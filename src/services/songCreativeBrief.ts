import { MOODS } from "../constants";
import type { CategoryItem } from "../types";

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function listValues(values: unknown, limit = 12): string {
  if (!Array.isArray(values)) return '';
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .slice(0, limit)
    .join(' / ');
}

function compact(value: unknown, fallback = 'none'): string {
  const text = cleanText(value);
  return text || fallback;
}

function summarizeSituation(situation: any): string {
  if (!situation || typeof situation !== 'object') return 'none';
  return [
    situation.description,
    situation.detailCustom,
    situation.relationship,
    situation.development,
    situation.speakerStyle,
    situation.attitude,
    situation.targetA,
    situation.targetB,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(' / ') || 'none';
}


type ResolvedMoodProfiles = {
  known: CategoryItem[];
  custom: string[];
};

function normalizeMoodLookupKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/[\s_\-–—/.,:;]+/g, '')
    .trim();
}

function moodSourceValue(value: unknown): string {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    return cleanText(candidate.id || candidate.labelKo || candidate.label || candidate.mood);
  }
  return cleanText(value);
}

const MOOD_CATALOG_LOOKUP = (() => {
  const lookup = new Map<string, CategoryItem>();
  MOODS.forEach((item) => {
    [item.id, item.label, item.labelKo].forEach((value) => {
      const key = normalizeMoodLookupKey(value);
      if (key && !lookup.has(key)) lookup.set(key, item);
    });
  });
  return lookup;
})();

function findMoodCatalogItem(value: unknown): CategoryItem | undefined {
  const key = normalizeMoodLookupKey(moodSourceValue(value));
  return key ? MOOD_CATALOG_LOOKUP.get(key) : undefined;
}

