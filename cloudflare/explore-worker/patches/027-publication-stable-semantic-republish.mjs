import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_STABLE_SEMANTIC_REPUBLISH_027_20260907';
if (source.includes(marker)) {
  console.log('[027] stable semantic republish patch already applied.');
  process.exit(0);
}
for (const required of [
  'publicationRepublishSemanticUnchanged022',
  'publicationJsonEquivalent022',
  'publicationSearchSignature022',
  'visibilityTransitionOnly022',
  'applyPublicationVisibilityTransition021',
]) {
  if (!source.includes(required)) throw new Error(`[027] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[027] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[027] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[027] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

function publicationStableShareValue027(value, path = '') {
  const setLikePaths = new Set([
    'selectedKeywords.genres',
    'selectedKeywords.styles',
    'selectedKeywords.sounds',
    'selectedKeywords.moods',
    'selectedKeywords.themes',
    'nextSong.genre',
    'nextSong.subGenre',
    'nextSong.subGenreIds',
    'nextSong.mood',
    'nextSong.theme',
    'nextSong.style',
    'nextSong.instrumentSound',
    'nextSong.pointSounds',
    'nextSong.lyricLanguages',
    'nextSong.titleLanguages',
    'nextSong.languageMixTargetLanguages',
    'nextSong.instrumentTags'
  ]);
  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => publicationStableShareValue027(item, `${path}[${index}]`));
    if (setLikePaths.has(path) && normalized.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return normalized
        .map((item) => item === null ? '' : String(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    return normalized;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const childPath = path ? `${path}.${key}` : key;
      out[key] = publicationStableShareValue027(value[key], childPath);
    }
    return out;
  }
  return value;
}

function publicationShareEquivalent027(a, b) {
  const parse = (value) => {
    const text = value === null || value === undefined || value === '' ? '{}' : String(value);
    try { return publicationStableShareValue027(JSON.parse(text)); } catch { return null; }
  };
  const left = parse(a);
  const right = parse(b);
  if (left === null || right === null) return String(a ?? '') === String(b ?? '');
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicationGenreSet027(payloadJson) {
  try {
    const parsed = JSON.parse(String(payloadJson || '{}'));
    const values = parsed?.selectedKeywords?.genres;
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function publicationPrimaryGenreEquivalent027(row, source, primaryGenre) {
  const previous = String(row?.primary_genre || '').trim();
  const next = String(primaryGenre || '').trim();
  if (previous === next) return true;
  const previousGenres = publicationGenreSet027(row?.share_payload_json);
  const nextGenres = publicationGenreSet027(source?.sharePayloadJson);
  if (!previousGenres.length || previousGenres.length !== nextGenres.length) return false;
  if (previousGenres.some((value, index) => value !== nextGenres[index])) return false;
  return previousGenres.includes(previous) && nextGenres.includes(next);
}

function publicationRepublishSemanticUnchanged027(row, source, options, primaryGenre) {
  if (!row?.id) return false;
  const text = (value) => value === null || value === undefined ? '' : String(value);
  const sameText = (a, b) => text(a) === text(b);
  const sameNumber = (a, b) => {
    const ae = a === null || a === undefined || a === '';
    const be = b === null || b === undefined || b === '';
    if (ae || be) return ae && be;
    return Number(a) === Number(b);
  };
  return sameText(row.source_type, source.sourceType)
    && sameText(row.source_id, source.sourceId)
    && sameText(row.source_parent_id, source.sourceParentId)
    && sameText(row.legacy_global_id, source.legacyGlobalId)
    && sameText(row.source_subtrack_key, source.sourceSubTrackKey)
    && sameNumber(row.source_subtrack_index, source.sourceSubTrackIndex)
    && sameText(row.source_subtrack_id, source.sourceSubTrackId)
    && sameText(row.title, source.title)
    && sameText(row.description, source.description)
    && sameText(row.cover_url, source.coverUrl)
    && sameNumber(row.duration_seconds, source.durationSeconds)
    && sameText(row.lyrics, source.lyrics)
    && sameText(row.style, source.style)
    && sameText(row.prompt, source.prompt)
    && sameText(row.suno_url_primary, source.sunoUrlPrimary)
    && sameText(row.suno_url_secondary, source.sunoUrlSecondary)
    && publicationSearchSignature022(row.search_text) === publicationSearchSignature022(source.searchText)
    && Number(row.allow_next_song_apply || 0) === Number(options.allowNextSongApply || 0)
    && Number(row.allow_follower_save || 0) === Number(options.allowFollowerSave || 0)
    && Number(row.profile_pinned || 0) === Number(options.profilePinned || 0)
    && Number(row.share_schema_version || 0) === Number(source.shareSchemaVersion || 0)
    && publicationShareEquivalent027(row.share_payload_json, source.sharePayloadJson)
    && publicationPrimaryGenreEquivalent027(row, source, primaryGenre);
}

const anchor = functionRange('publicationRepublishSemanticUnchanged022').start;
source = source.slice(0, anchor)
  + `// ${marker}\n${publicationStableShareValue027.toString()}\n\n${publicationShareEquivalent027.toString()}\n\n${publicationGenreSet027.toString()}\n\n${publicationPrimaryGenreEquivalent027.toString()}\n\n`
  + source.slice(anchor);

replaceFunction(
  'publicationRepublishSemanticUnchanged022',
  publicationRepublishSemanticUnchanged027.toString().replace('publicationRepublishSemanticUnchanged027', 'publicationRepublishSemanticUnchanged022'),
);

const semantic = functionRange('publicationRepublishSemanticUnchanged022').text;
for (const required of [
  'publicationShareEquivalent027(row.share_payload_json, source.sharePayloadJson)',
  'publicationPrimaryGenreEquivalent027(row, source, primaryGenre)',
  'sameText(row.title, source.title)',
  'sameText(row.lyrics, source.lyrics)',
  'sameText(row.suno_url_primary, source.sunoUrlPrimary)',
]) {
  if (!semantic.includes(required)) throw new Error(`[027] semantic invariant missing: ${required}`);
}
for (const forbidden of ['UPDATE ', 'INSERT ', 'DELETE ', 'SELECT ', 'env.DB']) {
  if (semantic.includes(forbidden)) throw new Error(`[027] semantic comparator must remain DB-free: ${forbidden}`);
}

const hot = functionRange('handleMusicNotePublicationSingleWrite016').text;
if (!hot.includes('visibilityTransitionOnly022')) throw new Error('[027] visibility transition routing missing');
if ((hot.match(/INSERT INTO tracks/g) || []).length !== 1) throw new Error('[027] canonical full-write count changed');
if (!hot.includes('applyPublicationVisibilityTransition021')) throw new Error('[027] narrow transition helper missing');

writeFileSync(workerPath, source, 'utf8');
console.log('[027] Re-publication now treats keyword-array ordering and derived primary-genre ordering as representation-only while preserving real content/options changes.');
