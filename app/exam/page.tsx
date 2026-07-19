import { B1_EXAM_BLUEPRINT } from '@/lib/assessment/b1-exam';
import { loadExamResultsAction } from '@/app/actions/exam';
import { ButtonLink, StatusChip } from '@/app/components/ui';

// B1 exit exam overview (redesigned 2026-07-10): four module cards in a
// calm grid, each leading with its German name, meta as chips, the score
// where one exists, and one clear action. Content generates when a module
// starts; all four at 60+ pass the simulation.

export const dynamic = 'force-dynamic';

const MODULES: Record<string, { label: string; english: string }> = {
  reading: { label: 'Lesen', english: 'Reading' },
  listening: { label: 'Hören', english: 'Listening' },
  writing: { label: 'Schreiben', english: 'Writing' },
  speaking: { label: 'Sprechen', english: 'Speaking' },
};

export default async function ExamPage() {
  const results = await loadExamResultsAction();
  const resultBySkill = new Map(results.map((result) => [result.skill, result]));
  const allPassed =
    B1_EXAM_BLUEPRINT.every((module) => resultBySkill.get(module.skill)?.passed) &&
    results.length === B1_EXAM_BLUEPRINT.length;

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-8 p-4 sm:p-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Goethe-Zertifikat B1 simulation
        </h1>
        <p className="text-ink-muted" data-testid="exam-intro">
          Four timed modules, scored 0 to 100 each; 60 passes a module. The structure matches the
          official model set; content generates when a module starts.
        </p>
      </div>

      {allPassed ? (
        <p role="status" data-testid="exam-passed">
          <StatusChip tone="success">Bestanden!</StatusChip> All four modules at 60 or above.
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2" data-testid="exam-modules">
        {B1_EXAM_BLUEPRINT.map((module) => {
          const totalItems = module.parts.reduce((sum, part) => sum + part.items, 0);
          const result = resultBySkill.get(module.skill);
          const meta = MODULES[module.skill]!;
          return (
            <li
              key={module.skill}
              className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
              data-testid={`exam-module-${module.skill}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight" lang="de">
                    {meta.label}
                  </h2>
                  <p className="text-sm text-ink-muted">{meta.english}</p>
                </div>
                {result ? (
                  <StatusChip
                    tone={result.passed ? 'success' : 'neutral'}
                    data-testid={`exam-result-${module.skill}`}
                  >
                    {result.score} / 100{result.passed ? ' ✓' : ''}
                  </StatusChip>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusChip tone="neutral">{module.minutes} minutes</StatusChip>
                <StatusChip tone="neutral">
                  {module.parts.length > 0
                    ? `${module.parts.length} Teile · ${totalItems} items`
                    : `${module.productionTasks} Aufgaben`}
                </StatusChip>
              </div>
              <p className="text-sm text-ink-subtle" data-testid={`exam-structure-${module.skill}`}>
                {module.parts.length > 0
                  ? `${module.parts.length} parts, ${totalItems} items: ${module.parts
                      .map((part) => `Teil ${part.part} (${part.items})`)
                      .join(', ')}`
                  : `${module.productionTasks} production tasks`}
              </p>
              <div className="mt-auto">
                <ButtonLink
                  variant={result ? 'secondary' : 'primary'}
                  href={`/exam/${module.skill}`}
                  data-testid={`exam-start-${module.skill}`}
                >
                  {result ? `Retake ${meta.label}` : `Start ${meta.label}`}
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="max-w-2xl text-sm text-ink-subtle">
        Module content is written by the deep tier into the official blueprint on first start and
        cached; without the brain, a deterministic practice filler keeps every sitting possible.
      </p>
    </main>
  );
}
