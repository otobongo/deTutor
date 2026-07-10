import { z } from 'zod';
import type { Level, VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import { outOfCorpusRate, STRETCH_BUDGET, tokenizeGerman } from './reading-gen';

// Dialogue lab (owner-directed 2026-07-10): a spoken two-person conversation
// on the unit theme, heard before it is read. The brain writes the German;
// code owns the envelope (turn count, length cap, corpus stretch budget),
// exactly like reading generation. Word identification is pure and
// deterministic; comprehension reuses the GT-206 listening evaluator.

export const DIALOGUE_SPEAKERS = ['Anna', 'Ben'] as const;
export type DialogueSpeaker = (typeof DIALOGUE_SPEAKERS)[number];

export const dialogueSchema = z.object({
  title: z.string().min(1),
  turns: z
    .array(
      z.object({
        speaker: z.enum(DIALOGUE_SPEAKERS),
        text: z.string().min(1),
      }),
    )
    .min(6)
    .max(10),
});
export type Dialogue = z.infer<typeof dialogueSchema>;

export const DIALOGUE_LENGTH_CAP_WORDS: Readonly<Record<Level, number>> = {
  A1: 90,
  A2: 200,
  B1: 350,
};

export function dialogueText(dialogue: Dialogue): string {
  return dialogue.turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');
}

export function dialogueBodyText(dialogue: Dialogue): string {
  return dialogue.turns.map((turn) => turn.text).join(' ');
}

// Cache key by content: the same conversation always maps to the same clip,
// a regenerated conversation gets a fresh one.
export function dialogueClipId(dialogue: Dialogue): string {
  let hash = 0x811c9dc5;
  for (const char of dialogueText(dialogue)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `dialogue-${hash.toString(16)}`;
}

export interface DialogueEnvelopeViolation {
  readonly rule: 'length' | 'stretch-budget';
  readonly detail: string;
}

export function validateDialogueEnvelope(
  dialogue: Dialogue,
  level: Level,
  corpus: readonly VocabularyWord[],
): DialogueEnvelopeViolation[] {
  const violations: DialogueEnvelopeViolation[] = [];
  const body = dialogueBodyText(dialogue);
  const tokens = tokenizeGerman(body);
  if (tokens.length > DIALOGUE_LENGTH_CAP_WORDS[level]) {
    violations.push({
      rule: 'length',
      detail: `${tokens.length} words exceeds the ${DIALOGUE_LENGTH_CAP_WORDS[level]}-word ${level} cap`,
    });
  }
  const rate = outOfCorpusRate(body, corpus);
  if (rate > STRETCH_BUDGET) {
    violations.push({
      rule: 'stretch-budget',
      detail: `${Math.round(rate * 100)}% of tokens outside corpus (budget ${STRETCH_BUDGET * 100}%)`,
    });
  }
  return violations;
}

export interface DialogueGenerationInput {
  readonly level: Level;
  readonly theme: string;
  readonly corpus: readonly VocabularyWord[];
}

export async function generateDialogue(
  client: GeminiClient,
  input: DialogueGenerationInput,
): Promise<Dialogue> {
  const sampleVocab = input.corpus
    .slice(0, 120)
    .map((word) => word.german)
    .join(', ');
  const prompt =
    `Write a short everyday German conversation at level ${input.level} between Anna and Ben ` +
    `on the theme "${input.theme}". 6 to 8 turns, alternating speakers, very short sentences.\n` +
    `Use ONLY vocabulary the learner knows (sample: ${sampleVocab}) plus at most a small stretch.\n` +
    'Return JSON: {"title":string,"turns":[{"speaker":"Anna"|"Ben","text":string}]}.';

  let lastViolations: DialogueEnvelopeViolation[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const dialogue = await client.generateJson(
      [{ role: 'learner', text: prompt }],
      dialogueSchema,
      { callSite: 'dialogue-generation' },
    );
    lastViolations = validateDialogueEnvelope(dialogue, input.level, input.corpus);
    if (lastViolations.length === 0) return dialogue;
  }
  throw new GeminiError(
    'parse-failure',
    `Generated dialogue violated the level envelope twice: ${lastViolations
      .map((violation) => violation.detail)
      .join('; ')}`,
  );
}

// Word identification: which of these did you hear? Heard options are corpus
// words actually present in the dialogue (longest first, they carry the
// content); decoys are corpus neighbors that never occur. Deterministic, no
// RNG; presentation order sorts alphabetically to hide the split.
export interface IdentificationOption {
  readonly wordId: string;
  readonly label: string;
  readonly heard: boolean;
}

export function buildWordIdentification(
  dialogue: Dialogue,
  corpus: readonly VocabularyWord[],
  heardCount = 4,
  decoyCount = 3,
): IdentificationOption[] {
  const tokens = new Set(tokenizeGerman(dialogueBodyText(dialogue)));
  const inDialogue = (word: VocabularyWord): boolean =>
    tokens.has(word.german.toLowerCase()) ||
    [...tokens].some(
      (token) =>
        word.german.length >= 4 &&
        token.startsWith(word.german.toLowerCase()) &&
        token.length - word.german.length <= 3,
    );

  const heard = corpus
    .filter((word) => word.german.length >= 3 && inDialogue(word))
    .sort((a, b) => b.german.length - a.german.length || a.id.localeCompare(b.id))
    .slice(0, heardCount);
  const decoys = corpus
    .filter((word) => word.german.length >= 3 && !inDialogue(word))
    .sort((a, b) => a.frequencyRank - b.frequencyRank || a.id.localeCompare(b.id))
    .slice(0, decoyCount);

  return [
    ...heard.map((word) => ({ word, heard: true })),
    ...decoys.map((word) => ({ word, heard: false })),
  ]
    .map(({ word, heard: wasHeard }): IdentificationOption => ({
      wordId: word.id,
      label: word.article ? `${word.article} ${word.german}` : word.german,
      heard: wasHeard,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

export interface IdentificationResult {
  readonly correct: number;
  readonly total: number;
  readonly score: number;
}

export function gradeWordIdentification(
  options: readonly IdentificationOption[],
  selectedWordIds: readonly string[],
): IdentificationResult {
  const selected = new Set(selectedWordIds);
  const correct = options.filter((option) => selected.has(option.wordId) === option.heard).length;
  const total = options.length;
  return { correct, total, score: total === 0 ? 0 : Math.round((100 * correct) / total) };
}
