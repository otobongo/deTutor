# German Learning Platform, Product Requirements Document v2 (Claude Code edition)

**Version:** 2.0  
**Author:** Otobong Okoko  
**Date:** July 2026  
**Build tool:** Claude Code, running Claude Fable 5 (the builder)  
**Runtime stack:** Google (Firebase/Firestore, Gemini API as the brain, Gemini Live for voice, Nano Banana 2 for images)  
**Status:** Draft  
**Supersedes:** `german-tutor-prd-claude-code.md` (v1.0) for scope. v1 files are retained as history.

> v2 expands the personal A1 tutor into a comprehensive A1 to B1 learning platform covering listening, reading, writing, and speaking, with a scored assessment engine, difficulty-weighted curriculum, and a build sequence that ships the full app on functional placeholders before any real media is generated. Gemini is the runtime brain for token economics. Claude Fable 5 builds the platform via Claude Code but does not run inside it.

---

## 1. Overview

### 1.1 Product Vision

An easy-to-use, comprehensive German learning platform that takes an English-speaking learner from zero to B1 across all four skills: understanding (listening), reading, writing, and speaking. Progress is measured by demonstrated comprehension and retention, not topic completion. The areas learners struggle with most get disproportionately intensive coverage. The tutor teaches the way the best crash-course instructors do: echo teaching, pattern extraction, contrast with English, and immediate production.

### 1.2 Problem Statement

Most language apps optimize for streaks and completion, not comprehension. A learner can "finish" a unit on noun genders and still fail to produce der/die/das correctly two weeks later, and the app never notices. Meanwhile the genuinely hard parts of German for English speakers (genders, cases, adjective endings, word order) get the same practice time as the easy parts. This platform inverts both failures: it retests everything on a schedule, gates progression on demonstrated comprehension, and spends its intensity where the difficulty actually lives.

### 1.3 Target User

**Primary:** Otobong Okoko, English-speaking professional, living in Berlin, absolute beginner in German, learning for daily life and long-term residency. B1 is also the legal language threshold for German naturalization, which makes it a meaningful terminal goal for v2.

### 1.4 Learner Language Context

The learner's native language is **English**. The platform uses this as a structural advantage:

- All explanations, corrections, and grammar notes are in English
- German grammar is taught by explicit contrast with English wherever the contrast holds (SVO order, shared Germanic vocabulary), and by pattern extraction where it does not (cases, adjective endings, verb-final clauses)
- False friends are flagged explicitly (Gift, bald, Mist, also, Chef, bekommen, sensibel)
- English scaffolding is heavy at A1 and withdrawn progressively; by B1, instructions and feedback shift toward simple German with English available on request

---

## 2. Goals and Success Metrics

| Goal | Metric |
|------|--------|
| Reach B1 within 12 months | Pass a full Goethe-Zertifikat B1 model test (all four modules at 60%+) |
| Retention, not completion | 80%+ recall on spaced retests of material "completed" 14+ days earlier |
| Four-skill balance | No skill module scoring below 60% at any level gate |
| Master the hard areas | Gender/article accuracy 85%+ by A2 exit; case accuracy 75%+ by B1 exit |
| Grammar growth | Recurring-error rate falls 50% per level |
| Engagement | 15+ minute active session, 5 days/week |

---

## 3. Curriculum Framework

### 3.1 CEFR Alignment and Level Structure

The curriculum spans **A1, A2, and B1**, each split into six units:

- **A1 (Units A1.1 to A1.6):** alphabet and pronunciation, greetings, self-introduction, SVO sentences, personal pronouns, present tense, numbers, days and time, basic questions (V2 inversion), articles introduced, Akkusativ introduced late, ~650 active words at exit
- **A2 (Units A2.1 to A2.6):** past tenses (Perfekt), Dativ, separable verbs, modal verbs, comparatives, everyday transactions and correspondence, ~1,300 cumulative words at exit
- **B1 (Units B1.1 to B1.6):** subordinate clauses and verb-final order, Genitiv, adjective endings intensively, Konjunktiv II, passive voice, opinion and argument, work and society topics, ~2,400 cumulative words at exit (matching the Goethe B1 Wortliste scope)

