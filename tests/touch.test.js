import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createTouchControls, touchLayout, BUTTON_IDS } from '../src/touch.js';

/** A stand-in for a DOM target that speaks touch events. */
function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, touches) {
      for (const handler of listeners.get(type) ?? []) {
        handler({ preventDefault() {}, changedTouches: touches });
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

const SCREEN = { width: 844, height: 390 };

function controls() {
  const target = fakeTarget();
  const touch = createTouchControls(target);
  touch.resize(SCREEN.width, SCREEN.height);
  touch.attach();
  return { target, touch, layout: touch.layout() };
}

const at = (id, x, y) => [{ identifier: id, clientX: x, clientY: y }];

test('the layout keeps all three buttons on screen, under the right thumb', () => {
  const layout = touchLayout(SCREEN.width, SCREEN.height);
  assert.equal(layout.buttons.length, 3);
  assert.deepEqual(layout.buttons.map((b) => b.id).sort(), [...BUTTON_IDS].sort());

  for (const button of layout.buttons) {
    assert.ok(button.x - layout.radius >= 0, `${button.id} is off the left edge`);
    assert.ok(button.x + layout.radius <= SCREEN.width, `${button.id} is off the right edge`);
    assert.ok(button.y + layout.radius <= SCREEN.height, `${button.id} is off the bottom`);
    assert.ok(button.x > SCREEN.width / 2, `${button.id} should sit under the right thumb`);
  }
});

test('buttons do not overlap each other', () => {
  const layout = touchLayout(SCREEN.width, SCREEN.height);
  for (let i = 0; i < layout.buttons.length; i += 1) {
    for (let j = i + 1; j < layout.buttons.length; j += 1) {
      const a = layout.buttons[i];
      const b = layout.buttons[j];
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) >= layout.radius * 2,
        `${a.id} and ${b.id} overlap`,
      );
    }
  }
});

test('the layout adapts to a small screen without shrinking away', () => {
  const small = touchLayout(568, 320);
  assert.ok(small.radius >= CONFIG.touch.buttonMinRadius);
  for (const button of small.buttons) {
    assert.ok(button.x + small.radius <= 568);
    assert.ok(button.y + small.radius <= 320);
  }
});

test('nothing is pressed before the screen is touched', () => {
  const { touch } = controls();
  assert.equal(touch.isActive(), false);
  assert.deepEqual(
    { ...touch.intent },
    { dx: 0, dy: 0, sing: false, jump: false, strike: false },
  );
});

test('each button drives its own action', () => {
  for (const { id, flag } of [
    { id: 'sing', flag: 'sing' },
    { id: 'jump', flag: 'jump' },
    { id: 'fight', flag: 'strike' },
  ]) {
    const { target, touch, layout } = controls();
    const button = layout.buttons.find((b) => b.id === id);

    target.emit('touchstart', at(1, button.x, button.y));
    assert.equal(touch.intent[flag], true, `${id} did not set ${flag}`);

    target.emit('touchend', at(1, button.x, button.y));
    assert.equal(touch.intent[flag], false, `${id} did not clear ${flag}`);
  }
});

test('a thumb on the left half raises a stick where it landed', () => {
  const { target, touch } = controls();

  target.emit('touchstart', at(1, 120, 240));
  assert.equal(touch.stick.active, true);
  assert.equal(touch.stick.originX, 120);
  assert.equal(touch.stick.originY, 240);

  // Resting still is not movement: singing needs the cricket standing.
  assert.equal(touch.intent.dx, 0);
  assert.equal(touch.intent.dy, 0);
});

test('dragging the stick steers, and the direction is normalised', () => {
  const { target, touch } = controls();

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchmove', at(1, 180, 240));

  assert.ok(Math.abs(touch.intent.dx - 1) < 0.001, 'should be pushing right');
  assert.ok(Math.abs(touch.intent.dy) < 0.001);
  assert.ok(Math.abs(Math.hypot(touch.intent.dx, touch.intent.dy) - 1) < 0.001);
});

