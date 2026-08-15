import Testing
@testable import CricketCore

private func house() -> World { World.house(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket, hidden: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: false, airborne: false)
}

@Test func aShadowArrivesBeforeTheFeet() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    let cricket = Cricket(world: world)

    var events: [HumanEvent] = []
    for _ in 0..<3000 {
        events += schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                  rng: SeededRandom(seed: 5))
        if events.contains(.approaching) { break }
    }
    #expect(events.contains(.approaching))
    #expect(!events.contains { if case .footfall = $0 { return true }; return false },
            "the shadow holds before any foot lands")
}

@Test func furnitureIsTheOnlyThingThatSavesYou() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)

    // Walk the schedule until a crossing starts, then stand under it.
    var started = false
    for _ in 0..<3000 where !started {
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                     rng: SeededRandom(seed: 5))
        started = events.contains(.approaching)
    }
    let walker = try! #require(schedule.walker)
    cricket.y = walker.y

    var crushed = false
    for _ in 0..<3000 {
        cricket.x = schedule.walker?.x ?? cricket.x
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket, hidden: true),
                                     rng: SeededRandom(seed: 5))
        if events.contains(where: { if case .crush = $0 { return true }; return false }) {
            crushed = true
        }
        if schedule.walker == nil { break }
    }
    #expect(!crushed, "hidden under furniture, nothing lands on you")
}

@Test func aCrossingEventuallyEnds() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    let cricket = Cricket(world: world)

    var sawGone = false
    for _ in 0..<20000 {
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                     rng: SeededRandom(seed: 5))
        if events.contains(.gone) { sawGone = true; break }
    }
    #expect(sawGone)
}
