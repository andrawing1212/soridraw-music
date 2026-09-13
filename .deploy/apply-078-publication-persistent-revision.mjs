import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/services/explorePublicationService.ts';
let source = readFileSync(path, 'utf8');

const mustReplace = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`[078] missing anchor: ${label}`);
  source = source.replace(before, after);
};

mustReplace(
`import {\n  readSoridrawPersistentCache,\n  removeSoridrawPersistentCache,\n  removeSoridrawPersistentCachesBySourceType,\n  writeSoridrawPersistentCache,\n} from '../lib/soridrawPersistentCache';`,
`import {\n  readSoridrawPersistentCache,\n  writeSoridrawPersistentCache,\n} from '../lib/soridrawPersistentCache';`,
'import cleanup',
);

mustReplace(
`// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913\n// SORIDRAW_PUBLICATION_STATE_SESSION_VALIDATION_076_20260913\n\nconst PUBLICATION_PAGE_SIZE = 50;\nconst MAX_PUBLICATION_PAGES = 8;`,
`// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913\n// SORIDRAW_PUBLICATION_PERSISTENT_REVISION_078_20260913`,
'078 marker',
);

mustReplace(
`type ExplorePublicationItem = {\n  id?: string;\n  trackId?: string;\n  sourceType?: string;\n  sourceId?: string;\n  isPublic?: boolean;\n  allowNextSongApply?: boolean;\n  allowFollowerSave?: boolean;\n  profilePinned?: boolean;\n};\n\n`,
'',
'legacy item type',
);

mustReplace(
`// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990\n// Schema v2 invalidates the 075 cache that could live forever without checking the\n// authoritative R2 publication-state bundle. After the first R2 validation in an\n// app session, page re-entry remains local-only.`,
`// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990\n// Schema v2 is intentionally kept stable across app releases. App updates must not\n// throw away a healthy device snapshot. A tiny R2 revision HEAD validates the\n// persistent snapshot; the full R2 bundle is fetched only on first device use or\n// when that revision actually changed.`,
'cache policy comment',
);

const readFnStart = source.indexOf('const readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {');
const writeFnStart = source.indexOf('const writePublicationStateCache = (', readFnStart);
if (readFnStart < 0 || writeFnStart < 0) throw new Error('[078] cache helper range missing');
const oldReadFn = source.slice(readFnStart, writeFnStart);
const newReadFn = `const readPublicationStateEnvelope = (uid: string) => {\n  const normalizedUid = String(uid || '').trim();\n  if (!normalizedUid) return null;\n  return readSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({\n    cacheKey: PUBLICATION_CACHE_KEY,\n    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,\n    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,\n    uid: normalizedUid,\n  });\n};\n\nconst normalizeCachedPublicationStates = (data: Record<string, ExploreMusicNotePublicationState>) => {\n  const normalized: Record<string, ExploreMusicNotePublicationState> = {};\n  Object.entries(data).forEach(([sourceId, value]) => {\n    const state = value as Partial<ExploreMusicNotePublicationState> | null;\n    const trackId = String(state?.trackId || '').trim();\n    if (!sourceId || !trackId) return;\n    normalized[sourceId] = {\n      status: state?.status === 'public' ? 'public' : 'private',\n      trackId,\n      allowNextSongApply: Boolean(state?.allowNextSongApply),\n      allowFollowerSave: Boolean(state?.allowFollowerSave),\n      profilePinned: Boolean(state?.profilePinned),\n    };\n  });\n  return normalized;\n};\n\nconst readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {\n  const normalizedUid = String(uid || '').trim();\n  if (!normalizedUid) return null;\n  const memory = publicationMemoryCache.get(normalizedUid);\n  if (memory) return clonePublicationStates(memory);\n\n  const envelope = readPublicationStateEnvelope(normalizedUid);\n  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return null;\n  const normalized = normalizeCachedPublicationStates(envelope.data);\n  publicationMemoryCache.set(normalizedUid, normalized);\n  return clonePublicationStates(normalized);\n};\n\n`;
source = source.slice(0, readFnStart) + newReadFn + source.slice(writeFnStart);

const writeStart = source.indexOf('const writePublicationStateCache = (');
const patchSourceStart = source.indexOf('const patchPublicationStateBySourceId = (', writeStart);
if (writeStart < 0 || patchSourceStart < 0) throw new Error('[078] write cache range missing');
const newWriteFn = `const writePublicationStateCache = (\n  uid: string,\n  states: Record<string, ExploreMusicNotePublicationState>,\n  serverRevision?: string | null,\n) => {\n  const normalizedUid = String(uid || '').trim();\n  if (!normalizedUid) return;\n  const existingEnvelope = readPublicationStateEnvelope(normalizedUid);\n  const cloned = clonePublicationStates(states);\n  publicationMemoryCache.set(normalizedUid, cloned);\n  writeSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({\n    cacheKey: PUBLICATION_CACHE_KEY,\n    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,\n    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,\n    dataVersion: 0,\n    uid: normalizedUid,\n    syncCursor: null,\n    serverRevision: serverRevision === undefined\n      ? (existingEnvelope?.serverRevision ?? null)\n      : serverRevision,\n    deletedIds: [],\n    expiresAt: null,\n    dirty: false,\n    pendingMutationId: null,\n    data: cloned,\n  });\n};\n\n`;
source = source.slice(0, writeStart) + newWriteFn + source.slice(patchSourceStart);

