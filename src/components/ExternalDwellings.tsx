import { For, Show } from "solid-js";
import { dwellingLabel } from "../dwelling-label";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { ExternalDwellingCard as Card } from "../types";
import { CreatureNameButton } from "./CreatureDetails";
import { DwellingSearch } from "./DwellingSearch";
import { CostDisplay } from "./ResourceCost";

export function ExternalDwellings(props: { planner: Planner }) {
  return (
    <section
      class="scheme-section external-dwellings-section panel planner-inputs"
      aria-labelledby="external-dwellings-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">Outside your town</p>
          <h2 id="external-dwellings-title">External&nbsp;dwellings</h2>
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
      props.planner.setExternalCardCount(props.card.id, input.value),
    );
  }

  return (
    <div class="unit-slot external-dwelling-slot">
      <div
        class="unit-card external-dwelling-card"
        data-stage="0"
        data-dwelling-id={props.card.id}
        data-dwelling-name={props.card.name}
        data-count={props.card.count}
      >
        <div class="unit-card-cycle external-dwelling-card-body">
          <span class="card-top">
            <span class="level-label">
              {dwellingLabel(
                props.card.name,
                props.card.recruitments.map((recruitment) => recruitment.level),
              )}
            </span>
            <button
              class="external-remove-button"
              type="button"
              aria-label={`Remove all ${props.card.name} dwellings`}
              onClick={() =>
                props.planner.removeExternalDwelling(props.card.id)}
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
          <span class="creature-name external-creature-names">
            <For each={props.card.recruitments}>
              {(recruitment, index) => (
                <>
                  <Show when={index() > 0}>{" · "}</Show>
                  <CreatureNameButton name={recruitment.creature.name} />
                </>
              )}
            </For>
          </span>
          <span class="creature-details">
            <span class="production-detail">
              <strong>{formatNumber(props.card.production)}</strong>/week
            </span>
            <Show when={props.card.recruitments.length === 1}>
              {", "}
              <span class="cost-detail">
                <CostDisplay cost={props.card.recruitments[0].unitCost} />
              </span>
            </Show>
          </span>
        </div>

        <div class="external-dwelling-control external-card-count-control">
          <span class="external-dwelling-icon" aria-hidden="true">🏠</span>
          <button
            class="external-dwelling-button"
            type="button"
            data-external-card-action="decrement"
            aria-label={`Remove one ${props.card.name} dwelling`}
            disabled={props.card.count <= 1}
            onClick={() =>
              props.planner.adjustExternalCard(props.card.id, "decrement")}
          >−</button>
          <input
            class="external-dwelling-input external-card-count-input"
            type="number"
            inputmode="numeric"
            min="1"
            max="99"
            value={props.card.count}
            aria-label={`${props.card.name} dwellings`}
            onChange={setCount}
          />
          <button
            class="external-dwelling-button"
            type="button"
            data-external-card-action="increment"
            aria-label={`Add one ${props.card.name} dwelling`}
            disabled={props.card.count >= 99}
            onClick={() =>
              props.planner.adjustExternalCard(props.card.id, "increment")}
          >+</button>
        </div>
      </div>
    </div>
  );
}
