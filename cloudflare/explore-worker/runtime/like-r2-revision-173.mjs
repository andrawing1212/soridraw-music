// SORIDRAW_LIKE_R2_REVISION_SAFE_173_20260922
// Source-only runtime helper for the dormant D1-only like route.
// No D1 access is allowed here. All writes are bounded shared-R2 CAS mutations.

export const LIKE_R2_MAX_RETRIES_173 = 8;
export const LIKE_R2_PERSONAL_PROTOCOL_173 = 'd1only171';

const clean = (value) => String(value || '').trim();
const safeInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

function normalizeCount173(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
}

function itemId173(item) {
  return clean(item?.id || item?.trackId);
}

function countFromItem173(item) {
  return normalizeCount173(item?.likeCount ?? item?.like_count ?? item?.stats?.likeCount ?? item?.stats?.like_count ?? 0);
}

function generationFromItem173(item) {
  const raw = item?.likeGeneration171;
  return safeInt(raw);
}

function patchItem173(item, likeCount, generation) {
  return {
    ...item,
    likeCount,
    likeGeneration171: generation,
    ...(item?.stats && typeof item.stats === 'object'
      ? { stats: { ...item.stats, likeCount } }
      : {}),
  };
}

export function applyGenerationGuard173(item, likeCountInput, generationInput) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid-item' };
  }
  const likeCount = normalizeCount173(likeCountInput);
  const generation = safeInt(generationInput);
  if (likeCount === null || generation === null) {
    return { ok: false, reason: 'invalid-generation-input' };
  }
  const storedGeneration = generationFromItem173(item);
  const storedCount = countFromItem173(item);
  if (storedCount === null) return { ok: false, reason: 'invalid-stored-count' };

  // Legacy items have no generation marker. The first 173 writer may establish
  // generation 0 without treating a stale pre-cutover count as a conflict.
  if (storedGeneration === null) {
    return { ok: true, changed: storedCount !== likeCount || item.likeGeneration171 !== generation,
      item: patchItem173(item, likeCount, generation), initialized: true };
  }
  if (generation < storedGeneration) {
    return { ok: true, changed: false, skippedOlder: true, item };
  }
  if (generation === storedGeneration) {
    if (storedCount !== likeCount) {
      return { ok: false, conflict: true, reason: 'same-generation-count-conflict' };
    }
    return { ok: true, changed: false, duplicate: true, item };
  }
  return { ok: true, changed: true, item: patchItem173(item, likeCount, generation) };
}

function normalizeRevisionEntry173(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const revision = safeInt(entry.revision);
  if (revision === null || typeof entry.liked !== 'boolean') return null;
  return {
    revision,
    liked: entry.liked,
    operationId: clean(entry.operationId),
  };
}

export function applyPersonalLikeRevision173(bundleInput, update) {
  const uid = clean(update?.uid);
  const trackId = clean(update?.trackId);
  const revision = safeInt(update?.revision);
  const operationId = clean(update?.operationId);
  const liked = update?.liked;
  if (!uid || !trackId || revision === null || typeof liked !== 'boolean' || !operationId || operationId.length > 128) {
    return { ok: false, reason: 'invalid-personal-update' };
  }

  const bundle = bundleInput && typeof bundleInput === 'object' && !Array.isArray(bundleInput)
    ? bundleInput : { schemaVersion: 1, uid, likedTrackIds: [] };
  if (Number(bundle.schemaVersion || 0) !== 1 || clean(bundle.uid || uid) !== uid ||
      !Array.isArray(bundle.likedTrackIds)) {
    return { ok: false, reason: 'invalid-personal-bundle' };
  }

  const revisionMap = bundle.likeRevisionByTrack171 && typeof bundle.likeRevisionByTrack171 === 'object' &&
    !Array.isArray(bundle.likeRevisionByTrack171)
    ? { ...bundle.likeRevisionByTrack171 } : {};
  const stored = normalizeRevisionEntry173(revisionMap[trackId]);
  if (stored) {
    if (revision < stored.revision) {
      return { ok: true, changed: false, skippedOlder: true, bundle };
    }
    if (revision === stored.revision) {
      if (stored.liked !== liked || (stored.operationId && stored.operationId !== operationId)) {
        return { ok: false, conflict: true, reason: 'same-revision-personal-conflict' };
      }
      return { ok: true, changed: false, duplicate: true, bundle };
    }
  }

  // Never slice/truncate the legacy list. Preserve every entry already present,
  // then merge only this UID/track state.
  const likedIds = new Set(bundle.likedTrackIds.map(clean).filter(Boolean));
  if (liked) likedIds.add(trackId);
  else likedIds.delete(trackId);
  revisionMap[trackId] = { revision, operationId, liked };

  const next = {
    ...bundle,
    schemaVersion: 1,
    uid,
    updatedAt: Date.now(),
    likedTrackIds: [...likedIds],
    likeRevisionByTrack171: revisionMap,
    revisionProtocol173: LIKE_R2_PERSONAL_PROTOCOL_173,
  };
  if (bundle.canonicalComplete156 === true) {
    next.exactLikeCount156 = likedIds.size;
  }
  return { ok: true, changed: true, bundle: next, initialized: !stored };
}

