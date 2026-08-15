import { CONFIG } from './config.js';
import { clampToBounds, coverAt, isHidden, isWater, nearestCover, spawnPoint } from './world.js';

export function createCricket(world) {
  const spawn = spawnPoint(world);

  return {
    x: spawn.x,
    y: spawn.y,
    dirX: 1,
    dirY: 0,
    moving: false,
    singing: false,
    songSeconds: 0,
    invulnerableFor: 0,

    jumping: false,
    jumpProgress: 0,
    jumpSeconds: 0,
    jumpFromX: spawn.x,
    jumpFromY: spawn.y,
    jumpToX: spawn.x,
    jumpToY: spawn.y,
    jumpCooldown: 0,
    jumpHeld: false,
  };
}

/**
 * Picks a landing spot for a leap with no cover to aim at.
 *
 * It looks outward along the hop direction for the first dry ground: at a
 * narrow stretch of stream that clears it, and at a wide one it runs out of
 * range and the cricket stops at the near bank instead of drowning.
 */
function dryLanding(cricket, world, dirX, dirY) {
  const { fallbackDistance, range } = CONFIG.cricket.jump;
  const r = CONFIG.cricket.radius;
  const at = (distance) => clampToBounds(world, cricket.x + dirX * distance, cricket.y + dirY * distance, r);

  for (let distance = fallbackDistance; distance <= range; distance += 12) {
    const candidate = at(distance);
    if (!isWater(world, candidate.x, candidate.y, r)) return candidate;
  }

  // Nothing dry ahead: pull back to the last dry step short of the water.
  for (let distance = fallbackDistance - 12; distance > 0; distance -= 12) {
    const candidate = at(distance);
    if (!isWater(world, candidate.x, candidate.y, r)) return candidate;
  }

  return { x: cricket.x, y: cricket.y };
}

/**
 * Moves the cricket, stopping at the water's edge.
 *
 * A blocked move is retried on each axis alone, so walking into a bank at an
 * angle slides along it rather than sticking fast.
 */
function walk(cricket, world, nx, ny, dt) {
  const r = CONFIG.cricket.radius;
  const step = CONFIG.cricket.speed * dt;
  const dry = (point) => !isWater(world, point.x, point.y, r);

  const full = clampToBounds(world, cricket.x + nx * step, cricket.y + ny * step, r);
  if (dry(full)) {
    cricket.x = full.x;
    cricket.y = full.y;
    return;
  }

  const alongX = clampToBounds(world, cricket.x + nx * step, cricket.y, r);
  if (nx !== 0 && dry(alongX)) {
    cricket.x = alongX.x;
    cricket.y = alongX.y;
    return;
  }

  const alongY = clampToBounds(world, cricket.x, cricket.y + ny * step, r);
  if (ny !== 0 && dry(alongY)) {
    cricket.x = alongY.x;
    cricket.y = alongY.y;
  }
}

/**
 * Aims a leap and commits the cricket to it.
 *
 * The target is the nearest cover in the held direction, excluding whatever the
 * cricket is standing in so a jump always goes somewhere. With no cover in
 * range it is a plain hop forward rather than a refused input.
 */
