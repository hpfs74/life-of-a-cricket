import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, startRun, updateGame, difficultyAt, dayAt } from '../src/game.js';
import { isWater } from '../src/world.js';

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

const fixedRng = () => 0.5;

// fixedRng is degenerate on purpose (it yields a meadow with no cover). Tests
// that need real cover use this instead.
function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const still = { dx: 0, dy: 0, sing: false, jump: false };
const singing = { dx: 0, dy: 0, sing: true, jump: false };

function newGame() {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  startRun(game);
  return game;
}

function diveOnCricket(game) {
  return {
    x: game.cricket.x, y: game.cricket.y, vx: 0, vy: 0,
    state: 'DIVE', stateTime: 0, angle: 0,
    targetX: game.cricket.x, targetY: game.cricket.y,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -200, exitY: -200,
  };
}

test('a new game sits in the menu until the run starts', () => {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  assert.equal(game.phase, 'MENU');

  startRun(game);
  assert.equal(game.phase, 'PLAYING');
  assert.equal(game.lives, CONFIG.game.startingLives);
  assert.equal(game.elapsed, 0);
  assert.equal(game.birds.length, 0);
});

test('difficulty ramps from 1 to the cap and then holds', () => {
  assert.equal(difficultyAt(0), 1);
  assert.ok(difficultyAt(CONFIG.game.difficultyRampSeconds / 2) > 1);
  assert.equal(difficultyAt(CONFIG.game.difficultyRampSeconds), CONFIG.game.difficultyMax);
  assert.equal(difficultyAt(CONFIG.game.difficultyRampSeconds * 10), CONFIG.game.difficultyMax);
});

test('nothing is simulated while in the menu', () => {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  updateGame(game, singing, 1);
  assert.equal(game.score.points, 0);
  assert.equal(game.elapsed, 0);
});

test('singing scores points and raises attention', () => {
  const game = newGame();
  updateGame(game, singing, 1);

  assert.ok(game.score.points > 0);
  assert.ok(game.attention.value > 0);
});

test('singing long enough summons a bird and emits the events', () => {
  const game = newGame();
  let sawSpawn = false;

  for (let i = 0; i < 600 && !sawSpawn; i += 1) {
    const events = updateGame(game, singing, 1 / 60);
    sawSpawn = events.some((event) => event.type === 'bird-spawn');
  }

  assert.ok(sawSpawn, 'no bird was ever summoned by singing');
  assert.ok(game.birds.length > 0);
});

test('the number of live birds is capped', () => {
  const game = newGame();
  for (let i = 0; i < 4000; i += 1) updateGame(game, singing, 1 / 60);
  assert.ok(game.birds.length <= CONFIG.bird.maxAlive, `${game.birds.length} birds alive`);
});

test('walking over food scores it and emits an ate event', () => {
  const game = newGame();
  game.food.items = [{ x: game.cricket.x, y: game.cricket.y, type: 'berry', value: 60, radius: 9, age: 0 }];

  const events = updateGame(game, still, 1 / 60);
  assert.ok(events.some((event) => event.type === 'ate'));
  assert.ok(game.score.points >= 60);
  assert.equal(game.score.fed, CONFIG.score.fedSeconds);
});

test('a hit costs a life, breaks the song, resets attention and grants mercy time', () => {
  const game = newGame();
  updateGame(game, singing, 2);
  game.attention.value = 0.9;
  game.score.multiplier = 3;
  game.birds = [diveOnCricket(game)];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((event) => event.type === 'hit'));
  assert.equal(game.lives, CONFIG.game.startingLives - 1);
  assert.equal(game.score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(game.attention.value, 0);
  assert.ok(game.cricket.invulnerableFor > 0);
});

test('an invulnerable cricket cannot be hit again', () => {
  const game = newGame();
  game.cricket.invulnerableFor = 1;
  game.birds = [diveOnCricket(game)];

  const events = updateGame(game, still, 1 / 60);
  assert.ok(!events.some((event) => event.type === 'hit'));
  assert.equal(game.lives, CONFIG.game.startingLives);
});

