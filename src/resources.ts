import { RESOURCES } from "./types";
import type { Cost, CostEntry, Resource } from "./types";

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function costEntries(cost: Cost = {}): CostEntry[] {
  return (Object.entries(cost) as CostEntry[])
    .filter(([, amount]) => amount > 0)
    .sort(([left], [right]) => resourceOrder(left) - resourceOrder(right));
}

export function multiplyCost(cost: Cost, quantity: number): Cost {
  return Object.fromEntries(
    costEntries(cost).map(([resource, amount]) => [resource, amount * quantity]),
  );
}

export function sumCosts(costs: Cost[]): Cost {
  const total: Cost = {};
  for (const cost of costs) {
    for (const [resource, amount] of costEntries(cost)) {
      total[resource] = (total[resource] ?? 0) + amount;
    }
  }
  return total;
}

export function totalCosts(costs: Cost[]): CostEntry[] {
  return costEntries(sumCosts(costs));
}

function resourceOrder(resource: Resource): number {
  return RESOURCES.indexOf(resource);
}
