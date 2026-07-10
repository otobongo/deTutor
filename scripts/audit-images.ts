import './load-env';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import { MEDIA_DIR, readManifest } from '@/lib/media/manifest';

// Image accuracy audit (media tooling, PRD 7.6 family): every generated
// image goes back through Gemini vision with its expected subject; the model
// judges whether the picture clearly depicts the word. Results land in
// public/media/image-audit.json and render as badges in the /catalog page.
// Idempotent: already-audited keys are skipped unless --recheck.

const verdictSchema = z.object({
  match: z.boolean(),
  seen: z.string().min(1),
});

export interface AuditEntry {
  key: string;
  german: string;
  translation: string;
  match: boolean;
  seen: string;
}

const AUDIT_FILE = path.join(MEDIA_DIR, 'image-audit.json');

async function main(): Promise<void> {
  const config = getConfig();
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const manifest = readManifest();
  const corpus = cumulativeCorpus('B1');
  const byDisplay = new Map(
    corpus.map((word) => [word.article ? `${word.article} ${word.german}` : word.german, word]),
  );

  const recheck = process.argv.includes('--recheck');
  const existing: Record<string, AuditEntry> = ((): Record<string, AuditEntry> => {
    try {
      return JSON.parse(readFileSync(AUDIT_FILE, 'utf8')) as Record<string, AuditEntry>;
    } catch {
      return {};
    }
  })();

  let audited = 0;
  for (const [key, file] of Object.entries(manifest.images)) {
    if (!recheck && existing[key]) continue;
    const display = key.split(':')[0] ?? '';
    const word = byDisplay.get(display);
    if (!word) continue;
    try {
      const image = readFileSync(path.join(MEDIA_DIR, file));
      const response = await ai.models.generateContent({
        model: config.models.fast,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/png', data: image.toString('base64') } },
              {
                text:
                  `This image illustrates the GERMAN word "${display}" for a beginner. ` +
                  'Judge against the common primary meaning of the German word itself ' +
                  `(the stored gloss "${word.translation}" may be wrong; flag it if the image ` +
                  'matches a rare sense instead of the common one). Judge strictly but allow ' +
                  'stylistic variation. Return JSON: {"match": true|false, ' +
                  '"seen": "one or two words for what is actually pictured"}.',
              },
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });
      // The vision model sometimes appends stray text after the JSON; the
      // verdict object is flat, so the first {...} span is the whole answer.
      const raw = response.text ?? '{}';
      const jsonSpan = raw.slice(raw.indexOf('{'), raw.indexOf('}') + 1);
      const verdict = verdictSchema.parse(JSON.parse(jsonSpan));
      existing[key] = {
        key,
        german: display,
        translation: word.translation,
        match: verdict.match,
        seen: verdict.seen,
      };
      audited += 1;
      if (!verdict.match) {
        console.log(`MISMATCH ${key}: expected "${word.translation}", saw "${verdict.seen}"`);
      }
      writeFileSync(AUDIT_FILE, JSON.stringify(existing, null, 2) + '\n');
    } catch (error) {
      console.error(`audit failed ${key}: ${String(error).slice(0, 120)}`);
    }
  }
  const total = Object.values(existing);
  console.log(
    `audited ${audited} new; ledger ${total.length} total, ` +
      `${total.filter((entry) => !entry.match).length} flagged mismatches.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
