import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const functionText = (source, name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `missing function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
};

assert.equal(manifest.patches.at(-1), '051-publication-write-returning.mjs');
assert.match(worker, /SORIDRAW_PUBLICATION_WRITE_RETURNING_051_20260914/);

const batch = functionText(worker, 'handleMusicNotePublicationBatch048');
assert.match(batch, /readMusicNotePublicationR2Payload\(env, authContext\.uid\)/);
assert.match(batch, /registeredMutations\.every/);
assert.match(batch, /env\.DB\.batch\(updateStatements\)/);
assert.match(batch, /UPDATE tracks SET \$\{sets\.join\(','\)\}/);
assert.match(batch, /WHERE id=\? AND owner_uid=\? AND source_type='music_note'/);
assert.match(batch, /RETURNING \*/);
assert.match(batch, /preUpdatedTrackIds\.has\(item\.mutation\.trackId\)/);
assert.match(batch, /unresolvedTrackIds\.size/);
assert.match(batch, /previousPublicBySource/);
assert.match(batch, /syncMusicNotePublicationR2Batch049/);
assert.match(batch, /handlePublication\(/);

assert.doesNotMatch(batch, /FROM track_stats WHERE track_id IN/);
assert.doesNotMatch(batch, /SELECT \* FROM tracks\s+WHERE owner_uid=\? AND id IN/);

const warmIndex = batch.indexOf('if (publicationStateWarm)');
const returningIndex = batch.indexOf('RETURNING *');
const unresolvedReadIndex = batch.indexOf('if (unresolvedTrackIds.size)');
const coldIndex = batch.indexOf('} else {', warmIndex);
assert.ok(warmIndex >= 0 && returningIndex > warmIndex, 'warm mutation path must update with RETURNING');
assert.ok(unresolvedReadIndex > returningIndex, 'warm SELECT fallback must be bounded to unresolved rows');
assert.ok(coldIndex > warmIndex, 'cold publication-state fallback must remain explicit');

console.log('PASS 084: warm registered publication changes use guarded UPDATE RETURNING without canonical pre-read; D1 SELECT is bounded to unresolved/cold repair; public track_stats preflight is removed; auth and R2 state guards remain.');
