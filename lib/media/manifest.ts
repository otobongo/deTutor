import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The generated-media manifest (GT-501/GT-502): the progress ledger for
// generation scripts, the lookup table the GeminiProvider serves from, and
// the cache index for on-demand synthesis. Keys match placeholder keys
// exactly ({word}:{style} and {clipId}), so the provider flip needs no data
// migration. Lives in lib/media so both the runtime provider and the batch
// scripts share one ledger implementation.

export interface MediaManifest {
  images: Record<string, string>;
  audio: Record<string, string>;
}

export const MEDIA_DIR = path.join(process.cwd(), 'public', 'media');

function manifestFile(mediaDir: string): string {
  return path.join(mediaDir, 'manifest.json');
}

export function readManifest(mediaDir: string = MEDIA_DIR): MediaManifest {
  const file = manifestFile(mediaDir);
  if (!existsSync(file)) return { images: {}, audio: {} };
  return JSON.parse(readFileSync(file, 'utf8')) as MediaManifest;
}

export function writeManifest(manifest: MediaManifest, mediaDir: string = MEDIA_DIR): void {
  mkdirSync(mediaDir, { recursive: true });
  writeFileSync(manifestFile(mediaDir), JSON.stringify(manifest, null, 2) + '\n');
}

// An entry is complete only when both the ledger row and the file exist;
// a crash between the two resumes cleanly.
export function hasImage(
  manifest: MediaManifest,
  key: string,
  mediaDir: string = MEDIA_DIR,
): boolean {
  const file = manifest.images[key];
  return file !== undefined && existsSync(path.join(mediaDir, file));
}

export function hasAudio(
  manifest: MediaManifest,
  clipId: string,
  mediaDir: string = MEDIA_DIR,
): boolean {
  const file = manifest.audio[clipId];
  return file !== undefined && existsSync(path.join(mediaDir, file));
}
