import { CONFIG } from './config.js';

/**
 * Water is a list of overlapping circles. Circles are trivial to hit-test and,
 * strung together, they read as a meandering stream or a rounded pond without
 * needing any polygon work.
 *
 * This module knows nothing about the rest of the world, so `world.js` can
 * build terrain on top of it without a circular import.
 */

function range(rng, [min, max]) {
  return min + rng() * (max - min);
}

/** A stream running across the ground band, narrow in places and wide in others. */
function createStream({ width, height, top }, rng) {
  const { streamSegments, streamMinRadius, streamMaxRadius, streamWander, spawnClearance } = CONFIG.water;

  const bandTop = top + 8;
  const bandBottom = height - 8;
  const middle = width / 2;

  // Start to one side of the spawn point, far enough that the cricket never
  // begins a run standing in the water.
  const side = rng() < 0.5 ? -1 : 1;
  const offset = spawnClearance + streamMaxRadius + rng() * (width * 0.3);
  let x = Math.min(width - 80, Math.max(80, middle + side * offset));

  const phase = rng() * Math.PI * 2;
  const circles = [];

  for (let i = 0; i <= streamSegments; i += 1) {
    const t = i / streamSegments;
    const y = bandTop + t * (bandBottom - bandTop);

    x += (rng() - 0.5) * streamWander;
    x = Math.min(width - 80, Math.max(80, x));

    // A slow wave along the length gives fordable narrows and impassable pools.
    const swell = 0.5 + 0.5 * Math.sin(t * Math.PI * 3 + phase);
    const radius = streamMinRadius + (streamMaxRadius - streamMinRadius) * swell;

    circles.push({ x, y, radius });
  }

  return circles;
}

/** A pond: a handful of overlapping blobs around a centre. */
function createPond({ width, height, top }, rng) {
  const { pondBlobs, pondRadiusRange, spawnClearance } = CONFIG.water;
  const middle = width / 2;

  const centreY = top + 60 + rng() * Math.max(1, height - top - 120);
  let centreX = 100 + rng() * Math.max(1, width - 200);

  // Shove it clear of the spawn point rather than rejecting the whole pond.
  if (Math.abs(centreX - middle) < spawnClearance) {
    centreX = middle + (centreX >= middle ? 1 : -1) * spawnClearance;
    centreX = Math.min(width - 100, Math.max(100, centreX));
  }

  return Array.from({ length: pondBlobs }, () => {
    const radius = range(rng, pondRadiusRange);
    const angle = rng() * Math.PI * 2;
    const reach = rng() * radius * 0.9;
    return {
      x: centreX + Math.cos(angle) * reach,
      y: centreY + Math.sin(angle) * reach * 0.6,
      radius,
    };
  });
}

/** Builds one stream plus a pond or two for a meadow of the given bounds. */
export function createWater(bounds, rng = Math.random) {
  const [minPonds, maxPonds] = CONFIG.water.pondCountRange;
  const ponds = Math.round(minPonds + rng() * (maxPonds - minPonds));

  const circles = createStream(bounds, rng);
  for (let i = 0; i < ponds; i += 1) circles.push(...createPond(bounds, rng));

  // Keep water inside the ground band; nothing should lap into the sky.
  return circles.filter((c) => c.y - c.radius * 0.6 > bounds.top - c.radius);
}

/**
 * True when a body of the given margin would be touching water.
 * Pass the mover's radius as `margin` so it stops at the bank, not in it.
 */
export function isWaterAt(water, x, y, margin = 0) {
  if (!water) return false;

  for (const circle of water) {
    if (Math.hypot(circle.x - x, circle.y - y) < circle.radius + margin) return true;
  }
  return false;
}
