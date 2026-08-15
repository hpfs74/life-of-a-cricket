/// What can strike the cricket. Carried by `GameEvent.hit` so a single case
/// covers every source of damage instead of one case per predator.
public enum Threat: Equatable, Sendable {
    case bird, bat, spider, cat, human
}

/// The seam between simulation and presentation.
///
/// In the JavaScript original, `updateGame` returns an array of
/// string-tagged objects (`{type: 'hit', from: 'bird'}`) and `src/audio.js`
/// switches on `event.type` with a `default` branch that silently discards
/// anything it doesn't recognise. A typo in a case string, or a new event
/// nobody wired up, fails at runtime — if it fails at all — by simply
/// producing no sound.
///
/// `GameEvent` replaces the string tag with a case. Because it carries no
/// `default` case, any `switch` over `GameEvent` that omits a case is a
/// compile error, not a silent gap. The audio layer (Plan 4) gets that
/// exhaustiveness for free: give every case a sound, and the build itself
/// proves none were missed. Add a case here later and every such `switch`
/// stops compiling until it's handled.
public enum GameEvent: Equatable, Sendable {
    case songStart
    case songBreak
    case jump
    case land
    case strike(connected: Bool)
    case bugHit(kind: RivalKind)
    case bugKilled(kind: RivalKind, drops: Int)
    case stunned(kind: RivalKind)
    case ate(FoodItem)
    case rivalAte(FoodItem)
    case birdSpawn(kind: BirdKind)
    case birdCry(kind: BirdKind)
    case spiderWake(index: Int)
    case spiderLunge(index: Int)
    case catNoticed
    case catLost
    case catPounced
    case humanApproaching
    case footfall(x: Double, y: Double)
    case humanGone
    case newDay(day: Int)
    case stageChange(stage: StageKind)
    case hit(from: Threat)
    case gameOver
}
