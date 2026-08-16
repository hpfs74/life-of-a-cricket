import CoreGraphics
import Combine
import CricketCore

/// Ports `createTouchControls()` from `src/touch.js`: on-screen controls for
/// phones, tracked by touch identity so a floating stick and a button press
/// can be driven by two different fingers at once — steering and pressing
/// act independently, the way they have to.
///
/// Deliberately a plain Swift type, ignorant of `UITouch`: it is driven by
/// an opaque, hashable identifier and a point, the same shape as the
/// browser's `Touch.identifier`/`clientX`/`clientY`. That keeps it testable
/// with synthetic identifiers, with no UIKit host required, and it is
/// `TouchInputView` (the UIKit layer, elsewhere) that adapts real `UITouch`
/// instances down to that shape.
@MainActor
public final class TouchState: ObservableObject {
    @Published public private(set) var intent: Intent = .idle

    /// The floating stick's origin (where the thumb first touched down) and
    /// current point, for the renderer to draw. Meaningless while
    /// `stickActive` is false.
    @Published public private(set) var stickActive = false
    @Published public private(set) var stickOrigin: CGPoint = .zero
    @Published public private(set) var stickPoint: CGPoint = .zero

    /// Which buttons currently have a touch on them, for the renderer to
    /// highlight.
    @Published public private(set) var pressed: Set<TouchButtonID> = []

    /// True once the player has touched the screen at all — mirrors
    /// `isActive()`, which gates whether the controls draw at all.
    public private(set) var isActive = false

    private var startRequested = false
    private var layout = touchLayout(width: 1, height: 1)

    private enum Assignment: Equatable {
        case stick
        case button(TouchButtonID)
    }
    private var assignments: [AnyHashable: Assignment] = [:]

    public init() {}

    /// Recomputes the button/stick-zone layout for a screen of this size.
    /// Call whenever the view's bounds change. `safeTrailingInset` is
    /// `UIView.safeAreaInsets.right` on the hosting view — how much of the
    /// trailing edge a hardware cutout (Dynamic Island, rotated into
    /// landscape) eats into; 0 where there is none.
    public func resize(width: Double, height: Double, safeTrailingInset: Double = 0) {
        layout = touchLayout(width: width, height: height, safeTrailingInset: safeTrailingInset)
    }

    public var currentLayout: TouchLayout { layout }

    /// True once, the first time after any touch begins, then resets.
    /// Mirrors `consumeStartRequest()`: any touch anywhere starts or
    /// restarts a run, exactly like the JS's `begin()` setting
    /// `startRequested = true` unconditionally before it even checks
    /// whether the touch landed on a button or the stick zone.
    public func consumeStartRequest() -> Bool {
        defer { startRequested = false }
        return startRequested
    }

    /// A touch identified by `id` began at `point`. Ports `begin()`.
    public func touchBegan(_ id: AnyHashable, at point: CGPoint) {
        isActive = true
        startRequested = true

        if let button = buttonAt(layout, x: Double(point.x), y: Double(point.y)) {
            assignments[id] = .button(button.id)
            pressed.insert(button.id)
            refresh()
            return
        }

        let zone = layout.stickZone
        let inStickZone = point.x >= zone.minX && point.x <= zone.maxX
        if inStickZone && !stickActive {
            assignments[id] = .stick
            stickActive = true
            stickOrigin = point
            stickPoint = point
        }
        refresh()
    }

    /// A touch identified by `id` moved to `point`. Ports `move()`: only the
    /// stick reacts to movement, clamped to its radius so it reads like a
    /// real stick.
    public func touchMoved(_ id: AnyHashable, to point: CGPoint) {
        guard assignments[id] == .stick else { return }

        let dx = point.x - stickOrigin.x
        let dy = point.y - stickOrigin.y
        let distance = (dx * dx + dy * dy).squareRoot()
        let limit = CGFloat(layout.stickMaxRadius)

        if distance > limit {
            stickPoint = CGPoint(x: stickOrigin.x + dx / distance * limit, y: stickOrigin.y + dy / distance * limit)
        } else {
            stickPoint = point
        }
        refresh()
    }

    /// A touch identified by `id` lifted off, or was cancelled. Ports
    /// `end()`. Lifting the stick's touch stops the cricket dead, rather
    /// than leaving it drifting toward wherever the thumb last was.
    public func touchEnded(_ id: AnyHashable) {
        guard let assignment = assignments.removeValue(forKey: id) else { return }
        switch assignment {
        case .button(let button): pressed.remove(button)
        case .stick: stickActive = false
        }
        refresh()
    }

    /// Mirrors the JS's `blur` handler: losing the window mid-touch (an
    /// interruption, an incoming call) should not leave a phantom press
    /// stuck on.
    public func releaseAll() {
        assignments.removeAll()
        pressed.removeAll()
        stickActive = false
        refresh()
    }

    /// Ports `refresh()`: recomputes `intent` from the current stick and
    /// button state. `dx`/`dy` are a unit vector once the thumb has moved
    /// past the dead zone; travel below it reads as standing still, which
    /// matters because singing requires standing still.
    private func refresh() {
        var next = Intent(
            sing: pressed.contains(.sing),
            jump: pressed.contains(.jump),
            strike: pressed.contains(.fight)
        )

        if stickActive {
            let dx = stickPoint.x - stickOrigin.x
            let dy = stickPoint.y - stickOrigin.y
            let distance = (dx * dx + dy * dy).squareRoot()
            if distance >= Config.Touch.stickDeadZone {
                next.dx = Double(dx / distance)
                next.dy = Double(dy / distance)
            }
        }

        intent = next
    }
}
