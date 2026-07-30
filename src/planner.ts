import { createEffect, createMemo } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { Store } from "solid-js/store";
import {
  basicCreature,
  externalDwellingName,
  hordeBuilding,
  nextSelection,
  selectedCreature,
  townByName,
} from "./catalog";
import {
  dwellingDisplayName,
  dwellingLabel,
  levelSymbol,
} from "./dwelling-label";
import {
  autosaveState,
  loadAutosavedState,
  loadSavedState,
  saveState,
} from "./persistence";
import { multiplyCost, sumCosts, totalCosts } from "./resources";
import type {
  Catalog,
  Cost,
  CostEntry,
  Dwelling,
  ExternalDwellingCard,
  Fortification,
  GlobalCostLineItem,
  PendingDwellingCosts,
  PendingFortification,
  PendingFortificationCosts,
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
  pendingDwellingCosts(planId: string): PendingDwellingCosts[];
  pendingFortificationCosts(planId: string): PendingFortificationCosts | undefined;
  pendingBuildingTotal(planId: string): Cost;
  externalDwellingCards(): ExternalDwellingCard[];
  externalRows(): RecruitmentRow[];
  externalTotals(): CostEntry[];
  globalRows(): RecruitmentRow[];
  globalCostLineItems(): GlobalCostLineItem[];
  globalTotals(): CostEntry[];
  resultContext(planId: string): string;
  addTown(town: string): string;
  removeTown(planId: string): void;
  renameTown(planId: string, label: string): string;
  changeTown(planId: string, town: string): void;
  cycleFortification(planId: string): void;
  togglePendingFortification(planId: string): void;
  cancelPendingFortification(planId: string): void;
  nextFortification(planId: string): Fortification;
  cycleDwelling(planId: string, dwellingIndex: number): void;
  togglePendingDwelling(planId: string, dwellingIndex: number): void;
  cancelPendingDwelling(planId: string, dwellingIndex: number): void;
  confirmAllPendingBuildings(planId: string): void;
  cancelAllPendingBuildings(planId: string): void;
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
  removeExternalDwelling(dwellingId: string): void;
  fortificationCost(level: Fortification): Cost | undefined;
  save(): void;
  reset(): void;
}

