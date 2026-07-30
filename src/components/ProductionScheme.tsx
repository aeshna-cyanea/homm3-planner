import { For, Show } from "solid-js";
import {
  basicCreature,
  externalDwellingName,
  hordeBuilding,
} from "../catalog";
import { dwellingLabel } from "../dwelling-label";
import { FORTIFICATION_COPY } from "../planner";
import type { Planner } from "../planner";
import { formatNumber } from "../resources";
import { createThreeFingerTapRecognizer } from "../three-finger-tap";
import type { Dwelling } from "../types";
import { CreatureNameButton } from "./CreatureDetails";
import { CostDisplay } from "./ResourceCost";

export function ProductionScheme(props: {
  planner: Planner;
  planId: string;
  showBuildingCosts: boolean;
}) {
  return (
    <section
      class="scheme-section production-scheme-section panel"
      id={domId("town-selection", props.planId)}
      data-town-id={props.planId}
      aria-label={`${props.planner.townLabel(props.planId)} production scheme`}
    >
      <TownControls
        planner={props.planner}
        planId={props.planId}
        showBuildingCosts={props.showBuildingCosts}
      />
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
              showBuildingCosts={props.showBuildingCosts}
            />
          )}
        </For>
      </div>
    </section>
  );
}

function TownControls(props: {
  planner: Planner;
  planId: string;
  showBuildingCosts: boolean;
}) {
  const plan = () => props.planner.plan(props.planId);
  const fortification = () => plan().fortification;
  const copy = () => FORTIFICATION_COPY[fortification()];
  const cost = () => props.planner.fortificationCost(
    props.planner.nextFortification(props.planId),
  );
  const pending = () => plan().pendingFortification !== null;
  const id = (name: string) => domId(name, props.planId);
  const threeFingerTap = createThreeFingerTapRecognizer(togglePending);

  function togglePending(): void {
    props.planner.togglePendingFortification(props.planId);
  }

  function handleMiddleButtonDown(event: MouseEvent): void {
    if (event.button === 1) event.preventDefault();
  }

  function handleAuxiliaryClick(event: MouseEvent): void {
    if (event.button !== 1) return;
    event.preventDefault();
    togglePending();
  }

  function handleCycleKeyDown(event: KeyboardEvent): void {
    if (
      event.key !== "Enter" ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    togglePending();
  }

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
          data-pending={pending() ? "true" : "false"}
          classList={{ "is-pending": pending() }}
          title={
            pending()
              ? `Confirm ${copy().name}`
              : `Select ${FORTIFICATION_COPY[
                  props.planner.nextFortification(props.planId)
                ].name}`
          }
          aria-labelledby={[
            id("fortification-label"),
            id("fortification-name"),
            id("fortification-detail"),
          ].join(" ")}
          aria-describedby={id("fortification-cycle-hint")}
          aria-keyshortcuts="Shift+Enter"
          onClick={() => props.planner.cycleFortification(props.planId)}
          onKeyDown={handleCycleKeyDown}
          onMouseDown={handleMiddleButtonDown}
          onAuxClick={handleAuxiliaryClick}
          onTouchStart={(event) => threeFingerTap.start(event)}
          onTouchMove={(event) => threeFingerTap.move(event)}
          onTouchEnd={(event) => threeFingerTap.end(event)}
          onTouchCancel={() => threeFingerTap.cancel()}
        >
          <span class="fortification-button-copy">
            <span class="fortification-name-row">
              <strong id={id("fortification-name")}>{copy().name}</strong>
              <Show when={pending()}>
                <span
                  class="pending-clock fortification-pending-clock"
                  aria-hidden="true"
                  title="Pending"
                >
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5v5l3.5 2" />
                  </svg>
                </span>
              </Show>
            </span>
            <small id={id("fortification-detail")}>
              <span class="fortification-growth">{copy().growth}</span>
              {props.showBuildingCosts && cost() && (
                <span class="fortification-cost">
                  <CostDisplay cost={cost()!} />
                </span>
              )}
            </small>
          </span>
        </button>
        <span class="sr-only" id={id("fortification-cycle-hint")}>
          {pending()
            ? "Pending. Activate to confirm; Shift Enter or middle click to cancel."
            : `Activate to select ${
                FORTIFICATION_COPY[
                  props.planner.nextFortification(props.planId)
                ].name
              }. Shift Enter or middle click advances it as pending.`}
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
  showBuildingCosts: boolean;
}) {
  const plan = () => props.planner.plan(props.planId);
  const basic = () => basicCreature(props.dwelling);
  const selection = () => plan().selections[props.index];
  const label = () =>
    dwellingLabel(
      externalDwellingName(props.planner.catalog, props.dwelling) ?? "Dwelling",
      props.dwelling.level,
      selection(),
    );
  const horde = () => hordeBuilding(props.dwelling);
  const selected = () => props.planner.creature(props.planId, props.index);
  const detail = () => props.planner.detailCreature(props.planId, props.index);
  const nextCost = () =>
    selection() < 0
      ? props.dwelling.building_cost
      : props.dwelling.upgrade_costs?.[selection()];
  const externalCount = () =>
    props.planner.externalDwellingCount(basic().name);
  const pending = () => plan().pendingDwellings.includes(props.index);
  const threeFingerTap = createThreeFingerTapRecognizer(togglePending);

  function togglePending(): void {
    props.planner.togglePendingDwelling(props.planId, props.index);
  }

  function handleMiddleButtonDown(event: MouseEvent): void {
    if (event.button === 1) event.preventDefault();
  }

  function handleAuxiliaryClick(event: MouseEvent): void {
    if (event.button !== 1) return;
    event.preventDefault();
    togglePending();
  }

  function handleCycleKeyDown(event: KeyboardEvent): void {
    if (
      event.key !== "Enter" ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    togglePending();
  }

  function setExternalCount(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const count = props.planner.setExternalDwellingCount(basic().name, input.value);
    input.value = count ? String(count) : "";
  }

  return (
    <div class="unit-slot" classList={{ "has-horde": Boolean(horde()) }}>
      <div
        class="unit-card"
        classList={{ "is-pending": pending() }}
        data-stage={selection()}
        data-pending={pending() ? "true" : "false"}
      >
        <div
          class="unit-card-cycle production-card-body"
          onMouseDown={handleMiddleButtonDown}
          onAuxClick={handleAuxiliaryClick}
          onTouchStart={(event) => threeFingerTap.start(event)}
          onTouchMove={(event) => threeFingerTap.move(event)}
          onTouchEnd={(event) => threeFingerTap.end(event)}
          onTouchCancel={() => threeFingerTap.cancel()}
        >
          <button
            class="unit-card-cycle-action"
            type="button"
            data-slot={props.index}
            aria-label={props.planner.cardAriaLabel(props.planId, props.index)}
            aria-keyshortcuts="Shift+Enter"
            onClick={() =>
              props.planner.cycleDwelling(props.planId, props.index)}
            onKeyDown={handleCycleKeyDown}
          />
          <span class="card-top">
            <span class="level-label">{label()}</span>
            <span class="state-markers">
              <span
                class="state-label"
                aria-hidden="true"
                title={props.planner.stageName(selection())}
              />
              <Show when={pending()}>
                <span class="pending-clock" aria-hidden="true" title="Pending">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5v5l3.5 2" />
                  </svg>
                </span>
              </Show>
            </span>
          </span>
          <span
            class="next-dwelling-cost"
            hidden={!props.showBuildingCosts}
          >
            {nextCost() ? (
              <CostDisplay cost={nextCost()!} />
            ) : (
              <span class="next-dwelling-cost-complete">
                No further upgrade
              </span>
            )}
          </span>
          <CreatureNameButton
            class="creature-name"
            name={props.planner.creatureName(props.planId, props.index)}
          />
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
        </div>

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
