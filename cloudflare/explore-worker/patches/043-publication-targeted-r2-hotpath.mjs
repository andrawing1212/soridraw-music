import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_TARGETED_R2_HOTPATH_043_20260913';
if (source.includes(MARKER)) {
  console.log('[043] publication targeted R2 hotpath already applied.');
  process.exit(0);
}

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'handleMusicNotePrivate017',
  'handleMusicNotePublicationOptions017',
  'syncMusicNotePublicationR2AfterMutation',
  'mutateExploreR2Cache052',
  'exploreFeedR2Key',
  'exploreProfileR2Key',
  'getExploreFeedItemId012',
  'sortExploreFeedItems012',
  'buildExploreFeedCursor012',
  'EXPLORE_R2_FEED_LIMIT',
  'validExploreProfileR2Bundle020',
  'getProfileTrackId019',
  'sortProfileTracks019',
  'PUBLIC_PROFILE_FIRST_VIEW_LIMIT',
]) {
  if (!source.includes(required)) throw new Error(`[043] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[043] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[043] function body missing: ${name}`);
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
  throw new Error(`[043] unterminated function: ${name}`);
};

const transformFunction = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[043] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

const replaceExactInFunction = (name, before, after, label) => {
  transformFunction(name, (text) => {
    const count = text.split(before).length - 1;
    if (count !== 1) throw new Error(`[043] ${label} anchor count=${count}`);
    return text.replace(before, after);
  });
};

async function syncExploreFeedR2Publication043(env, incomingItem) {
  const trackId = getExploreFeedItemId012(incomingItem);
  if (!trackId) return { ok: false, skipped: true };
  const results = await Promise.all(['latest', 'popular'].map(async (sort) => (
    mutateExploreR2Cache052(env, exploreFeedR2Key(sort), (bundle) => {
      const data = bundle?.payload?.data;
      if (!data || !Array.isArray(data.items)) return null;
      const previousItems = data.items;
      const existing = previousItems.find((item) => getExploreFeedItemId012(item) === trackId) || null;
      const merged = existing ? {
        ...existing,
        ...incomingItem,
        stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}) },
        likeCount: existing?.likeCount ?? incomingItem?.likeCount ?? incomingItem?.stats?.likeCount ?? 0,
        commentCount: existing?.commentCount ?? incomingItem?.commentCount ?? incomingItem?.stats?.commentCount ?? 0,
        playCount: existing?.playCount ?? incomingItem?.playCount ?? incomingItem?.stats?.playCount ?? 0,
      } : incomingItem;
      const withoutCurrent = previousItems.filter((item) => getExploreFeedItemId012(item) !== trackId);
      const previousCursor = data.nextCursor ?? null;
      const overflowed = !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT;
      const items = sortExploreFeedItems012([merged, ...withoutCurrent], sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      if (sort === 'popular' && !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT) {
        const included = items.some((item) => getExploreFeedItemId012(item) === trackId);
        if (!included) return null;
      }
      return {
        ...bundle,
        payload: {
          ...bundle.payload,
          data: {
            ...data,
            items,
            sort,
            nextCursor: buildExploreFeedCursor012(sort, items, previousCursor, overflowed),
          },
        },
        updatedAt: Date.now(),
      };
    })
  )));
  return { ok: results.every((result) => result?.ok !== false), results };
}

async function syncExploreFeedR2Private043(env, trackId) {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) return { ok: false, skipped: true };
  const results = await Promise.all(['latest', 'popular'].map(async (sort) => (
    mutateExploreR2Cache052(env, exploreFeedR2Key(sort), (bundle) => {
      const data = bundle?.payload?.data;
      if (!data || !Array.isArray(data.items)) return null;
      const items = data.items.filter((item) => getExploreFeedItemId012(item) !== normalizedTrackId);
      if (items.length === data.items.length) return null;
      return {
        ...bundle,
        payload: { ...bundle.payload, data: { ...data, items } },
        updatedAt: Date.now(),
      };
    })
  )));
  return { ok: results.every((result) => result?.ok !== false), results };
}

async function syncExploreFeedR2OptionPatch043(env, trackId, patch) {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) return { ok: false, skipped: true };
  const results = await Promise.all(['latest', 'popular'].map(async (sort) => (
    mutateExploreR2Cache052(env, exploreFeedR2Key(sort), (bundle) => {
      const data = bundle?.payload?.data;
      if (!data || !Array.isArray(data.items)) return null;
      let changed = false;
      const patched = data.items.map((item) => {
        if (getExploreFeedItemId012(item) !== normalizedTrackId) return item;
        changed = true;
        return { ...item, ...patch };
      });
      if (!changed) return null;
      const items = sortExploreFeedItems012(patched, sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      return {
        ...bundle,
        payload: { ...bundle.payload, data: { ...data, items } },
        updatedAt: Date.now(),
      };
    })
  )));
  return { ok: results.every((result) => result?.ok !== false), results };
}

