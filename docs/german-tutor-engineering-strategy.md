# German Learning Platform, Engineering Strategy
# Written by Claude Fable 5, acting as Principal Engineer, for any agent that builds on or after me

**Version:** 1.0  
**Companion to:** `german-tutor-prd-claude-code-v2.md` and `german-tutor-implementation-plan.md`  
**Audience:** Opus-class, Sonnet-class, or any future coding agent taking over any part of this build. Also useful to a human engineer.

This document exists because agents change and code should not notice. If you are reading this as my successor: the PRD tells you what to build, the implementation plan tells you which piece, and this document tells you how, so that the codebase reads as if one careful engineer wrote all of it.

---

## 1. Prime Directives

These are not preferences. Breaking any of these is a defect, regardless of whether the feature works.

1. **The adapter is law.** All image, audio, and voice access goes through `lib/media`. If you find yourself importing a Gemini media endpoint anywhere else, stop; you are about to break the build's most important seam. The CI guard will catch you, but you should not need it to.
2. **One brain, one prompt, one door.** Every Gemini text call goes through `lib/gemini/client.ts`, and every call carries the canonical system prompt from `lib/prompts/tutor-system-prompt.ts`. Never inline a second prompt, never fork the prompt per feature. Feature-specific behavior is injected as the scenario/context layer, not by editing the identity.
3. **Model strings live in config.** `lib/config.ts` is the only place a model identifier may appear. Model names rotate; grep-and-replace across a codebase is how sloppy builds die.
4. **Typed everything.** TypeScript strict. No `any` without a written justification comment. Firestore access only through converters. Closed unions for anything enumerable (error categories, skills, levels, tiers, provider names). If the compiler cannot see a mistake, a test must.
5. **Scoring math is pure and tested.** Anything that produces a score, a gate decision, an FSRS state, or a retention value is a pure function with unit tests. No I/O inside scoring logic, ever. A learner's progression must be auditable from inputs.
6. **Placeholders are production code.** The PlaceholderProvider is not a mock to be deleted. It is a permanent, tested implementation used in development forever. Write it with the same care as the Gemini provider.
7. **Nothing is done without its tests.** The Definition of Done in the implementation plan applies to every issue. A feature that works but has no tests is an unfinished feature.

---

## 2. Architecture Map (what talks to what)

```
app/ (Next.js App Router, UI only)
  └── calls lib/lesson, lib/assessment, lib/media, lib/fsrs via server actions / route handlers

lib/lesson/engine.ts        orchestrates sessions; the only composer of daily flow
lib/assessment/             scoring (pure), gates, retests, retention; no UI, no fetch
lib/fsrs/                   scheduler (pure) + queue; persistence at the edge only
lib/gemini/client.ts        the single Gemini text door; tiering; JSON-mode validation
lib/prompts/                one canonical system prompt + scenario context builders
lib/media/                  MediaProvider interface + placeholder + gemini implementations
lib/config.ts               the only reader of process.env; the only home of model strings
lib/firebase.ts             server-side init only
db/seed/                    versioned seed data + idempotent seed scripts
scripts/                    media generation (final phase); ingestion; never imported by app code
```

Dependency direction is one-way: `app` depends on `lib`; `lib` modules may depend on `lib/config` and each other downward, never on `app`. `scripts` may depend on `lib` but nothing depends on `scripts`.

---

## 3. Code Conventions

