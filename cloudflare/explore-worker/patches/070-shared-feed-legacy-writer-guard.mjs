import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remote = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remote) throw new Error('[070] remote Worker directory missing');
const file = join(remote, 'worker.js');
let source = readFileSync(file, 'utf8');
const marker = 'SORIDRAW_SHARED_FEED_LEGACY_WRITER_GUARD_070_20260919';
if (source.includes(marker)) {
  console.log('[070] already applied');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_SHARED_FEED_TARGETED_PARITY_069_20260919',
  'SORIDRAW_SHARED_LIKE_COUNT_TARGETED_065_20260918',
  'async function mirrorExploreSharedFeeds059(',
  'async function mirrorExploreSharedFeedAfterDerivedSync064(',
  'async function patchSharedFeedLikeCounts065(',
]) if (!source.includes(required)) throw new Error('[070] missing prerequisite: ' + required);

function range(name) {
  const start = source.indexOf('async function ' + name + '(');
  if (start < 0) throw new Error('[070] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[070] unterminated function: ' + name);
}
function replace(name, next) {
  const old = range(name);
  source = source.slice(0, old.start) + next + source.slice(old.end);
}

// Environment-local snapshots are not authoritative; another environment may
// have already made one of their tracks private. No bulk mirror is permitted.
replace('mirrorExploreSharedFeeds059',
  '// ' + marker + '\n' +
  'async function mirrorExploreSharedFeeds059(env) {\n' +
  '  return { mirrored: 0, disabledBy070: true };\n' +
  '}');
replace('mirrorExploreSharedFeedAfterDerivedSync064',
  'async function mirrorExploreSharedFeedAfterDerivedSync064(env, sort) {\n' +
  '  return { mirrored: false, disabledBy070: true };\n' +
  '}');

// 065 patches counts on existing records only. Convert its shared snapshot put
// into conditional writes, retrying against the new snapshot after any conflict.
// This prevents a delayed like writer from undoing a concurrent private deletion.
const original = range('patchSharedFeedLikeCounts065').text;
const start = original.indexOf('    let object = null;\n');
const end = original.indexOf('\n  let changedCards = 0;', start);
if (start < 0 || end < 0 || original.slice(start, end).includes('onlyIf:')) {
  throw new Error('[070] unexpected 065 target like writer');
}
const newPatch = [
  '    let completed = false;',
  '    for (let attempt = 0; attempt < 8; attempt += 1) {',
  '      const object = await shared.get(key);',
  '      if (!object) { completed = true; break; }',
  '      let bundle = null;',
  '      try { bundle = JSON.parse(await object.text()); } catch { bundle = null; }',
  '      const items = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : null;',
  '      if (!items) { completed = true; break; }',
  '      let changed = false;',
  '      const nextItems = items.map((item) => {',
  "        const trackId = String(item?.id || item?.trackId || '').trim();",
  '        if (!wanted.has(trackId)) return item;',
  '        const patched = patchSharedFeedItemLike065(item, wanted.get(trackId));',
  '        if (patched.changed) changed = true;',
  '        return patched.item;',
  '      });',
  '      if (!changed) { completed = true; break; }',
  '      const now = Date.now();',
  '      const nextBundle = {',
  '        ...bundle, updatedAt: now,',
  '        payload: { ...bundle.payload, data: { ...bundle.payload.data, items: nextItems } },',
  '      };',
  '      const saved = await shared.put(key, JSON.stringify(nextBundle), {',
  '        onlyIf: { etagMatches: object.etag },',
  "        httpMetadata: { contentType: 'application/json; charset=utf-8' },",
  '        customMetadata: {',
  '          ...(object.customMetadata || {}),',
  "          soridrawSharedFeed: '070',",
  "          targetedLikePatch: '065-cas-070',",
  '          mirroredAt: String(now),',
  '        },',
  '      });',
  '      if (saved) { changedFeeds += 1; completed = true; break; }',
  '    }',
  "    if (!completed) throw new Error('[SORIDRAW 070] shared like CAS contention: ' + sort);",
  '  }',
  '',
].join('\n');
const nextLike = original.slice(0, start) + newPatch + original.slice(end);
if (!nextLike.includes('onlyIf: { etagMatches: object.etag }') ||
    !nextLike.includes('patchSharedTrackCard062') ||
    !nextLike.includes('return { rows: rows.length, changedFeeds, changedCards, skipped: false };')) {
  throw new Error('[070] targeted like/card preservation failed');
}
replace('patchSharedFeedLikeCounts065', nextLike);
for (const name of ['mirrorExploreSharedFeeds059', 'mirrorExploreSharedFeedAfterDerivedSync064']) {
  if (range(name).text.includes('.put(') || !range(name).text.includes('disabledBy070: true')) {
    throw new Error('[070] legacy full writer still active: ' + name);
  }
}
if (/env\.DB|\.prepare\s*\(/.test(range('patchSharedFeedLikeCounts065').text)) {
  throw new Error('[070] unexpected D1 access');
}
writeFileSync(file, source, 'utf8');
console.log('[070] old full shared Feed writers disabled; targeted shared likes CAS-safe.');
