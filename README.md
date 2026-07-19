# deTutor: German Learning Platform (A1 to B1)

A comprehensive German learning platform that takes an English-speaking learner from zero to B1
across all four skills: listening, reading, writing, and speaking. Progress is gated on
demonstrated comprehension and retention, not topic completion. The areas learners actually
struggle with (genders, cases, adjective endings, word order) get disproportionately intensive
coverage.

Built by Claude via Claude Code. The runtime brain is Gemini.

## Status

| Phase               | Scope                                                                                | State |
| ------------------- | ------------------------------------------------------------------------------------ | ----- |
| 0 Foundation        | Scaffold, config, schemas, media adapter, placeholders, CI                           | Done  |
| 1 Curriculum core   | 18-unit seed, vocabulary corpus, FSRS, placement, Gemini client, lesson engine       | Done  |
| 2 Four skills       | Vocab/echo, image ID, listening, reading, writing, speaking, 12 scenarios, app shell | Done  |
| 3 Assessment engine | Unit tests, gates, retention decay, level exams, analytics, weighting                | Next  |
| 4 Hardening         | Full e2e pass, integrity audit, performance, accessibility                           | Open  |
| 5 Media generation  | Real images (Nano Banana 2), audio and voice (Gemini)                                | Open  |
| 6 Auth (v2.1)       | Firebase Auth, locked-down rules                                                     | Open  |

`docs/board.md` is the issue ledger with the current state-of-the-build note.

## Stack

- Next.js (App Router) + TypeScript strict, npm
- Firestore or Postgres for learner state (server-side only; a local dev-file store runs
  everything without credentials)
- Gemini text models (runtime brain), Gemini Live (voice, Phase 5), Nano Banana 2 (images, Phase 5)
- ts-fsrs for spaced repetition
- Vitest (unit and component), Playwright (journeys)

## Getting started

```bash
npm install
cp .env.local.template .env.local   # then fill in your keys (see below)
npm run ci                          # lint, format, typecheck, guards, tests, e2e
npm run dev                         # http://localhost:3000
```

The app is fully walkable without any real keys: media is served by the placeholder provider and
learner state lives in a local dev-file store. Brain-dependent features (listening evaluation,
scenario turns, writing correction) show honest recoverable states until a Gemini key is set.

### Environment

Copy `.env.local.template` to `.env.local` (gitignored) and paste your values:

- `GEMINI_API_KEY`: from Google AI Studio. Activates evaluations, corrections, scenarios,
  and content generation.
- `FIREBASE_*`: a service account from your Firebase project. Then set `DATA_STORE=firestore`
  to switch learner state from the local dev file to Firestore. No data shape changes.
- `DATABASE_URL`: a Postgres connection string. With `DATA_STORE=postgres`, learner state lives
  in a database you host instead of Firestore — the adapter creates its own table on first use,
  so an empty database is enough, and the `FIREBASE_*` values can stay dummy. No data shape
  changes either way.
- Model identifiers default in `lib/config.ts` and can be overridden per env var.

### Seeding (needs Firestore or runs against the emulator)

```bash
npm run seed:curriculum     # 18 units, 34 grammar items, 12 scenarios
npm run seed:vocab          # A1 set (650 words); -- --level A2|B1 stages later bands
```

The vocabulary corpus is rebuilt from source datasets with
`bash scripts/download-datasets.sh && npm run ingest:vocab`. Every noun article is verified
against the german-nouns dataset; nothing unverified is ever seeded.

## How the build works

Read these in order before writing code; they are binding:

1. `docs/german-tutor-engineering-strategy.md`: Prime Directives, conventions, Definition of Done
2. `docs/german-tutor-prd-claude-code-v2.md`: product source of truth
3. `docs/german-tutor-implementation-plan.md`: 60 self-contained issues (GT-001 to GT-603)
4. `docs/german-tutor-system-prompt-v2.md`: runtime content for the Gemini brain (embedded verbatim)

Hard boundaries, all machine-checked in CI (`npm run guards`):

- **The adapter is law.** All image, audio, and voice access goes through `lib/media`.
- Model strings live only in `lib/config.ts`, the sole reader of `process.env`.
- One Gemini text door (`lib/gemini/client.ts`) always carrying the canonical system prompt.
- Client components never import server config or Firebase.
- Scoring, gates, FSRS, and retention math are pure functions with unit tests.

## Testing

```bash
npm run test        # Vitest: unit and component (jsdom) tests
npm run test:e2e    # Playwright journeys in placeholder mode
npm run ci          # the full gate; nothing merges red
```

## License

Private project. All rights reserved.
