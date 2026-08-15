/// A source of uniform values in [0, 1).
///
/// A reference type on purpose: it threads through world generation without
/// `inout` at every call site, matching the reference semantics of the `rng`
/// closure the JavaScript passes around.
public protocol RandomSource: AnyObject {
    func next() -> Double
}

/// The linear congruential generator `tests/world.test.js` uses.
///
/// Reproduced exactly so the Swift and JavaScript implementations can be given
/// the same seed and compared field for field (see WorldGoldenTests).
public final class SeededRandom: RandomSource {
    private var state: UInt64

    public init(seed: UInt64) {
        self.state = seed
    }

    public func next() -> Double {
        state = (state &* 1664525 &+ 1013904223) % 4294967296
        return Double(state) / 4294967296
    }
}

/// A degenerate source returning a constant. Mirrors `fixedRng = () => 0.5`.
///
/// Note the trap documented in `tests/game.test.js`: 0.5 yields a meadow with
/// NO cover, because every rejection-sample candidate lands on the spawn point.
/// Tests needing real cover must use `SeededRandom`.
public final class FixedRandom: RandomSource {
    private let value: Double
    public init(_ value: Double) { self.value = value }
    public func next() -> Double { value }
}