function collectMoodSourceValues(params: any): string[] {
  const values = [
    ...(Array.isArray(params?.moods) ? params.moods : []),
    params?.mood,
    params?.customMoodInput,
    params?.customMoodText,
    params?.directMoodInput,
    params?.directMoodText,
  ]
    .map(moodSourceValue)
    .filter(Boolean);

  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeMoodLookupKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveSelectedMoodProfiles(params: any): ResolvedMoodProfiles {
  const known: CategoryItem[] = [];
  const custom: string[] = [];
  const knownIds = new Set<string>();
  const customKeys = new Set<string>();

  collectMoodSourceValues(params).forEach((value) => {
    const item = findMoodCatalogItem(value);
    if (item) {
      if (!knownIds.has(item.id)) {
        knownIds.add(item.id);
        known.push(item);
      }
      return;
    }

    const key = normalizeMoodLookupKey(value);
    if (key && !customKeys.has(key)) {
      customKeys.add(key);
      custom.push(value);
    }
  });

  return { known, custom };
}

function formatSelectedMoodSource(params: any, fallback = 'none'): string {
  const { known, custom } = resolveSelectedMoodProfiles(params);
  const values = [
    ...known.map((item) => item.labelKo ? `${item.labelKo} (${item.label})` : item.label),
    ...custom,
  ];
  return values.length ? values.join(' / ') : fallback;
}

function buildMoodCatalogProfileContext(params: any): string {
  const { known, custom } = resolveSelectedMoodProfiles(params);
  const lines: string[] = [];

  if (known.length) {
    lines.push('Resolved catalog mood profiles (use meaning, not just the visible label):');
    known.forEach((item) => {
      const identity = item.labelKo ? `${item.labelKo} (${item.label})` : item.label;
      lines.push(`- ${identity}: emotional character=${compact(item.mood, item.label)}; section movement=${compact(item.arrangement, 'adaptive movement')}; meaning=${compact(item.description, 'use the catalog meaning')}`);
    });
  }

  if (custom.length) {
    lines.push(`Custom/free mood direction (interpret freely in context): ${custom.join(' / ')}`);
  }

  return lines.length
    ? lines.join('\n')
    : 'Resolved catalog mood profiles: none';
}

function formatSelectedThemeSource(params: any, fallback = 'none'): string {
  const values = [
    ...(Array.isArray(params?.themes) ? params.themes : []),
    params?.theme,
    params?.customThemeInput,
    params?.customThemeText,
    params?.directThemeInput,
    params?.directThemeText,
  ]
    .map(cleanText)
    .filter(Boolean);

  const seen = new Set<string>();
  const unique = values.filter((value) => {
    const key = value.toLowerCase().replace(/[\s_\-–—/.,:;]+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.length ? unique.join(' / ') : fallback;
}

export function buildMoodDirectorBrief(params: any): string {
  const selectedMood = formatSelectedMoodSource(params);
  const selectedTheme = formatSelectedThemeSource(params);
  const directorText = compact(params?.userInput, 'none');
  const situation = summarizeSituation(params?.situation);
  const moodProfileContext = buildMoodCatalogProfileContext(params);

  return `GLOBAL MOOD DIRECTIVE (MANDATORY, INTERNAL ONLY):
Selected mood source: ${selectedMood}
${moodProfileContext}
Related story signals: theme=${selectedTheme} / director=${directorText} / situation=${situation}

Treat Mood as a compressed global direction for the whole song, not as the [Atmosphere]/[Mood] line only.
Mood must influence every output lane indirectly and differently: Genre, Sound/Instruments, Atmosphere/Mood, Vocals, Production/Arrangement, title, and lyrics.
Do not copy mood labels or their obvious literal children into lyrics.

First silently resolve all selected moods into ONE short global directive:
- core song identity: the emotional flavor that seasons the whole track
- surface energy: bright, calm, playful, funky, vintage, breezy, heavy, dry, loose, etc.
- hidden layer: what emotional aftertaste remains under the surface
- relationship pressure: closeness, distance, awkwardness, avoidance, tension, release
- movement: still, dragging, bouncing, rushing, hesitating, opening up
- section curve: how verse, pre-chorus, chorus, bridge should move emotionally

Global routing rule:
- Genre: season the genre identity lightly. Example: vintage/funky/breezy/upbeat may color the genre phrase, but do not replace the selected genre.
- Sound/Instruments: translate mood into sound texture, weight, air, tightness, roughness, polish, dryness, bounce, openness, or density.
- Atmosphere/Mood: express the final emotional design directly, but keep it music-friendly and not object-heavy.
- Vocals: translate mood into delivery, distance, diction, restraint, confidence, looseness, breath, or emotional pressure.
- Production/Arrangement: translate mood into section motion, build, drop, hook lift, contrast, space, and pacing.
- Lyrics: translate mood only into speech attitude, sentence length, hesitation, joke, silence, directness, repetition, and emotional scale.

Compression rule:
- The hidden directive may be detailed, but final prompt lines must stay short and clear.
- Do not repeat the same mood adjective in every line. Each line should receive only the mood aspect that fits its role.
- If many moods conflict, blend them into one clear intent rather than listing every selected keyword.
- Merge multiple arrangement profiles into ONE coherent section curve. Do not paste separate movement phrases that fight each other.
- If mood is weak or absent, keep the song emotionally simple rather than inventing decorative atmosphere.

Theme/action anchor guard:
- Preserve the semantic action, decision, desire, or relationship change in a direct/custom Theme. Do not reduce a phrase such as "a night to begin again" to the setting word "night" alone.
- [Atmosphere]/[Mood] should retain the core human action or intention when one is explicitly supplied, while remaining concise and music-friendly.

Leak guard:
- Prompt should not become a screenplay. Lyrics should not become a list of production words.
- Never output internal/meta phrases such as "the user's core idea", "visible musical moment", "the central voice", or "a compact emotional space".
- Never output helper templates such as "sonic texture with ... qualities", "vocal delivery with ... character", or a repeated "... emotional color" suffix.
- Mood is a seasoning directive, not a pile of words to paste. Think bibimbap sesame oil: it touches the whole bowl, but it does not become every ingredient.`;
}

export function buildCreativeBriefSourceSummary(params: any): string {
  const storyInputs = [
    `director/free text: ${compact(params?.userInput, 'none')}`,
    `situation: ${summarizeSituation(params?.situation)}`,
    `lyric draft: ${compact(params?.lyricDraft, 'none')}`,
    `selected theme: ${formatSelectedThemeSource(params)}`,
    `selected mood: ${formatSelectedMoodSource(params)}`,
  ];
  const musicInputs = [
    `genre: ${compact(params?.genre, 'none')}`,
    `sub genre: ${listValues(params?.subGenre, 8) || 'none'}`,
    `style: ${listValues(params?.styleValues ?? params?.styles, 8) || 'none'}`,
    `sound/instrument: ${listValues(params?.instrumentSounds, 12) || 'none'}`,
    `point sound: ${listValues(params?.pointSounds, 8) || 'none'}`,
    `vocal: ${compact(params?.vocal?.tonePrompt || params?.vocal?.mode, 'none')}`,
    `tempo: ${compact(params?.tempo, params?.isRandomTempo ? 'random' : 'none')}`,
    `structure: ${compact(params?.songStructure, 'default')}`,
  ];

  return `STORY INPUTS:\n- ${storyInputs.join('\n- ')}\n\nMUSIC INPUTS:\n- ${musicInputs.join('\n- ')}`;
}

export function buildSongCreativeBriefInstruction(params: any): string {
  return `COMMON SONG CREATIVE BRIEF (MANDATORY, INTERNAL ONLY):
Before writing productionPrompt, title, or lyrics, silently build ONE shared creative brief from the inputs below. Do NOT output the brief.

${buildCreativeBriefSourceSummary(params)}

${buildMoodDirectorBrief(params)}

Priority:
1. User director/free text and explicit Situation fields define the story world.
2. Lyric draft, selected Theme, and selected Mood support the story only when they do not conflict.
3. Genre, Style, Sound, instruments, tempo, structure, and production keywords define music/performance. They must not invent story objects, places, props, or title concepts.

Separate the brief into three lanes:
- STORY LANE: speaker, addressee, current situation, relationship, allowed scene boundary, and everyday Korean speech tone.
- MUSIC LANE: genre identity, sound palette, vocal direction, tempo/structure, and production movement.
- EXPRESSION BRIDGE: how music changes lyric delivery only: line length, repetition, hook directness, emotional size, section energy, breath, and phrasing.

Shared-brief rule:
- productionPrompt and lyrics must come from the same hidden brief so the song feels connected.
- Do NOT let productionPrompt wording become lyric objects. Lyrics must not copy [Genre], [Sound]/[Instruments], [Mood]/[Atmosphere], [Vocals], or [Production]/[Arrangement] phrases as story content.
- Do NOT let lyric props or random scene details pollute productionPrompt. Prompt should describe musical air and movement, not explain a screenplay.

Global mood routing rule:
- The selected Mood is a global seasoning directive for all five prompt lanes, not only Atmosphere/Mood.
- Genre receives only a small mood color; Sound receives texture/weight/air; Atmosphere receives emotional state; Vocals receive delivery/emotional pressure; Production receives section motion and density.
- If Vocal Character is selected, do not let the character become a disconnected preset. Treat the selected Genre menu choice + Mood + Theme as the upper performance director: the character identity stays, but delivery, phrasing, emotional distance, hook focus, and pressure must melt into the selected song world.
- Genre-specific vocal habits must come from the actual selected genre/subgenre only. Do not infer vocal style from Sound/Instruments chips such as electric bass, electric guitar, future-bass synths, trap drums, 808, risers, or pads. Those belong to Sound/Production unless they are explicit vocal effects.
- Only explicit vocal-effect sounds may affect [Vocals], such as radio voice, telephone voice, vocoder, auto-tune, whisper voice, choir, humming, chant, or ghost voice.
- Preserve the action/decision/desire in direct or custom Theme input; do not keep only its time/place noun.
- Merge mood movement cues into one compatible arrangement curve instead of listing conflicting phrases side by side.
- Before final output, remove internal/meta wording: the user's core idea, visible musical moment, the central voice, a compact emotional space.
- Prefer compact music-direction language over object-heavy imagery, and keep each final prompt line short.

Lyric rule:
- Title and lyrics use STORY LANE first.
- Music lane may affect delivery, rhythm, hook density, and emotional scale, but not lyric subject matter.
- If story source is weak, write a simpler human situation. Do not compensate by inventing genre-themed scenes.
- Korean lyric body must sound like contemporary Korean speech/thought, not translated AI prose or decorative metaphor stacking.`;
}

function collectMoodDirectiveText(params: any): string {
  const { known, custom } = resolveSelectedMoodProfiles(params);
  return [
    ...known.flatMap((item) => [item.id, item.label, item.labelKo, item.mood, item.arrangement, item.description]),
    ...custom,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type GlobalMoodLaneCues = {
  genre: string;
  sound: string;
  mood: string;
  vocals: string;
  production: string;
};


function splitCatalogCueParts(value: unknown, limit = 3): string[] {
  return cleanText(value)
    .split(/[,;/|]+/)
    .map((part) => part.replace(/[.]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function lowerCueStart(value: string): string {
  if (!value) return '';
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildCatalogMoodLaneCues(item: CategoryItem): GlobalMoodLaneCues {
  const moodParts = splitCatalogCueParts(item.mood || item.label, 3);
  const movementParts = splitCatalogCueParts(item.arrangement, 2);
  const primary = lowerCueStart(moodParts[0] || item.label || 'balanced');
  const secondary = lowerCueStart(moodParts[1] || '');
  const character = [primary, secondary].filter(Boolean).join(' and ');

  return {
    genre: primary,
    sound: character,
    mood: moodParts.join(', '),
    vocals: character,
    production: movementParts.join(', '),
  };
}

function joinCueParts(parts: string[], limit = 3): string {
  const seen = new Set<string>();
  return parts
    .map(cleanText)
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .join(', ');
}

export function buildGlobalMoodLaneCues(params: any): GlobalMoodLaneCues {
  const resolved = resolveSelectedMoodProfiles(params);
  const text = collectMoodDirectiveText(params);
  if (!text) return { genre: '', sound: '', mood: '', vocals: '', production: '' };

  const has = (pattern: RegExp) => pattern.test(text);
  const dreamy = has(/몽상|몽환|꿈결|dream|dreamy|hazy|floating|blurred/);
  const vintage = has(/빈티지|레트로|아날로그|빛바랜|낡은|vintage|retro|analog|dusty/);
  const warm = has(/따뜻|포근|다정|온화|warm|cozy|tender|intimate/);
  const hollow = has(/공허|허전|비어|empty|hollow|void|lonely|loneliness/);
  const funky = has(/펑키|그루브|groovy|funk|funky|bounce|bouncy/);
  const breezy = has(/시원|산뜻|청량|breezy|refreshing|open|cool/);
  const upbeat = has(/업비트|밝|경쾌|쾌활|upbeat|bright|lively|cheerful/);
  const calm = has(/차분|담담|고요|잔잔|calm|quiet|restrained|still/);
  const dark = has(/어두|불안|위태|긴장|dark|tense|anxious|moody/);
  const playful = has(/장난|유쾌|능청|코믹|playful|quirky|comic/);
  const spacious = has(/공간|넓|웅장|spatial|wide|cinematic|expansive/);

  const genreParts: string[] = [];
  const soundParts: string[] = [];
  const moodParts: string[] = [];
  const vocalParts: string[] = [];
  const productionParts: string[] = [];

  if (dreamy) {
    genreParts.push('dream-shaped color');
    soundParts.push('soft-focus haze');
    moodParts.push('dreamlike emotional drift');
    vocalParts.push('slightly distant phrasing');
    productionParts.push('floating section motion');
  }
  if (vintage) {
    genreParts.push('vintage-tinted identity');
    soundParts.push('dusty analog texture');
    moodParts.push('aged nostalgic aftertaste');
    productionParts.push('subtle retro flow');
  }
  if (warm) {
    genreParts.push('intimate color');
    soundParts.push('soft rounded texture');
    moodParts.push('gentle closeness');
    vocalParts.push('gentle restrained emotion');
    productionParts.push('soft intimate build');
  }
  if (hollow) {
    genreParts.push('hollow emotional shade');
    soundParts.push('sparse open resonance');
    moodParts.push('quiet emptiness under the surface');
    vocalParts.push('held-back hollow aftertone');
    productionParts.push('sparse break and return');
  }
  if (funky) {
    genreParts.push('funky rhythmic color');
    soundParts.push('tight groove texture');
    moodParts.push('light body-moving pulse');
    vocalParts.push('loose rhythmic delivery');
    productionParts.push('groove-led hook lift');
  }
  if (breezy) {
    genreParts.push('open breezy color');
    soundParts.push('light airy edges');
    moodParts.push('clear open feeling');
    vocalParts.push('unforced relaxed tone');
    productionParts.push('refreshing section lift');
  }
  if (upbeat) {
    genreParts.push('bright upbeat identity');
    soundParts.push('crisp forward motion');
    moodParts.push('bright surface energy');
    vocalParts.push('lively but controlled delivery');
    productionParts.push('clean upbeat momentum');
  }
  if (calm) {
    genreParts.push('restrained color');
    soundParts.push('dry controlled space');
    moodParts.push('calm emotional pressure');
    vocalParts.push('understated calm delivery');
    productionParts.push('measured section pacing');
  }
  if (dark) {
    genreParts.push('dark emotional edge');
    soundParts.push('heavier shadowed weight');
    moodParts.push('low tension undercurrent');
    vocalParts.push('guarded emotional pressure');
    productionParts.push('tension-and-release movement');
  }
  if (playful) {
    genreParts.push('playful edge');
    soundParts.push('small rhythmic sparks');
    moodParts.push('light teasing surface');
    vocalParts.push('playful conversational bounce');
    productionParts.push('playful hook turn');
  }
  if (spacious) {
    genreParts.push('wide spatial color');
    soundParts.push('wide air and depth');
    moodParts.push('expanded emotional space');
    vocalParts.push('distance-aware delivery');
    productionParts.push('wide cinematic section spread');
  }

  // Catalog-derived fallback: every registered mood is recognized even when it does not
  // belong to one of the broad stability archetypes above. Gemini receives the full
  // profile; these compact cues only protect final five-lane coverage after generation.
  resolved.known.forEach((item) => {
    const cue = buildCatalogMoodLaneCues(item);
    if (cue.genre) genreParts.push(cue.genre);
    if (cue.sound) soundParts.push(cue.sound);
    if (cue.mood) moodParts.push(cue.mood);
    if (cue.vocals) vocalParts.push(cue.vocals);
    if (cue.production) productionParts.push(cue.production);
  });

  return {
    genre: joinCueParts(genreParts, 1),
    sound: joinCueParts(soundParts, 2),
    mood: joinCueParts(moodParts, 2),
    vocals: joinCueParts(vocalParts, 2),
    production: joinCueParts(productionParts, 2),
  };
}

export function buildGlobalMoodDistributionInstruction(params: any): string {
  const selectedMood = formatSelectedMoodSource(params);
  const moodProfileContext = buildMoodCatalogProfileContext(params);

  return `GLOBAL MOOD 5-LANE DISTRIBUTION (MANDATORY):
Selected mood source: ${selectedMood}
${moodProfileContext}

Use the resolved profiles as semantic references, not phrases to paste verbatim.
Distribute one blended mood direction by role:
- Genre: only a light identity color.
- Sound/Instruments: texture, weight, air, polish, dryness, bounce, or density.
- Atmosphere/Mood: the central emotional state plus any explicit theme action.
- Vocals: delivery, distance, diction, restraint, confidence, breath, or pressure.
- Arrangement/Production: one coherent section curve, pacing, lift, contrast, and release.

VOCAL CHARACTER INTEGRATION:
If a Vocal Character exists, keep its identity, but the selected Genre/Mood/Theme must sit above it as the song director. The [Vocals] line must visibly include: one genre-menu-specific singing habit, one mood distance/emotion cue, and one current-theme/situation delivery cue when available. Keep these as final Suno-ready phrases, not internal labels. Do not copy full Atmosphere scenes into [Vocals]. Do not output internal words such as genre-shaped, mood-shaped, story-aware, lane, or directive. Never derive genre vocal habits from instrument/sound chips; allow only explicit vocal-effect sounds in the vocal lane.

Do not treat Mood as a short fixed prefix before the genre. Do not choose from a tiny fixed list of mood words.
First synthesize the selected mood combination into one global feeling, then distribute it across the five prompt lanes by role.
The selected genre/style/sound anchors must remain, but they should be seasoned by the global mood instead of blocking it.
Final production prompt lines must stay concise: each lane receives only the mood aspect that belongs there, not a repeated mood word list.`;
}

function parsePromptLines(prompt: string): { label: string; value: string; raw: string }[] {
  return String(prompt || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (!match) return { label: '', value: line, raw: line };
      return { label: match[1].trim(), value: match[2].trim(), raw: line };
    });
}

function normalizePromptPartKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(?:the|a|an|and|with|of|to|for|in|on|by)\b/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitPromptParts(value: string): string[] {
  return cleanText(value)
    .split(/[,，]/)
    .map((part) => part.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

const MAX_PROMPT_PARTS_BY_LANE: Record<string, number> = {
  genre: 3,
  instruments: 6,
  sound: 6,
  atmosphere: 4,
  mood: 4,
  vocals: 5,
  arrangement: 5,
  production: 5,
};

function maxPromptPartsForLane(label: string): number {
  return MAX_PROMPT_PARTS_BY_LANE[label.toLowerCase()] || 5;
}

function compactPromptLineValue(label: string, value: string): string {
  const clean = cleanText(value)
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parts = splitPromptParts(clean);
  if (parts.length <= 1) return clean;

  const maxParts = maxPromptPartsForLane(label);
  const kept: string[] = [];

  for (const part of parts) {
    const key = normalizePromptPartKey(part);
    if (!key) continue;
    const duplicate = kept.some((existing) => {
      const existingKey = normalizePromptPartKey(existing);
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey);
    });
    if (duplicate) continue;
    kept.push(part);
    if (kept.length >= maxParts) break;
  }

  return (kept.length ? kept : parts.slice(0, maxParts)).join(', ').replace(/\s{2,}/g, ' ').trim();
}

const INTERNAL_PROMPT_LEAK_PATTERN = /\b(?:the user's core idea|visible musical moment|the central voice|a compact emotional space|story lane|music lane|expression bridge|global mood directive|mood-shaped|genre-shaped|story-aware)\b/i;
const MECHANICAL_MOOD_TEMPLATE_PATTERN = /^(?:sonic texture with\b.*\bqualities|vocal delivery with\b.*\bcharacter)$/i;

function promptPartTokenSet(value: string): Set<string> {
  return new Set(
    normalizePromptPartKey(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function promptPartsOverlapStrongly(a: string, b: string): boolean {
  const aTokens = promptPartTokenSet(a);
  const bTokens = promptPartTokenSet(b);
  if (!aTokens.size || !bTokens.size) return false;
  let overlap = 0;
  bTokens.forEach((token) => {
    if (aTokens.has(token)) overlap += 1;
  });
  const smaller = Math.min(aTokens.size, bTokens.size);
  return overlap >= 2 && overlap / smaller >= 0.66;
}

function sanitizePromptLaneValue(label: string, value: string): string {
  let clean = cleanText(value)
    .replace(/\bwith\s+urban\s+where\b/gi, 'in an urban setting where')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const leaked = INTERNAL_PROMPT_LEAK_PATTERN.test(clean);
  if (leaked) return '';

  const rawParts = splitPromptParts(clean);
  const nonMechanical = rawParts.filter((part) => !MECHANICAL_MOOD_TEMPLATE_PATTERN.test(part));
  if (rawParts.length && !nonMechanical.length) return '';
  const sourceParts = nonMechanical.length ? nonMechanical : rawParts;
  const kept: string[] = [];

  for (const part of sourceParts) {
    const isRepeatedColorSuffix = /\bemotional color$/i.test(part)
      && kept.some((existing) => promptPartsOverlapStrongly(existing, part));
    const duplicate = kept.some((existing) => {
      const existingKey = normalizePromptPartKey(existing);
      const key = normalizePromptPartKey(part);
      return existingKey === key
        || existingKey.includes(key)
        || key.includes(existingKey)
        || promptPartsOverlapStrongly(existing, part);
    });
    if (isRepeatedColorSuffix || duplicate) continue;
    kept.push(part);
  }

  clean = (kept.length ? kept : sourceParts)
    .join(', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return compactPromptLineValue(label, clean);
}

function isWeakPromptLaneValue(label: string, value: string): boolean {
  const clean = cleanText(value);
  if (!clean || INTERNAL_PROMPT_LEAK_PATTERN.test(clean)) return true;

  const normalized = normalizePromptPartKey(clean);
  const generic = [
    'subtle mood color only',
    'texture weight air only',
    'main emotional design',
    'delivery distance emotional pressure only',
    'section motion density pacing only',
    'clear emotional scene',
    'balanced mood',
    'adaptive movement',
  ];
  if (generic.some((item) => normalized === normalizePromptPartKey(item))) return true;

  const meaningfulTokens = normalized.split(/\s+/).filter((token) => token.length >= 3);
  const minimum = label === 'genre' ? 2 : 3;
  return meaningfulTokens.length < minimum;
}

function fallbackMoodCueForLane(label: string, cues: GlobalMoodLaneCues, params: any): string {
  if (label === 'genre') return cues.genre;
  if (label === 'instruments' || label === 'sound') return cues.sound;
  if (label === 'atmosphere' || label === 'mood') {
    const theme = formatSelectedThemeSource(params, '');
    const compactTheme = theme.length > 96 ? `${theme.slice(0, 93).trim()}...` : theme;
    return joinCueParts([compactTheme, cues.mood], 3);
  }
  if (label === 'vocals') return cues.vocals;
  if (label === 'arrangement' || label === 'production') return cues.production;
  return '';
}

function appendCue(value: string, cue: string, label = ''): string {
  const base = compactPromptLineValue(label, value);
  const cleanCue = cleanText(cue);
  if (!cleanCue) return base;

  const baseKey = normalizePromptPartKey(base);
  const baseLower = base.toLowerCase();
  const cueParts = splitPromptParts(cleanCue);
  const missing = cueParts.filter((part) => {
    const key = normalizePromptPartKey(part);
    if (!key) return false;
    return !baseLower.includes(part.toLowerCase().slice(0, Math.min(part.length, 24)))
      && !baseKey.includes(key);
  });
  if (!missing.length) return base;

  const maxParts = maxPromptPartsForLane(label);
  const compactBaseParts = splitPromptParts(base);
  const protectedCueParts = missing.slice(0, Math.max(1, maxParts - 1));
  const baseSlots = Math.max(1, maxParts - protectedCueParts.length);
  const combined = [
    ...compactBaseParts.slice(0, baseSlots),
    ...protectedCueParts,
  ];

  return compactPromptLineValue(label, combined.join(', '));
}

export function applyGlobalMoodDirectiveToProductionPrompt(prompt: string, params: any): string {
  // Classic(v1) already has a long-established validator/router chain.
  // Keep the shared mood profile in the Gemini instructions, but do not run the
  // new fallback replacement layer over Classic output because it can collapse
  // a full Atmosphere sentence into a short catalog cue.
  const engineVersion = cleanText(params?.generationEngineVersion || 'classic').toLowerCase();
  if (engineVersion !== 'v2') return prompt;

  const cues = buildGlobalMoodLaneCues(params);
  const lines = parsePromptLines(prompt);

  const mapped = lines.map((line) => {
    const label = line.label.toLowerCase();
    if (!line.label) return line.raw;

    const cue = fallbackMoodCueForLane(label, cues, params);
    const sanitized = sanitizePromptLaneValue(label, line.value);

    // Common v1/v2 safety rule: Gemini's natural sentence is the primary result.
    // Catalog cues are used only when the lane is empty, leaked, or clearly generic.
    if (cue && isWeakPromptLaneValue(label, sanitized)) {
      const fallback = appendCue('', cue, label);
      return `[${line.label}] ${fallback || sanitized}`.trim();
    }

    return `[${line.label}] ${sanitized || line.value}`.trim();
  });

  return mapped.join('\n');
}
