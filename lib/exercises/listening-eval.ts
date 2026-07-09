import { z } from 'zod';
import type { Level } from '@/lib/db/curriculum';
import type { GeminiClient } from '@/lib/gemini/client';

// Listening evaluation engine (GT-206). The brain judges comprehension; the
// verdict is a closed union and the response is schema-validated (never
// regexed). A1/A2 run on the fast tier; B1 adds a deep-tier nuance pass
// (idiom, register, implied meaning) per the GT-110 escalation map.

export const listeningVerdictSchema = z.object({
  verdict: z.enum(['full', 'partial', 'missed']),
  missedPoints: z.array(z.string()),
  feedback: z.string().min(1),
});
export type ListeningVerdict = z.infer<typeof listeningVerdictSchema>;

export const listeningNuanceSchema = z.object({
  nuances: z.array(
    z.object({
      kind: z.enum(['idiom', 'register', 'implied-meaning']),
      explanation: z.string().min(1),
    }),
  ),
});
export type ListeningNuance = z.infer<typeof listeningNuanceSchema>;

export interface ListeningEvaluation {
  readonly verdict: ListeningVerdict;
  readonly nuance: ListeningNuance | null;
}

export interface ListeningEvaluationInput {
  readonly clipText: string;
  readonly learnerResponse: string;
  readonly level: Level;
}

export async function evaluateListening(
  client: GeminiClient,
  input: ListeningEvaluationInput,
): Promise<ListeningEvaluation> {
  const verdict = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          `Evaluate this listening comprehension at level ${input.level}.\n` +
          `Clip (German): ${input.clipText}\n` +
          `Learner described: ${input.learnerResponse}\n` +
          'Return JSON: {"verdict":"full"|"partial"|"missed","missedPoints":string[],"feedback":string}. ' +
          'missedPoints lists content the learner did not mention; feedback is one warm sentence.',
      },
    ],
    listeningVerdictSchema,
    { callSite: 'listening-evaluation' },
  );

  if (input.level !== 'B1') {
    return { verdict, nuance: null };
  }

  const nuance = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          `Explain the nuances of this B1 German clip for an English speaker.\n` +
          `Clip: ${input.clipText}\n` +
          'Return JSON: {"nuances":[{"kind":"idiom"|"register"|"implied-meaning","explanation":string}]}. ' +
          'Only include nuances actually present.',
      },
    ],
    listeningNuanceSchema,
    { callSite: 'listening-nuance-b1' },
  );
  return { verdict, nuance };
}
