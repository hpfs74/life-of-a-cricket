import SwiftUI
import Foundation
import CricketCore

/// Ports `drawEntities` from `src/render/entities.js`: the cricket, birds and
/// bats, ants and beetles, spiders, and food. Drawn in WORLD space, inside
/// the camera translate (see `GraphicsContext.worldSpace` in
/// `GameView.swift`), so everything here scrolls with the meadow.
///
/// The cat and the human are the house's cast, drawn by Task 5; nothing here
/// draws them, even though `drawEntities` in the JS also covers those two.
///
/// The spider is the one drawing with a design promise attached: `alertness`
/// rises as the cricket nears its tuft, and the eyes glow accordingly, with
/// an unmistakable crouch before the lunge. That tell is what keeps a spider
/// from being a surprise — see `Spider`'s doc comment in CricketCore.
extension GraphicsContext {
    func drawEntities(game: Game, time: Double) {
        // Tells first: they belong to the cover, beneath everything moving.
        for spider in game.spiders { drawSpiderTell(spider) }
        for item in game.food.items { drawFood(item) }
        for spider in game.spiders { drawSpider(spider, time: time) }
        for rival in game.rivals { drawRival(rival, time: time) }
        drawCricket(game: game, time: time)
        drawHiddenMarker(game: game)
        for bird in game.birds { drawBird(bird, world: game.world, time: time) }
    }

    // MARK: - Food

    private func foodColor(_ type: FoodType) -> Color {
        switch type {
        case .seed: return Palette.Entities.foodSeed
        case .lettuce: return Palette.Entities.foodLettuce
        case .berry: return Palette.Entities.foodBerry
        case .aphid: return Palette.Entities.foodAphid
        case .grub: return Palette.Entities.foodGrub
        }
    }

    /// Lettuce is a ruffled rosette rather than a berry-like blob, so it reads apart.
    private func drawLettuce(_ item: FoodItem, bob: Double) {
        let cx = item.x
        let cy = item.y + bob

        fill(circleAt(cx, cy, item.radius), with: .color(Palette.Entities.lettuceLeaf))

        for i in 0..<5 {
            let angle = (Double(i) / 5) * Double.pi * 2 + 0.4
            fill(
                rotatedEllipsePath(
                    cx: cx + cos(angle) * item.radius * 0.42, cy: cy + sin(angle) * item.radius * 0.42,
                    rx: item.radius * 0.52, ry: item.radius * 0.38, rotation: angle
                ),
                with: .color(Palette.Entities.foodLettuce)
            )
        }

        fill(circleAt(cx, cy, item.radius * 0.3), with: .color(Palette.Entities.lettuceCenter))
    }

    /// A grub: pale and segmented, so a hard-won drop does not look like a seed.
    private func drawGrub(_ item: FoodItem, bob: Double) {
        let cx = item.x
        let cy = item.y + bob

        fill(
            rotatedEllipsePath(cx: cx, cy: cy, rx: item.radius * 1.35, ry: item.radius * 0.8, rotation: 0.2),
            with: .color(Palette.Entities.foodGrub)
        )

        for i in -1...1 {
            stroke(
                rotatedEllipsePath(
                    cx: cx + Double(i) * item.radius * 0.5, cy: cy,
                    rx: item.radius * 0.24, ry: item.radius * 0.7, rotation: 0.2
                ),
                with: .color(Palette.Entities.grubOutline),
                lineWidth: 1
            )
        }
    }

    private func drawFood(_ item: FoodItem) {
        let bob = sin(item.age * 3) * 1.5

        // A fresh drop glints while it settles, so the player sees it land.
        if item.settleFor > 0 {
            let fraction = item.settleFor / Config.Food.dropSettleSeconds
            let radius = item.radius + 8 + (1 - fraction) * 8
            stroke(
                circleAt(item.x, item.y, radius),
                with: .color(Palette.Entities.foodSettleGlowBase.opacity(fraction)),
                lineWidth: 2
            )
        }

        fill(
            ellipsePath(cx: item.x, cy: item.y + item.radius * 0.9, rx: item.radius * 0.9, ry: item.radius * 0.35),
            with: .color(Palette.Entities.foodShadow)
        )

        switch item.type {
        case .lettuce:
            drawLettuce(item, bob: bob)
        case .grub:
            drawGrub(item, bob: bob)
        default:
            fill(circleAt(item.x, item.y + bob, item.radius), with: .color(foodColor(item.type)))
            fill(
                circleAt(item.x - item.radius * 0.3, item.y + bob - item.radius * 0.3, item.radius * 0.28),
                with: .color(Palette.Entities.foodHighlight)
            )
        }
    }

