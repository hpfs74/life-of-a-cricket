import Testing
@testable import CricketCore

@Test func foodSpawnsUpToTheCap() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var field = FoodField()
    let rng = SeededRandom(seed: 3)

    for _ in 0..<200 { field.update(dt: 1, world: world, rng: rng) }
    #expect(field.items.count == Config.Food.maxOnScreen)
}

@Test func onlyNaturalTypesEverSpawn() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var field = FoodField()
    let rng = SeededRandom(seed: 5)

    for _ in 0..<200 { field.update(dt: 1, world: world, rng: rng) }
    for item in field.items {
        #expect(FoodType.natural.contains(item.type), "grubs are only ever dropped")
    }
}

@Test func aDroppedGrubMustSettleBeforeItCanBeEaten() {
    var field = FoodField()
    let grub = field.drop(.grub, x: 100, y: 100)
    #expect(!grub.isEdible)

    #expect(field.consume(cricketX: 100, cricketY: 100).isEmpty)

    let world = World.meadow(rng: SeededRandom(seed: 7))
    field.update(dt: Config.Food.dropSettleSeconds, world: world, rng: SeededRandom(seed: 1))
    #expect(field.consume(cricketX: 100, cricketY: 100).count == 1)
}

@Test func dropsIgnoreTheOnScreenCap() {
    var field = FoodField()
    for i in 0..<(Config.Food.maxOnScreen + 5) {
        field.drop(.grub, x: Double(i), y: 100)
    }
    #expect(field.items.count == Config.Food.maxOnScreen + 5, "earned drops are never swallowed")
}
