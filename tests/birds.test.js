import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { spawnBird, updateBird } from '../src/birds.js';

const world = { width: 800, height: 600, cover: [] };
const rng = () => 0.5;

function context(overrides = {}) {
  return { world, cricket: { x: 400, y: 300 }, hidden: false, singing: false, ...overrides };
}

/** Runs the bird forward until it leaves the given state, or the guard trips. */
function runUntilStateChange(bird, ctx, dt = 1 / 60, maxSteps = 5000) {
  const startState = bird.state;
  let lastEvent = 'none';
  let steps = 0;

  while (bird.state === startState && steps < maxSteps) {
    lastEvent = updateBird(bird, dt, ctx);
    steps += 1;
  }

  assert.ok(steps < maxSteps, `bird never left ${startState}`);
  return lastEvent;
}

test('a spawned bird enters from outside the meadow', () => {
  const bird = spawnBird(world, rng, 1);
  assert.equal(bird.state, 'ENTER');

  const outside =
    bird.x < 0 || bird.x > world.width || bird.y < 0 || bird.y > world.height;
  assert.ok(outside, `bird spawned inside the meadow at ${bird.x},${bird.y}`);
});

test('difficulty scales the bird speed', () => {
  const slow = spawnBird(world, rng, 1);
  const fast = spawnBird(world, rng, 2);
  assert.ok(fast.speedScale > slow.speedScale);
});

test('a bird flies in and then starts circling', () => {
  const bird = spawnBird(world, rng, 1);
  runUntilStateChange(bird, context());
  assert.equal(bird.state, 'CIRCLE');
});

test('a bird that scans a hidden, silent cricket gives up and retreats', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true, singing: false });

  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'CIRCLE');

  const event = runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'RETREAT');
  assert.equal(event, 'scanned-lost');
});

test('a bird that scans a singing cricket dives even if it is hidden', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true, singing: true });

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'DIVE', 'singing from cover gives the cricket away');
});

test('the dive targets where the cricket was at scan time, not where it is now', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'DIVE');
  assert.equal(bird.targetX, 400);
  assert.equal(bird.targetY, 300);

  ctx.cricket = { x: 700, y: 100 };
  updateBird(bird, 1 / 60, ctx);
  assert.equal(bird.targetX, 400, 'the target must not follow the cricket');
  assert.equal(bird.targetY, 300);
});

test('a dive onto a stationary cricket hits it', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  const event = runUntilStateChange(bird, ctx);

  assert.equal(event, 'hit');
  assert.equal(bird.state, 'RETREAT');
});

test('a cricket that runs far enough after the scan is missed', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);

  ctx.cricket = { x: 50, y: 550 };
  const event = runUntilStateChange(bird, ctx);

  assert.equal(event, 'missed');
  assert.equal(bird.state, 'RETREAT');
});

test('a retreating bird eventually reports that it is gone', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true });

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'RETREAT');

  const event = runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'GONE');
  assert.equal(event, 'gone');
});
