import Testing
@testable import CricketCore

@Test func singingScoresAndClimbsTheMultiplier() {
    var score = Score()
    let gained = score.tickSong(dt: 1)
    #expect(abs(gained - Config.Score.songPointsPerSecond) < 1e-9)
    #expect(score.multiplier > Config.Score.multiplierStart)
}

@Test func theMultiplierClimbsFasterWhileFed() {
    var plain = Score()
    var fed = Score()
    fed.eat(value: 10)

    plain.tickSong(dt: 1)
    fed.tickSong(dt: 1)
    #expect(fed.multiplier > plain.multiplier)
}

@Test func breakingTheSongResetsTheMultiplier() {
    var score = Score()
    score.tickSong(dt: 5)
    score.breakSong()
    #expect(score.multiplier == Config.Score.multiplierStart)
}

@Test func theMultiplierIsCapped() {
    var score = Score()
    for _ in 0..<10_000 { score.tickSong(dt: 0.1) }
    #expect(score.multiplier == Config.Score.multiplierMax)
}

@Test func aRecordIsPersistedOnlyWhenBeaten() {
    let store = MemoryHighScoreStore()
    var score = Score(highScore: 100)

    score.points = 50
    #expect(score.commitHighScore(to: store) == false)

    score.points = 500
    #expect(score.commitHighScore(to: store) == true)
    #expect(store.load() == 500)
}
