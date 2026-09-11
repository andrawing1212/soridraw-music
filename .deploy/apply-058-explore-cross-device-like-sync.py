from pathlib import Path
import subprocess

BASE = 'b5a370f222ad7ef7f3552f87f915c6fc17d9e133'
LIKE = Path('src/services/exploreLikeService.ts')
SESSION = Path('src/services/exploreSessionCache.ts')
APP = Path('src/App.tsx')
EXPLORE = Path('src/pages/ExplorePage.tsx')
RULES = Path('firestore.rules')
VERSION = Path('public/app-version.json')


def git_show(path: str) -> str:
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], text=True)

# 058 v1 reacted to public feed count revisions. That would fan one user's
# personal-state read out to every active device. Restore the public feed cache
# to its 057 behavior before applying the account-scoped signal design.
SESSION.write_text(git_show('src/services/exploreSessionCache.ts'), encoding='utf-8')

# Rebuild the like service from the proven 057 batching baseline, then add one
# small same-account Firestore signal after a real server-confirmed like batch.
like = git_show('src/services/exploreLikeService.ts')
like = like.replace(
    "import type { User } from 'firebase/auth';\nimport { getFirebaseAppCheckToken } from '../firebase';",
    "import type { User } from 'firebase/auth';\nimport { doc, updateDoc } from 'firebase/firestore';\nimport { db, getFirebaseAppCheckToken } from '../firebase';",
    1,
)
like = like.replace(
    '// SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911\n',
    '// SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911\n// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911\n',
    1,
)
like = like.replace(
    "export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';\n",
    "export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';\nexport const EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT = 'soridraw:explore-like-account-invalidation';\nconst EXPLORE_LIKE_ACCOUNT_SIGNAL_VERSION_STORAGE_BASE = 'soridraw_explore_like_account_signal_v1';\n",
    1,
)

account_types_anchor = '''type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
  likeCount: number;
};
'''
account_types = account_types_anchor + '''
type ExploreLikeAccountSyncResult = ExploreLikeBatchResult & {
  ownerUid: string;
};

type ExploreLikeAccountSyncSignal = {
  version: number;
  previousVersion: number;
  results: ExploreLikeAccountSyncResult[];
};
'''
if account_types_anchor not in like:
    raise RuntimeError('058 account signal: batch type anchor missing')
like = like.replace(account_types_anchor, account_types, 1)

map_anchor = '''const likedStateByUid = new Map<string, Map<string, boolean>>();
const pendingTimers = new Map<string, number>();
const inflightByUid = new Map<string, ExploreLikeOutbox>();
'''
map_block = map_anchor + '''const observedAccountSignalVersionByUid = new Map<string, number>();

const getAccountSignalVersionStorageKey = (uid: string) => `${EXPLORE_LIKE_ACCOUNT_SIGNAL_VERSION_STORAGE_BASE}_${uid}`;

const readSeenAccountSignalVersion = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getAccountSignalVersionStorageKey(uid)) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
};

const setSeenAccountSignalVersion = (uid: string, version: number) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    if (Number.isFinite(version) && version > 0) {
      localStorage.setItem(getAccountSignalVersionStorageKey(uid), String(Math.floor(version)));
    } else {
      localStorage.removeItem(getAccountSignalVersionStorageKey(uid));
    }
  } catch {}
};

const normalizeAccountSyncSignal = (value: unknown): ExploreLikeAccountSyncSignal | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const version = Math.max(0, Math.floor(Number(raw.version || 0)));
  const previousVersion = Math.max(0, Math.floor(Number(raw.previousVersion || 0)));
  const rows = Array.isArray(raw.results) ? raw.results : [];
  if (!version || rows.length > EXPLORE_LIKE_BATCH_MAX) return null;
  const results: ExploreLikeAccountSyncResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const trackId = String(item.trackId || '').trim();
    if (!trackId) continue;
    results.push({
      trackId,
      ownerUid: String(item.ownerUid || '').trim(),
      liked: Boolean(item.liked),
      likeCount: clampLikeCount(item.likeCount),
    });
  }
  if (results.length !== rows.length) return null;
  return { version, previousVersion, results };
};
'''
if map_anchor not in like:
    raise RuntimeError('058 account signal: map anchor missing')
