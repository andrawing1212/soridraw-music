import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[086] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker185 = 'SORIDRAW_LEGACY_LIKE_DIRECT_NORMALIZE_185_20260922';
const marker186 = 'SORIDRAW_LEGACY_LIKE_POSTWRITE_ACK_186_20260922';
if (source.includes(marker186)) { console.log('[086/186] already applied'); process.exit(0); }
if (!source.includes(marker185)) throw new Error('[086/186] 185 prerequisite missing');

function functionRange(name) {
  const needle = 'async function ' + name + '(';
  const start = source.indexOf(needle);
  if (start < 0) throw new Error('[086/186] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[086/186] unterminated function: ' + name);
}

const range = functionRange('handleLikeBatch034');
const startNeedle = '  const catalogBefore185 = await readSharedLikesState161(env, authContext.uid);';
const start = range.text.indexOf(startNeedle);
const endNeedle = '  return json({';
const end = range.text.indexOf(endNeedle, start);
if (start < 0 || end < 0) throw new Error('[086/186] 185 post-write block missing');

const safe = [
  '  // ' + marker186,
  '  // Canonical D1 is already committed above. R2/cache publication is best-effort:',
  '  // it must never turn a successful mutation into HTTP 5xx and cause client replay.',
  '  let catalogBefore185 = null;',
  '  try { catalogBefore185 = await readSharedLikesState161(env, authContext.uid); }',
  "  catch (error) { console.warn('[186] personal catalog pre-read deferred:', String(error?.message || error || 'unknown')); }",
  "  let personalR2 = { ok: false, repairNeeded: true, reason: 'not-attempted' };",
  '  try { personalR2 = await syncExploreLikeR2AfterBatch074(env, authContext.uid, results, receivedAt, settlementBatchId185); }',
  "  catch (error) { console.warn('[186] personal R2 incremental publish deferred:', String(error?.message || error || 'unknown')); }",
  "  let personalLikeSnapshot185 = 'repair-needed';",
  '  if (personalR2?.ok && catalogBefore185?.exact) {',
  '    try {',
  '      const key185 = exploreSharedLikesKey061(authContext.uid);',
  '      let exactFinalized185 = false;',
  '      for (let attempt185 = 0; attempt185 < 8; attempt185 += 1) {',
  '        const object185 = await env.PROFILE_MEDIA.get(key185);',
  '        if (!object185) break;',
  '        let body185 = null; try { body185 = JSON.parse(await object185.text()); } catch {}',
  '        if (!body185 || !Array.isArray(body185.likedTrackIds)) break;',
  "        const ids185 = [...new Set(body185.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean))];",
  "        const next185 = { ...body185, canonicalComplete156: true, exactLikeCount156: ids185.length, canonicalSource156: 'direct-d1-catalog-186', updatedAt: Date.now(), likedTrackIds: ids185 };",
  "        const stored185 = await env.PROFILE_MEDIA.put(key185, JSON.stringify(next185), { onlyIf: { etagMatches: object185.etag }, httpMetadata: { contentType: 'application/json; charset=utf-8' }, customMetadata: { soridrawSharedLikes: '186', updatedAt: String(next185.updatedAt) } });",
  '        if (stored185) { exactFinalized185 = true; break; }',
  '      }',
  "      if (exactFinalized185) personalLikeSnapshot185 = 'settled';",
  '    } catch (catalogError185) {',
  "      console.warn('[186] exact personal catalog metadata finalize deferred:', String(catalogError185?.message || catalogError185 || 'unknown'));",
  '    }',
  '  }',
].join('\n') + '\n';

let legacyTail = range.text.slice(end);
legacyTail = legacyTail.replace("      personalLikeSnapshot: 'settled',", '      personalLikeSnapshot: personalLikeSnapshot185,');
legacyTail = legacyTail.replace("      personalLikeProtocol: 'legacy-direct-185',", "      personalLikeProtocol: 'legacy-direct-186-postwrite-ack',");
legacyTail = legacyTail.replace("      publicLikePublication: 'targeted-r2-185',", "      publicLikePublication: personalLikeSnapshot185 === 'settled' ? 'targeted-r2-186' : 'repair-needed',");
let next = range.text.slice(0, start) + safe + legacyTail;

if (!next.includes(marker186)) throw new Error('[086/186] marker not materialized');
if (!next.includes("canonicalD1: 'settled'")) throw new Error('[086/186] canonical settlement marker lost');
if (!legacyTail.includes('personalLikeSnapshot: personalLikeSnapshot185')) throw new Error('[086/186] dynamic legacy snapshot state missing');
if (!range.text.slice(0, start).includes("personalLikeSnapshot: 'settled'")) throw new Error('[086/186] D1-only settled response fixture missing');
if (next.includes("throwApi('LIKE_PUBLICATION_RETRY_REQUIRED'")) throw new Error('[086/186] post-write 5xx replay path remains');
if (next.includes('SELECT l.track_id FROM likes l JOIN tracks t')) throw new Error('[086/186] mutation hotpath still scans full personal likes');
if (next.includes('rebuildExploreLikeR2Bundle(env, authContext.uid)')) throw new Error('[086/186] mutation hotpath still performs synchronous full repair');

source = source.slice(0, range.start) + next + source.slice(range.end);
writeFileSync(workerPath, source, 'utf8');
console.log('[086/186] canonical D1 ACK is final; R2 publication is incremental/best-effort and full-like scan is removed from mutation hotpath.');
