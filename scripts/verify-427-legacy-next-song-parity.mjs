import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const helperSource = fs.readFileSync('src/lib/musicNoteNextSongRecipe.ts', 'utf8');
const js = ts.transpileModule(
  helperSource + '\n(globalThis).__resolve = resolveMusicNoteNextSongRecipe;',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const context = { globalThis: {} };
vm.runInNewContext(js, context);
const resolve = context.globalThis.__resolve;

const recent = resolve({
  appliedKeywords: {
    genre: ['nu-metal'],
    mood: ['dark'],
    userInput: 'current command',
    vocal: { mode: 'solo', members: [{ gender: 'male' }] },
    languageMixRatio: 20,
  },
  requestPayload: {
    appliedKeywords: {
      genre: ['old-rock'],
      userInput: 'old command',
      vocal: { mode: 'group', globalToneId: 'legacy-tone' },
      tempo: '120 BPM',
    },
  },
});
assert.deepEqual(Array.from(recent.genre), ['nu-metal']);
assert.equal(recent.userInput, 'current command');
assert.equal(recent.vocal.mode, 'solo');
assert.equal(recent.vocal.globalToneId, 'legacy-tone', 'missing nested legacy field may fill');
assert.equal(recent.tempo, '120 BPM');
assert.equal(recent.languageMixRatio, 20);

const legacyApplied = resolve({
  requestPayload: {
    appliedKeywords: {
      subGenre: ['dream-pop'],
      mood: ['dreamy'],
      instrumentSound: ['analog-synth'],
      userInput: 'persisted old command',
      lyricLanguages: ['ko', 'en'],
      languageMixTargetLanguages: ['en'],
      isKoreanEnglishMix: true,
    },
  },
});
assert.deepEqual(Array.from(legacyApplied.subGenre), ['dream-pop']);
assert.equal(legacyApplied.userInput, 'persisted old command');
assert.equal(legacyApplied.isKoreanEnglishMix, true);

const legacyDirect = resolve({
  requestPayload: {
    genre: ['dance-pop'],
    style: ['minimal'],
    tempo: '124 BPM',
    commandInput: 'legacy direct command',
    unrelatedProviderSecret: 'must-not-leak',
  },
});
assert.deepEqual(Array.from(legacyDirect.genre), ['dance-pop']);
assert.equal(legacyDirect.userInput, 'legacy direct command');
assert.equal(legacyDirect.tempo, '124 BPM');
assert.ok(!Object.prototype.hasOwnProperty.call(legacyDirect, 'unrelatedProviderSecret'));

const topAlias = resolve({
  appliedKeywords: { genre: ['britpop'] },
  directInput: 'top-level stored command',
});
assert.equal(topAlias.userInput, 'top-level stored command');

const absent = resolve({
  appliedKeywords: { genre: ['britpop'], mood: ['bright'] },
  prompt: 'GENERATED MUSIC PROMPT THAT MUST NOT BECOME USER INPUT',
  style: 'generated style',
});
assert.ok(!absent.userInput, 'historically absent command must remain absent');
assert.ok(!JSON.stringify(absent).includes('GENERATED MUSIC PROMPT'),
  'generated prompt must never be fabricated as original command');

const explicitEmpty = resolve({
  appliedKeywords: { userInput: '', genre: ['pop'] },
  requestPayload: { appliedKeywords: { userInput: 'older command' } },
});
assert.equal(explicitEmpty.userInput, '', 'explicit current empty command must beat older legacy value');

const favorite = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const globalPlayer = fs.readFileSync('src/components/GlobalPlayer.tsx', 'utf8');
const action = fs.readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const workerPatch = fs.readFileSync('cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs', 'utf8');
const manifest = JSON.parse(fs.readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

assert.match(favorite, /resolveMusicNoteNextSongRecipe\(song\)/,
  'Music Note direct apply must normalize historical storage shapes');
assert.match(globalPlayer, /resolveMusicNoteNextSongRecipe\(/,
  'GlobalPlayer apply must use the same historical normalizer');
assert.match(action, /const nextSong = resolveMusicNoteNextSongRecipe\(data\)/,
  'own Explore source recovery must use the same historical normalizer');
assert.ok(manifest.patches.includes('100-music-note-next-song-legacy-parity.mjs'),
  'public Worker release must include legacy shareBundle patch');
assert.match(workerPatch, /requestPayload/);
assert.match(workerPatch, /requestApplied/);
assert.match(workerPatch, /mergeMissing/);
// Patch100 legitimately includes the string "note?.lyrics" inside its
// NEGATIVE safety check. Inspect the actual canonical runtime function
// instead of matching that protective source-code assertion.
const workerRuntime = fs.readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const runtimeStart = workerRuntime.indexOf('function buildMusicNoteShareBundle015(note) {');
assert.ok(runtimeStart >= 0, 'canonical runtime share-bundle function must exist');
const runtimeEnd = workerRuntime.indexOf('\n}', runtimeStart);
assert.ok(runtimeEnd > runtimeStart, 'canonical runtime share-bundle function must terminate');
const runtimeBundle = workerRuntime.slice(runtimeStart, runtimeEnd + 2);
assert.match(runtimeBundle, /SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018/);
assert.match(runtimeBundle, /const userInput = shareText015\(applied\.userInput, 4000\)/);
assert.doesNotMatch(runtimeBundle, /note\?\.lyrics|note\?\.lyricsText/,
  'public next-song runtime must not copy finished lyrics');
assert.ok(workerPatch.includes("if (updated.includes('note?.lyrics') || updated.includes('note?.lyricsText'))"),
  'patch100 must retain its explicit generated-lyrics rejection guard');
assert.match(workerPatch, /const userInput = shareText015\(applied\.userInput, 4000\)/,
  'public share bundle must use persisted command only');

console.log('APP427_RECENT_NEXT_SONG_PARITY=PASS');
console.log('APP427_REQUEST_PAYLOAD_APPLIED_LEGACY=PASS');
console.log('APP427_REQUEST_PAYLOAD_DIRECT_LEGACY=PASS');
console.log('APP427_CANONICAL_WINS_LEGACY_FILL=PASS');
console.log('APP427_ABSENT_COMMAND_NOT_FABRICATED=PASS');
console.log('APP427_PUBLIC_SHARE_BUNDLE_PARITY=PASS');
