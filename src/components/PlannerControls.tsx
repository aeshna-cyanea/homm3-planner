import { Show, onCleanup, onMount } from "solid-js";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";
import { ResourceTotals } from "./ResourceCost";
import { ResultsTable } from "./Recruitment";
import { TownSearch } from "./TownSearch";

export function PlannerControls(props: {
  planner: Planner;
  showBuildingCosts: boolean;
  controlsPosition: "header" | "footer";
  onToggleBuildingCosts: () => void;
  onToggleControlsPosition: () => void;
}) {
  let controls!: HTMLDivElement;

  function focusTownSearch(event: MouseEvent): void {
    const target = event.target as Element;
    if (target.closest(".town-search-dropdown")) return;
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLInputElement>("#add-town-search")
      ?.focus();
  }

  function toggleControlsPosition(): void {
    const previousTop = controls.getBoundingClientRect().top;
    controls.classList.remove("is-relocating");
    props.onToggleControlsPosition();
    const currentTop = controls.getBoundingClientRect().top;
    const offset = previousTop - currentTop;

    if (
      offset === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    controls.style.setProperty("--planner-controls-offset-y", `${offset}px`);
    void controls.offsetWidth;
    controls.classList.add("is-relocating");
  }

  function finishRelocating(event: AnimationEvent): void {
    if (event.animationName !== "relocate-planner-controls") return;
    controls.classList.remove("is-relocating");
    controls.style.removeProperty("--planner-controls-offset-y");
  }

  return (
    <div
      ref={controls}
      class="planner-controls panel"
      onAnimationEnd={finishRelocating}
    >
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
          Save <span class="wide-action-label">State</span>
        </button>
        <button
          class="reset-button"
          id="reset-scheme"
          type="button"
          onClick={() => props.planner.reset()}
        >
          Reset <span class="wide-action-label">State</span>
        </button>
        <button
          class="reset-button building-costs-button"
          id="toggle-building-costs"
          type="button"
          aria-label={props.showBuildingCosts
            ? "Hide construction costs"
            : "Show construction costs"}
          aria-keyshortcuts="u"
          aria-pressed={props.showBuildingCosts}
          onClick={props.onToggleBuildingCosts}
        >
          <span class="building-costs-wide-label">
            {props.showBuildingCosts ? "Hide" : "Show"} construction costs
          </span>
          <span class="building-costs-compact-label" aria-hidden="true">
            Costs
          </span>
          <kbd class="shortcut-key">U</kbd>
        </button>
        <GlobalTotalDialog planner={props.planner} />
        <button
          class="reset-button move-controls-button"
          id="move-planner-controls"
          type="button"
          aria-label={props.controlsPosition === "header"
            ? "Move controls to footer"
            : "Move controls to header"}
          title={props.controlsPosition === "header"
            ? "Move controls to footer"
            : "Move controls to header"}
          onClick={toggleControlsPosition}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={props.controlsPosition === "header"
              ? "M6 9l6 6 6-6"
              : "M6 15l6-6 6 6"}
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GlobalTotalDialog(props: { planner: Planner }) {
  let dialog!: HTMLDialogElement;
  const hasPendingCosts = () =>
    props.planner.state.townPlans.some(
      (plan) =>
        plan.pendingFortification !== null || plan.pendingDwellings.length > 0,
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
        <span class="global-total-wide-label">Global </span>Total
        <kbd class="shortcut-key">P</kbd>
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
                costLineItems={props.planner.globalCostLineItems()}
                combinedCosts={hasPendingCosts()}
              />
            </div>
          </Show>
        </div>
      </dialog>
    </>
  );
}
