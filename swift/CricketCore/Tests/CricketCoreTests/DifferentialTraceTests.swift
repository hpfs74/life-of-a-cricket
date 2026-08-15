// A permanent differential harness: it drives the Swift `Game` through the
// exact same scripted inputs as `swift/tools/dump-game-trace.mjs` drives the
// real `src/game.js` through, from the same LCG seed, and compares every
// frame. Unit tests pin individual rules; this catches the thing they
// structurally cannot — a regression in the ORDER operations run in, or the
// order RNG draws happen in, that still satisfies every rule in isolation but
// diverges the two simulations over time.
//
// The four scenarios below are fixed at `swift/tools/dump-game-trace.mjs`;
// regenerate their fixtures with
//   node swift/tools/dump-game-trace.mjs <scenario> > swift/CricketCore/Tests/CricketCoreTests/Fixtures/trace-<scenario>.json
// if `src/game.js` (or one of the systems it drives) changes on purpose. If
// this test ever fails without such a change, the JavaScript is the
// reference: fix the Swift, never the fixture.
import Testing
import Foundation
@testable import CricketCore

private struct GoldenFrame: Decodable {
    let elapsed: Double
    let phase: String
    let stage: String
    let day: Int
    let night: Bool
    let lives: Int
    let points: Double
    let multiplier: Double
    let attention: Double
    let cricketX: Double
    let cricketY: Double
    let singing: Bool
    let jumping: Bool
    let stunnedFor: Double
    let hidden: Bool
    let birds: Int
    let rivals: Int
    let spiders: Int
    let food: Int
    let newRecord: Bool
    let events: [String]
}

private struct GoldenTrace: Decodable {
    let scenario: String
    let seed: Double
    let frames: [GoldenFrame]
}

private func loadTrace(_ name: String) throws -> GoldenTrace {
    let url = try #require(Bundle.module.url(forResource: "trace-\(name)", withExtension: "json"))
    return try JSONDecoder().decode(GoldenTrace.self, from: Data(contentsOf: url))
}

/// Generous enough for accumulated Double error over a few hundred frames,
/// far tighter than any real divergence: a reordered RNG draw or a step out
/// of sequence moves these values by whole units within a handful of frames,
/// not by a millionth.
private let tolerance = 1e-6

private func phaseString(_ phase: Phase) -> String {
    switch phase {
    case .menu: return "menu"
    case .playing: return "playing"
    case .gameOver: return "gameOver"
    }
}

private func threatString(_ threat: Threat) -> String {
    switch threat {
    case .bird: return "bird"
    case .bat: return "bat"
    case .spider: return "spider"
    case .cat: return "cat"
    case .human: return "human"
    }
}

/// Canonical, float-free string for one event — the Swift-side twin of
/// `traceEvent` in dump-game-trace.mjs. Keep the two in lockstep by hand.
private func traceEvent(_ event: GameEvent) -> String {
    switch event {
    case .songStart: return "song-start"
    case .songBreak: return "song-break"
    case .jump: return "jump"
    case .land: return "land"
    case .strike(let connected): return "strike:\(connected ? "hit" : "miss")"
    case .bugHit(let kind): return "bug-hit:\(kind.rawValue)"
    case .bugKilled(let kind, let drops): return "bug-killed:\(kind.rawValue):\(drops)"
    case .stunned(let kind): return "stunned:\(kind.rawValue)"
    case .ate(let item): return "ate:\(item.type.rawValue)"
    case .rivalAte(let item): return "rival-ate:\(item.type.rawValue)"
    case .birdSpawn(let kind): return "bird-spawn:\(kind.rawValue)"
    case .birdCry(let kind): return "bird-cry:\(kind.rawValue)"
    case .spiderWake: return "spider-wake"
    case .spiderLunge: return "spider-lunge"
    case .spiderMiss: return "spider-miss"
    case .catNoticed: return "cat-noticed"
    case .catLost: return "cat-lost"
    case .catPounced: return "cat-pounced"
    case .catMissed: return "cat-missed"
    case .humanApproaching: return "human-approaching"
    case .footfall: return "footfall"
    case .humanGone: return "human-gone"
    case .newDay(let day): return "new-day:\(day)"
    case .stageChange(let stage): return "stage-change:\(stage.rawValue)"
    case .hit(let from): return "hit:\(threatString(from))"
    case .gameOver: return "game-over"
    }
}

