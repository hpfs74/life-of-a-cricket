import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createCricket, updateCricket } from '../src/cricket.js';

const openWorld = { width: 800, height: 600, top: 0, cover: [] };
const coveredWorld = {
  width: 800,
  height: 600,
  top: 0,
  cover: [{ x: 100, y: 100, radius: 50, type: 'grass' }],
};
const skyWorld = { width: 800, height: 600, top: 168, cover: [] };

const still = { dx: 0, dy: 0, sing: false };

test('the cricket starts in the middle of the meadow, silent', () => {
  const cricket = createCricket(openWorld);
  assert.equal(cricket.x, 400);
  assert.equal(cricket.y, 300);
  assert.equal(cricket.singing, false);
  assert.equal(cricket.songSeconds, 0);
});

test('movement covers the configured speed over one second', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 0, sing: false }, 1, openWorld);
  assert.ok(Math.abs(cricket.x - (400 + CONFIG.cricket.speed)) < 0.001);
  assert.equal(cricket.y, 300);
});

test('diagonal movement is normalised so it is not faster than straight', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 1, sing: false }, 1, openWorld);
  const travelled = Math.hypot(cricket.x - 400, cricket.y - 300);
  assert.ok(Math.abs(travelled - CONFIG.cricket.speed) < 0.001, `travelled ${travelled}`);
});

test('the cricket cannot leave the meadow', () => {
  const cricket = createCricket(openWorld);
  for (let i = 0; i < 100; i += 1) {
    updateCricket(cricket, { dx: -1, dy: -1, sing: false }, 0.1, openWorld);
  }
  assert.equal(cricket.x, CONFIG.cricket.radius);
  assert.equal(cricket.y, CONFIG.cricket.radius);
});

test('the cricket cannot walk up into the sky', () => {
  const cricket = createCricket(skyWorld);
  assert.ok(cricket.y > skyWorld.top, 'spawned above the horizon');

  for (let i = 0; i < 200; i += 1) {
    updateCricket(cricket, { dx: 0, dy: -1, sing: false }, 0.1, skyWorld);
  }
  assert.equal(cricket.y, skyWorld.top + CONFIG.cricket.radius);
});

test('singing requires standing still and blocks movement', () => {
  const cricket = createCricket(openWorld);
  const events = updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  assert.equal(cricket.singing, true);
  assert.equal(events.startedSinging, true);
  assert.equal(cricket.x, 400, 'a singing cricket does not move');
  assert.ok(Math.abs(cricket.songSeconds - 0.5) < 0.001);
});

test('pressing a direction while holding sing cancels the song and moves', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  const events = updateCricket(cricket, { dx: 1, dy: 0, sing: true }, 0.5, openWorld);
  assert.equal(cricket.singing, false);
  assert.equal(events.stoppedSinging, true);
  assert.equal(cricket.songSeconds, 0);
  assert.ok(cricket.x > 400, 'the cricket moved instead of singing');
});

test('releasing the sing key reports a stop exactly once', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.2, openWorld);

  const first = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(first.stoppedSinging, true);

  const second = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(second.stoppedSinging, false);
});

test('hidden reflects whether the cricket is standing in cover', () => {
  const cricket = createCricket(coveredWorld);
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, false);

  cricket.x = 100;
  cricket.y = 100;
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, true);
});

test('invulnerability counts down and never goes negative', () => {
  const cricket = createCricket(openWorld);
  cricket.invulnerableFor = 0.3;

  updateCricket(cricket, still, 0.2, openWorld);
  assert.ok(Math.abs(cricket.invulnerableFor - 0.1) < 0.001);

  updateCricket(cricket, still, 0.5, openWorld);
  assert.equal(cricket.invulnerableFor, 0);
});

// A meadow with two pieces of cover either side of the spawn point, for jumps.
const jumpWorld = {
  width: 800,
  height: 600,
  top: 0,
  cover: [
    { x: 560, y: 300, radius: 30, type: 'leaf' },
    { x: 260, y: 300, radius: 30, type: 'rock' },
  ],
};

