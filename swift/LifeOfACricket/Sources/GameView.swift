import SwiftUI
import CricketCore

/// Colour standing in for the real renderer (Plan 2). Just enough to prove the
/// frame clock is alive: it changes with `game.phase`.
private func phaseColor(_ phase: Phase) -> Color {
    switch phase {
    case .menu: return Color(red: 0.063, green: 0.078, blue: 0.110)
    case .playing: return Color(red: 0.18, green: 0.42, blue: 0.20)
    case .gameOver: return Color(red: 0.42, green: 0.10, blue: 0.10)
    }
}

/// Drives the frame clock and stands in for the real renderer until Plan 2.
struct GameView: View {
    @StateObject private var runner = GameRunner()

    var body: some View {
        TimelineView(.animation) { context in
            runner.advance(to: context.date, intent: .idle)

            return Canvas { canvasContext, size in
                canvasContext.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .color(phaseColor(runner.game.phase))
                )
            }
            .ignoresSafeArea()
        }
    }
}
