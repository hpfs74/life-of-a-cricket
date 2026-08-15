export const CONFIG = {
  world: {
    width: 960,
    height: 600,
    // Everything above this fraction of the height is sky. The ground below it
    // is the playable field: the cricket, cover and food all stay inside it.
    horizonFraction: 0.28,
    edgeMargin: 24,
    coverCount: 9,
    coverMinRadius: 34,
    coverMaxRadius: 58,
    coverMinSeparation: 90,
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
    maxOnScreen: 5,
    spawnIntervalSeconds: 2.2,
    eatRadius: 20,
    types: {
      seed: { value: 25, radius: 6 },
      lettuce: { value: 45, radius: 12 },
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
