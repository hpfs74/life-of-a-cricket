// The Swift standard library has no trig functions; `hypot` needs the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as World.swift and Water.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Spiders live inside cover and never leave their tuft for long.
///
/// They are the exception to the game's central rule. Hiding and keeping quiet
/// beats anything with wings, but a spider hunts by touch at arm's length, so
/// the very move that saves the cricket from a dive is what walks it into one.
///
/// Every spider advertises itself: `alertness` rises as the cricket approaches
/// and the renderer glows the tell accordingly. The threat is information the
/// player acts on under time pressure, never a surprise.
public enum SpiderState: Sendable {
    case lurking, windup, lunge, recover
}

public struct Spider: Sendable {
    public let cover: Cover
    public let homeX: Double
    public let homeY: Double
    public var x: Double
    public var y: Double
    public var state: SpiderState
    public var stateTime: Double
    public var targetX: Double
    public var targetY: Double
    public var alertness: Double

    public init(
        cover: Cover, homeX: Double, homeY: Double, x: Double, y: Double,
        state: SpiderState, stateTime: Double, targetX: Double, targetY: Double,
        alertness: Double
    ) {
        self.cover = cover
        self.homeX = homeX; self.homeY = homeY
        self.x = x; self.y = y
        self.state = state
        self.stateTime = stateTime
        self.targetX = targetX; self.targetY = targetY
        self.alertness = alertness
    }
}

/// Events carry the spider's array index rather than a reference, because
/// `Spider` is a value type with no reference identity.
public enum SpiderEvent: Equatable {
    case wake(index: Int)
    case lunge(index: Int)
    case hit(index: Int)
    case miss(index: Int)
}

private func makeSpider(_ cover: Cover) -> Spider {
    Spider(
        cover: cover, homeX: cover.x, homeY: cover.y, x: cover.x, y: cover.y,
        state: .lurking, stateTime: 0, targetX: cover.x, targetY: cover.y, alertness: 0
    )
}

/// Settles spiders into distinct cover pieces, skipping anything close to
/// `keepAwayFrom` so the cricket is never handed an unavoidable death. That is
/// the spawn point on a fresh run, and the cricket itself when the meadow
/// rearranges mid-run.
public func createSpiders(world: World, rng: RandomSource, keepAwayFrom: Point?) -> [Spider] {
    let safe = keepAwayFrom ?? world.spawnPoint

    var eligible = world.cover.filter {
        hypot2($0.x - safe.x, $0.y - safe.y) >= Config.Spiders.minDistanceFromSpawn
    }

    // Fisher-Yates over a copy, so each spider gets its own tuft.
    if eligible.count > 1 {
        for i in stride(from: eligible.count - 1, to: 0, by: -1) {
            let j = Int(rng.next() * Double(i + 1))
            eligible.swapAt(i, j)
        }
    }

    return eligible.prefix(Config.Spiders.count).map(makeSpider)
}

private func enterState(_ spider: inout Spider, _ state: SpiderState) {
    spider.state = state
    spider.stateTime = 0
}

@discardableResult
private func moveToward(_ spider: inout Spider, x: Double, y: Double, speed: Double, dt: Double) -> Double {
    let dx = x - spider.x
    let dy = y - spider.y
    let distance = hypot2(dx, dy)
    // Positional literal from src/spiders.js:62: below this, treat the spider
    // as arrived rather than dividing by a near-zero distance.
    let arrivalEpsilon = 0.0001
    if distance < arrivalEpsilon { return 0 }

    let step = min(distance, speed * dt)
    spider.x += (dx / distance) * step
    spider.y += (dy / distance) * step
    return distance - step
}

// Positional literal from src/spiders.js:112: how close a lunge must get to its
// target, in points, before treating the approach as finished rather than a
// gameplay tunable.
private let lungeArrivalEpsilon = 1.0

/// Advances every spider and reports what happened.
///
/// A lunge commits to where the cricket stood when it launched — the same rule
/// the birds' dives use — so leaping or running clear of that spot beats it, and
/// the counterplay reads the same for both kinds of predator.
@discardableResult
public func updateSpiders(_ spiders: inout [Spider], dt: Double, world: World, cricket: Cricket) -> [SpiderEvent] {
    let windUpSeconds = Config.Spiders.windUpSeconds
    let lungeSpeed = Config.Spiders.lungeSpeed
    let lungeSeconds = Config.Spiders.lungeSeconds
    let hitRadius = Config.Spiders.hitRadius
    let recoverSeconds = Config.Spiders.recoverSeconds
    let returnSpeed = Config.Spiders.returnSpeed
    let noticeRadius = Config.Spiders.noticeRadius

    var events: [SpiderEvent] = []

    for index in spiders.indices {
        spiders[index].stateTime += dt

        let toCricket = hypot2(cricket.x - spiders[index].homeX, cricket.y - spiders[index].homeY)
        spiders[index].alertness = max(0, min(1, 1 - toCricket / noticeRadius))

        switch spiders[index].state {
        case .lurking:
            // Touch, not sound or sight: an airborne cricket sails over untouched.
            let disturbed = !cricket.jumping && toCricket <= spiders[index].cover.radius
            if disturbed {
                enterState(&spiders[index], .windup)
                events.append(.wake(index: index))
            }

        case .windup:
            if spiders[index].stateTime < windUpSeconds { break }

            spiders[index].targetX = cricket.x
            spiders[index].targetY = cricket.y
            enterState(&spiders[index], .lunge)
            events.append(.lunge(index: index))

        case .lunge:
            let remaining = moveToward(
                &spiders[index], x: spiders[index].targetX, y: spiders[index].targetY,
                speed: lungeSpeed, dt: dt
            )
            if remaining > lungeArrivalEpsilon && spiders[index].stateTime < lungeSeconds { break }

            let reach = hypot2(cricket.x - spiders[index].x, cricket.y - spiders[index].y)
            let connects = reach <= hitRadius && !cricket.jumping

            enterState(&spiders[index], .recover)
            events.append(connects ? .hit(index: index) : .miss(index: index))

        case .recover:
            moveToward(&spiders[index], x: spiders[index].homeX, y: spiders[index].homeY, speed: returnSpeed, dt: dt)
            if spiders[index].stateTime >= recoverSeconds {
                spiders[index].x = spiders[index].homeX
                spiders[index].y = spiders[index].homeY
                enterState(&spiders[index], .lurking)
            }
        }
    }

    return events
}
