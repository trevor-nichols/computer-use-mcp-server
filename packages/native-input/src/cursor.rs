use napi_derive::napi;

use crate::error::InputError;

#[napi(object)]
#[derive(Debug, Clone, PartialEq)]
pub struct CursorPosition {
    pub x: f64,
    pub y: f64,
}

#[cfg(target_os = "macos")]
pub fn get_cursor_position() -> Result<CursorPosition, InputError> {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .map_err(|_| InputError::CursorQueryFailure)?;
    let event = CGEvent::new(source).map_err(|_| InputError::CursorQueryFailure)?;
    let location = event.location();

    Ok(CursorPosition {
        x: location.x,
        y: location.y,
    })
}

#[cfg(not(target_os = "macos"))]
pub fn get_cursor_position() -> Result<CursorPosition, InputError> {
    Err(InputError::UnsupportedPlatform)
}

#[cfg(target_os = "macos")]
pub fn move_mouse(x: f64, y: f64) -> Result<(), InputError> {
    use core_graphics::display::CGDisplay;
    use core_graphics::geometry::CGPoint;

    let point = CGPoint::new(x, y);
    CGDisplay::warp_mouse_cursor_position(point)
        .map_err(|_| InputError::NativeEventPostFailure("mouse warp"))?;
    CGDisplay::associate_mouse_and_mouse_cursor_position(true)
        .map_err(|_| InputError::NativeEventPostFailure("mouse association"))?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn move_mouse(_x: f64, _y: f64) -> Result<(), InputError> {
    Err(InputError::UnsupportedPlatform)
}
