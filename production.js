"use strict";

const STORAGE_KEY = "hota-production-planner-state";
const FORTIFICATION_LEVELS = new Set(["fort", "citadel", "castle"]);
const RESOURCE_ORDER = ["gold", "wood", "ore", "mercury", "sulfur", "crystal", "gem"];
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const TOWN_ORDER = [
  "castle", "rampart", "tower", "inferno", "necropolis", "dungeon",
  "stronghold", "fortress", "conflux", "cove", "factory", "bulwark",
];
const TOWN_NAMES = {
  castle: "Castle",
  rampart: "Rampart",
  tower: "Tower",
  inferno: "Inferno",
  necropolis: "Necropolis",
  dungeon: "Dungeon",
  stronghold: "Stronghold",
  fortress: "Fortress",
  conflux: "Conflux",
  cove: "Cove",
  factory: "Factory",
  bulwark: "Bulwark",
};
const state = {
  town: "castle",
  fortification: "fort",
  selections: [],
  hordeEnabled: [],
  externalDwellings: new Map(),
  rosters: new Map(),
  dwellingCatalog: new Map(),
  fortificationBuildings: new Map(),
};

let externalDwellingSearch = null;

const elements = {
  townSelect: document.querySelector("#town-select"),
  unitGrid: document.querySelector("#unit-grid"),
  externalDwellingGrid: document.querySelector("#external-dwelling-grid"),
  saveButton: document.querySelector("#save-state"),
  resetButton: document.querySelector("#reset-scheme"),
  emptyResults: document.querySelector("#empty-results"),
  tableWrap: document.querySelector("#results-table-wrap"),
  resultsBody: document.querySelector("#results-body"),
  resultContext: document.querySelector("#result-context"),
  totals: document.querySelector("#totals"),
  resourceTotals: document.querySelector("#resource-totals"),
  externalResultsSection: document.querySelector("#external-results-section"),
  externalResultsBody: document.querySelector("#external-results-body"),
  externalResultContext: document.querySelector("#external-result-context"),
  externalResourceTotals: document.querySelector("#external-resource-totals"),
  loadError: document.querySelector("#load-error"),
  citadelDetail: document.querySelector("#citadel-detail"),
  castleDetail: document.querySelector("#castle-detail"),
};

function formatNumber(value) {
  return NUMBER_FORMATTER.format(value);
}

function titleCase(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, function capitalize(letter) {
      return letter.toUpperCase();
    });
}

function stateName(stage) {
  if (stage < 0) return "None";
  if (stage === 0) return "Basic";
  if (stage === 1) return "Upgraded";
  if (stage === 2) return "Second upgrade";
  return "Upgrade " + stage;
}

function resourceSort(left, right) {
  return RESOURCE_ORDER.indexOf(left) - RESOURCE_ORDER.indexOf(right);
}

function resourceIcon(resource) {
  return (
    '<span class="resource-symbol">' +
      '<span class="resource-icon resource-icon-' +
      resource +
      '" aria-hidden="true"></span>' +
      '<span class="sr-only"> ' +
      resource +
      "</span>" +
    "</span>"
  );
}

function formatCost(cost) {
  const entries = Object.entries(cost)
    .filter(function positive(entry) {
      return entry[1] > 0;
    })
    .sort(function ordered(left, right) {
      return resourceSort(left[0], right[0]);
    });

  return entries
    .map(function costItem(entry, index) {
      return (
        '<span class="cost-item"><b>' +
        formatNumber(entry[1]) +
        "</b>" +
        resourceIcon(entry[0]) +
        (index < entries.length - 1
          ? '<span class="cost-separator" aria-hidden="true">,</span>'
          : "") +
        "</span>"
      );
    })
    .join(" ");
}

function multiplyCost(cost, quantity) {
  return Object.fromEntries(
    Object.entries(cost).map(function multiply(entry) {
      return [entry[0], entry[1] * quantity];
    }),
  );
}

function addCost(total, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    total[resource] = (total[resource] || 0) + amount;
  }
}

function hordeFor(slot) {
  return basicCreatureFor(slot)?.horde_building || null;
}