Each unit contains: a themed vocabulary set, two to three grammar items, exercises in all four skills, one capstone dialogue, and a scored unit test.

### 3.2 Placement Check

On first launch, a placement check assigns the starting point. It now spans levels:

1. Five A1 probes (greeting comprehension, numbers, basic sentence comprehension, vocabulary recognition, "sein" conjugation)
2. If 4+ correct, five A2 probes (Perfekt recognition, Dativ pronoun choice, separable verb, short reading, short dictation)
3. If 4+ correct again, five B1 probes (subordinate clause completion, adjective ending, short opinion prompt, listening gist, reading detail)

**Output:** starting unit (default A1.1), per-skill baseline scores, and a personalized first-week plan.

### 3.3 Curriculum Builder

Generates a rolling 7-day plan from: current unit, per-skill scores, the grammar mistake log, FSRS review load, difficulty-weighted priorities (Section 6), and scenario preferences. Each day includes one vocabulary set, one grammar focus, one listening exercise, one reading or writing exercise (alternating), one dialogue scenario, and the FSRS review queue. Vocabulary sets are **thematically grouped within CEFR frequency order**: the day's words share a theme, drawn from the highest-frequency words not yet learned at the current level.

### 3.4 Teaching Method (codified from expert instruction analysis)

Derived from analysis of high-performing native-instructor teaching (the A1 crash-course transcript). These are platform-wide rules, encoded in the system prompt:

1. **Echo teaching.** Every new word or phrase is presented twice by the tutor, then produced by the learner aloud or typed. A faster second pass follows.
2. **Chunk, then produce.** Never more than five minutes of input before the learner produces output. Alphabet to umlauts to special sounds to a pronunciation exercise, in that rhythm.
3. **Pattern extraction over memorization.** Teach the rule that generates the forms (teen numbers = root + zehn), then isolate the exceptions explicitly as a short memorize-this list (elf, zwölf, siebzehn, zwanzig). Same move for weekday -tag endings (exception: Mittwoch), feminine -ung/-heit/-keit endings, and neuter -chen/-lein diminutives.
4. **Contrast with English where it holds.** SVO "same as English, you already know this." Questions as "flip subject and verb." Where contrast breaks (cases, verb-final), switch to pattern teaching and say so.
5. **Difficulty forewarning plus reassurance.** Name the hard thing before it arrives ("noun genders are the enemy of every German student"), normalize the struggle, promise the payoff ("it gets easy by B2").
6. **Noun and article as one package.** Never teach a bare noun. der Tisch, die Katze, das Haus. Color coding in the UI: blue der, red die, green das.
7. **Capstone dialogue per unit.** A short dialogue integrating everything in the unit, functioning as an informal comprehension check before the formal unit test.
8. **Instant translation.** No German is ever left hanging untranslated at A1 and A2.

---

## 4. Core Features

### 4.1 Onboarding

Voice selection (samples grouped Warm / Neutral / Energetic, changeable in Settings), dialect preference (Hochdeutsch default, Berlin dialect mode with labeled dialect usage), then the multi-level placement check (Section 3.2), conducted in English.

### 4.2 Spaced Repetition Vocabulary System

**Algorithm:** FSRS. Card states in Firestore. Ratings Again / Hard / Good / Easy.

**Vocabulary sources, tiered by level:**
- `vocabforge-cefr-german` (32,000 CEFR-tagged words, DAFlex-corrected, Wiktionary articles)
- Goethe-Zertifikat B1 Wortliste (official ~2,400-word B1 scope, the authoritative ceiling for v2)
- `german-nouns` (Wiktionary-derived noun dataset for article verification)
- `Deutschland-Vocabulary-A1-B2` (thematic sets with example sentences)
- OpenSubtitles frequency data (spoken-German prioritization)

Every noun card carries its article, color-coded. Every card carries IPA, translation, and an example sentence.

### 4.3 Image-Based Vocabulary Identification

Unchanged in design from v1.3 (recognition tap then production, flat and 3D-style via Settings toggle, picturable words only), with one v2 change: **images are served through the MediaProvider adapter** (Section 7.4) and are placeholders until the final build phase.

### 4.4 The Four Skills

