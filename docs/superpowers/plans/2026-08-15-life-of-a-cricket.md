# Life of a Cricket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser game where a cricket eats food and sings for points while hiding from birds, running from a static `index.html` with no build step.

**Architecture:** Pure-logic ES modules (world, cricket, birds, food, score, attention, game) hold all simulation state and are unit tested under Node's built-in test runner. A separate `render/` layer draws that state to a canvas and never mutates it. `main.js` owns the requestAnimationFrame loop and wires input → simulation → render.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5 Canvas 2D, WebAudio, `node --test`. Zero runtime and zero dev dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-life-of-a-cricket-design.md`

## Global Constraints

- **No dependencies.** `package.json` must never gain a `dependencies` or `devDependencies` entry. No bundler, no transpiler, no test framework beyond `node:test`.
- **No build step.** Opening `index.html` through a local static server must run the current source directly.
- **All imports use explicit `.js` extensions** — browsers require them for ES modules.
- **`package.json` contains `"type": "module"`** so Node treats the same `.js` files as ES modules.
- **Renderers are pure readers.** Nothing in `src/render/` may mutate simulation state.
- **All tunable numbers live in `src/config.js`.** No magic numbers in logic modules.
- **Node 18+** for the built-in test runner.
- **Test command:** `node --test tests/` from the project root.

---

### Task 1: Project skeleton and running loop

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/config.js`
- Create: `src/main.js`
- Create: `.gitignore`
- Test: `tests/config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `CONFIG` object from `src/config.js` — every later task reads its constants from here. `src/main.js` exports nothing; it is the entry module.

- [ ] **Step 1: Initialize the repository and package manifest**

```bash
cd /Users/hpfs/Developer/hpfs/life-of-a-cricket
git init
```

Create `package.json`:

```json
{
  "name": "life-of-a-cricket",
  "version": "1.0.0",
  "description": "A browser game about the life of a cricket: eat, sing, and hide from birds.",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test tests/",
    "start": "python3 -m http.server 8000"
  }
}
```

Create `.gitignore`:

```
.DS_Store
node_modules/
```

- [ ] **Step 2: Write the failing test for config**

Create `tests/config.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';

test('config exposes the tunables the simulation needs', () => {
  assert.ok(CONFIG.world.width > 0);
  assert.ok(CONFIG.world.height > 0);
  assert.equal(CONFIG.score.songPointsPerSecond, 10);
  assert.equal(CONFIG.score.multiplierClimbPerSecond, 0.2);
  assert.equal(CONFIG.score.multiplierMax, 5);
  assert.equal(CONFIG.game.startingLives, 3);
});

test('attention thresholds are sorted and within 0..1', () => {
  const t = CONFIG.attention.thresholds;
  assert.ok(t.length > 0);
  for (const value of t) {
    assert.ok(value > 0 && value <= 1, `threshold ${value} out of range`);
  }
  const sorted = [...t].sort((a, b) => a - b);
  assert.deepEqual(t, sorted);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/config.test.js`
Expected: FAIL — cannot find module `../src/config.js`.

- [ ] **Step 4: Write `src/config.js`**

```js
export const CONFIG = {
  world: {
    width: 960,
    height: 600,
    edgeMargin: 24,
    coverCount: 9,
    coverMinRadius: 34,
    coverMaxRadius: 58,
    coverMinSeparation: 90,
  },

  cricket: {
    radius: 12,
    speed: 190,
    invulnerableSeconds: 1.6,
  },

  score: {
    songPointsPerSecond: 10,
    multiplierStart: 1,
    multiplierClimbPerSecond: 0.2,
    multiplierMax: 5,
    fedClimbBonus: 2,
    fedSeconds: 6,
    storageKey: 'life-of-a-cricket:highscore',
  },

  food: {
    maxOnScreen: 5,
    spawnIntervalSeconds: 2.2,
    eatRadius: 20,
    types: {
      seed: { value: 25, radius: 6 },
      berry: { value: 60, radius: 9 },
      aphid: { value: 120, radius: 7 },
    },
  },

  attention: {
    risePerSecond: 0.22,
    decayPerSecond: 0.12,
    thresholds: [0.3, 0.55, 0.8],
    rearmMargin: 0.06,
  },

  bird: {
    maxAlive: 3,
    enterSpeed: 250,
    circleSpeed: 2.0,
    circleRadius: 210,
    circleSeconds: 2.4,
    diveSpeed: 620,
    retreatSpeed: 340,
    hitRadius: 30,
    warningSeconds: 0.9,
  },

  game: {
    startingLives: 3,
    maxFrameDelta: 0.05,
    difficultyRampSeconds: 90,
    difficultyMax: 2.2,
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/config.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 6: Create the page shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>Life of a Cricket</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <canvas id="stage"></canvas>
    <script type="module" src="src/main.js"></script>
  </body>
</html>
```

Create `styles.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  height: 100%;
  background: #10141c;
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}

#stage {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 7: Write the loop entry point**

Create `src/main.js`:

```js
import { CONFIG } from './config.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

