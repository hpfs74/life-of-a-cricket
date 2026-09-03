import { CONFIG } from './config.js';
import { randomOpenPoint } from './world.js';

// Only these are spawned by the meadow. Grubs exist too, but they are left
// behind by a killed bug and never appear on their own.
export const FOOD_TYPE_NAMES = CONFIG.food.naturalTypes;

/** Builds one food item of a known type. */
export function createFoodItem(type, x, y, settleFor = 0) {
  const spec = CONFIG.food.types[type];
  return { x, y, type, value: spec.value, radius: spec.radius, age: 0, settleFor };
}

/** True once an item has settled and can be picked up. */
export function isEdible(item) {
  return (item.settleFor ?? 0) <= 0;
}

/**
 * Puts an item on the ground regardless of the on-screen cap. Drops are earned,
 * so a full meadow must never swallow one.
 */
export function dropFood(field, type, x, y) {
  const item = createFoodItem(type, x, y, CONFIG.food.dropSettleSeconds);
  field.items.push(item);
  return item;
}

export function createFoodField() {
  return { items: [], timer: 0 };
}

/**
 * Ages existing food and spawns a new item once per interval, up to the cap.
 * Food only appears in the open meadow so the player has to leave cover for it.
 */
export function updateFood(field, dt, world, rng = Math.random) {
  for (const item of field.items) {
    item.age += dt;
    item.settleFor = Math.max(0, (item.settleFor ?? 0) - dt);
  }

  field.timer += dt;

  while (field.timer >= CONFIG.food.spawnIntervalSeconds) {
    field.timer -= CONFIG.food.spawnIntervalSeconds;
    if (field.items.length >= CONFIG.food.maxOnScreen) continue;

    const type = FOOD_TYPE_NAMES[Math.floor(rng() * FOOD_TYPE_NAMES.length) % FOOD_TYPE_NAMES.length];
    const spec = CONFIG.food.types[type];
    const point = randomOpenPoint(world, rng, spec.radius + 12);

    field.items.push(createFoodItem(type, point.x, point.y));
  }
}

/** Removes and returns every item the cricket is standing close enough to eat. */
export function consumeFood(field, cricket) {
  const eaten = [];
  const remaining = [];

  for (const item of field.items) {
    if (isEdible(item) && Math.hypot(item.x - cricket.x, item.y - cricket.y) <= CONFIG.food.eatRadius) {
      eaten.push(item);
    } else {
      remaining.push(item);
    }
  }

  field.items = remaining;
  return eaten;
}
