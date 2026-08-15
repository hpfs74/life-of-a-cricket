/// Water is a list of overlapping circles. Circles are trivial to hit-test and,
/// strung together, they read as a meandering stream or a rounded pond without
/// needing any polygon work.
///
/// This type knows nothing about the rest of the world, so world generation can
/// build terrain on top of it without a circular dependency.

// The Swift standard library has no trig functions (unlike `.squareRoot()`,
// which is part of `FloatingPoint`); `sin`/`cos` need the platform's libm.
// This is the platform C library, not Foundation, so it stays within the
// "stdlib only" constraint.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// The playable ground band a meadow generates water within.
public struct WaterBounds: Equatable, Sendable {
    public var width: Double
    public var height: Double
    public var top: Double
    public init(width: Double, height: Double, top: Double) {
        self.width = width; self.height = height; self.top = top
    }
}

// Structural layout constants from src/water.js, not gameplay tunables: how far
// the stream's band sits in from the top/bottom of the ground, and how far the
// x-clamp keeps the stream and ponds in from the world's east/west edges.
private let bandInset = 8.0
private let xClampMargin = 80.0
private let pondCentreXClampMargin = 100.0
private let pondCentreYInset = 60.0
private let pondCentreYSlack = 120.0
private let pondCentreXSlack = 200.0

private func range(_ rng: RandomSource, _ interval: ClosedRange<Double>) -> Double {
    interval.lowerBound + rng.next() * (interval.upperBound - interval.lowerBound)
}

/// A stream running across the ground band, narrow in places and wide in others.
private func createStream(_ bounds: WaterBounds, _ rng: RandomSource) -> [Circle] {
    let width = bounds.width, height = bounds.height, top = bounds.top

    let bandTop = top + bandInset
    let bandBottom = height - bandInset
    let middle = width / 2

    // Start to one side of the spawn point, far enough that the cricket never
    // begins a run standing in the water.
    let side: Double = rng.next() < 0.5 ? -1 : 1
    let offset = Config.Water.spawnClearance + Config.Water.streamMaxRadius
        + rng.next() * (width * 0.3)
    var x = min(width - xClampMargin, max(xClampMargin, middle + side * offset))

    let phase = rng.next() * Double.pi * 2
    var circles: [Circle] = []

    let segments = Config.Water.streamSegments
    for i in 0...segments {
        let t = Double(i) / Double(segments)
        let y = bandTop + t * (bandBottom - bandTop)

        x += (rng.next() - 0.5) * Config.Water.streamWander
        x = min(width - xClampMargin, max(xClampMargin, x))

        // A slow wave along the length gives fordable narrows and impassable pools.
        let swell = 0.5 + 0.5 * sin(t * Double.pi * 3 + phase)
        let radius = Config.Water.streamMinRadius
            + (Config.Water.streamMaxRadius - Config.Water.streamMinRadius) * swell

        circles.append(Circle(x: x, y: y, radius: radius))
    }

    return circles
}

/// A pond: a handful of overlapping blobs around a centre.
private func createPond(_ bounds: WaterBounds, _ rng: RandomSource) -> [Circle] {
    let width = bounds.width, height = bounds.height, top = bounds.top
    let middle = width / 2

    let centreY = top + pondCentreYInset + rng.next() * max(1, height - top - pondCentreYSlack)
    var centreX = pondCentreXClampMargin + rng.next() * max(1, width - pondCentreXSlack)

    // Shove it clear of the spawn point rather than rejecting the whole pond.
    if abs(centreX - middle) < Config.Water.spawnClearance {
        centreX = middle + (centreX >= middle ? 1 : -1) * Config.Water.spawnClearance
        centreX = min(width - pondCentreXClampMargin, max(pondCentreXClampMargin, centreX))
    }

    return (0..<Config.Water.pondBlobs).map { _ in
        let radius = range(rng, Config.Water.pondRadiusRange)
        let angle = rng.next() * Double.pi * 2
        let reach = rng.next() * radius * 0.9
        return Circle(x: centreX + cos(angle) * reach,
                      y: centreY + sin(angle) * reach * 0.6,
                      radius: radius)
    }
}

/// Builds one stream plus a pond or two for a meadow of the given bounds.
public func createWater(bounds: WaterBounds, rng: RandomSource) -> [Circle] {
    let pondRange = Config.Water.pondCountRange
    let ponds = (pondRange.lowerBound + rng.next() * (pondRange.upperBound - pondRange.lowerBound)).rounded()

    var circles = createStream(bounds, rng)
    for _ in 0..<Int(ponds) { circles.append(contentsOf: createPond(bounds, rng)) }

    // Keep water inside the ground band; nothing should lap into the sky.
    return circles.filter { $0.y - $0.radius * 0.6 > bounds.top - $0.radius }
}

/// True when a body of the given margin would be touching water.
/// Pass the mover's radius as `margin` so it stops at the bank, not in it.
public func isWaterAt(_ water: [Circle], x: Double, y: Double, margin: Double = 0) -> Bool {
    for circle in water {
        if hypot2(circle.x - x, circle.y - y) < circle.radius + margin { return true }
    }
    return false
}
