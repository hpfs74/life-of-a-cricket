import { CONFIG } from './config.js';
import { createWorld } from './world.js';
import { createCricket, updateCricket } from './cricket.js';
import { createFoodField, updateFood, consumeFood } from './food.js';
import { spawnBird, updateBird } from './birds.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from './score.js';
import { createAttention, tickAttention, resetAttention } from './attention.js';

/** Ramps linearly from 1 to the cap over the ramp window, then holds. */
export function difficultyAt(elapsedSeconds) {
  const progress = Math.min(1, elapsedSeconds / CONFIG.game.difficultyRampSeconds);
  return 1 + (CONFIG.game.difficultyMax - 1) * progress;
}

export function createGame({ storage, rng = Math.random } = {}) {
  const world = createWorld(rng);

  return {
    phase: 'MENU',
    rng,
    world,
    cricket: createCricket(world),
    birds: [],
    food: createFoodField(),
    score: createScore(storage),
    attention: createAttention(),
    lives: CONFIG.game.startingLives,
    elapsed: 0,
    hidden: false,
    newRecord: false,
  };
}

export function startRun(game) {
  const highScore = game.score.highScore;

  game.phase = 'PLAYING';
  game.world = createWorld(game.rng);
  game.cricket = createCricket(game.world);
  game.birds = [];
  game.food = createFoodField();
  game.score = createScore(game.score.storage);
  game.score.highScore = highScore;
  game.attention = createAttention();
  game.lives = CONFIG.game.startingLives;
  game.elapsed = 0;
  game.hidden = false;
  game.newRecord = false;
}

/**
 * Advances the whole simulation one frame and returns the events the
 * presentation layer cares about. The game never draws and never plays audio —
 * it only reports what happened.
 */
export function updateGame(game, intent, dt) {
  if (game.phase !== 'PLAYING') return [];

  const events = [];
  game.elapsed += dt;

  const cricketEvents = updateCricket(game.cricket, intent, dt, game.world);
  game.hidden = cricketEvents.hidden;

  if (cricketEvents.startedSinging) events.push({ type: 'song-start' });
  if (cricketEvents.stoppedSinging) {
    breakSong(game.score);
    events.push({ type: 'song-break' });
  }

  // Singing from cover is loud but scores nothing — cover is safety, not points.
  const scoringSong = game.cricket.singing && !game.hidden;
  if (scoringSong) tickSong(game.score, dt);
  tickFed(game.score, dt);

  const { spawned } = tickAttention(game.attention, game.cricket.singing, dt);
  const difficulty = difficultyAt(game.elapsed);

  for (let i = 0; i < spawned; i += 1) {
    if (game.birds.length >= CONFIG.bird.maxAlive) break;
    game.birds.push(spawnBird(game.world, game.rng, difficulty));
    events.push({ type: 'bird-spawn' });
  }

  updateFood(game.food, dt, game.world, game.rng);
  for (const item of consumeFood(game.food, game.cricket)) {
    eat(game.score, item.value);
    events.push({ type: 'ate', food: item });
  }

  const context = {
    world: game.world,
    cricket: game.cricket,
    hidden: game.hidden,
    singing: game.cricket.singing,
  };

  const survivors = [];

  for (const bird of game.birds) {
    const previousState = bird.state;
    const event = updateBird(bird, dt, context);

    if (previousState === 'CIRCLE' && bird.state === 'DIVE') {
      events.push({ type: 'bird-cry', bird });
    }

    if (event === 'hit' && game.cricket.invulnerableFor <= 0) {
      game.lives -= 1;
      game.cricket.invulnerableFor = CONFIG.cricket.invulnerableSeconds;
      breakSong(game.score);
      resetAttention(game.attention);
      events.push({ type: 'hit', bird });
    }

    if (bird.state !== 'GONE') survivors.push(bird);
  }

  game.birds = survivors;

  if (game.lives <= 0) {
    game.phase = 'GAME_OVER';
    game.newRecord = commitHighScore(game.score);
    events.push({ type: 'game-over' });
  }

  return events;
}
