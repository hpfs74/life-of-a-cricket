import SwiftUI
import Foundation
import CricketCore
// `CricketCore` (the module) also ships a type of the same name (its
// namespace enum), and `Circle` collides with `SwiftUI.Circle`; a scoped
// import is the one unambiguous way to name the water-circle type here.
import struct CricketCore.Circle

/// Ports `drawGround` from `src/render/background.js`: the ground fill, the
/// grass fringe along the horizon, water, the doorway to the house, and
/// cover. Drawn in WORLD space, inside the camera translate (see
/// `GraphicsContext.worldSpace` in `GameView.swift`), so it scrolls with the
/// meadow. Only the camera's visible slice — plus a 40pt margin either side —
/// is drawn; the meadow is several screens wide, so stroking every blade of
/// grass across all of it would be wasted work.
///
/// All simulation quantities from `CricketCore` (`Cover.x`, `Circle.radius`,
/// `Door.width`, ...) are `Double`; `CGPoint`/`CGRect` need `CGFloat`, and
/// Swift does not convert between them implicitly. `cgPoint`/`cgRect` below
/// do that conversion in one place instead of scattering `CGFloat(...)`
/// through every path build.
extension GraphicsContext {
    func drawGround(game: Game, time: Double, cameraX: Double) {
        let world = game.world
        let width = world.width
        let height = world.height
        let horizon = world.top
        let darkness = darknessAt(game.elapsed)
        let visibleFrom = cameraX - 40
        let visibleTo = cameraX + Config.View.width + 40

        // The ground dims with the sky, but never to pure black: the player
        // still has to read cover and food at midnight.
        let groundDim = 1 - darkness * 0.62
        fill(
            Path(cgRect(x: 0, y: horizon, width: width, height: height - horizon)),
            with: .linearGradient(
                Gradient(colors: [
                    Palette.Background.groundTopBase.color(dim: groundDim),
                    Palette.Background.groundBottomBase.color(dim: groundDim),
                ]),
                startPoint: cgPoint(0, horizon),
                endPoint: cgPoint(0, height)
            )
        )

        drawGrassFringe(horizon: horizon, time: time, visibleFrom: visibleFrom, visibleTo: visibleTo)
        drawWater(world.water, time: time, darkness: darkness, visibleFrom: visibleFrom, visibleTo: visibleTo)
        drawDoorway(game: game, darkness: darkness, visibleTo: visibleTo)

        for item in world.cover {
            guard item.x + item.radius >= visibleFrom && item.x - item.radius <= visibleTo else { continue }
            drawCover(item, time: time)
        }
    }

    /// Two pale layers of grass along the horizon read as depth. Blade height
    /// and lean are hashed off x so the fringe looks grown rather than combed.
    private func drawGrassFringe(horizon: Double, time: Double, visibleFrom: Double, visibleTo: Double) {
        struct Layer { let color: Color; let step: Double; let lineWidth: Double; let scale: Double; let lift: Double }
        let layers = [
            Layer(color: Palette.Background.grassFringeNear, step: 7, lineWidth: 3, scale: 0.7, lift: 4),
            Layer(color: Palette.Background.grassFringeFar, step: 9, lineWidth: 4, scale: 1, lift: 12),
        ]

        for layer in layers {
            var x = (visibleFrom / layer.step).rounded(.down) * layer.step
            while x < visibleTo {
                let hash = sin(x * 12.9898) * 43758.5453
                let jitter = hash - hash.rounded(.down)
                let bladeHeight = (14 + jitter * 26) * layer.scale
                let lean = (jitter - 0.5) * 14 + sin(time * 1.1 + x * 0.05) * 4

                var blade = Path()
                blade.move(to: cgPoint(x, horizon + layer.lift))
                blade.addQuadCurve(
                    to: cgPoint(x + lean, horizon - bladeHeight),
                    control: cgPoint(x + lean * 0.4, horizon - bladeHeight * 0.5)
                )
                stroke(blade, with: .color(layer.color), style: StrokeStyle(lineWidth: CGFloat(layer.lineWidth), lineCap: .round))

                x += layer.step
            }
        }
    }

