import Testing
@testable import CricketCore

@Test func daysAreOneBased() {
    #expect(dayAt(0) == 1)
    #expect(dayAt(Config.Game.secondsPerDay - 0.1) == 1)
    #expect(dayAt(Config.Game.secondsPerDay) == 2)
}

@Test func darknessPeaksAtMidnightAndReturnsToDawn() {
    #expect(abs(darknessAt(0) - 0) < 1e-9)
    #expect(abs(darknessAt(Config.Game.secondsPerDay / 2) - 1) < 1e-9)
    #expect(abs(darknessAt(Config.Game.secondsPerDay) - 0) < 1e-9)
}

@Test func nightIsTheDarkHalfOfTheCycle() {
    #expect(!isNight(0))
    #expect(isNight(Config.Game.secondsPerDay / 2))
}
