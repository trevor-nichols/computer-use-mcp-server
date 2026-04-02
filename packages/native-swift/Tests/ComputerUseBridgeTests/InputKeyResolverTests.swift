import XCTest
import Carbon.HIToolbox
@testable import ComputerUseBridge

final class InputKeyResolverTests: XCTestCase {
    func testResolveModifierAliases() {
        XCTAssertEqual(InputKeyResolver.resolveKey("cmd"), .modifier(.command))
        XCTAssertEqual(InputKeyResolver.resolveKey("meta"), .modifier(.command))
        XCTAssertEqual(InputKeyResolver.resolveKey("super"), .modifier(.command))
        XCTAssertEqual(InputKeyResolver.resolveKey("windows"), .modifier(.command))
        XCTAssertEqual(InputKeyResolver.resolveKey("alt"), .modifier(.option))
        XCTAssertEqual(InputKeyResolver.resolveKey("ctrl"), .modifier(.control))
        XCTAssertEqual(InputKeyResolver.resolveKey("function"), .modifier(.fn))
    }

    func testResolveFunctionAndNavigationKeys() {
        XCTAssertEqual(InputKeyResolver.resolveKey("f1"), .keyCode(CGKeyCode(kVK_F1)))
        XCTAssertEqual(InputKeyResolver.resolveKey("f20"), .keyCode(CGKeyCode(kVK_F20)))
        XCTAssertEqual(InputKeyResolver.resolveKey("home"), .keyCode(CGKeyCode(kVK_Home)))
        XCTAssertEqual(InputKeyResolver.resolveKey("end"), .keyCode(CGKeyCode(kVK_End)))
        XCTAssertEqual(InputKeyResolver.resolveKey("page_up"), .keyCode(CGKeyCode(kVK_PageUp)))
        XCTAssertEqual(InputKeyResolver.resolveKey("pagedown"), .keyCode(CGKeyCode(kVK_PageDown)))
        XCTAssertEqual(InputKeyResolver.resolveKey("left_arrow"), .keyCode(CGKeyCode(kVK_LeftArrow)))
    }

    func testDeleteCompatibilityAndForwardDelete() {
        XCTAssertEqual(InputKeyResolver.resolveKey("delete"), .keyCode(CGKeyCode(kVK_Delete)))
        XCTAssertEqual(InputKeyResolver.resolveKey("backspace"), .keyCode(CGKeyCode(kVK_Delete)))
        XCTAssertEqual(InputKeyResolver.resolveKey("forward_delete"), .keyCode(CGKeyCode(kVK_ForwardDelete)))
        XCTAssertEqual(InputKeyResolver.resolveKey("forwarddelete"), .keyCode(CGKeyCode(kVK_ForwardDelete)))
    }

    func testResolveNamedAndRawPunctuationAliases() {
        XCTAssertEqual(InputKeyResolver.resolveKey("period"), .keyCode(CGKeyCode(kVK_ANSI_Period)))
        XCTAssertEqual(InputKeyResolver.resolveKey("."), .keyCode(CGKeyCode(kVK_ANSI_Period)))
        XCTAssertEqual(InputKeyResolver.resolveKey("left_bracket"), .keyCode(CGKeyCode(kVK_ANSI_LeftBracket)))
        XCTAssertEqual(InputKeyResolver.resolveKey("["), .keyCode(CGKeyCode(kVK_ANSI_LeftBracket)))
        XCTAssertEqual(InputKeyResolver.resolveKey("quote"), .keyCode(CGKeyCode(kVK_ANSI_Quote)))
        XCTAssertEqual(InputKeyResolver.resolveKey("'"), .keyCode(CGKeyCode(kVK_ANSI_Quote)))
        XCTAssertEqual(InputKeyResolver.resolveKey("grave"), .keyCode(CGKeyCode(kVK_ANSI_Grave)))
        XCTAssertEqual(InputKeyResolver.resolveKey("`"), .keyCode(CGKeyCode(kVK_ANSI_Grave)))
    }

    func testResolveNumpadKeys() {
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad0"), .keyCode(CGKeyCode(kVK_ANSI_Keypad0)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad9"), .keyCode(CGKeyCode(kVK_ANSI_Keypad9)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad_add"), .keyCode(CGKeyCode(kVK_ANSI_KeypadPlus)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad_subtract"), .keyCode(CGKeyCode(kVK_ANSI_KeypadMinus)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad_multiply"), .keyCode(CGKeyCode(kVK_ANSI_KeypadMultiply)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad_divide"), .keyCode(CGKeyCode(kVK_ANSI_KeypadDivide)))
        XCTAssertEqual(InputKeyResolver.resolveKey("numpad_decimal"), .keyCode(CGKeyCode(kVK_ANSI_KeypadDecimal)))
    }

    func testResolveChordAllowsModifierPrefixesAndPunctuationShortcuts() {
        XCTAssertEqual(
            InputKeyResolver.resolveChord("command+["),
            [
                .modifier(.command),
                .keyCode(CGKeyCode(kVK_ANSI_LeftBracket))
            ]
        )
        XCTAssertEqual(
            InputKeyResolver.resolveChord("cmd+shift+."),
            [
                .modifier(.command),
                .modifier(.shift),
                .keyCode(CGKeyCode(kVK_ANSI_Period))
            ]
        )
        XCTAssertEqual(
            InputKeyResolver.resolveChord("shift"),
            [
                .modifier(.shift)
            ]
        )
    }

    func testResolveChordFailsClosedForUnknownOrNonModifierPrefixes() {
        XCTAssertNil(InputKeyResolver.resolveChord("a+b"))
        XCTAssertNil(InputKeyResolver.resolveChord("command+does_not_exist"))
        XCTAssertNil(InputKeyResolver.resolveKey(""))
    }
}
