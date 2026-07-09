# Issue Board (ledger)

Source of issue definitions: `german-tutor-implementation-plan.md`. This file tracks status only.
Statuses: open | in-progress | blocked | done. Every status change lands with the commit that causes it.

## State of the build

**2026-07-09, Claude (Fable 5), builder.** Phases 0, 1, and 2 complete: GT-001 to GT-008, GT-101
to GT-110, and GT-201 to GT-220 all done and merged to main. `npm run ci` green: lint, format,
typecheck, 4 guards, 240 unit and component tests across 42 files, 9 Playwright journeys (smoke,
onboarding to Day 1, adapter captions, placement escalation, settings persistence, FULL daily
session from Today to completion, skills library, mobile viewport, keyboard nav). All four skills
run in placeholder mode: echo/vocab cards, image ID with article traps, listening with captioned
placeholder audio and tiered evaluation, reading generation with a code-owned level envelope plus
Goethe Lesen tasks and tap-to-queue, writing tiles/dictation/composers/deep-tier correction,
speaking echo loop, 12 scenarios with inline corrections and summaries, session wrap-up reports,
and the app shell with a resumable five-step session runner. Brain-dependent flows degrade to
recoverable states until GEMINI_API_KEY arrives. Next: Phase 3 (GT-301 to GT-311, assessment
engine). Owner TODOs unchanged; GT-D1 enrichment batch still queued. No red, no uncommitted work.

## Owner TODOs (non-blocking for Phase 0, needed before later phases)

- [ ] Create the real Firebase project and drop its config values into `.env.local`
      (Phase 0 builds and tests against dummy values and converters only).
- [x] GEMINI_API_KEY supplied 2026-07-09 (lives in .env.local only; never committed).
- [x] Text model ids verified live 2026-07-09 (gemini-2.5-flash and gemini-2.5-pro both respond);
      Live and image identifiers still need verification at Phase 5 (GT-501/503).
- [x] GitHub remote added 2026-07-09: https://github.com/otobongo/deTutor (push after each issue).

## Discovered work (not yet in the plan)

- [x] **GT-D1: Vocabulary enrichment batch (in progress 2026-07-09).** npm run enrich:vocab
      fills ipa/exampleDe/exampleEn for the corpus (idempotent, resumes by skipping enriched
      words). Translation-pending entries (230) and article reviews (8) remain queued as GT-D1b.
