import { describe, expect, it } from 'vitest';
import {
  grammarItemConverter,
  imageAssetKey,
  mediaAssetRefConverter,
  mediaAssetRefSchema,
  scenarioConverter,
  unitConverter,
  vocabularyWordConverter,
  vocabularyWordSchema,
  type GrammarItem,
  type MediaAssetRef,
  type Scenario,
  type Unit,
  type VocabularyWord,
} from './curriculum';
import { fakeSnapshot } from './test-helpers';

const unit: Unit = {
  id: 'a1-3',
  level: 'A1',
  ordinal: 3,
  theme: 'Numbers, days, and time',
  grammarItemIds: ['numbers-teens', 'v2-questions'],
  vocabSetRef: 'vocab-a1-3',
  capstoneDialogueRef: 'capstone-a1-3',
  targetWordCount: 110,
};

const noun: VocabularyWord = {
  id: 'tisch',
  german: 'Tisch',
  wordType: 'noun',
  article: 'der',
  translation: 'table',
  ipa: 'tɪʃ',
  exampleDe: 'Der Tisch ist groß.',
  exampleEn: 'The table is big.',
  cefrLevel: 'A1',
  theme: 'Home',
  picturable: true,
  frequencyRank: 412,
};

const grammarItem: GrammarItem = {
  id: 'akkusativ-intro',
  name: 'Akkusativ (introduction)',
  level: 'A1',
  weight: 3,
};

const scenario: Scenario = {
  id: 'cafe',
  title: 'Ordering at a café',
  level: 'A1',
  setting: 'A Berlin café counter at breakfast time',
  personaDescription: 'A friendly barista who speaks short, clear Hochdeutsch',
};

const imageRef: MediaAssetRef = {
  kind: 'image',
  key: 'Tisch:flat',
  styleOrClipId: 'flat',
  status: 'placeholder',
};

const audioRef: MediaAssetRef = {
  kind: 'audio',
  key: 'a1-3-dialog-01',
  styleOrClipId: 'a1-3-dialog-01',
  status: 'placeholder',
};

describe('curriculum converters (GT-003)', () => {
  it.each([
    ['Unit', unitConverter, unit],
    ['VocabularyWord', vocabularyWordConverter, noun],
    ['GrammarItem', grammarItemConverter, grammarItem],
    ['Scenario', scenarioConverter, scenario],
    ['MediaAssetRef (image)', mediaAssetRefConverter, imageRef],
    ['MediaAssetRef (audio)', mediaAssetRefConverter, audioRef],
    // The literal-union entity types make the any-typed it.each row safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as ReadonlyArray<[string, any, any]>)(
    'round-trip preserves every field: %s',
    (_name, converter, entity) => {
      const written = converter.toFirestore(entity);
      const read = converter.fromFirestore(fakeSnapshot(written));
      expect(read).toEqual(entity);
    },
  );

  it('rejects a noun without an article', () => {
    const bare = { ...noun, article: null };
    const result = vocabularyWordSchema.safeParse(bare);
    expect(result.success).toBe(false);
    expect(() => vocabularyWordConverter.toFirestore(bare)).toThrow();
  });

  it('allows a non-noun without an article', () => {
    const verb = { ...noun, id: 'gehen', german: 'gehen', wordType: 'verb', article: null };
    expect(vocabularyWordSchema.safeParse(verb).success).toBe(true);
  });

  it('enforces image key format {word}:{style} exactly', () => {
    expect(imageAssetKey('Tisch', 'flat')).toBe('Tisch:flat');
    for (const badKey of ['Tisch', 'Tisch:cartoon', 'Tisch:flat:extra', 'Ti/sch:flat']) {
      expect(mediaAssetRefSchema.safeParse({ ...imageRef, key: badKey }).success).toBe(false);
    }
  });

  it('enforces audio key format {clipId} exactly (no colon, no slash)', () => {
    for (const badKey of ['clip:01', 'clip/01']) {
      expect(mediaAssetRefSchema.safeParse({ ...audioRef, key: badKey }).success).toBe(false);
    }
    expect(mediaAssetRefSchema.safeParse(audioRef).success).toBe(true);
  });

  it('rejects a unit id that does not match {level}-{ordinal}', () => {
    expect(unitConverter.toFirestore.bind(null, { ...unit, id: 'unit-7' })).toThrow();
  });
});
