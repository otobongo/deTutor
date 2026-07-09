import type { VocabularyWord } from '@/lib/db/curriculum';
import { ARTICLE_COLORS } from '@/lib/design/tokens';

// Vocabulary card (GT-201), rendering the exact system-prompt template:
// flags, article color-coded (and always present as text), IPA, Beispiel
// with translation. Enrichment-pending fields (null IPA/example) simply
// omit their lines until GT-D1 fills them.

export function VocabCard({ word }: { word: VocabularyWord }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border p-4 font-mono text-sm"
      data-testid={`vocab-card-${word.id}`}
    >
      <p>
        <span aria-hidden>🇩🇪 </span>
        {word.article ? (
          <>
            <span style={{ color: ARTICLE_COLORS[word.article] }} data-testid="card-article">
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
        <p>
          <span aria-hidden>🔊 </span>
          <span data-testid="card-ipa">{word.ipa}</span>
        </p>
      ) : null}
      {word.exampleDe ? (
        <div>
          <p>
            <span aria-hidden>📝 </span>Beispiel:{' '}
            <span data-testid="card-example">{word.exampleDe}</span>
          </p>
          {word.exampleEn ? <p className="pl-6 opacity-80">-&gt; {word.exampleEn}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
