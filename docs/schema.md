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

## Learner state (GT-004)

Added by GT-004; documented in the "Learner state collections" section below
when that issue lands.
