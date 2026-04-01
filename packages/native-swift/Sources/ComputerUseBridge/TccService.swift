import Foundation

#if os(macOS)
import AppKit
import ApplicationServices
import CoreGraphics

enum TccService {
    static func getState() -> [String: Any] {
        let screenRecording: Bool
        if #available(macOS 11.0, *) {
            screenRecording = CGPreflightScreenCaptureAccess()
        } else {
            screenRecording = true
        }

        return [
            "accessibility": AXIsProcessTrusted(),
            "screenRecording": screenRecording
        ]
    }

    static func openAccessibilitySettings() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") else { return }
        NSWorkspace.shared.open(url)
    }

    static func openScreenRecordingSettings() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") else { return }
        NSWorkspace.shared.open(url)
    }
}
#else
enum TccService {
    static func getState() -> [String: Any] {
        ["accessibility": false, "screenRecording": false]
    }

    static func openAccessibilitySettings() {}
    static func openScreenRecordingSettings() {}
}
#endif
