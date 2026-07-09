import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The generated-media manifest (GT-501/GT-502): the progress ledger for
// generation scripts and the lookup table the GeminiProvider serves from.
// Keys match placeholder keys exactly ({word}:{style} and {clipId}), so the
// provider flip needs no data migration.

export interface MediaManifest {
  images: Record<string, string>;
  audio: Record<string, string>;
}

export const MEDIA_DIR = path.join(process.cwd(), 'public', 'media');
const MANIFEST_FILE = path.join(MEDIA_DIR, 'manifest.json');

export function readManifest(): MediaManifest {
  if (!existsSync(MANIFEST_FILE)) return { images: {}, audio: {} };
  return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as MediaManifest;
}

export function writeManifest(manifest: MediaManifest): void {
  mkdirSync(MEDIA_DIR, { recursive: true });
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
}

// An entry is complete only when both the ledger row and the file exist;
// a crash between the two resumes cleanly.
export function hasImage(manifest: MediaManifest, key: string): boolean {
  const file = manifest.images[key];
  return file !== undefined && existsSync(path.join(MEDIA_DIR, file));
}

export function hasAudio(manifest: MediaManifest, clipId: string): boolean {
  const file = manifest.audio[clipId];
  return file !== undefined && existsSync(path.join(MEDIA_DIR, file));
}
