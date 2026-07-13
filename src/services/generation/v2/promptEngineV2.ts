import { buildV2LyricQualityInstruction } from "./lyricEngineV2";

export const PROMPT_ENGINE_V2_ID = "v2" as const;

export function isPromptEngineV2(version?: string | null): boolean {
  return version === PROMPT_ENGINE_V2_ID;
}

export interface PromptEngineV2InstructionOptions {
  isNoLyrics?: boolean;
}

export function buildPromptEngineV2OutputInstruction(options: PromptEngineV2InstructionOptions = {}): string {
  const lyricRule = options.isNoLyrics
    ? "- No-lyrics/instrumental mode is active, so keep lyrics empty and make [Vocals] explicitly instrumental/no vocals."
    : buildV2LyricQualityInstruction();

  return `GENERATION ENGINE: v2 — ISOLATED PROMPT ENGINE
- Version 2 is a separate engine path. Do not borrow Classic labels or Classic prompt wording.
- Cost rule: keep this as the same single Gemini response. Do not ask for analysis in a second call.
- Return productionPrompt with this exact label order and no extra labels:
  [Genre]
  [Sound]
  [Mood]
  [Vocals]
  [Production]
  [Audio quality improved to masterpiece]
- [Sound] owns the complete instrument, sound-source, texture, and playing-method line. Do not return [Instruments].
- [Mood] owns the scene air, emotional temperature, relationship/situation pressure, and space feeling. Do not return [Atmosphere].
- [Production] owns tempo when selected, groove, section movement, hook/release, dialogue ownership, and arrangement flow. Do not return [Arrangement].
- Keep [Genre] short and music-first. Keep [Vocals] as a natural singer-directing sentence.
- User free-text and Situation must shape [Sound], [Mood], [Production], and lyrics together; do not leave the story only inside [Vocals].
- Avoid abstract AI phrases, mood-word repetition, and generic phone/room/coffee scenes unless the user actually gave that scene.
- If the genre is fused, allow dense wording in Verse/Rap but keep Chorus/Hook breathable, short, and memorable.
${lyricRule}`;
}
