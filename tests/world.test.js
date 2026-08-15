import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  createWorld, clampToBounds, coverAt, isHidden, randomOpenPoint, spawnPoint,
} from '../src/world.js';

// A deterministic stand-in for Math.random so layout tests are repeatable.
function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('createWorld places the configured amount of cover inside the bounds', () => {
  const world = createWorld(seededRng(7));
  assert.equal(world.width, CONFIG.world.width);
  assert.equal(world.height, CONFIG.world.height);
  assert.equal(world.cover.length, CONFIG.world.coverCount);

  for (const item of world.cover) {
    assert.ok(item.x - item.radius >= 0, 'cover crosses the left edge');
    assert.ok(item.x + item.radius <= world.width, 'cover crosses the right edge');
    assert.ok(item.y - item.radius >= 0, 'cover crosses the top edge');
    assert.ok(item.y + item.radius <= world.height, 'cover crosses the bottom edge');
    assert.ok(['grass', 'rock', 'leaf'].includes(item.type));
  }
});

test('cover objects are separated enough to leave lanes between them', () => {
  const world = createWorld(seededRng(11));
  for (let i = 0; i < world.cover.length; i += 1) {
    for (let j = i + 1; j < world.cover.length; j += 1) {
      const a = world.cover[i];
      const b = world.cover[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(
        distance >= CONFIG.world.coverMinSeparation,
        `cover ${i} and ${j} are ${distance.toFixed(1)} apart`,
      );
    }
  }
});

test('cover stays on the ground and never floats up into the sky', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const world = createWorld(seededRng(seed));
    for (const item of world.cover) {
      assert.ok(
        item.y - item.radius >= world.top,
        `seed ${seed}: ${item.type} at y=${item.y.toFixed(0)} r=${item.radius.toFixed(0)} crosses the horizon ${world.top}`,
      );
      assert.ok(item.y + item.radius <= world.height, 'cover crosses the bottom edge');
    }
  }
});

test('no cover lands on the spawn point, so a run always starts exposed', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const world = createWorld(seededRng(seed));
    const spawn = spawnPoint(world);
    assert.equal(
      isHidden(world, spawn.x, spawn.y),
      false,
      `seed ${seed} spawned the cricket inside cover`,
    );
  }
});

test('the spawn point is the middle of the playable ground, not of the canvas', () => {
  const world = createWorld(seededRng(5));
  const spawn = spawnPoint(world);
  assert.equal(spawn.x, world.width / 2);
  assert.ok(spawn.y > world.top, 'spawned above the horizon');
  assert.ok(Math.abs(spawn.y - (world.top + world.height) / 2) < 0.001);
});

test('clampToBounds keeps a body on the ground and out of the sky', () => {
  const world = createWorld(seededRng(1));
  assert.deepEqual(clampToBounds(world, -50, -50, 10), { x: 10, y: world.top + 10 });
  assert.deepEqual(
    clampToBounds(world, world.width + 50, world.height + 50, 10),
    { x: world.width - 10, y: world.height - 10 },
  );
  assert.deepEqual(clampToBounds(world, 300, 400, 10), { x: 300, y: 400 });
});

test('food never spawns in the sky', () => {
  const world = createWorld(seededRng(3));
  const rng = seededRng(77);
  for (let i = 0; i < 200; i += 1) {
    const point = randomOpenPoint(world, rng, 20);
    assert.ok(point.y >= world.top, `spawned at y=${point.y} above the horizon ${world.top}`);
  }
});

test('coverAt and isHidden agree on the boundary of a cover object', () => {
  const world = { width: 800, height: 600, cover: [{ x: 400, y: 300, radius: 50, type: 'grass' }] };

  assert.equal(isHidden(world, 400, 300), true, 'dead centre is hidden');
  assert.equal(isHidden(world, 400, 349), true, 'just inside the edge is hidden');
  assert.equal(isHidden(world, 400, 351), false, 'just outside the edge is exposed');
  assert.equal(coverAt(world, 400, 300).type, 'grass');
  assert.equal(coverAt(world, 10, 10), null);
});

test('randomOpenPoint never lands inside cover', () => {
  const world = createWorld(seededRng(3));
  const rng = seededRng(99);
  for (let i = 0; i < 200; i += 1) {
    const point = randomOpenPoint(world, rng, 20);
    assert.equal(isHidden(world, point.x, point.y), false, 'spawned inside cover');
    assert.ok(point.x >= 0 && point.x <= world.width);
    assert.ok(point.y >= 0 && point.y <= world.height);
  }
});
