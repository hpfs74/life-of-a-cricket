import { CONFIG } from './config.js';
import { createGame, startRun, updateGame } from './game.js';
import { createInput } from './input.js';
import { createTouchControls } from './touch.js';
import { createAudio } from './audio.js';
import { createCamera, updateCamera } from './camera.js';
import { drawSky, drawGround } from './render/background.js';
import { drawHouseBackdrop, drawHouseInterior } from './render/house.js';
import { drawEntities } from './render/entities.js';
import { drawHud, drawOverlay } from './render/hud.js';
import { drawTouchControls, drawRotatePrompt } from './render/touchcontrols.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const game = createGame({ storage: window.localStorage, rng: Math.random });
const input = createInput(window);
const touch = createTouchControls(canvas);
const audio = createAudio();
const camera = createCamera(game.world, game.cricket);

input.attach();
touch.attach();

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

  // The view, not the world, is what gets letterboxed: the meadow is wider than
  // the window and scrolls behind it.
  const scale = Math.min(cssWidth / CONFIG.view.width, cssHeight / CONFIG.view.height);
  view.scale = scale;
  view.offsetX = (cssWidth - CONFIG.view.width * scale) / 2;
  view.offsetY = (cssHeight - CONFIG.view.height * scale) / 2;

  // The on-screen controls live in screen space, in the letterbox around the
  // playfield, so they never cover any of it.
  touch.resize(cssWidth, cssHeight);
}

window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'KeyM') audio.toggleMute();
});

canvas.addEventListener('touchstart', () => audio.unlock(), { passive: true });

/** A phone held upright cannot show a world this wide; ask for landscape. */
function isPortrait() {
  const touchCapable = (navigator.maxTouchPoints ?? 0) > 0;
  return touchCapable && window.innerHeight > window.innerWidth;
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;
  const time = now / 1000;

  const portrait = isPortrait();

  const startRequested = input.consumeStartRequest() || touch.consumeStartRequest();
  if (startRequested && game.phase !== 'PLAYING' && !portrait) {
    startRun(game);
    // Swallow the press so the same one does not start a song immediately.
    input.intent.sing = false;
  }

  // Keyboard and touch feed the same simulation: whichever is being used wins,
  // and holding both simply means the action is held.
  const intent = {
    dx: input.intent.dx || touch.intent.dx,
    dy: input.intent.dy || touch.intent.dy,
    sing: input.intent.sing || touch.intent.sing,
    jump: input.intent.jump || touch.intent.jump,
    strike: input.intent.strike || touch.intent.strike,
  };

  // A phone held upright pauses rather than playing on in a letterbox strip.
  for (const event of portrait ? [] : updateGame(game, intent, dt)) {
    audio.play(event.type, event);

    // A doorway swaps the whole world out; re-frame rather than sliding across.
    if (event.type === 'stage-change') {
      camera.x = createCamera(game.world, game.cricket).x;
    }
  }

  audio.setSinging(game.phase === 'PLAYING' && game.cricket.singing, game.score.multiplier);
  audio.update(dt, { night: game.night });
  updateCamera(camera, game.cricket, game.world, dt);

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  // Clip to the view so the scrolling meadow cannot spill into the letterbox.
  ctx.beginPath();
  ctx.rect(0, 0, CONFIG.view.width, CONFIG.view.height);
  ctx.clip();

  const indoors = game.stage === 'house';
  if (indoors) drawHouseBackdrop(ctx, game);
  else drawSky(ctx, game, time);

  // Everything from here to the matching restore is in world space.
  ctx.save();
  ctx.translate(-Math.round(camera.x), 0);
  if (indoors) drawHouseInterior(ctx, game, time, camera.x);
  else drawGround(ctx, game, time, camera.x);
  if (game.phase !== 'MENU') drawEntities(ctx, game, time);
  ctx.restore();

  if (game.phase !== 'MENU') drawHud(ctx, game);
  drawOverlay(ctx, game, time);

  ctx.restore();

  // Controls and the rotate prompt are screen-space, drawn over the letterbox.
  drawTouchControls(ctx, touch);
  if (portrait) drawRotatePrompt(ctx, window.innerWidth, window.innerHeight, time);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
