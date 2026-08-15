import SwiftUI
import Foundation
import CricketCore
// `CricketCore` (the module) also ships a type of the same name (its
// namespace enum), and `Circle` collides with `SwiftUI.Circle`; a scoped
// import is the one unambiguous way to name the water-circle type here.
import struct CricketCore.Circle

/// Ports `src/render/house.js` and the cat/human halves of
/// `src/render/entities.js`: the house drawn like a dollhouse, in cross-
/// section, with both floors visible at once, and its cast — the cat that
/// hunts and the human that doesn't.
///
/// `drawHouseBackdrop` is VIEW space (see `GraphicsContext.letterboxed` in
/// `GameView.swift`), so the wall behind the house holds still while the
/// house scrolls beneath it, the same way the meadow's sky does. Everything
/// else here — floors, stairwell, furniture, the cat, the human — is WORLD
/// space, drawn inside `GraphicsContext.worldSpace`, and only the camera's
/// visible slice (plus a margin) is built, since the house is several
/// screens wide.
extension GraphicsContext {
    /// A backdrop behind the house: fixed in view space so it never scrolls.
    func drawHouseBackdrop(game: Game) {
        let width = CGFloat(Config.View.width)
        let height = CGFloat(Config.View.height)
        let darkness = darknessAt(game.elapsed)
        // The backdrop dims by its own factor, distinct from the interior's.
        let backdropDim = 1 - darkness * 0.4

        fill(
            Path(CGRect(x: 0, y: 0, width: width, height: height)),
            with: .linearGradient(
                Gradient(colors: [
                    Palette.House.wallGradientTop.color(dim: backdropDim),
                    Palette.House.wallGradientBottom.color(dim: backdropDim),
                ]),
                startPoint: CGPoint(x: 0, y: 0),
                endPoint: CGPoint(x: 0, y: height)
            )
        )
    }

    func drawHouseInterior(game: Game, time: Double, cameraX: Double) {
        let world = game.world
        let darkness = darknessAt(game.elapsed)
        // Interior light: warm by day, lamplit and dim at night, never pitch black.
        let dim = 1 - darkness * 0.5
        let visibleFrom = cameraX - 40
        let visibleTo = cameraX + Config.View.width + 40
        let spanX = max(0, visibleFrom)
        let spanW = visibleTo - spanX

        for band in world.bands {
            // Wallpaper.
            fill(
                Path(cgRect(x: spanX, y: band.top, width: spanW, height: band.bottom - band.top)),
                with: .linearGradient(
                    Gradient(colors: [
                        Palette.House.wallpaperTop.color(dim: dim),
                        Palette.House.wallpaperBottom.color(dim: dim),
                    ]),
                    startPoint: cgPoint(0, band.top),
                    endPoint: cgPoint(0, band.bottom)
                )
            )

            // A faint vertical stripe pattern.
            let stripeColor = Palette.House.wallpaperStripeBase.opacity(0.05 * dim)
            var x = (visibleFrom / 48).rounded(.down) * 48
            while x < visibleTo {
                var stripe = Path()
                stripe.move(to: cgPoint(x, band.top))
                stripe.addLine(to: cgPoint(x, band.bottom - 18))
                stroke(stripe, with: .color(stripeColor), lineWidth: 6)
                x += 48
            }

            drawHouseFloor(band: band, dim: dim, visibleFrom: visibleFrom, visibleTo: visibleTo)
        }

        // The ceiling slab between the floors.
        for i in 0..<max(0, world.bands.count - 1) {
            let gapTop = world.bands[i].bottom
            let gapBottom = world.bands[i + 1].top
            fill(
                Path(cgRect(x: spanX, y: gapTop, width: spanW, height: gapBottom - gapTop)),
                with: .color(Palette.House.ceilingSlab.color(dim: dim))
            )
        }

        // The stairwell: a lit shaft with steps, cut through the ceiling. This
        // is the whole reason both floors are on screen at once — the player
        // must be able to watch the cat coming before it arrives.
        for stair in world.stairs {
            guard stair.x + stair.width >= visibleFrom && stair.x <= visibleTo else { continue }
            guard let firstBand = world.bands.first, let lastBand = world.bands.last else { continue }

            let top = firstBand.top
            let bottom = lastBand.bottom

            fill(
                Path(cgRect(x: stair.x, y: top, width: stair.width, height: bottom - top)),
                with: .color(Palette.House.stairwellShaft.color(dim: dim))
            )

            let steps = 9
            for i in 0..<steps {
                let y = firstBand.bottom + ((bottom - firstBand.bottom) / Double(steps)) * Double(i)
                let inset = (stair.width / Double(steps)) * Double(i) * 0.35
                fill(
                    Path(cgRect(x: stair.x + inset, y: y, width: stair.width - inset, height: 7)),
                    with: .color(Palette.House.stairwellSteps.color(dim: dim))
                )
            }
        }

        // The front door, on the ground floor.
        let door = world.door
        if door.x - door.width < visibleTo, let band = world.bands.last {
            let doorHeight = min(Config.Doorway.height * 1.3, band.bottom - band.top - 20)
            let doorTop = band.bottom - 16 - doorHeight

            fill(
                Path(cgRect(x: 0, y: doorTop, width: door.x + door.width / 2, height: doorHeight)),
                with: .color(Palette.House.doorDark.color(dim: dim))
            )

            fill(
                Path(cgRect(x: 0, y: doorTop + 8, width: door.x + door.width / 2 - 8, height: doorHeight - 16)),
                with: .color(Palette.House.doorLightBase.opacity(0.28 * (1 - darkness)))
            )
        }

        drawWater(world.water, time: time, darkness: darkness, visibleFrom: visibleFrom, visibleTo: visibleTo)

        for item in world.cover {
            guard item.x + item.radius >= visibleFrom && item.x - item.radius <= visibleTo else { continue }
            drawFurniture(item, dim: dim, time: time)
        }
    }

