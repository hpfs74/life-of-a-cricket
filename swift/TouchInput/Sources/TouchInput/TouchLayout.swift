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
/// Ports `touchLayout()` from `src/touch.js`. All positions are in the whole
/// screen's own coordinate space (CSS pixels there, points here) — not world
/// units — because the controls deliberately live in the letterbox bars
/// around the playfield, never over the meadow.
public struct TouchLayout: Equatable, Sendable {
    public var radius: Double
    public var buttonSpacing: Double
    public var stickMaxRadius: Double
    public var stickZone: CGRect
    public var buttons: [TouchButton]
}

/// Ports `touchLayout(width, height)`: button size scales with the screen's
/// short side, and the three buttons stack vertically inside the right-hand
/// letterbox bar, spaced widely enough that no two share a thumb.
///
/// A horizontal thumb-arc was tried first (matching an earlier version of
/// the JS), but on real phone aspect ratios its buttons reached past the
/// side bar and over the meadow, and no arc radius clears the meadow without
/// the buttons overlapping each other. A vertical stack fits the bar
/// instead, because the bar is narrow but tall.
///
/// `safeTrailingInset` is how much of the screen's trailing (right, in
/// screen-space x) edge a hardware cutout — the Dynamic Island, rotated into
/// landscape — eats into. It has no JS equivalent: a browser tab has no
/// notch to dodge. Pass `UIView.safeAreaInsets.right`; 0 (the default) is
/// correct for anything without one, including every existing caller.
public func touchLayout(width: Double, height: Double, safeTrailingInset: Double = 0) -> TouchLayout {
    typealias T = Config.Touch
    let radius = max(T.buttonMinRadius, min(T.buttonMaxRadius, min(width, height) * T.buttonScale))

    // Centre-to-centre gap between stacked buttons. At 2.4x the radius it is
    // comfortably wider than a button's own diameter (2x the radius), so no
    // two buttons can ever be pressed by one thumb at once.
    let buttonSpacing = radius * 2.4

    // Where the right letterbox bar actually sits: this mirrors the
    // scale/offset math in `GameView.letterboxed(into:viewport:)`, because
    // that is what determines where the playfield's right edge lands.
    let viewScale = min(width / Config.View.width, height / Config.View.height)
    let rightBarWidth = (width - Config.View.width * viewScale) / 2

    let pivotX: Double
    if rightBarWidth >= radius * 2 {
        // A real bar, wide enough to hold a button with room either side:
        // centre the stack inside it, the way it always has been...
        let barCenteredX = width - rightBarWidth / 2
        // ...then, if a cutout eats into the trailing edge, slide the whole
        // column left just far enough to clear it, but never past the point
        // where it would start covering the meadow — that guarantee comes
        // first, the cutout comes second.
        // `drawButton` (in the app's Render layer) strokes each button's
        // circle with a 2pt line, centred on the fill's edge — so the
        // button's actual visible boundary sits half that line width (1pt)
        // outside `radius`. Without this, a button parked exactly at
        // `radius` from the meadow edge would still let its stroke bleed
        // 1pt into the grass. `strokeAllowance` closes that.
        let strokeAllowance = 1.0
        let meadowLimit = (width - rightBarWidth) + radius + strokeAllowance
        let safeLimit = width - safeTrailingInset - radius
        // On a device where the corridor between the meadow's edge and the
        // cutout is narrower than one button's diameter, `safeLimit` can
        // fall below `meadowLimit`: no position clears both. `max` then
        // wins with `meadowLimit`, which is the one property that must
        // never give — a few points of the button are left under the
        // cutout rather than a few points over the grass. That is a real,
        // reported tradeoff on some hardware, not a silent one.
        pivotX = max(meadowLimit, min(barCenteredX, safeLimit))
    } else {
        // No usable right bar. This happens on a device shaped like an iPad,
        // where the 3:2 view is narrower than the screen and the letterbox
        // bars land above and below the playfield instead of beside it —
        // there is no bar for the stack to sit in. There is no honest fix
        // for that case: hug the screen's right edge (adjusted for whichever
        // of the standard padding or a safe-area cutout demands more room)
        // as the least-bad fallback, and accept that the buttons will sit
        // over the meadow there.
        pivotX = width - max(T.edgePadding, safeTrailingInset) - radius
    }

    // Lower-middle of the screen rather than dead centre: that is where a
    // thumb rests holding the phone in landscape.
    let pivotY = height * 0.6

    func place(_ row: Double) -> (x: Double, y: Double) {
        (pivotX, pivotY + row * buttonSpacing)
    }

    // Same order as `BUTTON_IDS`/`layout.buttons` in the JS, since that
    // order is also the hit-test order.
    let sing = place(-1)
    // Leap takes the middle of the stack: it is the panic button.
    let jump = place(0)
    let fight = place(1)

    return TouchLayout(
        radius: radius,
        buttonSpacing: buttonSpacing,
        stickMaxRadius: T.stickMaxRadius,
        stickZone: CGRect(x: 0, y: 0, width: width * T.stickZoneFraction, height: height),
        buttons: [
            TouchButton(id: .sing, label: "\u{266a}", x: sing.x, y: sing.y),
            TouchButton(id: .jump, label: "\u{2191}", x: jump.x, y: jump.y),
            TouchButton(id: .fight, label: "\u{2715}", x: fight.x, y: fight.y),
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
