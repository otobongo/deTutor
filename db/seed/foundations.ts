import type { QuizQuestion } from '@/lib/learn/progress';

// Foundation topics (owner-directed 2026-07-10): the ground structures that
// strengthen the words. Numbers, pronouns, accusative, and dative lead;
// the rest derive from the seeded A1 grammar items so Learn coverage maps
// 1:1 to what units teach. Curated seed content, owner-reviewable, A1 only.
// Every example is simple corpus-level German; audio rides the on-demand
// TTS cache at the page edge.

export interface FoundationExample {
  readonly de: string;
  readonly en: string;
}

export interface FoundationTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface FoundationSection {
  readonly heading: string;
  readonly body: string;
  readonly table?: FoundationTable;
  readonly examples?: readonly FoundationExample[];
}

export interface FoundationTopic {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  // Which seeded grammar items this topic explains (coverage bookkeeping).
  readonly grammarItemIds: readonly string[];
  readonly sections: readonly FoundationSection[];
  readonly quiz: readonly QuizQuestion[];
}

export const FOUNDATION_TOPICS: readonly FoundationTopic[] = [
  {
    id: 'numbers',
    title: 'Numbers',
    blurb: 'Count from null to hundert and read prices, times, and ages.',
    grammarItemIds: ['teen-numbers-pattern'],
    sections: [
      {
        heading: 'Zero to twelve: just memorize these',
        body:
          'The first thirteen numbers are their own words, like in English. ' +
          'Say them out loud until they feel automatic; everything above twelve is built from them.',
        table: {
          headers: ['0-3', '4-6', '7-9', '10-12'],
          rows: [
            [
              'null, eins, zwei, drei',
              'vier, fünf, sechs',
              'sieben, acht, neun',
              'zehn, elf, zwölf',
            ],
          ],
        },
        examples: [
          { de: 'Zwei Kaffee, bitte.', en: 'Two coffees, please.' },
          { de: 'Es ist zwölf Uhr.', en: 'It is twelve o clock.' },
        ],
      },
      {
        heading: 'Teens: number + zehn',
        body:
          'From 13 to 19 you glue the small number onto zehn: dreizehn, vierzehn, fünfzehn. ' +
          'Two spellings shrink: sechzehn (not sechszehn) and siebzehn (not siebenzehn).',
        examples: [
          { de: 'Sie ist dreizehn Jahre alt.', en: 'She is thirteen years old.' },
          { de: 'Er ist siebzehn.', en: 'He is seventeen.' },
        ],
      },
      {
        heading: 'Tens and the famous German flip',
        body:
          'The tens end in -zig: zwanzig, dreißig (note the ß), vierzig, fünfzig, sechzig, ' +
          'siebzig, achtzig, neunzig, then hundert. Above twenty, German says the ones digit ' +
          'FIRST: 21 is einundzwanzig, literally "one-and-twenty". 45 is fünfundvierzig.',
        examples: [
          { de: 'Das kostet einundzwanzig Euro.', en: 'That costs twenty-one euros.' },
          { de: 'Meine Mutter ist fünfundvierzig.', en: 'My mother is forty-five.' },
        ],
      },
    ],
    quiz: [
      {
        question: 'How do you say 21 in German?',
        options: ['zwanzigeins', 'einundzwanzig', 'zweiundzehn'],
        correctIndex: 1,
      },
      {
        question: 'Which spelling is correct?',
        options: ['sechszehn', 'sechzehn', 'sechssehn'],
        correctIndex: 1,
      },
      {
        question: '"fünfunddreißig" is:',
        options: ['53', '35', '45'],
        correctIndex: 1,
      },
      {
        question: 'What comes after neunzig?',
        options: ['hundert', 'zehnzig', 'neunzehn'],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 'pronouns',
    title: 'Pronouns',
    blurb: 'ich, du, er, sie, es and how they change with case.',
    grammarItemIds: ['personal-pronouns'],
    sections: [
      {
        heading: 'The basic set (nominative: who is doing it)',
        body:
          'These stand in for people and things doing the action. Note that sie does triple ' +
          'duty: she, they, and (capitalized, Sie) the polite you for strangers and officials.',
        table: {
          headers: ['Singular', 'Plural'],
          rows: [
            ['ich (I)', 'wir (we)'],
            ['du (you, informal)', 'ihr (you all)'],
            ['er / sie / es (he / she / it)', 'sie (they), Sie (you, formal)'],
          ],
        },
        examples: [
          { de: 'Ich lerne Deutsch.', en: 'I am learning German.' },
          { de: 'Kommen Sie herein!', en: 'Come in! (formal)' },
        ],
      },
      {
        heading: 'Pronouns change with case',
        body:
          'When a pronoun RECEIVES the action or a benefit, its form changes, just like ' +
          'English I becomes me. German has two receiving forms: accusative (direct) and ' +
          'dative (to/for someone). The accusative and dative topics explain when to use which.',
        table: {
          headers: ['Who acts (Nom.)', 'Direct object (Akk.)', 'To/for whom (Dat.)'],
          rows: [
            ['ich', 'mich', 'mir'],
            ['du', 'dich', 'dir'],
            ['er', 'ihn', 'ihm'],
            ['sie', 'sie', 'ihr'],
            ['es', 'es', 'ihm'],
            ['wir', 'uns', 'uns'],
            ['ihr', 'euch', 'euch'],
            ['sie/Sie', 'sie/Sie', 'ihnen/Ihnen'],
          ],
        },
        examples: [
          { de: 'Sie sieht mich.', en: 'She sees me.' },
          { de: 'Ich helfe dir.', en: 'I am helping you.' },
        ],
      },
    ],
    quiz: [
      {
        question: 'The polite "you" for a stranger is:',
        options: ['du', 'ihr', 'Sie'],
        correctIndex: 2,
      },
      {
        question: '"She sees ___" (me):',
        options: ['mich', 'mir', 'ich'],
        correctIndex: 0,
      },
      {
        question: '"Ich helfe ___" (you, informal, dative):',
        options: ['dich', 'dir', 'du'],
        correctIndex: 1,
      },
      {
        question: '"er" becomes what as a direct object?',
        options: ['ihm', 'ihn', 'ihr'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'accusative',
    title: 'Accusative (the direct object)',
    blurb: 'Why der becomes den: marking the thing the action lands on.',
    grammarItemIds: ['akkusativ-intro', 'akkusativ-pronouns'],
    sections: [
      {
        heading: 'What it is',
        body:
          'The accusative marks the direct object: the thing being seen, bought, eaten, or ' +
          'wanted. In "Ich kaufe den Kaffee", the coffee receives the buying, so it stands in ' +
          'the accusative. The wonderful news for beginners: only masculine words change.',
        table: {
          headers: ['Gender', 'Subject form', 'Accusative form'],
          rows: [
            ['masculine (der)', 'der / ein', 'den / einen'],
            ['feminine (die)', 'die / eine', 'die / eine (no change)'],
            ['neuter (das)', 'das / ein', 'das / ein (no change)'],
            ['plural (die)', 'die', 'die (no change)'],
          ],
        },
        examples: [
          {
            de: 'Der Kaffee ist heiß. Ich trinke den Kaffee.',
            en: 'The coffee is hot. I drink the coffee.',
          },
          { de: 'Ich möchte einen Tee.', en: 'I would like a tea.' },
          { de: 'Sie kauft eine Karte.', en: 'She buys a card. (feminine, unchanged)' },
        ],
      },
      {
        heading: 'Everyday verbs that always take accusative',
        body:
          'haben, möchten, kaufen, essen, trinken, sehen, suchen, brauchen: whatever follows ' +
          'them is a direct object. If the noun is masculine, say den or einen. Pronouns ' +
          'switch too: ich becomes mich, er becomes ihn.',
        examples: [
          { de: 'Ich brauche einen Stift.', en: 'I need a pen.' },
          { de: 'Wir sehen ihn morgen.', en: 'We will see him tomorrow.' },
        ],
      },
    ],
    quiz: [
      {
        question: '"Ich trinke ___ Kaffee." (der Kaffee)',
        options: ['der', 'den', 'dem'],
        correctIndex: 1,
      },
      {
        question: 'Which gender changes its article in the accusative?',
        options: ['only masculine', 'only feminine', 'all of them'],
        correctIndex: 0,
      },
      {
        question: '"Ich möchte ___ Tee." (masculine)',
        options: ['ein', 'einen', 'einem'],
        correctIndex: 1,
      },
      {
        question: '"Wir sehen ___ morgen." (him)',
        options: ['er', 'ihm', 'ihn'],
        correctIndex: 2,
      },
    ],
  },
  {
    id: 'dative',
    title: 'Dative (to whom, for whom)',
    blurb: 'mir, dir, dem: marking the receiver, the helper, the location.',
    grammarItemIds: ['dativ-intro'],
    sections: [
      {
        heading: 'What it is',
        body:
          'The dative marks the person or thing something is given TO, done FOR, or located ' +
          'AT. In "Er gibt ihr das Brot", she receives the bread, so she stands in the ' +
          'dative. Unlike the accusative, EVERY gender changes its article here.',
        table: {
          headers: ['Gender', 'Subject form', 'Dative form'],
          rows: [
            ['masculine (der)', 'der / ein', 'dem / einem'],
            ['feminine (die)', 'die / eine', 'der / einer'],
            ['neuter (das)', 'das / ein', 'dem / einem'],
            ['plural (die)', 'die', 'den (+n on the noun)'],
          ],
        },
        examples: [
          { de: 'Er gibt ihr das Brot.', en: 'He gives her the bread.' },
          { de: 'Das Buch gehört mir.', en: 'The book belongs to me.' },
        ],
      },
      {
        heading: 'Verbs and little words that force the dative',
        body:
          'A few very common verbs always take dative: helfen, danken, gehören, gefallen. ' +
          'And some prepositions always do too: mit, nach, bei, von, zu, aus. After any of ' +
          'these, reach for mir/dir/ihm/ihr or dem/der/einem.',
        examples: [
          { de: 'Ich helfe dir.', en: 'I am helping you.' },
          { de: 'Sie fährt mit dem Bus.', en: 'She goes by bus.' },
          { de: 'Wir danken ihnen.', en: 'We thank them.' },
        ],
      },
    ],
    quiz: [
      {
        question: '"Sie fährt mit ___ Bus." (der Bus)',
        options: ['den', 'dem', 'der'],
        correctIndex: 1,
      },
      {
        question: 'Which verb always takes the dative?',
        options: ['sehen', 'helfen', 'kaufen'],
        correctIndex: 1,
      },
      {
        question: '"Das Buch gehört ___." (to me)',
        options: ['mich', 'mir', 'ich'],
        correctIndex: 1,
      },
      {
        question: 'Feminine "die" becomes what in the dative?',
        options: ['der', 'dem', 'die'],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 'sounds',
    title: 'Sounds: ch, umlauts, and ß',
    blurb: 'The sounds English does not have, and how to make them.',
    grammarItemIds: ['pronunciation-ch-umlauts'],
    sections: [
      {
        heading: 'The two ch sounds',
        body:
          'After a, o, u the ch is rough, from the back of the throat, like Scottish loch: ' +
          'Buch, auch, noch. After e, i, ä, ö, ü it is soft, like a whispered "hue": ich, ' +
          'nicht, sprechen. Getting ich right instantly makes you sound less foreign.',
        examples: [
          { de: 'Ich spreche nicht viel.', en: 'I do not speak much. (soft ch)' },
          { de: 'Das Buch ist auch gut.', en: 'The book is also good. (rough ch)' },
        ],
      },
      {
        heading: 'Umlauts and ß',
        body:
          'ä sounds like the e in bed (Käse). ö is e said with rounded lips (schön). ü is i ' +
          'said with rounded lips (fünf, Tür). They are different letters, not decorations: ' +
          'schon (already) and schön (beautiful) are different words. ß is simply a sharp s ' +
          '(dreißig, heißen).',
        examples: [
          { de: 'Das ist schön.', en: 'That is beautiful.' },
          { de: 'Ich heiße Anna.', en: 'My name is Anna.' },
        ],
      },
    ],
    quiz: [
      {
        question: 'The ch in "ich" is:',
        options: ['rough, like loch', 'soft, like a whispered hue', 'silent'],
        correctIndex: 1,
      },
      {
        question: '"schon" and "schön" are:',
        options: ['the same word', 'two different words', 'spelling variants'],
        correctIndex: 1,
      },
      {
        question: 'ß is pronounced like:',
        options: ['a sharp s', 'a b', 'sh'],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 'verb-second',
    title: 'Verb second: the golden word-order rule',
    blurb: 'In a German statement, the verb is always the second idea.',
    grammarItemIds: ['v2-statements'],
    sections: [
      {
        heading: 'The rule',
        body:
          'In every normal statement, the conjugated verb sits in position two. Position one ' +
          'can be the subject, the time, the place, almost anything, but the verb never moves ' +
          'from spot two. If something else takes spot one, the subject slides behind the verb.',
        examples: [
          { de: 'Ich trinke heute Kaffee.', en: 'I drink coffee today.' },
          { de: 'Heute trinke ich Kaffee.', en: 'Today I drink coffee. (verb still second!)' },
          { de: 'Morgen lernen wir Deutsch.', en: 'Tomorrow we learn German.' },
        ],
      },
    ],
    quiz: [
      {
        question: 'Which is correct German word order?',
        options: [
          'Heute ich trinke Kaffee.',
          'Heute trinke ich Kaffee.',
          'Heute Kaffee ich trinke.',
        ],
        correctIndex: 1,
      },
      {
        question: 'In a statement, the conjugated verb is always:',
        options: ['first', 'second', 'last'],
        correctIndex: 1,
      },
      {
        question: 'If "Morgen" starts the sentence, what comes next?',
        options: ['the subject', 'the verb', 'a comma'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'sein-haben',
    title: 'sein and haben',
    blurb: 'The two most important verbs in German, fully irregular.',
    grammarItemIds: ['sein-haben-present'],
    sections: [
      {
        heading: 'sein (to be) and haben (to have)',
        body:
          'You will use these in almost every sentence, so their irregular forms must become ' +
          'automatic. Say each row out loud with its pronoun.',
        table: {
          headers: ['Pronoun', 'sein', 'haben'],
          rows: [
            ['ich', 'bin', 'habe'],
            ['du', 'bist', 'hast'],
            ['er/sie/es', 'ist', 'hat'],
            ['wir', 'sind', 'haben'],
            ['ihr', 'seid', 'habt'],
            ['sie/Sie', 'sind', 'haben'],
          ],
        },
        examples: [
          { de: 'Ich bin müde.', en: 'I am tired.' },
          { de: 'Du hast Zeit.', en: 'You have time.' },
          { de: 'Wir sind hier.', en: 'We are here.' },
        ],
      },
    ],
    quiz: [
      { question: '"du ___" (sein):', options: ['bist', 'bin', 'seid'], correctIndex: 0 },
      { question: '"er ___ Zeit" (haben):', options: ['habt', 'hat', 'haben'], correctIndex: 1 },
      { question: '"wir ___" (sein):', options: ['seid', 'ist', 'sind'], correctIndex: 2 },
      { question: '"ihr ___ Zeit" (haben):', options: ['habt', 'hast', 'haben'], correctIndex: 0 },
    ],
  },
  {
    id: 'weekdays-time',
    title: 'Weekdays and telling time',
    blurb: 'Montag to Sonntag, and how to say when things happen.',
    grammarItemIds: ['weekdays-time'],
    sections: [
      {
        heading: 'The week',
        body:
          'Montag, Dienstag, Mittwoch (literally mid-week), Donnerstag, Freitag, Samstag, ' +
          'Sonntag. On a day is "am": am Montag. All weekdays are masculine.',
        examples: [
          { de: 'Am Montag arbeite ich.', en: 'On Monday I work.' },
          { de: 'Am Samstag kommen Freunde.', en: 'On Saturday friends are coming.' },
        ],
      },
      {
        heading: 'Clock time',
        body:
          'At a time is "um": um acht Uhr. Half hours look forward in German: halb neun means ' +
          'half AN HOUR BEFORE nine, so 8:30, not 9:30. That one surprises everyone once.',
        examples: [
          { de: 'Der Kurs beginnt um acht Uhr.', en: 'The course starts at eight.' },
          { de: 'Es ist halb neun.', en: 'It is 8:30.' },
        ],
      },
    ],
    quiz: [
      { question: '"halb neun" means:', options: ['9:30', '8:30', '9:00'], correctIndex: 1 },
      {
        question: 'On Monday is:',
        options: ['um Montag', 'im Montag', 'am Montag'],
        correctIndex: 2,
      },
      {
        question: 'Mid-week is called:',
        options: ['Mittwoch', 'Donnerstag', 'Dienstag'],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 'genders-articles',
    title: 'der, die, das: noun genders',
    blurb: 'Every German noun has a gender; learn the word WITH its article.',
    grammarItemIds: ['noun-genders-articles'],
    sections: [
      {
        heading: 'Three genders, one habit',
        body:
          'Every noun is masculine (der), feminine (die), or neuter (das), and the gender ' +
          'often has nothing to do with meaning: der Tisch, die Tür, das Fenster. The only ' +
          'reliable method is the habit this app enforces everywhere: never learn a bare ' +
          'noun, always learn article + noun as one unit, in one breath.',
        examples: [
          { de: 'der Kaffee, die Milch, das Brot', en: 'the coffee, the milk, the bread' },
          { de: 'Die Tür ist offen.', en: 'The door is open.' },
        ],
      },
      {
        heading: 'A few helpful patterns',
        body:
          'Words ending in -ung, -heit, -keit are feminine (die Wohnung, die Gesundheit). ' +
          'Words ending in -chen are neuter (das Mädchen). Days, months, and seasons are ' +
          'masculine (der Montag, der Sommer). Patterns help, but the article-with-noun habit ' +
          'is what actually sticks.',
        examples: [
          { de: 'die Wohnung, das Mädchen, der Sommer', en: 'the flat, the girl, the summer' },
        ],
      },
    ],
    quiz: [
      {
        question: 'Words ending in -ung are usually:',
        options: ['der', 'die', 'das'],
        correctIndex: 1,
      },
      {
        question: 'Days of the week are:',
        options: ['masculine', 'feminine', 'neuter'],
        correctIndex: 0,
      },
      {
        question: 'The best way to learn noun gender is:',
        options: ['guess from meaning', 'learn article + noun together', 'ignore it at A1'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'plurals',
    title: 'Plurals: everything becomes die',
    blurb: 'One friendly rule and several plural shapes.',
    grammarItemIds: ['plural-die'],
    sections: [
      {
        heading: 'The friendly part',
        body:
          'Whatever the singular gender, EVERY plural takes die: der Tisch, die Tische; das ' +
          'Kind, die Kinder; die Frau, die Frauen. The endings vary (-e, -er, -en, -s, or an ' +
          'umlaut change), so learn the plural shape together with the word, but the article ' +
          'question has one answer: die.',
        examples: [
          { de: 'der Apfel, die Äpfel', en: 'the apple, the apples' },
          { de: 'das Auto, die Autos', en: 'the car, the cars' },
          { de: 'Die Kinder spielen.', en: 'The children are playing.' },
        ],
      },
    ],
    quiz: [
      {
        question: 'The plural article is always:',
        options: ['der', 'die', 'das'],
        correctIndex: 1,
      },
      {
        question: 'The plural of das Kind is:',
        options: ['die Kinds', 'die Kinder', 'das Kinder'],
        correctIndex: 1,
      },
      {
        question: 'Plural endings in German are:',
        options: ['always -s', 'always -en', 'varied; learn them with the word'],
        correctIndex: 2,
      },
    ],
  },
  {
    id: 'questions',
    title: 'Asking questions',
    blurb: 'W-words, and flipping the verb to the front.',
    grammarItemIds: ['v2-inversion-questions'],
    sections: [
      {
        heading: 'W-questions',
        body:
          'The question word takes position one, the verb stays second: wer (who), was ' +
          '(what), wo (where), wann (when), wie (how), warum (why).',
        examples: [
          { de: 'Wo wohnst du?', en: 'Where do you live?' },
          { de: 'Wann beginnt der Kurs?', en: 'When does the course start?' },
        ],
      },
      {
        heading: 'Yes/no questions: verb first',
        body:
          'For a yes/no question, the verb jumps to position one and the subject follows. No ' +
          'helper word like the English "do" is needed.',
        examples: [
          { de: 'Trinkst du Kaffee?', en: 'Do you drink coffee?' },
          { de: 'Bist du müde?', en: 'Are you tired?' },
        ],
      },
    ],
    quiz: [
      { question: '"Where" in German is:', options: ['wer', 'wo', 'wann'], correctIndex: 1 },
      {
        question: 'A yes/no question starts with:',
        options: ['the subject', 'the verb', 'a W-word'],
        correctIndex: 1,
      },
      {
        question: 'Which asks "Do you drink coffee?"',
        options: ['Du trinkst Kaffee?', 'Trinkst du Kaffee?', 'Kaffee du trinkst?'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'present-tense',
    title: 'Present tense: regular verbs',
    blurb: 'One set of endings unlocks hundreds of verbs.',
    grammarItemIds: ['present-tense-regular'],
    sections: [
      {
        heading: 'Stem plus ending',
        body:
          'Take the infinitive (machen), cut -en to get the stem (mach-), then add the ending ' +
          'for the person. This one pattern covers most verbs you will meet at A1.',
        table: {
          headers: ['Pronoun', 'Ending', 'machen'],
          rows: [
            ['ich', '-e', 'mache'],
            ['du', '-st', 'machst'],
            ['er/sie/es', '-t', 'macht'],
            ['wir', '-en', 'machen'],
            ['ihr', '-t', 'macht'],
            ['sie/Sie', '-en', 'machen'],
          ],
        },
        examples: [
          { de: 'Ich lerne Deutsch.', en: 'I learn German.' },
          { de: 'Sie wohnt in Berlin.', en: 'She lives in Berlin.' },
          { de: 'Wir kaufen Brot.', en: 'We buy bread.' },
        ],
      },
    ],
    quiz: [
      { question: '"du" takes which ending?', options: ['-e', '-st', '-t'], correctIndex: 1 },
      {
        question: '"sie wohn__ in Berlin" (she):',
        options: ['wohne', 'wohnst', 'wohnt'],
        correctIndex: 2,
      },
      { question: 'The stem of "machen" is:', options: ['mach', 'machen', 'ma'], correctIndex: 0 },
      {
        question: '"wir lern__ Deutsch":',
        options: ['lernt', 'lernen', 'lernst'],
        correctIndex: 1,
      },
    ],
  },
];

export function foundationTopicById(topicId: string): FoundationTopic | null {
  return FOUNDATION_TOPICS.find((topic) => topic.id === topicId) ?? null;
}
