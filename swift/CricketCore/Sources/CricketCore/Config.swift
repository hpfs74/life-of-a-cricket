/// Every tunable number in the game.
///
/// As in `src/config.js`, no logic file carries a numeric literal: speeds,
/// scoring rates, meter rates, jump range and cooldown, day length, spawn
/// intervals and the difficulty ramp all live here.
public enum Config {
    public enum View {
        public static let width = 960.0
        public static let height = 600.0
        // How quickly the camera catches up, as a fraction of the gap per second.
        public static let followPerSecond = 6.0
    }

    public enum World {
        public static let width = 2880.0
        public static let height = 600.0
        // Everything above this fraction of the height is sky. The ground below it
        // is the playable field: the cricket, cover and food all stay inside it.
        public static let horizonFraction = 0.28
        public static let edgeMargin = 24.0
        public static let coverCount = 26
        public static let coverMinRadius = 34.0
        public static let coverMaxRadius = 58.0
        public static let coverMinSeparation = 100.0
        public static let spawnClearance = 48.0
    }

    public enum Cricket {
        public static let radius = 12.0
        public static let speed = 190.0
        public static let invulnerableSeconds = 1.6

        // A short jab in front of the cricket. Deliberate, not a held blender.
        public enum Strike {
            public static let reach = 34.0
            public static let halfAngleDegrees = 70.0
            public static let cooldownSeconds = 0.35
            public static let swingSeconds = 0.14
        }

        public enum Jump {
            public static let range = 320.0
            // Half-angle of the cone a held direction restricts the search to.
            public static let halfAngleDegrees = 70.0
            public static let speed = 620.0
            public static let minSeconds = 0.25
            public static let maxSeconds = 0.6
            public static let cooldownSeconds = 0.5
            // Used when there is no cover in range: a plain hop forward.
            public static let fallbackDistance = 90.0
            // Render-only: how high the arc lifts the cricket off its shadow.
            public static let arcHeight = 46.0
        }
    }

    public enum Score {
        public static let songPointsPerSecond = 10.0
        public static let multiplierStart = 1.0
        public static let multiplierClimbPerSecond = 0.2
        public static let multiplierMax = 5.0
        public static let fedClimbBonus = 2.0
        public static let fedSeconds = 6.0
        public static let storageKey = "life-of-a-cricket:highscore"
    }

    public enum Food {
        public static let maxOnScreen = 12
        public static let spawnIntervalSeconds = 1.5
        public static let eatRadius = 20.0
        // `types` (seed/lettuce/berry/aphid/grub value+radius) and `naturalTypes`
        // are kind-keyed and become `FoodType` enum properties in Task 9, not
        // members of Config (ruling R2).
        // A dropped grub lands at arm's length from whoever killed for it. Without
        // a moment to settle it would be swallowed on the same frame and the player
        // would never see the drop at all.
        public static let dropSettleSeconds = 0.35
    }

    // The house at the east end of the meadow: two floors in cross-section, with
    // a stairwell joining them and furniture standing in for cover.
    public enum House {
        public static let width = 2000.0
        public static let height = 620.0
        // Upstairs runs from `top`; the ceiling gap separates the two floors.
        public static let top = 36.0
        public static let floorHeight = 264.0
        public static let ceilingGap = 44.0
        public static let stairWidth = 96.0
        // Furniture per floor, sized like the meadow's cover so hiding feels the same.
        public static let furniturePerFloor = 7
        public static let furnitureMinRadius = 32.0
        public static let furnitureMaxRadius = 56.0
        public static let furnitureMinSeparation = 108.0
        // A pet bowl and a spill or two, on the ground floor only.
        public static let spillCount = 2
        public static let spillRadius = 26.0
        // Where the cricket comes in, and how wide the doorway is to walk back out.
        public static let doorWidth = 70.0
        public static let entryClearance = 210.0
    }

    // The doorway at the east end of the meadow that leads into the house.
    public enum Doorway {
        public static let width = 86.0
        public static let height = 120.0
    }

    // A stream and a pond or two. Water is stored as overlapping circles: cheap
    // to test against, and they blob together into organic shapes.
    public enum Water {
        public static let streamSegments = 20
        public static let streamMinRadius = 24.0
        public static let streamMaxRadius = 44.0
        // How far the stream can wander sideways between segments.
        public static let streamWander = 90.0
        // The stream keeps this clear of the spawn point so a run never starts wet.
        public static let spawnClearance = 260.0
        public static let pondCountRange = 1.0...2.0
        public static let pondBlobs = 5
        public static let pondRadiusRange = 34.0...64.0
    }

    // The house cat. It hunts, unlike the human, and it can take the stairs.
    public enum Cat {
        public static let prowlSpeed = 92.0
        public static let stalkSpeed = 150.0
        public static let pounceSpeed = 540.0
        public static let pounceSeconds = 0.34
        public static let hitRadius = 30.0
        // How far it can notice an exposed cricket, and how much further a singing
        // one carries. Cover breaks its interest entirely.
        public static let noticeRadius = 300.0
        public static let singingBonus = 260.0
        // It must hold the cricket in view this long before committing.
        public static let stalkSeconds = 1.5
        public static let recoverSeconds = 1.8
        // Losing the trail, it mooches about before settling back to a prowl.
        public static let confusedSeconds = 2.2
        // How close to the stairwell centre counts as being on the stairs.
        public static let stairTolerance = 26.0
    }

