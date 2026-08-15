export const CONFIG = {
  world: {
    width: 960,
    height: 600,
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
