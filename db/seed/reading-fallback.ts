import type { z } from 'zod';
import type { richtigFalschTaskSchema } from '@/lib/exercises/reading-tasks';

// Curated A1 reading exercises (owner decision, 2026-07-10 A1-only scope):
// the daily reading slot stays fully walkable without the brain. Each text is
// a real Goethe A1 format (sign or note), within the 45-word A1 cap, with a
// verifiable richtig/falsch key. Selection is by day ordinal, no RNG.

export type RichtigFalschTask = z.infer<typeof richtigFalschTaskSchema>;

export interface FallbackReadingExercise {
  readonly id: string;
  readonly format: 'sign' | 'note';
  readonly title: string;
  readonly task: RichtigFalschTask;
}

export const A1_READING_FALLBACKS: readonly FallbackReadingExercise[] = [
  {
    id: 'zettel-kueche',
    format: 'note',
    title: 'Ein Zettel in der Küche',
    task: {
      format: 'richtig-falsch',
      text:
        'Hallo Anna! Ich gehe heute um 8 Uhr zur Arbeit. Das Brot ist in der Küche. ' +
        'Der Kaffee ist auch da. Bitte kauf Milch und Käse. Bis heute Abend! Dein Max',
      items: [
        { statement: 'Max geht heute zur Arbeit.', answer: true },
        { statement: 'Das Brot ist in der Küche.', answer: true },
        { statement: 'Anna soll Brot kaufen.', answer: false },
      ],
    },
  },
  {
    id: 'schild-baeckerei',
    format: 'sign',
    title: 'Ein Schild an der Bäckerei',
    task: {
      format: 'richtig-falsch',
      text:
        'Bäckerei Schmidt. Öffnungszeiten: Montag bis Freitag 7 bis 18 Uhr. ' +
        'Samstag 8 bis 12 Uhr. Sonntag geschlossen. Frisches Brot und Kuchen jeden Tag!',
      items: [
        { statement: 'Die Bäckerei ist am Sonntag offen.', answer: false },
        { statement: 'Am Samstag öffnet die Bäckerei um 8 Uhr.', answer: true },
        { statement: 'Es gibt jeden Tag frisches Brot.', answer: true },
      ],
    },
  },
  {
    id: 'zettel-arzt',
    format: 'note',
    title: 'Eine Nachricht von der Praxis',
    task: {
      format: 'richtig-falsch',
      text:
        'Liebe Frau Müller, der Termin beim Arzt ist am Montag um 10 Uhr. ' +
        'Bitte bringen Sie Ihre Karte mit. Die Praxis ist in der Bahnhofstraße 5. ' +
        'Mit freundlichen Grüßen, Praxis Dr. Weber',
      items: [
        { statement: 'Der Termin ist am Montag.', answer: true },
        { statement: 'Die Praxis ist am Bahnhofsplatz 12.', answer: false },
        { statement: 'Frau Müller soll ihre Karte mitbringen.', answer: true },
      ],
    },
  },
];

export function fallbackReadingFor(now: Date): FallbackReadingExercise {
  const dayOrdinal = Math.floor(now.getTime() / 86_400_000);
  return A1_READING_FALLBACKS[dayOrdinal % A1_READING_FALLBACKS.length] as FallbackReadingExercise;
}
