// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ScenarioSnapshot,
  ScenarioStartPayload,
  ScenarioTurnOutcome,
} from '@/app/actions/scenario';
import { ScenarioChat } from './scenario-chat';

const startPayload: ScenarioStartPayload = {
  scenario: {
    id: 'cafe',
    title: 'Ordering at a café',
    level: 'A1',
    setting: 'A relaxed Berlin café counter.',
    personaDescription: 'A friendly barista.',
  },
  snapshot: {
    scenarioId: 'cafe',
    messages: [],
    corrections: [],
    englishStreak: 0,
    redirected: false,
  },
};

function turnOutcome(snapshot: ScenarioSnapshot, input: string): ScenarioTurnOutcome {
  return {
    ok: true,
    turn: {
      reply: 'Gerne! Ein Kaffee kommt sofort.',
      correction: {
        acknowledgment: 'Fast!',
        better: 'Ich möchte einen Kaffee.',
        reason: 'Akkusativ after möchten',
        category: 'case',
        item: 'akkusativ',
      },
    },
    snapshot: {
      ...snapshot,
      messages: [
        ...snapshot.messages,
        { role: 'learner', text: input },
        { role: 'tutor', text: 'Gerne! Ein Kaffee kommt sofort.' },
      ],
      corrections: [
        ...snapshot.corrections,
        {
          acknowledgment: 'Fast!',
          better: 'Ich möchte einen Kaffee.',
          reason: 'Akkusativ after möchten',
          category: 'case',
          item: 'akkusativ',
          original: input,
        },
      ],
    },
  };
}

afterEach(cleanup);

describe('scenario chat', () => {
  it('runs a turn, shows the reply and the inline correction, then ends into the summary', async () => {
    const end = vi.fn().mockResolvedValue({
      ok: true,
      summary: {
        rows: [
          {
            yourVersion: 'Ich möchte ein Kaffee.',
            correctVersion: 'Ich möchte einen Kaffee.',
            rule: 'Akkusativ after möchten',
          },
        ],
        totalErrors: 1,
        takeaway: 'Watch the Akkusativ.',
        congratulation: null,
      },
      score: 7,
      errorsLogged: 1,
    });
    const onDone = vi.fn();
    render(
      <ScenarioChat
        start={() => Promise.resolve(startPayload)}
        turn={(snapshot, input) => Promise.resolve(turnOutcome(snapshot, input))}
        end={end}
        onDone={onDone}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('scenario-chat')).toBeTruthy());

    fireEvent.change(screen.getByTestId('scenario-input'), {
      target: { value: 'Ich möchte ein Kaffee.' },
    });
    fireEvent.click(screen.getByTestId('scenario-send'));

    await waitFor(() =>
      expect(screen.getByTestId('scenario-message-tutor').textContent).toContain('Gerne'),
    );
    expect(screen.getByTestId('scenario-correction').textContent).toContain('Fast!');
    expect(screen.getByTestId('scenario-correction').textContent).toContain(
      'Ich möchte einen Kaffee.',
    );

    fireEvent.click(screen.getByTestId('scenario-end'));
    await waitFor(() => expect(screen.getByTestId('scenario-summary')).toBeTruthy());
    expect(screen.getByTestId('scenario-score').textContent).toContain('7');

    fireEvent.click(screen.getByTestId('skill-continue'));
    expect(onDone).toHaveBeenCalledWith(7, ['case']);
  });

  it('a brain outage is a recoverable state with a way onward', async () => {
    const onDone = vi.fn();
    render(
      <ScenarioChat
        start={() => Promise.resolve(startPayload)}
        turn={() => Promise.resolve({ ok: false, category: 'network' })}
        end={() => Promise.resolve({ ok: false, category: 'network', errorsLogged: 0 })}
        onDone={onDone}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('scenario-chat')).toBeTruthy());

    fireEvent.change(screen.getByTestId('scenario-input'), { target: { value: 'Hallo!' } });
    fireEvent.click(screen.getByTestId('scenario-send'));
    await waitFor(() => expect(screen.getByTestId('scenario-offline')).toBeTruthy());

    fireEvent.click(screen.getByTestId('scenario-end'));
    await waitFor(() => expect(screen.getByTestId('scenario-summary-offline')).toBeTruthy());
    fireEvent.click(screen.getByTestId('skill-continue'));
    expect(onDone).toHaveBeenCalledWith(null, []);
  });
});
