export function isPlainShortcut(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLocaleLowerCase() === key.toLocaleLowerCase() &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isTypingTarget(event.target)
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
