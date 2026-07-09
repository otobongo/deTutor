# Issue Board (ledger)

Source of issue definitions: `german-tutor-implementation-plan.md`. This file tracks status only.
Statuses: open | in-progress | blocked | done. Every status change lands with the commit that causes it.

## State of the build

**2026-07-09, Claude (Fable 5), builder.** Phase 0 complete: GT-001 through GT-008 all done and
merged to main, `npm run ci` green (lint, format, typecheck, guards, 57 unit tests, smoke e2e).
The four CI guards (model-strings, process-env, client-server-config, media-adapter) are live and
tested with planted violations. Placeholder images, audio, and the fallback voice session are
implemented and unit-tested; the MediaProvider seam is closed. Next: Phase 1 starting with GT-101
(unit seed), GT-102 (vocab ingestion), and GT-109 (Gemini client), pending owner TODOs above for
real Firebase config and the Gemini key. No red, no uncommitted work.

## Owner TODOs (non-blocking for Phase 0, needed before later phases)

- [ ] Create the real Firebase project and drop its config values into `.env.local`
      (Phase 0 builds and tests against dummy values and converters only).
- [ ] Supply `GEMINI_API_KEY` when Phase 1 (GT-109) wires the Gemini client.
- [ ] Verify current Gemini fast/deep/Live and Nano Banana 2 model identifiers at GT-109/GT-501;
      config defaults are best-known values from build time and are env-overridable.
- [ ] Add a GitHub remote when ready; the Actions workflow is committed and will run as-is.

## Discovered work (not yet in the plan)

- [ ] **GT-D1: Vocabulary enrichment batch.** Gemini script to fill ipa, exampleDe,
      exampleEn for all corpus words and translations for db/seed/translation-pending.json
      (235 entries), plus review of db/seed/article-review.json (9 entries). Needs
      GEMINI_API_KEY. Blocks nothing in Phase 1; cards render without IPA/examples until then.

## Deviations log

| Date | Issue | Deviation | Why |
|------|-------|-----------|-----|
| 2026-07-09 | GT-001 | Next.js 16.2.10 instead of the v15-era assumption in the PRD | create-next-app@latest at build time; App Router and strict TS unchanged. Next 16 conventions apply (see AGENTS.md note). |
| 2026-07-09 | GT-001 | Repo root is the working directory `german/`, not a nested `german-platform/` | docs/ already lived here; layout inside the root matches PRD 11.1. |
| 2026-07-09 | GT-101 | Added `capstonePremise` to the Unit schema (GT-003 file) | The plan requires a capstone premise per unit; the GT-003 field list predated it. schema.md updated. |
| 2026-07-09 | GT-101 | Replaced `server-only` import in lib/firebase.ts with a runtime browser check | tsx-run seed scripts import lib/firebase; the server-only package throws outside React server components. Same protection, seed scripts work. |
| 2026-07-09 | GT-102 | Corpus strategy: Goethe B1 Wortliste is the corpus and level source (frequency banding 650/650/rest), vocabforge supplies translations only | vocabforge CEFR tags are unusable for breadth (91 A1 rows of 32,000; 26,020 tagged C2). The Wortliste IS the official B1 scope the PRD names as the ceiling. |
| 2026-07-09 | GT-102 | VocabularyWord ipa/exampleDe/exampleEn made nullable | No dataset supplies them; fabricating IPA would poison pronunciation teaching. Filled by the GT-D1 enrichment batch; null until then. |
| 2026-07-09 | GT-102 | Theme tagging is a keyword heuristic plus override file, not Deutschland-Vocabulary mapping | That repo is scanned-PDF flashcards (Bangla), machine-unusable. Overrides live in db/seed/theme-overrides.json. |

## Phase 0: Foundation

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-001 | Repository scaffold and CLAUDE.md | done | gt-001-repo-scaffold | CLAUDE.md adapter-law content test lands with the GT-008 harness. |
| GT-002 | Firebase wiring and environment configuration | done | gt-002-firebase-config | Built against dummy env values; real Firebase project is an owner TODO. Model-string and process-env guards wired into CI. |
| GT-003 | Firestore schema, curriculum entities | done | gt-003-curriculum-schema | zod-backed converters in lib/db/; wordType field added so the noun-needs-article rule is checkable. |
| GT-004 | Firestore schema, learner state | done | gt-004-learner-schema | FSRS state field named `phase` to keep the domain word "state" unambiguous; noted in schema.md. |
| GT-005 | MediaProvider interface and provider switch | done | gt-005-media-provider | Interface verbatim per PRD 7.4; GeminiProvider is a loud-failure seam until Phase 5; adapter guard extended to Gemini SDK imports. |
| GT-006 | PlaceholderProvider, images | done | gt-006-placeholder-images | Article colors defined once in lib/design/tokens.ts; nouns arrive as the full "der Tisch" package; ref persistence is a typed builder written via converters by callers. |
| GT-007 | PlaceholderProvider, audio and voice fallback | done | gt-007-placeholder-audio-voice | Clip registry resolves clipId to German text; unknown clips degrade silent+captioned, never throw. VoiceSessionEvent contract lives in provider.ts; GT-503's contract test must run against both implementations. Caption UI component lands with GT-205; the contract (captionsRequired) is typed now. |
| GT-008 | Test harness and CI | done | gt-008-test-harness | Built directly after GT-001 so later issues have a test home (plan permits: depends only on GT-001). Adapter guard joins the gate at GT-005. |

## Phase 1: Curriculum and Content Core

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-101 | Unit structure seed (18 units) | done | gt-101-unit-seed | 18 units + 34 grammar items seeded idempotently; `npm run seed:curriculum` writes them once env points at a live/emulated Firestore. |
| GT-102 | Vocabulary ingestion pipeline | done | gt-102-vocab-ingestion | Corpus: 2,548 verified words (A1 650 / A2 650 / B1 1,248) in db/seed/vocab/; 9 article reviews, 235 translations pending enrichment. Datasets download via scripts/download-datasets.sh (gitignored). |
| GT-103 | A1 vocabulary seed and staged A2/B1 sets | done | gt-103-vocab-seed | 650 A1 words seed by default; A2/B1 staged behind --level; day-set selector (theme within frequency) in lib/lesson/vocab-selection.ts. Includes GT-102 dedupe fix for prefix variants. |
| GT-104 | FSRS integration and card state persistence | done | gt-104-fsrs | ts-fsrs wrapped pure with fuzz disabled (deterministic); FsrsCardState gained learningSteps (schema.md updated); unknown-card ratings fail loudly. |
| GT-105 | Review queue engine | done | gt-105-review-queue | injectExtras seam documented for GT-304; retest items ride the queue but never touch FSRS state. |
| GT-106 | Placement check engine | open | | |
| GT-107 | Onboarding and placement UI flow | open | | |
| GT-108 | Daily lesson engine | open | | |
| GT-109 | Gemini client wrapper and system prompt module | done | gt-109-gemini-client | Prompt embedded verbatim with a byte-equality sync test in CI; transport seam keeps SDK calls testable; owner must verify model ids and supply GEMINI_API_KEY before first real call. |
| GT-110 | Model tiering, fast default with high-thinking escalation | done | gt-110-model-tiering | callSite is a closed union; ESCALATION_MAP is the only path to deep (4 mapped sites); tier logged per call. |

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
