"use strict";

const STORAGE_KEY = "hota-production-planner-state";
const FORTIFICATION_LEVELS = new Set(["fort", "citadel", "castle"]);
const RESOURCE_ORDER = ["gold", "wood", "ore", "mercury", "sulfur", "crystal", "gem"];
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
  externalDwellings: [],
  rosters: new Map(),
  hordeBuildings: new Map(),
  fortificationBuildings: new Map(),
};

const elements = {
  townSelect: document.querySelector("#town-select"),
  unitGrid: document.querySelector("#unit-grid"),
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
  return new Intl.NumberFormat("en-US").format(value);
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

function hordeFor(tier) {
  return state.hordeBuildings.get(state.town + ":" + tier) || null;
}

function productionFor(growth, tier, slotIndex) {
  const horde = hordeFor(tier);
  const hordeBonus = state.hordeEnabled[slotIndex] && horde ? horde.growth_bonus : 0;
  const externalBonus = state.externalDwellings[slotIndex] || 0;
  const adjustedGrowth = growth + hordeBonus + externalBonus;
  if (state.fortification === "citadel") return Math.floor(adjustedGrowth * 1.5);
  if (state.fortification === "castle") return adjustedGrowth * 2;
  return adjustedGrowth;
}

function dwellingSlots() {
  const roster = state.rosters.get(state.town);
  const slots = [];
  if (!roster) return slots;

  const tiers = Array.from(roster.keys()).sort(function tierSort(left, right) {
    return left - right;
  });
  for (const tier of tiers) {
    let slot = null;
    for (const creature of roster.get(tier) || []) {
      if (!slot || creature.upgrade_stage === 0) {
        slot = { tier: tier, creatures: [] };
        slots.push(slot);
      }
      slot.creatures.push(creature);
    }
  }
  return slots;
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
  return slot.creatures.find(function basic(creature) {
    return creature.upgrade_stage === 0;
  }) || null;
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
        externalDwellings: state.externalDwellings[slotIndex] || 0,
      };
    }),
  };
}

function persistPlannerState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedPlannerState()));
    return true;
  } catch (_error) {
    // Storage may be disabled or unavailable for this origin, especially under file:// policies.
    return false;
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

    state.externalDwellings[slotIndex] = normalizedExternalCount(
      savedDwelling.externalDwellings,
    );
    state.hordeEnabled[slotIndex] = Boolean(
      savedDwelling.hordeEnabled &&
      state.selections[slotIndex] >= 0 &&
      hordeFor(slot.tier),
    );
  });

  return true;
}

function syncFortificationControl() {
  const selectedRadio = document.querySelector(
    'input[name="fortification"][value="' + state.fortification + '"]',
  );
  if (selectedRadio) selectedRadio.checked = true;
}

function buildRosters(creatures) {
  const townCreatures = creatures.filter(function usable(creature) {
    return creature.town !== "neutral";
  });

  for (const creature of townCreatures) {
    if (!state.rosters.has(creature.town)) state.rosters.set(creature.town, new Map());
    const roster = state.rosters.get(creature.town);
    if (!roster.has(creature.level)) roster.set(creature.level, []);
    roster.get(creature.level).push(creature);
  }

  for (const [town, roster] of state.rosters) {
    for (let tier = 1; tier <= 7; tier += 1) {
      const creaturesForTier = roster.get(tier) || [];
      const hasBasic = creaturesForTier.some(function basic(creature) {
        return creature.upgrade_stage === 0;
      });
      const hasUpgrade = creaturesForTier.some(function upgraded(creature) {
        return creature.upgrade_stage === 1;
      });
      if (!hasBasic || !hasUpgrade) {
        state.rosters.delete(town);
        break;
      }
    }
  }
}

