import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[100/427] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018';
if (source.includes(marker)) {
  console.log('[100/427] already applied');
  process.exit(0);
}

function functionRange(name) {
  const candidates = ['function ' + name + '(', 'async function ' + name + '('];
  let start = -1;
  for (const prefix of candidates) {
    start = source.indexOf(prefix);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[100/427] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[100/427] unterminated function: ' + name);
}

function buildMusicNoteShareBundle100(note) {
  // SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018
  const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const parseRecord = (value) => {
    if (isRecord(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const fields = [
    'genre','subGenre','subGenreIds','mood','theme','style','instrumentSound',
    'pointSound','pointSounds',
    'customGenreInput','customMoodInput','customThemeInput','customStyleInput','customSoundInput',
    'tempo','tempoConfig','tempoSource','isRandomTempo',
    'vocalType','vocalTone','vocal','lyricsLength','songStructure','customStructure','sectionCueOptions',
    'kpopMode','citypopMode','isKoreanEnglishMix','englishMixRatio','languageMixRatio','languageMixTargetLanguages',
    'lyricLanguages','titleLanguages','maleCount','femaleCount','rapEnabled','rapMode',
    'lyricWritingStyle','isLyricMode','lyricMode','drumStyle','isBallad','isNoLyrics','includeLyrics','instrumentalBgmMode',
    'instrumentTags','situation','situationSummary',
    'userInput','commandInput','directInput','customPrompt',
  ];
  const pick = (value) => {
    const record = parseRecord(value);
    if (!record) return {};
    const picked = {};
    for (const key of fields) if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) picked[key] = record[key];
    return picked;
  };
  const mergeMissing = (target, fallback) => {
    const next = { ...target };
    for (const [key, fallbackValue] of Object.entries(fallback || {})) {
      if (!Object.prototype.hasOwnProperty.call(next, key) || next[key] === undefined || next[key] === null) {
        next[key] = fallbackValue;
      } else if (isRecord(next[key]) && isRecord(fallbackValue)) {
        next[key] = mergeMissing(next[key], fallbackValue);
      }
    }
    return next;
  };
  const firstCommand = (...records) => {
    for (const record of records) {
      if (!record) continue;
      for (const key of ['userInput','commandInput','directInput','customPrompt']) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
        const value = String(record[key] ?? '').trim();
        if (value) return value;
        if (record[key] === '') return '';
      }
    }
    return '';
  };

  const requestPayload = parseRecord(note?.requestPayload);
  const requestApplied = parseRecord(requestPayload?.appliedKeywords);
  const canonicalApplied = parseRecord(note?.appliedKeywords);
  let applied = pick(canonicalApplied);
  applied = mergeMissing(applied, pick(requestApplied));
  applied = mergeMissing(applied, pick(requestPayload));
  applied = mergeMissing(applied, pick(note));

  const storedCommand = firstCommand(canonicalApplied, requestApplied, requestPayload, parseRecord(note));
  if (storedCommand || [canonicalApplied, requestApplied, requestPayload, parseRecord(note)].some((record) => (
    record && ['userInput','commandInput','directInput','customPrompt'].some((key) => Object.prototype.hasOwnProperty.call(record, key))
  ))) {
    applied.userInput = storedCommand;
  }
  delete applied.commandInput;
  delete applied.directInput;
  delete applied.customPrompt;

  const preferredGenres = Array.isArray(applied.subGenre) && applied.subGenre.length ? applied.subGenre : applied.genre;
  const pointSounds = [
    ...shareList015(applied.pointSound),
    ...shareList015(applied.pointSounds),
  ];
  const selectedKeywords = {
    genres: shareList015(preferredGenres),
    styles: shareList015(applied.style),
    sounds: shareList015([...shareList015(applied.instrumentSound), ...pointSounds]),
    moods: shareList015(applied.mood),
    themes: shareList015(applied.theme),
  };

  const nextSong = {};
  const arrayFields = [
    'genre','subGenre','subGenreIds','mood','theme','style','instrumentSound','pointSounds',
    'lyricLanguages','titleLanguages','languageMixTargetLanguages','instrumentTags',
  ];
  for (const key of arrayFields) {
    const value = shareList015(applied[key]);
    if (value.length) nextSong[key] = value;
  }

  const stringFields = [
    'pointSound','customGenreInput','customMoodInput','customThemeInput','customStyleInput','customSoundInput',
    'tempo','vocalType','vocalTone','lyricsLength','songStructure','drumStyle','rapMode','lyricWritingStyle','lyricMode','tempoSource',
  ];
  for (const key of stringFields) {
    const value = shareText015(applied[key], key.startsWith('custom') ? 500 : 240);
    if (value) nextSong[key] = value;
  }

  const userInput = shareText015(applied.userInput, 4000);
  if (userInput) nextSong.userInput = userInput;

  const scalarFields = [
    'kpopMode','citypopMode','isKoreanEnglishMix','englishMixRatio','languageMixRatio',
    'maleCount','femaleCount','rapEnabled','isLyricMode','isBallad','isNoLyrics','includeLyrics',
    'instrumentalBgmMode','isRandomTempo',
  ];
  for (const key of scalarFields) {
    const value = applied[key];
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) nextSong[key] = value;
  }

  for (const key of ['tempoConfig','vocal','customStructure','sectionCueOptions','situation']) {
    const value = shareSafeValue015(applied[key]);
    if (value && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)) nextSong[key] = value;
  }

  const situationSummary = shareText015(applied.situationSummary ?? note?.situationSummary, 600);
  if (situationSummary) nextSong.situationSummary = situationSummary;

  let bundle = { schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015, selectedKeywords, nextSong };
  let payloadJson = JSON.stringify(bundle);
  if (payloadJson.length > SORIDRAW_PUBLIC_SHARE_MAX_JSON_015) {
    bundle = {
      schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015,
      selectedKeywords,
      nextSong: {
        genre: nextSong.genre || [],
        subGenre: nextSong.subGenre || [],
        subGenreIds: nextSong.subGenreIds || [],
        mood: nextSong.mood || [],
        theme: nextSong.theme || [],
        style: nextSong.style || [],
        instrumentSound: nextSong.instrumentSound || [],
        pointSounds: nextSong.pointSounds || [],
        tempo: nextSong.tempo || '',
        vocalType: nextSong.vocalType || '',
        vocalTone: nextSong.vocalTone || '',
        lyricsLength: nextSong.lyricsLength || '',
        songStructure: nextSong.songStructure || '',
        userInput: nextSong.userInput || '',
        customGenreInput: nextSong.customGenreInput || '',
        customMoodInput: nextSong.customMoodInput || '',
        customThemeInput: nextSong.customThemeInput || '',
        customStyleInput: nextSong.customStyleInput || '',
        customSoundInput: nextSong.customSoundInput || '',
        situationSummary: nextSong.situationSummary || '',
        lyricLanguages: nextSong.lyricLanguages || [],
        titleLanguages: nextSong.titleLanguages || [],
        languageMixTargetLanguages: nextSong.languageMixTargetLanguages || [],
        isKoreanEnglishMix: Boolean(nextSong.isKoreanEnglishMix),
        englishMixRatio: nextSong.englishMixRatio ?? 10,
        languageMixRatio: nextSong.languageMixRatio ?? nextSong.englishMixRatio ?? 10,
        kpopMode: nextSong.kpopMode ?? 0,
        citypopMode: nextSong.citypopMode ?? 0,
        maleCount: nextSong.maleCount ?? 0,
        femaleCount: nextSong.femaleCount ?? 0,
        rapEnabled: Boolean(nextSong.rapEnabled),
        rapMode: nextSong.rapMode || '',
        lyricWritingStyle: nextSong.lyricWritingStyle || '',
        isLyricMode: Boolean(nextSong.isLyricMode),
        lyricMode: nextSong.lyricMode || '',
        tempoSource: nextSong.tempoSource || '',
        isRandomTempo: Boolean(nextSong.isRandomTempo),
        isNoLyrics: Boolean(nextSong.isNoLyrics),
        includeLyrics: nextSong.includeLyrics !== false,
        instrumentalBgmMode: Boolean(nextSong.instrumentalBgmMode),
      },
    };
    payloadJson = JSON.stringify(bundle);
  }
  return { schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015, payloadJson };
}

const range = functionRange('buildMusicNoteShareBundle015');
const replacement = buildMusicNoteShareBundle100.toString()
  .replace('buildMusicNoteShareBundle100', 'buildMusicNoteShareBundle015');
source = source.slice(0, range.start) + replacement + source.slice(range.end);

const updated = functionRange('buildMusicNoteShareBundle015').text;
for (const required of [
  marker,
  'requestPayload',
  'requestApplied',
  'mergeMissing',
  'applied.userInput = storedCommand',
  'nextSong.userInput = userInput',
]) {
  if (!updated.includes(required)) throw new Error('[100/427] missing legacy next-song parity: ' + required);
}
if (updated.includes('note?.lyrics') || updated.includes('note?.lyricsText')) {
  throw new Error('[100/427] next-song bundle must not copy finished lyrics into the next command');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[100/427] public Music Note share bundle now restores persisted legacy generation settings.');
