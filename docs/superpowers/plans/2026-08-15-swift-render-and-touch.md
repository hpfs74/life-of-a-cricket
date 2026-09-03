# Swift Render and Touch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder iOS app into a playable game — SwiftUI `Canvas` renderers driving the already-ported simulation, plus a real multi-touch input layer, so *Life of a Cricket* can be played with two thumbs on a phone.

**Architecture:** `CricketCore` is finished and untouched by this plan. The app layer adds a `GameRunner` owning the simulation and a frame clock, `Canvas` renderers that read state and draw, and a `UIViewRepresentable` touch layer producing the same `Intent` the core already consumes. Nothing here may mutate simulation state.

**Tech Stack:** SwiftUI (`TimelineView`, `Canvas`, `GraphicsContext`), UIKit (`UIView` multi-touch only), Swift 6.3, Xcode 26.6 / iOS 26.5 SDK. Zero third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-life-of-a-cricket-swift-design.md` (phases 5–6)

**Prior plan:** `docs/superpowers/plans/2026-08-15-swift-simulation-core.md` (phases 1–4, complete — 107 tests)

## Global Constraints

- **`swift/CricketCore/` is FROZEN in this plan.** If a renderer needs data the core does not expose, add a read-only computed property or a `public let` — never logic, never mutation. Any change under `Sources/CricketCore/` must be reported prominently and justified.
- **Renderers are pure readers.** Nothing in `swift/LifeOfACricket/Sources/Render/` may mutate `Game` or any of its parts. This mirrors the rule `src/render/` follows in the JavaScript.
- **The JavaScript renderers in `src/render/` are the visual reference.** Match their shapes, colours, layering and motion. Read them before writing each Swift renderer.
- **No image assets, no audio files.** Every visual is drawn with paths, fills and gradients, exactly as the browser version does. Audio is a later plan.
- **Zero third-party dependencies.** No SPM dependency entries.
- **Swift 6 language mode.** The app layer is `@MainActor`; `Game` is deliberately not `Sendable` (it holds the store and rng existentials) and must stay confined to the main actor.
- **`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` is required on EVERY `swift test` and `xcodebuild` invocation.** Plain `swift test` fails with "no such module 'Testing'". Never run `sudo xcode-select`.
- **The simulation runs in `Config.World` units and is letterboxed into `Config.View` (960×600).** Never scale the simulation to the device; scale the view.
- **The full suite must stay green: 107 tests**, including `WorldGoldenTests` and `DifferentialTraceTests`.
- **Verify visually, not just by building.** Every rendering task ends with a simulator screenshot pasted into the report. "It compiles" is not evidence that anything is on screen.
- **Commit after every task.**

## File Structure

| Path | Responsibility |
| --- | --- |
| `swift/LifeOfACricket/Sources/GameRunner.swift` | `@MainActor` class owning `Game`, the frame clock, and dt clamping |
| `swift/LifeOfACricket/Sources/GameView.swift` | `TimelineView` + `Canvas`; the letterbox transform and the three coordinate spaces |
| `swift/LifeOfACricket/Sources/Render/Palette.swift` | Every colour, ported from the JS renderers |
| `swift/LifeOfACricket/Sources/Render/Background.swift` | Sky, day/night gradient, ground band |
| `swift/LifeOfACricket/Sources/Render/Terrain.swift` | Water, cover (grass/rock/leaf), the doorway |
| `swift/LifeOfACricket/Sources/Render/HouseRender.swift` | House backdrop, floors, stairwell, furniture |
| `swift/LifeOfACricket/Sources/Render/Entities.swift` | Cricket, birds/bats, spiders, rivals, food, cat, human |
| `swift/LifeOfACricket/Sources/Render/Hud.swift` | Score, lives, meters, captions, menu and game-over overlays |
| `swift/LifeOfACricket/Sources/Render/TouchControlsRender.swift` | Stick and action buttons, drawn in the letterbox |
| `swift/LifeOfACricket/Sources/TouchInputView.swift` | `UIViewRepresentable` multi-touch → `Intent` |

Renderers are split by what they draw rather than by coordinate space, so each file stays small enough to hold in context and matches a JS counterpart.

---

### Task 1: GameRunner and the frame clock

**Files:**
- Create: `swift/LifeOfACricket/Sources/GameRunner.swift`
- Modify: `swift/LifeOfACricket/Sources/GameView.swift`

**Interfaces:**
- Consumes: `CricketCore.Game`, `Config`, `Intent`, `MemoryHighScoreStore`, `SeededRandom`
- Produces:
  - `protocol HighScoreStoring` is NOT needed — reuse `CricketCore.HighScoreStore`
  - `final class UserDefaultsHighScoreStore: HighScoreStore` (app-side, uses `Config.Score.storageKey`)
  - `@MainActor final class GameRunner: ObservableObject` with `var game: Game`, `var camera: Camera`, `func advance(to date: Date)`, `func requestStart()`, `var latestEvents: [GameEvent]`

- [ ] **Step 1: Write GameRunner**

```swift
import Foundation
import SwiftUI
import CricketCore

