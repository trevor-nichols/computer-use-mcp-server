use computer_use_native_input::error::InputError;
use computer_use_native_input::keymap::{resolve_chord, resolve_key, InputModifierKey, ResolvedInputKey};

#[test]
fn resolves_modifier_aliases() {
    assert_eq!(resolve_key("cmd"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Command)));
    assert_eq!(resolve_key("meta"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Command)));
    assert_eq!(resolve_key("super"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Command)));
    assert_eq!(resolve_key("windows"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Command)));
    assert_eq!(resolve_key("alt"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Option)));
    assert_eq!(resolve_key("ctrl"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Control)));
    assert_eq!(resolve_key("function"), Ok(ResolvedInputKey::Modifier(InputModifierKey::Fn)));
}

#[test]
fn resolves_function_navigation_and_delete_keys() {
    assert_eq!(resolve_key("f1"), Ok(ResolvedInputKey::KeyCode(122)));
    assert_eq!(resolve_key("f20"), Ok(ResolvedInputKey::KeyCode(90)));
    assert_eq!(resolve_key("home"), Ok(ResolvedInputKey::KeyCode(115)));
    assert_eq!(resolve_key("end"), Ok(ResolvedInputKey::KeyCode(119)));
    assert_eq!(resolve_key("page_up"), Ok(ResolvedInputKey::KeyCode(116)));
    assert_eq!(resolve_key("pagedown"), Ok(ResolvedInputKey::KeyCode(121)));
    assert_eq!(resolve_key("left_arrow"), Ok(ResolvedInputKey::KeyCode(123)));
    assert_eq!(resolve_key("delete"), Ok(ResolvedInputKey::KeyCode(51)));
    assert_eq!(resolve_key("backspace"), Ok(ResolvedInputKey::KeyCode(51)));
    assert_eq!(resolve_key("forwarddelete"), Ok(ResolvedInputKey::KeyCode(117)));
}

#[test]
fn resolves_named_and_raw_punctuation_aliases() {
    assert_eq!(resolve_key("period"), Ok(ResolvedInputKey::KeyCode(47)));
    assert_eq!(resolve_key("."), Ok(ResolvedInputKey::KeyCode(47)));
    assert_eq!(resolve_key("left_bracket"), Ok(ResolvedInputKey::KeyCode(33)));
    assert_eq!(resolve_key("["), Ok(ResolvedInputKey::KeyCode(33)));
    assert_eq!(resolve_key("quote"), Ok(ResolvedInputKey::KeyCode(39)));
    assert_eq!(resolve_key("'"), Ok(ResolvedInputKey::KeyCode(39)));
    assert_eq!(resolve_key("grave"), Ok(ResolvedInputKey::KeyCode(50)));
    assert_eq!(resolve_key("`"), Ok(ResolvedInputKey::KeyCode(50)));
}

#[test]
fn resolves_numpad_keys() {
    assert_eq!(resolve_key("numpad0"), Ok(ResolvedInputKey::KeyCode(82)));
    assert_eq!(resolve_key("numpad9"), Ok(ResolvedInputKey::KeyCode(92)));
    assert_eq!(resolve_key("numpad_add"), Ok(ResolvedInputKey::KeyCode(69)));
    assert_eq!(resolve_key("numpad_subtract"), Ok(ResolvedInputKey::KeyCode(78)));
    assert_eq!(resolve_key("numpad_multiply"), Ok(ResolvedInputKey::KeyCode(67)));
    assert_eq!(resolve_key("numpad_divide"), Ok(ResolvedInputKey::KeyCode(75)));
    assert_eq!(resolve_key("numpad_decimal"), Ok(ResolvedInputKey::KeyCode(65)));
}

#[test]
fn resolves_chords_with_modifier_prefixes_and_punctuation_shortcuts() {
    assert_eq!(
        resolve_chord("command+["),
        Ok(vec![
            ResolvedInputKey::Modifier(InputModifierKey::Command),
            ResolvedInputKey::KeyCode(33),
        ])
    );
    assert_eq!(
        resolve_chord("cmd+shift+."),
        Ok(vec![
            ResolvedInputKey::Modifier(InputModifierKey::Command),
            ResolvedInputKey::Modifier(InputModifierKey::Shift),
            ResolvedInputKey::KeyCode(47),
        ])
    );
    assert_eq!(
        resolve_chord("shift"),
        Ok(vec![ResolvedInputKey::Modifier(InputModifierKey::Shift)])
    );
}

#[test]
fn fails_closed_for_unknown_or_non_modifier_prefixes() {
    assert_eq!(resolve_chord("a+b"), Err(InputError::InvalidKeySequence("a+b".to_string())));
    assert_eq!(resolve_chord("command+does_not_exist"), Err(InputError::InvalidKeyToken("does_not_exist".to_string())));
    assert_eq!(resolve_key(""), Err(InputError::InvalidKeyToken("".to_string())));
}
