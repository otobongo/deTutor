// Placeholder clip registry (GT-007). Real audio is keyed by clipId in
// storage; placeholder audio is keyed by the same clipId and resolves to the
// clip's German text so browsers can speak it (SpeechSynthesis, de-DE) and
// captions can always render. Lesson content registers its clips when seeded
// (Phase 1); unknown clips degrade to a silent, captioned asset, never an error.

const clipTexts = new Map<string, string>();

export function registerPlaceholderClip(clipId: string, germanText: string): void {
  clipTexts.set(clipId, germanText);
}

export function lookupPlaceholderClip(clipId: string): string | undefined {
  return clipTexts.get(clipId);
}

export function clearPlaceholderClips(): void {
  clipTexts.clear();
}
