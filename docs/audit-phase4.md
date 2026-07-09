# Phase 4 Integrity Audit (GT-402)

**Date:** 2026-07-09. **Auditor:** Claude (Fable 5), builder.
**Method:** the four CI guards plus manual grep sweeps over `app/`, `lib/`, `db/`, `scripts/`
(test files excluded where noted). Every finding is either clean or remediated in this issue.

## 1. Adapter contract (the adapter law)

`npm run guards` clean: no Gemini media endpoint or SDK import outside `lib/media/` and
`lib/gemini/`; no direct imports of provider internals outside `lib/media/`. The guard suite
itself is covered by planted-violation tests (tests/unit/guards.test.ts). The guard has caught
two real violations during the build (a test importing provider internals at GT-215; planted
fixtures at GT-002), which is evidence it works, not just that it exists.

**Verdict: clean.**

## 2. Model strings

Grep for `gemini-<digit>`, `gemini-(pro|flash)-latest`, `nano-banana` outside `lib/config.ts`
(excluding the guard's own pattern definitions and tests): zero hits. Model identifiers exist in
exactly one file and are env-overridable. The identifiers were re-verified live on 2026-07-09
after `gemini-2.5-flash` began returning sunset 404s (deviation logged in board.md).

**Verdict: clean.**

## 3. System prompt import graph

`TUTOR_SYSTEM_PROMPT` is exported by `lib/prompts/tutor-system-prompt.ts` and imported by
exactly one non-test module: `lib/gemini/client.ts`. Every Gemini text call attaches it; scenario
behavior is injected as a context layer (`ChatOptions.context`), never a fork. The byte-equality
sync test against `docs/german-tutor-system-prompt-v2.md` runs in CI.

**Verdict: clean; one source, one importer.**

## 4. Converter-typed Firestore access

All persistence flows through the `DocumentStore` seam (Firestore or dev-file), and every write
goes through a zod converter or schema parse. Read-side sweep of `.collection(` call sites:

| Site | Read validation | Write validation |
|------|-----------------|------------------|
| app/actions/lesson.ts | safeParse (profile, sessions, retentions) | lessonSessionConverter |
| app/actions/settings.ts | safeParse | learnerProfileConverter |
| app/actions/assessment.ts | safeParse (profile, unitProgress) | unitProgressConverter |
| lib/assessment/scoring.ts | **remediated**: prior attempts were cast, now skillScoreSchema.safeParse | skillScoreConverter |
| lib/exercises/reading-tasks.ts | **remediated**: same pattern, same fix | skillScoreConverter |
| lib/placement/persist.ts | n/a (write-only) | learnerProfileConverter, skillScoreConverter |
| db/seed/* | n/a (write-only) | unit/grammarItem/scenario/vocabularyWord converters |

**Verdict: two findings, both remediated in this issue; sweep now clean.**

## 5. process.env

Grep outside `lib/config.ts`: zero hits in app/lib/db/scripts (the guard also enforces this on
every CI run). `scripts/load-env.ts` populates the environment for tsx entry points but does not
read it.

**Verdict: clean.**

## Standing enforcement

Sweeps 1, 2, and 5 run on every CI invocation via `scripts/guards/run-guards.mjs`. Sweep 3 is
enforced by the prompt sync test. Sweep 4's write side is structural (converters are the only
write path); its read side is covered by schema safeParse at every current call site and should
be re-swept at the next phase gate.
