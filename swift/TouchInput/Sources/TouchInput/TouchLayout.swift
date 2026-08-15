import CoreGraphics
import Foundation
import CricketCore

/// The three action buttons under the right thumb. Order matters: it is the
/// hit-test order in `buttonAt`, matching the JS's `layout.buttons` array.
public enum TouchButtonID: String, CaseIterable, Hashable, Sendable {
    case sing, jump, fight
}

/// One button's screen position and label, part of a `TouchLayout`.
public struct TouchButton: Equatable, Sendable {
    public var id: TouchButtonID
    public var label: String
    public var x: Double
    public var y: Double
}

/// Where the stick zone and the three buttons sit on a screen of this size.
/// Ports `touchLayout()` from `src/render/touchcontrols.js`. All positions
/// are in the whole screen's own coordinate space (CSS pixels there, points
/// here) — not world units — because the controls deliberately live in the
/// letterbox bars around the playfield, never over the meadow.
public struct TouchLayout: Equatable, Sendable {
    public var radius: Double
    public var arcRadius: Double
    public var stickMaxRadius: Double
    public var stickZone: CGRect
    public var buttons: [TouchButton]
}

/// Ports `touchLayout(width, height)`: button size scales with the screen's
/// short side, and the three buttons sweep a quarter-arc from the
/// bottom-right corner, spaced widely enough that no two share a thumb.
public func touchLayout(width: Double, height: Double) -> TouchLayout {
    typealias T = Config.Touch
    let radius = max(T.buttonMinRadius, min(T.buttonMaxRadius, min(width, height) * T.buttonScale))
    let arcRadius = radius * 3
    let pivotX = width - T.edgePadding - radius
    let pivotY = height - T.edgePadding - radius

    func place(_ degrees: Double) -> (x: Double, y: Double) {
        let radians = degrees * .pi / 180
        return (pivotX + cos(radians) * arcRadius, pivotY + sin(radians) * arcRadius)
    }

    // Jump takes the middle of the arc: it is the panic button. Same order
    // as `BUTTON_IDS`/`layout.buttons` in the JS, since that order is also
    // the hit-test order.
    let fight = place(180)
    let jump = place(225)
    let sing = place(270)

    return TouchLayout(
        radius: radius,
        arcRadius: arcRadius,
        stickMaxRadius: T.stickMaxRadius,
        stickZone: CGRect(x: 0, y: 0, width: width * T.stickZoneFraction, height: height),
        buttons: [
            TouchButton(id: .fight, label: "\u{2715}", x: fight.x, y: fight.y),
            TouchButton(id: .jump, label: "\u{2191}", x: jump.x, y: jump.y),
            TouchButton(id: .sing, label: "\u{266a}", x: sing.x, y: sing.y),
        ]
    )
}

/// The button (if any) a touch at `(x, y)` lands on. Ports `buttonAt()`: a
/// generous hit radius, since thumbs are imprecise and the stakes are a lost
/// life.
public func buttonAt(_ layout: TouchLayout, x: Double, y: Double) -> TouchButton? {
    let reach = layout.radius * 1.28
    for button in layout.buttons {
        let dx = button.x - x
        let dy = button.y - y
        if (dx * dx + dy * dy).squareRoot() <= reach { return button }
    }
    return nil
}
