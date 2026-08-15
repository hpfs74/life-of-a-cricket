# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                          # node --test — the whole suite
node --test tests/spiders.test.js # one file
node --test --test-name-pattern "leap"  # one test by name
npm start                         # python3 -m http.server 8000, then open localhost:8000
```

`index.html` must be served over HTTP — opening it via `file://` fails because browsers block ES module imports there.

## Hard constraints

These are structural, not preferences. Breaking any of them breaks the deploy.

- **Zero dependencies.** `package.json` must never gain `dependencies` or `devDependencies`. No bundler, no transpiler, no test framework beyond `node:test`, no asset files — all visuals are canvas primitives and all audio is synthesized WebAudio.
- **No build step.** The files in the repo are the files that ship. `.github/workflows/deploy.yml` syncs `index.html`, `styles.css`, `src/*.js` and `src/render/*.js` verbatim to S3 — **a new source directory below `src/render/` will not be uploaded** unless that `--include` list is extended.
- **Explicit `.js` extensions on every import.** Browsers require them; Node accepts them. `"type": "module"` in `package.json` makes the same files work in both.
- **All tunable numbers live in `src/config.js`.** Logic modules read `CONFIG`; they do not carry literals.

## Architecture

Three layers, strictly separated:

1. **Simulation** (`src/*.js`, except `main.js`, `audio.js`, `render/`) — pure logic, no DOM, no canvas, unit tested under Node.
2. **Presentation** (`src/render/*.js`, `src/audio.js`) — reads game state and draws or plays it. **Never mutates simulation state.**
3. **Wiring** (`src/main.js`) — owns the rAF loop, the letterbox transform, and the input merge.

### The event stream is the seam

`updateGame(game, intent, dt)` advances everything one frame and **returns an array of events**; it never draws and never plays audio. `main.js` feeds those events to `audio.play()`, which switches on `event.type`. Adding a sound means pushing an event from `game.js` and adding a `case` in `src/audio.js` — the simulation stays ignorant of the fact that sound exists.

### Both stages are one data shape

The meadow (`src/world.js`) and the house (`src/house.js`) produce the same structure: `bands` of walkable ground, `cover` to hide in, `water` to avoid, a `door`, and optional `stairs`. A meadow is a house with one band and no stairs. Because of this, the cricket, food, rivals, spiders and camera all work indoors and out without knowing which stage they are in, and `changeStage()` in `game.js` swaps worlds by rebuilding the cast, not by branching gameplay.

Only the cast is stage-specific: birds/bats are gated on `game.stage === 'meadow'`; `game.cat` and `game.humans` are `null` outdoors.

`bandAt()` is the primitive that makes floors work — because bands occupy disjoint y ranges, furniture upstairs cannot hide anything downstairs, and no code outside `world.js` needs a concept of "floor".

### Coordinate spaces

The simulation always runs in `CONFIG.world` units. `main.js` letterboxes a fixed `CONFIG.view` (960×600) into whatever canvas the device provides. Rendering order matters:

- Sky / house backdrop — **view space** (stays put)
- Ground and entities — **world space**, behind the camera translate
- HUD and overlay — **view space**, on top
- Touch controls and the rotate prompt — **screen space**, drawn over the letterbox so they never cover the playfield

The world (2880 wide) is three views wide; `src/camera.js` scrolls horizontally to follow.

### Input

`src/input.js` (keyboard) and `src/touch.js` (on-screen stick and buttons) both produce the same neutral intent object `{dx, dy, sing, jump, strike}`. `main.js` ORs them together, so holding both sources simply means the action is held. Anything reading input reads the merged intent, never a key code.

## Tests

`node:test` with `assert/strict`, one file per simulation module. Conventions worth matching:

- **World generation takes an `rng` parameter** so tests can inject determinism. Most test files define a local `seededRng(seed)` LCG. Note the trap documented in `tests/game.test.js`: the simpler `fixedRng = () => 0.5` is degenerate and yields a meadow with **no cover** — tests that need real cover must use a seeded LCG.
- `createGame({ storage })` takes a storage object, so tests pass a `memoryStorage()` stub instead of touching `localStorage`.
- Tests assert on the returned event array and on state invariants (cover separation, nothing spawning in water, nothing burying the cricket on a reshuffle), not on rendering.

Nothing under `src/render/` has tests — that layer is deliberately thin and stateless.

## Deploy

Every push to `main` runs the suite, then publishes to `https://theteresa.com/life-of-a-cricket` via OIDC (no stored AWS keys). A red suite never reaches the site. The sync deliberately omits `--delete` and the IAM role has no delete permission, because the bucket also serves the rest of `theteresa.com`.

## Docs

`docs/superpowers/specs/` holds the approved design (including the design pillars the mechanics answer to); `docs/superpowers/plans/` holds the implementation plan. The README documents gameplay rules and the per-file responsibility table — consult it before inferring what a module does.

Game design is by Anna Teresa Salvestrini; gameplay-affecting changes are hers to call, not refactors to make unilaterally.
