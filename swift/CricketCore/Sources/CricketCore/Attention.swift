/// How loud the cricket has been, and how close it is to drawing a predator.
///
/// Each threshold in `Config.Attention.thresholds` fires once on the way up
/// and only re-arms after the value falls a margin below it, so hovering on a
/// boundary cannot machine-gun predators.
public struct Attention: Equatable, Sendable {
    public var value: Double
    public var armed: [Bool]

    public init(
        value: Double = 0,
        armed: [Bool] = Config.Attention.thresholds.map { _ in true }
    ) {
        self.value = value
        self.armed = armed
    }

    /// Advances the meter and reports how many predators it summoned this frame.
    @discardableResult
    public mutating func tick(singing: Bool, dt: Double) -> Int {
        let rate = singing ? Config.Attention.risePerSecond : -Config.Attention.decayPerSecond
        value = min(1, max(0, value + rate * dt))

        var spawned = 0

        for (index, threshold) in Config.Attention.thresholds.enumerated() {
            if value >= threshold && armed[index] {
                armed[index] = false
                spawned += 1
            } else if value < threshold - Config.Attention.rearmMargin {
                armed[index] = true
            }
        }

        return spawned
    }

    public mutating func reset() {
        value = 0
        armed = Config.Attention.thresholds.map { _ in true }
    }
}
