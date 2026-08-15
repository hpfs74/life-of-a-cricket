import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createFoodField, updateFood, consumeFood, FOOD_TYPE_NAMES } from '../src/food.js';

const world = { width: 800, height: 600, cover: [] };
const rng = () => 0.5;

test('a new field is empty', () => {
  const field = createFoodField();
  assert.equal(field.items.length, 0);
});

test('food appears only after the spawn interval elapses', () => {
  const field = createFoodField();

  updateFood(field, CONFIG.food.spawnIntervalSeconds - 0.01, world, rng);
  assert.equal(field.items.length, 0);

  updateFood(field, 0.02, world, rng);
  assert.equal(field.items.length, 1);
});

test('every spawned item has a known type, a value and a radius', () => {
  const field = createFoodField();
  updateFood(field, CONFIG.food.spawnIntervalSeconds, world, rng);

  const item = field.items[0];
  assert.ok(FOOD_TYPE_NAMES.includes(item.type));
  assert.equal(item.value, CONFIG.food.types[item.type].value);
  assert.equal(item.radius, CONFIG.food.types[item.type].radius);
  assert.equal(item.age, 0);
});

test('spawning stops at the on-screen cap', () => {
  const field = createFoodField();
  for (let i = 0; i < 100; i += 1) {
    updateFood(field, CONFIG.food.spawnIntervalSeconds, world, rng);
  }
  assert.equal(field.items.length, CONFIG.food.maxOnScreen);
});

test('items age so the renderer can animate them', () => {
  const field = createFoodField();
  updateFood(field, CONFIG.food.spawnIntervalSeconds, world, rng);
  updateFood(field, 0.5, world, rng);
  assert.ok(Math.abs(field.items[0].age - 0.5) < 0.001);
});

test('walking within the eat radius consumes the item and returns it', () => {
  const field = createFoodField();
  field.items = [
    { x: 100, y: 100, type: 'berry', value: 60, radius: 9, age: 0 },
    { x: 500, y: 400, type: 'seed', value: 25, radius: 6, age: 0 },
  ];

  const eaten = consumeFood(field, { x: 100 + CONFIG.food.eatRadius - 1, y: 100 });
  assert.equal(eaten.length, 1);
  assert.equal(eaten[0].type, 'berry');
  assert.equal(field.items.length, 1);
  assert.equal(field.items[0].type, 'seed');
});

test('food just outside the eat radius is left alone', () => {
  const field = createFoodField();
  field.items = [{ x: 100, y: 100, type: 'seed', value: 25, radius: 6, age: 0 }];

  const eaten = consumeFood(field, { x: 100 + CONFIG.food.eatRadius + 1, y: 100 });
  assert.equal(eaten.length, 0);
  assert.equal(field.items.length, 1);
});
