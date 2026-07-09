import { z } from 'zod';
import { levelSchema, skillSchema } from '@/lib/db/curriculum';

// Placement probe definitions (GT-106), data-driven per PRD 3.2. Conducted
// in English. Every probe is objectively checkable so placement stays fully
// deterministic (acceptance criterion); free-production assessment enters at
// the unit-test engine (GT-301), not here.

export const placementProbeSchema = z.object({
  id: z.string().min(1),
  level: levelSchema,
  skill: skillSchema,
  prompt: z.string().min(1),
  kind: z.enum(['multiple-choice', 'text']),
  options: z.array(z.string().min(1)).min(2).max(4).nullable(),
  // Accepted answers, compared case- and whitespace-insensitively.
  correctAnswers: z.array(z.string().min(1)).min(1),
});
export type PlacementProbe = z.infer<typeof placementProbeSchema>;

const probes: PlacementProbe[] = [
  // A1 stage: greeting comprehension, numbers, basic sentence comprehension,
  // vocabulary recognition, sein conjugation.
  {
    id: 'a1-greeting',
    level: 'A1',
    skill: 'listening',
    prompt: 'Someone says "Guten Morgen! Wie geht es dir?" What are they asking?',
    kind: 'multiple-choice',
    options: ['How you are doing', 'Where you live', 'What your name is', 'What time it is'],
    correctAnswers: ['How you are doing'],
  },
  {
    id: 'a1-numbers',
    level: 'A1',
    skill: 'listening',
    prompt: 'What number is "siebzehn"?',
    kind: 'multiple-choice',
    options: ['7', '17', '70', '27'],
    correctAnswers: ['17'],
  },
  {
    id: 'a1-sentence',
    level: 'A1',
    skill: 'reading',
    prompt: 'What does "Ich wohne in Berlin" mean?',
    kind: 'multiple-choice',
    options: ['I live in Berlin', 'I work in Berlin', 'I am visiting Berlin', 'I like Berlin'],
    correctAnswers: ['I live in Berlin'],
  },
  {
    id: 'a1-vocab',
    level: 'A1',
    skill: 'reading',
    prompt: 'Which word means "table"?',
    kind: 'multiple-choice',
    options: ['der Stuhl', 'der Tisch', 'das Fenster', 'die Tür'],
    correctAnswers: ['der Tisch'],
  },
  {
    id: 'a1-sein',
    level: 'A1',
    skill: 'writing',
    prompt: 'Complete with the right form of "sein": "Du ___ müde."',
    kind: 'text',
    options: null,
    correctAnswers: ['bist'],
  },
  // A2 stage: Perfekt recognition, Dativ pronoun choice, separable verb,
  // short reading, short dictation.
  {
    id: 'a2-perfekt',
    level: 'A2',
    skill: 'reading',
    prompt: 'Which sentence talks about the past?',
    kind: 'multiple-choice',
    options: [
      'Ich habe Pizza gegessen.',
      'Ich esse Pizza.',
      'Ich möchte Pizza essen.',
      'Ich esse gern Pizza.',
    ],
    correctAnswers: ['Ich habe Pizza gegessen.'],
  },
  {
    id: 'a2-dativ-pronoun',
    level: 'A2',
    skill: 'writing',
    prompt: 'Complete: "Kannst du ___ helfen?" (helfen takes Dativ)',
    kind: 'multiple-choice',
    options: ['mich', 'mir', 'ich', 'mein'],
    correctAnswers: ['mir'],
  },
  {
    id: 'a2-separable',
    level: 'A2',
    skill: 'writing',
    prompt: 'Put "anrufen" into the sentence: "Ich ___ dich morgen ___."',
    kind: 'multiple-choice',
    options: ['rufe ... an', 'anrufe ... (nothing)', 'rufe ... auf', 'an ... rufe'],
    correctAnswers: ['rufe ... an'],
  },
  {
    id: 'a2-reading',
    level: 'A2',
    skill: 'reading',
    prompt:
      '"Der Supermarkt ist wegen eines Feiertags geschlossen." Why is the supermarket closed?',
    kind: 'multiple-choice',
    options: ['A public holiday', 'Renovation work', 'A staff meeting', 'It is Sunday'],
    correctAnswers: ['A public holiday'],
  },
  {
    id: 'a2-dictation',
    level: 'A2',
    skill: 'listening',
    prompt: 'Type exactly what you hear: "Wir fahren am Samstag nach Hamburg."',
    kind: 'text',
    options: null,
    correctAnswers: ['Wir fahren am Samstag nach Hamburg.', 'Wir fahren am Samstag nach Hamburg'],
  },
  // B1 stage: subordinate clause completion, adjective ending, opinion
  // structure, listening gist, reading detail.
  {
    id: 'b1-subordinate',
    level: 'B1',
    skill: 'writing',
    prompt: 'Complete: "Ich bleibe zu Hause, weil ich krank ___."',
    kind: 'multiple-choice',
    options: ['bin', 'ist', 'sein', 'war ich'],
    correctAnswers: ['bin'],
  },
  {
    id: 'b1-adjective-ending',
    level: 'B1',
    skill: 'writing',
    prompt: 'Choose the correct form: "Ich suche einen ___ Tisch."',
    kind: 'multiple-choice',
    options: ['großen', 'großer', 'großes', 'groß'],
    correctAnswers: ['großen'],
  },
  {
    id: 'b1-opinion-structure',
    level: 'B1',
    skill: 'writing',
    prompt: 'Which sentence correctly introduces an opinion with "dass"?',
    kind: 'multiple-choice',
    options: [
      'Ich finde, dass die Stadt zu laut ist.',
      'Ich finde, dass die Stadt ist zu laut.',
      'Ich finde, die Stadt dass zu laut ist.',
      'Ich finde dass, die Stadt zu laut ist.',
    ],
    correctAnswers: ['Ich finde, dass die Stadt zu laut ist.'],
  },
  {
    id: 'b1-listening-gist',
    level: 'B1',
    skill: 'listening',
    prompt:
      '"Der Zug nach München fällt heute leider aus. Bitte nutzen Sie den Bus." What happened?',
    kind: 'multiple-choice',
    options: [
      'The train to Munich is cancelled',
      'The train to Munich is delayed',
      'The bus to Munich is cancelled',
      'The platform has changed',
    ],
    correctAnswers: ['The train to Munich is cancelled'],
  },
  {
    id: 'b1-reading-detail',
    level: 'B1',
    skill: 'reading',
    prompt:
      '"Die Wohnung wird erst ab dem ersten September vermietet, obwohl sie schon leer steht." When can you rent the apartment?',
    kind: 'multiple-choice',
    options: ['From September 1st', 'Immediately', 'From August 1st', 'It was already rented'],
    correctAnswers: ['From September 1st'],
  },
];

export const placementProbes: readonly PlacementProbe[] = probes.map((probe) =>
  placementProbeSchema.parse(probe),
);
