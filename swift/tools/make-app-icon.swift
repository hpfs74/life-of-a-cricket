#!/usr/bin/env swift
//
// Draws the app icon and writes it as a 1024×1024 PNG.
//
//   swift swift/tools/make-app-icon.swift <output.png>
//
// The game ships no image assets — every visual is drawn with primitives —
// so its icon is generated too rather than stored as opaque art. The palette
// is lifted from `src/render/entities.js` and `background.js` so the icon and
// the cricket on screen are the same colours.
//
// App Store rules: exactly 1024×1024, NO alpha channel, NO rounded corners
// (iOS applies the mask itself).

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024.0

// Straight from the game's own renderers.
func rgb(_ hex: UInt32) -> CGColor {
    CGColor(
        red: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: 1
    )
}

let bodyLight = rgb(0x7FA348)   // entities.js — the cricket's lit flank
let bodyMid = rgb(0x6D8F3C)
let bodyDark = rgb(0x4C6B2F)
let bodyShadow = rgb(0x2F3D22)
let ink = rgb(0x1C2416)         // its darkest line colour
let skyTop = rgb(0x21324A)      // dusk, the hour the game is set at
let skyLow = rgb(0x4A5A3A)
let groundTop = rgb(0x395C28)
let groundLow = rgb(0x24401B)
let noteWarm = rgb(0xFFE896)    // the singing tell

let cs = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
    data: nil, width: Int(size), height: Int(size),
    bitsPerComponent: 8, bytesPerRow: 0, space: cs,
    // noneSkipLast = opaque. The App Store rejects icons with alpha.
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { fatalError("could not create the bitmap context") }

// Y grows upward in CoreGraphics; flip so the arithmetic below reads top-down.
ctx.translateBy(x: 0, y: size)
ctx.scaleBy(x: 1, y: -1)

func gradient(_ colors: [CGColor], _ locations: [CGFloat]) -> CGGradient {
    CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: locations)!
}

// --- Sky, then ground: the game's own two bands ------------------------------
let horizon = size * 0.46

ctx.saveGState()
ctx.clip(to: CGRect(x: 0, y: 0, width: size, height: horizon))
ctx.drawLinearGradient(
    gradient([skyTop, skyLow], [0, 1]),
    start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: horizon),
    options: []
)
ctx.restoreGState()

ctx.saveGState()
ctx.clip(to: CGRect(x: 0, y: horizon, width: size, height: size - horizon))
ctx.drawLinearGradient(
    gradient([groundTop, groundLow], [0, 1]),
    start: CGPoint(x: 0, y: horizon), end: CGPoint(x: 0, y: size),
    options: []
)
ctx.restoreGState()

// A fringe of grass along the horizon, as `drawGround` does.
ctx.setFillColor(groundTop)
var blade = -20.0
var n = 0
while blade < size + 20 {
    let h = 26.0 + Double((n * 37) % 30)
    ctx.move(to: CGPoint(x: blade, y: horizon + 6))
    ctx.addLine(to: CGPoint(x: blade + 7, y: horizon - h))
    ctx.addLine(to: CGPoint(x: blade + 15, y: horizon + 6))
    ctx.closePath()
    ctx.fillPath()
    blade += 21
    n += 1
}

// --- The cricket -------------------------------------------------------------
// Deliberately bolder and simpler than the in-game sprite: an icon has to read
// at 40pt, where the on-screen cricket's fine legs would disappear entirely.
let cx = size * 0.44
let cy = size * 0.655
let bodyW = size * 0.225
let bodyH = size * 0.125

// Ground shadow, so it sits in the meadow rather than floating over it.
ctx.setFillColor(rgb(0x1B3014).copy(alpha: 0.55)!)
ctx.fillEllipse(in: CGRect(
    x: cx - bodyW * 1.15, y: cy + bodyH * 1.18,
    width: bodyW * 2.30, height: bodyH * 0.40
))

func leg(from: CGPoint, knee: CGPoint, toe: CGPoint, width: CGFloat) {
    ctx.setStrokeColor(bodyDark)
    ctx.setLineWidth(width)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.move(to: from)
    ctx.addLine(to: knee)
    ctx.addLine(to: toe)
    ctx.strokePath()
}

// The hind leg is the cricket's whole silhouette: a deep Z, femur angled up
// and back over the abdomen, tibia dropping to the ground. Drawn before the
// body so the body covers the hip joint.
leg(
    from: CGPoint(x: cx - bodyW * 0.20, y: cy + bodyH * 0.05),
    knee: CGPoint(x: cx - bodyW * 1.05, y: cy - bodyH * 1.35),
    toe: CGPoint(x: cx - bodyW * 1.34, y: cy + bodyH * 1.30),
    width: size * 0.034
)
// Two short front legs, just enough to plant it on the ground.
leg(
    from: CGPoint(x: cx + bodyW * 0.28, y: cy + bodyH * 0.44),
    knee: CGPoint(x: cx + bodyW * 0.52, y: cy + bodyH * 1.06),
    toe: CGPoint(x: cx + bodyW * 0.86, y: cy + bodyH * 1.26),
    width: size * 0.020
)
leg(
    from: CGPoint(x: cx - bodyW * 0.30, y: cy + bodyH * 0.52),
    knee: CGPoint(x: cx - bodyW * 0.34, y: cy + bodyH * 1.10),
    toe: CGPoint(x: cx - bodyW * 0.06, y: cy + bodyH * 1.28),
    width: size * 0.018
)

