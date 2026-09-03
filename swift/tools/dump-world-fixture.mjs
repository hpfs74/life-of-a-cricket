// Dumps a JS-generated meadow so the Swift port can be compared against it.
// Regenerate with: node swift/tools/dump-world-fixture.mjs 7 > <fixture path>
import { createWorld } from '../../src/world.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const seed = Number(process.argv[2] ?? 7);
const world = createWorld(seededRng(seed));

process.stdout.write(JSON.stringify({
  seed,
  width: world.width,
  height: world.height,
  top: world.top,
  door: world.door,
  cover: world.cover,
  water: world.water,
}, null, 2));
