import type { GrammarItem, Unit, VocabularyWord } from '@/lib/db/curriculum';
import { ARTICLES } from '@/lib/db/curriculum';
import { sectionPlan, unitTestSchema, type ObjectiveItem, type UnitTest } from './unit-test-gen';

// Placeholder unit test builder (GT-401). Placeholder-mode assessment is
// production code (Prime Directive 6): when the brain is unreachable, unit
// tests assemble deterministically from seed data, so the whole test-take-
// remediate-retake flow is exercisable offline. Different attempts draw
// different vocabulary slices, mirroring the regeneration contract.

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function articleItem(word: VocabularyWord, grammarItemId: string): ObjectiveItem {
  const article = word.article ?? 'das';
  return {
    stimulus: word.exampleDe ?? `___ ${word.german}`,
    question: `Welcher Artikel passt: ___ ${word.german}?`,
    options: [...ARTICLES],
    correctIndex: ARTICLES.indexOf(article),
    grammarItemId,
  };
}

export function meaningItem(
  word: VocabularyWord,
  distractors: readonly VocabularyWord[],
  grammarItemId: string,
): ObjectiveItem {
  // Deterministic correct-answer position derived from the word id.
  const correctIndex = hashString(word.id) % 3;
  const options = distractors.slice(0, 2).map((entry) => entry.translation);
  options.splice(correctIndex, 0, word.translation);
  return {
    stimulus: word.exampleDe ?? word.german,
    question: `Was bedeutet "${word.german}"?`,
    options: options.slice(0, 3),
    correctIndex,
    grammarItemId,
  };
}

export function buildPlaceholderUnitTest(
  unit: Unit,
  unitGrammarItems: readonly GrammarItem[],
  vocabulary: readonly VocabularyWord[],
  attempt: number,
): UnitTest {
  const plan = sectionPlan(unitGrammarItems);
  const grammarIds = unit.grammarItemIds;
  const idFor = (index: number) => grammarIds[index % grammarIds.length] as string;

  const nouns = vocabulary.filter((word) => word.wordType === 'noun' && word.article !== null);
  const nonNouns = vocabulary.filter((word) => word.translation.length > 0);
  // Attempts slice different vocabulary so a retake never repeats items.
  const offset = (attempt - 1) * (plan.listeningItems + plan.readingItems);

  const listening = Array.from({ length: plan.listeningItems }, (_, index) => {
    const word = nouns[(offset + index) % nouns.length] as VocabularyWord;
    return articleItem(word, idFor(index));
  });
  const reading = Array.from({ length: plan.readingItems }, (_, index) => {
    const wordIndex = offset + plan.listeningItems + index;
    const word = nonNouns[wordIndex % nonNouns.length] as VocabularyWord;
    const distractors = [
      nonNouns[(wordIndex + 7) % nonNouns.length] as VocabularyWord,
      nonNouns[(wordIndex + 13) % nonNouns.length] as VocabularyWord,
    ];
    return meaningItem(word, distractors, idFor(index));
  });

  return unitTestSchema.parse({
    unitId: unit.id,
    listening,
    reading,
    writing: {
      instruction:
        `Schreibe 3 bis 4 Sätze zum Thema "${unit.theme}". ` +
        `Attempt ${attempt}: use vocabulary from this unit.`,
      contentPoints: [
        'Use at least three unit vocabulary words',
        'Apply the unit grammar rule once',
        'Write complete sentences',
      ],
      grammarItemIds: [...grammarIds],
    },
    speaking: {
      instruction: `Sprich eine Minute: ${unit.capstonePremise} (attempt ${attempt}).`,
      contentPoints: ['Stay in the scenario', 'Use unit vocabulary'],
      grammarItemIds: [...grammarIds],
    },
  });
}
