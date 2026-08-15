import SwiftUI
import CricketCore

/// Placeholder until Plan 2 adds rendering. Proves the package links.
struct GameView: View {
    var body: some View {
        ZStack {
            Color(red: 0.063, green: 0.078, blue: 0.110).ignoresSafeArea()
            Text("CricketCore \(CricketCore.version)")
                .foregroundStyle(.white)
        }
    }
}
