from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

MARKER = '// SORIDRAW_SOCIAL_SNAPSHOT_075_20260913'
ROOT = Path('.')
like_path = ROOT / 'src/services/exploreLikeService.ts'
social_path = ROOT / 'src/services/exploreSocialService.ts'
snapshot_path = ROOT / 'src/services/exploreSocialSnapshotService.ts'
worker_path = ROOT / 'cloudflare/explore-worker/canonical/preview-worker.js'
worker_hash_path = ROOT / 'cloudflare/explore-worker/canonical/source-sha256.txt'
worker_patch_path = ROOT / 'cloudflare/explore-worker/patches/042-explore-social-snapshot-r2-queue.mjs'
release_patches_path = ROOT / 'cloudflare/explore-worker/release-patches.json'
version_path = ROOT / 'public/app-version.json'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'075 anchor missing: {label}')
    return text.replace(old, new, 1)


snapshot_source = r'''import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_SOCIAL_SNAPSHOT_075_20260913
const EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION = 1;
const EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY = 'explore-social-snapshot';
const EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE = 'explore_social_snapshot';
const EXPLORE_SOCIAL_SNAPSHOT_PATH = '/v1/me/social-snapshot';

export type ExploreSocialSnapshot = {
  complete: true;
  likedTrackIds: string[];
  followingUids: string[];
  updatedAt: number;
};

const inflightByUid = new Map<string, Promise<ExploreSocialSnapshot>>();

const normalizeList = (value: unknown) => [...new Set(
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean),
)];

const normalizeSnapshot = (value: unknown): ExploreSocialSnapshot | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.likedTrackIds) || !Array.isArray(row.followingUids)) return null;
  return {
    complete: true,
    likedTrackIds: normalizeList(row.likedTrackIds),
    followingUids: normalizeList(row.followingUids),
    updatedAt: Math.max(0, Number(row.updatedAt || 0)),
  };
};

export const readExploreSocialSnapshotCache = (uid: string): ExploreSocialSnapshot | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const envelope = readSoridrawPersistentCache<ExploreSocialSnapshot>({
    cacheKey: EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    uid: normalizedUid,
  });
  return normalizeSnapshot(envelope?.data);
};

const writeExploreSocialSnapshotCache = (uid: string, value: ExploreSocialSnapshot) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  writeSoridrawPersistentCache<ExploreSocialSnapshot>({
    cacheKey: EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    dataVersion: 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: value,
  });
};

export const invalidateExploreSocialSnapshot = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  inflightByUid.delete(normalizedUid);
  removeSoridrawPersistentCache(EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY, normalizedUid);
};

export const rememberExploreSocialLike = (uid: string, trackId: string, liked: boolean) => {
  const current = readExploreSocialSnapshotCache(uid);
  const normalizedTrackId = String(trackId || '').trim();
  if (!current || !normalizedTrackId) return;
  const next = new Set(current.likedTrackIds);
  if (liked) next.add(normalizedTrackId);
  else next.delete(normalizedTrackId);
  writeExploreSocialSnapshotCache(uid, {
    ...current,
    likedTrackIds: [...next],
    updatedAt: Date.now(),
  });
};

export const rememberExploreSocialFollow = (uid: string, targetUid: string, following: boolean) => {
  const current = readExploreSocialSnapshotCache(uid);
  const normalizedTargetUid = String(targetUid || '').trim();
  if (!current || !normalizedTargetUid) return;
  const next = new Set(current.followingUids);
  if (following) next.add(normalizedTargetUid);
  else next.delete(normalizedTargetUid);
  writeExploreSocialSnapshotCache(uid, {
    ...current,
    followingUids: [...next],
    updatedAt: Date.now(),
  });
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) {
    throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

export const getExploreSocialSnapshot = async (user: User): Promise<ExploreSocialSnapshot> => {
  const cached = readExploreSocialSnapshotCache(user.uid);
  if (cached) {
    recordCloudflareLocalCacheHit(EXPLORE_SOCIAL_SNAPSHOT_PATH, 'LOCAL HIT · 개인 소셜 스냅샷');
    return cached;
  }

  const existing = inflightByUid.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    const headers = await buildAuthHeaders(user);
    const response = await fetch(`${EXPLORE_API_BASE}${EXPLORE_SOCIAL_SNAPSHOT_PATH}`, {
      method: 'GET',
      headers: { ...headers, Accept: 'application/json' },
    });
    recordCloudflareResponse(response, EXPLORE_SOCIAL_SNAPSHOT_PATH);
    let payload: any = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      const message = String(payload?.message || payload?.error?.message || payload?.error || '개인 소셜 스냅샷을 불러오지 못했습니다.').trim();
      throw new Error(message || '개인 소셜 스냅샷을 불러오지 못했습니다.');
    }
    const normalized = normalizeSnapshot(payload?.data);
    if (!normalized) throw new Error('개인 소셜 스냅샷 응답을 확인하지 못했습니다.');
    writeExploreSocialSnapshotCache(user.uid, normalized);
    return normalized;
  })().finally(() => {
    if (inflightByUid.get(user.uid) === task) inflightByUid.delete(user.uid);
  });

  inflightByUid.set(user.uid, task);
  return task;
};
'''
snapshot_path.write_text(snapshot_source, encoding='utf-8')

