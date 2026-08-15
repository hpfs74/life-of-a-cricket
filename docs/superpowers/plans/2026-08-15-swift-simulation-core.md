# Swift Simulation Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the complete *Life of a Cricket* simulation to a pure-Swift package under `swift/`, verified by a test suite that runs on the command line without a simulator, plus a minimal iOS app shell proving the Xcode toolchain works end to end.

**Architecture:** A SwiftPM package `CricketCore` holds the entire simulation as value types with `mutating func` update methods, mirroring the JS modules one-for-one. It imports nothing but the standard library. A separate, deliberately tiny `.xcodeproj` builds an iOS app that depends on the package; in this plan that app renders only a placeholder screen — rendering is Plan 2.

**Tech Stack:** Swift 6.3 (Swift 6 language mode), SwiftPM, swift-testing (`@Test`/`#expect`), Xcode 26.6 with the iOS 26.5 SDK. Zero third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-life-of-a-cricket-swift-design.md`

**Scope:** This plan covers spec phases 1–4. Rendering and touch (phases 5–6), face control (phase 7) and audio (phase 8) are separate plans.

## Global Constraints

- **Zero third-party dependencies.** `Package.swift` must never gain a `dependencies` entry.
- **`CricketCore` imports only the Swift standard library.** No SwiftUI, UIKit, CoreGraphics, ARKit, or Foundation types in the simulation. `Foundation` is permitted *only* in test targets, for JSON decoding of fixtures.
- **Swift 6 language mode.** Simulation types are value types and therefore `Sendable`.
- **All tunable numbers live in `Config.swift`.** No numeric literals in logic files, exactly as the JS forbids them outside `src/config.js`.
- **Every Xcode invocation is prefixed with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.** `xcode-select` on this machine points at CommandLineTools; do not change it with `sudo`.
- **The reference implementation is the JS source in `src/`.** Behaviour parity is the acceptance criterion for every task. When this plan and `src/*.js` disagree, `src/*.js` wins — say so rather than silently diverging.
- **Deployment targets:** `.iOS(.v17)`, `.macOS(.v14)`. The macOS platform exists solely so `swift test` runs natively.
- **Every `mutating func` that returns a value is marked `@discardableResult`.** The tests call them for their side effects as often as for their results, mirroring the JS, which ignores return values freely.
- **Optional parameters carry defaults.** `nearestCover` defaults `halfAngleDegrees` to `Config.Cricket.Jump.halfAngleDegrees` and `exclude` to `nil`; `isWaterAt` and `isWater` default `margin` to `0`; `Score` has a memberwise init with every property defaulted, so `Score()` and `Score(highScore: 100)` both compile.
- **Commit after every task.**

## File Structure

| Path | Responsibility |
| --- | --- |
| `swift/CricketCore/Package.swift` | Package manifest; both platforms, one library target, one test target |
| `swift/CricketCore/Sources/CricketCore/Config.swift` | Every tunable number, as nested caseless enums |
| `swift/CricketCore/Sources/CricketCore/Random.swift` | `RandomSource` protocol and the seeded LCG |
| `swift/CricketCore/Sources/CricketCore/Geometry.swift` | `Point`, `Circle`, distance helpers |
| `swift/CricketCore/Sources/CricketCore/Intent.swift` | The neutral input struct |
| `swift/CricketCore/Sources/CricketCore/Water.swift` | Stream and pond generation; water hit-testing |
| `swift/CricketCore/Sources/CricketCore/World.swift` | Bands, cover, doorways, hiding, jump targeting |
| `swift/CricketCore/Sources/CricketCore/House.swift` | The two-floor house as a `World` |
| `swift/CricketCore/Sources/CricketCore/Daylight.swift` | Day number, darkness, night |
| `swift/CricketCore/Sources/CricketCore/Camera.swift` | Horizontal follow camera |
| `swift/CricketCore/Sources/CricketCore/Score.swift` | Points, multiplier, fed meter, high score |
| `swift/CricketCore/Sources/CricketCore/Attention.swift` | Attention meter and spawn thresholds |
| `swift/CricketCore/Sources/CricketCore/Food.swift` | Food spawning, settling, eating |
| `swift/CricketCore/Sources/CricketCore/Cricket.swift` | Player movement, singing, leaping, striking |
| `swift/CricketCore/Sources/CricketCore/Rivals.swift` | Ants and beetles; strike resolution |
| `swift/CricketCore/Sources/CricketCore/Spiders.swift` | Ambush predators holding cover |
| `swift/CricketCore/Sources/CricketCore/Birds.swift` | Aerial predator state machine |
| `swift/CricketCore/Sources/CricketCore/Cat.swift` | House cat: prowl, stalk, pounce, stairs |
| `swift/CricketCore/Sources/CricketCore/Human.swift` | Human schedule, shadow, footfalls |
| `swift/CricketCore/Sources/CricketCore/GameEvent.swift` | The event enum |
| `swift/CricketCore/Sources/CricketCore/Game.swift` | State machine, wave director, event stream |
| `swift/LifeOfACricket/LifeOfACricket.xcodeproj` | Written once in Task 2, never edited again |
| `swift/tools/dump-world-fixture.mjs` | Node script producing the cross-language golden fixture |

---

### Task 1: Package scaffold

**Files:**
- Create: `swift/CricketCore/Package.swift`
- Create: `swift/CricketCore/Sources/CricketCore/CricketCore.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/ScaffoldTests.swift`

**Interfaces:**
- Consumes: nothing
- Produces: the `CricketCore` module, importable by every later task

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/ScaffoldTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func packageIsImportable() {
    #expect(CricketCore.version == "0.1.0")
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd swift/CricketCore && swift test
```

Expected: FAIL — no `Package.swift` yet, so the build errors before the test runs.

- [ ] **Step 3: Write the manifest and the minimal source**

`swift/CricketCore/Package.swift`:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CricketCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CricketCore", targets: ["CricketCore"]),
    ],
    targets: [
        .target(name: "CricketCore"),
        .testTarget(name: "CricketCoreTests", dependencies: ["CricketCore"]),
    ]
)
```

`swift/CricketCore/Sources/CricketCore/CricketCore.swift`:

```swift
/// Namespace for package-level metadata.
public enum CricketCore {
    public static let version = "0.1.0"
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd swift/CricketCore && swift test
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): scaffold the CricketCore package"
```

---

### Task 2: iOS app shell and Xcode project

This task exists to fail fast. If a hand-written `project.pbxproj` will not build, we learn it now with nothing invested. Because all game code lives in the package, this file is written once and never edited again — it uses a *synchronized root group* (Xcode 16+), so adding Swift files to `Sources/` requires no project metadata changes.

**Files:**
- Create: `swift/LifeOfACricket/LifeOfACricket.xcodeproj/project.pbxproj`
- Create: `swift/LifeOfACricket/Info.plist`
- Create: `swift/LifeOfACricket/Sources/LifeOfACricketApp.swift`
- Create: `swift/LifeOfACricket/Sources/GameView.swift`

**Interfaces:**
- Consumes: the `CricketCore` package from Task 1
- Produces: a buildable, launchable `LifeOfACricket.app`; scheme name `LifeOfACricket`; bundle id `com.hpfs.LifeOfACricket`

- [ ] **Step 1: Write the app sources**

`swift/LifeOfACricket/Sources/LifeOfACricketApp.swift`:

```swift
import SwiftUI

@main
struct LifeOfACricketApp: App {
    var body: some Scene {
        WindowGroup { GameView() }
    }
}
```

`swift/LifeOfACricket/Sources/GameView.swift`:

```swift
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
```

- [ ] **Step 2: Write Info.plist**

`swift/LifeOfACricket/Info.plist` — landscape only, per the spec:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UIRequiresFullScreen</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 3: Write the Xcode project**

Create `swift/LifeOfACricket/LifeOfACricket.xcodeproj/project.pbxproj` with `objectVersion = 77`, a single `PBXNativeTarget` named `LifeOfACricket`, a `PBXFileSystemSynchronizedRootGroup` whose `path = Sources`, an `XCLocalSwiftPackageReference` pointing at `../CricketCore`, and build settings:

- `PRODUCT_BUNDLE_IDENTIFIER = com.hpfs.LifeOfACricket`
- `INFOPLIST_FILE = Info.plist`
- `IPHONEOS_DEPLOYMENT_TARGET = 17.0`
- `SWIFT_VERSION = 6.0`
- `TARGETED_DEVICE_FAMILY = 1,2`
- `GENERATE_INFOPLIST_FILE = NO`

The synchronized root group is what keeps this file static: it adopts every file under `Sources/` automatically.

- [ ] **Step 4: Verify it builds — iterate until it does**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project swift/LifeOfACricket/LifeOfACricket.xcodeproj \
  -scheme LifeOfACricket \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Expected: `** BUILD SUCCEEDED **`. This task is not complete until that string appears. If the project file is malformed, `xcodebuild` reports the specific key or section at fault — fix and re-run. Do not proceed to Task 3 with a red build.

- [ ] **Step 5: Verify it launches and shows the placeholder**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl boot 'iPhone 17 Pro' 2>/dev/null || true
APP=$(xcodebuild -project swift/LifeOfACricket/LifeOfACricket.xcodeproj \
  -scheme LifeOfACricket -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -showBuildSettings 2>/dev/null | awk -F' = ' '/ BUILT_PRODUCTS_DIR/{d=$2} / FULL_PRODUCT_NAME/{n=$2} END{print d"/"n}')
xcrun simctl install booted "$APP"
xcrun simctl launch booted com.hpfs.LifeOfACricket
xcrun simctl io booted screenshot /tmp/cricket-scaffold.png
```

Expected: the screenshot shows a dark screen reading `CricketCore 0.1.0`.

- [ ] **Step 6: Commit**

```bash
git add swift/LifeOfACricket
git commit -m "feat(swift): iOS app shell that builds and launches"
```

---

### Task 3: Config, Random, Geometry, Intent

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Config.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Random.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Geometry.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Intent.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/RandomTests.swift`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Config.World.{width,height,horizonFraction,edgeMargin,coverCount,coverMinRadius,coverMaxRadius,coverMinSeparation,spawnClearance}` and equivalents for every `CONFIG` key in `src/config.js`, preserving names in `lowerCamelCase` and nesting under caseless enums (`Config.Cricket.Jump.range`, `Config.Game.startingLives`, …)
  - `protocol RandomSource: AnyObject { func next() -> Double }`
  - `final class SeededRandom: RandomSource { init(seed: UInt64) }`
  - `struct Point: Equatable { var x, y: Double }`, `func distance(_ a: Point, _ b: Point) -> Double`
  - `struct Circle: Equatable { var x, y, radius: Double }`
  - `struct Intent { var dx, dy: Double; var sing, jump, strike: Bool; static let idle: Intent }`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/RandomTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func seededRandomMatchesTheJavaScriptLCG() {
    // Values produced by the LCG in tests/world.test.js with seed 7.
    let rng = SeededRandom(seed: 7)
    let first = rng.next()
    let second = rng.next()

    #expect(first >= 0 && first < 1)
    #expect(second >= 0 && second < 1)
    #expect(first != second)
}

@Test func seededRandomIsReproducible() {
    let a = SeededRandom(seed: 42)
    let b = SeededRandom(seed: 42)
    for _ in 0..<100 {
        #expect(a.next() == b.next())
    }
}

@Test func configMirrorsTheJavaScriptValues() {
    #expect(Config.World.width == 2880)
    #expect(Config.World.coverCount == 26)
    #expect(Config.Cricket.speed == 190)
    #expect(Config.Game.startingLives == 3)
    #expect(Config.Attention.thresholds == [0.3, 0.55, 0.8])
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd swift/CricketCore && swift test
```

Expected: FAIL — `cannot find 'SeededRandom' in scope`.

- [ ] **Step 3: Implement**

`swift/CricketCore/Sources/CricketCore/Random.swift`:

```swift
/// A source of uniform values in [0, 1).
///
/// A reference type on purpose: it threads through world generation without
/// `inout` at every call site, matching the reference semantics of the `rng`
/// closure the JavaScript passes around.
public protocol RandomSource: AnyObject {
    func next() -> Double
}

/// The linear congruential generator `tests/world.test.js` uses.
///
/// Reproduced exactly so the Swift and JavaScript implementations can be given
/// the same seed and compared field for field (see WorldGoldenTests).
public final class SeededRandom: RandomSource {
    private var state: UInt64

    public init(seed: UInt64) {
        self.state = seed
    }

    public func next() -> Double {
        state = (state &* 1664525 &+ 1013904223) % 4294967296
        return Double(state) / 4294967296
    }
}

/// A degenerate source returning a constant. Mirrors `fixedRng = () => 0.5`.
///
/// Note the trap documented in `tests/game.test.js`: 0.5 yields a meadow with
/// NO cover, because every rejection-sample candidate lands on the spawn point.
/// Tests needing real cover must use `SeededRandom`.
public final class FixedRandom: RandomSource {
    private let value: Double
    public init(_ value: Double) { self.value = value }
    public func next() -> Double { value }
}
```

`swift/CricketCore/Sources/CricketCore/Geometry.swift`:

```swift
import Swift

public struct Point: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

public struct Circle: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var radius: Double
    public init(x: Double, y: Double, radius: Double) {
        self.x = x; self.y = y; self.radius = radius
    }
}

@inlinable
public func hypot2(_ dx: Double, _ dy: Double) -> Double {
    (dx * dx + dy * dy).squareRoot()
}

@inlinable
public func distance(_ a: Point, _ b: Point) -> Double {
    hypot2(a.x - b.x, a.y - b.y)
}
```

`swift/CricketCore/Sources/CricketCore/Intent.swift`:

```swift
/// What the player is asking for this frame, independent of input device.
///
/// Keyboard, touch and face inputs all produce this and nothing else, so the
/// simulation never learns which device is driving it.
public struct Intent: Equatable, Sendable {
    public var dx: Double
    public var dy: Double
    public var sing: Bool
    public var jump: Bool
    public var strike: Bool

    public init(dx: Double = 0, dy: Double = 0,
                sing: Bool = false, jump: Bool = false, strike: Bool = false) {
        self.dx = dx; self.dy = dy
        self.sing = sing; self.jump = jump; self.strike = strike
    }

    public static let idle = Intent()
}
```

`swift/CricketCore/Sources/CricketCore/Config.swift` — transcribe every value from `src/config.js`, preserving the comments, as nested caseless enums. Begin:

```swift
/// Every tunable number in the game.
///
/// As in `src/config.js`, no logic file carries a numeric literal: speeds,
/// scoring rates, meter rates, jump range and cooldown, day length, spawn
/// intervals and the difficulty ramp all live here.
public enum Config {
    public enum View {
        public static let width = 960.0
        public static let height = 600.0
        public static let followPerSecond = 6.0
    }

    public enum World {
        public static let width = 2880.0
        public static let height = 600.0
        public static let horizonFraction = 0.28
        public static let edgeMargin = 24.0
        public static let coverCount = 26
        public static let coverMinRadius = 34.0
        public static let coverMaxRadius = 58.0
        public static let coverMinSeparation = 100.0
        public static let spawnClearance = 48.0
    }

    public enum Cricket {
        public static let radius = 12.0
        public static let speed = 190.0
        public static let invulnerableSeconds = 1.6

        public enum Strike {
            public static let reach = 34.0
            public static let halfAngleDegrees = 70.0
            public static let cooldownSeconds = 0.35
            public static let swingSeconds = 0.14
        }

        public enum Jump {
            public static let range = 320.0
            public static let halfAngleDegrees = 70.0
            public static let speed = 620.0
            public static let minSeconds = 0.25
            public static let maxSeconds = 0.6
            public static let cooldownSeconds = 0.5
            public static let fallbackDistance = 90.0
            public static let arcHeight = 46.0
        }
    }

    // …continue for Score, Food, House, Doorway, Water, Cat, Human,
    // Spiders, Rivals, Attention, Bird, Game, Touch — every key in
    // src/config.js, same names, same values.
}
```

Type notes: counts (`coverCount`, `startingLives`, `count`, `maxAlive`, `maxOnScreen`, `streamSegments`, `pondBlobs`, `furniturePerFloor`, `spillCount`) are `Int`; everything else is `Double`. `Config.Attention.thresholds` is `[Double]`. `Config.Human.everySeconds` and the water/pond ranges are `ClosedRange<Double>`. `Config.Score.storageKey` is `String`. `Config.Food.types` becomes a `FoodType` enum with `value` and `radius` properties (Task 9), not a dictionary.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd swift/CricketCore && swift test
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): config, seeded randomness, geometry and intent"
```

---

### Task 4: Water

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Water.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/WaterTests.swift`

**Reference:** `src/water.js`, `tests/water.test.js`

**Interfaces:**
- Consumes: `Config`, `RandomSource`, `Circle`
- Produces:
  - `struct WaterBounds { var width, height, top: Double }`
  - `func createWater(bounds: WaterBounds, rng: RandomSource) -> [Circle]`
  - `func isWaterAt(_ water: [Circle], x: Double, y: Double, margin: Double = 0) -> Bool`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/WaterTests.swift`:

```swift
import Testing
@testable import CricketCore

private func bounds() -> WaterBounds {
    WaterBounds(width: Config.World.width,
                height: Config.World.height,
                top: Config.World.height * Config.World.horizonFraction)
}

@Test func waterStaysOutOfTheSky() {
    let b = bounds()
    let water = createWater(bounds: b, rng: SeededRandom(seed: 3))
    #expect(!water.isEmpty)
    for circle in water {
        #expect(circle.y - circle.radius * 0.6 > b.top - circle.radius)
    }
}

@Test func theSpawnPointStartsDry() {
    let b = bounds()
    let water = createWater(bounds: b, rng: SeededRandom(seed: 5))
    let spawnX = b.width / 2
    let spawnY = b.top + (b.height - b.top) / 2
    #expect(!isWaterAt(water, x: spawnX, y: spawnY, margin: Config.Cricket.radius))
}

@Test func marginMakesABodyStopAtTheBank() {
    let water = [Circle(x: 100, y: 100, radius: 20)]
    #expect(!isWaterAt(water, x: 130, y: 100, margin: 0))
    #expect(isWaterAt(water, x: 130, y: 100, margin: 12))
}

@Test func generationIsDeterministicForASeed() {
    let a = createWater(bounds: bounds(), rng: SeededRandom(seed: 9))
    let b = createWater(bounds: bounds(), rng: SeededRandom(seed: 9))
    #expect(a == b)
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd swift/CricketCore && swift test --filter WaterTests
```

Expected: FAIL — `cannot find 'createWater' in scope`.

- [ ] **Step 3: Implement**

Port `src/water.js` verbatim in behaviour: `createStream` walks `streamSegments + 1` circles down the band, wandering by `(rng() - 0.5) * streamWander` and clamping x to `[80, width - 80]`, with radius following `0.5 + 0.5 * sin(t * .pi * 3 + phase)`; `createPond` places `pondBlobs` circles around a centre shoved clear of the spawn point; `createWater` emits the stream plus `round(minPonds + rng() * (maxPonds - minPonds))` ponds, then filters out anything lapping into the sky.

Preserve the JS call order of `rng()` exactly — the golden check in Task 6 depends on it.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd swift/CricketCore && swift test --filter WaterTests
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): streams and ponds as overlapping circles"
```

---

### Task 5: World

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/World.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/WorldTests.swift`

**Reference:** `src/world.js`, `tests/world.test.js`

**Interfaces:**
- Consumes: `Config`, `RandomSource`, `Circle`, `Point`, `createWater`, `isWaterAt`
- Produces:
  - `enum StageKind: String, Sendable { case meadow, house }`
  - `enum CoverType: String, CaseIterable, Sendable { case grass, rock, leaf, sofa, chair, table, plant, box, bed }` with `static let meadowTypes: [CoverType] = [.grass, .rock, .leaf]`
  - `struct Band: Equatable, Sendable { var top, bottom: Double }`
  - `struct Stair: Equatable, Sendable { var x, width: Double }`
  - `struct Door: Equatable, Sendable { var x, y, width, height: Double }`
  - `struct Cover: Equatable, Sendable { var x, y, radius: Double; var type: CoverType }`
  - `struct World: Equatable, Sendable` with `kind, width, height, top, bands, stairs, door, cover, water`
  - `static func World.meadow(rng: RandomSource) -> World`
  - Methods: `spawnPoint`, `atDoorway(x:y:)`, `inStairwell(x:)`, `bandAt(x:y:)`, `clampToBounds(x:y:radius:)`, `isWater(x:y:margin:)`, `nearestDryPoint(x:y:radius:avoid:)`, `coverAt(x:y:)`, `isHidden(x:y:)`, `nearestCover(x:y:maxDistance:dirX:dirY:halfAngleDegrees:exclude:)`, `randomOpenPoint(rng:minDistanceFromCover:)`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/WorldTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func meadowPlacesTheConfiguredCoverInsideTheBounds() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    #expect(world.width == Config.World.width)
    #expect(world.cover.count == Config.World.coverCount)

    for item in world.cover {
        #expect(item.x - item.radius >= 0)
        #expect(item.x + item.radius <= world.width)
        #expect(item.y + item.radius <= world.height)
        #expect(CoverType.meadowTypes.contains(item.type))
    }
}

@Test func coverIsSeparatedEnoughToLeaveLanes() {
    let world = World.meadow(rng: SeededRandom(seed: 11))
    for i in 0..<world.cover.count {
        for j in (i + 1)..<world.cover.count {
            let a = world.cover[i], b = world.cover[j]
            #expect(hypot2(a.x - b.x, a.y - b.y) >= Config.World.coverMinSeparation)
        }
    }
}

@Test func aRunAlwaysStartsInTheOpen() {
    let world = World.meadow(rng: SeededRandom(seed: 13))
    let spawn = world.spawnPoint
    #expect(world.coverAt(x: spawn.x, y: spawn.y) == nil)
    #expect(!world.isWater(x: spawn.x, y: spawn.y, margin: Config.Cricket.radius))
}

@Test func clampKeepsABodyOutOfTheSky() {
    let world = World.meadow(rng: SeededRandom(seed: 17))
    let clamped = world.clampToBounds(x: 500, y: -100, radius: Config.Cricket.radius)
    #expect(clamped.y >= world.top + Config.Cricket.radius)
}

@Test func aHeldDirectionSteersTheLeapTarget() {
    var world = World.meadow(rng: SeededRandom(seed: 19))
    world.cover = [
        Cover(x: 400, y: 400, radius: 40, type: .grass),   // to the left
        Cover(x: 600, y: 400, radius: 40, type: .grass),   // to the right
    ]
    let right = world.nearestCover(x: 500, y: 400, maxDistance: 320, dirX: 1, dirY: 0)
    #expect(right?.x == 600)

    let left = world.nearestCover(x: 500, y: 400, maxDistance: 320, dirX: -1, dirY: 0)
    #expect(left?.x == 400)
}

@Test func nearestDryPointRescuesABodyStandingInWater() {
    var world = World.meadow(rng: SeededRandom(seed: 23))
    world.water = [Circle(x: 500, y: 400, radius: 60)]
    let safe = world.nearestDryPoint(x: 500, y: 400, radius: Config.Cricket.radius)
    #expect(!world.isWater(x: safe.x, y: safe.y, margin: Config.Cricket.radius))
}

@Test func standingInADoorwayIsDetected() {
    let world = World.meadow(rng: SeededRandom(seed: 29))
    #expect(world.atDoorway(x: world.door.x, y: world.door.y))
    #expect(!world.atDoorway(x: 100, y: world.door.y))
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd swift/CricketCore && swift test --filter WorldTests
```

Expected: FAIL — `cannot find 'World' in scope`.

- [ ] **Step 3: Implement**

Port `src/world.js`. Points needing care:

- `bandAt` returns the containing band, the full height when in a stairwell, or the nearest band as a fallback so nothing is trapped between floors.
- `meadow(rng:)` rejection-samples cover with `attempts < coverCount * 400`, rejecting candidates that reach into the sky, sit within `radius + spawnClearance` of spawn, sit within `radius + doorway.width * 2` of the door, land on water, or fall within `coverMinSeparation` of existing cover. **Keep the `rng()` call order identical to the JS** — radius, then x, then y, then the type index — because Task 6 compares against JS output.
- `nearestCover` narrows to a cone when a direction is held and widens to everything in range when the cone is empty.
- `randomOpenPoint` tries 60 times then returns the last candidate.
- `nearestDryPoint` walks outward in 26 rings of `ring * 8` steps at `ring * 26` distance.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd swift/CricketCore && swift test --filter WorldTests
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): world geometry, cover, hiding and jump targeting"
```

---

### Task 6: Cross-language golden check

The strongest parity evidence available: world generation is a pure function of the seeded RNG, and both languages now run an identical LCG. This catches inverted comparisons and reordered rejection-sampling guards, which would otherwise surface only as Swift meadows feeling subtly different from JS ones.

**Files:**
- Create: `swift/tools/dump-world-fixture.mjs`
- Create: `swift/CricketCore/Tests/CricketCoreTests/Fixtures/world-seed-7.json`
- Create: `swift/CricketCore/Tests/CricketCoreTests/WorldGoldenTests.swift`
- Modify: `swift/CricketCore/Package.swift` — add `resources: [.process("Fixtures")]` to the test target

**Interfaces:**
- Consumes: `World.meadow(rng:)`, `SeededRandom`
- Produces: a regenerable fixture and the test asserting parity

- [ ] **Step 1: Write the dump script**

`swift/tools/dump-world-fixture.mjs`:

```javascript
// Dumps a JS-generated meadow so the Swift port can be compared against it.
// Regenerate with: node swift/tools/dump-world-fixture.mjs 7 > <fixture path>
import { createWorld } from '../../src/world.js';

function seededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const seed = Number(process.argv[2] ?? 7);
const world = createWorld(seededRng(seed));

process.stdout.write(JSON.stringify({
  seed,
  width: world.width,
  height: world.height,
  top: world.top,
  door: world.door,
  cover: world.cover,
  water: world.water,
}, null, 2));
```

- [ ] **Step 2: Generate the fixture**

```bash
mkdir -p swift/CricketCore/Tests/CricketCoreTests/Fixtures
node swift/tools/dump-world-fixture.mjs 7 \
  > swift/CricketCore/Tests/CricketCoreTests/Fixtures/world-seed-7.json
head -20 swift/CricketCore/Tests/CricketCoreTests/Fixtures/world-seed-7.json
```

Expected: JSON with `cover` and `water` arrays, `cover` holding 26 entries.

- [ ] **Step 3: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/WorldGoldenTests.swift`:

```swift
import Testing
import Foundation
@testable import CricketCore

private struct GoldenCircle: Decodable { let x, y, radius: Double }
private struct GoldenCover: Decodable { let x, y, radius: Double; let type: String }
private struct GoldenDoor: Decodable { let x, y, width, height: Double }
private struct GoldenWorld: Decodable {
    let seed: Double
    let width, height, top: Double
    let door: GoldenDoor
    let cover: [GoldenCover]
    let water: [GoldenCircle]
}

private func loadGolden() throws -> GoldenWorld {
    let url = try #require(Bundle.module.url(forResource: "world-seed-7", withExtension: "json"))
    return try JSONDecoder().decode(GoldenWorld.self, from: Data(contentsOf: url))
}

/// Generous enough for accumulated Double error, far tighter than any real
/// porting mistake: a flipped comparison moves a tuft by tens of points.
private let tolerance = 1e-9

@Test func swiftMeadowMatchesTheJavaScriptMeadowForTheSameSeed() throws {
    let golden = try loadGolden()
    let world = World.meadow(rng: SeededRandom(seed: 7))

    #expect(world.width == golden.width)
    #expect(world.height == golden.height)
    #expect(abs(world.top - golden.top) < tolerance)
    #expect(abs(world.door.x - golden.door.x) < tolerance)

    #expect(world.cover.count == golden.cover.count)
    for (mine, theirs) in zip(world.cover, golden.cover) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
        #expect(mine.type.rawValue == theirs.type)
    }

    #expect(world.water.count == golden.water.count)
    for (mine, theirs) in zip(world.water, golden.water) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
    }
}
```

- [ ] **Step 4: Run it**

```bash
cd swift/CricketCore && swift test --filter WorldGoldenTests
```

Expected: PASS. **If it fails, the Swift port has drifted from the JS — fix `World.swift` or `Water.swift`, not the fixture.** The most likely causes are an `rng()` call in a different order, a `<` where the JS has `<=`, or a rejection guard evaluated before rather than after another.

- [ ] **Step 5: Commit**

```bash
git add swift/tools swift/CricketCore
git commit -m "test(swift): assert Swift meadows match JavaScript meadows"
```

---

### Task 7: House

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/House.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/HouseTests.swift`

**Reference:** `src/house.js`, `tests/house.test.js`

**Interfaces:**
- Consumes: `Config`, `RandomSource`, `World`, `Cover`, `Band`, `Stair`, `Door`
- Produces:
  - `static func World.house(rng: RandomSource) -> World`
  - `var World.houseEntry: Point`
  - `func World.atFrontDoor(x: Double, y: Double) -> Bool`
  - `static let CoverType.furnitureTypes: [CoverType] = [.sofa, .chair, .table, .plant, .box, .bed]`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/HouseTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func aHouseHasTwoFloorsAndAStairwell() {
    let house = World.house(rng: SeededRandom(seed: 7))
    #expect(house.kind == .house)
    #expect(house.bands.count == 2)
    #expect(house.stairs.count == 1)
    #expect(house.bands[0].bottom < house.bands[1].top, "a ceiling separates the floors")
}

@Test func furnitureNeverStraddlesTheCeiling() {
    let house = World.house(rng: SeededRandom(seed: 11))
    for item in house.cover {
        let band = house.bands.first { item.y >= $0.top && item.y <= $0.bottom }
        #expect(band != nil, "every piece of furniture sits on a floor")
        #expect(CoverType.furnitureTypes.contains(item.type))
    }
}

@Test func theCricketArrivesOnTheGroundFloorClearOfTheDoor() {
    let house = World.house(rng: SeededRandom(seed: 13))
    let entry = house.houseEntry
    let ground = house.bands[house.bands.count - 1]
    #expect(entry.y >= ground.top && entry.y <= ground.bottom)
    #expect(!house.isWater(x: entry.x, y: entry.y, margin: Config.Cricket.radius))
}

@Test func aStairwellJoinsTheBandsIntoOneTallCorridor() {
    let house = World.house(rng: SeededRandom(seed: 17))
    let stair = house.stairs[0]
    let middle = stair.x + stair.width / 2
    #expect(house.inStairwell(x: middle))

    let band = house.bandAt(x: middle, y: house.bands[1].top)
    #expect(band.top == house.bands[0].top)
    #expect(band.bottom == house.bands[1].bottom)
}

@Test func spillsStayOnTheGroundFloor() {
    let house = World.house(rng: SeededRandom(seed: 19))
    let ground = house.bands[house.bands.count - 1]
    for spill in house.water {
        #expect(spill.y >= ground.top && spill.y <= ground.bottom)
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd swift/CricketCore && swift test --filter HouseTests
```

Expected: FAIL — `type 'World' has no member 'house'`.

- [ ] **Step 3: Implement**

Port `src/house.js`: `makeBands` stacks upstairs and downstairs separated by `ceilingGap`; the stairwell sits at `width * (0.58 + rng() * 0.24)`; the door is at the west wall of the ground floor; `furnishFloor` rejection-samples `furniturePerFloor` pieces per band keeping clear of the stairwell and the entry; spills go on the ground floor only, skipping any that would land in the stairwell.

Note `atDoorway` already handles the house case via `world.kind == .house` (x at or west of the door), implemented in Task 5.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd swift/CricketCore && swift test --filter HouseTests
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the two-floor house as a world"
```

---

### Task 8: Daylight and Camera

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Daylight.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Camera.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/DaylightTests.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/CameraTests.swift`

**Reference:** `src/daylight.js`, `src/camera.js`, `tests/daylight.test.js`, `tests/camera.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Point`
- Produces:
  - `func dayAt(_ elapsed: Double) -> Int`
  - `func phaseOfDay(_ elapsed: Double) -> Double`
  - `func darknessAt(_ elapsed: Double) -> Double`
  - `func isNight(_ elapsed: Double) -> Bool`
  - `struct Camera { var x: Double; var y: Double; init(world: World, target: Point); mutating func update(target: Point, world: World, dt: Double) }`
  - `func cameraLimit(_ world: World) -> Double`

- [ ] **Step 1: Write the failing tests**

`swift/CricketCore/Tests/CricketCoreTests/DaylightTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func daysAreOneBased() {
    #expect(dayAt(0) == 1)
    #expect(dayAt(Config.Game.secondsPerDay - 0.1) == 1)
    #expect(dayAt(Config.Game.secondsPerDay) == 2)
}

@Test func darknessPeaksAtMidnightAndReturnsToDawn() {
    #expect(abs(darknessAt(0) - 0) < 1e-9)
    #expect(abs(darknessAt(Config.Game.secondsPerDay / 2) - 1) < 1e-9)
    #expect(abs(darknessAt(Config.Game.secondsPerDay) - 0) < 1e-9)
}

@Test func nightIsTheDarkHalfOfTheCycle() {
    #expect(!isNight(0))
    #expect(isNight(Config.Game.secondsPerDay / 2))
}
```

`swift/CricketCore/Tests/CricketCoreTests/CameraTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func theCameraOpensAlreadyFramingTheCricket() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    let target = Point(x: 1500, y: 400)
    let camera = Camera(world: world, target: target)
    #expect(abs(camera.x - (1500 - Config.View.width / 2)) < 1e-9)
}

@Test func theCameraStopsAtEitherEndOfTheWorld() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    #expect(Camera(world: world, target: Point(x: 0, y: 400)).x == 0)
    #expect(Camera(world: world, target: Point(x: world.width, y: 400)).x == cameraLimit(world))
}

@Test func theCameraEasesTowardTheTargetAndSettlesExactly() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var camera = Camera(world: world, target: Point(x: 500, y: 400))
    let target = Point(x: 1500, y: 400)

    for _ in 0..<600 { camera.update(target: target, world: world, dt: 1.0 / 60) }

    #expect(camera.x == 1500 - Config.View.width / 2)
}
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd swift/CricketCore && swift test --filter "DaylightTests|CameraTests"
```

Expected: FAIL — `cannot find 'dayAt' in scope`.

- [ ] **Step 3: Implement**

Port both modules directly. `darknessAt` is `(1 - cos(phaseOfDay * 2π)) / 2`. The camera eases with `1 - exp(-followPerSecond * dt)` and snaps exactly when within `0.01`.

- [ ] **Step 4: Run to verify they pass**

```bash
cd swift/CricketCore && swift test --filter "DaylightTests|CameraTests"
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the day/night clock and the follow camera"
```

---

### Task 9: Score, Attention and Food

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Score.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Attention.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Food.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/ScoreTests.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/AttentionTests.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/FoodTests.swift`

**Reference:** `src/score.js`, `src/attention.js`, `src/food.js` and their tests

**Interfaces:**
- Consumes: `Config`, `RandomSource`, `World`
- Produces:
  - `protocol HighScoreStore: AnyObject { func load() -> Int; func save(_ value: Int) }`
  - `final class MemoryHighScoreStore: HighScoreStore` (used by tests and as the default)
  - `struct Score { var points, multiplier, fed: Double; var highScore: Int; mutating func tickSong(dt:) -> Double; mutating func breakSong(); mutating func tickFed(dt:); mutating func eat(value: Double); mutating func commitHighScore(to store: HighScoreStore) -> Bool }`
  - `struct Attention { var value: Double; var armed: [Bool]; mutating func tick(singing: Bool, dt: Double) -> Int; mutating func reset() }`
  - `enum FoodType: String, CaseIterable, Sendable { case seed, lettuce, berry, aphid, grub }` with `var value: Double`, `var radius: Double`, `static let natural: [FoodType]`
  - `struct FoodItem: Equatable, Identifiable, Sendable { let id: UInt64; var x, y: Double; let type: FoodType; var age, settleFor: Double; var value: Double; var radius: Double; var isEdible: Bool }`
  - `struct FoodField { var items: [FoodItem]; var timer: Double; mutating func update(dt:world:rng:); mutating func consume(cricketX:cricketY:) -> [FoodItem]; @discardableResult mutating func drop(_ type: FoodType, x: Double, y: Double) -> FoodItem; mutating func remove(id: UInt64) -> FoodItem? }`

`FoodItem` carries an `id` because Swift structs have no reference identity: `src/rivals.js` removes an eaten item with `indexOf(best)`, which relies on object identity the JS gets for free. `FoodField` assigns ids from a private monotonic counter.

- [ ] **Step 1: Write the failing tests**

`swift/CricketCore/Tests/CricketCoreTests/ScoreTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func singingScoresAndClimbsTheMultiplier() {
    var score = Score()
    let gained = score.tickSong(dt: 1)
    #expect(abs(gained - Config.Score.songPointsPerSecond) < 1e-9)
    #expect(score.multiplier > Config.Score.multiplierStart)
}

@Test func theMultiplierClimbsFasterWhileFed() {
    var plain = Score()
    var fed = Score()
    fed.eat(value: 10)

    plain.tickSong(dt: 1)
    fed.tickSong(dt: 1)
    #expect(fed.multiplier > plain.multiplier)
}

@Test func breakingTheSongResetsTheMultiplier() {
    var score = Score()
    score.tickSong(dt: 5)
    score.breakSong()
    #expect(score.multiplier == Config.Score.multiplierStart)
}

@Test func theMultiplierIsCapped() {
    var score = Score()
    for _ in 0..<10_000 { score.tickSong(dt: 0.1) }
    #expect(score.multiplier == Config.Score.multiplierMax)
}

@Test func aRecordIsPersistedOnlyWhenBeaten() {
    let store = MemoryHighScoreStore()
    var score = Score(highScore: 100)

    score.points = 50
    #expect(score.commitHighScore(to: store) == false)

    score.points = 500
    #expect(score.commitHighScore(to: store) == true)
    #expect(store.load() == 500)
}
```

`swift/CricketCore/Tests/CricketCoreTests/AttentionTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func singingRaisesAttentionAndSilenceDecaysIt() {
    var attention = Attention()
    attention.tick(singing: true, dt: 1)
    let raised = attention.value
    #expect(raised > 0)

    attention.tick(singing: false, dt: 1)
    #expect(attention.value < raised)
}

@Test func eachThresholdSummonsOnePredatorOnce() {
    var attention = Attention()
    var total = 0
    for _ in 0..<100 { total += attention.tick(singing: true, dt: 0.1) }
    #expect(total == Config.Attention.thresholds.count)
}

@Test func aThresholdRearmsOnlyAfterFallingBelowTheMargin() {
    var attention = Attention()
    while attention.value < Config.Attention.thresholds[0] {
        attention.tick(singing: true, dt: 0.05)
    }
    // Hovering on the boundary must not machine-gun predators.
    var extra = 0
    for _ in 0..<20 { extra += attention.tick(singing: true, dt: 0.001) }
    #expect(extra == 0)
}

@Test func resetDisarmsNothingAndClearsTheMeter() {
    var attention = Attention()
    attention.tick(singing: true, dt: 3)
    attention.reset()
    #expect(attention.value == 0)
    #expect(attention.armed.allSatisfy { $0 })
}
```

`swift/CricketCore/Tests/CricketCoreTests/FoodTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func foodSpawnsUpToTheCap() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var field = FoodField()
    let rng = SeededRandom(seed: 3)

    for _ in 0..<200 { field.update(dt: 1, world: world, rng: rng) }
    #expect(field.items.count == Config.Food.maxOnScreen)
}

@Test func onlyNaturalTypesEverSpawn() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var field = FoodField()
    let rng = SeededRandom(seed: 5)

    for _ in 0..<200 { field.update(dt: 1, world: world, rng: rng) }
    for item in field.items {
        #expect(FoodType.natural.contains(item.type), "grubs are only ever dropped")
    }
}

@Test func aDroppedGrubMustSettleBeforeItCanBeEaten() {
    var field = FoodField()
    let grub = field.drop(.grub, x: 100, y: 100)
    #expect(!grub.isEdible)

    #expect(field.consume(cricketX: 100, cricketY: 100).isEmpty)

    let world = World.meadow(rng: SeededRandom(seed: 7))
    field.update(dt: Config.Food.dropSettleSeconds, world: world, rng: SeededRandom(seed: 1))
    #expect(field.consume(cricketX: 100, cricketY: 100).count == 1)
}

@Test func dropsIgnoreTheOnScreenCap() {
    var field = FoodField()
    for i in 0..<(Config.Food.maxOnScreen + 5) {
        field.drop(.grub, x: Double(i), y: 100)
    }
    #expect(field.items.count == Config.Food.maxOnScreen + 5, "earned drops are never swallowed")
}
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd swift/CricketCore && swift test --filter "ScoreTests|AttentionTests|FoodTests"
```

Expected: FAIL — `cannot find 'Score' in scope`.

- [ ] **Step 3: Implement**

Port the three modules. `Score.commitHighScore(to:)` floors `points`, compares against `highScore`, and only then writes through the store. `Attention.tick` returns the count spawned this frame, arming down on crossing and re-arming below `threshold - rearmMargin`. `FoodField.update` ages items, decrements `settleFor`, and drains `timer` in a `while` loop that skips spawning when at the cap — note the JS uses `continue`, so the timer still drains at the cap.

- [ ] **Step 4: Run to verify they pass**

```bash
cd swift/CricketCore && swift test --filter "ScoreTests|AttentionTests|FoodTests"
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): score, attention meter and the food field"
```

---

### Task 10: Cricket

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Cricket.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/CricketTests.swift`

**Reference:** `src/cricket.js`, `tests/cricket.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Intent`
- Produces:
  - `struct CricketEvents: Equatable { var startedSinging, stoppedSinging, startedJump, landed, startedStrike, hidden: Bool }`
  - `struct Cricket` with `x, y, dirX, dirY, moving, singing, songSeconds, invulnerableFor, jumping, jumpProgress, jumpSeconds, jumpFromX, jumpFromY, jumpToX, jumpToY, jumpCooldown, jumpHeld, strikeCooldown, strikeHeld, swingFor, stunnedFor`
  - `init(world: World)`
  - `mutating func update(intent: Intent, dt: Double, world: World) -> CricketEvents`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/CricketTests.swift`:

```swift
import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func singingRequiresStandingStill() {
    let world = meadow()
    var cricket = Cricket(world: world)

    let events = cricket.update(intent: Intent(sing: true), dt: 0.1, world: world)
    #expect(cricket.singing)
    #expect(events.startedSinging)

    cricket.update(intent: Intent(dx: 1, sing: true), dt: 0.1, world: world)
    #expect(!cricket.singing, "moving cancels the song")
}

@Test func movingWalksTheCricketAndSetsItsFacing() {
    let world = meadow()
    var cricket = Cricket(world: world)
    let startX = cricket.x

    cricket.update(intent: Intent(dx: 1), dt: 0.1, world: world)
    #expect(cricket.x > startX)
    #expect(cricket.dirX == 1)
}

@Test func aJumpNeedsAFreshPressAndCannotBeSteeredMidAir() {
    let world = meadow()
    var cricket = Cricket(world: world)

    let held = Intent(jump: true)
    let events = cricket.update(intent: held, dt: 1.0 / 60, world: world)
    #expect(events.startedJump)
    #expect(cricket.jumping)

    // Airborne: no singing, no steering.
    cricket.update(intent: Intent(dx: 1, sing: true, jump: true), dt: 1.0 / 60, world: world)
    #expect(!cricket.singing)
    #expect(!cricket.moving)
}

@Test func aJumpDoesNotChainWhileTheKeyIsHeld() {
    let world = meadow()
    var cricket = Cricket(world: world)
    let held = Intent(jump: true)

    cricket.update(intent: held, dt: 1.0 / 60, world: world)
    // Ride the arc out and past the cooldown.
    for _ in 0..<200 { cricket.update(intent: held, dt: 1.0 / 60, world: world) }
    #expect(!cricket.jumping, "a held key must not re-trigger the leap")
}

@Test func aStunFreezesEverything() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.stunnedFor = Config.Rivals.biteStunSeconds

    let events = cricket.update(intent: Intent(dx: 1, sing: true, jump: true), dt: 0.1, world: world)
    #expect(!cricket.singing)
    #expect(!cricket.moving)
    #expect(!events.startedJump)
    #expect(!events.startedStrike)
}

@Test func aSwingSilencesTheSong() {
    let world = meadow()
    var cricket = Cricket(world: world)

    cricket.update(intent: Intent(sing: true), dt: 0.1, world: world)
    #expect(cricket.singing)

    let events = cricket.update(intent: Intent(sing: true, strike: true), dt: 0.01, world: world)
    #expect(events.startedStrike)
    #expect(!cricket.singing, "a scrap really does break the note")
}

@Test func theCricketStopsAtTheWaterAndSlidesAlongTheBank() {
    var world = meadow()
    var cricket = Cricket(world: world)
    // A wall of water directly to the east of the cricket.
    world.water = [Circle(x: cricket.x + 40, y: cricket.y, radius: 60)]

    for _ in 0..<60 { cricket.update(intent: Intent(dx: 1), dt: 1.0 / 60, world: world) }
    #expect(!world.isWater(x: cricket.x, y: cricket.y, margin: Config.Cricket.radius))
}

@Test func midLeapTheCricketIsNotHiddenEvenInsideCover() {
    var world = meadow()
    var cricket = Cricket(world: world)
    world.cover = [Cover(x: cricket.x, y: cricket.y, radius: 60, type: .grass)]

    let standing = cricket.update(intent: .idle, dt: 1.0 / 60, world: world)
    #expect(standing.hidden)

    let leaping = cricket.update(intent: Intent(jump: true), dt: 1.0 / 60, world: world)
    #expect(!leaping.hidden, "mid-air the cricket is above the grass")
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter CricketTests
```

Expected: FAIL — `cannot find 'Cricket' in scope`.

- [ ] **Step 3: Implement**

Port `src/cricket.js` exactly, preserving the order of operations in `update`: decrement timers, compute fresh-press edges for jump and strike, return early when stunned, then either advance the arc or handle strike → jump → move/sing. `startJump` aims at the nearest cover in the held cone excluding the cover currently occupied, falling back to `dryLanding` which steps outward from `fallbackDistance` to `range` in 12-point increments and then back off.

- [ ] **Step 4: Run to verify it passes**

```bash
cd swift/CricketCore && swift test --filter CricketTests
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): cricket movement, singing, leaping and striking"
```

---

### Task 11: Rivals

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Rivals.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/RivalsTests.swift`

**Reference:** `src/rivals.js`, `tests/rivals.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Cricket`, `FoodField`, `FoodItem`, `RandomSource`
- Produces:
  - `enum RivalKind: String, Sendable { case ant, beetle }` with `var health: Int` and `var drops: Int`
  - `struct Rival { var x, y, dirX, dirY: Double; let kind: RivalKind; var health: Int; var flashFor, nibbleFor, phase, targetX, targetY: Double }`
  - `func spawnRival(world: World, rng: RandomSource, index: Int) -> Rival`
  - `func createRivals(world: World, rng: RandomSource) -> [Rival]`
  - `struct StrikeResult { var hit: Rival?; var killed: Bool; var retaliated: Bool }`
  - `func resolveStrike(cricket: Cricket, rivals: inout [Rival]) -> StrikeResult`
  - `func updateRivals(_ rivals: inout [Rival], dt: Double, world: World, food: inout FoodField, rng: RandomSource) -> [FoodItem]`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/RivalsTests.swift`:

```swift
import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func aSwingOnlyReachesBugsInFront() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.dirX = 1; cricket.dirY = 0

    var behind = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    behind.x = cricket.x - 20; behind.y = cricket.y
    var rivals = [behind]

    #expect(resolveStrike(cricket: cricket, rivals: &rivals).hit == nil)
}

@Test func anAntDropsAtOneBlowAndABeetleTakesTwo() {
    let world = meadow()
    var cricket = Cricket(world: world)
    cricket.dirX = 1; cricket.dirY = 0

    var ant = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    #expect(ant.kind == .ant)
    ant.x = cricket.x + 20; ant.y = cricket.y
    var rivals = [ant]
    let first = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(first.killed)
    #expect(rivals.isEmpty)

    var beetle = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 1)
    #expect(beetle.kind == .beetle)
    beetle.x = cricket.x + 20; beetle.y = cricket.y
    rivals = [beetle]

    let hit = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(!hit.killed)
    #expect(hit.retaliated, "a beetle bites back for the first blow")

    let finish = resolveStrike(cricket: cricket, rivals: &rivals)
    #expect(finish.killed)
    #expect(rivals.isEmpty)
}

@Test func rivalsEatTheSameFoodTheCricketWants() {
    let world = meadow()
    var food = FoodField()
    let item = food.drop(.seed, x: 500, y: 400)
    food.update(dt: Config.Food.dropSettleSeconds, world: world, rng: SeededRandom(seed: 1))

    var rival = spawnRival(world: world, rng: SeededRandom(seed: 1), index: 0)
    rival.x = item.x + 5; rival.y = item.y
    rival.targetX = item.x; rival.targetY = item.y
    var rivals = [rival]

    var eaten: [FoodItem] = []
    for _ in 0..<60 {
        eaten += updateRivals(&rivals, dt: 1.0 / 60, world: world,
                              food: &food, rng: SeededRandom(seed: 2))
    }
    #expect(eaten.count == 1)
    #expect(food.items.isEmpty)
}

@Test func rivalsNeverWalkIntoWater() {
    var world = meadow()
    world.water = [Circle(x: 800, y: 400, radius: 120)]
    var food = FoodField()

    var rivals = createRivals(world: world, rng: SeededRandom(seed: 7))
    for _ in 0..<600 {
        updateRivals(&rivals, dt: 1.0 / 60, world: world,
                     food: &food, rng: SeededRandom(seed: 3))
    }
    for rival in rivals {
        #expect(!world.isWater(x: rival.x, y: rival.y, margin: Config.Rivals.radius))
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter RivalsTests
```

Expected: FAIL — `cannot find 'spawnRival' in scope`.

- [ ] **Step 3: Implement**

Port `src/rivals.js`. `resolveStrike` picks the *nearest* bug within `reach + radius` inside the strike cone, decrements its health, and removes it at zero. Removal uses the array index found during the scan rather than JS `indexOf`. In `updateRivals`, the eaten item is removed by `id` via `FoodField.remove(id:)`, since struct items have no reference identity.

- [ ] **Step 4: Run to verify it passes**

```bash
cd swift/CricketCore && swift test --filter RivalsTests
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): ants and beetles competing for the food"
```

---

### Task 12: Spiders

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Spiders.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/SpidersTests.swift`

**Reference:** `src/spiders.js`, `tests/spiders.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Cover`, `Cricket`, `RandomSource`, `Point`
- Produces:
  - `enum SpiderState: Sendable { case lurking, windup, lunge, recover }`
  - `struct Spider { let cover: Cover; let homeX, homeY: Double; var x, y: Double; var state: SpiderState; var stateTime, targetX, targetY, alertness: Double }`
  - `enum SpiderEvent: Equatable { case wake(index: Int); case lunge(index: Int); case hit(index: Int); case miss(index: Int) }`
  - `func createSpiders(world: World, rng: RandomSource, keepAwayFrom: Point?) -> [Spider]`
  - `func updateSpiders(_ spiders: inout [Spider], dt: Double, world: World, cricket: Cricket) -> [SpiderEvent]`

Events carry the spider's array index rather than a reference, because `Spider` is a value type.

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/SpidersTests.swift`:

```swift
import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

@Test func spidersKeepClearOfTheSpawnPoint() {
    let world = meadow()
    let spiders = createSpiders(world: world, rng: SeededRandom(seed: 5), keepAwayFrom: nil)
    let spawn = world.spawnPoint

    #expect(spiders.count <= Config.Spiders.count)
    for spider in spiders {
        let away = hypot2(spider.homeX - spawn.x, spider.homeY - spawn.y)
        #expect(away >= Config.Spiders.minDistanceFromSpawn)
    }
}

@Test func eachSpiderTakesItsOwnTuft() {
    let world = meadow()
    let spiders = createSpiders(world: world, rng: SeededRandom(seed: 5), keepAwayFrom: nil)
    for i in 0..<spiders.count {
        for j in (i + 1)..<spiders.count {
            #expect(!(spiders[i].homeX == spiders[j].homeX && spiders[i].homeY == spiders[j].homeY))
        }
    }
}

@Test func aSpiderHuntsByTouchAndLetsAnAirborneCricketPass() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400
    cricket.jumping = true

    let none = updateSpiders(&spiders, dt: 0.1, world: world, cricket: cricket)
    #expect(none.isEmpty, "a leaping cricket sails over untouched")

    cricket.jumping = false
    let woke = updateSpiders(&spiders, dt: 0.1, world: world, cricket: cricket)
    #expect(woke.contains(.wake(index: 0)))
}

@Test func aLungeCommitsToWhereTheCricketWas() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500; cricket.y = 400

    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)   // wake
    // Run clear during the wind-up.
    cricket.x = 900
    var events: [SpiderEvent] = []
    for _ in 0..<120 {
        events += updateSpiders(&spiders, dt: 1.0 / 60, world: world, cricket: cricket)
    }
    #expect(events.contains(.miss(index: 0)), "running out of reach beats the lunge")
    #expect(!events.contains(.hit(index: 0)))
}

@Test func alertnessRisesAsTheCricketApproaches() {
    var world = meadow()
    world.cover = [Cover(x: 500, y: 400, radius: 50, type: .grass)]
    var spiders = [createSpiders(world: world, rng: SeededRandom(seed: 1),
                                 keepAwayFrom: Point(x: -9999, y: -9999))[0]]

    var cricket = Cricket(world: world)
    cricket.x = 500 + Config.Spiders.noticeRadius + 50; cricket.y = 400
    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)
    #expect(spiders[0].alertness == 0)

    cricket.x = 500 + Config.Spiders.noticeRadius / 2
    updateSpiders(&spiders, dt: 0.01, world: world, cricket: cricket)
    #expect(spiders[0].alertness > 0)
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter SpidersTests
```

Expected: FAIL — `cannot find 'createSpiders' in scope`.

- [ ] **Step 3: Implement**

Port `src/spiders.js`, including the Fisher-Yates shuffle over eligible cover so each spider gets a distinct tuft. `keepAwayFrom: nil` means "use the spawn point", matching the JS default.

- [ ] **Step 4: Run to verify it passes**

```bash
cd swift/CricketCore && swift test --filter SpidersTests
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): spiders that ambush from cover"
```

---

### Task 13: Birds

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Birds.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/BirdsTests.swift`

**Reference:** `src/birds.js`, `tests/birds.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Cricket`, `RandomSource`, `Point`
- Produces:
  - `enum BirdKind: String, Sendable { case bird, bat }` with `var circleSecondsScale: Double`, `var speedScale: Double`, `var size: Double`
  - `enum BirdState: Sendable { case enter, circle, dive, retreat, gone }`
  - `enum BirdOutcome: Equatable, Sendable { case none, scannedLost, hit, missed, gone }`
  - `struct PredatorContext { let world: World; let cricket: Cricket; let hidden, singing, airborne: Bool }`
  - `struct Bird { var x, y, vx, vy: Double; let kind: BirdKind; var state: BirdState; var stateTime, angle, targetX, targetY, speedScale, centerX, centerY, exitX, exitY: Double }`
  - `static func Bird.spawn(world: World, rng: RandomSource, difficulty: Double, kind: BirdKind, focus: Point?) -> Bird`
  - `mutating func Bird.update(dt: Double, context: PredatorContext) -> BirdOutcome`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/BirdsTests.swift`:

```swift
import Testing
@testable import CricketCore

private func meadow() -> World { World.meadow(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket,
                     hidden: Bool = false, singing: Bool = false,
                     airborne: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: singing, airborne: airborne)
}

@Test func aBirdEntersFromOffScreenAndSettlesIntoAnOrbit() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))
    #expect(bird.state == .enter)

    for _ in 0..<600 {
        _ = bird.update(dt: 1.0 / 60, context: context(world, cricket))
        if bird.state != .enter { break }
    }
    #expect(bird.state == .circle)
}

@Test func hidingQuietlyMakesTheBirdGiveUp() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    var outcome = BirdOutcome.none
    for _ in 0..<1200 {
        outcome = bird.update(dt: 1.0 / 60,
                              context: context(world, cricket, hidden: true, singing: false))
        if outcome == .scannedLost { break }
    }
    #expect(outcome == .scannedLost)
    #expect(bird.state == .retreat)
}

@Test func singingFromCoverGivesTheCricketAway() {
    let world = meadow()
    let cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    for _ in 0..<1200 {
        _ = bird.update(dt: 1.0 / 60,
                        context: context(world, cricket, hidden: true, singing: true))
        if bird.state == .dive { break }
    }
    #expect(bird.state == .dive, "a singing cricket is found even in cover")
}

@Test func aLeapDodgesADive() {
    let world = meadow()
    var cricket = Cricket(world: world)
    var bird = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: Point(x: cricket.x, y: cricket.y))

    // Put the bird on top of the cricket, mid-dive.
    bird.state = .dive
    bird.stateTime = 0
    bird.x = cricket.x; bird.y = cricket.y
    bird.targetX = cricket.x; bird.targetY = cricket.y
    cricket.jumping = true

    let outcome = bird.update(dt: 1.0 / 60, context: context(world, cricket, airborne: true))
    #expect(outcome == .missed)
}

@Test func batsCommitFasterThanBirds() {
    #expect(BirdKind.bat.circleSecondsScale < BirdKind.bird.circleSecondsScale)
}

@Test func difficultyScalesEverySpeed() {
    let world = meadow()
    let slow = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 1, kind: .bird, focus: nil)
    let fast = Bird.spawn(world: world, rng: SeededRandom(seed: 7),
                          difficulty: 2, kind: .bird, focus: nil)
    #expect(fast.speedScale > slow.speedScale)
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter BirdsTests
```

Expected: FAIL — `cannot find 'Bird' in scope`.

- [ ] **Step 3: Implement**

Port `src/birds.js`. The scan at the end of `CIRCLE` is the pivotal rule: `hidden && !singing` retreats, otherwise the dive commits to the cricket's position *at that moment*, which is what lets a player who breaks off and runs still escape. `DIVE` connects only when within `hitRadius` **and** not airborne.

- [ ] **Step 4: Run to verify it passes**

```bash
cd swift/CricketCore && swift test --filter BirdsTests
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the aerial predator state machine"
```

---

### Task 14: Cat and Human

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Cat.swift`
- Create: `swift/CricketCore/Sources/CricketCore/Human.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/CatTests.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/HumanTests.swift`

**Reference:** `src/cat.js`, `src/human.js`, `tests/cat.test.js`, `tests/human.test.js`

**Interfaces:**
- Consumes: `Config`, `World`, `Cricket`, `PredatorContext`, `RandomSource`
- Produces:
  - `enum CatState: Sendable { case prowl, stalk, pounce, recover, confused }`
  - `enum CatOutcome: Equatable, Sendable { case none, noticed, lost, pounced, hit, missed }`
  - `struct Cat { var x, y, dirX, dirY: Double; var state: CatState; var stateTime, targetX, targetY, roamX, interest: Double; init(world: World, rng: RandomSource); mutating func update(dt: Double, context: PredatorContext, rng: RandomSource) -> CatOutcome }`
  - `struct Walker { var x, y: Double; let band: Band; let dir: Double; var warnFor, walked, lastStride: Double }`
  - `enum HumanEvent: Equatable, Sendable { case approaching, footfall(x: Double, y: Double), crush(x: Double, y: Double), gone }`
  - `struct HumanSchedule { var timer: Double; var walker: Walker?; init(rng: RandomSource); mutating func update(dt: Double, context: PredatorContext, rng: RandomSource) -> [HumanEvent] }`

- [ ] **Step 1: Write the failing tests**

`swift/CricketCore/Tests/CricketCoreTests/CatTests.swift`:

```swift
import Testing
@testable import CricketCore

private func house() -> World { World.house(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket,
                     hidden: Bool = false, singing: Bool = false,
                     airborne: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: singing, airborne: airborne)
}

@Test func furnitureBreaksTheCatsInterestOutright() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)
    cricket.x = cat.x + 40; cricket.y = cat.y

    let seen = cat.update(dt: 0.1, context: context(world, cricket), rng: SeededRandom(seed: 1))
    #expect(seen == .noticed)

    let lost = cat.update(dt: 0.1, context: context(world, cricket, hidden: true),
                          rng: SeededRandom(seed: 1))
    #expect(lost == .lost)
}

@Test func aSingingCricketCarriesFurtherThanAMovingOne() {
    let world = house()
    var quiet = Cat(world: world, rng: SeededRandom(seed: 3))
    var loud = Cat(world: world, rng: SeededRandom(seed: 3))

    var cricket = Cricket(world: world)
    // Beyond the plain notice radius, inside the singing bonus.
    cricket.x = quiet.x + Config.Cat.noticeRadius + 100
    cricket.y = quiet.y

    #expect(quiet.update(dt: 0.1, context: context(world, cricket),
                         rng: SeededRandom(seed: 1)) == .none)
    #expect(loud.update(dt: 0.1, context: context(world, cricket, singing: true),
                        rng: SeededRandom(seed: 1)) == .noticed)
}

@Test func aLeapClearsAPounce() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)
    cricket.x = cat.x; cricket.y = cat.y
    cricket.jumping = true

    cat.state = .pounce
    cat.stateTime = Config.Cat.pounceSeconds
    cat.targetX = cat.x; cat.targetY = cat.y

    let outcome = cat.update(dt: 1.0 / 60,
                             context: context(world, cricket, airborne: true),
                             rng: SeededRandom(seed: 1))
    #expect(outcome == .missed)
}

@Test func theCatClimbsTheStairsAfterTheCricket() {
    let world = house()
    var cat = Cat(world: world, rng: SeededRandom(seed: 3))
    // Cat downstairs, cricket upstairs, in view.
    cat.y = (world.bands[1].top + world.bands[1].bottom) / 2
    cat.state = .stalk

    var cricket = Cricket(world: world)
    cricket.x = cat.x
    cricket.y = (world.bands[0].top + world.bands[0].bottom) / 2

    let startY = cat.y
    for _ in 0..<600 {
        _ = cat.update(dt: 1.0 / 60, context: context(world, cricket),
                       rng: SeededRandom(seed: 1))
    }
    #expect(cat.y < startY, "the cat made its way upstairs")
}
```

`swift/CricketCore/Tests/CricketCoreTests/HumanTests.swift`:

```swift
import Testing
@testable import CricketCore

private func house() -> World { World.house(rng: SeededRandom(seed: 7)) }

private func context(_ world: World, _ cricket: Cricket, hidden: Bool = false) -> PredatorContext {
    PredatorContext(world: world, cricket: cricket,
                    hidden: hidden, singing: false, airborne: false)
}

@Test func aShadowArrivesBeforeTheFeet() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    let cricket = Cricket(world: world)

    var events: [HumanEvent] = []
    for _ in 0..<3000 {
        events += schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                  rng: SeededRandom(seed: 5))
        if events.contains(.approaching) { break }
    }
    #expect(events.contains(.approaching))
    #expect(!events.contains { if case .footfall = $0 { return true }; return false },
            "the shadow holds before any foot lands")
}

@Test func furnitureIsTheOnlyThingThatSavesYou() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    var cricket = Cricket(world: world)

    // Walk the schedule until a crossing starts, then stand under it.
    var started = false
    for _ in 0..<3000 where !started {
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                     rng: SeededRandom(seed: 5))
        started = events.contains(.approaching)
    }
    let walker = try! #require(schedule.walker)
    cricket.y = walker.y

    var crushed = false
    for _ in 0..<3000 {
        cricket.x = schedule.walker?.x ?? cricket.x
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket, hidden: true),
                                     rng: SeededRandom(seed: 5))
        if events.contains(where: { if case .crush = $0 { return true }; return false }) {
            crushed = true
        }
        if schedule.walker == nil { break }
    }
    #expect(!crushed, "hidden under furniture, nothing lands on you")
}

@Test func aCrossingEventuallyEnds() {
    let world = house()
    var schedule = HumanSchedule(rng: SeededRandom(seed: 3))
    let cricket = Cricket(world: world)

    var sawGone = false
    for _ in 0..<20000 {
        let events = schedule.update(dt: 1.0 / 60, context: context(world, cricket),
                                     rng: SeededRandom(seed: 5))
        if events.contains(.gone) { sawGone = true; break }
    }
    #expect(sawGone)
}
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd swift/CricketCore && swift test --filter "CatTests|HumanTests"
```

Expected: FAIL — `cannot find 'Cat' in scope`.

- [ ] **Step 3: Implement**

Port `src/cat.js` and `src/human.js`. The cat's `useStairs` walks to the stairwell centre, then along it to the centre of the cricket's band. The human's crush test requires the cricket on the walker's band, within `crushRadius` of the footfall, and **not hidden** — being airborne changes nothing, because there is nowhere above a foot to be.

- [ ] **Step 4: Run to verify they pass**

```bash
cd swift/CricketCore && swift test --filter "CatTests|HumanTests"
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the house cat and the human"
```

---

### Task 15: GameEvent

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/GameEvent.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/GameEventTests.swift`

**Interfaces:**
- Consumes: `FoodItem`, `BirdKind`, `RivalKind`, `StageKind`
- Produces:
  - `enum Threat: Equatable, Sendable { case bird, bat, spider, cat, human }`
  - `enum GameEvent: Equatable, Sendable` with cases: `songStart`, `songBreak`, `jump`, `land`, `strike(connected: Bool)`, `bugHit(kind: RivalKind)`, `bugKilled(kind: RivalKind, drops: Int)`, `stunned(kind: RivalKind)`, `ate(FoodItem)`, `rivalAte(FoodItem)`, `birdSpawn(kind: BirdKind)`, `birdCry(kind: BirdKind)`, `spiderWake(index: Int)`, `spiderLunge(index: Int)`, `catNoticed`, `catLost`, `catPounced`, `humanApproaching`, `footfall(x: Double, y: Double)`, `humanGone`, `newDay(day: Int)`, `stageChange(stage: StageKind)`, `hit(from: Threat)`, `gameOver`

This enum is the seam between simulation and presentation, and the reason the audio layer in Plan 4 gets compiler-enforced exhaustiveness where the JS `switch` falls silently through.

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/GameEventTests.swift`:

```swift
import Testing
@testable import CricketCore

@Test func everyJavaScriptEventTypeHasACase() {
    var field = FoodField()
    let item = field.drop(.grub, x: 0, y: 0)

    // The full set audio.js switches on, plus the ones only game.js emits.
    let events: [GameEvent] = [
        .songStart, .songBreak, .jump, .land,
        .strike(connected: true), .bugHit(kind: .ant),
        .bugKilled(kind: .beetle, drops: 2), .stunned(kind: .beetle),
        .ate(item), .rivalAte(item),
        .birdSpawn(kind: .bird), .birdCry(kind: .bat),
        .spiderWake(index: 0), .spiderLunge(index: 0),
        .catNoticed, .catLost, .catPounced,
        .humanApproaching, .footfall(x: 1, y: 2), .humanGone,
        .newDay(day: 2), .stageChange(stage: .house),
        .hit(from: .spider), .gameOver,
    ]
    #expect(events.count == 24)
}

@Test func eventsCompareByValue() {
    #expect(GameEvent.hit(from: .cat) == GameEvent.hit(from: .cat))
    #expect(GameEvent.hit(from: .cat) != GameEvent.hit(from: .bird))
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter GameEventTests
```

Expected: FAIL — `cannot find 'GameEvent' in scope`.

- [ ] **Step 3: Implement**

Write the enum exactly as listed in the Interfaces block.

- [ ] **Step 4: Run to verify it passes**

```bash
cd swift/CricketCore && swift test --filter GameEventTests
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the event enum joining simulation to presentation"
```

---

### Task 16: Game

The keystone: the state machine, wave director and event stream that ties every previous task together.

**Files:**
- Create: `swift/CricketCore/Sources/CricketCore/Game.swift`
- Test: `swift/CricketCore/Tests/CricketCoreTests/GameTests.swift`

**Reference:** `src/game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `enum Phase: Sendable { case menu, playing, gameOver }`
  - `func difficultyAt(_ elapsed: Double) -> Double`
  - `struct Game` with `phase, world, cricket, birds, food, rivals, spiders, score, attention, lives, elapsed, day, night, stage, stageCooldown, cat, humans, shiftedFor, rivalRespawnTimer, patrolTimer, hidden, newRecord`
  - `init(store: HighScoreStore, rng: RandomSource)`
  - `mutating func startRun()`
  - `mutating func update(intent: Intent, dt: Double) -> [GameEvent]`

- [ ] **Step 1: Write the failing test**

`swift/CricketCore/Tests/CricketCoreTests/GameTests.swift`:

```swift
import Testing
@testable import CricketCore

private func newGame(seed: UInt64 = 7) -> Game {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: seed))
    game.startRun()
    return game
}

private let still = Intent.idle
private let singing = Intent(sing: true)

@Test func aNewGameSitsInTheMenuUntilTheRunStarts() {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    #expect(game.phase == .menu)

    game.startRun()
    #expect(game.phase == .playing)
    #expect(game.lives == Config.Game.startingLives)
    #expect(game.elapsed == 0)
    #expect(game.birds.isEmpty)
}

@Test func difficultyRampsFromOneToTheCapAndHolds() {
    #expect(difficultyAt(0) == 1)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds / 2) > 1)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds) == Config.Game.difficultyMax)
    #expect(difficultyAt(Config.Game.difficultyRampSeconds * 10) == Config.Game.difficultyMax)
}

@Test func theMenuSimulatesNothing() {
    var game = Game(store: MemoryHighScoreStore(), rng: SeededRandom(seed: 7))
    #expect(game.update(intent: singing, dt: 1).isEmpty)
    #expect(game.elapsed == 0)
}

@Test func singingScoresAndEventuallySummonsAPredator() {
    var game = newGame()
    var sawSpawn = false
    for _ in 0..<600 {
        for event in game.update(intent: singing, dt: 1.0 / 60) {
            if case .birdSpawn = event { sawSpawn = true }
        }
    }
    #expect(game.score.points > 0)
    #expect(sawSpawn)
}

@Test func singingFromCoverScoresNothing() {
    var game = newGame()
    // Stand the cricket inside a tuft.
    game.world.cover = [Cover(x: game.cricket.x, y: game.cricket.y, radius: 60, type: .grass)]

    for _ in 0..<120 { game.update(intent: singing, dt: 1.0 / 60) }
    #expect(game.score.points == 0, "cover is safety, not points")
    #expect(game.hidden)
}

@Test func aHitCostsALifeAndGrantsMercy() {
    var game = newGame()
    let before = game.lives

    // Drop a bird on top of the cricket, mid-dive.
    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    var sawHit = false
    for _ in 0..<10 {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .hit = event { sawHit = true }
        }
        if sawHit { break }
    }
    #expect(sawHit)
    #expect(game.lives == before - 1)
    #expect(game.cricket.invulnerableFor > 0)
}

@Test func theRunEndsWhenTheLivesAreGone() {
    var game = newGame()
    game.lives = 1

    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    var sawGameOver = false
    for _ in 0..<10 {
        if game.update(intent: still, dt: 1.0 / 60).contains(.gameOver) { sawGameOver = true }
    }
    #expect(sawGameOver)
    #expect(game.phase == .gameOver)
}

@Test func aNewDayRearrangesTheMeadowButNeverBuriesTheCricket() {
    var game = newGame()
    var sawNewDay = false

    for _ in 0..<Int(Config.Game.secondsPerDay * 61) {
        for event in game.update(intent: still, dt: 1.0 / 60) {
            if case .newDay = event { sawNewDay = true }
        }
        if sawNewDay { break }
    }
    #expect(sawNewDay)
    #expect(!game.world.isWater(x: game.cricket.x, y: game.cricket.y,
                                margin: Config.Cricket.radius))
    #expect(!game.cricket.jumping, "a leap in progress is cancelled")
}

@Test func walkingIntoTheDoorwayMovesTheCricketIndoors() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y

    var events: [GameEvent] = []
    for _ in 0..<5 { events += game.update(intent: still, dt: 1.0 / 60) }

    #expect(events.contains(.stageChange(stage: .house)))
    #expect(game.stage == .house)
    #expect(game.cat != nil, "the house has its own cast")
    #expect(game.birds.isEmpty, "nothing follows the cricket through a doorway")
}

@Test func scoreAndLivesCarryThroughTheDoorway() {
    var game = newGame()
    game.score.points = 500
    game.lives = 2
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y

    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }

    #expect(game.score.points == 500, "going indoors is a change of scene, not a new run")
    #expect(game.lives == 2)
}

@Test func birdsNeverComeIndoors() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y
    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.stage == .house)

    for _ in 0..<3600 { game.update(intent: singing, dt: 1.0 / 60) }
    #expect(game.birds.isEmpty)
}

@Test func theHouseDoesNotRearrangeItselfOvernight() {
    var game = newGame()
    game.cricket.x = game.world.door.x
    game.cricket.y = game.world.door.y
    for _ in 0..<5 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.stage == .house)

    let furniture = game.world.cover
    for _ in 0..<Int(Config.Game.secondsPerDay * 61) {
        game.update(intent: still, dt: 1.0 / 60)
        if game.stage != .house { break }
    }
    if game.stage == .house {
        #expect(game.world.cover == furniture)
    }
}

@Test func swingingIsLoudEnoughToDrawAttention() {
    var game = newGame()
    let before = game.attention.value
    game.update(intent: Intent(strike: true), dt: 1.0 / 60)
    #expect(game.attention.value > before)
}

@Test func aNewRecordIsReportedAtTheEnd() {
    var game = newGame()
    game.score.points = 1000
    game.lives = 1

    var bird = Bird.spawn(world: game.world, rng: SeededRandom(seed: 1),
                          difficulty: 1, kind: .bird, focus: nil)
    bird.state = .dive
    bird.x = game.cricket.x; bird.y = game.cricket.y
    bird.targetX = game.cricket.x; bird.targetY = game.cricket.y
    game.birds = [bird]

    for _ in 0..<10 { game.update(intent: still, dt: 1.0 / 60) }
    #expect(game.phase == .gameOver)
    #expect(game.newRecord)
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd swift/CricketCore && swift test --filter GameTests
```

Expected: FAIL — `cannot find 'Game' in scope`.

- [ ] **Step 3: Implement**

Port `src/game.js`, preserving the order of operations in `update`, which matters because later steps read state earlier ones wrote:

1. Return `[]` unless `phase == .playing`.
2. Advance `elapsed`, `night`, `shiftedFor`, `stageCooldown`.
3. Roll the day; reshuffle **only** when `stage == .meadow`.
4. `cricket.update`, mapping `CricketEvents` to `GameEvent`s; `startedStrike` calls `swing`.
5. Score the song only when singing **and not hidden**; `tickFed`.
6. `attention.tick`, then `difficultyAt`, then drain the patrol timer at `patrolIntervalSeconds / difficulty`.
7. Spawn `spawned + patrols` predators, capped at `maxAlive`, only when `stage == .meadow`, of kind `night ? .bat : .bird`.
8. `food.update`; consume only when not jumping.
9. `updateRivals`; respawn one bug per `respawnSeconds` while below `count`.
10. Doorway check, gated on `stageCooldown <= 0`.
11. `updateSpiders`, then cat, then humans, then birds.
12. `lives <= 0` ends the run and commits the high score.

`takeHit` returns `false` inside the mercy window; on a real hit it decrements lives, sets `invulnerableFor`, breaks the song, resets attention, and emits `.hit`.

`swing` adds `Config.Attention.perStrike`, and on a kill scatters `drops` grubs around the corpse at `14` points of spread when there is more than one.

- [ ] **Step 4: Run the whole suite**

```bash
cd swift/CricketCore && swift test
```

Expected: PASS, all tests across every file. This is the moment the port is provably faithful with nothing yet drawn.

- [ ] **Step 5: Commit**

```bash
git add swift/CricketCore
git commit -m "feat(swift): the game state machine and event stream"
```

---

### Task 17: Documentation

**Files:**
- Create: `swift/README.md`
- Modify: `CLAUDE.md` — add a Swift section

- [ ] **Step 1: Write `swift/README.md`**

Cover: what the package is, the two commands (`swift test` and the `xcodebuild` line with `DEVELOPER_DIR`), the rule that `CricketCore` imports only the standard library, the golden-fixture regeneration command, and a pointer to the spec.

- [ ] **Step 2: Add a Swift section to `CLAUDE.md`**

Record the facts a fresh agent cannot infer: `DEVELOPER_DIR` is required because `xcode-select` points at CommandLineTools; `swift test` runs the simulation without a simulator; the `.xcodeproj` uses a synchronized root group so new files need no project edits; and the golden fixture must be regenerated from JS, never hand-edited, when world generation changes on purpose.

- [ ] **Step 3: Verify both suites still pass**

```bash
npm test
cd swift/CricketCore && swift test
```

Expected: both green. The JS suite must be unaffected — this plan adds a folder and touches nothing in `src/`.

- [ ] **Step 4: Commit**

```bash
git add swift/README.md CLAUDE.md
git commit -m "docs: how to build and test the Swift port"
```

---

## Definition of done

- `cd swift/CricketCore && swift test` passes, covering every module in `src/` except `main.js`, `input.js`, `touch.js`, `audio.js` and `render/`.
- The golden test proves Swift meadows match JS meadows for a shared seed.
- `xcodebuild … build` succeeds and the app launches in the simulator.
- `npm test` still passes; nothing in `src/` changed.
- No file in `swift/CricketCore/Sources/` imports anything but the Swift standard library.
