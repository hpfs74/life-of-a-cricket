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

@Test func theCameraFollowsTheSameElapsedTimeRegardlessOfFrameRate() {
    let world = World.meadow(rng: SeededRandom(seed: 7))
    let target = Point(x: 1500, y: 400)
    let totalSeconds = 0.5

    // Two very different step sizes covering the same total elapsed time.
    // A per-frame catch-up that scaled linearly with dt (rather than the
    // exponential decay the doc comment promises) would land these two at
    // different positions, since the same total time would then be chopped
    // into a different number of discrete corrections.
    var coarse = Camera(world: world, target: Point(x: 500, y: 400))
    let coarseDt = 1.0 / 10
    for _ in 0..<Int((totalSeconds / coarseDt).rounded()) {
        coarse.update(target: target, world: world, dt: coarseDt)
    }

    var fine = Camera(world: world, target: Point(x: 500, y: 400))
    let fineDt = 1.0 / 240
    for _ in 0..<Int((totalSeconds / fineDt).rounded()) {
        fine.update(target: target, world: world, dt: fineDt)
    }

    #expect(abs(coarse.x - fine.x) < 1e-6, "coarse=\(coarse.x) fine=\(fine.x)")
}
