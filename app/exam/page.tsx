import { B1_EXAM_BLUEPRINT } from '@/lib/assessment/b1-exam';
import { loadExamResultsAction } from '@/app/actions/exam';
import { ButtonLink, StatusChip } from '@/app/components/ui';

// B1 exit exam overview (GT-307, content wired 2026-07-10): the full Goethe
// structure with each module startable; content generates on demand when a
// module opens. Results persist per module; all four at 60+ pass the
// simulation. Open for testing at any level by owner decision.

export const dynamic = 'force-dynamic';

const MODULE_LABELS: Record<string, string> = {
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
};

export default async function ExamPage() {
  const results = await loadExamResultsAction();
  const resultBySkill = new Map(results.map((result) => [result.skill, result]));
  const allPassed =
    B1_EXAM_BLUEPRINT.every((module) => resultBySkill.get(module.skill)?.passed) &&
    results.length === B1_EXAM_BLUEPRINT.length;

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-4 sm:p-8">
      <h1 className="font-display text-3xl font-semibold">Goethe-Zertifikat B1 simulation</h1>
      <p data-testid="exam-intro">
        Four timed modules, scored 0 to 100 each; 60 passes a module. The structure below matches
        the official model set; content generates when a module starts.
      </p>
      {allPassed ? (
        <p role="status" data-testid="exam-passed">
          <StatusChip tone="success">Bestanden!</StatusChip> All four modules at 60 or above.
        </p>
      ) : null}
      <ul className="flex flex-col gap-4" data-testid="exam-modules">
        {B1_EXAM_BLUEPRINT.map((module) => {
          const totalItems = module.parts.reduce((sum, part) => sum + part.items, 0);
          const result = resultBySkill.get(module.skill);
          return (
            <li
              key={module.skill}
              className="flex flex-col gap-2 rounded-lg border bg-surface p-4"
              data-testid={`exam-module-${module.skill}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{MODULE_LABELS[module.skill]}</h2>
                <StatusChip tone="neutral">{module.minutes} minutes</StatusChip>
                {result ? (
                  <StatusChip
                    tone={result.passed ? 'success' : 'neutral'}
                    data-testid={`exam-result-${module.skill}`}
                  >
                    {result.score} / 100{result.passed ? ' ✓' : ''}
                  </StatusChip>
                ) : null}
              </div>
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
              <ButtonLink
                variant="secondary"
                size="sm"
                href={`/exam/${module.skill}`}
                className="self-start"
                data-testid={`exam-start-${module.skill}`}
              >
                {result
                  ? `Retake ${MODULE_LABELS[module.skill]}`
                  : `Start ${MODULE_LABELS[module.skill]}`}
              </ButtonLink>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-muted">
        Module content is written by the deep tier into the official blueprint on first start and
        cached; without the brain, a deterministic practice filler keeps every sitting possible.
      </p>
    </main>
  );
}
