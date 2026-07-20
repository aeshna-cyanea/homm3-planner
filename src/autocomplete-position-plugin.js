/**
 * Extends an autoComplete.js config with viewport-aware, direction-locked
 * results placement. Call configure() before construction and attach() after.
 */
export default function createAutoCompletePositionPlugin(options = {}) {
  const aboveClass = options.aboveClass || "is-above";
  const gap = options.gap ?? 8;
  const selectFirstOnEnter = Boolean(options.selectFirstOnEnter);
  let autoCompleteInstance = null;
  let opensAbove = null;
  let renderedResultsReversed = false;

  function reverseRenderedResultOrder() {
    const instance = autoCompleteInstance;
    const results = instance?.feedback?.results;
    if (!instance || !results?.length) return;

    results.reverse();
    const children = Array.from(instance.list.children);
    const resultIdPrefix = instance.resultItem.id + "_";
    const resultItems = children.filter(function isResultItem(child) {
      return child.id.startsWith(resultIdPrefix);
    });
    let resultIndex = resultItems.length - 1;
    instance.list.replaceChildren(
      ...children.map(function reverseOnlyResultItems(child) {
        return child.id.startsWith(resultIdPrefix) ? resultItems[resultIndex--] : child;
      }),
    );
    renderedResultsReversed = !renderedResultsReversed;
  }

  function positionResults() {
    const instance = autoCompleteInstance;
    if (!instance) return;

    const inputBounds = instance.input.getBoundingClientRect();
    const resultsList = instance.list;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    resultsList.style.maxHeight = "";
    const listHeight = resultsList.getBoundingClientRect().height;
    const directionWasUnset = opensAbove === null;
    if (directionWasUnset) {
      opensAbove = inputBounds.bottom + gap + listHeight > viewportHeight;
    }
    if (opensAbove && !renderedResultsReversed) reverseRenderedResultOrder();

    const availableHeight = opensAbove
      ? inputBounds.top - gap
      : viewportHeight - inputBounds.bottom - gap;
    resultsList.style.top = opensAbove ? "auto" : "100%";
    resultsList.style.bottom = opensAbove ? "100%" : "auto";
    resultsList.style.marginTop = opensAbove ? "0" : gap + "px";
    resultsList.style.marginBottom = opensAbove ? gap + "px" : "0";
    resultsList.classList.toggle(aboveClass, opensAbove);
    if (listHeight > availableHeight) {
      resultsList.style.maxHeight = Math.max(0, Math.floor(availableHeight)) + "px";
    }
    resultsList.scrollTop = opensAbove ? resultsList.scrollHeight : 0;
  }

  function handleKeydown(event) {
    const instance = autoCompleteInstance;
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
      instance.feedback?.results?.length
    ) {
      instance.select(opensAbove ? instance.feedback.results.length - 1 : 0);
    } else if (instance.cursor >= 0) {
      instance.select();
    }
  }

  function configure(config) {
    const originalListElement = config.resultsList?.element;
    const originalInputEvents = config.events?.input || {};
    const originalKeydown = originalInputEvents.keydown;
    const originalOpen = originalInputEvents.open;
    const originalClose = originalInputEvents.close;

    return {
      ...config,
      resultsList: {
        ...config.resultsList,
        element: function renderPositionedResults(list, data) {
          renderedResultsReversed = false;
          if (originalListElement) originalListElement.call(this, list, data);
          if (opensAbove) reverseRenderedResultOrder();
          if (autoCompleteInstance?.isOpen) positionResults();
        },
      },
      events: {
        ...config.events,
        input: {
          ...originalInputEvents,
          keydown: function positionAwareKeydown(event) {
            if (originalKeydown) originalKeydown.call(this, event);
            if (!event.defaultPrevented) handleKeydown(event);
          },
          open: function positionOpenedResults(event) {
            if (originalOpen) originalOpen.call(this, event);
            positionResults();
          },
          close: function unlockResultDirection(event) {
            if (originalClose) originalClose.call(this, event);
            if (renderedResultsReversed) reverseRenderedResultOrder();
            opensAbove = null;
          },
        },
      },
    };
  }

  function attach(instance) {
    autoCompleteInstance = instance;
  }

  return { configure, attach };
}
