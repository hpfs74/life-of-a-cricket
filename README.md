# Life of a Cricket

A browser game about being a cricket in a meadow. Eat what you find, sing for as
long as your nerve holds, and get into cover before the birds arrive — or, after
dark, the bats.

Game design by **Anna Teresa Salvestrini**.

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
| Sing | hold `E` | touch and hold still |
| Leap to cover | `SPACE` | quick tap |
| Start / restart | `ENTER` | tap |
| Mute | `M` | — |

The credits scroll continuously at the foot of the title screen.

## How it plays

- **Eating** scores points and fills the *fed* meter.
- **Singing** scores points per second, and the multiplier climbs the longer you
  hold an unbroken note — twice as fast while you are fed. Moving cancels it.
- Singing fills the *attention* meter, and each threshold it crosses summons a
  predator. They also **patrol on their own schedule**, so silence is quieter
  but never safe.
- Predators fly in, circle while they scan, then dive at wherever you were when
  they scanned — so breaking off and running can still save you.
- **Cover** hides you, but you score nothing there, and singing from cover gives
  you away. Safety and points are mutually exclusive; that is the game.
- **Leaping** carries you to the nearest cover in the direction you are holding.
  You cannot steer, sing or cancel in mid-air — but being airborne dodges a
  dive, which makes the leap the other answer to a predator's cry.
- **Days pass** on a dawn-to-midnight-to-dawn cycle. Birds hunt by day; bats
  take over at night.
- **Spiders** live inside four of the meadow's tufts, and they are the exception
  to all of the above: they hunt by touch, so hiding and keeping quiet is
  exactly what walks you into one. Look for glinting eyes and web strands before
  you dive for cover. They tense visibly before they lunge — leap then, or run
  out of reach.
- **Ants and beetles** roam the same meadow. They are no threat, but they eat
  the same food, so a crumb you walk past may not be there when you come back.
- The meadow is three screens wide and scrolls to follow you.
- Three lives, and the predators get faster the longer you last.

## Development

```bash
npm test           # node --test
```

No dependencies, no bundler, no transpiler. Simulation modules under `src/` are
pure logic and unit tested under Node; `src/render/` only reads state and draws.

Tunable numbers all live in `src/config.js` — speeds, scoring rates, meter
rates, jump range and cooldown, day length, spawn intervals and the difficulty
ramp.

### Layout

| Path | Responsibility |
| --- | --- |
| `src/world.js` | Meadow bounds, the horizon, cover placement, hiding and jump targeting |
| `src/daylight.js` | The day/night clock: day number, darkness, whether it is night |
| `src/cricket.js` | Player movement, singing and leaping |
| `src/birds.js` | Predator state machine, shared by day birds and night bats |
| `src/rivals.js` | Ants and beetles competing for the food |
| `src/spiders.js` | Ambush predators that hold cover |
| `src/food.js` | Food spawning and eating |
| `src/score.js` | Score, multiplier, fed meter, high score |
| `src/attention.js` | Attention meter and its spawn thresholds |
| `src/camera.js` | Horizontal camera that follows the cricket |
| `src/game.js` | State machine, wave director, event stream |
| `src/input.js` | Keyboard → a neutral intent object |
| `src/audio.js` | Synthesized ambience, calls and effects (no audio files) |
| `src/render/` | Drawing only; never mutates game state |

Rendering is split by coordinate space: the sky is drawn in view space so it
stays put, the ground and entities in world space behind the camera transform,
and the HUD back in view space on top.

The design and implementation notes live in `docs/superpowers/`.
