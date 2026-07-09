import type { GrammarErrorLogEntry } from '@/lib/db/learner';

// Word-tile sentence construction (GT-210). Each item defines EVERY accepted
// order (V2 means adverbial-fronted variants are equally valid); anything
// else is a word-order error logged with category "order".

export interface TileItem {
  readonly id: string;
  readonly tiles: readonly string[];
  readonly acceptedOrders: readonly (readonly string[])[];
  readonly translation: string;
}

// Deterministic shuffle: rotate by a hash of the item id so tiles never
// present in an accepted order but stay stable per item (no RNG).
export function shuffledTiles(item: TileItem): string[] {
  let hash = 0x811c9dc5;
  for (const char of item.id) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const rotation = (hash % (item.tiles.length - 1)) + 1;
  const rotated = [...item.tiles.slice(rotation), ...item.tiles.slice(0, rotation)];
  const matchesAccepted = item.acceptedOrders.some(
    (order) => order.length === rotated.length && order.every((tile, i) => tile === rotated[i]),
  );
  return matchesAccepted ? [...rotated.slice(1), rotated[0] as string] : rotated;
}

export interface TileResult {
  readonly correct: boolean;
  readonly acceptedExample: readonly string[];
  readonly logEntry: GrammarErrorLogEntry | null;
}

export function gradeTileOrder(
  item: TileItem,
  submitted: readonly string[],
  nowIso: string,
): TileResult {
  const sortedTiles = [...item.tiles].sort();
  const sortedSubmitted = [...submitted].sort();
  if (
    sortedTiles.length !== sortedSubmitted.length ||
    sortedTiles.some((tile, index) => tile !== sortedSubmitted[index])
  ) {
    throw new Error('Submitted tiles must be exactly the provided tiles, reordered.');
  }
  const correct = item.acceptedOrders.some(
    (order) => order.length === submitted.length && order.every((tile, i) => tile === submitted[i]),
  );
  const acceptedExample = item.acceptedOrders[0] as readonly string[];
  return {
    correct,
    acceptedExample,
    logEntry: correct
      ? null
      : {
          category: 'order',
          item: item.id,
          context: `Tiles: built "${submitted.join(' ')}", accepted e.g. "${acceptedExample.join(' ')}"`,
          at: nowIso,
        },
  };
}

// A1 seed items. V2 rule: the conjugated verb is always second; fronting the
// adverbial is as valid as subject-first.
export const TILE_ITEMS: readonly TileItem[] = [
  {
    id: 'tiles-kaffee-heute',
    tiles: ['ich', 'möchte', 'heute', 'Kaffee'],
    acceptedOrders: [
      ['ich', 'möchte', 'heute', 'Kaffee'],
      ['heute', 'möchte', 'ich', 'Kaffee'],
    ],
    translation: 'I would like coffee today.',
  },
  {
    id: 'tiles-wohne-berlin',
    tiles: ['ich', 'wohne', 'in', 'Berlin'],
    acceptedOrders: [['ich', 'wohne', 'in', 'Berlin']],
    translation: 'I live in Berlin.',
  },
  {
    id: 'tiles-morgen-arbeite',
    tiles: ['morgen', 'arbeite', 'ich', 'nicht'],
    acceptedOrders: [
      ['morgen', 'arbeite', 'ich', 'nicht'],
      ['ich', 'arbeite', 'morgen', 'nicht'],
    ],
    translation: 'I am not working tomorrow.',
  },
];
