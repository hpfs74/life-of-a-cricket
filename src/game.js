import { CONFIG } from './config.js';
import { createWorld, isWater, nearestDryPoint } from './world.js';
import { createCricket, updateCricket } from './cricket.js';
import { createFoodField, updateFood, consumeFood } from './food.js';
import { spawnBird, updateBird } from './birds.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from './score.js';
import { createAttention, tickAttention, resetAttention } from './attention.js';
import { createRivals, updateRivals } from './rivals.js';
import { createSpiders, updateSpiders } from './spiders.js';
import { dayAt, isNight } from './daylight.js';

export { dayAt, isNight };

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
    rivals: createRivals(world, rng),
    spiders: createSpiders(world, rng),
    score: createScore(storage),
    attention: createAttention(),
    lives: CONFIG.game.startingLives,
    elapsed: 0,
    day: 1,
    night: false,
    shiftedFor: 0,
    patrolTimer: 0,
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
  game.rivals = createRivals(game.world, game.rng);
  game.spiders = createSpiders(game.world, game.rng);
  game.score = createScore(game.score.storage);
  game.score.highScore = highScore;
  game.attention = createAttention();
  game.lives = CONFIG.game.startingLives;
  game.elapsed = 0;
  game.day = 1;
  game.night = false;
  game.shiftedFor = 0;
  game.patrolTimer = 0;
  game.hidden = false;
  game.newRecord = false;
}

/**
 * Rebuilds the meadow when a new day turns over: the grass moves, the stream
 * finds a new course and the spiders take new tufts.
 *
 * Nothing here is allowed to bury the cricket. Spiders keep clear of wherever
 * it is standing, any leap in progress is cancelled so it cannot land somewhere
 * that no longer exists, and the cricket itself is walked to the nearest safe
 * dry ground if the new terrain arrived on top of it.
 */
function reshuffleMeadow(game, events) {
  game.world = createWorld(game.rng);
  game.spiders = createSpiders(game.world, game.rng, game.cricket);
  game.rivals = createRivals(game.world, game.rng);

  game.food.items = game.food.items.filter((item) => !isWater(game.world, item.x, item.y));

  const inSpiderTuft = (x, y) =>
    game.spiders.some((spider) => Math.hypot(spider.homeX - x, spider.homeY - y) <= spider.cover.radius);

  const safe = nearestDryPoint(
    game.world, game.cricket.x, game.cricket.y, CONFIG.cricket.radius, inSpiderTuft,
  );
  game.cricket.x = safe.x;
  game.cricket.y = safe.y;

  game.cricket.jumping = false;
  game.cricket.jumpProgress = 0;

  game.shiftedFor = CONFIG.game.shiftCaptionSeconds;
  events.push({ type: 'new-day', day: game.day });
}

/**
 * Applies one hit on the cricket, from whatever caught it. Returns false if the
 * cricket was still inside its mercy window and the hit did not land.
 */
function takeHit(game, events, detail) {
  if (game.cricket.invulnerableFor > 0) return false;

  game.lives -= 1;
  game.cricket.invulnerableFor = CONFIG.cricket.invulnerableSeconds;
  breakSong(game.score);
  resetAttention(game.attention);
  events.push({ type: 'hit', ...detail });
  return true;
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
  game.night = isNight(game.elapsed);
  game.shiftedFor = Math.max(0, game.shiftedFor - dt);

  const previousDay = game.day;
  game.day = dayAt(game.elapsed);
  if (game.day !== previousDay) reshuffleMeadow(game, events);

  const cricketEvents = updateCricket(game.cricket, intent, dt, game.world);
  game.hidden = cricketEvents.hidden;

  if (cricketEvents.startedSinging) events.push({ type: 'song-start' });
  if (cricketEvents.stoppedSinging) {
    breakSong(game.score);
    events.push({ type: 'song-break' });
  }
  if (cricketEvents.startedJump) events.push({ type: 'jump' });
  if (cricketEvents.landed) events.push({ type: 'land' });

  // Singing from cover is loud but scores nothing — cover is safety, not points.
  const scoringSong = game.cricket.singing && !game.hidden;
  if (scoringSong) tickSong(game.score, dt);
  tickFed(game.score, dt);

  const { spawned } = tickAttention(game.attention, game.cricket.singing, dt);
  const difficulty = difficultyAt(game.elapsed);

  // Birds also patrol on their own schedule, so silence is quieter but never
  // safe. The patrol clock speeds up with difficulty.
  game.patrolTimer += dt;
  const patrolInterval = CONFIG.game.patrolIntervalSeconds / difficulty;
  let patrols = 0;
  while (game.patrolTimer >= patrolInterval) {
    game.patrolTimer -= patrolInterval;
    patrols += 1;
  }

  // Birds hunt the meadow by day; bats take the night shift.
  const kind = game.night ? 'bat' : 'bird';

  for (let i = 0; i < spawned + patrols; i += 1) {
    if (game.birds.length >= CONFIG.bird.maxAlive) break;
    const bird = spawnBird(game.world, game.rng, difficulty, kind, game.cricket);
    game.birds.push(bird);
    events.push({ type: 'bird-spawn', bird, kind });
  }

  updateFood(game.food, dt, game.world, game.rng);
  // A cricket in mid-leap flies over food rather than eating it.
  if (!game.cricket.jumping) {
    for (const item of consumeFood(game.food, game.cricket)) {
      eat(game.score, item.value);
      events.push({ type: 'ate', food: item });
    }
  }

  // The cricket gets first claim each frame; the rivals take what is left.
  for (const item of updateRivals(game.rivals, dt, game.world, game.food, game.rng)) {
    events.push({ type: 'rival-ate', food: item });
  }

  // Spiders hunt from inside cover, so they are checked wherever the cricket is.
  for (const event of updateSpiders(game.spiders, dt, game.world, game.cricket)) {
    if (event.type === 'spider-hit') takeHit(game, events, { spider: event.spider, from: 'spider' });
    else events.push(event);
  }

  const context = {
    world: game.world,
    cricket: game.cricket,
    hidden: game.hidden,
    singing: game.cricket.singing,
    airborne: game.cricket.jumping,
  };

  const survivors = [];

  for (const bird of game.birds) {
    const previousState = bird.state;
    const event = updateBird(bird, dt, context);

    if (previousState === 'CIRCLE' && bird.state === 'DIVE') {
      events.push({ type: 'bird-cry', bird, kind: bird.kind });
    }

    if (event === 'hit') takeHit(game, events, { bird, from: bird.kind });

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
