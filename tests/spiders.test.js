import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createWorld, spawnPoint } from '../src/world.js';
import { createSpiders, updateSpiders } from '../src/spiders.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A one-tuft meadow so encounters can be set up exactly. */
function lairWorld() {
  return {
    width: 1200,
    height: 600,
    top: 168,
    cover: [{ x: 600, y: 400, radius: 50, type: 'grass' }],
  };
}

function oneSpider() {
  const world = lairWorld();
  const spider = {
    cover: world.cover[0],
    homeX: 600, homeY: 400, x: 600, y: 400,
    state: 'LURKING', stateTime: 0,
    targetX: 0, targetY: 0, alertness: 0,
  };
  return { world, spider };
}

const grounded = (x, y) => ({ x, y, jumping: false });
const airborne = (x, y) => ({ x, y, jumping: true });

/** Steps until the spider leaves `from`, collecting every event on the way. */
function runUntilLeaves(spiders, world, cricket, from, maxSteps = 2000) {
  const seen = [];
  let steps = 0;
  while (spiders[0].state === from && steps < maxSteps) {
    seen.push(...updateSpiders(spiders, 1 / 60, world, cricket));
    steps += 1;
  }
  assert.ok(steps < maxSteps, `spider never left ${from}`);
  return seen;
}

test('spiders take distinct cover pieces, never near the spawn point', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const world = createWorld(seededRng(seed));
    const spiders = createSpiders(world, seededRng(seed * 7));
    const spawn = spawnPoint(world);

    assert.equal(spiders.length, CONFIG.spiders.count, `seed ${seed}`);

    const occupied = new Set(spiders.map((s) => s.cover));
    assert.equal(occupied.size, spiders.length, 'two spiders shared one tuft');

    for (const spider of spiders) {
      assert.ok(world.cover.includes(spider.cover), 'spider is not in a real piece of cover');
      const distance = Math.hypot(spider.x - spawn.x, spider.y - spawn.y);
      assert.ok(
        distance >= CONFIG.spiders.minDistanceFromSpawn,
        `seed ${seed}: spider ${distance.toFixed(0)} from spawn`,
      );
    }
  }
});

test('a spider starts lurking at the centre of its cover', () => {
  const { spider } = oneSpider();
  assert.equal(spider.state, 'LURKING');
  assert.equal(spider.x, spider.cover.x);
  assert.equal(spider.y, spider.cover.y);
});

test('a cricket stepping into the cover wakes the spider', () => {
  const { world, spider } = oneSpider();
  const events = updateSpiders([spider], 1 / 60, world, grounded(600, 400));

  assert.equal(spider.state, 'WINDUP');
  assert.ok(events.some((e) => e.type === 'spider-wake'));
});

test('keeping quiet does not help: the spider hunts by touch', () => {
  const { world, spider } = oneSpider();
  // No singing flag is passed at all — proximity alone is the trigger.
  updateSpiders([spider], 1 / 60, world, grounded(600, 400));
  assert.equal(spider.state, 'WINDUP', 'silence should not protect the cricket here');
});

test('a cricket outside the cover leaves the spider alone', () => {
  const { world, spider } = oneSpider();
  updateSpiders([spider], 1 / 60, world, grounded(600, 470));
  assert.equal(spider.state, 'LURKING');
});

test('a cricket leaping over the tuft does not disturb it', () => {
  const { world, spider } = oneSpider();
  updateSpiders([spider], 1 / 60, world, airborne(600, 400));
  assert.equal(spider.state, 'LURKING', 'an airborne cricket never touches the ground here');
});

test('the wind-up gives the player a window before the lunge', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  assert.equal(spider.state, 'WINDUP');

  // Most of the way through the wind-up it must still not have committed.
  for (let i = 0; i < Math.floor(CONFIG.spiders.windUpSeconds * 60) - 2; i += 1) {
    updateSpiders([spider], 1 / 60, world, cricket);
  }
  assert.equal(spider.state, 'WINDUP', 'it lunged before the window was up');

  const events = runUntilLeaves([spider], world, cricket, 'WINDUP');
  assert.equal(spider.state, 'LUNGE');
  assert.ok(events.some((e) => e.type === 'spider-lunge'));
});

test('the lunge commits to where the cricket was when it launched', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  runUntilLeaves([spider], world, cricket, 'WINDUP');

  assert.equal(spider.targetX, 600);
  assert.equal(spider.targetY, 400);

  cricket.x = 200;
  updateSpiders([spider], 1 / 60, world, cricket);
  assert.equal(spider.targetX, 600, 'the lunge must not track the cricket');
});

test('a lunge that lands on a grounded cricket costs it', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  runUntilLeaves([spider], world, cricket, 'WINDUP');
  const events = runUntilLeaves([spider], world, cricket, 'LUNGE');

  assert.ok(events.some((e) => e.type === 'spider-hit'));
});

test('leaping at the right moment clears the lunge', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  runUntilLeaves([spider], world, cricket, 'WINDUP');

  cricket.jumping = true;   // the player leaps as it commits
  const events = runUntilLeaves([spider], world, cricket, 'LUNGE');

  assert.ok(!events.some((e) => e.type === 'spider-hit'), 'the leap should have cleared it');
  assert.ok(events.some((e) => e.type === 'spider-miss'));
});

test('running out of reach also beats the lunge', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  runUntilLeaves([spider], world, cricket, 'WINDUP');

  cricket.x = 100;
  cricket.y = 250;
  const events = runUntilLeaves([spider], world, cricket, 'LUNGE');

  assert.ok(events.some((e) => e.type === 'spider-miss'));
});

test('after a lunge it recovers, walks home and lurks again', () => {
  const { world, spider } = oneSpider();
  const cricket = grounded(600, 400);

  updateSpiders([spider], 1 / 60, world, cricket);
  runUntilLeaves([spider], world, cricket, 'WINDUP');
  runUntilLeaves([spider], world, cricket, 'LUNGE');
  assert.equal(spider.state, 'RECOVER');

  cricket.x = 100;   // the cricket flees, so it is not re-triggered at once
  cricket.y = 250;
  runUntilLeaves([spider], world, cricket, 'RECOVER');

  assert.equal(spider.state, 'LURKING');
  assert.ok(Math.abs(spider.x - spider.homeX) < 1, 'it should return to its tuft');
  assert.ok(Math.abs(spider.y - spider.homeY) < 1);
});

test('alertness rises as the cricket closes in, so the tell can glow', () => {
  const { world, spider } = oneSpider();

  updateSpiders([spider], 1 / 60, world, grounded(600, 400 - CONFIG.spiders.noticeRadius - 50));
  const far = spider.alertness;

  updateSpiders([spider], 1 / 60, world, grounded(600, 400 - CONFIG.spiders.noticeRadius * 0.4));
  const near = spider.alertness;

  assert.equal(far, 0, 'out of range it should not glow at all');
  assert.ok(near > far, 'it should glow more as the cricket approaches');
  assert.ok(near <= 1);
});
