import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket,
                     hidden: Bool = false, singing: Bool = false,
                     airborne: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: singing, airborne: airborne)
}

@Test func aBirdEntersFromOffScreenAndSettlesIntoAnOrbit() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))
    #expect(bird.state == .enter)

    for _ in 0..<600 {
        _ = bird.update(dt: 1.0 / 60, context: context(world, cricket))
        if bird.state != .enter { break }
    }
    #expect(bird.state == .circle)
}

@Test func hidingQuietlyMakesTheBirdGiveUp() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    var outcome = BirdOutcome.none
    for _ in 0..<1200 {
        outcome = bird.update(dt: 1.0 / 60,
                              context: context(world, cricket, hidden: true, singing: false))
        if outcome == .scannedLost { break }
    }
    #expect(outcome == .scannedLost)
    #expect(bird.state == .retreat)
}

@Test func singingFromCoverGivesTheCricketAway() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    for _ in 0..<1200 {
        _ = bird.update(dt: 1.0 / 60,
                        context: context(world, cricket, hidden: true, singing: true))
        if bird.state == .dive { break }
    }
    #expect(bird.state == .dive, "a singing cricket is found even in cover")
}

@Test func aLeapDodgesADive() {
    let world = meadow()
    var cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    // Put the bird on top of the cricket, mid-dive.
    bird.state = .dive
    bird.stateTime = 0
    bird.x = cricket.x; bird.y = cricket.y
    bird.targetX = cricket.x; bird.targetY = cricket.y
    cricket.jumping = true

    let outcome = bird.update(dt: 1.0 / 60, context: context(world, cricket, airborne: true))
    #expect(outcome == .missed)
}

@Test func batsCommitFasterThanBirds() {
    #expect(BirdKind.bat.circleSecondsScale < BirdKind.bird.circleSecondsScale)
}

@Test func difficultyScalesEverySpeed() {
    let world = meadow()
    let slow = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: nil)
    let fast = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 2, kind: .bird, focus: nil)
    #expect(fast.speedScale > slow.speedScale)
}
