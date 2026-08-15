import { CONFIG } from './config.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

// The simulation always runs in CONFIG.world units. The canvas is sized to the
// device, and this transform letterboxes the world into it, so gameplay is
// identical at every screen size.
const view = { scale: 1, offsetX: 0, offsetY: 0 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const scale = Math.min(cssWidth / CONFIG.world.width, cssHeight / CONFIG.world.height);
  view.scale = scale;
  view.offsetX = (cssWidth - CONFIG.world.width * scale) / 2;
  view.offsetY = (cssHeight - CONFIG.world.height * scale) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;

  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  // Placeholder until the background renderer lands.
  ctx.fillStyle = '#2b3a2f';
  ctx.fillRect(0, 0, CONFIG.world.width, CONFIG.world.height);

  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// `dt` is computed and clamped every frame even though nothing consumes it yet;
// the simulation gets wired in here once the modules exist.
export { view };
