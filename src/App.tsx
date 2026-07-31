import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { isPlainShortcut } from "./keyboard";
import {
  loadPreferences,
  savePreferences,
  type PlannerPreferences,
} from "./persistence";
import type { Planner } from "./planner";
import { CreatureDetailsProvider } from "./components/CreatureDetails";
import { ExternalDwellings } from "./components/ExternalDwellings";
import { PlannerControls } from "./components/PlannerControls";
import { ExternalRecruitment } from "./components/Recruitment";
import { TownSection } from "./components/TownSection";

const githubUrl = "https://github.com/aeshna-cyanea/homm3-planner";
const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH;

export function App(props: { planner: Planner }) {
  let plannerContent!: HTMLDivElement;
  const preferences = loadPreferences();
  const [showBuildingCosts, setShowBuildingCosts] = createSignal(
    preferences.showBuildingCosts,
  );
  const [controlsPosition, setControlsPosition] = createSignal(
    preferences.controlsPosition,
  );
  const [showPendingBuildingHint, setShowPendingBuildingHint] = createSignal(
    !preferences.pendingBuildingHintDismissed,
  );

  onMount(() => window.addEventListener("keydown", toggleBuildingCosts));
  onCleanup(() => window.removeEventListener("keydown", toggleBuildingCosts));

  createEffect(() => {
    if (
      showPendingBuildingHint() &&
      props.planner.state.townPlans.some(
        (plan) =>
          plan.pendingFortification !== null ||
          plan.pendingDwellings.length > 0 ||
          plan.pendingHordes.length > 0,
      )
    ) {
      dismissPendingBuildingHint();
    }
  });

  function toggleBuildingCosts(event: KeyboardEvent): void {
    if (!isPlainShortcut(event, "u")) return;
    event.preventDefault();
    toggleBuildingCostsVisibility();
  }

  function persistPreferences(next: Partial<PlannerPreferences>): void {
    savePreferences({
      showBuildingCosts: showBuildingCosts(),
      controlsPosition: controlsPosition(),
      pendingBuildingHintDismissed: !showPendingBuildingHint(),
      ...next,
    });
  }

  function dismissPendingBuildingHint(): void {
    if (plannerContent) {
      plannerContent.classList.remove("is-relocating");
      plannerContent.style.removeProperty("--planner-content-offset-y");
    }
    const previousContentTop = plannerContent?.getBoundingClientRect().top;
    setShowPendingBuildingHint(false);
    persistPreferences({ pendingBuildingHintDismissed: true });
    if (
      previousContentTop === undefined ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const offset =
      previousContentTop - plannerContent.getBoundingClientRect().top;
    if (offset === 0) return;
    plannerContent.style.setProperty(
      "--planner-content-offset-y",
      `${offset}px`,
    );
    void plannerContent.offsetWidth;
    plannerContent.classList.add("is-relocating");
  }

  function toggleBuildingCostsVisibility(): void {
    const next = !showBuildingCosts();
    setShowBuildingCosts(next);
    persistPreferences({ showBuildingCosts: next });
  }

  function toggleControlsPosition(): void {
    const next = controlsPosition() === "header" ? "footer" : "header";
    setControlsPosition(next);
    persistPreferences({ controlsPosition: next });
  }

  function finishContentRelocating(event: AnimationEvent): void {
    if (event.animationName !== "relocate-planner-content") return;
    const content = event.currentTarget as HTMLDivElement;
    content.classList.remove("is-relocating");
    content.style.removeProperty("--planner-content-offset-y");
  }

  return (
    <CreatureDetailsProvider catalog={props.planner.catalog}>
      <main
        class="app-shell planner-app"
        data-building-costs={showBuildingCosts() ? "shown" : "hidden"}
        data-controls-position={controlsPosition()}
      >
        <h1 class="sr-only">HotA town production</h1>
        <PlannerControls
          planner={props.planner}
          showBuildingCosts={showBuildingCosts()}
          controlsPosition={controlsPosition()}
          contentElement={() => plannerContent}
          onToggleBuildingCosts={toggleBuildingCostsVisibility}
          onToggleControlsPosition={toggleControlsPosition}
        />
        <Show when={showPendingBuildingHint()}>
          <PendingBuildingHint onDismiss={dismissPendingBuildingHint} />
        </Show>
        <div
          ref={plannerContent}
          class="planner-content"
          onAnimationEnd={finishContentRelocating}
        >
          <div class="town-list">
            <For each={props.planner.state.townPlans}>
              {(plan) => (
                <TownSection
                  planner={props.planner}
                  planId={plan.id}
                  showBuildingCosts={showBuildingCosts()}
                />
              )}
            </For>
          </div>
          <div class="planner-layout external-layout">
            <ExternalDwellings planner={props.planner} />
            <ExternalRecruitment planner={props.planner} />
          </div>
        </div>
        <SourceFooter />
      </main>
    </CreatureDetailsProvider>
  );
}

function PendingBuildingHint(props: { onDismiss: () => void }) {
  return (
    <aside class="pending-building-hint" aria-label="Pending building tip">
      <span class="pending-building-hint-copy pending-building-hint-pointer-copy">
        Middle-click a building to mark it as pending.
      </span>
      <span class="pending-building-hint-copy pending-building-hint-touch-copy">
        Two-finger tap a building to mark it as pending.
      </span>
      <button
        class="pending-building-hint-close"
        type="button"
        aria-label="Dismiss pending building tip"
        onClick={props.onDismiss}
      >
        ×
      </button>
    </aside>
  );
}

export function LoadError(props: { message: string }) {
  return (
    <main class="app-shell">
      <div class="load-error" id="load-error" role="alert">
        {props.message}
      </div>
      <SourceFooter />
    </main>
  );
}

function SourceFooter() {
  const commitUrl = `${githubUrl}/commit/${commitHash}`;
  return (
    <footer class="site-meta" aria-label="Source version">
      <a href={githubUrl}>GitHub</a>
      <span aria-hidden="true"> · </span>
      <a
        href={commitUrl}
        aria-label={`View commit ${commitHash} on GitHub`}
      >
        <code>{commitHash}</code>
      </a>
    </footer>
  );
}
