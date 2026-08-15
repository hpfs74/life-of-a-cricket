import { CONFIG } from './config.js';

const COVER_TYPES = ['grass', 'rock', 'leaf'];

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
  const world = { width, height, top, cover: [] };
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

    const tooClose = world.cover.some(
      (item) => Math.hypot(item.x - x, item.y - y) < coverMinSeparation,
    );
    if (tooClose) continue;

    world.cover.push({ x, y, radius, type: COVER_TYPES[Math.floor(rng() * COVER_TYPES.length)] });
  }

  return world;
}

/** Keeps a body inside the playable ground, never up in the sky. */
export function clampToBounds(world, x, y, radius) {
  return {
    x: Math.min(Math.max(x, radius), world.width - radius),
    y: Math.min(Math.max(y, world.top + radius), world.height - radius),
  };
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

    const clear = world.cover.every(
      (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) > item.radius + minDistanceFromCover,
    );
    if (clear) return candidate;
  }

  return candidate;
}
