# V1 engine

V1 is the current Classic five-line production-prompt engine.

## Current ownership

- `geminiService.ts` still contains most legacy V1 generation and validation code.
- `generation/v1/generateV1.ts` is the V1 entry boundary.
- `generation/v1/rules/sharedSceneAlignment.ts` owns the V1 one-scene contract.

## One-scene contract

V1 must resolve one user-driven scene and keep it consistent across:

- title
- `[Instruments]` playing behavior
- `[Atmosphere]` scene description
- `[Vocals]` character delivery
- `[Arrangement]` section progression
- lyrics

The scene may come from selected Theme/Mood signals, direct theme input, the free-text director note, Storyboard/Situation, or a lyric draft. Explicit user facts always outrank automatic keyword inference.

This rule file must never contain topic-to-scene mappings or example-specific story branches. It may define only source priority, cross-lane consistency, and syntax-only preservation behavior.

V1 must not import V2 or V3 creative logic.
