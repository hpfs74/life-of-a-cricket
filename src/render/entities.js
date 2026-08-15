import { CONFIG } from '../config.js';

const FOOD_COLORS = {
  seed: '#d8c07a',
  berry: '#c4426a',
  aphid: '#8fd36a',
};

function drawFood(ctx, item) {
  const bob = Math.sin(item.age * 3) * 1.5;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + item.radius * 0.9, item.radius * 0.9, item.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = FOOD_COLORS[item.type] ?? '#ffffff';
  ctx.beginPath();
  ctx.arc(item.x, item.y + bob, item.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(item.x - item.radius * 0.3, item.y + bob - item.radius * 0.3, item.radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawSongRings(ctx, cricket, game, time) {
  const strength = Math.min(1, game.score.multiplier / CONFIG.score.multiplierMax);

  for (let i = 0; i < 3; i += 1) {
    const phase = (time * 1.6 + i / 3) % 1;
    const radius = 18 + phase * (70 + strength * 60);

    ctx.strokeStyle = `rgba(255, 244, 190, ${(1 - phase) * 0.55})`;
    ctx.lineWidth = 2 + strength * 2;
    ctx.beginPath();
    ctx.arc(cricket.x, cricket.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCricket(ctx, game, time) {
  const cricket = game.cricket;
  const r = CONFIG.cricket.radius;
  const blinking = cricket.invulnerableFor > 0 && Math.floor(time * 12) % 2 === 0;
  if (blinking) return;

  const angle = Math.atan2(cricket.dirY, cricket.dirX);
  const hop = cricket.moving ? Math.abs(Math.sin(time * 14)) * 3 : 0;

  ctx.save();
  ctx.translate(cricket.x, cricket.y - hop);
  ctx.rotate(angle);
  ctx.globalAlpha = game.hidden ? 0.4 : 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.9 + hop, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hind legs: bent, and they kick when the cricket sings.
  const kick = cricket.singing ? Math.sin(time * 40) * 0.35 : 0;
  ctx.strokeStyle = '#4c6b2f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, side * r * 0.5);
    ctx.lineTo(-r * 0.9, side * (r * 1.1 + kick * r));
    ctx.lineTo(-r * 0.2, side * (r * 1.5 + kick * r));
    ctx.stroke();
  }

  ctx.fillStyle = '#6d8f3c';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#587a30';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, 0, r * 0.85, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7fa348';
  ctx.beginPath();
  ctx.arc(r * 0.95, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c2416';
  ctx.beginPath();
  ctx.arc(r * 1.15, -r * 0.22, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 1.15, r * 0.22, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Antennae trail behind the direction of travel.
  ctx.strokeStyle = '#2f3d22';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(r * 1.2, side * r * 0.25);
    ctx.quadraticCurveTo(
      r * 2.1,
      side * r * (0.7 + Math.sin(time * 6 + side) * 0.2),
      r * 2.7,
      side * r * (1.1 + Math.sin(time * 6 + side) * 0.3),
    );
    ctx.stroke();
  }

  ctx.restore();

  if (cricket.singing) drawSongRings(ctx, cricket, game, time);
}

function drawBird(ctx, bird, game, time) {
  const diving = bird.state === 'DIVE';
  const angle = Math.atan2(bird.vy, bird.vx);
  const size = diving ? 26 : 22;

  // Ground shadow: the player's warning that something is overhead.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(bird.x, Math.min(bird.y + 46, game.world.height - 4), size * 0.9, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(angle);

  const flap = Math.sin(time * (diving ? 22 : 9)) * (diving ? 0.25 : 0.75);

  ctx.fillStyle = diving ? '#12161d' : '#1d222c';
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.35, -size * (0.34 + flap * 0.4));
  ctx.lineTo(-size * 0.9, -size * 0.12);
  ctx.lineTo(-size * 1.25, 0);
  ctx.lineTo(-size * 0.9, size * 0.12);
  ctx.lineTo(-size * 0.35, size * (0.34 + flap * 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  if (bird.state === 'CIRCLE') {
    // A pulsing marker over the circling bird tells the player where the threat is.
    const pulse = 0.5 + Math.sin(time * 6) * 0.5;
    ctx.strokeStyle = `rgba(255, 96, 96, ${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, size * 1.6 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawEntities(ctx, game, time) {
  for (const item of game.food.items) drawFood(ctx, item);
  drawCricket(ctx, game, time);
  for (const bird of game.birds) drawBird(ctx, bird, game, time);
}