    // MARK: - The cricket

    private func drawSongRings(cricket: Cricket, multiplier: Double, time: Double) {
        let strength = min(1, multiplier / Config.Score.multiplierMax)

        for i in 0..<3 {
            let phase = (time * 1.6 + Double(i) / 3).truncatingRemainder(dividingBy: 1)
            let radius = 18 + phase * (70 + strength * 60)

            stroke(
                circleAt(cricket.x, cricket.y, radius),
                with: .color(Palette.Entities.songRingBase.opacity((1 - phase) * 0.55)),
                lineWidth: CGFloat(2 + strength * 2)
            )
        }
    }

    private func drawCricket(game: Game, time: Double) {
        let cricket = game.cricket
        let r = Config.Cricket.radius
        let blinking = cricket.invulnerableFor > 0 && Int(time * 12) % 2 == 0
        if blinking { return }

        let angle = atan2(cricket.dirY, cricket.dirX)
        let hop = cricket.moving ? abs(sin(time * 14)) * 3 : 0
        let arc = Config.Cricket.Jump.arcHeight
        // A sine arc over the leap: nothing else on a flat field sells height.
        let lift = cricket.jumping ? sin(cricket.jumpProgress * Double.pi) * arc : 0

        // The shadow stays on the ground and shrinks as the cricket rises,
        // which is what tells the player it is airborne rather than just
        // moving fast. `Config.Cricket.Jump.arcHeight` only feeds this: the
        // simulation itself never reads it.
        let shrink = 1 - (lift / arc) * 0.55
        fill(
            ellipsePath(cx: cricket.x, cy: cricket.y + r * 0.9, rx: r * 1.1 * shrink, ry: r * 0.4 * shrink),
            with: .color(Palette.Entities.cricketShadowBase.opacity(shrink))
        )

        if cricket.jumpCooldown > 0 && !cricket.jumping {
            // A closing ring shows when the next leap is ready.
            let remaining = cricket.jumpCooldown / Config.Cricket.Jump.cooldownSeconds
            stroke(
                arcPath(
                    cx: cricket.x, cy: cricket.y, radius: r * 1.9,
                    from: -Double.pi / 2, to: -Double.pi / 2 + (1 - remaining) * Double.pi * 2
                ),
                with: .color(Palette.Entities.jumpCooldownRing),
                lineWidth: 2
            )
        }

        drawLayer { layer in
            layer.translateBy(x: CGFloat(cricket.x), y: CGFloat(cricket.y - hop - lift))
            layer.rotate(by: .radians(angle))
            layer.opacity = game.hidden ? 0.4 : 1

            // Hind legs: bent, kicking when the cricket sings and thrown back mid-leap.
            let kick = cricket.jumping ? 0.55 : (cricket.singing ? sin(time * 40) * 0.35 : 0)
            for side in [-1.0, 1.0] {
                var leg = Path()
                leg.move(to: cgPoint(-r * 0.2, side * r * 0.5))
                leg.addLine(to: cgPoint(-r * 0.9, side * (r * 1.1 + kick * r)))
                leg.addLine(to: cgPoint(-r * 0.2, side * (r * 1.5 + kick * r)))
                layer.stroke(leg, with: .color(Palette.Entities.cricketLegs), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }

            layer.fill(ellipsePath(cx: 0, cy: 0, rx: r * 1.25, ry: r * 0.72), with: .color(Palette.Entities.cricketBody))
            layer.fill(ellipsePath(cx: -r * 0.25, cy: 0, rx: r * 0.85, ry: r * 0.6), with: .color(Palette.Entities.cricketBodyShade))
            layer.fill(circleAt(r * 0.95, 0, r * 0.52), with: .color(Palette.Entities.cricketHead))

            for side in [-1.0, 1.0] {
                layer.fill(circleAt(r * 1.15, side * r * 0.22, r * 0.16), with: .color(Palette.Entities.cricketEyes))
            }

            // Antennae trail behind the direction of travel.
            for side in [-1.0, 1.0] {
                var antenna = Path()
                antenna.move(to: cgPoint(r * 1.2, side * r * 0.25))
                antenna.addQuadCurve(
                    to: cgPoint(r * 2.7, side * r * (1.1 + sin(time * 6 + side) * 0.3)),
                    control: cgPoint(r * 2.1, side * r * (0.7 + sin(time * 6 + side) * 0.2))
                )
                layer.stroke(antenna, with: .color(Palette.Entities.cricketAntennae), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }

        if cricket.swingFor > 0 {
            // A bright arc sweeping the cone the strike actually covers.
            let progress = 1 - cricket.swingFor / Config.Cricket.Strike.swingSeconds
            let facing = atan2(cricket.dirY, cricket.dirX)
            let half = Config.Cricket.Strike.halfAngleDegrees * Double.pi / 180

            stroke(
                arcPath(cx: cricket.x, cy: cricket.y, radius: Config.Cricket.Strike.reach, from: facing - half, to: facing + half),
                with: .color(Palette.Entities.strikeArcBase.opacity(0.85 * (1 - progress))),
                lineWidth: 3
            )
        }

        if cricket.stunnedFor > 0 {
            // Stars, so a frozen cricket reads as stunned rather than as a hung game.
            for i in 0..<3 {
                let a = time * 6 + (Double(i) / 3) * Double.pi * 2
                fill(
                    circleAt(cricket.x + cos(a) * 15, cricket.y - 24 + sin(a) * 5, 2.4),
                    with: .color(Palette.Entities.stunStars)
                )
            }
        }

        if cricket.singing { drawSongRings(cricket: cricket, multiplier: game.score.multiplier, time: time) }
    }

    /// Sits above the cricket, so it is drawn in world space with everything else.
    private func drawHiddenMarker(game: Game) {
        guard game.hidden else { return }

        let text = Text("hidden")
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(Palette.Entities.hiddenMarkerText)
        draw(text, at: cgPoint(game.cricket.x, game.cricket.y - 42), anchor: .center)
    }

    // MARK: - Birds and bats

    /// A bat: scalloped wings and a notched trailing edge, unmistakable in silhouette.
    private func batPath(size: Double, flap: Double) -> Path {
        let span = size * (1.15 - flap * 0.35)
        var path = Path()

        path.move(to: cgPoint(size * 0.55, 0))
        path.addQuadCurve(to: cgPoint(-size * 0.35, -span), control: cgPoint(size * 0.1, -span * 0.75))
        path.addQuadCurve(to: cgPoint(-size * 0.62, -span * 0.5), control: cgPoint(-size * 0.3, -span * 0.42))
        path.addQuadCurve(to: cgPoint(-size * 0.85, 0), control: cgPoint(-size * 0.5, -span * 0.16))
        path.addQuadCurve(to: cgPoint(-size * 0.62, span * 0.5), control: cgPoint(-size * 0.5, span * 0.16))
        path.addQuadCurve(to: cgPoint(-size * 0.35, span), control: cgPoint(-size * 0.3, span * 0.42))
        path.addQuadCurve(to: cgPoint(size * 0.55, 0), control: cgPoint(size * 0.1, span * 0.75))
        path.closeSubpath()

        // Ears.
        path.move(to: cgPoint(size * 0.35, -size * 0.18))
        path.addLine(to: cgPoint(size * 0.62, -size * 0.5))
        path.addLine(to: cgPoint(size * 0.66, -size * 0.12))
        path.closeSubpath()

        path.move(to: cgPoint(size * 0.35, size * 0.18))
        path.addLine(to: cgPoint(size * 0.62, size * 0.5))
        path.addLine(to: cgPoint(size * 0.66, size * 0.12))
        path.closeSubpath()

        return path
    }

    private func birdPath(size: Double, flap: Double) -> Path {
        var path = Path()
        path.move(to: cgPoint(size, 0))
        path.addLine(to: cgPoint(-size * 0.35, -size * (0.34 + flap * 0.4)))
        path.addLine(to: cgPoint(-size * 0.9, -size * 0.12))
        path.addLine(to: cgPoint(-size * 1.25, 0))
        path.addLine(to: cgPoint(-size * 0.9, size * 0.12))
        path.addLine(to: cgPoint(-size * 0.35, size * (0.34 + flap * 0.4)))
        path.closeSubpath()
        return path
    }

    private func drawBird(_ bird: Bird, world: World, time: Double) {
        let diving = bird.state == .dive
        let isBat = bird.kind == .bat
        let angle = atan2(bird.vy, bird.vx)
        let base = bird.kind.size
        let size = diving ? base * 1.18 : base

        // Ground shadow: the player's warning that something is overhead.
        fill(
            ellipsePath(cx: bird.x, cy: min(bird.y + 46, world.height - 4), rx: size * 0.9, ry: size * 0.3),
            with: .color(Palette.Entities.birdShadow)
        )

        drawLayer { layer in
            layer.translateBy(x: CGFloat(bird.x), y: CGFloat(bird.y))
            layer.rotate(by: .radians(angle))

            // Bats beat their wings far faster and more erratically than birds.
            let rate = isBat ? (diving ? 30.0 : 17.0) : (diving ? 22.0 : 9.0)
            let flap = sin(time * rate) * (diving ? 0.25 : 0.75)

            let color = diving ? Palette.Entities.batDiving : Palette.Entities.batBase
            layer.fill(isBat ? batPath(size: size, flap: flap) : birdPath(size: size, flap: flap), with: .color(color))
        }

        if bird.state == .circle {
            // A pulsing marker over the circling bird tells the player where the threat is.
            let pulse = 0.5 + sin(time * 6) * 0.5
            stroke(
                circleAt(bird.x, bird.y, size * 1.6 + pulse * 6),
                with: .color(Palette.Entities.birdCircleMarkerBase.opacity(0.35 + pulse * 0.4)),
                lineWidth: 2
            )
        }
    }

    // MARK: - Rivals

    /// Ants and beetles: small, busy, and after the same food as the cricket.
    private func drawRival(_ rival: Rival, time: Double) {
        let r = Config.Rivals.radius
        let (bodyColor, shineColor): (Color, Color) = rival.kind == .beetle
            ? (Palette.Entities.rivalBeetleBody, Palette.Entities.rivalBeetleShine)
            : (Palette.Entities.rivalAntBody, Palette.Entities.rivalAntShine)
        let scuttle = rival.nibbleFor > 0 ? 0 : sin(time * 18 + rival.phase)

        drawLayer { layer in
            layer.translateBy(x: CGFloat(rival.x), y: CGFloat(rival.y))
            layer.rotate(by: .radians(atan2(rival.dirY, rival.dirX)))

            layer.fill(ellipsePath(cx: 0, cy: r * 0.9, rx: r * 0.9, ry: r * 0.3), with: .color(Palette.Entities.rivalShadow))

            for side in [-1.0, 1.0] {
                for i in -1...1 {
                    var leg = Path()
                    leg.move(to: cgPoint(Double(i) * r * 0.4, side * r * 0.35))
                    leg.addLine(to: cgPoint(Double(i) * r * 0.5 + scuttle * 1.5, side * (r * 1.1)))
                    layer.stroke(leg, with: .color(bodyColor), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                }
            }

            let fillColor = rival.flashFor > 0 ? Palette.Entities.rivalFlash : bodyColor

            if rival.kind == .beetle {
                layer.fill(ellipsePath(cx: 0, cy: 0, rx: r * 1.15, ry: r * 0.85), with: .color(fillColor))
                var seam = Path()
                seam.move(to: cgPoint(-r * 0.9, 0))
                seam.addLine(to: cgPoint(r * 0.8, 0))
                layer.stroke(seam, with: .color(shineColor), lineWidth: 1)
            } else {
                for (ox, rx) in [(-r * 0.85, r * 0.5), (0, r * 0.34), (r * 0.75, r * 0.42)] {
                    layer.fill(ellipsePath(cx: ox, cy: 0, rx: rx, ry: rx * 0.82), with: .color(fillColor))
                }
            }
        }
    }

    // MARK: - Spiders

    /// Web strands across the mouth of an occupied tuft. Drawn beneath
    /// everything so the cover looks spun-in rather than decorated.
    private func drawSpiderTell(_ spider: Spider) {
        let r = spider.cover.radius
        let color = Palette.Entities.spiderTellBase.opacity(0.14 + spider.alertness * 0.26)

        for i in 0..<4 {
            let angle = (Double(i) / 4) * Double.pi * 2 + 0.5
            var strand = Path()
            strand.move(to: cgPoint(spider.homeX, spider.homeY))
            strand.addLine(to: cgPoint(spider.homeX + cos(angle) * r * 0.85, spider.homeY + sin(angle) * r * 0.6))
            stroke(strand, with: .color(color), lineWidth: 1)
        }
    }

    private func drawSpider(_ spider: Spider, time: Double) {
        let winding = spider.state == .windup
        let lunging = spider.state == .lunge

        // It tenses visibly before it commits: that crouch is the reaction window.
        let crouch = winding ? 1 - min(1, spider.stateTime / Config.Spiders.windUpSeconds) * 0.35 : 1.0
        let body = (lunging ? 8.5 : 7.0) * crouch
        let reach = lunging ? 17.0 : 13.0 * crouch
        let skitter = lunging ? 0 : sin(time * 5 + spider.homeY) * 0.12

        drawLayer { layer in
            layer.translateBy(x: CGFloat(spider.x), y: CGFloat(spider.y))

            layer.fill(ellipsePath(cx: 0, cy: body * 0.9, rx: body * 1.1, ry: body * 0.35), with: .color(Palette.Entities.spiderShadow))

            let legColor = (winding || lunging) ? Palette.Entities.spiderLegsAlert : Palette.Entities.spiderLegsIdle
            for side in [-1.0, 1.0] {
                for i in 0..<4 {
                    let spread = (-0.75 + Double(i) * 0.5) + skitter * side
                    let knee = reach * 0.62
                    var leg = Path()
                    leg.move(to: .zero)
                    leg.addLine(to: cgPoint(cos(spread) * knee * side, sin(spread) * knee - reach * 0.3))
                    leg.addLine(to: cgPoint(cos(spread) * reach * side, sin(spread) * reach + reach * 0.15))
                    layer.stroke(leg, with: .color(legColor), style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
                }
            }

            layer.fill(ellipsePath(cx: 0, cy: 0, rx: body, ry: body * 0.85), with: .color(Palette.Entities.spiderBody))
            layer.fill(ellipsePath(cx: body * 0.85, cy: 0, rx: body * 0.5, ry: body * 0.45), with: .color(Palette.Entities.spiderBody))

            // Eyes last, so the body cannot swallow the one cue the player
            // needs. They are always lit and brighten as the cricket approaches.
            let glow = 0.68 + spider.alertness * 0.32
            let pulse = 0.85 + sin(time * 3 + spider.homeX) * 0.15
            let eyeColor = Palette.Entities.spiderEyesBase.opacity(glow * pulse)
            for side in [-1.0, 1.0] {
                layer.fill(circleAt(body * 1.05, side * body * 0.3, 2.1), with: .color(eyeColor))
            }
        }
    }
}

/// `CGPoint` from `Double`, converting once at the point of use rather than
/// scattering `CGFloat(...)` through every path build below. Same convention
/// as `Terrain.swift`'s `cgPoint`/`cgRect`, kept file-private here since
/// nearly every shape in this file is built from a translated origin rather
/// than a `CGRect`.
private func cgPoint(_ x: Double, _ y: Double) -> CGPoint {
    CGPoint(x: CGFloat(x), y: CGFloat(y))
}

/// A circle or ellipse path centred on `(cx, cy)`, matching canvas
/// `ellipse(x, y, rx, ry, 0, 0, 2π)` (or `arc(x, y, r, 0, 2π)` when `rx == ry`).
private func ellipsePath(cx: Double, cy: Double, rx: Double, ry: Double) -> Path {
    Path(ellipseIn: CGRect(x: CGFloat(cx - rx), y: CGFloat(cy - ry), width: CGFloat(rx * 2), height: CGFloat(ry * 2)))
}

/// A plain circle, matching canvas `arc(x, y, r, 0, 2π)` — used for both
/// small filled dots (eyes, stars) and stroked rings (song rings, markers).
private func circleAt(_ cx: Double, _ cy: Double, _ radius: Double) -> Path {
    ellipsePath(cx: cx, cy: cy, rx: radius, ry: radius)
}

/// An ellipse rotated about its own centre by `rotation` radians, matching
/// canvas `ellipse(x, y, rx, ry, rotation, 0, 2π)` — the lettuce's petals and
/// the grub's body and stripes are the only shapes here that need it.
private func rotatedEllipsePath(cx: Double, cy: Double, rx: Double, ry: Double, rotation: Double) -> Path {
    let local = Path(ellipseIn: CGRect(x: -CGFloat(rx), y: -CGFloat(ry), width: CGFloat(rx * 2), height: CGFloat(ry * 2)))
    let transform = CGAffineTransform(rotationAngle: CGFloat(rotation))
        .concatenating(CGAffineTransform(translationX: CGFloat(cx), y: CGFloat(cy)))
    return local.applying(transform)
}

/// A partial arc from `startAngle` to `endAngle`, matching canvas
/// `arc(x, y, r, startAngle, endAngle)`. Built by sampling points rather than
/// `Path.addArc`, whose `clockwise` flag has a direction convention that does
/// not obviously match canvas's angle-increasing-from-start sweep; walking
/// the angle directly sidesteps that ambiguity and is exact for any span.
private func arcPath(cx: Double, cy: Double, radius: Double, from startAngle: Double, to endAngle: Double) -> Path {
    var path = Path()
    let segments = max(2, Int(abs(endAngle - startAngle) / 0.12))
    for i in 0...segments {
        let t = startAngle + (endAngle - startAngle) * Double(i) / Double(segments)
        let point = cgPoint(cx + cos(t) * radius, cy + sin(t) * radius)
        if i == 0 {
            path.move(to: point)
        } else {
            path.addLine(to: point)
        }
    }
    return path
}
