import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { dayAt, darknessAt, isNight, phaseOfDay } from '../src/daylight.js';

const DAY = CONFIG.game.secondsPerDay;

test('days are one-based and turn over once per day length', () => {
  assert.equal(dayAt(0), 1);
  assert.equal(dayAt(DAY - 0.01), 1);
  assert.equal(dayAt(DAY), 2);
  assert.equal(dayAt(DAY * 4.5), 5);
});

test('phaseOfDay runs from 0 to just under 1 within each day', () => {
  assert.equal(phaseOfDay(0), 0);
  assert.ok(Math.abs(phaseOfDay(DAY / 2) - 0.5) < 0.001);
  assert.ok(Math.abs(phaseOfDay(DAY * 3.25) - 0.25) < 0.001);
});

test('darkness starts and ends each day at its lightest, peaking at midnight', () => {
  assert.ok(darknessAt(0) < 0.001, 'a day starts light');
  assert.ok(darknessAt(DAY / 2) > 0.999, 'mid-day-length is the darkest point');
  assert.ok(darknessAt(DAY) < 0.001, 'and the next day dawns light again');
});

test('darkness is continuous across the midnight boundary', () => {
  const before = darknessAt(DAY - 0.001);
  const after = darknessAt(DAY + 0.001);
  assert.ok(Math.abs(before - after) < 0.01, `jumped from ${before} to ${after}`);
});

test('darkness never leaves the 0..1 range', () => {
  for (let t = 0; t < DAY * 3; t += DAY / 40) {
    const value = darknessAt(t);
    assert.ok(value >= 0 && value <= 1, `darkness ${value} at t=${t}`);
  }
});

test('night is the dark half of the cycle', () => {
  assert.equal(isNight(0), false, 'dawn is not night');
  assert.equal(isNight(DAY * 0.5), true, 'midnight is night');
  assert.equal(isNight(DAY * 0.95), false, 'late in the cycle it is light again');

  // Every day should contain both a lit and a dark stretch.
  const samples = [];
  for (let t = 0; t < DAY; t += DAY / 24) samples.push(isNight(t));
  assert.ok(samples.some(Boolean), 'a day with no night at all');
  assert.ok(samples.some((night) => !night), 'a day with no daylight at all');
});
