'use server';

import { placementProbes } from '@/db/seed/placement-probes';
import { dialectSchema, type LearnerProfile } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { runPlacement, type PlacementAnswer, type PlacementResult } from '@/lib/placement/engine';
import { persistPlacement } from '@/lib/placement/persist';
import { z } from 'zod';

// Onboarding server actions (GT-107). All media through the adapter, all
// persistence through the store seam with converters, all inputs validated
// at the boundary.

export interface VoiceOption {
  readonly id: string;
  readonly name: string;
  readonly group: 'Warm' | 'Neutral' | 'Energetic';
  readonly sampleClipId: string;
}

const VOICE_SAMPLES: readonly VoiceOption[] = [
  { id: 'warm-1', name: 'Mia', group: 'Warm', sampleClipId: 'voice-sample-warm-1' },
  { id: 'neutral-1', name: 'Jonas', group: 'Neutral', sampleClipId: 'voice-sample-neutral-1' },
  { id: 'energetic-1', name: 'Lena', group: 'Energetic', sampleClipId: 'voice-sample-energetic-1' },
];

registerPlaceholderClip('voice-sample-warm-1', 'Hallo! Ich bin Mia. Schön, dich kennenzulernen.');
registerPlaceholderClip('voice-sample-neutral-1', 'Guten Tag. Ich bin Jonas. Fangen wir an?');
registerPlaceholderClip('voice-sample-energetic-1', 'Hi! Ich bin Lena. Los geht es!');

export async function getVoiceOptions(): Promise<readonly VoiceOption[]> {
  return Promise.resolve(VOICE_SAMPLES);
}

export async function getVoiceSample(voiceId: string): Promise<AudioAsset> {
  const voice = VOICE_SAMPLES.find((candidate) => candidate.id === voiceId);
  if (!voice) throw new Error(`Unknown voice "${voiceId}".`);
  return getMediaProvider().getAudio(voice.sampleClipId);
}

const completeOnboardingInput = z.object({
  voice: z.string().min(1),
  dialect: dialectSchema.default('hochdeutsch'),
  answers: z.array(z.object({ probeId: z.string().min(1), answer: z.string() })),
});

export interface OnboardingOutcome {
  readonly result: PlacementResult;
  readonly profile: LearnerProfile;
}

export async function completeOnboarding(rawInput: unknown): Promise<OnboardingOutcome> {
  const input = completeOnboardingInput.parse(rawInput);
  const result = runPlacement(placementProbes, input.answers as PlacementAnswer[]);
  const profile = await persistPlacement(
    getDataStore(),
    result,
    {
      level: result.startingLevel,
      unitId: result.startingUnitId,
      settings: { voice: input.voice, dialect: input.dialect, imageStyle: 'mixed' },
    },
    new Date().toISOString(),
  );
  return { result, profile };
}
