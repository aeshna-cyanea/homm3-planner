import { Show, onCleanup, onMount } from "solid-js";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";
import { ResourceTotals } from "./ResourceCost";
import { ResultsTable } from "./Recruitment";
import { TownSearch } from "./TownSearch";

export function PlannerControls(props: { planner: Planner }) {
  return (
    <div class="planner-controls panel">
      <div class="add-town-control">
        <label for="add-town-search">Add town</label>
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

  onMount(() => window.addEventListener("keydown", openWithShortcut));
  onCleanup(() => window.removeEventListener("keydown", openWithShortcut));

  function open(): void {
    if (!dialog.open) dialog.showModal();
  }

  function openWithShortcut(event: KeyboardEvent): void {
    if (!isPlainShortcut(event, "p")) return;
    event.preventDefault();
    open();
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
        Global Total <kbd>P</kbd>
      </button>

      <dialog
        ref={dialog}
        class="global-total-dialog"
        aria-labelledby="global-total-title"
        onClick={closeFromBackdrop}
      >
        <div class="global-total-panel">
          <header class="global-total-header">
            <div>
              <p class="eyebrow">All recruitment</p>
              <h2 id="global-total-title">Global weekly total</h2>
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
          </p>

          <Show
            when={props.planner.globalRows().length > 0}
            fallback={
              <div class="empty-results">
                Select a dwelling to begin the production plan.
              </div>
            }
          >
            <div class="totals" aria-live="polite">
              <ResourceTotals
                id="global-resource-totals"
                entries={props.planner.globalTotals()}
              />
            </div>
            <div class="results-table-wrap">
              <ResultsTable
                id="global-results-body"
                rows={props.planner.globalRows()}
              />
            </div>
          </Show>
        </div>
      </dialog>
    </>
  );
}
