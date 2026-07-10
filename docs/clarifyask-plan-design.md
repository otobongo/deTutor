# App-wide design standards pass

Owner-aligned plan (2026-07-10, /clarifyask loop).

## Understanding

Full-app audit and cleanup to one consistent, accessible design language per
docs/design-system.md, with specialist subagents auditing and Sonnet workers
migrating, while Fable 5 designs primitives, hard layouts, and integrates.
Plus: onboarding slims to defaults (no forced voice choice), all preferences
(voice, dialect, image style, theme, mode) live in Settings with defaults,
and the navigation gets simple and clean.

## Plan

1. Shared primitives (Button, ButtonLink, action row, chip, progress bar,
   card patterns) with sparing accent rules from existing tokens, documented
   in docs/design-standards-appendix.md.
2. Onboarding becomes welcome + placement only; defaults applied (voice
   warm-1, dialect Hochdeutsch, image style mixed, theme follows system).
   Settings gains voice samples plus theme and mode controls. Header nav
   reduces to wordmark + links with a clear active state.
3. Parallel subagent audits: frontend design (hierarchy, spacing, layout,
   responsive structure) and accessibility (WCAG AA, semantics, focus,
   touch targets), code-level, producing a findings list.
4. Sonnet workers migrate page batches to the primitives (disjoint files).
5. Fable: desktop-vs-mobile compositions for the word workspace and session
   steps, accent placement, audit arbitration, full CI, both themes and
   modes verified visually, board update, merge, push.

## Assumptions

- Colors only from existing tokens; High Contrast stays grayscale; color
  never carries meaning alone.
- Action rows in-flow (no sticky bars); primary left, secondary beside.
- data-testids stay stable; e2e helper updated for the new onboarding flow.

## Edge cases acknowledged

- CLS budget on session steps; monochrome accent flattening; conflicting
  audit findings arbitrated by the design system's own rules.

## Out of scope

- New palette entries, sticky mobile bars, A2/B1 content, auth.
