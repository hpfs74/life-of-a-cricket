// The Swift standard library has no `exp` (unlike `.squareRoot()`, which is
// part of `FloatingPoint`); it needs the platform's libm.
// This is the platform C library, not Foundation, so it stays within the
// "stdlib only" constraint.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

// Once the camera is this close to its target it snaps the rest of the way,
// so a resting camera cannot drift by a fraction of a pixel.
private let settleThreshold = 0.01

/// The furthest left-edge position the camera may take without showing past the meadow.
public func cameraLimit(_ world: World) -> Double {
    max(0, world.width - Config.View.width)
}

private func framed(_ world: World, _ targetX: Double) -> Double {
    min(cameraLimit(world), max(0, targetX - Config.View.width / 2))
}

/// A horizontal camera. The meadow is wider than the window, so the view slides
/// sideways to keep the cricket centred, stopping at either end of the world.
///
/// It starts already framing the cricket: a run should open on the player, not
/// slide across to find them.
public struct Camera: Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(world: World, target: Point) {
        self.x = framed(world, target.x)
        self.y = 0
    }

    /// Eases toward the framing position. The exponential form makes the follow rate
    /// independent of frame rate, so the camera feels the same on any display.
    @discardableResult
    public mutating func update(target: Point, world: World, dt: Double) -> Camera {
        let desired = framed(world, target.x)
        let catchUp = 1 - exp(-Config.View.followPerSecond * dt)

        x += (desired - x) * catchUp

        // Settle exactly, so a resting camera cannot drift by a fraction of a pixel.
        if abs(desired - x) < settleThreshold { x = desired }

        return self
    }
}
