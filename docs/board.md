# Issue Board (ledger)

Source of issue definitions: `german-tutor-implementation-plan.md`. This file tracks status only.
Statuses: open | in-progress | blocked | done. Every status change lands with the commit that causes it.

## State of the build

**2026-07-19 (later), Claude (Fable 5), builder.** The app is deployed, live, and backed up.
GT-D3 made the VPS/Postgres path the real default: `DATA_STORE` defaults to `postgres`, and each
store's credentials are required only when that store is selected, so production no longer carries
invented placeholder Firebase values purely to satisfy the schema (`AppConfig.firebase` is
`| undefined`, so the type system forbids passing empty strings). GT-D4 fixed an owner-reported
bug where `/` rendered onboarding unconditionally and walked placed learners back into the
placement ladder; the root now redirects to `/today` when a profile exists, and the header
wordmark became a real home link pointing at `/today` rather than `/`. GT-D5 and GT-D6 restructured
Practice (skills lead as tiles, reference surfaces demoted to rows) and Today (per-step minute
estimates beside a sticky summary panel; the old hardcoded "15 to 20 minutes" is now derived from
the actual plan via the pure, unit-tested `lib/lesson/session-estimate.ts`).

`npm run ci` green at 29 e2e plus the unit suite. Live at
`http://detutor.65.109.12.203.sslip.io`, auto-deployed from `main` by webhook; note Coolify has no
health gate before cutover, so a build that succeeds but crashes at runtime is still served — run
the gate before pushing.

**Infrastructure, previously missing:** the production database had NO backups at all. There is now
a nightly `pg_dump` at 03:17 via `/usr/local/bin/detutor-backup.sh` (14-day retention, exits
non-zero rather than leaving a useless file if the container is down, the dump is implausibly
small, or the `documents` table is absent). Restore was verified, not assumed: the dump was loaded
into a scratch database and matched the source exactly. **Remaining gap: those dumps live on the
same host as the database**, so they survive a bad deploy or an accidental drop but not loss of the
VPS. Coolify's own scheduled-backup feature (with S3) is still unconfigured and is the owner's to
enable, since it needs storage credentials.

Three browse-style UI directions were shown to the owner as HTML replicas; two shipped (GT-D5,
GT-D6). The third, a category-rail word catalogue for Learn, was recommended against and
deliberately not built: a card grid suits visually distinct listings, and over 694 words it
degrades into near-identical typographic tiles that scan worse than a list, while its rating-style
metric would misrepresent recall as a rating. Revisit only if browsing Learn proves painful in real
use.

Next, by owner decision: Phase 6 auth (GT-601-603) and any further content generation remain
deferred. A1 content only.