export function createPlanner(catalog: Catalog): Planner {
  const autosavedSnapshot = loadAutosavedState();
  const restoredAutosave =
    autosavedSnapshot && restoreState(catalog, autosavedSnapshot);
  const loadedSavedSnapshot = loadSavedState();
  let savedSnapshot =
    loadedSavedSnapshot && restoreState(catalog, loadedSavedSnapshot)
      ? loadedSavedSnapshot
      : null;
  const [state, setState] = createStore(
    restoredAutosave ?? initialState(catalog),
  );

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
    const name = externalDwellingName(catalog, dwelling);
    const currentPlan = plan(planId);
    const selection = currentPlan.selections[dwellingIndex];
    const currentState = creature(planId, dwellingIndex)
      ? `, ${stageName(selection).toLowerCase()}`
      : ", not produced";
    const isPending = currentPlan.pendingDwellings.includes(dwellingIndex);
    const pendingAction = isPending
      ? "Pending. Click to confirm; Shift Enter or middle click to cancel."
      : selection < dwelling.variants.length - 1
        ? "Shift Enter or middle click to advance and mark pending."
        : "Fully upgraded; cannot be marked pending.";
    return (
      `${dwellingLabel(name ?? "Dwelling", dwelling.level, selection)}: ` +
      `${creatureName(planId, dwellingIndex)}` +
      `${currentState}. ` +
      (isPending
        ? pendingAction
        : `Click for ${nextCreatureName(planId, dwellingIndex)}. ${pendingAction}`)
    );
  }

  function externalDwellingIds(creatureName: string): string[] {
    return catalog.dwellingCatalog.get(creatureName)?.externalDwellingIds ?? [];
  }

  function namedExternalDwellingCount(dwellingId: string): number {
    return (
      state.externalDwellings.find((dwelling) => dwelling.id === dwellingId)
        ?.count ?? 0
    );
  }

  function externalDwellingCount(creatureName: string): number {
    return externalDwellingIds(creatureName).reduce(
      (total, id) => total + namedExternalDwellingCount(id),
      0,
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
      const stageDetail =
        `${levelSymbol(dwelling.level)} · ` +
        stageName(currentPlan.selections[dwellingIndex]);
      const detailParts = [
        stageDetail,
        ...(horde ? [horde.name] : []),
      ];
      return [{
        name: selected.name,
        detail: detailParts.join(" · "),
        detailParts,
        production,
        unitCost: selected.cost,
        weeklyCost: multiplyCost(selected.cost, production),
      }];
    });
  }

  function productionTotals(planId: string): CostEntry[] {
    return totalCosts(productionRows(planId).map((row) => row.weeklyCost));
  }

  function pendingDwellingCosts(
    planId: string,
  ): PendingDwellingCosts[] {
    const currentPlan = plan(planId);
    return currentPlan.pendingDwellings.flatMap((dwellingIndex) => {
      const dwelling = dwellings(planId)[dwellingIndex];
      const selection = currentPlan.selections[dwellingIndex];
      const construction = selection === 0
        ? dwelling?.building_cost
        : dwelling?.upgrade_costs?.[selection - 1];
      if (!dwelling || !construction || selection < 0) return [];

      const baseCreature = basicCreature(dwelling);
      return [{
        dwellingIndex,
        action: selection === 0 ? "building" as const : "upgrading" as const,
        dwellingName: dwellingDisplayName(
          externalDwellingName(catalog, dwelling) ?? "Dwelling",
          selection,
        ),
        construction,
        ...(selection === 0
          ? {
              creatures: {
                name: baseCreature.name,
                level: baseCreature.level,
                quantity: dwelling.growth,
                cost: multiplyCost(baseCreature.cost, dwelling.growth),
              },
            }
          : {}),
      }];
    });
  }

  function pendingFortificationCosts(
    planId: string,
  ): PendingFortificationCosts | undefined {
    const pending = plan(planId).pendingFortification;
    if (!pending) return undefined;

    const building = catalog.fortificationBuildings.find(
      (candidate) => candidate.id === pending,
    );
    return building
      ? {
          fortification: pending,
          buildingName: building.name,
          construction: building.cost,
        }
      : undefined;
  }

  function pendingCreatureRows(planId: string): RecruitmentRow[] {
    const currentPlan = plan(planId);
    return currentPlan.pendingDwellings.flatMap((dwellingIndex) => {
      if (currentPlan.selections[dwellingIndex] !== 0) return [];

      const dwelling = dwellings(planId)[dwellingIndex];
      const creature = dwelling && basicCreature(dwelling);
      return dwelling && creature
        ? [{
            name: creature.name,
            detail: "One-time",
            period: "one-time" as const,
            production: dwelling.growth,
            unitCost: creature.cost,
            weeklyCost: multiplyCost(creature.cost, dwelling.growth),
          }]
        : [];
    });
  }

  function pendingBuildingTotal(planId: string): Cost {
    const fortification = pendingFortificationCosts(planId);
    return sumCosts(
      [
        ...(fortification ? [fortification.construction] : []),
        ...pendingDwellingCosts(planId).flatMap((costs) => [
          costs.construction,
          ...(costs.creatures ? [costs.creatures.cost] : []),
        ]),
      ],
    );
  }

  const externalDwellingCards = createMemo<ExternalDwellingCard[]>(() =>
    state.externalDwellings.flatMap((entry) => {
      const dwelling = catalog.externalDwellingCatalog.get(entry.id);
      return dwelling
        ? [{
            id: entry.id,
            name: dwelling.name,
            count: entry.count,
            recruitments: dwelling.recruitments.map((recruitment) => ({
              ...recruitment,
              production: recruitment.dwelling.growth * entry.count,
              unitCost: externalRecruitmentCost(
                recruitment.creature.cost,
                recruitment.dwelling.level,
              ),
            })),
            production: dwelling.recruitments.reduce(
              (total, recruitment) =>
                total + recruitment.dwelling.growth * entry.count,
              0,
            ),
          }]
        : [];
    }),
  );

  const externalRows = createMemo<RecruitmentRow[]>(() =>
    externalDwellingCards().flatMap((card) =>
      card.recruitments.map((recruitment) => ({
        name: recruitment.creature.name,
        detail:
          `${dwellingLabel(card.name, recruitment.dwelling.level)} · ` +
          `${card.count} external dwelling${card.count === 1 ? "" : "s"}`,
        production: recruitment.production,
        unitCost: recruitment.unitCost,
        weeklyCost: externalRecruitmentCost(
          multiplyCost(recruitment.unitCost, recruitment.production),
          recruitment.dwelling.level,
        ),
      }))),
  );

  const globalRows = createMemo<RecruitmentRow[]>(() => {
    const weeklyRows = state.townPlans.flatMap((currentPlan) => {
      const source = townLabel(currentPlan.id);
      return productionRows(currentPlan.id).map((row) => ({ row, source }));
    });
    weeklyRows.push(
      ...externalRows().map((row) => ({ row, source: "External dwellings" })),
    );
    const oneTimeRows = state.townPlans.flatMap((currentPlan) => {
      const source = townLabel(currentPlan.id);
      return pendingCreatureRows(currentPlan.id).map((row) => ({ row, source }));
    });
    return [
      ...aggregateRows(oneTimeRows),
      ...aggregateRows(weeklyRows),
    ];
  });

  const globalCostLineItems = createMemo<GlobalCostLineItem[]>(() =>
    state.townPlans.flatMap((currentPlan) => {
      const fortification = pendingFortificationCosts(currentPlan.id);
      return [
        ...(fortification
          ? [{
              label: `Building ${fortification.buildingName}`,
              source: townLabel(currentPlan.id),
              cost: fortification.construction,
            }]
          : []),
        ...pendingDwellingCosts(currentPlan.id).map((costs) => ({
          label: `${capitalize(costs.action)} ${costs.dwellingName}`,
          source: townLabel(currentPlan.id),
          cost: costs.construction,
        })),
      ];
    }),
  );

  function setExternalDwellingCount(
    creatureName: string,
    value: string | number,
  ): number {
    const ids = externalDwellingIds(creatureName);
    if (ids.length === 0) return 0;

    const target = normalizedCount(value);
    let difference = target - externalDwellingCount(creatureName);
    if (difference > 0) {
      setNamedExternalDwellingCount(
        ids[0],
        namedExternalDwellingCount(ids[0]) + difference,
      );
    } else {
      for (const id of ids) {
        if (difference === 0) break;
        const count = namedExternalDwellingCount(id);
        const reduction = Math.min(count, -difference);
        setNamedExternalDwellingCount(id, count - reduction);
        difference += reduction;
      }
    }
    return externalDwellingCount(creatureName);
  }

  function setNamedExternalDwellingCount(
    dwellingId: string,
    value: string | number,
  ): number {
    if (!catalog.externalDwellingCatalog.has(dwellingId)) return 0;

    const count = normalizedCount(value);
    const index = state.externalDwellings.findIndex(
      (dwelling) => dwelling.id === dwellingId,
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
        { id: dwellingId, count },
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
    dwellingId: string,
    action: "increment" | "decrement",
  ): void {
    const count = namedExternalDwellingCount(dwellingId);
    if (action === "increment" || count > 1) {
      setNamedExternalDwellingCount(
        dwellingId,
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
        pendingFortification: currentPlan.pendingFortification,
        pendingDwellings: currentPlan.pendingDwellings.map(
          (dwellingIndex) =>
            basicCreature(
              dwellingsFor(catalog, currentPlan)[dwellingIndex],
            ).name,
        ),
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

  createEffect(() => autosaveState(serialize()));

  return {
    catalog,
    state,
    plan,
    townLabel,
    dwellings,
    productionRows,
    productionTotals,
    pendingDwellingCosts,
    pendingFortificationCosts,
    pendingBuildingTotal,
    externalDwellingCards,
    externalRows,
    externalTotals: createMemo(() => {
      const totals = totalCosts(externalRows().map((row) => row.weeklyCost));
      return totals.length > 0 || externalRows().length === 0
        ? totals
        : [["gold", 0] as CostEntry];
    }),
    globalRows,
    globalCostLineItems,
    globalTotals: createMemo(() => {
      return totalCosts([
        ...globalRows().map((row) => row.weeklyCost),
        ...globalCostLineItems().map((item) => item.cost),
      ]);
    }),
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
      const currentPlan = plan(planId);
      const replacement = createPlan(catalog, town, planId);
      setState("townPlans", index, {
        town: replacement.town,
        fortification: currentPlan.pendingFortification
          ? previousFortification(currentPlan.pendingFortification)
          : currentPlan.fortification,
        pendingFortification: null,
        selections: replacement.selections,
        hordeEnabled: replacement.hordeEnabled,
        pendingDwellings: [],
      });
    },

    cycleFortification(planId) {
      const index = planIndex(planId);
      if (plan(planId).pendingFortification) {
        setState("townPlans", index, "pendingFortification", null);
        return;
      }
      setState(
        "townPlans",
        index,
        "fortification",
        nextFortification(planId),
      );
    },

    togglePendingFortification(planId) {
      const index = planIndex(planId);
      const currentPlan = plan(planId);
      if (currentPlan.pendingFortification) {
        cancelPendingFortification(planId);
        return;
      }

      const target = nextFortification(planId);
      if (target === "fort") return;
      setState("townPlans", index, "fortification", target);
      setState("townPlans", index, "pendingFortification", target);
    },

    cancelPendingFortification,

    nextFortification,

    cycleDwelling(planId, dwellingIndex) {
      const index = planIndex(planId);
      if (plan(planId).pendingDwellings.includes(dwellingIndex)) {
        setState("townPlans", index, "pendingDwellings", (pending) =>
          pending.filter((candidate) => candidate !== dwellingIndex));
        return;
      }
      const selection = nextSelection(
        dwellings(planId)[dwellingIndex],
        plan(planId).selections[dwellingIndex],
      );
      setState("townPlans", index, "selections", dwellingIndex, selection);
      if (selection < 0) {
        setState("townPlans", index, "hordeEnabled", dwellingIndex, false);
      }
    },

    togglePendingDwelling(planId, dwellingIndex) {
      const index = planIndex(planId);
      const currentPlan = plan(planId);
      if (currentPlan.pendingDwellings.includes(dwellingIndex)) {
        cancelPendingDwelling(planId, dwellingIndex);
        return;
      }

      const dwelling = dwellings(planId)[dwellingIndex];
      const selection = currentPlan.selections[dwellingIndex];
      if (!dwelling || selection >= dwelling.variants.length - 1) return;

      setState(
        "townPlans",
        index,
        "selections",
        dwellingIndex,
        selection + 1,
      );
      setState("townPlans", index, "pendingDwellings", (pending) =>
        [...pending, dwellingIndex].sort((left, right) => left - right));
    },

    cancelPendingDwelling,

    confirmAllPendingBuildings(planId) {
      const index = planIndex(planId);
      setState("townPlans", index, "pendingFortification", null);
      setState("townPlans", index, "pendingDwellings", []);
    },

    cancelAllPendingBuildings(planId) {
      cancelPendingFortification(planId);
      for (const dwellingIndex of [...plan(planId).pendingDwellings]) {
        cancelPendingDwelling(planId, dwellingIndex);
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

    setExternalCardCount(dwellingId, value) {
      return setNamedExternalDwellingCount(
        dwellingId,
        Math.max(1, normalizedCount(value)),
      );
    },

    addExternalDwelling(dwellingId) {
      setNamedExternalDwellingCount(
        dwellingId,
        namedExternalDwellingCount(dwellingId) + 1,
      );
    },

    removeExternalDwelling(dwellingId) {
      setNamedExternalDwellingCount(dwellingId, 0);
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

  function cancelPendingDwelling(
    planId: string,
    dwellingIndex: number,
  ): void {
    const index = planIndex(planId);
    const currentPlan = plan(planId);
    if (!currentPlan.pendingDwellings.includes(dwellingIndex)) return;

    const selection = currentPlan.selections[dwellingIndex] - 1;
    setState("townPlans", index, "selections", dwellingIndex, selection);
    setState("townPlans", index, "pendingDwellings", (pending) =>
      pending.filter((candidate) => candidate !== dwellingIndex));
    if (selection < 0) {
      setState("townPlans", index, "hordeEnabled", dwellingIndex, false);
    }
  }

  function cancelPendingFortification(planId: string): void {
    const index = planIndex(planId);
    const pending = plan(planId).pendingFortification;
    if (!pending) return;

    setState("townPlans", index, "fortification", previousFortification(pending));
    setState("townPlans", index, "pendingFortification", null);
  }
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
    pendingFortification: null,
    selections: town.dwellings.map((_, index) => (index === 0 ? 0 : -1)),
    hordeEnabled: town.dwellings.map(() => false),
    pendingDwellings: [],
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
    const savedPendingFortification = savedPlan.pendingFortification;
    plan.pendingFortification =
        (savedPendingFortification === "citadel" ||
          savedPendingFortification === "castle") &&
        savedPendingFortification === plan.fortification
      ? savedPendingFortification
      : null;

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
    const savedPendingNames = Array.isArray(savedPlan.pendingDwellings)
      ? savedPlan.pendingDwellings.filter(
          (name): name is string => typeof name === "string",
        )
      : typeof savedPlan.pendingDwelling === "string"
        ? [savedPlan.pendingDwelling]
        : [];
    plan.pendingDwellings = dwellingsFor(catalog, plan).flatMap(
      (dwelling, dwellingIndex) =>
        savedPendingNames.includes(basicCreature(dwelling).name) &&
          plan.selections[dwellingIndex] >= 0
          ? [dwellingIndex]
          : [],
    );
    return [plan];
  });
  if (townPlans.length === 0) return null;

  return {
    townPlans,
    externalDwellings: (snapshot.externalDwellings ?? []).flatMap((dwelling) => {
      const count = normalizedCount(dwelling?.count);
      return dwelling &&
        catalog.externalDwellingCatalog.has(dwelling.id) &&
        count > 0
        ? [{ id: dwelling.id, count }]
        : [];
    }),
  };
}

function dwellingsFor(catalog: Catalog, plan: TownPlan): Dwelling[] {
  return townByName(catalog, plan.town)?.dwellings ?? [];
}

function externalRecruitmentCost(cost: Cost, level: number): Cost {
  return level === 1 ? { ...cost, gold: 0 } : cost;
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
    detail:
      `${sources.join(" · ")}${row.period === "one-time" ? " · One-time" : ""}`,
    detailParts: undefined,
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

function previousFortification(level: PendingFortification): Fortification {
  const index = FORTIFICATIONS.indexOf(level);
  return FORTIFICATIONS[Math.max(0, index - 1)];
}

function stageName(selection: number): string {
  if (selection < 0) return "None";
  if (selection === 0) return "Basic";
  return selection === 1 ? "Upgraded" : "Second upgrade";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
