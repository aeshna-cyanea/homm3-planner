import type { SavedPlannerState } from "./types";

const savedStateStorageKey = "hota-production-planner-state";
const autosavedStateStorageKey = "hota-production-planner-autosave";
const preferencesStorageKey = "hota-production-planner-preferences";

export interface PlannerPreferences {
  showBuildingCosts: boolean;
  controlsPosition: "header" | "footer";
  pendingBuildingHintDismissed: boolean;
}

export function loadSavedState(): SavedPlannerState | null {
  return loadState(savedStateStorageKey);
}

export function saveState(state: SavedPlannerState): void {
  storeState(savedStateStorageKey, state);
}

export function loadAutosavedState(): SavedPlannerState | null {
  return loadState(autosavedStateStorageKey);
}

export function autosaveState(state: SavedPlannerState): void {
  storeState(autosavedStateStorageKey, state);
}

function loadState(key: string): SavedPlannerState | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return isSavedPlannerState(value) ? value : null;
  } catch {
    return null;
  }
}

function storeState(key: string, state: SavedPlannerState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Persistence is optional when storage is blocked or unavailable.
  }
}

export function loadPreferences(): PlannerPreferences {
  const defaults: PlannerPreferences = {
    showBuildingCosts: false,
    controlsPosition: "header",
    pendingBuildingHintDismissed: false,
  };

  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(preferencesStorageKey) ?? "null",
    );
    if (typeof value !== "object" || value === null) return defaults;

    const preferences = value as Partial<PlannerPreferences>;
    return {
      showBuildingCosts:
        typeof preferences.showBuildingCosts === "boolean"
          ? preferences.showBuildingCosts
          : defaults.showBuildingCosts,
      controlsPosition:
        preferences.controlsPosition === "header" ||
        preferences.controlsPosition === "footer"
          ? preferences.controlsPosition
          : defaults.controlsPosition,
      pendingBuildingHintDismissed:
        typeof preferences.pendingBuildingHintDismissed === "boolean"
          ? preferences.pendingBuildingHintDismissed
          : defaults.pendingBuildingHintDismissed,
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: PlannerPreferences): void {
  try {
    localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
  } catch {
    // Saving is optional when storage is blocked or unavailable.
  }
}

function isSavedPlannerState(value: unknown): value is SavedPlannerState {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Partial<SavedPlannerState>).townPlans)
  );
}
