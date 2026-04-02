import XCTest
@testable import ComputerUseBridge

final class AppServiceTests: XCTestCase {
    func testDiscoverInstalledAppsFindsNestedApplicationBundles() throws {
        let root = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }

        let terminalPath = try makeAppBundle(
            at: root
                .appendingPathComponent("System", isDirectory: true)
                .appendingPathComponent("Applications", isDirectory: true)
                .appendingPathComponent("Utilities", isDirectory: true)
                .appendingPathComponent("Terminal.app", isDirectory: true),
            bundleId: "com.apple.Terminal",
            displayName: "Terminal"
        )

        let records = AppService.discoverInstalledApps(in: [root])

        XCTAssertTrue(records.contains(where: {
            $0.bundleId == "com.apple.Terminal"
                && $0.displayName == "Terminal"
                && $0.path == terminalPath.path
        }))
    }

    func testDiscoverInstalledAppsPrefersEarlierRootsForDuplicateBundleIds() throws {
        let userRoot = try makeTemporaryDirectory()
        let systemRoot = try makeTemporaryDirectory()
        defer {
            try? FileManager.default.removeItem(at: userRoot)
            try? FileManager.default.removeItem(at: systemRoot)
        }

        let preferredPath = try makeAppBundle(
            at: userRoot
                .appendingPathComponent("Applications", isDirectory: true)
                .appendingPathComponent("Notes.app", isDirectory: true),
            bundleId: "com.example.Notes",
            displayName: "Notes"
        )

        _ = try makeAppBundle(
            at: systemRoot
                .appendingPathComponent("System", isDirectory: true)
                .appendingPathComponent("Applications", isDirectory: true)
                .appendingPathComponent("Notes.app", isDirectory: true),
            bundleId: "com.example.Notes",
            displayName: "Notes"
        )

        let records = AppService.discoverInstalledApps(in: [userRoot, systemRoot])

        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.bundleId, "com.example.Notes")
        XCTAssertEqual(records.first?.path, preferredPath.path)
    }

    private func makeTemporaryDirectory() throws -> URL {
        try FileManager.default.url(
            for: .itemReplacementDirectory,
            in: .userDomainMask,
            appropriateFor: URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true),
            create: true
        )
    }

    @discardableResult
    private func makeAppBundle(at url: URL, bundleId: String, displayName: String) throws -> URL {
        let contentsURL = url.appendingPathComponent("Contents", isDirectory: true)
        try FileManager.default.createDirectory(at: contentsURL, withIntermediateDirectories: true)

        let infoPlistURL = contentsURL.appendingPathComponent("Info.plist")
        let plist: NSDictionary = [
            "CFBundleIdentifier": bundleId,
            "CFBundleName": displayName,
            "CFBundleDisplayName": displayName
        ]

        let wrote = plist.write(to: infoPlistURL, atomically: true)
        XCTAssertTrue(wrote)
        return url.standardizedFileURL
    }
}
