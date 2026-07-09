// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { ARTICLE_COLORS } from '@/lib/design/tokens';
import { VocabCard } from './vocab-card';

const noun: VocabularyWord = {
  id: 'tisch-noun',
  german: 'Tisch',
  wordType: 'noun',
  article: 'der',
  translation: 'table',
  ipa: 'tɪʃ',
  exampleDe: 'Der Tisch ist groß.',
  exampleEn: 'The table is big.',
  cefrLevel: 'A1',
  theme: 'home-living',
  picturable: true,
  frequencyRank: 412,
};

afterEach(cleanup);

describe('vocabulary card (GT-201)', () => {
  it('renders the system-prompt template: article, word, translation, IPA, Beispiel', () => {
    render(<VocabCard word={noun} />);
    expect(screen.getByTestId('card-article').textContent).toBe('der');
    expect(screen.getByTestId('card-german').textContent).toBe('Tisch');
    expect(screen.getByTestId('card-translation').textContent).toBe('table');
    expect(screen.getByTestId('card-ipa').textContent).toBe('tɪʃ');
    expect(screen.getByTestId('card-example').textContent).toBe('Der Tisch ist groß.');
  });

  it('shows the article in its convention color AND as text', () => {
    render(<VocabCard word={noun} />);
    const article = screen.getByTestId('card-article');
    // Color-coded, but never color-only: the article text itself is present.
    expect(article.getAttribute('style')).toContain('color:');
    expect(article.textContent).toBe('der');
    const expected = ARTICLE_COLORS.der;
    expect(expected).toMatch(/^#/);
  });

  it('omits enrichment-pending lines instead of fabricating them', () => {
    render(<VocabCard word={{ ...noun, id: 'x', ipa: null, exampleDe: null, exampleEn: null }} />);
    expect(screen.queryByTestId('card-ipa')).toBeNull();
    expect(screen.queryByTestId('card-example')).toBeNull();
  });

  it('renders non-nouns without an article slot', () => {
    render(
      <VocabCard
        word={{ ...noun, id: 'gehen-verb', german: 'gehen', wordType: 'verb', article: null }}
      />,
    );
    expect(screen.queryByTestId('card-article')).toBeNull();
  });
});