function externalDwellingCount(creatureName) {
  return state.externalDwellings.get(creatureName) || 0;
}

function setExternalDwellingCount(creatureName, value) {
  if (!state.dwellingCatalog.has(creatureName)) return;
  const count = normalizedExternalCount(value);
  if (count === 0) {
    state.externalDwellings.delete(creatureName);
  } else {
    state.externalDwellings.set(creatureName, count);
  }
}

function productionFor(growth, slot, slotIndex) {
  const horde = hordeFor(slot);
  const hordeBonus = state.hordeEnabled[slotIndex] && horde ? horde.growth_bonus : 0;
  const externalBonus = externalDwellingCount(basicCreatureFor(slot)?.name);
  const adjustedGrowth = growth + hordeBonus + externalBonus;
  if (state.fortification === "citadel") return Math.floor(adjustedGrowth * 1.5);
  if (state.fortification === "castle") return adjustedGrowth * 2;
  return adjustedGrowth;
}

function renderCardDetails(creature, slot, slotIndex) {
  if (!creature) return "";

  return (
    '<span class="production-detail">' +
    "<strong>" +
    formatNumber(productionFor(creature.growth, slot, slotIndex)) +
    "</strong>/week, </span>" +
    '<span class="cost-detail">' +
    formatCost(creature.cost) +
    "</span>"
  );
}

function dwellingSlots() {
  return state.rosters.get(state.town) || [];
}

function creatureUpgradeChain(rootCreature) {
  const creatures = [];
  const visited = new Set();
  let creature = rootCreature;

  while (creature) {
    if (visited.has(creature)) {
      throw new Error("Creature upgrade cycle found at " + creature.name);
    }
    if (
      creature.horde_building !== undefined &&
      (typeof creature.horde_building !== "object" ||
        Array.isArray(creature.horde_building))
    ) {
      throw new Error(creature.name + " has an invalid horde_building");
    }
    visited.add(creature);
    creatures.push(creature);
    const upgrade = creature.upgraded_creature;
    if (upgrade != null && (typeof upgrade !== "object" || Array.isArray(upgrade))) {
      throw new Error(creature.name + " has an invalid upgraded_creature");
    }
    creature = upgrade || null;
  }

  return creatures;
}

function availableSelections(slot) {
  return [-1].concat(
    slot.creatures.map(function selectionIndex(_, index) {
      return index;
    }),
  );
}

function creatureFor(slot, selection) {
  if (selection < 0) return null;
  return slot.creatures[selection] || null;
}

function nextSelection(slot, currentSelection) {
  const selections = availableSelections(slot);
  const currentIndex = selections.indexOf(currentSelection);
  return selections[(currentIndex + 1) % selections.length];
}

function basicCreatureFor(slot) {
  return slot.creatures[0] || null;
}

function serializedPlannerState() {
  return {
    town: state.town,
    fortification: state.fortification,
    dwellings: dwellingSlots().map(function serializeDwelling(slot, slotIndex) {
      const basicCreature = basicCreatureFor(slot);
      const selectedCreature = creatureFor(slot, state.selections[slotIndex]);
      return {
        basicCreature: basicCreature?.name || null,
        selectedCreature: selectedCreature?.name || null,
        hordeEnabled: Boolean(state.hordeEnabled[slotIndex]),
      };
    }),
    externalDwellings: Array.from(state.externalDwellings, function serializeExternal(entry) {
      return {
        basicCreature: entry[0],
        count: entry[1],
      };
    }),
  };
}

function persistPlannerState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedPlannerState()));
  } catch (_error) {
    // Storage may be disabled or unavailable for this origin, especially under file:// policies.
  }
}

function readPersistedPlannerState() {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const savedState = JSON.parse(serialized);
    if (
      !savedState ||
      typeof savedState.town !== "string"
    ) {
      return null;
    }
    return savedState;
  } catch (_error) {
    return null;
  }
}

