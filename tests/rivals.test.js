import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createRivals, updateRivals, resolveStrike, spawnRival } from '../src/rivals.js';

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

function striker(x, y, dirX = 1, dirY = 0) {
  return { x, y, dirX, dirY };
}

test('bugs start with the health their kind deserves', () => {
  const rivals = createRivals(world, rng);
  for (const rival of rivals) {
    assert.equal(rival.health, CONFIG.rivals.health[rival.kind]);
  }
});

test('a swing hits the nearest bug in front and misses what is behind', () => {
  const behind = { ...createRivals(world, rng)[0], x: 460, y: 300, kind: 'ant', health: 1 };
  const ahead = { ...createRivals(world, rng)[0], x: 520, y: 300, kind: 'ant', health: 1 };
  const rivals = [behind, ahead];

  const result = resolveStrike(striker(500, 300), rivals);

  assert.equal(result.hit, ahead, 'it should have hit the bug it was facing');
  assert.equal(result.killed, true);
  assert.ok(rivals.includes(behind), 'the bug behind should be untouched');
});

test('a swing at empty air reports nothing', () => {
  const rivals = [{ ...createRivals(world, rng)[0], x: 900, y: 300, kind: 'ant', health: 1 }];
  const result = resolveStrike(striker(100, 300), rivals);

  assert.equal(result.hit, null);
  assert.equal(result.killed, false);
  assert.equal(rivals.length, 1);
});

test('an ant dies in one hit', () => {
  const ant = { ...createRivals(world, rng)[0], x: 520, y: 300, kind: 'ant', health: 1 };
  const rivals = [ant];

  const result = resolveStrike(striker(500, 300), rivals);
  assert.equal(result.killed, true);
  assert.equal(result.retaliated, false);
  assert.equal(rivals.length, 0, 'the corpse should be removed');
});

test('a beetle takes two hits, and bites back after the first', () => {
  const beetle = { ...createRivals(world, rng)[0], x: 520, y: 300, kind: 'beetle', health: 2, flashFor: 0 };
  const rivals = [beetle];

  const first = resolveStrike(striker(500, 300), rivals);
  assert.equal(first.killed, false, 'a beetle should survive one hit');
  assert.equal(first.retaliated, true, 'and bite back for it');
  assert.equal(beetle.health, 1);
  assert.ok(beetle.flashFor > 0, 'it should flash so the hit reads');
  assert.equal(rivals.length, 1);

  const second = resolveStrike(striker(500, 300), rivals);
  assert.equal(second.killed, true);
  assert.equal(second.retaliated, false, 'a dead beetle cannot bite');
  assert.equal(rivals.length, 0);
});

test('the hit flash fades on its own', () => {
  const rivals = [{ ...createRivals(world, rng)[0], x: 520, y: 300, kind: 'beetle', health: 2, flashFor: 0 }];
  resolveStrike(striker(500, 300), rivals);

  const field = fieldWith([]);
  for (let i = 0; i < 60; i += 1) updateRivals(rivals, 1 / 60, world, field, rng);
  assert.equal(rivals[0].flashFor, 0);
});

test('spawnRival drops a fresh bug on open ground', () => {
  const rival = spawnRival(world, rng, 1);
  assert.ok(rival.x >= 0 && rival.x <= world.width);
  assert.ok(rival.y >= world.top && rival.y <= world.height);
  assert.equal(rival.health, CONFIG.rivals.health[rival.kind]);
});
