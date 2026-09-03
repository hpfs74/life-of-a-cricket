// Dumps a JS-generated house so the Swift port can be compared against it.
// Sibling to dump-world-fixture.mjs, which does the same for a meadow.
// Regenerate with: node swift/tools/dump-house-fixture.mjs 7 > <fixture path>
import { createHouse } from '../../src/house.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const seed = Number(process.argv[2] ?? 7);
const house = createHouse(seededRng(seed));

process.stdout.write(JSON.stringify({
  seed,
  width: house.width,
  height: house.height,
  top: house.top,
  bands: house.bands,
  stairs: house.stairs,
  door: house.door,
  cover: house.cover,
  water: house.water,
}, null, 2));
