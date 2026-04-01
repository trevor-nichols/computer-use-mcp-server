# Claude Code reference notes

This repository is a clean-room reimplementation, but the structure deliberately preserves the most useful *architectural* lessons from the Claude Code snapshot that was inspected locally during planning.

Key reference areas from the snapshot:

- `src/utils/computerUse/executor.ts`
  - showed the split between screenshot/app/TCC work and input work
  - confirmed screenshot sizing and coordinate coherence were treated as first-class concerns
  - showed clipboard round-trip verification before paste
  - showed small pointer settle delays before click and scroll
- `src/utils/computerUse/computerUseLock.ts`
  - reinforced a file-based desktop lock with stale PID recovery and re-entrant ownership
- `src/utils/computerUse/cleanup.ts`
  - reinforced cleanup as a turn-end responsibility, especially lock release and app unhide
- `src/utils/computerUse/hostAdapter.ts`
  - reinforced a thin host adapter around a richer executor surface
- `src/utils/computerUse/wrapper.tsx`
  - reinforced session-owned state for grants, display pinning, and screenshot dimensions

What was copied from that research:

- the *shape* of the seams
- the emphasis on coordinate correctness
- the desktop lock
- session-owned state
- clipboard-restore behavior
- keeping the MCP surface thin

What was **not** copied:

- package-internal code
- private package APIs
- any Anthropic-owned implementation details beyond high-level behavior and public architecture visible from the snapshot
