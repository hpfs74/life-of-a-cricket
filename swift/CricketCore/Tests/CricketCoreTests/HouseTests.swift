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
