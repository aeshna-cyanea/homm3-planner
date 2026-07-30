import { For, Show } from "solid-js";
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
      <Show when={pendingCosts()}>
        {(costs) => (
          <section
            class="results-section one-time-results-section panel"
            aria-labelledby={id("one-time-title")}
            data-one-time-costs
          >
            <div class="section-heading one-time-heading">
              <p class="eyebrow" id={id("one-time-title")}>One-time</p>
              <button
                class="one-time-close-button"
                type="button"
                aria-label="Cancel pending construction"
                title="Cancel pending construction"
                onClick={() =>
                  props.planner.cancelPendingDwelling(props.planId)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div class="one-time-costs">
              <OneTimeCostRow
                label="Construction"
                cost={costs().construction}
              />
              <Show when={costs().creatures}>
                {(creatures) => (
                  <OneTimeCostRow
                    label="Creatures"
                    cost={creatures()}
                  />
                )}
              </Show>
            </div>
          </section>
        )}
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
}) {
  return (
    <div class="one-time-cost-row">
      <span class="one-time-cost-label">{props.label}</span>
      <span class="cost-list one-time-cost-value">
        <CostDisplay cost={props.cost} />
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
