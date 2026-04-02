// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ComputerUseBridge",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "ComputerUseBridge", targets: ["ComputerUseBridge"])
    ],
    targets: [
        .executableTarget(
            name: "ComputerUseBridge",
            path: "Sources/ComputerUseBridge"
        ),
        .testTarget(
            name: "ComputerUseBridgeTests",
            dependencies: ["ComputerUseBridge"],
            path: "Tests/ComputerUseBridgeTests"
        )
    ]
)