function indexSharedBuildings(data) {
  for (const building of data.horde_buildings || []) {
    state.hordeBuildings.set(building.town + ":" + building.creature_level, building);
  }
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
      "&nbsp;to build</span>";
  }
  if (castle) {
    elements.castleDetail.innerHTML =
      '<span class="fortification-growth">2x growth </span>' +
      '<span class="fortification-cost">' +
      formatCost(castle.cost) +
      "&nbsp;to build</span>";
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

function renderCards() {
  elements.unitGrid.replaceChildren();
  const slots = dwellingSlots();

  slots.forEach(function renderSlot(slotData, slotIndex) {
    const tier = slotData.tier;
    const selection = state.selections[slotIndex];
    const creature = creatureFor(slotData, selection);
    const stage = creature?.upgrade_stage ?? -1;
    const horde = hordeFor(tier);
    const followingSelection = nextSelection(slotData, selection);
    const followingCreature = creatureFor(slotData, followingSelection);
    const slot = document.createElement("div");
    const card = document.createElement("button");
    slot.className = "unit-slot" + (horde ? " has-horde" : "");
    card.className = "unit-card";
    card.type = "button";
    card.dataset.slot = String(slotIndex);
    card.dataset.tier = String(tier);
    card.dataset.stage = String(stage);

    const basicCreature = basicCreatureFor(slotData);
    const creatureName = creature?.name || basicCreature?.name || "Unknown creature";
    const nextName = followingCreature?.name || "no unit";
    card.setAttribute(
      "aria-label",
      "Tier " +
        tier +
        ": " +
        creatureName +
        (creature ? "" : ", not produced") +
        ". Click for " +
        nextName +
        ".",
    );

    let details = basicCreature
        ? '<span class="inactive-details">' +
          '<span class="production-detail">(<strong>' +
          formatNumber(productionFor(basicCreature.growth, tier, slotIndex)) +
          "</strong> per week, </span>" +
          '<span class="cost-detail">' +
          formatCost(basicCreature.cost) +
          " each)</span></span>"
        : "";
    if (creature) {
      details =
        '<span class="production-detail"><strong>' +
        formatNumber(productionFor(creature.growth, tier, slotIndex)) +
        "</strong> per week</span>" +
        '<span class="cost-detail">' +
        formatCost(creature.cost) +
        " each</span>";
    }

    card.innerHTML =
      '<span class="card-top">' +
      '<span class="tier-label">Tier ' +
      tier +
      "</span>" +
      '<span class="state-label">' +
      stateName(stage) +
      "</span>" +
      "</span>" +
      '<span class="creature-name">' +
      creatureName +
      "</span>" +
      '<span class="creature-details">' +
      details +
      "</span>";

    slot.append(card);

    const externalCount = state.externalDwellings[slotIndex] || 0;
    const externalControl = document.createElement("div");
    externalControl.className = "external-dwelling-control";
    externalControl.innerHTML =
      '<span class="external-dwelling-icon" aria-hidden="true">🏠</span>' +
      '<button class="external-dwelling-button" type="button" data-external-action="decrement" data-slot="' +
      slotIndex +
      '" aria-label="Remove an external dwelling for ' +
      creatureName +
      '"' +
      (externalCount === 0 ? " disabled" : "") +
      ">−</button>" +
      '<input class="external-dwelling-input" type="number" inputmode="numeric" min="0" max="99" placeholder="0" value="' +
      (externalCount || "") +
      '" data-slot="' +
      slotIndex +
      '" aria-label="External dwellings for ' +
      creatureName +
      '">' +
      '<button class="external-dwelling-button" type="button" data-external-action="increment" data-slot="' +
      slotIndex +
      '" aria-label="Add an external dwelling for ' +
      creatureName +
      '"' +
      (externalCount === 99 ? " disabled" : "") +
      ">+</button>" +
      '<button class="external-dwelling-button external-dwelling-reset" type="button" data-external-action="reset" data-slot="' +
      slotIndex +
      '" aria-label="Reset external dwellings for ' +
      creatureName +
      '"' +
      (externalCount === 0 ? " disabled" : "") +
      ">⟲</button>";
    slot.append(externalControl);

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
        "&nbsp;to build</small></span>";
      slot.append(toggle);
    }

    elements.unitGrid.append(slot);
  });
}