like = like_path.read_text(encoding='utf-8')
if MARKER not in like:
    import_anchor = "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n"
    like = replace_once(
        like,
        import_anchor,
        import_anchor + "import {\n  getExploreSocialSnapshot,\n  invalidateExploreSocialSnapshot,\n  rememberExploreSocialLike,\n} from './exploreSocialSnapshotService';\n",
        'like snapshot import',
    )
    marker_anchor = "// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n"
    like = replace_once(like, marker_anchor, marker_anchor + MARKER + "\n", 'like marker')

    like = replace_once(
        like,
        "  if (missedSignal) cache.clear();\n",
        "  if (missedSignal) {\n    cache.clear();\n    invalidateExploreSocialSnapshot(uid);\n  }\n",
        'like missed-signal invalidation',
    )
    like = replace_once(
        like,
        "    cache.set(result.trackId, result.liked);\n    dispatchLikeSync({\n",
        "    cache.set(result.trackId, result.liked);\n    rememberExploreSocialLike(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n",
        'like signal snapshot patch',
    )

    old_missing = r'''  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    const query = new URLSearchParams({ trackIds: missing.join(',') });
    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
    const likedIds = new Set(
      Array.isArray(payload?.data?.likedTrackIds)
        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
        : [],
    );
    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
    persistLikedStateCache(user.uid, cache);
  }
'''
    new_missing = r'''  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    let resolvedFromSnapshot = false;
    try {
      const snapshot = await getExploreSocialSnapshot(user);
      const likedIds = new Set(snapshot.likedTrackIds);
      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
      persistLikedStateCache(user.uid, cache);
      resolvedFromSnapshot = true;
    } catch (snapshotError) {
      console.warn('[Explore like] social snapshot unavailable; using legacy liked-state recovery.', snapshotError);
    }

    if (!resolvedFromSnapshot) {
      const query = new URLSearchParams({ trackIds: missing.join(',') });
      const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
      const likedIds = new Set(
        Array.isArray(payload?.data?.likedTrackIds)
          ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
          : [],
      );
      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
      persistLikedStateCache(user.uid, cache);
    }
  }
'''
    like = replace_once(like, old_missing, new_missing, 'like getter snapshot path')

    like = replace_once(
        like,
        "  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');\n\n  const outbox = readLikeOutbox(user.uid);\n",
        "  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');\n\n  rememberExploreSocialLike(user.uid, normalizedTrackId, liked);\n  const outbox = readLikeOutbox(user.uid);\n",
        'like optimistic snapshot patch',
    )
like_path.write_text(like, encoding='utf-8')

social = social_path.read_text(encoding='utf-8')
if MARKER not in social:
    import_anchor = "import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';\n"
    social = replace_once(
        social,
        import_anchor,
        import_anchor + "import { getExploreSocialSnapshot, rememberExploreSocialFollow } from './exploreSocialSnapshotService';\n",
        'follow snapshot import',
    )
    marker_anchor = "// SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904\n"
    social = replace_once(social, marker_anchor, marker_anchor + MARKER + "\n", 'follow marker')

    bundle_anchor = "  try {\n    const bundle = await loadExploreFollowingBundle(user);\n"
    snapshot_block = r'''  try {
    const snapshot = await getExploreSocialSnapshot(user);
    const isFollowing = snapshot.followingUids.includes(normalizedUid);
    rememberExploreFollowState(user.uid, normalizedUid, isFollowing);
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL RESOLVE · 개인 소셜 스냅샷');
    return { isFollowing, followerCount: 0, followingCount: 0 };
  } catch (snapshotError) {
    console.warn('[Explore follow] social snapshot unavailable; using legacy following bundle.', snapshotError);
  }

'''
    social = replace_once(social, bundle_anchor, snapshot_block + bundle_anchor, 'follow getter snapshot path')

    target = "  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);\n  return result;\n};\n"
    replacement = "  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);\n  rememberExploreSocialFollow(user.uid, normalizedUid, result.isFollowing);\n  return result;\n};\n"
    # Patch both recovery and mutation result paths. rememberExploreSocialFollow is
    # intentionally a no-op until a complete unified snapshot has been loaded.
    if target not in social:
        raise RuntimeError('075 anchor missing: follow result patch')
    social = social.replace(target, replacement)
social_path.write_text(social, encoding='utf-8')

# Apply the reusable Worker patch to the repository-owned canonical PREVIEW Worker.
tmp_dir = ROOT / '.deploy/.tmp-075-worker'
if tmp_dir.exists():
    shutil.rmtree(tmp_dir)
tmp_dir.mkdir(parents=True)
shutil.copy2(worker_path, tmp_dir / 'worker.js')
env = os.environ.copy()
env['SORIDRAW_REMOTE_WORKER_DIR'] = str(tmp_dir.resolve())
subprocess.run(['node', str(worker_patch_path)], check=True, env=env)
shutil.copy2(tmp_dir / 'worker.js', worker_path)
shutil.rmtree(tmp_dir)

worker_hash = hashlib.sha256(worker_path.read_bytes()).hexdigest()
worker_hash_path.write_text(worker_hash + '\n', encoding='utf-8')

release = json.loads(release_patches_path.read_text(encoding='utf-8'))
patches = list(release.get('patches') or [])
patch_name = worker_patch_path.name
if patch_name not in patches:
    patches.append(patch_name)
release['patches'] = patches
release_patches_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

version_path.write_text('{\n  "version": "075"\n}\n', encoding='utf-8')

print('075 social snapshot + R2 transient like queue applied.')
