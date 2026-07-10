import './load-env';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import { mediaAssetRefConverter, mediaAssetRefSchema } from '@/lib/db/curriculum';
import { getDataStore } from '@/lib/db/store';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { listeningClipId, UNIT_LISTENING_CLIPS } from '@/db/seed/listening-clips';
import { hasAudio, MEDIA_DIR, readManifest, writeManifest } from '@/lib/media/manifest';
import { DEFAULT_TTS_VOICE, sdkTtsSynthesizer } from '@/lib/media/tts';

// GT-502: native de-DE audio for lesson clips and vocabulary pronunciations,
// keyed by the exact clipIds the placeholder provider uses. Same contract as
// GT-501: idempotent (ledger skip), resumable, per-level batching, capped
// failures. Caption text is retained in the seed data for accessibility.
// Synthesis lives in lib/media/tts, shared with the on-demand provider path;
// this script remains the optional bulk pre-warmer.

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
      const request = {
        text: job.text,
        speakers: [{ name: 'Sprecher', voiceName: DEFAULT_TTS_VOICE }],
      };
      let wav;
      try {
        wav = await sdkTtsSynthesizer(request);
      } catch (firstError) {
        if (isQuotaExhausted(firstError)) throw firstError;
        // Transient rate limit or network blip: one paced retry.
        await sleep(15_000);
        wav = await sdkTtsSynthesizer(request);
      }
      const fileName = `audio/${job.clipId}.wav`;
      writeFileSync(path.join(MEDIA_DIR, fileName), wav);
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
