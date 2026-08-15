import { CONFIG } from './config.js';

/** The furthest left-edge position the camera may take without showing past the meadow. */
export function cameraLimit(world) {
  return Math.max(0, world.width - CONFIG.view.width);
}

function framed(world, targetX) {
  return Math.min(cameraLimit(world), Math.max(0, targetX - CONFIG.view.width / 2));
}

/**
 * A horizontal camera. The meadow is wider than the window, so the view slides
 * sideways to keep the cricket centred, stopping at either end of the world.
 *
 * It starts already framing the cricket: a run should open on the player, not
 * slide across to find them.
 */
export function createCamera(world, target) {
  return { x: framed(world, target.x), y: 0 };
}

/**
 * Eases toward the framing position. The exponential form makes the follow rate
 * independent of frame rate, so the camera feels the same on any display.
 */
export function updateCamera(camera, target, world, dt) {
  const desired = framed(world, target.x);
  const catchUp = 1 - Math.exp(-CONFIG.view.followPerSecond * dt);

  camera.x += (desired - camera.x) * catchUp;

  // Settle exactly, so a resting camera cannot drift by a fraction of a pixel.
  if (Math.abs(desired - camera.x) < 0.01) camera.x = desired;

  return camera;
}
