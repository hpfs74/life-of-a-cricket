import SwiftUI
import Foundation
import CricketCore

/// Ports `drawSky` from `src/render/background.js`: the day/night gradient,
/// the stars that fade in as it darkens, and the one body — sun by day, moon
/// by night — that crosses the sky each in-game day.
///
/// Drawn in VIEW space (see `GraphicsContext.letterboxed` in `GameView.swift`),
/// outside the world translate, so the sky holds still while the meadow
/// scrolls beneath it. Its gradient tracks `darknessAt(game.elapsed)`, the
/// same clock `Game` itself advances from, so the sky, the day counter and
/// which predator is hunting can never disagree.
extension GraphicsContext {
    func drawSky(game: Game, time: Double) {
        let horizon = CGFloat(game.world.top)
        let width = CGFloat(Config.View.width)
        let darkness = darknessAt(game.elapsed)

        let top = DimmableRGB.lerp(Palette.Background.skyTopDay, Palette.Background.skyTopNight, darkness)
        let bottom = DimmableRGB.lerp(Palette.Background.skyBottomDay, Palette.Background.skyBottomNight, darkness)

        fill(
            Path(CGRect(x: 0, y: 0, width: width, height: horizon)),
            with: .linearGradient(
                Gradient(colors: [top, bottom]),
                startPoint: CGPoint(x: 0, y: 0),
                endPoint: CGPoint(x: 0, y: horizon)
            )
        )

        drawStars(width: width, horizon: horizon, darkness: darkness, time: time)
        drawCelestialBody(width: width, horizon: horizon, phase: phaseOfDay(game.elapsed))
    }

    /// Positions are hashed off the star's index rather than stored, so the
    /// constellation is the same every night without keeping any state.
    private func drawStars(width: CGFloat, horizon: CGFloat, darkness: Double, time: Double) {
        let alpha = max(0, darkness * 1.5 - 0.35)
        guard alpha > 0 else { return }

        for i in 0..<70 {
            let hx = sin(Double(i) * 78.233) * 43758.5453
            let hy = sin(Double(i) * 12.9898) * 24634.6345
            let x = CGFloat(hx - hx.rounded(.down)) * width
            let y = CGFloat(hy - hy.rounded(.down)) * horizon * 0.92
            let twinkle = 0.6 + sin(time * 1.7 + Double(i)) * 0.4

            fill(
                Path(CGRect(x: x, y: y, width: 2, height: 2)),
                with: .color(Palette.Background.starBase.opacity(alpha * twinkle))
            )
        }
    }

    /// One body crosses the sky each day: the sun, then the moon opposite it.
    private func drawCelestialBody(width: CGFloat, horizon: CGFloat, phase: Double) {
        let x = width * CGFloat(0.12 + 0.76 * phase)
        let swing = cos(phase * .pi * 2) * Double(horizon) * 0.4
        let sunY = Double(horizon) * 0.62 - swing
        let moonY = Double(horizon) * 0.62 + swing

        if sunY < Double(horizon) {
            let center = CGPoint(x: x, y: CGFloat(sunY))
            let glow = Gradient(stops: [
                .init(color: Palette.Background.sunGlowInner, location: 0),
                .init(color: Palette.Background.sunGlowOuter, location: 1),
            ])
            fill(
                circlePath(center: center, radius: 68),
                with: .radialGradient(glow, center: center, startRadius: 4, endRadius: 68)
            )
            fill(circlePath(center: center, radius: 20), with: .color(Palette.Background.sunBody))
            return
        }

        guard moonY < Double(horizon) else { return }
        let center = CGPoint(x: x, y: CGFloat(moonY))
        fill(circlePath(center: center, radius: 17), with: .color(Palette.Background.moonBody))

        // A bite out of the disc makes a crescent without a second gradient.
        let bite = CGPoint(x: center.x + 8, y: center.y - 5)
        fill(circlePath(center: bite, radius: 15), with: .color(Palette.Background.moonCrescent))
    }
}

/// A circle path centred on `center`, matching `ctx.arc(x, y, r, 0, 2π)`.
func circlePath(center: CGPoint, radius: CGFloat) -> Path {
    Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
}
