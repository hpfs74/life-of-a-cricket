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
| Strike | `F` | — |
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
- **Days pass** on a light cycle that runs from bright, down through midnight
  and back. Birds hunt by day; bats take over at night.
- **Water** cuts the meadow: a meandering stream plus a pond or two. You cannot
  walk into it — you stop at the bank and slide along it — but a leap clears the
  narrow stretches, so the stream is terrain to route around rather than a wall.
- **Every new day the meadow rearranges itself.** The grass moves, the stream
  finds a new course and the spiders take new tufts, so yesterday's map is worth
  nothing today. You are never buried by it: spiders keep clear of wherever you
  are standing, and you are walked to safe dry ground if the new terrain lands
  on top of you.
- **Spiders** live inside four of the meadow's tufts, and they are the exception
  to all of the above: they hunt by touch, so hiding and keeping quiet is
  exactly what walks you into one. Look for glinting eyes and web strands before
  you dive for cover. They tense visibly before they lunge — leap then, or run
  out of reach.
- **Ants and beetles** roam the same meadow. They are no threat on their own,
  but they eat the same food, so a crumb you walk past may not be there when you
  come back.
- **You can fight them for it.** `F` swings at whatever is in front of you. An
  ant drops at one blow; a beetle takes two and bites back for the first, which
  stuns you for half a second — no life lost, but a bad moment to be frozen.
  A killed bug leaves a **grub** worth more than a berry, and a beetle leaves
  two. Swinging is loud, so a long scrap summons predators just as singing does.
  Bugs wander back in over time, so the meadow is never farmed out.
- The meadow is three screens wide and scrolls to follow you.
- Three lives, and the predators get faster the longer you last.

## The house

Far to the east of the meadow there is a doorway. Walk into it and the game
moves indoors, carrying your score, your lives and the day with it. You can walk
back out whenever you like.

The house is drawn in cross-section, both floors at once, with a stairwell
joining them — so you can watch the cat coming before it reaches you. Furniture
replaces grass as cover, spills and a pet bowl replace the stream, and the
house's own ants and beetles are still after the same crumbs.

Birds and bats never come inside. Instead:

- **The cat** hunts. It prowls, notices anything exposed — and a singing cricket
  carries much further than a moving one — then stalks and pounces at where you
  were when it committed. Furniture breaks its interest outright, and it climbs
  the stairs after you. A leap clears a pounce, exactly as it clears a dive.
- **The human** never hunts and never notices you. It crosses a room on its own
  schedule behind a spreading shadow, and anything caught in the open under a
  footfall is crushed. Leaping does not help — there is nowhere above a foot to
  be. Only furniture saves you.
- **Spiders** live here too, behind the furniture, exactly as they do in the
  grass.

Houses do not rearrange themselves overnight, so the daily reshuffle stays
outdoors.

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
| `src/world.js` | World geometry: bands of walkable ground, cover and water placement, hiding, doorways and jump targeting |
| `src/daylight.js` | The day/night clock: day number, darkness, whether it is night |
| `src/cricket.js` | Player movement, singing and leaping |
| `src/birds.js` | Predator state machine, shared by day birds and night bats |
| `src/rivals.js` | Ants and beetles competing for the food |
| `src/spiders.js` | Ambush predators that hold cover |
| `src/water.js` | Streams and ponds, as overlapping circles |
| `src/house.js` | The two-floor house: bands, stairs, furniture, doorway |
| `src/cat.js` | The house cat: prowl, stalk, pounce, and the stairs |
| `src/human.js` | The human: a schedule, a shadow, and heavy feet |
| `src/food.js` | Food spawning and eating |
| `src/score.js` | Score, multiplier, fed meter, high score |
| `src/attention.js` | Attention meter and its spawn thresholds |
| `src/camera.js` | Horizontal camera that follows the cricket |
| `src/game.js` | State machine, wave director, event stream |
| `src/input.js` | Keyboard → a neutral intent object |
| `src/audio.js` | Synthesized ambience, calls and effects (no audio files) |
| `src/render/` | Drawing only; never mutates game state |

Rendering is split by coordinate space: the sky (or the house backdrop) is drawn
in view space so it stays put, the ground and entities in world space behind the
camera transform, and the HUD back in view space on top.

Both stages are the same shape of data — bands of walkable ground, cover to hide
in, water to avoid — so the cricket, the food, the rival bugs, the spiders and
the camera all work indoors and out without knowing which they are in. A meadow
is simply a house with one floor and no stairs.

The design and implementation notes live in `docs/superpowers/`.
