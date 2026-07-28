import { createMemo } from "solid-js";
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
import { multiplyCost, sumCosts, totalCosts } from "./resources";
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
  plan(planId: string): TownPlan;
  townLabel(planId: string): string;
  dwellings(planId: string): Dwelling[];
  productionRows(planId: string): RecruitmentRow[];
  productionTotals(planId: string): CostEntry[];
  externalDwellingCards(): ExternalDwellingCard[];
  externalRows(): RecruitmentRow[];
  externalTotals(): CostEntry[];
  globalRows(): RecruitmentRow[];
  globalTotals(): CostEntry[];
  resultContext(planId: string): string;
  addTown(town: string): string;
  removeTown(planId: string): void;
  renameTown(planId: string, label: string): string;
  changeTown(planId: string, town: string): void;
  cycleFortification(planId: string): void;
  nextFortification(planId: string): Fortification;
  cycleDwelling(planId: string, dwellingIndex: number): void;
  toggleHorde(planId: string, dwellingIndex: number, enabled: boolean): void;
  creature(planId: string, dwellingIndex: number): ReturnType<typeof selectedCreature>;
  detailCreature(planId: string, dwellingIndex: number): ReturnType<typeof basicCreature>;
  productionFor(planId: string, dwellingIndex: number): number;
  creatureName(planId: string, dwellingIndex: number): string;
  nextCreatureName(planId: string, dwellingIndex: number): string;
  stageName(selection: number): string;
  cardAriaLabel(planId: string, dwellingIndex: number): string;
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

  function planIndex(planId: string): number {
    const index = state.townPlans.findIndex((candidate) => candidate.id === planId);
    if (index < 0) throw new Error(`Unknown town plan: ${planId}`);
    return index;
  }

  function plan(planId: string): TownPlan {
    return state.townPlans[planIndex(planId)];
  }

  function dwellings(planId: string): Dwelling[] {
    return dwellingsFor(catalog, plan(planId));
  }

  function townLabel(planId: string): string {
    return plan(planId).label;
  }

  function nextFortification(planId: string): Fortification {
    const index = FORTIFICATIONS.indexOf(plan(planId).fortification);
    return FORTIFICATIONS[(index + 1) % FORTIFICATIONS.length];
  }

  function creature(planId: string, dwellingIndex: number) {
    return selectedCreature(
      dwellings(planId)[dwellingIndex],
      plan(planId).selections[dwellingIndex],
    );
  }

  function detailCreature(planId: string, dwellingIndex: number) {
    return (
      creature(planId, dwellingIndex) ??
      basicCreature(dwellings(planId)[dwellingIndex])
    );
  }

  function creatureName(planId: string, dwellingIndex: number): string {
    return (
      creature(planId, dwellingIndex)?.name ??
      basicCreature(dwellings(planId)[dwellingIndex]).name
    );
  }

  function nextCreatureName(planId: string, dwellingIndex: number): string {
    const dwelling = dwellings(planId)[dwellingIndex];
    return (
      selectedCreature(
        dwelling,
        nextSelection(dwelling, plan(planId).selections[dwellingIndex]),
      )?.name ?? "no unit"
    );
  }

  function cardAriaLabel(planId: string, dwellingIndex: number): string {
    const dwelling = dwellings(planId)[dwellingIndex];
    const selection = plan(planId).selections[dwellingIndex];
    const currentState = creature(planId, dwellingIndex)
      ? `, ${stageName(selection).toLowerCase()}`
      : ", not produced";
    return (
      `Tier ${dwelling.tier}: ${creatureName(planId, dwellingIndex)}` +
      `${currentState}. Click for ${nextCreatureName(planId, dwellingIndex)}.`
    );
  }

  function externalDwellingCount(creatureName: string): number {
    return (
      state.externalDwellings.find(
        (dwelling) => dwelling.basicCreature === creatureName,
      )?.count ?? 0
    );
  }

  function productionFor(planId: string, dwellingIndex: number): number {
    const currentPlan = plan(planId);
    const dwelling = dwellings(planId)[dwellingIndex];
    const horde = hordeBuilding(dwelling);
    const hordeBonus = currentPlan.hordeEnabled[dwellingIndex] && horde
      ? horde.growth_bonus
      : 0;
    const externalBonus = externalDwellingCount(basicCreature(dwelling).name);
    const growth = dwelling.growth + hordeBonus + externalBonus;

    if (currentPlan.fortification === "citadel") return Math.floor(growth * 1.5);
    if (currentPlan.fortification === "castle") return growth * 2;
    return growth;
  }

  function productionRows(planId: string): RecruitmentRow[] {
    const currentPlan = plan(planId);
    return dwellings(planId).flatMap((dwelling, dwellingIndex) => {
      const selected = creature(planId, dwellingIndex);
      if (!selected) return [];

      const horde = currentPlan.hordeEnabled[dwellingIndex]
        ? hordeBuilding(dwelling)
        : undefined;
      const production = productionFor(planId, dwellingIndex);
      return [{
        name: selected.name,
        detail:
          `Tier ${dwelling.tier} · ${stageName(currentPlan.selections[dwellingIndex])}` +
          (horde ? ` · ${horde.name}` : ""),
        production,
        unitCost: selected.cost,
        weeklyCost: multiplyCost(selected.cost, production),
      }];
    });
  }

  function productionTotals(planId: string): CostEntry[] {
    return totalCosts(productionRows(planId).map((row) => row.weeklyCost));
  }

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

  const globalRows = createMemo<RecruitmentRow[]>(() => {
    const sourcedRows = state.townPlans.flatMap((currentPlan) =>
      productionRows(currentPlan.id).map((row) => ({
        row,
        source: townLabel(currentPlan.id),
      })),
    );
    sourcedRows.push(
      ...externalRows().map((row) => ({ row, source: "External dwellings" })),
    );
    return aggregateRows(sourcedRows);
  });

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
      setExternalDwellingCount(
        creatureName,
        count + (action === "increment" ? 1 : -1),
      );
    }
  }

  function serialize(): SavedPlannerState {
    return {
      townPlans: state.townPlans.map((currentPlan) => ({
        id: currentPlan.id,
        label: currentPlan.label,
        town: currentPlan.town,
        fortification: currentPlan.fortification,
        dwellings: dwellingsFor(catalog, currentPlan).map((dwelling, index) => ({
          basicCreature: basicCreature(dwelling).name,
          selectedCreature:
            selectedCreature(dwelling, currentPlan.selections[index])?.name ?? null,
          hordeEnabled: Boolean(currentPlan.hordeEnabled[index]),
        })),
      })),
      externalDwellings: state.externalDwellings.map((dwelling) => ({ ...dwelling })),
    };
  }

  return {
    catalog,
    state,
    plan,
    townLabel,
    dwellings,
    productionRows,
    productionTotals,
    externalDwellingCards,
    externalRows,
    externalTotals: createMemo(() =>
      totalCosts(externalRows().map((row) => row.weeklyCost))),
    globalRows,
    globalTotals: createMemo(() =>
      totalCosts(globalRows().map((row) => row.weeklyCost))),
    resultContext(planId) {
      const currentPlan = plan(planId);
      return `${townLabel(planId)} · ${currentPlan.town} · ${capitalize(currentPlan.fortification)}`;
    },

    addTown(town) {
      const planId = nextTownId(state.townPlans);
      setState("townPlans", (plans) => [
        ...plans,
        createPlan(catalog, town, planId),
      ]);
      return planId;
    },

    removeTown(planId) {
      if (state.townPlans.length <= 1) return;
      setState("townPlans", (plans) =>
        plans.filter((candidate) => candidate.id !== planId));
    },

    renameTown(planId, label) {
      const currentLabel = townLabel(planId);
      const nextLabel = label.trim().slice(0, 40) || currentLabel;
      setState("townPlans", planIndex(planId), "label", nextLabel);
      return nextLabel;
    },

    changeTown(planId, town) {
      const index = planIndex(planId);
      const replacement = createPlan(catalog, town, planId);
      setState("townPlans", index, {
        town: replacement.town,
        selections: replacement.selections,
        hordeEnabled: replacement.hordeEnabled,
      });
    },

    cycleFortification(planId) {
      setState(
        "townPlans",
        planIndex(planId),
        "fortification",
        nextFortification(planId),
      );
    },

    nextFortification,

    cycleDwelling(planId, dwellingIndex) {
      const index = planIndex(planId);
      const selection = nextSelection(
        dwellings(planId)[dwellingIndex],
        plan(planId).selections[dwellingIndex],
      );
      setState("townPlans", index, "selections", dwellingIndex, selection);
      if (selection < 0) {
        setState("townPlans", index, "hordeEnabled", dwellingIndex, false);
      }
    },

    toggleHorde(planId, dwellingIndex, enabled) {
      setState(
        "townPlans",
        planIndex(planId),
        "hordeEnabled",
        dwellingIndex,
        Boolean(
          enabled &&
          creature(planId, dwellingIndex) &&
          hordeBuilding(dwellings(planId)[dwellingIndex]),
        ),
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
      return setExternalDwellingCount(
        creatureName,
        Math.max(1, normalizedCount(value)),
      );
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
    label: defaultTownLabel(id),
    town: town.name,
    fortification: "fort",
    selections: town.dwellings.map((_, index) => (index === 0 ? 0 : -1)),
    hordeEnabled: town.dwellings.map(() => false),
  };
}

function nextTownId(plans: readonly TownPlan[]): string {
  const highestNumber = plans.reduce((highest, plan) => {
    const match = /^town-(\d+)$/.exec(plan.id);
    return Math.max(highest, Number(match?.[1] ?? 0));
  }, 0);
  return `town-${highestNumber + 1}`;
}

function defaultTownLabel(id: string, fallback = 1): string {
  const number = /^town-(\d+)$/.exec(id)?.[1] ?? fallback;
  return `Town ${number}`;
}

function restoreState(
  catalog: Catalog,
  snapshot: SavedPlannerState,
): PlannerState | null {
  const townPlans = snapshot.townPlans.flatMap((savedPlan, index) => {
    if (!savedPlan || !townByName(catalog, savedPlan.town)) return [];

    const plan = createPlan(catalog, savedPlan.town, savedPlan.id || `town-${index + 1}`);
    plan.label =
      typeof savedPlan.label === "string" && savedPlan.label.trim()
        ? savedPlan.label.trim().slice(0, 40)
        : defaultTownLabel(plan.id, index + 1);
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

function aggregateRows(
  sourcedRows: { row: RecruitmentRow; source: string }[],
): RecruitmentRow[] {
  const groups = new Map<
    string,
    { row: RecruitmentRow; sources: string[]; costs: Cost[] }
  >();

  for (const { row, source } of sourcedRows) {
    const group = groups.get(row.name);
    if (group) {
      group.row.production += row.production;
      group.costs.push(row.weeklyCost);
      if (!group.sources.includes(source)) group.sources.push(source);
    } else {
      groups.set(row.name, {
        row: { ...row },
        sources: [source],
        costs: [row.weeklyCost],
      });
    }
  }

  return Array.from(groups.values(), ({ row, sources, costs }) => ({
    ...row,
    detail: sources.join(" · "),
    weeklyCost: sumCosts(costs),
  }));
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
