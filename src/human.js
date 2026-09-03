import { CONFIG } from './config.js';

/**
 * The human: enormous, oblivious, and lethal by accident.
 *
 * It never hunts and never reacts. It simply crosses a room on its own
 * schedule, and anything caught in the open under a footfall is crushed. That
 * makes it a different kind of pressure from the cat: there is nothing to
 * outwit, only a path to read and a moment to be somewhere else.
 *
 * A shadow arrives before the feet do, so the room always tells you first.
 */

function nextDelay([min, max], rng) {
  return min + rng() * (max - min);
}

/** The schedule that decides when a human walks through. */
export function createHumanSchedule(rng = Math.random) {
  return { timer: nextDelay(CONFIG.human.everySeconds, rng), walker: null };
}

function bandCentre(band) {
  return (band.top + band.bottom) / 2;
}

/** Starts a crossing on one of the floors, from one side to the other. */
function startWalk(world, rng) {
  const band = world.bands[Math.floor(rng() * world.bands.length) % world.bands.length];
  const leftToRight = rng() < 0.5;
  const margin = 160;

  return {
    y: bandCentre(band),
    band,
    dir: leftToRight ? 1 : -1,
    x: leftToRight ? -margin : world.width + margin,
    // The shadow leads the feet in, so the floor darkens before anything lands.
    warnFor: CONFIG.human.warningSeconds,
    // Distance walked, used to place footfalls a stride apart.
    walked: 0,
    lastStride: 0,
  };
}

/**
 * Advances the schedule and any crossing in progress.
 *
 * Returns events: 'human-approaching' when a shadow appears, 'footfall' for
 * each step (with where it landed), 'human-crush' when one lands on an exposed
 * cricket, and 'human-gone' when the crossing finishes.
 *
 * `context` carries { world, cricket, hidden }.
 */
export function updateHuman(schedule, dt, context, rng = Math.random) {
  const { world, cricket, hidden } = context;
  const cfg = CONFIG.human;
  const events = [];

  if (!schedule.walker) {
    schedule.timer -= dt;
    if (schedule.timer > 0) return events;

    schedule.timer = nextDelay(cfg.everySeconds, rng);
    schedule.walker = startWalk(world, rng);
    events.push({ type: 'human-approaching', walker: schedule.walker });
    return events;
  }

  const walker = schedule.walker;

  // The shadow holds for a moment before the feet actually arrive.
  if (walker.warnFor > 0) {
    walker.warnFor = Math.max(0, walker.warnFor - dt);
    return events;
  }

  const travelled = cfg.walkSpeed * dt;
  walker.x += walker.dir * travelled;
  walker.walked += travelled;

  // A footfall every stride.
  if (walker.walked - walker.lastStride >= cfg.strideLength) {
    walker.lastStride = walker.walked;
    events.push({ type: 'footfall', x: walker.x, y: walker.y });

    const onThisFloor = cricket.y >= walker.band.top && cricket.y <= walker.band.bottom;
    const underfoot = Math.hypot(cricket.x - walker.x, cricket.y - walker.y) <= cfg.crushRadius;

    // Furniture is the only thing that saves you. It is not looking, so being
    // airborne changes nothing: there is nowhere above a foot to be.
    if (onThisFloor && underfoot && !hidden) {
      events.push({ type: 'human-crush', x: walker.x, y: walker.y });
    }
  }

  const margin = 200;
  if (walker.x < -margin || walker.x > world.width + margin) {
    schedule.walker = null;
    events.push({ type: 'human-gone' });
  }

  return events;
}
