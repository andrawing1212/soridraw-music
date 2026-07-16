# SORIDRAW generation engines

Each generation version owns its creative assembly, lyric style, rules, examples,
and output normalization. Version-specific creative modules must not be shared.

- `v1/`: current Classic five-line engine. The shared Section Performance Plan now
  carries structured vocal fields and a section-bound Arrangement timeline in the
  first Gemini response. The large legacy body remains in `geminiService.ts` until
  a later safe migration.
- `v2/`: existing V2 song, prompt, and lyric implementation now lives inside
  this folder.
- `v3/`: isolated high-freedom single-call engine under construction.
- `shared/`: routing and non-creative technical types only.

Shared code must never decide story, scene, mood interpretation, lyric style,
prompt wording, or post-generation creative rewriting.

## Engine map

See `docs/SORIDRAW_ENGINE_MAP.md` for the current active engines, application order,
and ownership boundaries.
