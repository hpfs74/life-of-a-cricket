import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createWater, isWaterAt } from '../src/water.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const bounds = { width: 2880, height: 600, top: 168 };

test('a meadow gets water, made of circles inside its bounds', () => {
  const water = createWater(bounds, seededRng(3));
  assert.ok(water.length > 0);

  for (const circle of water) {
    assert.ok(circle.radius > 0);
    assert.ok(circle.x > 0 && circle.x < bounds.width, `x=${circle.x}`);
    assert.ok(circle.y > bounds.top && circle.y < bounds.height, `y=${circle.y}`);
  }
});

test('the stream spans the ground band, so it genuinely divides the meadow', () => {
  const water = createWater(bounds, seededRng(11));
  const top = Math.min(...water.map((c) => c.y));
  const bottom = Math.max(...water.map((c) => c.y));

  assert.ok(top < bounds.top + 60, `water starts at ${top.toFixed(0)}`);
  assert.ok(bottom > bounds.height - 60, `water ends at ${bottom.toFixed(0)}`);
});

test('the stream is narrow in places and wide in others', () => {
  const water = createWater(bounds, seededRng(5));
  const radii = water.map((c) => c.radius);
  assert.ok(Math.max(...radii) - Math.min(...radii) > 8, 'water is a uniform width');
});

test('a run never starts in the water', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const water = createWater(bounds, seededRng(seed));
    const spawn = { x: bounds.width / 2, y: (bounds.top + bounds.height) / 2 };
    assert.equal(
      isWaterAt(water, spawn.x, spawn.y, CONFIG.cricket.radius),
      false,
      `seed ${seed} put the spawn point under water`,
    );
  }
});

test('isWaterAt agrees with the circle boundary and respects the margin', () => {
  const water = [{ x: 100, y: 100, radius: 50 }];

  assert.equal(isWaterAt(water, 100, 100), true);
  assert.equal(isWaterAt(water, 100, 149), true);
  assert.equal(isWaterAt(water, 100, 151), false);

  // A body of radius 10 should be stopped ten pixels earlier.
  assert.equal(isWaterAt(water, 100, 155, 10), true);
  assert.equal(isWaterAt(water, 100, 161, 10), false);
});

test('isWaterAt copes with a meadow that has no water at all', () => {
  assert.equal(isWaterAt([], 10, 10), false);
  assert.equal(isWaterAt(undefined, 10, 10), false);
});