**4.4.1 Listening (Verstehen).** Graded audio per unit (30 to 90 seconds at A1/A2, up to 3 minutes at B1), describe-what-you-heard evaluation, segment replay, nuance explanation. B1 formats mirror Goethe Hören task types: short monologues (true/false plus multiple choice), a once-played narrative, a conversation, and a two-speaker discussion. Audio is served through the MediaProvider adapter.

**4.4.2 Reading (Lesen).** New as a first-class skill. Graded texts per unit generated at level by the Gemini brain: notes and signs at A1, emails and short articles at A2, blog posts, press reports, and matched advertisements at B1, mirroring Goethe Lesen task formats (richtig/falsch statements, multiple choice, statement-to-advertisement matching). Unknown-word tap-through adds words to the FSRS queue.

**4.4.3 Writing (Schreiben).** New skill. Progression: guided sentence construction from word tiles (A1), dictation from placeholder-then-real audio (A1/A2), short messages and informal emails of ~80 words with required content points (A2/B1, the Goethe Teil 1 format), and opinion texts on a prompt (B1, Goethe Teil 2 format). The Gemini brain corrects every submission with error categorization (gender, case, ending, order, spelling) that feeds the grammar mistake log and the difficulty-weighting engine.

**4.4.4 Speaking (Sprechen).** The pronunciation echo loop, voice dialogue scenarios, and at B1 the Goethe Sprechen formats: planning something together, giving a short presentation, and answering questions on it. Runs on Gemini Live through the MediaProvider adapter (placeholder mode uses text plus browser speech during the build).

### 4.5 Dialogue Scenarios

The six A1/A2 scenarios from v1 (café, U-Bahn, introductions, directions, Supermarkt, doctor) plus B1 additions: apartment viewing and Anmeldung, workplace small talk and meetings, complaint and return, phone appointment, discussing news and opinions, Behörde interactions. Inline corrections during, full correction summary after, both feeding the grammar log.

### 4.6 Assessment and Scoring Engine

The heart of v2. Modeled on the Goethe module system.

**Unit tests.** Every unit ends with a scored test covering all four skills proportionally to what the unit taught. Items are auto-generated by the Gemini brain from the unit's content, scored 0 to 100 per skill. **60% per skill passes**, matching Goethe convention. Failing a skill triggers targeted remediation exercises, then a retake of that skill's section only.

**Spaced retests.** Passing a unit does not close it. Retest items from passed units are woven into warm-ups and scenarios on an FSRS-style schedule (7, 14, 30, 60 days). A retention score per unit decays if retests are failed, and a decayed unit resurfaces remediation in the daily plan. This is the mechanism that makes progress mean retention rather than completion.

**Level gates.** Moving from A1 to A2 (and A2 to B1) requires a level exam in the four-module Goethe format, all modules at 60%+, plus a minimum retention score across the level's units. The B1 exit exam is a full Goethe-Zertifikat B1 simulation built from the official model-set structure.

**Growth analytics.** Per-session report (recall rate, new words, image-ID accuracy, per-skill scores, errors by category). Weekly summary (level bar, top five recurring error patterns with fixes, retention curve, streak, next-week focus). Level dashboard (per-skill trajectory, hard-area accuracy trends: genders, cases, endings, order).

### 4.7 Progress Reports

As in v1.3, extended with the per-skill and retention metrics above.

---

## 5. Knowledge Sources and Data References

Refreshed July 2026. These inform seed data, curriculum, and assessment design; they are not fetched at runtime.

### 5.1 Curriculum, CEFR, and Assessment

| Source | URL | Use |
|--------|-----|-----|
| Goethe-Institut CEFR Level Guide | https://www.goethe.de/en/spr/kur/stu.html | Level descriptors A1 to C2 |
| Goethe-Zertifikat B1 practice materials | https://www.goethe.de/en/spr/prf/ueb/pb1.html | Official model exams, all four modules, the assessment blueprint |
| Goethe B1 exam terms (Durchführungsbestimmungen) | https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_B1.pdf | Module scoring: 30 items Lesen/Hören, 100 points per module, 60% pass |
| Goethe-Zertifikat B1 Wortliste | https://www.goethe.de/pro/relaunch/prf/en/Goethe-Zertifikat_B1_Wortliste.pdf | Official B1 vocabulary scope (~2,400 words) |
| Deutsch im Blick (Open Textbook) | https://coerll.utexas.edu/dib/ | Open A1/A2 curriculum reference |
| Deutsche Welle, Nicos Weg | https://learngerman.dw.com | Free structured A1 to B1 video course, unit sequencing reference |
| UniversalCEFR dataset | https://github.com/UniversalCEFR | Multilingual CEFR-labeled learner texts incl. German, for writing-assessment calibration |

