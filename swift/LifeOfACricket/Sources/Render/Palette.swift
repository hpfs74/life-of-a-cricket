import SwiftUI

/// Every colour the renderers draw, named after its counterpart in the
/// JavaScript source under `src/render/`. Nested by the file it came from,
/// matching the draw functions there (`drawSky`, `drawEntities`, `drawHud`,
/// `drawHouseInterior`, ...).
///
/// Where the JS computes a colour's alpha at runtime — from darkness, a decay
/// timer, a pulse, a settle countdown — the entry here carries the JS's base
/// RGB with that alpha stripped to `1`; the renderer applies `.opacity(_:)`
/// itself, the same way the JS builds its `rgba(...)` string each frame.
/// Where the JS's alpha is a fixed literal, it is baked in here, matching the
/// source exactly. Colours the JS shades with `dim`/`darkness` (a brightness
/// multiplier on r, g and b together, as in `house.js`'s `shade()`) keep the
/// undimmed base; the renderer reapplies that multiplier.
///
/// This is Task 2's starting set, gathered from `background.js`, `entities.js`,
/// `hud.js` and `house.js`. Later render tasks add to it rather than
/// reintroducing literals inline.
enum Palette {
    /// The page behind the letterbox bars (`src/main.js`, `resize`/`frame`).
    static let page = Color(hex: 0x10141c)

    /// `src/render/background.js`: sky, stars, sun/moon, water, ground cover,
    /// the doorway to the house.
    enum Background {
        static let starBase = Color(r: 255, g: 253, b: 235)

        static let sunGlowInner = Color(r: 255, g: 236, b: 170, a: 0.85)
        static let sunGlowOuter = Color(r: 255, g: 214, b: 130, a: 0)
        static let sunBody = Color(hex: 0xfff2c4)

        static let moonBody = Color(r: 226, g: 232, b: 245, a: 0.95)
        static let moonCrescent = Color(r: 10, g: 14, b: 34, a: 0.92)

        static let waterDampMarginBase = Color(r: 74, g: 84, b: 62, a: 0.55)
        static let waterBodyBase = Color(r: 46, g: 96, b: 134, a: 0.92)
        static let waterShimmerBase = Color(r: 198, g: 232, b: 255)

        static let rockBody = Color(r: 78, g: 84, b: 92, a: 0.95)
        static let rockHighlight = Color(r: 120, g: 128, b: 138, a: 0.6)
        static let leafBody = Color(r: 96, g: 128, b: 58, a: 0.92)
        static let leafVein = Color(r: 58, g: 82, b: 34, a: 0.9)
        static let grassTuft = Color(r: 64, g: 106, b: 48, a: 0.95)

        static let groundTopBase = Color(r: 63, g: 90, b: 52)
        static let groundBottomBase = Color(r: 34, g: 51, b: 31)
        static let grassFringeNear = Color(r: 104, g: 132, b: 82, a: 0.5)
        static let grassFringeFar = Color(r: 138, g: 170, b: 104, a: 0.62)

        static let houseWallExteriorBase = Color(r: 96, g: 80, b: 72)
        static let doorwayDark = Color(hex: 0x1d140f)
        static let doorwayGlowInner = Color(r: 255, g: 214, b: 140)
        static let doorwayGlowOuter = Color(r: 255, g: 200, b: 120, a: 0)
    }

    /// `src/render/entities.js`: food, the cricket, birds/bats, rivals,
    /// spiders, the cat and the human.
    enum Entities {
        static let foodSeed = Color(hex: 0xd8c07a)
        static let foodBerry = Color(hex: 0xc4426a)
        static let foodAphid = Color(hex: 0x8fd36a)
        static let foodLettuce = Color(hex: 0xb6dd7c)
        static let foodGrub = Color(hex: 0xe8cdb0)
        static let lettuceLeaf = Color(hex: 0x8cbb5a)
        static let lettuceCenter = Color(hex: 0xd8efab)
        static let grubOutline = Color(r: 176, g: 140, b: 112, a: 0.8)
        static let foodSettleGlowBase = Color(r: 255, g: 245, b: 200)
        static let foodShadow = Color(r: 0, g: 0, b: 0, a: 0.25)
        static let foodHighlight = Color(r: 255, g: 255, b: 255, a: 0.5)

        static let songRingBase = Color(r: 255, g: 244, b: 190)

        static let cricketShadowBase = Color(r: 0, g: 0, b: 0, a: 0.32)
        static let jumpCooldownRing = Color(r: 255, g: 255, b: 255, a: 0.35)
        static let cricketLegs = Color(hex: 0x4c6b2f)
        static let cricketBody = Color(hex: 0x6d8f3c)
        static let cricketBodyShade = Color(hex: 0x587a30)
        static let cricketHead = Color(hex: 0x7fa348)
        static let cricketEyes = Color(hex: 0x1c2416)
        static let cricketAntennae = Color(hex: 0x2f3d22)
        static let strikeArcBase = Color(r: 255, g: 246, b: 214)
        static let stunStars = Color(r: 255, g: 232, b: 150, a: 0.9)
        static let hiddenMarkerText = Color(r: 160, g: 220, b: 255, a: 0.9)

        static let batDiving = Color(hex: 0x12161d)
        static let batBase = Color(hex: 0x1d222c)
        static let birdCircleMarkerBase = Color(r: 255, g: 96, b: 96)