const jumpPress = { dx: 0, dy: 0, sing: false, jump: true };
const jumpHeld = { dx: 0, dy: 0, sing: false, jump: true };

/** Steps the cricket until it lands, returning the events of the landing frame. */
function runUntilLanded(cricket, world, dt = 1 / 60, maxSteps = 500) {
  let steps = 0;
  let events = null;
  while (cricket.jumping && steps < maxSteps) {
    events = updateCricket(cricket, { dx: 0, dy: 0, sing: false, jump: true }, dt, world);
    steps += 1;
  }
  assert.ok(steps < maxSteps, 'the cricket never landed');
  return events;
}

test('pressing jump leaps to the nearest cover and lands hidden', () => {
  const cricket = createCricket(jumpWorld);
  const events = updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);

  assert.equal(cricket.jumping, true);
  assert.equal(events.startedJump, true);

  const landing = runUntilLanded(cricket, jumpWorld);
  assert.equal(cricket.jumping, false);
  assert.equal(landing.landed, true);
  assert.equal(landing.hidden, true, 'landed inside cover');
  assert.ok(Math.abs(cricket.x - 560) < 0.001 || Math.abs(cricket.x - 260) < 0.001);
});

test('a held direction steers the leap to cover that way', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, { dx: -1, dy: 0, sing: false, jump: true }, 1 / 60, jumpWorld);
  runUntilLanded(cricket, jumpWorld);

  assert.ok(Math.abs(cricket.x - 260) < 0.001, `landed at ${cricket.x}, expected the western rock`);
});

test('with no cover in range the cricket hops forward instead', () => {
  const bare = { width: 800, height: 600, top: 0, cover: [] };
  const cricket = createCricket(bare);
  cricket.dirX = 1;
  cricket.dirY = 0;

  updateCricket(cricket, jumpPress, 1 / 60, bare);
  assert.equal(cricket.jumping, true);
  runUntilLanded(cricket, bare);

  assert.ok(
    Math.abs(cricket.x - (400 + CONFIG.cricket.jump.fallbackDistance)) < 0.001,
    `hopped to ${cricket.x}`,
  );
});

test('the cricket cannot steer, sing or re-jump while airborne', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);

  const midX = cricket.x;
  const events = updateCricket(cricket, { dx: -1, dy: -1, sing: true, jump: true }, 1 / 60, jumpWorld);

  assert.equal(cricket.singing, false, 'cannot sing mid-air');
  assert.equal(events.startedJump, false, 'cannot re-trigger mid-air');
  assert.ok(cricket.x !== midX, 'the arc keeps advancing regardless of input');
  assert.ok(cricket.y > jumpWorld.top);
});

test('jumping breaks an in-progress song', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true, jump: false }, 0.5, jumpWorld);
  assert.equal(cricket.singing, true);

  const events = updateCricket(cricket, { dx: 0, dy: 0, sing: true, jump: true }, 1 / 60, jumpWorld);
  assert.equal(cricket.singing, false);
  assert.equal(events.stoppedSinging, true);
  assert.equal(events.startedJump, true);
});

test('holding the jump key does not chain jumps: it needs a fresh press', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, jumpHeld, 1 / 60, jumpWorld);
  runUntilLanded(cricket, jumpWorld);

  // Key still held, cooldown expired: must not re-launch.
  for (let i = 0; i < 120; i += 1) updateCricket(cricket, jumpHeld, 1 / 60, jumpWorld);
  assert.equal(cricket.jumping, false, 'a held key re-triggered the jump');
  assert.equal(cricket.jumpCooldown, 0);

  // Release, then press again.
  updateCricket(cricket, { dx: 0, dy: 0, sing: false, jump: false }, 1 / 60, jumpWorld);
  const events = updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);
  assert.equal(events.startedJump, true);
});

