import type { GrammarErrorLogEntry, RetentionScore, SkillScore } from '@/lib/db/learner';
import {
  HARD_AREAS,
  hardAreaTrends,
  retentionHeat,
  skillTrajectories,
} from '@/lib/analytics/dashboard';

// Level dashboard (GT-310): per-skill trajectories, retention heat by unit,
// and hard-area error trends, all rendered from stored aggregates with
// simple width-scaled bars (no chart library, no invented numbers).

const BAND_CLASSES: Record<string, string> = {
  healthy: 'bg-success-tint',
  warm: 'bg-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]',
  decayed: 'bg-error-tint',
};

export function LevelDashboard({
  skillScores,
  retentions,
  errors,
  now,
}: {
  skillScores: readonly SkillScore[];
  retentions: readonly RetentionScore[];
  errors: readonly GrammarErrorLogEntry[];
  now: Date;
}) {
  const trajectories = skillTrajectories(skillScores);
  const heat = retentionHeat(retentions);
  const trends = hardAreaTrends(errors, 4, now);
  const empty = skillScores.length === 0 && retentions.length === 0 && errors.length === 0;

  if (empty) {
    return (
      <p data-testid="dashboard-empty">
        The level dashboard fills in as you complete unit tests and retests.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="level-dashboard">
      <section aria-labelledby="trajectories-heading">
        <h3 id="trajectories-heading" className="font-medium">
          Skill trajectories
        </h3>
        {Object.entries(trajectories).map(([skill, points]) => (
          <p key={skill} className="text-sm" data-testid={`trajectory-${skill}`}>
            <span className="capitalize">{skill}: </span>
            {points.map((point) => point.score).join(' -> ')}
          </p>
        ))}
      </section>

      <section aria-labelledby="retention-heading">
        <h3 id="retention-heading" className="font-medium">
          Retention by unit
        </h3>
        <ul className="flex flex-wrap gap-2">
          {heat.map((cell) => (
            <li
              key={cell.unitId}
              className={`rounded-sm px-2 py-1 text-sm ${BAND_CLASSES[cell.band]}`}
              data-testid={`retention-${cell.unitId}`}
              data-band={cell.band}
            >
              {cell.unitId.toUpperCase()}: {cell.score}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hard-areas-heading">
        <h3 id="hard-areas-heading" className="font-medium">
          Hard-area errors per week (falling is improving)
        </h3>
        {HARD_AREAS.map((category) => (
          <div key={category} className="text-sm" data-testid={`trend-${category}`}>
            <span className="capitalize">{category}: </span>
            {trends[category].map((week) => week.count).join(', ')}
          </div>
        ))}
      </section>
    </div>
  );
}
