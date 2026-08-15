const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const SING = ['KeyE'];
const JUMP = ['Space'];
const START = ['Enter', 'NumpadEnter'];

const ALL_CODES = [...LEFT, ...RIGHT, ...UP, ...DOWN, ...SING, ...JUMP, ...START];

/**
 * Turns keyboard events into a neutral intent object the simulation reads.
 * Nothing here knows about the game rules, and the game never sees a DOM event.
 */
export function createInput(target) {
  const held = new Set();
  const intent = { dx: 0, dy: 0, sing: false, jump: false };
  let startRequested = false;

  function axis(negative, positive) {
    const low = negative.some((code) => held.has(code)) ? 1 : 0;
    const high = positive.some((code) => held.has(code)) ? 1 : 0;
    return high - low;
  }

  function refresh() {
    intent.dx = axis(LEFT, RIGHT);
    intent.dy = axis(UP, DOWN);
    intent.sing = SING.some((code) => held.has(code));
    // Held, not one-shot: the cricket edge-detects this so a leaning key
    // cannot chain leaps.
    intent.jump = JUMP.some((code) => held.has(code));
  }

  function onKeyDown(event) {
    if (!ALL_CODES.includes(event.code)) return;
    event.preventDefault?.();
    held.add(event.code);
    // Only ENTER starts a run: SPACE is the leap, so a press on the menu must
    // not launch the cricket the moment the run begins.
    if (START.includes(event.code)) startRequested = true;
    refresh();
  }

  function onKeyUp(event) {
    if (!ALL_CODES.includes(event.code)) return;
    event.preventDefault?.();
    held.delete(event.code);
    refresh();
  }

  function onBlur() {
    held.clear();
    refresh();
  }

  return {
    intent,

    consumeStartRequest() {
      const requested = startRequested;
      startRequested = false;
      return requested;
    },

    attach() {
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
    },

    detach() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
