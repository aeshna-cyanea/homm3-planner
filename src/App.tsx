import type { Planner } from "./planner";
import { ExternalDwellings } from "./components/ExternalDwellings";
import { ProductionScheme } from "./components/ProductionScheme";
import { Recruitment } from "./components/Recruitment";

const githubUrl = "https://github.com/aeshna-cyanea/homm3-planner";
const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH;

export function App(props: { planner: Planner }) {
  return (
    <main class="app-shell">
      <h1 class="sr-only">HotA town production</h1>
      <div class="planner-layout">
        <div class="planner-inputs">
          <ProductionScheme planner={props.planner} />
          <ExternalDwellings planner={props.planner} />
        </div>
        <Recruitment planner={props.planner} />
      </div>
      <SourceFooter />
    </main>
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
