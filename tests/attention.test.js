import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createAttention, tickAttention, resetAttention } from '../src/attention.js';

test('attention starts empty with every threshold armed', () => {
  const attention = createAttention();
  assert.equal(attention.value, 0);
  assert.equal(attention.armed.length, CONFIG.attention.thresholds.length);
  assert.ok(attention.armed.every(Boolean));
});

test('singing raises attention and silence decays it, both clamped', () => {
  const attention = createAttention();

  tickAttention(attention, true, 1);
  assert.ok(Math.abs(attention.value - CONFIG.attention.risePerSecond) < 0.001);

  tickAttention(attention, false, 1);
  const expected = CONFIG.attention.risePerSecond - CONFIG.attention.decayPerSecond;
  assert.ok(Math.abs(attention.value - expected) < 0.001);

  tickAttention(attention, false, 999);
  assert.equal(attention.value, 0, 'attention never goes below zero');

  tickAttention(attention, true, 999);
  assert.equal(attention.value, 1, 'attention never goes above one');
});

test('crossing a threshold upward spawns exactly one bird', () => {
  const attention = createAttention();
  const first = CONFIG.attention.thresholds[0];

  const secondsToJustBelow = (first - 0.01) / CONFIG.attention.risePerSecond;
  assert.equal(tickAttention(attention, true, secondsToJustBelow).spawned, 0);

  const crossing = tickAttention(attention, true, 0.02 / CONFIG.attention.risePerSecond);
  assert.equal(crossing.spawned, 1);

  // Staying above the threshold must not spawn again.
  assert.equal(tickAttention(attention, true, 0.05).spawned, 0);
});

test('a threshold re-arms only after attention drops below it by the margin', () => {
  const attention = createAttention();
  const first = CONFIG.attention.thresholds[0];

  attention.value = first + 0.01;
  tickAttention(attention, true, 0);
  attention.value = first - CONFIG.attention.rearmMargin / 2;
  tickAttention(attention, false, 0);
  assert.equal(attention.armed[0], false, 'still disarmed inside the margin');

  attention.value = first - CONFIG.attention.rearmMargin * 2;
  tickAttention(attention, false, 0);
  assert.equal(attention.armed[0], true, 're-armed below the margin');
});

test('a big jump across several thresholds spawns one bird per threshold', () => {
  const attention = createAttention();
  const result = tickAttention(attention, true, 999);
  assert.equal(result.spawned, CONFIG.attention.thresholds.length);
});

test('resetAttention clears the meter and re-arms everything', () => {
  const attention = createAttention();
  tickAttention(attention, true, 999);

  resetAttention(attention);
  assert.equal(attention.value, 0);
  assert.ok(attention.armed.every(Boolean));
});
