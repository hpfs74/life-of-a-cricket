// The Swift standard library has no trig functions; `hypot`/`cos`/`sin` need
// the platform's libm. This is the platform C library, not Foundation, so it
// stays within the "stdlib only" constraint. Same shim as World.swift,
// Water.swift and Rivals.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Aerial predators: birds by day, bats by night. Both share one state
/// machine; only their pace and silhouette differ.
///
/// `circleSecondsScale`, `speedScale` and `size` come from
/// `CONFIG.bird.kinds` in `src/config.js`; per ruling R2 they live here on
/// the enum, kind-keyed, rather than as members of `Config.Bird`.
public enum BirdKind: String, Sendable {
    case bird, bat

    /// How long the orbit lasts before the scan, relative to a day bird's.
    /// Bats commit sooner — less time on the wing before they either dive
    /// or give up.
    public var circleSecondsScale: Double {
        switch self {
        case .bird: return 1
        case .bat: return 0.7
        }
    }

    /// Multiplies every speed in the state machine.
    public var speedScale: Double {
        switch self {
        case .bird: return 1
        case .bat: return 0.92
        }
    }

    /// Rendered size in pixels. Not consumed by the state machine, but part
    /// of the shared per-kind tuning.
    public var size: Double {
        switch self {
        case .bird: return 22
        case .bat: return 16
        }
    }
}

/// Where a predator is in its attack run.
public enum BirdState: Sendable {
    case enter, circle, dive, retreat, gone
}

/// What happened this frame, for the caller to react to.
public enum BirdOutcome: Equatable, Sendable {
    case none, scannedLost, hit, missed, gone
}

/// The world state a predator needs to decide what to do: the world it is
/// flying over, the cricket it is hunting, and what the cricket is doing
/// right now. Defined here; consumed again by the cat and human predators.
public struct PredatorContext: Sendable {
    public let world: World
    public let cricket: Cricket
    public let hidden: Bool
    public let singing: Bool
    public let airborne: Bool

    public init(world: World, cricket: Cricket, hidden: Bool, singing: Bool, airborne: Bool) {
        self.world = world
        self.cricket = cricket
        self.hidden = hidden
        self.singing = singing
        self.airborne = airborne
    }
}

/// One aerial predator, mid-attack-run.
public struct Bird: Sendable {
    public var x: Double
    public var y: Double
    public var vx: Double
    public var vy: Double
    public let kind: BirdKind
    public var state: BirdState
    public var stateTime: Double
    public var angle: Double
    public var targetX: Double
    public var targetY: Double
    public var speedScale: Double
    public var centerX: Double
    public var centerY: Double
    public var exitX: Double
    public var exitY: Double

    public init(
        x: Double, y: Double, vx: Double, vy: Double, kind: BirdKind, state: BirdState,
        stateTime: Double, angle: Double, targetX: Double, targetY: Double, speedScale: Double,
        centerX: Double, centerY: Double, exitX: Double, exitY: Double
    ) {
        self.x = x; self.y = y; self.vx = vx; self.vy = vy
        self.kind = kind
        self.state = state
        self.stateTime = stateTime
        self.angle = angle
        self.targetX = targetX; self.targetY = targetY
        self.speedScale = speedScale
        self.centerX = centerX; self.centerY = centerY
        self.exitX = exitX; self.exitY = exitY
    }
}

/// Where a predator sets up its orbit. On a meadow wider than the view it
/// hunts around the cricket rather than the distant middle of the world, but
/// it never centres so close to an edge that half its circle is off the map.
private func huntCentre(world: World, focus: Point?) -> Double {
    let half = Config.View.width / 2
    guard let focus, world.width > Config.View.width else { return world.width / 2 }
    return min(world.width - half, max(half, focus.x))
}

