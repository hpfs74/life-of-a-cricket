// The Swift standard library has no trig functions; `cos`/`sin` need the
// platform's libm. This is the platform C library, not Foundation, so it stays
// within the "stdlib only" constraint. Same shim as World.swift and Rivals.swift.
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Where a run is: waiting to start, running, or finished.
public enum Phase: Sendable {
    case menu, playing, gameOver
}

/// Ramps linearly from 1 to the cap over the ramp window, then holds.
public func difficultyAt(_ elapsedSeconds: Double) -> Double {
    let progress = min(1, elapsedSeconds / Config.Game.difficultyRampSeconds)
    return 1 + (Config.Game.difficultyMax - 1) * progress
}

// Positional literals from src/game.js that are not CONFIG keys.

/// How far apart a corpse's drops are scattered, in points, so a beetle's pair
/// does not stack into one crumb. From src/game.js:133.
private let grubScatterSpread = 14.0

/// Coming back out of the house, the cricket arrives this many doorway widths
/// west of the meadow's door — just short of it, so it does not immediately
/// walk back in. From src/game.js:310.
private let doorStepBackWidths = 1.6

extension BirdKind {
    /// Which `Threat` this predator strikes as. In the JavaScript the bird's
    /// `kind` string is used directly as the hit's `from` field; here the two
    /// enums are distinct, so the mapping is explicit.
    var threat: Threat {
        switch self {
        case .bird: return .bird
        case .bat: return .bat
        }
    }
}

/// The whole simulation: the state machine, the wave director, and the event
/// stream the presentation layer reads.
///
/// The game never draws and never plays audio — it only reports what happened.
/// The order of operations in `update` is load-bearing: later steps read state
/// earlier ones wrote, so it follows `src/game.js` step for step.
public struct Game {
    public let store: HighScoreStore
    public let rng: RandomSource

    public var phase: Phase
    public var world: World
    public var cricket: Cricket
    public var birds: [Bird]
    public var food: FoodField
    public var rivals: [Rival]
    public var spiders: [Spider]
    public var score: Score
    public var attention: Attention
    public var lives: Int
    public var elapsed: Double
    public var day: Int
    public var night: Bool
    public var stage: StageKind
    public var stageCooldown: Double
    /// Indoor residents. Both are nil outdoors.
    public var cat: Cat?
    public var humans: HumanSchedule?
    public var shiftedFor: Double
    public var rivalRespawnTimer: Double
    public var patrolTimer: Double
    public var hidden: Bool
    public var newRecord: Bool

    public init(store: HighScoreStore, rng: RandomSource) {
        self.store = store
        self.rng = rng

        let world = World.meadow(rng: rng)

        self.phase = .menu
        self.world = world
        self.cricket = Cricket(world: world)
        self.birds = []
        self.food = FoodField()
        self.rivals = createRivals(world: world, rng: rng)
        self.spiders = createSpiders(world: world, rng: rng, keepAwayFrom: nil)
        self.score = Score(highScore: store.load())
        self.attention = Attention()
        self.lives = Config.Game.startingLives
        self.elapsed = 0
        self.day = 1
        self.night = false
        self.stage = .meadow
        self.stageCooldown = 0
        self.cat = nil
        self.humans = nil
        self.shiftedFor = 0
        self.rivalRespawnTimer = 0
        self.patrolTimer = 0
        self.hidden = false
        self.newRecord = false
    }

    /// Wipes the board and starts a fresh run. Everything resets but the high
    /// score, which outlives any single cricket.
    public mutating func startRun() {
        let highScore = score.highScore

        phase = .playing
        world = World.meadow(rng: rng)
        cricket = Cricket(world: world)
        birds = []
        food = FoodField()
        rivals = createRivals(world: world, rng: rng)
        spiders = createSpiders(world: world, rng: rng, keepAwayFrom: nil)
        score = Score(highScore: highScore)
        attention = Attention()
        lives = Config.Game.startingLives
        elapsed = 0
        day = 1
        night = false
        stage = .meadow
        stageCooldown = 0
        cat = nil
        humans = nil
        shiftedFor = 0
        rivalRespawnTimer = 0
        patrolTimer = 0
        hidden = false
        newRecord = false
    }

