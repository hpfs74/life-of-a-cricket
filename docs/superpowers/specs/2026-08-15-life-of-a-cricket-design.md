# Life of a Cricket — Design

**Date:** 2026-08-15
**Status:** Approved

## Overview

A browser game about being a cricket in a meadow at dusk. The player roams a
single fixed screen, eats food for points, and sings for a points-per-second
stream that climbs the longer the note is held. Singing is loud: it draws birds.
The player must break off and hide in cover before a dive lands.

The game runs from a static `index.html` with no build step and no dependencies.

## Design pillars

1. **Safety and points are mutually exclusive.** Singing requires standing
   still, and hiding in cover scores nothing. Every second is a decision.
2. **Greed is punished on a delay.** Attention builds while singing and birds
   take time to arrive, so the player who sings one second too long loses a life
   for a choice made several seconds earlier.
3. **No assets.** All visuals are drawn with canvas primitives; all audio is
   synthesized with WebAudio. The whole game is text files.

## Core loop

```
roam → eat food (points + fed meter) → stand still and sing (points/sec, rising
multiplier) → attention meter fills → birds spawn and circle → break off and
reach cover → bird scans, loses the player, leaves → repeat, escalating
```

## Mechanics

### Movement

- WASD and arrow keys, free 2D roaming within the meadow bounds.
- Touch: drag anywhere to steer, so the game is playable on a phone.
- The cricket cannot move while singing. Releasing the sing key restores
  movement immediately.

### Singing

- Hold `Space` to sing.
- Base rate: 10 points per second.
- Multiplier starts at ×1.0 and climbs **+0.2 per second** of unbroken song,
  capped at **×5.0**. With the fed bonus (below), the climb rate is doubled.
- The streak breaks — and the multiplier resets to ×1.0 — when the player
  releases the key, moves, or is hit by a bird.
- Singing from inside cover does not score and reveals the player's position to
  any scanning bird, so cover is safe only in silence.
- Feedback: expanding translucent rings from the cricket, plus a synthesized
  stridulation chirp whose pitch rises with the multiplier.

### Food

- Berries, seeds and aphids spawn at intervals at random open positions, up to a
  cap on screen at once. Each type is worth a different flat score.
- Eating is proximity-based: walk over the item.
- Eating also fills a **fed** meter, which decays slowly over time. While fed,
  the song multiplier climbs at double rate. This makes the intended rhythm
  *eat, then sing* rather than choosing one activity over the other.

### Attention and birds

- The **attention** meter rises while the player sings and decays while silent.
- Crossing an attention threshold spawns a bird. Higher attention means more
  birds present at once and faster dives.
- Bird lifecycle: `ENTER` (fly in from a screen edge, with a warning shadow and
  a cry) → `CIRCLE` (orbit the meadow while scanning) → `DIVE` (accelerate at
  the last known player position) → `RETREAT` (leave the screen).
- At the end of the circle phase the bird scans. If the player is in cover *and*
  silent, the bird loses the trail and retreats. Otherwise it commits to a dive
  at the player's position at scan time — so moving after the scan can still
  save the player.
- A landed dive costs one life. The player then gets brief invulnerability, the
  attention meter resets, and any song streak breaks.

### Cover

- Grass tufts, rocks and leaves are placed around the meadow at level setup.
- Standing within a cover object's radius hides the player: the cricket dims to
  a silhouette and a "hidden" indicator appears.
- Cover blocks nothing else — food can be eaten while hidden.

### Progression and end state

- The player starts with **3 lives**.
- Dusk deepens continuously over the run as a visual clock. A wave director
  ramps bird spawn frequency and dive speed with elapsed time.
- The run ends at 0 lives. The final score and a high score persisted in
  `localStorage` are shown, with a restart option.

## Presentation

Hand-drawn vector art, all canvas primitives:

- Warm dusk gradient sky darkening over the run.
- Layered grass, with the back layer paler for depth, swaying on a sine offset.
- Cricket: olive rounded body, jointed hind legs, antennae that trail behind
  movement.
- Birds: flat dark angular silhouettes — no interior detail, which reads as more
  menacing and costs nothing to draw.
- HUD: score, lives, multiplier, fed meter, attention meter.

## Architecture

ES modules loaded directly by the browser. No bundler, no package manager, no
transpiler. Each module owns one concern and exposes a small explicit interface;
rendering is kept separate from simulation so the logic modules stay testable
under Node.

```
index.html          canvas element + module entry point
styles.css          page chrome, centering, overlays

src/
  main.js           canvas setup, resize handling, requestAnimationFrame loop
  game.js           state machine (MENU / PLAYING / GAME_OVER), wave director
  config.js         all tunable constants in one place
  input.js          keyboard and touch → a neutral intent object
  cricket.js        player position, movement, singing, cover check
  birds.js          bird entities and their state machine
  food.js           spawning, lifetime, consumption
  world.js          meadow bounds, cover object layout, scenery
  score.js          score, multiplier, fed meter, localStorage high score
  attention.js      attention meter and spawn thresholds
  audio.js          WebAudio chirp synthesis
  render/
    background.js   sky gradient, grass layers
    entities.js     cricket, birds, food, cover
    hud.js          meters, score, overlays
```

Data flow each frame: `input` produces an intent → `game` advances `cricket`,
`food`, `attention`, `birds`, `score` against that intent and a delta time →
`render/*` draws the resulting state. Renderers read state and never mutate it.

## Error handling

- WebAudio is initialized lazily on first user gesture (browser autoplay policy)
  and every audio call is a no-op if the context is unavailable, so a blocked or
  unsupported audio context never breaks the game.
- `localStorage` reads and writes are wrapped; a failure (private browsing,
  disabled storage) degrades to an in-memory high score for the session.
- The frame delta is clamped to a maximum, so a backgrounded tab returning after
  a long pause cannot teleport entities through cover or skip a dive.

## Testing

Pure logic is unit tested with Node's built-in test runner (`node --test`),
which requires no packages and runs the same ES modules the browser loads:

- `score.js` — multiplier climb rate, cap, fed bonus, streak break and reset.
- `attention.js` — rise while singing, decay while silent, threshold crossings.
- `cricket.js` — movement clamping to bounds, movement blocked while singing,
  cover detection at boundary distances.
- `birds.js` — state transitions, scan outcome for hidden/silent vs. exposed,
  dive targeting the scan-time position.
- `food.js` — spawn cap, consumption proximity, scoring by type.
- `game.js` — wave director ramp, life loss, game over transition.

Rendering, feel and pacing are verified by running the game in Chrome and
playing it.

## Out of scope

Multiplayer, level editor, save/resume mid-run, mobile app packaging, leaderboard
beyond the local high score, and any art or audio asset files.
