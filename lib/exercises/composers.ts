// Writing composers (GT-212): the ~80-word informal email with three
// required content points (Goethe Schreiben Teil 1) and the B1 opinion text
// (Teil 2). Content points carry keyword hints so coverage can be checked
// softly before submission; the hard assessment happens in GT-213.

export interface ContentPoint {
  readonly description: string;
  readonly keywords: readonly string[];
}

export interface WritingPrompt {
  readonly id: string;
  readonly format: 'email' | 'opinion';
  readonly prompt: string;
  readonly contentPoints: readonly ContentPoint[];
  readonly targetWords: number;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

export interface CoverageResult {
  readonly point: ContentPoint;
  readonly covered: boolean;
}

export function checkContentPoints(
  text: string,
  points: readonly ContentPoint[],
): CoverageResult[] {
  const haystack = text.toLowerCase();
  return points.map((point) => ({
    point,
    covered: point.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  }));
}

export function uncoveredPoints(text: string, points: readonly ContentPoint[]): ContentPoint[] {
  return checkContentPoints(text, points)
    .filter((result) => !result.covered)
    .map((result) => result.point);
}

export const WRITING_PROMPTS: readonly WritingPrompt[] = [
  {
    id: 'email-besuch',
    format: 'email',
    prompt:
      'Your friend Alex wants to visit you in Berlin next month. Write an informal email (~80 words).',
    contentPoints: [
      {
        description: 'Say when the visit suits you',
        keywords: ['wochenende', 'woche', 'juli', 'august', 'samstag', 'sonntag', 'zeit'],
      },
      {
        description: 'Suggest something to do together',
        keywords: ['museum', 'park', 'essen', 'café', 'kino', 'besuchen', 'zeigen'],
      },
      { description: 'Ask a question about the trip', keywords: ['?'] },
    ],
    targetWords: 80,
  },
  {
    id: 'email-absage',
    format: 'email',
    prompt:
      "You cannot come to your colleague's birthday party. Write an informal email (~80 words).",
    contentPoints: [
      {
        description: 'Apologize and say you cannot come',
        keywords: ['leider', 'entschuldigung', 'nicht kommen', 'kann nicht'],
      },
      { description: 'Give a reason', keywords: ['weil', 'denn', 'arbeit', 'krank', 'termin'] },
      {
        description: 'Suggest meeting another time',
        keywords: ['nächste', 'treffen', 'bald', 'ander'],
      },
    ],
    targetWords: 80,
  },
  {
    id: 'opinion-homeoffice',
    format: 'opinion',
    prompt:
      'Ist Homeoffice besser als Arbeit im Büro? Write your opinion (B1, ~120 words) with reasons and an example.',
    contentPoints: [
      {
        description: 'State your opinion clearly',
        keywords: ['meiner meinung', 'ich finde', 'ich denke', 'ich glaube'],
      },
      { description: 'Give at least one reason', keywords: ['weil', 'denn', 'deshalb', 'darum'] },
      { description: 'Give an example', keywords: ['zum beispiel', 'beispielsweise', 'z.b.'] },
    ],
    targetWords: 120,
  },
];
