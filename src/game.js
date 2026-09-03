import { CONFIG } from './config.js';
import { atDoorway, clampToBounds, createWorld, isWater, nearestDryPoint, spawnPoint } from './world.js';
import { createHouse, houseEntry } from './house.js';
import { createCat, updateCat } from './cat.js';
import { createHumanSchedule, updateHuman } from './human.js';
import { createCricket, updateCricket } from './cricket.js';
import { createFoodField, updateFood, consumeFood, dropFood } from './food.js';
import { spawnBird, updateBird } from './birds.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from './score.js';
import { createAttention, tickAttention, resetAttention } from './attention.js';
import { createRivals, updateRivals, resolveStrike, spawnRival } from './rivals.js';
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
    stage: 'meadow',
    stageCooldown: 0,
    // Indoor residents. Both are null outdoors.
    cat: null,
    humans: null,
    shiftedFor: 0,
    rivalRespawnTimer: 0,
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
  game.stage = 'meadow';
  game.stageCooldown = 0;
  game.cat = null;
  game.humans = null;
  game.shiftedFor = 0;
  game.rivalRespawnTimer = 0;
  game.patrolTimer = 0;
  game.hidden = false;
  game.newRecord = false;
}

/**
 * Moves the cricket into a new world, taking its inhabitants with it.
 *
 * Score, lives and the day carry across untouched: going indoors is a change of
 * scene in one cricket's life, not a new run.
 */
function changeStage(game, stage, world, arrival, events) {
  game.stage = stage;
  game.world = world;
  game.stageCooldown = CONFIG.game.stageCooldownSeconds;

  game.cricket.x = arrival.x;
  game.cricket.y = arrival.y;
  game.cricket.jumping = false;
  game.cricket.jumpProgress = 0;
  game.cricket.stunnedFor = 0;

  // Nothing follows the cricket through a doorway.
  game.birds = [];
  game.spiders = createSpiders(world, game.rng, game.cricket);
  game.rivals = createRivals(world, game.rng);
  game.food = createFoodField();
  game.patrolTimer = 0;
  game.rivalRespawnTimer = 0;

  // The house has its own cast; the meadow has none of it.
  const indoors = stage === 'house';
  game.cat = indoors ? createCat(world, game.rng) : null;
  game.humans = indoors ? createHumanSchedule(game.rng) : null;

  events.push({ type: 'stage-change', stage });
}

/**
 * Resolves a swing: damage, the corpse's drop, and the beetle's answer.
 *
 * Swinging is loud, so it feeds the same attention meter singing does — a long
 * scrap summons predators exactly like a long note.
 */
function swing(game, events) {
  const { hit, killed, retaliated } = resolveStrike(game.cricket, game.rivals);
  events.push({ type: 'strike', connected: Boolean(hit) });

  game.attention.value = Math.min(1, game.attention.value + CONFIG.attention.perStrike);

  if (!hit) return;

  if (killed) {
    const drops = CONFIG.rivals.drops[hit.kind] ?? 1;
    for (let i = 0; i < drops; i += 1) {
      // Scatter multiples so a beetle's pair does not stack into one crumb.
      const angle = (i / drops) * Math.PI * 2;
      const spread = drops > 1 ? 14 : 0;
      const where = clampToBounds(
        game.world,
        hit.x + Math.cos(angle) * spread,
        hit.y + Math.sin(angle) * spread,
        CONFIG.food.types.grub.radius,
      );
      dropFood(game.food, 'grub', where.x, where.y);
    }
    events.push({ type: 'bug-killed', kind: hit.kind, drops });
    return;
  }

  events.push({ type: 'bug-hit', kind: hit.kind });

  if (retaliated) {
    game.cricket.stunnedFor = CONFIG.rivals.biteStunSeconds;

    // A shove backwards, so the bite reads as contact rather than a freeze.
    const shoved = clampToBounds(
      game.world,
      game.cricket.x - game.cricket.dirX * CONFIG.rivals.biteKnockback,
      game.cricket.y - game.cricket.dirY * CONFIG.rivals.biteKnockback,
      CONFIG.cricket.radius,
    );
    if (!isWater(game.world, shoved.x, shoved.y, CONFIG.cricket.radius)) {
      game.cricket.x = shoved.x;
      game.cricket.y = shoved.y;
    }

    events.push({ type: 'stunned', kind: hit.kind });
  }
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

  game.stageCooldown = Math.max(0, game.stageCooldown - dt);

  const previousDay = game.day;
  game.day = dayAt(game.elapsed);
  // Houses do not rearrange themselves overnight; meadows do.
  if (game.day !== previousDay && game.stage === 'meadow') reshuffleMeadow(game, events);

  const cricketEvents = updateCricket(game.cricket, intent, dt, game.world);
  game.hidden = cricketEvents.hidden;

  if (cricketEvents.startedSinging) events.push({ type: 'song-start' });
  if (cricketEvents.stoppedSinging) {
    breakSong(game.score);
    events.push({ type: 'song-break' });
  }
  if (cricketEvents.startedJump) events.push({ type: 'jump' });
  if (cricketEvents.landed) events.push({ type: 'land' });
  if (cricketEvents.startedStrike) swing(game, events);

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

  // Birds hunt the meadow by day; bats take the night shift. Neither comes
  // indoors — the house has its own cast.
  const kind = game.night ? 'bat' : 'bird';
  const aerialHunting = game.stage === 'meadow';

  for (let i = 0; aerialHunting && i < spawned + patrols; i += 1) {
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

  // Bugs wander back in from the long grass, so killing them off never empties
  // the meadow of competition or of the food their corpses provide.
  game.rivalRespawnTimer += dt;
  if (game.rivals.length < CONFIG.rivals.count && game.rivalRespawnTimer >= CONFIG.rivals.respawnSeconds) {
    game.rivalRespawnTimer = 0;
    game.rivals.push(spawnRival(game.world, game.rng, game.rivals.length));
  }

  // A doorway moves the cricket between the meadow and the house.
  if (game.stageCooldown <= 0 && atDoorway(game.world, game.cricket.x, game.cricket.y)) {
    if (game.stage === 'meadow') {
      const house = createHouse(game.rng);
      changeStage(game, 'house', house, houseEntry(house), events);
    } else {
      const meadow = createWorld(game.rng);
      const spawn = spawnPoint(meadow);
      // Step back out onto the meadow just short of the door.
      const arrival = clampToBounds(
        meadow,
        meadow.door.x - CONFIG.doorway.width * 1.6,
        meadow.door.y,
        CONFIG.cricket.radius,
      );
      changeStage(game, 'meadow', meadow, isWater(meadow, arrival.x, arrival.y, CONFIG.cricket.radius)
        ? spawn
        : arrival, events);
    }
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

  // Indoors, the cat hunts and the human blunders through.
  if (game.cat) {
    const catEvent = updateCat(game.cat, dt, context, game.rng);

    if (catEvent === 'hit') takeHit(game, events, { cat: game.cat, from: 'cat' });
    else if (catEvent !== 'none') events.push({ type: `cat-${catEvent}`, cat: game.cat });
  }

  if (game.humans) {
    for (const event of updateHuman(game.humans, dt, context, game.rng)) {
      if (event.type === 'human-crush') takeHit(game, events, { from: 'human' });
      else events.push(event);
    }
  }

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
