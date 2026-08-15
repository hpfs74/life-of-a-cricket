import SwiftUI
import CricketCore

/// Drives the frame clock and establishes the three coordinate spaces every
/// renderer draws into (Plan 2). Real rendering arrives in the tasks that
/// follow this one; for now the canvas only proves the spaces are correct.
struct GameView: View {
    @StateObject private var runner = GameRunner()

    var body: some View {
        TimelineView(.animation) { timeline in
            runner.advance(to: timeline.date, intent: .idle)

            return Canvas { context, size in
                draw(into: &context, size: size, date: timeline.date)
            }
            .ignoresSafeArea()
        }
    }

    /// Letterbox space, then world space nested inside it, then screen space
    /// outside both — matching the draw sandwich in `src/main.js`'s `frame()`.
    private func draw(into context: inout GraphicsContext, size: CGSize, date: Date) {
        // The page behind the letterbox bars.
        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Palette.page))

        let viewSize = CGSize(width: CGFloat(Config.View.width), height: CGFloat(Config.View.height))

        context.letterboxed(into: viewSize, viewport: size) { letterbox in
            // LETTERBOX-space proof: a border around the full 960x600 view.
            // If the clip below is missing, the world marks would bleed past it.
            letterbox.stroke(
                Path(CGRect(origin: .zero, size: viewSize)),
                with: .color(Palette.Hud.multiplierText),
                lineWidth: 6
            )

            // Stands in for the real camera until gameplay input drives it
            // (Task 7): a temporary step between the two ends of the world,
            // holding each for a few seconds, purely to prove the world
            // transform moves independently of the letterbox.
            let limit = cameraLimit(runner.game.world)
            let cameraX = demoCameraX(date.timeIntervalSinceReferenceDate, holdSeconds: 4, limit: limit)

            letterbox.worldSpace(cameraX: cameraX) { world in
                // WORLD-space proof: marks at the near and far ends of the
                // meadow. Only these move as the camera sweeps.
                let markSize: CGFloat = 60
                let markY = CGFloat(Config.View.height) / 2 - markSize / 2

                world.fill(
                    Path(ellipseIn: CGRect(x: -markSize / 2, y: markY, width: markSize, height: markSize)),
                    with: .color(Palette.Entities.foodBerry)
                )
                world.fill(
                    Path(ellipseIn: CGRect(x: CGFloat(Config.World.width) - markSize / 2, y: markY, width: markSize, height: markSize)),
                    with: .color(Palette.Entities.foodAphid)
                )
            }
        }

        // SCREEN-space proof: a mark in a corner, outside both layers above,
        // so it never scales or scrolls with the playfield.
        context.fill(
            Path(ellipseIn: CGRect(x: size.width - 26, y: 10, width: 16, height: 16)),
            with: .color(Palette.Hud.attentionMeter)
        )
    }

    /// Alternates between the two ends of the world, holding each for
    /// `holdSeconds` — long enough to screenshot comfortably.
    private func demoCameraX(_ t: Double, holdSeconds: Double, limit: Double) -> Double {
        let cycle = holdSeconds * 2
        let phase = (t.truncatingRemainder(dividingBy: cycle) + cycle).truncatingRemainder(dividingBy: cycle)
        return phase < holdSeconds ? 0 : limit
    }
}

extension GraphicsContext {
    /// Establishes the letterbox transform. The simulation always renders in
    /// `viewSize` (`Config.View`, 960x600); this letterboxes that fixed view
    /// into whatever `viewport` the device gives, centred, without stretching,
    /// and clips so nothing drawn inside can spill into the letterbox bars.
    ///
    /// Mirrors `resize()` and the `ctx.save()`/`translate`/`scale`/`clip()`
    /// sandwich in `src/main.js`'s `frame()`; `drawLayer` is the analogue of
    /// `ctx.save()`/`ctx.restore()`.
    func letterboxed(into viewSize: CGSize, viewport: CGSize, _ content: (inout GraphicsContext) -> Void) {
        let scale = min(viewport.width / viewSize.width, viewport.height / viewSize.height)
        let offsetX = (viewport.width - viewSize.width * scale) / 2
        let offsetY = (viewport.height - viewSize.height * scale) / 2

        drawLayer { letterbox in
            letterbox.translateBy(x: offsetX, y: offsetY)
            letterbox.scaleBy(x: scale, y: scale)
            letterbox.clip(to: Path(CGRect(origin: .zero, size: viewSize)))
            content(&letterbox)
        }
    }

    /// World space, nested inside `letterboxed`: ground and entities scroll
    /// beneath the camera. `cameraX` is rounded before use so a fractional
    /// pixel offset cannot make the scrolling meadow shimmer.
    func worldSpace(cameraX: Double, _ content: (inout GraphicsContext) -> Void) {
        drawLayer { world in
            world.translateBy(x: -CGFloat(cameraX.rounded()), y: 0)
            content(&world)
        }
    }
}
