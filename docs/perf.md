# Performance Budgets (GT-403)

**Reference machine:** the build machine (Apple Silicon, local `next dev`), 2026-07-09.
Enforced ceilings run in CI (tests/e2e/perf.spec.ts) with headroom over local measurements so
regressions fail without runner-noise flakes.

## Budgets and measurements

| Metric | Budget (local) | Measured (reference) | CI ceiling | Status |
|--------|----------------|----------------------|------------|--------|
| Lesson step transition (warm-up to vocabulary) | under 200ms | 29ms | 500ms | Met |
| Card advance layout shift (CLS) | under 0.1 | ~0 | 0.1 | Met |
| Today first render | under 1s | 79ms | 1.5s | Met |
| Practice first render | under 1s | 329ms | 1.5s | Met |
| Progress first render (store reads) | under 1s | 236ms | 1.5s | Met |

Step transitions are client-state changes with persistence fired after the UI update, which is
why they sit far under budget; the session document write does not block the render.

## Gemini round-trips and streaming

The plan's streaming test case ("first token renders before completion") does not apply as
written: every runtime brain call is JSON-mode with schema validation (strategy Section 8,
"Schema or it did not happen"), and validated-JSON responses cannot render token by token.
Perceived latency is handled with explicit pending states ("Evaluating...", "Correcting...") and
categorized recoverable errors instead. Recorded as a deviation in board.md. If free-prose tutor
turns are ever added (candidates: scenario replies rendered before correction parsing), they
should use `generateContentStream` and this section gets a first-token budget.

Round-trip expectations (network-bound, not enforced in CI): fast-tier JSON evaluations run 1 to
3 seconds; deep-tier corrections and generation 3 to 10 seconds. The UI never blocks navigation
on a brain call.
