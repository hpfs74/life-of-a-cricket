/// A world is divided into horizontal bands of walkable ground.
///
/// The meadow has one, from the horizon to the bottom of the screen. A house has
/// two, stacked, with a ceiling between them. A stairwell is an x-range where two
/// bands join into one tall corridor.
///
/// Modelling floors this way means nothing else has to know about them: cover,
/// water and hit-testing already work on absolute coordinates, and because bands
/// occupy disjoint y ranges, furniture upstairs cannot hide anything downstairs.

// The Swift standard library has no trig functions; `sin`/`cos` need the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as Water.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

public enum StageKind: String, Sendable {
    case meadow, house
}

public enum CoverType: String, CaseIterable, Sendable {
    case grass, rock, leaf, sofa, chair, table, plant, box, bed

    public static let meadowTypes: [CoverType] = [.grass, .rock, .leaf]
    public static let furnitureTypes: [CoverType] = [.sofa, .chair, .table, .plant, .box, .bed]
}

public struct Band: Equatable, Sendable {
    public var top: Double
    public var bottom: Double
    public init(top: Double, bottom: Double) {
        self.top = top; self.bottom = bottom
    }
}

public struct Stair: Equatable, Sendable {
    public var x: Double
    public var width: Double
    public init(x: Double, width: Double) {
        self.x = x; self.width = width
    }
}

public struct Door: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }
}

public struct Cover: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var radius: Double
    public var type: CoverType
    public init(x: Double, y: Double, radius: Double, type: CoverType) {
        self.x = x; self.y = y; self.radius = radius; self.type = type
    }
}

public struct World: Equatable, Sendable {
    public var kind: StageKind
    public var width: Double
    public var height: Double
    public var top: Double
    public var bands: [Band]
    public var stairs: [Stair]
    public var door: Door
    public var cover: [Cover]
    public var water: [Circle]

    public init(
        kind: StageKind, width: Double, height: Double, top: Double,
        bands: [Band], stairs: [Stair], door: Door, cover: [Cover], water: [Circle]
    ) {
        self.kind = kind
        self.width = width; self.height = height; self.top = top
        self.bands = bands; self.stairs = stairs
        self.door = door
        self.cover = cover; self.water = water
    }
}

// Positional layout literals from src/world.js that are not CONFIG keys.

/// The meadow's door sits this far down the playable band, as a fraction of its
/// height, so it lines up with the house drawn beyond the east edge.
private let meadowDoorYFraction = 0.62

/// Grass tufts draw upward from their anchor, so they need extra clearance above
/// the anchor — more than their bare radius — to stay out of the sky.
private let grassSkyClearanceFactor = 1.35

