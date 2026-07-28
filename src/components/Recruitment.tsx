import { For, Show } from "solid-js";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { RecruitmentRow } from "../types";
import { CreatureNameButton } from "./CreatureDetails";
import { CostDisplay, ResourceTotals } from "./ResourceCost";

export function TownRecruitment(props: { planner: Planner; planId: string }) {
  const rows = () => props.planner.productionRows(props.planId);
  const id = (name: string) => domId(name, props.planId);

  return (
    <div class="results-column" data-town-results={props.planId}>
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

export function ExternalRecruitment(props: { planner: Planner }) {
  return (
    <Show when={props.planner.externalRows().length > 0}>
      <div class="results-column external-results-column">
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
              <div class="totals" aria-live="polite">
                <ResourceTotals
                  id="external-resource-totals"
                  entries={props.planner.externalTotals()}
                />
              </div>
            </div>
            <p class="result-context" id="external-result-context">
              Recruitment at external dwellings
            </p>
          </div>

          <div class="results-table-wrap">
            <ResultsTable
              id="external-results-body"
              rows={props.planner.externalRows()}
            />
          </div>
        </section>
      </div>
    </Show>
  );
}

export function ResultsTable(props: { id?: string; rows: RecruitmentRow[] }) {
  return (
    <table class="results-table">
      <thead>
        <tr>
          <th scope="col">Creature</th>
          <th scope="col">Produced</th>
          <th scope="col">Each</th>
          <th scope="col">Weekly cost</th>
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
                <small>{row.detail}</small>
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
