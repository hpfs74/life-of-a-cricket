/// What the player is asking for this frame, independent of input device.
///
/// Keyboard, touch and face inputs all produce this and nothing else, so the
/// simulation never learns which device is driving it.
public struct Intent: Equatable, Sendable {
    public var dx: Double
    public var dy: Double
    public var sing: Bool
    public var jump: Bool
    public var strike: Bool

    public init(dx: Double = 0, dy: Double = 0,
                sing: Bool = false, jump: Bool = false, strike: Bool = false) {
        self.dx = dx; self.dy = dy
        self.sing = sing; self.jump = jump; self.strike = strike
    }

    public static let idle = Intent()
}
