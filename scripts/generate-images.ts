import './load-env';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { getConfig } from '@/lib/config';
import { imageAssetKey, mediaAssetRefConverter, mediaAssetRefSchema } from '@/lib/db/curriculum';
import { getDataStore } from '@/lib/db/store';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { slugify } from './ingest/core';
import { hasImage, MEDIA_DIR, readManifest, writeManifest } from './media/manifest';

// GT-501: real vocabulary images. Reads picturable words, calls the image
// model (key from env via config), writes assets keyed {word}:{style} into
// public/media plus the manifest ledger and MediaAssetRef docs. Idempotent
// (complete entries are skipped), resumable (ledger written per asset),
// batched per level with --level, sampled with --limit.

const STYLE_PROMPTS = {
  flat: (subject: string) =>
    `Simple flat vector illustration of ${subject}. Single clean subject, ` +
    'plain light background, friendly minimal style, no text, no letters.',
  render: (subject: string) =>
    `Soft, friendly 3D render of ${subject}. Single clean subject centered, ` +
    'plain light background, softly lit, no text, no letters.',
} as const;

async function main(): Promise<void> {
  const config = getConfig();
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const store = getDataStore();

  const levelFlag = process.argv.indexOf('--level');
  const level = (levelFlag === -1 ? 'A1' : process.argv[levelFlag + 1]?.toUpperCase()) as
    'A1' | 'A2' | 'B1';
  const limitFlag = process.argv.indexOf('--limit');
  const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);

  const words = loadVocabSeedFile(level).filter((word) => word.picturable);
  const manifest = readManifest();
  mkdirSync(path.join(MEDIA_DIR, 'images'), { recursive: true });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const word of words) {
    if (generated / 2 >= limit) break;
    const display = word.article ? `${word.article} ${word.german}` : word.german;
    for (const style of ['flat', 'render'] as const) {
      const key = imageAssetKey(display, style);
      if (hasImage(manifest, key)) {
        skipped += 1;
        continue;
      }
      try {
        const subject = `${word.translation} ("${word.german}")`;
        const response = await ai.models.generateContent({
          model: config.models.image,
          contents: STYLE_PROMPTS[style](subject),
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        });
        const part = response.candidates?.[0]?.content?.parts?.find(
          (candidate) => candidate.inlineData?.data,
        );
        if (!part?.inlineData?.data) throw new Error('no image data in response');
        const fileName = `images/${slugify(word.german)}-${style}.png`;
        writeFileSync(path.join(MEDIA_DIR, fileName), Buffer.from(part.inlineData.data, 'base64'));
        manifest.images[key] = fileName;
        writeManifest(manifest);
        await store
          .collection('mediaAssets')
          .doc(key)
          .set(
            mediaAssetRefConverter.toFirestore(
              mediaAssetRefSchema.parse({
                kind: 'image',
                key,
                styleOrClipId: style,
                status: 'generated',
              }),
            ),
          );
        generated += 1;
        console.log(`generated ${key} -> ${fileName}`);
      } catch (error) {
        failed += 1;
        console.error(`failed ${key}: ${String(error).slice(0, 140)}`);
        if (failed >= 8) {
          console.error('too many failures; stopping (rerun resumes at the ledger).');
          return;
        }
      }
    }
  }
  console.log(`images: ${generated} generated, ${skipped} skipped, ${failed} failed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
