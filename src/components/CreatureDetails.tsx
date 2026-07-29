import {
  For,
  Show,
  createContext,
  createSignal,
  useContext,
  type ParentProps,
} from "solid-js";
import { creatureProfile } from "../catalog";
import { dwellingLabel, tierSymbol } from "../dwelling-label";
import { formatNumber } from "../resources";
import type { Catalog, CreatureProfile } from "../types";
import { CostDisplay } from "./ResourceCost";

interface CreatureDetailsContextValue {
  open(name: string): void;
}

const CreatureDetailsContext =
  createContext<CreatureDetailsContextValue>();

export function CreatureDetailsProvider(
  props: ParentProps<{ catalog: Catalog }>,
) {
  const [profile, setProfile] = createSignal<CreatureProfile>();
  let dialog!: HTMLDialogElement;

  function open(name: string): void {
    const nextProfile = creatureProfile(props.catalog, name);
    if (!nextProfile) return;

    setProfile(nextProfile);
    queueMicrotask(() => {
      if (!dialog.open) dialog.showModal();
    });
  }

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === dialog) dialog.close();
  }

  function cycle(): void {
    const current = profile();
    if (!current?.variants || current.variantIndex === undefined) return;

    const nextIndex = (current.variantIndex + 1) % current.variants.length;
    const nextProfile = creatureProfile(
      props.catalog,
      current.variants[nextIndex].name,
    );
    if (nextProfile) setProfile(nextProfile);
  }

  return (
    <CreatureDetailsContext.Provider value={{ open }}>
      {props.children}
      <dialog
        ref={dialog}
        class="creature-details-dialog"
        aria-labelledby="creature-details-title"
        onClick={closeFromBackdrop}
        onClose={() => setProfile()}
      >
        <Show when={profile()}>
          {(current) => (
            <CreatureInfobox profile={current()} onCycle={cycle} />
          )}
        </Show>
      </dialog>
    </CreatureDetailsContext.Provider>
  );
}

export function CreatureNameButton(props: {
  name: string;
  class?: string;
}) {
  const details = useContext(CreatureDetailsContext);
  if (!details) {
    throw new Error("CreatureNameButton must be inside CreatureDetailsProvider");
  }

  return (
    <button
      class={`creature-info-trigger${props.class ? ` ${props.class}` : ""}`}
      type="button"
      aria-haspopup="dialog"
      onClick={() => details.open(props.name)}
    >
      {props.name}
    </button>
  );
}

function CreatureInfobox(props: {
  profile: CreatureProfile;
  onCycle(): void;
}) {
  const creature = () => props.profile.creature;
  const baseCreature = () => props.profile.baseCreature;
  const damage = () =>
    `${creature().damage.min}–${creature().damage.max}`;
  const baseDamage = () => {
    const base = baseCreature();
    return base ? `${base.damage.min}–${base.damage.max}` : undefined;
  };
  const changedFromBase = (
    current: number | string,
    base: number | string | undefined,
  ) => base !== undefined && current !== base;
  const stats = () => [
    {
      id: "attack",
      emoji: "⚔️",
      label: "Attack",
      value: creature().attack,
      changed: changedFromBase(creature().attack, baseCreature()?.attack),
    },
    {
      id: "defense",
      emoji: "🛡️",
      label: "Defense",
      value: creature().defense,
      changed: changedFromBase(creature().defense, baseCreature()?.defense),
    },
    {
      id: "damage",
      emoji: "🎲",
      label: "Damage",
      value: damage(),
      changed: changedFromBase(damage(), baseDamage()),
    },
    {
      id: "health",
      emoji: "❤️",
      label: "Health",
      value: creature().health,
      changed: changedFromBase(creature().health, baseCreature()?.health),
    },
    {
      id: "speed",
      emoji: "🏃",
      label: "Speed",
      value: creature().speed,
      changed: changedFromBase(creature().speed, baseCreature()?.speed),
    },
    {
      id: "growth",
      emoji: "🌱",
      label: "Growth",
      value: creature().growth,
      changed: changedFromBase(creature().growth, baseCreature()?.growth),
    },
  ];
  const abilitiesChanged = () => {
    const base = baseCreature();
    return base ? creature().special !== base.special : false;
  };
  const nextVariant = () => {
    const { variants, variantIndex } = props.profile;
    return variants && variantIndex !== undefined
      ? variants[(variantIndex + 1) % variants.length]
      : undefined;
  };

  function cycleFromPanel(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest("button, a")) props.onCycle();
  }

  return (
    <div
      class="creature-details-panel"
      classList={{ "is-cycleable": Boolean(nextVariant()) }}
      onClick={cycleFromPanel}
    >
      <header class="dialog-header">
        <div>
          <p class="eyebrow">
            {props.profile.factionName} ·{" "}
            {props.profile.dwellingName
              ? dwellingLabel(props.profile.dwellingName, props.profile.tier)
              : tierSymbol(props.profile.tier)}
            <Show when={props.profile.variant}>
              {" "}· {props.profile.variant}
            </Show>
          </p>
          <h2 id="creature-details-title">{creature().name}</h2>
        </div>
        <div class="creature-dialog-actions">
          <Show when={nextVariant()}>
            {(next) => (
              <button
                class="dialog-close-button creature-variant-cycle-button"
                type="button"
                aria-label={`Show ${next().name}`}
                title={`Show ${next().name}`}
                onClick={props.onCycle}
              >
                ↻
              </button>
            )}
          </Show>
          <form method="dialog">
            <button class="dialog-close-button" type="submit" aria-label="Close">
              ×
            </button>
          </form>
        </div>
      </header>

      <dl class="creature-stat-grid">
        <For each={stats()}>
          {(stat) => (
            <div
              class="creature-stat"
              classList={{ "is-upgrade-difference": stat.changed }}
              data-stat={stat.id}
              data-changed={stat.changed}
            >
              <dt>
                <span class="creature-stat-emoji" aria-hidden="true">
                  {stat.emoji}
                </span>
                {stat.label}
              </dt>
              <dd>
                {typeof stat.value === "number"
                  ? formatNumber(stat.value)
                  : stat.value}
              </dd>
            </div>
          )}
        </For>
      </dl>

      <div class="creature-profile-meta">
        <div>
          <p class="creature-profile-label">Recruitment cost</p>
          <div class="creature-profile-cost">
            <CostDisplay cost={creature().cost} />
          </div>
        </div>
        <a
          class="creature-wiki-link"
          href={creature().wiki_url}
          target="_blank"
          rel="noreferrer"
        >
          Heroes 3 Wiki <span aria-hidden="true">↗</span>
        </a>
      </div>

      <Show when={creature().special || abilitiesChanged()}>
        <section
          class="creature-special"
          classList={{ "is-upgrade-difference": abilitiesChanged() }}
        >
          <h3>Special abilities</h3>
          <p>{creature().special || "No special abilities"}</p>
        </section>
      </Show>
    </div>
  );
}
