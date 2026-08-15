import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from '../src/score.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

function throwingStorage() {
  return {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
}

test('a new score starts at zero with the base multiplier', () => {
  const score = createScore(memoryStorage());
  assert.equal(score.points, 0);
  assert.equal(score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(score.fed, 0);
  assert.equal(score.highScore, 0);
});

test('the stored high score is loaded on creation', () => {
  const score = createScore(memoryStorage({ [CONFIG.score.storageKey]: '4200' }));
  assert.equal(score.highScore, 4200);
});

test('unreadable storage degrades to a zero high score instead of throwing', () => {
  const score = createScore(throwingStorage());
  assert.equal(score.highScore, 0);
});

test('singing awards points at rate times multiplier', () => {
  const score = createScore(memoryStorage());
  const gained = tickSong(score, 1);
  // The multiplier climbs during the same second, so points land between the
  // starting rate and the rate at the end of the second.
  assert.ok(gained >= CONFIG.score.songPointsPerSecond);
  assert.ok(gained <= CONFIG.score.songPointsPerSecond * (1 + CONFIG.score.multiplierClimbPerSecond));
  assert.equal(score.points, gained);
});

test('the multiplier climbs at the configured rate and stops at the cap', () => {
  const score = createScore(memoryStorage());
  tickSong(score, 1);
  assert.ok(Math.abs(score.multiplier - (1 + CONFIG.score.multiplierClimbPerSecond)) < 0.001);

  for (let i = 0; i < 200; i += 1) tickSong(score, 1);
  assert.equal(score.multiplier, CONFIG.score.multiplierMax);
});

test('being fed doubles the multiplier climb rate', () => {
  const plain = createScore(memoryStorage());
  tickSong(plain, 1);

  const wellFed = createScore(memoryStorage());
  eat(wellFed, 0);
  tickSong(wellFed, 1);

  const plainClimb = plain.multiplier - CONFIG.score.multiplierStart;
  const fedClimb = wellFed.multiplier - CONFIG.score.multiplierStart;
  assert.ok(Math.abs(fedClimb - plainClimb * CONFIG.score.fedClimbBonus) < 0.001);
});

test('breaking the song resets the multiplier but keeps the points', () => {
  const score = createScore(memoryStorage());
  tickSong(score, 3);
  const banked = score.points;

  breakSong(score);
  assert.equal(score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(score.points, banked);
});

test('eating adds its value and refills the fed meter, which then decays', () => {
  const score = createScore(memoryStorage());
  eat(score, CONFIG.food.types.berry.value);

  assert.equal(score.points, CONFIG.food.types.berry.value);
  assert.equal(score.fed, CONFIG.score.fedSeconds);

  tickFed(score, 2);
  assert.ok(Math.abs(score.fed - (CONFIG.score.fedSeconds - 2)) < 0.001);

  tickFed(score, 999);
  assert.equal(score.fed, 0);
});

test('commitHighScore records a new record and reports whether it beat the old one', () => {
  const storage = memoryStorage({ [CONFIG.score.storageKey]: '100' });
  const score = createScore(storage);

  score.points = 50;
  assert.equal(commitHighScore(score), false);
  assert.equal(storage.getItem(CONFIG.score.storageKey), '100');

  score.points = 500;
  assert.equal(commitHighScore(score), true);
  assert.equal(storage.getItem(CONFIG.score.storageKey), '500');
  assert.equal(score.highScore, 500);
});

test('unwritable storage still updates the in-memory high score', () => {
  const score = createScore(throwingStorage());
  score.points = 900;
  assert.equal(commitHighScore(score), true);
  assert.equal(score.highScore, 900);
});
