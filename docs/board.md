# Issue Board (ledger)

Source of issue definitions: `german-tutor-implementation-plan.md`. This file tracks status only.
Statuses: open | in-progress | blocked | done. Every status change lands with the commit that causes it.

## State of the build

**2026-07-09, Claude (Fable 5), builder.** Phase 0 in progress. Repo scaffolded on Next.js 16.2.10
(App Router, TypeScript strict). See Deviations for the Next.js version note.

## Owner TODOs (non-blocking for Phase 0, needed before later phases)

- [ ] Create the real Firebase project and drop its config values into `.env.local`
      (Phase 0 builds and tests against dummy values and converters only).
- [ ] Supply `GEMINI_API_KEY` when Phase 1 (GT-109) wires the Gemini client.
- [ ] Verify current Gemini fast/deep/Live and Nano Banana 2 model identifiers at GT-109/GT-501;
      config defaults are best-known values from build time and are env-overridable.
- [ ] Add a GitHub remote when ready; the Actions workflow is committed and will run as-is.

## Deviations log

| Date | Issue | Deviation | Why |
|------|-------|-----------|-----|
| 2026-07-09 | GT-001 | Next.js 16.2.10 instead of the v15-era assumption in the PRD | create-next-app@latest at build time; App Router and strict TS unchanged. Next 16 conventions apply (see AGENTS.md note). |
| 2026-07-09 | GT-001 | Repo root is the working directory `german/`, not a nested `german-platform/` | docs/ already lived here; layout inside the root matches PRD 11.1. |

## Phase 0: Foundation

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-001 | Repository scaffold and CLAUDE.md | done | gt-001-repo-scaffold | CLAUDE.md adapter-law content test lands with the GT-008 harness. |
| GT-002 | Firebase wiring and environment configuration | open | | |
| GT-003 | Firestore schema, curriculum entities | open | | |
| GT-004 | Firestore schema, learner state | open | | |
| GT-005 | MediaProvider interface and provider switch | open | | |
| GT-006 | PlaceholderProvider, images | open | | |
| GT-007 | PlaceholderProvider, audio and voice fallback | open | | |
| GT-008 | Test harness and CI | done | gt-008-test-harness | Built directly after GT-001 so later issues have a test home (plan permits: depends only on GT-001). Adapter guard joins the gate at GT-005. |

## Phase 1: Curriculum and Content Core

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-101 | Unit structure seed (18 units) | open | | |
| GT-102 | Vocabulary ingestion pipeline | open | | |
| GT-103 | A1 vocabulary seed and staged A2/B1 sets | open | | |
| GT-104 | FSRS integration and card state persistence | open | | |
| GT-105 | Review queue engine | open | | |
| GT-106 | Placement check engine | open | | |
| GT-107 | Onboarding and placement UI flow | open | | |
| GT-108 | Daily lesson engine | open | | |
| GT-109 | Gemini client wrapper and system prompt module | open | | |
| GT-110 | Model tiering, fast default with high-thinking escalation | open | | |

## Phase 2: Four Skills in Placeholder Mode

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-201 | Vocabulary card component and echo flow | open | | |
| GT-202 | Image identification, recognition phase | open | | |
| GT-203 | Image identification, production phase | open | | |
| GT-204 | Settings, image style and preferences | open | | |
| GT-205 | Listening exercise flow | open | | |
| GT-206 | Listening evaluation engine | open | | |
| GT-207 | Reading text generator | open | | |
| GT-208 | Reading task formats | open | | |
| GT-209 | Tap-to-queue unknown words | open | | |
| GT-210 | Writing, word-tile sentence construction | open | | |
| GT-211 | Writing, dictation | open | | |
| GT-212 | Writing, emails and opinion texts | open | | |
| GT-213 | Writing correction engine | open | | |
| GT-214 | Grammar mistake log and error analytics store | open | | |
| GT-215 | Speaking echo loop (fallback mode) | open | | |
| GT-216 | Scenario engine and A1/A2 scenarios | open | | |
| GT-217 | B1 scenarios | open | | |
| GT-218 | Inline corrections and post-session summary | open | | |
| GT-219 | Session wrap-up and reporting hooks | open | | |
| GT-220 | App shell, navigation, and Day view | open | | |

## Phase 3: Assessment Engine

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-301 | Unit test generator | open | | |
| GT-302 | Per-skill scoring and pass gates | open | | |
| GT-303 | Remediation and single-skill retake | open | | |
| GT-304 | Spaced retest scheduler | open | | |
| GT-305 | Retention score and decay | open | | |
| GT-306 | Level gate exams | open | | |
| GT-307 | B1 exit simulation | open | | |
| GT-308 | Session report view | open | | |
| GT-309 | Weekly summary generator | open | | |
| GT-310 | Level dashboard and hard-area trends | open | | |
| GT-311 | Difficulty-weighting engine | open | | |

## Phase 4: Hardening

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-401 | End-to-end placeholder pass | open | | |
| GT-402 | Adapter contract and integrity audit | open | | |
| GT-403 | Performance pass | open | | |
| GT-404 | Accessibility pass | open | | |

## Phase 5: Media Generation (final)

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-501 | Image generation script | open | | |
| GT-502 | Audio generation script | open | | |
| GT-503 | Gemini Live voice integration | open | | |
| GT-504 | Provider flip and regression | open | | |

## Phase 6 (v2.1): Auth

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-601 | Firebase Authentication | open | | |
| GT-602 | Firestore rules lockdown | open | | |
| GT-603 | Cross-device sync verification | open | | |