mustReplace(
`export const clearExplorePublicationSessionCache = (uid?: string | null) => {\n  const normalizedUid = String(uid || '').trim();\n  if (normalizedUid) {\n    publicationMemoryCache.delete(normalizedUid);\n    publicationInflight.delete(normalizedUid);\n    publicationServerValidatedUids.delete(normalizedUid);\n    removeSoridrawPersistentCache(PUBLICATION_CACHE_KEY, normalizedUid);\n    return;\n  }\n  publicationMemoryCache.clear();\n  publicationInflight.clear();\n  publicationServerValidatedUids.clear();\n  removeSoridrawPersistentCachesBySourceType(PUBLICATION_CACHE_SOURCE_TYPE);\n};`,
`export const clearExplorePublicationSessionCache = (uid?: string | null) => {\n  const normalizedUid = String(uid || '').trim();\n  if (normalizedUid) {\n    publicationMemoryCache.delete(normalizedUid);\n    publicationInflight.delete(normalizedUid);\n    publicationServerValidatedUids.delete(normalizedUid);\n    return;\n  }\n  publicationMemoryCache.clear();\n  publicationInflight.clear();\n  publicationServerValidatedUids.clear();\n};`,
'persistent cache protection',
);

const normalizeItemStart = source.indexOf('const normalizePublicationItem = (item: any): ExplorePublicationItem => ({');
const normalizeOptionsStart = source.indexOf('const normalizePublicationOptions = (', normalizeItemStart);
if (normalizeItemStart < 0 || normalizeOptionsStart < 0) throw new Error('[078] legacy normalizer range missing');
source = source.slice(0, normalizeItemStart) + source.slice(normalizeOptionsStart);

const getterStart = source.indexOf('// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965');
const stateGetterStart = source.indexOf('export const getExploreMusicNotePublicationState = async (', getterStart);
if (getterStart < 0 || stateGetterStart < 0) throw new Error('[078] publication getter range missing');
const newGetter = `// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965\nexport const getExploreMusicNotePublicationStates = async (\n  user: User,\n): Promise<Record<string, ExploreMusicNotePublicationState>> => {\n  const uid = String(user.uid || '').trim();\n  const cached = readPublicationStateCache(uid);\n  const envelope = readPublicationStateEnvelope(uid);\n  if (cached && publicationServerValidatedUids.has(uid)) return cached;\n\n  const inFlight = publicationInflight.get(uid);\n  if (inFlight) return inFlight;\n\n  const task = (async () => {\n    let knownRevision = '';\n\n    // Warm device: validate only the tiny R2 object HEAD. This route is D1 R0/W0.\n    // A network/R2 outage never discards a valid device snapshot.\n    if (cached) {\n      try {\n        const revisionPayload = await requestExplore(user, '/v1/me/music-note-publications-revision');\n        const revisionData = revisionPayload?.data || {};\n        knownRevision = String(revisionData?.revision || '').trim();\n        const exists = Boolean(revisionData?.exists);\n        const remoteUpdatedAt = Math.max(0, Number(revisionData?.updatedAt || 0));\n        const localRevision = String(envelope?.serverRevision || '').trim();\n        const localSyncedAt = Math.max(0, Number(envelope?.syncedAt || 0));\n\n        if (!exists) {\n          publicationServerValidatedUids.add(uid);\n          return clonePublicationStates(cached);\n        }\n        if (knownRevision && localRevision && knownRevision === localRevision) {\n          publicationServerValidatedUids.add(uid);\n          return clonePublicationStates(cached);\n        }\n        // Upgrade a healthy 076 cache without downloading the whole state bundle.\n        // If the R2 object has not changed since this device snapshot was written,\n        // the cached data is already current; simply attach the current revision.\n        if (knownRevision && !localRevision && remoteUpdatedAt > 0 && localSyncedAt >= remoteUpdatedAt) {\n          writePublicationStateCache(uid, cached, knownRevision);\n          publicationServerValidatedUids.add(uid);\n          return clonePublicationStates(cached);\n        }\n      } catch (revisionError) {\n        console.warn('[Explore publication] revision validation unavailable; using persistent snapshot.', revisionError);\n        publicationServerValidatedUids.add(uid);\n        return clonePublicationStates(cached);\n      }\n    }\n\n    // Cold device, or a warm device whose revision actually changed: one R2 snapshot.\n    // There is intentionally no paginated D1 fallback on the client.\n    const payload = await requestExplore(user, '/v1/me/music-note-publications-bundle');\n    const bundledStates = parseMusicNotePublicationBundle(payload?.data);\n    if (!bundledStates) {\n      if (cached) {\n        publicationServerValidatedUids.add(uid);\n        return clonePublicationStates(cached);\n      }\n      throw new ExploreApiError(\n        'MUSIC_NOTE_PUBLICATION_BUNDLE_INVALID',\n        '뮤직노트 공개상태 번들을 확인하지 못했습니다.',\n      );\n    }\n    const bundleRevision = String(payload?.data?.revision || knownRevision || '').trim() || null;\n    writePublicationStateCache(uid, bundledStates, bundleRevision);\n    publicationServerValidatedUids.add(uid);\n    return clonePublicationStates(bundledStates);\n  })().finally(() => {\n    publicationInflight.delete(uid);\n  });\n\n  publicationInflight.set(uid, task);\n  return task;\n};\n\n`;
source = source.slice(0, getterStart) + newGetter + source.slice(stateGetterStart);

if (source.includes('PUBLICATION_PAGE_SIZE') || source.includes('MAX_PUBLICATION_PAGES') || source.includes('/v1/me/publications?')) {
  throw new Error('[078] owner-wide publication fallback still present');
}
if (!source.includes('SORIDRAW_PUBLICATION_PERSISTENT_REVISION_078_20260913')) throw new Error('[078] marker missing');
if (!source.includes('/v1/me/music-note-publications-revision')) throw new Error('[078] revision route missing');

writeFileSync(path, source, 'utf8');
console.log('[078] publication persistent revision patch applied');