**2026-07-19, Claude (Opus 4.8), builder.** GT-D2 adds a Postgres learner-state store so the
platform can be self-hosted without a Firebase project, unblocking deployment (and the Phase 6
credential dependency) on the owner's VPS. `DATA_STORE` now accepts `firestore | postgres |
dev-file`; postgres additionally requires `DATABASE_URL`, enforced at config load rather than at
first write. `lib/db/postgres-store.ts` implements the existing GT-107 `DocumentStore` interface
against a single key/JSONB table it creates on first use, preserving Firestore's semantics
including the direct-children-only `list()` filter; `pg` is imported lazily so firestore and
dev-file deployments never load the driver. `npm run ci` green: lint, format, typecheck, 4 guards,
372 unit/component tests (11 new: 7 Postgres integration, 4 config). Verified end to end against a
real Postgres through `getDataStore()` — a learner profile written by the converter path lands as
JSONB and reads back intact. Firestore and dev-file paths are untouched. Next: deployment to
Coolify, then Phase 6 auth.

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
      at **100 of 656 A1 clips** (counted on disk 2026-07-19; this entry previously said 55, which
      had drifted). Note this is now less urgent than it was: since GT-D2/GT-D6 the app generates
      TTS on demand and caches it, so a missing clip is a first-play delay rather than a gap.
      Pre-generating is a latency optimisation, not a correctness requirement.
      **By owner decision (2026-07-09), A2 and B1 audio are deferred** until the learner
      approaches those levels; generate them then with `-- --level A2|B1`.

- [x] ~~Create the real Firebase project~~ — **obsolete as of GT-D3 (2026-07-19).** Production
      runs on Coolify Postgres, and `FIREBASE_*` is now required only when `DATA_STORE=firestore`.
      No Firebase project is needed unless someone deliberately selects that store.
- [x] GEMINI_API_KEY supplied 2026-07-09 (lives in .env.local only; never committed).
- [x] Text model ids verified live 2026-07-09 (gemini-2.5-flash and gemini-2.5-pro both respond);
      Live and image identifiers still need verification at Phase 5 (GT-501/503).
- [x] GitHub remote added 2026-07-09: https://github.com/otobongo/deTutor (push after each issue).

## Discovered work (not yet in the plan)

- [x] **GT-D8: Schiefer theme, and themes become a picker (done 2026-07-19, owner-directed).**
      Four palettes were shown to the owner as HTML replicas and approved in general terms, but
      none had ever been implemented; the app still shipped only Papier plus `monochrome-stark`.
      Schiefer (cool blue-grey neutrals, muted teal accent) now exists as a full token set in both
      light and dark. It was chosen because a single accent must serve three jobs here (progress
      track, exam timer's low state, selected chips) and teal clears AA in all three without the
      special-case treatment gold needed. All 21 pairings across both modes were measured before
      the CSS was written, including the three article colours that carry grammatical gender.
      The control changed shape: a two-way toggle cannot express three themes, so
      `theme-controls.tsx` now renders a `Chip` picker driven by an exported `THEMES` list, and
      the old `theme-toggle` testid became `theme-picker` plus `theme-{id}`. **Trap worth
      remembering: the pre-hydration script in `layout.tsx` whitelists theme ids explicitly (it
      writes straight to a DOM attribute from user-writable localStorage), so any new theme must
      be added there too or it silently flashes the default on every load.** The added e2e test
      covers exactly that by reloading and re-asserting.

- [x] **GT-D9: close the visual seam left by GT-D5/D6 (done 2026-07-19, owner-directed).**
      Shipping two of three UI directions left Today and Practice speaking a different visual
      language from the rest of the app. Progress was the worst of it: plain `text-3xl`/`text-xl`
      headings and its headline figures buried inside a sentence on a page that gets scanned, not
      read. Progress now leads with three large tabular figures (words learned, percent with
      grade, foundations marked) over a `ProgressBar`, inside a bordered surface matching the
      Practice tiles. The original sentence is retained as `sr-only`, so the e2e assertion and
      screen readers keep the full statement while sighted users get the scan aid. Remaining
      plain `<h1>`s across Learn, Catalog, Words, and Today's no-profile fallback were moved onto
      the display face. Learn's card grids already matched and were left alone.

- [x] **GT-D6: Today session summary panel (done 2026-07-19, owner-directed).** The second of the
      three browse-style directions, and the one recommended if only one shipped. Today's plan
      became numbered rows carrying a per-step minute estimate, beside a panel that sticks to the
      viewport on large screens so the commitment and the start button stay together while the
      plan is read. The panel states total minutes, review-card count, new-word count, grammar
      focus, and skill slot. The page previously claimed a hardcoded "15 to 20 minutes"
      regardless of the actual plan; the figure is now derived.
      New pure module `lib/lesson/session-estimate.ts` (7 unit tests) holds the arithmetic, per
      the no-I/O-in-scoring convention. Two correctness points worth keeping: the total is summed
      from raw seconds rather than from per-step rounded minutes, so it cannot drift by five
      rounding errors; and both the estimate and the warm-up row count `warmupItems` rather than
      the step's own `queueWordIds`, because due retests ride the warm-up disguised as reviews
      (GT-304) and would otherwise be invisible to the estimate, promising a shorter session than
      the learner actually gets. `stepEstimates`/`StepEstimate` were written and then removed
      before commit once nothing consumed them (no dead code). Estimates are presented as
      approximate and derived from plan shape, not from measured telemetry, which does not exist
      yet. Note for future e2e work: `completeOnboarding` stops at the placement result and does
      not navigate to Today; tests needing the Day view must hop there explicitly.

- [x] **GT-D5: Practice hub hierarchy (done 2026-07-19, owner-directed).** Chosen from three
      browse-style UI directions shown to the owner as HTML replicas. The page previously gave
      four skills and the reference links roughly equal visual weight, so nothing said what to do
      first. The four skills now lead as tiles in a two-column grid, each with its German name
      (Hören, Lesen, Schreiben, Sprechen), a short summary line, and its B1 exam score where a
      sitting exists; the image catalogue and exam simulation drop to compact rows under an
      "Also here" label. Real data only: a skill with no exam result shows no chip rather than a
      fabricated zero. Every existing testid was preserved (`skill-*`, `practice-speaking-link`,
      `catalog-link`); `practice-exam-link` is new. The added e2e test asserts hierarchy by
      measured height rather than DOM order, since ordering alone would pass even if the tiles
      and rows looked identical. The two heavier directions (a category-rail word catalogue for
      Learn, and a sticky session-summary panel for Today) were NOT built: the catalogue's card
      grid suits visually distinct listings and would degrade to near-identical typographic tiles
      over 694 words, and its rating-style metric would misrepresent recall as a rating.

- [x] **GT-D4: top navigation organization and the onboarding-return bug (done 2026-07-19,
      owner-reported).** Reported as "somehow I can see the Landing page again when I click
      Today". Today itself was fine; the real fault was that `/` rendered the onboarding wizard
      unconditionally, with no profile check, so any return to the site root (browser Back, a
      bookmark, a reload of `/`) put a placed learner back into the placement ladder. Compounding
      it, the header wordmark was a plain `<span>`, so the app had no home link at all and no
      obvious way back to the plan. Fixed: `/` redirects to `/today` when a valid learner profile
      exists and stays onboarding only while none does (re-running placement remains a deliberate
      action from Settings); the wordmark became a real link to `/today`, not `/`; the header
      split into the four daily learning surfaces with Settings opposite them as account, so it
      reads as two groups rather than five equal items. Three e2e tests pin the behaviour, and
      the keyboard-order test was updated because the wordmark is now focusable ahead of the
      section links. Note: the smoke test previously inherited whatever profile a prior test
      left behind; it now resets the store so it exercises a genuine first visit.

- [x] **GT-D3: Postgres/VPS as the default deployment target (done 2026-07-19, owner-directed).**
      The app deployed to the VPS on Postgres (GT-D2) but the codebase still defaulted to
      `DATA_STORE=firestore` and required all three `FIREBASE_*` variables non-empty under every
      store, so the live deployment carried invented placeholder credentials purely to satisfy
      the schema. Changed: `DATA_STORE` now defaults to `postgres`; `FIREBASE_*` is optional in
      the base schema and required by the refinement only when `DATA_STORE=firestore`, mirroring
      how `DATABASE_URL` is handled for postgres; `AppConfig.firebase` became
      `| undefined` so the type system forbids handing Firebase empty strings, with
      `lib/firebase.ts` throwing a named wiring error instead; `.env.example` rewritten
      store-by-store, defaulting local development to `dev-file` (no credentials at all) and
      documenting that placeholder values must not be invented to satisfy the schema.
      Firestore remains fully supported. Note for future config work: zod short-circuits before
      refinements when a base field is missing, so a fully empty environment reports
      `GEMINI_API_KEY` alone rather than every store credential at once.

- [x] **Exam canvas redesign (done 2026-07-10, owner design brief).** Audit findings: no sense
      of exam mode, no stimulus/question/answer hierarchy, options that did not look
      answerable, checklist-as-form, content sharing the chrome's type voice. Direction: a
      dedicated exam canvas within the existing tokens. Sticky exam bar (module, percent done,
      always-visible monospace timer: gold chip under 5 minutes, error tint under 1, with text
      twins) over a gold segmented progress track; centered max-w-2xl column; Teil/Frage
      eyebrow; stimulus on the reading serif surface with a gold accent edge; question in
      display type; answers as full-width lettered A/B/C option cards. Production tasks are
      numbered task cards with word-budget chips (parsed from "circa NN Wörter"), coverage
      chips, and clickable checklist rows that tint green when done. Overview is a 2x2 module
      card grid leading with the German module names. All testids preserved; 25 Playwright
      checks green.

- [x] **B1 exam content wired and generated (done 2026-07-10, owner-directed; completes
      GT-307).** Each Goethe module generates on demand (new deep call site
      b1-exam-generation, fifth justified deep site) into the code-owned blueprint, validated
      against the official part/item counts with one retry, and caches forever in the
      b1ExamContent store collection; a deterministic corpus filler (never cached) keeps every
      sitting possible without the brain, labeled honestly. New /exam/[skill] pages run a
      full timed sitting: the official clock auto-submits at zero, objective modules run item
      by item (Lesen 5/30, Hören 4/30), production modules (Schreiben, Sprechen 3 tasks each)
      self-score against content points; results normalize 0-100, persist per module, and the
      overview shows scores plus Bestanden when all four clear 60. Owner decision: the exam
      stays open at any level for testing. Real content generated live with the owner's key
      (all four modules cached in the dev store). 25 Playwright checks green incl. two full
      exam sittings.

- [x] **Retention loop closed (done 2026-07-10, owner-directed gap fixes).** Passing a unit now
      writes its retention record (retentionScoreSchema gained nullable passedAt anchoring the
      7/14/30/60-day schedule; old records parse via default) and advances the profile to the
      next unit within the level (level boundaries wait for the GT-306 gate exam; retakes of
      older units never move the profile). Due retests now actually ride the warm-up: the
      GT-304 injector is wired into session composition, each due retest wears a deterministic
      corpus word as its face (lib/lesson/retest-disguise.ts), renders identically to a review,
      and its rating silently applies applyRetestResult (recalled = anything above "again")
      via app/actions/retention.ts, never touching FSRS state. Scenario corrections now count
      in the session report's errorsByCategory tally. e2e: disguised-retest journey asserts
      the +10 and lastRetestAt stamp in the store; the retake journey asserts advancement to
      A1-2 on Today. 23 Playwright checks green.

- [x] **App-wide design standards pass (done 2026-07-10, owner-directed; plan in
      docs/clarifyask-plan-design.md, rules in docs/design-standards-appendix.md).** Shared
      primitives in app/components/ui.tsx (Button, ButtonLink, ActionRow, ProgressBar,
      StatusChip, Chip) now carry every action in the app; two specialist subagent audits
      (frontend design on Opus, accessibility on Sonnet, 30 findings each) drove the fix list
      and three Sonnet workers migrated the session runner, all skill panels, and every page in
      parallel. Sparing accents from existing tokens: gold progress bars and grade chips,
      success tints for learned/done, never color alone. Desktop composes (Today plan + aside,
      Progress two-column, workspace two-column) while mobile stacks full-width. Accessibility:
      FocusHeading moves focus on every swapped view, skip-to-content link, aria-pressed on all
      selectable chips/options, aria-expanded on neighbor chips, role=status on async feedback,
      lang="de" on all German content, 44px touch targets, exercise images carry alt text.
      Onboarding slimmed to welcome + placement with defaults (voice warm-1, Hochdeutsch,
      mixed images, theme follows system); every preference including theme/mode lives in
      Settings with audible voice samples; nav is wordmark + five links with aria-current
      active state. Today's plan speaks the grammar item's human name, not its id.

- [x] **Audio polish + hermetic e2e (done 2026-07-10, owner-directed).** All contextual "Hear
      it" buttons are now compact speaker-icon buttons (AudioPlayer icon variant, aria-labeled);
      example blocks are fluid by count (one example full width, two or more as columns);
      foundation section intros are listenable on demand (spoken English via the en-US TTS
      path). Infrastructure fix after the third stale-server e2e breakage: Playwright now runs
      its own dev server on port 3100 with reuseExistingServer off and a dedicated store file
      (DEV_STORE_FILE=.dev-data/e2e-store.json, new optional env read in lib/config.ts), so
      test runs never collide with the owner's live dev server on 3000 and never wipe the
      owner's local learner data again.

- [x] **Learn before testing (done 2026-07-10, owner-directed; plan in
      docs/clarifyask-plan-learn.md).** New /learn section: Foundations shelf (12 curated study
      topics in db/seed/foundations.ts covering numbers, pronouns, accusative, dative, and every
      A1 grammar item, each with tables, audible examples, and a scored, graded self-check kept
      as best score) and Word groups (theme-mapped shelves plus the split "general" theme;
      numbers and pronouns are new curated card entries in db/seed/foundation-vocab.ts). The
      Learn flow marks a word learned and advances (skip/unmark supported); marking introduces
      the FSRS card (joins warm-ups, verified in e2e) and removes the word from future day
      sets. Progress is measured per learner (learnedWords + foundationProgress collections,
      store seam gained delete()) with percent and A-E grades on /learn and /progress. Nothing
      gates: Learn and /test both stay open, both scored. Word workspace is now responsive
      (two-column desktop, stacked mobile), echo optional outside sessions, and neighbor chips
      open with their own play button. 22 Playwright checks incl. 3 Learn journeys; axe covers
      /learn and a foundation page.

- [x] **Voice preference wired to all audio (done 2026-07-10, owner-reported robotic voice).**
      Root cause of the robotic voice: MEDIA_PROVIDER=placeholder in the owner's .env.local, so
      the app only ever used browser speech synthesis; flipped to gemini. The Settings/onboarding
      voice profile now drives every generated clip: VOICE_NAME_BY_PROFILE (warm-1=Sulafat,
      neutral-1=Kore, energetic-1=Puck) moved to lib/media/tts.ts and is shared by on-demand TTS,
      the batch script default, and the Live session. Audio cache keys are voice-aware
      ({clipId}@{Voice} for non-default voices; the bare key stays for Kore so the 55
      pre-generated clips remain valid), so changing the voice in Settings mints fresh clips
      immediately. Onboarding voice samples now speak in their own voices. Verified live:
      warm-1 profile minted word/dict clips as @Sulafat.

- [x] **Dialogue lab (done 2026-07-10, owner-directed).** The listening slot is now a spoken
      two-person conversation: brain-generated on the unit theme inside a code-owned envelope
      (6-10 turns, level length caps, corpus stretch budget with verb-stem inflection matching),
      curated A1 fallbacks (db/seed/dialogue-fallback.ts) when the brain is unreachable, and
      two-voice audio (Anna=Kore, Ben=Puck) through the on-demand TTS cache keyed by content
      hash. Phases: listen without transcript (real audio; captioned placeholder audio keeps the
      transcript per GT-007), identify heard words vs decoys (pure, deterministic, scored),
      explain the conversation in English (GT-206 evaluator, recoverable offline), then the
      transcript reveals with normal and slower replay. Identification score records to
      SkillScore(listening) and the session report. New fast-tier call site dialogue-generation.
      The old single-clip ListeningExercise and the payload's listeningClip were removed as dead
      code (unit listening clips remain in the seed and audio script).

- [x] **Word workspace (done 2026-07-10, owner-directed).** The vocab step now presents each
      word Google Translate style: focus zone (display-size word, article colored and as text,
      IPA, pronunciation audio), the echo production strip directly beneath, then a context zone
      (example sentence with audio, a cached brain-written plain-English usage note with audio
      via the en-US TTS path, distinct senses for multi-meaning words like Karte) and a
      neighborhood zone of related corpus words (shared-stem family first, then theme neighbors
      by frequency; pure lib/lesson/related-words.ts). Tapping a neighbor shows its essentials
      and quietly introduces its FSRS card. Notes cache through the wordNotes store collection
      (lib/lesson/word-notes.ts); the clip registry is now language-aware (de-DE/en-US). Extras
      load after first paint and append below the echo strip, so a brain outage or slow load
      never blocks production and never shifts layout. Also fixed: this Next version's JSX
      compiler drops the space between an expression and a following word (vocab heading
      rendered "15in"); heading is a template string now.

- [x] **On-demand audio with disk cache (done 2026-07-10, owner-directed).** The GeminiProvider
      now synthesizes a missing clip the first time a session requests it (lib/media/tts.ts is
      the shared synthesis seam, single or multi-speaker), writes the wav plus manifest entry,
      and serves from cache forever after. Bounded wait (4s) per request: slow synthesis serves
      the captioned placeholder now and the real clip next time; any failure opens a 10-minute
      cooldown so a dead quota never stalls pages. Daily sessions need 10 to 20 new clips, which
      fits the free TTS tier; npm run generate:audio remains the optional bulk pre-warmer and now
      shares the same synthesizer. Manifest utilities moved to lib/media/manifest.ts. Session and
      speaking-practice audio fetches parallelized so day-one waits overlap.

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
- [x] **GT-D2: Postgres learner-state store (done 2026-07-19).** Third DocumentStore adapter
      (`lib/db/postgres-store.ts`) behind the existing seam, so a self-hosted deployment owns its
      learner data without a Firebase project. `DATA_STORE=postgres` plus `DATABASE_URL`; the
      adapter creates its own key/JSONB table on first use. Firestore and dev-file are untouched.

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
| 2026-07-19 | GT-D2 | Third store adapter (postgres) alongside firestore and dev-file | Owner deploys to a self-hosted VPS (Coolify) and wants to own the learner data rather than depend on a Firebase project; Phase 6 was blocked on those credentials. The GT-107 seam already existed, so this is one adapter plus one enum value, no change to the converter-validated write path. |
| 2026-07-19 | GT-D2 | Documents stored as one key/JSONB table, not normalised per-entity tables | The seam hands the adapter whole documents keyed by `collectionPath/id`; a key/value table reproduces Firestore semantics exactly. Normalising would require teaching the adapter every learner schema, which is what the seam exists to prevent. |
| 2026-07-19 | GT-D2 | Postgres tests are integration tests gated on TEST_DATABASE_URL, skipped without it | The adapter's whole value is SQL behaviour (upsert, the direct-children list filter, JSONB round-trip); a mocked pool would assert nothing. Skipping keeps a checkout without Postgres green. |

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
