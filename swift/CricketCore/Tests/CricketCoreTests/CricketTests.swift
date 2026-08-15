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

    cricket.update(intent: held, dt: 1.0 / 60, world: world)
    // Ride the arc out and past the cooldown.
    for _ in 0..<200 { cricket.update(intent: held, dt: 1.0 / 60, world: world) }
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
}

@Test func theCricketStopsAtTheWaterAndSlidesAlongTheBank() {
    var world = meadow()
    var cricket = Cricket(world: world)
    // A wall of water directly to the east of the cricket. Offset must clear
    // radius + margin (60 + Config.Cricket.radius) so the cricket starts dry —
    // verified against src/cricket.js: an offset of 40 spawns the cricket
    // already inside the pond, which traps it there forever in both the JS
    // reference and this port (walk() only ever checks the destination, so a
    // body already submerged can never find a dry candidate to move to).
    world.water = [Circle(x: cricket.x + 100, y: cricket.y, radius: 60)]

    for _ in 0..<60 { cricket.update(intent: Intent(dx: 1), dt: 1.0 / 60, world: world) }
    #expect(!world.isWater(x: cricket.x, y: cricket.y, margin: Config.Cricket.radius))
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
