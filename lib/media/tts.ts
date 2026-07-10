import { GoogleGenAI } from '@google/genai';
import { getConfig } from '@/lib/config';

// Text-to-speech synthesis seam (GT-502 evolution, owner-directed
// 2026-07-10): the one place German speech is minted. The batch script and
// the on-demand provider path both call synthesize(); tests inject a fake.
// Single-speaker requests carry one voice; multi-speaker requests (dialogue
// lab) name a voice per speaker tag appearing in the text.

export interface TtsSpeaker {
  readonly name: string;
  readonly voiceName: string;
}

export interface TtsRequest {
  readonly text: string;
  // Exactly one voice for narration/word clips; two or more for dialogues
  // whose text lines are prefixed "Name:".
  readonly speakers: readonly TtsSpeaker[];
  // German content is the default; explanation clips speak English.
  readonly lang?: 'de-DE' | 'en-US';
}

// Returns a browser-playable WAV buffer.
export type TtsSynthesizer = (request: TtsRequest) => Promise<Buffer>;

// Gemini TTS returns 16-bit PCM at 24kHz; wrap it in a RIFF header so
// browsers can play it natively.
export function pcmToWav(pcm: Buffer, sampleRate = 24_000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export const DEFAULT_TTS_VOICE = 'Kore';

// The learner's voice profile (onboarding/Settings) maps to one Gemini
// prebuilt voice, shared by generated TTS clips and the Live session so the
// tutor sounds like one person everywhere.
export const VOICE_NAME_BY_PROFILE: Readonly<Record<string, string>> = {
  'warm-1': 'Sulafat',
  'neutral-1': 'Kore',
  'energetic-1': 'Puck',
};

export function voiceForProfile(profileVoice: string): string {
  return VOICE_NAME_BY_PROFILE[profileVoice] ?? DEFAULT_TTS_VOICE;
}

// Single-narrator speaker list for a learner profile; the common case for
// word, sentence, and explanation clips.
export function narratorFor(profileVoice: string): [TtsSpeaker] {
  return [{ name: 'Sprecher', voiceName: voiceForProfile(profileVoice) }];
}

// Audio cache key: the default single narrator keeps the bare clipId (the
// batch pre-warmer's keys and every clip generated before voice preferences
// stay valid); any other voice mix suffixes the voices, so changing the
// Settings voice mints fresh clips instead of serving the old sound.
export function audioCacheKey(clipId: string, speakers: readonly TtsSpeaker[] | null): string {
  if (
    !speakers ||
    speakers.length === 0 ||
    (speakers.length === 1 && speakers[0]?.voiceName === DEFAULT_TTS_VOICE)
  ) {
    return clipId;
  }
  return `${clipId}@${speakers.map((speaker) => speaker.voiceName).join('+')}`;
}

let sdk: GoogleGenAI | null = null;

export const sdkTtsSynthesizer: TtsSynthesizer = async (request) => {
  const config = getConfig();
  sdk ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  const speechConfig =
    request.speakers.length <= 1
      ? {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: request.speakers[0]?.voiceName ?? DEFAULT_TTS_VOICE,
            },
          },
        }
      : {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: request.speakers.map((speaker) => ({
              speaker: speaker.name,
              voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker.voiceName } },
            })),
          },
        };
  const instruction =
    request.lang === 'en-US'
      ? `Read this explanation clearly and warmly in English: ${request.text}`
      : request.speakers.length <= 1
        ? `Sprich klar und natürlich auf Deutsch: ${request.text}`
        : `Sprich dieses Gespräch klar und natürlich auf Deutsch:\n${request.text}`;
  const response = await sdk.models.generateContent({
    model: config.models.tts,
    contents: instruction,
    config: { responseModalities: ['AUDIO'], speechConfig },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
    ?.inlineData?.data;
  if (!data) throw new Error('no audio data in TTS response');
  return pcmToWav(Buffer.from(data, 'base64'));
};