like = like.replace(map_anchor, map_block, 1)

# Add the observer after the existing UI event helpers, where cache/event helpers
# are already available. The root App users/{uid} listener calls this function.
dispatch_error_anchor = '''const dispatchLikeSyncError = (detail: ExploreLikeSyncEventDetail & { message: string }) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_SYNC_ERROR_EVENT, { detail }));
};
'''
observer_block = dispatch_error_anchor + '''
export const observeExploreLikeAccountSyncSignal = (user: User, value: unknown) => {
  const signal = normalizeAccountSyncSignal(value);
  if (!signal || !user?.uid) return;
  const uid = user.uid;
  const seenVersion = readSeenAccountSignalVersion(uid);
  observedAccountSignalVersionByUid.set(
    uid,
    Math.max(observedAccountSignalVersionByUid.get(uid) || 0, signal.version),
  );
  if (signal.version <= seenVersion) return;

  // If previousVersion does not match, this browser slept through at least one
  // batch. Clear only this user's personal like-state cache. Explore will
  // rehydrate only currently visible IDs; no public feed/full scan is triggered.
  const missedSignal = signal.previousVersion !== seenVersion;
  const cache = getLikedStateCache(uid);
  if (missedSignal) cache.clear();

  for (const result of signal.results) {
    cache.set(result.trackId, result.liked);
    dispatchLikeSync({
      trackId: result.trackId,
      ownerUid: result.ownerUid,
      liked: result.liked,
      likeCount: result.likeCount,
    });
  }
  persistLikedStateCache(uid, cache);
  setSeenAccountSignalVersion(uid, signal.version);

  if (missedSignal && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
      detail: { uid, version: signal.version },
    }));
  }
};

const publishExploreLikeAccountSyncSignal = async (
  user: User,
  batchEntries: ExploreLikePendingMutation[],
  results: ExploreLikeBatchResult[],
) => {
  if (!user?.uid || !results.length) return;
  const uid = user.uid;
  const previousVersion = Math.max(
    readSeenAccountSignalVersion(uid),
    observedAccountSignalVersionByUid.get(uid) || 0,
  );
  const version = Math.max(Date.now(), previousVersion + 1);
  const ownerByTrack = new Map(batchEntries.map((pending) => [pending.trackId, pending.ownerUid]));
  const signal: ExploreLikeAccountSyncSignal = {
    version,
    previousVersion,
    results: results.map((result) => ({
      ...result,
      ownerUid: ownerByTrack.get(result.trackId) || '',
    })),
  };

  // Mark the origin browser before Firestore's local snapshot fires so it never
  // replays its own already-applied batch. If the signal write is rejected,
  // restore the previous marker; the canonical like batch itself remains saved.
  setSeenAccountSignalVersion(uid, version);
  observedAccountSignalVersionByUid.set(uid, version);
  try {
    await updateDoc(doc(db, 'users', uid), { exploreLikeSyncSignal: signal });
  } catch (reason) {
    if (readSeenAccountSignalVersion(uid) === version) setSeenAccountSignalVersion(uid, previousVersion);
    if ((observedAccountSignalVersionByUid.get(uid) || 0) === version) {
      observedAccountSignalVersionByUid.set(uid, previousVersion);
    }
    console.warn('Explore account like sync signal publish failed:', reason);
  }
};
'''
if dispatch_error_anchor not in like:
    raise RuntimeError('058 account signal: dispatch helper anchor missing')
like = like.replace(dispatch_error_anchor, observer_block, 1)

