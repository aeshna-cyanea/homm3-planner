import Alpine from "alpinejs";
import persist from "@alpinejs/persist";
import AutoComplete from "@tarekraafat/autocomplete.js";
import createAutoCompletePositionPlugin from "./autocomplete-position-plugin.js";
import initializeServiceWorker from "./service-worker.js";

initializeServiceWorker();

const STORAGE_KEY = "hota-production-planner-state";
const GITHUB_URL = "https://github.com/aeshna-cyanea/homm3-planner";
const COMMIT_HASH = import.meta.env.VITE_GIT_COMMIT_HASH;
const FORTIFICATION_LEVELS = ["fort", "citadel", "castle"];
const FORTIFICATION_COPY = {
  fort: { name: "Fort", growth: "Base growth" },
  citadel: { name: "Citadel", growth: "1.5x growth, rounded down" },
  castle: { name: "Castle", growth: "2x growth" },
};
const RESOURCE_ORDER = ["gold", "wood", "ore", "mercury", "sulfur", "crystal", "gem"];
const STAGE_NAMES = {
  [-1]: "None",
  0: "Basic",
  1: "Upgraded",
  2: "Second upgrade",
};
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const SAFE_STORAGE = {
  getItem(key) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) JSON.parse(value);
      return value;
    } catch (_error) {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_error) {
      // Persistence is optional when storage is blocked or unavailable.
    }
  },
};

let catalog = null;
let externalDwellingSearch = null;
let pendingSearchFocus = false;

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

function costEntries(cost) {
  return Object.entries(cost || {})
    .filter(function positive(entry) {
      return entry[1] > 0;
    })
    .sort(function ordered(left, right) {
      return resourceSort(left[0], right[0]);
    });
}

function formatCost(cost) {
  const entries = costEntries(cost);
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

function buildCatalog(data) {
  if (!Array.isArray(data.towns)) throw new Error("Creature data is missing its towns");

  const dwellingCatalog = new Map();
  for (const town of data.towns) {
    for (const dwelling of town.dwellings) {
      const creature = basicCreatureFor(dwelling);
      dwellingCatalog.set(creature.name, {
        factionName: town.name,
        creature,
        tier: dwelling.tier,
        growth: dwelling.growth,
      });
    }
  }
  for (const creature of data.neutral_creatures || []) {
    dwellingCatalog.set(creature.name, {
      factionName: "Neutral",
      creature,
      tier: creature.tier,
      growth: creature.growth,
    });
  }
  return {
    towns: data.towns,
    dwellingCatalog,
    fortificationBuildings: data.fortification_buildings || [],
    townOptions: data.towns.map(function townName(town) {
      return town.name;
    }),
  };
}

function townFor(name) {
  return catalog?.towns.find(function matchingTown(town) {
    return town.name === name;
  }) || null;
}

function basicCreatureFor(slot) {
  return slot?.variants[0] || null;
}

function creatureFor(slot, selection) {
  if (!slot || selection < 0) return null;
  return slot.variants[selection] || null;
}

function hordeFor(slot) {
  return slot?.horde || null;
}

function availableSelections(slot) {
  return [-1].concat(
    slot.variants.map(function selectionIndex(_, index) {
      return index;
    }),
  );
}

function nextSelection(slot, currentSelection) {
  const selections = availableSelections(slot);
  const currentIndex = selections.indexOf(currentSelection);
  return selections[(currentIndex + 1) % selections.length];
}

function normalizedExternalCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isFinite(count)) return 0;
  return Math.min(99, Math.max(0, count));
}

