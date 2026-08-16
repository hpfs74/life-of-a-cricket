import Testing
import CoreGraphics
import CricketCore
@testable import TouchInput

/// A 400x300 screen: wide enough that the stick zone (the left half) and the
/// button stack (right-hand side) do not overlap.
@MainActor
private func freshState() -> TouchState {
    let state = TouchState()
    state.resize(width: 400, height: 300)
    return state
}

@Test @MainActor func steeringAndPressingWorkSimultaneously() {
    // This is the property the whole touch-input layer exists to preserve:
    // a drag in the stick zone and a press on a button, driven by two
    // different touch identities at once, must both show up in the same
    // `Intent` at the same moment. A single touch could never demonstrate
    // this — only two independent, concurrently-tracked identities can.
    let state = freshState()
    let layout = state.currentLayout
    let strikeButton = layout.buttons.first { $0.id == .fight }!

    // Touch "A" puts a thumb down in the stick zone (the left half) and
    // drags it right and down.
    state.touchBegan("A", at: CGPoint(x: 40, y: 150))
    // Touch "B" — a different finger — presses the strike button.
    state.touchBegan("B", at: CGPoint(x: strikeButton.x, y: strikeButton.y))
    state.touchMoved("A", to: CGPoint(x: 40 + 50, y: 150 + 50))

    #expect(state.intent.dx != 0, "dragging touch A should steer the stick")
    #expect(state.intent.strike, "touch B should still be holding the strike button")

    // Lifting the button touch must not disturb the still-active drag.
    state.touchEnded("B")
    #expect(state.intent.dx != 0)
    #expect(!state.intent.strike)

    state.touchEnded("A")
    #expect(state.intent.dx == 0)
    #expect(state.intent.dy == 0)
}

@Test @MainActor func aTouchBeginningInTheStickZoneCreatesTheStickAtThatPoint() {
    let state = freshState()
    state.touchBegan("A", at: CGPoint(x: 77, y: 133))
    #expect(state.stickActive)
    #expect(state.stickOrigin == CGPoint(x: 77, y: 133))
    #expect(state.intent.dx == 0 && state.intent.dy == 0, "no movement yet, so standing still")
}

@Test @MainActor func travelBelowTheDeadZoneReadsAsStandingStill() {
    let state = freshState()
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    let tiny = Config.Touch.stickDeadZone * 0.5
    state.touchMoved("A", to: CGPoint(x: 40 + tiny, y: 40))
    #expect(state.intent.dx == 0 && state.intent.dy == 0)
}

@Test @MainActor func travelPastTheDeadZoneGivesAUnitVector() {
    let state = freshState()
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    state.touchMoved("A", to: CGPoint(x: 40 + 100, y: 40))
    #expect(abs(state.intent.dx - 1) < 1e-9)
    #expect(abs(state.intent.dy) < 1e-9)
}

@Test @MainActor func liftingTheStickTouchStopsTheCricketDead() {
    let state = freshState()
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    state.touchMoved("A", to: CGPoint(x: 140, y: 40))
    #expect(state.intent.dx != 0)

    state.touchEnded("A")
    #expect(state.intent.dx == 0 && state.intent.dy == 0)
    #expect(!state.stickActive)
}

@Test @MainActor func aSecondTouchInTheStickZoneWhileOneIsActiveIsIgnored() {
    // Mirrors the JS: `if (inStickZone && !stick.active)`. Only one stick.
    let state = freshState()
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    state.touchBegan("C", at: CGPoint(x: 60, y: 200))
    state.touchMoved("C", to: CGPoint(x: 160, y: 200))
    // C was never assigned the stick, so moving it does nothing.
    #expect(state.stickOrigin == CGPoint(x: 40, y: 40))
}

@Test @MainActor func onlyASingHeldButtonKeepsSingingTrue() {
    let state = freshState()
    let sing = state.currentLayout.buttons.first { $0.id == .sing }!
    state.touchBegan("A", at: CGPoint(x: sing.x, y: sing.y))
    #expect(state.intent.sing)
    state.touchEnded("A")
    #expect(!state.intent.sing)
}

@Test @MainActor func anyTouchAnywhereRequestsAStartExactlyOnce() {
    let state = freshState()
    #expect(!state.consumeStartRequest())
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    #expect(state.consumeStartRequest())
    #expect(!state.consumeStartRequest(), "consuming clears the request")
}

@Test @MainActor func buttonsClearThePlayfieldAtAPhoneAspectRatio() {
    // 844x390 (an iPhone 14-shaped landscape screen): wider, relative to its
    // height, than the 960x600 view, so the letterbox bars land left and
    // right of the playfield, and the button stack must fit inside the
    // right one without overlapping it.
    let state = TouchState()
    state.resize(width: 844, height: 390)
    let layout = state.currentLayout

    let viewScale = min(844.0 / Config.View.width, 390.0 / Config.View.height)
    let playfieldRight = 844.0 / 2 + (Config.View.width * viewScale) / 2

    for button in layout.buttons {
        #expect(
            button.x - layout.radius >= playfieldRight,
            "\(button.id) overlaps the playfield"
        )
    }
}

@Test @MainActor func releaseAllClearsEverything() {
    let state = freshState()
    let sing = state.currentLayout.buttons.first { $0.id == .sing }!
    state.touchBegan("A", at: CGPoint(x: 40, y: 40))
    state.touchBegan("B", at: CGPoint(x: sing.x, y: sing.y))
    state.touchMoved("A", to: CGPoint(x: 140, y: 40))

    state.releaseAll()

    #expect(!state.stickActive)
    #expect(state.pressed.isEmpty)
    #expect(state.intent == .idle)
}
