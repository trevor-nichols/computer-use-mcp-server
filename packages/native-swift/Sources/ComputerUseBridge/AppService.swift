import Foundation

#if os(macOS)
import AppKit
import CoreGraphics

struct InstalledAppRecord: Equatable {
    let bundleId: String
    let displayName: String
    let path: String

    var payload: [String: Any] {
        [
            "bundleId": bundleId,
            "displayName": displayName,
            "path": path
        ]
    }
}

enum AppService {
    private static func appPayload(_ app: NSRunningApplication) -> [String: Any]? {
        guard app.activationPolicy == .regular, let bundleId = app.bundleIdentifier else { return nil }
        return [
            "bundleId": bundleId,
            "displayName": app.localizedName ?? bundleId,
            "pid": app.processIdentifier,
            "isFrontmost": app.isActive
        ]
    }

    private static func regularRunningApplicationsByPid() -> [pid_t: NSRunningApplication] {
        NSWorkspace.shared.runningApplications.reduce(into: [pid_t: NSRunningApplication]()) { partial, app in
            guard app.activationPolicy == .regular else { return }
            partial[app.processIdentifier] = app
        }
    }

    private static func windowBounds(_ window: [String: Any]) -> CGRect? {
        guard
            let bounds = window[kCGWindowBounds as String] as? [String: Any],
            let x = bounds["X"] as? Double,
            let y = bounds["Y"] as? Double,
            let width = bounds["Width"] as? Double,
            let height = bounds["Height"] as? Double
        else {
            return nil
        }

        return CGRect(x: x, y: y, width: width, height: height)
    }

    static func listInstalledApps() -> [[String: Any]] {
        discoverInstalledApps(in: defaultInstalledAppRoots()).map(\.payload)
    }

    static func defaultInstalledAppRoots(fileManager: FileManager = .default) -> [URL] {
        let homeApplications = fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Applications", isDirectory: true)
        return [
            homeApplications,
            URL(fileURLWithPath: "/Applications", isDirectory: true),
            URL(fileURLWithPath: "/System/Applications", isDirectory: true)
        ]
    }

    static func discoverInstalledApps(
        in roots: [URL],
        fileManager: FileManager = .default
    ) -> [InstalledAppRecord] {
        var recordsByBundleId = [String: InstalledAppRecord]()
        var seenPaths = Set<String>()

        for root in roots {
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: root.path, isDirectory: &isDirectory), isDirectory.boolValue else {
                continue
            }

            guard let enumerator = fileManager.enumerator(
                at: root,
                includingPropertiesForKeys: [.isDirectoryKey, .isPackageKey],
                options: [.skipsHiddenFiles]
            ) else {
                continue
            }

            for case let url as URL in enumerator {
                if url.pathExtension.caseInsensitiveCompare("app") != .orderedSame {
                    continue
                }

                enumerator.skipDescendants()

                let resolvedURL = url.resolvingSymlinksInPath().standardizedFileURL
                guard seenPaths.insert(resolvedURL.path).inserted else {
                    continue
                }

                guard let record = installedAppRecord(at: resolvedURL) else {
                    continue
                }

                if recordsByBundleId[record.bundleId] == nil {
                    recordsByBundleId[record.bundleId] = record
                }
            }
        }