// The simulation always runs in CONFIG.world units. The canvas is sized to the
// device, and this transform letterboxes the world into it, so gameplay is
// identical at every screen size.
const view = { scale: 1, offsetX: 0, offsetY: 0 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const scale = Math.min(cssWidth / CONFIG.world.width, cssHeight / CONFIG.world.height);
  view.scale = scale;
  view.offsetX = (cssWidth - CONFIG.world.width * scale) / 2;
  view.offsetY = (cssHeight - CONFIG.world.height * scale) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;

  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  // Placeholder until Task 10 replaces this with the real background.
  ctx.fillStyle = '#2b3a2f';
  ctx.fillRect(0, 0, CONFIG.world.width, CONFIG.world.height);

  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// `dt` is computed and clamped every frame even though nothing consumes it yet;
// Task 9 wires the simulation in here.
export { view };
```

- [ ] **Step 8: Verify the page runs**

Run: `python3 -m http.server 8000` in the project root, then open `http://localhost:8000` in Chrome.
Expected: a centered green rectangle that letterboxes correctly when the window is resized, and no console errors.

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore index.html styles.css src/config.js src/main.js tests/config.test.js docs/
git commit -m "feat: project skeleton with canvas loop and config"
```

---

### Task 2: World, bounds and cover

**Files:**
- Create: `src/world.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: `CONFIG` from `src/config.js`.
- Produces:
  - `createWorld(rng = Math.random) -> { width, height, cover: Array<{x, y, radius, type}> }`
  - `clampToBounds(world, x, y, radius) -> { x, y }`
  - `coverAt(world, x, y) -> coverObject | null`
  - `isHidden(world, x, y) -> boolean`
  - `randomOpenPoint(world, rng, minDistanceFromCover) -> { x, y }`
  - Cover `type` is one of `'grass' | 'rock' | 'leaf'`.

- [ ] **Step 1: Write the failing tests**

Create `tests/world.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createWorld, clampToBounds, coverAt, isHidden, randomOpenPoint } from '../src/world.js';

// A deterministic stand-in for Math.random so layout tests are repeatable.
function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('createWorld places the configured amount of cover inside the bounds', () => {
  const world = createWorld(seededRng(7));
  assert.equal(world.width, CONFIG.world.width);
  assert.equal(world.height, CONFIG.world.height);
  assert.equal(world.cover.length, CONFIG.world.coverCount);

  for (const item of world.cover) {
    assert.ok(item.x - item.radius >= 0, 'cover crosses the left edge');
    assert.ok(item.x + item.radius <= world.width, 'cover crosses the right edge');
    assert.ok(item.y - item.radius >= 0, 'cover crosses the top edge');
    assert.ok(item.y + item.radius <= world.height, 'cover crosses the bottom edge');
    assert.ok(['grass', 'rock', 'leaf'].includes(item.type));
  }
});

test('cover objects are separated enough to leave lanes between them', () => {
  const world = createWorld(seededRng(11));
  for (let i = 0; i < world.cover.length; i += 1) {
    for (let j = i + 1; j < world.cover.length; j += 1) {
      const a = world.cover[i];
      const b = world.cover[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(
        distance >= CONFIG.world.coverMinSeparation,
        `cover ${i} and ${j} are ${distance.toFixed(1)} apart`,
      );
    }
  }
});

test('clampToBounds keeps a body fully inside the meadow', () => {
  const world = createWorld(seededRng(1));
  assert.deepEqual(clampToBounds(world, -50, -50, 10), { x: 10, y: 10 });
  assert.deepEqual(
    clampToBounds(world, world.width + 50, world.height + 50, 10),
    { x: world.width - 10, y: world.height - 10 },
  );
  assert.deepEqual(clampToBounds(world, 300, 200, 10), { x: 300, y: 200 });
});

test('coverAt and isHidden agree on the boundary of a cover object', () => {
  const world = { width: 800, height: 600, cover: [{ x: 400, y: 300, radius: 50, type: 'grass' }] };

  assert.equal(isHidden(world, 400, 300), true, 'dead centre is hidden');
  assert.equal(isHidden(world, 400, 349), true, 'just inside the edge is hidden');
  assert.equal(isHidden(world, 400, 351), false, 'just outside the edge is exposed');
  assert.equal(coverAt(world, 400, 300).type, 'grass');
  assert.equal(coverAt(world, 10, 10), null);
});

test('randomOpenPoint never lands inside cover', () => {
  const world = createWorld(seededRng(3));
  const rng = seededRng(99);
  for (let i = 0; i < 200; i += 1) {
    const point = randomOpenPoint(world, rng, 20);
    assert.equal(isHidden(world, point.x, point.y), false, 'spawned inside cover');
    assert.ok(point.x >= 0 && point.x <= world.width);
    assert.ok(point.y >= 0 && point.y <= world.height);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/world.test.js`
Expected: FAIL — cannot find module `../src/world.js`.

- [ ] **Step 3: Write `src/world.js`**

```js
import { CONFIG } from './config.js';

const COVER_TYPES = ['grass', 'rock', 'leaf'];

/**
 * Builds the meadow: fixed bounds plus a scattering of cover objects that the
 * cricket can hide inside. Cover is rejection-sampled so no two pieces overlap
 * closely enough to merge into one unreadable blob.
 */
export function createWorld(rng = Math.random) {
  const { width, height, edgeMargin, coverCount, coverMinRadius, coverMaxRadius, coverMinSeparation } =
    CONFIG.world;

  const cover = [];
  let attempts = 0;

  while (cover.length < coverCount && attempts < coverCount * 400) {
    attempts += 1;

    const radius = coverMinRadius + rng() * (coverMaxRadius - coverMinRadius);
    const minX = Math.max(radius, edgeMargin);
    const minY = Math.max(radius, edgeMargin);
    const x = minX + rng() * (width - minX * 2);
    const y = minY + rng() * (height - minY * 2);

    const tooClose = cover.some(
      (item) => Math.hypot(item.x - x, item.y - y) < coverMinSeparation,
    );
    if (tooClose) continue;

    cover.push({ x, y, radius, type: COVER_TYPES[Math.floor(rng() * COVER_TYPES.length)] });
  }

  return { width, height, cover };
}

export function clampToBounds(world, x, y, radius) {
  return {
    x: Math.min(Math.max(x, radius), world.width - radius),
    y: Math.min(Math.max(y, radius), world.height - radius),
  };
}

export function coverAt(world, x, y) {
  for (const item of world.cover) {
    if (Math.hypot(item.x - x, item.y - y) <= item.radius) return item;
  }
  return null;
}

export function isHidden(world, x, y) {
  return coverAt(world, x, y) !== null;
}

/**
 * Finds a point in the open meadow, at least `minDistanceFromCover` away from
 * every piece of cover, so food never spawns somewhere the player can eat it
 * without ever leaving safety. Falls back to the last candidate if the meadow
 * is unusually crowded, which keeps spawning from stalling the game.
 */
export function randomOpenPoint(world, rng = Math.random, minDistanceFromCover = 0) {
  const margin = CONFIG.world.edgeMargin;
  let candidate = { x: world.width / 2, y: world.height / 2 };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    candidate = {
      x: margin + rng() * (world.width - margin * 2),
      y: margin + rng() * (world.height - margin * 2),
    };

    const clear = world.cover.every(
      (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) > item.radius + minDistanceFromCover,
    );
    if (clear) return candidate;
  }

  return candidate;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/world.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/world.js tests/world.test.js
git commit -m "feat: meadow bounds, cover placement and hiding checks"
```

---

### Task 3: Cricket movement and singing

**Files:**
- Create: `src/cricket.js`
- Test: `tests/cricket.test.js`

**Interfaces:**
- Consumes: `CONFIG`; `clampToBounds`, `isHidden` from `src/world.js`.
- Produces:
  - `createCricket(world) -> { x, y, dirX, dirY, moving, singing, songSeconds, invulnerableFor }`
  - `updateCricket(cricket, intent, dt, world) -> { startedSinging, stoppedSinging, hidden }`
  - `intent` shape: `{ dx: number, dy: number, sing: boolean }` where `dx`/`dy` are in `-1..1`.

- [ ] **Step 1: Write the failing tests**

Create `tests/cricket.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createCricket, updateCricket } from '../src/cricket.js';

const openWorld = { width: 800, height: 600, cover: [] };
const coveredWorld = {
  width: 800,
  height: 600,
  cover: [{ x: 100, y: 100, radius: 50, type: 'grass' }],
};

const still = { dx: 0, dy: 0, sing: false };

test('the cricket starts in the middle of the meadow, silent', () => {
  const cricket = createCricket(openWorld);
  assert.equal(cricket.x, 400);
  assert.equal(cricket.y, 300);
  assert.equal(cricket.singing, false);
  assert.equal(cricket.songSeconds, 0);
});

test('movement covers the configured speed over one second', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 0, sing: false }, 1, openWorld);
  assert.ok(Math.abs(cricket.x - (400 + CONFIG.cricket.speed)) < 0.001);
  assert.equal(cricket.y, 300);
});

test('diagonal movement is normalised so it is not faster than straight', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 1, dy: 1, sing: false }, 1, openWorld);
  const travelled = Math.hypot(cricket.x - 400, cricket.y - 300);
  assert.ok(Math.abs(travelled - CONFIG.cricket.speed) < 0.001, `travelled ${travelled}`);
});

test('the cricket cannot leave the meadow', () => {
  const cricket = createCricket(openWorld);
  for (let i = 0; i < 100; i += 1) {
    updateCricket(cricket, { dx: -1, dy: -1, sing: false }, 0.1, openWorld);
  }
  assert.equal(cricket.x, CONFIG.cricket.radius);
  assert.equal(cricket.y, CONFIG.cricket.radius);
});

test('singing requires standing still and blocks movement', () => {
  const cricket = createCricket(openWorld);
  const events = updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  assert.equal(cricket.singing, true);
  assert.equal(events.startedSinging, true);
  assert.equal(cricket.x, 400, 'a singing cricket does not move');
  assert.ok(Math.abs(cricket.songSeconds - 0.5) < 0.001);
});

test('pressing a direction while holding sing cancels the song and moves', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.5, openWorld);

  const events = updateCricket(cricket, { dx: 1, dy: 0, sing: true }, 0.5, openWorld);
  assert.equal(cricket.singing, false);
  assert.equal(events.stoppedSinging, true);
  assert.equal(cricket.songSeconds, 0);
  assert.ok(cricket.x > 400, 'the cricket moved instead of singing');
});

test('releasing the sing key reports a stop exactly once', () => {
  const cricket = createCricket(openWorld);
  updateCricket(cricket, { dx: 0, dy: 0, sing: true }, 0.2, openWorld);

  const first = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(first.stoppedSinging, true);

  const second = updateCricket(cricket, still, 0.2, openWorld);
  assert.equal(second.stoppedSinging, false);
});

test('hidden reflects whether the cricket is standing in cover', () => {
  const cricket = createCricket(coveredWorld);
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, false);

  cricket.x = 100;
  cricket.y = 100;
  assert.equal(updateCricket(cricket, still, 0.016, coveredWorld).hidden, true);
});

test('invulnerability counts down and never goes negative', () => {
  const cricket = createCricket(openWorld);
  cricket.invulnerableFor = 0.3;

  updateCricket(cricket, still, 0.2, openWorld);
  assert.ok(Math.abs(cricket.invulnerableFor - 0.1) < 0.001);

  updateCricket(cricket, still, 0.5, openWorld);
  assert.equal(cricket.invulnerableFor, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/cricket.test.js`
Expected: FAIL — cannot find module `../src/cricket.js`.

- [ ] **Step 3: Write `src/cricket.js`**

```js
import { CONFIG } from './config.js';
import { clampToBounds, isHidden } from './world.js';

export function createCricket(world) {
  return {
    x: world.width / 2,
    y: world.height / 2,
    dirX: 1,
    dirY: 0,
    moving: false,
    singing: false,
    songSeconds: 0,
    invulnerableFor: 0,
  };
}

/**
 * Advances the player one frame.
 *
 * Singing and moving are mutually exclusive by design: holding the sing key
 * only sings while no direction is held, and pressing a direction mid-song
 * cancels it. That is the whole risk/reward core — the player has to commit to
 * a spot to score.
 */
export function updateCricket(cricket, intent, dt, world) {
  const wasSinging = cricket.singing;

  cricket.invulnerableFor = Math.max(0, cricket.invulnerableFor - dt);

  const magnitude = Math.hypot(intent.dx, intent.dy);
  const wantsToMove = magnitude > 0;
  cricket.moving = wantsToMove;
  cricket.singing = intent.sing && !wantsToMove;

  if (cricket.singing) {
    cricket.songSeconds += dt;
  } else {
    cricket.songSeconds = 0;

    if (wantsToMove) {
      const nx = intent.dx / magnitude;
      const ny = intent.dy / magnitude;
      cricket.dirX = nx;
      cricket.dirY = ny;

      const next = clampToBounds(
        world,
        cricket.x + nx * CONFIG.cricket.speed * dt,
        cricket.y + ny * CONFIG.cricket.speed * dt,
        CONFIG.cricket.radius,
      );
      cricket.x = next.x;
      cricket.y = next.y;
    }
  }

  return {
    startedSinging: cricket.singing && !wasSinging,
    stoppedSinging: !cricket.singing && wasSinging,
    hidden: isHidden(world, cricket.x, cricket.y),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/cricket.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cricket.js tests/cricket.test.js
git commit -m "feat: cricket movement, singing and cover state"
```

---

### Task 4: Score, multiplier and the fed meter

**Files:**
- Create: `src/score.js`
- Test: `tests/score.test.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - `createScore(storage) -> { points, multiplier, fed, highScore, storage }`
  - `tickSong(score, dt) -> pointsGained`
  - `breakSong(score) -> void`
  - `tickFed(score, dt) -> void`
  - `eat(score, value) -> void`
  - `commitHighScore(score) -> boolean` (true when a new record was set)
  - `storage` is any object with `getItem`/`setItem`; pass `window.localStorage` in the browser.

- [ ] **Step 1: Write the failing tests**

Create `tests/score.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from '../src/score.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

function throwingStorage() {
  return {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
}

test('a new score starts at zero with the base multiplier', () => {
  const score = createScore(memoryStorage());
  assert.equal(score.points, 0);
  assert.equal(score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(score.fed, 0);
  assert.equal(score.highScore, 0);
});

test('the stored high score is loaded on creation', () => {
  const score = createScore(memoryStorage({ [CONFIG.score.storageKey]: '4200' }));
  assert.equal(score.highScore, 4200);
});

test('unreadable storage degrades to a zero high score instead of throwing', () => {
  const score = createScore(throwingStorage());
  assert.equal(score.highScore, 0);
});

test('singing awards points at rate times multiplier', () => {
  const score = createScore(memoryStorage());
  const gained = tickSong(score, 1);
  // The multiplier climbs during the same second, so points land between the
  // starting rate and the rate at the end of the second.
  assert.ok(gained >= CONFIG.score.songPointsPerSecond);
  assert.ok(gained <= CONFIG.score.songPointsPerSecond * (1 + CONFIG.score.multiplierClimbPerSecond));
  assert.equal(score.points, gained);
});

test('the multiplier climbs at the configured rate and stops at the cap', () => {
  const score = createScore(memoryStorage());
  tickSong(score, 1);
  assert.ok(Math.abs(score.multiplier - (1 + CONFIG.score.multiplierClimbPerSecond)) < 0.001);

  for (let i = 0; i < 200; i += 1) tickSong(score, 1);
  assert.equal(score.multiplier, CONFIG.score.multiplierMax);
});

test('being fed doubles the multiplier climb rate', () => {
  const plain = createScore(memoryStorage());
  tickSong(plain, 1);

  const wellFed = createScore(memoryStorage());
  eat(wellFed, 0);
  tickSong(wellFed, 1);

  const plainClimb = plain.multiplier - CONFIG.score.multiplierStart;
  const fedClimb = wellFed.multiplier - CONFIG.score.multiplierStart;
  assert.ok(Math.abs(fedClimb - plainClimb * CONFIG.score.fedClimbBonus) < 0.001);
});

test('breaking the song resets the multiplier but keeps the points', () => {
  const score = createScore(memoryStorage());
  tickSong(score, 3);
  const banked = score.points;

  breakSong(score);
  assert.equal(score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(score.points, banked);
});

test('eating adds its value and refills the fed meter, which then decays', () => {
  const score = createScore(memoryStorage());
  eat(score, CONFIG.food.types.berry.value);

  assert.equal(score.points, CONFIG.food.types.berry.value);
  assert.equal(score.fed, CONFIG.score.fedSeconds);

  tickFed(score, 2);
  assert.ok(Math.abs(score.fed - (CONFIG.score.fedSeconds - 2)) < 0.001);

  tickFed(score, 999);
  assert.equal(score.fed, 0);
});

test('commitHighScore records a new record and reports whether it beat the old one', () => {
  const storage = memoryStorage({ [CONFIG.score.storageKey]: '100' });
  const score = createScore(storage);

  score.points = 50;
  assert.equal(commitHighScore(score), false);
  assert.equal(storage.getItem(CONFIG.score.storageKey), '100');

  score.points = 500;
  assert.equal(commitHighScore(score), true);
  assert.equal(storage.getItem(CONFIG.score.storageKey), '500');
  assert.equal(score.highScore, 500);
});

test('unwritable storage still updates the in-memory high score', () => {
  const score = createScore(throwingStorage());
  score.points = 900;
  assert.equal(commitHighScore(score), true);
  assert.equal(score.highScore, 900);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/score.test.js`
Expected: FAIL — cannot find module `../src/score.js`.

- [ ] **Step 3: Write `src/score.js`**

```js
import { CONFIG } from './config.js';

function readHighScore(storage) {
  try {
    const raw = storage?.getItem(CONFIG.score.storageKey);
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Private browsing or disabled storage: fall back to a session-only record.
    return 0;
  }
}

export function createScore(storage) {
  return {
    points: 0,
    multiplier: CONFIG.score.multiplierStart,
    fed: 0,
    highScore: readHighScore(storage),
    storage,
  };
}

/** Awards one frame of song and climbs the multiplier. Returns points gained. */
export function tickSong(score, dt) {
  const gained = CONFIG.score.songPointsPerSecond * score.multiplier * dt;
  score.points += gained;

  const climbRate =
    CONFIG.score.multiplierClimbPerSecond * (score.fed > 0 ? CONFIG.score.fedClimbBonus : 1);
  score.multiplier = Math.min(CONFIG.score.multiplierMax, score.multiplier + climbRate * dt);

  return gained;
}

export function breakSong(score) {
  score.multiplier = CONFIG.score.multiplierStart;
}

export function tickFed(score, dt) {
  score.fed = Math.max(0, score.fed - dt);
}

export function eat(score, value) {
  score.points += value;
  score.fed = CONFIG.score.fedSeconds;
}

/** Persists the run's score if it beat the record. Returns true on a new record. */
export function commitHighScore(score) {
  const final = Math.floor(score.points);
  if (final <= score.highScore) return false;

  score.highScore = final;
  try {
    score.storage?.setItem(CONFIG.score.storageKey, String(final));
  } catch {
    // Keep the in-memory record even when it cannot be persisted.
  }
  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/score.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/score.js tests/score.test.js
git commit -m "feat: scoring, song multiplier and fed meter"
```

---

### Task 5: Attention meter and spawn thresholds

**Files:**
- Create: `src/attention.js`
- Test: `tests/attention.test.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - `createAttention() -> { value, armed: boolean[] }`
  - `tickAttention(attention, singing, dt) -> { spawned: number }`
  - `resetAttention(attention) -> void`

- [ ] **Step 1: Write the failing tests**

Create `tests/attention.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createAttention, tickAttention, resetAttention } from '../src/attention.js';

test('attention starts empty with every threshold armed', () => {
  const attention = createAttention();
  assert.equal(attention.value, 0);
  assert.equal(attention.armed.length, CONFIG.attention.thresholds.length);
  assert.ok(attention.armed.every(Boolean));
});

test('singing raises attention and silence decays it, both clamped', () => {
  const attention = createAttention();

  tickAttention(attention, true, 1);
  assert.ok(Math.abs(attention.value - CONFIG.attention.risePerSecond) < 0.001);

  tickAttention(attention, false, 1);
  const expected = CONFIG.attention.risePerSecond - CONFIG.attention.decayPerSecond;
  assert.ok(Math.abs(attention.value - expected) < 0.001);

  tickAttention(attention, false, 999);
  assert.equal(attention.value, 0, 'attention never goes below zero');

  tickAttention(attention, true, 999);
  assert.equal(attention.value, 1, 'attention never goes above one');
});

test('crossing a threshold upward spawns exactly one bird', () => {
  const attention = createAttention();
  const first = CONFIG.attention.thresholds[0];

  const secondsToJustBelow = (first - 0.01) / CONFIG.attention.risePerSecond;
  assert.equal(tickAttention(attention, true, secondsToJustBelow).spawned, 0);

  const crossing = tickAttention(attention, true, 0.02 / CONFIG.attention.risePerSecond);
  assert.equal(crossing.spawned, 1);

  // Staying above the threshold must not spawn again.
  assert.equal(tickAttention(attention, true, 0.05).spawned, 0);
});

test('a threshold re-arms only after attention drops below it by the margin', () => {
  const attention = createAttention();
  const first = CONFIG.attention.thresholds[0];

  attention.value = first + 0.01;
  tickAttention(attention, true, 0);
  attention.value = first - CONFIG.attention.rearmMargin / 2;
  tickAttention(attention, false, 0);
  assert.equal(attention.armed[0], false, 'still disarmed inside the margin');

  attention.value = first - CONFIG.attention.rearmMargin * 2;
  tickAttention(attention, false, 0);
  assert.equal(attention.armed[0], true, 're-armed below the margin');
});

test('a big jump across several thresholds spawns one bird per threshold', () => {
  const attention = createAttention();
  const result = tickAttention(attention, true, 999);
  assert.equal(result.spawned, CONFIG.attention.thresholds.length);
});

test('resetAttention clears the meter and re-arms everything', () => {
  const attention = createAttention();
  tickAttention(attention, true, 999);

  resetAttention(attention);
  assert.equal(attention.value, 0);
  assert.ok(attention.armed.every(Boolean));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/attention.test.js`
Expected: FAIL — cannot find module `../src/attention.js`.

- [ ] **Step 3: Write `src/attention.js`**

```js
import { CONFIG } from './config.js';

export function createAttention() {
  return {
    value: 0,
    armed: CONFIG.attention.thresholds.map(() => true),
  };
}

/**
 * Advances the attention meter and reports how many birds it summoned.
 *
 * Each threshold fires once on the way up and only re-arms after attention
 * falls a margin below it, so hovering on a boundary cannot machine-gun birds.
 */
export function tickAttention(attention, singing, dt) {
  const rate = singing ? CONFIG.attention.risePerSecond : -CONFIG.attention.decayPerSecond;
  attention.value = Math.min(1, Math.max(0, attention.value + rate * dt));

  let spawned = 0;

  CONFIG.attention.thresholds.forEach((threshold, index) => {
    if (attention.value >= threshold && attention.armed[index]) {
      attention.armed[index] = false;
      spawned += 1;
    } else if (attention.value < threshold - CONFIG.attention.rearmMargin) {
      attention.armed[index] = true;
    }
  });

  return { spawned };
}

export function resetAttention(attention) {
  attention.value = 0;
  attention.armed = CONFIG.attention.thresholds.map(() => true);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/attention.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/attention.js tests/attention.test.js
git commit -m "feat: attention meter with re-arming spawn thresholds"
```

---

### Task 6: Food spawning and eating

**Files:**
- Create: `src/food.js`
- Test: `tests/food.test.js`

**Interfaces:**
- Consumes: `CONFIG`; `randomOpenPoint` from `src/world.js`.
- Produces:
  - `createFoodField() -> { items: Array<{ x, y, type, value, radius, age }>, timer }`
  - `updateFood(field, dt, world, rng) -> void`
  - `consumeFood(field, cricket) -> Array<eatenItem>`
  - `FOOD_TYPE_NAMES` — `['seed', 'berry', 'aphid']`

- [ ] **Step 1: Write the failing tests**

Create `tests/food.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/food.test.js`
Expected: FAIL — cannot find module `../src/food.js`.

- [ ] **Step 3: Write `src/food.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/food.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/food.js tests/food.test.js
git commit -m "feat: food spawning in open ground and proximity eating"
```

---

### Task 7: Birds and their state machine

**Files:**
- Create: `src/birds.js`
- Test: `tests/birds.test.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - `spawnBird(world, rng, difficulty) -> bird`
  - `updateBird(bird, dt, context) -> 'none' | 'scanned-lost' | 'hit' | 'missed' | 'gone'`
  - `context` shape: `{ world, cricket: { x, y }, hidden: boolean, singing: boolean }`
  - Bird shape: `{ x, y, vx, vy, state, stateTime, angle, targetX, targetY, speedScale, centerX, centerY }`
  - States: `'ENTER' | 'CIRCLE' | 'DIVE' | 'RETREAT' | 'GONE'`

- [ ] **Step 1: Write the failing tests**

Create `tests/birds.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { spawnBird, updateBird } from '../src/birds.js';

const world = { width: 800, height: 600, cover: [] };
const rng = () => 0.5;

function context(overrides = {}) {
  return { world, cricket: { x: 400, y: 300 }, hidden: false, singing: false, ...overrides };
}

/** Runs the bird forward until it leaves the given state, or the guard trips. */
function runUntilStateChange(bird, ctx, dt = 1 / 60, maxSteps = 5000) {
  const startState = bird.state;
  let lastEvent = 'none';
  let steps = 0;

  while (bird.state === startState && steps < maxSteps) {
    lastEvent = updateBird(bird, dt, ctx);
    steps += 1;
  }

  assert.ok(steps < maxSteps, `bird never left ${startState}`);
  return lastEvent;
}

test('a spawned bird enters from outside the meadow', () => {
  const bird = spawnBird(world, rng, 1);
  assert.equal(bird.state, 'ENTER');

  const outside =
    bird.x < 0 || bird.x > world.width || bird.y < 0 || bird.y > world.height;
  assert.ok(outside, `bird spawned inside the meadow at ${bird.x},${bird.y}`);
});

test('difficulty scales the bird speed', () => {
  const slow = spawnBird(world, rng, 1);
  const fast = spawnBird(world, rng, 2);
  assert.ok(fast.speedScale > slow.speedScale);
});

test('a bird flies in and then starts circling', () => {
  const bird = spawnBird(world, rng, 1);
  runUntilStateChange(bird, context());
  assert.equal(bird.state, 'CIRCLE');
});

test('a bird that scans a hidden, silent cricket gives up and retreats', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true, singing: false });

  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'CIRCLE');

  const event = runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'RETREAT');
  assert.equal(event, 'scanned-lost');
});

test('a bird that scans a singing cricket dives even if it is hidden', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true, singing: true });

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'DIVE', 'singing from cover gives the cricket away');
});

