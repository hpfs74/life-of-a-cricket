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
| Sing | hold `SPACE` | touch and hold still |
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
npm test           # node --test
```

No dependencies, no bundler, no transpiler. Simulation modules under `src/` are
pure logic and unit tested under Node; `src/render/` only reads state and draws.

Tunable numbers all live in `src/config.js` — speeds, scoring rates, meter
rates, spawn intervals and the difficulty ramp.

### Layout

| Path | Responsibility |
| --- | --- |
| `src/world.js` | Meadow bounds, the horizon, cover placement, hiding checks |
| `src/cricket.js` | Player movement and singing |
| `src/birds.js` | Bird state machine: enter, circle, scan, dive, retreat |
| `src/food.js` | Food spawning and eating |
| `src/score.js` | Score, multiplier, fed meter, high score |
| `src/attention.js` | Attention meter and its spawn thresholds |
| `src/game.js` | State machine, wave director, event stream |
| `src/input.js` | Keyboard → a neutral intent object |
| `src/audio.js` | Synthesized stridulation and effects (no audio files) |
| `src/render/` | Drawing only; never mutates game state |

The design and implementation notes live in `docs/superpowers/`.
