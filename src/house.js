import { CONFIG } from './config.js';

/**
 * The house: a two-floor cross-section, drawn and played like a dollhouse.
 *
 * It is built as the same shape a meadow is — bands of walkable ground, cover
 * to hide in, water to avoid — so every system that already works outdoors
 * works indoors without knowing it has moved. Only the cast changes: birds and
 * bats stay outside, and the cat and the human take their place.
 */

const FURNITURE = ['sofa', 'chair', 'table', 'plant', 'box', 'bed'];

/** The two floors, as bands of walkable ground. */
function makeBands() {
  const { top, floorHeight, ceilingGap } = CONFIG.house;
  const upstairs = { top, bottom: top + floorHeight };
  const downstairs = { top: upstairs.bottom + ceilingGap, bottom: upstairs.bottom + ceilingGap + floorHeight };
  return [upstairs, downstairs];
}

/**
 * Places furniture on a floor, keeping it clear of the stairwell and of the
 * doorway, so the cricket can always get in and always reach the stairs.
 */
function furnishFloor(world, band, rng, keepClear) {
  const {
    furniturePerFloor, furnitureMinRadius, furnitureMaxRadius, furnitureMinSeparation,
  } = CONFIG.house;

  let attempts = 0;

  while (attempts < furniturePerFloor * 400) {
    attempts += 1;
    const placed = world.cover.filter((item) => item.y >= band.top && item.y <= band.bottom);
    if (placed.length >= furniturePerFloor) break;

    const radius = furnitureMinRadius + rng() * (furnitureMaxRadius - furnitureMinRadius);
    const minY = band.top + radius * 1.1;
    const maxY = band.bottom - radius;
    if (minY >= maxY) break;

    const x = radius + 20 + rng() * (world.width - (radius + 20) * 2);
    const y = minY + rng() * (maxY - minY);

    if (keepClear.some((zone) => Math.abs(zone.x - x) < zone.radius + radius)) continue;

    const tooClose = world.cover.some(
      (item) => Math.hypot(item.x - x, item.y - y) < furnitureMinSeparation,
    );
    if (tooClose) continue;

    world.cover.push({ x, y, radius, type: FURNITURE[Math.floor(rng() * FURNITURE.length)] });
  }
}

/**
 * Builds a house. The doorway sits at the west wall of the ground floor, which
 * is the side the meadow is on.
 */
export function createHouse(rng = Math.random) {
  const {
    width, height, stairWidth, spillCount, spillRadius, doorWidth, entryClearance,
  } = CONFIG.house;

  const bands = makeBands();
  const [upstairs, downstairs] = bands;

  // The stairwell sits in the eastern half, away from the door, so crossing the
  // ground floor is the price of reaching the safer upper floor.
  const stairX = width * (0.58 + rng() * 0.24);
  const stairs = [{ x: stairX, width: stairWidth }];

  const door = { x: doorWidth, y: downstairs.bottom - CONFIG.doorway.height / 2, width: doorWidth };

  const world = {
    kind: 'house',
    width,
    height,
    top: upstairs.top,
    bands,
    stairs,
    door,
    cover: [],
    water: [],
  };

  const keepClear = [
    { x: stairX + stairWidth / 2, radius: stairWidth },
    { x: door.x, radius: entryClearance },
  ];

  furnishFloor(world, upstairs, rng, keepClear);
  furnishFloor(world, downstairs, rng, keepClear);

  // A pet bowl and a spill, on the ground floor only. Water indoors behaves
  // exactly as it does outdoors: you walk round it or leap it.
  for (let i = 0; i < spillCount; i += 1) {
    const x = width * (0.3 + rng() * 0.55);
    const y = downstairs.top + 40 + rng() * (downstairs.bottom - downstairs.top - 80);
    if (Math.abs(x - (stairX + stairWidth / 2)) < stairWidth) continue;
    world.water.push({ x, y, radius: spillRadius * (0.8 + rng() * 0.5) });
  }

  return world;
}

/** Where the cricket stands when it comes in from the meadow. */
export function houseEntry(world) {
  const downstairs = world.bands[world.bands.length - 1];
  return {
    x: world.door.x + CONFIG.house.doorWidth,
    y: (downstairs.top + downstairs.bottom) / 2,
  };
}

/** True when the cricket is standing in the doorway, on its way back out. */
export function atFrontDoor(world, x, y) {
  const downstairs = world.bands[world.bands.length - 1];
  return x <= world.door.x + CONFIG.house.doorWidth / 2 && y >= downstairs.top && y <= downstairs.bottom;
}