test('the dive targets where the cricket was at scan time, not where it is now', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'DIVE');
  assert.equal(bird.targetX, 400);
  assert.equal(bird.targetY, 300);

  ctx.cricket = { x: 700, y: 100 };
  updateBird(bird, 1 / 60, ctx);
  assert.equal(bird.targetX, 400, 'the target must not follow the cricket');
  assert.equal(bird.targetY, 300);
});

test('a dive onto a stationary cricket hits it', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  const event = runUntilStateChange(bird, ctx);

  assert.equal(event, 'hit');
  assert.equal(bird.state, 'RETREAT');
});

test('a cricket that runs far enough after the scan is missed', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context();

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);

  ctx.cricket = { x: 50, y: 550 };
  const event = runUntilStateChange(bird, ctx);

  assert.equal(event, 'missed');
  assert.equal(bird.state, 'RETREAT');
});

test('a retreating bird eventually reports that it is gone', () => {
  const bird = spawnBird(world, rng, 1);
  const ctx = context({ hidden: true });

  runUntilStateChange(bird, ctx);
  runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'RETREAT');

  const event = runUntilStateChange(bird, ctx);
  assert.equal(bird.state, 'GONE');
  assert.equal(event, 'gone');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/birds.test.js`
Expected: FAIL — cannot find module `../src/birds.js`.

- [ ] **Step 3: Write `src/birds.js`**

```js
import { CONFIG } from './config.js';

/**
 * Creates a bird just outside a random edge of the meadow.
 * `difficulty` (1 upward) scales every speed, which is how the game ramps.
 */
export function spawnBird(world, rng = Math.random, difficulty = 1) {
  const edge = Math.floor(rng() * 4) % 4;
  const margin = 120;

  const positions = [
    { x: rng() * world.width, y: -margin },
    { x: world.width + margin, y: rng() * world.height },
    { x: rng() * world.width, y: world.height + margin },
    { x: -margin, y: rng() * world.height },
  ];

  const start = positions[edge];

  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    state: 'ENTER',
    stateTime: 0,
    angle: rng() * Math.PI * 2,
    targetX: 0,
    targetY: 0,
    speedScale: difficulty,
    centerX: world.width / 2,
    centerY: world.height / 2,
    exitX: start.x,
    exitY: start.y,
  };
}