// Abdomen.
ctx.setFillColor(bodyMid)
ctx.fillEllipse(in: CGRect(
    x: cx - bodyW * 1.15, y: cy - bodyH,
    width: bodyW * 2.05, height: bodyH * 2
))

// The lit upper flank.
ctx.saveGState()
ctx.setFillColor(bodyLight)
ctx.fillEllipse(in: CGRect(
    x: cx - bodyW * 1.02, y: cy - bodyH * 0.98,
    width: bodyW * 1.70, height: bodyH * 1.05
))
ctx.restoreGState()

// The folded wing case — the part that actually makes the sound.
ctx.setStrokeColor(bodyShadow)
ctx.setLineWidth(size * 0.012)
ctx.setLineCap(.round)
ctx.move(to: CGPoint(x: cx - bodyW * 0.62, y: cy + bodyH * 0.10))
ctx.addLine(to: CGPoint(x: cx + bodyW * 0.44, y: cy + bodyH * 0.02))
ctx.strokePath()

// Head.
ctx.setFillColor(bodyLight)
ctx.fillEllipse(in: CGRect(
    x: cx + bodyW * 0.56, y: cy - bodyH * 0.82,
    width: bodyW * 0.72, height: bodyH * 1.42
))

// Eye.
ctx.setFillColor(ink)
ctx.fillEllipse(in: CGRect(
    x: cx + bodyW * 0.94, y: cy - bodyH * 0.36,
    width: bodyW * 0.20, height: bodyH * 0.40
))

// Antennae, swept back over the body.
ctx.setStrokeColor(ink)
ctx.setLineWidth(size * 0.013)
ctx.setLineCap(.round)
// Two of them, and they have to diverge visibly — drawn near-parallel they
// merge into one line at any size, which is what a first pass here did.
// The upper sweeps high over the back; the lower runs out almost level.
ctx.move(to: CGPoint(x: cx + bodyW * 1.18, y: cy - bodyH * 0.66))
ctx.addCurve(
    to: CGPoint(x: cx + bodyW * 1.86, y: cy - bodyH * 2.70),
    control1: CGPoint(x: cx + bodyW * 1.80, y: cy - bodyH * 1.20),
    control2: CGPoint(x: cx + bodyW * 2.05, y: cy - bodyH * 2.15)
)
ctx.strokePath()

ctx.move(to: CGPoint(x: cx + bodyW * 1.20, y: cy - bodyH * 0.40))
ctx.addCurve(
    to: CGPoint(x: cx + bodyW * 2.30, y: cy - bodyH * 1.34),
    control1: CGPoint(x: cx + bodyW * 1.90, y: cy - bodyH * 0.42),
    control2: CGPoint(x: cx + bodyW * 2.08, y: cy - bodyH * 0.84)
)
ctx.strokePath()

// --- The song ----------------------------------------------------------------
// Singing is the whole game: it is how you score, and how you get eaten.
let noteX = size * 0.255
let noteY = size * 0.150
let stem = size * 0.150

ctx.setFillColor(noteWarm)
ctx.fillEllipse(in: CGRect(
    x: noteX - size * 0.052, y: noteY + stem - size * 0.030,
    width: size * 0.104, height: size * 0.074
))
ctx.setStrokeColor(noteWarm)
ctx.setLineWidth(size * 0.020)
ctx.setLineCap(.round)
ctx.move(to: CGPoint(x: noteX + size * 0.046, y: noteY + stem))
ctx.addLine(to: CGPoint(x: noteX + size * 0.046, y: noteY))
ctx.strokePath()
// The flag.
ctx.setLineWidth(size * 0.017)
ctx.move(to: CGPoint(x: noteX + size * 0.046, y: noteY))
ctx.addCurve(
    to: CGPoint(x: noteX + size * 0.100, y: noteY + size * 0.082),
    control1: CGPoint(x: noteX + size * 0.104, y: noteY + size * 0.012),
    control2: CGPoint(x: noteX + size * 0.112, y: noteY + size * 0.048)
)
ctx.strokePath()

// --- Write it out ------------------------------------------------------------
let out = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "AppIcon-1024.png"

guard let image = ctx.makeImage() else { fatalError("could not render the image") }
let url = URL(fileURLWithPath: out)
guard let dest = CGImageDestinationCreateWithURL(
    url as CFURL, UTType.png.identifier as CFString, 1, nil
) else { fatalError("could not create \(out)") }

CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("could not write \(out)") }

print("wrote \(out) — \(Int(size))×\(Int(size)), opaque")
