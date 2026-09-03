// Dumps a per-frame trace of a scripted play session from the JS `Game`, so
// the Swift port can be replayed against the identical scenario and compared
// frame by frame. Companion to dump-world-fixture.mjs, which does the same
// for one static piece of state (a freshly generated meadow) rather than a
// running simulation.
//
// Regenerate with:
//   node swift/tools/dump-game-trace.mjs <scenario> > <fixture path>
//
// The scenario's driver logic (what intent to send on which frame, and any
// one-time state setup) is duplicated by hand in
// DifferentialTraceTests.swift. That duplication is inherent to any
// cross-language differential test: the two drivers are what apply identical
// inputs to two independent implementations, so their outputs can be
// compared. Keep the two in lockstep by hand when editing either one.
import { CONFIG } from '../../src/config.js';
import { createGame, startRun, updateGame } from '../../src/game.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

const dt = 1 / 60;
const idle = { dx: 0, dy: 0, sing: false, jump: false, strike: false };

/** Canonical, float-free string for one event, so the trace can be compared
 * by exact string equality rather than by float formatting. */
function traceEvent(e) {
  switch (e.type) {
    case 'song-start': return 'song-start';
    case 'song-break': return 'song-break';
    case 'jump': return 'jump';
    case 'land': return 'land';
    case 'strike': return `strike:${e.connected ? 'hit' : 'miss'}`;
    case 'bug-hit': return `bug-hit:${e.kind}`;
    case 'bug-killed': return `bug-killed:${e.kind}:${e.drops}`;
    case 'stunned': return `stunned:${e.kind}`;
    case 'ate': return `ate:${e.food.type}`;
    case 'rival-ate': return `rival-ate:${e.food.type}`;
    case 'bird-spawn': return `bird-spawn:${e.kind}`;
    case 'bird-cry': return `bird-cry:${e.kind}`;
    case 'spider-wake': return 'spider-wake';
    case 'spider-lunge': return 'spider-lunge';
    case 'spider-hit': return 'spider-hit';
    case 'spider-miss': return 'spider-miss';
    case 'cat-noticed': return 'cat-noticed';
    case 'cat-lost': return 'cat-lost';
    case 'cat-pounced': return 'cat-pounced';
    case 'cat-missed': return 'cat-missed';
    case 'human-approaching': return 'human-approaching';
    case 'footfall': return 'footfall';
    case 'human-gone': return 'human-gone';
    case 'new-day': return `new-day:${e.day}`;
    case 'stage-change': return `stage-change:${e.stage}`;
    case 'hit': return `hit:${e.from}`;
    case 'game-over': return 'game-over';
    default: throw new Error(`unhandled event type in trace: ${e.type}`);
  }
}

function snapshot(game, frameEvents) {
  return {
    elapsed: game.elapsed,
    phase: game.phase === 'MENU' ? 'menu' : game.phase === 'PLAYING' ? 'playing' : 'gameOver',
    stage: game.stage,
    day: game.day,
    night: game.night,
    lives: game.lives,
    points: game.score.points,
    multiplier: game.score.multiplier,
    attention: game.attention.value,
    cricketX: game.cricket.x,
    cricketY: game.cricket.y,
    singing: game.cricket.singing,
    jumping: game.cricket.jumping,
    stunnedFor: game.cricket.stunnedFor,
    hidden: game.hidden,
    birds: game.birds.length,
    rivals: game.rivals.length,
    spiders: game.spiders.length,
    food: game.food.items.length,
    newRecord: game.newRecord,
    events: frameEvents.map(traceEvent),
  };
}