test('losing the last life ends the run and commits the high score', () => {
  const game = newGame();
  game.score.points = 1234;
  game.lives = 1;
  game.birds = [diveOnCricket(game)];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((event) => event.type === 'game-over'));
  assert.equal(game.phase, 'GAME_OVER');
  assert.equal(game.lives, 0);
  assert.equal(game.score.highScore, 1234);
  assert.equal(game.newRecord, true);
});

test('departed birds are removed from the flock', () => {
  const game = newGame();
  game.birds = [{
    x: -300, y: -300, vx: 0, vy: 0,
    state: 'RETREAT', stateTime: 0, angle: 0,
    targetX: 0, targetY: 0,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -300, exitY: -300,
  }];

  updateGame(game, still, 1 / 60);
  assert.equal(game.birds.length, 0);
});

test('a fresh run after game over clears the previous state', () => {
  const game = newGame();
  updateGame(game, singing, 3);
  game.phase = 'GAME_OVER';

  startRun(game);
  assert.equal(game.phase, 'PLAYING');
  assert.equal(game.score.points, 0);
  assert.equal(game.attention.value, 0);
  assert.equal(game.birds.length, 0);
  assert.equal(game.lives, CONFIG.game.startingLives);
});

test('the day counter starts at one and advances once per day length', () => {
  const day = CONFIG.game.secondsPerDay;
  assert.equal(dayAt(0), 1);
  assert.equal(dayAt(day - 0.01), 1);
  assert.equal(dayAt(day), 2);
  assert.equal(dayAt(day * 4.5), 5);
});

/** The nearest tuft with no spider in it, in whatever meadow currently exists. */
function safeShelter(game) {
  return game.world.cover.find(
    (item) => !game.spiders.some((spider) => spider.cover === item),
  );
}

test('a cricket that keeps finding cover and keeps quiet survives day after day', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(9) });
  startRun(game);
  assert.equal(game.day, 1);
  assert.ok(game.world.cover.length > 0, 'this test needs a meadow with cover');

  // Sit in empty cover in silence. The meadow rearranges at every new day, so
  // the cricket has to re-find shelter rather than trusting yesterday's spot.
  // A few frames past the boundary, since summing 1/60 lands just short of it.
  for (let i = 0; i < CONFIG.game.secondsPerDay * 2 * 60 + 5; i += 1) {
    const shelter = safeShelter(game);
    game.cricket.x = shelter.x;
    game.cricket.y = shelter.y;

    updateGame(game, still, 1 / 60);
    assert.equal(game.day, dayAt(game.elapsed), 'day drifted from elapsed time');
  }

  assert.equal(game.phase, 'PLAYING', 'hiding quietly should have kept the cricket alive');
  assert.equal(game.lives, CONFIG.game.startingLives);
  assert.equal(game.day, 3, `reached day ${game.day} after two day lengths`);
});

test('standing in the open in silence still gets the cricket caught eventually', () => {
  const game = newGame();

  for (let i = 0; i < CONFIG.game.secondsPerDay * 4 * 60 && game.phase === 'PLAYING'; i += 1) {
    updateGame(game, still, 1 / 60);
  }

  assert.equal(game.phase, 'GAME_OVER', 'silence alone should not be a safe strategy');
});

test('birds patrol in even when the cricket never sings', () => {
  const game = newGame();
  let spawns = 0;

  for (let i = 0; i < CONFIG.game.patrolIntervalSeconds * 3 * 60; i += 1) {
    spawns += updateGame(game, still, 1 / 60).filter((e) => e.type === 'bird-spawn').length;
    if (game.phase !== 'PLAYING') break;
  }

  assert.ok(spawns > 0, 'silence left the meadow completely empty of birds');
  assert.equal(game.attention.value, 0, 'and it did so without any attention at all');
});