flush_anchor = '''    persistLikedStateCache(uid, confirmedCache);
    persistLikeOutbox(uid, latestOutbox);
    if (Object.keys(latestOutbox).length) schedulePendingLikes(user, undefined, true);
'''
flush_new = '''    persistLikedStateCache(uid, confirmedCache);
    persistLikeOutbox(uid, latestOutbox);
    await publishExploreLikeAccountSyncSignal(user, batchEntries, results);
    if (Object.keys(latestOutbox).length) schedulePendingLikes(user, undefined, true);
'''
if flush_anchor not in like:
    raise RuntimeError('058 account signal: flush anchor missing')
like = like.replace(flush_anchor, flush_new, 1)
LIKE.write_text(like, encoding='utf-8')

# Reuse the one existing users/{uid} listener. No new Firestore listener/read is
# created; it simply forwards the tiny account signal already present in the
# same profile snapshot.
app = APP.read_text(encoding='utf-8')
app_marker = '// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911'
if app_marker not in app:
    import_anchor = "import { readUserProfileCache, writeUserProfileCache } from './lib/userProfileCache';\n"
    if import_anchor not in app:
        raise RuntimeError('058 account signal: App import anchor missing')
    app = app.replace(
        import_anchor,
        import_anchor + "import { observeExploreLikeAccountSyncSignal } from './services/exploreLikeService';\n" + app_marker + '\n',
        1,
    )
    listener_anchor = '''            const data = docSnap.data();
            writeUserProfileCache(currentUser.uid, data);
            const recentSongsVersion = Number(data?.syncVersions?.recentSongs || 0);
'''
    listener_new = '''            const data = docSnap.data();
            writeUserProfileCache(currentUser.uid, data);
            observeExploreLikeAccountSyncSignal(currentUser, data?.exploreLikeSyncSignal);
            const recentSongsVersion = Number(data?.syncVersions?.recentSongs || 0);
'''
    if listener_anchor not in app:
        raise RuntimeError('058 account signal: App users listener anchor missing')
    app = app.replace(listener_anchor, listener_new, 1)
APP.write_text(app, encoding='utf-8')

# Only a missed-signal gap needs a visible-ID rehydrate. Normal cross-device
# batches arrive with exact per-track results and update the existing UI event.
explore = EXPLORE.read_text(encoding='utf-8')
explore_marker = '// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911'
if explore_marker not in explore:
    import_anchor = '''  EXPLORE_LIKE_SYNC_ERROR_EVENT,
  EXPLORE_LIKE_SYNC_EVENT,
  getExploreLikedTrackIds,
'''
    import_new = '''  EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT,
  EXPLORE_LIKE_SYNC_ERROR_EVENT,
  EXPLORE_LIKE_SYNC_EVENT,
  getExploreLikedTrackIds,
'''
    if import_anchor not in explore:
        raise RuntimeError('058 account signal: Explore import anchor missing')
    explore = explore.replace(import_anchor, import_new, 1)
    explore = explore.replace('// SORIDRAW_EXPLORE_FEED_COMPLETENESS_049\n', '// SORIDRAW_EXPLORE_FEED_COMPLETENESS_049\n' + explore_marker + '\n', 1)
    state_anchor = '''  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');
  const [feedRevisionSignal, setFeedRevisionSignal] = useState(0);
'''
    state_new = '''  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');
  const [likeAccountSyncSignal, setLikeAccountSyncSignal] = useState(0);
  const [feedRevisionSignal, setFeedRevisionSignal] = useState(0);
'''
    if state_anchor not in explore:
        raise RuntimeError('058 account signal: Explore state anchor missing')
    explore = explore.replace(state_anchor, state_new, 1)

    auth_effect_anchor = '''  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    likeHydrationKeyRef.current = '';
    if (!currentUser) setLikedTrackIds({});
  }), []);
'''
    auth_effect_new = auth_effect_anchor + '''
  useEffect(() => {
    const onAccountLikeInvalidation = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (!user?.uid || String(detail?.uid || '') !== user.uid) return;
      likeHydrationKeyRef.current = '';
      setLikeAccountSyncSignal((value) => value + 1);
    };
    window.addEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onAccountLikeInvalidation as EventListener);
    return () => window.removeEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onAccountLikeInvalidation as EventListener);
  }, [user?.uid]);
'''
    if auth_effect_anchor not in explore:
        raise RuntimeError('058 account signal: Explore auth effect anchor missing')
    explore = explore.replace(auth_effect_anchor, auth_effect_new, 1)
    deps_anchor = '''  }, [user, visibleTracks, profileUid]);
'''
    if explore.count(deps_anchor) < 1:
        raise RuntimeError('058 account signal: Explore hydration deps anchor missing')
    # This exact dependency list belongs to the like hydration effect in current source.
    explore = explore.replace(deps_anchor, '''  }, [user, visibleTracks, profileUid, likeAccountSyncSignal]);
''', 1)
EXPLORE.write_text(explore, encoding='utf-8')

