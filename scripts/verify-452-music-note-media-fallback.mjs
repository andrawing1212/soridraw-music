import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/musicNoteCompactMediaSync452.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox);
const f = sandbox.exports.appendBoundedMusicNoteMediaFallback452;
assert.equal(typeof f, 'function');

const base = { id: 'fav-id', firestoreId: 'fav-id', title: 'Legacy long song', __catalogSummary: true };
const project = {
  sunoShareUrl: 'https://suno.com/song/exact-url',
  sunoCoverUrl: 'https://cdn.suno.ai/image/exact-cover.png',
  sunoShareUrlUpdatedAt: 123456,
  sunoCoverFetchedAt: 123456,
  mainSunoIndex: 0,
  sunoLinks: [{ url: 'https://suno.com/song/exact-url', hugeHistoricalMetadata: 'X'.repeat(30000) }],
  thumbnailUrl: 'https://cdn.suno.ai/image/thumbnail.png',
};
const result = f(base, project);
assert.equal(result.sunoShareUrl, project.sunoShareUrl);
assert.equal(result.sunoCoverUrl, project.sunoCoverUrl);
assert.equal(result.thumbnailUrl, project.thumbnailUrl);
assert.equal(result.sunoShareUrlUpdatedAt, 123456);
assert.equal(result.sunoLinks, undefined, 'never send oversized whole media object');
assert.ok(JSON.stringify(result).length <= 24000);
assert.equal(base.sunoShareUrl, undefined, 'source data untouched');
assert.equal(result.firestoreId, 'fav-id', 'exact song identity must not change');
assert.equal(project.sunoLinks[0].hugeHistoricalMetadata.length, 30000,
  'large user-owned data must not be truncated or mutated');
assert.equal(result.title, 'Legacy long song', 'non-media fields remain intact');


const existing = f(base, { ...project, sunoLinks: [] });
assert.equal(Array.isArray(existing.sunoLinks), true,
  'when bounded, whole Suno link array is retained');
const empty = f(base, { title: 'unrelated' });
assert.equal(empty.sunoShareUrl, undefined, 'never invent a URL');

const service = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
assert.match(service, /return appendBoundedMusicNoteMediaFallback452\(\{[\s\S]{0,1400}updatedAtMs:[^\n]*\n  \}, projected\);/);
assert.match(service, /JSON.stringify\(compactProjected\).length <= MAX_SYNC_ITEM_JSON_CHARS/);
assert.match(service, /signal.operation === 'suno-media-preview'/);
console.log('APP452_LONG_MUSIC_NOTE_SUNO_URL_COVER_RTDB_FALLBACK=PASS');
console.log('APP452_RTDB_BOUND_24000_NO_EXTRA_SERVER_IO=PASS');
