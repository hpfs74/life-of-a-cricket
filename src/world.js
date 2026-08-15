import { CONFIG } from './config.js';

const COVER_TYPES = ['grass', 'rock', 'leaf'];

/**
 * Builds the meadow: fixed bounds plus a scattering of cover objects that the
 * cricket can hide inside. Cover is rejection-sampled so no two pieces overlap
 * closely enough to merge into one unreadable blob, and so none of it lands on
 * the spawn point — the run always starts in the open, exposed and scoring.
 */
export function createWorld(rng = Math.random) {
  const {
    width, height, edgeMargin, coverCount,
    coverMinRadius, coverMaxRadius, coverMinSeparation, spawnClearance,
  } = CONFIG.world;

  const spawn = { x: width / 2, y: height / 2 };
  const cover = [];
  let attempts = 0;

  while (cover.length < coverCount && attempts < coverCount * 400) {
    attempts += 1;

    const radius = coverMinRadius + rng() * (coverMaxRadius - coverMinRadius);
    const minX = Math.max(radius, edgeMargin);
    const minY = Math.max(radius, edgeMargin);
    const x = minX + rng() * (width - minX * 2);
    const y = minY + rng() * (height - minY * 2);

    if (Math.hypot(spawn.x - x, spawn.y - y) < radius + spawnClearance) continue;

    const tooClose = cover.some(
      (item) => Math.hypot(item.x - x, item.y - y) < coverMinSeparation,
    );
    if (tooClose) continue;

    cover.push({ x, y, radius, type: COVER_TYPES[Math.floor(rng() * COVER_TYPES.length)] });
  }

  return { width, height, cover };
}

export function clampToBounds(world, x, y, radius) {
  return {
    x: Math.min(Math.max(x, radius), world.width - radius),
    y: Math.min(Math.max(y, radius), world.height - radius),
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
 * Finds a point in the open meadow, at least `minDistanceFromCover` away from
 * every piece of cover, so food never spawns somewhere the player can eat it
 * without ever leaving safety. Falls back to the last candidate if the meadow
 * is unusually crowded, which keeps spawning from stalling the game.
 */
export function randomOpenPoint(world, rng = Math.random, minDistanceFromCover = 0) {
  const margin = CONFIG.world.edgeMargin;
  let candidate = { x: world.width / 2, y: world.height / 2 };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    candidate = {
      x: margin + rng() * (world.width - margin * 2),
      y: margin + rng() * (world.height - margin * 2),
    };

    const clear = world.cover.every(
      (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) > item.radius + minDistanceFromCover,
    );
    if (clear) return candidate;
  }

  return candidate;
}
