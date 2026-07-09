@AGENTS.md

# German Learning Platform (A1 to B1)

A comprehensive German learning platform taking an English-speaking learner from zero to B1
across listening, reading, writing, and speaking. Progress is gated on demonstrated comprehension
and retention, not topic completion. Built by Claude via Claude Code; the runtime brain is Gemini.

## Stack

- Next.js (App Router) + TypeScript strict, npm
- Firebase Firestore (server-side access only, via `lib/firebase.ts`)
- Gemini text models (runtime brain), Gemini Live (voice), Nano Banana 2 (images)
- ts-fsrs for spaced repetition
- Vitest (unit), Playwright (integration), `npm run ci` is the health gate

## Sources of truth (read in this order before writing code)

1. `docs/german-tutor-engineering-strategy.md`: how to build. Prime Directives, conventions,
   testing and delivery standards, handoff protocol (Section 7). Binding on every issue.
2. `docs/german-tutor-prd-claude-code-v2.md`: what to build. Product source of truth.
3. `docs/german-tutor-implementation-plan.md`: which piece. 60 self-contained issues, GT-001
   to GT-603, with acceptance criteria and test cases. Definition of Done applies to every issue.
4. `docs/german-tutor-system-prompt-v2.md`: runtime content for the Gemini brain. Embedded
   verbatim via `lib/prompts/tutor-system-prompt.ts`. Not instructions for the builder.

`docs/board.md` is the issue ledger: status of every issue, deviations, and the current
state-of-the-build note. If board.md disagrees with the code, the code is the truth and
board.md must be corrected first.

## The adapter law (Prime Directive 1, verbatim)

> **The adapter is law.** All image, audio, and voice access goes through `lib/media`. If you
> find yourself importing a Gemini media endpoint anywhere else, stop; you are about to break
> the build's most important seam. The CI guard will catch you, but you should not need it to.

## Conventions summary (full text in the strategy doc)

- One Gemini text door: `lib/gemini/client.ts`, always carrying the canonical system prompt
  from `lib/prompts/tutor-system-prompt.ts`. Never fork the prompt.
- Model strings live only in `lib/config.ts`, which is also the only reader of `process.env`.
- TypeScript strict; no `any` without a written justification comment; Firestore access only
  through converters; closed unions for anything enumerable.
- Scoring, gates, FSRS, and retention math are pure functions with unit tests. No I/O in scoring.
- Placeholders are production code, written and tested with the same care as real providers.
- Domain vocabulary is fixed: learner, unit, skill (listening | reading | writing | speaking),
  card, scenario, retest, retention. Do not invent synonyms.
- Files kebab-case, types PascalCase, functions camelCase. Comments explain why, not what.
- No dead code, no commented-out blocks, no TODO without an issue ID (`TODO(GT-xxx): ...`).
- Branch per issue (`gt-xxx-short-slug`), conventional commits with the issue ID, board.md
  updated when an issue changes status. Nothing is done without its tests.

## Handoff protocol

New agent taking over? Follow Section 7 of the engineering strategy exactly: read the docs in
order, trust board.md as ledger, run `npm run ci` and fix red before building, resume in-progress
branches against their acceptance criteria, do not refactor on arrival, and leave a dated
state-of-the-build note at the top of board.md when you stop.