        static let rivalAntBody = Color(hex: 0x4a3428)
        static let rivalAntShine = Color(hex: 0x6d4d3a)
        static let rivalBeetleBody = Color(hex: 0x2f3a44)
        static let rivalBeetleShine = Color(hex: 0x59707f)
        static let rivalShadow = Color(r: 0, g: 0, b: 0, a: 0.22)
        static let rivalFlash = Color(hex: 0xfff0f0)

        static let spiderTellBase = Color(r: 214, g: 226, b: 240)
        static let spiderShadow = Color(r: 0, g: 0, b: 0, a: 0.3)
        static let spiderLegsAlert = Color(hex: 0x241a20)
        static let spiderLegsIdle = Color(hex: 0x2c2028)
        static let spiderBody = Color(hex: 0x20161c)
        static let spiderEyesBase = Color(r: 255, g: 226, b: 128)

        static let catShadow = Color(r: 0, g: 0, b: 0, a: 0.32)
        static let catCoatAlert = Color(hex: 0x3b3339)
        static let catCoatIdle = Color(hex: 0x4a4048)
        static let catEyesBase = Color(r: 214, g: 240, b: 150)

        static let humanShadowSweepBase = Color(r: 0, g: 0, b: 0)
        static let humanShadowPoolInner = Color(r: 0, g: 0, b: 0, a: 0.5)
        static let humanShadowPoolOuter = Color(r: 0, g: 0, b: 0, a: 0)
        static let humanFootShadow = Color(r: 0, g: 0, b: 0, a: 0.3)
        static let humanFoot = Color(hex: 0x2c2f3a)
        static let humanFootTop = Color(hex: 0x3d4150)
    }

    /// `src/render/hud.js`: the score/meters HUD and the menu/game-over panels.
    enum Hud {
        static let meterTrack = Color(r: 0, g: 0, b: 0, a: 0.35)
        static let meterLabel = Color(r: 255, g: 255, b: 255, a: 0.85)
        static let primaryText = Color(hex: 0xffffff)
        static let secondaryText = Color(r: 255, g: 255, b: 255, a: 0.7)
        static let attentionMeter = Color(hex: 0xff6b5e)
        static let fedMeter = Color(hex: 0x7fd36a)
        static let shiftCaptionBase = Color(r: 190, g: 226, b: 255)
        static let multiplierText = Color(hex: 0xffe9a8)

        static let panelBackground = Color(r: 8, g: 12, b: 18, a: 0.72)
        static let creditLabel = Color(r: 255, g: 255, b: 255, a: 0.55)
        static let creditName = Color(hex: 0xffe9a8)
        static let creditDivider = Color(r: 255, g: 255, b: 255, a: 0.35)
        static let creditTitle = Color(r: 255, g: 255, b: 255, a: 0.8)
        static let creditSubtitle = Color(r: 255, g: 255, b: 255, a: 0.5)
    }

    /// `src/render/house.js`: the house interior, its furniture and its
    /// backdrop, drawn cross-section like a dollhouse.
    enum House {
        static let furnitureSofaBody = Color(hex: 0x7a4a52)
        static let furnitureSofaTrim = Color(hex: 0x93606a)
        static let furnitureChairBody = Color(hex: 0x8a6237)
        static let furnitureChairTrim = Color(hex: 0xa3763f)
        static let furnitureTableBody = Color(hex: 0x7d5734)
        static let furnitureTableTrim = Color(hex: 0x996b41)
        static let furniturePlantBody = Color(hex: 0x3f6b39)
        static let furniturePlantTrim = Color(hex: 0x4f8446)
        static let furnitureBoxBody = Color(hex: 0x8a7448)
        static let furnitureBoxTrim = Color(hex: 0xa08a58)
        static let furnitureBedBody = Color(hex: 0x5d6688)
        static let furnitureBedTrim = Color(hex: 0x77809f)
        static let furnitureShadow = Color(r: 0, g: 0, b: 0, a: 0.3)
        static let plantPot = Color(hex: 0x6d4b33)

        static let wallGradientTop = Color(hex: 0x2a2230)
        static let wallGradientBottom = Color(hex: 0x1a1620)
        static let wallpaperTop = Color(hex: 0x6d5f74)
        static let wallpaperBottom = Color(hex: 0x584c60)
        static let wallpaperStripeBase = Color(r: 255, g: 255, b: 255)

        static let floorboard = Color(hex: 0x4a3527)
        static let floorboardLine = Color(hex: 0x33241a)
        static let skirting = Color(hex: 0x6b5847)

        static let ceilingSlab = Color(hex: 0x3a2f2a)
        static let stairwellShaft = Color(hex: 0x4c4152)
        static let stairwellSteps = Color(hex: 0x7a6450)

        static let doorDark = Color(hex: 0x2a1e18)
        static let doorLightBase = Color(r: 255, g: 236, b: 180)
    }
}

private extension Color {
    /// A colour from a JS `#rrggbb` hex literal.
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }

    /// A colour from a JS `rgb()`/`rgba()` literal, components 0...255.
    init(r: Double, g: Double, b: Double, a: Double = 1) {
        self.init(.sRGB, red: r / 255, green: g / 255, blue: b / 255, opacity: a)
    }
}
