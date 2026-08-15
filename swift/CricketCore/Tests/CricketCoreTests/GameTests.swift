import Testing
@testable import CricketCore

private func newGame(seed: UInt64 = 7) -> Game {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: seed))
    game.startRun()
    return game
}

private let still = Intent.idle
private let singing = Intent(sing: true)

@Test func aNewGameSitsInTheMenuUntilTheRunStarts() {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    #expect(game.phase == .menu)

    game.startRun()
    #expect(game.phase == .playing)
    #expect(game.lives == Config.Game.startingLives)
    #expect(game.elapsed == 0)
    #expect(game.birds.isEmpty)
}

@Test func difficultyRampsFromOneToTheCapAndHolds() {
    #expect(difficultyAt(0) == 1)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds / 2) > 1)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds) == Config.Game.difficultyMax)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds * 10) == Config.Game.difficultyMax)
}

@Test func theMenuSimulatesNothing() {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    #expect(game.update(intent: singing, dt: 1).isEmpty)
    #expect(game.elapsed == 0)
}

@Test func singingScoresAndEventuallySummonsAPredator() {
    var game = newGame()
    var sawSpawn = false
    for _ in 0..<600 {
        for event in game.update(intent: singing, dt: 1.0 / 60) {
            if case .birdSpawn = event { sawSpawn = true }
        }
    }
    #expect(game.score.points > 0)
    #expect(sawSpawn)
}

@Test func singingFromCoverScoresNothing() {
    var game = newGame()
    // Stand the cricket inside a tuft.
    game.world.cover = [Cover(x: game.cricket.x, y: game.cricket.y, radius: 60, type: .grass)]

    for _ in 0..<120 { game.update(intent: singing, dt: 1.0 / 60) }
    #expect(game.score.points == 0, "cover is safety, not points")
    #expect(game.hidden)
}

@Test func aHitCostsALifeAndGrantsMercy() {
    var game = newGame()
    let before = game.lives

    // Drop a bird on top of the cricket, mid-dive.
    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    var sawHit = false
    for _ in 0..<10 {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .hit = event { sawHit = true }
        }
        if sawHit { break }
    }
    #expect(sawHit)
    #expect(game.lives == before - 1)
    #expect(game.cricket.invulnerableFor > 0)
}

@Test func theRunEndsWhenTheLivesAreGone() {
    var game = newGame()
    game.lives = 1

    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    var sawGameOver = false
    for _ in 0..<10 {
        if game.update(intent: still, dt: 1.0 / 60).contains(.gameOver) { sawGameOver = true }
    }
    #expect(sawGameOver)
    #expect(game.phase == .gameOver)
}

@Test func aNewDayRearrangesTheMeadowButNeverBuriesTheCricket() {
    var game = newGame()
    var sawNewDay = false

    for _ in 0..<Int(Config.Game.secondsPerDay * 61) {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .newDay = event { sawNewDay = true }
        }
        if sawNewDay { break }
    }
    #expect(sawNewDay)
    #expect(!game.world.isWater(x: game.cricket.x, y: game.cricket.y,
                                margin: Config.Cricket.radius))
    #expect(!game.cricket.jumping, "a leap in progress is cancelled")
}

@Test func walkingIntoTheDoorwayMovesTheCricketIndoors() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y

    var events: [GameEvent] = []
    for _ in 0..<5 { events += game.update(intent: still, dt: 1.0 / 60) }

    #expect(events.contains(.stageChange(stage: .house)))
    #expect(game.stage == .house)
    #expect(game.cat != nil, "the house has its own cast")
    #expect(game.birds.isEmpty, "nothing follows the cricket through a doorway")
}

@Test func scoreAndLivesCarryThroughTheDoorway() {
    var game = newGame()
    game.score.points = 500
    game.lives = 2
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y

    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }

    #expect(game.score.points == 500, "going indoors is a change of scene, not a new run")
    #expect(game.lives == 2)
}

@Test func birdsNeverComeIndoors() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y
    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.stage == .house)

    for _ in 0..<3600 { game.update(intent: singing, dt: 1.0 / 60) }
    #expect(game.birds.isEmpty)
}

@Test func theHouseDoesNotRearrangeItselfOvernight() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y
    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.stage == .house)

    let furniture = game.world.cover
    for _ in 0..<Int(Config.Game.secondsPerDay * 61) {
        game.update(intent: still, dt: 1.0 / 60)
        if game.stage != .house { break }
    }
    if game.stage == .house {
        #expect(game.world.cover == furniture)
    }
}

@Test func swingingIsLoudEnoughToDrawAttention() {
    var game = newGame()
    let before = game.attention.value
    game.update(intent: Intent(strike: true), dt: 1.0 / 60)
    #expect(game.attention.value > before)
}

@Test func aNewRecordIsReportedAtTheEnd() {
    var game = newGame()
    game.score.points = 1000
    game.lives = 1

    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    for _ in 0..<10 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.phase == .gameOver)
    #expect(game.newRecord)
}