    /// Moves the cricket into a new world, taking its inhabitants with it.
    ///
    /// Score, lives and the day carry across untouched: going indoors is a
    /// change of scene in one cricket's life, not a new run.
    private mutating func changeStage(
        to stage: StageKind, world newWorld: World, arrival: Point, events: inout [GameEvent]
    ) {
        self.stage = stage
        self.world = newWorld
        stageCooldown = Config.Game.stageCooldownSeconds

        cricket.x = arrival.x
        cricket.y = arrival.y
        cricket.jumping = false
        cricket.jumpProgress = 0
        cricket.stunnedFor = 0

        // Nothing follows the cricket through a doorway.
        birds = []
        // R3: `keepAwayFrom` is a point, so the cricket's position stands in for
        // the cricket itself.
        spiders = createSpiders(world: newWorld, rng: rng, keepAwayFrom: Point(x: cricket.x, y: cricket.y))
        rivals = createRivals(world: newWorld, rng: rng)
        food = FoodField()
        patrolTimer = 0
        rivalRespawnTimer = 0

        // The house has its own cast; the meadow has none of it.
        let indoors = stage == .house
        cat = indoors ? Cat(world: newWorld, rng: rng) : nil
        humans = indoors ? HumanSchedule(rng: rng) : nil

        events.append(.stageChange(stage: stage))
    }

    /// Resolves a swing: damage, the corpse's drop, and the beetle's answer.
    ///
    /// Swinging is loud, so it feeds the same attention meter singing does — a
    /// long scrap summons predators exactly like a long note.
    private mutating func swing(into events: inout [GameEvent]) {
        let result = resolveStrike(cricket: cricket, rivals: &rivals)
        events.append(.strike(connected: result.hit != nil))

        attention.value = min(1, attention.value + Config.Attention.perStrike)

        guard let hit = result.hit else { return }

        if result.killed {
            let drops = hit.kind.drops
            for i in 0..<drops {
                // Scatter multiples so a beetle's pair does not stack into one crumb.
                let angle = (Double(i) / Double(drops)) * Double.pi * 2
                let spread = drops > 1 ? grubScatterSpread : 0
                let where_ = world.clampToBounds(
                    x: hit.x + cos(angle) * spread,
                    y: hit.y + sin(angle) * spread,
                    radius: FoodType.grub.radius
                )
                food.drop(.grub, x: where_.x, y: where_.y)
            }
            events.append(.bugKilled(kind: hit.kind, drops: drops))
            return
        }

        events.append(.bugHit(kind: hit.kind))

        if result.retaliated {
            cricket.stunnedFor = Config.Rivals.biteStunSeconds

            // A shove backwards, so the bite reads as contact rather than a freeze.
            let shoved = world.clampToBounds(
                x: cricket.x - cricket.dirX * Config.Rivals.biteKnockback,
                y: cricket.y - cricket.dirY * Config.Rivals.biteKnockback,
                radius: Config.Cricket.radius
            )
            if !world.isWater(x: shoved.x, y: shoved.y, margin: Config.Cricket.radius) {
                cricket.x = shoved.x
                cricket.y = shoved.y
            }

            events.append(.stunned(kind: hit.kind))
        }
    }

