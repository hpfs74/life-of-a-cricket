import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createCamera, updateCamera, cameraLimit } from '../src/camera.js';

const world = { width: 2880, height: 600, top: 168, cover: [] };
const VIEW = CONFIG.view.width;

/** Runs the camera to rest so the steady-state position can be asserted. */
function settle(camera, target) {
  for (let i = 0; i < 600; i += 1) updateCamera(camera, target, world, 1 / 60);
  return camera.x;
}

test('the camera centres on the cricket once it has caught up', () => {
  const camera = createCamera(world, { x: 1400, y: 300 });
  assert.ok(Math.abs(settle(camera, { x: 1400 }) - (1400 - VIEW / 2)) < 0.5);
});

test('the camera never scrolls past the left edge of the meadow', () => {
  const camera = createCamera(world, { x: 1400, y: 300 });
  assert.equal(settle(camera, { x: 20 }), 0);
});

test('the camera never scrolls past the right edge of the meadow', () => {
  const camera = createCamera(world, { x: 100, y: 300 });
  assert.equal(settle(camera, { x: world.width - 20 }), world.width - VIEW);
});

test('a world no wider than the view does not scroll at all', () => {
  const narrow = { width: VIEW, height: 600, top: 168, cover: [] };
  const camera = createCamera(narrow, { x: 0, y: 300 });
  for (let i = 0; i < 100; i += 1) updateCamera(camera, { x: VIEW }, narrow, 1 / 60);
  assert.equal(camera.x, 0);
  assert.equal(cameraLimit(narrow), 0);
});

test('the camera starts already framing the cricket rather than sliding in', () => {
  const camera = createCamera(world, { x: 1400, y: 300 });
  assert.ok(Math.abs(camera.x - (1400 - VIEW / 2)) < 0.5, 'camera should not need to catch up on frame one');
});

test('the camera eases toward the target instead of snapping', () => {
  const camera = createCamera(world, { x: 500, y: 300 });
  const before = camera.x;
  updateCamera(camera, { x: 2000 }, world, 1 / 60);

  assert.ok(camera.x > before, 'it should move toward the target');
  assert.ok(camera.x < 2000 - VIEW / 2, 'but must not arrive in a single frame');
});

test('cameraLimit reports the furthest the camera may scroll', () => {
  assert.equal(cameraLimit(world), world.width - VIEW);
});
