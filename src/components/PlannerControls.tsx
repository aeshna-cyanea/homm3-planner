import { Show, onCleanup, onMount } from "solid-js";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";
import { ResourceTotals } from "./ResourceCost";
import { ResultsTable } from "./Recruitment";
import { TownSearch } from "./TownSearch";

export function PlannerControls(props: { planner: Planner }) {
  function focusTownSearch(event: MouseEvent): void {
    const target = event.target as Element;
    if (target.closest(".town-search-dropdown")) return;
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLInputElement>("#add-town-search")
      ?.focus();
  }

  return (
    <div class="planner-controls panel">
      <div class="add-town-control" onClick={focusTownSearch}>
        <label class="add-town-label" for="add-town-search">
          <span>Add town</span>
          <kbd class="shortcut-key">T</kbd>
        </label>
        <TownSearch planner={props.planner} />
      </div>

      <div class="state-actions">
        <button
          class="reset-button"
          id="save-state"
          type="button"
          onClick={() => props.planner.save()}
        >
          Save State
        </button>
        <button
          class="reset-button"
          id="reset-scheme"
          type="button"
          onClick={() => props.planner.reset()}
        >
          Reset State
        </button>
        <GlobalTotalDialog planner={props.planner} />
      </div>
    </div>
  );
}

function GlobalTotalDialog(props: { planner: Planner }) {
  let dialog!: HTMLDialogElement;
  const hasPendingCosts = () =>
    props.planner.state.townPlans.some(
      (plan) => plan.pendingDwelling !== null,
    );

  onMount(() => window.addEventListener("keydown", toggleWithShortcut));
  onCleanup(() => window.removeEventListener("keydown", toggleWithShortcut));

  function open(): void {
    if (!dialog.open) dialog.showModal();
  }

  function toggleWithShortcut(event: KeyboardEvent): void {
    if (!isPlainShortcut(event, "p")) return;
    event.preventDefault();
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
    }
  }

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === dialog) dialog.close();
  }

  return (
    <>
      <button
        class="reset-button global-total-button"
        id="open-global-total"
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="p"
        onClick={open}
      >
        Global Total <kbd class="shortcut-key">P</kbd>
      </button>

      <dialog
        ref={dialog}
        class="global-total-dialog"
        aria-labelledby="global-total-title"
        onClick={closeFromBackdrop}
      >
        <div class="global-total-panel">
          <header class="dialog-header">
            <div>
              <p class="eyebrow">
                {hasPendingCosts() ? "Weekly + one-time" : "All recruitment"}
              </p>
              <h2 id="global-total-title">
                {hasPendingCosts() ? "Global total" : "Global weekly total"}
              </h2>
            </div>
            <form method="dialog">
              <button class="dialog-close-button" type="submit" aria-label="Close">
                ×
              </button>
            </form>
          </header>

          <p class="result-context">
            {props.planner.state.townPlans.length}{" "}
            {props.planner.state.townPlans.length === 1 ? "town" : "towns"}
            <Show when={props.planner.externalRows().length > 0}>
              {" "}· External dwellings
            </Show>
            <Show when={hasPendingCosts()}>
              {" "}· Includes pending one-time costs
            </Show>
          </p>

          <Show
            when={props.planner.globalRows().length > 0}
            fallback={
              <div class="empty-results">
                Select a dwelling to begin the production plan.
              </div>
            }
          >
            <div
              class="totals"
              aria-live="polite"
              aria-label={hasPendingCosts()
                ? "Global total including weekly recruitment and pending one-time costs"
                : "Global weekly total"}
            >
              <ResourceTotals
                id="global-resource-totals"
                entries={props.planner.globalTotals()}
              />
            </div>
            <div class="results-table-wrap">
              <ResultsTable
                id="global-results-body"
                rows={props.planner.globalRows()}
                combinedCosts={hasPendingCosts()}
              />
            </div>
          </Show>
        </div>
      </dialog>
    </>
  );
}
