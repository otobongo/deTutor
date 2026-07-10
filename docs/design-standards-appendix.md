# Design standards appendix (application rules)

Companion to docs/design-system.md (the authority; this file never overrides
it). These are the concrete application rules the app follows, established
during the 2026-07-10 owner-directed standards pass.

## Primitives (app/components/ui.tsx)

- **Button**: `primary` (filled bg-action, one per view wherever possible),
  `secondary` (outlined), `ghost` (text-weight, for tertiary actions).
  Sizes: `md` (44px min touch target, the default), `sm` (dense inline
  contexts only, 36px). Never hand-write button classes in pages.
- **ButtonLink**: navigation that sits in an action row renders as a
  secondary (or primary) button but stays an anchor semantically. Links
  inside prose stay plain underlined links.
- **ActionRow**: the standard in-flow action cluster at the end of content.
  Primary action first (left), secondary beside it, gap-3, wraps on narrow
  screens. No sticky bars (owner decision).
- **ProgressBar**: gold highlight fill (`--highlight-date-color`) for
  learning progress, neutral for system progress. A text twin (count or
  percent) always sits near the bar.
- **StatusChip**: `success` tint for done/learned, `accent` (gold) for
  grades and active states, neutral otherwise. The chip text carries the
  meaning; the tint only reinforces it.

## Color, sparingly

Accents come only from the existing token palette: the gold highlight family
for progress and grades, success green for completed states, article colors
for der/die/das (pedagogy, mode-aware), error/info/warning for their
semantic roles. Rules:

1. At most one accent family per card or row.
2. Color never carries meaning alone; every accent has a text or shape twin.
3. The High Contrast theme flattens accents to grayscale by design; nothing
   may become ambiguous there.

## Layout: web is not stretched mobile

- Desktop (md+) composes side-by-side zones (word workspace: focus and
  production left, context and neighborhood right; shelves in 2-3 column
  grids; forms in labeled two-column sections where natural).
- Mobile composes stacked, full-width touch targets, content-first order.
- Blocks that arrive asynchronously append below or beside existing content,
  never shifting interactive controls (CLS budget 0.1 is CI-enforced).
- Fluid-by-count: a single item in a collection spans full width; two or
  more arrange as columns at sm+.

## Defaults over forced choices

Onboarding asks nothing it can default: voice `warm-1`, dialect
`hochdeutsch`, image style `mixed`, theme follows the system on first visit.
Every preference lives in Settings, changeable any time, with its default
labeled.

## Navigation

Header: wordmark plus five links (Today, Learn, Practice, Progress,
Settings), active page marked by ink color plus an underline offset (not
color alone). Theme and mode controls live in Settings, not the header.
