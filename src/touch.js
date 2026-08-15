import { CONFIG } from './config.js';

/**
 * On-screen controls for phones.
 *
 * Steering is a floating stick: put a thumb down anywhere on the left half and
 * the stick appears there. Nothing to aim for, it suits any hand, and lifting
 * off stops the cricket dead — which matters, because singing requires standing
 * still.
 *
 * The three actions sit under the right thumb in an arc. Everything is tracked
 * by touch identifier, so steering and pressing a button at the same time works
 * the way it has to.
 *
 * Positions are in CSS pixels of the whole screen, not world units: the
 * controls deliberately live in the letterbox around the playfield.
 */

export const BUTTON_IDS = ['sing', 'jump', 'fight'];

/** Where the stick zone and the three buttons sit on a screen of this size. */
export function touchLayout(width, height) {
  const { buttonScale, buttonMinRadius, buttonMaxRadius, edgePadding, stickZoneFraction } = CONFIG.touch;

  const radius = Math.max(buttonMinRadius, Math.min(buttonMaxRadius, Math.min(width, height) * buttonScale));

  // The buttons sit on a quarter-arc swept by the thumb from the bottom-right.
  // At three radii the gap between neighbours is comfortably wider than a
  // button, so no two can ever be pressed by one thumb at once.
  const arcRadius = radius * 3;
  const pivotX = width - edgePadding - radius;
  const pivotY = height - edgePadding - radius;

  const place = (degrees) => ({
    x: pivotX + Math.cos((degrees * Math.PI) / 180) * arcRadius,
    y: pivotY + Math.sin((degrees * Math.PI) / 180) * arcRadius,
  });

  return {
    radius,
    arcRadius,
    stickMaxRadius: CONFIG.touch.stickMaxRadius,
    stickZone: { x: 0, y: 0, width: width * stickZoneFraction, height },
    buttons: [
      // Jump takes the middle of the arc: it is the panic button.
      { id: 'fight', label: '✕', ...place(180) },
      { id: 'jump', label: '↑', ...place(225) },
      { id: 'sing', label: '♪', ...place(270) },
    ],
  };
}

function buttonAt(layout, x, y) {
  // A generous hit area: thumbs are imprecise and the stakes are a lost life.
  const reach = layout.radius * 1.28;

  for (const button of layout.buttons) {
    if (Math.hypot(button.x - x, button.y - y) <= reach) return button;
  }
  return null;
}

export function createTouchControls(target) {
  const intent = { dx: 0, dy: 0, sing: false, jump: false, strike: false };
  const stick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };
  const pressed = new Set();

  // Which touch is doing what, by identifier.
  const assignments = new Map();

  let layout = touchLayout(1, 1);
  let active = false;
  let startRequested = false;

  function refresh() {
    intent.sing = pressed.has('sing');
    intent.jump = pressed.has('jump');
    intent.strike = pressed.has('fight');

    if (!stick.active) {
      intent.dx = 0;
      intent.dy = 0;
      return;
    }

    const dx = stick.x - stick.originX;
    const dy = stick.y - stick.originY;
    const distance = Math.hypot(dx, dy);

    if (distance < CONFIG.touch.stickDeadZone) {
      intent.dx = 0;
      intent.dy = 0;
      return;
    }

    intent.dx = dx / distance;
    intent.dy = dy / distance;
  }

  function begin(id, x, y) {
    active = true;
    startRequested = true;

    const button = buttonAt(layout, x, y);
    if (button) {
      assignments.set(id, { kind: 'button', button: button.id });
      pressed.add(button.id);
      return;
    }

    const zone = layout.stickZone;
    const inStickZone = x >= zone.x && x <= zone.x + zone.width;
    if (inStickZone && !stick.active) {
      assignments.set(id, { kind: 'stick' });
      stick.active = true;
      stick.originX = x;
      stick.originY = y;
      stick.x = x;
      stick.y = y;
    }
  }

  function move(id, x, y) {
    const assignment = assignments.get(id);
    if (!assignment || assignment.kind !== 'stick') return;

    // Clamp the knob to the stick's radius so it reads like a real stick.
    const dx = x - stick.originX;
    const dy = y - stick.originY;
    const distance = Math.hypot(dx, dy);
    const limit = layout.stickMaxRadius;

    if (distance > limit) {
      stick.x = stick.originX + (dx / distance) * limit;
      stick.y = stick.originY + (dy / distance) * limit;
    } else {
      stick.x = x;
      stick.y = y;
    }
  }

  function end(id) {
    const assignment = assignments.get(id);
    if (!assignment) return;

    assignments.delete(id);

    if (assignment.kind === 'button') pressed.delete(assignment.button);
    else stick.active = false;
  }

  function onStart(event) {
    event.preventDefault?.();
    for (const touch of event.changedTouches) begin(touch.identifier, touch.clientX, touch.clientY);
    refresh();
  }

  function onMove(event) {
    event.preventDefault?.();
    for (const touch of event.changedTouches) move(touch.identifier, touch.clientX, touch.clientY);
    refresh();
  }

  function onEnd(event) {
    event.preventDefault?.();
    for (const touch of event.changedTouches) end(touch.identifier);
    refresh();
  }

  function releaseAll() {
    assignments.clear();
    pressed.clear();
    stick.active = false;
    refresh();
  }

  return {
    intent,
    stick,
    pressed,

    /** True once the player has touched the screen at all. */
    isActive() {
      return active;
    },

    layout() {
      return layout;
    },

    resize(width, height) {
      layout = touchLayout(width, height);
    },

    consumeStartRequest() {
      const requested = startRequested;
      startRequested = false;
      return requested;
    },

    attach() {
      target.addEventListener('touchstart', onStart, { passive: false });
      target.addEventListener('touchmove', onMove, { passive: false });
      target.addEventListener('touchend', onEnd, { passive: false });
      target.addEventListener('touchcancel', onEnd, { passive: false });
      target.addEventListener('blur', releaseAll);
    },

    detach() {
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove', onMove);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', onEnd);
      target.removeEventListener('blur', releaseAll);
    },
  };
}
