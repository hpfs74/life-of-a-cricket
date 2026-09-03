import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func aSwingOnlyReachesBugsInFront() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.dirX = 1; cricket.dirY = 0

    var behind = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    behind.x = cricket.x - 20; behind.y = cricket.y
    var rivals = [behind]

    #expect(resolveStrike(cricket: cricket, rivals: &rivals).hit == nil)
}

@Test func anAntDropsAtOneBlowAndABeetleTakesTwo() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.dirX = 1; cricket.dirY = 0

    var ant = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    #expect(ant.kind == .ant)
    ant.x = cricket.x + 20; ant.y = cricket.y
    var rivals = [ant]
    let first = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(first.killed)
    #expect(rivals.isEmpty)

    var beetle = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 1)
    #expect(beetle.kind == .beetle)
    beetle.x = cricket.x + 20; beetle.y = cricket.y
    rivals = [beetle]

    let hit = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(!hit.killed)
    #expect(hit.retaliated, "a beetle bites back for the first blow")

    let finish = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(finish.killed)
    #expect(rivals.isEmpty)
}

@Test func rivalsEatTheSameFoodTheCricketWants() {
    let world = meadow()
    var food = FoodField()
    let item = food.drop(.seed, x: 500, y: 400)
    food.update(dt: Config.Food.dropSettleSeconds, world: world, rng: SeededRandom(seed: 1))

    var rival = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    rival.x = item.x + 5; rival.y = item.y
    rival.targetX = item.x; rival.targetY = item.y
    var rivals = [rival]

    var eaten: [FoodItem] = []
    for _ in 0..<60 {
        eaten += updateRivals(&rivals, dt: 1.0 / 60, world: world,
                              food: &food, rng: SeededRandom(seed: 2))
    }
    #expect(eaten.count == 1)
    #expect(food.items.isEmpty)
}

@Test func rivalsNeverWalkIntoWater() {
    var world = meadow()
    world.water = [Circle(x: 800, y: 400, radius: 120)]
    var food = FoodField()

    var rivals = createRivals(world: world, rng: SeededRandom(seed: 7))
    for _ in 0..<600 {
        updateRivals(&rivals, dt: 1.0 / 60, world: world,
                     food: &food, rng: SeededRandom(seed: 3))
    }
    for rival in rivals {
        #expect(!world.isWater(x: rival.x, y: rival.y, margin: Config.Rivals.radius))
    }
}