extension World {
    /// Builds the meadow. `top` is the horizon: everything above it is sky, and
    /// the band below it is the playable field. Cover is rejection-sampled so no
    /// two pieces merge into one unreadable blob, none of it drifts up into the
    /// sky, and none lands on the spawn point — a run always starts in the open,
    /// exposed and scoring.
    public static func meadow(rng: RandomSource) -> World {
        let width = Config.World.width
        let height = Config.World.height
        let top = height * Config.World.horizonFraction

        let door = Door(
            x: width - Config.Doorway.width / 2,
            y: top + (height - top) * meadowDoorYFraction,
            width: Config.Doorway.width,
            height: Config.Doorway.height
        )

        var world = World(
            kind: .meadow,
            width: width, height: height, top: top,
            // One band of ground, and no stairs: the meadow is a one-floor world.
            bands: [Band(top: top, bottom: height)],
            stairs: [],
            door: door,
            cover: [], water: []
        )

        world.water = createWater(bounds: WaterBounds(width: width, height: height, top: top), rng: rng)
        let spawn = world.spawnPoint

        let coverCount = Config.World.coverCount
        let coverMinRadius = Config.World.coverMinRadius
        let coverMaxRadius = Config.World.coverMaxRadius
        let coverMinSeparation = Config.World.coverMinSeparation
        let spawnClearance = Config.World.spawnClearance
        let edgeMargin = Config.World.edgeMargin

        var attempts = 0
        while world.cover.count < coverCount && attempts < coverCount * 400 {
            attempts += 1

            let radius = coverMinRadius + rng.next() * (coverMaxRadius - coverMinRadius)

            // Grass tufts draw upward from their anchor, so they need clearance
            // above the anchor to stay out of the sky.
            let minY = top + radius * grassSkyClearanceFactor
            let maxY = height - radius
            if minY >= maxY { continue }

            let minX = max(radius, edgeMargin)
            let x = minX + rng.next() * (width - minX * 2)
            let y = minY + rng.next() * (maxY - minY)

            if hypot2(spawn.x - x, spawn.y - y) < radius + spawnClearance { continue }

            // Leave the doorway approach clear, so the way indoors is never
            // walled off.
            if hypot2(world.door.x - x, world.door.y - y) < radius + Config.Doorway.width * 2 { continue }

            // Cover grows on dry ground.
            if isWaterAt(world.water, x: x, y: y, margin: radius) { continue }

            let tooClose = world.cover.contains { hypot2($0.x - x, $0.y - y) < coverMinSeparation }
            if tooClose { continue }

            let typeIndex = Int(rng.next() * Double(CoverType.meadowTypes.count))
            world.cover.append(Cover(x: x, y: y, radius: radius, type: CoverType.meadowTypes[typeIndex]))
        }

        return world
    }

    /// The point every run starts from: the middle of the playable ground.
    public var spawnPoint: Point {
        Point(x: width / 2, y: top + (height - top) / 2)
    }

    /// True when the cricket is standing in a doorway — the east door of the
    /// meadow, or the front door of a house. Either one moves it between stages.
    public func atDoorway(x: Double, y: Double) -> Bool {
        let withinX = kind == .house
            ? x <= door.x + door.width / 2
            : x >= door.x - door.width / 2

        return withinX && abs(y - door.y) <= door.height / 2
    }

    /// True when this x sits inside a stairwell, where the bands join up.
    public func inStairwell(x: Double) -> Bool {
        stairs.contains { x >= $0.x && x <= $0.x + $0.width }
    }

    /// The band of walkable ground at a point: the one containing `y`, or the
    /// whole height when standing in a stairwell. Falls back to the nearest band
    /// if `y` is inside a ceiling, so nothing can be trapped between floors.
    public func bandAt(x: Double, y: Double) -> Band {
        let effectiveBands = bands.isEmpty ? [Band(top: top, bottom: height)] : bands

        if inStairwell(x: x) {
            return Band(top: effectiveBands[0].top, bottom: effectiveBands[effectiveBands.count - 1].bottom)
        }

        if let containing = effectiveBands.first(where: { y >= $0.top && y <= $0.bottom }) {
            return containing
        }

        return effectiveBands.reduce(effectiveBands[0]) { best, band in
            let distance = min(abs(y - band.top), abs(y - band.bottom))
            let bestDistance = min(abs(y - best.top), abs(y - best.bottom))
            return distance < bestDistance ? band : best
        }
    }

    /// Keeps a body inside the walkable ground: never up in the sky outdoors,
    /// and never through a ceiling indoors.
    public func clampToBounds(x: Double, y: Double, radius: Double) -> Point {
        let band = bandAt(x: x, y: y)
        return Point(
            x: min(max(x, radius), width - radius),
            y: min(max(y, band.top + radius), band.bottom - radius)
        )
    }

    /// True when a body of the given radius would be standing in water.
    public func isWater(x: Double, y: Double, margin: Double = 0) -> Bool {
        isWaterAt(water, x: x, y: y, margin: margin)
    }

