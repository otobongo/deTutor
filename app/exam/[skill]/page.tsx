import Link from 'next/link';
import { skillSchema, type Skill } from '@/lib/db/curriculum';
import { B1_EXAM_BLUEPRINT } from '@/lib/assessment/b1-exam';
import { getExamModuleAction, submitExamModuleAction } from '@/app/actions/exam';
import { ExamModuleRunner } from '@/app/components/exam-module-runner';

// One B1 exam module: content generates on demand (deep tier) the first
// time this page opens and is cached forever; the deterministic filler
// covers brain outages so a sitting is always possible. The page stays a
// thin shell: the runner's exam canvas carries the visual mode.

export const dynamic = 'force-dynamic';

const MODULE_LABELS: Readonly<Record<Skill, string>> = {
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
};

export default async function ExamModulePage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill: rawSkill } = await params;
  const parsed = skillSchema.safeParse(rawSkill);
  const spec = parsed.success
    ? B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === parsed.data)
    : undefined;

  if (!parsed.success || !spec) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="font-display text-3xl font-semibold">B1 exam</h1>
        <p>
          This module does not exist.{' '}
          <Link className="text-ink underline" href="/exam">
            Back to the exam overview.
          </Link>
        </p>
      </main>
    );
  }

  const payload = await getExamModuleAction(parsed.data);

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col p-4 sm:p-8">
      <h1 className="text-sm font-medium text-ink-muted">
        Goethe-Zertifikat B1 · {MODULE_LABELS[parsed.data]} · {spec.minutes} Minuten
      </h1>
      <ExamModuleRunner
        skill={parsed.data}
        module={payload.module}
        source={payload.source}
        submit={submitExamModuleAction}
      />
    </main>
  );
}