function restorePlannerState(savedState) {
  if (!savedState || !state.rosters.has(savedState.town)) return false;

  state.town = savedState.town;
  state.fortification = FORTIFICATION_LEVELS.has(savedState.fortification)
    ? savedState.fortification
    : "fort";
  state.externalDwellings.clear();
  resetCreatureSelections();

  const savedDwellings = Array.isArray(savedState.dwellings) ? savedState.dwellings : [];
  const savedByBasicCreature = new Map(
    savedDwellings
      .filter(function usable(savedDwelling) {
        return savedDwelling && typeof savedDwelling.basicCreature === "string";
      })
      .map(function keyed(savedDwelling) {
        return [savedDwelling.basicCreature, savedDwelling];
      }),
  );

  dwellingSlots().forEach(function restoreDwelling(slot, slotIndex) {
    const basicCreature = basicCreatureFor(slot);
    const savedDwelling = savedByBasicCreature.get(basicCreature?.name);
    if (!savedDwelling) return;

    if (savedDwelling.selectedCreature === null) {
      state.selections[slotIndex] = -1;
    } else if (typeof savedDwelling.selectedCreature === "string") {
      const selection = slot.creatures.findIndex(function selected(creature) {
        return creature.name === savedDwelling.selectedCreature;
      });
      if (selection >= 0) state.selections[slotIndex] = selection;
    }

    state.hordeEnabled[slotIndex] = Boolean(
      savedDwelling.hordeEnabled &&
      state.selections[slotIndex] >= 0 &&
      hordeFor(slot),
    );
  });

  const savedExternalDwellings = Array.isArray(savedState.externalDwellings)
    ? savedState.externalDwellings
    : [];
  for (const savedExternal of savedExternalDwellings) {
    if (!savedExternal || typeof savedExternal.basicCreature !== "string") continue;
    setExternalDwellingCount(savedExternal.basicCreature, savedExternal.count);
  }

  // Migrate planner states saved before external dwellings became global.
  if (savedExternalDwellings.length === 0) {
    for (const savedDwelling of savedDwellings) {
      if (!savedDwelling || typeof savedDwelling.basicCreature !== "string") continue;
      setExternalDwellingCount(
        savedDwelling.basicCreature,
        savedDwelling.externalDwellings,
      );
    }
  }

  return true;
}

function syncFortificationControl() {
  const selectedRadio = document.querySelector(
    'input[name="fortification"][value="' + state.fortification + '"]',
  );
  if (selectedRadio) selectedRadio.checked = true;
}

function buildRosters(creaturesByFaction) {
  for (const [faction, creatureRoots] of Object.entries(creaturesByFaction)) {
    if (!Array.isArray(creatureRoots)) {
      throw new Error("Creature faction " + faction + " is not an array");
    }
    const slots = creatureRoots.map(function dwelling(rootCreature) {
      const slot = {
        faction: faction,
        tier: rootCreature.level,
        creatures: creatureUpgradeChain(rootCreature),
      };
      state.dwellingCatalog.set(rootCreature.name, {
        faction: faction,
        slot: slot,
      });
      return slot;
    });

    if (faction !== "neutral") state.rosters.set(faction, slots);
  }

  for (const [town, roster] of state.rosters) {
    for (let tier = 1; tier <= 7; tier += 1) {
      const tierSlots = roster.filter(function atTier(slot) {
        return slot.tier === tier;
      });
      const hasCompleteDwelling = tierSlots.some(function complete(slot) {
        return slot.creatures.length >= 2;
      });
      if (!hasCompleteDwelling) {
        state.rosters.delete(town);
        break;
      }
    }
  }
}

function indexFortificationBuildings(data) {
  for (const building of data.fortification_buildings || []) {
    state.fortificationBuildings.set(building.id, building);
  }
}

function renderFortificationDetails() {
  const citadel = state.fortificationBuildings.get("citadel");
  const castle = state.fortificationBuildings.get("castle");
  if (citadel) {
    elements.citadelDetail.innerHTML =
      '<span class="fortification-growth">1.5x growth, rounded down </span>' +
      '<span class="fortification-cost">' +
      formatCost(citadel.cost) +
      "</span>";
  }
  if (castle) {
    elements.castleDetail.innerHTML =
      '<span class="fortification-growth">2x growth </span>' +
      '<span class="fortification-cost">' +
      formatCost(castle.cost) +
      "</span>";
  }
}

