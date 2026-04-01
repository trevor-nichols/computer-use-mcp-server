import Foundation

#if os(macOS)
import AppKit
import CoreGraphics

enum InputService {
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
        let parts = sequence
            .split(separator: "+")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

        if parts.isEmpty { return }

        let modifiers = parts.dropLast().compactMap { modifierFlag(String($0)) }
        let mainKeyName = String(parts.last!)
        guard let keyCode = keyCodeForKey(mainKeyName) else { return }

        for modifier in modifiers {
            postModifier(flag: modifier, down: true)
        }

        postKey(keyCode: keyCode, down: true, flags: modifiers.reduce([], { $0.union($1) }))
        postKey(keyCode: keyCode, down: false, flags: modifiers.reduce([], { $0.union($1) }))

        for modifier in modifiers.reversed() {
            postModifier(flag: modifier, down: false)
        }
    }

    static func keyDown(_ key: String) {
        guard let keyCode = keyCodeForKey(key.lowercased()) else { return }
        postKey(keyCode: keyCode, down: true, flags: [])
    }

    static func keyUp(_ key: String) {
        guard let keyCode = keyCodeForKey(key.lowercased()) else { return }
        postKey(keyCode: keyCode, down: false, flags: [])
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

    private static func postMouseEvent(button: String, type: CGEventType, point: CGPoint, clickState: Int64) {
        guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: mouseButton(button)) else {
            return
        }
        event.setIntegerValueField(.mouseEventClickState, value: clickState)
        event.post(tap: .cghidEventTap)
    }

    private static func postKey(keyCode: CGKeyCode, down: Bool, flags: CGEventFlags) {
        guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: down) else { return }
        event.flags = flags
        SyntheticInputMarker.mark(event)
        event.post(tap: .cghidEventTap)
    }

    private static func postModifier(flag: CGEventFlags, down: Bool) {
        let key: CGKeyCode
        switch flag {
        case .maskCommand: key = 55
        case .maskShift: key = 56
        case .maskAlternate: key = 58
        case .maskControl: key = 59
        case .maskSecondaryFn: key = 63
        default: return
        }
        postKey(keyCode: key, down: down, flags: down ? flag : [])
    }

    private static func modifierFlag(_ key: String) -> CGEventFlags? {
        switch key {
        case "command", "cmd": return .maskCommand
        case "shift": return .maskShift
        case "option", "alt": return .maskAlternate
        case "control", "ctrl": return .maskControl
        case "fn", "function": return .maskSecondaryFn
        default: return nil
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

    private static func keyCodeForKey(_ key: String) -> CGKeyCode? {
        switch key {
        case "a": return 0
        case "b": return 11
        case "c": return 8
        case "d": return 2
        case "e": return 14
        case "f": return 3
        case "g": return 5
        case "h": return 4
        case "i": return 34
        case "j": return 38
        case "k": return 40
        case "l": return 37
        case "m": return 46
        case "n": return 45
        case "o": return 31
        case "p": return 35
        case "q": return 12
        case "r": return 15
        case "s": return 1
        case "t": return 17
        case "u": return 32
        case "v": return 9
        case "w": return 13
        case "x": return 7
        case "y": return 16
        case "z": return 6
        case "0": return 29
        case "1": return 18
        case "2": return 19
        case "3": return 20
        case "4": return 21
        case "5": return 23
        case "6": return 22
        case "7": return 26
        case "8": return 28
        case "9": return 25
        case "return", "enter": return 36
        case "tab": return 48
        case "space": return 49
        case "escape", "esc": return 53
        case "delete", "backspace": return 51
        case "left": return 123
        case "right": return 124
        case "down": return 125
        case "up": return 126
        default: return nil
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
