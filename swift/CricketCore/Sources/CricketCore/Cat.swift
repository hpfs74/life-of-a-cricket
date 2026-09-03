// The Swift standard library has no trig functions; `hypot` needs the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as World.swift and Birds.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// The house cat: the only thing indoors that actually hunts the cricket.
///
/// It prowls a floor until it notices something exposed — noticing is a matter
/// of distance, and singing carries much further than moving does. Cover breaks
/// its interest outright, which is why furniture is the indoor equivalent of a
/// grass tuft.
///
/// Once it has the cricket it stalks, then pounces at where the cricket was when
/// it committed: the same rule birds' dives and spiders' lunges use, so the
/// counterplay reads identically everywhere in the game.
///
/// It can take the stairs, which is the whole reason both floors are on screen.
public enum CatState: Sendable {
    case prowl, stalk, pounce, recover, confused
}

/// What happened this frame, for the caller to react to.
public enum CatOutcome: Equatable, Sendable {
    case none, noticed, lost, pounced, hit, missed
}

/// A body radius the cat clamps to when it steps, matching the positional
/// literal `18` in src/cat.js:56.
private let catBodyRadius = 18.0

/// Below this gap from `roamX`, PROWL treats itself as arrived and redraws a
/// new roam target. Positional literal from src/cat.js:108.
private let roamArrivalEpsilon = 12.0

/// CONFUSED moochs toward a point this far ahead along its last heading.
/// Positional literal from src/cat.js:158.
private let moochOffset = 40.0

/// CONFUSED moves at this fraction of `prowlSpeed` while it moochs. Positional
/// literal from src/cat.js:158.
private let moochSpeedFactor = 0.6

/// Below this remaining distance, POUNCE treats itself as arrived even if
/// `pounceSeconds` has not elapsed. Positional literal from src/cat.js:141.
private let pounceArrivalEpsilon = 1.0

private func bandCentre(_ band: Band) -> Double {
    (band.top + band.bottom) / 2
}

public struct Cat: Sendable {
    public var x: Double
    public var y: Double
    public var dirX: Double
    public var dirY: Double
    public var state: CatState
    public var stateTime: Double
    public var targetX: Double
    public var targetY: Double
    // Where it is heading while prowling, and which floor it wants to be on.
    public var roamX: Double
    public var interest: Double

    /// Spawns the cat on the ground floor, somewhere in the middle band of the
    /// house's width, heading toward a fresh roam target.
    ///
    /// Draws TWO values from `rng`, in this order: `x` (1), then `roamX` (2) —
    /// matching `createCat` in src/cat.js, which builds the return object as a
    /// single literal with `x` written before `roamX`.
    public init(world: World, rng: RandomSource) {
        let band = world.bands[world.bands.count - 1]

        let x = world.width * (0.35 + rng.next() * 0.4)
        let roamX = world.width * rng.next()

        self.x = x
        self.y = bandCentre(band)
        self.dirX = -1
        self.dirY = 0
        self.state = .prowl
        self.stateTime = 0
        self.targetX = 0
        self.targetY = 0
        self.roamX = roamX
        self.interest = 0
    }
}

private func enterState(_ cat: inout Cat, _ state: CatState) {
    cat.state = state
    cat.stateTime = 0
}

/// Steps `cat` toward `(targetX, targetY)` by `speed * dt`, clamped to the
/// world. Returns the distance remaining after the step.
@discardableResult
private func step(_ cat: inout Cat, world: World, targetX: Double, targetY: Double, speed: Double, dt: Double) -> Double {
    let dx = targetX - cat.x
    let dy = targetY - cat.y
    let distance = hypot2(dx, dy)
    if distance < 0.0001 { return 0 }

    let travelled = min(distance, speed * dt)
    cat.dirX = dx / distance
    cat.dirY = dy / distance

    let next = world.clampToBounds(x: cat.x + cat.dirX * travelled, y: cat.y + cat.dirY * travelled, radius: catBodyRadius)
    cat.x = next.x
    cat.y = next.y

    return distance - travelled
}

