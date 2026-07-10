# Issue Board (ledger)

Source of issue definitions: `german-tutor-implementation-plan.md`. This file tracks status only.
Statuses: open | in-progress | blocked | done. Every status change lands with the commit that causes it.

## State of the build

**2026-07-10, Claude (Fable 5), builder.** A1 skill surfaces are live in the daily flow
(owner directive 2026-07-10: build effectiveness first, A1 content only). The session runner
now runs real exercises in every slot: interactive card-by-card warm-up with the four FSRS
ratings persisting through learners/default/cards (new words are introduced on vocab-step
completion and come due the same day), image identification inside the vocabulary step for
picturable day words, word tiles plus dictation in the writing slot, reading with brain-generated
text falling back to curated A1 exercises (db/seed/reading-fallback.ts) with tap-to-queue and
richtig/falsch scoring into SkillScore(reading), and scenario chat with inline corrections,
summary table, and 0-10 score into the session report. /practice/speaking hosts the on-demand
echo loop (exact matches confirm without the brain). All brain outages render as recoverable
states. New server actions: cards, grammar, reading, scenario, speaking. `npm run ci` green:
327 unit/component tests, 19 Playwright checks including a four-session rotation journey
through all skill slots and axe WCAG A/AA on six flows. Content generation everywhere keys off
the profile level: an A1 learner only ever sees A1 scenarios, A1 reading, A1 corpus words.
Next: B1 exam item generation, Phase 6 auth (blocked on owner Firebase credentials), deployment.

**2026-07-09, Claude (Fable 5), builder.** Phases 0 to 4 complete (GT-001 to GT-404 plus GT-D1),
all merged and pushed to github.com/otobongo/deTutor. `npm run ci` green: lint, format,
typecheck, 4 guards, 300+ unit/component tests, 17 Playwright checks including the five GT-401
journeys (onboarding, daily session with rotation, unit test with remediated retake, retention
decay to remediation, B1 exam smoke), performance ceilings, and axe WCAG A/AA on five flows.
Integrity audit in docs/audit-phase4.md (two read-validation findings remediated); performance
budgets in docs/perf.md (step transition 29ms vs 200ms budget); streaming deviation documented.
The corpus is fully enriched (2,547 words with IPA and examples); model defaults refreshed to
gemini-3.5-flash / gemini-pro-latest after the 2.5-flash sunset. Next: Phase 5 media generation
(GT-501 to GT-504; needs no further owner input for images/audio scripts, Gemini Live at GT-503)
and the owner's Firebase credentials for the DATA_STORE flip. GT-D1b (230 pending translations,
8 article reviews) remains queued. No red, no uncommitted work.

## Owner TODOs (non-blocking for Phase 0, needed before later phases)

- [ ] **Enable pay-as-you-go billing for the Gemini API key** (AI Studio -> plan/billing), then
      run `npm run generate:audio` (defaults to A1 only; quota-aware and resumable). Audio stands
      at 55 of 656 A1 clips. **By owner decision (2026-07-09), A2 and B1 audio are deferred**
      until the learner approaches those levels; generate them then with `-- --level A2|B1`.

- [ ] Create the real Firebase project and drop its config values into `.env.local`
      (Phase 0 builds and tests against dummy values and converters only).
- [x] GEMINI_API_KEY supplied 2026-07-09 (lives in .env.local only; never committed).
- [x] Text model ids verified live 2026-07-09 (gemini-2.5-flash and gemini-2.5-pro both respond);
      Live and image identifiers still need verification at Phase 5 (GT-501/503).
- [x] GitHub remote added 2026-07-09: https://github.com/otobongo/deTutor (push after each issue).

## Discovered work (not yet in the plan)

- [x] **A1 skill surfaces in the daily flow (done 2026-07-10, owner-directed).** Interactive
      warm-up reviews (FSRS ratings persisted per card; introduction on vocab completion),
      image-ID in the vocab step, tiles+dictation writing slot, reading slot with curated A1
      fallback and tap-to-queue, scenario chat with corrections/summary/score, /practice/speaking
      echo loop. Known limits, by design: disguised retest items do not yet render in the warm-up
      UI (they only exist once units pass; the engine seam is unchanged), scenario corrections
      count into the grammar log but not the client-side errorsByCategory tally, and cards minted
      from brain mini-cards (out-of-corpus taps) are skipped in warm-up display until their words
      join the corpus.

- [x] **Design system applied (2026-07-10, owner-supplied).** docs/design-system.md (LiD Prep
      tokens) is now the authoritative styling spec: full token layer with Cal x Readwise
      (default) and High Contrast themes, light/dark scales in CSS, Tailwind v4 bridge,
      pre-hydration mode script (first visit follows prefers-color-scheme), header theme/mode
      controls, fonts via next/font (Google Sans Flex not self-hosted; spec fallbacks apply),
      highlight mark treatments ready for reading content. All components swept from hardcoded
      palette to tokens. Decisions: CSS-selector theming instead of per-token JS writes (same
      contract, less machinery); article colors kept as mode-aware pedagogy tokens
      (--article-der/die/das) with dark-mode shades clearing 4.5:1. axe WCAG AA green on the new
      tokens across all five audited flows.

