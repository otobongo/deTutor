import type { FsrsCardState } from '@/lib/db/learner';
import { isDue } from './scheduler';

// Review queue engine (GT-105). Pure selection and ordering; persistence and
// rating stay in their own layers. UI contract for consumers: present one
// item at a time, wait for the learner's answer, rate, then advance.

export type WarmupItem =
  | { readonly kind: 'review'; readonly card: FsrsCardState }
  // Disguised retest items (GT-304) ride the same queue and must be visually
  // indistinguishable from reviews. Their results write to RetentionScore,
  // never to FSRS card states.
  | { readonly kind: 'retest'; readonly retestId: string; readonly unitId: string };

export type InjectExtras = (items: readonly WarmupItem[]) => readonly WarmupItem[];

// The GT-304 injection seam: default is a no-op; the spaced retest scheduler
// replaces it to weave retest items into warm-ups unannounced.
export const noExtras: InjectExtras = (items) => items;

export function dueCards(
  cards: readonly FsrsCardState[],
  now: Date,
  limit: number,
): FsrsCardState[] {
  return cards
    .filter((card) => isDue(card, now))
    .sort((a, b) => {
      const overdueA = now.getTime() - new Date(a.due).getTime();
      const overdueB = now.getTime() - new Date(b.due).getTime();
      return overdueB - overdueA || a.wordId.localeCompare(b.wordId);
    })
    .slice(0, Math.max(0, limit));
}

export function buildWarmupQueue(
  cards: readonly FsrsCardState[],
  now: Date,
  limit: number,
  injectExtras: InjectExtras = noExtras,
): readonly WarmupItem[] {
  const reviews: WarmupItem[] = dueCards(cards, now, limit).map((card) => ({
    kind: 'review',
    card,
  }));
  return injectExtras(reviews);
}
