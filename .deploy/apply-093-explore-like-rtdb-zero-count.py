from pathlib import Path

MARKER = 'SORIDRAW_EXPLORE_LIKE_RTDB_ZERO_COUNT_093_20260915'


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        print(f'{label}: already applied')
        return
    if old not in text:
        raise SystemExit(f'{label}: expected source not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'{label}: applied')


# -----------------------------------------------------------------------------
# 1) Explore like cross-device signal: Firestore users/{uid} -> existing RTDB
#    userSync channel. D1 remains canonical for likes; RTDB carries only a tiny
#    same-account invalidation/result signal.
# -----------------------------------------------------------------------------
replace_once(
    'src/services/exploreLikeService.ts',
    "import type { User } from 'firebase/auth';\nimport { doc, updateDoc } from '../lib/firestoreMeasured';\nimport { db, getFirebaseAppCheckToken } from '../firebase';",
    "import type { User } from 'firebase/auth';\nimport { ref as databaseRef, set as setRealtimeValue } from 'firebase/database';\nimport { getFirebaseAppCheckToken, realtimeDb } from '../firebase';",
    'Explore like RTDB imports',
)

replace_once(
    'src/services/exploreLikeService.ts',
    '// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n',
    '// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n// SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915\n',
    'Explore like 093 marker',
)

replace_once(
    'src/services/exploreLikeService.ts',
    "  // Mark the origin browser before Firestore's local snapshot fires so it never\n  // replays its own already-applied batch. If the signal write is rejected,\n  // restore the previous marker; the canonical like batch itself remains saved.\n  setSeenAccountSignalVersion(uid, version);\n  observedAccountSignalVersionByUid.set(uid, version);\n  try {\n    await updateDoc(doc(db, 'users', uid), { exploreLikeSyncSignal: signal });\n  } catch (reason) {\n    if (readSeenAccountSignalVersion(uid) === version) setSeenAccountSignalVersion(uid, previousVersion);\n    if ((observedAccountSignalVersionByUid.get(uid) || 0) === version) {\n      observedAccountSignalVersionByUid.set(uid, previousVersion);\n    }\n    console.warn('Explore account like sync signal publish failed:', reason);\n  }",
    "  // 093: Explore likes must never mutate Firestore users/{uid} just to wake a\n  // second device. Reuse the UID-scoped RTDB invalidation channel instead. D1/R2\n  // remain canonical; this retained signal is fixed-size (max 50 results).\n  setSeenAccountSignalVersion(uid, version);\n  observedAccountSignalVersionByUid.set(uid, version);\n  try {\n    await setRealtimeValue(databaseRef(realtimeDb, `userSync/${uid}/exploreLike`), signal);\n  } catch (reason) {\n    if (readSeenAccountSignalVersion(uid) === version) setSeenAccountSignalVersion(uid, previousVersion);\n    if ((observedAccountSignalVersionByUid.get(uid) || 0) === version) {\n      observedAccountSignalVersionByUid.set(uid, previousVersion);\n    }\n    console.warn('Explore account like RTDB sync signal publish failed:', reason);\n  }",
    'Explore like Firestore signal removal',
)

# -----------------------------------------------------------------------------
# 2) Subscribe to the retained Explore-like signal through the existing RTDB
#    user-domain service. No Firestore listener/read is added.
# -----------------------------------------------------------------------------
replace_once(
    'src/services/userDomainSyncService.ts',
    "import { auth, realtimeDb } from '../firebase';\nimport {\n  addV1MutationPostSuccessHook,",
    "import { auth, realtimeDb } from '../firebase';\nimport { observeExploreLikeAccountSyncSignal } from './exploreLikeService';\nimport {\n  addV1MutationPostSuccessHook,",
    'RTDB Explore observer import',
)

replace_once(
    'src/services/userDomainSyncService.ts',
    "let unsubscribeMusicNote: Unsubscribe | null = null;\nlet unsubscribeRecentSongs: Unsubscribe | null = null;",
    "let unsubscribeMusicNote: Unsubscribe | null = null;\nlet unsubscribeRecentSongs: Unsubscribe | null = null;\nlet unsubscribeExploreLike: Unsubscribe | null = null;",
    'RTDB Explore unsubscribe state',
)

replace_once(
    'src/services/userDomainSyncService.ts',
    "  unsubscribeMusicNote?.();\n  unsubscribeRecentSongs?.();\n  unsubscribeMusicNote = null;\n  unsubscribeRecentSongs = null;\n  activeUid = '';",
    "  unsubscribeMusicNote?.();\n  unsubscribeRecentSongs?.();\n  unsubscribeExploreLike?.();\n  unsubscribeMusicNote = null;\n  unsubscribeRecentSongs = null;\n  unsubscribeExploreLike = null;\n  activeUid = '';",
    'RTDB Explore unsubscribe cleanup',
)

replace_once(
    'src/services/userDomainSyncService.ts',
    "  unsubscribeRecentSongs = onValue(ref(realtimeDb, `userSync/${safeUid}/recentSongs`), (snapshot) => {\n    const signal = normalizeSignal(snapshot.val());\n    if (signal) dispatchSignal(safeUid, 'recentSongs', signal);\n  }, (error) => {\n    console.warn('Recent-song RTDB sync signal unavailable; Firestore fallback remains active.', error);\n  });\n};",
    "  unsubscribeRecentSongs = onValue(ref(realtimeDb, `userSync/${safeUid}/recentSongs`), (snapshot) => {\n    const signal = normalizeSignal(snapshot.val());\n    if (signal) dispatchSignal(safeUid, 'recentSongs', signal);\n  }, (error) => {\n    console.warn('Recent-song RTDB sync signal unavailable; Firestore fallback remains active.', error);\n  });\n\n  // SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915\n  unsubscribeExploreLike = onValue(ref(realtimeDb, `userSync/${safeUid}/exploreLike`), (snapshot) => {\n    const currentUser = auth.currentUser;\n    if (!currentUser || currentUser.uid !== safeUid) return;\n    observeExploreLikeAccountSyncSignal(currentUser, snapshot.val());\n  }, (error) => {\n    console.warn('Explore like RTDB sync signal unavailable; R2 social snapshot recovery remains active.', error);\n  });\n};",
    'RTDB Explore subscriber',
)

# -----------------------------------------------------------------------------
# 3) Add bounded same-account RTDB validation. Additive only; no existing path or
#    meaning is removed.
# -----------------------------------------------------------------------------
replace_once(
    'database.rules.json',
    "        \"$other\": {\n          \".validate\": false\n        }\n      }\n    }\n  }\n}",
    "        \"exploreLike\": {\n          \".validate\": \"newData.hasChildren(['version','previousVersion','results'])\",\n          \"version\": {\n            \".validate\": \"newData.isNumber() && newData.val() > 0\"\n          },\n          \"previousVersion\": {\n            \".validate\": \"newData.isNumber() && newData.val() >= 0\"\n          },\n          \"results\": {\n            \".validate\": \"newData.numChildren() <= 50\",\n            \"$index\": {\n              \".validate\": \"newData.hasChildren(['trackId','ownerUid','liked','likeCount'])\",\n              \"trackId\": {\n                \".validate\": \"newData.isString() && newData.val().length > 0 && newData.val().length <= 512\"\n              },\n              \"ownerUid\": {\n                \".validate\": \"newData.isString() && newData.val().length <= 128\"\n              },\n              \"liked\": {\n                \".validate\": \"newData.isBoolean()\"\n              },\n              \"likeCount\": {\n                \".validate\": \"newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000\"\n              },\n              \"displayLikeCount\": {\n                \".validate\": \"newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000\"\n              },\n              \"$other\": {\n                \".validate\": false\n              }\n            }\n          },\n          \"$other\": {\n            \".validate\": false\n          }\n        },\n        \"$other\": {\n          \".validate\": false\n        }\n      }\n    }\n  }\n}",
    'RTDB Explore rules',
)

# -----------------------------------------------------------------------------
# 4) Repair the cold-device contradiction: membership says liked=true but a stale
#    Feed/Profile cache says count=0. Batch only those visible contradictory IDs
#    into the existing /v1/me/liked-tracks route. This is a targeted D1 query, not
#    a Feed scan, not a poll, and never fabricates 0->1.
# -----------------------------------------------------------------------------
replace_once(
    'src/services/exploreLikeDisplayStateService.ts',
    '// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n',
    "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\nimport { auth, getFirebaseAppCheckToken } from '../firebase';\nimport { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\nimport { readSoridrawPersistentCache } from '../lib/soridrawPersistentCache';\n\n// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n// SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915\n",
    'Zero-count recovery imports/marker',
)

helper_block = r'''const ZERO_COUNT_RECOVERY_ROUTE_093 = '/v1/me/liked-tracks';
const ZERO_COUNT_RECOVERY_BATCH_MAX_093 = 50;
const ZERO_COUNT_RECOVERY_COOLDOWN_MS_093 = 12 * 60_000;
const ZERO_COUNT_RECOVERY_FAILURE_COOLDOWN_MS_093 = 60_000;
const ZERO_COUNT_RECOVERY_STORAGE_PREFIX_093 = 'soridraw:explore-like-zero-count-recovery:093:';
const ZERO_COUNT_LIKED_CACHE_KEY_093 = 'explore-liked-state';
const ZERO_COUNT_LIKED_SOURCE_TYPE_093 = 'explore_likes';
const ZERO_COUNT_LIKED_SCHEMA_VERSION_093 = 2;
const zeroCountRecoveryQueueByUid093 = new Map<string, Set<string>>();
const zeroCountRecoveryTimerByUid093 = new Map<string, number>();
const zeroCountRecoveryInflightByUid093 = new Set<string>();
const zeroCountRecoveryFailureUntil093 = new Map<string, number>();

const zeroCountRecoveryStorageKey093 = (uid: string, trackId: string) => (
  `${ZERO_COUNT_RECOVERY_STORAGE_PREFIX_093}${uid}:${trackId}`
);

const readZeroCountRecoveryAttempt093 = (uid: string, trackId: string) => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(zeroCountRecoveryStorageKey093(uid, trackId)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const rememberZeroCountRecoveryAttempt093 = (uid: string, trackId: string, at: number) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(zeroCountRecoveryStorageKey093(uid, trackId), String(at)); } catch {}
};

const isPersistentlyLiked093 = (uid: string, trackId: string) => {
  const envelope = readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: ZERO_COUNT_LIKED_CACHE_KEY_093,
    sourceType: ZERO_COUNT_LIKED_SOURCE_TYPE_093,
    schemaVersion: ZERO_COUNT_LIKED_SCHEMA_VERSION_093,
    uid,
  });
  return Boolean(envelope?.data && typeof envelope.data === 'object' && envelope.data[trackId] === true);
};

const armZeroCountRecovery093 = (uid: string) => {
  if (!uid || typeof window === 'undefined') return;
  if (zeroCountRecoveryTimerByUid093.has(uid) || zeroCountRecoveryInflightByUid093.has(uid)) return;
  const timer = window.setTimeout(() => {
    zeroCountRecoveryTimerByUid093.delete(uid);
    void flushZeroCountRecovery093(uid);
  }, 0);
  zeroCountRecoveryTimerByUid093.set(uid, timer);
};

const queueZeroCountRecovery093 = (uid: string, trackId: string) => {
  if (!uid || !trackId || typeof window === 'undefined') return;
  const now = Date.now();
  const key = `${uid}:${trackId}`;
  if ((zeroCountRecoveryFailureUntil093.get(key) || 0) > now) return;
  const lastAttempt = readZeroCountRecoveryAttempt093(uid, trackId);
  if (lastAttempt > 0 && now - lastAttempt < ZERO_COUNT_RECOVERY_COOLDOWN_MS_093) return;
  let queue = zeroCountRecoveryQueueByUid093.get(uid);
  if (!queue) {
    queue = new Set<string>();
    zeroCountRecoveryQueueByUid093.set(uid, queue);
  }
  queue.add(trackId);
  armZeroCountRecovery093(uid);
};

async function flushZeroCountRecovery093(uid: string): Promise<void> {
  if (!uid || zeroCountRecoveryInflightByUid093.has(uid)) return;
  const queue = zeroCountRecoveryQueueByUid093.get(uid);
  const trackIds = queue ? [...queue].slice(0, ZERO_COUNT_RECOVERY_BATCH_MAX_093) : [];
  if (!trackIds.length) return;
  trackIds.forEach((trackId) => queue?.delete(trackId));
  zeroCountRecoveryInflightByUid093.add(uid);

  try {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) return;
    const [idToken, appCheckToken] = await Promise.all([
      user.getIdToken(),
      getFirebaseAppCheckToken(),
    ]);
    if (!appCheckToken) throw new Error('APP_CHECK_UNAVAILABLE');

    const response = await fetch(`${EXPLORE_API_BASE}${ZERO_COUNT_RECOVERY_ROUTE_093}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'X-Firebase-AppCheck': appCheckToken,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trackIds }),
    });
    recordCloudflareResponse(response, ZERO_COUNT_RECOVERY_ROUTE_093);
    let payload: any = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const canonicalLiked = new Set(
      (Array.isArray(payload?.data?.likedTrackIds) ? payload.data.likedTrackIds : [])
        .map((value: unknown) => String(value || '').trim())
        .filter(Boolean),
    );
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    const itemById = new Map<string, any>(items.map((item: any) => [String(item?.id || '').trim(), item]));
    const now = Date.now();
    const counts = canonicalMap091(uid);
    const states = loadStates091(uid);
    const recovered: Array<{ trackId: string; ownerUid: string; likeCount: number }> = [];

    trackIds.forEach((trackId) => {
      rememberZeroCountRecoveryAttempt093(uid, trackId, now);
      if (!canonicalLiked.has(trackId)) return;
      const item = itemById.get(trackId);
      const nestedStats = item?.stats && typeof item.stats === 'object' ? item.stats : null;
      const likeCount = clampCount091(item?.likeCount ?? nestedStats?.likeCount);
      // Never invent a count from membership. If canonical track_stats is still 0,
      // the existing deferred aggregate/fresh-feed path remains responsible.
      if (likeCount <= 0) return;
      const ownerUid = normalizeUid091(item?.ownerUid ?? item?.owner_uid);
      counts.set(trackId, likeCount);
      states.set(trackId, {
        trackId,
        ownerUid,
        baseLiked: true,
        desiredLiked: true,
        baseLikeCount: likeCount,
        displayLikeCount: likeCount,
        phase: 'accepted',
        updatedAt: now,
        expiresAt: now + DISPLAY_TTL_MS_091,
      });
      recovered.push({ trackId, ownerUid, likeCount });
    });

    if (recovered.length) {
      persistStates091(uid, states);
      if (typeof window !== 'undefined') {
        recovered.forEach(({ trackId, ownerUid, likeCount }) => {
          window.dispatchEvent(new CustomEvent('soridraw:explore-like-sync', {
            detail: { uid, trackId, ownerUid, liked: true, likeCount, displayLikeCount: likeCount },
          }));
        });
      }
    }
  } catch (reason) {
    const retryAfter = Date.now() + ZERO_COUNT_RECOVERY_FAILURE_COOLDOWN_MS_093;
    trackIds.forEach((trackId) => zeroCountRecoveryFailureUntil093.set(`${uid}:${trackId}`, retryAfter));
    console.warn('[Explore like] targeted zero-count recovery unavailable.', reason);
  } finally {
    zeroCountRecoveryInflightByUid093.delete(uid);
    if ((zeroCountRecoveryQueueByUid093.get(uid)?.size || 0) > 0) armZeroCountRecovery093(uid);
  }
}

'''

replace_once(
    'src/services/exploreLikeDisplayStateService.ts',
    'export const getExploreLikeDisplayCount091 = (\n',
    helper_block + 'export const getExploreLikeDisplayCount091 = (\n',
    'Zero-count recovery helper block',
)

replace_once(
    'src/services/exploreLikeDisplayStateService.ts',
    "  const state = states.get(normalizedTrackId);\n  if (state && state.expiresAt > Date.now()) return state.displayLikeCount;\n  if (state) {\n    states.delete(normalizedTrackId);\n    persistStates091(normalizedUid, states);\n  }\n  return getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);",
    "  const state = states.get(normalizedTrackId);\n  if (state && state.expiresAt > Date.now()) {\n    if (state.displayLikeCount === 0 && state.desiredLiked) queueZeroCountRecovery093(normalizedUid, normalizedTrackId);\n    return state.displayLikeCount;\n  }\n  if (state) {\n    states.delete(normalizedTrackId);\n    persistStates091(normalizedUid, states);\n  }\n  const resolved = getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);\n  if (resolved === 0 && isPersistentlyLiked093(normalizedUid, normalizedTrackId)) {\n    queueZeroCountRecovery093(normalizedUid, normalizedTrackId);\n  }\n  return resolved;",
    'Zero-count recovery render gate',
)

replace_once(
    'src/services/exploreLikeDisplayStateService.ts',
    "export const resetExploreLikeDisplayState091ForTests = () => {\n  canonicalCountsByUid091.clear();\n  displayStatesByUid091.clear();\n  loadedUid091.clear();\n};",
    "export const resetExploreLikeDisplayState091ForTests = () => {\n  canonicalCountsByUid091.clear();\n  displayStatesByUid091.clear();\n  loadedUid091.clear();\n  if (typeof window !== 'undefined') {\n    zeroCountRecoveryTimerByUid093.forEach((timer) => window.clearTimeout(timer));\n  }\n  zeroCountRecoveryQueueByUid093.clear();\n  zeroCountRecoveryTimerByUid093.clear();\n  zeroCountRecoveryInflightByUid093.clear();\n  zeroCountRecoveryFailureUntil093.clear();\n};",
    'Zero-count recovery test reset',
)

# -----------------------------------------------------------------------------
# 5) Permanent verifier. Keep this after the one-shot patch workflow is removed.
# -----------------------------------------------------------------------------
verifier = r'''import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const like = read('src/services/exploreLikeService.ts');
const domain = read('src/services/userDomainSyncService.ts');
const display = read('src/services/exploreLikeDisplayStateService.ts');
const rules = read('database.rules.json');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(like.includes('SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915'), '093 like RTDB marker missing');
must(like.includes("setRealtimeValue(databaseRef(realtimeDb, `userSync/${uid}/exploreLike`), signal)"), 'Explore like RTDB publisher missing');
must(!like.includes("updateDoc(doc(db, 'users', uid), { exploreLikeSyncSignal: signal })"), 'Explore like Firestore users write still active');
must(!like.includes("from '../lib/firestoreMeasured'"), 'Explore like service still imports Firestore wrapper');

must(domain.includes('SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915'), 'RTDB subscriber marker missing');
must(domain.includes('userSync/${safeUid}/exploreLike'), 'UID-scoped Explore like RTDB subscriber missing');
must(domain.includes('observeExploreLikeAccountSyncSignal(currentUser, snapshot.val())'), 'Explore like RTDB signal consumer missing');

const parsedRules = JSON.parse(rules);
must(parsedRules?.rules?.userSync?.$uid?.exploreLike, 'Explore like RTDB rules missing');
must(String(parsedRules.rules.userSync.$uid.exploreLike?.results?.['.validate'] || '').includes('<= 50'), 'Explore like RTDB result cap missing');

must(display.includes('SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915'), 'zero-count recovery marker missing');
must(display.includes("ZERO_COUNT_RECOVERY_ROUTE_093 = '/v1/me/liked-tracks'"), 'targeted liked-tracks recovery route missing');
must(display.includes('ZERO_COUNT_RECOVERY_BATCH_MAX_093 = 50'), 'zero-count recovery batch cap missing');
must(display.includes('resolved === 0 && isPersistentlyLiked093'), 'liked+zero contradiction gate missing');
must(display.includes('if (likeCount <= 0) return;'), 'no-fabricated-count guard missing');
must(!/setInterval\s*\(/.test(display), 'polling introduced in display recovery');
must(!/firebase\/firestore|getDocs\(|collection\(/.test(display), 'zero-count recovery must not read Firestore/full collections');

console.log('EXPLORE_LIKE_FIRESTORE_SYNC_WRITE=0_TARGET');
console.log('EXPLORE_LIKE_RTDB_ACCOUNT_SIGNAL=PASS');
console.log('LIKED_ZERO_COUNT_TARGETED_BATCH_RECOVERY=PASS');
console.log('FAKE_ZERO_TO_ONE_FLOOR=ABSENT');
console.log('NO_POLLING_NO_FULLSCAN=PASS');
'''
Path('scripts/verify-093-explore-like-rtdb-zero-count.mjs').write_text(verifier, encoding='utf-8')

# Final source checks before CI.
for path in [
    'src/services/exploreLikeService.ts',
    'src/services/userDomainSyncService.ts',
    'src/services/exploreLikeDisplayStateService.ts',
    'database.rules.json',
    'scripts/verify-093-explore-like-rtdb-zero-count.mjs',
]:
    if not Path(path).exists():
        raise SystemExit(f'missing output: {path}')

print(f'Applied {MARKER}: RTDB Explore like signal + targeted liked-zero count repair; no deploy.')
