import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createCat, updateCat } from '../src/cat.js';
import { createHouse } from '../src/house.js';
import { bandAt } from '../src/world.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A bare two-floor house with no furniture, so tests control what is where. */
function emptyHouse() {
  return {
    kind: 'house',
    width: 1600,
    height: 620,
    top: 36,
    bands: [{ top: 36, bottom: 300 }, { top: 344, bottom: 608 }],
    stairs: [{ x: 1100, width: 96 }],
    door: { x: 70, y: 476, width: 70, height: 120 },
    cover: [],
    water: [],
  };
}

const downstairsY = 476;
const upstairsY = 168;

function context(world, cricket, overrides = {}) {
  return { world, cricket, hidden: false, singing: false, ...overrides };
}

/** Steps the cat until it leaves `from`, returning the last event seen. */
function runUntilLeaves(cat, ctx, from, maxSteps = 4000) {
  let last = 'none';
  let steps = 0;
  while (cat.state === from && steps < maxSteps) {
    last = updateCat(cat, 1 / 60, ctx, () => 0.5);
    steps += 1;
  }
  assert.ok(steps < maxSteps, `the cat never left ${from}`);
  return last;
}

test('a cat starts on the ground floor, prowling', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));

  assert.equal(cat.state, 'PROWL');
  assert.deepEqual(bandAt(world, cat.x, cat.y), world.bands[1]);
});

test('a cat notices an exposed cricket and starts stalking', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 800;
  cat.y = downstairsY;

  const event = updateCat(cat, 1 / 60, context(world, { x: 900, y: downstairsY, jumping: false }), () => 0.5);

  assert.equal(event, 'noticed');
  assert.equal(cat.state, 'STALK');
});

test('furniture hides the cricket from the cat entirely', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 800;
  cat.y = downstairsY;

  const cricket = { x: 830, y: downstairsY, jumping: false };
  const event = updateCat(cat, 1 / 60, context(world, cricket, { hidden: true }), () => 0.5);

  assert.equal(event, 'none');
  assert.equal(cat.state, 'PROWL', 'it should not notice a cricket behind furniture');
});

test('singing carries much further than moving does', () => {
  const world = emptyHouse();
  const far = CONFIG.cat.noticeRadius + CONFIG.cat.singingBonus / 2;

  const quiet = createCat(world, seededRng(2));
  quiet.x = 400;
  quiet.y = downstairsY;
  const quietEvent = updateCat(
    quiet, 1 / 60, context(world, { x: 400 + far, y: downstairsY, jumping: false }), () => 0.5,
  );

  const loud = createCat(world, seededRng(2));
  loud.x = 400;
  loud.y = downstairsY;
  const loudEvent = updateCat(
    loud, 1 / 60, context(world, { x: 400 + far, y: downstairsY, jumping: false }, { singing: true }), () => 0.5,
  );

  assert.equal(quietEvent, 'none', 'it should not hear a silent cricket that far off');
  assert.equal(loudEvent, 'noticed', 'but a singing one carries');
});

test('a cat that loses sight of the cricket gives up and goes back to prowling', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 800;
  cat.y = downstairsY;
  const cricket = { x: 900, y: downstairsY, jumping: false };

  updateCat(cat, 1 / 60, context(world, cricket), () => 0.5);
  assert.equal(cat.state, 'STALK');

  const hiddenCtx = context(world, cricket, { hidden: true });
  assert.equal(updateCat(cat, 1 / 60, hiddenCtx, () => 0.5), 'lost');
  assert.equal(cat.state, 'CONFUSED');

  runUntilLeaves(cat, hiddenCtx, 'CONFUSED');
  assert.equal(cat.state, 'PROWL');
});

test('a stalked cricket is eventually pounced on, and the pounce commits', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 700;
  cat.y = downstairsY;
  const cricket = { x: 760, y: downstairsY, jumping: false };
  const ctx = context(world, cricket);

  updateCat(cat, 1 / 60, ctx, () => 0.5);
  const event = runUntilLeaves(cat, ctx, 'STALK');

  assert.equal(event, 'pounced');
  assert.equal(cat.state, 'POUNCE');
  assert.equal(cat.targetX, cricket.x, 'it commits to where the cricket was');

  cricket.x = 200;
  updateCat(cat, 1 / 60, ctx, () => 0.5);
  assert.equal(cat.targetX, 760, 'and must not track it afterwards');
});

test('a pounce that lands on a grounded cricket catches it', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 700;
  cat.y = downstairsY;
  const cricket = { x: 760, y: downstairsY, jumping: false };
  const ctx = context(world, cricket);

  updateCat(cat, 1 / 60, ctx, () => 0.5);
  runUntilLeaves(cat, ctx, 'STALK');
  assert.equal(runUntilLeaves(cat, ctx, 'POUNCE'), 'hit');
});

test('leaping clears a pounce, exactly as it clears a dive', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 700;
  cat.y = downstairsY;
  const cricket = { x: 760, y: downstairsY, jumping: false };
  const ctx = context(world, cricket);

  updateCat(cat, 1 / 60, ctx, () => 0.5);
  runUntilLeaves(cat, ctx, 'STALK');

  cricket.jumping = true;
  assert.equal(runUntilLeaves(cat, ctx, 'POUNCE'), 'missed');
});

test('the cat climbs the stairs to reach a cricket on the other floor', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.x = 900;
  cat.y = downstairsY;

  // A singing cricket upstairs, well within earshot.
  const cricket = { x: 1150, y: upstairsY, jumping: false };
  const ctx = context(world, cricket, { singing: true });

  assert.deepEqual(bandAt(world, cat.x, cat.y), world.bands[1], 'it starts downstairs');

  updateCat(cat, 1 / 60, ctx, () => 0.5);
  assert.equal(cat.state, 'STALK');

  // Inside the stairwell bandAt reports the merged corridor, so the honest
  // question is simply how high the cat has got.
  const upstairs = world.bands[0];
  let climbed = false;
  for (let i = 0; i < 2000 && !climbed; i += 1) {
    updateCat(cat, 1 / 60, ctx, () => 0.5);
    climbed = cat.y <= upstairs.bottom;
  }

  assert.ok(climbed, `the cat never came upstairs (stopped at y=${cat.y.toFixed(0)})`);
  assert.ok(Math.abs(cat.x - cricket.x) < 120, 'and it should have closed on the cricket');
});

test('a recovering cat is harmless for a moment before prowling again', () => {
  const world = emptyHouse();
  const cat = createCat(world, seededRng(2));
  cat.state = 'RECOVER';
  cat.stateTime = 0;

  const cricket = { x: cat.x, y: cat.y, jumping: false };
  const ctx = context(world, cricket);

  for (let i = 0; i < Math.floor(CONFIG.cat.recoverSeconds * 60) - 2; i += 1) {
    assert.equal(updateCat(cat, 1 / 60, ctx, () => 0.5), 'none');
  }
  runUntilLeaves(cat, ctx, 'RECOVER');
  assert.equal(cat.state, 'PROWL');
});
