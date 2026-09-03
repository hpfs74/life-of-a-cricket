import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';

test('config exposes the tunables the simulation needs', () => {
  assert.ok(CONFIG.world.width > 0);
  assert.ok(CONFIG.world.height > 0);
  assert.equal(CONFIG.score.songPointsPerSecond, 10);
  assert.equal(CONFIG.score.multiplierClimbPerSecond, 0.2);
  assert.equal(CONFIG.score.multiplierMax, 5);
  assert.equal(CONFIG.game.startingLives, 3);
});

test('attention thresholds are sorted and within 0..1', () => {
  const t = CONFIG.attention.thresholds;
  assert.ok(t.length > 0);
  for (const value of t) {
    assert.ok(value > 0 && value <= 1, `threshold ${value} out of range`);
  }
  const sorted = [...t].sort((a, b) => a - b);
  assert.deepEqual(t, sorted);
});
