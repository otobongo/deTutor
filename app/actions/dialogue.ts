'use server';

import { seedUnits } from '@/db/seed/units';
import { fallbackDialogueFor } from '@/db/seed/dialogue-fallback';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import {
  buildWordIdentification,
  dialogueClipId,
  dialogueText,
  generateDialogue,
  type Dialogue,
  type IdentificationOption,
} from '@/lib/exercises/dialogue';
import { recordSkillScore } from '@/lib/assessment/scoring';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';

// Dialogue lab actions: brain-generated conversation with the curated A1
// fallback, spoken through two distinct voices via the on-demand TTS cache.
// The identification key stays server-side territory conceptually but the
// exercise is self-checked; the listening score records at the edge here.

const SPEAKER_VOICES = [
  { name: 'Anna', voiceName: 'Kore' },
  { name: 'Ben', voiceName: 'Puck' },
] as const;

export interface DialogueLabPayload {
  readonly source: 'brain' | 'fallback';
  readonly dialogue: Dialogue;
  readonly audio: AudioAsset;
  readonly identification: readonly IdentificationOption[];
}

export async function getDialogueLabAction(): Promise<DialogueLabPayload | null> {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) return null;
  const unit = seedUnits.find((candidate) => candidate.id === profile.unitId);
  const corpus = loadVocabSeedFile(profile.level);

  let dialogue: Dialogue;
  let source: 'brain' | 'fallback';
  try {
    dialogue = await generateDialogue(getGeminiClient(), {
      level: profile.level,
      theme: unit?.theme ?? 'everyday life',
      corpus,
    });
    source = 'brain';
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    dialogue = fallbackDialogueFor(new Date());
    source = 'fallback';
  }

  const clipId = dialogueClipId(dialogue);
  registerPlaceholderClip(clipId, dialogueText(dialogue), { speakers: SPEAKER_VOICES });
  const audio = await getMediaProvider().getAudio(clipId);

  return {
    source,
    dialogue,
    audio,
    identification: buildWordIdentification(dialogue, corpus),
  };
}

export async function recordListeningScoreAction(score: number): Promise<void> {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) return;
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  await recordSkillScore(store, profile.unitId, 'listening', bounded, new Date().toISOString());
}