function createPlannerStore() {
  return {
    ready: false,
    loadError: "",
    townOptions: [],
    townPlans: [
      {
        id: "town-1",
        town: "Castle",
        fortification: "fort",
        selections: [],
        hordeEnabled: [],
      },
    ],
    externalDwellings: [],
    savedState: Alpine.$persist(null).as(STORAGE_KEY).using(SAFE_STORAGE),
    fortificationCopy: FORTIFICATION_COPY,
    githubUrl: GITHUB_URL,
    commitHash: COMMIT_HASH,

    get commitUrl() {
      return this.githubUrl + "/commit/" + this.commitHash;
    },

    get activePlan() {
      return this.townPlans[0];
    },

    initialize(data) {
      catalog = buildCatalog(data);
      this.townOptions = catalog.townOptions;
      if (!this.restore(this.savedState)) this.applyInitialState();
    },

    mount() {
      Alpine.nextTick(() => {
        initializeExternalDwellingSearch(this);
        this.ready = true;
      });
    },

    createPlan(town = "Castle", id = "town-1") {
      const resolvedTown = townFor(town) || catalog.towns[0];
      const slots = resolvedTown?.dwellings || [];
      return {
        id,
        town: resolvedTown.name,
        fortification: "fort",
        selections: slots.map(function defaultSelection(_, index) {
          return index === 0 ? 0 : -1;
        }),
        hordeEnabled: Array(slots.length).fill(false),
      };
    },

    applyInitialState() {
      this.townPlans = [this.createPlan("Castle")];
      this.externalDwellings = [];
    },

    restore(savedState) {
      if (!savedState || !Array.isArray(savedState.townPlans)) return false;

      const restoredPlans = savedState.townPlans.flatMap((savedPlan, planIndex) => {
        if (!savedPlan || !townFor(savedPlan.town)) return [];
        const plan = this.createPlan(
          savedPlan.town,
          typeof savedPlan.id === "string" ? savedPlan.id : "town-" + (planIndex + 1),
        );
        plan.fortification = FORTIFICATION_LEVELS.includes(savedPlan.fortification)
          ? savedPlan.fortification
          : "fort";
        const savedDwellings = Array.isArray(savedPlan.dwellings)
          ? savedPlan.dwellings
          : [];

        this.slots(plan).forEach(function restoreDwelling(slot, slotIndex) {
          const basicCreatureName = basicCreatureFor(slot)?.name;
          const savedDwelling = savedDwellings.find(function matchingDwelling(dwelling) {
            return dwelling?.basicCreature === basicCreatureName;
          });
          if (!savedDwelling) return;

          if (savedDwelling.selectedCreature === null) {
            plan.selections[slotIndex] = -1;
          } else if (typeof savedDwelling.selectedCreature === "string") {
            const selection = slot.variants.findIndex(function selected(creature) {
              return creature.name === savedDwelling.selectedCreature;
            });
            if (selection >= 0) plan.selections[slotIndex] = selection;
          }

          plan.hordeEnabled[slotIndex] = Boolean(
            savedDwelling.hordeEnabled &&
            plan.selections[slotIndex] >= 0 &&
            hordeFor(slot),
          );
        });
        return [plan];
      });
      if (restoredPlans.length === 0) return false;

      this.townPlans = restoredPlans;
      this.externalDwellings = [];
      const savedExternalDwellings = Array.isArray(savedState.externalDwellings)
        ? savedState.externalDwellings
        : [];
      for (const savedExternal of savedExternalDwellings) {
        if (!savedExternal || typeof savedExternal.basicCreature !== "string") continue;
        this.setExternalDwellingCount(savedExternal.basicCreature, savedExternal.count);
      }
      return true;
    },

    serialize() {
      return {
        townPlans: this.townPlans.map((plan) => {
          return {
            id: plan.id,
            town: plan.town,
            fortification: plan.fortification,
            dwellings: this.slots(plan).map(function serializeDwelling(slot, slotIndex) {
              return {
                basicCreature: basicCreatureFor(slot)?.name || null,
                selectedCreature: creatureFor(slot, plan.selections[slotIndex])?.name || null,
                hordeEnabled: Boolean(plan.hordeEnabled[slotIndex]),
              };
            }),
          };
        }),
        externalDwellings: this.externalDwellings.map(function serializeExternal(entry) {
          return { basicCreature: entry.basicCreature, count: entry.count };
        }),
      };
    },

    save() {
      this.savedState = JSON.parse(JSON.stringify(this.serialize()));
    },

    reset() {
      if (!this.restore(this.savedState)) this.applyInitialState();
    },

    slots(plan = this.activePlan) {
      return townFor(plan?.town)?.dwellings || [];
    },

    changeTown(plan, town) {
      const replacement = this.createPlan(town);
      plan.town = replacement.town;
      plan.selections = replacement.selections;
      plan.hordeEnabled = replacement.hordeEnabled;
    },

    cycleFortification(plan) {
      const currentIndex = FORTIFICATION_LEVELS.indexOf(plan.fortification);
      plan.fortification =
        FORTIFICATION_LEVELS[(currentIndex + 1) % FORTIFICATION_LEVELS.length];
    },

    nextFortification(plan) {
      const currentIndex = FORTIFICATION_LEVELS.indexOf(plan.fortification);
      return FORTIFICATION_LEVELS[(currentIndex + 1) % FORTIFICATION_LEVELS.length];
    },

    cycleDwelling(plan, slotIndex) {
      const slot = this.slots(plan)[slotIndex];
      plan.selections[slotIndex] = nextSelection(slot, plan.selections[slotIndex]);
      if (plan.selections[slotIndex] < 0) plan.hordeEnabled[slotIndex] = false;
    },

    toggleHorde(plan, slotIndex, enabled) {
      const slot = this.slots(plan)[slotIndex];
      plan.hordeEnabled[slotIndex] = Boolean(
        enabled && this.creatureFor(plan, slotIndex) && hordeFor(slot),
      );
    },

    creatureFor(plan, slotIndex) {
      return creatureFor(this.slots(plan)[slotIndex], plan.selections[slotIndex]);
    },

    basicCreatureFor(slot) {
      return basicCreatureFor(slot);
    },

    detailCreature(plan, slotIndex) {
      return this.creatureFor(plan, slotIndex) || basicCreatureFor(this.slots(plan)[slotIndex]);
    },

    hordeFor(slot) {
      return hordeFor(slot);
    },

    creatureName(plan, slotIndex) {
      return this.creatureFor(plan, slotIndex)?.name ||
        basicCreatureFor(this.slots(plan)[slotIndex])?.name ||
        "Unknown creature";
    },

    nextCreatureName(plan, slotIndex) {
      const slot = this.slots(plan)[slotIndex];
      return creatureFor(slot, nextSelection(slot, plan.selections[slotIndex]))?.name || "no unit";
    },

    stageNames: STAGE_NAMES,

    cardAriaLabel(plan, slotIndex) {
      const slot = this.slots(plan)[slotIndex];
      const creature = this.creatureFor(plan, slotIndex);
      return (
        "Tier " +
        slot.tier +
        ": " +
        this.creatureName(plan, slotIndex) +
        (creature
          ? ", " + STAGE_NAMES[plan.selections[slotIndex]].toLowerCase()
          : ", not produced") +
        ". Click for " +
        this.nextCreatureName(plan, slotIndex) +
        "."
      );
    },

    externalDwellingCount(creatureName) {
      return this.externalDwellings.find(function matches(entry) {
        return entry.basicCreature === creatureName;
      })?.count || 0;
    },

    setExternalDwellingCount(creatureName, value) {
      if (!catalog?.dwellingCatalog.has(creatureName)) return 0;
      const count = normalizedExternalCount(value);
      const index = this.externalDwellings.findIndex(function matches(entry) {
        return entry.basicCreature === creatureName;
      });
      if (count === 0) {
        if (index >= 0) this.externalDwellings.splice(index, 1);
      } else if (index >= 0) {
        this.externalDwellings[index].count = count;
      } else {
        this.externalDwellings.push({ basicCreature: creatureName, count });
      }
      return count;
    },

    adjustExternalDwelling(creatureName, action) {
      const current = this.externalDwellingCount(creatureName);
      if (action === "increment") {
        this.setExternalDwellingCount(creatureName, current + 1);
      } else if (action === "decrement") {
        this.setExternalDwellingCount(creatureName, current - 1);
      } else {
        this.setExternalDwellingCount(creatureName, 0);
      }
    },

    adjustExternalCard(creatureName, action) {
      const current = this.externalDwellingCount(creatureName);
      if (action === "increment") {
        this.setExternalDwellingCount(creatureName, current + 1);
      } else if (current > 1) {
        this.setExternalDwellingCount(creatureName, current - 1);
      }
    },

    setExternalCardCount(creatureName, value) {
      return this.setExternalDwellingCount(
        creatureName,
        Math.max(1, normalizedExternalCount(value)),
      );
    },

    addExternalDwelling(creatureName) {
      this.setExternalDwellingCount(
        creatureName,
        this.externalDwellingCount(creatureName) + 1,
      );
    },

    productionFor(plan, slotIndex) {
      const slot = this.slots(plan)[slotIndex];
      const horde = hordeFor(slot);
      const hordeBonus = plan.hordeEnabled[slotIndex] && horde ? horde.growth_bonus : 0;
      const externalBonus = this.externalDwellingCount(basicCreatureFor(slot)?.name);
      const adjustedGrowth = slot.growth + hordeBonus + externalBonus;
      if (plan.fortification === "citadel") return Math.floor(adjustedGrowth * 1.5);
      if (plan.fortification === "castle") return adjustedGrowth * 2;
      return adjustedGrowth;
    },

    get productionRows() {
      const plan = this.activePlan;
      return this.slots(plan).flatMap((slot, slotIndex) => {
        const selection = plan.selections[slotIndex];
        const creature = creatureFor(slot, selection);
        if (!creature) return [];
        const activeHorde = plan.hordeEnabled[slotIndex] ? hordeFor(slot) : null;
        const production = this.productionFor(plan, slotIndex);
        return [{
          name: creature.name,
          detail:
            "Tier " +
            slot.tier +
            " · " +
            STAGE_NAMES[selection] +
            (activeHorde ? " · " + activeHorde.name : ""),
          production,
          unitCost: creature.cost,
          weeklyCost: multiplyCost(creature.cost, production),
        }];
      });
    },

    get externalDwellingCards() {
      return this.externalDwellings.flatMap(function card(entry) {
        const dwelling = catalog.dwellingCatalog.get(entry.basicCreature);
        if (!dwelling) return [];
        return [{
          creatureName: entry.basicCreature,
          count: entry.count,
          creature: dwelling.creature,
          factionName: dwelling.factionName,
          tier: dwelling.tier,
          production: dwelling.growth * entry.count,
        }];
      });
    },

    get externalRows() {
      return this.externalDwellingCards.map(function row(card) {
        return {
          name: card.creature.name,
          detail:
            "Tier " +
            card.tier +
            " · Basic · " +
            card.count +
            " external dwelling" +
            (card.count === 1 ? "" : "s"),
          production: card.production,
          unitCost: card.creature.cost,
          weeklyCost: multiplyCost(card.creature.cost, card.production),
        };
      });
    },

    totalsFor(rows) {
      const totals = {};
      for (const row of rows) addCost(totals, row.weeklyCost);
      return costEntries(totals);
    },

    get productionTotals() {
      return this.totalsFor(this.productionRows);
    },

    get externalTotals() {
      return this.totalsFor(this.externalRows);
    },

    get resultContext() {
      return this.activePlan.town + " · " + titleCase(this.activePlan.fortification);
    },

    fortificationCost(level) {
      return catalog?.fortificationBuildings.find(function matchingBuilding(building) {
        return building.id === level;
      })?.cost || null;
    },

    formatNumber,
    formatCost,
  };
}