/// True when the cat and the cricket are on the same floor.
private func sameFloor(world: World, cat: Cat, cricket: Cricket) -> Bool {
    world.bandAt(x: cat.x, y: cat.y).top == world.bandAt(x: cricket.x, y: cricket.y).top
}

/// Walks the cat toward the stairwell and then along it to the cricket's floor.
/// Returns true once it has arrived on the right floor.
@discardableResult
private func useStairs(_ cat: inout Cat, world: World, cricket: Cricket, speed: Double, dt: Double) -> Bool {
    guard let stair = world.stairs.first else { return true }

    let middle = stair.x + stair.width / 2

    if !world.inStairwell(x: cat.x) || abs(cat.x - middle) > Config.Cat.stairTolerance {
        step(&cat, world: world, targetX: middle, targetY: cat.y, speed: speed, dt: dt)
        return false
    }

    // On the stairs: climb or descend toward the cricket's floor.
    let target = bandCentre(world.bandAt(x: cricket.x, y: cricket.y))
    step(&cat, world: world, targetX: middle, targetY: target, speed: speed, dt: dt)
    return sameFloor(world: world, cat: cat, cricket: cricket)
}

extension Cat {
    /// Advances the cat and reports what happened.
    @discardableResult
    public mutating func update(dt: Double, context: PredatorContext, rng: RandomSource) -> CatOutcome {
        stateTime += dt

        let distance = hypot2(context.cricket.x - x, context.cricket.y - y)
        let reach = Config.Cat.noticeRadius + (context.singing ? Config.Cat.singingBonus : 0)
        // Furniture hides the cricket outright; being airborne does not.
        let visible = !context.hidden && distance <= reach
        interest = visible ? max(0, 1 - distance / reach) : 0

        switch state {
        case .prowl:
            if abs(x - roamX) < roamArrivalEpsilon { roamX = context.world.width * rng.next() }
            step(&self, world: context.world, targetX: roamX, targetY: bandCentre(context.world.bandAt(x: x, y: y)),
                 speed: Config.Cat.prowlSpeed, dt: dt)

            if visible {
                enterState(&self, .stalk)
                return .noticed
            }
            return .none

        case .stalk:
            if !visible {
                enterState(&self, .confused)
                return .lost
            }

            if !sameFloor(world: context.world, cat: self, cricket: context.cricket) {
                useStairs(&self, world: context.world, cricket: context.cricket, speed: Config.Cat.stalkSpeed, dt: dt)
                return .none
            }

            step(&self, world: context.world, targetX: context.cricket.x, targetY: context.cricket.y,
                 speed: Config.Cat.stalkSpeed, dt: dt)

            if stateTime < Config.Cat.stalkSeconds { return .none }

            targetX = context.cricket.x
            targetY = context.cricket.y
            enterState(&self, .pounce)
            return .pounced

        case .pounce:
            let remaining = step(&self, world: context.world, targetX: targetX, targetY: targetY,
                                  speed: Config.Cat.pounceSpeed, dt: dt)
            if remaining > pounceArrivalEpsilon && stateTime < Config.Cat.pounceSeconds { return .none }

            let gap = hypot2(context.cricket.x - x, context.cricket.y - y)
            // A leap clears a pounce exactly as it clears a dive.
            let connects = gap <= Config.Cat.hitRadius && !context.cricket.jumping

            enterState(&self, .recover)
            return connects ? .hit : .missed

        case .recover:
            if stateTime >= Config.Cat.recoverSeconds { enterState(&self, .prowl) }
            return .none

        case .confused:
            // Mooching about where it last saw something.
            step(&self, world: context.world, targetX: x + dirX * moochOffset, targetY: y,
                 speed: Config.Cat.prowlSpeed * moochSpeedFactor, dt: dt)

            if visible {
                enterState(&self, .stalk)
                return .noticed
            }
            if stateTime >= Config.Cat.confusedSeconds { enterState(&self, .prowl) }
            return .none
        }
    }
}
