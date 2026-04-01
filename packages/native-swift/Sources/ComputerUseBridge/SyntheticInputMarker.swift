import Foundation

#if os(macOS)
import CoreGraphics

enum SyntheticInputMarker {
    static let eventSourceUserData: Int64 = 0x43554D4350455343

    static func mark(_ event: CGEvent?) {
        event?.setIntegerValueField(.eventSourceUserData, value: eventSourceUserData)
    }

    static func isMarked(_ event: CGEvent) -> Bool {
        event.getIntegerValueField(.eventSourceUserData) == eventSourceUserData
    }
}
#else
enum SyntheticInputMarker {
    static let eventSourceUserData: Int64 = 0
}
#endif
