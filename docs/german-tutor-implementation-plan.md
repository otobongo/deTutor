# German Learning Platform, Implementation Plan
# Agent-agnostic issue breakdown for PRD v2

**Version:** 1.0  
**Companion to:** `german-tutor-prd-claude-code-v2.md` and `german-tutor-engineering-strategy.md`  
**Purpose:** Any capable agent can pick up any open issue cold and build it correctly. Every issue is self-contained: context, dependencies, tasks, expected outcome, acceptance criteria, and test cases. Read the engineering strategy document before writing any code.

**Issue ID scheme:** GT-{phase}{number}. Dependencies reference issue IDs. An issue is buildable when all its dependencies are Done.

**Model tiers (dispatch guidance):**
- **T1 (Fable-class / top tier):** architecture, schemas, contracts, scoring math
- **T2 (Opus-class):** complex features, engines with AI-evaluation logic
- **T3 (Sonnet-class):** standard features, UI flows, CRUD, components

**Definition of Done (applies to every issue):** all acceptance criteria met, all listed test cases implemented and passing, lint and typecheck green, no direct media API calls outside the MediaProvider adapter, no hardcoded model strings, conventions from the engineering strategy followed.

---

## Phase 0: Foundation

### GT-001: Repository scaffold and CLAUDE.md
**Tier:** T1 | **Depends:** none
**Context:** Everything starts here. The repo layout is defined in PRD Section 11.1.
**Tasks:**
1. Initialize Next.js (App Router, TypeScript strict) per the repo layout in the PRD
2. Add lint (ESLint) and formatting (Prettier) configs; add typecheck and lint npm scripts
3. Write CLAUDE.md: project summary, stack, source-of-truth pointers (PRD v2, system prompt v2, strategy doc, this plan), conventions summary, the adapter law, and the handoff protocol pointer
4. Copy the four docs into docs/
**Expected outcome:** A cloneable repo where a fresh agent can orient in one read.
**Acceptance criteria:** `npm run lint`, `npm run typecheck`, `npm run dev` all succeed on a clean clone; CLAUDE.md references all four documents.
**Test cases:** (1) clean clone installs and builds; (2) lint catches a deliberately misformatted file; (3) CLAUDE.md contains the adapter law verbatim.

### GT-002: Firebase project wiring and environment configuration
**Tier:** T1 | **Depends:** GT-001
**Context:** Firestore is the only datastore. Keys live in env vars only (PRD 7.2).
**Tasks:**
1. Add Firebase SDK; create `lib/firebase.ts` with server-side initialization
2. Define `.env.example` with every required variable (Firebase config, GEMINI_API_KEY, MEDIA_PROVIDER flag), no real values
3. Add a config module `lib/config.ts` that validates env at startup and exposes typed config, including model string entries (no model strings anywhere else)
**Expected outcome:** One typed config surface; the app fails fast with a clear error when env is incomplete.
**Acceptance criteria:** No Firebase or Gemini credential appears outside env; `lib/config.ts` is the only reader of process.env; startup with missing vars produces a named error listing what is missing.
**Test cases:** (1) config module throws on missing GEMINI_API_KEY naming the var; (2) model strings resolve from config only (grep test in CI); (3) client bundle contains no server env values.

### GT-003: Firestore schema, curriculum entities
**Tier:** T1 | **Depends:** GT-002
**Context:** PRD 3.1 defines 18 units across A1/A2/B1. Curriculum data is read-heavy and seed-written.
**Tasks:**
1. Define TypeScript types and Firestore converters for: Level, Unit (theme, grammarItems, vocabSetRef, capstoneDialogueRef), VocabularyWord (german, article, translation, ipa, exampleDe, exampleEn, cefrLevel, theme, picturable, frequencyRank), GrammarItem (id, name, level, weight), Scenario, MediaAssetRef (kind, key, styleOrClipId, status)
2. Document collection paths and index needs in `docs/schema.md`
3. Write converter round-trip helpers
**Expected outcome:** A typed schema layer; no untyped Firestore reads anywhere in the codebase.
**Acceptance criteria:** All curriculum reads/writes go through converters; schema.md lists every collection with field tables.
**Test cases:** (1) converter round-trip preserves every field for each entity; (2) a VocabularyWord without an article fails validation when the word is a noun; (3) MediaAssetRef key format matches `{word}:{style}` or `{clipId}` exactly.

### GT-004: Firestore schema, learner state
**Tier:** T1 | **Depends:** GT-003
**Context:** Single-user in v1 (open access), but shaped so v2.1 auth is a namespace change, not a migration.
**Tasks:**
1. Define types and converters for: LearnerProfile (level, unit, settings incl. voice, dialect, imageStyle), FsrsCardState, SkillScore (unitId, skill, score, attempts), RetentionScore (unitId, score, lastRetestAt), GrammarErrorLog entry (category: gender|case|ending|order|spelling|choice, item, context, at), SessionReport, WeeklySummary
2. Root all learner documents under a single `learners/{learnerId}` document with `learnerId = "default"` in v1
**Expected outcome:** Learner state that survives the v2.1 auth switch by changing only learnerId resolution.
**Acceptance criteria:** No learner data outside the learners/{learnerId} tree; error categories are a closed union type.
**Test cases:** (1) writing a grammar error with an unknown category fails typecheck; (2) all learner state resolves under learners/default; (3) SkillScore rejects values outside 0 to 100.

