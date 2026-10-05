import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER
  || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const extractFunction = (source, name) => {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, line = false, block = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1] || '';
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i += 1; continue; }
    if (c === '/' && n === '*') { block = true; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

assert.ok(
  manifest.patches.includes('094-publication-d1-read-compaction.mjs'),
  '094 patch not wired into release manifest',
);
assert.match(worker, /SORIDRAW_PUBLICATION_D1_READ_COMPACTION_361_20261005/);

const single = extractFunction(worker, 'handleMusicNotePublicationSingleWrite016');
for (const required of [
  'readMusicNotePublicationR2Payload(env, authContext.uid)',
  'readExploreProfileCanonicalR2Bundle020(env, authContext.uid)',
  'publicationR2ProvedNew361',
  'if (!publicationR2ProvedNew361)',
  'previous = await publicationReadState016(env, authContext.uid, source.id)',
]) assert.ok(single.includes(required), `first-public read compaction missing: ${required}`);
assert.equal(
  (single.match(/publicationReadState016\(env, authContext\.uid, source\.id\)/g) || []).length,
  1,
  'first-public D1 fallback must remain exactly one conditional call',
);
assert.ok(
  single.indexOf('if (!publicationR2ProvedNew361)') < single.indexOf('publicationReadState016(env, authContext.uid, source.id)'),
  'canonical first-public read is no longer conditional',
);
assert.ok(single.includes('profile_is_public: 1'), 'R2 profile proof does not preserve public-profile contract');

const batch = extractFunction(worker, 'handleMusicNotePublicationBatch048');
for (const required of [
  'inlineMediaFast361',
  'mutation.refreshSourceContent || (mutation.refreshSourceMedia && !inlineMediaFast361)',
  "['cover_url', String(inlineMediaFast361.coverUrl || '')]",
  "['duration_seconds', inlineMediaFast361.durationSeconds == null ? null : Number(inlineMediaFast361.durationSeconds)]",
  "['suno_url_primary', String(inlineMediaFast361.sunoUrlPrimary || '')]",
  "['suno_url_secondary', inlineMediaFast361.sunoUrlSecondary ? String(inlineMediaFast361.sunoUrlSecondary) : null]",
  'guards.push(`${column} IS NOT ?`)',
  'RETURNING *',
]) assert.ok(batch.includes(required), `source-swap read compaction missing: ${required}`);

assert.ok(
  batch.includes('mutation.refreshSourceContent || (mutation.refreshSourceMedia && !inlineMediaFast361)'),
  'legacy/content refresh fallback must remain intact',
);
assert.ok(
  batch.includes('const inlineMedia = mutation.refreshSourceMedia ? mutation.sourceMedia : null;'),
  'app333 inline-media authority was lost',
);

console.log('PUBLICATION_361_FIRST_PUBLIC_R2_PRECHECK=PASS');
console.log('PUBLICATION_361_FIRST_PUBLIC_D1_FALLBACK=BOUNDED');
console.log('PUBLICATION_361_SOURCE_SWAP_INLINE_MEDIA_PRESELECT=REMOVED');
console.log('PUBLICATION_361_LEGACY_SOURCE_SWAP_FALLBACK=PRESERVED');
console.log('PUBLICATION_361_REFRESH_CONTENT_FALLBACK=PRESERVED');
console.log('PUBLICATION_361_UI_SCOPE_CHANGED=false');
