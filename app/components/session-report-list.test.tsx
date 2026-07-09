// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionReport } from '@/lib/db/learner';
import { SessionReportList } from './session-report-list';

const report: SessionReport = {
  sessionDate: '2026-07-09T08:00:00.000Z',
  wordsReviewed: 12,
  recallRate: 0.75,
  newWords: 15,
  imageIdAccuracy: null,
  scenarioScore: 7,
  skillScores: { listening: 70 },
  errorsByCategory: { gender: 2 },
  grammarItemPracticed: 'noun-genders-articles',
};

const errors = [
  {
    category: 'gender' as const,
    item: 'der Tisch',
    context: 'Image production: wrote "die Tisch" for der Tisch',
    at: '2026-07-09T09:00:00.000Z',
  },
  {
    category: 'case' as const,
    item: 'mich/mir',
    context: 'Old error from another day',
    at: '2026-07-01T09:00:00.000Z',
  },
];

afterEach(cleanup);

describe('session report view (GT-308)', () => {
  it('renders every stored number verbatim', () => {
    render(<SessionReportList reports={[report]} errors={errors} />);
    expect(screen.getByTestId('report-words-reviewed').textContent).toBe('12');
    expect(screen.getByTestId('report-recall').textContent).toBe('75%');
    expect(screen.getByTestId('report-new-words').textContent).toBe('15');
    expect(screen.getByTestId('report-image-id').textContent).toBe('no image exercises');
    expect(screen.getByTestId('report-scenario').textContent).toBe('7 / 10');
    expect(screen.getByTestId('report-error-categories').textContent).toContain('gender 2');
  });

  it("drill-down lists exactly that day's logged items verbatim", () => {
    render(<SessionReportList reports={[report]} errors={errors} />);
    const items = screen.getAllByTestId('drilldown-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain('wrote "die Tisch" for der Tisch');
  });

  it('renders an honest empty state', () => {
    render(<SessionReportList reports={[]} errors={[]} />);
    expect(screen.getByTestId('reports-empty').textContent).toContain('No sessions recorded');
  });
});