async function readJsonObject173(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return { object: null, value: null };
  let value = null;
  try { value = JSON.parse(await object.text()); }
  catch { return { object, value: null, invalid: true }; }
  return { object, value };
}

async function casJson173(bucket, key, mutate, { allowCreate = false, metadata = {} } = {}) {
  for (let attempt = 0; attempt < LIKE_R2_MAX_RETRIES_173; attempt += 1) {
    const read = await readJsonObject173(bucket, key);
    if (read.invalid) return { ok: false, reason: 'invalid-json', key };
    if (!read.object && !allowCreate) return { ok: false, reason: 'missing-object', key };
    const next = await mutate(read.value, read.object);
    if (!next?.ok) return { ...next, key };
    if (!next.changed) return { ...next, key };
    const now = Date.now();
    const saved = await bucket.put(key, JSON.stringify(next.value), {
      onlyIf: read.object?.etag
        ? { etagMatches: read.object.etag }
        : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: {
        ...(read.object?.customMetadata || {}),
        ...metadata,
        revisionSafe173: '1',
        updatedAt: String(now),
      },
    });
    if (saved) return { ...next, ok: true, changed: true, key, attempts: attempt + 1 };
  }
  return { ok: false, reason: 'contention', key };
}

function normalizeTrackBundle173(value, trackId) {
  if (!value || Number(value.schemaVersion || 0) !== 1 || clean(value.trackId) !== trackId ||
      !value.card || itemId173(value.card) !== trackId) return null;
  return value;
}

async function patchTrackCard173(bucket, key, update) {
  let ownerUid = '';
  const result = await casJson173(bucket, key, (value) => {
    const bundle = normalizeTrackBundle173(value, update.trackId);
    if (!bundle) return { ok: false, reason: 'invalid-track-card' };
    ownerUid = clean(bundle.card?.ownerUid || bundle.card?.owner_uid);
    const guarded = applyGenerationGuard173(bundle.card, update.likeCount, update.generation);
    if (!guarded.ok || !guarded.changed) return { ...guarded, value: bundle, ownerUid };
    return {
      ok: true,
      changed: true,
      ownerUid,
      value: { ...bundle, updatedAt: Date.now(), likeGeneration171: update.generation, card: guarded.item },
    };
  }, { metadata: { likePublication173: 'track-card' } });
  return { ...result, ownerUid: result.ownerUid || ownerUid };
}

async function patchSharedFeed173(bucket, key, sort, update, sortItems, feedLimit) {
  return await casJson173(bucket, key, (bundle) => {
    const data = bundle?.payload?.data;
    if (!data || !Array.isArray(data.items)) return { ok: false, reason: 'invalid-feed' };
    const index = data.items.findIndex((item) => itemId173(item) === update.trackId);
    if (index < 0) return { ok: true, changed: false, absent: true, value: bundle };
    const guarded = applyGenerationGuard173(data.items[index], update.likeCount, update.generation);
    if (!guarded.ok || !guarded.changed) return { ...guarded, value: bundle };
    const items = [...data.items];
    items[index] = guarded.item;
    // Popular policy: reorder only the already-cached first-page window.
    // Never query D1 or pull an outside candidate merely because one like changed.
    const ordered = sort === 'popular' && typeof sortItems === 'function'
      ? sortItems(items, 'popular').slice(0, feedLimit)
      : items;
    return {
      ok: true,
      changed: true,
      value: {
        ...bundle,
        updatedAt: Date.now(),
        payload: { ...bundle.payload, data: { ...data, items: ordered } },
      },
    };
  }, { metadata: { likePublication173: 'feed-' + sort } });
}

