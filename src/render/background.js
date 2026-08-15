import { CONFIG } from '../config.js';

/** Dusk deepens over the run, so the sky doubles as a clock. */
function skyStops(elapsed) {
  const dusk = Math.min(1, elapsed / (CONFIG.game.difficultyRampSeconds * 1.5));
  const lerp = (a, b) => Math.round(a + (b - a) * dusk);

  return {
    top: `rgb(${lerp(122, 30)}, ${lerp(170, 40)}, ${lerp(210, 78)})`,
    bottom: `rgb(${lerp(246, 92)}, ${lerp(203, 62)}, ${lerp(150, 86)})`,
  };
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

export function drawBackground(ctx, game, time) {
  const { width, height } = game.world;
  const horizon = height * 0.28;
  const sky = skyStops(game.elapsed);

  const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, sky.top);
  gradient.addColorStop(1, sky.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizon);

  const ground = ctx.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, '#3f5a34');
  ground.addColorStop(1, '#22331f');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, width, height - horizon);

  // A pale far layer of grass along the horizon reads as depth.
  ctx.strokeStyle = 'rgba(126, 156, 96, 0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let x = -10; x < width + 10; x += 13) {
    const bladeSway = Math.sin(time * 1.1 + x * 0.05) * 5;
    ctx.beginPath();
    ctx.moveTo(x, horizon + 12);
    ctx.quadraticCurveTo(x + bladeSway * 0.5, horizon - 8, x + bladeSway, horizon - 22);
    ctx.stroke();
  }

  for (const item of game.world.cover) drawCover(ctx, item, time);
}
