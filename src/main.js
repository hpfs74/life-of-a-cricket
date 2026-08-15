import { CONFIG } from './config.js';
import { createGame, startRun, updateGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawBackground } from './render/background.js';
import { drawEntities } from './render/entities.js';
import { drawHud, drawOverlay } from './render/hud.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const game = createGame({ storage: window.localStorage, rng: Math.random });
const input = createInput(window);
const audio = createAudio();

input.attach();

// The simulation always runs in CONFIG.world units; this transform letterboxes
// that fixed world into whatever canvas the device gives us.
const view = { scale: 1, offsetX: 0, offsetY: 0 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const scale = Math.min(cssWidth / CONFIG.world.width, cssHeight / CONFIG.world.height);
  view.scale = scale;
  view.offsetX = (cssWidth - CONFIG.world.width * scale) / 2;
  view.offsetY = (cssHeight - CONFIG.world.height * scale) / 2;
}

window.addEventListener('resize', resize);
resize();

// Touch: dragging anywhere steers, and holding still sings, so the game is
// playable on a phone without a keyboard.
let touchOrigin = null;

function touchIntent(touch) {
  const dx = touch.clientX - touchOrigin.x;
  const dy = touch.clientY - touchOrigin.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 14) {
    input.intent.dx = 0;
    input.intent.dy = 0;
    input.intent.sing = true;
    return;
  }

  input.intent.sing = false;
  input.intent.dx = dx / distance;
  input.intent.dy = dy / distance;
}

canvas.addEventListener('touchstart', (event) => {
  event.preventDefault();
  audio.unlock();

  if (game.phase !== 'PLAYING') {
    startRun(game);
    return;
  }

  const touch = event.touches[0];
  touchOrigin = { x: touch.clientX, y: touch.clientY };
  touchIntent(touch);
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
  event.preventDefault();
  if (touchOrigin) touchIntent(event.touches[0]);
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
  event.preventDefault();
  touchOrigin = null;
  input.intent.dx = 0;
  input.intent.dy = 0;
  input.intent.sing = false;
}, { passive: false });

window.addEventListener('keydown', () => audio.unlock(), { once: true });

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;
  const time = now / 1000;

  if (input.consumeStartRequest() && game.phase !== 'PLAYING') {
    startRun(game);
    // Swallow the keypress so the same press does not start a song immediately.
    input.intent.sing = false;
  }

  for (const event of updateGame(game, input.intent, dt)) {
    audio.play(event.type);
  }

  audio.setSinging(game.phase === 'PLAYING' && game.cricket.singing, game.score.multiplier);

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  drawBackground(ctx, game, time);
  if (game.phase !== 'MENU') {
    drawEntities(ctx, game, time);
    drawHud(ctx, game);
  }
  drawOverlay(ctx, game);

  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