        return recordsByBundleId.values.sorted { lhs, rhs in
            if lhs.displayName.caseInsensitiveCompare(rhs.displayName) != .orderedSame {
                return compareCaseInsensitive(lhs.displayName, rhs.displayName)
            }
            if lhs.bundleId.caseInsensitiveCompare(rhs.bundleId) != .orderedSame {
                return compareCaseInsensitive(lhs.bundleId, rhs.bundleId)
            }
            return compareCaseInsensitive(lhs.path, rhs.path)
        }
    }

    private static func installedAppRecord(at url: URL) -> InstalledAppRecord? {
        let bundle = Bundle(url: url)
        let fallbackName = url.deletingPathExtension().lastPathComponent
        let bundleId = bundle?.bundleIdentifier ?? fallbackName
        let displayName =
            (bundle?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (bundle?.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? fallbackName

        return InstalledAppRecord(
            bundleId: bundleId,
            displayName: displayName,
            path: url.path
        )
    }

    private static func compareCaseInsensitive(_ lhs: String, _ rhs: String) -> Bool {
        let lhsLower = lhs.lowercased()
        let rhsLower = rhs.lowercased()
        if lhsLower != rhsLower {
            return lhsLower < rhsLower
        }
        return lhs < rhs
    }

    static func listRunningApps() -> [[String: Any]] {
        NSWorkspace.shared.runningApplications.compactMap(appPayload)
    }

    static func getFrontmostApp() -> [String: Any]? {
        if let app = NSWorkspace.shared.frontmostApplication, let payload = appPayload(app) {
            return payload
        }

        if let app = NSWorkspace.shared.runningApplications.first(where: { $0.isActive }),
           let payload = appPayload(app) {
            return payload
        }

        return nil
    }

    static func appUnderPoint(x: Double, y: Double) -> [String: Any]? {
        let runningApps = regularRunningApplicationsByPid()
        let point = CGPoint(x: x, y: y)

        guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return nil
        }

        for window in windowList {
            guard
                let pid = window[kCGWindowOwnerPID as String] as? Int32,
                let app = runningApps[pid],
                let bounds = windowBounds(window),
                bounds.contains(point),
                let payload = appPayload(app)
            else {
                continue
            }

            return payload
        }

        return nil
    }

    static func openApplication(bundleId: String) async throws {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) else {
            throw BridgeRuntimeError(message: "Unable to resolve app for bundle id \(bundleId)")
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true

        let app = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<NSRunningApplication, Error>) in
            NSWorkspace.shared.openApplication(at: url, configuration: configuration) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first {
                    continuation.resume(returning: app)
                } else {
                    continuation.resume(throwing: BridgeRuntimeError(message: "Opened \(bundleId) but could not resolve the running application"))
                }
            }
        }

        try await activateApplication(app, bundleId: bundleId)
    }

    private static func activateApplication(_ app: NSRunningApplication, bundleId: String) async throws {
        let options: NSApplication.ActivationOptions = [.activateAllWindows, .activateIgnoringOtherApps]

        for _ in 0..<20 {
            if app.activate(options: options) {
                return
            }

            if let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first,
               running.activate(options: options) {
                return
            }

            try await Task.sleep(nanoseconds: 100_000_000)
        }

        throw BridgeRuntimeError(message: "Opened \(bundleId) but failed to activate it")
    }

    static func hideApplications(bundleIds: [String]) -> [String] {
        let apps = NSWorkspace.shared.runningApplications.filter { app in
            guard let bundleId = app.bundleIdentifier else { return false }
            return bundleIds.contains(bundleId)
        }

        for app in apps {
            app.hide()
        }

        return apps.compactMap(\.bundleIdentifier)
    }

    static func unhideApplications(bundleIds: [String]) {
        let apps = NSWorkspace.shared.runningApplications.filter { app in
            guard let bundleId = app.bundleIdentifier else { return false }
            return bundleIds.contains(bundleId)
        }

        for app in apps {
            app.unhide()
        }
    }

    static func findWindowDisplays(bundleIds: [String]) -> [String: [Int]] {
        let runningApps = regularRunningApplicationsByPid().reduce(into: [pid_t: String]()) { partial, item in
            if let bundleId = item.value.bundleIdentifier {
                partial[item.key] = bundleId
            }
        }

        var results = [String: Set<Int>]()

        guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return [:]
        }

        for window in windowList {
            guard
                let pid = window[kCGWindowOwnerPID as String] as? Int32,
                let bundleId = runningApps[pid],
                bundleIds.contains(bundleId),
                let rect = windowBounds(window)
            else {
                continue
            }

            for display in DisplayService.listDisplays() {
                guard
                    let displayId = display["displayId"] as? Int,
                    let originX = display["originX"] as? Int,
                    let originY = display["originY"] as? Int,
                    let displayWidth = display["width"] as? Int,
                    let displayHeight = display["height"] as? Int
                else {
                    continue
                }

                let displayRect = CGRect(x: originX, y: originY, width: displayWidth, height: displayHeight)
                if rect.intersects(displayRect) {
                    var set = results[bundleId] ?? Set<Int>()
                    set.insert(displayId)
                    results[bundleId] = set
                }
            }
        }

        return results.mapValues { Array($0).sorted() }
    }
}
#else
enum AppService {
    static func listInstalledApps() -> [[String: Any]] { [] }
    static func listRunningApps() -> [[String: Any]] { [] }
    static func getFrontmostApp() -> [String: Any]? { nil }
    static func appUnderPoint(x: Double, y: Double) -> [String: Any]? { nil }
    static func openApplication(bundleId: String) async throws {}
    static func hideApplications(bundleIds: [String]) -> [String] { [] }
    static func unhideApplications(bundleIds: [String]) {}
    static func findWindowDisplays(bundleIds: [String]) -> [String: [Int]] { [:] }
}
#endif
