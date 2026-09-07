import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_SEMANTIC_REPUBLISH_022_20260907';
if (source.includes(marker)) {
  console.log('[022] semantic republish patch already applied.');
  process.exit(0);
}
if (!source.includes('applyPublicationVisibilityTransition021')) {
  throw new Error('[022] patch 021 must be active first.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[022] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[022] function body missing: ${name}`);
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
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`[022] unterminated function: ${name}`);
};

const replaceFunctionText = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[022] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

function publicationStableJsonValue022(value) {
  if (Array.isArray(value)) return value.map((item) => publicationStableJsonValue022(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = publicationStableJsonValue022(value[key]);
    return out;
  }
  return value;
}

function publicationJsonEquivalent022(a, b) {
  const parse = (value) => {
    const text = value === null || value === undefined || value === '' ? '{}' : String(value);
    try { return publicationStableJsonValue022(JSON.parse(text)); } catch { return null; }
  };
  const left = parse(a);
  const right = parse(b);
  if (left === null || right === null) return String(a ?? '') === String(b ?? '');
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicationSearchSignature022(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join('\u0001');
}

function publicationRepublishSemanticUnchanged022(row, source, options, primaryGenre) {
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
    && publicationJsonEquivalent022(row.share_payload_json, source.sharePayloadJson)
    && sameText(row.primary_genre, primaryGenre);
}

const helperAnchor = 'async function applyPublicationVisibilityTransition021(';
if (!source.includes(helperAnchor)) throw new Error('[022] helper anchor missing');
source = source.replace(
  helperAnchor,
  `// ${marker}\n${publicationStableJsonValue022.toString()}\n\n${publicationJsonEquivalent022.toString()}\n\n${publicationSearchSignature022.toString()}\n\n${publicationRepublishSemanticUnchanged022.toString()}\n\n${helperAnchor}`,
);

replaceFunctionText('handleMusicNotePublicationSingleWrite016', (text) => {
  const oldProbeSingle = `  const visibilityTransitionOnly021 = Boolean(previous?.id)\n    && !unchanged\n    && publicationCanonicalUnchanged016(\n      { ...previous, is_public: 1, status: 'published' },\n      source,\n      resolvedOptions,\n      primaryGenre\n    );`;
  const oldProbeDouble = `  const visibilityTransitionOnly021 = Boolean(previous?.id) && !unchanged && publicationCanonicalUnchanged016(\n    { ...previous, is_public: 1, status: "published" },\n    source,\n    resolvedOptions,\n    primaryGenre\n  );`;
  const oldProbe = text.includes(oldProbeSingle) ? oldProbeSingle : (text.includes(oldProbeDouble) ? oldProbeDouble : null);
  if (!oldProbe) throw new Error('[022] 021 transition probe anchor missing');
  let next = text.replace(
    oldProbe,
    `  const visibilityTransitionOnly022 = Boolean(previous?.id)\n    && !unchanged\n    && publicationRepublishSemanticUnchanged022(previous, source, resolvedOptions, primaryGenre);`,
  );
  next = next.replace('  if (visibilityTransitionOnly021) {', '  if (visibilityTransitionOnly022) {');
  next = next.replace(
    `      mutation: unchanged ? 'idempotent' : 'written'`,
    `      mutation: visibilityTransitionOnly022 ? 'visibility-transition' : (unchanged ? 'idempotent' : 'written')`,
  );
  next = next.replace(
    `      mutation: unchanged ? "idempotent" : "written"`,
    `      mutation: visibilityTransitionOnly022 ? "visibility-transition" : unchanged ? "idempotent" : "written"`,
  );
  if (!next.includes('visibilityTransitionOnly022')) throw new Error('[022] transition flag missing after transform');
  if (next.includes('visibilityTransitionOnly021')) throw new Error('[022] legacy 021 transition flag remains');
  if (!next.includes('visibility-transition')) throw new Error('[022] mutation diagnostic missing');
  return next;
});

const hot = functionRange('handleMusicNotePublicationSingleWrite016').text;
const semantic = functionRange('publicationRepublishSemanticUnchanged022').text;
for (const required of [
  'visibilityTransitionOnly022',
  'publicationRepublishSemanticUnchanged022(',
  'visibility-transition',
  'applyPublicationVisibilityTransition021(',
]) {
  if (!hot.includes(required)) throw new Error(`[022] publish invariant missing: ${required}`);
}
if ((hot.match(/INSERT INTO tracks/g) || []).length !== 1) {
  throw new Error('[022] full create/update path count changed');
}
for (const required of [
  'publicationSearchSignature022(row.search_text)',
  'publicationJsonEquivalent022(row.share_payload_json, source.sharePayloadJson)',
  'sameText(row.title, source.title)',
  'sameText(row.lyrics, source.lyrics)',
  'sameText(row.suno_url_primary, source.sunoUrlPrimary)',
]) {
  if (!semantic.includes(required)) throw new Error(`[022] semantic guard missing: ${required}`);
}
for (const forbidden of ['UPDATE ', 'INSERT ', 'DELETE ', 'SELECT ']) {
  if (semantic.includes(forbidden)) throw new Error(`[022] semantic guard must stay read/write free: ${forbidden}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[022] Republish now ignores representation-only Firestore map/tag ordering while preserving real content-change detection.');
