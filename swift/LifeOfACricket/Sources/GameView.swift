import SwiftUI
import CricketCore
import TouchInput

/// Drives the frame clock and establishes the three coordinate spaces every
/// renderer draws into (Plan 2), and hosts the real touch input layer
/// (Task 7): a `TouchInputView` overlay feeding a `TouchState`, whose
/// `intent` drives the simulation and whose stick/buttons are drawn by
/// `drawTouchControls` in screen space, in the same `Canvas` draw pass.
struct GameView: View {
    @StateObject private var runner = GameRunner()
    @StateObject private var touch = TouchState()

    var body: some View {
        TimelineView(.animation) { timeline in
            // Any touch anywhere starts or restarts a run, matching the JS
            // where touching the screen at all begins play.
            if touch.consumeStartRequest() { runner.requestStart() }

            // Touch is the only input source on a phone — no keyboard, no
            // face input — so its intent is what drives the simulation
            // outright. Elsewhere this would be OR'd together with other
            // sources; here there is only the one.
            runner.advance(to: timeline.date, intent: touch.intent)

            return ZStack {
                Canvas { context, size in
                    draw(into: &context, size: size, date: timeline.date)
                }
                // Sits on top so it receives every touch across the whole
                // screen, letterbox bars included — the controls live there.
                // A plain `UIView` reports no intrinsic size, so without an
                // explicit frame the `ZStack` could collapse it to zero and
                // it would never receive a touch.
                TouchInputView(state: touch)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        let time = date.timeIntervalSinceReferenceDate

        context.letterboxed(into: viewSize, viewport: size) { letterbox in
            // The sky is VIEW space: it holds still while the meadow scrolls
            // beneath it. The house's backdrop is the same idea indoors.
            switch runner.game.stage {
            case .meadow: letterbox.drawSky(game: runner.game, time: time)
            case .house: letterbox.drawHouseBackdrop(game: runner.game)
            }

            // The real camera, driven by `GameRunner` from the cricket's
            // position each frame — the touch stick moves the cricket, and
            // the camera follows.
            let cameraX = runner.camera.x

            letterbox.worldSpace(cameraX: cameraX) { world in
                switch runner.game.stage {
                case .meadow: world.drawGround(game: runner.game, time: time, cameraX: cameraX)
                case .house: world.drawHouseInterior(game: runner.game, time: time, cameraX: cameraX)
                }
                // Entities are stage-agnostic, same as `drawEntities` in the JS:
                // the house reuses the same cricket/rivals/spiders/food types.
                if runner.game.phase != .menu {
                    world.drawEntities(game: runner.game, time: time)
                    // The house's own cast: a no-op outside the house, since
                    // `game.cat`/`game.humans` are `nil` there.
                    world.drawHouseCast(game: runner.game, time: time)
                }
            }

            // The HUD and the menu/game-over overlays: still VIEW space, but
            // outside the world translate, matching the order in `frame()`.
            if runner.game.phase != .menu {
                letterbox.drawHud(game: runner.game)
            }
            letterbox.drawOverlay(game: runner.game, time: time)
        }

        // SCREEN space, outside the letterbox transform: the stick and
        // buttons live in the bars around the playfield, never over the
        // meadow, matching `drawTouchControls` in the JS.
        context.drawTouchControls(touch, size: size)
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
