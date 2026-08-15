/// The kinds of food that can appear in the meadow.
///
/// Values and radii come from `CONFIG.food.types` in `src/config.js`; per
/// ruling R2 they live here on the enum rather than in `Config`, since they
/// are kind-keyed rather than a single tunable number.
public enum FoodType: String, CaseIterable, Sendable {
    case seed, lettuce, berry, aphid, grub

    public var value: Double {
        switch self {
        case .seed: return 25
        case .lettuce: return 45
        case .berry: return 60
        case .aphid: return 120
        // Only ever left behind by a killed bug, never spawned by the meadow.
        case .grub: return 90
        }
    }

    public var radius: Double {
        switch self {
        case .seed: return 6
        case .lettuce: return 12
        case .berry: return 9
        case .aphid: return 7
        case .grub: return 8
        }
    }

    /// Types the meadow spawns on its own. Grubs exist too, but they are left
    /// behind by a killed bug and never appear on their own.
    public static let natural: [FoodType] = [.seed, .lettuce, .berry, .aphid]
}

/// One piece of food on the ground.
public struct FoodItem: Equatable, Identifiable, Sendable {
    public let id: UInt64
    public var x: Double
    public var y: Double
    public let type: FoodType
    public var age: Double
    public var settleFor: Double
    public var value: Double
    public var radius: Double

    /// True once an item has settled and can be picked up.
    public var isEdible: Bool { settleFor <= 0 }

    public init(id: UInt64, type: FoodType, x: Double, y: Double, settleFor: Double = 0) {
        self.id = id
        self.x = x
        self.y = y
        self.type = type
        self.age = 0
        self.settleFor = settleFor
        self.value = type.value
        self.radius = type.radius
    }
}

/// The food scattered across the meadow: ages existing items, spawns new ones
/// up to a cap, and lets the cricket eat what has settled.
public struct FoodField: Sendable {
    public var items: [FoodItem]
    public var timer: Double
    private var nextID: UInt64

    public init(items: [FoodItem] = [], timer: Double = 0) {
        self.items = items
        self.timer = timer
        self.nextID = 0
    }

    private mutating func makeID() -> UInt64 {
        defer { nextID += 1 }
        return nextID
    }

    /// Ages existing food and spawns a new item once per interval, up to the
    /// cap. Food only appears in the open meadow so the player has to leave
    /// cover for it.
    public mutating func update(dt: Double, world: World, rng: RandomSource) {
        for index in items.indices {
            items[index].age += dt
            items[index].settleFor = max(0, items[index].settleFor - dt)
        }

        timer += dt

        while timer >= Config.Food.spawnIntervalSeconds {
            timer -= Config.Food.spawnIntervalSeconds
            // The JS uses `continue` here, not `break`, so the timer still
            // drains fully while the field is full.
            if items.count >= Config.Food.maxOnScreen { continue }

            let natural = FoodType.natural
            let type = natural[Int(rng.next() * Double(natural.count)) % natural.count]
            let point = world.randomOpenPoint(rng: rng, minDistanceFromCover: type.radius + 12)

            items.append(FoodItem(id: makeID(), type: type, x: point.x, y: point.y))
        }
    }

    /// Removes and returns every item the cricket is standing close enough to eat.
    @discardableResult
    public mutating func consume(cricketX: Double, cricketY: Double) -> [FoodItem] {
        var eaten: [FoodItem] = []
        var remaining: [FoodItem] = []

        for item in items {
            let dx = item.x - cricketX
            let dy = item.y - cricketY
            if item.isEdible && (dx * dx + dy * dy).squareRoot() <= Config.Food.eatRadius {
                eaten.append(item)
            } else {
                remaining.append(item)
            }
        }

        items = remaining
        return eaten
    }

    /// Puts an item on the ground regardless of the on-screen cap. Drops are
    /// earned, so a full meadow must never swallow one.
    @discardableResult
    public mutating func drop(_ type: FoodType, x: Double, y: Double) -> FoodItem {
        let item = FoodItem(id: makeID(), type: type, x: x, y: y, settleFor: Config.Food.dropSettleSeconds)
        items.append(item)
        return item
    }

    /// Removes a specific item by id, e.g. when a rival eats it first.
    @discardableResult
    public mutating func remove(id: UInt64) -> FoodItem? {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return nil }
        return items.remove(at: index)
    }
}
