# Learn before testing: free-study curriculum with per-user progress

Owner-aligned plan (2026-07-10, /clarifyask loop). A1 scope.

## Understanding

A free-study Learn layer alongside the daily session, nothing gated:

1. Marking is learner-driven: open a word, read, recite, understand the context, mark it
   learned, flow to the next word until choosing to stop. Every marked word tracked per user.
2. No gating: Learn and Test both always open, both scored and graded.
3. Content: theme-mapped word groups (office and work, city, places, food, and so on) plus
   foundation structures explained first (numbers, pronouns, accusative, dative, and the other
   structures derived from the seeded A1 grammar items), each showing how they apply to words.
4. Design: every "words nearby" chip gets a play button; the vocabulary surface gets a
   deliberate two-column desktop layout and a purposeful stacked mobile layout.

## Plan

1. Seeds: db/seed/foundations.ts (curated study pages: sections, tables, corpus-word examples,
   scored self-check quiz) and db/seed/foundation-vocab.ts (numbers and pronouns as reviewable
   card entries, schema-validated; excluded from daily day-set selection).
2. Learner state: learnedWords and foundationProgress collections under the learner tree.
3. Pure engines: group mapping (corpus themes to friendly groups), progress percent plus grade
   bands (A 90+, B 75+, C 60+, D 40+, E below), quiz scoring.
4. Learn section: /learn overview (Foundations shelf first, then Word groups with progress
   bars), /learn/foundations/[topic] study pages, /learn/words/[group] mark-and-next flow
   reusing the word workspace (echo optional in free study).
5. Neighbor chips: play button via on-demand audio when a chip opens.
6. Responsive word workspace: two-column desktop, stacked mobile.
7. Marking a word introduces its FSRS card (joins warm-ups) and removes it from future "new
   vocabulary" day sets; unmarking allowed, the card stays.
8. Progress tab shows Learn progress (groups and foundations, percent and grade).
9. Nav gains Learn; axe and responsive checks cover the new pages.

## Assumptions

- A1 only; A2/B1 shown as locked outlines.
- Single learner profile now; moves per-account with Phase 6 auth unchanged.
- Foundations content lives in reviewable seed files; grades as percent plus A-E bands.
- Theme "general" words grouped as "Everyday essentials".

## Edge cases acknowledged

- Unmarking keeps the FSRS card.
- No literal office theme in the corpus: mapped and mergeable group names, owner-renameable.
- Numbers and pronouns are new curated seed content (Goethe corpus excludes them by design).
- Grading is per group and per level (units do not own words in the data model).

## Out of scope

- A2/B1 content, gating of any kind, multi-user auth, deployment.
