import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_CACHE_FIRST_MUTATION_023_20260907';
if (source.includes(marker)) {
  console.log('[023] publication cache-first mutation patch already applied.');
  process.exit(0);
}

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'handleMusicNotePublicationOptions017',
  'handlePublicationOptions017',
  'handleMusicNotePrivate017',
  'handleVisibility017',
  'applyPublicationVisibilityTransition021',
  'publicationRepublishSemanticUnchanged022',
  'patchExploreProfileR2Mutation019',
  'validExploreProfileR2Bundle020',
  'readExploreR2Json',
  'exploreProfileR2Key',
]) {
  if (!source.includes(required)) throw new Error(`[023] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[023] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[023] function body missing: ${name}`);
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
  throw new Error(`[023] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const transformFunction = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[023] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

async function applyPublicationVisibilityTransition023(env, uid, trackId, isPublic, publishedAt, now, currentStatus) {
  if (isPublic) {
    if (String(currentStatus || '') === 'published') {
      await env.DB.prepare(`
        UPDATE tracks
        SET is_public = 1, updated_at = ?
        WHERE id = ? AND owner_uid = ? AND is_public <> 1
      `).bind(now, trackId, uid).run();
      return;
    }
    await env.DB.prepare(`
      UPDATE tracks
      SET is_public = 1, status = 'published', published_at = ?, updated_at = ?
      WHERE id = ? AND owner_uid = ? AND (is_public <> 1 OR status <> 'published')
    `).bind(publishedAt, now, trackId, uid).run();
    return;
  }
  await env.DB.prepare(`
    UPDATE tracks
    SET is_public = 0, updated_at = ?
    WHERE id = ? AND owner_uid = ? AND is_public <> 0
  `).bind(now, trackId, uid).run();
}

async function publicationResolveProfileHandle023(env, uid, preferredHandle) {
  const preferred = String(preferredHandle || '').trim().replace(/^@+/, '');
  if (preferred) return preferred;
  try {
    const row = await env.DB.prepare(`
      SELECT handle
      FROM public_profiles
      WHERE uid = ?
      LIMIT 1
    `).bind(uid).first();
    return String(row?.handle || '').trim().replace(/^@+/, '');
  } catch {
    return '';
  }
}

async function patchExploreProfileR2Mutation023(env, uid, change) {
  try {
    const normalizedUid = String(uid || '').trim();
    const trackId = String(change?.trackId || '').trim();
    if (!normalizedUid || !trackId) return { ok: false, skipped: true, handle: '' };

    // Mutation paths already know the canonical UID. Going through the handle-alias
    // resolver here added one R2 read and one repair-style alias write on every track
    // mutation even though the handle never changes. Read/write the UID bundle only.
    const bundle = await readExploreR2Json(env, exploreProfileR2Key(normalizedUid));
    if (!validExploreProfileR2Bundle020(bundle)) {
      console.warn('[SORIDRAW 023] canonical profile R2 bundle missing; bounded repair remains deferred to profile access.');
      return { ok: false, repairNeeded: true, handle: '' };
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
    console.warn('[SORIDRAW 023] profile R2 delta skipped:', String(error?.message || error || 'unknown'));
    return { ok: false, repairNeeded: true, handle: '' };
  }
}

async function handleMusicNotePublicationOptions023(request, env, cors, authContext, body, row) {
  const options = normalizePublicationOptions(body);
  if (!hasPublicationOptionChanges(options)) {
    throwApi('PUBLICATION_OPTIONS_REQUIRED', '변경할 공개 옵션이 필요합니다.', 400);
  }
  const next = {
    allowNextSongApply: publicationBool016(options.allowNextSongApply, Number(row.allow_next_song_apply || 0) === 1),
    allowFollowerSave: publicationBool016(options.allowFollowerSave, Number(row.allow_follower_save || 0) === 1),
    profilePinned: publicationBool016(options.profilePinned, Number(row.profile_pinned || 0) === 1)
  };
  const changed = Number(row.allow_next_song_apply || 0) !== next.allowNextSongApply
    || Number(row.allow_follower_save || 0) !== next.allowFollowerSave
    || Number(row.profile_pinned || 0) !== next.profilePinned;

  if (!changed) {
    return json({ ok: true, data: {
      trackId: row.id,
      allowNextSongApply: next.allowNextSongApply === 1,
      allowFollowerSave: next.allowFollowerSave === 1,
      profilePinned: next.profilePinned === 1,
      mutation: 'idempotent'
    } }, 200, cors);
  }

  const now = Date.now();
  await env.DB.prepare(`
    UPDATE tracks
    SET allow_next_song_apply = ?, allow_follower_save = ?, profile_pinned = ?, updated_at = ?
    WHERE id = ? AND owner_uid = ?
  `).bind(
    next.allowNextSongApply,
    next.allowFollowerSave,
    next.profilePinned,
    now,
    row.id,
    authContext.uid
  ).run();

  const derived = await Promise.allSettled([
    syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: Number(row.is_public || 0) === 1 ? 'public' : 'private',
      trackId: row.id,
      allowNextSongApply: next.allowNextSongApply === 1,
      allowFollowerSave: next.allowFollowerSave === 1,
      profilePinned: next.profilePinned === 1
    }),
    syncExploreFeedR2OptionPatch017(env, row.id, {
      allowNextSongApply: next.allowNextSongApply === 1,
      allowFollowerSave: next.allowFollowerSave === 1,
      profilePinned: next.profilePinned === 1
    }),
    patchExploreProfileR2Mutation019(env, authContext.uid, {
      trackId: row.id,
      remove: false,
      trackCountDelta: 0,
      patch: {
        allowNextSongApply: next.allowNextSongApply === 1,
        allowFollowerSave: next.allowFollowerSave === 1,
        profilePinned: next.profilePinned === 1
      }
    })
  ]);
  const profileMutation = derived[2]?.status === 'fulfilled' ? derived[2].value : null;
  const handle = await publicationResolveProfileHandle023(env, authContext.uid, profileMutation?.handle || '');
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, handle);

  return json({ ok: true, data: {
    trackId: row.id,
    allowNextSongApply: next.allowNextSongApply === 1,
    allowFollowerSave: next.allowFollowerSave === 1,
    profilePinned: next.profilePinned === 1,
    mutation: 'written'
  } }, 200, cors);
}

async function handlePublicationOptions023(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 2048);
  const row = await env.DB.prepare(`
    SELECT id, owner_uid, source_type, source_id, is_public, status,
      allow_next_song_apply, allow_follower_save, profile_pinned
    FROM tracks
    WHERE id = ? AND owner_uid = ?
    LIMIT 1
  `).bind(trackId, authContext.uid).first();
  if (!row) throwApi('NOT_FOUND', '곡을 찾을 수 없습니다.', 404);
  if (String(row.source_type || '') !== 'music_note') {
    return await handlePublicationOptionsR2CoreLegacy017(request, env, cors, trackId);
  }
  return await handleMusicNotePublicationOptions017(request, env, cors, authContext, body, row);
}

async function handleMusicNotePrivate023(request, env, cors, authContext, row) {
  const changed = Number(row.is_public || 0) !== 0;
  if (!changed) {
    return json({ ok: true, data: { trackId: row.id, isPublic: false, mutation: 'idempotent' } }, 200, cors);
  }

  const now = Date.now();
  await applyPublicationVisibilityTransition021(
    env,
    authContext.uid,
    row.id,
    false,
    null,
    now,
    row.status
  );

  const derived = await Promise.allSettled([
    syncExploreFeedR2Private017(env, row.id),
    syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: 'private',
      trackId: row.id,
      allowNextSongApply: Number(row.allow_next_song_apply || 0) === 1,
      allowFollowerSave: Number(row.allow_follower_save || 0) === 1,
      profilePinned: Number(row.profile_pinned || 0) === 1
    }),
    patchExploreProfileR2Mutation019(env, authContext.uid, {
      trackId: row.id,
      remove: true,
      trackCountDelta: -1
    })
  ]);
  const profileMutation = derived[2]?.status === 'fulfilled' ? derived[2].value : null;
  const handle = await publicationResolveProfileHandle023(env, authContext.uid, profileMutation?.handle || '');
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, handle);

  return json({ ok: true, data: { trackId: row.id, isPublic: false, mutation: 'written' } }, 200, cors);
}

async function handleVisibility023(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 2048);
  if (typeof body.isPublic !== 'boolean') throwApi('VISIBILITY_REQUIRED', '공개 여부 값이 필요합니다.', 400);
  const row = await env.DB.prepare(`
    SELECT id, owner_uid, source_type, source_id, is_public, status,
      allow_next_song_apply, allow_follower_save, profile_pinned
    FROM tracks
    WHERE id = ? AND owner_uid = ?
    LIMIT 1
  `).bind(trackId, authContext.uid).first();
  if (!row) throwApi('NOT_FOUND', '곡을 찾을 수 없습니다.', 404);
  if (String(row.source_type || '') !== 'music_note' || body.isPublic === true) {
    return await handleVisibilityR2CoreLegacy017(request, env, cors, trackId);
  }
  return await handleMusicNotePrivate017(request, env, cors, authContext, row);
}

const helperAnchor = functionRange('applyPublicationVisibilityTransition021').start;
source = source.slice(0, helperAnchor)
  + `// ${marker}\n${publicationResolveProfileHandle023.toString()}\n\n`
  + source.slice(helperAnchor);

replaceFunction(
  'applyPublicationVisibilityTransition021',
  applyPublicationVisibilityTransition023.toString().replace('applyPublicationVisibilityTransition023', 'applyPublicationVisibilityTransition021')
);
replaceFunction(
  'patchExploreProfileR2Mutation019',
  patchExploreProfileR2Mutation023.toString().replace('patchExploreProfileR2Mutation023', 'patchExploreProfileR2Mutation019')
);
replaceFunction(
  'handleMusicNotePublicationOptions017',
  handleMusicNotePublicationOptions023.toString().replace('handleMusicNotePublicationOptions023', 'handleMusicNotePublicationOptions017')
);
replaceFunction(
  'handlePublicationOptions017',
  handlePublicationOptions023.toString().replace('handlePublicationOptions023', 'handlePublicationOptions017')
);
replaceFunction(
  'handleMusicNotePrivate017',
  handleMusicNotePrivate023.toString().replace('handleMusicNotePrivate023', 'handleMusicNotePrivate017')
);
replaceFunction(
  'handleVisibility017',
  handleVisibility023.toString().replace('handleVisibility023', 'handleVisibility017')
);

transformFunction('handleMusicNotePublicationSingleWrite016', (text) => {
  const next = text.replace(
    /const publishedAt\s*=\s*wasPublic\s*&&\s*Number\(previous\?\.published_at\s*\|\|\s*0\)\s*>\s*0\s*\?\s*Number\(previous\.published_at\)\s*:\s*now;/,
    'const publishedAt = Number(previous?.published_at || 0) > 0 ? Number(previous.published_at) : now;'
  );
  if (next === text) throw new Error('[023] publishedAt anchor not found');
  return next;
});

const transition = functionRange('applyPublicationVisibilityTransition021').text;
if (!transition.includes('SET is_public = 1, updated_at = ?')) throw new Error('[023] republish transition still rewrites published_at');
if (!transition.includes('AND is_public <> 1')) throw new Error('[023] public DB idempotency guard missing');
if (!transition.includes('AND is_public <> 0')) throw new Error('[023] private DB idempotency guard missing');

const profilePatch = functionRange('patchExploreProfileR2Mutation019').text;
if (!profilePatch.includes('readExploreR2Json(env, exploreProfileR2Key(normalizedUid))')) throw new Error('[023] profile mutation does not use canonical UID fast read');
if (profilePatch.includes('readExploreProfileCanonicalR2Bundle020')) throw new Error('[023] alias-first profile read still active on mutation');
if (profilePatch.includes('writeExploreProfileAlias020')) throw new Error('[023] unchanged handle alias still rewritten on mutation');

const privateHandler = functionRange('handleMusicNotePrivate017').text;
if (!privateHandler.includes("mutation: 'idempotent'")) throw new Error('[023] private idempotent early return missing');
if (!privateHandler.includes('Promise.allSettled')) throw new Error('[023] private derived cache work not parallelized');

const optionHandler = functionRange('handleMusicNotePublicationOptions017').text;
if (!optionHandler.includes("mutation: 'idempotent'")) throw new Error('[023] option idempotent early return missing');
if (!optionHandler.includes('Promise.allSettled')) throw new Error('[023] option derived cache work not parallelized');

for (const name of ['handleVisibility017', 'handlePublicationOptions017']) {
  const fn = functionRange(name).text;
  if (fn.includes('LEFT JOIN public_profiles')) throw new Error(`[023] ${name} still reads public_profiles on hot mutation path`);
  if (fn.includes('profile_handle')) throw new Error(`[023] ${name} still selects profile handle from D1`);
}

const publish = functionRange('handleMusicNotePublicationSingleWrite016').text;
if (!publish.includes('const publishedAt = Number(previous?.published_at || 0) > 0')) throw new Error('[023] stable republish timestamp missing');

writeFileSync(workerPath, source, 'utf8');
console.log('[023] Public/private mutations now keep a stable publish timestamp, avoid alias R2 churn, skip hot-path profile joins, and short-circuit idempotent derived work.');