test('a fresh press during the cooldown is refused', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);
  runUntilLanded(cricket, jumpWorld);

  assert.ok(cricket.jumpCooldown > 0, 'landing starts a cooldown');

  updateCricket(cricket, { dx: 0, dy: 0, sing: false, jump: false }, 1 / 60, jumpWorld);
  const blocked = updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);
  assert.equal(blocked.startedJump, false);
  assert.equal(cricket.jumping, false);
});

test('an airborne cricket is never reported as hidden, even over cover', () => {
  const cricket = createCricket(jumpWorld);
  updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);

  cricket.x = 560;
  cricket.y = 300;
  const events = updateCricket(cricket, jumpPress, 1 / 60, jumpWorld);
  assert.equal(cricket.jumping, true);
  assert.equal(events.hidden, false, 'mid-air over cover still counts as exposed');
});

// A meadow split by a band of water down the middle.
function streamWorld() {
  return {
    width: 800,
    height: 600,
    top: 0,
    cover: [],
    water: [
      { x: 400, y: 200, radius: 40 },
      { x: 400, y: 300, radius: 40 },
      { x: 400, y: 400, radius: 40 },
    ],
  };
}

test('the cricket cannot walk into the water', () => {
  const world = streamWorld();
  const cricket = createCricket(world);
  cricket.x = 300;
  cricket.y = 300;

  for (let i = 0; i < 200; i += 1) {
    updateCricket(cricket, { dx: 1, dy: 0, sing: false, jump: false }, 1 / 60, world);
  }

  assert.ok(cricket.x < 400 - 40, `the cricket waded in to x=${cricket.x}`);
});

test('walking into a bank at an angle slides along it instead of sticking', () => {
  const world = streamWorld();
  const cricket = createCricket(world);
  cricket.x = 340;
  cricket.y = 300;

  const startY = cricket.y;
  for (let i = 0; i < 60; i += 1) {
    updateCricket(cricket, { dx: 1, dy: 1, sing: false, jump: false }, 1 / 60, world);
  }

  assert.ok(cricket.y > startY + 20, 'the cricket should have slid down the bank');
  assert.ok(cricket.x < 400, 'and still not be in the water');
});

test('a leap clears a narrow stretch and lands on dry ground', () => {
  const world = { width: 800, height: 600, top: 0, cover: [], water: [{ x: 400, y: 300, radius: 25 }] };
  const cricket = createCricket(world);
  cricket.x = 340;
  cricket.y = 300;
  cricket.dirX = 1;
  cricket.dirY = 0;

  updateCricket(cricket, { dx: 1, dy: 0, sing: false, jump: true }, 1 / 60, world);
  assert.equal(cricket.jumping, true);

  for (let i = 0; i < 200 && cricket.jumping; i += 1) {
    updateCricket(cricket, { dx: 1, dy: 0, sing: false, jump: true }, 1 / 60, world);
  }

  assert.ok(cricket.x > 425, `landed at ${cricket.x}, short of the far bank`);
});

test('a leap never lands the cricket in the water', () => {
  const world = streamWorld();
  const cricket = createCricket(world);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    cricket.x = 330 + (attempt % 7) * 4;
    cricket.y = 200 + (attempt % 5) * 50;
    cricket.jumping = false;
    cricket.jumpCooldown = 0;
    cricket.jumpHeld = false;
    cricket.dirX = 1;
    cricket.dirY = 0;

    updateCricket(cricket, { dx: 1, dy: 0, sing: false, jump: true }, 1 / 60, world);
    for (let i = 0; i < 200 && cricket.jumping; i += 1) {
      updateCricket(cricket, { dx: 1, dy: 0, sing: false, jump: true }, 1 / 60, world);
    }

    const wet = world.water.some(
      (c) => Math.hypot(c.x - cricket.x, c.y - cricket.y) < c.radius + CONFIG.cricket.radius,
    );
    assert.equal(wet, false, `attempt ${attempt} landed in the water at ${cricket.x.toFixed(0)}`);
  }
});
