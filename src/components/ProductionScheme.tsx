import { For } from "solid-js";
import { basicCreature, hordeBuilding } from "../catalog";
import { FORTIFICATION_COPY } from "../planner";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import type { Dwelling } from "../types";
import { CostDisplay } from "./ResourceCost";

export function ProductionScheme(props: { planner: Planner; planId: string }) {
  return (
    <section
      class="scheme-section production-scheme-section panel planner-inputs"
      id={domId("town-selection", props.planId)}
      data-town-id={props.planId}
      aria-label={`${props.planner.townLabel(props.planId)} production scheme`}
    >
      <TownControls planner={props.planner} planId={props.planId} />
      <div
        class="unit-grid"
        id={domId("unit-grid", props.planId)}
        aria-live="polite"
      >
        <For each={props.planner.dwellings(props.planId)}>
          {(dwelling, index) => (
            <DwellingCard
              planner={props.planner}
              planId={props.planId}
              dwelling={dwelling}
              index={index()}
            />
          )}
        </For>
      </div>
    </section>
  );
}

function TownControls(props: { planner: Planner; planId: string }) {
  const plan = () => props.planner.plan(props.planId);
  const fortification = () => plan().fortification;
  const copy = () => FORTIFICATION_COPY[fortification()];
  const cost = () => props.planner.fortificationCost(fortification());
  const id = (name: string) => domId(name, props.planId);

  return (
    <div class="scheme-controls">
      <label class="town-control" for={id("town-select")}>
        <span>Town</span>
        <select
          id={id("town-select")}
          value={plan().town}
          onChange={(event) =>
            props.planner.changeTown(props.planId, event.currentTarget.value)}
        >
          <For each={props.planner.catalog.towns}>
            {(town) => <option value={town.name}>{town.name}</option>}
          </For>
        </select>
      </label>

      <div class="fortification-control">
        <span class="fortification-label" id={id("fortification-label")}>
          Fortification
        </span>
        <button
          class="fortification-cycle-button"
          id={id("fortification-cycle")}
          type="button"
          data-fortification={fortification()}
          title={
            `Select ${FORTIFICATION_COPY[
              props.planner.nextFortification(props.planId)
            ].name}`
          }
          aria-labelledby={[
            id("fortification-label"),
            id("fortification-name"),
            id("fortification-detail"),
          ].join(" ")}
          aria-describedby={id("fortification-cycle-hint")}
          onClick={() => props.planner.cycleFortification(props.planId)}
        >
          <span class="fortification-button-copy">
            <strong id={id("fortification-name")}>{copy().name}</strong>
            <small id={id("fortification-detail")}>
              <span class="fortification-growth">{copy().growth}</span>
              {cost() && (
                <span class="fortification-cost">
                  <CostDisplay cost={cost()!} />
                </span>
              )}
            </small>
          </span>
        </button>
        <span class="sr-only" id={id("fortification-cycle-hint")}>
          Activate to select{" "}
          {FORTIFICATION_COPY[props.planner.nextFortification(props.planId)].name}.
        </span>
      </div>
    </div>
  );
}

function DwellingCard(props: {
  planner: Planner;
  planId: string;
  dwelling: Dwelling;
  index: number;
}) {
  const plan = () => props.planner.plan(props.planId);
  const basic = () => basicCreature(props.dwelling);
  const horde = () => hordeBuilding(props.dwelling);
  const selection = () => plan().selections[props.index];
  const selected = () => props.planner.creature(props.planId, props.index);
  const detail = () => props.planner.detailCreature(props.planId, props.index);
  const externalCount = () =>
    props.planner.externalDwellingCount(basic().name);

  function setExternalCount(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const count = props.planner.setExternalDwellingCount(basic().name, input.value);
    input.value = count ? String(count) : "";
  }

  return (
    <div class="unit-slot" classList={{ "has-horde": Boolean(horde()) }}>
      <div class="unit-card" data-stage={selection()}>
        <button
          class="unit-card-cycle"
          type="button"
          data-slot={props.index}
          aria-label={props.planner.cardAriaLabel(props.planId, props.index)}
          onClick={() =>
            props.planner.cycleDwelling(props.planId, props.index)}
        >
          <span class="card-top">
            <span class="tier-label">Tier {props.dwelling.tier}</span>
            <span
              class="state-label"
              aria-hidden="true"
              title={props.planner.stageName(selection())}
            />
          </span>
          <span class="creature-name">
            {props.planner.creatureName(props.planId, props.index)}
          </span>
          <span class="creature-details">
            <span class="production-detail">
              <strong>
                {formatNumber(props.planner.productionFor(props.planId, props.index))}
              </strong>
              /week,{" "}
            </span>
            <span class="cost-detail">
              <CostDisplay cost={detail().cost} />
            </span>
          </span>
        </button>

        <div class="external-dwelling-control">
          <span class="external-dwelling-icon" aria-hidden="true">🏠</span>
          <button
            class="external-dwelling-button"
            type="button"
            data-external-action="decrement"
            data-slot={props.index}
            aria-label={`Remove an external dwelling for ${basic().name}`}
            disabled={externalCount() === 0}
            onClick={() =>
              props.planner.adjustExternalDwelling(basic().name, "decrement")}
          >−</button>
          <input
            class="external-dwelling-input"
            type="number"
            inputmode="numeric"
            min="0"
            max="99"
            placeholder="0"
            value={externalCount() || ""}
            data-slot={props.index}
            aria-label={`External dwellings for ${basic().name}`}
            onChange={setExternalCount}
          />
          <button
            class="external-dwelling-button"
            type="button"
            data-external-action="increment"
            data-slot={props.index}
            aria-label={`Add an external dwelling for ${basic().name}`}
            disabled={externalCount() === 99}
            onClick={() =>
              props.planner.adjustExternalDwelling(basic().name, "increment")}
          >+</button>
          <button
            class="external-dwelling-button"
            type="button"
            data-external-action="reset"
            data-slot={props.index}
            aria-label={`Reset external dwellings for ${basic().name}`}
            disabled={externalCount() === 0}
            onClick={() =>
              props.planner.adjustExternalDwelling(basic().name, "reset")}
          >⟲</button>
        </div>
      </div>

      {horde() && (
        <label
          class="horde-toggle"
          classList={{ "is-disabled": !selected() }}
        >
          <input
            class="horde-checkbox"
            type="checkbox"
            data-slot={props.index}
            checked={plan().hordeEnabled[props.index]}
            disabled={!selected()}
            onChange={(event) =>
              props.planner.toggleHorde(
                props.planId,
                props.index,
                event.currentTarget.checked,
              )}
          />
          <span class="toggle-indicator" aria-hidden="true" />
          <span class="horde-copy">
            <strong>{horde()!.name}</strong>
            <small>
              +{horde()!.growth_bonus} growth ·{" "}
              <CostDisplay cost={horde()!.cost} />
            </small>
          </span>
        </label>
      )}
    </div>
  );
}

function domId(base: string, planId: string): string {
  return planId === "town-1" ? base : `${base}-${planId}`;
}