### GT-005: MediaProvider interface and provider switch
**Tier:** T1 | **Depends:** GT-002
**Context:** The adapter law (PRD 7.4). This contract is the single most protected piece of code in the build.
**Tasks:**
1. Create `lib/media/provider.ts` exporting the MediaProvider interface exactly as specified in PRD 7.4, plus ImageAsset, AudioAsset, VoiceSession, VoiceConfig types
2. Create `lib/media/index.ts` factory that returns the provider based on config.MEDIA_PROVIDER ('placeholder' | 'gemini')
3. Add a CI grep guard script that fails if any file outside lib/media/ imports Gemini image or audio endpoints
**Expected outcome:** One import path for all media in the entire app: `lib/media`.
**Acceptance criteria:** Interface matches the PRD verbatim; factory switch works; guard script wired into CI.
**Test cases:** (1) factory returns PlaceholderProvider when flag is placeholder; (2) guard script fails on a planted direct call in a test fixture; (3) asset key formats are enforced by type.

### GT-006: PlaceholderProvider, images
**Tier:** T3 | **Depends:** GT-005
**Context:** PRD 7.5. Placeholders must be functional and deterministic so caching paths and the style toggle are real.
**Tasks:**
1. Implement getImage: deterministic SVG tile from the word (hash-seeded background color, word text, article color-coded blue/red/green for der/die/das), visually distinct treatment for 'flat' vs 'render'
2. Persist generated placeholder refs through MediaAssetRef exactly as real assets will be
**Expected outcome:** Every picturable word renders an image card today.
**Acceptance criteria:** Same word plus style always yields identical SVG; flat and render are visually distinguishable; noun tiles show the article in its convention color.
**Test cases:** (1) determinism: two calls, identical output; (2) der/die/das map to blue/red/green; (3) asset ref written with key `{word}:{style}`.

### GT-007: PlaceholderProvider, audio and voice fallback
**Tier:** T3 | **Depends:** GT-005
**Context:** PRD 7.5. Listening and speaking flows must be fully exercisable pre-media.
**Tasks:**
1. Implement getAudio: browser SpeechSynthesis de-DE when available, else a silent asset flagged captionsRequired
2. Implement getLiveVoiceSession: text-mode session object exposing the same events a real voice session will (transcript, learnerInput, end), backed by text input plus browser speech recognition where available
3. Caption component contract: any audio with captionsRequired renders captions
**Expected outcome:** Listening exercises, dictation, and voice scenarios run end to end with no Gemini calls.
**Acceptance criteria:** Session event shape identical between placeholder and (future) Gemini implementations; captions always render for silent assets.
**Test cases:** (1) silent asset triggers captions; (2) fallback session emits transcript events from typed input; (3) getAudio never throws when SpeechSynthesis is absent.

### GT-008: Test harness and CI
**Tier:** T1 | **Depends:** GT-001
**Context:** PRD 7.7. Tests are part of done, phase by phase.
**Tasks:**
1. Add Vitest for unit tests, Playwright for integration flows, npm scripts test / test:e2e
2. CI script (GitHub Actions or local runner): lint, typecheck, unit, e2e (placeholder mode), adapter guard (GT-005)
3. Seed a smoke e2e: app boots, onboarding screen renders
**Expected outcome:** Every subsequent issue has somewhere to put its tests, and a single command proves the build healthy.
**Acceptance criteria:** `npm run ci` runs the full gate locally; smoke test passes.
**Test cases:** (1) CI fails when a unit test fails; (2) CI fails on typecheck error; (3) smoke e2e green.

---

## Phase 1: Curriculum and Content Core

### GT-101: Unit structure seed (18 units)
**Tier:** T2 | **Depends:** GT-003
**Context:** PRD 3.1 defines level content. Grammar items carry difficulty weights (PRD Section 6).
**Tasks:**
1. Author the 18-unit seed as a versioned JSON/TS file in `db/seed/units.ts`: per unit, theme, 2 to 3 grammar items with weights, target word count, capstone dialogue premise
2. Grammar progression must follow PRD 3.1 and Section 6: Akkusativ late A1, Dativ mid A2, Genitiv and adjective endings and verb-final clauses at B1
3. Seed script writes units to Firestore idempotently
**Expected outcome:** The full curriculum skeleton in Firestore.
**Acceptance criteria:** 18 units; grammar item placement matches the PRD progression table; re-running the seed changes nothing.
**Test cases:** (1) seed idempotency; (2) Dativ does not appear before A2; (3) every unit has a capstone premise.

