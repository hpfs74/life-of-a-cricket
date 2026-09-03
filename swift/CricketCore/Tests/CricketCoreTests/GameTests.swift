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

@Test func theMercyWindowStopsASecondHitFromCostingASecondLife() {
    var game = newGame()
    let before = game.lives

    // Drop a bird on top of the cricket, mid-dive, and land the first hit.
    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    var sawFirstHit = false
    for _ in 0..<10 {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .hit = event { sawFirstHit = true }
        }
        if sawFirstHit { break }
    }
    #expect(sawFirstHit)
    #expect(game.lives == before - 1)

    // Land a second dive on the same spot, well inside the 1.6s mercy window.
    var second = Bird.spawn(world: game.world, rng: SeededRandom(seed: 2),
                            difficulty: 1, kind: .bird, focus: nil)
    second.state = .dive
    second.x = game.cricket.x; second.y = game.cricket.y
    second.targetX = game.cricket.x; second.targetY = game.cricket.y
    game.birds = [second]

    var sawSecondHit = false
    for _ in 0..<10 {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .hit = event { sawSecondHit = true }
        }
    }

    #expect(!sawSecondHit, "a hit inside the mercy window should not register at all")
    #expect(game.lives == before - 1, "only one life should have been lost")
}

/** Parks a bug of the given kind just in front of the cricket, facing it. */
@discardableResult
private func bugInFront(_ game: inout Game, kind: RivalKind) -> Rival {
    let bug = Rival(
        x: game.cricket.x + 20, y: game.cricket.y, dirX: 1, dirY: 0, kind: kind,
        health: kind.health, flashFor: 0, nibbleFor: 999, phase: 0,
        targetX: 0, targetY: 0
    )
    game.rivals = [bug]
    game.cricket.dirX = 1
    game.cricket.dirY = 0
    return bug
}

@Test func killingAnAntLeavesAGrubWhereItFell() {
    var game = newGame()
    game.food.items = []
    let ant = bugInFront(&game, kind: .ant)

    let events = game.update(intent: Intent(strike: true), dt: 1.0 / 60)

    #expect(events.contains { if case .bugKilled(let kind, _) = $0 { return kind == .ant }; return false })
    #expect(game.rivals.isEmpty)
    #expect(game.food.items.count == RivalKind.ant.drops)
    #expect(game.food.items.first?.type == .grub)
    if let drop = game.food.items.first {
        #expect(hypot2(drop.x - ant.x, drop.y - ant.y) < 30)
    }
}

@Test func aBeetleTakesTwoSwingsAndStunsTheCricketInBetween() {
    var game = newGame()
    game.food.items = []
    bugInFront(&game, kind: .beetle)

    let first = game.update(intent: Intent(strike: true), dt: 1.0 / 60)
    #expect(first.contains { if case .bugHit = $0 { return true }; return false })
    #expect(first.contains { if case .stunned = $0 { return true }; return false })
    #expect(game.cricket.stunnedFor > 0)
    #expect(game.rivals.count == 1, "it should still be standing")

    // Shake off the stun, then finish it.
    for _ in 0..<60 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.cricket.stunnedFor == 0)

    game.rivals[0].x = game.cricket.x + 20
    game.rivals[0].y = game.cricket.y
    let second = game.update(intent: Intent(strike: true), dt: 1.0 / 60)

    #expect(second.contains { if case .bugKilled(let kind, _) = $0 { return kind == .beetle }; return false })
    #expect(game.food.items.count == RivalKind.beetle.drops, "a beetle should pay double")
}

@Test func aStunnedCricketCannotMoveSingLeapOrSwing() {
    var game = newGame()
    bugInFront(&game, kind: .beetle)
    game.update(intent: Intent(strike: true), dt: 1.0 / 60)
    #expect(game.cricket.stunnedFor > 0)

    let startX = game.cricket.x
    let events = game.update(intent: Intent(dx: 1, dy: 0, sing: true, jump: true, strike: true), dt: 1.0 / 60)

    #expect(game.cricket.x == startX, "it moved while stunned")
    #expect(!game.cricket.singing)
    #expect(!game.cricket.jumping)
    #expect(!events.contains { if case .strike = $0 { return true }; return false })
}

@Test func aSilentCricketInTheOpenScoresNothing() {
    var game = newGame()
    // The cricket spawns in the open by construction; confirm it and stay still.
    #expect(!game.hidden)

    for _ in 0..<120 { game.update(intent: still, dt: 1.0 / 60) }

    #expect(game.score.points == 0, "no song, no points, cover or not")
    #expect(!game.hidden)
}
