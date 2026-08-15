import { CONFIG } from '../config.js';

function meter(ctx, x, y, width, height, fill, color, label) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, Math.min(1, fill)) * width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width + 10, y + height / 2);
}

export function drawHud(ctx, game) {
  // The HUD lives in view space: it does not scroll with the meadow.
  const width = CONFIG.view.width;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(Math.floor(game.score.points)), 22, 20);

  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`BEST ${game.score.highScore}`, 22, 56);

  meter(ctx, 22, 82, 160, 10, game.attention.value, '#ff6b5e', 'attention');
  meter(ctx, 22, 100, 160, 10, game.score.fed / CONFIG.score.fedSeconds, '#7fd36a', 'fed');

  // The day counter sits dead centre at the top: it is the run's headline stat.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${game.night ? '\u263e' : '\u2600'}  Day ${game.day}`, width / 2, 18);

  if (game.shiftedFor > 0) {
    // Fade the caption out so a new day reads as an event, not a glitch.
    const fade = Math.min(1, game.shiftedFor / 1.2);
    ctx.fillStyle = `rgba(190, 226, 255, ${fade})`;
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('the meadow has shifted', width / 2, 50);
  } else if (game.score.multiplier > CONFIG.score.multiplierStart + 0.001) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '700 20px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`x${game.score.multiplier.toFixed(1)}`, width / 2, 48);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('♥'.repeat(Math.max(0, game.lives)), width - 22, 22);

}

function panel(ctx, game, lines) {
  const { width, height } = CONFIG.view;

  ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalHeight = lines.reduce((sum, line) => sum + (line.gap ?? 34), 0);
  let y = height / 2 - totalHeight / 2;

  for (const line of lines) {
    ctx.fillStyle = line.color ?? '#ffffff';
    ctx.font = line.font ?? '600 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(line.text, width / 2, y);
    y += line.gap ?? 34;
  }
}

const CREDIT_LINES = [
  { text: 'Game design', color: 'rgba(255, 255, 255, 0.55)', font: '600 13px ui-sans-serif, system-ui, sans-serif' },
  { text: 'Anna Teresa Salvestrini', color: '#ffe9a8', font: '700 22px ui-sans-serif, system-ui, sans-serif' },
  { text: '\u00b7', color: 'rgba(255, 255, 255, 0.35)', font: '600 16px ui-sans-serif, system-ui, sans-serif' },
  { text: 'Life of a Cricket', color: 'rgba(255, 255, 255, 0.8)', font: '600 16px ui-sans-serif, system-ui, sans-serif' },
  { text: 'No engine, no assets \u2014 every pixel and every sound made from code', color: 'rgba(255, 255, 255, 0.5)', font: '600 13px ui-sans-serif, system-ui, sans-serif' },
  { text: '\u00b7', color: 'rgba(255, 255, 255, 0.35)', font: '600 16px ui-sans-serif, system-ui, sans-serif' },
];

const CREDIT_LINE_HEIGHT = 34;
const CREDIT_SCROLL_SPEED = 26;
const CREDIT_BAND_HEIGHT = 118;

/**
 * A credits roll on the title screen: the block scrolls up through a band at
 * the bottom of the page and wraps around forever.
 *
 * Each line is drawn twice, one loop-length apart, so the seam is never visible
 * however long the menu sits open.
 */
function drawCreditsRoll(ctx, time) {
  const { width, height } = CONFIG.view;
  const bandTop = height - CREDIT_BAND_HEIGHT - 18;
  const loop = CREDIT_LINES.length * CREDIT_LINE_HEIGHT;
  const scroll = ((time * CREDIT_SCROLL_SPEED) % loop + loop) % loop;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bandTop, width, CREDIT_BAND_HEIGHT);
  ctx.clip();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  CREDIT_LINES.forEach((line, index) => {
    const base = bandTop + CREDIT_BAND_HEIGHT + index * CREDIT_LINE_HEIGHT - scroll;

    for (const y of [base, base + loop]) {
      if (y < bandTop - CREDIT_LINE_HEIGHT || y > bandTop + CREDIT_BAND_HEIGHT + CREDIT_LINE_HEIGHT) continue;

      // Fade toward both edges of the band so lines slide in and out softly.
      const distance = Math.abs(y - (bandTop + CREDIT_BAND_HEIGHT / 2));
      const fade = Math.max(0, 1 - distance / (CREDIT_BAND_HEIGHT / 2));

      ctx.globalAlpha = fade;
      ctx.fillStyle = line.color;
      ctx.font = line.font;
      ctx.fillText(line.text, width / 2, y);
    }
  });

  ctx.restore();
}

export function drawOverlay(ctx, game, time = 0) {
  if (game.phase === 'MENU') {
    panel(ctx, game, [
      { text: 'Life of a Cricket', font: '700 48px ui-sans-serif, system-ui, sans-serif', gap: 62 },
      { text: 'Move with WASD or the arrow keys. Hold SPACE to sing.', color: 'rgba(255,255,255,0.85)' },
      { text: 'Singing scores — and it is loud. Birds come for the noise.', color: 'rgba(255,255,255,0.85)' },
      { text: 'Hide in grass, rocks and leaves. Cover only saves you if you stay quiet.', color: 'rgba(255,255,255,0.85)', gap: 56 },
      { text: 'Press ENTER to begin', color: '#ffe9a8', font: '700 22px ui-sans-serif, system-ui, sans-serif' },
    ]);
    drawCreditsRoll(ctx, time);
    return;
  }

  if (game.phase === 'GAME_OVER') {
    panel(ctx, game, [
      { text: 'Caught', font: '700 46px ui-sans-serif, system-ui, sans-serif', gap: 58 },
      { text: `Score ${Math.floor(game.score.points)}`, font: '700 26px ui-sans-serif, system-ui, sans-serif' },
      {
        text: game.newRecord ? 'A new best!' : `Best ${game.score.highScore}`,
        color: game.newRecord ? '#ffe9a8' : 'rgba(255,255,255,0.75)',
        gap: 56,
      },
      { text: 'Press ENTER to sing again', color: '#ffe9a8', font: '700 20px ui-sans-serif, system-ui, sans-serif' },
    ]);
  }
}
