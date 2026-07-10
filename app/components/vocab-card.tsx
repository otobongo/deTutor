import type { VocabularyWord } from '@/lib/db/curriculum';

// Vocabulary card (GT-201), rendering the exact system-prompt template:
// flags, article color-coded (and always present as text), IPA, Beispiel
// with translation. Enrichment-pending fields (null IPA/example) simply
// omit their lines until GT-D1 fills them.

export function VocabCard({ word }: { word: VocabularyWord }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border bg-surface p-4 text-sm"
      data-testid={`vocab-card-${word.id}`}
    >
      <p lang="de">
        <span aria-hidden>🇩🇪 </span>
        {word.article ? (
          <>
            <span
              style={{ color: `var(--article-${word.article})` }}
              className="font-semibold"
              data-testid="card-article"
            >
              {word.article}
            </span>{' '}
          </>
        ) : null}
        <span className="font-semibold" data-testid="card-german">
          {word.german}
        </span>
      </p>
      <p>
        <span aria-hidden>🇬🇧 </span>
        <span data-testid="card-translation">{word.translation}</span>
      </p>
      {word.ipa ? (
        <p className="font-mono text-ink-muted">
          <span aria-hidden>🔊 </span>
          <span data-testid="card-ipa">{word.ipa}</span>
        </p>
      ) : null}
      {word.exampleDe ? (
        <div className="rounded-sm bg-reading-surface p-2 font-reading text-reading-ink">
          <p lang="de">
            <span aria-hidden>📝 </span>Beispiel:{' '}
            <span data-testid="card-example">{word.exampleDe}</span>
          </p>
          {word.exampleEn ? <p className="pl-6 text-ink-muted">-&gt; {word.exampleEn}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
