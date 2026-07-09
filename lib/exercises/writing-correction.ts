import { z } from 'zod';
import { grammarErrorCategorySchema, type GrammarErrorLogEntry } from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';
import { writeGrammarError } from '@/lib/analytics/grammar-log';
import type { GeminiClient } from '@/lib/gemini/client';
import type { ContentPoint } from './composers';

// Writing correction engine (GT-213). The exact four-part structure is fixed
// by the system prompt: what works, corrected version in full, categorized
// errors, one pattern-level takeaway. Deep tier; every error is written to
// the grammar log through the single GT-214 path and feeds the GT-311
// difficulty-weighting seam.

export const writingCorrectionSchema = z.object({
  whatWorks: z.string().min(1),
  correctedText: z.string().min(1),
  errors: z.array(
    z.object({
      category: grammarErrorCategorySchema,
      original: z.string().min(1),
      corrected: z.string().min(1),
      explanation: z.string().min(1),
    }),
  ),
  patternTakeaway: z.string().min(1),
  contentPointsCovered: z.array(z.boolean()).nullable(),
});
export type WritingCorrection = z.infer<typeof writingCorrectionSchema>;

export interface CorrectWritingInput {
  readonly text: string;
  readonly format: 'email' | 'opinion';
  readonly contentPoints: readonly ContentPoint[];
}

export async function correctWriting(
  client: GeminiClient,
  input: CorrectWritingInput,
): Promise<WritingCorrection> {
  const pointsList = input.contentPoints
    .map((point, index) => `${index + 1}. ${point.description}`)
    .join('\n');
  return client.generateJson(
    [
      {
        role: 'learner',
        text:
          `Correct this learner ${input.format} using your four-part structure.\n` +
          `Text:\n${input.text}\n` +
          (input.format === 'email'
            ? `Required content points:\n${pointsList}\nAssess each point as covered true/false in order.\n`
            : '') +
          'Return JSON: {"whatWorks":string,"correctedText":string,' +
          '"errors":[{"category":"gender"|"case"|"ending"|"order"|"spelling"|"choice",' +
          '"original":string,"corrected":string,"explanation":string}],' +
          '"patternTakeaway":string,"contentPointsCovered":boolean[]|null}.',
      },
    ],
    writingCorrectionSchema,
    { callSite: 'writing-correction' },
  );
}

// The GT-311 seam: correction errors become log entries; the weighting
// engine reads the log, never the corrections directly.
export function correctionLogEntries(
  correction: WritingCorrection,
  nowIso: string,
): GrammarErrorLogEntry[] {
  return correction.errors.map((error) => ({
    category: error.category,
    item: error.corrected,
    context: `Writing: "${error.original}" -> "${error.corrected}" (${error.explanation})`,
    at: nowIso,
  }));
}

export async function logCorrectionErrors(
  store: DocumentStore,
  correction: WritingCorrection,
  nowIso: string,
): Promise<number> {
  const entries = correctionLogEntries(correction, nowIso);
  for (const entry of entries) {
    await writeGrammarError(store, entry);
  }
  return entries.length;
}
