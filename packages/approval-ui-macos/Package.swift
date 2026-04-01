// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ApprovalUIBridge",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "ApprovalUIBridge", targets: ["ApprovalUIBridge"])
    ],
    targets: [
        .executableTarget(
            name: "ApprovalUIBridge",
            path: "Sources/ApprovalUIBridge"
        )
    ]
)
