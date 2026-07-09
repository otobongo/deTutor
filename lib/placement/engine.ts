import type { Level, Skill } from '@/lib/db/curriculum';
import type { PlacementProbe } from '@/db/seed/placement-probes';

// Placement ladder engine (GT-106), pure and deterministic. Five probes per
// stage; 4+ correct escalates to the next stage. Starting-unit policy (fixed
// by the plan's own acceptance tests): passing A1 probes earns an A2 start,
// but a B1 start must be earned by passing the B1 probes themselves; a
// failed B1 stage falls back to the A2 start.

export const ESCALATION_THRESHOLD = 4;

export interface PlacementAnswer {
  readonly probeId: string;
  readonly answer: string;
}

export interface StageResult {
  readonly level: Level;
  readonly administered: number;
  readonly correct: number;
  readonly passed: boolean;
}

export interface PlacementResult {
  readonly startingLevel: Level;
  readonly startingUnitId: string;
  readonly stages: readonly StageResult[];
  // Percent correct (0 to 100) per skill across all administered probes.
  readonly skillBaselines: Partial<Record<Skill, number>>;
}

function normalize(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isCorrect(probe: PlacementProbe, answer: string): boolean {
  return probe.correctAnswers.some((accepted) => normalize(accepted) === normalize(answer));
}

const STAGE_ORDER: readonly Level[] = ['A1', 'A2', 'B1'];

function stageResult(
  probes: readonly PlacementProbe[],
  answersById: ReadonlyMap<string, string>,
  level: Level,
): StageResult {
  const stageProbes = probes.filter((probe) => probe.level === level);
  const correct = stageProbes.filter((probe) => {
    const answer = answersById.get(probe.id);
    return answer !== undefined && isCorrect(probe, answer);
  }).length;
  return {
    level,
    administered: stageProbes.length,
    correct,
    passed: correct >= ESCALATION_THRESHOLD,
  };
}

// Which stage the UI should administer next; null when the ladder is done.
export function nextStage(
  probes: readonly PlacementProbe[],
  answers: readonly PlacementAnswer[],
): Level | null {
  const answersById = new Map(answers.map((answer) => [answer.probeId, answer.answer]));
  for (const level of STAGE_ORDER) {
    const stageProbes = probes.filter((probe) => probe.level === level);
    const answered = stageProbes.every((probe) => answersById.has(probe.id));
    if (!answered) return level;
    if (!stageResult(probes, answersById, level).passed) return null;
  }
  return null;
}

export function runPlacement(
  probes: readonly PlacementProbe[],
  answers: readonly PlacementAnswer[],
): PlacementResult {
  const answersById = new Map(answers.map((answer) => [answer.probeId, answer.answer]));

  const stages: StageResult[] = [];
  for (const level of STAGE_ORDER) {
    const stageProbes = probes.filter((probe) => probe.level === level);
    const administered = stageProbes.every((probe) => answersById.has(probe.id));
    if (!administered) break;
    stages.push(stageResult(probes, answersById, level));
    if (!(stages[stages.length - 1] as StageResult).passed) break;
  }

  const passed = new Set(stages.filter((stage) => stage.passed).map((stage) => stage.level));
  const startingLevel: Level = passed.has('B1') ? 'B1' : passed.has('A1') ? 'A2' : 'A1';
  const startingUnitId = `${startingLevel.toLowerCase()}-1`;

  const administeredProbes = probes.filter((probe) =>
    stages.some((stage) => stage.level === probe.level),
  );
  const skillBaselines: Partial<Record<Skill, number>> = {};
  const bySkill = new Map<Skill, { correct: number; total: number }>();
  for (const probe of administeredProbes) {
    const tally = bySkill.get(probe.skill) ?? { correct: 0, total: 0 };
    tally.total += 1;
    const answer = answersById.get(probe.id);
    if (answer !== undefined && isCorrect(probe, answer)) tally.correct += 1;
    bySkill.set(probe.skill, tally);
  }
  for (const [skill, tally] of bySkill) {
    skillBaselines[skill] = Math.round((100 * tally.correct) / tally.total);
  }

  return { startingLevel, startingUnitId, stages, skillBaselines };
}
