import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, startRun, updateGame, difficultyAt, dayAt, showCredits, closeCredits } from '../src/game.js';

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

test('a cricket that hides and keeps quiet survives day after day', () => {
  const game = createGame({ storage: memoryStorage(), rng: seededRng(9) });
  startRun(game);
  assert.equal(game.day, 1);
  assert.ok(game.world.cover.length > 0, 'this test needs a meadow with cover');

  // Sit in cover in silence: patrols should scan, lose the trail and leave.
  const shelter = game.world.cover[0];
  game.cricket.x = shelter.x;
  game.cricket.y = shelter.y;

  // A few frames past the boundary, since summing 1/60 lands just short of it.
  for (let i = 0; i < CONFIG.game.secondsPerDay * 2 * 60 + 5; i += 1) {
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

test('credits open from the menu and return to it', () => {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  assert.equal(game.phase, 'MENU');

  showCredits(game);
  assert.equal(game.phase, 'CREDITS');

  closeCredits(game);
  assert.equal(game.phase, 'MENU');
});

test('credits are reachable from the game-over screen too', () => {
  const game = newGame();
  game.phase = 'GAME_OVER';
  showCredits(game);
  assert.equal(game.phase, 'CREDITS');
});

test('credits cannot be opened mid-run, and nothing simulates while they are up', () => {
  const game = newGame();
  showCredits(game);
  assert.equal(game.phase, 'PLAYING', 'a run must not be interrupted by the credits');

  game.phase = 'CREDITS';
  updateGame(game, singing, 1);
  assert.equal(game.score.points, 0);
  assert.equal(game.elapsed, 0);
});