### GT-102: Vocabulary ingestion pipeline
**Tier:** T2 | **Depends:** GT-003
**Context:** PRD 4.2 sources. Articles must be verified; a wrong article poisons the highest-weighted teaching area.
**Tasks:**
1. Script `scripts/ingest-vocab.ts`: parse vocabforge CSV, normalize fields, cross-check every noun article against the german-nouns dataset, flag mismatches to a review file instead of writing them
2. Tag each word with cefrLevel, theme (from Deutschland-Vocabulary mapping where available), frequencyRank (OpenSubtitles), picturable (heuristic: concrete noun list plus manual override file)
3. Cap B1 scope against the Goethe Wortliste list
**Expected outcome:** A clean, verified, tagged vocabulary corpus ready to seed.
**Acceptance criteria:** Zero unverified noun articles enter Firestore; mismatches land in `db/seed/article-review.json`; every word has level, theme, rank, picturable.
**Test cases:** (1) planted wrong-article row is flagged, not written; (2) word beyond the B1 Wortliste is excluded from B1 sets; (3) ingestion is idempotent.

### GT-103: A1 vocabulary seed and staged A2/B1 sets
**Tier:** T3 | **Depends:** GT-102
**Tasks:**
1. Seed the full A1 set (~650 words) to Firestore; stage A2 and B1 as seed files loaded when the learner approaches those levels
2. Thematic grouping within frequency order per PRD 3.3
**Expected outcome:** Day-one vocabulary live; later levels one command away.
**Acceptance criteria:** A1 count in range 600 to 700; each themed day-set is drawn highest-frequency-first within theme.
**Test cases:** (1) A1 seed count in range; (2) a generated day-set shares one theme; (3) staged loader writes A2 only when invoked.

### GT-104: FSRS integration and card state persistence
**Tier:** T1 | **Depends:** GT-004, GT-103
**Context:** ts-fsrs is the scheduler; states persist in Firestore (PRD 4.2).
**Tasks:**
1. Wrap ts-fsrs in `lib/fsrs/scheduler.ts` with a pure API: rate(card, rating, now) returns next state and due date
2. Persistence layer mapping FsrsCardState to and from ts-fsrs card objects
3. New-card introduction policy: cards enter FSRS on first exposure in a lesson
**Expected outcome:** Deterministic, tested scheduling core.
**Acceptance criteria:** Scheduler is pure (no I/O); Again/Hard/Good/Easy all transition per ts-fsrs semantics.
**Test cases:** (1) Good rating extends interval, Again resets to learning; (2) round-trip persistence preserves scheduler behavior; (3) rating an unknown card id fails loudly.

### GT-105: Review queue engine
**Tier:** T2 | **Depends:** GT-104
**Context:** Warm-ups draw due cards plus disguised retest items (PRD 4.6). Retest injection is built in Phase 3; leave the seam.
**Tasks:**
1. `lib/fsrs/queue.ts`: dueCards(now, limit) ordered by overdueness; interleave policy hook `injectExtras(items)` (no-op for now, used by GT-304)
2. Rating UI contract: one card at a time, wait for answer, rate, advance
**Expected outcome:** Warm-up queue ready for the lesson engine.
**Acceptance criteria:** Only due cards surface; ordering is stable; injection seam documented.
**Test cases:** (1) card due tomorrow does not surface today; (2) most-overdue first; (3) injected extra appears without disturbing FSRS ratings of real cards.

### GT-106: Placement check engine
**Tier:** T2 | **Depends:** GT-003, GT-109
**Context:** PRD 3.2. Multi-level ladder: five A1 probes, escalate at 4+, five A2 probes, escalate at 4+, five B1 probes. Conducted in English.
**Tasks:**
1. Implement the ladder as data-driven probe definitions (typed, in seed)
2. Scoring: per-skill baseline extraction, starting unit assignment (default A1.1)
3. Persist result to LearnerProfile plus baseline SkillScores
**Expected outcome:** Deterministic placement from probe answers.
**Acceptance criteria:** Escalation only at 4+ correct; result includes starting unit and per-skill baselines; re-runnable from Settings.
**Test cases:** (1) 3/5 at A1 assigns A1.1 without escalation; (2) 5/5 then 4/5 then 2/5 assigns A2 start; (3) rerun overwrites baselines cleanly.

### GT-107: Onboarding and placement UI flow
**Tier:** T3 | **Depends:** GT-106, GT-007
**Context:** PRD 4.1 order: voice selection (samples via MediaProvider), dialect choice, placement check.
**Tasks:**
1. Onboarding wizard: voice cards grouped Warm/Neutral/Energetic with sample playback, dialect selection, then the placement ladder UI (typed and spoken input where fallback supports it)
2. Persist selections to LearnerProfile settings
**Expected outcome:** A first-run experience that lands the learner in Day 1.
**Acceptance criteria:** Order enforced; selections changeable later in Settings; placement result screen explains the starting point in plain English.
**Test cases:** (1) e2e: complete onboarding lands on Day 1 plan; (2) voice sample plays through the adapter (assert no direct call); (3) skipping dialect defaults to Hochdeutsch.

### GT-108: Daily lesson engine
**Tier:** T2 | **Depends:** GT-105, GT-101, GT-109
**Context:** PRD 4.4 five-step session and 3.3 daily plan composition.
**Tasks:**
1. `lib/lesson/engine.ts`: composes a session from the daily plan: warm-up (queue), new vocabulary (themed set, 10 to 15), grammar focus (one item, weight-aware selection), skill practice slot (rotates listening/reading/writing/scenario), wrap-up (scores, tomorrow preview)
2. Adaptation rule: a poorly scored grammar item resurfaces next session
3. Session state persisted so an interrupted session resumes
**Expected outcome:** The orchestrator every skill feature plugs into.
**Acceptance criteria:** Five steps in order; one grammar rule per session; resume works; chunk-then-produce enforced (no step delivers content without a learner action).
**Test cases:** (1) failed grammar item reappears next session; (2) resume restores step and progress; (3) skill slot rotation covers all four skills across four sessions.