### 5.2 Vocabulary Datasets

| Source | URL | Use |
|--------|-----|-----|
| vocabforge-cefr-german | https://github.com/Adityav20/vocabforge-cefr-german | 32,000 CEFR-tagged words, DAFlex-corrected |
| german-nouns (Wiktionary-derived) | https://github.com/gambolputty/german-nouns | Noun article verification dataset |
| Deutschland-Vocabulary-A1-B2 | https://github.com/Hazrat-Ali9/Deutschland-Vocabulary-A1-B2 | Thematic word lists with sentences |
| awesome-german vocabulary hub | https://github.com/awesome-german/vocabulary | Curated index: frequency decks, 4000 sentences with audio, picture decks |
| CEFRLex / DAFlex | https://cefr-lex.eu | Official CEFR lexical resource for German |
| OpenSubtitles Frequency List | https://invokeit.wordpress.com/frequency-word-lists/ | Spoken-frequency prioritization |

### 5.3 Spaced Repetition

| Source | URL | Use |
|--------|-----|-----|
| FSRS4Anki | https://github.com/open-spaced-repetition/fsrs4anki | Algorithm reference |
| ts-fsrs | https://github.com/open-spaced-repetition/ts-fsrs | TypeScript implementation used in the build |
| Anki Revlogs 10K | https://huggingface.co/datasets/open-spaced-repetition/anki-revlogs-10k | Validation data |

### 5.4 Learner-Challenge Research (difficulty weighting inputs)

| Source | URL | Finding used |
|--------|-----|-----|
| Olesen Tuition, Top 10 German grammar hurdles A1 to B2 | https://www.olesentuition.co.uk/single-post/top-10-german-grammar-hurdles-a1-b2-and-how-to-overcome-them | Gender memorization with article-as-package and color coding; -ung/-heit/-keit and -chen/-lein gender patterns; case system as the most notorious feature |
| Learn German Online, mistakes and problem areas | https://www.learngermanonline.org/mistakes-and-problems/ | Grammar, specifically genders plus cases plus declension, is the top error source for English speakers |
| GermanPod101 grammar overview | https://www.germanpod101.com/blog/2021/03/18/german-grammar-overview/ | Adjective endings and articles hardest because they vary by both case and gender simultaneously |
| italki, hardest parts for English speakers | https://www.italki.com/en/article/1076/5-hardest-parts-of-the-german-language-for-native-english-speakers | Prioritize pronoun declension (mich/mir, dich/dir) over noun declension for daily usefulness; separable verbs and word order as core hurdles |
| Deutschwunder, is German hard | https://deutschwunder.com/blog/is-german-hard-to-learn | Consistent struggle areas: gender, four cases, adjective endings; German is medium difficulty (FSI ~750 hours) with a Germanic head start |
| Lingoda, German difficulty | https://www.lingoda.com/blog/en/is-german-hard-to-learn/ | Genders, cases, verb position as the three named barriers; plural nouns always take die |

### 5.5 Voice, Images, and Build Tooling

| Source | URL | Use |
|--------|-----|-----|
| Gemini API docs (text) | https://ai.google.dev/gemini-api/docs | Runtime brain integration |
| Gemini Live API docs | https://ai.google.dev/gemini-api/docs/live-api | Voice pipe: barge-in, VAD, transcription, de-DE |
| Gemini models overview | https://ai.google.dev/gemini-api/docs/models | Verify current model strings at build |
| Firebase docs | https://firebase.google.com/docs | Firestore, Auth (v1.1), Cloud Run |
| Claude Code docs | https://docs.claude.com/en/docs/claude-code | Build environment |

---

## 6. Difficulty-Weighted Curriculum

