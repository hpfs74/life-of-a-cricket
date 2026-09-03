import Testing
@testable import CricketCore

@Test func singingRaisesAttentionAndSilenceDecaysIt() {
    var attention = Attention()
    attention.tick(singing: true, dt: 1)
    let raised = attention.value
    #expect(raised > 0)

    attention.tick(singing: false, dt: 1)
    #expect(attention.value < raised)
}

@Test func eachThresholdSummonsOnePredatorOnce() {
    var attention = Attention()
    var total = 0
    for _ in 0..<100 { total += attention.tick(singing: true, dt: 0.1) }
    #expect(total == Config.Attention.thresholds.count)
}

@Test func aThresholdRearmsOnlyAfterFallingBelowTheMargin() {
    var attention = Attention()
    while attention.value < Config.Attention.thresholds[0] {
        attention.tick(singing: true, dt: 0.05)
    }
    // Hovering on the boundary must not machine-gun predators.
    var extra = 0
    for _ in 0..<20 { extra += attention.tick(singing: true, dt: 0.001) }
    #expect(extra == 0)
}

@Test func resetDisarmsNothingAndClearsTheMeter() {
    var attention = Attention()
    attention.tick(singing: true, dt: 3)
    attention.reset()
    #expect(attention.value == 0)
    #expect(attention.armed.allSatisfy { $0 })
}
