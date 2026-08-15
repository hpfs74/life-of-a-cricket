import Testing
@testable import CricketCore

@Test func theCameraOpensAlreadyFramingTheCricket() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    let target = Point(x: 1500, y: 400)
    let camera = Camera(world: world, target: target)
    #expect(abs(camera.x - (1500 - Config.View.width / 2)) < 1e-9)
}

@Test func theCameraStopsAtEitherEndOfTheWorld() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    #expect(Camera(world: world, target: Point(x: 0, y: 400)).x == 0)
    #expect(Camera(world: world, target: Point(x: world.width, y: 400)).x == cameraLimit(world))
}

@Test func theCameraEasesTowardTheTargetAndSettlesExactly() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    var camera = Camera(world: world, target: Point(x: 500, y: 400))
    let target = Point(x: 1500, y: 400)

    for _ in 0..<600 { camera.update(target: target, world: world, dt: 1.0 / 60) }

    #expect(camera.x == 1500 - Config.View.width / 2)
}
