import Link from 'next/link';

// Practice: the skills library (GT-220). Listening, reading, writing, and
// scenario dialogue rotate through the daily session; the echo loop is also
// practicable on demand here.

const SKILLS = [
  {
    skill: 'listening',
    description:
      'Graded clips with captions, replay, and slower playback. Runs in the daily session.',
    href: null,
  },
  {
    skill: 'reading',
    description:
      'Generated texts at your level with Goethe Lesen tasks and tap-to-queue. Runs in the daily session (reading days).',
    href: null,
  },
  {
    skill: 'writing',
    description:
      'Word tiles and dictation run in the daily session (writing days); email and opinion composers arrive with A2/B1.',
    href: null,
  },
  {
    skill: 'speaking',
    description:
      'Dialogue scenarios run in the daily session (scenario days). The echo pronunciation loop is always available here.',
    href: '/practice/speaking',
  },
] as const;

export default function PracticePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Practice</h1>
      <ul className="flex flex-col gap-4" data-testid="skills-library">
        {SKILLS.map((entry) => (
          <li
            key={entry.skill}
            className="rounded-lg border bg-surface p-4"
            data-testid={`skill-${entry.skill}`}
          >
            <h2 className="font-medium capitalize">{entry.skill}</h2>
            <p className="text-sm text-ink-muted">{entry.description}</p>
            {entry.href ? (
              <Link
                className="mt-2 inline-block rounded-md bg-action px-3 py-1 text-sm text-action-inverse"
                href={entry.href}
                data-testid={`practice-${entry.skill}-link`}
              >
                Start echo practice
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">
        The full daily flow lives in{' '}
        <Link className="underline" href="/today">
          Today
        </Link>
        . Generated media is reviewable in the{' '}
        <Link className="underline" href="/catalog" data-testid="catalog-link">
          image catalog
        </Link>
        .
      </p>
    </main>
  );
}
