use std::collections::BTreeMap;
use std::sync::{LazyLock, Mutex};

use crate::keymap::InputModifierKey;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ModifierState {
    counts: BTreeMap<InputModifierKey, usize>,
}

impl ModifierState {
    pub fn active_flag_bits(&self) -> u64 {
        self.counts
            .iter()
            .filter(|(_, count)| **count > 0)
            .fold(0_u64, |bits, (modifier, _)| bits | modifier.flag_bits())
    }

    pub fn next_event_flag_bits(&self, modifier: InputModifierKey, down: bool) -> u64 {
        let mut flags = self.active_flag_bits();
        let current_count = self.count(modifier);
        let next_count = if down {
            current_count + 1
        } else {
            current_count.saturating_sub(1)
        };

        if down || next_count > 0 {
            flags |= modifier.flag_bits();
        } else {
            flags &= !modifier.flag_bits();
        }

        flags
    }

    pub fn apply_transition(&mut self, modifier: InputModifierKey, down: bool) {
        let current = self.count(modifier);
        let next = if down { current + 1 } else { current.saturating_sub(1) };
        if next == 0 {
            self.counts.remove(&modifier);
        } else {
            self.counts.insert(modifier, next);
        }
    }

    pub fn count(&self, modifier: InputModifierKey) -> usize {
        self.counts.get(&modifier).copied().unwrap_or(0)
    }

    #[cfg(test)]
    pub fn reset(&mut self) {
        self.counts.clear();
    }
}

static ACTIVE_MODIFIERS: LazyLock<Mutex<ModifierState>> =
    LazyLock::new(|| Mutex::new(ModifierState::default()));

pub fn with_modifier_state<R>(f: impl FnOnce(&mut ModifierState) -> R) -> R {
    let mut guard = ACTIVE_MODIFIERS.lock().expect("modifier state mutex poisoned");
    f(&mut guard)
}

#[cfg(test)]
pub fn reset_global_modifier_state() {
    with_modifier_state(|state| state.reset());
}
