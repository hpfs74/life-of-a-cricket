import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, startRun, updateGame, difficultyAt } from '../src/game.js';

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

const fixedRng = () => 0.5;
const still = { dx: 0, dy: 0, sing: false };
const singing = { dx: 0, dy: 0, sing: true };

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