/// Persists the high score in UserDefaults. The core stays free of any
/// platform storage API; this is the app's half of that bargain.
final class UserDefaultsHighScoreStore: HighScoreStore {
    private let key = Config.Score.storageKey
    func load() -> Int { UserDefaults.standard.integer(forKey: key) }
    func save(_ value: Int) { UserDefaults.standard.set(value, forKey: key) }
}

/// Owns the simulation and the frame clock.
///
/// A reference type at this boundary so SwiftUI does not copy a whole `Game`
/// sixty times a second; `Game` itself stays a pure value type inside the core.
@MainActor
final class GameRunner: ObservableObject {
    private(set) var game: Game
    private(set) var camera: Camera
    private(set) var latestEvents: [GameEvent] = []

    private var lastDate: Date?
    private var startRequested = false

    init() {
        let store = UserDefaultsHighScoreStore()
        let rng = SystemRandom()
        game = Game(store: store, rng: rng)
        camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
    }

    func requestStart() { startRequested = true }

    /// Advances the simulation to `date`. Guarded against SwiftUI evaluating the
    /// view body more than once for a single date, which would double-step time.
    func advance(to date: Date, intent: Intent) {
        guard lastDate != date else { return }
        let dt = min(date.timeIntervalSince(lastDate ?? date), Config.Game.maxFrameDelta)
        lastDate = date

        if startRequested {
            startRequested = false
            if game.phase != .playing {
                game.startRun()
                camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
            }
        }

        latestEvents = game.update(intent: intent, dt: dt)

        // A doorway swaps the whole world out; re-frame rather than sliding across.
        if latestEvents.contains(where: { if case .stageChange = $0 { return true }; return false }) {
            camera = Camera(world: game.world, target: Point(x: game.cricket.x, y: game.cricket.y))
        }

        camera.update(target: Point(x: game.cricket.x, y: game.cricket.y), world: game.world, dt: dt)
    }
}
```

`SystemRandom` is a small app-side `RandomSource` wrapping `Double.random(in: 0..<1)` — add it in this file. The core deliberately ships only seeded generators so its tests stay deterministic.

- [ ] **Step 2: Wire GameView to the runner with a fixed intent**

Replace the placeholder body with a `TimelineView(.animation)` whose body calls `runner.advance(to: context.date, intent: .idle)` and then draws a `Canvas` containing a single filled rectangle whose colour depends on `game.phase`. This proves the clock runs before any renderer exists.

- [ ] **Step 3: Build, run, screenshot**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project swift/LifeOfACricket/LifeOfACricket.xcodeproj \
  -scheme LifeOfACricket -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcrun simctl boot 'iPhone 17 Pro' 2>/dev/null || true
# install + launch as in the prior plan, then:
xcrun simctl io booted screenshot /tmp/task1.png
```

Expected: a solid colour filling the screen in landscape. Paste the result into the report and confirm the app did not crash after several seconds (which would indicate the clock or dt handling is wrong).

- [ ] **Step 4: Verify the core suite is untouched**

```bash
cd swift/CricketCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

Expected: 107 tests pass.

- [ ] **Step 5: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): the frame clock and the game runner"
```

---

### Task 2: The letterbox and the three coordinate spaces

**Files:**
- Modify: `swift/LifeOfACricket/Sources/GameView.swift`
- Create: `swift/LifeOfACricket/Sources/Render/Palette.swift`

**Interfaces:**
- Produces:
  - `enum Palette` with every colour used by the renderers, named after its JS counterpart
  - `func GraphicsContext.letterboxed(size:_:)` — or an equivalent helper — establishing the view transform

**Reference:** `src/main.js` (the `resize` function and the draw sandwich)

- [ ] **Step 1: Implement the transform**

The simulation always runs in `Config.View` units (960×600). Compute `scale = min(size.width / 960, size.height / 600)` and centre the result, then clip to the view rect so the scrolling meadow cannot spill into the letterbox. `GraphicsContext.drawLayer` is the analogue of the JS `ctx.save()`/`ctx.restore()`.

Establish all three spaces, matching `src/main.js`:

