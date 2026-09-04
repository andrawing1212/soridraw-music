import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_PROFILE_R2_DELTA_019_20260905';
if (source.includes('patchExploreProfileR2Mutation019')) {
  console.log('[019] publication profile R2 delta already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[019] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[019] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[019] ${label} anchor count=${count}`);
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'handleMusicNotePrivate017',
  'handleMusicNotePublicationOptions017',
  'readExploreProfileR2Bundle',
  'writeExploreR2Json',
  'exploreProfileR2Key',
  'invalidatePublicationProfileCaches017',
  'env.DB.batch',
  'Promise.allSettled',
]) {
  if (!source.includes(required)) throw new Error(`[019] required Stage3.1 runtime behavior missing: ${required}`);
}

const helperSource = `// ${marker}
function getProfileTrackId019(item) {
  return String(item?.id || item?.trackId || '').trim();
}

function sortProfileTracks019(items) {
  return [...items].sort((a, b) => {
    const pinnedA = a?.profilePinned === true || Number(a?.profile_pinned || 0) === 1 ? 1 : 0;
    const pinnedB = b?.profilePinned === true || Number(b?.profile_pinned || 0) === 1 ? 1 : 0;
    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
    const publishedA = Number(a?.publishedAt ?? a?.published_at ?? 0);
    const publishedB = Number(b?.publishedAt ?? b?.published_at ?? 0);
    if (publishedA !== publishedB) return publishedB - publishedA;
    return getProfileTrackId019(b).localeCompare(getProfileTrackId019(a));
  });
}

async function patchExploreProfileR2Mutation019(env, uid, change) {
  try {
    const normalizedUid = String(uid || '').trim();
    const trackId = String(change?.trackId || '').trim();
    if (!normalizedUid || !trackId) return { ok: false, skipped: true };
    const bundle = await readExploreProfileR2Bundle(env, normalizedUid);
    if (!bundle?.body?.data?.profile || !Array.isArray(bundle.body.data.items)) {
      console.warn('[SORIDRAW stage3.2] profile R2 bundle missing; D1 rebuild intentionally skipped.');
      return { ok: false, repairNeeded: true };
    }

    const previousData = bundle.body.data;
    let items = previousData.items.filter((item) => getProfileTrackId019(item) !== trackId);
    if (!change?.remove) {
      const previous = previousData.items.find((item) => getProfileTrackId019(item) === trackId) || {};
      const nextItem = change?.item
        ? { ...previous, ...change.item }
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
    };
    const nextBundle = {
      ...bundle,
      revision: nextRevision,
      updatedAt: Date.now(),
      body: { ...bundle.body, data: nextData },
    };
    await writeExploreR2Json(env, exploreProfileR2Key(normalizedUid), nextBundle);
    return { ok: true, repairNeeded: false, revision: nextRevision };
  } catch (error) {
    console.warn('[SORIDRAW stage3.2] profile R2 delta skipped:', String(error?.message || error || 'unknown'));
    return { ok: false, repairNeeded: true };
  }
}
`;
const helperAnchor = functionRange('invalidatePublicationProfileCaches017').start;
source = source.slice(0, helperAnchor) + helperSource + '\n' + source.slice(helperAnchor);

replaceFunction('invalidatePublicationProfileCaches017', `async function invalidatePublicationProfileCaches017(request, env, uid, handle) {
  // R2 first-view is now the mutation cache of record. Never delete it here: doing
  // so forces the next profile visit back to a stale/expensive D1 snapshot.
  try {
    await invalidatePublicProfileFirstViewEdgeCache(request, [uid, handle].filter(Boolean));
  } catch (error) {
    console.warn('[SORIDRAW stage3.2] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));
  }
}`);

replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  '  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || "");',
  `  await patchExploreProfileR2Mutation019(env, authContext.uid, {
    trackId: source.id,
    item: feedItem,
    remove: false,
    trackCountDelta: wasPublic ? 0 : 1
  });
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || "");`,
  'publish profile R2 delta',
);

replaceOnceInFunction(
  'handleMusicNotePrivate017',
  '  await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || "");',
  `  if (changed) {
    await patchExploreProfileR2Mutation019(env, authContext.uid, {
      trackId: row.id,
      remove: true,
      trackCountDelta: -1
    });
  }
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || "");`,
  'private profile R2 delta',
);

replaceOnceInFunction(
  'handleMusicNotePublicationOptions017',
  `  if (changed && Number(row.profile_pinned || 0) !== next.profilePinned) {
    await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || "");
  }`,
  `  if (changed) {
    await patchExploreProfileR2Mutation019(env, authContext.uid, {
      trackId: row.id,
      remove: false,
      trackCountDelta: 0,
      patch: {
        allowNextSongApply: next.allowNextSongApply === 1,
        allowFollowerSave: next.allowFollowerSave === 1,
        profilePinned: next.profilePinned === 1
      }
    });
    await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || "");
  }`,
  'option profile R2 delta',
);

const profileInvalidator = functionRange('invalidatePublicationProfileCaches017').text;
if (profileInvalidator.includes('PROFILE_MEDIA.delete')) throw new Error('[019] publication still deletes profile R2 cache');
const publishHot = functionRange('handleMusicNotePublicationSingleWrite016').text;
const privateHot = functionRange('handleMusicNotePrivate017').text;
if (!publishHot.includes('patchExploreProfileR2Mutation019')) throw new Error('[019] publish profile delta missing');
if (!privateHot.includes('patchExploreProfileR2Mutation019')) throw new Error('[019] private profile delta missing');
if (helperSource.includes('env.DB.')) throw new Error('[019] profile R2 delta must never touch D1');

writeFileSync(workerPath, source, 'utf8');
console.log('[019] Public profile mutation cache now uses bounded R2 delta updates; publication/private no longer delete R2 and fall back to stale D1 snapshots.');
