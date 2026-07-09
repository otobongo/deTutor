// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScenarioSummaryView } from './scenario-summary';

afterEach(cleanup);

describe('scenario summary view (GT-218)', () => {
  it('renders the fixed table format with total and takeaway', () => {
    render(
      <ScenarioSummaryView
        summary={{
          rows: [
            {
              yourVersion: 'Ich möchte eine Kaffee.',
              correctVersion: 'Ich hätte gern einen Kaffee.',
              rule: 'Kaffee is masculine.',
            },
          ],
          totalErrors: 1,
          takeaway: 'Watch masculine articles.',
          congratulation: null,
        }}
      />,
    );
    expect(screen.getAllByTestId('summary-row')).toHaveLength(1);
    expect(screen.getByTestId('summary-total').textContent).toContain('1');
    expect(screen.getByTestId('summary-takeaway').textContent).toContain('masculine');
  });

  it('renders the congratulation instead of an empty table', () => {
    render(
      <ScenarioSummaryView
        summary={{
          rows: [],
          totalErrors: 0,
          takeaway: 'Keep going.',
          congratulation: 'Fehlerfrei!',
        }}
      />,
    );
    expect(screen.queryByTestId('summary-table')).toBeNull();
    expect(screen.getByTestId('summary-congratulation').textContent).toContain('Fehlerfrei');
  });
});
