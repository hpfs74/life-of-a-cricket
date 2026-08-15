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