function moveToward(bird, targetX, targetY, speed, dt) {
  const dx = targetX - bird.x;
  const dy = targetY - bird.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return 0;

  const step = Math.min(distance, speed * dt);
  bird.vx = (dx / distance) * speed;
  bird.vy = (dy / distance) * speed;
  bird.x += (dx / distance) * step;
  bird.y += (dy / distance) * step;

  return distance - step;
}

function enterState(bird, state) {
  bird.state = state;
  bird.stateTime = 0;
}

/**
 * Advances one bird and reports what happened this frame.
 *
 * The dive commits to the cricket's position at scan time. That is deliberate:
 * it means a player who breaks off and runs the instant they hear the cry can
 * still escape, which is what makes the warning readable rather than decorative.
 */
export function updateBird(bird, dt, context) {
  bird.stateTime += dt;

  switch (bird.state) {
    case 'ENTER': {
      const orbitX = bird.centerX + Math.cos(bird.angle) * CONFIG.bird.circleRadius;
      const orbitY = bird.centerY + Math.sin(bird.angle) * CONFIG.bird.circleRadius * 0.6;
      const remaining = moveToward(bird, orbitX, orbitY, CONFIG.bird.enterSpeed * bird.speedScale, dt);

      if (remaining <= 1) enterState(bird, 'CIRCLE');
      return 'none';
    }

    case 'CIRCLE': {
      bird.angle += CONFIG.bird.circleSpeed * bird.speedScale * dt;
      const nextX = bird.centerX + Math.cos(bird.angle) * CONFIG.bird.circleRadius;
      const nextY = bird.centerY + Math.sin(bird.angle) * CONFIG.bird.circleRadius * 0.6;
      bird.vx = (nextX - bird.x) / Math.max(dt, 0.0001);
      bird.vy = (nextY - bird.y) / Math.max(dt, 0.0001);
      bird.x = nextX;
      bird.y = nextY;

      if (bird.stateTime < CONFIG.bird.circleSeconds) return 'none';

      // Scan: cover only saves a cricket that keeps quiet.
      if (context.hidden && !context.singing) {
        enterState(bird, 'RETREAT');
        return 'scanned-lost';
      }

      bird.targetX = context.cricket.x;
      bird.targetY = context.cricket.y;
      enterState(bird, 'DIVE');
      return 'none';
    }

    case 'DIVE': {
      const remaining = moveToward(
        bird,
        bird.targetX,
        bird.targetY,
        CONFIG.bird.diveSpeed * bird.speedScale,
        dt,
      );
      if (remaining > 1) return 'none';

      const distanceToCricket = Math.hypot(
        context.cricket.x - bird.x,
        context.cricket.y - bird.y,
      );
      enterState(bird, 'RETREAT');
      return distanceToCricket <= CONFIG.bird.hitRadius ? 'hit' : 'missed';
    }

    case 'RETREAT': {
      const remaining = moveToward(
        bird,
        bird.exitX,
        bird.exitY,
        CONFIG.bird.retreatSpeed * bird.speedScale,
        dt,
      );
      if (remaining <= 1) {
        enterState(bird, 'GONE');
        return 'gone';
      }
      return 'none';
    }

    default:
      return 'none';
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/birds.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/birds.js tests/birds.test.js
git commit -m "feat: bird state machine with scan, dive and retreat"
```

---

### Task 8: Game state machine and wave director

**Files:**
- Create: `src/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces:
  - `createGame({ storage, rng }) -> game`
  - `startRun(game) -> void`
  - `updateGame(game, intent, dt) -> Array<event>` where each event is `{ type }` with type in `'ate' | 'song-start' | 'song-break' | 'bird-spawn' | 'bird-cry' | 'hit' | 'game-over'`
  - `difficultyAt(elapsedSeconds) -> number`
  - `game` shape: `{ phase: 'MENU' | 'PLAYING' | 'GAME_OVER', world, cricket, birds, food, score, attention, lives, elapsed, hidden, newRecord }`

- [ ] **Step 1: Write the failing tests**

Create `tests/game.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, startRun, updateGame, difficultyAt } from '../src/game.js';

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

const fixedRng = () => 0.5;
const still = { dx: 0, dy: 0, sing: false };
const singing = { dx: 0, dy: 0, sing: true };

function newGame() {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  startRun(game);
  return game;
}

test('a new game sits in the menu until the run starts', () => {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  assert.equal(game.phase, 'MENU');

  startRun(game);
  assert.equal(game.phase, 'PLAYING');
  assert.equal(game.lives, CONFIG.game.startingLives);
  assert.equal(game.elapsed, 0);
  assert.equal(game.birds.length, 0);
});

test('difficulty ramps from 1 to the cap and then holds', () => {
  assert.equal(difficultyAt(0), 1);
  assert.ok(difficultyAt(CONFIG.game.difficultyRampSeconds / 2) > 1);
  assert.equal(difficultyAt(CONFIG.game.difficultyRampSeconds), CONFIG.game.difficultyMax);
  assert.equal(difficultyAt(CONFIG.game.difficultyRampSeconds * 10), CONFIG.game.difficultyMax);
});

test('nothing is simulated while in the menu', () => {
  const game = createGame({ storage: memoryStorage(), rng: fixedRng });
  updateGame(game, singing, 1);
  assert.equal(game.score.points, 0);
  assert.equal(game.elapsed, 0);
});

test('singing scores points and raises attention', () => {
  const game = newGame();
  updateGame(game, singing, 1);

  assert.ok(game.score.points > 0);
  assert.ok(game.attention.value > 0);
});

test('singing long enough summons a bird and emits the events', () => {
  const game = newGame();
  let sawSpawn = false;

  for (let i = 0; i < 600 && !sawSpawn; i += 1) {
    const events = updateGame(game, singing, 1 / 60);
    sawSpawn = events.some((event) => event.type === 'bird-spawn');
  }

  assert.ok(sawSpawn, 'no bird was ever summoned by singing');
  assert.ok(game.birds.length > 0);
});

test('the number of live birds is capped', () => {
  const game = newGame();
  for (let i = 0; i < 4000; i += 1) updateGame(game, singing, 1 / 60);
  assert.ok(game.birds.length <= CONFIG.bird.maxAlive, `${game.birds.length} birds alive`);
});

test('walking over food scores it and emits an ate event', () => {
  const game = newGame();
  game.food.items = [{ x: game.cricket.x, y: game.cricket.y, type: 'berry', value: 60, radius: 9, age: 0 }];

  const events = updateGame(game, still, 1 / 60);
  assert.ok(events.some((event) => event.type === 'ate'));
  assert.ok(game.score.points >= 60);
  assert.equal(game.score.fed, CONFIG.score.fedSeconds);
});

test('a hit costs a life, breaks the song, resets attention and grants mercy time', () => {
  const game = newGame();
  updateGame(game, singing, 2);
  game.attention.value = 0.9;
  game.score.multiplier = 3;

  // Force a dive that lands on the cricket.
  game.birds = [{
    x: game.cricket.x, y: game.cricket.y, vx: 0, vy: 0,
    state: 'DIVE', stateTime: 0, angle: 0,
    targetX: game.cricket.x, targetY: game.cricket.y,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -200, exitY: -200,
  }];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((event) => event.type === 'hit'));
  assert.equal(game.lives, CONFIG.game.startingLives - 1);
  assert.equal(game.score.multiplier, CONFIG.score.multiplierStart);
  assert.equal(game.attention.value, 0);
  assert.ok(game.cricket.invulnerableFor > 0);
});

test('an invulnerable cricket cannot be hit again', () => {
  const game = newGame();
  game.cricket.invulnerableFor = 1;
  game.birds = [{
    x: game.cricket.x, y: game.cricket.y, vx: 0, vy: 0,
    state: 'DIVE', stateTime: 0, angle: 0,
    targetX: game.cricket.x, targetY: game.cricket.y,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -200, exitY: -200,
  }];

  const events = updateGame(game, still, 1 / 60);
  assert.ok(!events.some((event) => event.type === 'hit'));
  assert.equal(game.lives, CONFIG.game.startingLives);
});

test('losing the last life ends the run and commits the high score', () => {
  const game = newGame();
  game.score.points = 1234;
  game.lives = 1;
  game.birds = [{
    x: game.cricket.x, y: game.cricket.y, vx: 0, vy: 0,
    state: 'DIVE', stateTime: 0, angle: 0,
    targetX: game.cricket.x, targetY: game.cricket.y,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -200, exitY: -200,
  }];

  const events = updateGame(game, still, 1 / 60);

  assert.ok(events.some((event) => event.type === 'game-over'));
  assert.equal(game.phase, 'GAME_OVER');
  assert.equal(game.lives, 0);
  assert.equal(game.score.highScore, 1234);
  assert.equal(game.newRecord, true);
});

test('departed birds are removed from the flock', () => {
  const game = newGame();
  game.birds = [{
    x: -300, y: -300, vx: 0, vy: 0,
    state: 'RETREAT', stateTime: 0, angle: 0,
    targetX: 0, targetY: 0,
    speedScale: 1, centerX: 400, centerY: 300,
    exitX: -300, exitY: -300,
  }];

  updateGame(game, still, 1 / 60);
  assert.equal(game.birds.length, 0);
});

test('a fresh run after game over clears the previous state', () => {
  const game = newGame();
  updateGame(game, singing, 3);
  game.phase = 'GAME_OVER';

  startRun(game);
  assert.equal(game.phase, 'PLAYING');
  assert.equal(game.score.points, 0);
  assert.equal(game.attention.value, 0);
  assert.equal(game.birds.length, 0);
  assert.equal(game.lives, CONFIG.game.startingLives);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/game.test.js`
Expected: FAIL — cannot find module `../src/game.js`.

- [ ] **Step 3: Write `src/game.js`**

```js
import { CONFIG } from './config.js';
import { createWorld, isHidden } from './world.js';
import { createCricket, updateCricket } from './cricket.js';
import { createFoodField, updateFood, consumeFood } from './food.js';
import { spawnBird, updateBird } from './birds.js';
import { createScore, tickSong, breakSong, tickFed, eat, commitHighScore } from './score.js';
import { createAttention, tickAttention, resetAttention } from './attention.js';

/** Ramps linearly from 1 to the cap over the ramp window, then holds. */
export function difficultyAt(elapsedSeconds) {
  const progress = Math.min(1, elapsedSeconds / CONFIG.game.difficultyRampSeconds);
  return 1 + (CONFIG.game.difficultyMax - 1) * progress;
}

export function createGame({ storage, rng = Math.random } = {}) {
  const world = createWorld(rng);

  return {
    phase: 'MENU',
    rng,
    world,
    cricket: createCricket(world),
    birds: [],
    food: createFoodField(),
    score: createScore(storage),
    attention: createAttention(),
    lives: CONFIG.game.startingLives,
    elapsed: 0,
    hidden: false,
    newRecord: false,
  };
}

export function startRun(game) {
  const highScore = game.score.highScore;

  game.phase = 'PLAYING';
  game.world = createWorld(game.rng);
  game.cricket = createCricket(game.world);
  game.birds = [];
  game.food = createFoodField();
  game.score = createScore(game.score.storage);
  game.score.highScore = highScore;
  game.attention = createAttention();
  game.lives = CONFIG.game.startingLives;
  game.elapsed = 0;
  game.hidden = false;
  game.newRecord = false;
}

/**
 * Advances the whole simulation one frame and returns the events the
 * presentation layer cares about. The game never draws and never plays audio —
 * it only reports what happened.
 */
export function updateGame(game, intent, dt) {
  if (game.phase !== 'PLAYING') return [];

  const events = [];
  game.elapsed += dt;

  const cricketEvents = updateCricket(game.cricket, intent, dt, game.world);
  game.hidden = cricketEvents.hidden;

  if (cricketEvents.startedSinging) events.push({ type: 'song-start' });
  if (cricketEvents.stoppedSinging) {
    breakSong(game.score);
    events.push({ type: 'song-break' });
  }

  // Singing from cover is loud but scores nothing — cover is safety, not points.
  const scoringSong = game.cricket.singing && !game.hidden;
  if (scoringSong) tickSong(game.score, dt);
  tickFed(game.score, dt);

  const { spawned } = tickAttention(game.attention, game.cricket.singing, dt);
  const difficulty = difficultyAt(game.elapsed);

  for (let i = 0; i < spawned; i += 1) {
    if (game.birds.length >= CONFIG.bird.maxAlive) break;
    game.birds.push(spawnBird(game.world, game.rng, difficulty));
    events.push({ type: 'bird-spawn' });
  }

  updateFood(game.food, dt, game.world, game.rng);
  for (const item of consumeFood(game.food, game.cricket)) {
    eat(game.score, item.value);
    events.push({ type: 'ate', food: item });
  }

  const context = {
    world: game.world,
    cricket: game.cricket,
    hidden: game.hidden,
    singing: game.cricket.singing,
  };

  const survivors = [];

  for (const bird of game.birds) {
    const previousState = bird.state;
    const event = updateBird(bird, dt, context);

    if (previousState === 'CIRCLE' && bird.state === 'DIVE') {
      events.push({ type: 'bird-cry', bird });
    }

    if (event === 'hit' && game.cricket.invulnerableFor <= 0) {
      game.lives -= 1;
      game.cricket.invulnerableFor = CONFIG.cricket.invulnerableSeconds;
      breakSong(game.score);
      resetAttention(game.attention);
      events.push({ type: 'hit', bird });
    }

    if (bird.state !== 'GONE') survivors.push(bird);
  }

  game.birds = survivors;

  if (game.lives <= 0) {
    game.phase = 'GAME_OVER';
    game.newRecord = commitHighScore(game.score);
    events.push({ type: 'game-over' });
  }

  return events;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/game.test.js`
Expected: PASS — 12 tests.

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/`
Expected: PASS — every test from Tasks 1–8.

- [ ] **Step 6: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "feat: game state machine, wave director and event stream"
```

---

### Task 9: Input

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createInput(target) -> { intent, anyKeyPressed, consumeStartRequest(), attach(), detach() }`
  - `intent` is a live object `{ dx, dy, sing }` that the game reads each frame.
  - `target` is any object with `addEventListener`/`removeEventListener` — the tests pass a fake.

- [ ] **Step 1: Write the failing tests**

Create `tests/input.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

/** A minimal stand-in for a DOM event target so input is testable under Node. */
function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, event = {}) {
      for (const handler of listeners.get(type) ?? []) {
        handler({ preventDefault() {}, ...event });
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

test('arrow keys and WASD both drive the intent', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'ArrowRight' });
  assert.equal(input.intent.dx, 1);

  target.emit('keyup', { code: 'ArrowRight' });
  assert.equal(input.intent.dx, 0);

  target.emit('keydown', { code: 'KeyW' });
  assert.equal(input.intent.dy, -1);

  target.emit('keyup', { code: 'KeyW' });
  assert.equal(input.intent.dy, 0);
});

