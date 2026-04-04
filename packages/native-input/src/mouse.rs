use crate::cursor;
use crate::error::InputError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButtonKind {
    Left,
    Right,
    Middle,
}

impl MouseButtonKind {
    pub fn parse(raw: &str) -> Result<Self, InputError> {
        match raw {
            "left" => Ok(Self::Left),
            "right" => Ok(Self::Right),
            "middle" => Ok(Self::Middle),
            _ => Err(InputError::InvalidMouseButton(raw.to_string())),
        }
    }
}

pub fn mouse_down(button: &str) -> Result<(), InputError> {
    let point = cursor::get_cursor_position()?;
    post_mouse_event(MouseButtonKind::parse(button)?, MouseEventPhase::Down, point.x, point.y, 1)
}

pub fn mouse_up(button: &str) -> Result<(), InputError> {
    let point = cursor::get_cursor_position()?;
    post_mouse_event(MouseButtonKind::parse(button)?, MouseEventPhase::Up, point.x, point.y, 1)
}

pub fn click(button: &str, count: i32) -> Result<(), InputError> {
    if !(1..=3).contains(&count) {
        return Err(InputError::InvalidClickCount(count));
    }

    let button = MouseButtonKind::parse(button)?;
    let point = cursor::get_cursor_position()?;

    for click_state in 1..=count {
        post_mouse_event(button, MouseEventPhase::Down, point.x, point.y, i64::from(click_state))?;
        post_mouse_event(button, MouseEventPhase::Up, point.x, point.y, i64::from(click_state))?;
    }

    Ok(())
}

#[derive(Debug, Clone, Copy)]
enum MouseEventPhase {
    Down,
    Up,
}

#[cfg(target_os = "macos")]
fn post_mouse_event(
    button: MouseButtonKind,
    phase: MouseEventPhase,
    x: f64,
    y: f64,
    click_state: i64,
) -> Result<(), InputError> {
    use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventType, CGMouseButton, EventField};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use core_graphics::geometry::CGPoint;

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| InputError::NativeEventCreateFailure("mouse"))?;
    let event = CGEvent::new_mouse_event(
        source,
        match (button, phase) {
            (MouseButtonKind::Left, MouseEventPhase::Down) => CGEventType::LeftMouseDown,
            (MouseButtonKind::Left, MouseEventPhase::Up) => CGEventType::LeftMouseUp,
            (MouseButtonKind::Right, MouseEventPhase::Down) => CGEventType::RightMouseDown,
            (MouseButtonKind::Right, MouseEventPhase::Up) => CGEventType::RightMouseUp,
            (MouseButtonKind::Middle, MouseEventPhase::Down) => CGEventType::OtherMouseDown,
            (MouseButtonKind::Middle, MouseEventPhase::Up) => CGEventType::OtherMouseUp,
        },
        CGPoint::new(x, y),
        match button {
            MouseButtonKind::Left => CGMouseButton::Left,
            MouseButtonKind::Right => CGMouseButton::Right,
            MouseButtonKind::Middle => CGMouseButton::Center,
        },
    )
    .map_err(|_| InputError::NativeEventCreateFailure("mouse"))?;

    event.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, click_state);
    event.post(CGEventTapLocation::HID);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn post_mouse_event(
    _button: MouseButtonKind,
    _phase: MouseEventPhase,
    _x: f64,
    _y: f64,
    _click_state: i64,
) -> Result<(), InputError> {
    Err(InputError::UnsupportedPlatform)
}
