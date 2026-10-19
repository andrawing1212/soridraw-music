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

// Legacy app versions persisted userInput:'' as an ordinary default, even
// when requestPayload contained a real direct command. A bare empty string is
// NOT an intentional-clear marker. An explicit later clear can be recognized
// only when its source carries a trustworthy clear revision/timestamp.
const COMMAND_KEYS_459 = ['userInput', 'commandInput', 'directInput', 'customPrompt'] as const;
const hasProvenManualCommandClear459 = (...sources: Array<PlainRecord | null>): boolean =>
  sources.some((source) => Boolean(source) && (
    source?.manualCommandCleared === true
    || (typeof source?.manualCommandClearedAt === 'number' && source.manualCommandClearedAt > 0)
  ));

const firstStoredCommand = (...sources: Array<PlainRecord | null>): string | undefined => {
  for (const source of sources) {
    if (!source) continue;
    // A clear is authoritative only within its own precedence layer.
    // A newer nonempty command in a higher layer must not be erased by an
    // older requestPayload clear marker.
    if (hasProvenManualCommandClear459(source)) return '';
    for (const key of COMMAND_KEYS_459) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = typeof source[key] === 'string' ? source[key].trim() : '';
      if (value) return value;
    }
  }
  // No nonempty original command is known: preserve an actual stored blank
  // without fabricating instructions from generated prompt or lyrics.
  return sources.some((source) => source && COMMAND_KEYS_459.some((key) =>
    Object.prototype.hasOwnProperty.call(source, key))) ? '' : undefined;
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
  if (userInput !== undefined) recipe.userInput = userInput;
  delete recipe.commandInput;
  delete recipe.directInput;
  delete recipe.customPrompt;
  return recipe;
};


/**
 * Explicit user click only. Some old fully-rendered Music Note cards carry an
 * empty fallback userInput even though their exact persisted requestPayload
 * contains the original direct command. A synthesized empty *top-level* card
 * value cannot suppress that genuine stored command, but an explicit newest
 * appliedKeywords empty command can.
 */
export const mergeMusicNoteNextSongClickRecipe455 = (
  cachedRow: unknown,
  originalDocument: unknown,
): PlainRecord => {
  const local = resolveMusicNoteNextSongRecipe(cachedRow);
  const persisted = resolveMusicNoteNextSongRecipe(originalDocument);
  const cached = parseRecord(cachedRow) || {};
  const localApplied = parseRecord(cached.appliedKeywords) || {};
  const localCommand = typeof local.userInput === 'string' ? local.userInput.trim() : '';
  const persistedCommand = typeof persisted.userInput === 'string' ? persisted.userInput.trim() : '';
  // A nonempty newer local command wins. Otherwise the known original
  // requestPayload command fills the older synthesized empty placeholder.
  // An explicit clear is only authoritative with a real clear marker.
  const localCleared = hasProvenManualCommandClear459(localApplied, cached);
  const stored = parseRecord(originalDocument) || {};
  const storedRequest = parseRecord(stored.requestPayload);
  const storedRequestApplied = parseRecord(storedRequest?.appliedKeywords);
  const persistedCleared = hasProvenManualCommandClear459(
    parseRecord(stored.appliedKeywords), storedRequestApplied, storedRequest, stored,
  );
  const merged: PlainRecord = { ...persisted, ...local };
  if (localCleared) merged.userInput = '';
  else if (localCommand) merged.userInput = localCommand;
  else if (persistedCleared) merged.userInput = '';
  else if (persistedCommand) merged.userInput = persistedCommand;
  return merged;
};
