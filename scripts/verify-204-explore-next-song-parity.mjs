import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const action = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/089-public-next-song-command-parity.mjs', 'utf8');
const legacyPatch427 = readFileSync('cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs', 'utf8');

function functionRange(source, name) {
  const needles = [`async function ${name}(`, `function ${name}(`, `const ${name} =`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} body did not terminate`);
}

const bundle = functionRange(worker, 'buildMusicNoteShareBundle015');
// app427 supersedes the app204 inline bundle shape while retaining its
// command/legacy/no-generated-prompt contract. Audit the actual runtime, not
// an obsolete source marker or direct note fallback removed by patch100.
assert.match(bundle, /SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018/,
  'canonical Worker must contain the audited app427 legacy next-song replacement');
assert.match(bundle, /const requestApplied = parseRecord\(requestPayload\?\.appliedKeywords\)/,
  'legacy requestPayload.appliedKeywords must be read');
assert.match(bundle, /applied = mergeMissing\(applied, pick\(requestApplied\)\)/,
  'persisted legacy fields must fill missing canonical fields');
assert.match(bundle, /const storedCommand = firstCommand\(canonicalApplied, requestApplied, requestPayload, parseRecord\(note\)\)/,
  'command precedence must use stored originals, not generated prompt');
assert.match(bundle, /const userInput = shareText015\(applied\.userInput, 4000\)/,
  'public share bundle must copy only the persisted original command');
assert.match(bundle, /nextSong\.userInput = userInput/, 'command input must be part of nextSong');
for (const field of ['rapMode', 'lyricWritingStyle', 'tempoSource', 'isRandomTempo']) {
  assert.ok(bundle.includes(field), `public nextSong must preserve ${field}`);
}
assert.match(bundle, /userInput: nextSong\.userInput \|\| ''/, 'compact oversized-bundle fallback must retain command input');
assert.doesNotMatch(bundle, /note\?\.lyrics|note\?\.lyricsText/, 'next-song share must not copy finished lyrics into the next command');
assert.match(patch, /SORIDRAW_PUBLIC_NEXT_SONG_COMMAND_PARITY_204_20260926/, 'replay patch must preserve the same Worker contract');
assert.match(legacyPatch427, /SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018/, 'latest replay patch must preserve requestPayload legacy parity');
assert.match(legacyPatch427, /requestApplied/, 'latest public bundle must read requestPayload.appliedKeywords');
// The actual canonical runtime was already checked above for finished
// lyrics. Patch100 intentionally contains the phrase only in its NEGATIVE
// rejection guard; require that protection instead of falsely flagging it.
assert.ok(legacyPatch427.includes("if (updated.includes('note?.lyrics') || updated.includes('note?.lyricsText'))"),
  'legacy patch must actively reject copying finished lyrics');

const ownSource = functionRange(action, 'getExploreOwnMusicNoteApplyKeywords');
assert.match(ownSource, /getDoc\(doc\(db, 'favorites', normalizedSourceId\)\)/, 'own legacy recovery must read only one source Music Note document');
assert.doesNotMatch(ownSource, /getDocs\(|collection\(|collectionGroup\(/, 'own legacy recovery must never scan a collection');
assert.match(ownSource, /ownerUid && ownerUid !== user\.uid/, 'own source recovery must reject a mismatched owner');
assert.match(ownSource, /resolveMusicNoteNextSongRecipe\(data\)/, 'own source recovery must normalize persisted legacy recipe fields');

const legacy = functionRange(action, 'buildExploreLegacyApplyKeywords');
for (const kind of ['genre', 'style', 'mood', 'theme', 'sound']) {
  assert.ok(legacy.includes(`byKind('${kind}')`), `legacy apply fallback must map ${kind} tags`);
}
assert.doesNotMatch(legacy, /prompt|userInput/, 'legacy public tag fallback must never pretend the generated prompt is the original command');

const apply = functionRange(page, 'applyExploreTrackToNextSong');
assert.match(apply, /user\.uid === track\.ownerUid[\s\S]*track\.sourceType === 'music_note'[\s\S]*getExploreOwnMusicNoteApplyKeywords\(user, track\.sourceId\)/,
  'only the owner may use the one-document Music Note recovery');
assert.match(apply, /buildExploreLegacyApplyKeywords\(\{[\s\S]*shareBundle: track\.shareBundle \|\| null/s,
  'legacy public bundle must be converted locally before a Worker fallback');
assert.match(apply, /const source = await getExploreTrackApplySource\(user, track\.id\)[\s\S]*buildExploreLegacyApplyKeywords\(source\)/,
  'Worker legacy tags must remain a bounded final fallback');
assert.doesNotMatch(apply, /source\?\.prompt[\s\S]*userInput|userInput[\s\S]*source\?\.prompt/,
  'generated prompt must never be substituted for the original command');

const studioApply = functionRange(app, 'applyKeywordsToNext');
assert.match(studioApply, /appliedKeywords\?\.userInput[\s\S]*setUserInput\(resolvedUserInput\)/,
  'Studio must continue restoring the shared userInput into the command window');

console.log('APP204_PUBLIC_NEXT_SONG_COMMAND_PARITY=PASS');
console.log('APP204_LEGACY_TAG_FALLBACK=PASS');
console.log('APP204_OWN_MUSIC_NOTE_ONE_DOC_RECOVERY=PASS');
console.log('APP204_STUDIO_COMMAND_RESTORE=PASS');
console.log('APP204_NO_PROMPT_AS_COMMAND=PASS');
