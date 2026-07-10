import type { Dialogue } from '@/lib/exercises/dialogue';

// Curated A1 dialogues (owner decision 2026-07-10, A1-only scope): the
// dialogue lab stays fully walkable without the brain. Short everyday
// conversations within the A1 corpus; selection is by day ordinal, no RNG.

export const A1_DIALOGUE_FALLBACKS: readonly Dialogue[] = [
  {
    title: 'Im Café',
    turns: [
      { speaker: 'Anna', text: 'Guten Morgen! Was möchtest du trinken?' },
      { speaker: 'Ben', text: 'Einen Kaffee, bitte. Und du?' },
      { speaker: 'Anna', text: 'Ich trinke einen Tee mit Milch.' },
      { speaker: 'Ben', text: 'Möchtest du auch ein Brot essen?' },
      { speaker: 'Anna', text: 'Ja, gern. Das Brot hier ist sehr gut.' },
      { speaker: 'Ben', text: 'Gut, ich kaufe zwei Brote und den Kaffee.' },
    ],
  },
  {
    title: 'Die neue Wohnung',
    turns: [
      { speaker: 'Anna', text: 'Wie ist deine neue Wohnung?' },
      { speaker: 'Ben', text: 'Sie ist klein, aber sehr schön.' },
      { speaker: 'Anna', text: 'Hast du eine Küche?' },
      { speaker: 'Ben', text: 'Ja, die Küche ist neu. Der Tisch ist groß.' },
      { speaker: 'Anna', text: 'Und wo ist die Wohnung?' },
      { speaker: 'Ben', text: 'In der Stadt, neben dem Bahnhof.' },
      { speaker: 'Anna', text: 'Das ist gut! Ich komme am Samstag.' },
    ],
  },
  {
    title: 'Am Bahnhof',
    turns: [
      { speaker: 'Anna', text: 'Entschuldigung, wann kommt der Zug nach Berlin?' },
      { speaker: 'Ben', text: 'Der Zug kommt um zehn Uhr.' },
      { speaker: 'Anna', text: 'Danke! Wo kaufe ich eine Fahrkarte?' },
      { speaker: 'Ben', text: 'Da links, am Automaten.' },
      { speaker: 'Anna', text: 'Was kostet die Fahrkarte?' },
      { speaker: 'Ben', text: 'Zehn Euro. Gute Reise!' },
    ],
  },
];

export function fallbackDialogueFor(now: Date): Dialogue {
  const dayOrdinal = Math.floor(now.getTime() / 86_400_000);
  return A1_DIALOGUE_FALLBACKS[dayOrdinal % A1_DIALOGUE_FALLBACKS.length] as Dialogue;
}
