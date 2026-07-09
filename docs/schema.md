# Firestore Schema

All reads and writes go through the zod-backed converters in `lib/db/` (see
`lib/db/converter.ts`). No untyped Firestore access anywhere. Closed unions
(levels, skills, articles, error categories, statuses) are defined once in the
schema modules and imported everywhere else.

## Curriculum collections (GT-003, seed-written, read-heavy)

Source module: `lib/db/curriculum.ts`.

### `units/{unitId}`

`unitId` format: `{level}-{ordinal}`, lowercase, e.g. `a1-3`.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Same as document id |
| level | 'A1' \| 'A2' \| 'B1' | Closed union |
| ordinal | number | 1 to 6 within the level |
| theme | string | Unit theme |
| grammarItemIds | string[] | 2 to 3 refs into `grammarItems` |
| vocabSetRef | string | Ref to the unit's vocabulary set |
| capstoneDialogueRef | string | Ref to the capstone dialogue scenario |
| capstonePremise | string | One-line premise of the capstone dialogue (GT-101) |
| targetWordCount | number | Words introduced by the unit |

### `vocabulary/{wordId}`

| Field | Type | Notes |
|-------|------|-------|
| id | string | Same as document id |
| german | string | The word or phrase |
| wordType | 'noun' \| 'verb' \| 'adjective' \| 'adverb' \| 'phrase' \| 'other' | Closed union |
| article | 'der' \| 'die' \| 'das' \| null | Required (non-null) when wordType is noun; nouns are never stored bare |
| translation | string | English |
| ipa | string | Pronunciation |
| exampleDe / exampleEn | string | Example sentence and its translation |
| cefrLevel | 'A1' \| 'A2' \| 'B1' | Level the word belongs to |
| theme | string | Thematic group |
| picturable | boolean | Eligible for image identification |
| frequencyRank | number | Lower = more frequent (OpenSubtitles-derived) |

Index needs: composite `(cefrLevel asc, frequencyRank asc)` for day-set
selection; composite `(cefrLevel asc, theme asc, frequencyRank asc)` for
themed grouping within frequency order (PRD 3.3).

### `grammarItems/{itemId}`

| Field | Type | Notes |
|-------|------|-------|
| id | string | Same as document id |
| name | string | Human-readable name |
| level | 'A1' \| 'A2' \| 'B1' | Where the item is taught |
| weight | 1 \| 2 \| 3 | Difficulty weight per PRD Section 6 (1x/2x/3x) |

### `scenarios/{scenarioId}`

| Field | Type | Notes |
|-------|------|-------|
| id | string | Same as document id |
| title | string | Display title |
| level | 'A1' \| 'A2' \| 'B1' | Minimum level |
| setting | string | Scene description injected as scenario context |
| personaDescription | string | The native-speaker persona the brain plays |

### `mediaAssets/{assetKey}`

Keys are shared between placeholder and generated assets so the GT-504
provider flip needs zero data migration.

| Field | Type | Notes |
|-------|------|-------|
| kind | 'image' \| 'audio' | Closed union |
| key | string | Image: `{word}:{style}` where style is `flat` or `render`. Audio: bare `{clipId}` (no colon, no slash). Enforced by schema refinement. Same as document id. |
| styleOrClipId | string | The style (image) or clipId (audio) |
| status | 'placeholder' \| 'pending' \| 'generated' | Generation lifecycle |

## Learner state collections (GT-004)

Source module: `lib/db/learner.ts`. Single learner in v1: everything roots at
`learners/default`. The v2.1 auth switch (GT-601) changes only learnerId
resolution, never document shape. Path helpers: `learnerPaths` in the module.

### `learners/{learnerId}` (document: LearnerProfile)

| Field | Type | Notes |
|-------|------|-------|
| level | 'A1' \| 'A2' \| 'B1' | Current level |
| unitId | string | Current unit, e.g. `a1-1` |
| settings.voice | string | Selected tutor voice id |
| settings.dialect | 'hochdeutsch' \| 'berlin' | Dialect mode |
| settings.imageStyle | 'flat' \| 'render' \| 'mixed' | Image style preference |

### `learners/{learnerId}/cards/{wordId}` (FsrsCardState)

| Field | Type | Notes |
|-------|------|-------|
| wordId | string | Ref into `vocabulary` |
| phase | 'new' \| 'learning' \| 'review' \| 'relearning' | FSRS state name (called `phase` to avoid clashing with the domain word "state") |
| due | ISO datetime string | Next review |
| stability / difficulty | number | FSRS parameters |
| elapsedDays / scheduledDays | number | FSRS parameters |
| reps / lapses / learningSteps | integer | Counters (learningSteps added by GT-104 for ts-fsrs short-term steps) |
| lastReview | ISO datetime string \| null | Null until first review |

Index needs: `(due asc)` for the review queue (GT-105).

### `learners/{learnerId}/skillScores/{unitId}-{skill}` (SkillScore)

| Field | Type | Notes |
|-------|------|-------|
| unitId | string | Unit tested |
| skill | 'listening' \| 'reading' \| 'writing' \| 'speaking' | Closed union |
| score | number 0 to 100 | Latest attempt |
| attempts | Array<{ score, at }> | Append-only history, min 1 |

### `learners/{learnerId}/retentionScores/{unitId}` (RetentionScore)

| Field | Type | Notes |
|-------|------|-------|
| unitId | string | Passed unit |
| score | number 0 to 100 | Decays on failed/lapsed retests (GT-305) |
| lastRetestAt | ISO datetime string \| null | Last retest |

### `learners/{learnerId}/grammarErrors/{autoId}` (GrammarErrorLogEntry)

| Field | Type | Notes |
|-------|------|-------|
| category | 'gender' \| 'case' \| 'ending' \| 'order' \| 'spelling' \| 'choice' | Closed union; single write path lands at GT-214 |
| item | string | The grammar item or word involved |
| context | string | Snippet showing the error |
| at | ISO datetime string | When |

Index needs: `(category asc, at desc)` and `(at desc)` for analytics windows.

### `learners/{learnerId}/sessionReports/{autoId}` (SessionReport)

Fields per PRD 4.7 per-session list: sessionDate, wordsReviewed, recallRate
(0 to 1), newWords, imageIdAccuracy (0 to 1, null when no image exercises),
scenarioScore (0 to 10, null when no scenario), skillScores (partial record by
skill), errorsByCategory (partial record by category), grammarItemPracticed.

### `learners/{learnerId}/sessions/{sessionId}` (LessonSession, GT-108)

One document per session day (`session-YYYY-MM-DD`). Fields: id, unitId,
createdAt, currentStepIndex (0 to 4, resume point), steps (fixed five-step
array: warm-up with queueWordIds, new-vocabulary with theme and wordIds,
grammar-focus with grammarItemId, skill-practice with slot, wrap-up), status
('active' | 'completed'), grammarScore (0 to 10 or null; drives the
next-session resurfacing rule).

### `learners/{learnerId}/weeklySummaries/{weekStart}` (WeeklySummary)

Fields per PRD 4.6 weekly summary: weekStart, levelProgressPercent,
topErrorPatterns (max 5: category, item, occurrences, fix), retentionCurve
(points of at + score), streakDays, nextWeekFocus.
