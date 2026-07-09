export const PROMPT_ENGINE_V1_ID = "classic" as const;

export function buildPromptEngineV1OutputInstruction(): string {
  return `GENERATION ENGINE: v1 / Classic
- This is the legacy SORIDRAW engine. Keep it fully isolated from Version 2 rules.
- Use the existing classic production prompt labels exactly: [Genre], [Instruments], [Atmosphere], [Vocals], [Arrangement].
- Do not use Version 2 labels such as [Sound], [Mood], or [Production] in Classic output.
- Preserve the existing Classic behavior and post-processing path.`;
}