### GT-109: Gemini client wrapper and system prompt module
**Tier:** T1 | **Depends:** GT-002
**Context:** One canonical system prompt (PRD 11.1), one Gemini call path, model strings from config only.
**Tasks:**
1. `lib/prompts/tutor-system-prompt.ts` exporting the verbatim contents of system prompt v2 (single source; a sync check script compares it to docs/german-tutor-system-prompt-v2.md)
2. `lib/gemini/client.ts`: server-side only; chat(messages, options) attaching the system prompt; JSON-mode helper with schema validation and one retry on parse failure
3. Error taxonomy: rate-limit, safety-block, parse-failure, network, each surfaced distinctly
**Expected outcome:** Every Gemini text call in the app goes through one tested wrapper carrying one prompt.
**Acceptance criteria:** No fetch to Gemini outside lib/gemini/; prompt sync script passes; JSON helper returns typed results or a categorized error.
**Test cases:** (1) sync script fails when the ts prompt drifts from the md; (2) malformed JSON triggers exactly one retry then a parse-failure error; (3) grep guard: no Gemini URL outside lib/gemini/ and lib/media/.

### GT-110: Model tiering, fast default with high-thinking escalation
**Tier:** T2 | **Depends:** GT-109
**Context:** PRD 7.1. Routine turns on the fast model; escalation for writing assessment, complex grammar analysis, weekly reports.
**Tasks:**
1. Add tier parameter to the client: 'fast' | 'deep', model strings from config
2. Escalation policy map: which call sites use deep (writing correction GT-213, unit test generation GT-301, weekly summary GT-309, listening nuance evaluation GT-206 at B1)
3. Log tier per call for cost observability
**Expected outcome:** Cost-controlled intelligence where it matters.
**Acceptance criteria:** Default is fast; only mapped call sites escalate; tier visible in logs.
**Test cases:** (1) scenario turn uses fast; (2) writing correction uses deep; (3) missing deep model string in config fails at startup, not mid-call.

---

## Phase 2: Four Skills in Placeholder Mode

### GT-201: Vocabulary card component and echo flow
**Tier:** T3 | **Depends:** GT-108, GT-007
**Context:** Card format and echo teaching are fixed by the system prompt and PRD 3.4.
**Tasks:**
1. Card component rendering the exact format (flags, article color-coded, IPA, Beispiel with translation)
2. Echo flow: tutor presents twice (audio via adapter), learner produces (typed or spoken via fallback), faster second pass
**Expected outcome:** The standard vocabulary teaching interaction.
**Acceptance criteria:** Format matches the system prompt template exactly; production step is mandatory before advancing.
**Test cases:** (1) noun card shows article in convention color; (2) advancing without production is blocked; (3) audio requested through adapter only.

### GT-202: Image identification, recognition phase
**Tier:** T3 | **Depends:** GT-201, GT-006
**Tasks:**
1. Exercise: image (via adapter) plus 3 to 4 German word options; distractors drawn from same theme and level
2. Correct answer confirms warmly; wrong answer shows correct word plus article, logs error category if article-related, moves on
**Expected outcome:** Duolingo-style recognition live on placeholder tiles.
**Acceptance criteria:** Distractors plausible (same level, same theme where possible); picturable words only.
**Test cases:** (1) non-picturable word never gets an image exercise; (2) distractor set contains no duplicates; (3) wrong answer writes a grammar log entry when article confusion is involved.

### GT-203: Image identification, production phase
**Tier:** T3 | **Depends:** GT-202
**Tasks:** Review-time variant: image alone, learner types or speaks the word with article; article-aware scoring (word right, article wrong = partial, logged as gender error).
**Acceptance criteria:** Partial credit path exists; FSRS rating derived from result.
**Test cases:** (1) "Tisch" without "der" scores partial and logs gender; (2) full correct maps to Good or better; (3) production result updates the FSRS card.

### GT-204: Settings, image style and preferences
**Tier:** T3 | **Depends:** GT-006, GT-107
**Tasks:** Settings page: image style (Flat / 3D-style / Mixed default), voice, dialect, re-run placement. Mixed rule: render for concrete objects, flat for categories, per PRD 4.3.
**Acceptance criteria:** Style change reflects immediately using cached assets (no regeneration).
**Test cases:** (1) toggle flips asset key style; (2) Mixed picks per the rule; (3) placement re-run reachable from Settings.

### GT-205: Listening exercise flow
**Tier:** T3 | **Depends:** GT-108, GT-007
**Tasks:** Player (adapter audio, captions when required), describe-what-you-understood input, segment replay control, slower replay.
**Acceptance criteria:** Whole flow works with silent-asset captions; replay targets segments.
**Test cases:** (1) captions render for placeholder silent audio; (2) replay button replays the same clip id; (3) response submits to evaluation (GT-206).

