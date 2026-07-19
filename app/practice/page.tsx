import Link from 'next/link';
import { loadExamResultsAction } from '@/app/actions/exam';
import { ButtonLink, StatusChip } from '@/app/components/ui';

// Practice: the skills library (GT-220, restructured GT-D5). The four skills
// are the reason to come here, so they lead as large tiles; the reference
// surfaces that used to compete with them for attention drop to compact rows
// underneath. Card-first hierarchy borrowed from browse-style product UIs.

export const dynamic = 'force-dynamic';

const SKILLS = [
  {
    skill: 'listening',
    german: 'Hören',
    summary: 'The dialogue lab',
    description:
      'Spoken two-person conversations with word identification, comprehension, and replay. Runs in the daily session (listening days).',
    href: null,
  },
  {
    skill: 'reading',
    german: 'Lesen',
    summary: 'Texts at your level',
    description:
      'Generated texts with Goethe Lesen tasks and tap-to-queue. Runs in the daily session (reading days).',
    href: null,
  },
  {
    skill: 'writing',
    german: 'Schreiben',
    summary: 'Tiles and dictation',
    description:
      'Word tiles and dictation run in the daily session (writing days); email and opinion composers arrive with A2/B1.',
    href: null,
  },
  {
    skill: 'speaking',
    german: 'Sprechen',
    summary: 'Echo pronunciation',
    description:
      'Dialogue scenarios run in the daily session (scenario days). The echo loop is always available here.',
    href: '/practice/speaking',
  },
] as const;

export default async function PracticePage() {
  // Exam results are the one real per-skill number this page can show; a
  // skill with no sitting yet shows nothing rather than a fabricated zero.
  const examResults = await loadExamResultsAction();
  const scoreBySkill = new Map(examResults.map((result) => [result.skill, result]));

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-8 p-4 sm:p-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Practice</h1>
        <p className="text-ink-muted">
          Work any skill on its own, outside the daily session. Your daily flow still lives in{' '}
          <Link className="text-ink underline" href="/today">
            Today
          </Link>
          ; nothing here changes the schedule.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2" data-testid="skills-library">
        {SKILLS.map((entry) => {
          const result = scoreBySkill.get(entry.skill);
          return (
            <li
              key={entry.skill}
              className="flex flex-col gap-3 rounded-lg border bg-surface p-5"
              data-testid={`skill-${entry.skill}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <h2 className="font-display text-xl font-semibold tracking-tight" lang="de">
                    {entry.german}
                  </h2>
                  <p className="text-sm capitalize text-ink-muted">{entry.skill}</p>
                </div>
                {result ? (
                  <StatusChip tone={result.passed ? 'success' : 'neutral'}>
                    B1 exam {result.score}
                  </StatusChip>
                ) : null}
              </div>
              <p className="text-sm font-medium">{entry.summary}</p>
              <p className="text-sm text-ink-muted">{entry.description}</p>
              {entry.href ? (
                <div className="mt-auto pt-1">
                  <ButtonLink
                    variant="primary"
                    size="sm"
                    href={entry.href}
                    data-testid={`practice-${entry.skill}-link`}
                  >
                    Start echo practice
                  </ButtonLink>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-muted">
          Also here
        </h2>
        <ul className="flex flex-col overflow-hidden rounded-lg border">
          <li className="border-b bg-surface last:border-b-0">
            <Link
              className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2"
              href="/catalog"
              data-testid="catalog-link"
            >
              <span className="flex flex-col">
                <span className="font-medium">Image catalogue</span>
                <span className="text-sm text-ink-muted">
                  Every generated image with its audit summary
                </span>
              </span>
              <span aria-hidden="true" className="text-ink-muted">
                →
              </span>
            </Link>
          </li>
          <li className="bg-surface">
            <Link
              className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2"
              href="/exam"
              data-testid="practice-exam-link"
            >
              <span className="flex flex-col">
                <span className="font-medium">B1 exam simulation</span>
                <span className="text-sm text-ink-muted">
                  Four timed modules, scored out of 100
                </span>
              </span>
              <span aria-hidden="true" className="text-ink-muted">
                →
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
