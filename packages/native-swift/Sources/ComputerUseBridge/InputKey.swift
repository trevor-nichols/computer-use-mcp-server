import Foundation

#if os(macOS)
import CoreGraphics
import Carbon.HIToolbox

enum InputModifierKey: String {
    case command
    case shift
    case option
    case control
    case fn

    var keyCode: CGKeyCode {
        switch self {
        case .command:
            return CGKeyCode(kVK_Command)
        case .shift:
            return CGKeyCode(kVK_Shift)
        case .option:
            return CGKeyCode(kVK_Option)
        case .control:
            return CGKeyCode(kVK_Control)
        case .fn:
            return CGKeyCode(kVK_Function)
        }
    }

    var flag: CGEventFlags {
        switch self {
        case .command:
            return .maskCommand
        case .shift:
            return .maskShift
        case .option:
            return .maskAlternate
        case .control:
            return .maskControl
        case .fn:
            return .maskSecondaryFn
        }
    }
}

enum ResolvedInputKey: Equatable {
    case keyCode(CGKeyCode)
    case modifier(InputModifierKey)

    var isModifier: Bool {
        if case .modifier = self {
            return true
        }
        return false
    }
}

enum InputKeyResolver {
    static func resolveKey(_ rawKey: String) -> ResolvedInputKey? {
        guard let normalizedKey = normalizeToken(rawKey) else {
            return nil
        }

        if let modifier = InputModifierKey(rawValue: normalizedKey) {
            return .modifier(modifier)
        }

        guard let keyCode = keyCodes[normalizedKey] else {
            return nil
        }
        return .keyCode(keyCode)
    }

    static func resolveChord(_ sequence: String) -> [ResolvedInputKey]? {
        let parts = sequence
            .split(separator: "+")
            .map { String($0) }

        guard !parts.isEmpty else {
            return nil
        }

        var resolved: [ResolvedInputKey] = []
        resolved.reserveCapacity(parts.count)

        for part in parts {
            guard let resolvedPart = resolveKey(part) else {
                return nil
            }
            resolved.append(resolvedPart)
        }

        if resolved.dropLast().contains(where: { !$0.isModifier }) {
            return nil
        }

        return resolved
    }

    private static func normalizeToken(_ rawKey: String) -> String? {
        let lowered = rawKey
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        guard !lowered.isEmpty else {
            return nil
        }

        return aliases[lowered] ?? lowered
    }

    private static let aliases: [String: String] = [
        "enter": "return",
        "esc": "escape",
        "backspace": "delete",
        "page_up": "pageup",
        "page_down": "pagedown",
        "left_arrow": "left",
        "right_arrow": "right",
        "up_arrow": "up",
        "down_arrow": "down",
        "cmd": "command",
        "alt": "option",
        "ctrl": "control",
        "function": "fn",
        "meta": "command",
        "super": "command",
        "windows": "command",
        "forwarddelete": "forward_delete",
        "-": "minus",
        "=": "equal",
        "[": "left_bracket",
        "]": "right_bracket",
        "\\": "backslash",
        ";": "semicolon",
        "'": "quote",
        ",": "comma",
        ".": "period",
        "/": "slash",
        "`": "grave"
    ]

