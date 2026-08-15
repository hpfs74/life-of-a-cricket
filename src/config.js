export const CONFIG = {
  // The window onto the world. The meadow is wider than this, so the camera
  // scrolls sideways to follow the cricket.
  view: {
    width: 960,
    height: 600,
    // How quickly the camera catches up, as a fraction of the gap per second.
    followPerSecond: 6,
  },

  world: {
    width: 2880,
    height: 600,
    // Everything above this fraction of the height is sky. The ground below it
    // is the playable field: the cricket, cover and food all stay inside it.
    horizonFraction: 0.28,
    edgeMargin: 24,
    coverCount: 26,
    coverMinRadius: 34,
    coverMaxRadius: 58,
    coverMinSeparation: 100,
    spawnClearance: 48,
  },

  cricket: {
    radius: 12,
    speed: 190,
    invulnerableSeconds: 1.6,

    jump: {
      range: 320,
      // Half-angle of the cone a held direction restricts the search to.
      halfAngleDegrees: 70,
      speed: 620,
      minSeconds: 0.25,
      maxSeconds: 0.6,
      cooldownSeconds: 0.5,
      // Used when there is no cover in range: a plain hop forward.
      fallbackDistance: 90,
      // Render-only: how high the arc lifts the cricket off its shadow.
      arcHeight: 46,
    },
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
    maxOnScreen: 12,
    spawnIntervalSeconds: 1.5,
    eatRadius: 20,
    types: {
      seed: { value: 25, radius: 6 },
      lettuce: { value: 45, radius: 12 },
      berry: { value: 60, radius: 9 },
      aphid: { value: 120, radius: 7 },
    },
  },

  // Spiders live inside cover. They are the exception to the game's core rule:
  // hiding and keeping quiet beats anything with wings, but not one of these.
  spiders: {
    count: 4,
    // No spider sits near the spawn point, so a run cannot open with a death.
    minDistanceFromSpawn: 420,
    // The reaction window between being disturbed and being lunged at.
    windUpSeconds: 0.45,
    lungeSpeed: 520,
    lungeSeconds: 0.28,
    hitRadius: 22,
    recoverSeconds: 1.6,
    returnSpeed: 150,
    // How close the cricket must be before the tell starts to glow.
    noticeRadius: 190,
  },

  // Ants and beetles share the meadow. They are no threat to the cricket, but
  // they eat the same food, so dawdling costs points.
  rivals: {
    count: 6,
    speed: 58,
    radius: 7,
    eatRadius: 13,
    // How long a rival stays put after a meal before hunting again.
    nibbleSeconds: 0.8,
    // How far it will look for food before wandering instead.
    senseRange: 420,
  },

  attention: {
    risePerSecond: 0.22,
    decayPerSecond: 0.12,
    thresholds: [0.3, 0.55, 0.8],
    rearmMargin: 0.06,
  },

  bird: {
    maxAlive: 3,
    // Two kinds of aerial predator share one state machine. Birds hunt by day;
    // bats take over at night — smaller, twitchier, and quicker to commit.
    kinds: {
      bird: { circleSecondsScale: 1, speedScale: 1, size: 22 },
      bat: { circleSecondsScale: 0.7, speedScale: 0.92, size: 16 },
    },
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
    // How long one in-game day lasts. Also the period of the sky's dawn-to-dusk
    // cycle, so the day counter and what the player sees agree.
    secondsPerDay: 30,
    // Birds patrol on their own schedule too, so staying silent is quieter,
    // never safe. Scaled down by difficulty as the run goes on.
    patrolIntervalSeconds: 13,
  },
};