### GT-206: Listening evaluation engine
**Tier:** T2 | **Depends:** GT-205, GT-110
**Tasks:** Gemini JSON evaluation: full / partial / missed with missed-point list; nuance explanation (idiom, register, implied meaning) at B1 via deep tier; result feeds session scoring.
**Acceptance criteria:** Typed evaluation result; B1 nuance uses deep tier; A1 uses fast.
**Test cases:** (1) evaluation returns closed-union verdict; (2) tier assertion by level; (3) parse failure surfaces a retryable UI state, not a crash.

### GT-207: Reading text generator
**Tier:** T2 | **Depends:** GT-110, GT-101
**Tasks:** Level-graded text generation: signs/notes (A1), emails/short articles (A2), blog posts, press reports, advertisements (B1); vocabulary constrained to learned words plus a bounded stretch set; length caps per level.
**Acceptance criteria:** Generated text vocabulary stays within corpus plus stretch budget; level determines format and length.
**Test cases:** (1) A1 text under length cap and format sign/note; (2) out-of-corpus word rate under the stretch budget (sampled check); (3) B1 request produces one of the three B1 formats.

### GT-208: Reading task formats
**Tier:** T3 | **Depends:** GT-207
**Tasks:** Goethe Lesen task UIs: richtig/falsch statements, multiple choice a/b/c, statement-to-advertisement matching; auto-generated items with answer keys from the generator; scoring to the reading skill.
**Acceptance criteria:** All three formats functional; item counts configurable; scores persist per skill.
**Test cases:** (1) matching format prevents double-assignment; (2) score writes SkillScore(reading); (3) answer key consistency check on generated items.

### GT-209: Tap-to-queue unknown words
**Tier:** T3 | **Depends:** GT-208, GT-104
**Tasks:** Tapping any word in a reading text shows its card (if in corpus) or a generated mini-card, and enqueues it to FSRS as a new card.
**Acceptance criteria:** Tapped word appears in the next warm-up queue when due.
**Test cases:** (1) in-corpus tap enqueues existing word id; (2) duplicate tap does not create a second card; (3) queue surfaces it per FSRS schedule.

### GT-210: Writing, word-tile sentence construction
**Tier:** T3 | **Depends:** GT-108
**Tasks:** A1 exercise: shuffled tiles, learner orders them; validates against accepted orders (V2 rule means multiple valid orders exist for adverbial-fronted variants); word-order errors logged.
**Acceptance criteria:** Accepts all grammatically valid orders defined per item; logs category "order" on failure.
**Test cases:** (1) "Heute möchte ich Kaffee" and "Ich möchte heute Kaffee" both accepted where defined; (2) verb-third rejected and logged; (3) completion feeds session score.

### GT-211: Writing, dictation
**Tier:** T3 | **Depends:** GT-205
**Tasks:** Adapter audio (captions hidden during attempt), learner types what they heard, diff-based feedback highlighting misspellings and misheard words; spelling errors logged.
**Acceptance criteria:** Works in placeholder mode (captions shown after submission for silent assets); diff highlights at word level.
**Test cases:** (1) exact match scores full; (2) umlaut error highlighted and logged as spelling; (3) captions never visible before submission.

### GT-212: Writing, emails and opinion texts
**Tier:** T3 | **Depends:** GT-108
**Tasks:** Two composers: ~80-word informal email with three required content points (checklist visible), and B1 opinion text on a prompt; word count guidance; submit to GT-213.
**Acceptance criteria:** Content-point checklist tracked; both Goethe Schreiben formats represented.
**Test cases:** (1) missing content point flagged before submission (soft warning); (2) word count indicator accurate; (3) submission reaches the correction engine.

### GT-213: Writing correction engine
**Tier:** T2 | **Depends:** GT-212, GT-110
**Context:** The exact four-part correction structure is fixed in the system prompt. Deep tier.
**Tasks:**
1. Gemini JSON correction: whatWorks, correctedText, errors[] (category from the closed union, original, corrected, explanation), patternTakeaway
2. Render per the structure; write every error to the grammar log; feed the difficulty-weighting engine seam (GT-311)
**Acceptance criteria:** Response schema-validated; every error categorized; content points assessed for the email format.
**Test cases:** (1) planted Dativ error returns category "case"; (2) all errors land in the grammar log; (3) schema violation triggers one retry then graceful failure UI.

### GT-214: Grammar mistake log and error analytics store
**Tier:** T3 | **Depends:** GT-004
**Tasks:** Write path used by scenarios, writing, image-ID, tiles; query API: errors by category, by grammar item, by time window; recurring-pattern detection (same category plus item 3+ times in 14 days).
**Acceptance criteria:** Single write path; recurring detection deterministic.
**Test cases:** (1) three case errors on pronouns in window flags a recurring pattern; (2) category filter returns only that category; (3) log entries carry context snippets.

### GT-215: Speaking echo loop (fallback mode)
**Tier:** T3 | **Depends:** GT-007, GT-201
**Tasks:** Tutor presents (adapter audio), learner responds via fallback session (speech recognition or typed), comparison scoring (correct / missing sounds / stress note via Gemini fast), retry loop, confirm when close.
**Acceptance criteria:** Loop runs fully in placeholder mode; retry capped with encouragement per tone rules.
**Test cases:** (1) exact transcript confirms; (2) near-miss offers retry with the specific issue named; (3) three misses moves on kindly, logs pronunciation item.

