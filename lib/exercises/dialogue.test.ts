import { describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import {
  buildWordIdentification,
  dialogueClipId,
  dialogueText,
  generateDialogue,
  gradeWordIdentification,
  validateDialogueEnvelope,
  type Dialogue,
} from './dialogue';

function word(overrides: Partial<VocabularyWord> & { id: string; german: string }): VocabularyWord {
  return {
    wordType: 'noun',
    article: 'der',
    translation: 'x',
    ipa: null,
    exampleDe: null,
    exampleEn: null,
    cefrLevel: 'A1',
    theme: 'food-drink',
    picturable: true,
    frequencyRank: 100,
    ...overrides,
  };
}

const corpus: VocabularyWord[] = [
  word({ id: 'kaffee-noun', german: 'Kaffee' }),
  word({ id: 'tee-noun', german: 'Tee', frequencyRank: 150 }),
  word({ id: 'brot-noun', german: 'Brot', article: 'das', frequencyRank: 120 }),
  word({ id: 'milch-noun', german: 'Milch', article: 'die', frequencyRank: 130 }),
  word({ id: 'hund-noun', german: 'Hund', theme: 'nature-weather', frequencyRank: 80 }),
  word({
    id: 'trinken-verb',
    german: 'trinken',
    wordType: 'verb',
    article: null,
    frequencyRank: 60,
  }),
  // Conversational glue at A1, as in the real Goethe corpus.
  word({ id: 'moechten-verb', german: 'möchten', wordType: 'verb', article: null }),
  word({ id: 'bitte-adverb', german: 'bitte', wordType: 'adverb', article: null }),
  word({ id: 'gern-adverb', german: 'gern', wordType: 'adverb', article: null }),
  word({ id: 'ja-adverb', german: 'ja', wordType: 'adverb', article: null }),
  word({ id: 'gut-adjective', german: 'gut', wordType: 'adjective', article: null }),
  word({ id: 'zwei-other', german: 'zwei', wordType: 'other', article: null }),
  word({ id: 'was-other', german: 'was', wordType: 'other', article: null }),
];

const dialogue: Dialogue = {
  title: 'Im Café',
  turns: [
    { speaker: 'Anna', text: 'Was möchtest du trinken?' },
    { speaker: 'Ben', text: 'Einen Kaffee, bitte.' },
    { speaker: 'Anna', text: 'Ich trinke einen Tee.' },
    { speaker: 'Ben', text: 'Möchtest du ein Brot?' },
    { speaker: 'Anna', text: 'Ja, gern.' },
    { speaker: 'Ben', text: 'Gut, zwei Brote bitte.' },
  ],
};

describe('dialogue engine', () => {
  it('renders speaker-tagged text and a content-stable clip id', () => {
    expect(dialogueText(dialogue)).toContain('Anna: Was möchtest du trinken?');
    expect(dialogueClipId(dialogue)).toBe(dialogueClipId({ ...dialogue }));
    expect(dialogueClipId(dialogue)).toMatch(/^dialogue-[0-9a-f]+$/);
    const changed: Dialogue = {
      ...dialogue,
      turns: [...dialogue.turns.slice(0, 5), { speaker: 'Ben', text: 'Nein, danke.' }],
    };
    expect(dialogueClipId(changed)).not.toBe(dialogueClipId(dialogue));
  });

  it('the envelope rejects over-long and out-of-corpus dialogues', () => {
    const longText = Array<string>(50).fill('Kaffee Tee Brot').join(' ');
    const tooLong: Dialogue = {
      ...dialogue,
      turns: dialogue.turns.map((turn) => ({ ...turn, text: longText })),
    };
    expect(validateDialogueEnvelope(tooLong, 'A1', corpus).map((v) => v.rule)).toContain('length');

    const offCorpus: Dialogue = {
      ...dialogue,
      turns: dialogue.turns.map((turn) => ({
        ...turn,
        text: 'Quantenphysik Relativität Thermodynamik Elektromagnetismus',
      })),
    };
    expect(validateDialogueEnvelope(offCorpus, 'A1', corpus).map((v) => v.rule)).toContain(
      'stretch-budget',
    );
    expect(validateDialogueEnvelope(dialogue, 'A1', corpus)).toEqual([]);
  });

  it('generation retries once on envelope violations, then fails as parse-failure', async () => {
    const bad: Dialogue = {
      ...dialogue,
      turns: dialogue.turns.map((turn) => ({
        ...turn,
        text: 'Quantenphysik Relativität Thermodynamik Elektromagnetismus',
      })),
    };
    const client = {
      chat: vi.fn(),
      generateJson: vi.fn().mockResolvedValue(bad),
    } as unknown as GeminiClient;
    await expect(
      generateDialogue(client, { level: 'A1', theme: 'food', corpus }),
    ).rejects.toBeInstanceOf(GeminiError);
    expect(client.generateJson).toHaveBeenCalledTimes(2);
  });

  it('word identification marks dialogue words heard and corpus outsiders as decoys', () => {
    const options = buildWordIdentification(dialogue, corpus);
    const byId = new Map(options.map((option) => [option.wordId, option]));
    expect(byId.get('kaffee-noun')?.heard).toBe(true);
    expect(byId.get('brot-noun')?.heard).toBe(true);
    expect(byId.get('trinken-verb')?.heard).toBe(true);
    expect(byId.get('hund-noun')?.heard).toBe(false);
    // Deterministic alphabetical presentation hides the split.
    expect(options.map((option) => option.label)).toEqual(
      [...options.map((option) => option.label)].sort((a, b) => a.localeCompare(b, 'de')),
    );
  });

  it('grading rewards true positives and correctly ignored decoys', () => {
    const options = buildWordIdentification(dialogue, corpus);
    const perfect = gradeWordIdentification(
      options,
      options.filter((option) => option.heard).map((option) => option.wordId),
    );
    expect(perfect.score).toBe(100);
    const allSelected = gradeWordIdentification(
      options,
      options.map((option) => option.wordId),
    );
    expect(allSelected.score).toBeLessThan(100);
  });
});
