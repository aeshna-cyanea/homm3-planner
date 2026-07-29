import { Show, createSignal } from "solid-js";
import type { Planner } from "../planner";
import { ProductionScheme } from "./ProductionScheme";
import { TownRecruitment } from "./Recruitment";

export function TownSection(props: {
  planner: Planner;
  planId: string;
}) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [editingLabel, setEditingLabel] = createSignal(false);
  const [labelDraft, setLabelDraft] = createSignal("");
  const schemeContentId = `town-content-${props.planId}`;
  const resultsContentId = `town-results-content-${props.planId}`;
  const labelInputId = `town-label-${props.planId}`;
  let labelInput: HTMLInputElement | undefined;

  function startEditingLabel() {
    setLabelDraft(props.planner.townLabel(props.planId));
    setEditingLabel(true);
    queueMicrotask(() => {
      labelInput?.focus();
      labelInput?.select();
    });
  }

  function finishEditingLabel() {
    props.planner.renameTown(props.planId, labelDraft());
    setEditingLabel(false);
  }

  return (
    <article class="town-section" data-town-id={props.planId}>
      <div class="planner-layout town-layout">
        <div class="town-scheme-column planner-inputs">
          <header class="town-section-header">
            <div class="town-heading">
              <p class="eyebrow">{props.planner.plan(props.planId).town}</p>
              <div class="town-title-row">
                <Show
                  when={editingLabel()}
                  fallback={
                    <>
                      <h2>{props.planner.townLabel(props.planId)}</h2>
                      <button
                        class="edit-town-label-button"
                        type="button"
                        aria-label={`Rename ${props.planner.townLabel(props.planId)}`}
                        title="Rename town"
                        onClick={startEditingLabel}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m15.5 5.5 3 3M4 20l4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                        </svg>
                      </button>
                    </>
                  }
                >
                  <form
                    class="town-label-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      finishEditingLabel();
                    }}
                  >
                    <label class="sr-only" for={labelInputId}>Town name</label>
                    <input
                      ref={labelInput}
                      class="town-label-input"
                      id={labelInputId}
                      maxlength="40"
                      value={labelDraft()}
                      onInput={(event) => setLabelDraft(event.currentTarget.value)}
                      onBlur={finishEditingLabel}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        event.preventDefault();
                        setEditingLabel(false);
                      }}
                    />
                  </form>
                </Show>
              </div>
            </div>
            <div class="town-section-actions">
              <Show when={props.planner.state.townPlans.length > 1}>
                <button
                  class="town-header-button remove-town-button"
                  type="button"
                  aria-label={`Remove ${props.planner.townLabel(props.planId)}`}
                  onClick={() => props.planner.removeTown(props.planId)}
                >
                  Remove
                </button>
              </Show>
              <button
                class="town-header-button"
                type="button"
                aria-expanded={!collapsed()}
                aria-controls={`${schemeContentId} ${resultsContentId}`}
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed() ? "Expand" : "Collapse"}
              </button>
            </div>
          </header>

          <div
            class="town-scheme-content"
            id={schemeContentId}
            hidden={collapsed()}
          >
            <ProductionScheme planner={props.planner} planId={props.planId} />
          </div>
        </div>

        <div
          class="town-results-content"
          id={resultsContentId}
          hidden={collapsed()}
        >
          <TownRecruitment planner={props.planner} planId={props.planId} />
        </div>
      </div>
    </article>
  );
}
