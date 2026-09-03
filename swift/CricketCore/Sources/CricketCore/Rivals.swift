// The Swift standard library has no trig functions; `hypot`/`cos` need the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as World.swift and Water.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Ants and beetles share the meadow. They are no threat to the cricket, but
/// they eat the same food, so dawdling costs points.
///
/// `health` and `drops` come from `CONFIG.rivals.health`/`.drops` in
/// `src/config.js`; per ruling R2 they live here on the enum, kind-keyed,
/// rather than as members of `Config.Rivals`.
public enum RivalKind: String, Sendable {
    case ant, beetle

    /// Ants scatter at a touch; beetles need finishing, and bite if you fail.
    public var health: Int {
        switch self {
        case .ant: return 1
        case .beetle: return 2
        }
    }

    /// What a corpse leaves behind. A beetle pays double for the second hit.
    public var drops: Int {
        switch self {
        case .ant: return 1
        case .beetle: return 2
        }
    }
}

/// One ant or beetle, wandering the meadow for food.
public struct Rival: Sendable {
    public var x: Double
    public var y: Double
    public var dirX: Double
    public var dirY: Double
    public let kind: RivalKind
    public var health: Int
    public var flashFor: Double
    public var nibbleFor: Double
    public var phase: Double
    public var targetX: Double
    public var targetY: Double

    public init(
        x: Double, y: Double, dirX: Double, dirY: Double, kind: RivalKind,
        health: Int, flashFor: Double, nibbleFor: Double, phase: Double,
        targetX: Double, targetY: Double
    ) {
        self.x = x; self.y = y; self.dirX = dirX; self.dirY = dirY
        self.kind = kind
        self.health = health
        self.flashFor = flashFor
        self.nibbleFor = nibbleFor
        self.phase = phase
        self.targetX = targetX; self.targetY = targetY
    }
}

/// Picks a new place for a rival to amble to when it has nothing better to do.
private func wanderTarget(_ rival: inout Rival, world: World, rng: RandomSource) {
    let point = world.randomOpenPoint(rng: rng)
    rival.targetX = point.x
    rival.targetY = point.y
}

/// One bug, dropped into the meadow at a random open spot.
public func spawnRival(world: World, rng: RandomSource, index: Int) -> Rival {
    let start = world.randomOpenPoint(rng: rng)
    let kind: RivalKind = index % 2 == 0 ? .ant : .beetle
    // Hoisted into its own binding rather than drawn inline as a struct-
    // literal argument below: Swift does not guarantee the evaluation order
    // of a call's arguments, so a draw made inside one is only correct by
    // current compiler behaviour. A named `let`, one statement per draw,
    // pins the order explicitly.
    let phase = rng.next() * Double.pi * 2 // Staggers gaits so the swarm does not march in lockstep.

    var rival = Rival(
        x: start.x, y: start.y, dirX: 1, dirY: 0, kind: kind,
        health: kind.health, flashFor: 0, nibbleFor: 0,
        phase: phase,
        targetX: start.x, targetY: start.y
    )
    wanderTarget(&rival, world: world, rng: rng)
    return rival
}

/// A handful of ants and beetles scattered across the meadow.
public func createRivals(world: World, rng: RandomSource) -> [Rival] {
    (0..<Config.Rivals.count).map { spawnRival(world: world, rng: rng, index: $0) }
}

/// The outcome of one swing of the cricket's strike. `hit` is nil when the
/// swing found air.
public struct StrikeResult: Sendable {
    public var hit: Rival?
    public var killed: Bool
    public var retaliated: Bool

    public init(hit: Rival?, killed: Bool, retaliated: Bool) {
        self.hit = hit; self.killed = killed; self.retaliated = retaliated
    }
}

// Positional literal from src/rivals.js:76: how long a hit flashes, not a
// gameplay tunable.
private let hitFlashSeconds = 0.12

