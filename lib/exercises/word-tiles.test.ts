import { describe, expect, it } from 'vitest';
import { gradeTileOrder, shuffledTiles, TILE_ITEMS, type TileItem } from './word-tiles';

const nowIso = '2026-07-09T08:00:00.000Z';
const kaffee = TILE_ITEMS[0] as TileItem;

describe('word-tile construction (GT-210)', () => {
  it('accepts every defined valid order (V2 variants)', () => {
    expect(gradeTileOrder(kaffee, ['ich', 'möchte', 'heute', 'Kaffee'], nowIso).correct).toBe(true);
    expect(gradeTileOrder(kaffee, ['heute', 'möchte', 'ich', 'Kaffee'], nowIso).correct).toBe(true);
  });

  it('rejects verb-third and logs category "order"', () => {
    const result = gradeTileOrder(kaffee, ['heute', 'ich', 'möchte', 'Kaffee'], nowIso);
    expect(result.correct).toBe(false);
    expect(result.logEntry?.category).toBe('order');
    expect(result.logEntry?.context).toContain('heute ich möchte Kaffee');
  });

  it('refuses submissions that are not a reordering of the tiles', () => {
    expect(() => gradeTileOrder(kaffee, ['ich', 'möchte', 'Kaffee'], nowIso)).toThrow(
      /exactly the provided tiles/,
    );
  });

  it('never presents tiles already in an accepted order, deterministically', () => {
    for (const item of TILE_ITEMS) {
      const shuffled = shuffledTiles(item);
      expect(shuffledTiles(item)).toEqual(shuffled);
      expect([...shuffled].sort()).toEqual([...item.tiles].sort());
      const matchesAccepted = item.acceptedOrders.some((order) =>
        order.every((tile, index) => tile === shuffled[index]),
      );
      expect(matchesAccepted).toBe(false);
    }
  });

  it('completion result feeds the session score (correct flag exposed)', () => {
    const result = gradeTileOrder(kaffee, ['ich', 'möchte', 'heute', 'Kaffee'], nowIso);
    expect(result).toHaveProperty('correct', true);
    expect(result.acceptedExample.length).toBeGreaterThan(0);
  });
});
