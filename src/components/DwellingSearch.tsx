import AutoComplete from "@tarekraafat/autocomplete.js";
import { onCleanup, onMount } from "solid-js";
import createAutoCompletePositionPlugin from "../autocomplete-position-plugin";
import type {
  AutoCompleteConfig,
  AutoCompleteInstance,
} from "../autocomplete-types";
import { deduplicateBy } from "../deduplicate";
import { dwellingLabel } from "../dwelling-label";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";

interface SearchOption {
  id: string;
  name: string;
  aliases: string;
  creatures: string[];
  factions: string[];
  tiers: number[];
}

export function DwellingSearch(props: { planner: Planner }) {
  let input!: HTMLInputElement;
  let search: AutoCompleteInstance<SearchOption> | undefined;

  onMount(() => {
    const options = Array.from(
      props.planner.catalog.externalDwellingCatalog,
      ([id, dwelling]) => ({
        id,
        name: dwelling.name,
        aliases: dwelling.recruitments
          .map((recruitment) => recruitment.creature.name)
          .join(" "),
        creatures: dwelling.recruitments
          .map((recruitment) => recruitment.creature.name),
        factions: Array.from(new Set(
          dwelling.recruitments.map((recruitment) => recruitment.factionName),
        )),
        tiers: dwelling.recruitments.map((recruitment) => recruitment.tier),
      }),
    );
    const position = createAutoCompletePositionPlugin<SearchOption>({
      aboveClass: "is-above",
      gap: 8,
      selectFirstOnEnter: true,
    });

    const config: AutoCompleteConfig<SearchOption> = {
      selector: () => input,
      data: {
        src: options,
        keys: ["name", "aliases"],
        cache: true,
        filter: (results) =>
          deduplicateBy(results, (result) => result.value.id),
      },
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
          message.textContent =
            `No dwellings or creatures found for “${feedback.query}”`;
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
            const dwellingId = event.detail.selection?.value.id;
            if (!dwellingId) return;
            props.planner.addExternalDwelling(dwellingId);
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

  function focusFromCard(event: MouseEvent): void {
    const target = event.target as Element;
    if (target.closest(".autocomplete-dropdown")) return;
    input.focus();
  }

  return (
    <div class="unit-slot external-dwelling-slot add-dwelling-slot">
      <div class="unit-card add-dwelling-card" onClick={focusFromCard}>
        <div class="unit-card-cycle add-dwelling-card-body">
          <span class="card-top">
            <span class="tier-label">New external dwelling</span>
            <span class="add-dwelling-symbol" aria-hidden="true">+</span>
          </span>
          <span class="creature-name add-dwelling-name">
            <span>Add a dwelling</span>
            <kbd class="shortcut-key">/</kbd>
          </span>
          <label class="sr-only" for="external-dwelling-search">
            Search creatures
          </label>
          <input
            ref={input}
            class="external-dwelling-search-source"
            id="external-dwelling-search"
            type="search"
            placeholder="Search creatures"
            autocomplete="off"
            aria-keyshortcuts="/"
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

  container.className = "external-search-option";
  name.append(highlightMatch(
    dwellingLabel(option.name, option.tiers),
    query,
  ));
  detail.append(
    highlightMatch(option.creatures.join(", "), query),
    ` · ${option.factions.join(", ")}`,
  );
  container.append(name, detail);
  return container;
}

function highlightMatch(value: string, query: string): DocumentFragment {
  const content = document.createDocumentFragment();
  const matchIndex = value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (!query || matchIndex < 0) {
    content.append(value);
    return content;
  }

  const highlight = document.createElement("mark");
  highlight.className = "external-search-highlight";
  highlight.textContent = value.slice(matchIndex, matchIndex + query.length);
  content.append(
    value.slice(0, matchIndex),
    highlight,
    value.slice(matchIndex + query.length),
  );
  return content;
}
