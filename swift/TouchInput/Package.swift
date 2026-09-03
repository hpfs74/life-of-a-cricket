// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TouchInput",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "TouchInput", targets: ["TouchInput"]),
    ],
    dependencies: [
        .package(path: "../CricketCore"),
    ],
    targets: [
        .target(name: "TouchInput", dependencies: ["CricketCore"]),
        .testTarget(name: "TouchInputTests", dependencies: ["TouchInput"]),
    ]
)
