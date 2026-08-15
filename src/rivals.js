import { CONFIG } from './config.js';
import { clampToBounds, isWater, randomOpenPoint } from './world.js';

const KINDS = ['ant', 'beetle'];

function wanderTarget(rival, world, rng) {
  const point = randomOpenPoint(world, rng, 0);
  rival.targetX = point.x;
  rival.targetY = point.y;
}

/** A handful of ants and beetles scattered across the meadow. */
export function createRivals(world, rng = Math.random) {
  return Array.from({ length: CONFIG.rivals.count }, (unused, index) => {
    const start = randomOpenPoint(world, rng, 0);
    const rival = {
      x: start.x,
      y: start.y,
      dirX: 1,
      dirY: 0,
      kind: KINDS[index % KINDS.length],
      nibbleFor: 0,
      // Staggers their gaits so the swarm does not march in lockstep.
      phase: rng() * Math.PI * 2,
      targetX: start.x,
      targetY: start.y,
    };
    wanderTarget(rival, world, rng);
    return rival;
  });
}

/**
 * Moves every rival and lets them eat.
 *
 * They are not a threat — they are competition. Food left lying around gets
 * taken, so the cricket cannot bank a whole meadow and sing at leisure.
 *
 * Returns the items eaten this frame.
 */
export function updateRivals(rivals, dt, world, food, rng = Math.random) {
  const { speed, eatRadius, nibbleSeconds, senseRange } = CONFIG.rivals;
  const eaten = [];

  for (const rival of rivals) {
    if (rival.nibbleFor > 0) {
      rival.nibbleFor = Math.max(0, rival.nibbleFor - dt);
      continue;
    }

    // Head for the closest food it can sense, else amble to a random spot.
    let best = null;
    let bestDistance = senseRange;

    for (const item of food.items) {
      const distance = Math.hypot(item.x - rival.x, item.y - rival.y);
      if (distance <= bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }

    if (best) {
      rival.targetX = best.x;
      rival.targetY = best.y;
    }

    const dx = rival.targetX - rival.x;
    const dy = rival.targetY - rival.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0.5) {
      rival.dirX = dx / distance;
      rival.dirY = dy / distance;
      const step = Math.min(distance, speed * dt);
      const next = clampToBounds(
        world,
        rival.x + rival.dirX * step,
        rival.y + rival.dirY * step,
        CONFIG.rivals.radius,
      );

      if (isWater(world, next.x, next.y, CONFIG.rivals.radius)) {
        // Blocked by the bank: give up on this errand and amble elsewhere.
        wanderTarget(rival, world, rng);
      } else {
        rival.x = next.x;
        rival.y = next.y;
      }
    } else if (!best) {
      wanderTarget(rival, world, rng);
    }

    if (best && Math.hypot(best.x - rival.x, best.y - rival.y) <= eatRadius) {
      const index = food.items.indexOf(best);
      if (index !== -1) {
        food.items.splice(index, 1);
        eaten.push(best);
        rival.nibbleFor = nibbleSeconds;
        wanderTarget(rival, world, rng);
      }
    }
  }

  return eaten;
}
