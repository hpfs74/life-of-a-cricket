import { CONFIG } from '../config.js';

const FOOD_COLORS = {
  seed: '#d8c07a',
  berry: '#c4426a',
  aphid: '#8fd36a',
  lettuce: '#b6dd7c',
  grub: '#e8cdb0',
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

/** A grub: pale and segmented, so a hard-won drop does not look like a seed. */
function drawGrub(ctx, item, bob) {
  const cx = item.x;
  const cy = item.y + bob;

  ctx.fillStyle = FOOD_COLORS.grub;
  ctx.beginPath();
  ctx.ellipse(cx, cy, item.radius * 1.35, item.radius * 0.8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(176, 140, 112, 0.8)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.ellipse(cx + i * item.radius * 0.5, cy, item.radius * 0.24, item.radius * 0.7, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFood(ctx, item) {
  const bob = Math.sin(item.age * 3) * 1.5;

  // A fresh drop glints while it settles, so the player sees it land.
  if ((item.settleFor ?? 0) > 0) {
    ctx.strokeStyle = `rgba(255, 245, 200, ${item.settleFor / CONFIG.food.dropSettleSeconds})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius + 8 + (1 - item.settleFor / CONFIG.food.dropSettleSeconds) * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + item.radius * 0.9, item.radius * 0.9, item.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  if (item.type === 'lettuce') {
    drawLettuce(ctx, item, bob);
    return;
  }

  if (item.type === 'grub') {
    drawGrub(ctx, item, bob);
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

  if (cricket.swingFor > 0) {
    // A bright arc sweeping the cone the strike actually covers.
    const progress = 1 - cricket.swingFor / CONFIG.cricket.strike.swingSeconds;
    const facing = Math.atan2(cricket.dirY, cricket.dirX);
    const half = (CONFIG.cricket.strike.halfAngleDegrees * Math.PI) / 180;

    ctx.strokeStyle = `rgba(255, 246, 214, ${0.85 * (1 - progress)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cricket.x, cricket.y, CONFIG.cricket.strike.reach, facing - half, facing + half);
    ctx.stroke();
  }

  if (cricket.stunnedFor > 0) {
    // Stars, so a frozen cricket reads as stunned rather than as a hung game.
    for (let i = 0; i < 3; i += 1) {
      const angle = time * 6 + (i / 3) * Math.PI * 2;
      ctx.fillStyle = 'rgba(255, 232, 150, 0.9)';
      ctx.beginPath();
      ctx.arc(cricket.x + Math.cos(angle) * 15, cricket.y - 24 + Math.sin(angle) * 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

const RIVAL_COLORS = {
  ant: { body: '#4a3428', shine: '#6d4d3a' },
  beetle: { body: '#2f3a44', shine: '#59707f' },
};

/** Ants and beetles: small, busy, and after the same food as the cricket. */
function drawRival(ctx, rival, time) {
  const r = CONFIG.rivals.radius;
  const palette = RIVAL_COLORS[rival.kind] ?? RIVAL_COLORS.ant;
  const scuttle = rival.nibbleFor > 0 ? 0 : Math.sin(time * 18 + rival.phase);

  ctx.save();
  ctx.translate(rival.x, rival.y);
  ctx.rotate(Math.atan2(rival.dirY, rival.dirX));

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = palette.body;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.4, side * r * 0.35);
      ctx.lineTo(i * r * 0.5 + scuttle * 1.5, side * (r * 1.1));
      ctx.stroke();
    }
  }

  ctx.fillStyle = rival.flashFor > 0 ? '#fff0f0' : palette.body;
  if (rival.kind === 'beetle') {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.shine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(r * 0.8, 0);
    ctx.stroke();
  } else {
    for (const [ox, rx] of [[-r * 0.85, r * 0.5], [0, r * 0.34], [r * 0.75, r * 0.42]]) {
      ctx.beginPath();
      ctx.ellipse(ox, 0, rx, rx * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Web strands across the mouth of an occupied tuft. Drawn beneath everything so
 * the cover looks spun-in rather than decorated.
 */
function drawSpiderTell(ctx, spider) {
  const r = spider.cover.radius;

  ctx.strokeStyle = `rgba(214, 226, 240, ${0.14 + spider.alertness * 0.26})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(spider.homeX, spider.homeY);
    ctx.lineTo(spider.homeX + Math.cos(angle) * r * 0.85, spider.homeY + Math.sin(angle) * r * 0.6);
    ctx.stroke();
  }
}

function drawSpider(ctx, spider, time) {
  const winding = spider.state === 'WINDUP';
  const lunging = spider.state === 'LUNGE';

  // It tenses visibly before it commits: that crouch is the reaction window.
  const crouch = winding ? 1 - Math.min(1, spider.stateTime / CONFIG.spiders.windUpSeconds) * 0.35 : 1;
  const body = (lunging ? 8.5 : 7) * crouch;
  const reach = lunging ? 17 : 13 * crouch;
  const skitter = lunging ? 0 : Math.sin(time * 5 + spider.homeY) * 0.12;

  ctx.save();
  ctx.translate(spider.x, spider.y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, body * 0.9, body * 1.1, body * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = winding || lunging ? '#241a20' : '#2c2028';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const spread = (-0.75 + i * 0.5) + skitter * side;
      const knee = reach * 0.62;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(spread) * knee * side, Math.sin(spread) * knee - reach * 0.3);
      ctx.lineTo(Math.cos(spread) * reach * side, Math.sin(spread) * reach + reach * 0.15);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#20161c';
  ctx.beginPath();
  ctx.ellipse(0, 0, body, body * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(body * 0.85, 0, body * 0.5, body * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes last, so the body cannot swallow the one cue the player needs. They
  // are always lit and brighten as the cricket approaches.
  const glow = 0.68 + spider.alertness * 0.32;
  const pulse = 0.85 + Math.sin(time * 3 + spider.homeX) * 0.15;
  ctx.fillStyle = `rgba(255, 226, 128, ${glow * pulse})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(body * 1.05, side * body * 0.3, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Sits above the cricket, so it is drawn in world space with everything else. */
function drawHiddenMarker(ctx, game) {
  if (!game.hidden) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(160, 220, 255, 0.9)';
  ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('hidden', game.cricket.x, game.cricket.y - 42);
}

export function drawEntities(ctx, game, time) {
  // Tells first: they belong to the cover, beneath everything moving.
  for (const spider of game.spiders) drawSpiderTell(ctx, spider);
  for (const item of game.food.items) drawFood(ctx, item);
  for (const spider of game.spiders) drawSpider(ctx, spider, time);
  for (const rival of game.rivals) drawRival(ctx, rival, time);
  drawCricket(ctx, game, time);
  drawHiddenMarker(ctx, game);
  for (const bird of game.birds) drawBird(ctx, bird, game, time);
}