function renderTownOptions() {
  const towns = Array.from(state.rosters.keys()).sort(function townSort(left, right) {
    const leftIndex = TOWN_ORDER.indexOf(left);
    const rightIndex = TOWN_ORDER.indexOf(right);
    if (leftIndex === -1 || rightIndex === -1) return left.localeCompare(right);
    return leftIndex - rightIndex;
  });

  elements.townSelect.innerHTML = towns
    .map(function townOption(town) {
      return (
        '<option value="' +
        town +
        '">' +
        (TOWN_NAMES[town] || titleCase(town)) +
        "</option>"
      );
    })
    .join("");

  if (!state.rosters.has(state.town)) state.town = towns[0];
  elements.townSelect.value = state.town;
  elements.townSelect.disabled = false;
}

function renderCards(slots) {
  elements.unitGrid.replaceChildren();

  slots.forEach(function renderSlot(slotData, slotIndex) {
    const tier = slotData.tier;
    const selection = state.selections[slotIndex];
    const creature = creatureFor(slotData, selection);
    const stage = selection;
    const horde = hordeFor(slotData);
    const followingSelection = nextSelection(slotData, selection);
    const followingCreature = creatureFor(slotData, followingSelection);
    const slot = document.createElement("div");
    const card = document.createElement("div");
    const cycleButton = document.createElement("button");
    slot.className = "unit-slot" + (horde ? " has-horde" : "");
    card.className = "unit-card";
    card.dataset.stage = String(stage);
    cycleButton.className = "unit-card-cycle";
    cycleButton.type = "button";
    cycleButton.dataset.slot = String(slotIndex);

    const basicCreature = basicCreatureFor(slotData);
    const creatureName = creature?.name || basicCreature?.name || "Unknown creature";
    const nextName = followingCreature?.name || "no unit";
    cycleButton.setAttribute(
      "aria-label",
      "Tier " +
        tier +
        ": " +
        creatureName +
        (creature ? ", " + stateName(stage).toLowerCase() : ", not produced") +
        ". Click for " +
        nextName +
        ".",
    );

    const detailCreature = creature || basicCreature;
    const details = renderCardDetails(detailCreature, slotData, slotIndex);

    cycleButton.innerHTML =
      '<span class="card-top">' +
      '<span class="tier-label">Tier ' +
      tier +
      "</span>" +
      '<span class="state-label" aria-hidden="true" title="' +
      stateName(stage) +
      '"></span>' +
      "</span>" +
      '<span class="creature-name">' +
      creatureName +
      "</span>" +
      '<span class="creature-details">' +
      details +
      "</span>";

    card.append(cycleButton);
    slot.append(card);

    const externalCreatureName = basicCreature?.name || creatureName;
    const externalCount = externalDwellingCount(externalCreatureName);
    const externalControl = document.createElement("div");
    externalControl.className = "external-dwelling-control";
    externalControl.innerHTML =
      '<span class="external-dwelling-icon" aria-hidden="true">🏠</span>' +
      '<button class="external-dwelling-button" type="button" data-external-action="decrement" data-slot="' +
      slotIndex +
      '" aria-label="Remove an external dwelling for ' +
      externalCreatureName +
      '"' +
      (externalCount === 0 ? " disabled" : "") +
      ">−</button>" +
      '<input class="external-dwelling-input" type="number" inputmode="numeric" min="0" max="99" placeholder="0" value="' +
      (externalCount || "") +
      '" data-slot="' +
      slotIndex +
      '" aria-label="External dwellings for ' +
      externalCreatureName +
      '">' +
      '<button class="external-dwelling-button" type="button" data-external-action="increment" data-slot="' +
      slotIndex +
      '" aria-label="Add an external dwelling for ' +
      externalCreatureName +
      '"' +
      (externalCount === 99 ? " disabled" : "") +
      ">+</button>" +
      '<button class="external-dwelling-button" type="button" data-external-action="reset" data-slot="' +
      slotIndex +
      '" aria-label="Reset external dwellings for ' +
      externalCreatureName +
      '"' +
      (externalCount === 0 ? " disabled" : "") +
      ">⟲</button>";
    card.append(externalControl);

    if (horde) {
      const toggle = document.createElement("label");
      const disabled = !creature;
      toggle.className = "horde-toggle" + (disabled ? " is-disabled" : "");
      toggle.innerHTML =
        '<input class="horde-checkbox" type="checkbox" data-slot="' +
        slotIndex +
        '"' +
        (state.hordeEnabled[slotIndex] ? " checked" : "") +
        (disabled ? " disabled" : "") +
        ">" +
        '<span class="toggle-indicator" aria-hidden="true"></span>' +
        '<span class="horde-copy"><strong>' +
        horde.name +
        "</strong><small>+" +
        horde.growth_bonus +
        " growth · " +
        formatCost(horde.cost) +
        "</small></span>";
      slot.append(toggle);
    }

    elements.unitGrid.append(slot);
  });
}

