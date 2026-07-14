export interface V1StoryContextInput {
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
 * V1 Story Context contract.
 *
 * Story Context is intentionally flexible. It may be a single scene, a broad
 * situation, a relationship, a day-long progression, an emotional condition,
 * an abstract image, a premise, or a production-shaped direction. It is never
 * completed with topic-specific templates or compulsory story slots.
 */
export function buildV1StoryContextInstruction(
  context: V1StoryContextInput,
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
  const directorRule = context.productionOnlyDirectorNote
    ? '- The director note is production/performance-shaped. Apply it to music, pacing, hook behavior, vocal attitude, and section motion, but do not force a literal place, object, character, or plot that the user did not provide.'
    : '- The director note may contain a scene, a situation, a relationship, a whole-day premise, an emotional state, a social observation, a joke, an abstract image, or a plot. Preserve whichever form the user actually wrote instead of converting it into a fixed scene checklist.';

  return `V1 STORY CONTEXT CONTRACT (MANDATORY, INTERNAL ONLY):
- Before writing JSON, resolve ONE concise Story Context that preserves the user's overall meaning.
- Story Context is the song's shared narrative center. It may be a single visual scene, a wider situation, a relationship, a period of time, a character condition, a desire, a conflict, an emotional progression, an abstract image, or a production-shaped premise.
- Story Context is NOT a form to complete. Do not require speaker, addressee, place, object, visible action, conflict, or ending when the source does not naturally provide them.
- Do not convert every input into an image-like scene. A phrase such as a person's difficult day, a relationship dynamic, or a wish that lasts across time must remain that wider situation.
- Preserve explicit user facts exactly in meaning. Do not replace unusual material with stock romance, breakup, bedroom, cafe, office, road, phone-screen, food, space, or any other canned scenario.
- Do not use topic-specific mappings, keyword-to-scene templates, or compulsory narrative slots.
- When information is missing, keep the context naturally open or add only the minimum connective tissue needed for coherence. Never invent props, places, events, characters, or conflicts merely to make the context look detailed.
- When several sources exist, combine only compatible meanings. Higher-priority direct input must not be diluted by lower-priority cards.
- Direct input, active Situation/Storyboard, and lyric draft facts are locked. Selected Theme may fill a genuine gap; selected Mood may color emotional temperature and expression only.
- Creative variation may change viewpoint, section emphasis, hook ownership, or the order of emotional development inside the SAME Story Context. It must not replace the context with a different story.
- This Story Context contract overrides older V1 wording that asks for a compulsory Scene Blueprint, fixed speaker/addressee slots, a mandatory place/object/action, or one frozen visual frame.
${directorRule}
- ${hasExplicitStorySource ? 'An explicit narrative source exists. Preserve its full intent and shape; do not shrink it into a generic summary.' : 'No explicit narrative source is locked. Build a simple coherent Story Context from selected Theme signals, while Mood remains expression color rather than plot.'}

STORY CONTEXT SOURCES BY PRIORITY:
1. Director/free-text note: ${directorNote || 'None'}
2. Direct theme/input: ${directTheme || 'None'}
3. Storyboard/Situation: ${storyboard || 'None'}
4. Lyric draft source: ${lyricDraft || 'None'}
5. Selected Themes: ${selectedThemes}
6. Direct/selected Mood as expression color: ${directMood || selectedMoods}
7. Additional interpreted detail: ${additionalDetail || 'None'}

JSON STORY CONTEXT FIELD:
- Return a top-level JSON field named storyContext.
- Write storyContext in concise natural English as 1-3 sentences, not a checklist, labels, or JSON inside JSON.
- Keep the source's natural scope. Do not add mandatory people, places, actions, objects, or conclusions.
- The narrative/topic meaning from Direct Theme, selected Theme, Situation, lyric draft, or story-shaped director text is the content core. Mood is only emotional color around that core and must never replace it.
- This field is internal application data. Never mention the label Story Context inside title, productionPrompt, or lyrics.

JSON STORY ATMOSPHERE FIELD:
- Return a top-level JSON field named storyAtmosphere.
- Write storyAtmosphere in natural English as the final content for the visible [Atmosphere] lane, without the [Atmosphere] label.
- Start from the same Story Context and preserve its recognizable topic, situation, relationship, condition, or progression. Then add the selected/direct Mood only as emotional temperature, tone, or texture.
- Do not replace a specific or unusual Story Context with a generic human moment, generic emotional scene, mood list, compulsory prop, or stock scenario.
- Keep it concise and music-friendly, but never compress away the narrative core.

ONE-CONTEXT OUTPUT OWNERSHIP:
- [Genre]: musical identity only. It may carry a light emotional color but must not invent or replace the Story Context.
- [Instruments]: selected sound anchors and how the music responds to the Story Context's pressure, movement, intimacy, humor, scale, or restraint. Do not invent plot facts.
- [Atmosphere]: use storyAtmosphere as the authoritative lane. Express the Story Context as musical air and a clear situation, with Theme/story meaning first and Mood as added color. It may describe one scene when the source is scene-shaped, or a broader state/progression when the source is situation-shaped. Do not force a single still image.
- [Vocals]: perform from inside the same Story Context. Vocal identity and technique remain musical directions; attitude and phrasing should react to the same situation.
- [Arrangement]: unfold the same Story Context through the selected sections. Each section may reveal a different phase or pressure, but must not introduce a separate narrative.
- Lyrics: naturally develop the same Story Context through speech, thought, behavior, progression, or image. Do not copy production wording and do not create a parallel story.
- Title: come from the same central meaning, desire, situation, phrase, or emotional turn. Do not introduce an unrelated image.

FINAL CHECK BEFORE RETURNING JSON:
1. Does storyContext faithfully preserve the strongest user input without compulsory missing-field invention?
2. Could Atmosphere, lyrics, title, vocals, and arrangement all belong to that exact Story Context, even when it spans multiple moments rather than one visual frame?
3. Did any genre, sound, style, mood, variation, validator phrase, or selected card introduce a different object, place, relationship, event, or conflict?
4. If any output lane drifts, rewrite that lane before returning JSON.
- Never output meta phrases such as Story Context, shared scene, source text, blueprint, user intent, core idea, or alignment inside visible song content.`;
}

// Compatibility aliases for older V1 imports. New V1 code should use Story Context names.
export type V1SharedSceneAlignmentContext = V1StoryContextInput;
export const buildV1SharedSceneAlignmentInstruction = buildV1StoryContextInstruction;

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
