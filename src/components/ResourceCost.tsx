import { For } from "solid-js";
import { costEntries, formatNumber } from "../resources";
import type { Cost, CostEntry, Resource } from "../types";

export function ResourceSymbol(props: { resource: Resource }) {
  return (
    <span class="resource-symbol">
      <span
        class={`resource-icon resource-icon-${props.resource}`}
        aria-hidden="true"
      />
      <span class="sr-only"> {props.resource}</span>
    </span>
  );
}

export function CostDisplay(props: { cost: Cost }) {
  const entries = (): CostEntry[] => {
    const cost = props.cost ?? {};
    const positiveEntries = costEntries(cost);
    return cost.gold === 0
      ? [["gold", 0], ...positiveEntries]
      : positiveEntries;
  };
  return (
    <For each={entries()}>
      {(entry, index) => (
        <>
          <span class="cost-item">
            <b>{formatNumber(entry[1])}</b>
            <ResourceSymbol resource={entry[0]} />
            {index() < entries().length - 1 && (
              <span class="cost-separator" aria-hidden="true">,</span>
            )}
          </span>
          {index() < entries().length - 1 && " "}
        </>
      )}
    </For>
  );
}

export function ResourceTotals(props: {
  id?: string;
  entries: CostEntry[];
}) {
  return (
    <div class="resource-totals" id={props.id}>
      <For each={props.entries}>
        {([resource, amount]) => (
          <span class="resource-total">
            <strong>{formatNumber(amount)}</strong>
            <ResourceSymbol resource={resource} />
          </span>
        )}
      </For>
    </div>
  );
}
