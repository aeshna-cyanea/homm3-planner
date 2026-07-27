import { For, Show } from "solid-js";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { RecruitmentRow } from "../types";
import { CostDisplay, ResourceTotals } from "./ResourceCost";

export function Recruitment(props: { planner: Planner }) {
  return (
    <div class="results-column">
      <section class="results-section panel" aria-labelledby="results-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow" id="results-title">Weekly recruitment</p>
            <Show when={props.planner.productionRows().length > 0}>
              <div class="totals" id="totals" aria-live="polite">
                <ResourceTotals
                  id="resource-totals"
                  entries={props.planner.productionTotals()}
                />
              </div>
            </Show>
          </div>
          <p class="result-context" id="result-context">
            {props.planner.resultContext()}
          </p>
        </div>

        <Show
          when={props.planner.productionRows().length > 0}
          fallback={
            <div class="empty-results" id="empty-results">
              Select a dwelling to begin the production plan.
            </div>
          }
        >
          <div class="results-table-wrap" id="results-table-wrap">
            <ResultsTable
              id="results-body"
              rows={props.planner.productionRows()}
            />
          </div>
        </Show>
      </section>

      <Show when={props.planner.externalRows().length > 0}>
        <section
          class="results-section panel"
          id="external-results-section"
          aria-labelledby="external-results-title"
        >
          <div class="section-heading">
            <div>
              <p class="eyebrow" id="external-results-title">
                External recruitment
              </p>
              <div class="totals" aria-live="polite">
                <ResourceTotals
                  id="external-resource-totals"
                  entries={props.planner.externalTotals()}
                />
              </div>
            </div>
            <p class="result-context" id="external-result-context">
              All factions · External dwellings
            </p>
          </div>

          <div class="results-table-wrap">
            <ResultsTable
              id="external-results-body"
              rows={props.planner.externalRows()}
            />
          </div>
        </section>
      </Show>

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
      </div>
    </div>
  );
}

function ResultsTable(props: { id: string; rows: RecruitmentRow[] }) {
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
                <strong>{row.name}</strong>
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
