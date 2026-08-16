// The Swift standard library has no trig functions (unlike `.squareRoot()`,
// which is part of `FloatingPoint`); `cos` needs the platform's libm.
// This is the platform C library, not Foundation, so it stays within the
// "stdlib only" constraint.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// The run's clock. One "day" is a full light cycle: it dawns bright, darkens to
/// midnight halfway through, and lightens again.
///
/// Simulation and rendering both read from here so the day counter, the sky and
/// which predator is hunting can never disagree with each other.

/// Which day a moment falls on. One-based: a run starts on day 1.
public func dayAt(_ elapsedSeconds: Double) -> Int {
    1 + Int((elapsedSeconds / Config.Game.secondsPerDay).rounded(.down))
}

/// How far through the current day a moment is, from 0 to just under 1.
public func phaseOfDay(_ elapsedSeconds: Double) -> Double {
    let phase = elapsedSeconds.truncatingRemainder(dividingBy: Config.Game.secondsPerDay) / Config.Game.secondsPerDay
    return phase < 0 ? phase + 1 : phase
}

/// 0 at dawn, 1 at midnight, back to 0 at the next dawn.
///
/// A raised cosine rather than a sawtooth, so the sky never snaps from black to
/// bright at the day boundary.
public func darknessAt(_ elapsedSeconds: Double) -> Double {
    (1 - cos(phaseOfDay(elapsedSeconds) * Double.pi * 2)) / 2
}

/// True through the dark half of the cycle, when bats hunt instead of birds.
public func isNight(_ elapsedSeconds: Double) -> Bool {
    darknessAt(elapsedSeconds) > 0.5
}
