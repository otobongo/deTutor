import { describe, expect, it } from 'vitest';
import type { Level } from '@/lib/db/curriculum';
import { seedGrammarItems, seedUnits } from './units';
import { seedCurriculum, type SeedTarget } from './seed-curriculum';

const itemsById = new Map(seedGrammarItems.map((item) => [item.id, item]));

function unitsReferencing(fragment: string) {
  return seedUnits.filter((unit) => unit.grammarItemIds.some((id) => id.includes(fragment)));
}

describe('unit structure seed (GT-101)', () => {
  it('contains 18 units, six per level, with unique sequential ordinals', () => {
    expect(seedUnits).toHaveLength(18);
    for (const level of ['A1', 'A2', 'B1'] as Level[]) {
      const ordinals = seedUnits
        .filter((unit) => unit.level === level)
        .map((unit) => unit.ordinal)
        .sort((a, b) => a - b);
      expect(ordinals).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('gives every unit a capstone premise and dialogue ref', () => {
    for (const unit of seedUnits) {
      expect(unit.capstonePremise.length).toBeGreaterThan(10);
      expect(unit.capstoneDialogueRef).toBe(`capstone-${unit.id}`);
    }
  });

  it('references only existing grammar items at the unit level', () => {
    for (const unit of seedUnits) {
      expect(unit.grammarItemIds.length).toBeGreaterThanOrEqual(2);
      expect(unit.grammarItemIds.length).toBeLessThanOrEqual(3);
      for (const id of unit.grammarItemIds) {
        const item = itemsById.get(id);
        expect(item, `grammar item ${id} referenced by ${unit.id}`).toBeDefined();
        expect(item?.level).toBe(unit.level);
      }
    }
  });

  it('does not let Dativ appear before A2', () => {
    for (const unit of unitsReferencing('dativ')) {
      expect(unit.level).not.toBe('A1');
    }
    expect(itemsById.get('dativ-intro')?.level).toBe('A2');
    expect(unitsReferencing('dativ').map((unit) => unit.id)).toContain('a2-3');
  });

  it('introduces Akkusativ late in A1', () => {
    const akkusativUnits = unitsReferencing('akkusativ');
    expect(akkusativUnits.length).toBeGreaterThan(0);
    for (const unit of akkusativUnits.filter((u) => u.level === 'A1')) {
      expect(unit.ordinal).toBeGreaterThanOrEqual(5);
    }
  });

  it('defers Genitiv, adjective endings, and verb-final clauses to B1', () => {
    for (const fragment of ['genitiv', 'adjective-endings', 'verb-final']) {
      for (const unit of unitsReferencing(fragment)) {
        expect(unit.level, `${fragment} must be B1-only`).toBe('B1');
      }
    }
  });

  it('carries the PRD Section 6 weights on the hard areas', () => {
    expect(itemsById.get('noun-genders-articles')?.weight).toBe(3);
    expect(itemsById.get('akkusativ-intro')?.weight).toBe(3);
    expect(itemsById.get('dativ-pronouns')?.weight).toBe(3);
    expect(itemsById.get('adjective-endings')?.weight).toBe(3);
    expect(itemsById.get('v2-statements')?.weight).toBe(2);
    expect(itemsById.get('separable-verbs')?.weight).toBe(2);
    expect(itemsById.get('pronunciation-ch-umlauts')?.weight).toBe(2);
    expect(itemsById.get('teen-numbers-pattern')?.weight).toBe(1);
  });

  it('keeps cumulative word targets near the PRD scope (650/1300/2400)', () => {
    const totalByLevel = (level: Level) =>
      seedUnits
        .filter((unit) => unit.level === level)
        .reduce((sum, unit) => sum + unit.targetWordCount, 0);
    const a1 = totalByLevel('A1');
    const a2 = a1 + totalByLevel('A2');
    const b1 = a2 + totalByLevel('B1');
    expect(a1).toBeGreaterThanOrEqual(600);
    expect(a1).toBeLessThanOrEqual(700);
    expect(a2).toBeGreaterThanOrEqual(1200);
    expect(a2).toBeLessThanOrEqual(1400);
    expect(b1).toBeGreaterThanOrEqual(2300);
    expect(b1).toBeLessThanOrEqual(2500);
  });
});

describe('seedCurriculum idempotency (GT-101)', () => {
  function fakeDb() {
    const written = new Map<string, FirebaseFirestore.DocumentData>();
    const db: SeedTarget = {
      collection: (path: string) => ({
        doc: (id: string) => ({
          set: (data: FirebaseFirestore.DocumentData) => {
            written.set(`${path}/${id}`, data);
            return Promise.resolve();
          },
        }),
      }),
    };
    return { db, written };
  }

  it('re-running the seed changes nothing', async () => {
    const { db, written } = fakeDb();
    const first = await seedCurriculum(db);
    const afterFirst = new Map(written);
    const second = await seedCurriculum(db);
    expect(second).toEqual(first);
    expect(written.size).toBe(afterFirst.size);
    for (const [path, data] of afterFirst) {
      expect(written.get(path)).toEqual(data);
    }
  });

  it('writes each unit and grammar item exactly once per run, keyed by id', async () => {
    const { db, written } = fakeDb();
    const summary = await seedCurriculum(db);
    expect(summary).toEqual({ units: 18, grammarItems: seedGrammarItems.length, scenarios: 12 });
    expect(written.size).toBe(18 + seedGrammarItems.length + 12);
    expect(written.has('units/a1-1')).toBe(true);
    expect(written.has('grammarItems/noun-genders-articles')).toBe(true);
  });
});
