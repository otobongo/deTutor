import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import { StatusChip } from '@/app/components/ui';

// Generated-media catalog: every image from the manifest with its word,
// translation, level, style, and the vision-audit verdict, so generation
// quality is reviewable at a glance. Flagged cards sort first.

export const dynamic = 'force-dynamic';

interface AuditEntry {
  match: boolean;
  seen: string;
}

interface CatalogCard {
  key: string;
  url: string;
  german: string;
  translation: string;
  level: string;
  style: string;
  audit: AuditEntry | null;
}

function loadCatalog(): CatalogCard[] {
  const mediaDir = path.join(process.cwd(), 'public', 'media');
  const manifestFile = path.join(mediaDir, 'manifest.json');
  if (!existsSync(manifestFile)) return [];
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
    images: Record<string, string>;
  };
  const auditFile = path.join(mediaDir, 'image-audit.json');
  const audit: Record<string, AuditEntry> = existsSync(auditFile)
    ? (JSON.parse(readFileSync(auditFile, 'utf8')) as Record<string, AuditEntry>)
    : {};
  const corpus = cumulativeCorpus('B1');
  const byDisplay = new Map(
    corpus.map((word) => [word.article ? `${word.article} ${word.german}` : word.german, word]),
  );
  const cards = Object.entries(manifest.images).map(([key, file]): CatalogCard => {
    const [display, style] = key.split(':') as [string, string];
    const word = byDisplay.get(display);
    return {
      key,
      url: `/media/${file}`,
      german: display,
      translation: word?.translation ?? '(unknown word)',
      level: word?.cefrLevel ?? '?',
      style,
      audit: audit[key] ?? null,
    };
  });
  // Flagged mismatches first, then unaudited, then by level and word.
  return cards.sort((a, b) => {
    const rank = (card: CatalogCard) => (card.audit === null ? 1 : card.audit.match ? 2 : 0);
    return (
      rank(a) - rank(b) ||
      a.level.localeCompare(b.level) ||
      a.german.localeCompare(b.german, 'de') ||
      a.style.localeCompare(b.style)
    );
  });
}

export default function CatalogPage() {
  const cards = loadCatalog();
  const flagged = cards.filter((card) => card.audit && !card.audit.match);
  const audited = cards.filter((card) => card.audit !== null);
  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Image catalog</h1>
      <p data-testid="catalog-summary">
        {cards.length} generated images. Vision audit: {audited.length} checked, {flagged.length}{' '}
        flagged for review (shown first). Regenerate a flagged image by deleting its file and
        manifest entry, then rerunning npm run generate:images.
      </p>
      {cards.length === 0 ? (
        <p>No generated images yet. Run npm run generate:images first.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li
              key={card.key}
              className={`flex flex-col gap-1 rounded-lg border bg-surface p-2 ${
                card.audit && !card.audit.match ? 'border-2 border-error' : ''
              }`}
              data-testid="catalog-card"
              data-flagged={card.audit ? String(!card.audit.match) : 'unaudited'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.url}
                alt={`${card.german}: ${card.translation} (${card.style})`}
                className="aspect-[4/3] w-full rounded object-cover"
                loading="lazy"
              />
              <p className="text-sm font-medium" lang="de">
                {card.german}
              </p>
              <p className="text-xs text-ink-muted">
                {card.translation} · {card.level} · {card.style}
              </p>
              {card.audit ? (
                <StatusChip tone={card.audit.match ? 'success' : 'neutral'}>
                  {card.audit.match ? '✓ verified' : `✗ audit saw: ${card.audit.seen}`}
                </StatusChip>
              ) : (
                <p className="text-xs text-ink-subtle">not audited yet</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
