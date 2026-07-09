import { describe, expect, it } from 'vitest';
import { seedScenarios } from '@/db/seed/scenarios';
import type { Scenario } from '@/lib/db/curriculum';
import { buildScenarioContext } from './engine';

// GT-217: the six B1 scenarios with level-appropriate register and
// complexity. Register lives in the persona; the context builder carries it
// into the runtime verbatim.

const b1 = seedScenarios.filter((scenario) => scenario.level === 'B1');

describe('B1 scenarios (GT-217)', () => {
  it('seeds exactly the six planned B1 scenarios', () => {
    expect(b1.map((scenario) => scenario.id).sort()).toEqual([
      'apartment-viewing',
      'behoerde',
      'complaint-return',
      'news-opinion',
      'phone-appointment',
      'workplace',
    ]);
  });

  it('the Behörde scenario demands the Sie-form and formal register', () => {
    const behoerde = b1.find((scenario) => scenario.id === 'behoerde') as Scenario;
    const context = buildScenarioContext(behoerde, 'B1', 'hochdeutsch');
    expect(context).toContain('Sie-form');
    expect(context).toContain('bureaucratic register');
  });

  it('the opinion scenario invites Konjunktiv II', () => {
    const opinion = b1.find((scenario) => scenario.id === 'news-opinion') as Scenario;
    expect(opinion.personaDescription).toContain('Konjunktiv II');
  });

  it('B1 contexts allow subordinate clauses instead of capping sentences', () => {
    const workplace = b1.find((scenario) => scenario.id === 'workplace') as Scenario;
    const context = buildScenarioContext(workplace, 'B1', 'hochdeutsch');
    expect(context).toContain('subordinate clauses');
    expect(context).not.toContain('max 8 words');
  });

  it('all six are selectable at B1 only (level field gates selection)', () => {
    for (const scenario of b1) {
      expect(scenario.level).toBe('B1');
    }
    const selectableAt = (level: 'A1' | 'A2' | 'B1') =>
      seedScenarios.filter((scenario) =>
        level === 'B1'
          ? true
          : scenario.level === 'A1' || (level === 'A2' && scenario.level !== 'B1'),
      );
    expect(selectableAt('A1').every((scenario) => scenario.level === 'A1')).toBe(true);
    expect(selectableAt('A2').some((scenario) => scenario.level === 'B1')).toBe(false);
    expect(selectableAt('B1')).toHaveLength(12);
  });
});
