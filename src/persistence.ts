import type { SavedPlannerState } from "./types";

const storageKey = "hota-production-planner-state";

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

function isSavedPlannerState(value: unknown): value is SavedPlannerState {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Partial<SavedPlannerState>).townPlans)
  );
}