    /// The house's cast: the cat that hunts, and the human that doesn't.
    /// Called every frame alongside `drawEntities`, matching `drawEntities` in
    /// the JS — both are `nil` outside the house, so nothing draws elsewhere.
    func drawHouseCast(game: Game, time: Double) {
        if let cat = game.cat { drawCat(cat, time: time) }
        drawHuman(game.humans, time: time)
    }

    // MARK: - Floor

    /// Floorboards, so the floors read as floors and give the eye some scale.
    private func drawHouseFloor(band: Band, dim: Double, visibleFrom: Double, visibleTo: Double) {
        let boardTop = band.bottom - 16
        let spanX = max(0, visibleFrom)
        let spanW = visibleTo - spanX

        fill(
            Path(cgRect(x: spanX, y: boardTop, width: spanW, height: 16)),
            with: .color(Palette.House.floorboard.color(dim: dim))
        )

        var x = (visibleFrom / 64).rounded(.down) * 64
        while x < visibleTo {
            var plank = Path()
            plank.move(to: cgPoint(x, boardTop))
            plank.addLine(to: cgPoint(x, band.bottom))
            stroke(plank, with: .color(Palette.House.floorboardLine.color(dim: dim)), lineWidth: 1)
            x += 64
        }

        // Skirting where the wall meets the floor.
        fill(
            Path(cgRect(x: spanX, y: boardTop - 5, width: spanW, height: 5)),
            with: .color(Palette.House.skirting.color(dim: dim))
        )
    }

    // MARK: - Furniture

    private func furniturePalette(_ type: CoverType) -> (body: DimmableRGB, trim: DimmableRGB) {
        switch type {
        case .sofa: return (Palette.House.furnitureSofaBody, Palette.House.furnitureSofaTrim)
        case .chair: return (Palette.House.furnitureChairBody, Palette.House.furnitureChairTrim)
        case .table: return (Palette.House.furnitureTableBody, Palette.House.furnitureTableTrim)
        case .plant: return (Palette.House.furniturePlantBody, Palette.House.furniturePlantTrim)
        case .bed: return (Palette.House.furnitureBedBody, Palette.House.furnitureBedTrim)
        default: return (Palette.House.furnitureBoxBody, Palette.House.furnitureBoxTrim)
        }
    }

