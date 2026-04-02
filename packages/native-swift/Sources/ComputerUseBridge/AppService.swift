import Foundation

#if os(macOS)
import AppKit
import CoreGraphics

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
        let roots = ["/Applications", "/System/Applications"]
        var results: [[String: Any]] = []

        for root in roots {
            guard let items = try? FileManager.default.contentsOfDirectory(atPath: root) else { continue }
            for item in items where item.hasSuffix(".app") {
                let url = URL(fileURLWithPath: root).appendingPathComponent(item)
                let bundle = Bundle(url: url)
                results.append([
                    "bundleId": bundle?.bundleIdentifier ?? item,
                    "displayName": bundle?.object(forInfoDictionaryKey: "CFBundleName") as? String ?? item.replacingOccurrences(of: ".app", with: ""),
                    "path": url.path
                ])
            }
        }

        return results
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
