import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createHumanSchedule, updateHuman } from '../src/human.js';

function emptyHouse() {
  return {
    kind: 'house',
    width: 1600,
    height: 620,
    top: 36,
    bands: [{ top: 36, bottom: 300 }, { top: 344, bottom: 608 }],
    stairs: [{ x: 1100, width: 96 }],
    cover: [],
    water: [],
  };
}

const rng = () => 0.5;

function context(world, cricket, overrides = {}) {
  return { world, cricket, hidden: false, ...overrides };
}

/** Runs the schedule until the given event type appears, collecting everything. */
function runUntil(schedule, ctx, type, maxSteps = 6000) {
  const seen = [];
  for (let i = 0; i < maxSteps; i += 1) {
    const events = updateHuman(schedule, 1 / 60, ctx, rng);
    seen.push(...events);
    if (events.some((e) => e.type === type)) return seen;
  }
  assert.fail(`never saw ${type}`);
  return seen;
}

test('nobody comes through until the schedule says so', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const ctx = context(world, { x: 800, y: 476 });

  assert.equal(schedule.walker, null);
  const events = updateHuman(schedule, 1 / 60, ctx, rng);
  assert.deepEqual(events, []);
});

test('a shadow arrives before the feet do', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const ctx = context(world, { x: 800, y: 476 });

  runUntil(schedule, ctx, 'human-approaching');
  assert.ok(schedule.walker, 'someone should be on their way');
  assert.ok(schedule.walker.warnFor > 0, 'the warning should still be running');

  // During the warning the feet must not have moved at all.
  const startX = schedule.walker.x;
  updateHuman(schedule, 1 / 60, ctx, rng);
  assert.equal(schedule.walker.x, startX);
});

test('a crossing starts off the edge of the room and walks all the way out', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const ctx = context(world, { x: -9999, y: -9999 });

  runUntil(schedule, ctx, 'human-approaching');
  assert.ok(schedule.walker.x < 0 || schedule.walker.x > world.width, 'it should start off-screen');

  runUntil(schedule, ctx, 'human-gone');
  assert.equal(schedule.walker, null, 'the crossing should be over');
});

test('footfalls land a stride apart', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const ctx = context(world, { x: -9999, y: -9999 });

  const seen = runUntil(schedule, ctx, 'human-gone');
  const steps = seen.filter((e) => e.type === 'footfall');

  assert.ok(steps.length >= 3, `only ${steps.length} footfalls in a whole crossing`);
  for (let i = 1; i < steps.length; i += 1) {
    const gap = Math.abs(steps[i].x - steps[i - 1].x);
    assert.ok(
      Math.abs(gap - CONFIG.human.strideLength) < CONFIG.human.strideLength * 0.35,
      `stride ${i} was ${gap.toFixed(0)}`,
    );
  }
});

test('a cricket caught in the open is crushed', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const cricket = { x: 0, y: 0 };
  const ctx = context(world, cricket);

  runUntil(schedule, ctx, 'human-approaching');
  // Stand exactly where the next foot will land.
  cricket.y = schedule.walker.y;

  let crushed = false;
  for (let i = 0; i < 6000 && !crushed; i += 1) {
    cricket.x = schedule.walker.x;
    crushed = updateHuman(schedule, 1 / 60, ctx, rng).some((e) => e.type === 'human-crush');
  }

  assert.ok(crushed, 'standing under a footfall should be fatal');
});

test('furniture saves the cricket from a footfall', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const cricket = { x: 0, y: 0 };
  const ctx = context(world, cricket, { hidden: true });

  runUntil(schedule, ctx, 'human-approaching');
  cricket.y = schedule.walker.y;

  for (let i = 0; i < 6000; i += 1) {
    cricket.x = schedule.walker.x;
    const events = updateHuman(schedule, 1 / 60, ctx, rng);
    assert.ok(!events.some((e) => e.type === 'human-crush'), 'it should not reach under the furniture');
    if (events.some((e) => e.type === 'human-gone')) break;
  }
});

test('a cricket on the other floor is never touched', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const cricket = { x: 0, y: 0 };
  const ctx = context(world, cricket);

  runUntil(schedule, ctx, 'human-approaching');
  const walkerBand = schedule.walker.band;
  const otherBand = world.bands.find((b) => b.top !== walkerBand.top);
  cricket.y = (otherBand.top + otherBand.bottom) / 2;

  for (let i = 0; i < 6000; i += 1) {
    cricket.x = schedule.walker.x;
    const events = updateHuman(schedule, 1 / 60, ctx, rng);
    assert.ok(!events.some((e) => e.type === 'human-crush'), 'it crushed through a ceiling');
    if (events.some((e) => e.type === 'human-gone')) break;
  }
});

test('leaping does not save you: there is nowhere above a foot to be', () => {
  const world = emptyHouse();
  const schedule = createHumanSchedule(rng);
  const cricket = { x: 0, y: 0, jumping: true };
  const ctx = context(world, cricket);

  runUntil(schedule, ctx, 'human-approaching');
  cricket.y = schedule.walker.y;

  let crushed = false;
  for (let i = 0; i < 6000 && !crushed; i += 1) {
    cricket.x = schedule.walker.x;
    crushed = updateHuman(schedule, 1 / 60, ctx, rng).some((e) => e.type === 'human-crush');
  }

  assert.ok(crushed, 'a leap should not clear a footfall');
});
