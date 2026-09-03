import Testing
@testable import CricketCore

private func bounds() -> WaterBounds {
    WaterBounds(width: Config.World.width,
                height: Config.World.height,
                top: Config.World.height * Config.World.horizonFraction)
}

@Test func waterStaysOutOfTheSky() {
    let b = bounds()
    let water = createWater(bounds: b, rng: SeededRandom(seed: 3))
    #expect(!water.isEmpty)
    for circle in water {
        #expect(circle.y - circle.radius * 0.6 > b.top - circle.radius)
    }
}

@Test func theSpawnPointStartsDry() {
    let b = bounds()
    let water = createWater(bounds: b, rng: SeededRandom(seed: 5))
    let spawnX = b.width / 2
    let spawnY = b.top + (b.height - b.top) / 2
    #expect(!isWaterAt(water, x: spawnX, y: spawnY, margin: Config.Cricket.radius))
}

@Test func marginMakesABodyStopAtTheBank() {
    let water = [Circle(x: 100, y: 100, radius: 20)]
    #expect(!isWaterAt(water, x: 130, y: 100, margin: 0))
    #expect(isWaterAt(water, x: 130, y: 100, margin: 12))
}

@Test func generationIsDeterministicForASeed() {
    let a = createWater(bounds: bounds(), rng: SeededRandom(seed: 9))
    let b = createWater(bounds: bounds(), rng: SeededRandom(seed: 9))
    #expect(a == b)
}