- [ ] **GT-D1b: Pending translations and article review.** Enrich db/seed/translation-pending.json
      entries with translations and re-run ingestion; resolve db/seed/article-review.json.

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
| 2026-07-09 | GT-107 | DocumentStore seam: Firestore adapter plus a dev-file adapter (DATA_STORE env, default firestore) | No Firebase credentials and no Java for the emulator on this machine. Same converter-validated single write path either way; connecting the real project is a one-env-var flip. e2e runs hermetically on dev-file. |

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
| GT-106 | Placement check engine | done | gt-106-placement | All 15 probes objectively checkable so placement is deterministic (plan acceptance); B1 start requires passing B1 probes, a failed B1 stage falls back to A2 start (fixed by the plan's own test case). |
| GT-107 | Onboarding and placement UI flow | done | gt-107-onboarding | Voice (adapter samples with captions), dialect (skip defaults Hochdeutsch), placement ladder, result, Day 1 landing; e2e covers the full journey plus escalation. Settings page itself is GT-204. |
| GT-108 | Daily lesson engine | done | gt-108-lesson-engine | Pure five-step composer; weight-proportional deterministic grammar selection (no RNG); chunk-then-produce enforced at completeStep; session doc schema added (schema.md). Built before GT-107 so onboarding lands on a real Day 1 plan. |
| GT-109 | Gemini client wrapper and system prompt module | done | gt-109-gemini-client | Prompt embedded verbatim with a byte-equality sync test in CI; transport seam keeps SDK calls testable; owner must verify model ids and supply GEMINI_API_KEY before first real call. |
| GT-110 | Model tiering, fast default with high-thinking escalation | done | gt-110-model-tiering | callSite is a closed union; ESCALATION_MAP is the only path to deep (4 mapped sites); tier logged per call. |

## Phase 2: Four Skills in Placeholder Mode

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-201 | Vocabulary card component and echo flow | done | gt-201-vocab-card-echo | Echo is a strict state machine; production structurally mandatory; component tests run on jsdom (testing-library added to the harness). |
| GT-202 | Image identification, recognition phase | done | gt-202-image-id | Options include an article trap (same noun, wrong article) so article confusion is detectable and logged as gender; distractors deterministic, theme-first. |
| GT-203 | Image identification, production phase | done | gt-203-image-production | Partial credit (word right, article wrong) logs gender and maps to Hard; full maps to Good; rating updates FSRS. Grading engine landed with gt-202 module. |
| GT-204 | Settings, image style and preferences | done | gt-204-settings | Mixed rule = render for concrete-theme nouns, flat otherwise; style flips asset keys only (cached, deterministic). Placement re-run links to onboarding. |
| GT-205 | Listening exercise flow | done | gt-205-listening-flow | Captions honor the GT-007 contract; replay reuses the identical clipId; slower toggle at 0.75x; segments have individual controls. |
| GT-206 | Listening evaluation engine | done | gt-206-listening-eval | Closed-union verdict, schema-validated; B1 adds the deep-tier nuance pass; parse failures surface as categorized GeminiError (retryable state, not a crash). |
| GT-207 | Reading text generator | done | gt-207-reading-generator | Envelope validated in code: format by level, length caps, corpus+stretch budget (35%, inflection-tolerant, function forms always allowed since the Wortliste excludes them by design); one regeneration then typed failure. cumulativeCorpus helper added. |
| GT-208 | Reading task formats | done | gt-208-reading-tasks | All three Goethe Lesen formats; matching keys checked for double assignment and dangling refs; deterministic scoring writes SkillScore(reading) with appended attempts. Task UI composes in the GT-220 shell. |
| GT-209 | Tap-to-queue unknown words | done | gt-209-tap-to-queue | In-corpus taps enqueue the existing id; duplicates are no-ops; out-of-corpus taps get schema-honest mini-cards (nouns must carry articles). |
| GT-210 | Writing, word-tile sentence construction | done | gt-210-word-tiles | Accepted-order sets per item (V2 variants both valid); verb-third logged as order; deterministic tile shuffle never presents a valid order. |
| GT-211 | Writing, dictation | done | gt-211-dictation | LCS word-level diff; substitutions log as spelling; captions hidden until submission, shown after for silent placeholder assets. |
| GT-212 | Writing, emails and opinion texts | done | gt-212-composers | Both Goethe Schreiben formats; keyword-hinted checklist; missing points soft-warn once then allow submission; live word count. |
| GT-213 | Writing correction engine | done | gt-213-writing-correction | Four-part structure schema-fixed; deep tier; every error logged via GT-214; content points assessed for emails; GT-311 reads the log, not corrections. |
| GT-214 | Grammar mistake log and error analytics store | done | gt-214-grammar-log | Built first in Phase 2 (write path feeds most skill issues). DocumentStore gained list() for analytics queries. |
| GT-215 | Speaking echo loop (fallback mode) | open | | |
| GT-216 | Scenario engine and A1/A2 scenarios | done | gt-216-scenario-engine | Layer-3 context injection (never a prompt fork); English redirect deterministic by second English turn; structured turns carry inline corrections; six A1/A2 scenarios seeded. Includes a gt-215 test fix the adapter guard caught (direct provider import). |
| GT-217 | B1 scenarios | done | gt-217-b1-scenarios | Six B1 scenarios with register in personas (Behörde strict Sie-form, opinion invites Konjunktiv II); level gates selection; content seeded with gt-216, tests own this branch. |
| GT-218 | Inline corrections and post-session summary | done | gt-218-inline-corrections | Corrections record the learner's original utterance; summary table matches the fixed format; zero-error sessions congratulate without an empty table; all corrections logged via GT-214. |
| GT-219 | Session wrap-up and reporting hooks | done | gt-219-wrap-up | Report fields per PRD 4.7; recall = non-again ratings; interrupted sessions refuse to persist; loadSessionReports is the Phase 3 hook. |
| GT-220 | App shell, navigation, and Day view | done | gt-220-app-shell | Shell nav (Today/Practice/Progress/Settings, keyboard-tested); session runner walks all five steps with per-step persistence and resume; brain-dependent evaluation degrades to a recoverable self-check state without a key; e2e covers the full daily session, skills library, and mobile viewport. |

## Phase 3: Assessment Engine

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-301 | Unit test generator | done | gt-301-unit-test-generator | Section counts proportional to summed grammar weights; out-of-unit grammar ids rejected in code; regeneration must not repeat prior items (avoid list). |
| GT-302 | Per-skill scoring and pass gates | done | gt-302-scoring-gates | Pure scoring; 60 exactly passes; production rubric = 60 content + 40 language (8 per error); attempts append-only. |
| GT-303 | Remediation and single-skill retake | done | gt-303-remediation | Pure progress state machine; retakes locked behind remediation, passed skills untouchable; generated exercises must target failed grammar items (checked in code). |
| GT-304 | Spaced retest scheduler | done | gt-304-305-retention | 7/14/30/60 points; injector fills the GT-105 seam; retests ride the WarmupItem union unannounced; results write retention only. Shares a module and branch with GT-305 (one retention math surface). |
| GT-305 | Retention score and decay | done | gt-304-305-retention | Documented math: start 80, +10 pass, -15 fail, -10 lapse, clamp 0-100, threshold 60 (parameterized); decayed units feed the lesson engine's resurfacing seam. |
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