async function patchSharedProfile173(bucket, key, update) {
  return await casJson173(bucket, key, (bundle) => {
    const items = bundle?.body?.data?.items;
    if (!Array.isArray(items)) return { ok: false, reason: 'invalid-profile' };
    const index = items.findIndex((item) => itemId173(item) === update.trackId);
    if (index < 0) return { ok: true, changed: false, absent: true, value: bundle };
    const guarded = applyGenerationGuard173(items[index], update.likeCount, update.generation);
    if (!guarded.ok || !guarded.changed) return { ...guarded, value: bundle };
    const nextItems = [...items];
    nextItems[index] = guarded.item;
    return {
      ok: true,
      changed: true,
      value: {
        ...bundle,
        updatedAt: Date.now(),
        body: { ...bundle.body, data: { ...bundle.body.data, items: nextItems } },
      },
    };
  }, { metadata: { likePublication173: 'profile' } });
}

async function patchPersonal173(bucket, key, update) {
  return await casJson173(bucket, key, (bundle) => {
    const merged = applyPersonalLikeRevision173(bundle, update);
    if (!merged.ok) return merged;
    return { ...merged, value: merged.bundle };
  }, { allowCreate: true, metadata: { likePublication173: 'personal' } });
}

export function createLikeR2RevisionPublisher173(env, options = {}) {
  const bucket = env?.PROFILE_MEDIA || null;
  const trackCardKey = options.trackCardKey;
  const feedKey = options.feedKey;
  const profileKey = options.profileKey;
  const sortItems = options.sortItems;
  const feedLimit = Number.isSafeInteger(options.feedLimit) && options.feedLimit > 0 ? options.feedLimit : 40;

  return {
    async publish(updateInput) {
      const update = {
        uid: clean(updateInput?.uid),
        trackId: clean(updateInput?.trackId),
        liked: updateInput?.liked,
        likeCount: normalizeCount173(updateInput?.likeCount),
        revision: safeInt(updateInput?.revision),
        generation: safeInt(updateInput?.generation),
        operationId: clean(updateInput?.operationId),
        status: clean(updateInput?.status),
      };
      if (!bucket || !update.uid || !update.trackId || typeof update.liked !== 'boolean' ||
          update.likeCount === null || update.revision === null || update.generation === null ||
          !update.operationId || typeof trackCardKey !== 'function' || typeof feedKey !== 'function' ||
          typeof profileKey !== 'function') {
        return { ok: false, reason: 'publisher-input-or-binding' };
      }

      const personalKey = `internal/explore/shared-social-v114/likes/${encodeURIComponent(update.uid)}.json`;
      const personal = await patchPersonal173(bucket, personalKey, update);
      if (!personal.ok) return { ok: false, stage: 'personal', personal };

      if (update.status === 'ineligible') {
        return { ok: true, personal, publicSkipped: 'ineligible' };
      }

      const card = await patchTrackCard173(bucket, trackCardKey(update.trackId), update);
      if (!card.ok) return { ok: false, stage: 'track-card', personal, card };
      const ownerUid = clean(card.ownerUid);
      if (!ownerUid) return { ok: false, stage: 'track-card-owner', personal, card };

      const feeds = await Promise.all(['latest', 'popular'].map((sort) =>
        patchSharedFeed173(bucket, feedKey(sort), sort, update, sortItems, feedLimit)));
      if (feeds.some((result) => !result.ok)) {
        return { ok: false, stage: 'feeds', personal, card, feeds };
      }

      let profile = { ok: true, changed: false, absent: true };
      const profileObject = await bucket.get(profileKey(ownerUid));
      if (profileObject) {
        // Re-read through CAS helper so the object used for the conditional write
        // is always current. This preliminary GET only decides whether a cached
        // profile surface exists; absent profiles are not materialized here.
        profile = await patchSharedProfile173(bucket, profileKey(ownerUid), update);
        if (!profile.ok) return { ok: false, stage: 'profile', personal, card, feeds, profile };
      }
      return { ok: true, personal, card, feeds, profile, ownerUid };
    },
  };
}
