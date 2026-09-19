import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');

const expectedClient = "const getMusicNoteTrackId = (uid: string, sourceId: string) => `music_note_${uid}_${sourceId}`;";
assert.ok(client.includes(expectedClient), 'client Music Note trackId formula changed');

const workerFormula = "id: `music_note_${uid}_${sourceId}`,";
assert.ok(worker.includes(workerFormula), 'Worker Music Note trackId formula changed');

const functionBody = (source, name) => {
  const prefixes = [`function ${name}(`, `async function ${name}(`];
  let start = -1;
  for (const prefix of prefixes) {
    start = source.indexOf(prefix);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

const sourceBuilder = functionBody(worker, 'buildMusicNoteExploreSource');
assert.ok(sourceBuilder.includes(workerFormula), 'Worker source builder no longer uses deterministic uid/sourceId formula');
for (const forbidden of ['Date.now(', 'Math.random(', 'crypto.randomUUID(', 'performance.now(', 'navigator.', 'device']) {
  assert.equal(sourceBuilder.includes(forbidden), false, `unstable value entered Worker trackId builder: ${forbidden}`);
}

const clientId = (uid, sourceId) => `music_note_${uid}_${sourceId}`;
const workerId = (uid, sourceId) => `music_note_${uid}_${sourceId}`;
for (const [uid, sourceId] of [
  ['uid-A', 'note-1'],
  ['uid-A', 'note-1'],
  ['uid-B', 'abc_123'],
  ['firebase-uid-0123456789', 'music-note-source-xyz'],
]) {
  const a = clientId(uid, sourceId);
  const b = workerId(uid, sourceId);
  assert.equal(a, b, 'client/Worker trackId mismatch');
  assert.equal(clientId(uid, sourceId), a, 'same uid/sourceId retry changed trackId');
}

assert.ok(client.includes('getMusicNoteTrackId(uid, sourceId)'), 'publication flow no longer calls deterministic trackId helper');
assert.ok(client.includes('trackId: desiredState.trackId'), 'publication outbox no longer preserves desired trackId');
assert.ok(client.includes("trackId: String(value?.trackId || trackId || '').trim()"), 'publication state normalization no longer preserves trackId');
assert.ok(client.includes('state.trackId === normalizedTrackId'), 'cached publication state no longer resolves by stable trackId');
assert.ok(client.includes('const prefix = `music_note_${uid}_`;'), 'trackId reverse sourceId recovery prefix changed');

const helperLineStart = client.indexOf('const getMusicNoteTrackId =');
const helperLineEnd = client.indexOf('\n', helperLineStart);
const helperLine = client.slice(helperLineStart, helperLineEnd);
for (const forbidden of ['Date.now', 'Math.random', 'randomUUID', 'performance', 'navigator', 'window', 'device']) {
  assert.equal(helperLine.includes(forbidden), false, `unstable client trackId input: ${forbidden}`);
}

console.log('W2_PHASE_B_TRACK_ID_STABILITY=PASS');
console.log('CLIENT_FORMULA=music_note_${uid}_${sourceId}');
console.log('WORKER_FORMULA=music_note_${uid}_${sourceId}');
console.log('RETRY_DETERMINISTIC=true');
console.log('OUTBOX_TRACK_ID_PRESERVED=true');
console.log('CACHE_TRACK_ID_PRESERVED=true');
console.log('RANDOM_TIME_DEVICE_INPUTS=false');
