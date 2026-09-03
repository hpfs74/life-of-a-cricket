# Life of a Cricket — Swift Port Design

**Date:** 2026-08-15
**Status:** Approved
**Original:** `docs/superpowers/specs/2026-08-15-life-of-a-cricket-design.md`

## Overview

A native iOS and iPadOS port of *Life of a Cricket*, living in `swift/` inside
this repository. The port reaches full feature parity with the browser game —
both stages, every predator, the day cycle, touch controls and synthesized
audio — and adds one thing the browser version cannot do: an experimental mode
that drives the cricket's three actions from the player's face.

The browser game already separates pure simulation from presentation, and the
seam between them is an event stream. That separation is what makes this port
tractable, and preserving it is the design's first obligation.

## Goals

- Full parity with the JS game's simulation, verifiable rather than asserted.
- Native touch controls with genuine multi-touch, matching the browser game's
  stated property that steering and pressing act independently.
- An experimental face-control mode: bite to attack, wink to leap, scrunch the
  nose to sing.
- A test suite that runs in seconds on the command line, without a simulator.

## Non-goals

- Replacing or modifying the JS game. `swift/` is additive; the deploy workflow
  uploads an explicit file list and cannot pick it up.
- Sharing code between the two implementations. They share a *design* and a
  seeded RNG algorithm, nothing more.
- A macOS, tvOS or Android *app*. `CricketCore` declares a macOS platform so its
  tests can run natively on the command line, but no macOS app target is built.
- Game Center, persistence beyond the high score, or any networking.

## Architecture

Three layers, matching the browser game's separation exactly:

1. **`CricketCore`** — a SwiftPM package holding the entire simulation. Imports
   nothing but the standard library: no SwiftUI, no UIKit, no CoreGraphics, no
   ARKit. This is the analogue of `src/*.js`.
2. **App presentation** — SwiftUI `Canvas` renderers, touch input, face input
   and audio. Reads simulation state; never mutates it. The analogue of
   `src/render/`, `src/touch.js` and `src/audio.js`.
3. **App wiring** — `GameRunner` and `GameView`, owning the frame loop and
   routing events to audio. The analogue of `src/main.js`.

The package boundary is a compiler-enforced version of a discipline the JS
project maintains by convention. `CricketCore` cannot reach for a platform
framework even by accident, which is what keeps its tests fast and its logic
portable.

### Project layout

```
swift/
├── CricketCore/
│   ├── Package.swift
│   ├── Sources/CricketCore/
│   │   ├── Config.swift              # all tunable numbers
│   │   ├── Random.swift              # seeded PRNG
│   │   ├── Geometry.swift            # Point, and the vector helpers
│   │   ├── Intent.swift              # the neutral input struct
│   │   ├── GameEvent.swift           # the event enum
│   │   ├── Water.swift
│   │   ├── World.swift
│   │   ├── House.swift
│   │   ├── Daylight.swift
│   │   ├── Camera.swift
│   │   ├── Cricket.swift
│   │   ├── Food.swift
│   │   ├── Score.swift
│   │   ├── Attention.swift
│   │   ├── Rivals.swift
│   │   ├── Spiders.swift
│   │   ├── Birds.swift
│   │   ├── Cat.swift
│   │   ├── Human.swift
│   │   ├── FaceGestures.swift        # pure gesture recognition
│   │   └── Game.swift                # state machine, event stream
│   └── Tests/CricketCoreTests/       # one file per tests/*.test.js
└── LifeOfACricket/
    ├── LifeOfACricket.xcodeproj
    ├── Info.plist
    └── Sources/
        ├── LifeOfACricketApp.swift
        ├── GameRunner.swift
        ├── GameView.swift
        ├── Render/
        │   ├── Background.swift
        │   ├── HouseRender.swift
        │   ├── Entities.swift
        │   ├── Hud.swift
        │   └── TouchControlsRender.swift
        ├── TouchInputView.swift      # UIViewRepresentable, real multi-touch
        ├── FaceInput.swift           # ARSession plumbing only
        └── Audio.swift
```

All game code lives in the package. The `.xcodeproj` is written once during
phase 1 and never edited again — adding Swift files to `CricketCore` requires no
project metadata changes, which removes the usual reason a hand-maintained
`project.pbxproj` decays.

### Toolchain