function startJump(cricket, intent, world) {
  const { jump } = CONFIG.cricket;

  const magnitude = Math.hypot(intent.dx, intent.dy);
  const aimX = magnitude > 0 ? intent.dx / magnitude : 0;
  const aimY = magnitude > 0 ? intent.dy / magnitude : 0;

  const target = nearestCover(world, cricket.x, cricket.y, {
    maxDistance: jump.range,
    dirX: aimX,
    dirY: aimY,
    exclude: coverAt(world, cricket.x, cricket.y),
  });

  let destination;
  if (target) {
    // Cover only ever grows on dry ground, so a cover target is always safe.
    destination = clampToBounds(world, target.x, target.y, CONFIG.cricket.radius);
  } else {
    // Fall back to the held direction, or to whichever way the cricket faces.
    const hopX = magnitude > 0 ? aimX : cricket.dirX;
    const hopY = magnitude > 0 ? aimY : cricket.dirY;
    destination = dryLanding(cricket, world, hopX, hopY);
  }

  const distance = Math.hypot(destination.x - cricket.x, destination.y - cricket.y);

  cricket.jumping = true;
  cricket.jumpProgress = 0;
  cricket.jumpSeconds = Math.min(jump.maxSeconds, Math.max(jump.minSeconds, distance / jump.speed));
  cricket.jumpFromX = cricket.x;
  cricket.jumpFromY = cricket.y;
  cricket.jumpToX = destination.x;
  cricket.jumpToY = destination.y;

  if (distance > 0) {
    cricket.dirX = (destination.x - cricket.x) / distance;
    cricket.dirY = (destination.y - cricket.y) / distance;
  }
}

/**
 * Advances the player one frame.
 *
 * Singing and moving are mutually exclusive by design: holding the sing key
 * only sings while no direction is held, and pressing a direction mid-song
 * cancels it. That is the whole risk/reward core — the player has to commit to
 * a spot to score.
 *
 * A leap is the other commitment. Once airborne the cricket cannot steer, sing,
 * cancel or re-jump; it rides the arc out. In exchange, being airborne dodges a
 * diving bird, which makes the leap the counterplay to a bird's cry.
 */
export function updateCricket(cricket, intent, dt, world) {
  const wasSinging = cricket.singing;
  const wasJumping = cricket.jumping;

  cricket.invulnerableFor = Math.max(0, cricket.invulnerableFor - dt);

  // A fresh press, not a held key: jumps never chain on their own.
  const jumpPressed = intent.jump === true;
  const freshPress = jumpPressed && !cricket.jumpHeld;
  cricket.jumpHeld = jumpPressed;

  if (cricket.jumping) {
    cricket.jumpProgress = Math.min(1, cricket.jumpProgress + dt / cricket.jumpSeconds);
    cricket.x = cricket.jumpFromX + (cricket.jumpToX - cricket.jumpFromX) * cricket.jumpProgress;
    cricket.y = cricket.jumpFromY + (cricket.jumpToY - cricket.jumpFromY) * cricket.jumpProgress;

    cricket.singing = false;
    cricket.moving = false;
    cricket.songSeconds = 0;

    if (cricket.jumpProgress >= 1) {
      cricket.jumping = false;
      cricket.jumpCooldown = CONFIG.cricket.jump.cooldownSeconds;
    }
  } else {
    cricket.jumpCooldown = Math.max(0, cricket.jumpCooldown - dt);

    if (freshPress && cricket.jumpCooldown <= 0) {
      startJump(cricket, intent, world);
      cricket.singing = false;
      cricket.moving = false;
      cricket.songSeconds = 0;
    } else {
      const magnitude = Math.hypot(intent.dx, intent.dy);
      const wantsToMove = magnitude > 0;
      cricket.moving = wantsToMove;
      cricket.singing = intent.sing && !wantsToMove;

      if (cricket.singing) {
        cricket.songSeconds += dt;
      } else {
        cricket.songSeconds = 0;

        if (wantsToMove) {
          const nx = intent.dx / magnitude;
          const ny = intent.dy / magnitude;
          cricket.dirX = nx;
          cricket.dirY = ny;
          walk(cricket, world, nx, ny, dt);
        }
      }
    }
  }

  return {
    startedSinging: cricket.singing && !wasSinging,
    stoppedSinging: !cricket.singing && wasSinging,
    startedJump: cricket.jumping && !wasJumping,
    landed: wasJumping && !cricket.jumping,
    // Mid-air the cricket is above the grass, so cover cannot conceal it.
    hidden: !cricket.jumping && isHidden(world, cricket.x, cricket.y),
  };
}