    private func drawFurniture(_ item: Cover, dim: Double, time: Double) {
        let (bodyColor, trimColor) = furniturePalette(item.type)
        let r = item.radius

        fill(
            ellipsePath(cx: item.x, cy: item.y + r * 0.82, rx: r * 1.05, ry: r * 0.24),
            with: .color(Palette.House.furnitureShadow)
        )

        if item.type == .plant {
            var pot = Path()
            pot.move(to: cgPoint(item.x - r * 0.4, item.y + r * 0.8))
            pot.addLine(to: cgPoint(item.x + r * 0.4, item.y + r * 0.8))
            pot.addLine(to: cgPoint(item.x + r * 0.28, item.y + r * 0.15))
            pot.addLine(to: cgPoint(item.x - r * 0.28, item.y + r * 0.15))
            pot.closeSubpath()
            fill(pot, with: .color(Palette.House.plantPot.color(dim: dim)))

            let leafColor = bodyColor.color(dim: dim)
            for i in 0..<6 {
                let angle = (Double(i) / 6) * Double.pi * 2 + sin(time * 0.7 + item.x * 0.01) * 0.08
                fill(
                    rotatedEllipsePath(
                        cx: item.x + cos(angle) * r * 0.45, cy: item.y - r * 0.25 + sin(angle) * r * 0.3,
                        rx: r * 0.42, ry: r * 0.2, rotation: angle
                    ),
                    with: .color(leafColor)
                )
            }
            return
        }

        if item.type == .table {
            fill(Path(cgRect(x: item.x - r, y: item.y - r * 0.5, width: r * 2, height: r * 0.34)), with: .color(bodyColor.color(dim: dim)))
            fill(Path(cgRect(x: item.x - r * 0.82, y: item.y - r * 0.16, width: r * 0.2, height: r * 0.95)), with: .color(trimColor.color(dim: dim)))
            fill(Path(cgRect(x: item.x + r * 0.62, y: item.y - r * 0.16, width: r * 0.2, height: r * 0.95)), with: .color(trimColor.color(dim: dim)))
            return
        }

        // Sofas, chairs, beds and boxes: a padded block with a back.
        fill(
            Path(roundedRect: cgRect(x: item.x - r, y: item.y - r * 0.55, width: r * 2, height: r * 1.35), cornerRadius: r * 0.22),
            with: .color(bodyColor.color(dim: dim))
        )
        fill(
            Path(roundedRect: cgRect(x: item.x - r * 0.95, y: item.y - r * 0.9, width: r * 1.9, height: r * 0.55), cornerRadius: r * 0.2),
            with: .color(trimColor.color(dim: dim))
        )
    }

    // MARK: - The cat

    /// The cat: a long low silhouette, tensing before it commits. `state`
    /// drives every visible cue: it flattens as it stalks, stretches out
    /// mid-pounce, and its eyes brighten with `interest` as it closes in — the
    /// same tell language the meadow's spiders use.
    private func drawCat(_ cat: Cat, time: Double) {
        let pouncing = cat.state == .pounce
        let stalking = cat.state == .stalk
        let facing: Double = cat.dirX >= 0 ? 1 : -1

        let crouch = stalking ? 0.82 : 1.0
        let stretch = pouncing ? 1.25 : 1.0
        let length = 34 * stretch
        let height = 17 * crouch
        let bob = pouncing ? 0 : sin(time * 4 + cat.x * 0.02) * 1.5

        drawLayer { layer in
            layer.translateBy(x: CGFloat(cat.x), y: CGFloat(cat.y + bob))
            layer.scaleBy(x: CGFloat(facing), y: 1)

            layer.fill(
                ellipsePath(cx: 0, cy: height * 0.95, rx: length * 0.8, ry: height * 0.3),
                with: .color(Palette.Entities.catShadow)
            )

            let coat = (stalking || pouncing) ? Palette.Entities.catCoatAlert : Palette.Entities.catCoatIdle

            // Legs.
            for at in [-length * 0.5, -length * 0.15, length * 0.3, length * 0.55] {
                let swing = pouncing ? 6 : sin(time * 7 + at) * 3
                var leg = Path()
                leg.move(to: cgPoint(at, height * 0.1))
                leg.addLine(to: cgPoint(at + swing, height * 0.95))
                layer.stroke(leg, with: .color(coat), style: StrokeStyle(lineWidth: 4, lineCap: .round))
            }

            // Tail, whipping when it is interested.
            let whip = sin(time * (stalking ? 9.0 : 3.0)) * (stalking ? 12.0 : 6.0)
            var tail = Path()
            tail.move(to: cgPoint(-length * 0.75, -height * 0.15))
            tail.addQuadCurve(
                to: cgPoint(-length * 1.35, -height * 1.1 + whip),
                control: cgPoint(-length * 1.15, -height * 0.7 + whip)
            )
            layer.stroke(tail, with: .color(coat), lineWidth: 3.4)

            layer.fill(ellipsePath(cx: 0, cy: 0, rx: length * 0.72, ry: height), with: .color(coat))

            // Head and ears.
            layer.fill(circleAt(length * 0.72, -height * 0.25, height * 0.62), with: .color(coat))

            var ears = Path()
            ears.move(to: cgPoint(length * 0.5, -height * 0.7))
            ears.addLine(to: cgPoint(length * 0.6, -height * 1.5))
            ears.addLine(to: cgPoint(length * 0.78, -height * 0.78))
            ears.closeSubpath()
            ears.move(to: cgPoint(length * 0.82, -height * 0.8))
            ears.addLine(to: cgPoint(length * 0.98, -height * 1.45))
            ears.addLine(to: cgPoint(length * 1.02, -height * 0.6))
            ears.closeSubpath()
            layer.fill(ears, with: .color(coat))

            // Eyes: bright when it has seen you.
            layer.fill(
                circleAt(length * 0.92, -height * 0.35, 2.4),
                with: .color(Palette.Entities.catEyesBase.opacity(0.5 + cat.interest * 0.5))
            )
        }
    }

