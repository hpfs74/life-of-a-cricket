import { CONFIG } from './config.js';
import { createGame, startRun, updateGame, showCredits, closeCredits } from './game.js';
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

// Touch: dragging steers, holding still sings, and a quick tap leaps — so the
// game is playable on a phone without a keyboard.
const TAP_MAX_SECONDS = 0.25;
const TAP_MAX_DISTANCE = 14;

let touchOrigin = null;
let touchStartedAt = 0;
let touchTravelled = 0;
let touchJumpFrames = 0;

function touchIntent(touch) {
  const dx = touch.clientX - touchOrigin.x;
  const dy = touch.clientY - touchOrigin.y;
  const distance = Math.hypot(dx, dy);
  touchTravelled = Math.max(touchTravelled, distance);

  if (distance < TAP_MAX_DISTANCE) {
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

  if (game.phase === 'CREDITS') {
    closeCredits(game);
    return;
  }
  if (game.phase !== 'PLAYING') {
    startRun(game);
    return;
  }

  const touch = event.touches[0];
  touchOrigin = { x: touch.clientX, y: touch.clientY };
  touchStartedAt = performance.now();
  touchTravelled = 0;
  touchIntent(touch);
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
  event.preventDefault();
  if (touchOrigin) touchIntent(event.touches[0]);
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
  event.preventDefault();

  const heldSeconds = (performance.now() - touchStartedAt) / 1000;
  if (touchOrigin && heldSeconds < TAP_MAX_SECONDS && touchTravelled < TAP_MAX_DISTANCE) {
    // Hold the pulse for two frames so the cricket's edge detector sees it.
    touchJumpFrames = 2;
  }

  touchOrigin = null;
  input.intent.dx = 0;
  input.intent.dy = 0;
  input.intent.sing = false;
}, { passive: false });

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'KeyM') audio.toggleMute();
});

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;
  const time = now / 1000;

  const startPressed = input.consumeStartRequest();
  const creditsPressed = input.consumeCreditsRequest();
  const backPressed = input.consumeBackRequest();

  if (game.phase === 'CREDITS') {
    if (startPressed || backPressed) closeCredits(game);
  } else if (creditsPressed && game.phase !== 'PLAYING') {
    showCredits(game);
  } else if (startPressed && game.phase !== 'PLAYING') {
    startRun(game);
    // Swallow the keypress so the same press does not start a song immediately.
    input.intent.sing = false;
  }

  // A touch tap and a held SPACE both mean "leap"; either one is enough.
  const intent = touchJumpFrames > 0 ? { ...input.intent, jump: true } : input.intent;
  if (touchJumpFrames > 0) touchJumpFrames -= 1;

  for (const event of updateGame(game, intent, dt)) {
    audio.play(event.type, event);
  }

  audio.setSinging(game.phase === 'PLAYING' && game.cricket.singing, game.score.multiplier);
  audio.update(dt, { night: game.night });

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
