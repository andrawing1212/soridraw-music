import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_SHARE_BUNDLE_V1_015_20260905';
if (source.includes(marker)) {
  console.log('[015] publication share bundle v1 already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_PUBLICATION_SINGLE_R2_BUNDLE_014_20260905')) {
  throw new Error('[015] patch 014 must be applied first.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[015] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[015] unterminated function: ${name}`);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[015] ${label} anchor count=${count}`);
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

for (const required of ['buildMusicNoteExploreSource', 'handlePublicationR2Core', 'mapTrackRow']) {
  if (!source.includes(required)) throw new Error(`[015] required function missing: ${required}`);
}

const buildAnchor = 'function buildMusicNoteExploreSource(note, uid, sourceId) {';
if (!source.includes(buildAnchor)) throw new Error('[015] music-note source anchor missing');

const helpers = `// ${marker}\nconst SORIDRAW_PUBLIC_SHARE_SCHEMA_015 = 1;\nconst SORIDRAW_PUBLIC_SHARE_MAX_JSON_015 = 14000;\n\nfunction shareText015(value, max = 240) {\n  const text = String(value ?? "").trim();\n  return text ? text.slice(0, max) : "";\n}\n\nfunction shareList015(value, maxItems = 32, maxChars = 120) {\n  const input = Array.isArray(value) ? value : (value === null || value === undefined || value === "" ? [] : [value]);\n  const out = [];\n  const seen = new Set();\n  for (const item of input) {\n    const text = shareText015(item, maxChars);\n    if (!text || seen.has(text)) continue;\n    seen.add(text);\n    out.push(text);\n    if (out.length >= maxItems) break;\n  }\n  return out;\n}\n\nfunction shareSafeValue015(value, depth = 0) {\n  if (depth > 4 || value === null || value === undefined) return null;\n  if (typeof value === "string") return shareText015(value, 320);\n  if (typeof value === "boolean") return value;\n  if (typeof value === "number") return Number.isFinite(value) ? value : null;\n  if (Array.isArray(value)) return value.slice(0, 24).map((item) => shareSafeValue015(item, depth + 1)).filter((item) => item !== null);\n  if (typeof value === "object") {\n    const result = {};\n    for (const key of Object.keys(value).slice(0, 32)) {\n      const safeKey = shareText015(key, 80);\n      if (!safeKey || safeKey === "__proto__" || safeKey === "constructor" || safeKey === "prototype") continue;\n      const safeValue = shareSafeValue015(value[key], depth + 1);\n      if (safeValue !== null && safeValue !== "") result[safeKey] = safeValue;\n    }\n    return result;\n  }\n  return null;\n}\n\nfunction buildMusicNoteShareBundle015(note) {\n  const applied = note?.appliedKeywords && typeof note.appliedKeywords === "object" && !Array.isArray(note.appliedKeywords)\n    ? note.appliedKeywords\n    : {};\n  const preferredGenres = Array.isArray(applied.subGenre) && applied.subGenre.length ? applied.subGenre : applied.genre;\n  const pointSounds = [\n    ...shareList015(applied.pointSound),\n    ...shareList015(applied.pointSounds)\n  ];\n  const selectedKeywords = {\n    genres: shareList015(preferredGenres),\n    styles: shareList015(applied.style),\n    sounds: shareList015([...(shareList015(applied.instrumentSound)), ...pointSounds]),\n    moods: shareList015(applied.mood),\n    themes: shareList015(applied.theme)\n  };\n\n  const nextSong = {};\n  const arrayFields = [\n    "genre", "subGenre", "subGenreIds", "mood", "theme", "style", "instrumentSound",\n    "pointSounds", "lyricLanguages", "titleLanguages", "languageMixTargetLanguages", "instrumentTags"\n  ];\n  for (const key of arrayFields) {\n    const value = shareList015(applied[key]);\n    if (value.length) nextSong[key] = value;\n  }\n  const stringFields = [\n    "pointSound", "customGenreInput", "customMoodInput", "customThemeInput", "customStyleInput",\n    "customSoundInput", "tempo", "vocalType", "vocalTone", "lyricsLength", "songStructure", "drumStyle"\n  ];\n  for (const key of stringFields) {\n    const value = shareText015(applied[key], key.startsWith("custom") ? 500 : 240);\n    if (value) nextSong[key] = value;\n  }\n  const scalarFields = [\n    "kpopMode", "citypopMode", "isKoreanEnglishMix", "englishMixRatio", "languageMixRatio",\n    "maleCount", "femaleCount", "rapEnabled", "isBallad", "isNoLyrics", "includeLyrics", "instrumentalBgmMode"\n  ];\n  for (const key of scalarFields) {\n    const value = applied[key];\n    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) nextSong[key] = value;\n  }\n  for (const key of ["tempoConfig", "vocal", "customStructure", "sectionCueOptions", "situation"]) {\n    const value = shareSafeValue015(applied[key]);\n    if (value && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length)) nextSong[key] = value;\n  }\n  const situationSummary = shareText015(applied.situationSummary ?? note?.situationSummary, 600);\n  if (situationSummary) nextSong.situationSummary = situationSummary;\n\n  let bundle = { schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015, selectedKeywords, nextSong };\n  let payloadJson = JSON.stringify(bundle);\n  if (payloadJson.length > SORIDRAW_PUBLIC_SHARE_MAX_JSON_015) {\n    // Preserve the cheap, reusable keyword core first. Large advanced recipe fields\n    // are optional and may be regenerated later from the owner's canonical note.\n    bundle = {\n      schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015,\n      selectedKeywords,\n      nextSong: {\n        genre: nextSong.genre || [],\n        subGenre: nextSong.subGenre || [],\n        subGenreIds: nextSong.subGenreIds || [],\n        mood: nextSong.mood || [],\n        theme: nextSong.theme || [],\n        style: nextSong.style || [],\n        instrumentSound: nextSong.instrumentSound || [],\n        pointSounds: nextSong.pointSounds || [],\n        tempo: nextSong.tempo || "",\n        vocalType: nextSong.vocalType || "",\n        vocalTone: nextSong.vocalTone || "",\n        lyricsLength: nextSong.lyricsLength || "",\n        songStructure: nextSong.songStructure || ""\n      }\n    };\n    payloadJson = JSON.stringify(bundle);\n  }\n  return { schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015, payloadJson };\n}\n\nfunction readPublicShareBundle015(row) {\n  try {\n    if (Number(row?.share_schema_version || 0) !== SORIDRAW_PUBLIC_SHARE_SCHEMA_015) return null;\n    const parsed = JSON.parse(String(row?.share_payload_json || ""));\n    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Number(parsed.schemaVersion || 0) !== SORIDRAW_PUBLIC_SHARE_SCHEMA_015) return null;\n    const selectedKeywords = parsed.selectedKeywords && typeof parsed.selectedKeywords === "object" ? parsed.selectedKeywords : {};\n    const allowNextSongApply = Number(row?.allow_next_song_apply || 0) === 1;\n    return {\n      schemaVersion: SORIDRAW_PUBLIC_SHARE_SCHEMA_015,\n      selectedKeywords,\n      nextSong: allowNextSongApply && parsed.nextSong && typeof parsed.nextSong === "object" ? parsed.nextSong : null\n    };\n  } catch {\n    return null;\n  }\n}\n\n`;
source = source.replace(buildAnchor, helpers + buildAnchor);

replaceOnceInFunction(
  'buildMusicNoteExploreSource',
  '  const searchText = [\n    title,\n    description,\n    style,\n    ...tags.map((tag) => tag.value)\n  ].filter(Boolean).join(" ").slice(0, 4e3);\n  return {',
  '  const searchText = [\n    title,\n    description,\n    style,\n    ...tags.map((tag) => tag.value)\n  ].filter(Boolean).join(" ").slice(0, 4e3);\n  const publicShare = buildMusicNoteShareBundle015(note);\n  return {',
  'build share payload',
);
replaceOnceInFunction(
  'buildMusicNoteExploreSource',
  '    searchText,\n    tags',
  '    searchText,\n    shareSchemaVersion: publicShare.schemaVersion,\n    sharePayloadJson: publicShare.payloadJson,\n    tags',
  'attach share payload to source',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  '        suno_url_primary, suno_url_secondary, search_text,\n        is_public, status, published_at, created_at, updated_at',
  '        suno_url_primary, suno_url_secondary, search_text,\n        share_schema_version, share_payload_json,\n        is_public, status, published_at, created_at, updated_at',
  'insert share columns',
);
replaceOnceInFunction(
  'handlePublicationR2Core',
  '        ?, ?, ?,\n        1, \'published\', ?, ?, ?',
  '        ?, ?, ?,\n        ?, ?,\n        1, \'published\', ?, ?, ?',
  'insert share values',
);
replaceOnceInFunction(
  'handlePublicationR2Core',
  '        search_text = excluded.search_text,\n        is_public = 1,',
  '        search_text = excluded.search_text,\n        share_schema_version = excluded.share_schema_version,\n        share_payload_json = excluded.share_payload_json,\n        is_public = 1,',
  'update share columns',
);
replaceOnceInFunction(
  'handlePublicationR2Core',
  '      source.searchText,\n      now,\n      now,\n      now',
  '      source.searchText,\n      source.sourceType === "music_note" ? Number(source.shareSchemaVersion || 0) : 0,\n      source.sourceType === "music_note" ? String(source.sharePayloadJson || "") : null,\n      now,\n      now,\n      now',
  'bind share values',
);

replaceOnceInFunction(
  'mapTrackRow',
  '    profilePinned: Number(row.profile_pinned || 0) === 1,\n    stats: {',
  '    profilePinned: Number(row.profile_pinned || 0) === 1,\n    shareBundle: readPublicShareBundle015(row),\n    stats: {',
  'map public share bundle',
);

for (const required of [
  marker,
  'share_schema_version, share_payload_json',
  'share_schema_version = excluded.share_schema_version',
  'shareBundle: readPublicShareBundle015(row)',
  'const publicShare = buildMusicNoteShareBundle015(note);',
]) {
  if (!source.includes(required)) throw new Error(`[015] missing required token: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[015] Music Note publication now packs selected keywords and a bounded next-song recipe into the same canonical track row.');