The platform spends intensity where the research says learners fail. Each hard area gets a weight that multiplies its practice frequency, retest frequency, and remediation priority.

| Area | Weight | Treatment |
|------|--------|-----------|
| Noun genders and articles | **Intensive (3x)** | Article taught as part of every noun from day one, color-coded UI (blue der, red die, green das). Daily micro-drills. Gender patterns taught explicitly (-ung/-heit/-keit feminine, -chen/-lein neuter, plurals always die), with the honest framing that most genders must be memorized. Dedicated gender retests every unit. Forewarning script: named as the hardest part, normalized, payoff promised. |
| Case system (Akkusativ, Dativ, Genitiv) | **Intensive (3x)** | Progressive introduction: Akkusativ late A1, Dativ mid A2, Genitiv B1. Pronoun declension (mich/mir, dich/dir, ihn/ihm) prioritized over noun declension for daily usefulness. Case drills embedded in scenarios, not just tables. Case-error categorization in every writing correction. |
| Adjective endings | **Intensive (3x, B1 focus)** | Deferred until gender and case are stable, then drilled hard at B1 since endings depend on both. Pattern-first teaching (three tables collapsed into decision rules), exceptions isolated. |
| Word order (V2, verb-final, separable verbs) | **High (2x)** | V2 from A1 unit 1 (contrast: flip subject and verb). Separable verbs at A2 with bracket visualization. Verb-final subordinate clauses at B1 with heavy production practice. |
| Pronunciation (ch, ü/ö/ä, r, ß) | **High (2x)** | Echo drills from day one in the speaking loop. The ich/Buch two-sound ch distinction taught explicitly. |
| Plural formation, compounds | **Standard (1x)** | Pattern extraction with exception lists. |

Weights are data-driven at runtime too: if the learner's own error log shows a different distribution, the curriculum builder shifts weight toward their actual weaknesses.

---

## 7. Build Configuration and Technical Architecture

### 7.1 Roles

| Role | Occupant |
|------|----------|
| Builder (writes the code) | **Claude Fable 5 via Claude Code**. Does not run inside the shipped app. |
| Runtime brain (tutoring, corrections, assessment scoring, curriculum and content generation) | **Gemini text models**. Chosen for token economics: the platform makes very frequent runtime calls, and Gemini's per-token cost keeps that sustainable. Fast model for routine turns, high-thinking Gemini escalation for complex grammar analysis, writing assessment, and weekly pattern reports. |
| Voice | **Gemini Live API** (de-DE), behind the MediaProvider adapter |
| Images | **Nano Banana 2**, behind the MediaProvider adapter |
| Data | **Firebase Firestore**; Cloud Run deployment |

### 7.2 Stack Decisions

| Choice | Decision | Rationale |
|--------|----------|-----------|
| Frontend | Next.js | Server-side key handling, one mental model, matches the builder's conventions |
| Backend | Node.js + Firebase (Firestore, Cloud Run) | Google's recommended stack, retained by explicit decision |
| Spaced repetition | ts-fsrs, states in Firestore | Standard, validated |
| Auth (v1) | Open, no login | Free testing; Firebase Auth at v1.1 with locked-down rules |
| API keys | Env vars only, server-side only | Gemini keys supplied by the owner at media-generation time and runtime; never in the repo, never client-side |

### 7.3 Build Sequencing (the governing principle)

**The app is built and fully testable end to end before any real media exists.** Speed comes from decoupling, not from skipping. Three rules enforce it:

1. All media access goes through one adapter (7.4). No component calls Gemini image or audio APIs directly.
2. Placeholders are functional, not cosmetic (7.5). Every flow is exercisable in placeholder mode.
3. Media generation is a standalone final phase (7.6) with idempotent, resumable batch scripts.

### 7.4 MediaProvider Adapter

A single interface with two implementations, switched by config:

```
interface MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset>
  getAudio(clipId: string): Promise<AudioAsset>
  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession>
}
```

- `PlaceholderProvider`: build-time implementation
- `GeminiProvider`: post-build implementation (Nano Banana 2, Gemini TTS/Live)

Swapping providers is one config change. No scattered TODOs.

### 7.5 Placeholder Specification

