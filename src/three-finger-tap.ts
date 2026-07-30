const MAX_TAP_DURATION_MS = 400;
const MAX_TAP_MOVEMENT_PX = 12;

interface TouchStart {
  x: number;
  y: number;
}

interface Gesture {
  active: Set<number>;
  starts: Map<number, TouchStart>;
  startedAt: number;
  invalid: boolean;
}

export interface ThreeFingerTapRecognizer {
  start(event: TouchEvent): void;
  move(event: TouchEvent): void;
  end(event: TouchEvent): void;
  cancel(): void;
}

export function createThreeFingerTapRecognizer(
  onTap: () => void,
): ThreeFingerTapRecognizer {
  let gesture: Gesture | undefined;

  function start(event: TouchEvent): void {
    gesture ??= {
      active: new Set(),
      starts: new Map(),
      startedAt: event.timeStamp,
      invalid: false,
    };

    for (const touch of Array.from(event.changedTouches)) {
      if (
        !(touch.target instanceof Node) ||
        !event.currentTarget ||
        !(event.currentTarget as Node).contains(touch.target)
      ) {
        gesture.invalid = true;
        continue;
      }
      gesture.active.add(touch.identifier);
      gesture.starts.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      });
    }
    if (gesture.starts.size > 3) gesture.invalid = true;
  }

  function move(event: TouchEvent): void {
    if (!gesture) return;
    checkMovement(event.changedTouches);
  }

  function end(event: TouchEvent): void {
    if (!gesture) return;
    checkMovement(event.changedTouches);
    for (const touch of Array.from(event.changedTouches)) {
      gesture.active.delete(touch.identifier);
    }
    if (gesture.active.size > 0) return;

    const recognized =
      !gesture.invalid &&
      gesture.starts.size === 3 &&
      event.timeStamp - gesture.startedAt <= MAX_TAP_DURATION_MS;
    gesture = undefined;
    if (!recognized) return;

    if (event.cancelable) event.preventDefault();
    onTap();
  }

  function checkMovement(touches: TouchList): void {
    if (!gesture) return;
    for (const touch of Array.from(touches)) {
      const origin = gesture.starts.get(touch.identifier);
      if (
        origin &&
        Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) >
          MAX_TAP_MOVEMENT_PX
      ) {
        gesture.invalid = true;
      }
    }
  }

  function cancel(): void {
    gesture = undefined;
  }

  return { start, move, end, cancel };
}