    // The human: enormous, oblivious, and lethal to anything in the open.
    public enum Human {
        // A floor is crossed this often, give or take.
        public static let everySeconds = 9.0...18.0
        public static let walkSpeed = 210.0
        // The shadow that arrives before the feet do.
        public static let warningSeconds = 1.3
        // Anything within this of a footfall, and not behind furniture, is crushed.
        public static let crushRadius = 46.0
        // Distance between footfalls.
        public static let strideLength = 165.0
    }

    // Spiders live inside cover. They are the exception to the game's core rule:
    // hiding and keeping quiet beats anything with wings, but not one of these.
    public enum Spiders {
        public static let count = 4
        // No spider sits near the spawn point, so a run cannot open with a death.
        public static let minDistanceFromSpawn = 420.0
        // The reaction window between being disturbed and being lunged at.
        public static let windUpSeconds = 0.45
        public static let lungeSpeed = 520.0
        public static let lungeSeconds = 0.28
        public static let hitRadius = 22.0
        public static let recoverSeconds = 1.6
        public static let returnSpeed = 150.0
        // How close the cricket must be before the tell starts to glow.
        public static let noticeRadius = 190.0
    }

    // Ants and beetles share the meadow. They are no threat to the cricket, but
    // they eat the same food, so dawdling costs points.
    public enum Rivals {
        public static let count = 6
        // `health` (ant: 1, beetle: 2) and `drops` (what a corpse leaves behind;
        // a beetle pays double for the second hit) are kind-keyed and become
        // `RivalKind` enum properties in Task 11, not members of Config (ruling R2).
        public static let biteStunSeconds = 0.6
        public static let biteKnockback = 26.0
        // Bugs wander back in from the long grass, so the meadow is never farmed out.
        public static let respawnSeconds = 8.0
        public static let speed = 58.0
        public static let radius = 7.0
        public static let eatRadius = 13.0
        // How long a rival stays put after a meal before hunting again.
        public static let nibbleSeconds = 0.8
        // How far it will look for food before wandering instead.
        public static let senseRange = 420.0
    }

    public enum Attention {
        public static let risePerSecond = 0.22
        public static let decayPerSecond = 0.12
        public static let thresholds: [Double] = [0.3, 0.55, 0.8]
        // Swinging is loud: a long scrap draws predators just as singing does.
        public static let perStrike = 0.05
        public static let rearmMargin = 0.06
    }

    public enum Bird {
        public static let maxAlive = 3
        // Two kinds of aerial predator share one state machine. Birds hunt by day;
        // bats take over at night — smaller, twitchier, and quicker to commit.
        // `kinds` (bird: circleSecondsScale/speedScale/size, bat: ...) is
        // kind-keyed and becomes a `BirdKind` enum property in Task 13, not a
        // member of Config (ruling R2).
        public static let enterSpeed = 250.0
        public static let circleSpeed = 2.0
        public static let circleRadius = 210.0
        public static let circleSeconds = 2.4
        public static let diveSpeed = 620.0
        public static let retreatSpeed = 340.0
        public static let hitRadius = 30.0
        public static let warningSeconds = 0.9
    }

    public enum Game {
        public static let startingLives = 3
        public static let maxFrameDelta = 0.05
        public static let difficultyRampSeconds = 90.0
        public static let difficultyMax = 2.2
        // How long one in-game day lasts. Also the period of the sky's dawn-to-dusk
        // cycle, so the day counter and what the player sees agree.
        public static let secondsPerDay = 30.0
        // How long the "the meadow has shifted" caption stays up after a new day.
        public static let shiftCaptionSeconds = 3.5
        // A grace period after moving between stages, so arriving in a doorway
        // cannot bounce the cricket straight back where it came from.
        public static let stageCooldownSeconds = 1.2
        // Birds patrol on their own schedule too, so staying silent is quieter,
        // never safe. Scaled down by difficulty as the run goes on.
        public static let patrolIntervalSeconds = 13.0
    }

    // On-screen controls for touch devices: a floating stick on the left half and
    // three action buttons under the right thumb.
    public enum Touch {
        // Button size and spacing scale with the screen's short side.
        public static let buttonScale = 0.085
        public static let buttonMinRadius = 30.0
        public static let buttonMaxRadius = 46.0
        public static let edgePadding = 22.0
        // How far the thumb must travel from where it landed before the cricket
        // moves, so resting a thumb still counts as standing still.
        public static let stickDeadZone = 12.0
        public static let stickMaxRadius = 64.0
        // The stick only picks up touches starting in this fraction of the width.
        public static let stickZoneFraction = 0.5
    }
}
