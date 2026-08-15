import { CONFIG } from './config.js';
import { clampToBounds, coverAt, isHidden, nearestCover, spawnPoint } from './world.js';

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
    destination = clampToBounds(world, target.x, target.y, CONFIG.cricket.radius);
  } else {
    // Fall back to the held direction, or to whichever way the cricket faces.
    const hopX = magnitude > 0 ? aimX : cricket.dirX;
    const hopY = magnitude > 0 ? aimY : cricket.dirY;
    destination = clampToBounds(
      world,
      cricket.x + hopX * jump.fallbackDistance,
      cricket.y + hopY * jump.fallbackDistance,
      CONFIG.cricket.radius,
    );
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

          const next = clampToBounds(
            world,
            cricket.x + nx * CONFIG.cricket.speed * dt,
            cricket.y + ny * CONFIG.cricket.speed * dt,
            CONFIG.cricket.radius,
          );
          cricket.x = next.x;
          cricket.y = next.y;
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
