import Foundation
import SwiftUI
import CricketCore

/// Persists the high score in UserDefaults. The core stays free of any
/// platform storage API; this is the app's half of that bargain.
final class UserDefaultsHighScoreStore: HighScoreStore {
    private let key = Config.Score.storageKey
    func load() -> Int { UserDefaults.standard.integer(forKey: key) }
    func save(_ value: Int) { UserDefaults.standard.set(value, forKey: key) }
}

/// A source of uniform values in [0, 1) backed by the system RNG.
///
/// The core deliberately ships only seeded generators so its tests stay
/// deterministic; a real, unseeded source belongs here in the app layer.
final class SystemRandom: RandomSource {
    func next() -> Double { Double.random(in: 0..<1) }
}

/// Owns the simulation and the frame clock.
///
/// A reference type at this boundary so SwiftUI does not copy a whole `Game`
/// sixty times a second; `Game` itself stays a pure value type inside the core.
@MainActor
final class GameRunner: ObservableObject {
    private(set) var game: Game
    private(set) var camera: Camera
    private(set) var latestEvents: [GameEvent] = []

    private var lastDate: Date?
    private var startRequested = false

    init() {
        let store = UserDefaultsHighScoreStore()
        let rng = SystemRandom()
        game = Game(store: store, rng: rng)
        camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
    }

    func requestStart() { startRequested = true }

    /// Advances the simulation to `date`. Guarded against SwiftUI evaluating the
    /// view body more than once for a single date, which would double-step time.
    func advance(to date: Date, intent: Intent) {
        guard lastDate != date else { return }
        let dt = min(date.timeIntervalSince(lastDate ?? date), Config.Game.maxFrameDelta)
        lastDate = date

        if startRequested {
            startRequested = false
            if game.phase != .playing {
                game.startRun()
                camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
            }
        }

        latestEvents = game.update(intent: intent, dt: dt)

        // A doorway swaps the whole world out; re-frame rather than sliding across.
        if latestEvents.contains(where: { if case .stageChange = $0 { return true }; return false }) {
            camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
        }

        camera.update(target: Point(x: game.cricket.x, y: game.cricket.y), world: game.world, dt: dt)
    }
}