/// Every mismatch between one Swift frame and its JS golden counterpart, so a
/// failing frame reports everything wrong with it at once rather than one
/// assertion at a time.
private func mismatches(_ game: Game, _ events: [GameEvent], _ golden: GoldenFrame) -> [String] {
    var problems: [String] = []

    func close(_ swift: Double, _ js: Double, _ label: String) {
        if abs(swift - js) >= tolerance { problems.append("\(label): swift=\(swift) js=\(js)") }
    }
    func same<T: Equatable>(_ swift: T, _ js: T, _ label: String) {
        if swift != js { problems.append("\(label): swift=\(swift) js=\(js)") }
    }

    close(game.elapsed, golden.elapsed, "elapsed")
    same(phaseString(game.phase), golden.phase, "phase")
    same(game.stage.rawValue, golden.stage, "stage")
    same(game.day, golden.day, "day")
    same(game.night, golden.night, "night")
    same(game.lives, golden.lives, "lives")
    close(game.score.points, golden.points, "points")
    close(game.score.multiplier, golden.multiplier, "multiplier")
    close(game.attention.value, golden.attention, "attention")
    close(game.cricket.x, golden.cricketX, "cricketX")
    close(game.cricket.y, golden.cricketY, "cricketY")
    same(game.cricket.singing, golden.singing, "singing")
    same(game.cricket.jumping, golden.jumping, "jumping")
    close(game.cricket.stunnedFor, golden.stunnedFor, "stunnedFor")
    same(game.hidden, golden.hidden, "hidden")
    same(game.birds.count, golden.birds, "birds")
    same(game.rivals.count, golden.rivals, "rivals")
    same(game.spiders.count, golden.spiders, "spiders")
    same(game.food.items.count, golden.food, "food")
    same(game.newRecord, golden.newRecord, "newRecord")
    same(events.map(traceEvent), golden.events, "events")

    return problems
}

private let dt = 1.0 / 60

/// Drives `game` through `trace`, frame by frame. `driver` is called before
/// each `update` and may mutate `game` directly (e.g. teleporting the
/// cricket onto a doorway) before returning that frame's intent — matching
/// `intentFor(game, i)` in dump-game-trace.mjs exactly.
private func replay(
    _ game: inout Game, trace: GoldenTrace, scenario: String,
    driver: (inout Game, Int) -> Intent
) {
    for (index, goldenFrame) in trace.frames.enumerated() {
        let intent = driver(&game, index)
        let events = game.update(intent: intent, dt: dt)
        let problems = mismatches(game, events, goldenFrame)
        #expect(problems.isEmpty, "\(scenario) frame \(index): \(problems.joined(separator: "; "))")
        if !problems.isEmpty { break } // one divergence cascades into hundreds; stop at the first
    }
}

@Test func singingScenarioMatchesTheJavaScriptTraceFrameByFrame() throws {
    let trace = try loadTrace("singing")
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    game.startRun()
    replay(&game, trace: trace, scenario: "singing") { _, _ in Intent(sing: true) }
}

@Test func silentBaselineScenarioMatchesTheJavaScriptTraceFrameByFrame() throws {
    let trace = try loadTrace("silent-baseline")
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 21))
    game.startRun()
    replay(&game, trace: trace, scenario: "silent-baseline") { _, _ in .idle }
}

/// A connecting strike against a beetle: the first hit stuns and knocks the
/// cricket back; once the stun clears the driver chases the (now-wandering)
/// beetle back into reach and lands the kill. See dump-game-trace.mjs's
/// `combat` scenario for why this reacts to live state each frame rather
/// than following a fixed frame budget.
@Test func combatScenarioMatchesTheJavaScriptTraceFrameByFrame() throws {
    let trace = try loadTrace("combat")
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    game.startRun()

    game.cricket.dirX = 1
    game.cricket.dirY = 0
    game.rivals = [Rival(
        x: game.cricket.x + 20, y: game.cricket.y, dirX: 1, dirY: 0, kind: .beetle,
        health: RivalKind.beetle.health, flashFor: 0, nibbleFor: 0, phase: 0,
        targetX: game.cricket.x + 20, targetY: game.cricket.y
    )]

    replay(&game, trace: trace, scenario: "combat") { game, _ in
        guard let rival = game.rivals.first else { return .idle }
        if game.cricket.stunnedFor > 0 { return .idle }

        let dx = rival.x - game.cricket.x
        let dy = rival.y - game.cricket.y
        let reach = Config.Cricket.Strike.reach + Config.Rivals.radius

        if hypot2(dx, dy) > reach {
            return Intent(dx: dx, dy: dy)
        }
        return Intent(strike: true)
    }
}

/// A full round trip: meadow, through the door into the house, and back out
/// to the meadow again. See dump-game-trace.mjs's `house-round-trip`
/// scenario for the frame budget behind the teleport at frame 85.
@Test func houseRoundTripScenarioMatchesTheJavaScriptTraceFrameByFrame() throws {
    let trace = try loadTrace("house-round-trip")
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 15))
    game.startRun()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y

    replay(&game, trace: trace, scenario: "house-round-trip") { game, index in
        if index == 85 {
            game.cricket.x = game.world.door.x
            game.cricket.y = game.world.door.y
        }
        return .idle
    }
}
