import type { Skill, VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import {
  B1_EXAM_BLUEPRINT,
  examModuleSchema,
  validateExamModule,
  type ExamModule,
} from './b1-exam';
import { articleItem, meaningItem } from './placeholder-unit-test';

// B1 exam content (GT-307 completion, owner-directed 2026-07-10): the brain
// writes each module's items into the code-owned blueprint on demand (deep
// tier, validated against the official part/item counts, retried once);
// the deterministic placeholder module keeps the exam walkable without the
// brain, labeled honestly at the page edge.

const MODULE_BRIEFS: Readonly<Record<Skill, string>> = {
  reading:
    'Lesen: Teil 1 everyday texts (blog/email), Teil 2 press articles, Teil 3 ' +
    'advertisements matching, Teil 4 opinion texts, Teil 5 official instructions.',
  listening:
    'Hören: Teil 1 short announcements, Teil 2 a guided tour or talk, Teil 3 an ' +
    'everyday conversation, Teil 4 a radio discussion. The stimulus field carries ' +
    'the spoken German text.',
  writing:
    'Schreiben: task 1 an informal email (80 words), task 2 a forum post stating an ' +
    'opinion (80 words), task 3 a semi-formal email (40 words).',
  speaking:
    'Sprechen: task 1 planning something together, task 2 presenting a topic, ' +
    'task 3 giving feedback and asking questions about a presentation.',
};

// B1 grammar items the tasks should exercise (from the seeded B1 units).
const B1_GRAMMAR_IDS = [
  'verb-final-subordinate',
  'dass-weil-clauses',
  'genitiv',
  'relative-clauses',
  'adjective-endings',
  'konjunktiv2',
  'passive-voice',
  'zu-infinitive',
] as const;

export async function generateExamModule(client: GeminiClient, skill: Skill): Promise<ExamModule> {
  const spec = B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === skill);
  if (!spec) throw new Error(`Unknown exam module ${skill}.`);
  const partsShape =
    spec.parts.length > 0
      ? `"parts":[${spec.parts
          .map((part) => `{"part":${part.part},"items":[${part.items} objective items]}`)
          .join(',')}],"productionTasks":[]`
      : `"parts":[],"productionTasks":[${spec.productionTasks} production tasks]`;
  const prompt =
    `Create the ${skill} module of a Goethe-Zertifikat B1 exam. ${MODULE_BRIEFS[skill]}\n` +
    `Return JSON: {"skill":"${skill}",${partsShape}}.\n` +
    'Objective item: {"stimulus":string (German text at B1),"question":string,' +
    '"options":[3 strings],"correctIndex":0|1|2,"grammarItemId":string}. ' +
    'Production task: {"instruction":string (German),"contentPoints":[2-4 strings],' +
    `"grammarItemIds":[from ${JSON.stringify(B1_GRAMMAR_IDS)}]}. ` +
    'Every answer key must be verifiable from its stimulus alone; item counts must match ' +
    'the shape EXACTLY. German at authentic B1 level.';

  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidate = await client.generateJson(
      [{ role: 'learner', text: prompt }],
      examModuleSchema,
      { callSite: 'b1-exam-generation' },
    );
    problems = validateExamModule(candidate);
    if (candidate.skill !== skill) problems.push(`module drifted to ${candidate.skill}`);
    if (problems.length === 0) return candidate;
  }
  throw new GeminiError(
    'parse-failure',
    `Generated ${skill} module failed the blueprint twice: ${problems.join('; ')}`,
  );
}

const PLACEHOLDER_PRODUCTION: Readonly<
  Record<'writing' | 'speaking', ExamModule['productionTasks']>
