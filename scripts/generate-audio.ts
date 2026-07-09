import './load-env';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { getConfig } from '@/lib/config';
import { mediaAssetRefConverter, mediaAssetRefSchema } from '@/lib/db/curriculum';
import { getDataStore } from '@/lib/db/store';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { listeningClipId, UNIT_LISTENING_CLIPS } from '@/db/seed/listening-clips';
import { hasAudio, MEDIA_DIR, readManifest, writeManifest } from './media/manifest';

// GT-502: native de-DE audio for lesson clips and vocabulary pronunciations,
// keyed by the exact clipIds the placeholder provider uses. Same contract as
// GT-501: idempotent (ledger skip), resumable, per-level batching, capped
// failures. Caption text is retained in the seed data for accessibility.

// Gemini TTS returns 16-bit PCM at 24kHz; wrap it in a RIFF header so
// browsers can play it natively.
function pcmToWav(pcm: Buffer, sampleRate = 24_000): Buffer {
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

interface ClipJob {
  readonly clipId: string;
  readonly text: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Daily-quota 429s cannot recover inside a run; per-minute 429s can. One
// paced retry distinguishes them.
function isQuotaExhausted(error: unknown): boolean {
  return String(error).includes('exceeded your current quota');
}

async function main(): Promise<void> {
  const config = getConfig();
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const store = getDataStore();

  const levelFlag = process.argv.indexOf('--level');
  const level = (levelFlag === -1 ? 'A1' : process.argv[levelFlag + 1]?.toUpperCase()) as
    'A1' | 'A2' | 'B1';
  const limitFlag = process.argv.indexOf('--limit');
  const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);

  const jobs: ClipJob[] = [
    // Unit listening clips for the level.
    ...Object.entries(UNIT_LISTENING_CLIPS)
      .filter(([unitId]) => unitId.startsWith(level.toLowerCase()))
      .map(([unitId, text]) => ({ clipId: listeningClipId(unitId), text })),
    // Vocabulary pronunciations: the noun-article package spoken naturally.
    ...loadVocabSeedFile(level).map((word) => ({
      clipId: `word-${word.id}`,
      text: word.article ? `${word.article} ${word.german}` : word.german,
    })),
  ];

  const manifest = readManifest();
  mkdirSync(path.join(MEDIA_DIR, 'audio'), { recursive: true });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const job of jobs) {
    if (generated >= limit) break;
    if (hasAudio(manifest, job.clipId)) {
      skipped += 1;
      continue;
    }
    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: config.models.tts,
          contents: `Sprich klar und natürlich auf Deutsch: ${job.text}`,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        });
      } catch (firstError) {
        if (isQuotaExhausted(firstError)) throw firstError;
        // Transient rate limit or network blip: one paced retry.
        await sleep(15_000);
        response = await ai.models.generateContent({
          model: config.models.tts,
          contents: `Sprich klar und natürlich auf Deutsch: ${job.text}`,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        });
      }
      const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
        ?.inlineData?.data;
      if (!data) throw new Error('no audio data in response');
      const fileName = `audio/${job.clipId}.wav`;
      writeFileSync(path.join(MEDIA_DIR, fileName), pcmToWav(Buffer.from(data, 'base64')));
      manifest.audio[job.clipId] = fileName;
      writeManifest(manifest);
      await store
        .collection('mediaAssets')
        .doc(job.clipId)
        .set(
          mediaAssetRefConverter.toFirestore(
            mediaAssetRefSchema.parse({
              kind: 'audio',
              key: job.clipId,
              styleOrClipId: job.clipId,
              status: 'generated',
            }),
          ),
        );
      generated += 1;
      console.log(`generated ${job.clipId} -> ${fileName}`);
    } catch (error) {
      if (isQuotaExhausted(error)) {
        console.error(
          `quota exhausted for ${config.models.tts} at ${job.clipId}; ` +
            'stopping cleanly. Rerun when quota resets (the ledger resumes here), ' +
            'or override GEMINI_MODEL_TTS.',
        );
        return;
      }
      failed += 1;
      console.error(`failed ${job.clipId}: ${String(error).slice(0, 140)}`);
      if (failed >= 8) {
        console.error('too many failures; stopping (rerun resumes at the ledger).');
        return;
      }
    }
    // Gentle pacing keeps the run inside per-minute limits.
    await sleep(1_500);
  }
  console.log(`audio: ${generated} generated, ${skipped} skipped, ${failed} failed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
