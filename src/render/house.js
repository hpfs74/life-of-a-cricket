import { CONFIG } from '../config.js';
import { darknessAt } from '../daylight.js';
import { drawWater } from './background.js';

/**
 * The house, drawn in cross-section like a dollhouse: both floors on screen at
 * once with the stairwell joining them.
 *
 * Everything here is world-space and scrolls with the camera. Only the slice
 * the camera can see is drawn — the house is several screens wide.
 */

const FURNITURE_COLORS = {
  sofa: { body: '#7a4a52', trim: '#93606a' },
  chair: { body: '#8a6237', trim: '#a3763f' },
  table: { body: '#7d5734', trim: '#996b41' },
  plant: { body: '#3f6b39', trim: '#4f8446' },
  box: { body: '#8a7448', trim: '#a08a58' },
  bed: { body: '#5d6688', trim: '#77809f' },
};

/** Interior light: warm by day, lamplit and dim at night, never pitch black. */
function lighting(elapsed) {
  const darkness = darknessAt(elapsed);
  return { darkness, dim: 1 - darkness * 0.5 };
}

function shade(hex, dim) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * dim);
  const g = Math.round(((n >> 8) & 255) * dim);
  const b = Math.round((n & 255) * dim);
  return `rgb(${r}, ${g}, ${b})`;
}

/** A backdrop behind the house, drawn in view space so it does not scroll. */
export function drawHouseBackdrop(ctx, game) {
  const { width, height } = CONFIG.view;
  const { darkness } = lighting(game.elapsed);

  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, shade('#2a2230', 1 - darkness * 0.4));
  wall.addColorStop(1, shade('#1a1620', 1 - darkness * 0.4));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);
}

function drawFurniture(ctx, item, dim, time) {
  const palette = FURNITURE_COLORS[item.type] ?? FURNITURE_COLORS.box;
  const r = item.radius;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + r * 0.82, r * 1.05, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  if (item.type === 'plant') {
    ctx.fillStyle = shade('#6d4b33', dim);
    ctx.beginPath();
    ctx.moveTo(item.x - r * 0.4, item.y + r * 0.8);
    ctx.lineTo(item.x + r * 0.4, item.y + r * 0.8);
    ctx.lineTo(item.x + r * 0.28, item.y + r * 0.15);
    ctx.lineTo(item.x - r * 0.28, item.y + r * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(palette.body, dim);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + Math.sin(time * 0.7 + item.x * 0.01) * 0.08;
      ctx.beginPath();
      ctx.ellipse(
        item.x + Math.cos(angle) * r * 0.45,
        item.y - r * 0.25 + Math.sin(angle) * r * 0.3,
        r * 0.42, r * 0.2, angle, 0, Math.PI * 2,
      );
      ctx.fill();
    }
    return;
  }

  if (item.type === 'table') {
    ctx.fillStyle = shade(palette.body, dim);
    ctx.fillRect(item.x - r, item.y - r * 0.5, r * 2, r * 0.34);
    ctx.fillStyle = shade(palette.trim, dim);
    ctx.fillRect(item.x - r * 0.82, item.y - r * 0.16, r * 0.2, r * 0.95);
    ctx.fillRect(item.x + r * 0.62, item.y - r * 0.16, r * 0.2, r * 0.95);
    return;
  }

  // Sofas, chairs, beds and boxes: a padded block with a back.
  ctx.fillStyle = shade(palette.body, dim);
  ctx.beginPath();
  ctx.roundRect(item.x - r, item.y - r * 0.55, r * 2, r * 1.35, r * 0.22);
  ctx.fill();

  ctx.fillStyle = shade(palette.trim, dim);
  ctx.beginPath();
  ctx.roundRect(item.x - r * 0.95, item.y - r * 0.9, r * 1.9, r * 0.55, r * 0.2);
  ctx.fill();
}