    /// Water, drawn as one merged shape rather than a string of visible discs:
    /// every circle's ellipse goes onto the same path so their overlaps
    /// disappear into a single fill.
    private func drawWater(_ circles: [Circle], time: Double, darkness: Double, visibleFrom: Double, visibleTo: Double) {
        let inView = circles.filter { $0.x + $0.radius >= visibleFrom && $0.x - $0.radius <= visibleTo }
        guard !inView.isEmpty else { return }

        let dim = 1 - darkness * 0.55

        // A damp margin where the ground meets the water.
        fill(waterPath(inView, grow: 6), with: .color(Palette.Background.waterDampMarginBase.color(dim: dim)))
        fill(waterPath(inView, grow: 0), with: .color(Palette.Background.waterBodyBase.color(dim: dim)))

        // Shimmer: short highlights that drift along the surface, clipped to
        // the water's own shape so none of it spills onto dry ground.
        drawLayer { layer in
            layer.clip(to: waterPath(inView, grow: -4))
            let shimmerAlpha = 0.14 + (1 - darkness) * 0.16
            let shimmer = GraphicsContext.Shading.color(Palette.Background.waterShimmerBase.opacity(shimmerAlpha))

            for c in inView {
                for i in 0..<2 {
                    let drift = sin(time * 0.9 + c.x * 0.03 + Double(i) * 2.1) * c.radius * 0.4
                    let y = c.y + (Double(i) - 0.5) * c.radius * 0.5

                    var line = Path()
                    line.move(to: cgPoint(c.x - c.radius * 0.45 + drift, y))
                    line.addLine(to: cgPoint(c.x + c.radius * 0.3 + drift, y))
                    layer.stroke(line, with: shimmer, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                }
            }
        }
    }

    /// One path holding every visible circle as an ellipse (`radius * 0.72`
    /// tall), all wound the same direction so a single fill covers their
    /// union rather than leaving seams at the overlaps. `grow` insets or
    /// expands every circle by the same amount, for the damp margin and the
    /// shimmer's inner clip.
    private func waterPath(_ circles: [Circle], grow: Double) -> Path {
        var path = Path()
        for c in circles {
            let rx = c.radius + grow
            let ry = rx * 0.72
            path.addEllipse(in: cgRect(x: c.x - rx, y: c.y - ry, width: rx * 2, height: ry * 2))
        }
        return path
    }

    /// The house at the east end of the meadow: a wall, and a lit doorway.
    private func drawDoorway(game: Game, darkness: Double, visibleTo: Double) {
        let world = game.world
        let door = world.door
        guard door.x - door.width * 3 <= visibleTo else { return }

        let wallLeft = door.x - door.width / 2

        // The house wall closing off the east end. It runs past the world
        // edge so no gap shows when the camera is hard against the right stop.
        let wallK = 1 - darkness * 0.5
        fill(
            Path(cgRect(
                x: wallLeft, y: world.top - 40,
                width: world.width - wallLeft + 200, height: world.height - world.top + 40
            )),
            with: .color(Palette.Background.houseWallExteriorBase.color(dim: wallK))
        )

        // The doorway itself, warmly lit from inside. Rounded only on its
        // outer (west) edge, so it reads as a hole cut into the wall.
        let doorTop = door.y - door.height / 2
        let doorRadius = door.width * 0.4
        fill(
            roundedRectPath(
                cgRect(x: wallLeft, y: doorTop, width: door.width * 1.6, height: door.height),
                topLeft: CGFloat(doorRadius), topRight: 0, bottomRight: 0, bottomLeft: CGFloat(doorRadius)
            ),
            with: .color(Palette.Background.doorwayDark)
        )

        let glowAlpha = 0.5 + darkness * 0.35
        let glowRadius = door.width * 0.35
        fill(
            roundedRectPath(
                cgRect(x: wallLeft, y: doorTop + 6, width: door.width * 1.5, height: door.height - 12),
                topLeft: CGFloat(glowRadius), topRight: 0, bottomRight: 0, bottomLeft: CGFloat(glowRadius)
            ),
            with: .linearGradient(
                Gradient(colors: [
                    Palette.Background.doorwayGlowInner.opacity(glowAlpha),
                    Palette.Background.doorwayGlowOuter,
                ]),
                startPoint: cgPoint(wallLeft, 0),
                endPoint: cgPoint(wallLeft + door.width * 1.4, 0)
            )
        )
    }

    /// Three cover types, each with a genuinely different silhouette: `rock`
    /// (a squat filled ellipse with a highlight), `leaf` (an elongated
    /// ellipse with a vein, swaying as one piece), and everything else —
    /// `grass`, matching the JS's fall-through default — a fan of blades
    /// swaying as one clump, drawn upward from the anchor point (world
    /// generation gives grass tufts extra sky clearance above their anchor
    /// for exactly this reason).
    private func drawCover(_ item: Cover, time: Double) {
        let sway = sin(time * 1.4 + item.x * 0.02) * 3

        switch item.type {
        case .rock:
            let rx = item.radius, ry = rx * 0.72
            fill(
                Path(ellipseIn: cgRect(x: item.x - rx, y: item.y - ry, width: rx * 2, height: ry * 2)),
                with: .color(Palette.Background.rockBody)
            )
            fill(
                rotatedEllipsePath(
                    center: cgPoint(item.x - item.radius * 0.25, item.y - item.radius * 0.22),
                    rx: CGFloat(item.radius * 0.45), ry: CGFloat(item.radius * 0.28), rotation: -0.4
                ),
                with: .color(Palette.Background.rockHighlight)
            )

        case .leaf:
            let center = cgPoint(item.x, item.y)
            let swayAngle = CGFloat(sin(time * 0.8 + item.y * 0.01) * 0.12)
            let group = CGAffineTransform(rotationAngle: swayAngle)
                .concatenating(CGAffineTransform(translationX: center.x, y: center.y))

            let r = CGFloat(item.radius)
            let body = rotatedEllipsePath(center: .zero, rx: r, ry: r * 0.55, rotation: 0.6).applying(group)
            fill(body, with: .color(Palette.Background.leafBody))

            var vein = Path()
            vein.move(to: CGPoint(x: -r * 0.8, y: -r * 0.3))
            vein.addLine(to: CGPoint(x: r * 0.8, y: r * 0.3))
            stroke(vein.applying(group), with: .color(Palette.Background.leafVein), style: StrokeStyle(lineWidth: 2, lineCap: .round))

        default:
            // Grass tuft: a fan of blades that sways as one clump.
            for i in 0..<11 {
                let spread = (Double(i) / 10 - 0.5) * item.radius * 1.9
                let bladeHeight = item.radius * (0.9 + sin(Double(i) * 2.3) * 0.28)

                var blade = Path()
                blade.move(to: cgPoint(item.x + spread * 0.5, item.y + item.radius * 0.4))
                blade.addQuadCurve(
                    to: cgPoint(item.x + spread + sway * 1.6, item.y - bladeHeight),
                    control: cgPoint(item.x + spread * 0.8 + sway, item.y - bladeHeight * 0.4)
                )
                stroke(blade, with: .color(Palette.Background.grassTuft), style: StrokeStyle(lineWidth: 4, lineCap: .round))
            }
        }
    }
}

/// `CGPoint`/`CGRect` from `Double`, converting once at the point of use
/// rather than scattering `CGFloat(...)` through every path build above.
private func cgPoint(_ x: Double, _ y: Double) -> CGPoint {
    CGPoint(x: CGFloat(x), y: CGFloat(y))
}

private func cgRect(x: Double, y: Double, width: Double, height: Double) -> CGRect {
    CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(width), height: CGFloat(height))
}

