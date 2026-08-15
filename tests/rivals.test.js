import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createRivals, updateRivals } from '../src/rivals.js';

const world = { width: 1200, height: 600, top: 168, cover: [] };
const rng = () => 0.5;

function fieldWith(items) {
  return { items: [...items], timer: 0 };
}

test('a swarm starts at the configured population, inside the meadow', () => {
  const rivals = createRivals(world, rng);
  assert.equal(rivals.length, CONFIG.rivals.count);

  for (const rival of rivals) {
    assert.ok(rival.x >= 0 && rival.x <= world.width);
    assert.ok(rival.y >= world.top && rival.y <= world.height, `y=${rival.y} outside the ground`);
    assert.ok(['ant', 'beetle'].includes(rival.kind));
  }
});

test('a rival walks toward the nearest food', () => {
  const rivals = createRivals(world, rng);
  const rival = rivals[0];
  rival.x = 200;
  rival.y = 400;
  rival.nibbleFor = 0;

  const food = fieldWith([{ x: 600, y: 400, type: 'seed', value: 25, radius: 6, age: 0 }]);
  const before = Math.abs(600 - rival.x);

  for (let i = 0; i < 30; i += 1) updateRivals([rival], 1 / 60, world, food, rng);

  assert.ok(Math.abs(600 - rival.x) < before, 'the rival did not close on the food');
});

test('reaching food consumes it and reports the theft', () => {
  const rivals = createRivals(world, rng);
  const rival = rivals[0];
  rival.x = 600;
  rival.y = 400;
  rival.nibbleFor = 0;

  const food = fieldWith([{ x: 600, y: 400, type: 'berry', value: 60, radius: 9, age: 0 }]);
  const eaten = updateRivals([rival], 1 / 60, world, food, rng);

  assert.equal(eaten.length, 1);
  assert.equal(eaten[0].type, 'berry');
  assert.equal(food.items.length, 0, 'the food should be gone');
  assert.ok(rival.nibbleFor > 0, 'the rival should pause after eating');
});

test('a nibbling rival stays put and does not eat again immediately', () => {
  const rivals = createRivals(world, rng);
  const rival = rivals[0];
  rival.x = 600;
  rival.y = 400;
  rival.nibbleFor = CONFIG.rivals.nibbleSeconds;

  const food = fieldWith([{ x: 600, y: 400, type: 'seed', value: 25, radius: 6, age: 0 }]);
  const eaten = updateRivals([rival], 1 / 60, world, food, rng);

  assert.equal(eaten.length, 0);
  assert.equal(food.items.length, 1);
  assert.equal(rival.x, 600, 'it should not wander off mid-meal');
});

test('rivals ignore food beyond their senses and wander instead', () => {
  const rivals = createRivals(world, rng);
  const rival = rivals[0];
  rival.x = 50;
  rival.y = 400;
  rival.nibbleFor = 0;

  const far = CONFIG.rivals.senseRange + 300;
  const food = fieldWith([{ x: 50 + far, y: 400, type: 'seed', value: 25, radius: 6, age: 0 }]);

  updateRivals([rival], 1 / 60, world, food, rng);
  assert.equal(rival.targetX === 50 + far, false, 'it should not beeline to food it cannot sense');
});

test('rivals never leave the playable ground, however long they roam', () => {
  const rivals = createRivals(world, rng);
  const food = fieldWith([]);

  for (let i = 0; i < 4000; i += 1) {
    updateRivals(rivals, 1 / 60, world, food, Math.random);
  }

  for (const rival of rivals) {
    assert.ok(rival.x >= 0 && rival.x <= world.width, `x=${rival.x}`);
    assert.ok(rival.y >= world.top && rival.y <= world.height, `y=${rival.y}`);
  }
});

test('a swarm clears a field of food given time', () => {
  const rivals = createRivals(world, rng);
  const food = fieldWith(
    Array.from({ length: 6 }, (unused, i) => ({
      x: 150 + i * 150, y: 300 + (i % 3) * 80, type: 'seed', value: 25, radius: 6, age: 0,
    })),
  );

  for (let i = 0; i < 60 * 60; i += 1) updateRivals(rivals, 1 / 60, world, food, Math.random);
  assert.equal(food.items.length, 0, `${food.items.length} items were never eaten`);
});
