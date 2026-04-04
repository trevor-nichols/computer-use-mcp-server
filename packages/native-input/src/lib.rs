pub mod error;
pub mod keymap;
pub mod marker;
pub mod modifiers;

mod cursor;
mod keyboard;
mod mouse;
mod scroll;

use napi::bindgen_prelude::Result;
use napi_derive::napi;

pub use cursor::CursorPosition;

#[napi(js_name = "getCursorPosition")]
pub fn get_cursor_position() -> Result<CursorPosition> {
    cursor::get_cursor_position().map_err(Into::into)
}

#[napi(js_name = "moveMouse")]
pub fn move_mouse(x: f64, y: f64) -> Result<()> {
    cursor::move_mouse(x, y).map_err(Into::into)
}

#[napi(js_name = "mouseDown")]
pub fn mouse_down(button: String) -> Result<()> {
    mouse::mouse_down(&button).map_err(Into::into)
}

#[napi(js_name = "mouseUp")]
pub fn mouse_up(button: String) -> Result<()> {
    mouse::mouse_up(&button).map_err(Into::into)
}

#[napi(js_name = "click")]
pub fn click(button: String, count: i32) -> Result<()> {
    mouse::click(&button, count).map_err(Into::into)
}

#[napi(js_name = "scroll")]
pub fn scroll(dx: f64, dy: f64) -> Result<()> {
    scroll::scroll(dx, dy).map_err(Into::into)
}

#[napi(js_name = "keySequence")]
pub fn key_sequence(sequence: String) -> Result<()> {
    keyboard::key_sequence(&sequence).map_err(Into::into)
}

#[napi(js_name = "keyDown")]
pub fn key_down(key: String) -> Result<()> {
    keyboard::key_down(&key).map_err(Into::into)
}

#[napi(js_name = "keyUp")]
pub fn key_up(key: String) -> Result<()> {
    keyboard::key_up(&key).map_err(Into::into)
}

#[napi(js_name = "typeText")]
pub fn type_text(text: String) -> Result<()> {
    keyboard::type_text(&text).map_err(Into::into)
}
