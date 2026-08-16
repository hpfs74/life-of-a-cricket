/// The human: enormous, oblivious, and lethal by accident.
///
/// It never hunts and never reacts. It simply crosses a room on its own
/// schedule, and anything caught in the open under a footfall is crushed. That
/// makes it a different kind of pressure from the cat: there is nothing to
/// outwit, only a path to read and a moment to be somewhere else.
///
/// A shadow arrives before the feet do, so the room always tells you first.

/// How far off-screen a crossing starts and ends. Positional literal from
/// src/human.js:31.
private let walkerMargin = 160.0

/// How far past the world's edges a crossing must go before it is considered
/// finished. Positional literal from src/human.js:97.
private let goneMargin = 200.0

private func bandCentre(_ band: Band) -> Double {
    (band.top + band.bottom) / 2
}

private func nextDelay(_ range: ClosedRange<Double>, _ rng: RandomSource) -> Double {
    range.lowerBound + rng.next() * (range.upperBound - range.lowerBound)
}

/// One crossing in progress: which floor, which direction, and how far along
/// its walk it has come.
public struct Walker: Sendable {
    public var x: Double
    public var y: Double
    public let band: Band
    public let dir: Double
    public var warnFor: Double
    // Distance walked, used to place footfalls a stride apart.
    public var walked: Double
    public var lastStride: Double

    public init(x: Double, y: Double, band: Band, dir: Double, warnFor: Double, walked: Double, lastStride: Double) {
        self.x = x; self.y = y
        self.band = band
        self.dir = dir
        self.warnFor = warnFor
        self.walked = walked
        self.lastStride = lastStride
    }
}

/// Events the schedule reports: `approaching` when a shadow appears,
/// `footfall` for each step (with where it landed), `crush` when one lands on
/// an exposed cricket, and `gone` when the crossing finishes.
public enum HumanEvent: Equatable, Sendable {
    case approaching, footfall(x: Double, y: Double), crush(x: Double, y: Double), gone
}

/// Starts a crossing on one of the floors, from one side to the other.
///
/// Draws TWO values from `rng`, in this order: the band index (1), then the
/// direction (2) — matching `startWalk` in src/human.js, which reads `band`
/// before `leftToRight`.
private func startWalk(world: World, rng: RandomSource) -> Walker {
    let bandIndex = Int(rng.next() * Double(world.bands.count)) % world.bands.count
    let leftToRight = rng.next() < 0.5

    let band = world.bands[bandIndex]

    return Walker(
        x: leftToRight ? -walkerMargin : world.width + walkerMargin,
        y: bandCentre(band),
        band: band,
        dir: leftToRight ? 1 : -1,
        // The shadow leads the feet in, so the floor darkens before anything lands.
        warnFor: Config.Human.warningSeconds,
        walked: 0,
        lastStride: 0
    )
}

/// The schedule that decides when a human walks through.
public struct HumanSchedule: Sendable {
    public var timer: Double
    public var walker: Walker?

    public init(rng: RandomSource) {
        self.timer = nextDelay(Config.Human.everySeconds, rng)
        self.walker = nil
    }
}

extension HumanSchedule {
    /// Advances the schedule and any crossing in progress.
    @discardableResult
    public mutating func update(dt: Double, context: PredatorContext, rng: RandomSource) -> [HumanEvent] {
        var events: [HumanEvent] = []

        guard var walker else {
            timer -= dt
            if timer > 0 { return events }

            timer = nextDelay(Config.Human.everySeconds, rng)
            let started = startWalk(world: context.world, rng: rng)
            self.walker = started
            events.append(.approaching)
            return events
        }

        // The shadow holds for a moment before the feet actually arrive.
        if walker.warnFor > 0 {
            walker.warnFor = max(0, walker.warnFor - dt)
            self.walker = walker
            return events
        }

        let travelled = Config.Human.walkSpeed * dt
        walker.x += walker.dir * travelled
        walker.walked += travelled

        // A footfall every stride.
        if walker.walked - walker.lastStride >= Config.Human.strideLength {
            walker.lastStride = walker.walked
            events.append(.footfall(x: walker.x, y: walker.y))

            let onThisFloor = context.cricket.y >= walker.band.top && context.cricket.y <= walker.band.bottom
            let underfoot = hypot2(context.cricket.x - walker.x, context.cricket.y - walker.y) <= Config.Human.crushRadius

            // Furniture is the only thing that saves you. It is not looking, so
            // being airborne changes nothing: there is nowhere above a foot to be.
            if onThisFloor && underfoot && !context.hidden {
                events.append(.crush(x: walker.x, y: walker.y))
            }
        }

        if walker.x < -goneMargin || walker.x > context.world.width + goneMargin {
            self.walker = nil
            events.append(.gone)
        } else {
            self.walker = walker
        }

        return events
    }
}