function externalDwellingSearchData() {
  const options = [];
  for (const [creatureName, dwelling] of catalog.dwellingCatalog) {
    options.push({
      name: creatureName,
      faction: dwelling.factionName,
      tier: dwelling.tier,
    });
  }
  return options;
}

function initializeExternalDwellingSearch(planner) {
  if (externalDwellingSearch) return;
  const searchInput = document.querySelector("#external-dwelling-search");
  if (!searchInput) return;
  const searchData = externalDwellingSearchData();
  const positionPlugin = createAutoCompletePositionPlugin({
    aboveClass: "is-above",
    gap: 8,
    selectFirstOnEnter: true,
  });

  externalDwellingSearch = new AutoComplete(positionPlugin.configure({
    selector: function selectExternalDwellingSearch() {
      return searchInput;
    },
    data: {
      src: searchData,
      keys: ["name"],
      cache: true,
    },
    threshold: 1,
    resultsList: {
      class: "external-dwelling-dropdown",
      maxResults: searchData.length,
      noResults: true,
      element: function renderNoSearchResults(list, data) {
        if (data.results.length === 0) {
          const message = document.createElement("p");
          message.className = "no-results";
          message.setAttribute("role", "status");
          message.textContent = 'No creatures found for “' + data.query + '”';
          list.append(message);
        }
      },
    },
    resultItem: {
      class: "external-search-result",
      selected: "is-selected",
      element: function renderSearchOption(item, result) {
        const option = document.createElement("span");
        const name = document.createElement("strong");
        const detail = document.createElement("small");
        const creatureName = result.value.name;
        const query = searchInput.value.toLocaleLowerCase();
        const matchIndex = creatureName.toLocaleLowerCase().indexOf(query);
        option.className = "external-search-option";
        if (query && matchIndex >= 0) {
          const highlight = document.createElement("mark");
          highlight.className = "external-search-highlight";
          highlight.textContent = creatureName.slice(matchIndex, matchIndex + query.length);
          name.append(
            creatureName.slice(0, matchIndex),
            highlight,
            creatureName.slice(matchIndex + query.length),
          );
        } else {
          name.textContent = creatureName;
        }
        detail.textContent = result.value.faction + " · Tier " + result.value.tier;
        option.append(name, detail);
        item.replaceChildren(option);
      },
    },
    events: {
      input: {
        selection: function addSearchedDwelling(event) {
          const creatureName = event.detail.selection?.value?.name;
          if (!creatureName) return;
          planner.addExternalDwelling(creatureName);
          searchInput.value = "";
        },
      },
    },
  }));
  positionPlugin.attach(externalDwellingSearch);
  if (pendingSearchFocus) {
    pendingSearchFocus = false;
    searchInput.focus();
  }
}

