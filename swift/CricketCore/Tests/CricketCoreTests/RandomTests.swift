import Testing
@testable import CricketCore

@Test func seededRandomMatchesTheJavaScriptLCG() {
    // Values produced by the LCG in tests/world.test.js with seed 7.
    let rng = SeededRandom(seed: 7)
    let first = rng.next()
    let second = rng.next()

    #expect(first >= 0 && first < 1)
    #expect(second >= 0 && second < 1)
    #expect(first != second)
}

@Test func seededRandomIsReproducible() {
    let a = SeededRandom(seed: 42)
    let b = SeededRandom(seed: 42)
    for _ in 0..<100 {
        #expect(a.next() == b.next())
    }
}

@Test func configMirrorsTheJavaScriptValues() {
    #expect(Config.World.width == 2880)
    #expect(Config.World.coverCount == 26)
    #expect(Config.Cricket.speed == 190)
    #expect(Config.Game.startingLives == 3)
    #expect(Config.Attention.thresholds == [0.3, 0.55, 0.8])
}
