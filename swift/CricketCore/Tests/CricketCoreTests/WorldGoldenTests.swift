import Testing
import Foundation
@testable import CricketCore

private struct GoldenCircle: Decodable { let x, y, radius: Double }
private struct GoldenCover: Decodable { let x, y, radius: Double; let type: String }
private struct GoldenDoor: Decodable { let x, y, width, height: Double }
private struct GoldenWorld: Decodable {
    let seed: Double
    let width, height, top: Double
    let door: GoldenDoor
    let cover: [GoldenCover]
    let water: [GoldenCircle]
}

private func loadGolden() throws -> GoldenWorld {
    let url = try #require(Bundle.module.url(forResource: "world-seed-7", withExtension: "json"))
    return try JSONDecoder().decode(GoldenWorld.self, from: Data(contentsOf: url))
}

/// Generous enough for accumulated Double error, far tighter than any real
/// porting mistake: a flipped comparison moves a tuft by tens of points.
private let tolerance = 1e-9

@Test func swiftMeadowMatchesTheJavaScriptMeadowForTheSameSeed() throws {
    let golden = try loadGolden()
    let world = World.meadow(rng: SeededRandom(seed: 7))

    #expect(world.width == golden.width)
    #expect(world.height == golden.height)
    #expect(abs(world.top - golden.top) < tolerance)
    #expect(abs(world.door.x - golden.door.x) < tolerance)
    #expect(abs(world.door.y - golden.door.y) < tolerance)
    #expect(abs(world.door.width - golden.door.width) < tolerance)
    #expect(abs(world.door.height - golden.door.height) < tolerance)

    #expect(world.cover.count == golden.cover.count)
    for (mine, theirs) in zip(world.cover, golden.cover) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
        #expect(mine.type.rawValue == theirs.type)
    }

    #expect(world.water.count == golden.water.count)
    for (mine, theirs) in zip(world.water, golden.water) {
        #expect(abs(mine.x - theirs.x) < tolerance)
        #expect(abs(mine.y - theirs.y) < tolerance)
        #expect(abs(mine.radius - theirs.radius) < tolerance)
    }
}