function renderExternalDwellingCards() {
  if (externalDwellingSearch) {
    externalDwellingSearch.destroy();
    externalDwellingSearch = null;
  }
  elements.externalDwellingGrid.replaceChildren();

  for (const [creatureName, count] of state.externalDwellings) {
    const dwelling = state.dwellingCatalog.get(creatureName);
    if (!dwelling) continue;
    const creature = basicCreatureFor(dwelling.slot);
    const slot = document.createElement("div");
    const card = document.createElement("div");
    const body = document.createElement("div");
    slot.className = "unit-slot external-dwelling-slot";
    card.className = "unit-card external-dwelling-card";
    card.dataset.stage = "0";
    card.dataset.creatureName = creatureName;
    card.dataset.count = String(count);
    body.className = "unit-card-cycle external-dwelling-card-body";
    body.innerHTML =
      '<span class="card-top">' +
      '<span class="tier-label">' +
      (TOWN_NAMES[dwelling.faction] || titleCase(dwelling.faction)) +
      " · Tier " +
      dwelling.slot.tier +
      "</span>" +
      '<button class="external-remove-button" type="button" aria-label="Remove all external dwellings for ' +
      creature.name +
      '"><svg class="external-remove-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6m0-6-6 6"></path></svg></button>' +
      "</span>" +
      '<span class="creature-name">' +
      creature.name +
      "</span>" +
      '<span class="creature-details">' +
      '<span class="production-detail"><strong>' +
      formatNumber(creature.growth * count) +
      "</strong>/week, </span>" +
      '<span class="cost-detail">' +
      formatCost(creature.cost) +
      "</span></span>";
    card.append(body);

    const control = document.createElement("div");
    control.className = "external-dwelling-control external-card-count-control";
    control.innerHTML =
      '<span class="external-dwelling-icon" aria-hidden="true">🏠</span>' +
      '<button class="external-dwelling-button" type="button" data-external-card-action="decrement" aria-label="Remove one external dwelling for ' +
      creature.name +
      '"' +
      (count <= 1 ? " disabled" : "") +
      ">−</button>" +
      '<input class="external-dwelling-input external-card-count-input" type="number" inputmode="numeric" min="1" max="99" value="' +
      count +
      '" aria-label="External dwellings for ' +
      creature.name +
      '">' +
      '<button class="external-dwelling-button" type="button" data-external-card-action="increment" aria-label="Add one external dwelling for ' +
      creature.name +
      '"' +
      (count >= 99 ? " disabled" : "") +
      ">+</button>";
    card.append(control);
    slot.append(card);
    elements.externalDwellingGrid.append(slot);
  }

  const addSlot = document.createElement("div");
  const addCard = document.createElement("div");
  const addBody = document.createElement("div");
  addSlot.className = "unit-slot external-dwelling-slot add-dwelling-slot";
  addCard.className = "unit-card add-dwelling-card";
  addBody.className = "unit-card-cycle add-dwelling-card-body";
  addBody.innerHTML =
    '<span class="card-top">' +
    '<span class="tier-label">New external dwelling</span>' +
    '<span class="add-dwelling-symbol" aria-hidden="true">+</span>' +
    "</span>" +
    '<span class="creature-name">Add a dwelling</span>' +
    '<label class="sr-only" for="external-dwelling-search">Search creatures</label>' +
    '<input class="external-dwelling-search-source" id="external-dwelling-search" type="search" placeholder="Creature name" autocomplete="off" aria-describedby="external-search-note">' +
    '<small class="external-search-note" id="external-search-note">Select to add one dwelling.</small>';
  addCard.append(addBody);
  addSlot.append(addCard);
  elements.externalDwellingGrid.append(addSlot);
  initializeExternalDwellingSearch();
}

