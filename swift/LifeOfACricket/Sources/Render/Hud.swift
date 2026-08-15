import SwiftUI
import CricketCore

/// Ports `drawHud` and `drawOverlay` from `src/render/hud.js`: the score,
/// meters and day counter drawn every frame, and the menu/game-over panels.
///
/// Drawn in VIEW space — the same layer as the sky (see `GameView.swift`),
/// after the world-space block closes — so none of it scrolls or scales with
/// the meadow, matching the JS's `ctx.restore()` before `drawHud`/`drawOverlay`
/// in `src/main.js`'s `frame()`.
extension GraphicsContext {
    func drawHud(game: Game) {
        let width = CGFloat(Config.View.width)

        drawHudText(
            String(Int(game.score.points.rounded(.down))),
            at: cgPoint(22, 20), anchor: .topLeading,
            size: 30, weight: .bold, color: Palette.Hud.primaryText
        )
        drawHudText(
            "BEST \(game.score.highScore)",
            at: cgPoint(22, 56), anchor: .topLeading,
            size: 13, weight: .semibold, color: Palette.Hud.secondaryText
        )

        // Attention is the player's only warning that a predator is coming —
        // full size, undimmed, same as the JS.
        drawMeter(x: 22, y: 82, width: 160, height: 10, fill: game.attention.value, color: Palette.Hud.attentionMeter, label: "attention")
        drawMeter(x: 22, y: 100, width: 160, height: 10, fill: game.score.fed / Config.Score.fedSeconds, color: Palette.Hud.fedMeter, label: "fed")

        // The day counter sits dead centre at the top: it is the run's
        // headline stat.
        let where_ = game.stage == .house ? "\u{2302}  " : ""
        let glyph = game.night ? "\u{263e}" : "\u{2600}"
        drawHudText(
            "\(where_)\(glyph)  Day \(game.day)",
            at: cgPoint(Double(width) / 2, 18), anchor: .top,
            size: 24, weight: .bold, color: Palette.Hud.primaryText
        )

        if game.shiftedFor > 0 {
            // Fade the caption out so a new day reads as an event, not a glitch.
            let fade = min(1, game.shiftedFor / 1.2)
            drawHudText(
                "the meadow has shifted",
                at: cgPoint(Double(width) / 2, 50), anchor: .top,
                size: 15, weight: .semibold, color: Palette.Hud.shiftCaptionBase.opacity(fade)
            )
        } else if game.score.multiplier > Config.Score.multiplierStart + 0.001 {
            drawHudText(
                String(format: "x%.1f", game.score.multiplier),
                at: cgPoint(Double(width) / 2, 48), anchor: .top,
                size: 20, weight: .bold, color: Palette.Hud.multiplierText
            )
        }

        let hearts = String(repeating: "\u{2665}", count: max(0, game.lives))
        drawHudText(
            hearts,
            at: cgPoint(Double(width) - 22, 22), anchor: .topTrailing,
            size: 24, weight: .bold, color: Palette.Hud.primaryText
        )
    }

    /// A rounded track with a proportional fill and a label to its right,
    /// matching `meter()` in the JS.
    private func drawMeter(x: Double, y: Double, width: Double, height: Double, fill: Double, color: Color, label: String) {
        let rect = CGRect(x: x, y: y, width: width, height: height)
        self.fill(Path(roundedRect: rect, cornerRadius: height / 2), with: .color(Palette.Hud.meterTrack))

        let fillWidth = max(0, min(1, fill)) * width
        // `roundRect`'s corner radius clamps to the shape it is given, same as
        // the canvas spec does automatically for a bar narrower than its pill.
        let fillRect = CGRect(x: x, y: y, width: fillWidth, height: height)
        self.fill(Path(roundedRect: fillRect, cornerRadius: min(height / 2, fillWidth / 2)), with: .color(color))

        let text = Text(label)
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(Palette.Hud.meterLabel)
        draw(text, at: cgPoint(x + width + 10, y + height / 2), anchor: .leading)
    }

    private func drawHudText(_ string: String, at point: CGPoint, anchor: UnitPoint, size: CGFloat, weight: Font.Weight, color: Color) {
        let text = Text(string)
            .font(.system(size: size, weight: weight))
            .foregroundColor(color)
        draw(text, at: point, anchor: anchor)
    }

    // MARK: - Overlays

    func drawOverlay(game: Game, time: Double) {
        switch game.phase {
        case .menu:
            drawPanel(lines: menuLines)
            drawCreditsRoll(time: time)
        case .gameOver:
            drawPanel(lines: gameOverLines(game: game))
        case .playing:
            break
        }
    }

    private var menuLines: [PanelLine] {
        [
            PanelLine(text: "Life of a Cricket", color: Palette.Hud.primaryText, size: 48, weight: .bold, gap: 62),
            PanelLine(text: "Move with WASD or the arrow keys. Hold SPACE to sing.", color: Palette.Hud.bodyText),
            PanelLine(text: "Singing scores \u{2014} and it is loud. Birds come for the noise.", color: Palette.Hud.bodyText),
            PanelLine(text: "Hide in grass, rocks and leaves. Cover only saves you if you stay quiet.", color: Palette.Hud.bodyText, gap: 56),
            // The JS reads "Press ENTER to begin · or touch the screen"; a
            // phone has no ENTER key, so the prompt is touch-only here.
            PanelLine(text: "Touch the screen to begin", color: Palette.Hud.multiplierText, size: 22, weight: .bold),
        ]
    }

