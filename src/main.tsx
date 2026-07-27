import { render } from "solid-js/web";
import { App, LoadError } from "./App";
import { buildCatalog } from "./catalog";
import { createPlanner } from "./planner";
import initializeServiceWorker from "./service-worker";
import type { CreatureData } from "./types";

initializeServiceWorker();

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

try {
  const embeddedData = document.querySelector<HTMLScriptElement>("#creature-data");
  const data = embeddedData
    ? (JSON.parse(embeddedData.textContent ?? "") as CreatureData)
    : await fetchCreatureData();
  const planner = createPlanner(buildCatalog(data));
  render(() => <App planner={planner} />, root);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  render(
    () => (
      <LoadError
        message={
          `Could not load creatures.json: ${message}. ` +
          "Run npm run dev and open the local URL it prints."
        }
      />
    ),
    root,
  );
}

async function fetchCreatureData(): Promise<CreatureData> {
  const response = await fetch("creatures.json");
  if (!response.ok) {
    throw new Error(`Creature data returned HTTP ${response.status}`);
  }
  return response.json() as Promise<CreatureData>;
}