/// An ellipse of radii `rx`/`ry` centred on `center`, rotated about that
/// centre by `rotation` radians — matches the canvas `ellipse(x, y, rx, ry,
/// rotation, 0, 2π)` call the JS uses for the rock's highlight and the leaf's
/// body, which SwiftUI's `Path(ellipseIn:)` has no direct equivalent for.
private func rotatedEllipsePath(center: CGPoint, rx: CGFloat, ry: CGFloat, rotation: CGFloat) -> Path {
    let local = Path(ellipseIn: CGRect(x: -rx, y: -ry, width: rx * 2, height: ry * 2))
    let transform = CGAffineTransform(rotationAngle: rotation)
        .concatenating(CGAffineTransform(translationX: center.x, y: center.y))
    return local.applying(transform)
}

/// A rectangle with up to four independently-sized corner radii, matching
/// canvas `roundRect(x, y, w, h, [tl, tr, br, bl])`. SwiftUI's built-in
/// rounded-rect path only takes one radius for all four corners, which can't
/// express the doorway's "rounded on the outer edge, square where it meets
/// the wall" shape.
private func roundedRectPath(_ rect: CGRect, topLeft: CGFloat, topRight: CGFloat, bottomRight: CGFloat, bottomLeft: CGFloat) -> Path {
    let x = rect.minX, y = rect.minY, w = rect.width, h = rect.height
    var path = Path()

    path.move(to: CGPoint(x: x + topLeft, y: y))
    path.addLine(to: CGPoint(x: x + w - topRight, y: y))
    path.addArc(center: CGPoint(x: x + w - topRight, y: y + topRight), radius: topRight, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
    path.addLine(to: CGPoint(x: x + w, y: y + h - bottomRight))
    path.addArc(center: CGPoint(x: x + w - bottomRight, y: y + h - bottomRight), radius: bottomRight, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
    path.addLine(to: CGPoint(x: x + bottomLeft, y: y + h))
    path.addArc(center: CGPoint(x: x + bottomLeft, y: y + h - bottomLeft), radius: bottomLeft, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
    path.addLine(to: CGPoint(x: x, y: y + topLeft))
    path.addArc(center: CGPoint(x: x + topLeft, y: y + topLeft), radius: topLeft, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
    path.closeSubpath()

    return path
}
