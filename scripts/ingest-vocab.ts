import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { CURATED_TRANSLATIONS } from '@/db/seed/curated-translations';
import { ARTICLES, type Article } from '@/lib/db/curriculum';
import { ingest, type VocabforgeRow } from './ingest/core';

// GT-102 runner: reads db/datasets/ (run scripts/download-datasets.sh first),
// writes staged seed files to db/seed/vocab/ plus the article review and
// translation pending ledgers. Idempotent: pure core plus deterministic
// serialization means identical inputs always produce identical files.

const root = path.resolve(__dirname, '..');
const datasets = path.join(root, 'db', 'datasets');
const outDir = path.join(root, 'db', 'seed', 'vocab');

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function readCsv(file: string): string[][] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function loadVocabforge(): VocabforgeRow[] {
  const [header, ...rows] = readCsv(path.join(datasets, 'cefr_vocabulary.csv'));
  const index = (name: string) => header?.indexOf(name) ?? -1;
  const lemma = index('lemma');
  const category = index('category');
  const translation = index('translation');
  const article = index('article');
  return rows.map((row) => ({
    lemma: row[lemma] ?? '',
    category: row[category] ?? '',
    translation: row[translation] ?? '',
    article: row[article] ?? '',
  }));
}

function loadGenusMap(): Map<string, Set<Article>> {
  const [header, ...rows] = readCsv(path.join(datasets, 'german-nouns.csv'));
  const genusColumns = (header ?? [])
    .map((name, column) => ({ name, column }))
    .filter(({ name }) => name === 'genus' || /^genus \d$/.test(name))
    .map(({ column }) => column);
  const lemmaColumn = (header ?? []).indexOf('lemma');
  const byGenus: Record<string, Article> = { m: 'der', f: 'die', n: 'das' };
  const map = new Map<string, Set<Article>>();
  for (const row of rows) {
    const lemma = row[lemmaColumn];
    if (!lemma) continue;
    for (const column of genusColumns) {
      const article = byGenus[(row[column] ?? '').trim()];
      if (article && ARTICLES.includes(article)) {
        const existing = map.get(lemma) ?? new Set<Article>();
        existing.add(article);
        map.set(lemma, existing);
      }
    }
  }
  return map;
}

function loadFrequencyRanks(): Map<string, number> {
  const ranks = new Map<string, number>();
  readFileSync(path.join(datasets, 'de-frequency-50k.txt'), 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const word = line.split(' ')[0];
      if (word && !ranks.has(word)) ranks.set(word, index + 1);
    });
  return ranks;
}

function loadJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}

function main(): void {
  const wortlisteLines = readFileSync(path.join(datasets, 'goethe-b1-wortliste.txt'), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const result = ingest({
    wortlisteLines,
    vocabforgeRows: loadVocabforge(),
    genusByLemma: loadGenusMap(),
    frequencyRanks: loadFrequencyRanks(),
    curated: CURATED_TRANSLATIONS,
    themeOverrides: loadJson(path.join(root, 'db', 'seed', 'theme-overrides.json'), {}),
    picturableOverrides: loadJson(path.join(root, 'db', 'seed', 'picturable-overrides.json'), {}),
  });

  mkdirSync(outDir, { recursive: true });
  for (const level of ['A1', 'A2', 'B1'] as const) {
    const words = result.words.filter((word) => word.cefrLevel === level);
    writeFileSync(
      path.join(outDir, `${level.toLowerCase()}.json`),
      JSON.stringify(words, null, 2) + '\n',
    );
    console.log(`${level}: ${words.length} words`);
  }
  writeFileSync(
    path.join(root, 'db', 'seed', 'article-review.json'),
    JSON.stringify(result.articleReview, null, 2) + '\n',
  );
  writeFileSync(
    path.join(root, 'db', 'seed', 'translation-pending.json'),
    JSON.stringify(result.translationPending, null, 2) + '\n',
  );
  console.log(
    `article review: ${result.articleReview.length}, translation pending: ${result.translationPending.length}`,
  );
}

main();
