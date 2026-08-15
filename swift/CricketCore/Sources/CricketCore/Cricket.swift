// The Swift standard library has no trig functions; `hypot` needs the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as Water.swift and World.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// What happened to the cricket this frame, for sound and score to react to.
public struct CricketEvents: Equatable, Sendable {
    public var startedSinging: Bool
    public var stoppedSinging: Bool
    public var startedJump: Bool
    public var landed: Bool
    public var startedStrike: Bool
    public var hidden: Bool

    public init(
        startedSinging: Bool, stoppedSinging: Bool, startedJump: Bool,
        landed: Bool, startedStrike: Bool, hidden: Bool
    ) {
        self.startedSinging = startedSinging
        self.stoppedSinging = stoppedSinging
        self.startedJump = startedJump
        self.landed = landed
        self.startedStrike = startedStrike
        self.hidden = hidden
    }
}

/// The player character: movement, singing, leaping and striking.
///
/// Singing and moving are mutually exclusive by design: holding the sing key
/// only sings while no direction is held, and pressing a direction mid-song
/// cancels it. That is the whole risk/reward core — the player has to commit
/// to a spot to score.
///
/// A leap is the other commitment. Once airborne the cricket cannot steer,
/// sing, cancel or re-jump; it rides the arc out. In exchange, being airborne
/// dodges a diving bird, which makes the leap the counterplay to a bird's cry.
public struct Cricket: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var dirX: Double
    public var dirY: Double
    public var moving: Bool
    public var singing: Bool
    public var songSeconds: Double
    public var invulnerableFor: Double

    public var jumping: Bool
    public var jumpProgress: Double
    public var jumpSeconds: Double
    public var jumpFromX: Double
    public var jumpFromY: Double
    public var jumpToX: Double
    public var jumpToY: Double
    public var jumpCooldown: Double
    public var jumpHeld: Bool

    public var strikeCooldown: Double
    public var strikeHeld: Bool
    public var swingFor: Double
    public var stunnedFor: Double

    public init(world: World) {
        let spawn = world.spawnPoint

        x = spawn.x
        y = spawn.y
        dirX = 1
        dirY = 0
        moving = false
        singing = false
        songSeconds = 0
        invulnerableFor = 0

        jumping = false
        jumpProgress = 0
        jumpSeconds = 0
        jumpFromX = spawn.x
        jumpFromY = spawn.y
        jumpToX = spawn.x
        jumpToY = spawn.y
        jumpCooldown = 0
        jumpHeld = false

        strikeCooldown = 0
        strikeHeld = false
        swingFor = 0
        stunnedFor = 0
    }

    /// Advances the player one frame. See the type's doc comment for the
    /// design rules this enforces.
    @discardableResult
    public mutating func update(intent: Intent, dt: Double, world: World) -> CricketEvents {
        let wasSinging = singing
        let wasJumping = jumping

        invulnerableFor = max(0, invulnerableFor - dt)
        strikeCooldown = max(0, strikeCooldown - dt)
        swingFor = max(0, swingFor - dt)
        stunnedFor = max(0, stunnedFor - dt)

        // A fresh press, not a held key: jumps never chain on their own.
        let jumpPressed = intent.jump == true
        let freshPress = jumpPressed && !jumpHeld
        jumpHeld = jumpPressed

        let strikePressed = intent.strike == true
        let freshStrike = strikePressed && !strikeHeld
        strikeHeld = strikePressed

        // A beetle's bite freezes the cricket outright: no moving, singing,
        // leaping or swinging until it shakes it off.
        if stunnedFor > 0 {
            singing = false
            moving = false
            songSeconds = 0

            return CricketEvents(
                startedSinging: false,
                stoppedSinging: wasSinging,
                startedJump: false,
                landed: wasJumping && !jumping,
                startedStrike: false,
                hidden: !jumping && world.isHidden(x: x, y: y)
            )
        }

        var startedStrike = false

        if jumping {
            jumpProgress = min(1, jumpProgress + dt / jumpSeconds)
            x = jumpFromX + (jumpToX - jumpFromX) * jumpProgress
            y = jumpFromY + (jumpToY - jumpFromY) * jumpProgress

            singing = false
            moving = false
            songSeconds = 0

            if jumpProgress >= 1 {
                jumping = false
                jumpCooldown = Config.Cricket.Jump.cooldownSeconds
            }
        } else {
            jumpCooldown = max(0, jumpCooldown - dt)

            if freshStrike && strikeCooldown <= 0 {
                swingFor = Config.Cricket.Strike.swingSeconds
                strikeCooldown = Config.Cricket.Strike.cooldownSeconds
                singing = false
                songSeconds = 0
                startedStrike = true
            }

            if freshPress && jumpCooldown <= 0 {
                startJump(intent: intent, world: world)
                singing = false
                moving = false
                songSeconds = 0
            } else {
                let magnitude = hypot2(intent.dx, intent.dy)
                let wantsToMove = magnitude > 0
                moving = wantsToMove
                // A swing in progress silences the cricket, so a scrap really
                // does break the song rather than the note resuming under the
                // player's held key.
                singing = intent.sing && !wantsToMove && swingFor <= 0

                if singing {
                    songSeconds += dt
                } else {
                    songSeconds = 0

                    if wantsToMove {
                        let nx = intent.dx / magnitude
                        let ny = intent.dy / magnitude
                        dirX = nx
                        dirY = ny
                        walk(world: world, nx: nx, ny: ny, dt: dt)
                    }
                }
            }
        }

        return CricketEvents(
            startedSinging: singing && !wasSinging,
            stoppedSinging: !singing && wasSinging,
            startedJump: jumping && !wasJumping,
            landed: wasJumping && !jumping,
            startedStrike: startedStrike,
            // Mid-air the cricket is above the grass, so cover cannot conceal it.
            hidden: !jumping && world.isHidden(x: x, y: y)
        )
    }

    /// Moves the cricket, stopping at the water's edge.
    ///
    /// A blocked move is retried on each axis alone, so walking into a bank at
    /// an angle slides along it rather than sticking fast.
    private mutating func walk(world: World, nx: Double, ny: Double, dt: Double) {
        let r = Config.Cricket.radius
        let step = Config.Cricket.speed * dt
        let dry = { (point: Point) in !world.isWater(x: point.x, y: point.y, margin: r) }

        let full = world.clampToBounds(x: x + nx * step, y: y + ny * step, radius: r)
        if dry(full) {
            x = full.x
            y = full.y
            return
        }

        let alongX = world.clampToBounds(x: x + nx * step, y: y, radius: r)
        if nx != 0 && dry(alongX) {
            x = alongX.x
            y = alongX.y
            return
        }

        let alongY = world.clampToBounds(x: x, y: y + ny * step, radius: r)
        if ny != 0 && dry(alongY) {
            x = alongY.x
            y = alongY.y
        }
    }

    /// Picks a landing spot for a leap with no cover to aim at.
    ///
    /// It looks outward along the hop direction for the first dry ground: at a
    /// narrow stretch of stream that clears it, and at a wide one it runs out
    /// of range and the cricket stops at the near bank instead of drowning.
    private func dryLanding(world: World, dirX: Double, dirY: Double) -> Point {
        let fallbackDistance = Config.Cricket.Jump.fallbackDistance
        let range = Config.Cricket.Jump.range
        let r = Config.Cricket.radius
        // The stride the outward (and, failing that, inward) search takes
        // between candidate landing spots.
        let searchStep = 12.0
        let at = { (distance: Double) in
            world.clampToBounds(x: x + dirX * distance, y: y + dirY * distance, radius: r)
        }

        var distance = fallbackDistance
        while distance <= range {
            let candidate = at(distance)
            if !world.isWater(x: candidate.x, y: candidate.y, margin: r) { return candidate }
            distance += searchStep
        }

        // Nothing dry ahead: pull back to the last dry step short of the water.
        distance = fallbackDistance - searchStep
        while distance > 0 {
            let candidate = at(distance)
            if !world.isWater(x: candidate.x, y: candidate.y, margin: r) { return candidate }
            distance -= searchStep
        }

        return Point(x: x, y: y)
    }

    /// Aims a leap and commits the cricket to it.
    ///
    /// The target is the nearest cover in the held direction, excluding
    /// whatever the cricket is standing in so a jump always goes somewhere.
    /// With no cover in range it is a plain hop forward rather than a refused
    /// input.
    private mutating func startJump(intent: Intent, world: World) {
        typealias Jump = Config.Cricket.Jump

        let magnitude = hypot2(intent.dx, intent.dy)
        let aimX = magnitude > 0 ? intent.dx / magnitude : 0
        let aimY = magnitude > 0 ? intent.dy / magnitude : 0

        let target = world.nearestCover(
            x: x, y: y,
            maxDistance: Jump.range,
            dirX: aimX, dirY: aimY,
            exclude: world.coverAt(x: x, y: y)
        )

        let destination: Point
        if let target {
            // Cover only ever grows on dry ground, so a cover target is always safe.
            destination = world.clampToBounds(x: target.x, y: target.y, radius: Config.Cricket.radius)
        } else {
            // Fall back to the held direction, or to whichever way the cricket faces.
            let hopX = magnitude > 0 ? aimX : dirX
            let hopY = magnitude > 0 ? aimY : dirY
            destination = dryLanding(world: world, dirX: hopX, dirY: hopY)
        }

        let distance = hypot2(destination.x - x, destination.y - y)

        jumping = true
        jumpProgress = 0
        jumpSeconds = min(Jump.maxSeconds, max(Jump.minSeconds, distance / Jump.speed))
        jumpFromX = x
        jumpFromY = y
        jumpToX = destination.x
        jumpToY = destination.y

        if distance > 0 {
            dirX = (destination.x - x) / distance
            dirY = (destination.y - y) / distance
        }
    }
}