- **Language:** TypeScript strict everywhere, including scripts.
- **Naming:** files kebab-case, types PascalCase, functions camelCase, constants SCREAMING_SNAKE only for true constants. Domain vocabulary is fixed: use `learner` (not user), `unit`, `skill` (one of listening | reading | writing | speaking), `card` (FSRS), `scenario`, `retest`, `retention`. Do not invent synonyms; searchability is integrity.
- **Functions:** small, single-purpose. If a function needs a comment to explain what it does, split it or name it better. Comments explain why, not what.
- **Errors:** never swallow. Every catch either handles meaningfully, translates to a typed error from the taxonomy in `lib/gemini/client.ts` and friends, or rethrows. UI layers render categorized errors as recoverable states, never blank screens.
- **Async:** no floating promises (lint-enforced). Server actions validate inputs at the boundary with zod (or the schema layer already in place); trust nothing from the client.
- **State:** learner state lives in Firestore; ephemeral session state lives in the lesson engine's persisted session document (resumability is a feature, GT-108). No duplicate sources of truth.
- **UI:** components are presentational; logic lives in lib. The article color convention (blue der, red die, green das) is defined once as a token, and article identity is always also conveyed in text (accessibility, GT-404).
- **No dead code, no commented-out blocks, no TODO without an issue ID.** A TODO must read `TODO(GT-xxx): ...` or it does not merge.

---

## 4. Testing Standards

- **Unit (Vitest):** all pure logic: FSRS wrapping, scoring, gates, retention decay, weighting selection, queue ordering, converters, config validation. Test names describe behavior ("Again rating resets card to learning"), not implementation.
- **Integration (Playwright):** learner journeys in placeholder mode. The five Phase 4 journeys (GT-401) are the regression floor; add a journey when you add a flow.
- **Contract tests:** the MediaProvider event-shape contract runs against both providers (GT-503). The system-prompt sync check (GT-109) runs in CI. The adapter guard (GT-005) runs in CI.
- **AI-output tests:** Gemini JSON responses are schema-validated at runtime; tests assert the retry-once-then-categorized-error path with mocked malformed output. Never assert on exact generated prose; assert on schema, closed unions, and invariants (e.g., generated reading text length caps).
- **Coverage:** no numeric fetish, but every acceptance criterion in an issue maps to at least one test, and every bug fix lands with a regression test first.

---

## 5. Delivery Standards

- **Branch per issue:** `gt-xxx-short-slug`. One issue, one branch, one PR-equivalent.
- **Commits:** conventional style, scoped to the issue: `feat(gt-213): categorized writing correction engine`. The issue ID appears in every commit touching that issue. History must let a future agent reconstruct what happened and why.
- **An issue is closed when:** Definition of Done met (plan header), `npm run ci` green, docs updated if the issue changed schema, contracts, or conventions (schema.md, this document), and the issue's status recorded in `docs/board.md` (see Section 7).
- **Never batch unrelated changes.** If you find an unrelated bug while working an issue, file it as a new entry in board.md and fix it in its own branch unless it blocks you, in which case say so in the commit body.
- **Phase gates:** a phase is not done because its issues are merged; it is done when the phase's acceptance sweep (hardening checklist for Phase 4, regression for Phase 5) is green and recorded.

---

## 6. Model Dispatch Strategy

Issues carry a tier. Match agent capability to tier; do not send T1 work to a T3 agent to save cost, and do not burn T1 capacity on T3 work.

| Tier | Work | Agent class | Why |
|------|------|-------------|-----|
| T1 | Architecture, schemas, contracts (adapter, Gemini client), scoring and retention math, gates, security rules, integrity audits | Fable-class (or the strongest available) | Errors here propagate everywhere; these files are depended on by everything and changed rarely. Get them right once. |
| T2 | Engines with AI-evaluation logic (writing correction, listening evaluation, test generation, curriculum builder, scenario runtime), media scripts, auth | Opus-class | Complex behavior, multiple integration points, judgment about edge cases, but the contracts they sit on are already fixed. |
| T3 | UI flows, components, exercise variants, settings, dashboards, seed wiring, a11y and perf passes | Sonnet-class | Well-specified, contract-bounded work. The issue text plus this document is sufficient context. |

