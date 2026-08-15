// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CricketCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CricketCore", targets: ["CricketCore"]),
    ],
    targets: [
        .target(name: "CricketCore"),
        .testTarget(name: "CricketCoreTests", dependencies: ["CricketCore"]),
    ]
)
