// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wordCount, WRITING_PROMPTS, type WritingPrompt } from '@/lib/exercises/composers';
import { WritingComposer } from './writing-composer';

const emailPrompt = WRITING_PROMPTS[0] as WritingPrompt;

afterEach(cleanup);

describe('writing composer (GT-212)', () => {
  it('covers both Goethe Schreiben formats in the prompt seed', () => {
    const formats = new Set(WRITING_PROMPTS.map((prompt) => prompt.format));
    expect(formats).toEqual(new Set(['email', 'opinion']));
    for (const prompt of WRITING_PROMPTS.filter((p) => p.format === 'email')) {
      expect(prompt.contentPoints).toHaveLength(3);
    }
  });

  it('counts words accurately', async () => {
    const user = userEvent.setup();
    render(<WritingComposer prompt={emailPrompt} onSubmit={() => {}} submitting={false} />);
    await user.type(screen.getByTestId('composer-text'), 'Hallo Alex, wie geht es dir?');
    expect(screen.getByTestId('composer-word-count').textContent).toContain('6 /');
    expect(wordCount('  Hallo   Alex  ')).toBe(2);
  });

  it('soft-warns on missing content points, then submits anyway', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WritingComposer prompt={emailPrompt} onSubmit={onSubmit} submitting={false} />);
    await user.type(screen.getByTestId('composer-text'), 'Hallo Alex, bis bald!');
    await user.click(screen.getByTestId('composer-submit'));
    // First click warns instead of submitting (soft, not a block).
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('composer-soft-warning')).toBeTruthy();
    await user.click(screen.getByTestId('composer-submit'));
    expect(onSubmit).toHaveBeenCalledWith('Hallo Alex, bis bald!');
  });

  it('submits directly when the checklist is covered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WritingComposer prompt={emailPrompt} onSubmit={onSubmit} submitting={false} />);
    const text = 'Hallo Alex! Am Samstag habe ich Zeit. Wir können das Museum besuchen. Kommst du?';
    await user.click(screen.getByTestId('composer-text'));
    await user.paste(text);
    const checklist = screen.getByTestId('content-checklist');
    expect(checklist.querySelectorAll('[data-covered="true"]').length).toBe(3);
    await user.click(screen.getByTestId('composer-submit'));
    expect(onSubmit).toHaveBeenCalledWith(text);
  });
});
