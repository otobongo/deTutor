import { z } from 'zod';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';
import type { GeminiClient } from '@/lib/gemini/client';

// Speaking echo loop (GT-215), fallback mode: the tutor presents (adapter
// audio), the learner responds through the fallback voice session (typed or
// speech-recognized transcript), the brain assesses pronunciation-relevant
// differences, the learner retries. Three misses move on kindly and log the
// pronunciation item; encouragement lives in tone, not in inflated verdicts.

export const MAX_ATTEMPTS = 3;

export const echoAssessmentSchema = z.object({
  verdict: z.enum(['correct', 'close', 'off']),
  missingSounds: z.array(z.string()),
  stressNote: z.string().nullable(),
  encouragement: z.string().min(1),
});
export type EchoAssessment = z.infer<typeof echoAssessmentSchema>;

export interface EchoLoopState {
  readonly target: string;
  readonly attempts: number;
  readonly status: 'awaiting-response' | 'confirmed' | 'moved-on';
  readonly lastAssessment: EchoAssessment | null;
}

export function startEchoLoop(target: string): EchoLoopState {
  return { target, attempts: 0, status: 'awaiting-response', lastAssessment: null };
}

// Exact transcripts confirm without a model call; anything else asks the
// brain for the specific issue (fast tier).
export async function assessEchoAttempt(
  client: GeminiClient,
  state: EchoLoopState,
  transcript: string,
): Promise<EchoLoopState> {
  if (state.status !== 'awaiting-response') {
    throw new Error('Echo loop already finished.');
  }
  const attempts = state.attempts + 1;
  const normalize = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ');
  if (normalize(transcript) === normalize(state.target)) {
    return {
      ...state,
      attempts,
      status: 'confirmed',
      lastAssessment: {
        verdict: 'correct',
        missingSounds: [],
        stressNote: null,
        encouragement: 'Genau so! That was spot on.',
      },
    };
  }

  const assessment = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          `Echo pronunciation check. Target: "${state.target}". ` +
          `Learner said (transcript): "${transcript}".\n` +
          'Return JSON: {"verdict":"correct"|"close"|"off","missingSounds":string[],' +
          '"stressNote":string|null,"encouragement":string}. Name the specific issue.',
      },
    ],
    echoAssessmentSchema,
    { callSite: 'echo-assessment' },
  );

  if (assessment.verdict === 'correct' || (assessment.verdict === 'close' && attempts >= 2)) {
    // Confirm when close after a genuine retry; do not drill into frustration.
    return { ...state, attempts, status: 'confirmed', lastAssessment: assessment };
  }
  if (attempts >= MAX_ATTEMPTS) {
    return { ...state, attempts, status: 'moved-on', lastAssessment: assessment };
  }
  return { ...state, attempts, status: 'awaiting-response', lastAssessment: assessment };
}

// Moving on after three misses logs the pronunciation item so the daily
// micro-drills pick it up. Pronunciation is not a grammar category; spelling
// is the closest closed-union fit for sound-level issues and is tagged in
// the item text for the analytics layer.
export function moveOnLogEntry(state: EchoLoopState, nowIso: string): GrammarErrorLogEntry | null {
  if (state.status !== 'moved-on') return null;
  return {
    category: 'spelling',
    item: `pronunciation:${state.target}`,
    context: `Echo loop: moved on after ${state.attempts} attempts (${
      state.lastAssessment?.missingSounds.join(', ') || 'unspecified sounds'
    })`,
    at: nowIso,
  };
}
