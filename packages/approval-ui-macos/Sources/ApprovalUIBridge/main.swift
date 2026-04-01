import Foundation

#if os(macOS)
import AppKit

func output(_ object: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: object),
       let text = String(data: data, encoding: .utf8) {
        print(text)
    } else {
        print("{\"approved\":false}")
    }
}

func runTccMode(payload: [String: Any]) {
    let alert = NSAlert()
    alert.messageText = "Grant macOS permissions"
    alert.informativeText = "Grant Accessibility and Screen Recording in System Settings, then return here and click Continue."
    alert.alertStyle = .informational
    alert.addButton(withTitle: "Continue")
    alert.addButton(withTitle: "Cancel")
    let response = alert.runModal()

    output([
        "acknowledged": response == .alertFirstButtonReturn
    ])
}

func runAppAccessMode(payload: [String: Any]) {
    let apps = (payload["requestedApps"] as? [[String: Any]] ?? [])
        .compactMap { $0["displayName"] as? String ?? $0["bundleId"] as? String }
        .joined(separator: ", ")

    let flags = payload["requestedFlags"] as? [String: Any] ?? [:]
    let requestedFlags = [
        (flags["clipboardRead"] as? Bool ?? false) ? "clipboard read" : nil,
        (flags["clipboardWrite"] as? Bool ?? false) ? "clipboard write" : nil,
        (flags["systemKeyCombos"] as? Bool ?? false) ? "system key combos" : nil,
    ].compactMap { $0 }.joined(separator: ", ")

    let alert = NSAlert()
    alert.messageText = "Allow app control for this session?"
    alert.informativeText = [
        apps.isEmpty ? nil : "Requested apps: \(apps)",
        requestedFlags.isEmpty ? nil : "Requested capabilities: \(requestedFlags)",
    ].compactMap { $0 }.joined(separator: "\n")
    alert.alertStyle = .warning
    alert.addButton(withTitle: "Allow")
    alert.addButton(withTitle: "Deny")
    let response = alert.runModal()

    let approved = response == .alertFirstButtonReturn
    output([
        "approved": approved,
        "grantedApps": approved ? (payload["requestedApps"] as? [[String: Any]] ?? []) : [],
        "deniedApps": approved ? [] : (payload["requestedApps"] as? [[String: Any]] ?? []),
        "effectiveFlags": approved ? (payload["requestedFlags"] as? [String: Any] ?? [:]) : [
            "clipboardRead": false,
            "clipboardWrite": false,
            "systemKeyCombos": false,
        ]
    ])
}

let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? "{}"
let payload = (try? JSONSerialization.jsonObject(with: Data(input.utf8))) as? [String: Any] ?? [:]
let mode = payload["mode"] as? String ?? ""

switch mode {
case "tcc":
    runTccMode(payload: payload)
case "app-access":
    runAppAccessMode(payload: payload)
default:
    output(["approved": false, "message": "Unknown mode"])
}
#else
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? "{}"
_ = input
print("{\"approved\":false,\"acknowledged\":false}")
#endif