/** Floorboards, so the floors read as floors and give the eye some scale. */
function drawFloor(ctx, band, world, dim, visibleFrom, visibleTo) {
  const boardTop = band.bottom - 16;

  ctx.fillStyle = shade('#4a3527', dim);
  ctx.fillRect(Math.max(0, visibleFrom), boardTop, visibleTo - visibleFrom, 16);

  ctx.strokeStyle = shade('#33241a', dim);
  ctx.lineWidth = 1;
  const start = Math.floor(visibleFrom / 64) * 64;
  for (let x = start; x < visibleTo; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, boardTop);
    ctx.lineTo(x, band.bottom);
    ctx.stroke();
  }

  // Skirting where the wall meets the floor.
  ctx.fillStyle = shade('#6b5847', dim);
  ctx.fillRect(Math.max(0, visibleFrom), boardTop - 5, visibleTo - visibleFrom, 5);
}

export function drawHouseInterior(ctx, game, time, cameraX = 0) {
  const world = game.world;
  const { darkness, dim } = lighting(game.elapsed);
  const visibleFrom = cameraX - 40;
  const visibleTo = cameraX + CONFIG.view.width + 40;
  const spanX = Math.max(0, visibleFrom);
  const spanW = visibleTo - spanX;

  for (const band of world.bands) {
    // Wallpaper.
    const paper = ctx.createLinearGradient(0, band.top, 0, band.bottom);
    paper.addColorStop(0, shade('#6d5f74', dim));
    paper.addColorStop(1, shade('#584c60', dim));
    ctx.fillStyle = paper;
    ctx.fillRect(spanX, band.top, spanW, band.bottom - band.top);

    // A faint vertical stripe pattern.
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 * dim})`;
    ctx.lineWidth = 6;
    const start = Math.floor(visibleFrom / 48) * 48;
    for (let x = start; x < visibleTo; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, band.top);
      ctx.lineTo(x, band.bottom - 18);
      ctx.stroke();
    }

    drawFloor(ctx, band, world, dim, visibleFrom, visibleTo);
  }

  // The ceiling slab between the floors.
  for (let i = 0; i < world.bands.length - 1; i += 1) {
    const gapTop = world.bands[i].bottom;
    const gapBottom = world.bands[i + 1].top;
    ctx.fillStyle = shade('#3a2f2a', dim);
    ctx.fillRect(spanX, gapTop, spanW, gapBottom - gapTop);
  }

  // The stairwell: a lit shaft with steps, cut through the ceiling.
  for (const stair of world.stairs) {
    if (stair.x + stair.width < visibleFrom || stair.x > visibleTo) continue;

    const top = world.bands[0].top;
    const bottom = world.bands[world.bands.length - 1].bottom;

    ctx.fillStyle = shade('#4c4152', dim);
    ctx.fillRect(stair.x, top, stair.width, bottom - top);

    ctx.fillStyle = shade('#7a6450', dim);
    const steps = 9;
    for (let i = 0; i < steps; i += 1) {
      const y = world.bands[0].bottom + ((bottom - world.bands[0].bottom) / steps) * i;
      const inset = (stair.width / steps) * i * 0.35;
      ctx.fillRect(stair.x + inset, y, stair.width - inset, 7);
    }
  }

  // The front door, on the ground floor.
  if (world.door && world.door.x - world.door.width < visibleTo) {
    const band = world.bands[world.bands.length - 1];
    const doorHeight = Math.min(CONFIG.doorway.height * 1.3, band.bottom - band.top - 20);
    const doorTop = band.bottom - 16 - doorHeight;

    ctx.fillStyle = shade('#2a1e18', dim);
    ctx.fillRect(0, doorTop, world.door.x + world.door.width / 2, doorHeight);

    ctx.fillStyle = `rgba(255, 236, 180, ${0.28 * (1 - darkness)})`;
    ctx.fillRect(0, doorTop + 8, world.door.x + world.door.width / 2 - 8, doorHeight - 16);
  }

  drawWater(ctx, world, time, darkness, visibleFrom, visibleTo);

  for (const item of world.cover) {
    if (item.x + item.radius < visibleFrom || item.x - item.radius > visibleTo) continue;
    drawFurniture(ctx, item, dim, time);
  }
}
