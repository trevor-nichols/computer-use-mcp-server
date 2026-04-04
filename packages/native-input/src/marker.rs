pub const SYNTHETIC_INPUT_MARKER: i64 = 0x4355_4D43_5045_5343;

#[cfg(target_os = "macos")]
pub fn mark_synthetic(event: &core_graphics::event::CGEvent) {
    use core_graphics::event::EventField;

    event.set_integer_value_field(EventField::EVENT_SOURCE_USER_DATA, SYNTHETIC_INPUT_MARKER);
}
