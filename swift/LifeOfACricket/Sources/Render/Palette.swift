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

        // The sky's two gradient stops at noon and at midnight; `drawSky`
        // lerps between them by `darknessAt(game.elapsed)`, matching
        // `skyStops()` in the JS.
        static let skyTopDay = DimmableRGB(r: 122, g: 170, b: 210)
        static let skyTopNight = DimmableRGB(r: 10, g: 14, b: 34)
        static let skyBottomDay = DimmableRGB(r: 246, g: 203, b: 150)
        static let skyBottomNight = DimmableRGB(r: 38, g: 33, b: 62)

        // These are dimmed by the renderer (`.color(dim:)`), not fixed: the JS
        // multiplies each one's r/g/b by a darkness-derived `k` every frame.
        static let waterDampMarginBase = DimmableRGB(r: 74, g: 84, b: 62, a: 0.55)
        static let waterBodyBase = DimmableRGB(r: 46, g: 96, b: 134, a: 0.92)
        static let waterShimmerBase = Color(r: 198, g: 232, b: 255)

        static let rockBody = Color(r: 78, g: 84, b: 92, a: 0.95)
        static let rockHighlight = Color(r: 120, g: 128, b: 138, a: 0.6)
        static let leafBody = Color(r: 96, g: 128, b: 58, a: 0.92)
        static let leafVein = Color(r: 58, g: 82, b: 34, a: 0.9)
        static let grassTuft = Color(r: 64, g: 106, b: 48, a: 0.95)

        static let groundTopBase = DimmableRGB(r: 63, g: 90, b: 52)
        static let groundBottomBase = DimmableRGB(r: 34, g: 51, b: 31)
        static let grassFringeNear = Color(r: 104, g: 132, b: 82, a: 0.5)
        static let grassFringeFar = Color(r: 138, g: 170, b: 104, a: 0.62)

        static let houseWallExteriorBase = DimmableRGB(r: 96, g: 80, b: 72)
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

        static let birdShadow = Color(r: 0, g: 0, b: 0, a: 0.28)
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

        // The menu's descriptive lines and the game-over panel's "Best" line
        // use two distinct whites-with-alpha the JS bakes as literals
        // (`rgba(255,255,255,0.85)` and `rgba(255,255,255,0.75)`) — kept apart
        // from `secondaryText`'s 0.7, which is a third, separate literal.
        static let bodyText = Color(r: 255, g: 255, b: 255, a: 0.85)
        static let bestText = Color(r: 255, g: 255, b: 255, a: 0.75)

        static let panelBackground = Color(r: 8, g: 12, b: 18, a: 0.72)
        static let creditLabel = Color(r: 255, g: 255, b: 255, a: 0.55)
        static let creditName = Color(hex: 0xffe9a8)
        static let creditDivider = Color(r: 255, g: 255, b: 255, a: 0.35)
        static let creditTitle = Color(r: 255, g: 255, b: 255, a: 0.8)
        static let creditSubtitle = Color(r: 255, g: 255, b: 255, a: 0.5)
    }

    /// `src/render/house.js`: the house interior, its furniture and its
    /// backdrop, drawn cross-section like a dollhouse. Almost everything here
    /// is a `DimmableRGB`: the house has its own light level (`lighting()` in
    /// the JS), dimmer than the meadow's darkness curve and never pitch black,
    /// and every one of these tones is passed through `shade()` there.
    enum House {
        static let furnitureSofaBody = DimmableRGB(r: 0x7a, g: 0x4a, b: 0x52)
        static let furnitureSofaTrim = DimmableRGB(r: 0x93, g: 0x60, b: 0x6a)
        static let furnitureChairBody = DimmableRGB(r: 0x8a, g: 0x62, b: 0x37)
        static let furnitureChairTrim = DimmableRGB(r: 0xa3, g: 0x76, b: 0x3f)
        static let furnitureTableBody = DimmableRGB(r: 0x7d, g: 0x57, b: 0x34)
        static let furnitureTableTrim = DimmableRGB(r: 0x99, g: 0x6b, b: 0x41)
        static let furniturePlantBody = DimmableRGB(r: 0x3f, g: 0x6b, b: 0x39)
        static let furniturePlantTrim = DimmableRGB(r: 0x4f, g: 0x84, b: 0x46)
        static let furnitureBoxBody = DimmableRGB(r: 0x8a, g: 0x74, b: 0x48)
        static let furnitureBoxTrim = DimmableRGB(r: 0xa0, g: 0x8a, b: 0x58)
        static let furnitureBedBody = DimmableRGB(r: 0x5d, g: 0x66, b: 0x88)
        static let furnitureBedTrim = DimmableRGB(r: 0x77, g: 0x80, b: 0x9f)
        // Furniture's shadow is a flat rgba() in the JS, never shaded by `dim`.
        static let furnitureShadow = Color(r: 0, g: 0, b: 0, a: 0.3)
        static let plantPot = DimmableRGB(r: 0x6d, g: 0x4b, b: 0x33)

        // The backdrop dims by its own factor (`1 - darkness * 0.4`), distinct
        // from the interior's `dim` (`1 - darkness * 0.5`).
        static let wallGradientTop = DimmableRGB(r: 0x2a, g: 0x22, b: 0x30)
        static let wallGradientBottom = DimmableRGB(r: 0x1a, g: 0x16, b: 0x20)
        static let wallpaperTop = DimmableRGB(r: 0x6d, g: 0x5f, b: 0x74)
        static let wallpaperBottom = DimmableRGB(r: 0x58, g: 0x4c, b: 0x60)
        // The stripe's alpha itself is multiplied by `dim` in the JS, not its
        // rgb — stays a plain `Color`, opacity applied at the call site.
        static let wallpaperStripeBase = Color(r: 255, g: 255, b: 255)

        static let floorboard = DimmableRGB(r: 0x4a, g: 0x35, b: 0x27)
        static let floorboardLine = DimmableRGB(r: 0x33, g: 0x24, b: 0x1a)
        static let skirting = DimmableRGB(r: 0x6b, g: 0x58, b: 0x47)

        static let ceilingSlab = DimmableRGB(r: 0x3a, g: 0x2f, b: 0x2a)
        static let stairwellShaft = DimmableRGB(r: 0x4c, g: 0x41, b: 0x52)
        static let stairwellSteps = DimmableRGB(r: 0x7a, g: 0x64, b: 0x50)

        static let doorDark = DimmableRGB(r: 0x2a, g: 0x1e, b: 0x18)
        // The door's glow is `rgba(255, 236, 180, 0.28 * (1 - darkness))` in the
        // JS — alpha keyed to darkness directly, not shaded — so it too stays a
        // plain `Color`.
        static let doorLightBase = Color(r: 255, g: 236, b: 180)

        // The cat and the human draw from `Palette.Entities`
        // (`catShadow`/`catCoatAlert`/... and `humanShadowSweepBase`/...): they
        // were seeded there alongside the rest of `drawEntities`'s cast even
        // though this task, not Task 2, is the one that draws them.
    }
}

