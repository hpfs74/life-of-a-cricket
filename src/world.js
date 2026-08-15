import { CONFIG } from './config.js';
import { createWater, isWaterAt } from './water.js';

const COVER_TYPES = ['grass', 'rock', 'leaf'];

/**
 * A world is divided into horizontal bands of walkable ground.
 *
 * The meadow has one, from the horizon to the bottom of the screen. A house has
 * two, stacked, with a ceiling between them. A stairwell is an x-range where two
 * bands join into one tall corridor.
 *
 * Modelling floors this way means nothing else has to know about them: cover,
 * water and hit-testing already work on absolute coordinates, and because bands
 * occupy disjoint y ranges, furniture upstairs cannot hide anything downstairs.
 */

/**
 * True when the cricket is standing in a doorway — the east door of the meadow,
 * or the front door of a house. Either one moves it between stages.
 */
export function atDoorway(world, x, y) {
  const door = world.door;
  if (!door) return false;

  const withinX = world.kind === 'house'
    ? x <= door.x + door.width / 2
    : x >= door.x - door.width / 2;

  return withinX && Math.abs(y - door.y) <= door.height / 2;
}

/** True when this x sits inside a stairwell, where the bands join up. */
export function inStairwell(world, x) {
  return (world.stairs ?? []).some((stair) => x >= stair.x && x <= stair.x + stair.width);
}

/**
 * The band of walkable ground at a point: the one containing `y`, or the whole
 * height when standing in a stairwell. Falls back to the nearest band if `y` is
 * inside a ceiling, so nothing can be trapped between floors.
 */
export function bandAt(world, x, y) {
  const bands = world.bands ?? [{ top: world.top, bottom: world.height }];

  if (inStairwell(world, x)) {
    return { top: bands[0].top, bottom: bands[bands.length - 1].bottom };
  }

  const containing = bands.find((band) => y >= band.top && y <= band.bottom);
  if (containing) return containing;

  return bands.reduce((best, band) => {
    const distance = Math.min(Math.abs(y - band.top), Math.abs(y - band.bottom));
    const bestDistance = Math.min(Math.abs(y - best.top), Math.abs(y - best.bottom));
    return distance < bestDistance ? band : best;
  });
}

/** The point every run starts from: the middle of the playable ground. */
export function spawnPoint(world) {
  return { x: world.width / 2, y: world.top + (world.height - world.top) / 2 };
}

/**
 * Builds the meadow. `top` is the horizon: everything above it is sky, and the
 * band below it is the playable field. Cover is rejection-sampled so no two
 * pieces merge into one unreadable blob, none of it drifts up into the sky, and
 * none lands on the spawn point — a run always starts in the open, exposed and
 * scoring.
 */
export function createWorld(rng = Math.random) {
  const {
    width, height, horizonFraction, edgeMargin, coverCount,
    coverMinRadius, coverMaxRadius, coverMinSeparation, spawnClearance,
  } = CONFIG.world;

  const top = height * horizonFraction;
  const world = {
    kind: 'meadow',
    width, height, top,
    // One band of ground, and no stairs: the meadow is a one-floor world.
    bands: [{ top, bottom: height }],
    stairs: [],
    // The house stands at the east end. Walk into the doorway to go inside.
    door: {
      x: width - CONFIG.doorway.width / 2,
      y: top + (height - top) * 0.62,
      width: CONFIG.doorway.width,
      height: CONFIG.doorway.height,
    },
    water: [], cover: [],
  };
  world.water = createWater({ width, height, top }, rng);
  const spawn = spawnPoint(world);

  let attempts = 0;

  while (world.cover.length < coverCount && attempts < coverCount * 400) {
    attempts += 1;

    const radius = coverMinRadius + rng() * (coverMaxRadius - coverMinRadius);

    // Grass tufts draw upward from their anchor, so they need clearance above
    // the anchor to stay out of the sky.
    const minY = top + radius * 1.35;
    const maxY = height - radius;
    if (minY >= maxY) continue;

    const minX = Math.max(radius, edgeMargin);
    const x = minX + rng() * (width - minX * 2);
    const y = minY + rng() * (maxY - minY);

    if (Math.hypot(spawn.x - x, spawn.y - y) < radius + spawnClearance) continue;

    // Leave the doorway approach clear, so the way indoors is never walled off.
    if (Math.hypot(world.door.x - x, world.door.y - y) < radius + CONFIG.doorway.width * 2) continue;

    // Cover grows on dry ground.
    if (isWaterAt(world.water, x, y, radius)) continue;

    const tooClose = world.cover.some(
      (item) => Math.hypot(item.x - x, item.y - y) < coverMinSeparation,
    );
    if (tooClose) continue;

    world.cover.push({ x, y, radius, type: COVER_TYPES[Math.floor(rng() * COVER_TYPES.length)] });
  }

  return world;
}

