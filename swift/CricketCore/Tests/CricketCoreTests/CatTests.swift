import Testing
@testable import CricketCore

private func house() -> World { World.house(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket,
                     hidden: Bool = false, singing: Bool = false,
                     airborne: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: singing, airborne: airborne)
}

@Test func furnitureBreaksTheCatsInterestOutright() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)
    cricket.x = cat.x + 40; cricket.y = cat.y

    let seen = cat.update(dt: 0.1, context: context(world, cricket), rng: SeededRandom(seed: 1))
    #expect(seen == .noticed)

    let lost = cat.update(dt: 0.1, context: context(world, cricket, hidden: true),
                          rng: SeededRandom(seed: 1))
    #expect(lost == .lost)
}

@Test func aSingingCricketCarriesFurtherThanAMovingOne() {
    let world = house()
    var quiet = Cat(world: world, rng: SeededRandom(seed: 3))
    var loud = Cat(world: world, rng: SeededRandom(seed: 3))

    var cricket = Cricket(world: world)
    // Beyond the plain notice radius, inside the singing bonus.
    cricket.x = quiet.x + Config.Cat.noticeRadius + 100
    cricket.y = quiet.y

    #expect(quiet.update(dt: 0.1, context: context(world, cricket),
                         rng: SeededRandom(seed: 1)) == .none)
    #expect(loud.update(dt: 0.1, context: context(world, cricket, singing: true),
                        rng: SeededRandom(seed: 1)) == .noticed)
}

@Test func aLeapClearsAPounce() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)
    cricket.x = cat.x; cricket.y = cat.y
    cricket.jumping = true

    cat.state = .pounce
    cat.stateTime = Config.Cat.pounceSeconds
    cat.targetX = cat.x; cat.targetY = cat.y

    let outcome = cat.update(dt: 1.0 / 60,
                             context: context(world, cricket, airborne: true),
                             rng: SeededRandom(seed: 1))
    #expect(outcome == .missed)
}

@Test func theCatClimbsTheStairsAfterTheCricket() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    // Cat downstairs, cricket upstairs, in view.
    cat.y = (world.bands[1].top + world.bands[1].bottom) / 2
    cat.state = .stalk

    var cricket = Cricket(world: world)
    cricket.x = cat.x
    cricket.y = (world.bands[0].top + world.bands[0].bottom) / 2

    // Fixture fix, verified against src/cat.js in Node: the gap between the
    // two floors' band centres is `ceilingGap + floorHeight` = 308, which is
    // just past the plain `noticeRadius` of 300. A silent cricket here is
    // genuinely out of earshot — STALK immediately loses it and the cat never
    // reaches the stairs, in both the JS and this port. `singing: true` is
    // what actually puts it "in view" per the comment above, matching how
    // tests/cat.test.js's own stairs test uses a singing cricket to close
    // the same gap.
    let startY = cat.y
    for _ in 0..<600 {
        _ = cat.update(dt: 1.0 / 60, context: context(world, cricket, singing: true),
                       rng: SeededRandom(seed: 1))
    }
    #expect(cat.y < startY, "the cat made its way upstairs")
}