Rules for mixed capability:
- A lower-tier agent may read but must not modify T1 files (lib/media/provider.ts, lib/gemini/client.ts, lib/config.ts, lib/assessment scoring, lib/fsrs/scheduler.ts, firestore rules). If a T3 issue seems to require a T1 change, the correct move is to stop and flag it in board.md, not to make the change.
- Any agent may fix a typo-level defect anywhere, with a regression test.
- Escalation is cheap; rework is expensive. When in doubt about tier, escalate the question, not the code.

---

## 7. Agent Handoff Protocol

When a new agent (of any class) takes over, mid-phase or mid-issue:

1. **Read, in order:** CLAUDE.md, this document, the PRD v2, the implementation plan, `docs/board.md`, and `docs/schema.md`. Do not write code before finishing this list.
2. **board.md is the ledger.** It tracks every issue: status (open / in-progress / blocked / done), branch, owner note, and any deviations from the plan with their justification. If it disagrees with the code, the code is the truth and board.md must be corrected first.
3. **Verify the floor:** run `npm run ci`. If it is red, your first job is making it green, and the fix gets its own commit trail. Never build on a red floor.
4. **Resume in-progress work by reading its branch diff against the issue's acceptance criteria.** Finish or cleanly restart; never merge half-met criteria.
5. **Do not refactor on arrival.** New agents itch to restructure. Resist it. Conventions in this document override your defaults, even where your defaults are arguably better. Consistency beats local optimality; a codebase written in three dialects is worse than one written in one good-enough dialect. Propose convention changes as board.md entries; adopt them only at phase boundaries, applied everywhere at once.
6. **Deviations require a written trace.** If reality forces a departure from the PRD or the plan (an API changed, a model string died), record it: what, why, and which documents were updated. An undocumented deviation is a defect even when the code is correct.
7. **Leave the campsite better:** before ending a work session, board.md current, CI green, no uncommitted work, and a one-paragraph state-of-the-build note at the top of board.md dated and signed with your agent identity.

---

## 8. Working With the AI Runtime (Gemini) Without Making a Mess

- **Determinism first.** Prefer deterministic code over model calls wherever possible: scoring, gating, scheduling, selection are code, not prompts. The model teaches, evaluates language, and generates content; it never decides a score gate.
- **Schema or it did not happen.** Every JSON-mode call has a zod schema, one retry on parse failure, then a typed error. Never regex a model response.
- **Prompts are code.** Scenario and task prompts live in `lib/prompts/` as typed builders with tests on their inputs, not as string literals scattered in features.
- **Cost discipline.** Fast tier is the default; the escalation map (GT-110) is the only path to the deep tier. If you add a deep call site, add it to the map and note the justification.
- **Content invariants over content assertions.** Generated German is validated for level constraints (length caps, corpus-plus-stretch vocabulary) programmatically. You cannot unit-test prose quality, but you can test its envelope.

---

## 9. Security and Data Integrity

- Keys in env only, read only by `lib/config.ts`, never logged, never in the client bundle (tested, GT-002).
- v1 runs open by explicit product decision; that is a posture, not an oversight. It is recorded in the PRD and reversed at GT-601/602. Do not "helpfully" add auth early; do not widen the open surface either (no admin endpoints, no destructive routes without confirmation).
- Learner data writes go through the typed write paths (grammar log has one write path, GT-214). Ad-hoc writes from features are defects.
- Seeds and generation scripts are idempotent and resumable by contract. A script that can double-write on rerun does not merge.

---

## 10. Definition of Professional

The standard for this codebase, stated once so no agent has to guess:

A professional build here means a stranger-agent can clone the repo, read four documents, run one command to prove health, pick any open issue, and produce work indistinguishable in style and quality from everything already merged. Every number a learner sees is traceable to stored data. Every hard boundary (adapter, prompt, config, scoring purity) is enforced by CI, not by memory. Every deviation from plan is written down. Nothing is clever where it can be clear, and nothing is manual where it can be checked by a machine.

If you hold to this document, the learner will never know the builder changed. That is the goal.

*Engineering Strategy v1.0, authored by Claude Fable 5 as Principal Engineer for this build.*
