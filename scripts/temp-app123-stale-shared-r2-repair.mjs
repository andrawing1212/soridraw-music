import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const workerDir = resolve('cloudflare/explore-worker');
const wrangler = join(workerDir, 'node_modules/wrangler/bin/wrangler.js');
const config = 'canonical/wrangler.preview.jsonc';
const bucket = 'soridraw-profile-media';
const temp = process.env.RUNNER_TEMP || '/tmp';
const previewBase = 'https://soridraw-explore-preview.andrawing1212.workers.dev';
const previewOrigin = 'https://preview.soridraw.com';

const expectedTargets = [
  { id: 'music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q', titleNeedle: 'Leaving One Step Open' },
  { id: 'music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_mdCqNWohZwk6lsKuNWOa', titleNeedle: 'Left Unsaid' },
  { id: 'music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_b1ef5cf6fcb04371b33ea71d1950f244_5jt44', titleNeedle: 'Through the Night' },
  { id: 'music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6eb4944de4264b12a85f0d17180cd143_1en45bp', titleNeedle: 'Just Stay Here Awhile' },
];

const run = (args, { capture = false, allowFail = false } = {}) => {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: workerDir,
    env: process.env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`wrangler failed (${result.status}): ${args.join(' ')}\n${result.stderr || ''}`);
  }
  return result;
};

const sql = `SELECT
  t.id,
  t.owner_uid,
  t.title,
  COALESCE(s.like_count,0) AS like_count,
  (SELECT COUNT(*) FROM likes l WHERE l.track_id=t.id) AS relation_count,
  COALESCE(d.likes,-1) AS derived_likes
FROM tracks t
LEFT JOIN track_stats s ON s.track_id=t.id
LEFT JOIN explore_derived_tracks d ON d.id=t.id
WHERE t.id IN ('music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q','music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_mdCqNWohZwk6lsKuNWOa','music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_b1ef5cf6fcb04371b33ea71d1950f244_5jt44','music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6eb4944de4264b12a85f0d17180cd143_1en45bp')
ORDER BY t.id`;

const d1 = run(['d1','execute','DB','--remote','--config',config,'--command',sql,'--json'], { capture: true });
let parsed;
try { parsed = JSON.parse(d1.stdout); } catch (error) { throw new Error(`D1 JSON parse failed: ${d1.stdout}\n${d1.stderr}`); }
const rows = parsed.flatMap((entry) => Array.isArray(entry?.results) ? entry.results : []);
const expectedById = new Map(expectedTargets.map((row) => [row.id, row]));
const actualIds = rows.map((row) => String(row.id || '')).sort();
const expectedIds = expectedTargets.map((row) => row.id).sort();
if (rows.length !== 4 || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`Safety stop: expected exact four diagnosed track IDs, got ${JSON.stringify(rows)}`);
}
for (const row of rows) {
  const id = String(row.id || '').trim();
  const expected = expectedById.get(id);
  if (!expected || !String(row.owner_uid || '').trim()) throw new Error(`Safety stop: missing expected id/owner ${JSON.stringify(row)}`);
  if (!String(row.title || '').includes(expected.titleNeedle)) throw new Error(`Safety stop: title/id pairing changed for ${id}: ${row.title}`);
  if (Number(row.like_count) !== 1 || Number(row.relation_count) !== 1 || Number(row.derived_likes) !== 1) {
    throw new Error(`Safety stop: canonical/relation/derived no longer all 1 for ${row.title}: ${JSON.stringify(row)}`);
  }
}
console.log('EXACT_4_CANONICAL_GATE=PASS');
console.log(JSON.stringify(rows, null, 2));

const targetById = new Map(rows.map((row) => [String(row.id), {
  id: String(row.id),
  ownerUid: String(row.owner_uid),
  title: String(row.title),
  likeCount: Number(row.like_count),
}]));
const idsByOwner = new Map();
for (const row of targetById.values()) {
  if (!idsByOwner.has(row.ownerUid)) idsByOwner.set(row.ownerUid, new Set());
  idsByOwner.get(row.ownerUid).add(row.id);
}

const work = join(temp, 'app123-shared-r2-repair');
mkdirSync(work, { recursive: true });
writeFileSync(join(work, 'canonical-rows.json'), JSON.stringify([...targetById.values()], null, 2));

const safeName = (value) => Buffer.from(String(value)).toString('base64url');
const r2Get = (key, file, required = false) => {
  const result = run(['r2','object','get',`${bucket}/${key}`,'--file',file,'--remote'], { allowFail: !required });
  if (result.status !== 0) {
    if (required) throw new Error(`Required R2 object missing: ${key}`);
    return false;
  }
  return true;
};
const r2Put = (key, file) => run(['r2','object','put',`${bucket}/${key}`,'--file',file,'--content-type','application/json','--remote','--force']);