    private static let keyCodes: [String: CGKeyCode] = [
        "a": CGKeyCode(kVK_ANSI_A),
        "b": CGKeyCode(kVK_ANSI_B),
        "c": CGKeyCode(kVK_ANSI_C),
        "d": CGKeyCode(kVK_ANSI_D),
        "e": CGKeyCode(kVK_ANSI_E),
        "f": CGKeyCode(kVK_ANSI_F),
        "g": CGKeyCode(kVK_ANSI_G),
        "h": CGKeyCode(kVK_ANSI_H),
        "i": CGKeyCode(kVK_ANSI_I),
        "j": CGKeyCode(kVK_ANSI_J),
        "k": CGKeyCode(kVK_ANSI_K),
        "l": CGKeyCode(kVK_ANSI_L),
        "m": CGKeyCode(kVK_ANSI_M),
        "n": CGKeyCode(kVK_ANSI_N),
        "o": CGKeyCode(kVK_ANSI_O),
        "p": CGKeyCode(kVK_ANSI_P),
        "q": CGKeyCode(kVK_ANSI_Q),
        "r": CGKeyCode(kVK_ANSI_R),
        "s": CGKeyCode(kVK_ANSI_S),
        "t": CGKeyCode(kVK_ANSI_T),
        "u": CGKeyCode(kVK_ANSI_U),
        "v": CGKeyCode(kVK_ANSI_V),
        "w": CGKeyCode(kVK_ANSI_W),
        "x": CGKeyCode(kVK_ANSI_X),
        "y": CGKeyCode(kVK_ANSI_Y),
        "z": CGKeyCode(kVK_ANSI_Z),
        "0": CGKeyCode(kVK_ANSI_0),
        "1": CGKeyCode(kVK_ANSI_1),
        "2": CGKeyCode(kVK_ANSI_2),
        "3": CGKeyCode(kVK_ANSI_3),
        "4": CGKeyCode(kVK_ANSI_4),
        "5": CGKeyCode(kVK_ANSI_5),
        "6": CGKeyCode(kVK_ANSI_6),
        "7": CGKeyCode(kVK_ANSI_7),
        "8": CGKeyCode(kVK_ANSI_8),
        "9": CGKeyCode(kVK_ANSI_9),
        "return": CGKeyCode(kVK_Return),
        "tab": CGKeyCode(kVK_Tab),
        "space": CGKeyCode(kVK_Space),
        "escape": CGKeyCode(kVK_Escape),
        "delete": CGKeyCode(kVK_Delete),
        "forward_delete": CGKeyCode(kVK_ForwardDelete),
        "left": CGKeyCode(kVK_LeftArrow),
        "right": CGKeyCode(kVK_RightArrow),
        "down": CGKeyCode(kVK_DownArrow),
        "up": CGKeyCode(kVK_UpArrow),
        "home": CGKeyCode(kVK_Home),
        "end": CGKeyCode(kVK_End),
        "pageup": CGKeyCode(kVK_PageUp),
        "pagedown": CGKeyCode(kVK_PageDown),
        "f1": CGKeyCode(kVK_F1),
        "f2": CGKeyCode(kVK_F2),
        "f3": CGKeyCode(kVK_F3),
        "f4": CGKeyCode(kVK_F4),
        "f5": CGKeyCode(kVK_F5),
        "f6": CGKeyCode(kVK_F6),
        "f7": CGKeyCode(kVK_F7),
        "f8": CGKeyCode(kVK_F8),
        "f9": CGKeyCode(kVK_F9),
        "f10": CGKeyCode(kVK_F10),
        "f11": CGKeyCode(kVK_F11),
        "f12": CGKeyCode(kVK_F12),
        "f13": CGKeyCode(kVK_F13),
        "f14": CGKeyCode(kVK_F14),
        "f15": CGKeyCode(kVK_F15),
        "f16": CGKeyCode(kVK_F16),
        "f17": CGKeyCode(kVK_F17),
        "f18": CGKeyCode(kVK_F18),
        "f19": CGKeyCode(kVK_F19),
        "f20": CGKeyCode(kVK_F20),
        "numpad0": CGKeyCode(kVK_ANSI_Keypad0),
        "numpad1": CGKeyCode(kVK_ANSI_Keypad1),
        "numpad2": CGKeyCode(kVK_ANSI_Keypad2),
        "numpad3": CGKeyCode(kVK_ANSI_Keypad3),
        "numpad4": CGKeyCode(kVK_ANSI_Keypad4),
        "numpad5": CGKeyCode(kVK_ANSI_Keypad5),
        "numpad6": CGKeyCode(kVK_ANSI_Keypad6),
        "numpad7": CGKeyCode(kVK_ANSI_Keypad7),
        "numpad8": CGKeyCode(kVK_ANSI_Keypad8),
        "numpad9": CGKeyCode(kVK_ANSI_Keypad9),
        "numpad_add": CGKeyCode(kVK_ANSI_KeypadPlus),
        "numpad_subtract": CGKeyCode(kVK_ANSI_KeypadMinus),
        "numpad_multiply": CGKeyCode(kVK_ANSI_KeypadMultiply),
        "numpad_divide": CGKeyCode(kVK_ANSI_KeypadDivide),
        "numpad_decimal": CGKeyCode(kVK_ANSI_KeypadDecimal),
        "minus": CGKeyCode(kVK_ANSI_Minus),
        "equal": CGKeyCode(kVK_ANSI_Equal),
        "left_bracket": CGKeyCode(kVK_ANSI_LeftBracket),
        "right_bracket": CGKeyCode(kVK_ANSI_RightBracket),
        "backslash": CGKeyCode(kVK_ANSI_Backslash),
        "semicolon": CGKeyCode(kVK_ANSI_Semicolon),
        "quote": CGKeyCode(kVK_ANSI_Quote),
        "comma": CGKeyCode(kVK_ANSI_Comma),
        "period": CGKeyCode(kVK_ANSI_Period),
        "slash": CGKeyCode(kVK_ANSI_Slash),
        "grave": CGKeyCode(kVK_ANSI_Grave)
    ]
}
#endif