extension Bird {
    /// Creates an aerial predator just off the edge of the visible window.
    /// `difficulty` (1 upward) scales every speed, which is how the game
    /// ramps. `kind` is `.bird` by day and `.bat` by night; both share this
    /// state machine. `focus` is the point it hunts around — the cricket, in
    /// play.
    ///
    /// Draws SIX values from `rng`, in this order: the edge (1), then all
    /// four candidate spawn positions in array order regardless of which one
    /// is chosen (2-5), then the starting angle (6). The JavaScript builds
    /// the full `positions` array before indexing into it, so every position
    /// is generated even though three of them are discarded — the RNG
    /// stream must match that exactly or it diverges from the JS forever
    /// after.
    public static func spawn(
        world: World, rng: RandomSource, difficulty: Double, kind: BirdKind, focus: Point?
    ) -> Bird {
        let edge = Int(rng.next() * 4) % 4
        let centreX = huntCentre(world: world, focus: focus)
        let centreY = world.top + (world.height - world.top) / 2
        let margin = Config.View.width / 2 + 120
        let spread: (Double) -> Double = { value in centreX + (value - 0.5) * Config.View.width }

        // Positional literals from src/birds.js:33-36: how far off-screen a
        // predator spawns above/below the meadow, not gameplay tunables.
        let topOffset = -120.0
        let bottomOffset = world.height + 120

        let topX = spread(rng.next())
        let rightY = rng.next() * world.height
        let bottomX = spread(rng.next())
        let leftY = rng.next() * world.height

        let positions = [
            Point(x: topX, y: topOffset),
            Point(x: centreX + margin, y: rightY),
            Point(x: bottomX, y: bottomOffset),
            Point(x: centreX - margin, y: leftY),
        ]

        let start = positions[edge]
        let angle = rng.next() * Double.pi * 2

        return Bird(
            x: start.x, y: start.y, vx: 0, vy: 0, kind: kind, state: .enter,
            stateTime: 0, angle: angle, targetX: 0, targetY: 0,
            speedScale: difficulty * kind.speedScale,
            centerX: centreX,
            // Predators orbit over the playable ground, not over the empty
            // sky band.
            centerY: centreY,
            exitX: start.x, exitY: start.y
        )
    }
}

/// Steps `bird` toward `(targetX, targetY)` by `speed * dt`, updating its
/// velocity to face the target. Returns the distance remaining after the
/// step.
@discardableResult
private func moveToward(_ bird: inout Bird, targetX: Double, targetY: Double, speed: Double, dt: Double) -> Double {
    let dx = targetX - bird.x
    let dy = targetY - bird.y
    let distance = hypot2(dx, dy)
    if distance < 0.0001 { return 0 }

    let step = min(distance, speed * dt)
    bird.vx = (dx / distance) * speed
    bird.vy = (dy / distance) * speed
    bird.x += (dx / distance) * step
    bird.y += (dy / distance) * step

    return distance - step
}

private func enterState(_ bird: inout Bird, _ state: BirdState) {
    bird.state = state
    bird.stateTime = 0
}

extension Bird {
    /// Advances the predator one frame and reports what happened.
    ///
    /// The dive commits to the cricket's position at scan time. That is
    /// deliberate: it means a player who breaks off and runs the instant
    /// they hear the cry can still escape, which is what makes the warning
    /// readable rather than decorative.
    @discardableResult
    public mutating func update(dt: Double, context: PredatorContext) -> BirdOutcome {
        stateTime += dt

        switch state {
        case .enter:
            let orbitX = centerX + cos(angle) * Config.Bird.circleRadius
            let orbitY = centerY + sin(angle) * Config.Bird.circleRadius * 0.6
            let remaining = moveToward(&self, targetX: orbitX, targetY: orbitY,
                                       speed: Config.Bird.enterSpeed * speedScale, dt: dt)

            if remaining <= 1 { enterState(&self, .circle) }
            return .none

        case .circle:
            angle += Config.Bird.circleSpeed * speedScale * dt
            let nextX = centerX + cos(angle) * Config.Bird.circleRadius
            let nextY = centerY + sin(angle) * Config.Bird.circleRadius * 0.6
            vx = (nextX - x) / max(dt, 0.0001)
            vy = (nextY - y) / max(dt, 0.0001)
            x = nextX
            y = nextY

            let circleSeconds = Config.Bird.circleSeconds * kind.circleSecondsScale
            if stateTime < circleSeconds { return .none }

            // Scan: cover only saves a cricket that keeps quiet.
            if context.hidden && !context.singing {
                enterState(&self, .retreat)
                return .scannedLost
            }

            targetX = context.cricket.x
            targetY = context.cricket.y
            enterState(&self, .dive)
            return .none

        case .dive:
            let remaining = moveToward(&self, targetX: targetX, targetY: targetY,
                                       speed: Config.Bird.diveSpeed * speedScale, dt: dt)
            if remaining > 1 { return .none }

            let distanceToCricket = hypot2(context.cricket.x - x, context.cricket.y - y)
            enterState(&self, .retreat)

            // A cricket in mid-leap passes under the strike: timing a jump
            // is the other way out of a dive, alongside hiding quietly.
            let connects = distanceToCricket <= Config.Bird.hitRadius && !context.airborne
            return connects ? .hit : .missed

        case .retreat:
            let remaining = moveToward(&self, targetX: exitX, targetY: exitY,
                                       speed: Config.Bird.retreatSpeed * speedScale, dt: dt)
            if remaining <= 1 {
                enterState(&self, .gone)
                return .gone
            }
            return .none

        case .gone:
            return .none
        }
    }
}