/**
 * Keeps a body inside the walkable ground: never up in the sky outdoors, and
 * never through a ceiling indoors.
 */
export function clampToBounds(world, x, y, radius) {
  const band = bandAt(world, x, y);
  return {
    x: Math.min(Math.max(x, radius), world.width - radius),
    y: Math.min(Math.max(y, band.top + radius), band.bottom - radius),
  };
}

/** True when a body of the given radius would be standing in water. */
export function isWater(world, x, y, margin = 0) {
  return isWaterAt(world.water, x, y, margin);
}

/**
 * Walks outward from a point until it finds somewhere a body of `radius` can
 * legally stand: on the map, out of the water, and clear of anything `avoid`
 * rejects. Used to rescue the cricket when the terrain changes underneath it.
 */
export function nearestDryPoint(world, x, y, radius, avoid = () => false) {
  const start = clampToBounds(world, x, y, radius);
  if (!isWater(world, start.x, start.y, radius) && !avoid(start.x, start.y)) return start;

  for (let ring = 1; ring <= 26; ring += 1) {
    const distance = ring * 26;
    const steps = ring * 8;

    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const candidate = clampToBounds(
        world,
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance,
        radius,
      );
      if (!isWater(world, candidate.x, candidate.y, radius) && !avoid(candidate.x, candidate.y)) {
        return candidate;
      }
    }
  }

  return spawnPoint(world);
}

export function coverAt(world, x, y) {
  for (const item of world.cover) {
    if (Math.hypot(item.x - x, item.y - y) <= item.radius) return item;
  }
  return null;
}

export function isHidden(world, x, y) {
  return coverAt(world, x, y) !== null;
}

/**
 * Picks the cover a jump should land on.
 *
 * A held direction narrows the search to a cone, so the player steers the leap
 * rather than always being pulled to whatever happens to be closest. If nothing
 * lies inside that cone the search widens to everything in range — better to
 * leap somewhere useful than to refuse the input.
 */
export function nearestCover(world, x, y, options = {}) {
  const {
    maxDistance = Infinity,
    dirX = 0,
    dirY = 0,
    halfAngleDegrees = CONFIG.cricket.jump.halfAngleDegrees,
    exclude = null,
  } = options;

  const inRange = world.cover
    .filter((item) => item !== exclude)
    .map((item) => ({ item, distance: Math.hypot(item.x - x, item.y - y) }))
    .filter((candidate) => candidate.distance <= maxDistance);

  if (inRange.length === 0) return null;

  const closest = (candidates) =>
    candidates.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best)).item;

  const magnitude = Math.hypot(dirX, dirY);
  if (magnitude === 0) return closest(inRange);

  const cosLimit = Math.cos((halfAngleDegrees * Math.PI) / 180);
  const inCone = inRange.filter(({ item, distance }) => {
    if (distance === 0) return true;
    const dot = ((item.x - x) * dirX + (item.y - y) * dirY) / (distance * magnitude);
    return dot >= cosLimit;
  });

  return closest(inCone.length > 0 ? inCone : inRange);
}

/**
 * Finds a point in the open ground, at least `minDistanceFromCover` away from
 * every piece of cover, so food never spawns somewhere the player can eat it
 * without ever leaving safety. Falls back to the last candidate if the meadow
 * is unusually crowded, which keeps spawning from stalling the game.
 */
export function randomOpenPoint(world, rng = Math.random, minDistanceFromCover = 0) {
  const margin = CONFIG.world.edgeMargin;
  const minY = world.top + margin;
  let candidate = spawnPoint(world);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    candidate = {
      x: margin + rng() * (world.width - margin * 2),
      y: minY + rng() * (world.height - margin - minY),
    };

    if (isWaterAt(world.water, candidate.x, candidate.y, minDistanceFromCover)) continue;

    const clear = world.cover.every(
      (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) > item.radius + minDistanceFromCover,
    );
    if (clear) return candidate;
  }

  return candidate;
}
