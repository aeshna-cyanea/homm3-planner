import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { Store } from "solid-js/store";
import {
  basicCreature,
  hordeBuilding,
  nextSelection,
  selectedCreature,
  townByName,
} from "./catalog";
import { loadSavedState, saveState } from "./persistence";
import { multiplyCost, totalCosts } from "./resources";
import type {
  Catalog,
  Cost,
  CostEntry,
  Dwelling,
  ExternalDwellingCard,
  Fortification,
  PlannerState,
  RecruitmentRow,
  SavedPlannerState,
  TownPlan,
} from "./types";

export const FORTIFICATIONS = ["fort", "citadel", "castle"] as const;
export const FORTIFICATION_COPY: Record<
  Fortification,
  { name: string; growth: string }
> = {
  fort: { name: "Fort", growth: "Base growth" },
  citadel: { name: "Citadel", growth: "1.5x growth, rounded down" },
  castle: { name: "Castle", growth: "2x growth" },
};

type ExternalCountAction = "increment" | "decrement" | "reset";

export interface Planner {
  catalog: Catalog;
  state: Store<PlannerState>;
  activePlan: Accessor<TownPlan>;
  dwellings: Accessor<Dwelling[]>;
  productionRows: Accessor<RecruitmentRow[]>;
  productionTotals: Accessor<CostEntry[]>;
  externalDwellingCards: Accessor<ExternalDwellingCard[]>;
  externalRows: Accessor<RecruitmentRow[]>;
  externalTotals: Accessor<CostEntry[]>;
  resultContext: Accessor<string>;
  changeTown(town: string): void;
  cycleFortification(): void;
  nextFortification(): Fortification;
  cycleDwelling(index: number): void;
  toggleHorde(index: number, enabled: boolean): void;
  creature(index: number): ReturnType<typeof selectedCreature>;
  detailCreature(index: number): ReturnType<typeof basicCreature>;
  productionFor(index: number): number;
  creatureName(index: number): string;
  nextCreatureName(index: number): string;
  stageName(selection: number): string;
  cardAriaLabel(index: number): string;
  externalDwellingCount(creatureName: string): number;
  setExternalDwellingCount(creatureName: string, value: string | number): number;
  adjustExternalDwelling(creatureName: string, action: ExternalCountAction): void;
  adjustExternalCard(creatureName: string, action: "increment" | "decrement"): void;
  setExternalCardCount(creatureName: string, value: string | number): number;
  addExternalDwelling(creatureName: string): void;
  fortificationCost(level: Fortification): Cost | undefined;
  save(): void;
  reset(): void;
}