`xcode-select` on this machine points at CommandLineTools, so Xcode is invoked
through `DEVELOPER_DIR` rather than by changing global state with `sudo`.

```bash
# Simulation tests: seconds, no simulator, no Xcode
cd swift/CricketCore && swift test

# Build the app
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project swift/LifeOfACricket/LifeOfACricket.xcodeproj \
  -scheme LifeOfACricket \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Run and capture
xcrun simctl boot 'iPhone 17 Pro'
xcrun simctl install booted <path/to/LifeOfACricket.app>
xcrun simctl launch booted com.hpfs.LifeOfACricket
xcrun simctl io booted screenshot shot.png
```

Verified available: Xcode 26.6, iOS 26.5 SDK, Swift 6.3.3, iPhone 17 family
simulators. `CricketCore` declares `.iOS(.v17)` and `.macOS(.v14)`; the macOS
platform exists solely so `swift test` runs natively.

Swift 6 language mode throughout. The simulation is value types and therefore
naturally `Sendable`; the app layer is `@MainActor`.

## CricketCore

### State as value types

The JS mutates objects in place (`game.cricket.x = …`, `updateBird(bird, dt,
ctx)`). Swift reproduces those semantics with structs and `mutating func`:

```swift
public struct Game {
    public private(set) var phase: Phase
    public var world: World
    public var cricket: Cricket
    public var birds: [Bird]
    // …
    public mutating func update(intent: Intent, dt: Double) -> [GameEvent]
}
```

Arrays of birds, spiders and rivals mutate through their indices. Value
semantics make tests isolated by construction: there is no shared state to reset
between cases, and a test can snapshot a `Game` simply by assigning it.

`Game.update` returns the events that occurred. It never draws and never plays
audio, exactly as `updateGame` does not.

### Events as an enum

```swift
public enum GameEvent: Equatable {
    case songStart, songBreak
    case jump, land
    case ate(Food)
    case hit(from: Threat)
    case birdSpawn(kind: BirdKind)
    // …
}
```

This is a deliberate improvement on the JS string-tagged objects: the audio
layer's `switch` becomes exhaustive, so adding an event without giving it a
sound fails the build rather than falling silently through a `default`.

### Deterministic randomness

`SystemRandomNumberGenerator` cannot be seeded, so determinism is designed in
rather than borrowed:

```swift
public protocol RandomSource: AnyObject {
    func next() -> Double          // [0, 1)
}

public final class SeededRandom: RandomSource {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }
    public func next() -> Double {
        state = (state &* 1664525 &+ 1013904223) % 4294967296
        return Double(state) / 4294967296
    }
}
```

A class, not a struct, so it threads through world generation without `inout`
noise at every call site — matching the reference semantics of the JS closure.
The LCG is byte-for-byte the one `tests/world.test.js` already uses, which makes
cross-language comparison possible (see Testing).

### Configuration

`CONFIG` becomes nested caseless enums:

```swift
public enum Config {
    public enum World {
        public static let width = 2880.0
        public static let horizonFraction = 0.28
        // …
    }
}
```

Namespaced, zero-cost, non-instantiable. As in the JS original, no logic module
carries a numeric literal.

### The shared stage shape

`World` models both the meadow and the house, as the JS does: `bands` of
walkable ground, `cover`, `water`, a `door`, and optional `stairs`. A meadow is
a house with one band and no stairs. Every consumer — cricket, food, rivals,
spiders, camera — works in both without branching. Only the cast is
stage-specific: birds and bats are gated on the meadow; `cat` and `humans` are
`nil` outdoors.

## App layer

### Frame loop

`TimelineView(.animation)` supplies a date at display rate. The view body calls
`runner.advance(to:)`, which derives `dt`, clamps it to
`Config.Game.maxFrameDelta` and steps the simulation, then passes state to
`Canvas`. A stored `lastDate` guards against SwiftUI evaluating the body more
than once for a single date and double-stepping the world.

`GameRunner` is a `@MainActor final class` owning `var game: Game`. A reference
type at this boundary avoids per-frame struct copies through SwiftUI state, and
keeps `Game` itself a pure value type inside the package.

### Coordinate spaces

`GraphicsContext.drawLayer` is the analogue of `ctx.save()`/`ctx.restore()`, and
`translateBy`/`scaleBy`/`clip` map one-to-one. The browser's three-space
sandwich is preserved:

