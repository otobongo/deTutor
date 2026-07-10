import { vocabularyWordSchema, type VocabularyWord } from '@/lib/db/curriculum';

// Foundation vocabulary (owner-directed 2026-07-10): numbers and pronouns as
// learnable, reviewable card entries. The Goethe Wortliste deliberately
// excludes them (they are grammar-item territory), so they live here as
// curated seed content, schema-validated like the corpus. They join warm-up
// reviews when marked learned but never enter daily "new vocabulary" day
// sets; the theme "foundations" keeps them out of theme-based selection.

interface FoundationEntry {
  readonly id: string;
  readonly german: string;
  readonly translation: string;
  readonly exampleDe: string;
  readonly exampleEn: string;
  readonly rank: number;
}

function entry(
  id: string,
  german: string,
  translation: string,
  exampleDe: string,
  exampleEn: string,
  rank: number,
): FoundationEntry {
  return { id, german, translation, exampleDe, exampleEn, rank };
}

const NUMBERS: readonly FoundationEntry[] = [
  entry(
    'num-null',
    'null',
    'zero',
    'Die Nummer ist null drei null.',
    'The number is zero three zero.',
    1,
  ),
  entry('num-eins', 'eins', 'one', 'Ich habe eins.', 'I have one.', 2),
  entry('num-zwei', 'zwei', 'two', 'Zwei Kaffee, bitte.', 'Two coffees, please.', 3),
  entry('num-drei', 'drei', 'three', 'Wir sind drei Personen.', 'We are three people.', 4),
  entry('num-vier', 'vier', 'four', 'Der Bus kommt um vier.', 'The bus comes at four.', 5),
  entry('num-fuenf', 'fünf', 'five', 'Das kostet fünf Euro.', 'That costs five euros.', 6),
  entry('num-sechs', 'sechs', 'six', 'Ich stehe um sechs auf.', 'I get up at six.', 7),
  entry(
    'num-sieben',
    'sieben',
    'seven',
    'Die Woche hat sieben Tage.',
    'The week has seven days.',
    8,
  ),
  entry('num-acht', 'acht', 'eight', 'Der Kurs beginnt um acht.', 'The course starts at eight.', 9),
  entry('num-neun', 'neun', 'nine', 'Es ist neun Uhr.', 'It is nine o clock.', 10),
  entry('num-zehn', 'zehn', 'ten', 'Zehn Minuten, bitte.', 'Ten minutes, please.', 11),
  entry('num-elf', 'elf', 'eleven', 'Der Zug kommt um elf.', 'The train comes at eleven.', 12),
  entry(
    'num-zwoelf',
    'zwölf',
    'twelve',
    'Es ist zwölf Uhr, Mittag!',
    'It is twelve o clock, noon!',
    13,
  ),
  entry(
    'num-dreizehn',
    'dreizehn',
    'thirteen',
    'Sie ist dreizehn Jahre alt.',
    'She is thirteen years old.',
    14,
  ),
  entry('num-sechzehn', 'sechzehn', 'sixteen', 'Er ist sechzehn.', 'He is sixteen.', 15),
  entry('num-siebzehn', 'siebzehn', 'seventeen', 'Sie ist siebzehn.', 'She is seventeen.', 16),
  entry(
    'num-zwanzig',
    'zwanzig',
    'twenty',
    'Das kostet zwanzig Euro.',
    'That costs twenty euros.',
    17,
  ),
  entry(
    'num-einundzwanzig',
    'einundzwanzig',
    'twenty-one',
    'Er ist einundzwanzig Jahre alt.',
    'He is twenty-one years old.',
    18,
  ),
  entry(
    'num-dreissig',
    'dreißig',
    'thirty',
    'Der Film dauert dreißig Minuten.',
    'The film lasts thirty minutes.',
    19,
  ),
  entry('num-vierzig', 'vierzig', 'forty', 'Mein Vater ist vierzig.', 'My father is forty.', 20),
  entry(
    'num-fuenfzig',
    'fünfzig',
    'fifty',
    'Fünfzig Euro sind zu viel.',
    'Fifty euros is too much.',
    21,
  ),
  entry(
    'num-sechzig',
    'sechzig',
    'sixty',
    'Die Stunde hat sechzig Minuten.',
    'The hour has sixty minutes.',
    22,
  ),
  entry(
    'num-siebzig',
    'siebzig',
    'seventy',
    'Meine Oma ist siebzig.',
    'My grandma is seventy.',
    23,
  ),
  entry(
    'num-achtzig',
    'achtzig',
    'eighty',
    'Das Haus ist achtzig Jahre alt.',
    'The house is eighty years old.',
    24,
  ),
  entry(
    'num-neunzig',
    'neunzig',
    'ninety',
    'Neunzig Minuten, ein Fußballspiel.',
    'Ninety minutes, a football match.',
    25,
  ),
  entry(
    'num-hundert',
    'hundert',
    'one hundred',
    'Hundert Euro, bitte.',
    'One hundred euros, please.',
    26,
  ),
];