test('patrols arrive sooner as difficulty climbs', () => {
  const early = createGame({ storage: memoryStorage(), rng: fixedRng });
  startRun(early);
  let earlyFirst = 0;
  for (let i = 1; i <= 60 * 60; i += 1) {
    if (updateGame(early, still, 1 / 60).some((e) => e.type === 'bird-spawn')) { earlyFirst = i; break; }
  }

  const late = createGame({ storage: memoryStorage(), rng: fixedRng });
  startRun(late);
  late.elapsed = CONFIG.game.difficultyRampSeconds * 2;
  let lateFirst = 0;
  for (let i = 1; i <= 60 * 60; i += 1) {
    if (updateGame(late, still, 1 / 60).some((e) => e.type === 'bird-spawn')) { lateFirst = i; break; }
  }

  assert.ok(earlyFirst > 0 && lateFirst > 0, 'both runs should see a patrol');
  assert.ok(lateFirst < earlyFirst, `late patrol at ${lateFirst} was not sooner than early at ${earlyFirst}`);
});

test('a leaping cricket dodges a dive that would otherwise land', () => {
  const game = newGame();
  game.cricket.jumping = true;
  game.cricket.jumpSeconds = 1;
  game.cricket.jumpProgress = 0;
  game.cricket.jumpToX = game.cricket.x;
  game.cricket.jumpToY = game.cricket.y;
  game.cricket.jumpFromX = game.cricket.x;
  game.cricket.jumpFromY = game.cricket.y;
  game.birds = [diveOnCricket(game)];

  const events = updateGame(game, still, 1 / 60);
  assert.ok(!events.some((e) => e.type === 'hit'), 'the dive should have missed');
  assert.equal(game.lives, CONFIG.game.startingLives);
});

test('the game reports jump and landing so the presentation layer can react', () => {
  const game = newGame();
  const started = updateGame(game, { dx: 0, dy: 0, sing: false, jump: true }, 1 / 60);
  assert.ok(started.some((e) => e.type === 'jump'));

  let landed = false;
  for (let i = 0; i < 120 && !landed; i += 1) {
    landed = updateGame(game, { dx: 0, dy: 0, sing: false, jump: true }, 1 / 60)
      .some((e) => e.type === 'land');
  }
  assert.ok(landed, 'never reported a landing');
});

test('an airborne cricket flies over food instead of eating it', () => {
  const game = newGame();
  game.rivals = [];   // this is about the cricket, not about competition
  updateGame(game, { dx: 0, dy: 0, sing: false, jump: true }, 1 / 60);
  assert.equal(game.cricket.jumping, true);

  game.food.items = [{ x: game.cricket.x, y: game.cricket.y, type: 'berry', value: 60, radius: 9, age: 0 }];
  const events = updateGame(game, { dx: 0, dy: 0, sing: false, jump: true }, 1 / 60);

  assert.ok(!events.some((e) => e.type === 'ate'));
  assert.equal(game.food.items.length, 1);
});

test('birds hunt by day and bats take over at night', () => {
  const game = newGame();

  const kindsSeen = new Set();
  for (let i = 0; i < CONFIG.game.secondsPerDay * 2 * 60; i += 1) {
    for (const event of updateGame(game, still, 1 / 60)) {
      if (event.type === 'bird-spawn') {
        kindsSeen.add(event.kind);
        assert.equal(event.kind, game.night ? 'bat' : 'bird', 'wrong predator for the hour');
      }
    }
    if (game.phase !== 'PLAYING') startRun(game);
  }

  assert.ok(kindsSeen.has('bird'), 'never saw a daytime bird');
  assert.ok(kindsSeen.has('bat'), 'never saw a night-time bat');
});

