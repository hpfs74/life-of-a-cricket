import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

/** A minimal stand-in for a DOM event target so input is testable under Node. */
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
    emit(type, event = {}) {
      for (const handler of listeners.get(type) ?? []) {
        handler({ preventDefault() {}, ...event });
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

test('arrow keys and WASD both drive the intent', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'ArrowRight' });
  assert.equal(input.intent.dx, 1);

  target.emit('keyup', { code: 'ArrowRight' });
  assert.equal(input.intent.dx, 0);

  target.emit('keydown', { code: 'KeyW' });
  assert.equal(input.intent.dy, -1);

  target.emit('keyup', { code: 'KeyW' });
  assert.equal(input.intent.dy, 0);
});

test('opposite keys held together cancel out', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyA' });
  target.emit('keydown', { code: 'KeyD' });
  assert.equal(input.intent.dx, 0);
});

test('E sets and clears the sing flag', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyE' });
  assert.equal(input.intent.sing, true);

  target.emit('keyup', { code: 'KeyE' });
  assert.equal(input.intent.sing, false);
});

test('space drives jump, not sing', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'Space' });
  assert.equal(input.intent.jump, true);
  assert.equal(input.intent.sing, false, 'space must no longer sing');

  target.emit('keyup', { code: 'Space' });
  assert.equal(input.intent.jump, false);
});

test('space does not start a run, so a menu press cannot launch a leap', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'Space' });
  assert.equal(input.consumeStartRequest(), false);

  target.emit('keydown', { code: 'Enter' });
  assert.equal(input.consumeStartRequest(), true);
});

test('a start request is raised once and consumed once', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  assert.equal(input.consumeStartRequest(), false);

  target.emit('keydown', { code: 'Enter' });
  assert.equal(input.consumeStartRequest(), true);
  assert.equal(input.consumeStartRequest(), false);
});

test('detach removes every listener so nothing leaks', () => {
  const target = fakeTarget();
  const input = createInput(target);

  input.attach();
  assert.ok(target.listenerCount('keydown') > 0);

  input.detach();
  assert.equal(target.listenerCount('keydown'), 0);
  assert.equal(target.listenerCount('keyup'), 0);
});

test('losing focus releases every held key', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyD' });
  target.emit('keydown', { code: 'KeyE' });
  target.emit('keydown', { code: 'Space' });
  target.emit('blur');

  assert.equal(input.intent.dx, 0);
  assert.equal(input.intent.sing, false);
  assert.equal(input.intent.jump, false);
});



test('F drives the strike, separately from singing and leaping', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyF' });
  assert.equal(input.intent.strike, true);
  assert.equal(input.intent.sing, false);
  assert.equal(input.intent.jump, false);

  target.emit('keyup', { code: 'KeyF' });
  assert.equal(input.intent.strike, false);
});

test('losing focus drops the strike key too', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyF' });
  target.emit('blur');
  assert.equal(input.intent.strike, false);
});
