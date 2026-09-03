/// The house: a two-floor cross-section, drawn and played like a dollhouse.
///
/// It is built as the same shape a meadow is — bands of walkable ground, cover
/// to hide in, water to avoid — so every system that already works outdoors
/// works indoors without knowing it has moved. Only the cast changes: birds and
/// bats stay outside, and the cat and the human take their place.

// Positional layout literals from src/house.js that are not CONFIG keys.

/// The stairwell sits in the eastern half of the house, away from the door, so
/// crossing the ground floor is the price of reaching the safer upper floor.
private let stairXFraction = 0.58...0.82

/// Rejection sampling for furniture gives up after this many tries per piece,
/// the same generosity the meadow's cover loop allows itself.
private let furnitureAttemptsPerPiece = 400

/// How far in from the walls furniture keeps, beyond its own radius.
private let furnitureEdgeMargin = 20.0

/// Grass tufts in the meadow draw upward from their anchor; furniture has the
/// equivalent clearance above it so nothing pokes into the ceiling.
private let furnitureCeilingClearanceFactor = 1.1

/// Spills wander this far across the width of the ground floor...
private let spillXFraction = 0.3...0.85

/// ...and keep this far in from the ceiling and the floor below it.
private let spillYInset = 40.0

/// A spill's radius varies by this factor around `CONFIG.house.spillRadius`.
private let spillRadiusFactor = 0.8...1.3

/// A single zone furniture and water keep clear of: the stairwell, or the door.
private struct ClearZone {
    var x: Double
    var radius: Double
}

/// The two floors, as bands of walkable ground. Upstairs runs from `top` for
/// `floorHeight`; downstairs starts `ceilingGap` below upstairs' bottom. Their y
/// ranges are disjoint, which is what stops furniture upstairs from hiding
/// anything downstairs.
private func makeHouseBands() -> [Band] {
    let top = Config.House.top
    let floorHeight = Config.House.floorHeight
    let ceilingGap = Config.House.ceilingGap

    let upstairs = Band(top: top, bottom: top + floorHeight)
    let downstairs = Band(
        top: upstairs.bottom + ceilingGap,
        bottom: upstairs.bottom + ceilingGap + floorHeight
    )
    return [upstairs, downstairs]
}

/// Places furniture on a floor, keeping it clear of the stairwell and of the
/// doorway, so the cricket can always get in and always reach the stairs.
private func furnishFloor(_ world: inout World, band: Band, rng: RandomSource, keepClear: [ClearZone]) {
    let furniturePerFloor = Config.House.furniturePerFloor
    let furnitureMinRadius = Config.House.furnitureMinRadius
    let furnitureMaxRadius = Config.House.furnitureMaxRadius
    let furnitureMinSeparation = Config.House.furnitureMinSeparation

    var attempts = 0

    while attempts < furniturePerFloor * furnitureAttemptsPerPiece {
        attempts += 1
        let placed = world.cover.filter { $0.y >= band.top && $0.y <= band.bottom }
        if placed.count >= furniturePerFloor { break }

        let radius = furnitureMinRadius + rng.next() * (furnitureMaxRadius - furnitureMinRadius)
        let minY = band.top + radius * furnitureCeilingClearanceFactor
        let maxY = band.bottom - radius
        if minY >= maxY { break }

        let x = radius + furnitureEdgeMargin + rng.next() * (world.width - (radius + furnitureEdgeMargin) * 2)
        let y = minY + rng.next() * (maxY - minY)

        if keepClear.contains(where: { abs($0.x - x) < $0.radius + radius }) { continue }

        let tooClose = world.cover.contains { hypot2($0.x - x, $0.y - y) < furnitureMinSeparation }
        if tooClose { continue }

        let typeIndex = Int(rng.next() * Double(CoverType.furnitureTypes.count))
        world.cover.append(Cover(x: x, y: y, radius: radius, type: CoverType.furnitureTypes[typeIndex]))
    }
}

extension World {
    /// Builds a house. The doorway sits at the west wall of the ground floor,
    /// which is the side the meadow is on.
    public static func house(rng: RandomSource) -> World {
        let width = Config.House.width
        let height = Config.House.height
        let stairWidth = Config.House.stairWidth
        let doorWidth = Config.House.doorWidth
        let entryClearance = Config.House.entryClearance

        let bands = makeHouseBands()
        let upstairs = bands[0]
        let downstairs = bands[1]

        // The stairwell sits in the eastern half, away from the door, so
        // crossing the ground floor is the price of reaching the safer upper
        // floor.
        let stairX = width * (stairXFraction.lowerBound
            + rng.next() * (stairXFraction.upperBound - stairXFraction.lowerBound))
        let stairs = [Stair(x: stairX, width: stairWidth)]

        let door = Door(
            x: doorWidth,
            y: (downstairs.top + downstairs.bottom) / 2,
            width: doorWidth,
            height: Config.Doorway.height
        )

        var world = World(
            kind: .house,
            width: width, height: height, top: upstairs.top,
            bands: bands, stairs: stairs,
            door: door,
            cover: [], water: []
        )

        let keepClear = [
            ClearZone(x: stairX + stairWidth / 2, radius: stairWidth),
            ClearZone(x: door.x, radius: entryClearance),
        ]

        furnishFloor(&world, band: upstairs, rng: rng, keepClear: keepClear)
        furnishFloor(&world, band: downstairs, rng: rng, keepClear: keepClear)

        // A pet bowl and a spill, on the ground floor only. Water indoors
        // behaves exactly as it does outdoors: you walk round it or leap it.
        let spillCount = Config.House.spillCount
        let spillRadius = Config.House.spillRadius
        for _ in 0..<spillCount {
            let x = width * (spillXFraction.lowerBound
                + rng.next() * (spillXFraction.upperBound - spillXFraction.lowerBound))
            let y = downstairs.top + spillYInset
                + rng.next() * (downstairs.bottom - downstairs.top - spillYInset * 2)
            if abs(x - (stairX + stairWidth / 2)) < stairWidth { continue }
            world.water.append(Circle(
                x: x, y: y,
                radius: spillRadius * (spillRadiusFactor.lowerBound
                    + rng.next() * (spillRadiusFactor.upperBound - spillRadiusFactor.lowerBound))
            ))
        }

        return world
    }

    /// Where the cricket stands when it comes in from the meadow.
    public var houseEntry: Point {
        let downstairs = bands[bands.count - 1]
        return Point(
            x: door.x + Config.House.doorWidth,
            y: (downstairs.top + downstairs.bottom) / 2
        )
    }

    /// True when the cricket is standing in the doorway, on its way back out.
    public func atFrontDoor(x: Double, y: Double) -> Bool {
        let downstairs = bands[bands.count - 1]
        if y < downstairs.top || y > downstairs.bottom { return false }
        return x <= door.x + door.width / 2
    }
}
