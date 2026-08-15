import { CONFIG } from './config.js';
import { randomOpenPoint } from './world.js';

export const FOOD_TYPE_NAMES = Object.keys(CONFIG.food.types);

export function createFoodField() {
  return { items: [], timer: 0 };
}

/**
 * Ages existing food and spawns a new item once per interval, up to the cap.
 * Food only appears in the open meadow so the player has to leave cover for it.
 */
export function updateFood(field, dt, world, rng = Math.random) {
  for (const item of field.items) item.age += dt;

  field.timer += dt;

  while (field.timer >= CONFIG.food.spawnIntervalSeconds) {
    field.timer -= CONFIG.food.spawnIntervalSeconds;
    if (field.items.length >= CONFIG.food.maxOnScreen) continue;

    const type = FOOD_TYPE_NAMES[Math.floor(rng() * FOOD_TYPE_NAMES.length) % FOOD_TYPE_NAMES.length];
    const spec = CONFIG.food.types[type];
    const point = randomOpenPoint(world, rng, spec.radius + 12);

    field.items.push({ x: point.x, y: point.y, type, value: spec.value, radius: spec.radius, age: 0 });
  }
}

/** Removes and returns every item the cricket is standing close enough to eat. */
export function consumeFood(field, cricket) {
  const eaten = [];
  const remaining = [];

  for (const item of field.items) {
    if (Math.hypot(item.x - cricket.x, item.y - cricket.y) <= CONFIG.food.eatRadius) {
      eaten.push(item);
    } else {
      remaining.push(item);
    }
  }

  field.items = remaining;
  return eaten;
}