const PRONOUNS: readonly FoundationEntry[] = [
  entry('pron-ich', 'ich', 'I', 'Ich lerne Deutsch.', 'I am learning German.', 30),
  entry('pron-du', 'du', 'you (informal)', 'Du bist nett.', 'You are nice.', 31),
  entry('pron-er', 'er', 'he', 'Er kommt aus Berlin.', 'He comes from Berlin.', 32),
  entry('pron-sie', 'sie', 'she; they', 'Sie trinkt Tee.', 'She drinks tea.', 33),
  entry('pron-es', 'es', 'it', 'Es ist kalt.', 'It is cold.', 34),
  entry('pron-wir', 'wir', 'we', 'Wir essen zusammen.', 'We eat together.', 35),
  entry('pron-ihr', 'ihr', 'you (plural)', 'Ihr seid Freunde.', 'You are friends.', 36),
  entry('pron-sie-formal', 'Sie', 'you (formal)', 'Kommen Sie herein!', 'Come in!', 37),
  entry('pron-mich', 'mich', 'me (accusative)', 'Sie sieht mich.', 'She sees me.', 38),
  entry('pron-dich', 'dich', 'you (accusative)', 'Ich verstehe dich.', 'I understand you.', 39),
  entry('pron-ihn', 'ihn', 'him (accusative)', 'Wir fragen ihn.', 'We ask him.', 40),
  entry('pron-uns', 'uns', 'us', 'Er besucht uns.', 'He visits us.', 41),
  entry(
    'pron-euch',
    'euch',
    'you all (accusative/dative)',
    'Ich sehe euch morgen.',
    'I will see you all tomorrow.',
    42,
  ),
  entry('pron-mir', 'mir', 'to me (dative)', 'Das Buch gehört mir.', 'The book belongs to me.', 43),
  entry('pron-dir', 'dir', 'to you (dative)', 'Ich helfe dir.', 'I am helping you.', 44),
  entry('pron-ihm', 'ihm', 'to him (dative)', 'Sie dankt ihm.', 'She thanks him.', 45),
  entry(
    'pron-ihr-dat',
    'ihr',
    'to her (dative)',
    'Er gibt ihr das Brot.',
    'He gives her the bread.',
    46,
  ),
  entry('pron-ihnen', 'ihnen', 'to them (dative)', 'Wir helfen ihnen.', 'We are helping them.', 47),
];

function toWord(source: FoundationEntry, kind: 'number' | 'pronoun'): VocabularyWord {
  return vocabularyWordSchema.parse({
    id: source.id,
    german: source.german,
    wordType: 'other',
    article: null,
    translation: source.translation,
    ipa: null,
    exampleDe: source.exampleDe,
    exampleEn: source.exampleEn,
    cefrLevel: 'A1',
    theme: 'foundations',
    picturable: false,
    // Ranks sit far above the corpus so foundation entries never win
    // frequency-based selection anywhere.
    frequencyRank: 100_000 + (kind === 'number' ? 0 : 100) + source.rank,
  });
}

export const foundationNumbers: readonly VocabularyWord[] = NUMBERS.map((source) =>
  toWord(source, 'number'),
);
export const foundationPronouns: readonly VocabularyWord[] = PRONOUNS.map((source) =>
  toWord(source, 'pronoun'),
);
export const foundationVocabulary: readonly VocabularyWord[] = [
  ...foundationNumbers,
  ...foundationPronouns,
];