test('opposite keys held together cancel out', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyA' });
  target.emit('keydown', { code: 'KeyD' });
  assert.equal(input.intent.dx, 0);
});

test('space sets and clears the sing flag', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'Space' });
  assert.equal(input.intent.sing, true);

  target.emit('keyup', { code: 'Space' });
  assert.equal(input.intent.sing, false);
});

test('a start request is raised once and consumed once', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  assert.equal(input.consumeStartRequest(), false);

  target.emit('keydown', { code: 'Enter' });
  assert.equal(input.consumeStartRequest(), true);
  assert.equal(input.consumeStartRequest(), false);
});

test('detach removes every listener so nothing leaks', () => {
  const target = fakeTarget();
  const input = createInput(target);

  input.attach();
  assert.ok(target.listenerCount('keydown') > 0);

  input.detach();
  assert.equal(target.listenerCount('keydown'), 0);
  assert.equal(target.listenerCount('keyup'), 0);
});

test('losing focus releases every held key', () => {
  const target = fakeTarget();
  const input = createInput(target);
  input.attach();

  target.emit('keydown', { code: 'KeyD' });
  target.emit('keydown', { code: 'Space' });
  target.emit('blur');

  assert.equal(input.intent.dx, 0);
  assert.equal(input.intent.sing, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/input.test.js`
Expected: FAIL — cannot find module `../src/input.js`.

- [ ] **Step 3: Write `src/input.js`**

```js
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const SING = ['Space'];
const START = ['Enter', 'NumpadEnter'];

const ALL_CODES = [...LEFT, ...RIGHT, ...UP, ...DOWN, ...SING, ...START];

/**
 * Turns keyboard events into a neutral intent object the simulation reads.
 * Nothing here knows about the game rules, and the game never sees a DOM event.
 */
export function createInput(target) {
  const held = new Set();
  const intent = { dx: 0, dy: 0, sing: false };
  let startRequested = false;

  function axis(negative, positive) {
    const low = negative.some((code) => held.has(code)) ? 1 : 0;
    const high = positive.some((code) => held.has(code)) ? 1 : 0;
    return high - low;
  }

  function refresh() {
    intent.dx = axis(LEFT, RIGHT);
    intent.dy = axis(UP, DOWN);
    intent.sing = SING.some((code) => held.has(code));
  }

  function onKeyDown(event) {
    if (!ALL_CODES.includes(event.code)) return;
    event.preventDefault?.();
    held.add(event.code);
    if (START.includes(event.code) || SING.includes(event.code)) startRequested = true;
    refresh();
  }

  function onKeyUp(event) {
    if (!ALL_CODES.includes(event.code)) return;
    event.preventDefault?.();
    held.delete(event.code);
    refresh();
  }

  function onBlur() {
    held.clear();
    refresh();
  }

  return {
    intent,

    consumeStartRequest() {
      const requested = startRequested;
      startRequested = false;
      return requested;
    },

    attach() {
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
    },

    detach() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/input.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "feat: keyboard input mapped to a neutral intent object"
```

---

### Task 10: Background rendering

**Files:**
- Create: `src/render/background.js`
- Modify: `src/main.js` (replace the placeholder fill)

**Interfaces:**
- Consumes: `CONFIG`; game state (read-only).
- Produces: `drawBackground(ctx, game, time)` — paints sky, ground, cover and the grass fringe. Reads state; never writes it.

- [ ] **Step 1: Write the background renderer**

Create `src/render/background.js`:

```js
import { CONFIG } from '../config.js';

/** Dusk deepens over the run, so the sky doubles as a clock. */
function skyStops(elapsed) {
  const dusk = Math.min(1, elapsed / (CONFIG.game.difficultyRampSeconds * 1.5));
  const lerp = (a, b) => Math.round(a + (b - a) * dusk);

  return {
    top: `rgb(${lerp(122, 30)}, ${lerp(170, 40)}, ${lerp(210, 78)})`,
    bottom: `rgb(${lerp(246, 92)}, ${lerp(203, 62)}, ${lerp(150, 86)})`,
  };
}

function drawCover(ctx, item, time) {
  const sway = Math.sin(time * 1.4 + item.x * 0.02) * 3;

  if (item.type === 'rock') {
    ctx.fillStyle = 'rgba(78, 84, 92, 0.95)';
    ctx.beginPath();
    ctx.ellipse(item.x, item.y, item.radius, item.radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(120, 128, 138, 0.6)';
    ctx.beginPath();
    ctx.ellipse(item.x - item.radius * 0.25, item.y - item.radius * 0.22, item.radius * 0.45, item.radius * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (item.type === 'leaf') {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.sin(time * 0.8 + item.y * 0.01) * 0.12);
    ctx.fillStyle = 'rgba(96, 128, 58, 0.92)';
    ctx.beginPath();
    ctx.ellipse(0, 0, item.radius, item.radius * 0.55, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 82, 34, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-item.radius * 0.8, -item.radius * 0.3);
    ctx.lineTo(item.radius * 0.8, item.radius * 0.3);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Grass tuft: a fan of blades that sways as one clump.
  ctx.strokeStyle = 'rgba(64, 106, 48, 0.95)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (let i = 0; i < 11; i += 1) {
    const spread = (i / 10 - 0.5) * item.radius * 1.9;
    const height = item.radius * (0.9 + Math.sin(i * 2.3) * 0.28);
    ctx.beginPath();
    ctx.moveTo(item.x + spread * 0.5, item.y + item.radius * 0.4);
    ctx.quadraticCurveTo(
      item.x + spread * 0.8 + sway,
      item.y - height * 0.4,
      item.x + spread + sway * 1.6,
      item.y - height,
    );
    ctx.stroke();
  }
}

export function drawBackground(ctx, game, time) {
  const { width, height } = game.world;
  const horizon = height * 0.28;
  const sky = skyStops(game.elapsed);

  const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, sky.top);
  gradient.addColorStop(1, sky.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizon);

  const ground = ctx.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, '#3f5a34');
  ground.addColorStop(1, '#22331f');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, width, height - horizon);

  // A pale far layer of grass along the horizon reads as depth.
  ctx.strokeStyle = 'rgba(126, 156, 96, 0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let x = -10; x < width + 10; x += 13) {
    const bladeSway = Math.sin(time * 1.1 + x * 0.05) * 5;
    ctx.beginPath();
    ctx.moveTo(x, horizon + 12);
    ctx.quadraticCurveTo(x + bladeSway * 0.5, horizon - 8, x + bladeSway, horizon - 22);
    ctx.stroke();
  }

  for (const item of game.world.cover) drawCover(ctx, item, time);
}
```

- [ ] **Step 2: Wire it into the loop**

In `src/main.js`, replace the placeholder fill block:

```js
  // Placeholder until Task 10 replaces this with the real background.
  ctx.fillStyle = '#2b3a2f';
  ctx.fillRect(0, 0, CONFIG.world.width, CONFIG.world.height);
```

with a temporary preview harness so the background can be seen before the game is wired in at Task 13:

```js
  drawBackground(ctx, previewGame, now / 1000);
```

and add near the top of `src/main.js`:

```js
import { drawBackground } from './render/background.js';
import { createWorld } from './world.js';

// Temporary preview state; Task 13 replaces this with the real game.
const previewGame = { world: createWorld(), elapsed: 0 };
```

- [ ] **Step 3: Verify in the browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.
Expected: a dusk sky over a green meadow with swaying horizon grass and nine cover objects (grass tufts, rocks and leaves), no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/render/background.js src/main.js
git commit -m "feat: meadow background with dusk sky, grass and cover"
```

---

### Task 11: Entity rendering

**Files:**
- Create: `src/render/entities.js`

**Interfaces:**
- Consumes: `CONFIG`; game state (read-only).
- Produces: `drawEntities(ctx, game, time)` — draws food, the cricket, bird shadows and birds, in that order.

- [ ] **Step 1: Write the entity renderer**

Create `src/render/entities.js`:

```js
import { CONFIG } from '../config.js';

const FOOD_COLORS = {
  seed: '#d8c07a',
  berry: '#c4426a',
  aphid: '#8fd36a',
};

function drawFood(ctx, item) {
  const bob = Math.sin(item.age * 3) * 1.5;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(item.x, item.y + item.radius * 0.9, item.radius * 0.9, item.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = FOOD_COLORS[item.type] ?? '#ffffff';
  ctx.beginPath();
  ctx.arc(item.x, item.y + bob, item.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(item.x - item.radius * 0.3, item.y + bob - item.radius * 0.3, item.radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawCricket(ctx, game, time) {
  const cricket = game.cricket;
  const r = CONFIG.cricket.radius;
  const blinking = cricket.invulnerableFor > 0 && Math.floor(time * 12) % 2 === 0;
  if (blinking) return;

  const angle = Math.atan2(cricket.dirY, cricket.dirX);
  const hop = cricket.moving ? Math.abs(Math.sin(time * 14)) * 3 : 0;

  ctx.save();
  ctx.translate(cricket.x, cricket.y - hop);
  ctx.rotate(angle);
  ctx.globalAlpha = game.hidden ? 0.4 : 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.9 + hop, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hind legs: bent, and they kick when the cricket sings.
  const kick = cricket.singing ? Math.sin(time * 40) * 0.35 : 0;
  ctx.strokeStyle = '#4c6b2f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, side * r * 0.5);
    ctx.lineTo(-r * 0.9, side * (r * 1.1 + kick * r));
    ctx.lineTo(-r * 0.2, side * (r * 1.5 + kick * r));
    ctx.stroke();
  }

  ctx.fillStyle = '#6d8f3c';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#587a30';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, 0, r * 0.85, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7fa348';
  ctx.beginPath();
  ctx.arc(r * 0.95, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c2416';
  ctx.beginPath();
  ctx.arc(r * 1.15, -r * 0.22, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 1.15, r * 0.22, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Antennae trail behind the direction of travel.
  ctx.strokeStyle = '#2f3d22';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(r * 1.2, side * r * 0.25);
    ctx.quadraticCurveTo(
      r * 2.1,
      side * r * (0.7 + Math.sin(time * 6 + side) * 0.2),
      r * 2.7,
      side * r * (1.1 + Math.sin(time * 6 + side) * 0.3),
    );
    ctx.stroke();
  }

  ctx.restore();

  if (cricket.singing) drawSongRings(ctx, cricket, game, time);
}

function drawSongRings(ctx, cricket, game, time) {
  const strength = Math.min(1, game.score.multiplier / CONFIG.score.multiplierMax);

  for (let i = 0; i < 3; i += 1) {
    const phase = (time * 1.6 + i / 3) % 1;
    const radius = 18 + phase * (70 + strength * 60);

    ctx.strokeStyle = `rgba(255, 244, 190, ${(1 - phase) * 0.55})`;
    ctx.lineWidth = 2 + strength * 2;
    ctx.beginPath();
    ctx.arc(cricket.x, cricket.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBird(ctx, bird, game, time) {
  const diving = bird.state === 'DIVE';
  const angle = Math.atan2(bird.vy, bird.vx);
  const size = diving ? 26 : 22;

  // Ground shadow: the player's warning that something is overhead.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(bird.x, Math.min(bird.y + 46, game.world.height - 4), size * 0.9, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(angle);

  const flap = Math.sin(time * (diving ? 22 : 9)) * (diving ? 0.25 : 0.75);

  ctx.fillStyle = diving ? '#12161d' : '#1d222c';
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.35, -size * (0.34 + flap * 0.4));
  ctx.lineTo(-size * 0.9, -size * 0.12);
  ctx.lineTo(-size * 1.25, 0);
  ctx.lineTo(-size * 0.9, size * 0.12);
  ctx.lineTo(-size * 0.35, size * (0.34 + flap * 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  if (bird.state === 'CIRCLE') {
    // A pulsing marker over the circling bird tells the player where the threat is.
    const pulse = 0.5 + Math.sin(time * 6) * 0.5;
    ctx.strokeStyle = `rgba(255, 96, 96, ${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, size * 1.6 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawEntities(ctx, game, time) {
  for (const item of game.food.items) drawFood(ctx, item);
  drawCricket(ctx, game, time);
  for (const bird of game.birds) drawBird(ctx, bird, game, time);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/entities.js
git commit -m "feat: cricket, food, bird and song-ring rendering"
```

---

### Task 12: HUD and overlays

**Files:**
- Create: `src/render/hud.js`

**Interfaces:**
- Consumes: `CONFIG`; game state (read-only).
- Produces: `drawHud(ctx, game)` — score, lives, multiplier, meters, hidden indicator; and `drawOverlay(ctx, game)` — menu and game-over screens.

- [ ] **Step 1: Write the HUD renderer**

Create `src/render/hud.js`:

```js
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
  const { width } = game.world;

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

  if (game.score.multiplier > CONFIG.score.multiplierStart + 0.001) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`x${game.score.multiplier.toFixed(1)}`, width / 2, 20);
  }

  ctx.textAlign = 'right';
  ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('♥'.repeat(Math.max(0, game.lives)), width - 22, 22);

  if (game.hidden) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160, 220, 255, 0.9)';
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('hidden', game.cricket.x, game.cricket.y - 42);
  }
}

function panel(ctx, game, lines) {
  const { width, height } = game.world;

  ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let y = height / 2 - (lines.length - 1) * 26;

  for (const line of lines) {
    ctx.fillStyle = line.color ?? '#ffffff';
    ctx.font = line.font ?? '600 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(line.text, width / 2, y);
    y += line.gap ?? 34;
  }
}

export function drawOverlay(ctx, game) {
  if (game.phase === 'MENU') {
    panel(ctx, game, [
      { text: 'Life of a Cricket', font: '700 48px ui-sans-serif, system-ui, sans-serif', gap: 56 },
      { text: 'Move with WASD or the arrow keys. Hold SPACE to sing.', color: 'rgba(255,255,255,0.85)' },
      { text: 'Singing scores — and it is loud. Birds come for the noise.', color: 'rgba(255,255,255,0.85)' },
      { text: 'Hide in grass, rocks and leaves. Cover only saves you if you stay quiet.', color: 'rgba(255,255,255,0.85)', gap: 52 },
      { text: 'Press ENTER to begin', color: '#ffe9a8', font: '700 22px ui-sans-serif, system-ui, sans-serif' },
    ]);
    return;
  }

  if (game.phase === 'GAME_OVER') {
    panel(ctx, game, [
      { text: 'Caught', font: '700 46px ui-sans-serif, system-ui, sans-serif', gap: 54 },
      { text: `Score ${Math.floor(game.score.points)}`, font: '700 26px ui-sans-serif, system-ui, sans-serif' },
      {
        text: game.newRecord ? 'A new best!' : `Best ${game.score.highScore}`,
        color: game.newRecord ? '#ffe9a8' : 'rgba(255,255,255,0.75)',
        gap: 52,
      },
      { text: 'Press ENTER to sing again', color: '#ffe9a8', font: '700 20px ui-sans-serif, system-ui, sans-serif' },
    ]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/hud.js
git commit -m "feat: HUD meters and menu/game-over overlays"
```

---

### Task 13: Audio and full wiring

**Files:**
- Create: `src/audio.js`
- Modify: `src/main.js` (replace the preview harness with the real game)

**Interfaces:**
- Consumes: game events from `updateGame`.
- Produces:
  - `createAudio() -> { unlock(), setSinging(active, multiplier), play(eventType), }`
  - `play` accepts `'ate' | 'bird-cry' | 'hit' | 'game-over'`.

- [ ] **Step 1: Write the audio module**

Create `src/audio.js`:

```js
/**
 * All sound is synthesized — there are no audio files in this project.
 *
 * Every call is guarded: if the browser has no AudioContext, or refuses to
 * create one, audio silently becomes a no-op rather than breaking the game.
 */
export function createAudio() {
  let ctx = null;
  let chirp = null;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const context = ensureContext();
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  }

  function blip({ frequency, duration, type = 'sine', gain = 0.2, sweepTo = null }) {
    const context = ensureContext();
    if (!context) return;

    try {
      const osc = context.createOscillator();
      const amp = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (sweepTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(sweepTo, context.currentTime + duration);
      }

      amp.gain.setValueAtTime(gain, context.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

      osc.connect(amp).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Ignore: audio is never load-bearing.
    }
  }

  /**
   * A cricket stridulates rather than sings: a high carrier chopped by a fast
   * tremolo. Amplitude-modulating a square wave gets close with two oscillators.
   */
  function startChirp() {
    const context = ensureContext();
    if (!context || chirp) return;

    try {
      const carrier = context.createOscillator();
      const tremolo = context.createOscillator();
      const tremoloDepth = context.createGain();
      const amp = context.createGain();

      carrier.type = 'square';
      carrier.frequency.value = 3400;

      tremolo.type = 'sine';
      tremolo.frequency.value = 26;
      tremoloDepth.gain.value = 0.05;

      amp.gain.value = 0.0001;

      tremolo.connect(tremoloDepth).connect(amp.gain);
      carrier.connect(amp).connect(context.destination);

      carrier.start();
      tremolo.start();

      chirp = { carrier, tremolo, amp, context };
    } catch {
      chirp = null;
    }
  }

  function stopChirp() {
    if (!chirp) return;
    try {
      chirp.amp.gain.setTargetAtTime(0.0001, chirp.context.currentTime, 0.02);
      chirp.carrier.stop(chirp.context.currentTime + 0.15);
      chirp.tremolo.stop(chirp.context.currentTime + 0.15);
    } catch {
      // Ignore.
    }
    chirp = null;
  }

  return {
    unlock,

    /** Keeps the chirp running while singing; pitch rises with the multiplier. */
    setSinging(active, multiplier = 1) {
      if (!active) {
        stopChirp();
        return;
      }

      startChirp();
      if (!chirp) return;

      try {
        chirp.carrier.frequency.setTargetAtTime(2900 + multiplier * 220, chirp.context.currentTime, 0.08);
        chirp.tremolo.frequency.setTargetAtTime(22 + multiplier * 4, chirp.context.currentTime, 0.08);
        chirp.amp.gain.setTargetAtTime(0.06, chirp.context.currentTime, 0.05);
      } catch {
        // Ignore.
      }
    },

    play(eventType) {
      switch (eventType) {
        case 'ate':
          blip({ frequency: 620, sweepTo: 980, duration: 0.12, type: 'triangle', gain: 0.16 });
          break;
        case 'bird-cry':
          blip({ frequency: 1500, sweepTo: 420, duration: 0.45, type: 'sawtooth', gain: 0.12 });
          break;
        case 'hit':
          blip({ frequency: 260, sweepTo: 70, duration: 0.5, type: 'square', gain: 0.2 });
          break;
        case 'game-over':
          blip({ frequency: 420, sweepTo: 90, duration: 1.1, type: 'sine', gain: 0.22 });
          break;
        default:
          break;
      }
    },
  };
}
```

- [ ] **Step 2: Replace `src/main.js` with the real wiring**

Overwrite `src/main.js`:

```js
import { CONFIG } from './config.js';
import { createGame, startRun, updateGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawBackground } from './render/background.js';
import { drawEntities } from './render/entities.js';
import { drawHud, drawOverlay } from './render/hud.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const game = createGame({ storage: window.localStorage, rng: Math.random });
const input = createInput(window);
const audio = createAudio();

input.attach();

// The simulation always runs in CONFIG.world units; this transform letterboxes
// that fixed world into whatever canvas the device gives us.
const view = { scale: 1, offsetX: 0, offsetY: 0 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const scale = Math.min(cssWidth / CONFIG.world.width, cssHeight / CONFIG.world.height);
  view.scale = scale;
  view.offsetX = (cssWidth - CONFIG.world.width * scale) / 2;
  view.offsetY = (cssHeight - CONFIG.world.height * scale) / 2;
}

window.addEventListener('resize', resize);
resize();

// Touch: dragging anywhere steers, and a tap in the lower band sings, so the
// game is playable on a phone without a keyboard.
let touchOrigin = null;

function touchIntent(touch) {
  const dx = touch.clientX - touchOrigin.x;
  const dy = touch.clientY - touchOrigin.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 14) {
    input.intent.dx = 0;
    input.intent.dy = 0;
    input.intent.sing = true;
    return;
  }

  input.intent.sing = false;
  input.intent.dx = dx / distance;
  input.intent.dy = dy / distance;
}

canvas.addEventListener('touchstart', (event) => {
  event.preventDefault();
  audio.unlock();
  if (game.phase !== 'PLAYING') {
    startRun(game);
    return;
  }
  const touch = event.touches[0];
  touchOrigin = { x: touch.clientX, y: touch.clientY };
  touchIntent(touch);
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
  event.preventDefault();
  if (touchOrigin) touchIntent(event.touches[0]);
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
  event.preventDefault();
  touchOrigin = null;
  input.intent.dx = 0;
  input.intent.dy = 0;
  input.intent.sing = false;
}, { passive: false });

window.addEventListener('keydown', () => audio.unlock(), { once: true });

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.game.maxFrameDelta);
  lastTime = now;
  const time = now / 1000;

  if (input.consumeStartRequest() && game.phase !== 'PLAYING') {
    startRun(game);
    // Swallow the keypress so the same press does not start a song immediately.
    input.intent.sing = false;
  }

  for (const event of updateGame(game, input.intent, dt)) {
    audio.play(event.type);
  }

  audio.setSinging(game.phase === 'PLAYING' && game.cricket.singing, game.score.multiplier);

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  drawBackground(ctx, game, time);
  if (game.phase !== 'MENU') {
    drawEntities(ctx, game, time);
    drawHud(ctx, game);
  }
  drawOverlay(ctx, game);

  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 3: Run the full test suite**

Run: `node --test tests/`
Expected: PASS — every test still passes; nothing in this task changed simulation logic.

- [ ] **Step 4: Play the game end to end**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Verify, in order:
1. The menu appears; `ENTER` starts a run.
2. WASD and arrows move the cricket; it cannot leave the meadow.
3. Holding `SPACE` while still starts the chirp, the song rings and a climbing multiplier; pressing a direction cancels the song.
4. Walking over food scores it, plays a blip and fills the fed meter.
5. Sustained singing fills the attention meter and a bird flies in, circles with a red marker, then dives with a cry.
6. Standing in cover and staying silent makes the bird lose the trail and leave; singing from cover makes it dive anyway.
7. A landed dive costs a heart, flashes the cricket and resets the meters.
8. Losing all three hearts shows the game-over panel with the score, and `ENTER` restarts.
9. The high score survives a page reload.
10. The console is clean.

- [ ] **Step 5: Commit**

```bash
git add src/audio.js src/main.js
git commit -m "feat: synthesized chirp audio and full game wiring"
```

---

### Task 14: README and final pass

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the finished game.
- Produces: documentation only.

- [ ] **Step 1: Write the README**

Create `README.md`:

````markdown
# Life of a Cricket

A browser game about being a cricket in a meadow at dusk. Eat what you find,
sing for as long as your nerve holds, and get into cover before the birds
arrive.

## Play

The game is static files with no build step. Any local static server works:

```bash
npm start          # python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` directly from the filesystem will not work — browsers block
ES module imports over `file://`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `WASD` or arrow keys | drag from anywhere |
| Sing | hold `SPACE` | tap and hold |
| Start / restart | `ENTER` | tap |

## How it plays

- **Eating** scores points and fills the *fed* meter.
- **Singing** scores points per second, and the multiplier climbs the longer you
  hold an unbroken note — twice as fast while you are fed. Moving cancels it.
- Singing fills the *attention* meter. Each threshold it crosses summons a bird.
- Birds fly in, circle while they scan, then dive at wherever you were when they
  scanned — so breaking off and running can still save you.
- **Cover** hides you, but you score nothing there, and singing from cover gives
  you away. Safety and points are mutually exclusive; that is the game.
- Three lives. Dusk deepens and the birds get faster the longer you last.

## Development

```bash
npm test           # node --test tests/
```

No dependencies, no bundler, no transpiler. Simulation modules under `src/` are
pure logic and unit tested under Node; `src/render/` only reads state and draws.

Tunable numbers all live in `src/config.js`.
````

- [ ] **Step 2: Run the full suite one last time**

Run: `node --test tests/`
Expected: PASS — all tests across all modules.

- [ ] **Step 3: Confirm the no-dependency constraint holds**

Run: `cat package.json`
Expected: no `dependencies` or `devDependencies` key.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with controls, rules and development notes"
```

---

## Self-Review Notes

Checked against `docs/superpowers/specs/2026-08-15-life-of-a-cricket-design.md`:

- Every spec section maps to a task: movement/singing → 3, food and fed meter →
  6 and 4, attention/birds → 5 and 7, cover → 2, progression and end state → 8,
  presentation → 10–12, architecture → all, error handling → 4 (storage), 13
  (audio), 1 (frame delta clamp), testing → tests in 2–9.
- `src/render/` is drawn from the spec's file list; `src/render/background.js`,
  `entities.js` and `hud.js` cover it.
- Names are consistent across tasks: `isHidden`, `clampToBounds`,
  `randomOpenPoint`, `updateCricket`, `tickSong`, `breakSong`, `tickFed`, `eat`,
  `commitHighScore`, `tickAttention`, `resetAttention`, `spawnBird`,
  `updateBird`, `updateFood`, `consumeFood`, `updateGame`, `startRun`,
  `difficultyAt`, `createInput`, `createAudio`, `drawBackground`,
  `drawEntities`, `drawHud`, `drawOverlay`.
- The spec's "no assets" and "no build step" constraints are enforced by the
  Global Constraints section and verified in Task 14 Step 3.
