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

// Only supplement a confirmed original with historical fields that are absent.
// In a clicked original, explicit null/empty/[] mean "cleared", not "missing".
const mergeAbsentOnlyClick462 = (target: PlainRecord, fallback: PlainRecord): PlainRecord => {
  const merged: PlainRecord = { ...target };
  for (const [key, value] of Object.entries(fallback)) {
    if (!Object.prototype.hasOwnProperty.call(merged, key) || merged[key] === undefined) {
      merged[key] = value;
    } else if (isPlainRecord(merged[key]) && isPlainRecord(value)) {
      merged[key] = mergeAbsentOnlyClick462(merged[key], value);
    }
  }
  return merged;
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
  verifiedPendingUpdates?: unknown,
): PlainRecord => {
  const local = resolveMusicNoteNextSongRecipe(cachedRow);
  const persisted = resolveMusicNoteNextSongRecipe(originalDocument);
  const cached = parseRecord(cachedRow) || {};
  const original = parseRecord(originalDocument) || {};
  const canonicalApplied = parseRecord(original.appliedKeywords);
  const localApplied = parseRecord(cached.appliedKeywords);
  const pending = parseRecord(verifiedPendingUpdates);
  const pendingApplied = parseRecord(pending?.appliedKeywords);

  // Exact owned server original wins. Only truly absent historical settings
  // may be filled from a local card; explicit null/empty server values stay.
  const merged: PlainRecord = mergeAbsentOnlyClick462(persisted, local);
  if (pending) {
    // The caller supplies only a version-verified durable unsaved edit.
    // Never blindly spread unrelated cached favorite/public/media fields.
    const changed = {
      ...pickKnownRecipeFields(pending),
      ...pickKnownRecipeFields(pendingApplied),
    };
    for (const key of COMMAND_KEYS_459) delete changed[key];
    Object.assign(merged, changed);
  }

  // Old auto-empty userInput must not shadow the stored requestPayload direct
  // command. A newer canonical real command/marked clear beats stale local
  // text, except for an independently verified pending user edit.
  const pendingCommand = firstStoredCommand(pendingApplied, pending);
  const pendingClear = hasProvenManualCommandClear459(pendingApplied, pending);
  const canonicalClear = hasProvenManualCommandClear459(canonicalApplied);
  const canonicalCommand = COMMAND_KEYS_459.some((key) =>
    typeof canonicalApplied?.[key] === 'string' && canonicalApplied[key].trim().length > 0);
  const localClear = hasProvenManualCommandClear459(localApplied, cached);
  const localCommand = typeof local.userInput === 'string' ? local.userInput.trim() : '';

  if (pendingClear) merged.userInput = '';
  else if (pendingCommand) merged.userInput = pendingCommand;
  else if (canonicalClear || canonicalCommand) merged.userInput = persisted.userInput ?? '';
  else if (localClear) merged.userInput = '';
  else if (localCommand) merged.userInput = localCommand;
  else if (typeof persisted.userInput === 'string') merged.userInput = persisted.userInput;

  return merged;
};
