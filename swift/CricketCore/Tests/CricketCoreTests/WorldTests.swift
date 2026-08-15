import Testing
@testable import CricketCore

@Test func meadowPlacesTheConfiguredCoverInsideTheBounds() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    #expect(world.width == Config.World.width)
    #expect(world.cover.count == Config.World.coverCount)

    for item in world.cover {
        #expect(item.x - item.radius >= 0)
        #expect(item.x + item.radius <= world.width)
        #expect(item.y + item.radius <= world.height)
        #expect(CoverType.meadowTypes.contains(item.type))
    }
}

@Test func coverIsSeparatedEnoughToLeaveLanes() {
    let world = World.meadow(rng: SeededRandom(seed: 11))
    for i in 0..<world.cover.count {
        for j in (i + 1)..<world.cover.count {
            let a = world.cover[i], b = world.cover[j]
            #expect(hypot2(a.x - b.x, a.y - b.y) >= Config.World.coverMinSeparation)
        }
    }
}

@Test func aRunAlwaysStartsInTheOpen() {
    let world = World.meadow(rng: SeededRandom(seed: 13))
    let spawn = world.spawnPoint
    #expect(world.coverAt(x: spawn.x, y: spawn.y) == nil)
    #expect(!world.isWater(x: spawn.x, y: spawn.y, margin: Config.Cricket.radius))
}

@Test func clampKeepsABodyOutOfTheSky() {
    let world = World.meadow(rng: SeededRandom(seed: 17))
    let clamped = world.clampToBounds(x: 500, y: -100, radius: Config.Cricket.radius)
    #expect(clamped.y >= world.top + Config.Cricket.radius)
}

@Test func aHeldDirectionSteersTheLeapTarget() {
    var world = World.meadow(rng: SeededRandom(seed: 19))
    world.cover = [
        Cover(x: 400, y: 400, radius: 40, type: .grass),   // to the left
        Cover(x: 600, y: 400, radius: 40, type: .grass),   // to the right
    ]
    let right = world.nearestCover(x: 500, y: 400, maxDistance: 320, dirX: 1, dirY: 0)
    #expect(right?.x == 600)

    let left = world.nearestCover(x: 500, y: 400, maxDistance: 320, dirX: -1, dirY: 0)
    #expect(left?.x == 400)
}

@Test func nearestDryPointRescuesABodyStandingInWater() {
    var world = World.meadow(rng: SeededRandom(seed: 23))
    world.water = [Circle(x: 500, y: 400, radius: 60)]
    let safe = world.nearestDryPoint(x: 500, y: 400, radius: Config.Cricket.radius)
    #expect(!world.isWater(x: safe.x, y: safe.y, margin: Config.Cricket.radius))
}

@Test func standingInADoorwayIsDetected() {
    let world = World.meadow(rng: SeededRandom(seed: 29))
    #expect(world.atDoorway(x: world.door.x, y: world.door.y))
    #expect(!world.atDoorway(x: 100, y: world.door.y))
}
