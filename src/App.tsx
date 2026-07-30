import { For, createSignal, onCleanup, onMount } from "solid-js";
import { isPlainShortcut } from "./keyboard";
import type { Planner } from "./planner";
import { CreatureDetailsProvider } from "./components/CreatureDetails";
import { ExternalDwellings } from "./components/ExternalDwellings";
import { PlannerControls } from "./components/PlannerControls";
import { ExternalRecruitment } from "./components/Recruitment";
import { TownSection } from "./components/TownSection";

const githubUrl = "https://github.com/aeshna-cyanea/homm3-planner";
const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH;

export function App(props: { planner: Planner }) {
  const [showDwellingCosts, setShowDwellingCosts] = createSignal(false);

  onMount(() => window.addEventListener("keydown", toggleDwellingCosts));
  onCleanup(() => window.removeEventListener("keydown", toggleDwellingCosts));

  function toggleDwellingCosts(event: KeyboardEvent): void {
    if (!isPlainShortcut(event, "u")) return;
    event.preventDefault();
    setShowDwellingCosts((visible) => !visible);
  }

  return (
    <CreatureDetailsProvider catalog={props.planner.catalog}>
      <main
        class="app-shell"
        data-dwelling-costs={showDwellingCosts() ? "shown" : "hidden"}
      >
        <h1 class="sr-only">HotA town production</h1>
        <div class="town-list">
          <For each={props.planner.state.townPlans}>
            {(plan) => (
              <TownSection
                planner={props.planner}
                planId={plan.id}
                showDwellingCosts={showDwellingCosts()}
              />
            )}
          </For>
        </div>
        <div class="planner-layout external-layout">
          <ExternalDwellings planner={props.planner} />
          <ExternalRecruitment planner={props.planner} />
        </div>
        <PlannerControls planner={props.planner} />
        <SourceFooter />
      </main>
    </CreatureDetailsProvider>
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