test('the game tracks whether it is night', () => {
  const game = newGame();
  assert.equal(game.night, false, 'a run starts in daylight');

  updateGame(game, still, CONFIG.game.secondsPerDay / 2);
  assert.equal(game.night, true, 'halfway through a day it is night');
});




test('rival insects share the meadow and take food the cricket leaves', () => {
  const game = newGame();
  assert.equal(game.rivals.length, CONFIG.rivals.count);

  // Park a rival right on a crumb, well away from the cricket.
  const rival = game.rivals[0];
  rival.nibbleFor = 0;
  rival.x = game.cricket.x + 500;
  rival.y = game.cricket.y;
  game.food.items = [{ x: rival.x, y: rival.y, type: 'seed', value: 25, radius: 6, age: 0 }];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((e) => e.type === 'rival-ate'), 'the rival should have taken it');
  assert.ok(!events.some((e) => e.type === 'ate'), 'and the cricket should score nothing for it');
  assert.equal(game.score.points, 0);
});

test('the cricket gets first claim on food it is standing on', () => {
  const game = newGame();
  const rival = game.rivals[0];
  rival.nibbleFor = 0;
  rival.x = game.cricket.x;
  rival.y = game.cricket.y;
  game.food.items = [{ x: game.cricket.x, y: game.cricket.y, type: 'berry', value: 60, radius: 9, age: 0 }];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((e) => e.type === 'ate'), 'the cricket should win the tie');
  assert.ok(!events.some((e) => e.type === 'rival-ate'));
  assert.ok(game.score.points >= 60);
});

test('a fresh run repopulates the rivals', () => {
  const game = newGame();
  game.rivals = [];
  startRun(game);
  assert.equal(game.rivals.length, CONFIG.rivals.count);
});

test('a run places spiders in the meadow and repopulates them on restart', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(4) });
  startRun(game);
  assert.equal(game.spiders.length, CONFIG.spiders.count);

  game.spiders = [];
  startRun(game);
  assert.equal(game.spiders.length, CONFIG.spiders.count);
});

test('hiding in an occupied tuft costs a life, however quiet the cricket is', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(4) });
  startRun(game);

  const spider = game.spiders[0];
  game.cricket.x = spider.homeX;
  game.cricket.y = spider.homeY;

  let hit = false;
  for (let i = 0; i < 240 && !hit; i += 1) {
    // Silent and stationary: exactly what saves the cricket from a bird.
    game.cricket.x = spider.homeX;
    game.cricket.y = spider.homeY;
    hit = updateGame(game, still, 1 / 60).some((e) => e.type === 'hit' && e.from === 'spider');
  }

  assert.ok(hit, 'the spider never caught a cricket sitting on top of it');
  assert.equal(game.lives, CONFIG.game.startingLives - 1);
  assert.ok(game.cricket.invulnerableFor > 0, 'a spider hit should grant the same mercy window');
});

test('the spider wake and lunge are reported so the player can hear them coming', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(4) });
  startRun(game);

  const spider = game.spiders[0];
  game.cricket.x = spider.homeX;
  game.cricket.y = spider.homeY;

  const seen = new Set();
  for (let i = 0; i < 240; i += 1) {
    game.cricket.x = spider.homeX;
    game.cricket.y = spider.homeY;
    for (const e of updateGame(game, still, 1 / 60)) seen.add(e.type);
  }

  assert.ok(seen.has('spider-wake'), 'no wake was reported');
  assert.ok(seen.has('spider-lunge'), 'no lunge was reported');
});

