// Placeholder clip registry (GT-007). Real audio is keyed by clipId in
// storage; placeholder audio is keyed by the same clipId and resolves to the
// clip's text so browsers can speak it (SpeechSynthesis) and captions can
// always render. Clips are German by default; explanation clips (word
// workspace) register as English. Lesson content registers its clips when
// seeded (Phase 1); unknown clips degrade to a silent, captioned asset,
// never an error.

export type ClipLang = 'de-DE' | 'en-US';

export interface ClipEntry {
  readonly text: string;
  readonly lang: ClipLang;
}

const clips = new Map<string, ClipEntry>();

export function registerPlaceholderClip(
  clipId: string,
  text: string,
  lang: ClipLang = 'de-DE',
): void {
  clips.set(clipId, { text, lang });
}

export function lookupPlaceholderClip(clipId: string): string | undefined {
  return clips.get(clipId)?.text;
}

export function lookupPlaceholderClipEntry(clipId: string): ClipEntry | undefined {
  return clips.get(clipId);
}

export function clearPlaceholderClips(): void {
  clips.clear();
}