| Space | Contents | Mechanism |
|---|---|---|
| Letterbox | everything in the 960×600 view | outer `drawLayer`: translate by offset, scale, clip to view |
| World | ground, house interior, entities | nested `drawLayer`: translate by `-round(camera.x)` |
| Screen | touch controls | outside both layers |

The simulation always runs in `Config.World` units; the letterbox transform maps
that fixed world onto whatever the device provides. The world is 2880 wide —
three views — and the camera scrolls horizontally.

Because the game ships no image assets, every renderer is arithmetic, paths and
fills. There is nothing to convert.

### Touch input

SwiftUI's `DragGesture` does not expose independent concurrent touches with
stable identity, and the browser game's floating stick and action arc rely on
exactly that: `touch.js` tracks `Touch.identifier` so steering and pressing act
independently. Gesture composition cannot reproduce this reliably.

`TouchInputView` is therefore a `UIViewRepresentable` wrapping a `UIView` with
`isMultipleTouchEnabled = true`, overriding
`touchesBegan/Moved/Ended/Cancelled` and tracking `UITouch` identity — the same
model as the browser, expressed in UIKit. It emits an `Intent`, so the core
never learns that touches exist.

Controls are drawn in the letterbox around the playfield, as in the browser, so
they never cover the meadow.

### Orientation

Landscape is enforced in `Info.plist`. The browser game's "please rotate your
phone" prompt is a workaround for a limitation iOS does not have, and is
therefore not ported.

### Audio

`AVAudioEngine` with an `AVAudioSourceNode` render block, implementing the same
primitives the WebAudio version uses: oscillator shapes, gain envelopes, noise
and filtering. Each `case` in `src/audio.js` becomes a Swift function of the
same shape, dispatched from an exhaustive `switch` over `GameEvent`. The
sustained song voice is a persistent node whose pitch and gain track the score
multiplier.

An `AVAudioSession` in the `.ambient` category is activated at launch. iOS
requires no equivalent of the browser's `audio.unlock()` gesture dance, so that
workaround is dropped.

## Face control

An experimental mode, toggleable at runtime, in which the cricket's three
actions are driven by the player's face. Movement remains on the thumb stick.

### Structure

`FaceGestureRecognizer` is a pure struct in `CricketCore`. It imports no ARKit
and knows nothing of cameras: it takes plain `Double` blendshape coefficients
plus `dt` and returns intent flags. Only the `ARSession` plumbing that feeds it
lives in the app, in `FaceInput.swift`.

This split is what makes an otherwise untestable subsystem testable. Recognition
logic is unit tested against synthetic coefficient traces; the ARKit wiring is
thin enough to inspect by eye. When a gesture misfires on a device, the failure
is attributable to one side of the boundary or the other rather than to the
opaque whole.

`FaceInput` produces the same `Intent` as touch and is merged by the same OR
that already merges keyboard and touch in the browser. `CricketCore`'s
simulation is unchanged by the feature's existence.

### Bindings

| Action | Blendshapes | Kind |
|---|---|---|
| Sing | `noseSneerLeft` / `noseSneerRight` above threshold, sustained | held, matching `E` |
| Attack | `jawOpen` rising edge | edge + cooldown, matching `F` |
| Jump | `eyeBlinkLeft` high **while** `eyeBlinkRight` low | edge + cooldown, matching `SPACE` |

Jump is bound to a **wink, not a blink**, deliberately. People blink 15–20 times
a minute involuntarily; because leaping cancels a song, a blink-triggered jump
would break the core scoring loop rather than merely annoy. Testing for
*asymmetry* between the two eyes is immune to ordinary blinking, and leaves one
eye on the screen — which matters, since leaping is the answer to a predator's
dive and the player needs to watch it.

ARKit exposes no "nose move" coefficient; `noseSneerLeft`/`Right` describe a
scrunch. It suits a held action well: easy to sustain, hard to trigger by
accident.

### Robustness

- **Hysteresis** on every threshold — a higher value to trigger than to release
  — so a coefficient hovering near the line cannot chatter the input.
- **Calibration**: face mode opens with a ~1.5s neutral-expression capture, and
  thresholds apply to the delta from that baseline. Resting coefficients differ
  substantially between faces; without this, thresholds tuned on one face
  misbehave on another.
