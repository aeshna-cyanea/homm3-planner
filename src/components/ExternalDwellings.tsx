import { For } from "solid-js";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { ExternalDwellingCard as Card } from "../types";
import { DwellingSearch } from "./DwellingSearch";
import { CostDisplay } from "./ResourceCost";

export function ExternalDwellings(props: { planner: Planner }) {
  return (
    <section
      class="scheme-section external-dwellings-section panel"
      aria-labelledby="external-dwellings-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">Outside your town</p>
          <h2 id="external-dwellings-title">External dwellings</h2>
        </div>
        <p class="cycle-key">
          Dwellings added from the production scheme appear here.
        </p>
      </div>

      <div
        class="unit-grid external-dwelling-grid"
        id="external-dwelling-grid"
        aria-live="polite"
      >
        <For each={props.planner.externalDwellingCards()}>
          {(card) => <ExternalDwellingCard planner={props.planner} card={card} />}
        </For>
        <DwellingSearch planner={props.planner} />
      </div>
    </section>
  );
}

function ExternalDwellingCard(props: { planner: Planner; card: Card }) {
  function setCount(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    input.value = String(
      props.planner.setExternalCardCount(props.card.creatureName, input.value),
    );
  }

  return (
    <div class="unit-slot external-dwelling-slot">
      <div
        class="unit-card external-dwelling-card"
        data-stage="0"
        data-creature-name={props.card.creatureName}
        data-count={props.card.count}
      >
        <div class="unit-card-cycle external-dwelling-card-body">
          <span class="card-top">
            <span class="tier-label">
              {props.card.factionName} · Tier {props.card.tier}
            </span>
            <button
              class="external-remove-button"
              type="button"
              aria-label={`Remove all external dwellings for ${props.card.creature.name}`}
              onClick={() =>
                props.planner.setExternalDwellingCount(props.card.creatureName, 0)}
            >
              <svg
                class="external-remove-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m9 9 6 6m0-6-6 6" />
              </svg>
            </button>
          </span>
          <span class="creature-name">{props.card.creature.name}</span>
          <span class="creature-details">
            <span class="production-detail">
              <strong>{formatNumber(props.card.production)}</strong>/week,{" "}
            </span>
            <span class="cost-detail">
              <CostDisplay cost={props.card.creature.cost} />
            </span>
          </span>
        </div>

        <div class="external-dwelling-control external-card-count-control">
          <span class="external-dwelling-icon" aria-hidden="true">🏠</span>
          <button
            class="external-dwelling-button"
            type="button"
            data-external-card-action="decrement"
            aria-label={`Remove one external dwelling for ${props.card.creature.name}`}
            disabled={props.card.count <= 1}
            onClick={() =>
              props.planner.adjustExternalCard(props.card.creatureName, "decrement")}
          >−</button>
          <input
            class="external-dwelling-input external-card-count-input"
            type="number"
            inputmode="numeric"
            min="1"
            max="99"
            value={props.card.count}
            aria-label={`External dwellings for ${props.card.creature.name}`}
            onChange={setCount}
          />
          <button
            class="external-dwelling-button"
            type="button"
            data-external-card-action="increment"
            aria-label={`Add one external dwelling for ${props.card.creature.name}`}
            disabled={props.card.count >= 99}
            onClick={() =>
              props.planner.adjustExternalCard(props.card.creatureName, "increment")}
          >+</button>
        </div>
      </div>
    </div>
  );
}