function renderResults() {
  const rows = [];
  const totalsByResource = {};

  dwellingSlots().forEach(function addResult(slotData, slotIndex) {
    const tier = slotData.tier;
    const selection = state.selections[slotIndex];
    const creature = creatureFor(slotData, selection);
    if (!creature) return;

    const activeHorde = state.hordeEnabled[slotIndex] ? hordeFor(tier) : null;
    const production = productionFor(creature.growth, tier, slotIndex);
    const weeklyCost = multiplyCost(creature.cost, production);
    addCost(totalsByResource, weeklyCost);

    rows.push(
      "<tr>" +
        "<td><strong>" +
        creature.name +
        "</strong><small>Tier " +
        tier +
        " · " +
        stateName(creature.upgrade_stage) +
        (activeHorde ? " · " + activeHorde.name : "") +
        "</small></td>" +
        "<td>" +
        formatNumber(production) +
        " <small>units</small></td>" +
        '<td><span class="cost-list">' +
        formatCost(creature.cost) +
        "</span></td>" +
        '<td><span class="cost-list">' +
        formatCost(weeklyCost) +
        "</span></td>" +
      "</tr>",
    );
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
        '</strong><span class="resource-total-label">' +
        resourceIcon(entry[0]) +
        "</span></span>"
      );
    })
    .join("");
}

function renderExternalResults() {
  const rows = [];
  const totalsByResource = {};

  dwellingSlots().forEach(function addExternalResult(slotData, slotIndex) {
    const dwellingCount = state.externalDwellings[slotIndex] || 0;
    if (dwellingCount === 0) return;

    const basicCreature = basicCreatureFor(slotData);
    if (!basicCreature) return;

    const production = basicCreature.growth * dwellingCount;
    const weeklyCost = multiplyCost(basicCreature.cost, production);
    addCost(totalsByResource, weeklyCost);

    rows.push(
      "<tr>" +
        "<td><strong>" +
        basicCreature.name +
        "</strong><small>Tier " +
        slotData.tier +
        " · Basic · " +
        dwellingCount +
        " external dwelling" +
        (dwellingCount === 1 ? "" : "s") +
        "</small></td>" +
        "<td>" +
        formatNumber(production) +
        " <small>units</small></td>" +
        '<td><span class="cost-list">' +
        formatCost(basicCreature.cost) +
        "</span></td>" +
        '<td><span class="cost-list">' +
        formatCost(weeklyCost) +
        "</span></td>" +
      "</tr>",
    );
  });

  const hasExternalResults = rows.length > 0;
  elements.externalResultsSection.hidden = !hasExternalResults;
  if (!hasExternalResults) {
    elements.externalResultsBody.replaceChildren();
    return;
  }

  elements.externalResultContext.textContent =
    (TOWN_NAMES[state.town] || titleCase(state.town)) + " · External dwellings";
  elements.externalResultsBody.innerHTML = rows.join("");
  renderResourceTotals(elements.externalResourceTotals, totalsByResource);
}

function render() {
  renderCards();
  renderResults();
  renderExternalResults();
}

function resetCreatureSelections() {
  const slotCount = dwellingSlots().length;
  state.selections = Array.from({ length: slotCount }, function defaultSelection(_, index) {
    return index === 0 ? 0 : -1;
  });
  state.hordeEnabled = Array(slotCount).fill(false);
  state.externalDwellings = Array(slotCount).fill(0);
}

function applyInitialPlannerState() {
  state.town = "castle";
  state.fortification = "fort";
  resetCreatureSelections();
}

function normalizedExternalCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isFinite(count)) return 0;
  return Math.min(99, Math.max(0, count));
}

elements.unitGrid.addEventListener("click", function cycleDwelling(event) {
  const card = event.target.closest(".unit-card");
  if (!card) return;
  const slotIndex = Number(card.dataset.slot);
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
  const current = state.externalDwellings[slotIndex] || 0;
  if (button.dataset.externalAction === "increment") {
    state.externalDwellings[slotIndex] = normalizedExternalCount(current + 1);
  } else if (button.dataset.externalAction === "decrement") {
    state.externalDwellings[slotIndex] = normalizedExternalCount(current - 1);
  } else {
    state.externalDwellings[slotIndex] = 0;
  }
  render();
});

elements.unitGrid.addEventListener("change", function setExternalDwellingCount(event) {
  if (!event.target.matches(".external-dwelling-input")) return;
  const slotIndex = Number(event.target.dataset.slot);
  state.externalDwellings[slotIndex] = normalizedExternalCount(event.target.value);
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
  if (!Array.isArray(data.creatures)) {
    throw new Error("Creature data is missing its creatures array");
  }
  buildRosters(data.creatures);
  indexSharedBuildings(data);
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