- **Images:** generated SVG tiles showing the German word on a colored background, styled differently for flat vs. render so the Settings toggle is testable. Deterministic from the word, so caching paths are exercised.
- **Lesson audio:** browser SpeechSynthesis with de-DE voice where available, otherwise a silent clip with always-visible captions, so listening flows, replays, and dictation are all testable.
- **Voice sessions:** text-mode fallback with browser speech recognition where available, so scenario logic, corrections, and scoring run before Gemini Live is wired.
- Placeholder assets are keyed identically to real assets (word plus style; clipId), so the swap requires zero data migration.

### 7.6 Media Generation Scripts (final phase)

- `scripts/generate-images.ts`: reads picturable vocabulary from Firestore, calls Nano Banana 2 with the owner's key from env, writes assets keyed word plus style, flips nothing until told.
- `scripts/generate-audio.ts`: reads lesson clips and vocabulary pronunciations, generates native audio via Gemini, writes assets keyed by clipId.
- Both scripts: **idempotent** (skip existing assets), **resumable** (a failed batch continues where it stopped), **batched per level** (A1 first; A2 and B1 batches run when the learner approaches those levels, avoiding upfront generation of 2,400+ words of media).
- Final step: switch config from PlaceholderProvider to GeminiProvider. The app itself does not change.

### 7.7 Engineering Quality (build-time, not a learner feature)

The builder ships automated tests alongside the app: unit tests for FSRS scheduling, scoring math, gate logic, and the adapter contract; integration tests for the lesson flow and assessment engine in placeholder mode. "Don't be sloppy" is enforced as: no direct media API calls outside the adapter, no hardcoded model strings (config only), no untested scoring logic, and lint plus typecheck green before every phase is called done.

### 7.8 Caveats

- **Open access in v1:** Firestore on open test rules until v1.1 auth. Single-user progress document until then.
- **Model-string volatility:** verify current Gemini text, Live, and Nano Banana identifiers at build time.
- **Firestore vs. Postgres:** unchanged from v1.3; migrate only if the platform outgrows personal use.

---

## 8. Out of Scope (v2)

- Offline caching / PWA
- Auth and accounts (v2.1 milestone, not permanently out)
- B2 and above content
- Nano Banana Pro 4K imagery; rotatable 3D models
- Group, social, or multi-learner features
- Native mobile apps
- Human tutor marketplace or live human sessions

---

## 9. Phased Delivery Plan (build-sequenced, media last)

### Phase 0: Foundation (Week 1)
- [ ] Repo, CLAUDE.md, conventions; PRD v2 and system prompt v2 in docs/
- [ ] Next.js scaffold, Firebase connected (open test rules)
- [ ] Firestore schema: units, vocabulary, FSRS states, per-skill scores, retention scores, grammar log, media asset references
- [ ] MediaProvider interface plus PlaceholderProvider
- [ ] Engineering test harness (unit plus integration scaffolding)

### Phase 1: Curriculum and Content Core (Weeks 2 to 3)
- [ ] A1 to B1 unit structure seeded (18 units, themes, grammar items)
- [ ] Vocabulary seeded: A1 set fully, A2/B1 sets staged; articles verified against german-nouns; B1 ceiling matched to the Goethe Wortliste
- [ ] ts-fsrs queue logic with tests
- [ ] Placement check (multi-level)
- [ ] Daily lesson engine (five-step flow) in placeholder mode
- [ ] System prompt v2 wired as the Gemini brain's system instruction, one canonical copy

### Phase 2: Four Skills in Placeholder Mode (Weeks 4 to 6)
- [ ] Listening flows (placeholder audio, captions, replay, evaluation)
- [ ] Reading engine (level-graded generated texts, Goethe Lesen task formats, tap-to-queue words)
- [ ] Writing engine (tiles, dictation, 80-word emails, opinion texts; Gemini correction with error categorization)
- [ ] Speaking flows in text-fallback mode (echo loop logic, scenario dialogues, corrections)
- [ ] Image-ID exercise with placeholder SVG tiles; style toggle
- [ ] All 12 dialogue scenarios (6 A1/A2 plus 6 B1)

