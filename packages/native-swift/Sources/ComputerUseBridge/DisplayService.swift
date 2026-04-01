import Foundation

#if os(macOS)
import AppKit
import CoreGraphics

enum DisplayService {
    static func listDisplays() -> [[String: Any]] {
        var count: UInt32 = 0
        _ = CGGetActiveDisplayList(0, nil, &count)
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        _ = CGGetActiveDisplayList(count, &ids, &count)

        let mainDisplay = CGMainDisplayID()

        return ids.map { id in
            let bounds = CGDisplayBounds(id)
            let screen = NSScreen.screens.first {
                guard let number = $0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {
                    return false
                }
                return number.uint32Value == id
            }

            return [
                "displayId": Int(id),
                "name": screen?.localizedName ?? "Display \(id)",
                "originX": Int(bounds.origin.x),
                "originY": Int(bounds.origin.y),
                "width": Int(bounds.width),
                "height": Int(bounds.height),
                "scaleFactor": screen?.backingScaleFactor ?? 1.0,
                "isPrimary": id == mainDisplay
            ]
        }
    }

    static func displayInfo(for displayId: Int?) -> [String: Any]? {
        let displays = listDisplays()
        if let displayId {
            return displays.first { ($0["displayId"] as? Int) == displayId }
        }
        return displays.first
    }
}
#else
enum DisplayService {
    static func listDisplays() -> [[String: Any]] { [] }
    static func displayInfo(for displayId: Int?) -> [String: Any]? { nil }
}
#endif
