use crate::error::InputError;

#[cfg(target_os = "macos")]
pub fn scroll(dx: f64, dy: f64) -> Result<(), InputError> {
    use core_graphics::event::{CGEvent, CGEventTapLocation, ScrollEventUnit};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| InputError::NativeEventCreateFailure("scroll"))?;
    let event = CGEvent::new_scroll_event(
        source,
        ScrollEventUnit::PIXEL,
        2,
        dy.round() as i32,
        dx.round() as i32,
        0,
    )
    .map_err(|_| InputError::NativeEventCreateFailure("scroll"))?;

    event.post(CGEventTapLocation::HID);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn scroll(_dx: f64, _dy: f64) -> Result<(), InputError> {
    Err(InputError::UnsupportedPlatform)
}
