use crate::error::InputError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum InputModifierKey {
    Command,
    Shift,
    Option,
    Control,
    Fn,
}

impl InputModifierKey {
    pub fn from_token(token: &str) -> Option<Self> {
        match token {
            "command" => Some(Self::Command),
            "shift" => Some(Self::Shift),
            "option" => Some(Self::Option),
            "control" => Some(Self::Control),
            "fn" => Some(Self::Fn),
            _ => None,
        }
    }

    pub fn key_code(self) -> u16 {
        match self {
            Self::Command => 55,
            Self::Shift => 56,
            Self::Option => 58,
            Self::Control => 59,
            Self::Fn => 63,
        }
    }

    pub fn flag_bits(self) -> u64 {
        match self {
            Self::Command => 0x0010_0000,
            Self::Shift => 0x0002_0000,
            Self::Option => 0x0008_0000,
            Self::Control => 0x0004_0000,
            Self::Fn => 0x0080_0000,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolvedInputKey {
    KeyCode(u16),
    Modifier(InputModifierKey),
}

impl ResolvedInputKey {
    pub fn is_modifier(self) -> bool {
        matches!(self, Self::Modifier(_))
    }
}

pub fn normalize_token(raw: &str) -> Option<String> {
    let lowered = raw.trim().to_lowercase();
    if lowered.is_empty() {
        return None;
    }

    let canonical = match lowered.as_str() {
        "enter" => "return",
        "esc" => "escape",
        "backspace" => "delete",
        "page_up" => "pageup",
        "page_down" => "pagedown",
        "left_arrow" => "left",
        "right_arrow" => "right",
        "up_arrow" => "up",
        "down_arrow" => "down",
        "cmd" => "command",
        "alt" => "option",
        "ctrl" => "control",
        "function" => "fn",
        "meta" => "command",
        "super" => "command",
        "windows" => "command",
        "forwarddelete" => "forward_delete",
        "-" => "minus",
        "=" => "equal",
        "[" => "left_bracket",
        "]" => "right_bracket",
        "\\" => "backslash",
        ";" => "semicolon",
        "'" => "quote",
        "," => "comma",
        "." => "period",
        "/" => "slash",
        "`" => "grave",
        _ => lowered.as_str(),
    };

    Some(canonical.to_string())
}

pub fn resolve_key(raw: &str) -> Result<ResolvedInputKey, InputError> {
    let normalized = normalize_token(raw).ok_or_else(|| InputError::InvalidKeyToken(raw.to_string()))?;

    if let Some(modifier) = InputModifierKey::from_token(&normalized) {
        return Ok(ResolvedInputKey::Modifier(modifier));
    }

    let key_code = key_code_for(&normalized).ok_or_else(|| InputError::InvalidKeyToken(raw.to_string()))?;
    Ok(ResolvedInputKey::KeyCode(key_code))
}

pub fn resolve_chord(sequence: &str) -> Result<Vec<ResolvedInputKey>, InputError> {
    let parts: Vec<&str> = sequence.split('+').collect();
    if parts.is_empty() || parts.iter().all(|part| part.trim().is_empty()) {
        return Err(InputError::InvalidKeySequence(sequence.to_string()));
    }

    let mut resolved = Vec::with_capacity(parts.len());
    for part in parts {
        resolved.push(resolve_key(part)?);
    }

    if resolved.len() > 1 && resolved[..resolved.len() - 1].iter().any(|part| !part.is_modifier()) {
        return Err(InputError::InvalidKeySequence(sequence.to_string()));
    }

    Ok(resolved)
}

fn key_code_for(token: &str) -> Option<u16> {
    Some(match token {
        "a" => 0,
        "s" => 1,
        "d" => 2,
        "f" => 3,
        "h" => 4,
        "g" => 5,
        "z" => 6,
        "x" => 7,
        "c" => 8,
        "v" => 9,
        "b" => 11,
        "q" => 12,
        "w" => 13,
        "e" => 14,
        "r" => 15,
        "y" => 16,
        "t" => 17,
        "1" => 18,
        "2" => 19,
        "3" => 20,
        "4" => 21,
        "6" => 22,
        "5" => 23,
        "equal" => 24,
        "9" => 25,
        "7" => 26,
        "minus" => 27,
        "8" => 28,
        "0" => 29,
        "right_bracket" => 30,
        "o" => 31,
        "u" => 32,
        "left_bracket" => 33,
        "i" => 34,
        "p" => 35,
        "return" => 36,
        "l" => 37,
        "j" => 38,
        "quote" => 39,
        "k" => 40,
        "semicolon" => 41,
        "backslash" => 42,
        "comma" => 43,
        "slash" => 44,
        "n" => 45,
        "m" => 46,
        "period" => 47,
        "tab" => 48,
        "space" => 49,
        "grave" => 50,
        "delete" => 51,
        "escape" => 53,
        "forward_delete" => 117,
        "left" => 123,
        "right" => 124,
        "down" => 125,
        "up" => 126,
        "home" => 115,
        "end" => 119,
        "pageup" => 116,
        "pagedown" => 121,
        "f1" => 122,
        "f2" => 120,
        "f3" => 99,
        "f4" => 118,
        "f5" => 96,
        "f6" => 97,
        "f7" => 98,
        "f8" => 100,
        "f9" => 101,
        "f10" => 109,
        "f11" => 103,
        "f12" => 111,
        "f13" => 105,
        "f14" => 107,
        "f15" => 113,
        "f16" => 106,
        "f17" => 64,
        "f18" => 79,
        "f19" => 80,
        "f20" => 90,
        "numpad0" => 82,
        "numpad1" => 83,
        "numpad2" => 84,
        "numpad3" => 85,
        "numpad4" => 86,
        "numpad5" => 87,
        "numpad6" => 88,
        "numpad7" => 89,
        "numpad8" => 91,
        "numpad9" => 92,
        "numpad_add" => 69,
        "numpad_subtract" => 78,
        "numpad_multiply" => 67,
        "numpad_divide" => 75,
        "numpad_decimal" => 65,
        _ => return None,
    })
}
