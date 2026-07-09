# Provider Flip (GT-504)

**Date:** 2026-07-09. The app itself did not change; only configuration did (PRD 7.6).

## How to flip

```bash
# .env.local
MEDIA_PROVIDER=gemini      # placeholder remains selectable for development
```

## What the Gemini provider serves

- **Images:** generated assets from `public/media/manifest.json` by the exact placeholder key
  (`{word}:{style}`), as URL sources. Ungenerated keys fall back to placeholder SVG tiles, so a
  partially generated corpus (generation is per-level batched by design) never breaks a flow.
- **Audio:** generated de-DE WAV clips by clipId as URL sources, `captionsRequired: false` with
  caption text retained for accessibility. Ungenerated clips fall back to the captioned
  speech-synthesis placeholder.
- **Voice:** `GeminiLiveVoiceSession` over the Live API (de-DE, profile voice, canonical system
  prompt with scenario context layered, VAD/barge-in, transcription on), emitting the identical
  event contract as the fallback session (cross-provider contract test in
  lib/media/voice-contract.test.ts).

## Regression results

- Full 17-check Playwright suite: **green** with `MEDIA_PROVIDER=gemini` (2026-07-09).
- Provider-seam unit tests: generated assets serve from cache without regeneration; fallbacks
  cover ungenerated keys; captions retained.
- Flip back to placeholder: the default CI run covers it on every invocation.

## Remaining owner steps

- Full media batches (sample batches are verified live; ~330 picturable A1 words at two styles
  plus ~650 pronunciation clips cost real API money):
  `npm run generate:images -- --level A1` and `npm run generate:audio -- --level A1`,
  then A2/B1 when the learner approaches those levels. Both commands are idempotent and resume
  after interruption.
- Live voice needs a real-microphone browser session to verify audibly; the event contract and
  configuration are tested, the audio path is not verifiable headlessly (noted in board.md).