function externalDwellingSearchData() {
  const options = [];
  const optgroups = new Map();

  for (const [creatureName, dwelling] of state.dwellingCatalog) {
    const factionName = TOWN_NAMES[dwelling.faction] || titleCase(dwelling.faction);
    if (!optgroups.has(dwelling.faction)) {
      optgroups.set(dwelling.faction, {
        value: dwelling.faction,
        label: factionName,
      });
    }
    options.push({
      value: creatureName,
      text: creatureName,
      faction: dwelling.faction,
      tier: dwelling.slot.tier,
    });
  }

  return {
    options: options,
    optgroups: Array.from(optgroups.values()),
  };
}

function initializeExternalDwellingSearch() {
  if (typeof window.TomSelect !== "function") {
    throw new Error("Tom Select failed to load");
  }

  const searchData = externalDwellingSearchData();
  externalDwellingSearch = new window.TomSelect("#external-dwelling-search", {
    options: searchData.options,
    optgroups: searchData.optgroups,
    valueField: "value",
    labelField: "text",
    searchField: ["text"],
    optgroupField: "faction",
    lockOptgroupOrder: true,
    maxItems: 1,
    maxOptions: null,
    create: false,
    closeAfterSelect: true,
    dropdownParent: "body",
    dropdownClass: "ts-dropdown external-dwelling-dropdown",
    render: {
      option: function renderSearchOption(option, escape) {
        return (
          '<div class="external-search-option"><strong>' +
          escape(option.text) +
          "</strong><small>Tier " +
          option.tier +
          "</small></div>"
        );
      },
      no_results: function renderNoSearchResults(search, escape) {
        return (
          '<div class="no-results">No creatures found for “' +
          escape(search.input) +
          "”</div>"
        );
      },
    },
    onInitialize: function labelSearchInput() {
      this.control_input.setAttribute("aria-label", "Search creatures");
      this.control_input.setAttribute("aria-describedby", "external-search-note");
    },
    onChange: function addSearchedDwelling(creatureName) {
      if (!creatureName) return;
      setExternalDwellingCount(
        creatureName,
        externalDwellingCount(creatureName) + 1,
      );
      const selectedSearch = this;
      queueMicrotask(function renderSelectedDwelling() {
        if (externalDwellingSearch === selectedSearch) render();
      });
    },
  });
}

function renderResultRow(name, detail, production, unitCost, weeklyCost) {
  return (
    "<tr>" +
      "<td><strong>" +
      name +
      "</strong><small>" +
      detail +
      "</small></td>" +
      "<td>" +
      formatNumber(production) +
      " <small>units</small></td>" +
      '<td><span class="cost-list">' +
      formatCost(unitCost) +
      "</span></td>" +
      '<td><span class="cost-list">' +
      formatCost(weeklyCost) +
      "</span></td>" +
    "</tr>"
  );
}