test('a small wobble inside the dead zone does not move the cricket', () => {
  const { target, touch } = controls();

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchmove', at(1, 120 + CONFIG.touch.stickDeadZone - 2, 240));

  assert.equal(touch.intent.dx, 0);
  assert.equal(touch.intent.dy, 0);
});

test('the knob stays within the stick radius however far the thumb travels', () => {
  const { target, touch, layout } = controls();

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchmove', at(1, 900, 240));

  const reach = Math.hypot(touch.stick.x - touch.stick.originX, touch.stick.y - touch.stick.originY);
  assert.ok(reach <= layout.stickMaxRadius + 0.001, `knob reached ${reach}`);
  assert.ok(Math.abs(touch.intent.dx - 1) < 0.001, 'but it still steers fully');
});

test('lifting the thumb stops the cricket dead', () => {
  const { target, touch } = controls();

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchmove', at(1, 200, 300));
  assert.ok(touch.intent.dx !== 0);

  target.emit('touchend', at(1, 200, 300));
  assert.equal(touch.stick.active, false);
  assert.equal(touch.intent.dx, 0);
  assert.equal(touch.intent.dy, 0);
});

test('steering and pressing a button at the same time both work', () => {
  const { target, touch, layout } = controls();
  const jump = layout.buttons.find((b) => b.id === 'jump');

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchmove', at(1, 200, 240));
  target.emit('touchstart', at(2, jump.x, jump.y));

  assert.ok(Math.abs(touch.intent.dx - 1) < 0.001, 'steering should survive the second thumb');
  assert.equal(touch.intent.jump, true);

  // Releasing the button must not release the stick.
  target.emit('touchend', at(2, jump.x, jump.y));
  assert.equal(touch.intent.jump, false);
  assert.equal(touch.stick.active, true);
  assert.ok(Math.abs(touch.intent.dx - 1) < 0.001);
});

test('two actions can be held at once', () => {
  const { target, touch, layout } = controls();
  const sing = layout.buttons.find((b) => b.id === 'sing');
  const fight = layout.buttons.find((b) => b.id === 'fight');

  target.emit('touchstart', at(1, sing.x, sing.y));
  target.emit('touchstart', at(2, fight.x, fight.y));

  assert.equal(touch.intent.sing, true);
  assert.equal(touch.intent.strike, true);
});

test('a touch on a button never starts the stick', () => {
  const { target, touch, layout } = controls();
  const jump = layout.buttons.find((b) => b.id === 'jump');

  target.emit('touchstart', at(1, jump.x, jump.y));
  assert.equal(touch.stick.active, false, 'the button swallowed the touch, as it should');
});

test('touching anywhere asks to start the run, and the ask is consumed once', () => {
  const { target, touch } = controls();

  assert.equal(touch.consumeStartRequest(), false);
  target.emit('touchstart', at(1, 400, 200));
  assert.equal(touch.consumeStartRequest(), true);
  assert.equal(touch.consumeStartRequest(), false);
});

test('losing focus releases every thumb', () => {
  const { target, touch, layout } = controls();
  const sing = layout.buttons.find((b) => b.id === 'sing');

  target.emit('touchstart', at(1, 120, 240));
  target.emit('touchstart', at(2, sing.x, sing.y));

  for (const handler of [() => {}]) handler();
  target.emit('blur', []);

  assert.equal(touch.intent.sing, false);
  assert.equal(touch.stick.active, false);
  assert.equal(touch.intent.dx, 0);
});

test('detach removes every listener', () => {
  const target = fakeTarget();
  const touch = createTouchControls(target);
  touch.attach();
  assert.ok(target.listenerCount('touchstart') > 0);

  touch.detach();
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.equal(target.listenerCount(type), 0, `${type} listener leaked`);
  }
});
