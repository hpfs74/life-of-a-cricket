import { CONFIG } from './config.js';
import { bandAt, clampToBounds, inStairwell } from './world.js';

/**
 * The house cat: the only thing indoors that actually hunts the cricket.
 *
 * It prowls a floor until it notices something exposed — noticing is a matter
 * of distance, and singing carries much further than moving does. Cover breaks
 * its interest outright, which is why furniture is the indoor equivalent of a
 * grass tuft.
 *
 * Once it has the cricket it stalks, then pounces at where the cricket was when
 * it committed: the same rule birds' dives and spiders' lunges use, so the
 * counterplay reads identically everywhere in the game.
 *
 * It can take the stairs, which is the whole reason both floors are on screen.
 */

function bandCentre(band) {
  return (band.top + band.bottom) / 2;
}

export function createCat(world, rng = Math.random) {
  const band = world.bands[world.bands.length - 1];

  return {
    x: world.width * (0.35 + rng() * 0.4),
    y: bandCentre(band),
    dirX: -1,
    dirY: 0,
    state: 'PROWL',
    stateTime: 0,
    targetX: 0,
    targetY: 0,
    // Where it is heading while prowling, and which floor it wants to be on.
    roamX: world.width * rng(),
    interest: 0,
  };
}

function enterState(cat, state) {
  cat.state = state;
  cat.stateTime = 0;
}

function step(cat, world, targetX, targetY, speed, dt) {
  const dx = targetX - cat.x;
  const dy = targetY - cat.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return 0;

  const travelled = Math.min(distance, speed * dt);
  cat.dirX = dx / distance;
  cat.dirY = dy / distance;

  const next = clampToBounds(world, cat.x + cat.dirX * travelled, cat.y + cat.dirY * travelled, 18);
  cat.x = next.x;
  cat.y = next.y;

  return distance - travelled;
}

/** True when the cat and the cricket are on the same floor. */
function sameFloor(world, cat, cricket) {
  return bandAt(world, cat.x, cat.y).top === bandAt(world, cricket.x, cricket.y).top;
}

/**
 * Walks the cat toward the stairwell and then along it to the cricket's floor.
 * Returns true once it has arrived on the right floor.
 */
function useStairs(cat, world, cricket, speed, dt) {
  const stair = world.stairs[0];
  if (!stair) return true;

  const middle = stair.x + stair.width / 2;

  if (!inStairwell(world, cat.x) || Math.abs(cat.x - middle) > CONFIG.cat.stairTolerance) {
    step(cat, world, middle, cat.y, speed, dt);
    return false;
  }

  // On the stairs: climb or descend toward the cricket's floor.
  const target = bandCentre(bandAt(world, cricket.x, cricket.y));
  step(cat, world, middle, target, speed, dt);
  return sameFloor(world, cat, cricket);
}

/**
 * Advances the cat and reports what happened.
 *
 * `context` carries { world, cricket, hidden, singing }.
 */
export function updateCat(cat, dt, context, rng = Math.random) {
  const { world, cricket, hidden, singing } = context;
  const cfg = CONFIG.cat;

  cat.stateTime += dt;

  const distance = Math.hypot(cricket.x - cat.x, cricket.y - cat.y);
  const reach = cfg.noticeRadius + (singing ? cfg.singingBonus : 0);
  // Furniture hides the cricket outright; being airborne does not.
  const visible = !hidden && distance <= reach;
  cat.interest = visible ? Math.max(0, 1 - distance / reach) : 0;

  switch (cat.state) {
    case 'PROWL': {
      if (Math.abs(cat.x - cat.roamX) < 12) cat.roamX = world.width * rng();
      step(cat, world, cat.roamX, bandCentre(bandAt(world, cat.x, cat.y)), cfg.prowlSpeed, dt);

      if (visible) {
        enterState(cat, 'STALK');
        return 'noticed';
      }
      return 'none';
    }

    case 'STALK': {
      if (!visible) {
        enterState(cat, 'CONFUSED');
        return 'lost';
      }

      if (!sameFloor(world, cat, cricket)) {
        useStairs(cat, world, cricket, cfg.stalkSpeed, dt);
        return 'none';
      }

      step(cat, world, cricket.x, cricket.y, cfg.stalkSpeed, dt);

      if (cat.stateTime < cfg.stalkSeconds) return 'none';

      cat.targetX = cricket.x;
      cat.targetY = cricket.y;
      enterState(cat, 'POUNCE');
      return 'pounced';
    }

    case 'POUNCE': {
      const remaining = step(cat, world, cat.targetX, cat.targetY, cfg.pounceSpeed, dt);
      if (remaining > 1 && cat.stateTime < cfg.pounceSeconds) return 'none';

      const gap = Math.hypot(cricket.x - cat.x, cricket.y - cat.y);
      // A leap clears a pounce exactly as it clears a dive.
      const connects = gap <= cfg.hitRadius && !cricket.jumping;

      enterState(cat, 'RECOVER');
      return connects ? 'hit' : 'missed';
    }

    case 'RECOVER': {
      if (cat.stateTime >= cfg.recoverSeconds) enterState(cat, 'PROWL');
      return 'none';
    }

    case 'CONFUSED': {
      // Mooching about where it last saw something.
      step(cat, world, cat.x + cat.dirX * 40, cat.y, cfg.prowlSpeed * 0.6, dt);

      if (visible) {
        enterState(cat, 'STALK');
        return 'noticed';
      }
      if (cat.stateTime >= cfg.confusedSeconds) enterState(cat, 'PROWL');
      return 'none';
    }

    default:
      return 'none';
  }
}
