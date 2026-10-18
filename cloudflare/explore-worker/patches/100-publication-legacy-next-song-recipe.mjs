import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[100/425] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_PUBLIC_LEGACY_NEXT_SONG_425_20261018';
if (source.includes(marker)) {
  console.log('[100/425] already applied');
  process.exit(0);
}

function functionRange(name) {
  const candidates = ['function ' + name + '(', 'async function ' + name + '('];
  let start = -1;
  for (const prefix of candidates) {
    start = source.indexOf(prefix);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[100/425] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[100/425] unterminated function: ' + name);
}

function buildMusicNoteShareBundle100(note) {
  // SORIDRAW_PUBLIC_LEGACY_NEXT_SONG_425_20261018
  const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const hasOwn = (value, key) => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
  const requestPayload = asObject(note?.requestPayload);
  const requestApplied = asObject(requestPayload?.appliedKeywords);
  const canonicalApplied = asObject(note?.appliedKeywords);
  const applied = canonicalApplied ? { ...canonicalApplied } : {};

  const legacyFields = [
    'genre', 'subGenre', 'subGenreIds', 'mood', 'theme', 'style', 'instrumentSound',
    'pointSound', 'pointSounds', 'lyricLanguages', 'titleLanguages', 'languageMixTargetLanguages',
    'instrumentTags', 'customGenreInput', 'customMoodInput', 'customThemeInput',
    'customStyleInput', 'customSoundInput', 'tempo', 'tempoConfig', 'vocalType', 'vocalTone',
    'vocal', 'lyricsLength', 'songStructure', 'customStructure', 'sectionCueOptions',
    'drumStyle', 'rapMode', 'lyricWritingStyle', 'tempoSource', 'kpopMode', 'citypopMode',
    'isKoreanEnglishMix', 'englishMixRatio', 'languageMixRatio', 'maleCount', 'femaleCount',
    'rapEnabled', 'isBallad', 'isNoLyrics', 'includeLyrics', 'instrumentalBgmMode',
    'isRandomTempo', 'situation', 'situationSummary'
  ];
  for (const key of legacyFields) {
    if (hasOwn(applied, key)) continue;
    if (hasOwn(requestApplied, key)) applied[key] = requestApplied[key];
    else if (hasOwn(requestPayload, key)) applied[key] = requestPayload[key];
  }

  if (!hasOwn(applied, 'userInput')) {
    const commandSources = [canonicalApplied, requestApplied, requestPayload, asObject(note)];
    for (const candidate of commandSources) {
      if (!candidate) continue;
      let resolved = false;
      for (const key of ['userInput', 'commandInput', 'directInput', 'customPrompt']) {
        if (!hasOwn(candidate, key)) continue;
        const value = shareText015(candidate[key], 4000);
        if (value) applied.userInput = value;
        else if (key === 'userInput') applied.userInput = '';
        resolved = true;
        break;
      }
      if (resolved) break;
    }
  }

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
    'genre', 'subGenre', 'subGenreIds', 'mood', 'theme', 'style', 'instrumentSound',
    'pointSounds', 'lyricLanguages', 'titleLanguages', 'languageMixTargetLanguages', 'instrumentTags',
  ];
  for (const key of arrayFields) {
    const value = shareList015(applied[key]);
    if (value.length) nextSong[key] = value;
  }

  const stringFields = [
    'pointSound', 'customGenreInput', 'customMoodInput', 'customThemeInput', 'customStyleInput',
    'customSoundInput', 'tempo', 'vocalType', 'vocalTone', 'lyricsLength', 'songStructure',
    'drumStyle', 'rapMode', 'lyricWritingStyle', 'tempoSource',
  ];
  for (const key of stringFields) {
    const value = shareText015(applied[key], key.startsWith('custom') ? 500 : 240);
    if (value) nextSong[key] = value;
  }

  const userInput = shareText015(applied.userInput, 4000);
  if (userInput) nextSong.userInput = userInput;

  const scalarFields = [
    'kpopMode', 'citypopMode', 'isKoreanEnglishMix', 'englishMixRatio', 'languageMixRatio',
    'maleCount', 'femaleCount', 'rapEnabled', 'isBallad', 'isNoLyrics', 'includeLyrics',
    'instrumentalBgmMode', 'isRandomTempo',
  ];
  for (const key of scalarFields) {
    const value = applied[key];
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) nextSong[key] = value;
  }

  for (const key of ['tempoConfig', 'vocal', 'customStructure', 'sectionCueOptions', 'situation']) {
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
  'requestPayload?.appliedKeywords',
  "['userInput', 'commandInput', 'directInput', 'customPrompt']",
  'nextSong.userInput = userInput',
]) {
  if (!updated.includes(required)) throw new Error('[100/425] missing legacy next-song contract: ' + required);
}
if (updated.includes('note?.prompt') || updated.includes('note?.style')) {
  throw new Error('[100/425] generated prompt/style must never become the original command');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[100/425] public Music Note share bundle now reads bounded legacy recipe fields without fabricating commands.');