| Space | Contents | Mechanism |
| --- | --- | --- |
| Letterbox | everything in the 960×600 view | outer `drawLayer`: translate by offset, scale, clip |
| World | ground, entities | nested `drawLayer`: translate by `-round(camera.x)` |
| Screen | touch controls | outside both layers |

- [ ] **Step 2: Prove all three spaces with placeholder marks**

Draw: a full-view rect in letterbox space; a rect at world x=0 and another at world x=2880 (the far end of the meadow) in world space; and a small mark in a screen corner. Only the world marks should move when `camera.x` changes.

- [ ] **Step 3: Screenshot and confirm the letterbox**

Take screenshots on two simulators of different aspect ratios (`iPhone 17 Pro` and `iPad (A16)` if available) and confirm the playfield keeps its 8:5 proportion with bars on the long axis, rather than stretching. Paste both into the report.

- [ ] **Step 4: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): the letterbox transform and the three coordinate spaces"
```

---

### Task 3: Sky, ground and terrain

**Files:**
- Create: `swift/LifeOfACricket/Sources/Render/Background.swift`
- Create: `swift/LifeOfACricket/Sources/Render/Terrain.swift`

**Reference:** `src/render/background.js` — read it fully before writing.

- [ ] **Step 1: Port the sky**

The sky is drawn in VIEW space so it stays put while the meadow scrolls. Its gradient tracks `darknessAt(game.elapsed)`, so dawn, noon, dusk and midnight all read differently and the day counter, the sky and which predator hunts can never disagree.

- [ ] **Step 2: Port the ground band and water**

Ground fills from `world.top` down. Water is a list of overlapping circles (`world.water`); fill them so they blob together into a stream and ponds, as the JS does.

- [ ] **Step 3: Port cover**

Three types with distinct silhouettes: `grass` (tufts drawn upward from the anchor — which is why world generation gives them sky clearance), `rock`, `leaf`. Match the JS shapes closely enough that a player of the web version recognises them.

- [ ] **Step 4: Port the doorway** at the east end.

- [ ] **Step 5: Screenshot at several times of day**

Force `game.elapsed` to 0, `secondsPerDay * 0.25`, `* 0.5`, `* 0.75` and screenshot each. Paste all four into the report — this is the only way to confirm the day cycle reads correctly.

- [ ] **Step 6: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): sky, ground, water and cover"
```

---

### Task 4: Entities

**Files:**
- Create: `swift/LifeOfACricket/Sources/Render/Entities.swift`

**Reference:** `src/render/entities.js` — read it fully.

- [ ] **Step 1: The cricket**, including its facing (`dirX`/`dirY`), the singing tell, the leap arc (drawn `Config.Cricket.Jump.arcHeight` above its shadow — a render-only value, which is why it lives in `Config` but the simulation ignores it), the strike swing, the stun, and the invulnerability flicker.
- [ ] **Step 2: Birds and bats**, sized by `BirdKind.size`, with distinct silhouettes and a visible dive.
- [ ] **Step 3: Spiders**, with the alertness tell — eyes glowing as `alertness` rises, and a visible wind-up before the lunge. **This is the game's fairness contract made visible: the threat must be readable information, never a surprise.** Get it right.
- [ ] **Step 4: Rivals** (ants and beetles, visibly different), with the hit flash.
- [ ] **Step 5: Food**, one shape per `FoodType`.
- [ ] **Step 6: Screenshot** a running game with entities on screen; paste it in.
- [ ] **Step 7: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): the cricket and everything that shares the meadow with it"
```

---

### Task 5: The house

**Files:**
- Create: `swift/LifeOfACricket/Sources/Render/HouseRender.swift`

**Reference:** `src/render/house.js`

- [ ] **Step 1:** The cross-section backdrop (view space), both floors, the ceiling between them, and the stairwell.
- [ ] **Step 2:** Furniture by `CoverType` (sofa, chair, table, plant, box, bed), spills, and the front door.
- [ ] **Step 3:** The cat, with its state legible — prowling, stalking, pouncing.
- [ ] **Step 4:** The human: the spreading shadow that arrives before the feet, and the footfalls. The shadow is the warning the whole mechanic depends on.
- [ ] **Step 5: Screenshot** the house stage. Walk the cricket in through the doorway rather than forcing the stage, so the transition is exercised too.
- [ ] **Step 6: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): the house and its cast"
```

---

### Task 6: HUD and overlays

**Files:**
- Create: `swift/LifeOfACricket/Sources/Render/Hud.swift`

**Reference:** `src/render/hud.js`