### GT-216: Scenario engine and A1/A2 scenarios
**Tier:** T2 | **Depends:** GT-108, GT-109
**Tasks:**
1. Scenario runtime: Layer 3 context injection per PRD Section 6 prompt architecture, turn loop, level-capped complexity
2. Seed the six A1/A2 scenarios (café, U-Bahn, introductions, directions, Supermarkt, doctor)
3. English-avoidance redirect per system prompt rules
**Acceptance criteria:** Scenario context injected per session; redirect fires by second English response.
**Test cases:** (1) barista scenario responds in German at A1 sentence length; (2) second English input triggers the redirect; (3) scenario completion emits a 0 to 10 score.

### GT-217: B1 scenarios
**Tier:** T3 | **Depends:** GT-216
**Tasks:** Seed six B1 scenarios (apartment viewing/Anmeldung, workplace, complaint/return, phone appointment, news/opinion discussion, Behörde) with level-appropriate register and complexity.
**Acceptance criteria:** B1 scenarios use subordinate clauses and formal register where the setting demands.
**Test cases:** (1) Behörde scenario uses Sie-form; (2) opinion scenario invites Konjunktiv II; (3) all six selectable at B1 only.

### GT-218: Inline corrections and post-session summary
**Tier:** T2 | **Depends:** GT-216, GT-214
**Tasks:** In-scenario correction per the four-step inline rule; end-of-scenario summary table (your version / correct / rule), total, one takeaway; every correction logged.
**Acceptance criteria:** Inline corrections never terminate the scene; summary table renders per the fixed format.
**Test cases:** (1) error mid-scene yields "Gut/Fast + Besser + one-line reason" and the scene continues; (2) summary rows equal logged errors for the session; (3) zero-error session produces a congratulatory summary without an empty table.

### GT-219: Session wrap-up and reporting hooks
**Tier:** T3 | **Depends:** GT-108, GT-214
**Tasks:** Wrap-up screen (words reviewed, recall rate, new words, rule practiced, scenario score, image-ID accuracy); persist SessionReport; expose hooks the Phase 3 analytics read.
**Acceptance criteria:** Report fields match PRD 4.7 per-session list.
**Test cases:** (1) report persists all fields; (2) recall rate math verified against queue results; (3) interrupted session produces no partial report.

### GT-220: App shell, navigation, and Day view
**Tier:** T3 | **Depends:** GT-107, GT-108
**Tasks:** Shell with Today (lesson entry), Practice (skills library), Progress (placeholder until Phase 3), Settings; responsive; the daily plan renders as the Today view.
**Acceptance criteria:** All Phase 2 features reachable; keyboard navigable.
**Test cases:** (1) e2e: full daily session from Today; (2) Practice lists all four skills; (3) mobile viewport renders without horizontal scroll.

---

## Phase 3: Assessment Engine

### GT-301: Unit test generator
**Tier:** T2 | **Depends:** GT-110, GT-101, GT-208
**Tasks:** Generate a unit test from unit content: per-skill sections proportional to what the unit taught; item types reuse skill formats (reading tasks, listening items, writing prompt, speaking prompt); answer keys validated; deep tier.
**Acceptance criteria:** Items reference only unit-covered vocabulary and grammar; per-skill sections present; regeneration produces a different but equivalent test.
**Test cases:** (1) no out-of-unit grammar item appears; (2) section weights match unit content proportions; (3) two generations share no identical items.

### GT-302: Per-skill scoring and pass gates
**Tier:** T1 | **Depends:** GT-301
**Context:** Scoring math is Goethe-derived: 0 to 100 per skill, 60% passes (PRD 4.6).
**Tasks:** Deterministic scoring per skill from item results (writing and speaking scored via GT-213-style rubric result, capped and normalized); pass/fail per skill; persist SkillScore with attempt history.
**Acceptance criteria:** Pure scoring functions; 60 exactly passes; attempts append, never overwrite.
**Test cases:** (1) 18/30 items = 60 = pass; (2) 59.9 fails; (3) attempt history preserves both attempts after a retake.

### GT-303: Remediation and single-skill retake
**Tier:** T2 | **Depends:** GT-302
**Tasks:** On a failed skill: generate targeted remediation exercises from the failed items' grammar and vocabulary; unlock retake of that skill section only after remediation completion; other passed skills untouched.
**Acceptance criteria:** Retake covers only the failed skill; remediation targets the actual failure categories.
**Test cases:** (1) failing writing locks only writing retake behind remediation; (2) remediation items map to failed categories; (3) passing the retake completes the unit.

### GT-304: Spaced retest scheduler
**Tier:** T1 | **Depends:** GT-105, GT-302
**Context:** The mechanism that makes progress mean retention (PRD 4.6). Schedule: 7, 14, 30, 60 days after unit pass.
**Tasks:** Retest item selection from passed units at schedule points; injection into warm-ups and scenarios via the GT-105 seam, unannounced; silent scoring against the unit's retention record.
**Acceptance criteria:** Retests are indistinguishable from normal items in the UI; schedule points respected; results write to retention, not to FSRS card states of unrelated words.
**Test cases:** (1) day-7 item appears in the first warm-up after day 7; (2) UI snapshot identical to a normal item; (3) retest result updates RetentionScore only.

