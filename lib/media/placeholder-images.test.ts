import { describe, expect, it } from 'vitest';
import { ARTICLE_COLORS } from '@/lib/design/tokens';
import { mediaAssetRefSchema } from '@/lib/db/curriculum';
import { buildPlaceholderSvg, placeholderAssetRef } from './placeholder-images';
import { PlaceholderProvider } from './placeholder-provider';

const provider = new PlaceholderProvider();

describe('placeholder images (GT-006)', () => {
  it('is deterministic: two calls yield identical assets', async () => {
    const first = await provider.getImage('der Tisch', 'flat');
    const second = await provider.getImage('der Tisch', 'flat');
    expect(second).toEqual(first);
    expect(buildPlaceholderSvg('die Katze', 'render')).toBe(
      buildPlaceholderSvg('die Katze', 'render'),
    );
  });

  it('color-codes der/die/das as blue/red/green from the shared token', async () => {
    const der = await provider.getImage('der Tisch', 'flat');
    const die = await provider.getImage('die Katze', 'flat');
    const das = await provider.getImage('das Haus', 'flat');
    for (const [asset, article] of [
      [der, 'der'],
      [die, 'die'],
      [das, 'das'],
    ] as const) {
      expect(asset.source.type).toBe('inline-svg');
      if (asset.source.type === 'inline-svg') {
        expect(asset.source.svg).toContain(ARTICLE_COLORS[article]);
        expect(asset.source.svg).toContain(`>${article}</tspan>`);
      }
    }
  });

  it('renders non-noun words without an article color', () => {
    const svg = buildPlaceholderSvg('gehen', 'flat');
    for (const color of Object.values(ARTICLE_COLORS)) {
      expect(svg).not.toContain(color);
    }
  });

  it('makes flat and render visually distinct', () => {
    const flat = buildPlaceholderSvg('der Tisch', 'flat');
    const render = buildPlaceholderSvg('der Tisch', 'render');
    expect(flat).not.toBe(render);
    expect(render).toContain('radialGradient');
    expect(render).toContain('ellipse');
    expect(flat).not.toContain('radialGradient');
  });

  it('writes the asset ref with key {word}:{style} through the schema', () => {
    const ref = placeholderAssetRef('der Tisch', 'flat');
    expect(ref).toEqual({
      kind: 'image',
      key: 'der Tisch:flat',
      styleOrClipId: 'flat',
      status: 'placeholder',
    });
    expect(mediaAssetRefSchema.safeParse(ref).success).toBe(true);
  });

  it('keys assets identically to the future generated assets', async () => {
    const asset = await provider.getImage('das Brötchen', 'render');
    expect(asset.key).toBe('das Brötchen:render');
  });

  it('escapes XML-unsafe characters in the word', () => {
    const svg = buildPlaceholderSvg('Fisch & Chips <test>', 'flat');
    expect(svg).toContain('Fisch &amp; Chips &lt;test&gt;');
    expect(svg).not.toContain('<test>');
  });
});
