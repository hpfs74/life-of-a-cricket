import { CONFIG } from '../config.js';
import { darknessAt, phaseOfDay } from '../daylight.js';

/** The sky is the clock: it cycles from noon through midnight and back. */
function skyStops(darkness) {
  const lerp = (a, b) => Math.round(a + (b - a) * darkness);

  return {
    top: `rgb(${lerp(122, 10)}, ${lerp(170, 14)}, ${lerp(210, 34)})`,
    bottom: `rgb(${lerp(246, 38)}, ${lerp(203, 33)}, ${lerp(150, 62)})`,
  };
}

/**
 * Stars fade in as it darkens. Positions are hashed off the index so the
 * constellation is the same every night without storing anything.
 */
function drawStars(ctx, width, horizon, darkness, time) {
  const alpha = Math.max(0, darkness * 1.5 - 0.35);
  if (alpha <= 0) return;

  for (let i = 0; i < 70; i += 1) {
    const hx = Math.sin(i * 78.233) * 43758.5453;
    const hy = Math.sin(i * 12.9898) * 24634.6345;
    const x = (hx - Math.floor(hx)) * width;
    const y = (hy - Math.floor(hy)) * horizon * 0.92;
    const twinkle = 0.6 + Math.sin(time * 1.7 + i) * 0.4;

    ctx.fillStyle = `rgba(255, 253, 235, ${alpha * twinkle})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

/** One body crosses the sky each day: the sun, then the moon opposite it. */
function drawCelestialBody(ctx, width, horizon, phase) {
  const x = width * (0.12 + 0.76 * phase);
  const swing = Math.cos(phase * Math.PI * 2) * horizon * 0.4;
  const sunY = horizon * 0.62 - swing;
  const moonY = horizon * 0.62 + swing;

  if (sunY < horizon) {
    const glow = ctx.createRadialGradient(x, sunY, 4, x, sunY, 68);
    glow.addColorStop(0, 'rgba(255, 236, 170, 0.85)');
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, sunY, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff2c4';
    ctx.beginPath();
    ctx.arc(x, sunY, 20, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (moonY < horizon) {
    ctx.fillStyle = 'rgba(226, 232, 245, 0.95)';
    ctx.beginPath();
    ctx.arc(x, moonY, 17, 0, Math.PI * 2);
    ctx.fill();

    // A bite out of the disc makes a crescent without a second gradient.
    ctx.fillStyle = 'rgba(10, 14, 34, 0.92)';
    ctx.beginPath();
    ctx.arc(x + 8, moonY - 5, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Water, drawn as one merged shape rather than a string of visible discs: the
 * circles are filled onto the same path so their overlaps disappear.
 */
export function drawWater(ctx, world, time, darkness, visibleFrom, visibleTo) {
  const inView = world.water.filter(
    (c) => c.x + c.radius >= visibleFrom && c.x - c.radius <= visibleTo,
  );
  if (inView.length === 0) return;

  const dim = 1 - darkness * 0.55;
  const path = (grow) => {
    ctx.beginPath();
    for (const c of inView) {
      ctx.moveTo(c.x + c.radius + grow, c.y);
      ctx.ellipse(c.x, c.y, c.radius + grow, (c.radius + grow) * 0.72, 0, 0, Math.PI * 2);
    }
  };

  // A damp margin where the ground meets the water.
  ctx.fillStyle = `rgba(${Math.round(74 * dim)}, ${Math.round(84 * dim)}, ${Math.round(62 * dim)}, 0.55)`;
  path(6);
  ctx.fill();

  ctx.fillStyle = `rgba(${Math.round(46 * dim)}, ${Math.round(96 * dim)}, ${Math.round(134 * dim)}, 0.92)`;
  path(0);
  ctx.fill();

  // Shimmer: short highlights that drift along the surface.
  ctx.save();
  path(-4);
  ctx.clip();
  ctx.strokeStyle = `rgba(198, 232, 255, ${0.14 + (1 - darkness) * 0.16})`;
  ctx.lineWidth = 2;
  for (const c of inView) {
    for (let i = 0; i < 2; i += 1) {
      const drift = Math.sin(time * 0.9 + c.x * 0.03 + i * 2.1) * c.radius * 0.4;
      const y = c.y + (i - 0.5) * c.radius * 0.5;
      ctx.beginPath();
      ctx.moveTo(c.x - c.radius * 0.45 + drift, y);
      ctx.lineTo(c.x + c.radius * 0.3 + drift, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCover(ctx, item, time) {
  const sway = Math.sin(time * 1.4 + item.x * 0.02) * 3;

  if (item.type === 'rock') {
    ctx.fillStyle = 'rgba(78, 84, 92, 0.95)';
    ctx.beginPath();
    ctx.ellipse(item.x, item.y, item.radius, item.radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(120, 128, 138, 0.6)';
    ctx.beginPath();
    ctx.ellipse(
      item.x - item.radius * 0.25, item.y - item.radius * 0.22,
      item.radius * 0.45, item.radius * 0.28, -0.4, 0, Math.PI * 2,
    );
    ctx.fill();
    return;
  }

  if (item.type === 'leaf') {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.sin(time * 0.8 + item.y * 0.01) * 0.12);
    ctx.fillStyle = 'rgba(96, 128, 58, 0.92)';
    ctx.beginPath();
    ctx.ellipse(0, 0, item.radius, item.radius * 0.55, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 82, 34, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-item.radius * 0.8, -item.radius * 0.3);
    ctx.lineTo(item.radius * 0.8, item.radius * 0.3);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Grass tuft: a fan of blades that sways as one clump.
  ctx.strokeStyle = 'rgba(64, 106, 48, 0.95)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (let i = 0; i < 11; i += 1) {
    const spread = (i / 10 - 0.5) * item.radius * 1.9;
    const height = item.radius * (0.9 + Math.sin(i * 2.3) * 0.28);
    ctx.beginPath();
    ctx.moveTo(item.x + spread * 0.5, item.y + item.radius * 0.4);
    ctx.quadraticCurveTo(
      item.x + spread * 0.8 + sway,
      item.y - height * 0.4,
      item.x + spread + sway * 1.6,
      item.y - height,
    );
    ctx.stroke();
  }
}

/**
 * The sky is drawn in view space, not world space, so it stays put while the
 * ground scrolls underneath. That difference is the parallax.
 */
/** The house at the east end of the meadow: a wall, and a lit doorway to enter. */
function drawDoorway(ctx, game, darkness, visibleTo) {
  const door = game.world.door;
  if (!door || door.x - door.width * 3 > visibleTo) return;

  const { height, top } = game.world;
  const wallLeft = door.x - door.width / 2;

  // The house wall closing off the east end. It runs past the world edge so no
  // gap shows when the camera is hard against the right-hand stop.
  const k = 1 - darkness * 0.5;
  ctx.fillStyle = `rgb(${Math.round(96 * k)}, ${Math.round(80 * k)}, ${Math.round(72 * k)})`;
  ctx.fillRect(wallLeft, top - 40, game.world.width - wallLeft + 200, height - top + 40);

  // The doorway itself, warmly lit from inside.
  const doorTop = door.y - door.height / 2;
  ctx.fillStyle = '#1d140f';
  ctx.beginPath();
  ctx.roundRect(wallLeft, doorTop, door.width * 1.6, door.height, [door.width * 0.4, 0, 0, door.width * 0.4]);
  ctx.fill();

  const glow = ctx.createLinearGradient(wallLeft, 0, wallLeft + door.width * 1.4, 0);
  glow.addColorStop(0, `rgba(255, 214, 140, ${0.5 + darkness * 0.35})`);
  glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.roundRect(wallLeft, doorTop + 6, door.width * 1.5, door.height - 12, [door.width * 0.35, 0, 0, door.width * 0.35]);
  ctx.fill();
}

export function drawSky(ctx, game, time) {
  const horizon = game.world.top;
  const width = CONFIG.view.width;
  const darkness = darknessAt(game.elapsed);
  const sky = skyStops(darkness);

  const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, sky.top);
  gradient.addColorStop(1, sky.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizon);

  drawStars(ctx, width, horizon, darkness, time);
  drawCelestialBody(ctx, width, horizon, phaseOfDay(game.elapsed));
}

/**
 * The ground is drawn in world space, behind the camera transform. Only the
 * slice the camera can see is drawn: the meadow is several screens wide, and
 * stroking every blade of it would be wasted work.
 */
export function drawGround(ctx, game, time, cameraX = 0) {
  const { width, height, top: horizon } = game.world;
  const darkness = darknessAt(game.elapsed);
  const visibleFrom = cameraX - 40;
  const visibleTo = cameraX + CONFIG.view.width + 40;

  // The ground dims with the sky, but never to pure black: the player still
  // has to read cover and food at midnight.
  const dim = (r, g, b) => {
    const k = 1 - darkness * 0.62;
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
  };

  const ground = ctx.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, dim(63, 90, 52));
  ground.addColorStop(1, dim(34, 51, 31));
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Two pale layers of grass along the horizon read as depth. Blade height and
  // lean are hashed off x so the fringe looks grown rather than combed.
  ctx.lineCap = 'round';

  for (const layer of [
    { color: 'rgba(104, 132, 82, 0.5)', step: 7, lineWidth: 3, scale: 0.7, lift: 4 },
    { color: 'rgba(138, 170, 104, 0.62)', step: 9, lineWidth: 4, scale: 1, lift: 12 },
  ]) {
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.lineWidth;

    const start = Math.floor(visibleFrom / layer.step) * layer.step;
    for (let x = start; x < visibleTo; x += layer.step) {
      const hash = Math.sin(x * 12.9898) * 43758.5453;
      const jitter = hash - Math.floor(hash);
      const height = (14 + jitter * 26) * layer.scale;
      const lean = (jitter - 0.5) * 14 + Math.sin(time * 1.1 + x * 0.05) * 4;

      ctx.beginPath();
      ctx.moveTo(x, horizon + layer.lift);
      ctx.quadraticCurveTo(x + lean * 0.4, horizon - height * 0.5, x + lean, horizon - height);
      ctx.stroke();
    }
  }

  drawWater(ctx, game.world, time, darkness, visibleFrom, visibleTo);

  drawDoorway(ctx, game, darkness, visibleTo);

  for (const item of game.world.cover) {
    if (item.x + item.radius < visibleFrom || item.x - item.radius > visibleTo) continue;
    drawCover(ctx, item, time);
  }
}
