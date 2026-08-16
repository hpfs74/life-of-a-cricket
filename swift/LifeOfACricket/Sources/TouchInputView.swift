import SwiftUI
import UIKit
import TouchInput

/// The one place this app uses UIKit, and for a specific reason.
///
/// SwiftUI's `DragGesture` does not expose independent concurrent touches
/// with stable identity — only a single combined gesture state shared
/// across however many fingers are down. `src/touch.js` tracks
/// `Touch.identifier` precisely so that steering (the floating stick) and
/// pressing a button act independently: you can run and swing at the same
/// time. That is a stated design property of the game, not an accident, and
/// gesture composition cannot reproduce it reliably.
///
/// So instead: a raw `UIView` with `isMultipleTouchEnabled = true`,
/// overriding `touchesBegan/Moved/Ended/Cancelled` and tracking each
/// `UITouch`'s object identity exactly as the browser tracks
/// `Touch.identifier` — the same model, expressed in UIKit. All of the
/// actual tracking logic lives in `TouchInput.TouchState`, a plain Swift
/// type that knows nothing about `UITouch`; this view's only job is
/// translating UIKit's touch events down to the (identifier, point) shape
/// that type expects.
struct TouchInputView: UIViewRepresentable {
    @ObservedObject var state: TouchState

    func makeUIView(context: Context) -> TouchCatchingView {
        let view = TouchCatchingView()
        view.state = state
        view.backgroundColor = .clear
        view.isMultipleTouchEnabled = true
        return view
    }

    func updateUIView(_ uiView: TouchCatchingView, context: Context) {
        uiView.state = state
    }
}

final class TouchCatchingView: UIView {
    weak var state: TouchState?

    override func layoutSubviews() {
        super.layoutSubviews()
        // `safeAreaInsets` is populated for any `UIView` from its window,
        // independent of the SwiftUI ancestor's `.ignoresSafeArea()` — that
        // modifier only permits this view's *frame* to extend under the
        // cutout, it does not stop UIKit reporting where the cutout is.
        // `.right` is genuinely screen-space right, not text-direction
        // `.trailing`, which is what the button column's raw x math wants.
        state?.resize(
            width: Double(bounds.width),
            height: Double(bounds.height),
            safeTrailingInset: Double(safeAreaInsets.right)
        )
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        // A rotation changes which physical edge the cutout sits on without
        // necessarily changing `bounds`, so this needs its own hook rather
        // than relying on `layoutSubviews` alone.
        state?.resize(
            width: Double(bounds.width),
            height: Double(bounds.height),
            safeTrailingInset: Double(safeAreaInsets.right)
        )
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            state?.touchBegan(identity(of: touch), at: touch.location(in: self))
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            state?.touchMoved(identity(of: touch), to: touch.location(in: self))
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            state?.touchEnded(identity(of: touch))
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            state?.touchEnded(identity(of: touch))
        }
    }

    /// `UITouch` has no public identifier like the browser's
    /// `Touch.identifier`, but the same `UITouch` object instance persists
    /// from its `began` through its `ended`/`cancelled` call, so its object
    /// identity serves exactly the same purpose.
    private func identity(of touch: UITouch) -> AnyHashable {
        AnyHashable(ObjectIdentifier(touch))
    }
}