async function patchExploreProfileR2Publication043(env, uid, change) {
  const normalizedUid = String(uid || '').trim();
  const trackId = String(change?.trackId || '').trim();
  if (!normalizedUid || !trackId) return { ok: false, skipped: true, handle: '' };
  let resolvedHandle = '';
  const result = await mutateExploreR2Cache052(env, exploreProfileR2Key(normalizedUid), (bundle) => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const previousData = bundle.body.data;
    resolvedHandle = String(previousData.profile?.handle || bundle.handle || '').trim().replace(/^@+/, '');
    let items = previousData.items.filter((item) => getProfileTrackId019(item) !== trackId);
    if (!change?.remove) {
      const previous = previousData.items.find((item) => getProfileTrackId019(item) === trackId) || {};
      const nextItem = change?.item ? {
        ...previous,
        ...change.item,
        stats: { ...(change.item?.stats || {}), ...(previous?.stats || {}) },
        likeCount: previous?.likeCount ?? change.item?.likeCount ?? change.item?.stats?.likeCount ?? 0,
        commentCount: previous?.commentCount ?? change.item?.commentCount ?? change.item?.stats?.commentCount ?? 0,
        playCount: previous?.playCount ?? change.item?.playCount ?? change.item?.stats?.playCount ?? 0,
      } : { ...previous, ...(change?.patch || {}) };
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
      updatedAt: Date.now(),
    };
    return {
      ...bundle,
      revision: nextRevision,
      updatedAt: Date.now(),
      body: { ...bundle.body, data: nextData },
    };
  });
  return {
    ok: Boolean(result?.ok),
    repairNeeded: Boolean(result?.repairNeeded),
    handle: resolvedHandle,
  };
}

const helperAnchor = functionRange('handleMusicNotePublicationSingleWrite016').start;
const helpers = `// ${MARKER}\n${[
  syncExploreFeedR2Publication043,
  syncExploreFeedR2Private043,
  syncExploreFeedR2OptionPatch043,
  patchExploreProfileR2Publication043,
].map((fn) => fn.toString()).join('\n\n')}\n\n`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

replaceExactInFunction(
  'handleMusicNotePublicationSingleWrite016',
  'await syncExploreFeedR2Publication012(env, feedItem);',
  'await syncExploreFeedR2Publication043(env, feedItem);',
  'publish feed targeted mutation',
);
replaceExactInFunction(
  'handleMusicNotePublicationSingleWrite016',
  'await patchExploreProfileR2Mutation019(env, authContext.uid, {',
  'await patchExploreProfileR2Publication043(env, authContext.uid, {',
  'publish profile targeted mutation',
);
replaceExactInFunction(
  'handleMusicNotePrivate017',
  'syncExploreFeedR2Private017(env, row.id),',
  'syncExploreFeedR2Private043(env, row.id),',
  'private feed targeted mutation',
);
replaceExactInFunction(
  'handleMusicNotePrivate017',
  'patchExploreProfileR2Mutation019(env, authContext.uid, { trackId: row.id, remove: true, trackCountDelta: -1 })',
  'patchExploreProfileR2Publication043(env, authContext.uid, { trackId: row.id, remove: true, trackCountDelta: -1 })',
  'private profile targeted mutation',
);
replaceExactInFunction(
  'handleMusicNotePublicationOptions017',
  'syncExploreFeedR2OptionPatch017(env, row.id, {',
  'syncExploreFeedR2OptionPatch043(env, row.id, {',
  'options feed targeted mutation',
);
replaceExactInFunction(
  'handleMusicNotePublicationOptions017',
  'patchExploreProfileR2Mutation019(env, authContext.uid, {',
  'patchExploreProfileR2Publication043(env, authContext.uid, {',
  'options profile targeted mutation',
);

for (const name of [
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreProfileR2Publication043',
]) {
  const text = functionRange(name).text;
  if (text.includes('env.DB')) throw new Error(`[043] ${name} must remain D1-free`);
  if (!text.includes('mutateExploreR2Cache052')) throw new Error(`[043] ${name} must use R2 CAS mutation`);
}

for (const [name, forbidden] of [
  ['handleMusicNotePublicationSingleWrite016', ['syncExploreFeedR2Publication012(env, feedItem)', 'patchExploreProfileR2Mutation019(env, authContext.uid']],
  ['handleMusicNotePrivate017', ['syncExploreFeedR2Private017(env, row.id)', 'patchExploreProfileR2Mutation019(env, authContext.uid']],
  ['handleMusicNotePublicationOptions017', ['syncExploreFeedR2OptionPatch017(env, row.id)', 'patchExploreProfileR2Mutation019(env, authContext.uid']],
]) {
  const text = functionRange(name).text;
  for (const token of forbidden) {
    if (text.includes(token)) throw new Error(`[043] ${name} still uses D1-derived publication helper: ${token}`);
  }
}

writeFileSync(workerPath, source, 'utf8');
console.log('[043] Music Note publish/private/options now patch known R2 snapshots directly without D1-derived re-reads.');
