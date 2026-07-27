import AutoComplete from "@tarekraafat/autocomplete.js";
import { onCleanup, onMount } from "solid-js";
import createAutoCompletePositionPlugin from "../autocomplete-position-plugin";
import type {
  AutoCompleteConfig,
  AutoCompleteInstance,
} from "../autocomplete-types";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";

interface SearchOption {
  name: string;
  faction: string;
  tier: number;
}

export function DwellingSearch(props: { planner: Planner }) {
  let input!: HTMLInputElement;
  let search: AutoCompleteInstance<SearchOption> | undefined;

  onMount(() => {
    const options = Array.from(
      props.planner.catalog.dwellingCatalog,
      ([name, dwelling]) => ({
        name,
        faction: dwelling.factionName,
        tier: dwelling.tier,
      }),
    );
    const position = createAutoCompletePositionPlugin<SearchOption>({
      aboveClass: "is-above",
      gap: 8,
      selectFirstOnEnter: true,
    });

    const config: AutoCompleteConfig<SearchOption> = {
      selector: () => input,
      data: { src: options, keys: ["name"], cache: true },
      threshold: 1,
      resultsList: {
        class: "autocomplete-dropdown external-dwelling-dropdown",
        maxResults: options.length,
        noResults: true,
        element(list, feedback) {
          if (feedback.results.length > 0) return;
          const message = document.createElement("p");
          message.className = "no-results";
          message.setAttribute("role", "status");
          message.textContent = `No creatures found for “${feedback.query}”`;
          list.append(message);
        },
      },
      resultItem: {
        class: "autocomplete-result external-search-result",
        selected: "is-selected",
        element(item, result) {
          item.replaceChildren(renderOption(result.value, input.value));
        },
      },
      events: {
        input: {
          selection(event) {
            const creatureName = event.detail.selection?.value.name;
            if (!creatureName) return;
            props.planner.addExternalDwelling(creatureName);
            input.value = "";
          },
        },
      },
    };

    search = new AutoComplete(
      position.configure(config),
    ) as unknown as AutoCompleteInstance<SearchOption>;
    position.attach(search);
    window.addEventListener("keydown", focusSearch, { capture: true });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", focusSearch, { capture: true });
    search?.unInit();
  });

  function focusSearch(event: KeyboardEvent): void {
    if (!isPlainShortcut(event, "/")) return;
    event.preventDefault();
    input.focus();
  }

  return (
    <div class="unit-slot external-dwelling-slot add-dwelling-slot">
      <div class="unit-card add-dwelling-card">
        <div class="unit-card-cycle add-dwelling-card-body">
          <span class="card-top">
            <span class="tier-label">New external dwelling</span>
            <span class="add-dwelling-symbol" aria-hidden="true">+</span>
          </span>
          <span class="creature-name">Add a dwelling</span>
          <label class="sr-only" for="external-dwelling-search">
            Search creatures
          </label>
          <input
            ref={input}
            class="external-dwelling-search-source"
            id="external-dwelling-search"
            type="search"
            placeholder="press / to search"
            autocomplete="off"
            aria-describedby="external-search-note"
          />
          <small class="external-search-note" id="external-search-note">
            Select to add one dwelling.
          </small>
        </div>
      </div>
    </div>
  );
}

function renderOption(option: SearchOption, query: string): HTMLElement {
  const container = document.createElement("span");
  const name = document.createElement("strong");
  const detail = document.createElement("small");
  const matchIndex = option.name.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());

  container.className = "external-search-option";
  if (query && matchIndex >= 0) {
    const highlight = document.createElement("mark");
    highlight.className = "external-search-highlight";
    highlight.textContent = option.name.slice(matchIndex, matchIndex + query.length);
    name.append(
      option.name.slice(0, matchIndex),
      highlight,
      option.name.slice(matchIndex + query.length),
    );
  } else {
    name.textContent = option.name;
  }
  detail.textContent = `${option.faction} · Tier ${option.tier}`;
  container.append(name, detail);
  return container;
}
