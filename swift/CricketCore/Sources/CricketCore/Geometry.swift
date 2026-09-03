public struct Point: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

public struct Circle: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var radius: Double
    public init(x: Double, y: Double, radius: Double) {
        self.x = x; self.y = y; self.radius = radius
    }
}

@inlinable
public func hypot2(_ dx: Double, _ dy: Double) -> Double {
    (dx * dx + dy * dy).squareRoot()
}

@inlinable
public func distance(_ a: Point, _ b: Point) -> Double {
    hypot2(a.x - b.x, a.y - b.y)
}
