import Link from 'next/link';

// Practice: the skills library (GT-220). Each skill lists what is available
// now; brain-dependent flows say so honestly until the Gemini key arrives.

const SKILLS = [
  {
    skill: 'listening',
    description:
      'Graded clips with captions, replay, and slower playback. Runs in the daily session.',
  },
  {
    skill: 'reading',
    description:
      'Level-graded generated texts with Goethe Lesen tasks and tap-to-queue. Generation needs the Gemini brain (key pending).',
  },
  {
    skill: 'writing',
    description:
      'Word tiles and dictation run now; email and opinion correction needs the Gemini brain (key pending).',
  },
  {
    skill: 'speaking',
    description:
      'Echo pronunciation loop and 12 dialogue scenarios; scenario turns need the Gemini brain (key pending).',
  },
] as const;

export default function PracticePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Practice</h1>
      <ul className="flex flex-col gap-4" data-testid="skills-library">
        {SKILLS.map((entry) => (
          <li
            key={entry.skill}
            className="rounded-lg border p-4"
            data-testid={`skill-${entry.skill}`}
          >
            <h2 className="font-medium capitalize">{entry.skill}</h2>
            <p className="text-sm opacity-80">{entry.description}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm opacity-70">
        The full daily flow lives in{' '}
        <Link className="underline" href="/today">
          Today
        </Link>
        .
      </p>
    </main>
  );
}