- [ ] **Step 1:** Score, high score, lives, the day counter.
- [ ] **Step 2:** The fed and attention meters. Attention is the player's only warning that predators are coming — make it as legible as the JS does.
- [ ] **Step 3:** The multiplier, and the "the meadow has shifted" caption while `shiftedFor > 0`.
- [ ] **Step 4:** Menu and game-over overlays, including the new-record state. The menu carries the credit — game design by **Anna Teresa Salvestrini** — as the web version's scrolling credits do.
- [ ] **Step 5: Screenshot** menu, mid-run and game-over states. Paste all three.
- [ ] **Step 6: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): the HUD and the menu and game-over overlays"
```

---

### Task 7: Multi-touch input

The one place this plan uses UIKit, and for a specific reason.

**Files:**
- Create: `swift/LifeOfACricket/Sources/TouchInputView.swift`
- Create: `swift/LifeOfACricket/Sources/Render/TouchControlsRender.swift`
- Modify: `swift/LifeOfACricket/Sources/GameView.swift`

**Reference:** `src/touch.js` and `src/render/touchcontrols.js`

**Interfaces:**
- Produces:
  - `final class TouchState: ObservableObject` exposing `intent: Intent`, the floating stick's origin and current point, and which buttons are pressed
  - `struct TouchInputView: UIViewRepresentable`

- [ ] **Step 1: Explain the choice in a comment**

SwiftUI's `DragGesture` does not expose independent concurrent touches with stable identity. `src/touch.js` tracks `Touch.identifier` so that **steering and pressing act independently** — you can run and swing at the same time. That is a stated design property of the game, not an accident, and gesture composition cannot reproduce it reliably. Hence a `UIView` with `isMultipleTouchEnabled = true` and `touchesBegan/Moved/Ended/Cancelled`, tracking `UITouch` identity exactly as the browser tracks `Touch.identifier`.

- [ ] **Step 2: The floating stick**

Any touch beginning in the left `Config.Touch.stickZoneFraction` of the width creates a stick AT THAT POINT — there is nothing to aim for. Movement below `stickDeadZone` reads as standing still, which matters because singing requires standing still. Lifting off stops the cricket dead.

- [ ] **Step 3: The action arc**

Three buttons under the right thumb: sing (held), leap, strike. Sizes from `Config.Touch`, scaling with the screen's short side.

- [ ] **Step 4: Draw the controls in the letterbox**

Screen space, in the bars around the playfield, so they never cover any of the meadow — as the web version does.

- [ ] **Step 5: Merge intents**

`GameView` ORs the touch intent into whatever it passes to `runner.advance`. Holding two sources simply means the action is held.

- [ ] **Step 6: Prove multi-touch works**

This cannot be verified by screenshot. Use `xcrun simctl` or an XCUITest to deliver two simultaneous touches — one dragging in the stick zone, one on the strike button — and assert the resulting `Intent` has BOTH a non-zero `dx` and `strike == true`. If simultaneous synthetic touches prove impractical, write a unit test against `TouchState` driving its touch-began/moved/ended handlers directly with two synthetic touch identities. **Do not skip this** — independent steering and pressing is the property this whole task exists to preserve, and a single-touch test cannot detect its loss.

- [ ] **Step 7: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): real multi-touch controls"
```

---

### Task 8: Playable pass and device handoff

**Files:**
- Modify: whatever the play-through reveals
- Create: `swift/README.md`

- [ ] **Step 1: Play a full run in the simulator.** Start from the menu, eat, sing, get hunted, leap to cover, fight a beetle, go indoors, meet the cat, die, restart. Screenshot each milestone.
- [ ] **Step 2: Fix what the play-through reveals.** Rendering-layer only — report any core change prominently.
- [ ] **Step 3: Confirm the core suite is still green** (107 tests) and that the app builds clean.
- [ ] **Step 4: Write `swift/README.md`** — what the package is, both commands with `DEVELOPER_DIR`, the frozen-core rule, how to regenerate fixtures, how to run on a device (free Apple ID signing, Developer Mode, the 7-day expiry), and a pointer to the spec.
- [ ] **Step 5: Commit**

```bash
git add swift
git commit -m "feat(swift): a playable pass, and how to run it"
```

---

## Definition of done

- The game is playable in the simulator: menu → run → death → restart, in both meadow and house.
- Steering and pressing work simultaneously, proven by a test.
- Controls sit in the letterbox and never cover the playfield.
- `swift/CricketCore` is unchanged, and its 107 tests still pass.
- Nothing in `Render/` mutates simulation state.
- Screenshots in the reports show each stage actually rendering.