### Phase 3: Assessment Engine (Weeks 7 to 8)
- [ ] Unit test generator and per-skill scoring (0 to 100, 60% gates)
- [ ] Remediation and single-skill retake flow
- [ ] Spaced retest scheduler with retention scores and decay
- [ ] Level gate exams (four-module format); B1 exit as full Goethe simulation
- [ ] Growth analytics: session report, weekly summary, level dashboard, hard-area trends
- [ ] Difficulty-weighting engine (static weights plus learner-error adaptation)

### Phase 4: Hardening (Week 9)
- [ ] Full placeholder-mode end-to-end pass of every flow
- [ ] Test suite green; lint and typecheck clean; adapter contract verified (zero direct media calls)
- [ ] Performance pass on lesson and assessment latency

### Phase 5: Media Generation (final, Week 10)
- [ ] Owner supplies Gemini API keys as env vars
- [ ] Run generate-images.ts, A1 batch (verify, then A2/B1 staged)
- [ ] Run generate-audio.ts, A1 batch (lesson clips, pronunciations)
- [ ] Wire Gemini Live for real voice sessions
- [ ] Flip config to GeminiProvider; regression pass on all media flows

### Phase 6 (v2.1): Auth
- [ ] Firebase Authentication, locked-down Firestore rules, per-user progress

---

## 10. Resolved Design Decisions (v2)

| # | Question | Decision |
|---|----------|----------|
| 1 | Scope | A1 to B1, 18 units, four skills including writing |
| 2 | Assessment model | Goethe-modular: per-skill 0 to 100, 60% gates, spaced retests with retention decay, level exams, B1 exit as full Goethe simulation |
| 3 | Difficulty weighting | Research-backed intensive coverage of genders/articles, cases, adjective endings, word order; adapts to the learner's own error log |
| 4 | Teaching method | Codified from expert-instructor analysis: echo, chunk-then-produce, pattern extraction with exception isolation, contrast with English, forewarning plus reassurance, noun-article package, capstone dialogues |
| 5 | Runtime brain | Gemini (token economics); fast model default, high-thinking escalation |
| 6 | Builder | Claude Fable 5 via Claude Code; builds the platform, does not run in it |
| 7 | Voice and images | Gemini Live and Nano Banana 2, owner-supplied keys, behind the MediaProvider adapter |
| 8 | Build sequencing | App first on functional placeholders; media generation scripts run last, idempotent and per-level batched |
| 9 | "Unit testing" | Curriculum unit tests (learner-facing); automated app tests also ship as engineering quality |
| 10 | Backend | Firebase/Firestore and Cloud Run retained; open v1, auth at v2.1 |
| 11 | Curriculum ordering | Thematic grouping within CEFR frequency order |

---

## 11. Working in Claude Code

### 11.1 Repo layout

```
german-platform/
  CLAUDE.md
  docs/
    german-tutor-prd-claude-code-v2.md
    german-tutor-system-prompt-v2.md
  lib/
    prompts/tutor-system-prompt.ts     # canonical, imported by all Gemini call paths
    media/provider.ts                  # MediaProvider interface
    media/placeholder-provider.ts
    media/gemini-provider.ts
    fsrs/                              # scheduling logic + tests
    assessment/                        # scoring, gates, retests + tests
    firebase.ts
  scripts/
    generate-images.ts
    generate-audio.ts
  app/                                 # Next.js App Router
```

### 11.2 Kickoff instruction

```
Read CLAUDE.md, docs/german-tutor-prd-claude-code-v2.md, and
docs/german-tutor-system-prompt-v2.md in full. /clarifyask

Start Phase 0 from the PRD. Scaffold Next.js with Firebase (open test rules),
build the Firestore schema for units, vocabulary, FSRS states, per-skill and
retention scores, the grammar log, and media asset references. Implement the
MediaProvider interface with the PlaceholderProvider first. Set up the test
harness. All media access must go through the adapter; no direct Gemini image
or audio calls anywhere. The Gemini runtime system prompt is embedded verbatim
from the system prompt file, one canonical copy. No auth in v1.
```

---

*PRD v2.0 (Claude Code edition). Built by Claude Fable 5 via Claude Code on Google's runtime stack (Firebase/Firestore, Gemini brain, Gemini Live voice, Nano Banana 2 images). Placeholders during build; media generation last. v1 documents retained as history.*
