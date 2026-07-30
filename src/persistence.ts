import type { SavedPlannerState } from "./types";

const storageKey = "hota-production-planner-state";
const preferencesStorageKey = "hota-production-planner-preferences";

export interface PlannerPreferences {
  showBuildingCosts: boolean;
  controlsPosition: "header" | "footer";
}

export function loadSavedState(): SavedPlannerState | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return isSavedPlannerState(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveState(state: SavedPlannerState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Saving is optional when storage is blocked or unavailable.
  }
}

export function loadPreferences(): PlannerPreferences {
  const defaults: PlannerPreferences = {
    showBuildingCosts: false,
    controlsPosition: "header",
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
