import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createHouse, houseEntry, atFrontDoor } from '../src/house.js';
import { bandAt, clampToBounds, inStairwell, isHidden, isWater } from '../src/world.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('a house has two floors and a stairwell joining them', () => {
  const house = createHouse(seededRng(3));

  assert.equal(house.kind, 'house');
  assert.equal(house.bands.length, 2);
  assert.equal(house.stairs.length, 1);

  const [upstairs, downstairs] = house.bands;
  assert.ok(upstairs.bottom < downstairs.top, 'the floors must not overlap');
  assert.equal(downstairs.top - upstairs.bottom, CONFIG.house.ceilingGap);
});

test('the stairwell lets a body pass between the floors', () => {
  const house = createHouse(seededRng(5));
  const stair = house.stairs[0];
  const middle = stair.x + stair.width / 2;

  assert.equal(inStairwell(house, middle), true);
  const joined = bandAt(house, middle, house.bands[0].top + 10);
  assert.equal(joined.top, house.bands[0].top);
  assert.equal(joined.bottom, house.bands[1].bottom);
});

test('away from the stairs each floor is sealed off from the other', () => {
  const house = createHouse(seededRng(7));
  const [upstairs, downstairs] = house.bands;

  // Find an x that is not part of the stairwell.
  const solid = inStairwell(house, 100) ? house.width - 100 : 100;
  const step = CONFIG.cricket.speed * CONFIG.game.maxFrameDelta;

  // Walking downwards from the upper floor stops on the upper floor.
  const fromAbove = clampToBounds(house, solid, upstairs.bottom + step, 12);
  assert.equal(fromAbove.y, upstairs.bottom - 12);

  // Walking upwards from the lower floor stops on the lower floor.
  const fromBelow = clampToBounds(house, solid, downstairs.top - step, 12);
  assert.equal(fromBelow.y, downstairs.top + 12);
});

test('the ceiling gap splits at its midpoint, each half belonging to its own floor', () => {
  const house = createHouse(seededRng(7));
  const [upstairs, downstairs] = house.bands;
  const solid = inStairwell(house, 100) ? house.width - 100 : 100;
  const middle = (upstairs.bottom + downstairs.top) / 2;

  assert.equal(clampToBounds(house, solid, middle - 4, 12).y, upstairs.bottom - 12);
  assert.equal(clampToBounds(house, solid, middle + 4, 12).y, downstairs.top + 12);
});

test('both floors are furnished, and none of it floats between them', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const house = createHouse(seededRng(seed));
    const [upstairs, downstairs] = house.bands;

    const above = house.cover.filter((c) => c.y <= upstairs.bottom);
    const below = house.cover.filter((c) => c.y >= downstairs.top);

    assert.ok(above.length > 0, `seed ${seed}: nothing to hide behind upstairs`);
    assert.ok(below.length > 0, `seed ${seed}: nothing to hide behind downstairs`);
    assert.equal(above.length + below.length, house.cover.length, 'furniture stuck in a ceiling');

    for (const item of house.cover) {
      assert.ok(item.x - item.radius >= 0 && item.x + item.radius <= house.width);
    }
  }
});

test('furniture never blocks the stairwell or the doorway', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const house = createHouse(seededRng(seed));
    const stair = house.stairs[0];
    const stairMiddle = stair.x + stair.width / 2;

    for (const item of house.cover) {
      assert.ok(
        Math.abs(item.x - stairMiddle) >= stair.width + item.radius,
        `seed ${seed}: furniture in the stairwell`,
      );
      assert.ok(
        Math.abs(item.x - house.door.x) >= CONFIG.house.entryClearance + item.radius,
        `seed ${seed}: furniture blocking the door`,
      );
    }
  }
});

test('the cricket comes in on the ground floor, on dry open ground', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const house = createHouse(seededRng(seed));
    const entry = houseEntry(house);
    const downstairs = house.bands[1];

    assert.ok(entry.y > downstairs.top && entry.y < downstairs.bottom, `seed ${seed}: entered mid-air`);
    assert.equal(isWater(house, entry.x, entry.y, CONFIG.cricket.radius), false, `seed ${seed}: entered a puddle`);
    assert.equal(isHidden(house, entry.x, entry.y), false, `seed ${seed}: entered inside furniture`);
  }
});

test('standing in the doorway is recognised, from the ground floor only', () => {
  const house = createHouse(seededRng(9));
  const [upstairs, downstairs] = house.bands;

  assert.equal(atFrontDoor(house, house.door.x, (downstairs.top + downstairs.bottom) / 2), true);
  assert.equal(atFrontDoor(house, house.width / 2, (downstairs.top + downstairs.bottom) / 2), false);
  assert.equal(
    atFrontDoor(house, house.door.x, (upstairs.top + upstairs.bottom) / 2),
    false,
    'there is no door on the upper floor',
  );
});

test('spills stay on the ground floor and out of the stairwell', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const house = createHouse(seededRng(seed));
    const downstairs = house.bands[1];

    for (const spill of house.water) {
      assert.ok(
        spill.y >= downstairs.top && spill.y <= downstairs.bottom,
        `seed ${seed}: water upstairs`,
      );
      assert.equal(inStairwell(house, spill.x), false, `seed ${seed}: water in the stairwell`);
    }
  }
});
