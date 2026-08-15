import Testing
@testable import CricketCore

@Test func everyJavaScriptEventTypeHasACase() {
    var field = FoodField()
    let item = field.drop(.grub, x: 0, y: 0)

    // The full set audio.js switches on, plus the ones only game.js emits.
    let events: [GameEvent] = [
        .songStart, .songBreak, .jump, .land,
        .strike(connected: true), .bugHit(kind: .ant),
        .bugKilled(kind: .beetle, drops: 2), .stunned(kind: .beetle),
        .ate(item), .rivalAte(item),
        .birdSpawn(kind: .bird), .birdCry(kind: .bat),
        .spiderWake(index: 0), .spiderLunge(index: 0), .spiderMiss(index: 0),
        .catNoticed, .catLost, .catPounced,
        .humanApproaching, .footfall(x: 1, y: 2), .humanGone,
        .newDay(day: 2), .stageChange(stage: .house),
        .hit(from: .spider), .gameOver,
    ]
    #expect(events.count == 25)
}

@Test func eventsCompareByValue() {
    #expect(GameEvent.hit(from: .cat) == GameEvent.hit(from: .cat))
    #expect(GameEvent.hit(from: .cat) != GameEvent.hit(from: .bird))
}
