import SwiftUI
import TouchInput

/// Ports `drawTouchControls`, `drawButton` and `drawStick` from
/// `src/render/touchcontrols.js`.
///
/// Drawn directly into the SCREEN-space context `Canvas` provides — the one
/// call in `GameView.draw(into:size:date:)` made *outside*
/// `letterboxed(into:viewport:)` — because the controls deliberately live in
/// the letterbox bars around the playfield, in the device's own points, not
/// world or view units. That is deliberate, same as the JS: the playfield is
/// letterboxed into a fixed window, and the controls live in the bars around
/// it so they never cover any of the meadow.
extension GraphicsContext {
    @MainActor
    func drawTouchControls(_ touch: TouchState, size: CGSize) {
        guard touch.isActive else { return }

        let layout = touch.currentLayout

        drawLayer { controls in
            controls.drawStick(touch, maxRadius: layout.stickMaxRadius)
            for button in layout.buttons {
                controls.drawButton(button, radius: layout.radius, held: touch.pressed.contains(button.id))
            }
        }
    }

    @MainActor
    private func drawStick(_ touch: TouchState, maxRadius: Double) {
        guard touch.stickActive else { return }

        let origin = touch.stickOrigin
        let track = circleRect(center: origin, radius: maxRadius)
        fill(Path(ellipseIn: track), with: .color(Palette.Touch.stickTrack))
        stroke(Path(ellipseIn: track), with: .color(Palette.Touch.stickTrackBorder), lineWidth: 2)

        let knob = circleRect(center: touch.stickPoint, radius: maxRadius * 0.42)
        fill(Path(ellipseIn: knob), with: .color(Palette.Touch.stickKnob))
    }

    private func drawButton(_ button: TouchButton, radius: Double, held: Bool) {
        let tint = tint(for: button.id)
        let rect = circleRect(center: CGPoint(x: button.x, y: button.y), radius: radius * (held ? 0.92 : 1))

        fill(Path(ellipseIn: rect), with: .color(held ? Palette.Touch.buttonFillHeld : Palette.Touch.buttonFillIdle))
        stroke(Path(ellipseIn: rect), with: .color(held ? tint : Palette.Touch.buttonBorderIdle), lineWidth: 2)

        let text = Text(button.label)
            .font(.system(size: CGFloat(radius * 0.92), weight: .bold))
            .foregroundColor(held ? Palette.Touch.buttonLabelHeld : tint)
        draw(text, at: CGPoint(x: button.x, y: button.y + 1), anchor: .center)
    }

    private func tint(for id: TouchButtonID) -> Color {
        switch id {
        case .sing: return Palette.Touch.singTint
        case .jump: return Palette.Touch.jumpTint
        case .fight: return Palette.Touch.fightTint
        }
    }
}

private func circleRect(center: CGPoint, radius: Double) -> CGRect {
    CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
}