    /// Rebuilds the meadow when a new day turns over: the grass moves, the
    /// stream finds a new course and the spiders take new tufts.
    ///
    /// Nothing here is allowed to bury the cricket. Spiders keep clear of
    /// wherever it is standing, any leap in progress is cancelled so it cannot
    /// land somewhere that no longer exists, and the cricket itself is walked to
    /// the nearest safe dry ground if the new terrain arrived on top of it.
    private mutating func reshuffleMeadow(into events: inout [GameEvent]) {
        world = World.meadow(rng: rng)
        spiders = createSpiders(world: world, rng: rng, keepAwayFrom: Point(x: cricket.x, y: cricket.y))
        rivals = createRivals(world: world, rng: rng)

        let meadow = world
        food.items = food.items.filter { !meadow.isWater(x: $0.x, y: $0.y) }

        // Bound before the call so the closure captures a plain array rather
        // than `self`, which is already exclusively accessed by this method.
        let tufts = spiders
        let safe = meadow.nearestDryPoint(
            x: cricket.x, y: cricket.y, radius: Config.Cricket.radius,
            avoid: { x, y in
                tufts.contains { hypot2($0.homeX - x, $0.homeY - y) <= $0.cover.radius }
            }
        )
        cricket.x = safe.x
        cricket.y = safe.y

        cricket.jumping = false
        cricket.jumpProgress = 0

        shiftedFor = Config.Game.shiftCaptionSeconds
        events.append(.newDay(day: day))
    }

    /// Applies one hit on the cricket, from whatever caught it. Returns false if
    /// the cricket was still inside its mercy window and the hit did not land.
    @discardableResult
    private mutating func takeHit(from threat: Threat, into events: inout [GameEvent]) -> Bool {
        if cricket.invulnerableFor > 0 { return false }

        lives -= 1
        cricket.invulnerableFor = Config.Cricket.invulnerableSeconds
        score.breakSong()
        attention.reset()
        events.append(.hit(from: threat))
        return true
    }

