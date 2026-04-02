import Foundation

#if os(macOS)
import AppKit
import CoreGraphics

enum InputService {
    private static var activeModifierCounts: [InputModifierKey: Int] = [:]

    private static var activeModifierFlags: CGEventFlags {
        activeModifierCounts.reduce(into: CGEventFlags()) { result, entry in
            if entry.value > 0 {
                result.insert(entry.key.flag)
            }
        }
    }

    static func getCursorPosition() -> [String: Any] {
        let point = CGEvent(source: nil)?.location ?? .zero
        return [
            "x": Int(point.x),
            "y": Int(point.y)
        ]
    }

    static func moveMouse(x: Double, y: Double) {
        let point = CGPoint(x: x, y: y)
        CGWarpMouseCursorPosition(point)
        CGAssociateMouseAndMouseCursorPosition(1)
    }

    static func mouseDown(button: String) {
        let point = CGEvent(source: nil)?.location ?? .zero
        postMouseEvent(button: button, type: mouseDownType(button), point: point, clickState: 1)
    }

    static func mouseUp(button: String) {
        let point = CGEvent(source: nil)?.location ?? .zero
        postMouseEvent(button: button, type: mouseUpType(button), point: point, clickState: 1)
    }

    static func click(button: String, count: Int) {
        let point = CGEvent(source: nil)?.location ?? .zero
        for index in 1...count {
            postMouseEvent(button: button, type: mouseDownType(button), point: point, clickState: Int64(index))
            postMouseEvent(button: button, type: mouseUpType(button), point: point, clickState: Int64(index))
        }
    }

    static func scroll(dx: Double, dy: Double) {
        let event = CGEvent(
            scrollWheelEvent2Source: nil,
            units: .pixel,
            wheelCount: 2,
            wheel1: Int32(dy),
            wheel2: Int32(dx),
            wheel3: 0
        )
        event?.post(tap: .cghidEventTap)
    }

    static func keySequence(_ sequence: String) {
        guard let resolvedKeys = InputKeyResolver.resolveChord(sequence),
              let finalKey = resolvedKeys.last else {
            return
        }

        let leadingModifiers = Array(resolvedKeys.dropLast())

        for modifier in leadingModifiers {
            postResolvedKey(modifier, down: true)
        }

        postResolvedKey(finalKey, down: true)
        postResolvedKey(finalKey, down: false)

        for modifier in leadingModifiers.reversed() {
            postResolvedKey(modifier, down: false)
        }
    }

    static func keyDown(_ key: String) {
        guard let resolvedKey = InputKeyResolver.resolveKey(key) else { return }
        postResolvedKey(resolvedKey, down: true)
    }

    static func keyUp(_ key: String) {
        guard let resolvedKey = InputKeyResolver.resolveKey(key) else { return }
        postResolvedKey(resolvedKey, down: false)
    }

    static func typeText(_ text: String) {
        for scalar in text.unicodeScalars {
            let value = Array(String(scalar).utf16)
            let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
            down?.keyboardSetUnicodeString(stringLength: value.count, unicodeString: value)
            down?.post(tap: .cghidEventTap)

            let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)
            up?.keyboardSetUnicodeString(stringLength: value.count, unicodeString: value)
            up?.post(tap: .cghidEventTap)
        }
    }

    private static func postResolvedKey(_ key: ResolvedInputKey, down: Bool) {
        switch key {
        case .keyCode(let keyCode):
            postKey(keyCode: keyCode, down: down, flags: activeModifierFlags)
        case .modifier(let modifier):
            postModifier(modifier, down: down)
        }
    }

    private static func postMouseEvent(button: String, type: CGEventType, point: CGPoint, clickState: Int64) {
        guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: mouseButton(button)) else {
            return
        }
        event.setIntegerValueField(.mouseEventClickState, value: clickState)
        event.post(tap: .cghidEventTap)
    }

    @discardableResult
    private static func postKey(keyCode: CGKeyCode, down: Bool, flags: CGEventFlags) -> Bool {
        guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: down) else { return false }
        event.flags = flags
        SyntheticInputMarker.mark(event)
        event.post(tap: .cghidEventTap)
        return true
    }

    private static func postModifier(_ modifier: InputModifierKey, down: Bool) {
        let currentCount = activeModifierCounts[modifier, default: 0]
        let nextCount = down ? currentCount + 1 : max(0, currentCount - 1)
        var eventFlags = activeModifierFlags

        if down || nextCount > 0 {
            eventFlags.insert(modifier.flag)
        } else {
            eventFlags.remove(modifier.flag)
        }

        if postKey(keyCode: modifier.keyCode, down: down, flags: eventFlags) {
            activeModifierCounts[modifier] = nextCount
            if nextCount == 0 {
                activeModifierCounts.removeValue(forKey: modifier)
            }
        }
    }

    private static func mouseButton(_ button: String) -> CGMouseButton {
        switch button {
        case "right": return .right
        case "middle": return .center
        default: return .left
        }
    }

    private static func mouseDownType(_ button: String) -> CGEventType {
        switch button {
        case "right": return .rightMouseDown
        case "middle": return .otherMouseDown
        default: return .leftMouseDown
        }
    }

    private static func mouseUpType(_ button: String) -> CGEventType {
        switch button {
        case "right": return .rightMouseUp
        case "middle": return .otherMouseUp
        default: return .leftMouseUp
        }
    }
}
#else
enum InputService {
    static func getCursorPosition() -> [String: Any] { ["x": 0, "y": 0] }
    static func moveMouse(x: Double, y: Double) {}
    static func mouseDown(button: String) {}
    static func mouseUp(button: String) {}
    static func click(button: String, count: Int) {}
    static func scroll(dx: Double, dy: Double) {}
    static func keySequence(_ sequence: String) {}
    static func keyDown(_ key: String) {}
    static func keyUp(_ key: String) {}
    static func typeText(_ text: String) {}
}
#endif
