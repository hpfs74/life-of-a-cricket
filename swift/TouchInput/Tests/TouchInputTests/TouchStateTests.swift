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

@Test @MainActor func aSafeAreaCutoutNeverPushesTheColumnOverThePlayfield() {
    // The one property that must hold no matter how deep a cutout bites:
    // sliding the column left to dodge it must never cross back into the
    // meadow. Sweep a range of insets, including ones deep enough that full
    // clearance of the cutout itself becomes impossible (see the next test).
    let width = 874.0, height = 402.0
    let viewScale = min(width / Config.View.width, height / Config.View.height)
    let playfieldRight = (width - Config.View.width * viewScale) / 2 + Config.View.width * viewScale

    for inset in [0.0, 20.0, 50.7, 90.0, 200.0] {
        let layout = touchLayout(width: width, height: height, safeTrailingInset: inset)
        for button in layout.buttons {
            #expect(
                button.x - layout.radius >= playfieldRight - 1e-9,
                "\(button.id) crossed into the playfield at inset \(inset)"
            )
        }
    }
}

@Test @MainActor func aSafeAreaCutoutWithRoomToSpareIsFullyCleared() {
    // A corridor wide enough for the button (a hypothetical inset smaller
    // than the real Dynamic Island's) must be fully cleared on both sides —
    // this is the ordinary case the fallback exists for.
    let width = 1000.0, height = 402.0
    let layout = touchLayout(width: width, height: height, safeTrailingInset: 10)

    let viewScale = min(width / Config.View.width, height / Config.View.height)
    let playfieldRight = (width - Config.View.width * viewScale) / 2 + Config.View.width * viewScale

    for button in layout.buttons {
        #expect(button.x - layout.radius >= playfieldRight, "\(button.id) overlaps the playfield")
        #expect(button.x + layout.radius <= width - 10, "\(button.id) sits under the cutout")
    }
}

@Test @MainActor func onARealDynamicIslandPhoneTheCutoutOverlapShrinksDrastically() {
    // The measured, real numbers from an iPhone 17 Pro simulator in
    // landscape: a 874x402pt screen, and a Dynamic Island whose left edge
    // (measured from a screenshot) sits ~50.7pt in from the trailing edge.
    // The corridor between the meadow's edge and the island (~64.7pt) is
    // narrower than one button's diameter (~68.3pt) — genuinely too narrow
    // for zero overlap on both sides at once. The fix cannot make that
    // impossible geometry possible; it can only take the overlap from
    // covering ~40% of a button (the pre-fix defect) down to a sliver.
    let width = 874.0, height = 402.0
    let safeTrailingInset = 50.7

    let before = touchLayout(width: width, height: height)
    let after = touchLayout(width: width, height: height, safeTrailingInset: safeTrailingInset)

    let islandLeft = width - safeTrailingInset
    func overlap(_ layout: TouchLayout) -> Double {
        layout.buttons.map { max(0, $0.x + layout.radius - islandLeft) }.max() ?? 0
    }

    let beforeOverlap = overlap(before)
    let afterOverlap = overlap(after)
    #expect(beforeOverlap > afterOverlap * 5, "the fix should shrink the overlap by a large factor")
    #expect(afterOverlap < after.radius * 0.15, "residual overlap should be a sliver, not a chunk, of a button")

    // And the non-negotiable half of the fix: still nothing over the grass.
    let viewScale = min(width / Config.View.width, height / Config.View.height)
    let playfieldRight = (width - Config.View.width * viewScale) / 2 + Config.View.width * viewScale
    for button in after.buttons {
        #expect(button.x - after.radius >= playfieldRight - 1e-9)
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