/// Resolves one swing of the cricket's strike.
///
/// Only the nearest bug inside a cone in front of the cricket is hit, so a swing
/// is a jab at one target rather than a sweep of the meadow. A bug that survives
/// and has the temperament for it bites back, and the caller applies the stun.
@discardableResult
public func resolveStrike(cricket: Cricket, rivals: inout [Rival]) -> StrikeResult {
    let reach = Config.Cricket.Strike.reach
    let halfAngleDegrees = Config.Cricket.Strike.halfAngleDegrees
    let cosLimit = cos(halfAngleDegrees * Double.pi / 180)

    var bestIndex: Int?
    var bestDistance = Double.infinity

    for (index, rival) in rivals.enumerated() {
        let dx = rival.x - cricket.x
        let dy = rival.y - cricket.y
        let dist = hypot2(dx, dy)
        if dist > reach + Config.Rivals.radius || dist >= bestDistance { continue }

        if dist > 0 {
            let dot = (dx * cricket.dirX + dy * cricket.dirY) / dist
            if dot < cosLimit { continue }
        }

        bestIndex = index
        bestDistance = dist
    }

    guard let index = bestIndex else {
        return StrikeResult(hit: nil, killed: false, retaliated: false)
    }

    rivals[index].health -= 1
    rivals[index].flashFor = hitFlashSeconds

    if rivals[index].health <= 0 {
        let killed = rivals.remove(at: index)
        return StrikeResult(hit: killed, killed: true, retaliated: false)
    }

    // Still standing, and cross about it.
    rivals[index].nibbleFor = 0
    return StrikeResult(hit: rivals[index], killed: false, retaliated: rivals[index].kind == .beetle)
}

// Positional literal from src/rivals.js:130/148: how close a rival must be to
// its target before it counts as arrived, rather than a gameplay tunable.
private let arrivalEpsilon = 0.5

/// Moves every rival and lets them eat.
///
/// They are not a threat — they are competition. Food left lying around gets
/// taken, so the cricket cannot bank a whole meadow and sing at leisure.
///
/// Returns the items eaten this frame.
@discardableResult
public func updateRivals(
    _ rivals: inout [Rival], dt: Double, world: World, food: inout FoodField, rng: RandomSource
) -> [FoodItem] {
    let speed = Config.Rivals.speed
    let eatRadius = Config.Rivals.eatRadius
    let nibbleSeconds = Config.Rivals.nibbleSeconds
    let senseRange = Config.Rivals.senseRange
    var eaten: [FoodItem] = []

    for index in rivals.indices {
        rivals[index].flashFor = max(0, rivals[index].flashFor - dt)

        if rivals[index].nibbleFor > 0 {
            rivals[index].nibbleFor = max(0, rivals[index].nibbleFor - dt)
            continue
        }

        // Head for the closest food it can sense, else amble to a random spot.
        var best: FoodItem?
        var bestDistance = senseRange

        for item in food.items {
            guard item.isEdible else { continue }
            let dist = hypot2(item.x - rivals[index].x, item.y - rivals[index].y)
            if dist <= bestDistance {
                best = item
                bestDistance = dist
            }
        }

        if let best {
            rivals[index].targetX = best.x
            rivals[index].targetY = best.y
        }

        let dx = rivals[index].targetX - rivals[index].x
        let dy = rivals[index].targetY - rivals[index].y
        let dist = hypot2(dx, dy)

        if dist > arrivalEpsilon {
            rivals[index].dirX = dx / dist
            rivals[index].dirY = dy / dist
            let step = min(dist, speed * dt)
            let next = world.clampToBounds(
                x: rivals[index].x + rivals[index].dirX * step,
                y: rivals[index].y + rivals[index].dirY * step,
                radius: Config.Rivals.radius
            )

            if world.isWater(x: next.x, y: next.y, margin: Config.Rivals.radius) {
                // Blocked by the bank: give up on this errand and amble elsewhere.
                wanderTarget(&rivals[index], world: world, rng: rng)
            } else {
                rivals[index].x = next.x
                rivals[index].y = next.y
            }
        } else if best == nil {
            wanderTarget(&rivals[index], world: world, rng: rng)
        }

        if let best, hypot2(best.x - rivals[index].x, best.y - rivals[index].y) <= eatRadius {
            if let removed = food.remove(id: best.id) {
                eaten.append(removed)
                rivals[index].nibbleFor = nibbleSeconds
                wanderTarget(&rivals[index], world: world, rng: rng)
            }
        }
    }

    return eaten
}