    // MARK: - The human

    /// The human, seen only as a shadow and a pair of enormous feet. Showing
    /// no more than that keeps the scale right: from down here you would
    /// never see a face. A shadow sweeps in and darkens for `warnFor` seconds
    /// before any foot lands — the entire warning the mechanic depends on,
    /// since the human never hunts and never notices the cricket.
    private func drawHuman(_ schedule: HumanSchedule?, time: Double) {
        guard let walker = schedule?.walker else { return }
        let band = walker.band

        if walker.warnFor > 0 {
            // The shadow sweeps in before anything lands.
            let strength = 1 - walker.warnFor / Config.Human.warningSeconds
            let x0 = walker.x - walker.dir * 300
            let x1 = walker.x + walker.dir * 200
            let rectX = min(x0, x1)
            let rectW = abs(x1 - x0)

            fill(
                Path(cgRect(x: rectX, y: band.top, width: rectW, height: band.bottom - band.top)),
                with: .linearGradient(
                    Gradient(colors: [
                        Palette.Entities.humanShadowSweepBase.opacity(0),
                        Palette.Entities.humanShadowSweepBase.opacity(0.45 * strength),
                    ]),
                    startPoint: cgPoint(x0, 0),
                    endPoint: cgPoint(x1, 0)
                )
            )
            return
        }

        // A pool of shadow under the walker.
        let poolCenter = cgPoint(walker.x, walker.y)
        fill(
            Path(cgRect(x: walker.x - 190, y: band.top, width: 380, height: band.bottom - band.top)),
            with: .radialGradient(
                Gradient(colors: [Palette.Entities.humanShadowPoolInner, Palette.Entities.humanShadowPoolOuter]),
                center: poolCenter, startRadius: 10, endRadius: 190
            )
        )

        // Two feet, a stride apart, the back one lifted.
        let strides: [(offset: Double, lift: Double)] = [
            (0, 0),
            (-walker.dir * Config.Human.strideLength * 0.6, 16),
        ]
        for stride in strides {
            let fx = walker.x + stride.offset

            fill(ellipsePath(cx: fx, cy: walker.y + 26, rx: 52, ry: 13), with: .color(Palette.Entities.humanFootShadow))
            fill(ellipsePath(cx: fx, cy: walker.y - stride.lift, rx: 54, ry: 27), with: .color(Palette.Entities.humanFoot))
            fill(
                ellipsePath(cx: fx + walker.dir * 22, cy: walker.y - stride.lift - 4, rx: 26, ry: 18),
                with: .color(Palette.Entities.humanFootTop)
            )
        }
    }
}

/// `CGPoint`/`CGRect` from `Double`, converting once at the point of use.
/// Same convention as `Terrain.swift`'s and `Entities.swift`'s helpers, kept
/// file-private here since Swift does not let one file's `private` helper be
/// reused by another.
private func cgPoint(_ x: Double, _ y: Double) -> CGPoint {
    CGPoint(x: CGFloat(x), y: CGFloat(y))
}

private func cgRect(x: Double, y: Double, width: Double, height: Double) -> CGRect {
    CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(width), height: CGFloat(height))
}

/// A circle or ellipse path centred on `(cx, cy)`, matching canvas
/// `ellipse(x, y, rx, ry, 0, 0, 2π)`.
private func ellipsePath(cx: Double, cy: Double, rx: Double, ry: Double) -> Path {
    Path(ellipseIn: CGRect(x: CGFloat(cx - rx), y: CGFloat(cy - ry), width: CGFloat(rx * 2), height: CGFloat(ry * 2)))
}

/// A plain circle, matching canvas `arc(x, y, r, 0, 2π)`.
private func circleAt(_ cx: Double, _ cy: Double, _ radius: Double) -> Path {
    ellipsePath(cx: cx, cy: cy, rx: radius, ry: radius)
}

/// An ellipse rotated about its own centre by `rotation` radians, matching
/// canvas `ellipse(x, y, rx, ry, rotation, 0, 2π)` — used for the plant's
/// leaves, the one shape here that needs it.
private func rotatedEllipsePath(cx: Double, cy: Double, rx: Double, ry: Double, rotation: Double) -> Path {
    let local = Path(ellipseIn: CGRect(x: -CGFloat(rx), y: -CGFloat(ry), width: CGFloat(rx * 2), height: CGFloat(ry * 2)))
    let transform = CGAffineTransform(rotationAngle: CGFloat(rotation))
        .concatenating(CGAffineTransform(translationX: CGFloat(cx), y: CGFloat(cy)))
    return local.applying(transform)
}
