# Eval fixtures

Layout: `<mode>/<captureId>/{photo-1.jpg,photo-2.jpg?,expected.json,draft.json}`

- `mode`: `bottle` | `samples` | `set`
- `photo-2.jpg` is optional.
- `expected.json` holds the expected extraction for the capture.

## Phase 0 spike session (2026-10-31)

- Every `expected.json` from this session is the **unverified model output**. Hand-correction was skipped.
- Captures where `is_perfume` / `is_discovery_set` is false are kept as negative fixtures. They include the floor false-fires and a bottle shot in Set mode.
- Bottle `f042893a` is a mistaken back-of-bottle capture of the Naxos bottle `09c61b9f`.
- Captures `09c61b9f` (bottle), `f042893a` (bottle, the mistaken back) and `3ffe789b` (set) were extracted with the round-1 prompt, from before the branding fix. Their `draft.json` reflects that prompt. Only 09c61b9f's `expected.json` was hand-corrected (house).