test('the meadow rearranges itself when a new day turns over', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(21) });
  startRun(game);

  const oldWorld = game.world;
  const oldCover = game.world.cover.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('|');
  const oldWater = game.world.water.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('|');

  let announced = false;
  for (let i = 0; i < CONFIG.game.secondsPerDay * 60 + 10; i += 1) {
    const shelter = safeShelter(game);
    game.cricket.x = shelter.x;
    game.cricket.y = shelter.y;
    if (updateGame(game, still, 1 / 60).some((e) => e.type === 'new-day')) announced = true;
  }

  assert.ok(announced, 'the new day was never announced');
  assert.notEqual(game.world, oldWorld, 'the world object should have been rebuilt');
  assert.notEqual(
    game.world.cover.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('|'),
    oldCover,
    'the cover did not move',
  );
  assert.notEqual(
    game.world.water.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('|'),
    oldWater,
    'the stream did not find a new course',
  );
  assert.ok(game.shiftedFor > 0, 'the player should be told the meadow shifted');
});

test('a reshuffle never leaves the cricket in water or on top of a spider', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const game = createGame({ storage: memoryStorage(), rng: seededRng(seed) });
    startRun(game);

    // Drop the cricket somewhere arbitrary, then force the day over.
    game.cricket.x = game.world.width * 0.5;
    game.cricket.y = game.world.top + 40;
    game.elapsed = CONFIG.game.secondsPerDay - 1 / 120;
    updateGame(game, still, 1 / 60);

    assert.equal(game.day, 2, `seed ${seed} did not turn over`);
    assert.equal(
      isWater(game.world, game.cricket.x, game.cricket.y, CONFIG.cricket.radius),
      false,
      `seed ${seed} left the cricket in the water`,
    );

    const onSpider = game.spiders.some(
      (s) => Math.hypot(s.homeX - game.cricket.x, s.homeY - game.cricket.y) <= s.cover.radius,
    );
    assert.equal(onSpider, false, `seed ${seed} dropped a spider on the cricket`);
    assert.equal(game.cricket.jumping, false, 'a leap in progress should be cancelled');
  }
});

test('food that the new stream swallowed is cleared away', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(33) });
  startRun(game);

  // Scatter crumbs everywhere, including where water will land.
  game.food.items = Array.from({ length: 60 }, (unused, i) => ({
    x: (i * 47) % game.world.width,
    y: game.world.top + ((i * 31) % (game.world.height - game.world.top)),
    type: 'seed', value: 25, radius: 6, age: 0,
  }));

  game.elapsed = CONFIG.game.secondsPerDay - 1 / 120;
  updateGame(game, still, 1 / 60);

  for (const item of game.food.items) {
    assert.equal(isWater(game.world, item.x, item.y), false, 'a crumb was left floating');
  }
});

const striking = { dx: 0, dy: 0, sing: false, jump: false, strike: true };
const notStriking = { dx: 0, dy: 0, sing: false, jump: false, strike: false };

/** Parks a bug of the given kind just in front of the cricket. */
function bugInFront(game, kind) {
  const bug = {
    x: game.cricket.x + 20, y: game.cricket.y,
    dirX: 1, dirY: 0, kind,
    health: CONFIG.rivals.health[kind],
    flashFor: 0, nibbleFor: 999, phase: 0,
    targetX: 0, targetY: 0,
  };
  game.rivals = [bug];
  game.cricket.dirX = 1;
  game.cricket.dirY = 0;
  return bug;
}

test('killing an ant leaves a grub where it fell', () => {
  const game = newGame();
  game.food.items = [];
  const ant = bugInFront(game, 'ant');

  const events = updateGame(game, striking, 1 / 60);

  assert.ok(events.some((e) => e.type === 'bug-killed' && e.kind === 'ant'));
  assert.equal(game.rivals.length, 0);
  assert.equal(game.food.items.length, CONFIG.rivals.drops.ant);
  assert.equal(game.food.items[0].type, 'grub');
  assert.ok(Math.hypot(game.food.items[0].x - ant.x, game.food.items[0].y - ant.y) < 30);
});

