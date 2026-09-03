import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func spidersKeepClearOfTheSpawnPoint() {
    let world = meadow()
    let spiders = createSpiders(world: world, rng: SeededRandom(seed: 5), keepAwayFrom: nil)
    let spawn = world.spawnPoint

    #expect(spiders.count <= Config.Spiders.count)
    for spider in spiders {
        let away = hypot2(spider.homeX - spawn.x, spider.homeY - spawn.y)
        #expect(away >= Config.Spiders.minDistanceFromSpawn)
    }
}

@Test func eachSpiderTakesItsOwnTuft() {
    let world = meadow()
    let spiders = createSpiders(world: world, rng: SeededRandom(seed: 5), keepAwayFrom: nil)
    for i in 0..<spiders.count {
        for j in (i + 1)..<spiders.count {
            #expect(!(spiders[i].homeX == spiders[j].homeX && spiders[i].homeY == spiders[j].homeY))
        }
    }
}

@Test func aSpiderHuntsByTouchAndLetsAnAirborneCricketPass() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400
    cricket.jumping = true

    let none = updateSpiders(&spiders, dt: 0.1, world: world, cricket: cricket)
    #expect(none.isEmpty, "a leaping cricket sails over untouched")

    cricket.jumping = false
    let woke = updateSpiders(&spiders, dt: 0.1, world: world, cricket: cricket)
    #expect(woke.contains(.wake(index: 0)))
}

@Test func aLungeCommitsToWhereTheCricketWas() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400

    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)   // wake
    // Run clear during the wind-up.
    cricket.x = 900
    var events: [SpiderEvent] = []
    for _ in 0..<120 {
        events += updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)
    }
    #expect(events.contains(.miss(index: 0)), "running out of reach beats the lunge")
    #expect(!events.contains(.hit(index: 0)))
}

@Test func alertnessRisesAsTheCricketApproaches() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500 + Config.Spiders.noticeRadius + 50; cricket.y = 400
    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)
    #expect(spiders[0].alertness == 0)

    cricket.x = 500 + Config.Spiders.noticeRadius / 2
    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)
    #expect(spiders[0].alertness > 0)
}

/** Steps the spider until its state changes away from `from`, collecting every event. */
@discardableResult
private func runUntilLeaves(
    _ spiders: inout [Spider], world: World, cricket: Cricket, from: SpiderState, maxSteps: Int = 2000
) -> [SpiderEvent] {
    var seen: [SpiderEvent] = []
    var steps = 0
    while spiders[0].state == from && steps < maxSteps {
        seen += updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)
        steps += 1
    }
    #expect(steps < maxSteps, "spider never left \(from)")
    return seen
}

@Test func justShortOfTheWindUpTheSpiderHasNotYetCommitted() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]
    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400

    updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)   // wake
    #expect(spiders[0].state == .windup)

    // Most of the way through the wind-up it must still not have committed.
    let steps = Int(Config.Spiders.windUpSeconds * 60) - 2
    for _ in 0..<max(0, steps) {
        updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)
    }
    #expect(spiders[0].state == .windup, "it lunged before the window was up")
}

@Test func aGroundedStationaryCricketIsHitByTheLunge() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]
    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400

    updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)   // wake
    runUntilLeaves(&spiders, world: world, cricket: cricket, from: .windup)
    #expect(spiders[0].state == .lunge)

    let events = runUntilLeaves(&spiders, world: world, cricket: cricket, from: .lunge)
    #expect(events.contains(.hit(index: 0)))
}

@Test func afterALungeItRecoversWalksHomeAndLurksAgain() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]
    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400

    updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)   // wake
    runUntilLeaves(&spiders, world: world, cricket: cricket, from: .windup)
    runUntilLeaves(&spiders, world: world, cricket: cricket, from: .lunge)
    #expect(spiders[0].state == .recover)

    // The cricket flees, so it is not re-triggered the instant it gets home.
    cricket.x = 100; cricket.y = 250
    runUntilLeaves(&spiders, world: world, cricket: cricket, from: .recover)

    #expect(spiders[0].state == .lurking)
    #expect(abs(spiders[0].x - spiders[0].homeX) < 1, "it should return to its tuft")
    #expect(abs(spiders[0].y - spiders[0].homeY) < 1)
}
