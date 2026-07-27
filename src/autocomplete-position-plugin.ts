import type {
  AutoCompleteConfig,
  AutoCompleteFeedback,
  AutoCompleteInstance,
} from "./autocomplete-types";

interface PositionPluginOptions {
  aboveClass?: string;
  gap?: number;
  selectFirstOnEnter?: boolean;
}

/**
 * Adds viewport-aware placement to autoComplete.js. The opening direction is
 * locked until close so changing result counts cannot make the list jump.
 */
export default function createAutoCompletePositionPlugin<T>(
  options: PositionPluginOptions = {},
) {
  const aboveClass = options.aboveClass ?? "is-above";
  const gap = options.gap ?? 8;
  const selectFirstOnEnter = Boolean(options.selectFirstOnEnter);
  let instance: AutoCompleteInstance<T> | undefined;
  let opensAbove: boolean | undefined;
  let resultsReversed = false;

  function reverseResults(): void {
    if (!instance?.feedback.results.length) return;

    instance.feedback.results.reverse();
    const children = Array.from(instance.list.children);
    const idPrefix = `${instance.resultItem.id}_`;
    const resultItems = children.filter((child) => child.id.startsWith(idPrefix));
    let resultIndex = resultItems.length - 1;
    instance.list.replaceChildren(
      ...children.map((child) =>
        child.id.startsWith(idPrefix) ? resultItems[resultIndex--] : child),
    );
    resultsReversed = !resultsReversed;
  }

  function positionResults(): void {
    if (!instance) return;

    const inputBounds = instance.input.getBoundingClientRect();
    const list = instance.list;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    list.style.maxHeight = "";
    const listHeight = list.getBoundingClientRect().height;
    if (opensAbove === undefined) {
      opensAbove = inputBounds.bottom + gap + listHeight > viewportHeight;
    }
    if (opensAbove && !resultsReversed) reverseResults();

    const availableHeight = opensAbove
      ? inputBounds.top - gap
      : viewportHeight - inputBounds.bottom - gap;
    list.style.top = opensAbove ? "auto" : "100%";
    list.style.bottom = opensAbove ? "100%" : "auto";
    list.style.marginTop = opensAbove ? "0" : `${gap}px`;
    list.style.marginBottom = opensAbove ? `${gap}px` : "0";
    list.classList.toggle(aboveClass, opensAbove);
    if (listHeight > availableHeight) {
      list.style.maxHeight = `${Math.max(0, Math.floor(availableHeight))}px`;
    }
    list.scrollTop = opensAbove ? list.scrollHeight : 0;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!instance) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (opensAbove && instance.cursor < 0) {
        instance.goTo(instance.feedback.results.length - 1);
      } else {
        instance.next();
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      instance.previous();
      return;
    }
    if (event.key === "Escape") {
      instance.input.value = "";
      instance.input.dispatchEvent(
        new CustomEvent("clear", {
          bubbles: true,
          cancelable: true,
          detail: instance.feedback,
        }),
      );
      instance.close();
      return;
    }
    if (event.key === "Tab") {
      if (instance.resultsList.tabSelect && instance.cursor >= 0) instance.select();
      return;
    }
    if (event.key !== "Enter" || event.isComposing) return;

    if (!instance.submit) event.preventDefault();
    if (
      selectFirstOnEnter &&
      instance.input.value.trim() &&
      instance.isOpen &&
      instance.feedback.results.length
    ) {
      instance.select(opensAbove ? instance.feedback.results.length - 1 : 0);
    } else if (instance.cursor >= 0) {
      instance.select();
    }
  }

  function configure(config: AutoCompleteConfig<T>): AutoCompleteConfig<T> {
    const renderList = config.resultsList?.element;
    const inputEvents = config.events?.input;

    return {
      ...config,
      resultsList: {
        ...config.resultsList,
        element(list, feedback) {
          resultsReversed = false;
          renderList?.(list, feedback);
          if (opensAbove) reverseResults();
          if (instance?.isOpen) positionResults();
        },
      },
      events: {
        ...config.events,
        input: {
          ...inputEvents,
          keydown(event) {
            inputEvents?.keydown?.(event);
            if (!event.defaultPrevented) handleKeydown(event);
          },
          open(event) {
            inputEvents?.open?.(event);
            positionResults();
          },
          close(event) {
            inputEvents?.close?.(event);
            if (resultsReversed) reverseResults();
            opensAbove = undefined;
          },
        },
      },
    };
  }

  function attach(autoComplete: AutoCompleteInstance<T>): void {
    instance = autoComplete;
  }

  return { configure, attach };
}