window.addEventListener("keydown", function focusExternalDwellingSearch(event) {
  if (
    event.key !== "/" ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  ) {
    return;
  }
  const searchInput = document.querySelector("#external-dwelling-search");
  if (!searchInput || searchInput.disabled) return;
  event.preventDefault();
  pendingSearchFocus = true;
  searchInput.focus();
}, { capture: true });

function initializePlanner(data) {
  Alpine.store("planner").initialize(data);
}

function showLoadError(error, context) {
  Alpine.store("planner").loadError = context + ": " + error.message;
}

let initialData = null;
let initialError = null;
let initialErrorContext = "";
const embeddedData = document.querySelector("#creature-data");

try {
  if (embeddedData) {
    initialData = JSON.parse(embeddedData.textContent);
  } else {
    const response = await fetch("creatures.json");
    if (!response.ok) {
      throw new Error("Creature data returned HTTP " + response.status);
    }
    initialData = await response.json();
  }
} catch (error) {
  initialError = error;
  initialErrorContext = embeddedData
    ? "Could not load embedded creature data"
    : "Could not load creatures.json. Run npm run dev and open the local URL it prints";
}

Alpine.plugin(persist);
Alpine.store("planner", createPlannerStore());
window.Alpine = Alpine;

if (initialData) {
  initializePlanner(initialData);
}

Alpine.start();

if (initialData) {
  Alpine.store("planner").mount();
} else {
  showLoadError(initialError, initialErrorContext);
}
