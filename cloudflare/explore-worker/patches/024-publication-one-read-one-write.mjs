import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_ONE_READ_ONE_WRITE_024_20260907';
if (source.includes(marker)) {
  console.log('[024] publication one-read/one-write patch already applied.');
  process.exit(0);
}

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'publicationReadState016',
  'publicationEnsureProfile016',
  'publicationResolveProfileHandle023',
  'patchExploreProfileR2Mutation019',
  'readExploreR2Json',
  'exploreProfileR2Key',
  'validExploreProfileR2Bundle020',
  'applyPublicationVisibilityTransition021',
]) {
  if (!source.includes(required)) throw new Error(`[024] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[024] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[024] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[024] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const transformFunction = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[024] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

async function publicationReadState024(env, uid, trackId) {
  // Existing publish/re-publish needs one canonical row only. Engagement and
  // profile identity are already materialized in R2 and must not add D1 reads.
  return await env.DB.prepare(`
    SELECT *
    FROM tracks
    WHERE id = ? AND owner_uid = ?
    LIMIT 1
  `).bind(trackId, uid).first();
}

async function publicationReadProfileR2024(env, authContext) {
  try {
    const uid = String(authContext?.uid || '').trim();
    if (!uid) return null;
    const bundle = await readExploreR2Json(env, exploreProfileR2Key(uid));
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const profile = bundle?.body?.data?.profile || {};
    return {
      nickname: String(profile?.nickname || profile?.displayName || authContext?.displayName || ''),
      avatarUrl: String(profile?.avatarUrl || profile?.avatar_url || authContext?.picture || ''),
      handle: String(profile?.handle || bundle?.handle || '').trim().replace(/^@+/, '')
    };
  } catch {
    return null;
  }
}

async function publicationResolveProfileHandle024(env, uid, preferredHandle) {
  const preferred = String(preferredHandle || '').trim().replace(/^@+/, '');
  if (preferred) return preferred;
  try {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) return '';
    const bundle = await readExploreR2Json(env, exploreProfileR2Key(normalizedUid));
    if (!validExploreProfileR2Bundle020(bundle)) return '';
    return String(bundle?.body?.data?.profile?.handle || bundle?.handle || '').trim().replace(/^@+/, '');
  } catch {
    return '';
  }
}

async function patchExploreProfileR2Mutation024(env, uid, change) {
  try {
    const normalizedUid = String(uid || '').trim();
    const trackId = String(change?.trackId || '').trim();
    if (!normalizedUid || !trackId) return { ok: false, skipped: true, handle: '' };

    const bundle = await readExploreR2Json(env, exploreProfileR2Key(normalizedUid));
    if (!validExploreProfileR2Bundle020(bundle)) {
      console.warn('[SORIDRAW 024] canonical profile R2 bundle missing; repair deferred to profile access.');
      return { ok: false, repairNeeded: true, handle: '' };
    }

    const previousData = bundle.body.data;
    let items = previousData.items.filter((item) => getProfileTrackId019(item) !== trackId);
    if (!change?.remove) {
      const previous = previousData.items.find((item) => getProfileTrackId019(item) === trackId) || {};
      const nextItem = change?.item
        ? {
            ...previous,
            ...change.item,
            // The canonical D1 hot read intentionally no longer joins track_stats.
            // Preserve any already-materialized engagement values from R2.
            stats: { ...(change.item?.stats || {}), ...(previous?.stats || {}) },
            likeCount: previous?.likeCount ?? change.item?.likeCount ?? change.item?.stats?.likeCount ?? 0,
            commentCount: previous?.commentCount ?? change.item?.commentCount ?? change.item?.stats?.commentCount ?? 0,
            playCount: previous?.playCount ?? change.item?.playCount ?? change.item?.stats?.playCount ?? 0
          }
        : { ...previous, ...(change?.patch || {}) };
      items.push(nextItem);
    }
    items = sortProfileTracks019(items).slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);

    const previousCount = Number(previousData.profile?.trackCount ?? previousData.profile?.track_count ?? 0);
    const nextCount = Math.max(0, previousCount + Number(change?.trackCountDelta || 0));
    const nextRevision = Math.max(1, Number(bundle.revision || previousData.revision || 0) + 1);
    const nextData = {
      ...previousData,
      profile: { ...previousData.profile, trackCount: nextCount },
      items,
      revision: nextRevision,
      updatedAt: Date.now()
    };
    const nextBundle = {
      ...bundle,
      revision: nextRevision,
      updatedAt: Date.now(),
      body: { ...bundle.body, data: nextData }
    };
    await writeExploreR2Json(env, exploreProfileR2Key(normalizedUid), nextBundle);
    return {
      ok: true,
      repairNeeded: false,
      revision: nextRevision,
      handle: String(nextData.profile?.handle || bundle.handle || '').trim().replace(/^@+/, '')
    };
  } catch (error) {
    console.warn('[SORIDRAW 024] profile R2 delta skipped:', String(error?.message || error || 'unknown'));
    return { ok: false, repairNeeded: true, handle: '' };
  }
}

replaceFunction(
  'publicationReadState016',
  publicationReadState024.toString().replace('publicationReadState024', 'publicationReadState016'),
);
replaceFunction(
  'publicationResolveProfileHandle023',
  publicationResolveProfileHandle024.toString().replace('publicationResolveProfileHandle024', 'publicationResolveProfileHandle023'),
);
replaceFunction(
  'patchExploreProfileR2Mutation019',
  patchExploreProfileR2Mutation024.toString().replace('patchExploreProfileR2Mutation024', 'patchExploreProfileR2Mutation019'),
);

const helperAnchor = functionRange('handleMusicNotePublicationSingleWrite016').start;
source = source.slice(0, helperAnchor)
  + `// ${marker}\n${publicationReadProfileR2024.toString()}\n\n`
  + source.slice(helperAnchor);

transformFunction('handleMusicNotePublicationSingleWrite016', (text) => {
  const pattern = /const\s+profile\s*=\s*await\s+publicationEnsureProfile016\(env,\s*authContext,\s*previous,\s*now\);/;
  if (!pattern.test(text)) throw new Error('[024] publish profile ensure anchor missing');
  return text.replace(pattern, `let profile = await publicationReadProfileR2024(env, authContext);\n  if (!profile && !previous?.id) {\n    profile = await publicationEnsureProfile016(env, authContext, previous, now);\n  }\n  if (!profile) {\n    profile = {\n      nickname: String(authContext?.displayName || ''),\n      avatarUrl: String(authContext?.picture || ''),\n      handle: ''\n    };\n  }`);
});

const readState = functionRange('publicationReadState016').text;
for (const forbidden of ['track_stats', 'public_profiles', 'JOIN ']) {
  if (readState.includes(forbidden)) throw new Error(`[024] publication read still touches ${forbidden}`);
}
if (!readState.includes('FROM tracks')) throw new Error('[024] canonical track read missing');

const resolver = functionRange('publicationResolveProfileHandle023').text;
if (resolver.includes('env.DB') || resolver.includes('public_profiles')) {
  throw new Error('[024] profile handle resolver still touches D1');
}
if (!resolver.includes('readExploreR2Json')) throw new Error('[024] profile handle resolver must use R2');

const publish = functionRange('handleMusicNotePublicationSingleWrite016').text;
for (const required of [
  'publicationReadProfileR2024(env, authContext)',
  'if (!profile && !previous?.id)',
  'publicationEnsureProfile016(env, authContext, previous, now)',
]) {
  if (!publish.includes(required)) throw new Error(`[024] publish cache-first invariant missing: ${required}`);
}
const ensureIndex = publish.indexOf('publicationEnsureProfile016(env, authContext, previous, now)');
const newOnlyIndex = publish.indexOf('if (!profile && !previous?.id)');
if (ensureIndex < newOnlyIndex) throw new Error('[024] profile ensure is not bounded to first publication');

const profilePatch = functionRange('patchExploreProfileR2Mutation019').text;
for (const required of [
  'previous?.stats',
  'previous?.likeCount',
  'previous?.commentCount',
  'previous?.playCount',
  'readExploreR2Json(env, exploreProfileR2Key(normalizedUid))'
]) {
  if (!profilePatch.includes(required)) throw new Error(`[024] R2 profile invariant missing: ${required}`);
}
if (profilePatch.includes('env.DB')) throw new Error('[024] profile R2 delta must not touch D1');

writeFileSync(workerPath, source, 'utf8');
console.log('[024] Existing Music Note public/private transitions now target one canonical D1 read and one index-neutral D1 write.');
