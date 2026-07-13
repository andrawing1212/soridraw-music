export interface V1SharedSceneAlignmentContext {
  directorNote: string;
  directTheme: string;
  directMood: string;
  storyboard: string;
  lyricDraft: string;
  selectedThemes: string[];
  selectedMoods: string[];
  additionalDetail: string;
  productionOnlyDirectorNote: boolean;
}

const clean = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim();

const formatList = (values: string[]): string => {
  const cleaned = values.map(clean).filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : 'None';
};

/**
 * V1 creative contract.
 *
 * This file deliberately contains no topic-to-scene mapping and no example story.
 * It only defines how Gemini must keep one user-driven scene consistent across
 * the production prompt and lyrics.
 */
export function buildV1SharedSceneAlignmentInstruction(
  context: V1SharedSceneAlignmentContext,
): string {
  const directorNote = clean(context.directorNote);
  const directTheme = clean(context.directTheme);
  const directMood = clean(context.directMood);
  const storyboard = clean(context.storyboard);
  const lyricDraft = clean(context.lyricDraft);
  const additionalDetail = clean(context.additionalDetail);
  const selectedThemes = formatList(context.selectedThemes || []);
  const selectedMoods = formatList(context.selectedMoods || []);

  const hasExplicitStorySource = Boolean(
    directTheme || storyboard || lyricDraft || (directorNote && !context.productionOnlyDirectorNote),
  );
  const directorStoryRule = context.productionOnlyDirectorNote
    ? '- The director note is production/performance-shaped, so it may shape genre, sound, vocal attitude, pacing, and hook design, but it must not invent a separate story. Resolve the shared scene from the direct theme, storyboard, lyric draft, or selected Theme/Mood signals.'
    : '- When the director note contains people, actions, places, relationships, conflict, humor, or plot, treat those facts as part of the shared scene at full priority. Do not reduce them to a generic summary.';

  return `V1 ONE-SCENE ALIGNMENT CONTRACT (MANDATORY, INTERNAL ONLY — NEVER OUTPUT THIS LABEL):
- Before writing the title, productionPrompt, or lyrics, silently resolve ONE coherent song scene from the sources below.
- The production prompt and lyrics must describe the SAME speaker/addressee, place boundary, visible action, desire/conflict, lived detail, and emotional turn. Do not create a second scene for any output lane.
- Preserve explicit user facts exactly in meaning. Do not replace unusual details with a stock romance, breakup, bedroom, cafe, office, road, phone-screen, space, food, or other canned scenario.
- Do not use topic-specific code logic or keyword-to-scene templates. Gemini must infer the scene from the full source combination each time.
- If several sources are present, reconcile them into one scene instead of letting each source create a different story.
- Explicit direct input and the free-text director note outrank automatic keyword-card inference.
- Storyboard/Situation character, relationship, and scenario facts are locked unless the user's direct instruction explicitly changes them.
- In lyric preserve/correction mode, the lyric draft remains the primary lyrical story source; align the production prompt to that scene instead of rewriting the draft into a different story.
- Selected Theme signals may fill missing story gaps only when explicit sources do not define them. Mood only colors emotional temperature and must not invent new objects/events.
${directorStoryRule}
- ${hasExplicitStorySource ? 'An explicit story source exists. Keep its actual characters, action, relationship, place, and conflict; selected keywords may support it but may not replace it.' : 'No explicit story source is locked. Create one fresh believable scene from the selected Theme signals and use the selected Mood only as emotional color.'}

SHARED SCENE SOURCES:
- Director note: ${directorNote || 'None'}
- Direct theme/input: ${directTheme || 'None'}
- Direct mood/input: ${directMood || 'None'}
- Storyboard/Situation: ${storyboard || 'None'}
- Lyric draft source: ${lyricDraft || 'None'}
- Selected Themes: ${selectedThemes}
- Selected Moods: ${selectedMoods}
- Additional detail: ${additionalDetail || 'None'}

CROSS-LANE SCENE OWNERSHIP:
- [Genre]: express the musical identity and selected mood color. It may frame the scene musically, but it must not invent or replace the scene.
- [Instruments]: preserve user-selected sound anchors, then describe how the instruments play in response to the SAME visible action, tension, intimacy, humor, distance, or emotional pressure. Instrument performance must support the scene without inventing new plot facts.
- [Atmosphere]: state the SAME concrete scene and emotional air clearly enough that the listener understands the situation even without seeing the lyrics.
- [Vocals]: the singer(s) must perform from inside the SAME scene. Delivery, phrasing, distance, restraint, urgency, humor, or conflict must feel like the character's immediate reaction to that scene. Preserve selected vocal identity and technique without replacing the scene.
- [Arrangement]: section movement must follow the SAME action/relationship/emotional progression. Verse establishes what is happening, later sections increase or redirect pressure, the chorus releases the central desire, and the bridge/final section changes or resolves the same situation. Do not introduce a second story arc.
- Lyrics: write character speech and behavior inside the SAME scene. Reuse the same factual anchors and emotional turn without merely copying the production-prompt wording.
- Title: derive from the same scene, action, detail, or central line; do not introduce an unrelated image.

FINAL CONSISTENCY CHECK BEFORE JSON:
1. Could [Instruments], [Atmosphere], [Vocals], [Arrangement], title, and lyrics all belong to one exact song scene?
2. Do the production prompt and lyrics agree on who is present, what is happening, what is wanted, and what changes?
3. Did any selected sound, style, mood, genre, or validator phrase invent a different object, place, event, relationship, or conflict?
4. If any lane points to a different scene, rewrite that lane before returning JSON.
- Never output meta phrases such as shared scene, source text, blueprint, user intent, core idea, or scene alignment.`;
}

function stripVocalSubject(value: string): string {
  return clean(value)
    .replace(/^\[Vocals\]\s*/i, '')
    .replace(/^(?:Natural\s+)?(?:(?:female|male|solo|dual|group|mixed|all|\d+[-\s]?member)\s+)*(?:conversational\s+)?vocals?\s+(?:with\s+)?/i, '')
    .replace(/^with\s+/i, '')
    .trim();
}

/**
 * Selected vocal identity must not erase Gemini's scene-reactive performance.
 * The merge is syntax-only: it does not infer topics or add story content.
 */
export function mergeV1ForcedVocalIdentityWithGeneratedPerformance(
  forcedIdentityLine: string,
  generatedVocalLine: string,
): string {
  const forced = clean(forcedIdentityLine).replace(/^\[Vocals\]\s*/i, '');
  const generated = clean(generatedVocalLine).replace(/^\[Vocals\]\s*/i, '');
  if (!forced) return generated;
  if (!generated) return forced;

  if (/\b(?:Vocal\s+[A-E]|role\s+split|voice\s+character:)\b/i.test(generated)) return forced;

  const generatedTail = stripVocalSubject(generated);
  if (!generatedTail) return forced;

  const forcedKey = forced.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tailKey = generatedTail.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!tailKey || forcedKey.includes(tailKey)) return forced;

  return `${forced}, ${generatedTail}`
    .replace(/\bwith\s+with\b/gi, 'with')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