function renderResults(slots) {
  const rows = [];
  const totalsByResource = {};

  slots.forEach(function addResult(slotData, slotIndex) {
    const tier = slotData.tier;
    const selection = state.selections[slotIndex];
    const creature = creatureFor(slotData, selection);
    if (!creature) return;

    const activeHorde = state.hordeEnabled[slotIndex] ? hordeFor(slotData) : null;
    const production = productionFor(creature.growth, slotData, slotIndex);
    const weeklyCost = multiplyCost(creature.cost, production);
    addCost(totalsByResource, weeklyCost);

    const detail =
      "Tier " +
      tier +
      " · " +
      stateName(selection) +
      (activeHorde ? " · " + activeHorde.name : "");
    rows.push(renderResultRow(creature.name, detail, production, creature.cost, weeklyCost));
  });

  elements.resultContext.textContent =
    (TOWN_NAMES[state.town] || titleCase(state.town)) +
    " · " +
    titleCase(state.fortification);

  const hasResults = rows.length > 0;
  elements.emptyResults.hidden = hasResults;
  elements.tableWrap.hidden = !hasResults;
  elements.totals.hidden = !hasResults;

  if (!hasResults) {
    elements.resultsBody.replaceChildren();
    return;
  }

  elements.resultsBody.innerHTML = rows.join("");
  renderResourceTotals(elements.resourceTotals, totalsByResource);
}

function renderResourceTotals(container, totalsByResource) {
  container.innerHTML = Object.entries(totalsByResource)
    .sort(function ordered(left, right) {
      return resourceSort(left[0], right[0]);
    })
    .map(function resourceTotal(entry) {
      return (
        '<span class="resource-total"><strong>' +
        formatNumber(entry[1]) +
        "</strong>" +
        resourceIcon(entry[0]) +
        "</span>"
      );
    })
    .join("");
}

function renderExternalResults() {
  const rows = [];
  const totalsByResource = {};

  for (const [creatureName, dwellingCount] of state.externalDwellings) {
    const dwelling = state.dwellingCatalog.get(creatureName);
    if (!dwelling) continue;
    const basicCreature = basicCreatureFor(dwelling.slot);

    const production = basicCreature.growth * dwellingCount;
    const weeklyCost = multiplyCost(basicCreature.cost, production);
    addCost(totalsByResource, weeklyCost);

    const detail =
      "Tier " +
      dwelling.slot.tier +
      " · Basic · " +
      dwellingCount +
      " external dwelling" +
      (dwellingCount === 1 ? "" : "s");
    rows.push(
      renderResultRow(
        basicCreature.name,
        detail,
        production,
        basicCreature.cost,
        weeklyCost,
      ),
    );
  }

  const hasExternalResults = rows.length > 0;
  elements.externalResultsSection.hidden = !hasExternalResults;
  if (!hasExternalResults) {
    elements.externalResultsBody.replaceChildren();
    return;
  }

  elements.externalResultContext.textContent = "All factions · External dwellings";
  elements.externalResultsBody.innerHTML = rows.join("");
  renderResourceTotals(elements.externalResourceTotals, totalsByResource);
}

function render() {
  const slots = dwellingSlots();
  renderCards(slots);
  renderExternalDwellingCards();
  renderResults(slots);
  renderExternalResults();
}

function resetCreatureSelections() {
  const slotCount = dwellingSlots().length;
  state.selections = Array.from({ length: slotCount }, function defaultSelection(_, index) {
    return index === 0 ? 0 : -1;
  });
  state.hordeEnabled = Array(slotCount).fill(false);
}

function applyInitialPlannerState() {
  state.town = "castle";
  state.fortification = "fort";
  state.externalDwellings.clear();
  resetCreatureSelections();
}

function normalizedExternalCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isFinite(count)) return 0;
  return Math.min(99, Math.max(0, count));
}

elements.unitGrid.addEventListener("click", function cycleDwelling(event) {
  const cycleButton = event.target.closest(".unit-card-cycle");
  if (!cycleButton) return;
  const slotIndex = Number(cycleButton.dataset.slot);
  const slot = dwellingSlots()[slotIndex];
  state.selections[slotIndex] = nextSelection(slot, state.selections[slotIndex]);
  if (state.selections[slotIndex] < 0) state.hordeEnabled[slotIndex] = false;
  render();
});

elements.unitGrid.addEventListener("change", function toggleHorde(event) {
  if (!event.target.matches(".horde-checkbox")) return;
  const slotIndex = Number(event.target.dataset.slot);
  state.hordeEnabled[slotIndex] = event.target.checked;
  render();
});

