import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createCricket, updateCricket } from '../src/cricket.js';

const openWorld = { width: 800, height: 600, cover: [] };
const coveredWorld = {
  width: 800,
  height: 600,
  cover: [{ x: 100, y: 100, radius: 50, type: 'grass' }],
};

const still = { dx: 0, dy: 0, sing: false };

test('the cricket starts in the middle of the meadow, silent', () => {
  const cricket = createCricket(openWorld);
  assert.equal(cricket.x, 400);
  assert.equal(cricket.y, 300);
  assert.equal(cricket.singing, false);
  assert.equal(cricket.songSeconds, 0);
});

test('movement covers the configured speed over one second', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 0, sing: false }, 1, openWorld);
  assert.ok(Math.abs(cricket.x - (400 + CONFIG.cricket.speed)) < 0.001);
  assert.equal(cricket.y, 300);
});

test('diagonal movement is normalised so it is not faster than straight', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 1, sing: false }, 1, openWorld);
  const travelled = Math.hypot(cricket.x - 400, cricket.y - 300);
  assert.ok(Math.abs(travelled - CONFIG.cricket.speed) < 0.001, `travelled ${travelled}`);
});

test('the cricket cannot leave the meadow', () => {
  const cricket = createCricket(openWorld);
  for (let i = 0; i < 100; i += 1) {
    updateCricket(cricket, { dx: -1, dy: -1, sing: false }, 0.1, openWorld);
  }
  assert.equal(cricket.x, CONFIG.cricket.radius);
  assert.equal(cricket.y, CONFIG.cricket.radius);
});

test('singing requires standing still and blocks movement', () => {
  const cricket = createCricket(openWorld);
  const events = updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  assert.equal(cricket.singing, true);
  assert.equal(events.startedSinging, true);
  assert.equal(cricket.x, 400, 'a singing cricket does not move');
  assert.ok(Math.abs(cricket.songSeconds - 0.5) < 0.001);
});

test('pressing a direction while holding sing cancels the song and moves', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  const events = updateCricket(cricket, { dx: 1, dy: 0, sing: true }, 0.5, openWorld);
  assert.equal(cricket.singing, false);
  assert.equal(events.stoppedSinging, true);
  assert.equal(cricket.songSeconds, 0);
  assert.ok(cricket.x > 400, 'the cricket moved instead of singing');
});

test('releasing the sing key reports a stop exactly once', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.2, openWorld);

  const first = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(first.stoppedSinging, true);

  const second = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(second.stoppedSinging, false);
});

test('hidden reflects whether the cricket is standing in cover', () => {
  const cricket = createCricket(coveredWorld);
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, false);

  cricket.x = 100;
  cricket.y = 100;
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, true);
});

test('invulnerability counts down and never goes negative', () => {
  const cricket = createCricket(openWorld);
  cricket.invulnerableFor = 0.3;

  updateCricket(cricket, still, 0.2, openWorld);
  assert.ok(Math.abs(cricket.invulnerableFor - 0.1) < 0.001);

  updateCricket(cricket, still, 0.5, openWorld);
  assert.equal(cricket.invulnerableFor, 0);
});