- **Cooldowns** mirror the simulation's existing jump and strike cooldowns, so
  the face cannot outpace what the game already permits.
- Blendshape coefficients are facial rather than spatial, so they are unaffected
  by device orientation. This is a robustness argument for staying on
  blendshapes and not adding head-pose steering.

### Constraints

- `ARFaceTrackingConfiguration` does not run in the Simulator. This mode can
  only be judged on hardware, and is the single handoff in the plan.
- Availability is gated at runtime on `ARFaceTrackingConfiguration.isSupported`;
  the toggle is hidden where unsupported.
- Face tracking runs the camera and Neural Engine continuously, a real battery
  and thermal cost. The toggle means it is paid only when in use.

### Privacy

`NSCameraUsageDescription` is required and will state the purpose plainly. Face
geometry stays on device, nothing is recorded or persisted, no frame is written
to disk, and the camera is inactive unless face mode is enabled.

## Testing

`swift-testing` (`@Test`, `#expect`), bundled with the Swift 6.3 toolchain. One
test file per existing `tests/*.test.js`. The JS suite is the specification:
assertions port across, including the invariants — cover separation, nothing
spawning in water, the daily reshuffle never burying the cricket.

The `fixedRng = () => 0.5` degeneracy documented in `tests/game.test.js` (it
yields a meadow with no cover) carries over as an explicit comment, so it is not
rediscovered the hard way.

### Cross-language golden check

World, house and water generation are pure functions of the seeded RNG, and both
implementations now run an identical LCG. A small Node script dumps
`createWorld(seededRng(7))` as JSON into
`swift/CricketCore/Tests/CricketCoreTests/Fixtures/`, and a Swift test asserts
`World(rng: SeededRandom(seed: 7))` matches field for field.

This catches the porting errors most likely to go unnoticed — an inverted
comparison, a reordered rejection-sampling guard — which would otherwise surface
only as Swift meadows feeling subtly different from JS ones. Scope is limited to
the pure-data generators, where the comparison is exact and cheap.

### What is not tested

The render layer, as in the JS project. It is verified by building to the
simulator and screenshotting. Face tracking's ARKit plumbing is likewise
unverifiable locally; the recognition logic behind it is fully tested.

## Phasing

Ordered so the riskiest unknown fails first.

1. **Scaffold** — package, `.xcodeproj`, a black screen that builds and launches
   in the simulator. No game code. Proves the toolchain end to end before any
   porting effort is at stake.
2. **Geometry** — `Config`, `SeededRandom`, `Water`, `World`, `House`,
   `Daylight`, `Camera`, with tests and the golden check.
3. **Actors** — `Cricket`, `Food`, `Score`, `Attention`, `Rivals`, `Spiders`,
   `Birds`, `Cat`, `Human`, with tests.
4. **Game** — state machine, event stream, stage changes, daily reshuffle. At
   this point `swift test` covers the whole simulation and parity is
   demonstrable with nothing yet drawn.
5. **Render** — first visuals.
6. **Touch** — first playable build.
7. **Face control** — recognizer plus tests, then ARKit wiring; handed over for
   device testing.
8. **Audio.**

Phases 1–6 are verifiable end to end in the simulator.

## Risks

| Risk | Mitigation |
|---|---|
| Hand-written `project.pbxproj` is fiddly | Phase 1 exists to fail fast: if it will not build, nothing is invested. All code lives in the package, so it needs no later edits. |
| SwiftUI `Canvas` may not hold 60fps with a full meadow | Measured at phase 5 with real content. If it disappoints, only the render layer is replaced (Metal or SpriteKit) — the package boundary guarantees the simulation is unaffected. |
| Face gestures may feel wrong on a real face | Recognition logic is pure and tested; thresholds are data, tunable without structural change. Device testing is scheduled as an explicit handoff rather than discovered late. |
| Port drift in world generation | The cross-language golden check. |

## Deliberate divergences from the browser game

| Browser | Swift | Why |
|---|---|---|
| Rotate prompt in portrait | Landscape locked in `Info.plist` | iOS solves declaratively what the browser could not |
| `audio.unlock()` on first gesture | `AVAudioSession` activated at launch | No autoplay policy to work around |
| String-tagged event objects | `GameEvent` enum | Exhaustiveness checking |
| Keyboard + touch input | Touch + face input | No keyboard on the target platform |
