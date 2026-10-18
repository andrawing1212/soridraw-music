// app425 — one client-side compatibility contract for "다음곡에 적용".
//
// Modern Music Note rows keep the reusable recipe in appliedKeywords. Older
// rows may keep some or all of the same recipe under requestPayload. Resolve
// those historical shapes only when the user explicitly applies one song.
// This is read-time compatibility only: no migration/backfill and no prompt
// guessing. If an old command was never persisted, it stays absent.

export type MusicNoteNextSongRecipe = Record<string, unknown>;

const LEGACY_RECIPE_FIELDS = [
  'genre',
  'subGenre',
  'subGenreIds',
  'mood',
  'theme',
  'style',
  'instrumentSound',
  'pointSound',
  'pointSounds',
  'lyricLanguages',
  'titleLanguages',
  'languageMixTargetLanguages',
  'instrumentTags',
  'customGenreInput',
  'customMoodInput',
  'customThemeInput',
  'customStyleInput',
  'customSoundInput',
  'tempo',
  'tempoConfig',
  'vocalType',
  'vocalTone',
  'vocal',
  'lyricsLength',
  'songStructure',
  'customStructure',
  'sectionCueOptions',
  'drumStyle',
  'rapMode',
  'lyricWritingStyle',
  'tempoSource',
  'kpopMode',
  'citypopMode',
  'isKoreanEnglishMix',
  'englishMixRatio',
  'languageMixRatio',
  'maleCount',
  'femaleCount',
  'rapEnabled',
  'isBallad',
  'isNoLyrics',
  'includeLyrics',
  'instrumentalBgmMode',
  'isRandomTempo',
  'situation',
  'situationSummary',
  'lyricDraft',
  'isLyricMode',
  'lyricMode',
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const hasOwn = (value: Record<string, unknown> | null, key: string) => (
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key)
);

const copyValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(copyValue);
  if (value && typeof value === 'object') return { ...(value as Record<string, unknown>) };
  return value;
};

const firstStoredCommand = (
  sources: Array<Record<string, unknown> | null>,
): string | undefined => {
  const aliases = ['userInput', 'commandInput', 'directInput', 'customPrompt'] as const;
  for (const source of sources) {
    if (!source) continue;
    for (const key of aliases) {
      if (!hasOwn(source, key)) continue;
      const value = String(source[key] ?? '').trim();
      if (value) return value;
      if (key === 'userInput') return '';
    }
  }
  return undefined;
};

export const resolveMusicNoteNextSongRecipe425 = (
  rawSource: unknown,
): MusicNoteNextSongRecipe => {
  const source = asRecord(rawSource) || {};
  const requestPayload = asRecord(source.requestPayload);
  const requestApplied = asRecord(requestPayload?.appliedKeywords);
  const canonicalApplied = asRecord(source.appliedKeywords);

  const resolved: MusicNoteNextSongRecipe = canonicalApplied
    ? { ...canonicalApplied }
    : {};

  for (const key of LEGACY_RECIPE_FIELDS) {
    if (hasOwn(resolved, key)) continue;
    if (hasOwn(requestApplied, key)) {
      resolved[key] = copyValue(requestApplied?.[key]);
      continue;
    }
    if (hasOwn(requestPayload, key)) {
      resolved[key] = copyValue(requestPayload?.[key]);
    }
  }

  if (!hasOwn(resolved, 'userInput')) {
    const command = firstStoredCommand([
      canonicalApplied,
      requestApplied,
      requestPayload,
      source,
    ]);
    if (command !== undefined) resolved.userInput = command;
  }

  if (!hasOwn(resolved, 'situationSummary') && hasOwn(source, 'situationSummary')) {
    resolved.situationSummary = copyValue(source.situationSummary);
  }

  return resolved;
};

export const hasMusicNoteNextSongRecipe425 = (value: unknown): boolean => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value as Record<string, unknown>).length > 0
);
