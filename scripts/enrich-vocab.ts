import './load-env';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { vocabularyWordSchema, type VocabularyWord } from '@/lib/db/curriculum';
import { getGeminiClient } from '@/lib/gemini/client';

// GT-D1: fill ipa, exampleDe, exampleEn for corpus words. Idempotent and
// resumable by construction: words that already carry an ipa are skipped, so
// an interrupted run continues where it stopped. Batched to keep call counts
// sane; every batch is schema-validated and written back immediately.

const BATCH_SIZE = 20;
const root = path.resolve(__dirname, '..');

const enrichmentSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().min(1),
      ipa: z.string().min(1),
      exampleDe: z.string().min(1),
      exampleEn: z.string().min(1),
    }),
  ),
});

async function enrichBatch(words: VocabularyWord[]): Promise<Map<string, VocabularyWord>> {
  const client = getGeminiClient();
  const list = words
    .map(
      (word) =>
        `- id: ${word.id}, word: ${word.article ? `${word.article} ` : ''}${word.german}` +
        ` (${word.translation}), level: ${word.cefrLevel}`,
    )
    .join('\n');
  const result = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          'For each German vocabulary entry below, provide the IPA transcription of the German ' +
          'word (without the article, no slashes) and one short example sentence at the given ' +
          'CEFR level with its natural English translation.\n' +
          `${list}\n` +
          'Return JSON: {"entries":[{"id":string,"ipa":string,"exampleDe":string,"exampleEn":string}]} ' +
          'with exactly one entry per id, ids copied verbatim.',
      },
    ],
    enrichmentSchema,
    { callSite: 'vocab-enrichment' },
  );
  const byId = new Map<string, VocabularyWord>();
  for (const entry of result.entries) {
    const word = words.find((candidate) => candidate.id === entry.id);
    if (!word) continue;
    byId.set(
      entry.id,
      vocabularyWordSchema.parse({
        ...word,
        ipa: entry.ipa,
        exampleDe: entry.exampleDe,
        exampleEn: entry.exampleEn,
      }),
    );
  }
  return byId;
}

async function enrichLevelFile(level: 'a1' | 'a2' | 'b1'): Promise<void> {
  const file = path.join(root, 'db', 'seed', 'vocab', `${level}.json`);
  const words = (JSON.parse(readFileSync(file, 'utf8')) as unknown[]).map((entry) =>
    vocabularyWordSchema.parse(entry),
  );
  const pending = words.filter((word) => word.ipa === null);
  console.log(`${level}: ${pending.length} of ${words.length} words need enrichment`);
  let failures = 0;

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    if (failures >= 10) {
      console.error(`${level}: too many failed batches; stopping this level.`);
      break;
    }
    const batch = pending.slice(start, start + BATCH_SIZE);
    try {
      const enriched = await enrichBatch(batch);
      const updated = words.map((word) => enriched.get(word.id) ?? word);
      words.splice(0, words.length, ...updated);
      writeFileSync(file, JSON.stringify(words, null, 2) + '\n');
      console.log(
        `${level}: ${Math.min(start + BATCH_SIZE, pending.length)}/${pending.length} ` +
          `(${enriched.size}/${batch.length} in batch)`,
      );
    } catch (error) {
      // A stubborn batch must not sink the run: skip it and keep going; the
      // next invocation retries skipped words automatically (ipa still null).
      failures += 1;
      console.error(`${level}: batch at ${start} failed (${String(error)}); skipping.`);
    }
  }
}

async function main(): Promise<void> {
  const levelFlag = process.argv.indexOf('--level');
  const levels =
    levelFlag === -1
      ? (['a1', 'a2', 'b1'] as const)
      : ([process.argv[levelFlag + 1]?.toLowerCase()] as ('a1' | 'a2' | 'b1')[]);
  for (const level of levels) {
    await enrichLevelFile(level);
  }
  console.log('Enrichment complete.');
}

main().catch(() => {
  process.exitCode = 1;
});
