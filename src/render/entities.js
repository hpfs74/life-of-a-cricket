import { CONFIG } from '../config.js';

const FOOD_COLORS = {
  seed: '#d8c07a',
  berry: '#c4426a',
  aphid: '#8fd36a',
  lettuce: '#b6dd7c',
};

/** Lettuce is a ruffled rosette rather than a berry-like blob, so it reads apart. */
function drawLettuce(ctx, item, bob) {
  const cx = item.x;
  const cy = item.y + bob;

  ctx.fillStyle = '#8cbb5a';
  ctx.beginPath();
  ctx.arc(cx, cy, item.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = FOOD_COLORS.lettuce;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(angle) * item.radius * 0.42,
      cy + Math.sin(angle) * item.radius * 0.42,
      item.radius * 0.52, item.radius * 0.38, angle, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.fillStyle = '#d8efab';
  ctx.beginPath();
  ctx.arc(cx, cy, item.radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFood(ctx, item) {
  const bob = Math.sin(item.age * 3) * 1.5;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + item.radius * 0.9, item.radius * 0.9, item.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  if (item.type === 'lettuce') {
    drawLettuce(ctx, item, bob);
    return;
  }

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
  const arc = CONFIG.cricket.jump.arcHeight;
  // A sine arc over the leap: nothing else on a flat field sells height.
  const lift = cricket.jumping ? Math.sin(cricket.jumpProgress * Math.PI) * arc : 0;

  // The shadow stays on the ground and shrinks as the cricket rises, which is
  // what tells the player it is airborne rather than just moving fast.
  const shrink = 1 - (lift / arc) * 0.55;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.32 * shrink})`;
  ctx.beginPath();
  ctx.ellipse(cricket.x, cricket.y + r * 0.9, r * 1.1 * shrink, r * 0.4 * shrink, 0, 0, Math.PI * 2);
  ctx.fill();

  if (cricket.jumpCooldown > 0 && !cricket.jumping) {
    // A closing ring shows when the next leap is ready.
    const remaining = cricket.jumpCooldown / CONFIG.cricket.jump.cooldownSeconds;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cricket.x, cricket.y, r * 1.9, -Math.PI / 2, -Math.PI / 2 + (1 - remaining) * Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(cricket.x, cricket.y - hop - lift);
  ctx.rotate(angle);
  ctx.globalAlpha = game.hidden ? 0.4 : 1;

  // Hind legs: bent, kicking when the cricket sings and thrown back mid-leap.
  const kick = cricket.jumping ? 0.55 : (cricket.singing ? Math.sin(time * 40) * 0.35 : 0);
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

/** A bat: scalloped wings and a notched trailing edge, unmistakable in silhouette. */
function drawBatShape(ctx, size, flap) {
  const span = size * (1.15 - flap * 0.35);

  ctx.beginPath();
  ctx.moveTo(size * 0.55, 0);
  ctx.quadraticCurveTo(size * 0.1, -span * 0.75, -size * 0.35, -span);
  ctx.quadraticCurveTo(-size * 0.3, -span * 0.42, -size * 0.62, -span * 0.5);
  ctx.quadraticCurveTo(-size * 0.5, -span * 0.16, -size * 0.85, 0);
  ctx.quadraticCurveTo(-size * 0.5, span * 0.16, -size * 0.62, span * 0.5);
  ctx.quadraticCurveTo(-size * 0.3, span * 0.42, -size * 0.35, span);
  ctx.quadraticCurveTo(size * 0.1, span * 0.75, size * 0.55, 0);
  ctx.closePath();
  ctx.fill();

  // Ears.
  ctx.beginPath();
  ctx.moveTo(size * 0.35, -size * 0.18);
  ctx.lineTo(size * 0.62, -size * 0.5);
  ctx.lineTo(size * 0.66, -size * 0.12);
  ctx.closePath();
  ctx.moveTo(size * 0.35, size * 0.18);
  ctx.lineTo(size * 0.62, size * 0.5);
  ctx.lineTo(size * 0.66, size * 0.12);
  ctx.closePath();
  ctx.fill();
}

function drawBirdShape(ctx, size, flap) {
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.35, -size * (0.34 + flap * 0.4));
  ctx.lineTo(-size * 0.9, -size * 0.12);
  ctx.lineTo(-size * 1.25, 0);
  ctx.lineTo(-size * 0.9, size * 0.12);
  ctx.lineTo(-size * 0.35, size * (0.34 + flap * 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawBird(ctx, bird, game, time) {
  const diving = bird.state === 'DIVE';
  const isBat = bird.kind === 'bat';
  const angle = Math.atan2(bird.vy, bird.vx);
  const base = CONFIG.bird.kinds[bird.kind]?.size ?? CONFIG.bird.kinds.bird.size;
  const size = diving ? base * 1.18 : base;

  // Ground shadow: the player's warning that something is overhead.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(bird.x, Math.min(bird.y + 46, game.world.height - 4), size * 0.9, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(angle);

  // Bats beat their wings far faster and more erratically than birds.
  const rate = isBat ? (diving ? 30 : 17) : (diving ? 22 : 9);
  const flap = Math.sin(time * rate) * (diving ? 0.25 : 0.75);

  ctx.fillStyle = diving ? '#12161d' : '#1d222c';
  if (isBat) drawBatShape(ctx, size, flap);
  else drawBirdShape(ctx, size, flap);

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
