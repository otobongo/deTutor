import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';

// Word review (owner tooling): the full corpus with translations, IPA,
// examples, and the translation-audit verdict, so every word is manually
// confirmable. Flagged words sort first; ?level=A1 filters.

export const dynamic = 'force-dynamic';

interface AuditEntry {
  ok: boolean;
  better: string;
  stored: string;
}

export default async function WordsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; flagged?: string }>;
}) {
  const params = await searchParams;
  const levelFilter = params.level?.toUpperCase();
  const flaggedOnly = params.flagged === '1';

  const auditFile = path.join(process.cwd(), 'db', 'seed', 'translation-audit.json');
  const audit: Record<string, AuditEntry> = existsSync(auditFile)
    ? (JSON.parse(readFileSync(auditFile, 'utf8')) as Record<string, AuditEntry>)
    : {};

  const words = cumulativeCorpus('B1')
    .filter((word) => !levelFilter || word.cefrLevel === levelFilter)
    .filter((word) => !flaggedOnly || (audit[word.id] && !audit[word.id]?.ok))
    .sort((a, b) => {
      const rank = (id: string) => (audit[id] === undefined ? 1 : audit[id]?.ok ? 2 : 0);
      return rank(a.id) - rank(b.id) || a.frequencyRank - b.frequencyRank;
    });

  const flaggedCount = Object.values(audit).filter((entry) => !entry.ok).length;

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Word review</h1>
      <p data-testid="words-summary">
        {words.length} words shown. Translation audit: {Object.keys(audit).length} checked,{' '}
        {flaggedCount} flagged (shown first).
      </p>
      <p className="flex gap-3 text-sm">
        {['A1', 'A2', 'B1'].map((level) => (
          <Link key={level} className="underline" href={`/words?level=${level}`}>
            {level}
          </Link>
        ))}
        <Link className="underline" href="/words?flagged=1">
          flagged only
        </Link>
        <Link className="underline" href="/words">
          all
        </Link>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b px-2 py-1">Word</th>
              <th className="border-b px-2 py-1">Translation</th>
              <th className="border-b px-2 py-1">IPA</th>
              <th className="border-b px-2 py-1">Example</th>
              <th className="border-b px-2 py-1">Audit</th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => {
              const verdict = audit[word.id];
              return (
                <tr key={word.id} data-testid="word-row" data-level={word.cefrLevel}>
                  <td className="border-b px-2 py-1 font-medium">
                    {word.article ? `${word.article} ` : ''}
                    {word.german}
                    <span className="ml-1 text-xs text-ink-subtle">{word.cefrLevel}</span>
                  </td>
                  <td className="border-b px-2 py-1">{word.translation}</td>
                  <td className="border-b px-2 py-1 text-xs">{word.ipa ?? 'pending'}</td>
                  <td className="border-b px-2 py-1 text-xs">{word.exampleDe ?? 'pending'}</td>
                  <td className="border-b px-2 py-1 text-xs">
                    {verdict === undefined ? (
                      <span className="text-ink-subtle">unchecked</span>
                    ) : verdict.ok ? (
                      <span className="text-success">✓</span>
                    ) : (
                      <span className="text-error">was: {verdict.stored}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