    private func gameOverLines(game: Game) -> [PanelLine] {
        [
            PanelLine(text: "Caught", color: Palette.Hud.primaryText, size: 46, weight: .bold, gap: 58),
            PanelLine(text: "Score \(Int(game.score.points.rounded(.down)))", color: Palette.Hud.primaryText, size: 26, weight: .bold),
            game.newRecord
                ? PanelLine(text: "A new best!", color: Palette.Hud.multiplierText, gap: 56)
                : PanelLine(text: "Best \(game.score.highScore)", color: Palette.Hud.bestText, gap: 56),
            // As on the menu: no ENTER key on a phone, so touch is the only prompt.
            PanelLine(text: "Touch the screen to sing again", color: Palette.Hud.multiplierText, size: 20, weight: .bold),
        ]
    }

    /// A full-view translucent panel with centred, vertically stacked lines,
    /// matching `panel()` in the JS.
    private func drawPanel(lines: [PanelLine]) {
        let width = CGFloat(Config.View.width)
        let height = CGFloat(Config.View.height)

        fill(Path(CGRect(x: 0, y: 0, width: width, height: height)), with: .color(Palette.Hud.panelBackground))

        let totalHeight = lines.reduce(0.0) { $0 + $1.gap }
        var y = Double(height) / 2 - totalHeight / 2

        for line in lines {
            drawHudText(line.text, at: cgPoint(Double(width) / 2, y), anchor: .center, size: line.size, weight: line.weight, color: line.color)
            y += line.gap
        }
    }

    // MARK: - Credits roll

    /// A credits roll on the title screen: the block scrolls up through a
    /// band at the bottom of the page and wraps around forever. Carries the
    /// designer's own credit — this matters, it is her name on her own game.
    ///
    /// Each line is drawn twice, one loop-length apart, so the seam is never
    /// visible however long the menu sits open, matching `drawCreditsRoll` in
    /// the JS.
    private func drawCreditsRoll(time: Double) {
        let width = CGFloat(Config.View.width)
        let height = CGFloat(Config.View.height)
        let bandTop = height - creditBandHeight - 18
        let loop = Double(creditLines.count) * creditLineHeight

        let raw = (time * creditScrollSpeed).truncatingRemainder(dividingBy: loop)
        let scroll = raw < 0 ? raw + loop : raw

        drawLayer { band in
            band.clip(to: Path(CGRect(x: 0, y: bandTop, width: width, height: creditBandHeight)))

            for (index, line) in creditLines.enumerated() {
                let base = bandTop + CGFloat(creditBandHeight + Double(index) * creditLineHeight - scroll)

                for y in [base, base + CGFloat(loop)] {
                    guard y >= bandTop - CGFloat(creditLineHeight), y <= bandTop + creditBandHeight + CGFloat(creditLineHeight) else { continue }

                    // Fade toward both edges of the band so lines slide in and out softly.
                    let distance = abs(Double(y) - (Double(bandTop) + creditBandHeight / 2))
                    let fade = max(0, 1 - distance / (creditBandHeight / 2))
                    guard fade > 0 else { continue }

                    band.drawLayer { lineLayer in
                        lineLayer.opacity = fade
                        let text = Text(line.text)
                            .font(.system(size: line.size, weight: line.weight))
                            .foregroundColor(line.color)
                        lineLayer.draw(text, at: cgPoint(Double(width) / 2, Double(y)), anchor: .center)
                    }
                }
            }
        }
    }
}

/// One line of a panel (menu/game-over) or the credits roll.
private struct PanelLine {
    let text: String
    var color: Color = Palette.Hud.primaryText
    var size: CGFloat = 18
    var weight: Font.Weight = .semibold
    var gap: Double = 34
}

private let creditLineHeight = 34.0
private let creditScrollSpeed = 26.0
private let creditBandHeight = 118.0

private let creditLines: [PanelLine] = [
    PanelLine(text: "Game design", color: Palette.Hud.creditLabel, size: 13, weight: .semibold),
    PanelLine(text: "Anna Teresa Salvestrini", color: Palette.Hud.creditName, size: 22, weight: .bold),
    PanelLine(text: "\u{b7}", color: Palette.Hud.creditDivider, size: 16, weight: .semibold),
    PanelLine(text: "Life of a Cricket", color: Palette.Hud.creditTitle, size: 16, weight: .semibold),
    PanelLine(text: "No engine, no assets \u{2014} every pixel and every sound made from code", color: Palette.Hud.creditSubtitle, size: 13, weight: .semibold),
    PanelLine(text: "\u{b7}", color: Palette.Hud.creditDivider, size: 16, weight: .semibold),
]

private func cgPoint(_ x: Double, _ y: Double) -> CGPoint {
    CGPoint(x: x, y: y)
}
