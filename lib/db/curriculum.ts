import { z } from 'zod';
import { zodConverter } from './converter';

// Curriculum entities (GT-003). Read-heavy, seed-written. Collection paths
// and index needs are documented in docs/schema.md.

export const LEVELS = ['A1', 'A2', 'B1'] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const SKILLS = ['listening', 'reading', 'writing', 'speaking'] as const;
export const skillSchema = z.enum(SKILLS);
export type Skill = z.infer<typeof skillSchema>;

export const ARTICLES = ['der', 'die', 'das'] as const;
export const articleSchema = z.enum(ARTICLES);
export type Article = z.infer<typeof articleSchema>;

export const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'] as const;
export const wordTypeSchema = z.enum(WORD_TYPES);
export type WordType = z.infer<typeof wordTypeSchema>;

// Difficulty weights per PRD Section 6: 1x standard, 2x high, 3x intensive.
export const GRAMMAR_WEIGHTS = [1, 2, 3] as const;
export const grammarWeightSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type GrammarWeight = z.infer<typeof grammarWeightSchema>;

export const grammarItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: levelSchema,
  weight: grammarWeightSchema,
});
export type GrammarItem = z.infer<typeof grammarItemSchema>;

export const unitSchema = z.object({
  id: z.string().regex(/^(a1|a2|b1)-[1-6]$/, 'unit ids follow {level}-{ordinal}, e.g. a1-3'),
  level: levelSchema,
  ordinal: z.number().int().min(1).max(6),
  theme: z.string().min(1),
  grammarItemIds: z.array(z.string().min(1)).min(2).max(3),
  vocabSetRef: z.string().min(1),
  capstoneDialogueRef: z.string().min(1),
  capstonePremise: z.string().min(1),
  targetWordCount: z.number().int().positive(),
});
export type Unit = z.infer<typeof unitSchema>;

export const vocabularyWordSchema = z
  .object({
    id: z.string().min(1),
    german: z.string().min(1),
    wordType: wordTypeSchema,
    article: articleSchema.nullable(),
    translation: z.string().min(1),
    ipa: z.string().min(1),
    exampleDe: z.string().min(1),
    exampleEn: z.string().min(1),
    cefrLevel: levelSchema,
    theme: z.string().min(1),
    picturable: z.boolean(),
    frequencyRank: z.number().int().positive(),
  })
  .refine((word) => word.wordType !== 'noun' || word.article !== null, {
    message: 'A noun must carry its article; nouns are never taught bare (PRD 3.4).',
    path: ['article'],
  });
export type VocabularyWord = z.infer<typeof vocabularyWordSchema>;

export const scenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: levelSchema,
  setting: z.string().min(1),
  personaDescription: z.string().min(1),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const MEDIA_KINDS = ['image', 'audio'] as const;
export const mediaKindSchema = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const IMAGE_STYLES = ['flat', 'render'] as const;
export const imageStyleSchema = z.enum(IMAGE_STYLES);
export type ImageStyle = z.infer<typeof imageStyleSchema>;

export const MEDIA_ASSET_STATUSES = ['placeholder', 'pending', 'generated'] as const;
export const mediaAssetStatusSchema = z.enum(MEDIA_ASSET_STATUSES);
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;

const IMAGE_KEY_PATTERN = /^[^:/]+:(flat|render)$/;
const AUDIO_KEY_PATTERN = /^[^:/]+$/;

// Image keys are `{word}:{style}`, audio keys are `{clipId}`. Placeholder and
// generated assets share this keyspace so the provider flip needs no migration.
export const mediaAssetRefSchema = z
  .object({
    kind: mediaKindSchema,
    key: z.string().min(1),
    styleOrClipId: z.string().min(1),
    status: mediaAssetStatusSchema,
  })
  .refine(
    (ref) =>
      ref.kind === 'image' ? IMAGE_KEY_PATTERN.test(ref.key) : AUDIO_KEY_PATTERN.test(ref.key),
    {
      message: 'Image keys must be {word}:{style}; audio keys must be a bare {clipId}.',
      path: ['key'],
    },
  );
export type MediaAssetRef = z.infer<typeof mediaAssetRefSchema>;

export function imageAssetKey(word: string, style: ImageStyle): string {
  return `${word}:${style}`;
}

export const unitConverter = zodConverter(unitSchema);
export const vocabularyWordConverter = zodConverter(vocabularyWordSchema);
export const grammarItemConverter = zodConverter(grammarItemSchema);
export const scenarioConverter = zodConverter(scenarioSchema);
export const mediaAssetRefConverter = zodConverter(mediaAssetRefSchema);
