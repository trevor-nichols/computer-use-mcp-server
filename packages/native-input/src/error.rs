use std::fmt;

use napi::{Error, Status};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InputError {
    UnsupportedPlatform,
    InvalidMouseButton(String),
    InvalidClickCount(i32),
    InvalidKeyToken(String),
    InvalidKeySequence(String),
    NativeEventCreateFailure(&'static str),
    NativeEventPostFailure(&'static str),
    CursorQueryFailure,
}

impl fmt::Display for InputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedPlatform => write!(f, "The Rust input backend currently supports macOS only."),
            Self::InvalidMouseButton(button) => write!(f, "Unsupported mouse button: {button}. Expected left, right, or middle."),
            Self::InvalidClickCount(count) => write!(f, "Unsupported click count: {count}. Expected 1, 2, or 3."),
            Self::InvalidKeyToken(token) => write!(f, "Unsupported key token: {token}."),
            Self::InvalidKeySequence(sequence) => write!(f, "Invalid key sequence: {sequence}. Only leading modifier tokens are allowed before the final key."),
            Self::NativeEventCreateFailure(kind) => write!(f, "Failed to create the native {kind} event."),
            Self::NativeEventPostFailure(kind) => write!(f, "Failed to post the native {kind} event."),
            Self::CursorQueryFailure => write!(f, "Failed to read the current cursor position."),
        }
    }
}

impl std::error::Error for InputError {}

impl From<InputError> for Error {
    fn from(value: InputError) -> Self {
        let status = match value {
            InputError::InvalidMouseButton(_)
            | InputError::InvalidClickCount(_)
            | InputError::InvalidKeyToken(_)
            | InputError::InvalidKeySequence(_) => Status::InvalidArg,
            InputError::UnsupportedPlatform => Status::InvalidArg,
            InputError::NativeEventCreateFailure(_)
            | InputError::NativeEventPostFailure(_)
            | InputError::CursorQueryFailure => Status::GenericFailure,
        };

        Error::new(status, value.to_string())
    }
}