/// A base colour, in the JS's `rgb()` units (0...255), that a renderer
/// multiplies by a darkness-derived brightness factor before turning into a
/// `Color` — mirrors `dim()` in `background.js` and `shade()` in `house.js`.
/// Kept separate from a plain `Color` because SwiftUI does not let drawing
/// code read a `Color`'s components back out to redim it.
struct DimmableRGB {
    let r: Double
    let g: Double
    let b: Double
    var a: Double = 1

    /// `k` is the multiplier the JS applies to r, g and b together — e.g.
    /// `1 - darkness * 0.62` for the ground, `1 - darkness * 0.5` for walls.
    func color(dim k: Double) -> Color {
        Color(.sRGB, red: r * k / 255, green: g * k / 255, blue: b * k / 255, opacity: a)
    }

    /// The undimmed colour (`k` = 1), for callers that only need the base tone.
    var color: Color { color(dim: 1) }

    /// Linear interpolation between two base colours, e.g. the sky's noon and
    /// midnight gradient stops by `darknessAt(game.elapsed)`.
    static func lerp(_ from: DimmableRGB, _ to: DimmableRGB, _ t: Double) -> Color {
        Color(
            .sRGB,
            red: (from.r + (to.r - from.r) * t) / 255,
            green: (from.g + (to.g - from.g) * t) / 255,
            blue: (from.b + (to.b - from.b) * t) / 255,
            opacity: from.a + (to.a - from.a) * t
        )
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
