import type { GrammarErrorCategory } from '@/lib/db/learner';
import type { GrammarItem } from '@/lib/db/curriculum';
import type { RecurringPattern } from '@/lib/analytics/grammar-log';

// Difficulty-weighting engine (GT-311, PRD Section 6). Static research-backed
// weights are the floor; the learner's own error log shifts weight upward
// within documented bounds, and mastered areas decay back toward baseline,
// never below it for the intensive areas (or any area).

export const DIFFICULTY_AREAS = [
  'gender',
  'case',
  'ending',
  'order',
  'pronunciation',
  'standard',
] as const;
export type DifficultyArea = (typeof DIFFICULTY_AREAS)[number];

// PRD Section 6: 3x genders/articles, cases, adjective endings; 2x word
// order and pronunciation; 1x the rest. These are floors, never ceilings.
export const BASE_WEIGHTS: Readonly<Record<DifficultyArea, number>> = {
  gender: 3,
  case: 3,
  ending: 3,
  order: 2,
  pronunciation: 2,
  standard: 1,
};

export const MAX_WEIGHT = 5;

export type AreaWeights = Readonly<Record<DifficultyArea, number>>;

export function areaOfCategory(category: GrammarErrorCategory): DifficultyArea {
  switch (category) {
    case 'gender':
      return 'gender';
    case 'case':
      return 'case';
    case 'ending':
      return 'ending';
    case 'order':
      return 'order';
    case 'spelling':
      return 'pronunciation';
    case 'choice':
      return 'standard';
  }
}

const AREA_ID_MARKERS: ReadonlyArray<readonly [DifficultyArea, readonly string[]]> = [
  ['gender', ['gender', 'articles', 'plural']],
  ['case', ['akkusativ', 'dativ', 'genitiv', 'case', 'prepositions']],
  ['ending', ['adjective', 'ending']],
  ['order', ['v2', 'order', 'separable', 'verb-final', 'bracket', 'clauses']],
  ['pronunciation', ['pronunciation']],
];

export function areaOfGrammarItem(item: GrammarItem): DifficultyArea {
  for (const [area, markers] of AREA_ID_MARKERS) {
    if (markers.some((marker) => item.id.includes(marker))) return area;
  }
  return 'standard';
}

// Adaptation: +1 per area with a recurring error pattern (capped at
// MAX_WEIGHT); areas quiet in the window decay by 1 toward their baseline
// floor. Bounds are BASE_WEIGHTS[area] .. MAX_WEIGHT, always.
export function adaptWeights(
  current: AreaWeights,
  patterns: readonly RecurringPattern[],
  quietAreas: readonly DifficultyArea[],
): AreaWeights {
  const recurringAreas = new Set(patterns.map((pattern) => areaOfCategory(pattern.category)));
  const next: Record<DifficultyArea, number> = { ...current };
  for (const area of DIFFICULTY_AREAS) {
    if (recurringAreas.has(area)) {
      next[area] = Math.min(MAX_WEIGHT, current[area] + 1);
    } else if (quietAreas.includes(area)) {
      next[area] = Math.max(BASE_WEIGHTS[area], current[area] - 1);
    }
    // Invariant: never below the PRD floor, never above the cap.
    next[area] = Math.min(MAX_WEIGHT, Math.max(BASE_WEIGHTS[area], next[area]));
  }
  return next;
}

// Selection multiplier for the lesson engine: the effective weight of a
// grammar item is its area's adapted weight (falling back to the item's own
// seeded weight when equal areas differ in the seed).
export function effectiveWeightOf(weights: AreaWeights): (item: GrammarItem) => number {
  return (item) => weights[areaOfGrammarItem(item)];
}
