import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[091] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_SHARED_PROFILE_PARITY_091_20260927';
if (source.includes(marker)) {
  console.log('[091] already applied');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917',
  'SORIDRAW_PUBLICATION_CANONICAL_LIKE_PARITY_071_20260920',
  'patchExploreProfileR2Publication043',
  'exploreSharedProfileR2Key060',
  'validExploreProfileR2Bundle020',
  'getProfileTrackId019',
  'sortProfileTracks019',
  'PUBLIC_PROFILE_FIRST_VIEW_LIMIT',
]) {
  if (!source.includes(required)) throw new Error('[091] missing prerequisite: ' + required);
}

function functionRange(name) {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[091] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[091] unterminated function: ' + name);
}

async function patchExploreSharedProfilePublication091(env, uid, change) {
  const normalizedUid = String(uid || '').trim();
  const trackId = String(change?.trackId || '').trim();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!normalizedUid || !trackId || !bucket) return { ok: false, skipped: true };

  const key = exploreSharedProfileR2Key060(normalizedUid);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const object = await bucket.get(key);
    if (!object) return { ok: false, repairNeeded: true, reason: 'shared_profile_missing' };

    let bundle;
    try { bundle = JSON.parse(await object.text()); } catch { bundle = null; }
    if (!validExploreProfileR2Bundle020(bundle)) {
      return { ok: false, repairNeeded: true, reason: 'shared_profile_invalid' };
    }

    const previousData = bundle.body.data;
    const previousItems = Array.isArray(previousData.items) ? previousData.items : [];
    let items = previousItems.filter((item) => getProfileTrackId019(item) !== trackId);

    if (!change?.remove) {
      const previous = previousItems.find((item) => getProfileTrackId019(item) === trackId) || {};
      const nextItem = change?.item
        ? {
            ...previous,
            ...change.item,
            stats: { ...(change.item?.stats || {}), ...(previous?.stats || {}), likeCount: change.item.likeCount },
            likeCount: change.item.likeCount,
          }
        : { ...previous, ...(change?.patch || {}) };
      items.push(nextItem);
    }

    items = sortProfileTracks019(items).slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);
    const previousCount = Math.max(0, Number(previousData.profile?.trackCount ?? previousData.profile?.track_count ?? 0));
    const nextCount = Math.max(0, previousCount + Number(change?.trackCountDelta || 0));
    const nextRevision = Math.max(1, Number(bundle.revision || previousData.revision || 0) + 1);
    const now = Date.now();
    const nextData = {
      ...previousData,
      profile: { ...previousData.profile, trackCount: nextCount },
      items,
      revision: nextRevision,
      updatedAt: now,
    };
    const nextBundle = {
      ...bundle,
      revision: nextRevision,
      updatedAt: now,
      body: { ...bundle.body, data: nextData },
    };

    const saved = await bucket.put(key, JSON.stringify(nextBundle), {
      onlyIf: { etagMatches: object.etag },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { soridrawSharedProfile: '113', mirroredAt: String(now), publicationParity: '091' },
    });
    if (saved) return { ok: true, revision: nextRevision };
  }

  return { ok: false, repairNeeded: true, reason: 'shared_profile_conflict' };
}

const anchor = functionRange('patchExploreProfileR2Publication043');
const helper = `// ${marker}\n${patchExploreSharedProfilePublication091.toString()}\n\n`;
source = source.slice(0, anchor.start) + helper + source.slice(anchor.start);

const current = functionRange('patchExploreProfileR2Publication043');
let body = current.text;
if (!body.includes('readCanonicalPublicationLike071')) {
  throw new Error('[091] 071 canonical publication wrapper is not active');
}
if (!body.includes('const [env, uid] = args;')) {
  throw new Error('[091] publication profile wrapper env/uid anchor missing');
}

const resultMatch = body.match(/const result = await ([A-Za-z0-9_$]+)\(\.\.\.args\);/);
if (!resultMatch) throw new Error('[091] publication profile result anchor missing');
const resultLine = resultMatch[0];
const parityBlock = `${resultLine}
  try {
    const sharedParity091 = await patchExploreSharedProfilePublication091(env, uid, args[2]);
    if (sharedParity091?.ok === false && !sharedParity091?.skipped) {
      console.warn('[SORIDRAW 091] shared publication profile parity deferred:', String(sharedParity091?.reason || 'unknown'));
    }
  } catch (error) {
    console.warn('[SORIDRAW 091] shared publication profile parity failed:', String(error?.message || error || 'unknown'));
  }`;
body = body.replace(resultLine, parityBlock);
source = source.slice(0, current.start) + body + source.slice(current.end);

const finalBody = functionRange('patchExploreProfileR2Publication043').text;
for (const required of [
  'readCanonicalPublicationLike071',
  'patchExploreSharedProfilePublication091(env, uid, args[2])',
  'const result = await',
]) {
  if (!finalBody.includes(required)) throw new Error('[091] final wrapper missing: ' + required);
}
const sharedBody = functionRange('patchExploreSharedProfilePublication091').text;
if (sharedBody.includes('env.DB') || sharedBody.includes('.prepare(')) {
  throw new Error('[091] shared profile publication parity must remain D1-free');
}
for (const required of ['onlyIf: { etagMatches: object.etag }', 'PROFILE_MEDIA', 'exploreSharedProfileR2Key060']) {
  if (!sharedBody.includes(required)) throw new Error('[091] shared helper missing: ' + required);
}

writeFileSync(path, source, 'utf8');
console.log('[091] publication profile delta now updates shared profile R2 directly with CAS; no owner-wide D1 read.');
