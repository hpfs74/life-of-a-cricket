export const CONFIG = {
  // On-screen controls for touch devices: a floating stick on the left half and
  // three action buttons under the right thumb.
  touch: {
    // Button size and spacing scale with the screen's short side.
    buttonScale: 0.085,
    buttonMinRadius: 30,
    buttonMaxRadius: 46,
    edgePadding: 22,
    // How far the thumb must travel from where it landed before the cricket
    // moves, so resting a thumb still counts as standing still.
    stickDeadZone: 12,
    stickMaxRadius: 64,
    // The stick only picks up touches starting in this fraction of the width.
    stickZoneFraction: 0.5,
  },

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

    // A short jab in front of the cricket. Deliberate, not a held blender.
    strike: {
      reach: 34,
      halfAngleDegrees: 70,
      cooldownSeconds: 0.35,
      swingSeconds: 0.14,
    },

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
      // Only ever left behind by a killed bug, never spawned by the meadow.
      grub: { value: 90, radius: 8 },
    },
    naturalTypes: ['seed', 'lettuce', 'berry', 'aphid'],
    // A dropped grub lands at arm's length from whoever killed for it. Without
    // a moment to settle it would be swallowed on the same frame and the player
    // would never see the drop at all.
    dropSettleSeconds: 0.35,
  },

  // The house at the east end of the meadow: two floors in cross-section, with
  // a stairwell joining them and furniture standing in for cover.
  house: {
    width: 2000,
    height: 620,
    // Upstairs runs from `top`; the ceiling gap separates the two floors.
    top: 36,
    floorHeight: 264,
    ceilingGap: 44,
    stairWidth: 96,
    // Furniture per floor, sized like the meadow's cover so hiding feels the same.
    furniturePerFloor: 7,
    furnitureMinRadius: 32,
    furnitureMaxRadius: 56,
    furnitureMinSeparation: 108,
    // A pet bowl and a spill or two, on the ground floor only.
    spillCount: 2,
    spillRadius: 26,
    // Where the cricket comes in, and how wide the doorway is to walk back out.
    doorWidth: 70,
    entryClearance: 210,
  },

  // The doorway at the east end of the meadow that leads into the house.
  doorway: {
    width: 86,
    height: 120,
  },

  // A stream and a pond or two. Water is stored as overlapping circles: cheap
  // to test against, and they blob together into organic shapes.
  water: {
    streamSegments: 20,
    streamMinRadius: 24,
    streamMaxRadius: 44,
    // How far the stream can wander sideways between segments.
    streamWander: 90,
    // The stream keeps this clear of the spawn point so a run never starts wet.
    spawnClearance: 260,
    pondCountRange: [1, 2],
    pondBlobs: 5,
    pondRadiusRange: [34, 64],
  },

  // The house cat. It hunts, unlike the human, and it can take the stairs.
  cat: {
    prowlSpeed: 92,
    stalkSpeed: 150,
    pounceSpeed: 540,
    pounceSeconds: 0.34,
    hitRadius: 30,
    // How far it can notice an exposed cricket, and how much further a singing
    // one carries. Cover breaks its interest entirely.
    noticeRadius: 300,
    singingBonus: 260,
    // It must hold the cricket in view this long before committing.
    stalkSeconds: 1.5,
    recoverSeconds: 1.8,
    // Losing the trail, it mooches about before settling back to a prowl.
    confusedSeconds: 2.2,
    // How close to the stairwell centre counts as being on the stairs.
    stairTolerance: 26,
  },

  // The human: enormous, oblivious, and lethal to anything in the open.
  human: {
    // A floor is crossed this often, give or take.
    everySeconds: [9, 18],
    walkSpeed: 210,
    // The shadow that arrives before the feet do.
    warningSeconds: 1.3,
    // Anything within this of a footfall, and not behind furniture, is crushed.
    crushRadius: 46,
    // Distance between footfalls.
    strideLength: 165,
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
    // Ants scatter at a touch; beetles need finishing, and bite if you fail.
    health: { ant: 1, beetle: 2 },
    // What a corpse leaves behind. A beetle pays double for the second hit.
    drops: { ant: 1, beetle: 2 },
    biteStunSeconds: 0.6,
    biteKnockback: 26,
    // Bugs wander back in from the long grass, so the meadow is never farmed out.
    respawnSeconds: 8,
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
    // Swinging is loud: a long scrap draws predators just as singing does.
    perStrike: 0.05,
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
    // How long the "the meadow has shifted" caption stays up after a new day.
    shiftCaptionSeconds: 3.5,
    // A grace period after moving between stages, so arriving in a doorway
    // cannot bounce the cricket straight back where it came from.
    stageCooldownSeconds: 1.2,
    // Birds patrol on their own schedule too, so staying silent is quieter,
    // never safe. Scaled down by difficulty as the run goes on.
    patrolIntervalSeconds: 13,
  },
};