- [x] **Corpus translation audit (done 2026-07-10, owner-triggered).** The image audit's blind
      spot (it validated images against stored translations, not against the German words) let
      vocabforge's rare-sense glosses through: Hund was "mine car", Zug was "strain", sehr was
      "damned". Full audit of all 2,547 words via npm run audit:translations: 1,400 corrected
      (55%), enrichment (IPA/examples) regenerated for every corrected word, affected images
      purged and regenerated, image audit re-run judging against the German word first. Final:
      240 images, zero flags; /words is the manual review surface (flagged-first, level filters).
      Karte fixed to "card, map" per owner. Repeat-offender picturables (Eltern, Wand,
      Visitenkarte, Luft, Szene, Tablette-as-computer etc.) made non-picturable with overrides.

- [x] **Image catalog and vision audit (done 2026-07-09).** /catalog previews every generated
      image with word, translation, and audit verdict; npm run audit:images sends each image back
      through Gemini vision against its expected word. Outcome: 266 generated, 17 flagged, root
      causes fixed (7 bad source translations corrected, 8 abstract/confusable words made
      non-picturable with overrides persisted), flagged images regenerated; final catalog is 250
      images, 100% audit-verified.

- [x] **GT-D1: Vocabulary enrichment batch (done 2026-07-09).** All 2,547 corpus words carry
      IPA and example sentences (npm run enrich:vocab, idempotent, resumable).
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
| 2026-07-09 | GT-D1 | Default models moved to gemini-3.5-flash (fast) and gemini-pro-latest (deep) | gemini-2.5-flash began returning intermittent sunset 404s mid-batch during enrichment; successors verified live against the models API. Env overrides unchanged. |
| 2026-07-09 | GT-403 | No token streaming for brain responses | Every runtime call is JSON-mode with schema validation (strategy Section 8); validated JSON cannot stream token by token. Pending states cover perceived latency; revisit if free-prose turns are added. Details in docs/perf.md. |
| 2026-07-09 | GT-501 | IMAGE_MODEL default is gemini-3.1-flash-image | The PRD's "Nano Banana 2" name has no live identifier; the flash image model is the current GA equivalent (the pro/4K tier is out of scope per PRD Section 8). Verified with a live sample batch. |

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
| GT-306 | Level gate exams | done | gt-306-level-gates | Dual condition (all modules 60+, average retention 70+); failure report names blocking modules weakest first; only passed gates advance the profile. |
| GT-307 | B1 exit simulation | done | gt-307-b1-exam | Official blueprint in code (Lesen 5/30/65min, Hören 4/30/40min, Schreiben 3 tasks/60min, Sprechen 3/15min); assembly validated against it; pure module timer; normalization to 100 per module. |
| GT-308 | Session report view | done | gt-308-session-report-view | Progress tab renders stored numbers verbatim; drill-down lists the day's grammar-log entries; honest empty state; e2e asserts the completed session appears. |
| GT-309 | Weekly summary generator | done | gt-309-weekly-summary | Patterns pinned to the GT-214 detector (invented ones rejected); deep tier writes only fixes and focus; growth framed against the learner's prior week; pattern-free weeks skip the model call. |
| GT-310 | Level dashboard and hard-area trends | done | gt-310-level-dashboard | Pure aggregates: skill trajectories from attempt history, retention heat with severity bands, hard-area weekly error counts (falling = improving); rendered from stored data only, empty state graceful. |
| GT-311 | Difficulty-weighting engine | done | gt-311-weighting | Area weights: floors from PRD Section 6, +1 per recurring area capped at 5, quiet areas decay to floor; effective weights plug into the lesson engine's selection seam. |

## Phase 4: Hardening

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-401 | End-to-end placeholder pass | done | gt-401-e2e-pass | All five journeys green and self-contained (store reset per journey). Flow gaps closed en route: unit-test UI with deterministic placeholder tests, retention remediation surfaced on Today, skill rotation wired across sessions, B1 exam page. |
| GT-402 | Adapter contract and integrity audit | done | gt-402-integrity-audit | All four sweeps documented in docs/audit-phase4.md; two read-validation findings remediated in-issue; guards enforce sweeps 1/2/5 on every CI run. |
| GT-403 | Performance pass | done | gt-403-perf | Budgets documented and met (step transition 29ms vs 200ms budget, CLS ~0); CI ceilings enforced in perf.spec.ts. Streaming test case recorded as a deviation (JSON-mode calls cannot token-stream). |
| GT-404 | Accessibility pass | done | gt-404-a11y | axe (WCAG A/AA) clean on onboarding, Today, session, Progress, Settings; keyboard-only step completion; article identity proven as literal text in a real flow. |

## Phase 5: Media Generation (final)

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-501 | Image generation script | done | gt-501-image-generation | Sample batch verified live (gemini-3.1-flash-image; PRD's 'Nano Banana 2' pinned to it, deviation noted); manifest ledger + MediaAssetRef writes; idempotent/resumable; full A1 batch is one command, cost flagged to owner. |
| GT-502 | Audio generation script | done | gt-502-audio-generation | Live-verified sample (all 6 A1 unit clips + pronunciations, de-DE TTS to WAV); caption text retained in seeds; same ledger/idempotency contract as GT-501. |
| GT-503 | Gemini Live voice integration | open | | |
| GT-504 | Provider flip and regression | open | | |

## Phase 6 (v2.1): Auth

| Issue | Title | Status | Branch | Notes |
|-------|-------|--------|--------|-------|
| GT-601 | Firebase Authentication | open | | |
| GT-602 | Firestore rules lockdown | open | | |
| GT-603 | Cross-device sync verification | open | | |