    /// Walks outward from a point until it finds somewhere a body of `radius`
    /// can legally stand: on the map, out of the water, and clear of anything
    /// `avoid` rejects. Used to rescue the cricket when the terrain changes
    /// underneath it.
    public func nearestDryPoint(
        x: Double, y: Double, radius: Double,
        avoid: (Double, Double) -> Bool = { _, _ in false }
    ) -> Point {
        let start = clampToBounds(x: x, y: y, radius: radius)
        if !isWater(x: start.x, y: start.y, margin: radius) && !avoid(start.x, start.y) { return start }

        for ring in 1...26 {
            let distance = Double(ring) * 26
            let steps = ring * 8

            for i in 0..<steps {
                let angle = (Double(i) / Double(steps)) * Double.pi * 2
                let candidate = clampToBounds(
                    x: x + cos(angle) * distance,
                    y: y + sin(angle) * distance,
                    radius: radius
                )
                if !isWater(x: candidate.x, y: candidate.y, margin: radius) && !avoid(candidate.x, candidate.y) {
                    return candidate
                }
            }
        }

        return spawnPoint
    }

    public func coverAt(x: Double, y: Double) -> Cover? {
        for item in cover {
            if hypot2(item.x - x, item.y - y) <= item.radius { return item }
        }
        return nil
    }

    public func isHidden(x: Double, y: Double) -> Bool {
        coverAt(x: x, y: y) != nil
    }

    /// Picks the cover a jump should land on.
    ///
    /// A held direction narrows the search to a cone, so the player steers the
    /// leap rather than always being pulled to whatever happens to be closest.
    /// If nothing lies inside that cone the search widens to everything in
    /// range — better to leap somewhere useful than to refuse the input.
    public func nearestCover(
        x: Double, y: Double,
        maxDistance: Double = .infinity,
        dirX: Double = 0, dirY: Double = 0,
        halfAngleDegrees: Double = Config.Cricket.Jump.halfAngleDegrees,
        exclude: Cover? = nil
    ) -> Cover? {
        let inRange = cover
            .filter { $0 != exclude }
            .map { (item: $0, distance: hypot2($0.x - x, $0.y - y)) }
            .filter { $0.distance <= maxDistance }

        if inRange.isEmpty { return nil }

        func closest(_ candidates: [(item: Cover, distance: Double)]) -> Cover {
            candidates.reduce(candidates[0]) { best, candidate in
                candidate.distance < best.distance ? candidate : best
            }.item
        }

        let magnitude = hypot2(dirX, dirY)
        if magnitude == 0 { return closest(inRange) }

        let cosLimit = cos(halfAngleDegrees * Double.pi / 180)
        let inCone = inRange.filter { candidate in
            if candidate.distance == 0 { return true }
            let dot = ((candidate.item.x - x) * dirX + (candidate.item.y - y) * dirY)
                / (candidate.distance * magnitude)
            return dot >= cosLimit
        }

        return closest(inCone.isEmpty ? inRange : inCone)
    }

    /// Finds a point in the open ground, at least `minDistanceFromCover` away
    /// from every piece of cover, so food never spawns somewhere the player can
    /// eat it without ever leaving safety. Falls back to the last candidate if
    /// the meadow is unusually crowded, which keeps spawning from stalling the
    /// game.
    public func randomOpenPoint(rng: RandomSource, minDistanceFromCover: Double = 0) -> Point {
        let margin = Config.World.edgeMargin
        let minY = top + margin
        var candidate = spawnPoint

        for _ in 0..<60 {
            candidate = Point(
                x: margin + rng.next() * (width - margin * 2),
                y: minY + rng.next() * (height - margin - minY)
            )

            if isWaterAt(water, x: candidate.x, y: candidate.y, margin: minDistanceFromCover) { continue }

            let clear = cover.allSatisfy {
                hypot2($0.x - candidate.x, $0.y - candidate.y) > $0.radius + minDistanceFromCover
            }
            if clear { return candidate }
        }

        return candidate
    }
}
