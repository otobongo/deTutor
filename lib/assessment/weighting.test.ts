import { describe, expect, it } from 'vitest';
import { seedGrammarItems } from '@/db/seed/units';
import type { GrammarItem } from '@/lib/db/curriculum';
import { selectGrammarItem } from '@/lib/lesson/engine';
import {
  adaptWeights,
  areaOfCategory,
  areaOfGrammarItem,
  BASE_WEIGHTS,
  effectiveWeightOf,
  MAX_WEIGHT,
  type AreaWeights,
} from './weighting';

const gender = seedGrammarItems.find((item) => item.id === 'noun-genders-articles') as GrammarItem;
const standard = seedGrammarItems.find((item) => item.id === 'teen-numbers-pattern') as GrammarItem;

const pattern = (category: 'case' | 'gender') => ({
  category,
  item: 'x',
  occurrences: 3,
});

describe('difficulty-weighting engine (GT-311)', () => {
  it('maps grammar items and error categories to areas', () => {
    expect(areaOfGrammarItem(gender)).toBe('gender');
    expect(areaOfGrammarItem(standard)).toBe('standard');
    expect(areaOfCategory('spelling')).toBe('pronunciation');
    const dativ = seedGrammarItems.find((item) => item.id === 'dativ-pronouns') as GrammarItem;
    expect(areaOfGrammarItem(dativ)).toBe('case');
  });

  it('over 100 selections, gender drills appear ~3x the 1x baseline', () => {
    const items = [gender, standard];
    const picks = new Map<string, number>();
    const weightOf = effectiveWeightOf(BASE_WEIGHTS);
    for (let day = 0; day < 100; day += 1) {
      const at = new Date(Date.UTC(2026, 6, 9) + day * 86_400_000);
      const pick = selectGrammarItem(items, [], at, weightOf);
      picks.set(pick.id, (picks.get(pick.id) ?? 0) + 1);
    }
    const heavy = picks.get('noun-genders-articles') ?? 0;
    const light = picks.get('teen-numbers-pattern') ?? 0;
    expect(heavy / light).toBeGreaterThan(2.5);
    expect(heavy / light).toBeLessThan(3.5);
  });

  it('recurring case errors raise the case weight within bounds', () => {
    const adapted = adaptWeights(BASE_WEIGHTS, [pattern('case')], []);
    expect(adapted.case).toBe(4);
    expect(adapted.gender).toBe(BASE_WEIGHTS.gender);
    // Repeated adaptation caps at MAX_WEIGHT.
    let weights: AreaWeights = adapted;
    for (let round = 0; round < 5; round += 1) {
      weights = adaptWeights(weights, [pattern('case')], []);
    }
    expect(weights.case).toBe(MAX_WEIGHT);
  });

  it('mastered areas decay toward baseline but intensive areas never drop below their floor', () => {
    const raised: AreaWeights = { ...BASE_WEIGHTS, case: 5, order: 3 };
    const once = adaptWeights(raised, [], ['case', 'order', 'gender']);
    expect(once.case).toBe(4);
    expect(once.order).toBe(2);
    // Gender was already at its floor: decay cannot push it lower.
    expect(once.gender).toBe(BASE_WEIGHTS.gender);
    let weights = once;
    for (let round = 0; round < 5; round += 1) {
      weights = adaptWeights(weights, [], ['case', 'order']);
    }
    expect(weights.case).toBe(BASE_WEIGHTS.case);
    expect(weights.order).toBe(BASE_WEIGHTS.order);
  });

  it('adapted weights shift the lesson engine selection measurably', () => {
    const items = [gender, standard];
    const boosted: AreaWeights = { ...BASE_WEIGHTS, standard: 3 };
    const picks = new Map<string, number>();
    for (let day = 0; day < 60; day += 1) {
      const at = new Date(Date.UTC(2026, 6, 9) + day * 86_400_000);
      const pick = selectGrammarItem(items, [], at, effectiveWeightOf(boosted));
      picks.set(pick.id, (picks.get(pick.id) ?? 0) + 1);
    }
    const heavy = picks.get('noun-genders-articles') ?? 0;
    const light = picks.get('teen-numbers-pattern') ?? 0;
    expect(heavy).toBe(light);
  });
});