elements.unitGrid.addEventListener("click", function adjustExternalDwelling(event) {
  const button = event.target.closest("[data-external-action]");
  if (!button) return;
  const slotIndex = Number(button.dataset.slot);
  const creatureName = basicCreatureFor(dwellingSlots()[slotIndex])?.name;
  const current = externalDwellingCount(creatureName);
  if (button.dataset.externalAction === "increment") {
    setExternalDwellingCount(creatureName, current + 1);
  } else if (button.dataset.externalAction === "decrement") {
    setExternalDwellingCount(creatureName, current - 1);
  } else {
    setExternalDwellingCount(creatureName, 0);
  }
  render();
});

elements.unitGrid.addEventListener("change", function setSchemeExternalDwellingCount(event) {
  if (!event.target.matches(".external-dwelling-input")) return;
  const slotIndex = Number(event.target.dataset.slot);
  const creatureName = basicCreatureFor(dwellingSlots()[slotIndex])?.name;
  setExternalDwellingCount(creatureName, event.target.value);
  render();
});

elements.externalDwellingGrid.addEventListener("click", function adjustExternalCard(event) {
  const card = event.target.closest(".external-dwelling-card");
  if (!card) return;
  const creatureName = card.dataset.creatureName;

  if (event.target.closest(".external-remove-button")) {
    setExternalDwellingCount(creatureName, 0);
    render();
    return;
  }

  const button = event.target.closest("[data-external-card-action]");
  if (!button) return;
  const current = externalDwellingCount(creatureName);
  if (button.dataset.externalCardAction === "increment") {
    setExternalDwellingCount(creatureName, current + 1);
  } else if (current > 1) {
    setExternalDwellingCount(creatureName, current - 1);
  }
  render();
});

elements.externalDwellingGrid.addEventListener("change", function setExternalCardCount(event) {
  if (!event.target.matches(".external-card-count-input")) return;
  const card = event.target.closest(".external-dwelling-card");
  const count = Math.max(1, normalizedExternalCount(event.target.value));
  setExternalDwellingCount(card.dataset.creatureName, count);
  render();
});

elements.townSelect.addEventListener("change", function changeTown() {
  state.town = elements.townSelect.value;
  resetCreatureSelections();
  render();
});

document.querySelectorAll('input[name="fortification"]').forEach(function register(radio) {
  radio.addEventListener("change", function changeFortification() {
    state.fortification = radio.value;
    render();
  });
});

elements.saveButton.addEventListener("click", function savePlannerState() {
  persistPlannerState();
});

elements.resetButton.addEventListener("click", function resetScheme() {
  const restored = restorePlannerState(readPersistedPlannerState());
  if (!restored) applyInitialPlannerState();
  elements.townSelect.value = state.town;
  syncFortificationControl();
  render();
});

function initializePlanner(data) {
  if (
    !data.creatures ||
    typeof data.creatures !== "object" ||
    Array.isArray(data.creatures)
  ) {
    throw new Error("Creature data is missing its faction groups");
  }
  indexFortificationBuildings(data);
  buildRosters(data.creatures);
  const restored = restorePlannerState(readPersistedPlannerState());
  if (!restored) applyInitialPlannerState();
  renderTownOptions();
  syncFortificationControl();
  renderFortificationDetails();
  render();
}

function showLoadError(error, context) {
  elements.loadError.hidden = false;
  elements.loadError.textContent = context + ": " + error.message;
}

const embeddedData = document.querySelector("#creature-data");
if (embeddedData) {
  try {
    initializePlanner(JSON.parse(embeddedData.textContent));
  } catch (error) {
    showLoadError(error, "Could not load embedded creature data");
  }
} else {
  fetch("creatures.json")
    .then(function checkResponse(response) {
      if (!response.ok) {
        throw new Error("Creature data returned HTTP " + response.status);
      }
      return response.json();
    })
    .then(initializePlanner)
    .catch(function showFetchError(error) {
      showLoadError(
        error,
        "Could not load creatures.json. Run ./serve_production.sh and open the local URL it prints",
      );
    });
}