const countOf = (item) => {
  const value = item?.likeCount ?? item?.like_count ?? item?.stats?.likeCount ?? item?.stats?.like_count ?? 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const patchItemCount = (item, count) => {
  const current = countOf(item);
  if (current === count) return false;
  item.likeCount = count;
  if (Object.prototype.hasOwnProperty.call(item, 'like_count')) item.like_count = count;
  if (item.stats && typeof item.stats === 'object' && !Array.isArray(item.stats)) {
    item.stats.likeCount = count;
    if (Object.prototype.hasOwnProperty.call(item.stats, 'like_count')) item.stats.like_count = count;
  }
  return true;
};

const now = Date.now();
const feedResults = [];
for (const sort of ['latest','popular']) {
  const key = `internal/explore/shared-feed-v112/${sort}-40.json`;
  const before = join(work, `${sort}-before.json`);
  r2Get(key, before, true);
  const bundle = JSON.parse(readFileSync(before, 'utf8'));
  const items = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : null;
  if (!items) throw new Error(`Safety stop: invalid shared Feed bundle ${sort}`);
  let found = 0;
  let changed = 0;
  const beforeCounts = {};
  for (const item of items) {
    const id = String(item?.id || item?.trackId || '').trim();
    const target = targetById.get(id);
    if (!target) continue;
    found += 1;
    beforeCounts[id] = countOf(item);
    if (patchItemCount(item, target.likeCount)) changed += 1;
  }
  if (sort === 'latest' && found !== 4) throw new Error(`Safety stop: diagnosed four tracks are not all in shared latest-40 (found ${found})`);
  if (changed > 0) {
    bundle.updatedAt = now;
    const after = join(work, `${sort}-after.json`);
    writeFileSync(after, JSON.stringify(bundle));
    r2Put(key, after);
  }
  feedResults.push({ sort, found, changed, beforeCounts });
}
console.log('SHARED_FEED_TARGETED_PATCH=' + JSON.stringify(feedResults));

let cardFound = 0;
let cardChanged = 0;
for (const target of targetById.values()) {
  const key = `internal/explore/shared-track-card-v115/${encodeURIComponent(target.id)}.json`;
  const before = join(work, `card-${safeName(target.id)}-before.json`);
  if (!r2Get(key, before, false)) continue;
  cardFound += 1;
  const bundle = JSON.parse(readFileSync(before, 'utf8'));
  const card = bundle?.card;
  if (!card || String(card.id || card.trackId || '').trim() !== target.id) throw new Error(`Safety stop: invalid track card ${target.id}`);
  if (patchItemCount(card, target.likeCount)) {
    bundle.updatedAt = now;
    const after = join(work, `card-${safeName(target.id)}-after.json`);
    writeFileSync(after, JSON.stringify(bundle));
    r2Put(key, after);
    cardChanged += 1;
  }
}
console.log(`SHARED_TRACK_CARD_PATCH found=${cardFound} changed=${cardChanged}`);

let profileFound = 0;
let profileChanged = 0;
for (const [ownerUid, ownerIds] of idsByOwner) {
  const key = `internal/explore/shared-profile-v113/${encodeURIComponent(ownerUid)}.json`;
  const before = join(work, `profile-${safeName(ownerUid)}-before.json`);
  if (!r2Get(key, before, false)) continue;
  profileFound += 1;
  const bundle = JSON.parse(readFileSync(before, 'utf8'));
  const items = Array.isArray(bundle?.body?.data?.items) ? bundle.body.data.items : null;
  if (!items) throw new Error(`Safety stop: invalid shared profile ${ownerUid}`);
  let changed = 0;
  for (const item of items) {
    const id = String(item?.id || item?.trackId || '').trim();
    if (!ownerIds.has(id)) continue;
    const target = targetById.get(id);
    if (target && patchItemCount(item, target.likeCount)) changed += 1;
  }
  if (changed > 0) {
    const oldRevision = Math.max(0, Number(bundle.revision || bundle.body?.data?.revision || 0));
    const nextRevision = oldRevision + 1;
    bundle.revision = nextRevision;
    bundle.updatedAt = now;
    bundle.body.data.revision = nextRevision;
    bundle.body.data.updatedAt = now;
    const after = join(work, `profile-${safeName(ownerUid)}-after.json`);
    writeFileSync(after, JSON.stringify(bundle));
    r2Put(key, after);
    profileChanged += 1;
  }
}
console.log(`SHARED_PROFILE_PATCH found=${profileFound} changed=${profileChanged}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let feedVerified = false;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const response = await fetch(`${previewBase}/v1/feed?sort=latest&limit=40&__soridraw_r2_only=108`, {
    headers: { Origin: previewOrigin, 'Cache-Control': 'no-cache' },
  });
  const payload = await response.json();
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const byId = new Map(items.map((item) => [String(item?.id || item?.trackId || '').trim(), countOf(item)]));
  const ok = [...targetById.keys()].every((id) => byId.get(id) === 1);
  const d1Read = response.headers.get('x-soridraw-d1-read');
  console.log(`PREVIEW_SHARED_FEED_VERIFY attempt=${attempt} status=${response.status} d1Read=${d1Read} source=${response.headers.get('x-soridraw-feed-snapshot')}`);
  if (response.ok && ok && d1Read === '0') { feedVerified = true; break; }
  await sleep(1000);
}
if (!feedVerified) throw new Error('Shared Feed API did not converge to canonical count=1 for all four tracks');

for (const [ownerUid, ownerIds] of idsByOwner) {
  const probe = `__app123_repair_${Date.now()}`;
  const response = await fetch(`${previewBase}/v1/profiles/${encodeURIComponent(ownerUid)}/first-view?limit=50&knownRevision=${probe}`, {
    headers: { Origin: previewOrigin, 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`Public profile verify failed ${ownerUid}: ${response.status}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const matching = items.filter((item) => ownerIds.has(String(item?.id || item?.trackId || '').trim()));
  if (matching.length && !matching.every((item) => countOf(item) === 1)) {
    throw new Error(`Public profile still has stale like count for ${ownerUid}`);
  }
  console.log(`PUBLIC_PROFILE_VERIFY owner=${ownerUid} matched=${matching.length} source=${response.headers.get('x-soridraw-profile-edge-cache') || ''}`);
}

console.log('APP123_STALE_SHARED_R2_REPAIR=PASS');
console.log('D1_OPERATION=SELECT_ONLY');
console.log('USER_CANONICAL_DATA_WRITE=0');
console.log('R2_WRITE_SCOPE=EXACT_DIAGNOSED_4_TRACKS_ONLY');