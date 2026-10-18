export const MUSIC_NOTE_NEXT_SONG_RECIPE_FIELDS = [
  'genre', 'subGenre', 'subGenreIds',
  'mood', 'theme', 'style', 'instrumentSound',
  'pointSound', 'pointSounds',
  'customGenreInput', 'customMoodInput', 'customThemeInput', 'customStyleInput', 'customSoundInput',
  'tempo', 'tempoConfig', 'tempoSource', 'isRandomTempo',
  'vocalType', 'vocalTone', 'vocal',
  'lyricsLength', 'songStructure', 'customStructure', 'sectionCueOptions',
  'kpopMode', 'citypopMode',
  'isKoreanEnglishMix', 'englishMixRatio', 'languageMixRatio', 'languageMixTargetLanguages',
  'lyricLanguages', 'titleLanguages',
  'maleCount', 'femaleCount', 'rapEnabled', 'rapMode',
  'lyricWritingStyle', 'drumStyle', 'isBallad',
  'isNoLyrics', 'includeLyrics', 'instrumentalBgmMode',
  'instrumentTags', 'situation', 'situationSummary',
  'lyricDraft', 'isLyricMode', 'lyricMode',
  'userInput', 'commandInput', 'directInput', 'customPrompt',
] as const;

type PlainRecord = Record<string, any>;

const isPlainRecord = (value: unknown): value is PlainRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
);

const parseRecord = (value: unknown): PlainRecord | null => {
  if (isPlainRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const mergeMissingDeep = (target: PlainRecord, fallback: PlainRecord): PlainRecord => {
  const next: PlainRecord = { ...target };
  for (const [key, fallbackValue] of Object.entries(fallback)) {
    if (!Object.prototype.hasOwnProperty.call(next, key) || next[key] === undefined || next[key] === null) {
      next[key] = fallbackValue;
      continue;
    }
    if (isPlainRecord(next[key]) && isPlainRecord(fallbackValue)) {
      next[key] = mergeMissingDeep(next[key], fallbackValue);
    }
  }
  return next;
};

const pickKnownRecipeFields = (source: PlainRecord | null): PlainRecord => {
  if (!source) return {};
  const picked: PlainRecord = {};
  for (const key of MUSIC_NOTE_NEXT_SONG_RECIPE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
};

const firstStoredCommand = (...sources: Array<PlainRecord | null>): string => {
  for (const source of sources) {
    if (!source) continue;
    for (const key of ['userInput', 'commandInput', 'directInput', 'customPrompt']) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = String(source[key] ?? '').trim();
      if (value) return value;
      // An explicitly stored empty current field is authoritative and must not
      // be silently replaced by an older command alias.
      if (source[key] === '') return '';
    }
  }
  return '';
};

/**
 * Normalizes historical Music Note generation settings without rewriting user data.
 * Priority is newest canonical appliedKeywords, then missing fields from
 * requestPayload.appliedKeywords, then known direct requestPayload recipe fields,
 * then top-level legacy aliases. Generated prompt/style is never treated as the
 * user's original command.
 */
export const resolveMusicNoteNextSongRecipe = (rawSource: unknown): PlainRecord => {
  const source = parseRecord(rawSource) || {};
  const requestPayload = parseRecord(source.requestPayload);
  const requestApplied = parseRecord(requestPayload?.appliedKeywords);
  const canonicalApplied = parseRecord(source.appliedKeywords);

  let recipe = pickKnownRecipeFields(canonicalApplied);
  recipe = mergeMissingDeep(recipe, pickKnownRecipeFields(requestApplied));
  recipe = mergeMissingDeep(recipe, pickKnownRecipeFields(requestPayload));
  recipe = mergeMissingDeep(recipe, pickKnownRecipeFields(source));

  const userInput = firstStoredCommand(
    canonicalApplied,
    requestApplied,
    requestPayload,
    source,
  );
  if (userInput || [
    canonicalApplied,
    requestApplied,
    requestPayload,
    source,
  ].some((candidate) => candidate && ['userInput', 'commandInput', 'directInput', 'customPrompt']
    .some((key) => Object.prototype.hasOwnProperty.call(candidate, key)))) {
    recipe.userInput = userInput;
  }
  delete recipe.commandInput;
  delete recipe.directInput;
  delete recipe.customPrompt;
  return recipe;
};
