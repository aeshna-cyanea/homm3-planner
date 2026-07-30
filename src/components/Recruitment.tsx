import { For, Show } from "solid-js";
import { levelSymbol } from "../dwelling-label";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { RecruitmentRow } from "../types";
import { CreatureNameButton } from "./CreatureDetails";
import { CostDisplay, ResourceTotals } from "./ResourceCost";

export function TownRecruitment(props: { planner: Planner; planId: string }) {
  const rows = () => props.planner.productionRows(props.planId);
  const pendingCosts = () =>
    props.planner.pendingDwellingCosts(props.planId);
  const id = (name: string) => domId(name, props.planId);

  return (
    <div
      class="results-column"
      data-town-results={props.planId}
      data-empty={rows().length === 0}
    >
      <Show when={pendingCosts().length > 0}>
        <section
          class="results-section one-time-results-section panel"
          aria-labelledby={id("one-time-title")}
          data-one-time-costs
        >
          <div class="section-heading one-time-heading">
            <p class="eyebrow" id={id("one-time-title")}>
              One-time costs
            </p>
            <span
              class="cost-list one-time-subtotal"
              aria-label="One-time cost subtotal"
              aria-live="polite"
            >
              <CostDisplay
                cost={props.planner.pendingDwellingTotal(props.planId)}
              />
            </span>
          </div>
          <div class="one-time-costs">
            <For each={pendingCosts()}>
              {(costs) => {
                const action = costs.action === "building"
                  ? "Building"
                  : "Upgrading";
                const actionLabel = `${action} ${costs.dwellingName}`;
                return (
                  <div
                    class="one-time-cost-group"
                    data-pending-dwelling={costs.dwellingIndex}
                  >
                    <OneTimeCostRow
                      label={actionLabel}
                      cost={costs.construction}
                      cancelLabel={
                        `Cancel ${action.toLowerCase()} ${costs.dwellingName}`
                      }
                      onCancel={() =>
                        props.planner.cancelPendingDwelling(
                          props.planId,
                          costs.dwellingIndex,
                        )}
                    />
                    <Show when={costs.creatures}>
                      {(creatures) => (
                        <OneTimeCostRow
                          label={
                            `${levelSymbol(creatures().level)} ` +
                            `${creatures().name} ×${formatNumber(creatures().quantity)}`
                          }
                          cost={creatures().cost}
                        />
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="one-time-actions">
            <button
              class="one-time-action-button is-confirm"
              type="button"
              onClick={() =>
                props.planner.confirmAllPendingDwellings(props.planId)}
            >
              Confirm all
            </button>
            <button
              class="one-time-action-button"
              type="button"
              onClick={() =>
                props.planner.cancelAllPendingDwellings(props.planId)}
            >
              Cancel all
            </button>
          </div>
        </section>
      </Show>

      <section class="results-section panel" aria-labelledby={id("results-title")}>
        <div class="section-heading">
          <div>
            <p class="eyebrow" id={id("results-title")}>Weekly subtotal</p>
            <Show when={rows().length > 0}>
              <div class="totals" id={id("totals")} aria-live="polite">
                <ResourceTotals
                  id={id("resource-totals")}
                  entries={props.planner.productionTotals(props.planId)}
                />
              </div>
            </Show>
          </div>
          <p class="result-context" id={id("result-context")}>
            {props.planner.resultContext(props.planId)}
          </p>
        </div>

        <Show
          when={rows().length > 0}
          fallback={
            <div class="empty-results" id={id("empty-results")}>
              Select a dwelling to begin this production plan.
            </div>
          }
        >
          <div class="results-table-wrap" id={id("results-table-wrap")}>
            <ResultsTable id={id("results-body")} rows={rows()} />
          </div>
        </Show>
      </section>
    </div>
  );
}

function OneTimeCostRow(props: {
  label: string;
  cost: RecruitmentRow["unitCost"];
  cancelLabel?: string;
  onCancel?: () => void;
}) {
  return (
    <div class="one-time-cost-row">
      <span class="one-time-cost-label">{props.label}</span>
      <span class="cost-list one-time-cost-value">
        <CostDisplay cost={props.cost} />
      </span>
      <span class="one-time-cost-cancel">
        <Show when={props.onCancel}>
          <button
            class="one-time-entry-close-button"
            type="button"
            aria-label={props.cancelLabel}
            title={props.cancelLabel}
            onClick={() => props.onCancel?.()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </Show>
      </span>
    </div>
  );
}

export function ExternalRecruitment(props: { planner: Planner }) {
  const rows = () => props.planner.externalRows();

  return (
    <div
      class="results-column external-results-column"
      data-empty={rows().length === 0}
    >
      <section
        class="results-section panel"
        id="external-results-section"
        aria-labelledby="external-results-title"
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow" id="external-results-title">
              External subtotal
            </p>
            <Show when={rows().length > 0}>
              <div class="totals" aria-live="polite">
                <ResourceTotals
                  id="external-resource-totals"
                  entries={props.planner.externalTotals()}
                />
              </div>
            </Show>
          </div>
          <p class="result-context" id="external-result-context">
            Recruitment at external dwellings
          </p>
        </div>

        <Show
          when={rows().length > 0}
          fallback={
            <div class="empty-results" id="external-empty-results">
              Add an external dwelling to begin this production plan.
            </div>
          }
        >
          <div class="results-table-wrap" id="external-results-table-wrap">
            <ResultsTable
              id="external-results-body"
              rows={rows()}
            />
          </div>
        </Show>
      </section>
    </div>
  );
}

export function ResultsTable(props: {
  id?: string;
  rows: RecruitmentRow[];
  combinedCosts?: boolean;
}) {
  return (
    <table class="results-table">
      <thead>
        <tr>
          <th scope="col">Creature</th>
          <th scope="col">{props.combinedCosts ? "Units" : "Produced"}</th>
          <th scope="col">Each</th>
          <th scope="col">
            {props.combinedCosts ? "Creature cost" : "Weekly cost"}
          </th>
        </tr>
      </thead>
      <tbody id={props.id}>
        <For each={props.rows}>
          {(row) => (
            <tr>
              <td>
                <CreatureNameButton
                  class="results-creature-name"
                  name={row.name}
                />
                <Show
                  when={row.detailParts}
                  fallback={<small>{row.detail}</small>}
                >
                  {(parts) => (
                    <small
                      class="results-detail-parts"
                      aria-label={row.detail}
                    >
                      <For each={parts()}>
                        {(part) => (
                          <span class="results-detail-part">{part}</span>
                        )}
                      </For>
                    </small>
                  )}
                </Show>
              </td>
              <td>
                {formatNumber(row.production)} <small>units</small>
              </td>
              <td>
                <span class="cost-list">
                  <CostDisplay cost={row.unitCost} />
                </span>
              </td>
              <td>
                <span class="cost-list">
                  <CostDisplay cost={row.weeklyCost} />
                </span>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function domId(base: string, planId: string): string {
  return planId === "town-1" ? base : `${base}-${planId}`;
}