> = {
  writing: [
    {
      instruction:
        'Schreiben Sie eine E-Mail an eine Freundin: Sie sind umgezogen und laden sie ein ' +
        '(circa 80 Wörter).',
      contentPoints: [
        'Describe the new home',
        'Invite with a concrete date',
        'Explain how to get there',
      ],
      grammarItemIds: ['dass-weil-clauses'],
    },
    {
      instruction:
        'Forumsbeitrag: "Braucht man heute noch ein Auto in der Stadt?" Schreiben Sie Ihre ' +
        'Meinung (circa 80 Wörter).',
      contentPoints: [
        'State your opinion clearly',
        'Give two reasons',
        'Include one counterargument',
      ],
      grammarItemIds: ['opinion-discourse-markers', 'dass-weil-clauses'],
    },
    {
      instruction:
        'Schreiben Sie eine halbformelle E-Mail an Ihre Kursleiterin: Sie können am Termin ' +
        'nicht kommen (circa 40 Wörter).',
      contentPoints: ['Apologize politely', 'Give the reason and propose an alternative'],
      grammarItemIds: ['konjunktiv2'],
    },
  ],
  speaking: [
    {
      instruction:
        'Gemeinsam etwas planen: Ein Freund hat eine Prüfung bestanden. Planen Sie zusammen ' +
        'eine Überraschungsparty.',
      contentPoints: ['Suggest a time and place', 'Discuss food and guests', 'React to proposals'],
      grammarItemIds: ['konjunktiv2'],
    },
    {
      instruction:
        'Ein Thema präsentieren: "Mein Weg zur deutschen Sprache". Sprechen Sie circa drei ' +
        'Minuten mit Einleitung, Hauptteil und Schluss.',
      contentPoints: [
        'Structure with intro and conclusion',
        'Give personal examples',
        'Name advantages and disadvantages',
      ],
      grammarItemIds: ['zu-infinitive', 'dass-weil-clauses'],
    },
    {
      instruction:
        'Feedback geben: Reagieren Sie auf die Präsentation Ihres Partners und stellen Sie ' +
        'eine Frage dazu.',
      contentPoints: ['Say what you found interesting', 'Ask one concrete question'],
      grammarItemIds: ['relative-clauses'],
    },
  ],
};

// Deterministic fallback: the exact blueprint filled from the cumulative B1
// corpus (article and meaning items cycling like the placeholder unit test),
// so the exam is walkable end to end without the brain.
export function buildPlaceholderExamModule(
  skill: Skill,
  corpus: readonly VocabularyWord[],
): ExamModule {
  const spec = B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === skill);
  if (!spec) throw new Error(`Unknown exam module ${skill}.`);

  if (spec.parts.length === 0) {
    return examModuleSchema.parse({
      skill,
      parts: [],
      productionTasks: PLACEHOLDER_PRODUCTION[skill as 'writing' | 'speaking'],
    });
  }

  const nouns = corpus.filter((word) => word.wordType === 'noun' && word.article !== null);
  const nonNouns = corpus.filter((word) => word.translation.length > 0);
  const grammarIdFor = (index: number) => B1_GRAMMAR_IDS[index % B1_GRAMMAR_IDS.length] as string;

  let offset = 0;
  const parts = spec.parts.map((partSpec) => {
    const items = Array.from({ length: partSpec.items }, (_, index) => {
      const itemIndex = offset + index;
      // Odd parts drill articles, even parts drill meaning, so the fallback
      // exam still varies by part like the real formats do.
      if (partSpec.part % 2 === 1) {
        const word = nouns[itemIndex % nouns.length] as VocabularyWord;
        return articleItem(word, grammarIdFor(itemIndex));
      }
      const word = nonNouns[itemIndex % nonNouns.length] as VocabularyWord;
      const distractors = [
        nonNouns[(itemIndex + 11) % nonNouns.length] as VocabularyWord,
        nonNouns[(itemIndex + 23) % nonNouns.length] as VocabularyWord,
      ];
      return meaningItem(word, distractors, grammarIdFor(itemIndex));
    });
    offset += partSpec.items;
    return { part: partSpec.part, items };
  });

  return examModuleSchema.parse({ skill, parts, productionTasks: [] });
}
