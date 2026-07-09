import type { Article } from '@/lib/db/curriculum';

// The article color convention (PRD 3.4, rule 6), defined once as a token:
// blue der, red die, green das. Article identity is always ALSO conveyed as
// text; color is never the only carrier (GT-404 accessibility rule).

export const ARTICLE_COLORS: Readonly<Record<Article, string>> = {
  der: '#1d4ed8',
  die: '#b91c1c',
  das: '#15803d',
};
