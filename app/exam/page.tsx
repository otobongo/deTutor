import { B1_EXAM_BLUEPRINT, moduleTimer } from '@/lib/assessment/b1-exam';

// B1 exit exam (GT-401 journey 5 smoke): the full Goethe structure rendered
// from the blueprint. Item generation into this frame runs on demand when a
// module starts; the smoke proves structure and timing.

export const dynamic = 'force-dynamic';

const MODULE_LABELS: Record<string, string> = {
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
};

export default function ExamPage() {
  const now = new Date();
  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Goethe-Zertifikat B1 simulation</h1>
      <p data-testid="exam-intro">
        Four timed modules, scored 0 to 100 each; 60 passes a module. The structure below matches
        the official model set.
      </p>
      <ul className="flex flex-col gap-4" data-testid="exam-modules">
        {B1_EXAM_BLUEPRINT.map((module) => {
          const timer = moduleTimer(module.skill, now.toISOString(), now);
          const totalItems = module.parts.reduce((sum, part) => sum + part.items, 0);
          return (
            <li
              key={module.skill}
              className="rounded-lg border bg-surface p-4"
              data-testid={`exam-module-${module.skill}`}
            >
              <h2 className="font-medium">
                {MODULE_LABELS[module.skill]} ({module.minutes} minutes)
              </h2>
              {module.parts.length > 0 ? (
                <p data-testid={`exam-structure-${module.skill}`}>
                  {module.parts.length} parts, {totalItems} items:{' '}
                  {module.parts.map((part) => `Teil ${part.part} (${part.items})`).join(', ')}
                </p>
              ) : (
                <p data-testid={`exam-structure-${module.skill}`}>
                  {module.productionTasks} production tasks
                </p>
              )}
              <p className="text-sm text-ink-muted" data-testid={`exam-timer-${module.skill}`}>
                Timer: {Math.round(timer.remainingSeconds / 60)} minutes when started
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-muted">
        The exam unlocks at B1 after the A2 gate; module item generation uses the deep tier.
      </p>
    </main>
  );
}
