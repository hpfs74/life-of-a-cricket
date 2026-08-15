import { CONFIG } from './config.js';
import { clampToBounds, isHidden, spawnPoint } from './world.js';

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
  };
}

/**
 * Advances the player one frame.
 *
 * Singing and moving are mutually exclusive by design: holding the sing key
 * only sings while no direction is held, and pressing a direction mid-song
 * cancels it. That is the whole risk/reward core — the player has to commit to
 * a spot to score.
 */
export function updateCricket(cricket, intent, dt, world) {
  const wasSinging = cricket.singing;

  cricket.invulnerableFor = Math.max(0, cricket.invulnerableFor - dt);

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

  return {
    startedSinging: cricket.singing && !wasSinging,
    stoppedSinging: !cricket.singing && wasSinging,
    hidden: isHidden(world, cricket.x, cricket.y),
  };
}
