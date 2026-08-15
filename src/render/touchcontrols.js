import { CONFIG } from '../config.js';

/**
 * The on-screen controls, drawn in screen space rather than world space.
 *
 * That is deliberate: the playfield is letterboxed into a fixed 3:2 window, and
 * the controls deliberately live in the black bars around it, so they never
 * cover any of the meadow.
 */

const LABEL_COLORS = {
  sing: '#ffe9a8',
  jump: '#a8dcff',
  fight: '#ffb4a8',
};

function drawButton(ctx, button, radius, held) {
  const tint = LABEL_COLORS[button.id] ?? '#ffffff';

  ctx.beginPath();
  ctx.arc(button.x, button.y, radius * (held ? 0.92 : 1), 0, Math.PI * 2);
  ctx.fillStyle = held ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = held ? tint : 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();

  ctx.fillStyle = held ? '#1a1f28' : tint;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(radius * 0.92)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(button.label, button.x, button.y + 1);
}

function drawStick(ctx, stick, maxRadius) {
  if (!stick.active) return;

  ctx.beginPath();
  ctx.arc(stick.originX, stick.originY, maxRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(stick.x, stick.y, maxRadius * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fill();
}

export function drawTouchControls(ctx, touch) {
  if (!touch.isActive()) return;

  const layout = touch.layout();

  ctx.save();
  drawStick(ctx, touch.stick, layout.stickMaxRadius);
  for (const button of layout.buttons) {
    drawButton(ctx, button, layout.radius, touch.pressed.has(button.id));
  }
  ctx.restore();
}

/**
 * Shown when a phone is held upright. The meadow is three screens wide and the
 * house is a cutaway; both need the width to be readable at all, so the game
 * pauses rather than squeezing into a strip.
 */
export function drawRotatePrompt(ctx, width, height, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const tilt = Math.sin(time * 1.4) * 0.22;

  // A phone turning on its side.
  ctx.save();
  ctx.translate(cx, cy - 40);
  ctx.rotate(tilt);
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-34, -56, 68, 112, 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 233, 168, 0.25)';
  ctx.beginPath();
  ctx.roundRect(-27, -44, 54, 88, 6);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Turn your phone sideways', cx, cy + 70);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('The meadow is wider than it is tall', cx, cy + 102);

  ctx.restore();
}