export function createPlanner(catalog: Catalog): Planner {
  const loadedSnapshot = loadSavedState();
  const restored = loadedSnapshot && restoreState(catalog, loadedSnapshot);
  let savedSnapshot = restored ? loadedSnapshot : null;
  const [state, setState] = createStore(restored ?? initialState(catalog));

  const activePlan = (): TownPlan => state.townPlans[0];
  const dwellings = (): Dwelling[] =>
    townByName(catalog, activePlan().town)?.dwellings ?? [];

  function nextFortification(): Fortification {
    const index = FORTIFICATIONS.indexOf(activePlan().fortification);
    return FORTIFICATIONS[(index + 1) % FORTIFICATIONS.length];
  }

  function creature(index: number) {
    return selectedCreature(dwellings()[index], activePlan().selections[index]);
  }

  function detailCreature(index: number) {
    return creature(index) ?? basicCreature(dwellings()[index]);
  }

  function creatureName(index: number): string {
    return creature(index)?.name ?? basicCreature(dwellings()[index]).name;
  }

  function nextCreatureName(index: number): string {
    const dwelling = dwellings()[index];
    return selectedCreature(
      dwelling,
      nextSelection(dwelling, activePlan().selections[index]),
    )?.name ?? "no unit";
  }

  function cardAriaLabel(index: number): string {
    const dwelling = dwellings()[index];
    const selected = creature(index);
    const currentState = selected
      ? `, ${stageName(activePlan().selections[index]).toLowerCase()}`
      : ", not produced";
    return (
      `Tier ${dwelling.tier}: ${creatureName(index)}${currentState}. ` +
      `Click for ${nextCreatureName(index)}.`
    );
  }

  function externalDwellingCount(creatureName: string): number {
    return (
      state.externalDwellings.find(
        (dwelling) => dwelling.basicCreature === creatureName,
      )?.count ?? 0
    );
  }

  function productionFor(index: number): number {
    const dwelling = dwellings()[index];
    const horde = hordeBuilding(dwelling);
    const hordeBonus = activePlan().hordeEnabled[index] && horde
      ? horde.growth_bonus
      : 0;
    const externalBonus = externalDwellingCount(basicCreature(dwelling).name);
    const growth = dwelling.growth + hordeBonus + externalBonus;

    if (activePlan().fortification === "citadel") return Math.floor(growth * 1.5);
    if (activePlan().fortification === "castle") return growth * 2;
    return growth;
  }

  const productionRows = createMemo<RecruitmentRow[]>(() =>
    dwellings().flatMap((dwelling, index) => {
      const selected = creature(index);
      if (!selected) return [];

      const horde = activePlan().hordeEnabled[index]
        ? hordeBuilding(dwelling)
        : undefined;
      const production = productionFor(index);
      return [{
        name: selected.name,
        detail:
          `Tier ${dwelling.tier} · ${stageName(activePlan().selections[index])}` +
          (horde ? ` · ${horde.name}` : ""),
        production,
        unitCost: selected.cost,
        weeklyCost: multiplyCost(selected.cost, production),
      }];
    }),
  );

  const externalDwellingCards = createMemo<ExternalDwellingCard[]>(() =>
    state.externalDwellings.flatMap((entry) => {
      const dwelling = catalog.dwellingCatalog.get(entry.basicCreature);
      return dwelling
        ? [{
            creatureName: entry.basicCreature,
            count: entry.count,
            creature: dwelling.creature,
            factionName: dwelling.factionName,
            tier: dwelling.tier,
            production: dwelling.growth * entry.count,
          }]
        : [];
    }),
  );

  const externalRows = createMemo<RecruitmentRow[]>(() =>
    externalDwellingCards().map((card) => ({
      name: card.creature.name,
      detail:
        `Tier ${card.tier} · Basic · ${card.count} external dwelling` +
        (card.count === 1 ? "" : "s"),
      production: card.production,
      unitCost: card.creature.cost,
      weeklyCost: multiplyCost(card.creature.cost, card.production),
    })),
  );

  function setExternalDwellingCount(
    creatureName: string,
    value: string | number,
  ): number {
    if (!catalog.dwellingCatalog.has(creatureName)) return 0;

    const count = normalizedCount(value);
    const index = state.externalDwellings.findIndex(
      (dwelling) => dwelling.basicCreature === creatureName,
    );
    if (count === 0) {
      if (index >= 0) {
        setState("externalDwellings", (dwellings) =>
          dwellings.filter((_, dwellingIndex) => dwellingIndex !== index));
      }
    } else if (index >= 0) {
      setState("externalDwellings", index, "count", count);
    } else {
      setState("externalDwellings", (dwellings) => [
        ...dwellings,
        { basicCreature: creatureName, count },
      ]);
    }
    return count;
  }

  function adjustExternalDwelling(
    creatureName: string,
    action: ExternalCountAction,
  ): void {
    const count = externalDwellingCount(creatureName);
    setExternalDwellingCount(
      creatureName,
      action === "increment" ? count + 1 : action === "decrement" ? count - 1 : 0,
    );
  }

  function adjustExternalCard(
    creatureName: string,
    action: "increment" | "decrement",
  ): void {
    const count = externalDwellingCount(creatureName);
    if (action === "increment" || count > 1) {
      setExternalDwellingCount(creatureName, count + (action === "increment" ? 1 : -1));
    }
  }

  function serialize(): SavedPlannerState {
    return {
      townPlans: state.townPlans.map((plan) => ({
        id: plan.id,
        town: plan.town,
        fortification: plan.fortification,
        dwellings: dwellingsFor(catalog, plan).map((dwelling, index) => ({
          basicCreature: basicCreature(dwelling).name,
          selectedCreature:
            selectedCreature(dwelling, plan.selections[index])?.name ?? null,
          hordeEnabled: Boolean(plan.hordeEnabled[index]),
        })),
      })),
      externalDwellings: state.externalDwellings.map((dwelling) => ({ ...dwelling })),
    };
  }

  return {
    catalog,
    state,
    activePlan,
    dwellings,
    productionRows,
    productionTotals: createMemo(() =>
      totalCosts(productionRows().map((row) => row.weeklyCost))),
    externalDwellingCards,
    externalRows,
    externalTotals: createMemo(() =>
      totalCosts(externalRows().map((row) => row.weeklyCost))),
    resultContext: createMemo(() =>
      `${activePlan().town} · ${capitalize(activePlan().fortification)}`),

    changeTown(town) {
      const replacement = createPlan(catalog, town);
      setState("townPlans", 0, {
        town: replacement.town,
        selections: replacement.selections,
        hordeEnabled: replacement.hordeEnabled,
      });
    },

    cycleFortification() {
      setState("townPlans", 0, "fortification", nextFortification());
    },

    nextFortification,

    cycleDwelling(index) {
      const selection = nextSelection(dwellings()[index], activePlan().selections[index]);
      setState("townPlans", 0, "selections", index, selection);
      if (selection < 0) setState("townPlans", 0, "hordeEnabled", index, false);
    },

    toggleHorde(index, enabled) {
      setState(
        "townPlans",
        0,
        "hordeEnabled",
        index,
        Boolean(enabled && creature(index) && hordeBuilding(dwellings()[index])),
      );
    },

    creature,
    detailCreature,
    productionFor,
    creatureName,
    nextCreatureName,
    stageName,
    cardAriaLabel,

    externalDwellingCount,
    setExternalDwellingCount,
    adjustExternalDwelling,
    adjustExternalCard,

    setExternalCardCount(creatureName, value) {
      return setExternalDwellingCount(creatureName, Math.max(1, normalizedCount(value)));
    },

    addExternalDwelling(creatureName) {
      setExternalDwellingCount(
        creatureName,
        externalDwellingCount(creatureName) + 1,
      );
    },

    fortificationCost(level) {
      return catalog.fortificationBuildings.find(
        (building) => building.id === level,
      )?.cost;
    },

    save() {
      savedSnapshot = serialize();
      saveState(savedSnapshot);
    },

    reset() {
      setState(reconcile(
        (savedSnapshot && restoreState(catalog, savedSnapshot)) ?? initialState(catalog),
      ));
    },
  };
}

