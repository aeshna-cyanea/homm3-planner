import AutoComplete from "@tarekraafat/autocomplete.js";
import { onCleanup, onMount } from "solid-js";
import createAutoCompletePositionPlugin from "../autocomplete-position-plugin";
import type {
  AutoCompleteConfig,
  AutoCompleteInstance,
} from "../autocomplete-types";
import { isPlainShortcut } from "../keyboard";
import type { Planner } from "../planner";

interface TownOption {
  name: string;
}

export function TownSearch(props: { planner: Planner }) {
  let input!: HTMLInputElement;
  let search: AutoCompleteInstance<TownOption> | undefined;

  onMount(() => {
    const options = props.planner.catalog.towns.map(({ name }) => ({ name }));
    const position = createAutoCompletePositionPlugin<TownOption>({
      aboveClass: "is-above",
      gap: 8,
      selectFirstOnEnter: true,
    });

    const config: AutoCompleteConfig<TownOption> = {
      selector: () => input,
      data: { src: options, keys: ["name"], cache: true },
      threshold: 0,
      resultsList: {
        class: "autocomplete-dropdown town-search-dropdown",
        maxResults: options.length,
      },
      resultItem: {
        class: "autocomplete-result town-search-result",
        selected: "is-selected",
        element(item, result) {
          const name = document.createElement("strong");
          name.textContent = result.value.name;
          item.replaceChildren(name);
        },
      },
      events: {
        input: {
          focus() {
            search?.start();
          },
          click() {
            if (!search?.isOpen) search?.start();
          },
          selection(event) {
            const town = event.detail.selection?.value.name;
            if (!town) return;
            const planId = props.planner.addTown(town);
            input.value = "";
            input.blur();
            requestAnimationFrame(() => {
              document
                .querySelector<HTMLElement>(
                  `.town-section[data-town-id="${planId}"]`,
                )
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          },
        },
      },
    };

    search = new AutoComplete(
      position.configure(config),
    ) as unknown as AutoCompleteInstance<TownOption>;
    position.attach(search);
    window.addEventListener("keydown", focusSearch, { capture: true });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", focusSearch, { capture: true });
    search?.unInit();
  });

  function focusSearch(event: KeyboardEvent): void {
    if (
      !isPlainShortcut(event, "t") ||
      document.querySelector("dialog[open]")
    ) {
      return;
    }
    event.preventDefault();
    input.focus();
  }

  return (
    <input
      ref={input}
      class="town-search-input"
      id="add-town-search"
      type="search"
      placeholder="Search towns"
      autocomplete="off"
      aria-keyshortcuts="t"
    />
  );
}