### GT-305: Retention score and decay
**Tier:** T1 | **Depends:** GT-304
**Tasks:** Per-unit retention score updated by retest results; decay when retests fail or lapse; decayed unit (below threshold) schedules remediation into the daily plan automatically.
**Acceptance criteria:** Deterministic update math, documented in code; threshold configurable; remediation appears in the plan within one day of decay.
**Test cases:** (1) two failed retests drop the score below threshold; (2) decayed unit inserts remediation into tomorrow's plan; (3) recovered unit resumes the normal schedule.

### GT-306: Level gate exams
**Tier:** T2 | **Depends:** GT-302, GT-305
**Tasks:** A1-to-A2 and A2-to-B1 gates: four-module exam (all skills), 60%+ each, plus minimum average retention across the level's units; failure routes to the weakest modules with remediation.
**Acceptance criteria:** Gate requires both conditions; progression writes the new level to the profile; failure report names the blocking modules.
**Test cases:** (1) all modules 60+ but retention below minimum blocks progression; (2) one module at 55 blocks with that module named; (3) pass advances the level and unlocks the next unit set.

### GT-307: B1 exit simulation
**Tier:** T2 | **Depends:** GT-306
**Tasks:** Full Goethe-Zertifikat B1 simulation assembled per the official structure (Lesen 5 parts / 30 items / 65 min; Hören 4 parts / 30 items; Schreiben 3 tasks; Sprechen 3 parts), timed, scored to 100 per module.
**Acceptance criteria:** Structure and timing match the model-set structure; results presented per module with pass indication at 60.
**Test cases:** (1) Lesen section contains 30 items across 5 parts; (2) timer enforces module time; (3) module scores normalize to 100.

### GT-308: Session report view
**Tier:** T3 | **Depends:** GT-219, GT-302
**Tasks:** Progress tab session view: per-session metrics per PRD 4.7 plus error categories; honest presentation per system prompt (no inflation, drill-down to exact items on request).
**Acceptance criteria:** Every displayed number traceable to stored data; drill-down lists the actual items.
**Test cases:** (1) displayed recall rate equals stored; (2) drill-down shows the failed items verbatim; (3) empty session day renders an honest empty state.

### GT-309: Weekly summary generator
**Tier:** T2 | **Depends:** GT-308, GT-214, GT-110
**Tasks:** Deep-tier weekly synthesis: level bar, top five recurring error patterns with fixes, retention curve data, streak, next-week focus; growth framing against the learner's own past only.
**Acceptance criteria:** Patterns come from the GT-214 detector, not free generation; schema-validated output.
**Test cases:** (1) reported patterns match detector output; (2) summary references prior-week deltas; (3) generation uses deep tier.

### GT-310: Level dashboard and hard-area trends
**Tier:** T3 | **Depends:** GT-308, GT-305
**Tasks:** Per-skill trajectory charts, retention heat by unit, hard-area accuracy trends (genders, cases, endings, order) over time.
**Acceptance criteria:** Hard-area trends computed from the grammar log categories; charts render from stored aggregates.
**Test cases:** (1) gender-accuracy trend matches log-derived computation; (2) unit retention heat reflects RetentionScores; (3) empty history renders gracefully.

### GT-311: Difficulty-weighting engine
**Tier:** T1 | **Depends:** GT-214, GT-108
**Context:** PRD Section 6. Static weights (3x/2x/1x) plus adaptation to the learner's own error distribution.
**Tasks:** Weight table in config; selection multipliers applied in the lesson engine (grammar focus choice, drill frequency, retest frequency); adaptive shift: recurring-pattern areas gain weight, mastered areas decay toward baseline.
**Acceptance criteria:** Selection probabilities reflect weights measurably; adaptation moves weights within documented bounds; never below baseline for the intensive areas.
**Test cases:** (1) over 100 simulated selections, gender drills appear ~3x the 1x baseline; (2) recurring case errors raise the case weight; (3) intensive areas never drop below their PRD floor.

---

## Phase 4: Hardening

### GT-401: End-to-end placeholder pass
**Tier:** T3 | **Depends:** all Phase 2 and 3 issues
**Tasks:** Playwright suite covering: onboarding to placement to Day 1; a full daily session touching all four skills across runs; a unit test with a failed-skill retake; a retention decay to remediation path; B1 exam smoke.
**Acceptance criteria:** All journeys green in placeholder mode on CI.
**Test cases:** the five journeys above, each as a distinct e2e spec.

### GT-402: Adapter contract and integrity audit
**Tier:** T1 | **Depends:** GT-401
**Tasks:** Verify zero direct media calls (guard plus manual sweep); verify no hardcoded model strings; verify single system prompt import path; verify all Firestore access is converter-typed; document findings in docs/audit-phase4.md.
**Acceptance criteria:** All four sweeps clean or remediated in this issue.
**Test cases:** (1) guard script clean; (2) grep for model strings outside config returns nothing; (3) prompt import graph has one source.