function initialState(catalog: Catalog): PlannerState {
  return { townPlans: [createPlan(catalog, "Castle")], externalDwellings: [] };
}

function createPlan(catalog: Catalog, townName: string, id = "town-1"): TownPlan {
  const town = townByName(catalog, townName) ?? catalog.towns[0];
  if (!town) throw new Error("Creature data contains no towns");

  return {
    id,
    town: town.name,
    fortification: "fort",
    selections: town.dwellings.map((_, index) => (index === 0 ? 0 : -1)),
    hordeEnabled: town.dwellings.map(() => false),
  };
}

function restoreState(
  catalog: Catalog,
  snapshot: SavedPlannerState,
): PlannerState | null {
  const townPlans = snapshot.townPlans.flatMap((savedPlan, index) => {
    if (!savedPlan || !townByName(catalog, savedPlan.town)) return [];

    const plan = createPlan(catalog, savedPlan.town, savedPlan.id || `town-${index + 1}`);
    plan.fortification = isFortification(savedPlan.fortification)
      ? savedPlan.fortification
      : "fort";

    for (const [dwellingIndex, dwelling] of dwellingsFor(catalog, plan).entries()) {
      const savedDwelling = savedPlan.dwellings?.find(
        (candidate) => candidate?.basicCreature === basicCreature(dwelling).name,
      );
      if (!savedDwelling) continue;

      plan.selections[dwellingIndex] = savedDwelling.selectedCreature === null
        ? -1
        : dwelling.variants.findIndex(
            (creature) => creature.name === savedDwelling.selectedCreature,
          );
      plan.hordeEnabled[dwellingIndex] = Boolean(
        savedDwelling.hordeEnabled &&
        plan.selections[dwellingIndex] >= 0 &&
        hordeBuilding(dwelling),
      );
    }
    return [plan];
  });
  if (townPlans.length === 0) return null;

  return {
    townPlans,
    externalDwellings: (snapshot.externalDwellings ?? []).flatMap((dwelling) => {
      const count = normalizedCount(dwelling?.count);
      return dwelling &&
        catalog.dwellingCatalog.has(dwelling.basicCreature) &&
        count > 0
        ? [{ basicCreature: dwelling.basicCreature, count }]
        : [];
    }),
  };
}

function dwellingsFor(catalog: Catalog, plan: TownPlan): Dwelling[] {
  return townByName(catalog, plan.town)?.dwellings ?? [];
}

function normalizedCount(value: string | number): number {
  const count = Number.parseInt(String(value), 10);
  return Number.isFinite(count) ? Math.min(99, Math.max(0, count)) : 0;
}

function isFortification(value: string): value is Fortification {
  return FORTIFICATIONS.includes(value as Fortification);
}

function stageName(selection: number): string {
  if (selection < 0) return "None";
  if (selection === 0) return "Basic";
  return selection === 1 ? "Upgraded" : "Second upgrade";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
