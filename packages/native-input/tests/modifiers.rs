use computer_use_native_input::keymap::InputModifierKey;
use computer_use_native_input::modifiers::ModifierState;

#[test]
fn standalone_modifier_hold_and_release_updates_counts_and_flags() {
    let mut state = ModifierState::default();

    assert_eq!(state.active_flag_bits(), 0);
    assert_eq!(state.next_event_flag_bits(InputModifierKey::Command, true), InputModifierKey::Command.flag_bits());

    state.apply_transition(InputModifierKey::Command, true);
    assert_eq!(state.count(InputModifierKey::Command), 1);
    assert_eq!(state.active_flag_bits(), InputModifierKey::Command.flag_bits());

    assert_eq!(state.next_event_flag_bits(InputModifierKey::Command, false), 0);
    state.apply_transition(InputModifierKey::Command, false);
    assert_eq!(state.count(InputModifierKey::Command), 0);
    assert_eq!(state.active_flag_bits(), 0);
}

#[test]
fn overlapping_hold_and_chord_do_not_release_modifier_early() {
    let mut state = ModifierState::default();
    state.apply_transition(InputModifierKey::Command, true);

    let chord_down_flags = state.next_event_flag_bits(InputModifierKey::Command, true);
    assert_eq!(chord_down_flags, InputModifierKey::Command.flag_bits());
    state.apply_transition(InputModifierKey::Command, true);
    assert_eq!(state.count(InputModifierKey::Command), 2);

    let chord_up_flags = state.next_event_flag_bits(InputModifierKey::Command, false);
    assert_eq!(chord_up_flags, InputModifierKey::Command.flag_bits());
    state.apply_transition(InputModifierKey::Command, false);
    assert_eq!(state.count(InputModifierKey::Command), 1);
    assert_eq!(state.active_flag_bits(), InputModifierKey::Command.flag_bits());
}

#[test]
fn repeated_modifier_down_up_balances_counts() {
    let mut state = ModifierState::default();
    state.apply_transition(InputModifierKey::Shift, true);
    state.apply_transition(InputModifierKey::Shift, true);
    state.apply_transition(InputModifierKey::Shift, true);
    assert_eq!(state.count(InputModifierKey::Shift), 3);

    state.apply_transition(InputModifierKey::Shift, false);
    state.apply_transition(InputModifierKey::Shift, false);
    assert_eq!(state.count(InputModifierKey::Shift), 1);
    assert_eq!(state.active_flag_bits(), InputModifierKey::Shift.flag_bits());

    state.apply_transition(InputModifierKey::Shift, false);
    assert_eq!(state.count(InputModifierKey::Shift), 0);
    assert_eq!(state.active_flag_bits(), 0);
}
