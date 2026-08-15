# V3 generation engine

V3 is an isolated, single-call Gemini generation engine.

## Non-negotiable boundaries

- V1 and V2 must not import V3 internals.
- V3 must not import V1/V2 scene builders, cue banks, MoodRoleTranslator output assembly, or content-rewriting postprocessors.
- User selections and free text are delivered without creative rewriting by application code.
- Gemini creates title, music prompt, and lyrics from one unified interpretation.
- Application code may preserve selected section order, section-tag grammar, lyric-length constraints, parsing, and format-only validation.
- Application code must not invent or replace characters, places, objects, actions, conflicts, emotions, or story outcomes.

Step 27 contains structure only. It is intentionally not connected to the engine selector or Gemini client.
