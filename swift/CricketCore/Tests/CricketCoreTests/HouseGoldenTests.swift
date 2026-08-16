import Testing
import Foundation
@testable import CricketCore

private struct GoldenCircle: Decodable { let x, y, radius: Double }
private struct GoldenCover: Decodable { let x, y, radius: Double; let type: String }
private struct GoldenDoor: Decodable { let x, y, width, height: Double }
private struct GoldenBand: Decodable { let top, bottom: Double }
private struct GoldenStair: Decodable { let x, width: Double }
private struct GoldenHouse: Decodable {
    let seed: Double
    let width, height, top: Double
    let bands: [GoldenBand]
    let stairs: [GoldenStair]
    let door: GoldenDoor
    let cover: [GoldenCover]
    let water: [GoldenCircle]
}

private func loadGolden() throws -> GoldenHouse {
    let url = try #require(Bundle.module.url(forResource: "house-seed-7", withExtension: "json"))
    return try JSONDecoder().decode(GoldenHouse.self, from: Data(contentsOf: url))
}

/// Generous enough for accumulated Double error, far tighter than any real
/// porting mistake: a flipped comparison moves a piece of furniture by tens
/// of points.
private let tolerance = 1e-9

@Test func swiftHouseMatchesTheJavaScriptHouseForTheSameSeed() throws {
    let golden = try loadGolden()
    let house = World.house(rng: SeededRandom(seed: 7))

    #expect(house.width == golden.width)
    #expect(house.height == golden.height)
    #expect(abs(house.top - golden.top) < tolerance)

    #expect(abs(house.door.x - golden.door.x) < tolerance)
    #expect(abs(house.door.y - golden.door.y) < tolerance)
    #expect(abs(house.door.width - golden.door.width) < tolerance)
    #expect(abs(house.door.height - golden.door.height) < tolerance)

    // Assert counts BEFORE any `zip`: `zip` stops at the shorter sequence, so
    // without this a truncated array would pass silently.
    #expect(house.bands.count == golden.bands.count)
    for (mine, theirs) in zip(house.bands, golden.bands) {
        #expect(abs(mine.top - theirs.top) < tolerance)
        #expect(abs(mine.bottom - theirs.bottom) < tolerance)
    }

    #expect(house.stairs.count == golden.stairs.count)
    for (mine, theirs) in zip(house.stairs, golden.stairs) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.width - theirs.width) < tolerance)
    }

    #expect(house.cover.count == golden.cover.count)
    for (mine, theirs) in zip(house.cover, golden.cover) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
        #expect(mine.type.rawValue == theirs.type)
    }

    #expect(house.water.count == golden.water.count)
    for (mine, theirs) in zip(house.water, golden.water) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
    }
}
