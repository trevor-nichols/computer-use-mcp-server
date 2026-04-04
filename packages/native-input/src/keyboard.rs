use crate::error::InputError;
use crate::keymap::{resolve_chord, resolve_key, InputModifierKey, ResolvedInputKey};
use crate::modifiers::with_modifier_state;

pub fn key_sequence(sequence: &str) -> Result<(), InputError> {
    let resolved = resolve_chord(sequence)?;
    let final_key = *resolved
        .last()
        .ok_or_else(|| InputError::InvalidKeySequence(sequence.to_string()))?;

    let mut pressed_modifiers = Vec::new();
    for modifier in resolved.iter().take(resolved.len().saturating_sub(1)).copied() {
        if let ResolvedInputKey::Modifier(modifier_key) = modifier {
            post_modifier(modifier_key, true)?;
            pressed_modifiers.push(modifier_key);
        }
    }

    let result = (|| {
        post_resolved_key(final_key, true)?;
        post_resolved_key(final_key, false)
    })();

    for modifier in pressed_modifiers.into_iter().rev() {
        let _ = post_modifier(modifier, false);
    }

    result
}

pub fn key_down(key: &str) -> Result<(), InputError> {
    post_resolved_key(resolve_key(key)?, true)
}

pub fn key_up(key: &str) -> Result<(), InputError> {
    post_resolved_key(resolve_key(key)?, false)
}

pub fn type_text(text: &str) -> Result<(), InputError> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::{CGEvent, CGEventTapLocation};
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

        for scalar in text.chars() {
            let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
                .map_err(|_| InputError::NativeEventCreateFailure("keyboard"))?;
            let down = CGEvent::new_keyboard_event(source.clone(), 0, true)
                .map_err(|_| InputError::NativeEventCreateFailure("keyboard"))?;
            down.set_string(&scalar.to_string());
            crate::marker::mark_synthetic(&down);
            down.post(CGEventTapLocation::HID);

            let up = CGEvent::new_keyboard_event(source, 0, false)
                .map_err(|_| InputError::NativeEventCreateFailure("keyboard"))?;
            up.set_string(&scalar.to_string());
            crate::marker::mark_synthetic(&up);
            up.post(CGEventTapLocation::HID);
        }
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err(InputError::UnsupportedPlatform)
    }
}

fn post_resolved_key(key: ResolvedInputKey, down: bool) -> Result<(), InputError> {
    match key {
        ResolvedInputKey::KeyCode(key_code) => post_key_event(key_code, down, current_modifier_flags()),
        ResolvedInputKey::Modifier(modifier) => post_modifier(modifier, down),
    }
}

fn current_modifier_flags() -> u64 {
    with_modifier_state(|state| state.active_flag_bits())
}

fn post_modifier(modifier: InputModifierKey, down: bool) -> Result<(), InputError> {
    with_modifier_state(|state| {
        let flags = state.next_event_flag_bits(modifier, down);
        post_key_event(modifier.key_code(), down, flags)?;
        state.apply_transition(modifier, down);
        Ok(())
    })
}

#[cfg(target_os = "macos")]
fn post_key_event(key_code: u16, down: bool, flags: u64) -> Result<(), InputError> {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| InputError::NativeEventCreateFailure("keyboard"))?;
    let event = CGEvent::new_keyboard_event(source, key_code, down)
        .map_err(|_| InputError::NativeEventCreateFailure("keyboard"))?;
    event.set_flags(CGEventFlags::from_bits_retain(flags));
    crate::marker::mark_synthetic(&event);
    event.post(CGEventTapLocation::HID);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn post_key_event(_key_code: u16, _down: bool, _flags: u64) -> Result<(), InputError> {
    Err(InputError::UnsupportedPlatform)
}
