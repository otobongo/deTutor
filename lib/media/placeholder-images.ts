import { ARTICLES, imageAssetKey, type Article, type ImageStyle } from '@/lib/db/curriculum';
import { mediaAssetRefSchema, type MediaAssetRef } from '@/lib/db/curriculum';
import { ARTICLE_COLORS } from '@/lib/design/tokens';
import type { ImageAsset } from './provider';

// Deterministic SVG tiles (GT-006). The same word plus style always yields
// byte-identical output so caching paths behave exactly as they will with
// generated assets. Nouns arrive as the full package ("der Tisch") and the
// article renders in its convention color.

const TEXT_COLOR = '#1f2937';

// FNV-1a: stable, dependency-free, good spread for short strings.
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitArticle(word: string): { article: Article | null; rest: string } {
  const [first, ...restParts] = word.split(' ');
  const candidate = ARTICLES.find((article) => article === first);
  if (candidate && restParts.length > 0) {
    return { article: candidate, rest: restParts.join(' ') };
  }
  return { article: null, rest: word };
}

function wordLabel(word: string): string {
  const { article, rest } = splitArticle(word);
  if (article) {
    return (
      `<tspan fill="${ARTICLE_COLORS[article]}" font-weight="700">${escapeXml(article)}</tspan>` +
      `<tspan fill="${TEXT_COLOR}"> ${escapeXml(rest)}</tspan>`
    );
  }
  return `<tspan fill="${TEXT_COLOR}">${escapeXml(word)}</tspan>`;
}

export function buildPlaceholderSvg(word: string, style: ImageStyle): string {
  const hue = hashString(`${word}:${style}`) % 360;
  const label = wordLabel(word);
  const text =
    `<text x="200" y="150" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="system-ui, sans-serif" font-size="32">${label}</text>`;

  if (style === 'flat') {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" ` +
      `aria-label="${escapeXml(word)} (flat placeholder)">` +
      `<rect width="400" height="300" fill="hsl(${hue}, 70%, 88%)"/>` +
      text +
      `</svg>`
    );
  }

  // The render style reads as pseudo-3D: gradient depth, floor shadow, and a
  // raised card, so the Settings style toggle is visually testable (PRD 7.5).
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" ` +
    `aria-label="${escapeXml(word)} (render placeholder)">` +
    `<defs><radialGradient id="bg" cx="50%" cy="35%" r="80%">` +
    `<stop offset="0%" stop-color="hsl(${hue}, 75%, 92%)"/>` +
    `<stop offset="100%" stop-color="hsl(${hue}, 55%, 72%)"/>` +
    `</radialGradient></defs>` +
    `<rect width="400" height="300" fill="url(#bg)"/>` +
    `<ellipse cx="200" cy="248" rx="120" ry="18" fill="hsl(${hue}, 40%, 55%)" opacity="0.45"/>` +
    `<rect x="80" y="70" width="240" height="160" rx="16" fill="hsl(${hue}, 70%, 95%)" ` +
    `stroke="hsl(${hue}, 45%, 62%)" stroke-width="2"/>` +
    text.replace('y="150"', 'y="152"') +
    `</svg>`
  );
}

export function buildPlaceholderImageAsset(word: string, style: ImageStyle): ImageAsset {
  return {
    key: imageAssetKey(word, style) as ImageAsset['key'],
    word,
    style,
    source: { type: 'inline-svg', svg: buildPlaceholderSvg(word, style) },
  };
}

// Placeholder refs persist through the same MediaAssetRef shape and keyspace
// as generated assets (GT-006 task 2); callers write this via the converter.
export function placeholderAssetRef(word: string, style: ImageStyle): MediaAssetRef {
  return mediaAssetRefSchema.parse({
    kind: 'image',
    key: imageAssetKey(word, style),
    styleOrClipId: style,
    status: 'placeholder',
  });
}
