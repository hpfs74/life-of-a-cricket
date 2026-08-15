import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func singingRequiresStandingStill() {
    let world = meadow()
    var cricket = Cricket(world: world)

    let events = cricket.update(intent: Intent(sing: true), dt: 0.1, world: world)
    #expect(cricket.singing)
    #expect(events.startedSinging)

    cricket.update(intent: Intent(dx: 1, sing: true), dt: 0.1, world: world)
    #expect(!cricket.singing, "moving cancels the song")
}

@Test func movingWalksTheCricketAndSetsItsFacing() {
    let world = meadow()
    var cricket = Cricket(world: world)
    let startX = cricket.x

    cricket.update(intent: Intent(dx: 1), dt: 0.1, world: world)
    #expect(cricket.x > startX)
    #expect(cricket.dirX == 1)
}

@Test func aJumpNeedsAFreshPressAndCannotBeSteeredMidAir() {
    let world = meadow()
    var cricket = Cricket(world: world)

    let held = Intent(jump: true)
    let events = cricket.update(intent: held, dt: 1.0 / 60, world: world)
    #expect(events.startedJump)
    #expect(cricket.jumping)

    // Airborne: no singing, no steering.
    cricket.update(intent: Intent(dx: 1, sing: true, jump: true), dt: 1.0 / 60, world: world)
    #expect(!cricket.singing)
    #expect(!cricket.moving)
}

@Test func aJumpDoesNotChainWhileTheKeyIsHeld() {
    let world = meadow()
    var cricket = Cricket(world: world)
    let held = Intent(jump: true)

    let first = cricket.update(intent: held, dt: 1.0 / 60, world: world)
    #expect(first.startedJump, "the first press must actually launch a jump")

    // Ride the arc out and past the cooldown, pinning every single frame:
    // the held key must never fire a second startedJump, not just the last one.
    for _ in 0..<200 {
        let events = cricket.update(intent: held, dt: 1.0 / 60, world: world)
        #expect(!events.startedJump, "a held key must not re-trigger the leap")
    }
    #expect(!cricket.jumping, "a held key must not re-trigger the leap")
}

@Test func aStunFreezesEverything() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.stunnedFor = Config.Rivals.biteStunSeconds

    let events = cricket.update(intent: Intent(dx: 1, sing: true, jump: true), dt: 0.1, world: world)
    #expect(!cricket.singing)
    #expect(!cricket.moving)
    #expect(!events.startedJump)
    #expect(!events.startedStrike)
}

@Test func aSwingSilencesTheSong() {
    let world = meadow()
    var cricket = Cricket(world: world)

    cricket.update(intent: Intent(sing: true), dt: 0.1, world: world)
    #expect(cricket.singing)

    let events = cricket.update(intent: Intent(sing: true, strike: true), dt: 0.01, world: world)
    #expect(events.startedStrike)
    #expect(!cricket.singing, "a scrap really does break the note")

    // Pin the `swingFor <= 0` conjunct itself, not just the strike frame (where
    // singing is already forced false by the fresh-strike block regardless of
    // that conjunct). Hold sing with no further strike: swingFor is merely
    // decrementing (0.14 - 0.01 = 0.13, still > 0), so the note must stay cut
    // even though nothing is freshly swinging this frame.
    #expect(cricket.swingFor > 0, "the swing should still be in progress")
    let held = cricket.update(intent: Intent(sing: true), dt: 0.01, world: world)
    #expect(cricket.swingFor > 0, "still mid-swing on this frame")
    #expect(!cricket.singing, "the note must not resume until the swing finishes")
    #expect(!held.startedSinging)
}

@Test func theCricketStopsAtTheWaterAndSlidesAlongTheBank() {
    var world = meadow()
    var cricket = Cricket(world: world)

    // A vertical band of water (three stacked ponds) a short walk east, with a
    // dry gap of 8px between the cricket and the near edge (matching
    // tests/cricket.test.js's streamWorld/340 setup) — verified against
    // src/cricket.js. A single `dx: 1` intent, as the previous version of this
    // test used, never exercises walk()'s axis-retry at all: since ny == 0,
    // `alongX` is computed by the exact same formula as `full`, and the
    // `alongY` branch is skipped outright, so deleting that whole block left
    // the old test green. A diagonal `dx: 1, dy: 1` intent forces the cricket
    // to hug the band and slide down it along Y while blocked on X, which only
    // happens through the axis-retry path.
    let bandX = cricket.x + 60
    world.water = [
        Circle(x: bandX, y: cricket.y - 100, radius: 40),
        Circle(x: bandX, y: cricket.y, radius: 40),
        Circle(x: bandX, y: cricket.y + 100, radius: 40),
    ]
    #expect(!world.isWater(x: cricket.x, y: cricket.y, margin: Config.Cricket.radius), "should start dry")

    let startY = cricket.y
    for _ in 0..<60 { cricket.update(intent: Intent(dx: 1, dy: 1), dt: 1.0 / 60, world: world) }

    #expect(cricket.y > startY + 20, "should have slid down the bank")
    #expect(!world.isWater(x: cricket.x, y: cricket.y, margin: Config.Cricket.radius), "and still not be in the water")
}

@Test func midLeapTheCricketIsNotHiddenEvenInsideCover() {
    var world = meadow()
    var cricket = Cricket(world: world)
    world.cover = [Cover(x: cricket.x, y: cricket.y, radius: 60, type: .grass)]

    let standing = cricket.update(intent: .idle, dt: 1.0 / 60, world: world)
    #expect(standing.hidden)

    let leaping = cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    #expect(!leaping.hidden, "mid-air the cricket is above the grass")
}