test('a beetle takes two swings and stuns the cricket in between', () => {
  const game = newGame();
  game.food.items = [];
  bugInFront(game, 'beetle');

  const first = updateGame(game, striking, 1 / 60);
  assert.ok(first.some((e) => e.type === 'bug-hit'));
  assert.ok(first.some((e) => e.type === 'stunned'));
  assert.ok(game.cricket.stunnedFor > 0);
  assert.equal(game.rivals.length, 1, 'it should still be standing');

  // Shake off the stun, then finish it.
  for (let i = 0; i < 60; i += 1) updateGame(game, notStriking, 1 / 60);
  assert.equal(game.cricket.stunnedFor, 0);

  game.rivals[0].x = game.cricket.x + 20;
  game.rivals[0].y = game.cricket.y;
  const second = updateGame(game, striking, 1 / 60);

  assert.ok(second.some((e) => e.type === 'bug-killed' && e.kind === 'beetle'));
  assert.equal(game.food.items.length, CONFIG.rivals.drops.beetle, 'a beetle should pay double');
});

test('a stunned cricket cannot move, sing, leap or swing', () => {
  const game = newGame();
  bugInFront(game, 'beetle');
  updateGame(game, striking, 1 / 60);
  assert.ok(game.cricket.stunnedFor > 0);

  const startX = game.cricket.x;
  const events = updateGame(game, { dx: 1, dy: 0, sing: true, jump: true, strike: true }, 1 / 60);

  assert.equal(game.cricket.x, startX, 'it moved while stunned');
  assert.equal(game.cricket.singing, false);
  assert.equal(game.cricket.jumping, false);
  assert.ok(!events.some((e) => e.type === 'strike'));
});

test('swinging is loud: it feeds the same attention meter singing does', () => {
  const game = newGame();
  game.rivals = [];
  assert.equal(game.attention.value, 0);

  updateGame(game, striking, 1 / 60);
  // One frame of the meter's own decay comes off the bump, hence the tolerance.
  assert.ok(game.attention.value > CONFIG.attention.perStrike * 0.9, `attention ${game.attention.value}`);
  assert.ok(game.attention.value <= CONFIG.attention.perStrike);
});

test('a swing at empty air still costs noise but drops nothing', () => {
  const game = newGame();
  game.rivals = [];
  game.food.items = [];

  const events = updateGame(game, striking, 1 / 60);
  assert.ok(events.some((e) => e.type === 'strike' && e.connected === false));
  assert.equal(game.food.items.length, 0);
});

test('the strike has a cooldown, so a held key cannot machine-gun swings', () => {
  const game = newGame();
  game.rivals = [];

  let swings = 0;
  for (let i = 0; i < 60; i += 1) {
    swings += updateGame(game, striking, 1 / 60).filter((e) => e.type === 'strike').length;
  }

  assert.equal(swings, 1, `a held key produced ${swings} swings in one second`);
});

test('a cricket cannot swing in mid-leap', () => {
  const game = newGame();
  game.rivals = [];
  updateGame(game, { dx: 0, dy: 0, sing: false, jump: true, strike: false }, 1 / 60);
  assert.equal(game.cricket.jumping, true);

  const events = updateGame(game, striking, 1 / 60);
  assert.ok(!events.some((e) => e.type === 'strike'));
});

test('the bug population recovers after a cull', () => {
  const game = newGame();
  game.rivals = [];

  for (let i = 0; i < CONFIG.rivals.respawnSeconds * CONFIG.rivals.count * 60 + 120; i += 1) {
    updateGame(game, notStriking, 1 / 60);
    if (game.phase !== 'PLAYING') startRun(game);
  }

  assert.equal(game.rivals.length, CONFIG.rivals.count, 'the meadow stayed farmed out');
});

test('a grub is never spawned by the meadow itself', () => {
  const game = newGame();
  game.rivals = [];

  for (let i = 0; i < 120 * 60; i += 1) {
    updateGame(game, notStriking, 1 / 60);
    if (game.phase !== 'PLAYING') startRun(game);
    for (const item of game.food.items) {
      assert.notEqual(item.type, 'grub', 'a grub appeared without a bug dying for it');
    }
  }
});