# Add one tightly bounded owner-only field to the shared user document. Existing
# clients ignore it, so this is additive/backward compatible.
rules = RULES.read_text(encoding='utf-8')
rules_marker = '// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911'
if rules_marker not in rules:
    sync_fn_anchor = '''      function isValidSelfUpdate() {
'''
    signal_validator = '''      // SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911
      // Same-account cross-device UI signal only. Canonical likes remain in the
      // Explore backend; this field carries at most one confirmed batch (50 rows).
      function hasValidExploreLikeSyncSignal() {
        return !('exploreLikeSyncSignal' in request.resource.data) ||
          (request.resource.data.exploreLikeSyncSignal is map &&
            request.resource.data.exploreLikeSyncSignal.keys().hasOnly(['version', 'previousVersion', 'results']) &&
            request.resource.data.exploreLikeSyncSignal.version is int &&
            request.resource.data.exploreLikeSyncSignal.version > 0 &&
            request.resource.data.exploreLikeSyncSignal.previousVersion is int &&
            request.resource.data.exploreLikeSyncSignal.previousVersion >= 0 &&
            request.resource.data.exploreLikeSyncSignal.results is list &&
            request.resource.data.exploreLikeSyncSignal.results.size() <= 50);
      }

'''
    if sync_fn_anchor not in rules:
        raise RuntimeError('058 account signal: rules self update anchor missing')
    rules = rules.replace(sync_fn_anchor, signal_validator + sync_fn_anchor, 1)
    old_keys = '''          'favoriteCount', 'songGeneratedCount',
          'favoriteSyncSignal', 'favoriteSyncSignalUpdatedAt'
'''
    new_keys = '''          'favoriteCount', 'songGeneratedCount',
          'favoriteSyncSignal', 'favoriteSyncSignalUpdatedAt', 'exploreLikeSyncSignal'
'''
    if old_keys not in rules:
        raise RuntimeError('058 account signal: rules key list anchor missing')
    rules = rules.replace(old_keys, new_keys, 1)
    old_validation = '''        hasValidGenerationPreferences() &&
        hasValidSyncVersions();
'''
    new_validation = '''        hasValidGenerationPreferences() &&
        hasValidSyncVersions() &&
        hasValidExploreLikeSyncSignal();
'''
    if old_validation not in rules:
        raise RuntimeError('058 account signal: rules validator anchor missing')
    rules = rules.replace(old_validation, new_validation, 1)
RULES.write_text(rules, encoding='utf-8')

version = VERSION.read_text(encoding='utf-8')
if '"version": "057"' in version:
    version = version.replace('"version": "057"', '"version": "058"', 1)
elif '"version": "058"' not in version:
    raise RuntimeError('058 account signal: unexpected app version')
VERSION.write_text(version, encoding='utf-8')