// Each scenario is a one-time `setup` (run once, right after `startRun`, to
// place the board for the encounter the scenario means to exercise) plus an
// `intentFor(game, frameIndex)` driver that may also mutate `game` directly —
// e.g. teleporting the cricket onto a doorway — before its intent is applied.
// Frame indices below are derived from CONFIG constants, not from reading
// results back out of the simulation mid-run, so the same script produces the
// same sequence of inputs regardless of implementation.
const scenarios = {
  // A long stretch of singing, interrupted every two seconds by a single-frame
  // jump press: song scoring and the attention meter it drives, the birds
  // (and, once night falls partway through, bats) it eventually summons, and
  // — because the jump is a fresh press each time — the full jump/land cycle
  // and the song-break it forces (a leap cancels singing outright). Long
  // enough (2400 frames = 40s) that the birds it keeps drawing eventually spend
  // every life: the only scenario that runs a game to game-over purely through
  // aerial predators.
  singing: {
    seed: 7,
    frames: 2400,
    setup() {},
    intentFor(game, i) {
      if (i > 0 && i % 120 === 0) return { dx: 0, dy: 0, sing: false, jump: true, strike: false };
      return { dx: 0, dy: 0, sing: true, jump: false, strike: false };
    },
  },

  // A long baseline stretch of silence: food spawn/settle/consumption, rival
  // wandering, respawn timers and the meals they eat (rival-ate), and the
  // patrol clock's own bird spawns, none of which the singing scenario
  // touches. 1830 frames (30.5s) is deliberately just past one full day
  // (CONFIG.game.secondsPerDay = 30): it crosses night — the dark half of the
  // very first day, roughly frames 450-1350, so any bird the patrol clock
  // spawns there is a bat — and then a day rollover, which rebuilds the
  // meadow from scratch (`reshuffleMeadow`, the single largest RNG consumer
  // in the game) and reseeds its spiders and rivals.
  'silent-baseline': {
    seed: 21,
    frames: 1830,
    setup() {},
    intentFor() { return idle; },
  },

  // A connecting strike against a beetle: the first hit stuns and knocks the
  // cricket back (retaliation); the beetle's own strike-reaction ("still
  // standing, and cross about it" — its nibbleFor is zeroed, so it wanders
  // rather than sitting still) means the exact spot to close back in on has
  // to be read from the live rival, not predicted from a fixed frame budget.
  // The driver below reacts to distance and the stun timer every frame
  // instead: chase until in range, then strike. Because both language's
  // simulations are being driven from identical state (that is what this
  // whole harness is proving), the same reactive rule produces the same
  // sequence of intents in both, and the second hit kills and scatters two
  // grubs — the trig-heavy path in `swing` that nothing else here reaches.
  combat: {
    seed: 7,
    frames: 150,
    setup(game) {
      game.cricket.dirX = 1;
      game.cricket.dirY = 0;
      game.rivals = [{
        x: game.cricket.x + 20, y: game.cricket.y,
        dirX: 1, dirY: 0, kind: 'beetle',
        health: CONFIG.rivals.health.beetle,
        flashFor: 0, nibbleFor: 0, phase: 0,
        targetX: game.cricket.x + 20, targetY: game.cricket.y,
      }];
    },
    intentFor(game) {
      const rival = game.rivals[0];
      if (!rival) return idle; // already dead: nothing left to do
      if (game.cricket.stunnedFor > 0) return idle; // riding out the stun

      const dx = rival.x - game.cricket.x;
      const dy = rival.y - game.cricket.y;
      const reach = CONFIG.cricket.strike.reach + CONFIG.rivals.radius;

      if (Math.hypot(dx, dy) > reach) {
        return { dx, dy, sing: false, jump: false, strike: false };
      }
      return { dx: 0, dy: 0, sing: false, jump: false, strike: true };
    },
  },

  // A full round trip: meadow, through the door into the house, and back out
  // to the meadow again. Exercises `changeStage` in both directions — the
  // cast teardown/setup, the spider and rival reseeding, and the RNG draws
  // `createHouse`/`createCat`/`createHumanSchedule` consume — none of which
  // the other scenarios ever touch.
  'house-round-trip': {
    seed: 15,
    frames: 120,
    setup(game) {
      // Stand exactly in the meadow doorway, so the very first frame crosses.
      game.cricket.x = game.world.door.x;
      game.cricket.y = game.world.door.y;
    },
    intentFor(game, i) {
      // Frame 85: the house's own arrival grace period (stageCooldown =
      // 1.2s = 72 frames) has cleared by a comfortable margin; step onto the
      // house's own front door so this frame crosses back to the meadow.
      if (i === 85) {
        game.cricket.x = game.world.door.x;
        game.cricket.y = game.world.door.y;
      }
      return idle;
    },
  },

  // Teleports the cricket into a spider's own tuft and holds it there. A
  // spider is disturbed by touch, not sound or sight, so standing still on
  // top of one is enough: it wakes, winds up and lunges — and because the
  // cricket never moves away, it keeps connecting each time the spider
  // recovers and re-triggers, running out every life. Exercises the entire
  // spider state machine (LURKING -> WINDUP -> LUNGE -> RECOVER), which none
  // of the other scenarios ever touch.
  'spider-encounter': {
    seed: 7,
    frames: 350,
    setup(game) {
      const spider = game.spiders[0];
      game.cricket.x = spider.homeX;
      game.cricket.y = spider.homeY;
    },
    intentFor() { return idle; },
  },

  // Steps through the meadow door on the very first frame (stageCooldown is
  // 0 on a fresh run, so the crossing happens immediately) and then holds
  // still indoors for a long stretch. Long enough for the cat to prowl into
  // notice range, stalk and pounce, and for the human's own schedule
  // (9-18s between crossings) to send at least one full walk through —
  // approaching, footfalls, gone — and, eventually, to run out of lives.
  // Exercises the cat and the human, neither of which any other scenario
  // ever goes indoors long enough to meet.
  'house-siege': {
    seed: 15,
    frames: 1900,
    setup(game) {
      game.cricket.x = game.world.door.x;
      game.cricket.y = game.world.door.y;
    },
    intentFor() { return idle; },
  },
};

const name = process.argv[2];
const scenario = scenarios[name];
if (!scenario) {
  throw new Error(`unknown scenario '${name}'. Known: ${Object.keys(scenarios).join(', ')}`);
}

const game = createGame({ storage: memoryStorage(), rng: seededRng(scenario.seed) });
startRun(game);
scenario.setup(game);

const frames = [];
for (let i = 0; i < scenario.frames; i += 1) {
  const intent = scenario.intentFor(game, i);
  const events = updateGame(game, intent, dt);
  frames.push(snapshot(game, events));
}

// No pretty-printing: this fixture is machine-read only, and one entry per
// frame for a few hundred frames adds up fast.
process.stdout.write(JSON.stringify({ scenario: name, seed: scenario.seed, frames }));
