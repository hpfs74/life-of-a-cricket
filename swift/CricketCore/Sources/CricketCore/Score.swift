/// Stores the run's high score. A protocol rather than an embedded browser
/// `localStorage` handle (as `src/score.js` uses) so `Score` stays a pure
/// value type and `CricketCore` stays free of any platform storage API.
public protocol HighScoreStore: AnyObject {
    func load() -> Int
    func save(_ value: Int)
}

/// An in-memory `HighScoreStore`, used by tests and as the default.
public final class MemoryHighScoreStore: HighScoreStore {
    private var value: Int

    public init(_ value: Int = 0) {
        self.value = value
    }

    public func load() -> Int { value }
    public func save(_ value: Int) { self.value = value }
}

/// Points, the singing multiplier, the fed meter and the run's high score.
public struct Score: Equatable, Sendable {
    public var points: Double
    public var multiplier: Double
    public var fed: Double
    public var highScore: Int

    public init(
        points: Double = 0,
        multiplier: Double = Config.Score.multiplierStart,
        fed: Double = 0,
        highScore: Int = 0
    ) {
        self.points = points
        self.multiplier = multiplier
        self.fed = fed
        self.highScore = highScore
    }

    /// Awards one frame of song and climbs the multiplier. Returns points gained.
    @discardableResult
    public mutating func tickSong(dt: Double) -> Double {
        let gained = Config.Score.songPointsPerSecond * multiplier * dt
        points += gained

        let climbRate = Config.Score.multiplierClimbPerSecond
            * (fed > 0 ? Config.Score.fedClimbBonus : 1)
        multiplier = min(Config.Score.multiplierMax, multiplier + climbRate * dt)

        return gained
    }

    public mutating func breakSong() {
        multiplier = Config.Score.multiplierStart
    }

    public mutating func tickFed(dt: Double) {
        fed = max(0, fed - dt)
    }

    public mutating func eat(value: Double) {
        points += value
        fed = Config.Score.fedSeconds
    }

    /// Persists the run's score if it beat the record. Returns true on a new record.
    @discardableResult
    public mutating func commitHighScore(to store: HighScoreStore) -> Bool {
        let final = Int(points.rounded(.down))
        if final <= highScore { return false }

        highScore = final
        store.save(final)
        return true
    }
}