    /// Advances the whole simulation one frame and returns the events the
    /// presentation layer cares about.
    @discardableResult
    public mutating func update(intent: Intent, dt: Double) -> [GameEvent] {
        guard phase == .playing else { return [] }

        var events: [GameEvent] = []
        elapsed += dt
        night = isNight(elapsed)
        shiftedFor = max(0, shiftedFor - dt)

        stageCooldown = max(0, stageCooldown - dt)

        let previousDay = day
        day = dayAt(elapsed)
        // Houses do not rearrange themselves overnight; meadows do.
        if day != previousDay && stage == .meadow { reshuffleMeadow(into: &events) }

        let cricketEvents = cricket.update(intent: intent, dt: dt, world: world)
        hidden = cricketEvents.hidden

        if cricketEvents.startedSinging { events.append(.songStart) }
        if cricketEvents.stoppedSinging {
            score.breakSong()
            events.append(.songBreak)
        }
        if cricketEvents.startedJump { events.append(.jump) }
        if cricketEvents.landed { events.append(.land) }
        if cricketEvents.startedStrike { swing(into: &events) }

        // Singing from cover is loud but scores nothing — cover is safety, not points.
        let scoringSong = cricket.singing && !hidden
        if scoringSong { score.tickSong(dt: dt) }
        score.tickFed(dt: dt)

        let spawned = attention.tick(singing: cricket.singing, dt: dt)
        let difficulty = difficultyAt(elapsed)

        // Birds also patrol on their own schedule, so silence is quieter but
        // never safe. The patrol clock speeds up with difficulty.
        patrolTimer += dt
        let patrolInterval = Config.Game.patrolIntervalSeconds / difficulty
        var patrols = 0
        while patrolTimer >= patrolInterval {
            patrolTimer -= patrolInterval
            patrols += 1
        }

        // Birds hunt the meadow by day; bats take the night shift. Neither comes
        // indoors — the house has its own cast.
        let kind: BirdKind = night ? .bat : .bird
        let aerialHunting = stage == .meadow

        if aerialHunting {
            for _ in 0..<(spawned + patrols) {
                if birds.count >= Config.Bird.maxAlive { break }
                let bird = Bird.spawn(
                    world: world, rng: rng, difficulty: difficulty, kind: kind,
                    focus: Point(x: cricket.x, y: cricket.y)
                )
                birds.append(bird)
                events.append(.birdSpawn(kind: kind))
            }
        }

        food.update(dt: dt, world: world, rng: rng)
        // A cricket in mid-leap flies over food rather than eating it.
        if !cricket.jumping {
            for item in food.consume(cricketX: cricket.x, cricketY: cricket.y) {
                score.eat(value: item.value)
                events.append(.ate(item))
            }
        }

        // The cricket gets first claim each frame; the rivals take what is left.
        for item in updateRivals(&rivals, dt: dt, world: world, food: &food, rng: rng) {
            events.append(.rivalAte(item))
        }

        // Bugs wander back in from the long grass, so killing them off never
        // empties the meadow of competition or of the food their corpses provide.
        rivalRespawnTimer += dt
        if rivals.count < Config.Rivals.count && rivalRespawnTimer >= Config.Rivals.respawnSeconds {
            rivalRespawnTimer = 0
            rivals.append(spawnRival(world: world, rng: rng, index: rivals.count))
        }

        // A doorway moves the cricket between the meadow and the house.
        if stageCooldown <= 0 && world.atDoorway(x: cricket.x, y: cricket.y) {
            if stage == .meadow {
                let house = World.house(rng: rng)
                changeStage(to: .house, world: house, arrival: house.houseEntry, events: &events)
            } else {
                let meadow = World.meadow(rng: rng)
                let spawn = meadow.spawnPoint
                // Step back out onto the meadow just short of the door.
                let arrival = meadow.clampToBounds(
                    x: meadow.door.x - Config.Doorway.width * doorStepBackWidths,
                    y: meadow.door.y,
                    radius: Config.Cricket.radius
                )
                let wet = meadow.isWater(x: arrival.x, y: arrival.y, margin: Config.Cricket.radius)
                changeStage(to: .meadow, world: meadow, arrival: wet ? spawn : arrival, events: &events)
            }
        }

        // Spiders hunt from inside cover, so they are checked wherever the cricket is.
        for event in updateSpiders(&spiders, dt: dt, world: world, cricket: cricket) {
            switch event {
            case .hit: takeHit(from: .spider, into: &events)
            case .wake(let index): events.append(.spiderWake(index: index))
            case .lunge(let index): events.append(.spiderLunge(index: index))
            case .miss(let index): events.append(.spiderMiss(index: index))
            }
        }

        let context = PredatorContext(
            world: world, cricket: cricket, hidden: hidden,
            singing: cricket.singing, airborne: cricket.jumping
        )

        // Indoors, the cat hunts and the human blunders through.
        if let outcome = cat?.update(dt: dt, context: context, rng: rng) {
            switch outcome {
            case .hit: takeHit(from: .cat, into: &events)
            case .none: break
            case .noticed: events.append(.catNoticed)
            case .lost: events.append(.catLost)
            case .pounced: events.append(.catPounced)
            case .missed: events.append(.catMissed)
            }
        }

        if let humanEvents = humans?.update(dt: dt, context: context, rng: rng) {
            for event in humanEvents {
                switch event {
                case .crush: takeHit(from: .human, into: &events)
                case .approaching: events.append(.humanApproaching)
                case .footfall(let x, let y): events.append(.footfall(x: x, y: y))
                case .gone: events.append(.humanGone)
                }
            }
        }

        var survivors: [Bird] = []

        for var bird in birds {
            let previousState = bird.state
            let outcome = bird.update(dt: dt, context: context)

            if previousState == .circle && bird.state == .dive {
                events.append(.birdCry(kind: bird.kind))
            }

            if outcome == .hit { takeHit(from: bird.kind.threat, into: &events) }

            if bird.state != .gone { survivors.append(bird) }
        }

        birds = survivors

        if lives <= 0 {
            phase = .gameOver
            newRecord = score.commitHighScore(to: store)
            events.append(.gameOver)
        }

        return events
    }
}
