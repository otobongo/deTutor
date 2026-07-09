import './load-env';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { vocabularyWordSchema } from '@/lib/db/curriculum';
import { getGeminiClient } from '@/lib/gemini/client';

// Corpus translation audit. vocabforge sometimes supplies rare senses as the
// only translation (Hund -> "mine car", Zug -> "strain"), which poisons
// cards, examples, and images downstream. Every word goes through the brain:
// is the stored translation the common, learner-appropriate primary meaning?
// Flags land in db/seed/translation-audit.json (the manual review ledger);
// --apply writes the corrections into the seed files and clears enrichment
// on corrected words so their examples regenerate from the right sense.

const BATCH = 25;
const AUDIT_FILE = path.join(process.cwd(), 'db', 'seed', 'translation-audit.json');

const batchVerdictSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().min(1),
      ok: z.boolean(),
      better: z.string().min(1),
    }),
  ),
});

export interface TranslationAuditEntry {
  id: string;
  german: string;
  stored: string;
  ok: boolean;
  better: string;
}

function loadLedger(): Record<string, TranslationAuditEntry> {
  try {
    return JSON.parse(readFileSync(AUDIT_FILE, 'utf8')) as Record<string, TranslationAuditEntry>;
  } catch {
    return {};
  }
}

async function auditAll(): Promise<void> {
  const client = getGeminiClient();
  const ledger = loadLedger();
  for (const level of ['a1', 'a2', 'b1']) {
    const file = path.join(process.cwd(), 'db', 'seed', 'vocab', `${level}.json`);
    const words = (JSON.parse(readFileSync(file, 'utf8')) as unknown[]).map((entry) =>
      vocabularyWordSchema.parse(entry),
    );
    const pending = words.filter((word) => !ledger[word.id]);
    console.log(`${level}: auditing ${pending.length} of ${words.length}`);
    for (let start = 0; start < pending.length; start += BATCH) {
      const batch = pending.slice(start, start + BATCH);
      const list = batch
        .map(
          (word) =>
            `- id: ${word.id} | German: ${word.article ? `${word.article} ` : ''}${word.german} | stored translation: "${word.translation}"`,
        )
        .join('\n');
      try {
        const verdict = await client.generateJson(
          [
            {
              role: 'learner',
              text:
                'Audit these German-to-English translations for an A1-B1 learner. For each, ' +
                'judge whether the stored translation gives the COMMON primary meaning(s) of the ' +
                'German word. Rare, technical, or jargon senses are wrong even if dictionaries ' +
                'list them. In "better", give the best 1-3 common meanings, comma separated ' +
                '(repeat the stored translation when it is fine).\n' +
                `${list}\n` +
                'Return JSON: {"entries":[{"id":string,"ok":boolean,"better":string}]} with one ' +
                'entry per id, ids verbatim.',
            },
          ],
          batchVerdictSchema,
          { callSite: 'vocab-enrichment' },
        );
        for (const entry of verdict.entries) {
          const word = batch.find((candidate) => candidate.id === entry.id);
          if (!word) continue;
          ledger[word.id] = {
            id: word.id,
            german: word.article ? `${word.article} ${word.german}` : word.german,
            stored: word.translation,
            ok: entry.ok,
            better: entry.better,
          };
          if (!entry.ok) {
            console.log(`FLAG ${word.id}: "${word.translation}" -> "${entry.better}"`);
          }
        }
        writeFileSync(AUDIT_FILE, JSON.stringify(ledger, null, 2) + '\n');
      } catch (error) {
        console.error(`batch at ${level}/${start} failed: ${String(error).slice(0, 120)}`);
      }
    }
  }
  const all = Object.values(ledger);
  console.log(`ledger: ${all.length} audited, ${all.filter((entry) => !entry.ok).length} flagged.`);
}

function applyFixes(): void {
  const ledger = loadLedger();
  const flagged = Object.values(ledger).filter((entry) => !entry.ok);
  let applied = 0;
  for (const level of ['a1', 'a2', 'b1']) {
    const file = path.join(process.cwd(), 'db', 'seed', 'vocab', `${level}.json`);
    const words = JSON.parse(readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
    let touched = false;
    for (const word of words) {
      const flag = flagged.find((entry) => entry.id === word.id);
      if (flag && word.translation !== flag.better) {
        word.translation = flag.better;
        // Examples were generated from the wrong sense; clear enrichment so
        // the next enrich run rebuilds them from the corrected translation.
        word.ipa = null;
        word.exampleDe = null;
        word.exampleEn = null;
        touched = true;
        applied += 1;
      }
    }
    if (touched) writeFileSync(file, JSON.stringify(words, null, 2) + '\n');
  }
  console.log(`applied ${applied} corrections (enrichment cleared on corrected words).`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--apply')) {
    applyFixes();
    return;
  }
  await auditAll();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
