# Life of a Cricket — Swift port

A native iOS port of the game in `../src`. It renders the same meadow and
house, drives the same simulation rules, and plays with real multi-touch
controls instead of a mouse and keyboard.

## Package split

Three pieces, each with a distinct job and a distinct set of things it's
allowed to depend on:

- **`CricketCore`** — the whole simulation, ported rule-for-rule from `../src`
  (`game.js`, `world.js`, `cricket.js`, `birds.js`, `spiders.js`, `house.js`,
  `score.js`, and so on). No rendering, no input, no UIKit, no SwiftUI. It
  imports **only the Swift standard library plus platform libm** (`Foundation`
  is not linked) — that's what makes it possible to run and reason about
  identically on macOS (for `swift test`) and iOS, and it's the constraint
  that keeps the simulation honest: nothing in here can reach out to a
  platform API and behave differently on one than the other.

  **`CricketCore` is frozen.** It was built and verified bit-for-bit against
  the JavaScript in an earlier phase of this port (see the plans linked
  below), and nothing in the render/touch/app layers is allowed to change it.
  If playing the app ever turns up something that looks like a `CricketCore`
  bug, that is a significant finding, not a quick fix — it means the frozen,
  verified core and the JavaScript it was checked against have diverged, and
  it needs to be adjudicated deliberately rather than patched in passing.

- **`TouchInput`** — the on-screen stick and buttons (`touchLayout`,
  `buttonAt`, `TouchState`), ported from `src/touch.js`. It depends on
  `CricketCore` (for `Intent` and `Config.Touch`) but nothing else, and
  deliberately knows nothing about `UIKit`: touches are identified by a plain
  `AnyHashable`, not `UITouch`. That's what makes it unit-testable without a
  device or a UI test host — see `steeringAndPressingWorkSimultaneously()` in
  `TouchInput/Tests/TouchInputTests/TouchStateTests.swift` for the property
  that exists to prove: a drag on the stick and a hold on a button, driven by
  two independent synthetic touch identities at once, both show up in the
  same `Intent` at the same moment.

- **`LifeOfACricket`** (the app target, in `LifeOfACricket/`) — the one place
  UIKit and SwiftUI show up. `Sources/Render/` draws `CricketCore`'s state
  with a SwiftUI `Canvas`, `Sources/TouchInputView.swift` is the thin
  `UIViewRepresentable` adapter that turns real `UITouch` events into calls on
  `TouchInput.TouchState`, and `Sources/GameView.swift` ties the frame clock,
  the touch layer, and the renderer together. **Nothing under `Render/` may
  mutate simulation state** — it only reads `CricketCore`'s types and draws
  them; the frame clock in `GameView` is the only thing that advances the
  simulation.

## Running the tests

Plain `swift test` fails with `error: no such module 'Testing'` — the
`Testing` framework ships inside Xcode's toolchain, not the command-line
tools. Point `DEVELOPER_DIR` at Xcode first, every time, and never
`sudo xcode-select` to change the system default:

```bash
cd swift/CricketCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test   # 107 tests
cd swift/TouchInput   && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test   # 13 tests
```

The JavaScript suite it's checked against runs the normal way from the repo
root: `npm test` (245 tests).

## Building and running the app

```bash
cd swift/LifeOfACricket
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project LifeOfACricket.xcodeproj -scheme LifeOfACricket \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

or just open `LifeOfACricket.xcodeproj` in Xcode and hit Run.

**`xcodebuild` rewrites `project.pbxproj` as a side effect of building** — it
downgrades `objectVersion` from 77 to 70 and can inject a local
`DEVELOPMENT_TEAM`. 77 is what supports `PBXFileSystemSynchronizedRootGroup`,
the mechanism that lets adding a Swift file under `Sources/` need no project
edit at all; losing it silently breaks that. Run `git status` after every
build and `git checkout` the file if it changed. **Never commit that rewrite,
and never commit a personal team ID.**

## Cross-language guards

Three tests in `CricketCore` exist specifically to catch the Swift port
drifting from the JavaScript it's a port of, and none of their fixtures are
ever hand-edited:

- **`WorldGoldenTests`** — decodes a JS-generated meadow
  (`Fixtures/world-seed-7.json`) and checks the Swift `createWorld` produces
  the same layout from the same seed. Regenerate with:
  ```bash
  node swift/tools/dump-world-fixture.mjs 7 > swift/CricketCore/Tests/CricketCoreTests/Fixtures/world-seed-7.json
  ```

- **`HouseGoldenTests`** — the same idea for `createHouse`
  (`Fixtures/house-seed-7.json`): bands, stairs, the door, cover and water,
  field for field at 1e-9 tolerance. `createHouse`'s rejection-sampling draw
  order otherwise rests on hand-reading alone. Regenerate with:
  ```bash
  node swift/tools/dump-house-fixture.mjs 7 > swift/CricketCore/Tests/CricketCoreTests/Fixtures/house-seed-7.json
  ```

- **`DifferentialTraceTests`** — drives the Swift `Game` through the same
  scripted inputs, from the same seed, as `dump-game-trace.mjs` drives the
  real `src/game.js` through, and compares every frame: phase, stage, day,
  night, lives, score, and cricket position. Unit tests pin individual rules;
  this catches what they structurally cannot — a regression in operation
  order, or RNG draw order, that still satisfies every rule in isolation but
  diverges the two simulations over time. Six scenarios, a few thousand
  frames total, chosen to collectively exercise a day rollover and the
  `reshuffleMeadow` it triggers, night (so bats spawn instead of birds),
  jump/land and the song-break a jump forces, a bird/spider/cat hit and three
  separate runs to game-over, the full spider state machine, and the cat and
  a full human crossing. Regenerate a scenario's fixture with:
  ```bash
  node swift/tools/dump-game-trace.mjs <scenario> > swift/CricketCore/Tests/CricketCoreTests/Fixtures/trace-<scenario>.json
  ```

If either test ever fails without a corresponding intentional change to
`src/game.js` or `src/world.js`, **the JavaScript is the reference: fix the
Swift, never the fixture.**

## Running on a real device

1. Open `LifeOfACricket.xcodeproj` in Xcode, select your device from the
   scheme's destination menu (it must be plugged in, or on the same network
   with Wi-Fi debugging enabled).
2. Select the `LifeOfACricket` target → **Signing & Capabilities** → set
   **Team** to your personal Apple ID (Xcode will offer to create a free
   personal team if you don't have one).
3. Build and run. The first time, iOS will refuse to launch the app until you
   trust the developer certificate: on the device, go to **Settings → General
   → VPN & Device Management**, find your Apple ID under "Developer App", and
   tap **Trust**.
4. **Developer Mode** must be enabled on the device (iOS 16+): **Settings →
   Privacy & Security → Developer Mode** → toggle on → the device will prompt
   to restart.
5. A free (non-paid-program) Apple ID's provisioning profile **expires after
   7 days** — the app simply stops launching until you rebuild and reinstall
   from Xcode, no other symptom.

## Further reading

- Design spec: `../docs/superpowers/specs/2026-08-15-life-of-a-cricket-swift-design.md`
- Simulation-core plan (built and froze `CricketCore`):
  `../docs/superpowers/plans/2026-08-15-swift-simulation-core.md`
- Render-and-touch plan (built everything else in this directory):
  `../docs/superpowers/plans/2026-08-15-swift-render-and-touch.md`