### GT-403: Performance pass
**Tier:** T3 | **Depends:** GT-401
**Tasks:** Measure and fix: lesson step transitions under 200ms local, Gemini turn round-trips streamed to the UI, no layout shift on card advance; document budgets in docs/perf.md.
**Acceptance criteria:** Budgets documented and met on the reference machine.
**Test cases:** (1) step transition timing test; (2) streaming renders first token before completion; (3) CLS check on the lesson flow.

### GT-404: Accessibility pass
**Tier:** T3 | **Depends:** GT-401
**Tasks:** Keyboard-complete flows, ARIA on exercise controls, caption correctness, color-convention redundancy (article identity never conveyed by color alone; the article text is always present).
**Acceptance criteria:** axe checks clean on core flows; article information readable without color.
**Test cases:** (1) axe on lesson flow; (2) keyboard-only session completion; (3) grayscale screenshot still communicates articles.

---

## Phase 5: Media Generation (final)

### GT-501: Image generation script
**Tier:** T2 | **Depends:** GT-402
**Tasks:** `scripts/generate-images.ts`: read picturable vocabulary, call Nano Banana 2 (key from env) with the style prompts (single clean subject, plain background, flat vs. render), write assets keyed `{word}:{style}`, update MediaAssetRef status; idempotent (skip existing), resumable (progress ledger), batched per level with a --level flag.
**Acceptance criteria:** A1 batch completes; rerun generates nothing new; interrupted run resumes at the ledger point.
**Test cases:** (1) rerun after completion is a no-op; (2) kill mid-batch, resume completes without duplicates; (3) generated key format matches placeholder keys exactly.

### GT-502: Audio generation script
**Tier:** T2 | **Depends:** GT-402
**Tasks:** `scripts/generate-audio.ts`: generate native de-DE audio for vocabulary pronunciations and lesson clips via Gemini (key from env), keyed by clipId; same idempotency, resumability, and per-level batching as GT-501.
**Acceptance criteria:** A1 audio batch complete; caption data retained for accessibility even with real audio.
**Test cases:** (1) idempotent rerun; (2) resume after interruption; (3) clipId keys match placeholder keys.

### GT-503: Gemini Live voice integration
**Tier:** T1 | **Depends:** GT-402
**Tasks:** Implement getLiveVoiceSession in GeminiProvider: de-DE config, selected voice from profile, system prompt injected into session config, barge-in and VAD enabled, transcription on; event shape identical to the fallback session (GT-007 contract).
**Acceptance criteria:** Echo loop and voice scenarios run on real audio with zero changes outside lib/media/.
**Test cases:** (1) event-shape contract test passes against both providers; (2) voice matches profile selection; (3) transcript events populate the correction pipeline.

### GT-504: Provider flip and regression
**Tier:** T2 | **Depends:** GT-501, GT-502, GT-503
**Tasks:** Switch config to GeminiProvider; run the full GT-401 suite plus media-specific regression (image render, audio playback, voice session); document the flip in docs/media-flip.md.
**Acceptance criteria:** Full suite green on the Gemini provider; placeholder mode still selectable for development.
**Test cases:** (1) GT-401 suite green post-flip; (2) image cards render real assets from cache without regeneration; (3) flipping back to placeholder still works.

---

## Phase 6 (v2.1): Auth

### GT-601: Firebase Authentication
**Tier:** T2 | **Depends:** GT-504
**Tasks:** Firebase Auth (email plus Google sign-in), learnerId resolution from auth identity replacing "default", sign-in UI, session handling.
**Acceptance criteria:** Authenticated user maps to their own learners/{uid} tree.
**Test cases:** (1) two accounts see isolated progress; (2) unauthenticated access redirects to sign-in; (3) default-learner data migration path documented.

### GT-602: Firestore rules lockdown
**Tier:** T1 | **Depends:** GT-601
**Tasks:** Replace open test rules: learner tree readable/writable only by its owner; curriculum read-only to authenticated users; rules unit-tested with the Firebase emulator.
**Acceptance criteria:** Emulator tests prove isolation; no open rules remain.
**Test cases:** (1) cross-user read denied; (2) curriculum write from client denied; (3) owner read/write allowed.

### GT-603: Cross-device sync verification
**Tier:** T3 | **Depends:** GT-601
**Tasks:** Verify progress, FSRS states, and settings follow the account across devices; conflict policy documented (server timestamp wins).
**Acceptance criteria:** Session on device B reflects device A's completed lesson.
**Test cases:** (1) lesson completed on A appears in B's history; (2) settings change propagates; (3) concurrent rating conflict resolves per policy.

---

## Issue Index

| Phase | Issues | Count |
|-------|--------|-------|
| 0 Foundation | GT-001 to GT-008 | 8 |
| 1 Curriculum core | GT-101 to GT-110 | 10 |
| 2 Four skills | GT-201 to GT-220 | 20 |
| 3 Assessment | GT-301 to GT-311 | 11 |
| 4 Hardening | GT-401 to GT-404 | 4 |
| 5 Media (final) | GT-501 to GT-504 | 4 |
| 6 Auth (v2.1) | GT-601 to GT-603 | 3 |
| **Total** | | **60** |

*Implementation Plan v1.0. Read `german-tutor-engineering-strategy.md` before starting any issue.*