// The tests below give `startJump`'s targeting dedicated coverage, mirroring
// the intent of tests/cricket.test.js's cover-aiming tests (that file's
// jumpWorld / bare-world doubles, ported directly since `World.meadow`'s
// random cover placement can't pin exact landing spots). Every expectation
// here was checked against a run of the real src/cricket.js first.

/// Two pieces of cover flanking the spawn point, closer on the west side, so a
/// held direction can be proven to override the plain "nearest" choice.
private func jumpWorld() -> World {
    World(
        kind: .meadow, width: 800, height: 600, top: 0,
        bands: [Band(top: 0, bottom: 600)], stairs: [],
        door: Door(x: 800, y: 300, width: 86, height: 120),
        cover: [
            Cover(x: 260, y: 300, radius: 30, type: .rock),  // 140px away: nearer
            Cover(x: 560, y: 300, radius: 30, type: .leaf),  // 160px away: farther
        ],
        water: []
    )
}

private func bareWorld(width: Double = 800) -> World {
    World(
        kind: .meadow, width: width, height: 600, top: 0,
        bands: [Band(top: 0, bottom: 600)], stairs: [],
        door: Door(x: width, y: 300, width: 86, height: 120),
        cover: [], water: []
    )
}

@Test func aHeldDirectionOverridesTheNearestCoverWhenAimingALeap() {
    let world = jumpWorld()
    var cricket = Cricket(world: world)

    // Held east: must land on the farther leaf (560), not the nearer rock
    // (260) that an undirected jump would pick — proving Cricket actually
    // threads the held direction into the cone search rather than always
    // taking the plain nearest.
    cricket.update(intent: Intent(dx: 1, jump: true), dt: 1.0 / 60, world: world)
    for _ in 0..<500 where cricket.jumping {
        cricket.update(intent: Intent(dx: 1, jump: true), dt: 1.0 / 60, world: world)
    }
    #expect(!cricket.jumping, "the cricket never landed")
    #expect(abs(cricket.x - 560) < 0.001, "held-east should steer to the farther leaf")
}

@Test func aLeapExcludesTheCoverTheCricketIsStandingIn() {
    let world = jumpWorld()
    var cricket = Cricket(world: world)
    // Stand exactly on the rock: distance 0, which would otherwise always win
    // as "nearest" — the exclusion must skip it and reach for the leaf.
    cricket.x = 260
    cricket.y = 300

    let events = cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    #expect(events.startedJump)
    for _ in 0..<500 where cricket.jumping {
        cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    }
    #expect(abs(cricket.x - 560) < 0.001, "should jump to the OTHER cover, not the one it's standing in")
}

@Test func withNoCoverInRangeALeapHopsForward() {
    let world = bareWorld()
    var cricket = Cricket(world: world)
    cricket.dirX = 1
    cricket.dirY = 0

    cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    for _ in 0..<500 where cricket.jumping {
        cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    }
    #expect(abs(cricket.x - (world.spawnPoint.x + Config.Cricket.Jump.fallbackDistance)) < 0.001)
}

@Test func aLeapClearsANarrowStretchOfWaterAndLandsDry() {
    var world = bareWorld()
    world.water = [Circle(x: world.spawnPoint.x, y: world.spawnPoint.y, radius: 25)]
    var cricket = Cricket(world: world)
    cricket.x = world.spawnPoint.x - 60
    cricket.dirX = 1
    cricket.dirY = 0

    cricket.update(intent: Intent(dx: 1, jump: true), dt: 1.0 / 60, world: world)
    #expect(cricket.jumping)
    for _ in 0..<500 where cricket.jumping {
        cricket.update(intent: Intent(dx: 1, jump: true), dt: 1.0 / 60, world: world)
    }
    #expect(cricket.x > world.spawnPoint.x + 25, "should have cleared the far bank")
}

@Test func aLeapFallsBackToTheNearBankWhenForwardSearchFindsNoDryGround() {
    // A wide pond that swallows every candidate `dryLanding` would try walking
    // forward (fallbackDistance...range, i.e. spawn+90 to spawn+320): only the
    // backward sweep (fallbackDistance-12 down to 0) finds dry ground, 30px
    // short of the near bank. Deleting the backward-sweep block leaves
    // `dryLanding` returning the cricket's own position (a 0-distance "jump"),
    // which this test's exact landing spot rules out.
    var world = bareWorld(width: 1600)
    var cricket = Cricket(world: world)
    let spawnX = cricket.x
    world.water = [Circle(x: spawnX + 300, y: cricket.y, radius: 250)]
    cricket.dirX = 1
    cricket.dirY = 0

    cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    #expect(cricket.jumping)
    #expect(abs(cricket.jumpToX - (spawnX + 30)) < 0.001, "should fall back to the near bank, 30px out")

    for _ in 0..<500 where cricket.jumping {
        cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    }
    #expect(!world.isWater(x: cricket.x, y: cricket.y, margin: Config.Cricket.radius))
}

@Test func aCloseLeapIsClampedToTheMinimumJumpDuration() {
    // A target only 20px away would compute a raw duration of 20/620 ≈ 0.032s;
    // the min clamp must force it up to minSeconds (0.25s) instead. (The
    // maxSeconds clamp has no equivalent public path to exercise: every leap's
    // distance is capped by `jump.range` (320), and range / jump.speed (620)
    // is already below maxSeconds (0.6), so the cap can never actually bind
    // through startJump with the game's real Config values.)
    let world = bareWorld()
    var cricket = Cricket(world: world)
    var closeWorld = world
    closeWorld.cover = [Cover(x: cricket.x + 20, y: cricket.y, radius: 5, type: .rock)]

    cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: closeWorld)
    #expect(cricket.jumpSeconds == Config.Cricket.Jump.minSeconds)
}
