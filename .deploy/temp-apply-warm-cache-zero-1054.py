from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label}: anchor missing")
    return text.replace(old, new, 1)


Path("src/lib/catalogWarmCachePolicy.ts").write_text(
    """export type CatalogWarmCacheKind = 'musicNote' | 'library';

const positiveInt = (value: unknown): number => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

export const readCatalogProfileRevision = (
  kind: CatalogWarmCacheKind,
  profile: any,
): number => {
  if (!profile || typeof profile !== 'object') return 0;
  if (kind === 'library') return positiveInt(profile?.syncVersions?.library);
  return Math.max(
    positiveInt(profile?.syncVersions?.musicNote),
    positiveInt(profile?.favoriteSyncSignalUpdatedAt),
    positiveInt(profile?.favoriteSyncSignal?.at),
  );
};

export const canUseWarmCatalogWithoutRemote = ({
  localRevision,
  profileRevision,
  sessionValidated,
}: {
  localRevision: number;
  profileRevision: number;
  sessionValidated: boolean;
}): boolean => {
  const local = positiveInt(localRevision);
  const remote = positiveInt(profileRevision);
  if (local <= 0) return false;
  if (sessionValidated) return remote <= 0 || local >= remote;
  // Across app restarts, a server-authored IndexedDB Catalog may skip the
  // Worker only when the existing user-profile invalidation token proves
  // that the Catalog revision is current. Unknown profile state stays fail-safe.
  return remote > 0 && local >= remote;
};

export const shouldRefreshCatalogForProfile = ({
  catalogRevision,
  profileRevision,
}: {
  catalogRevision: number;
  profileRevision: number;
}): boolean => {
  const local = positiveInt(catalogRevision);
  const remote = positiveInt(profileRevision);
  return remote > 0 && (local <= 0 || remote > local);
};
""",
    encoding="utf-8",
)

Path("test").mkdir(exist_ok=True)
Path("test/catalogWarmCachePolicy.test.mjs").write_text(
    """import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseWarmCatalogWithoutRemote,
  readCatalogProfileRevision,
  shouldRefreshCatalogForProfile,
} from '../src/lib/catalogWarmCachePolicy.ts';

test('warm restart skips Worker when profile proves local Catalog current', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 500, sessionValidated: false }), true);
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 510, profileRevision: 500, sessionValidated: false }), true);
});

test('unknown profile never promotes cross-session local Catalog by itself', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 0, sessionValidated: false }), false);
});

test('newer profile invalidates warm Catalog', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 501, sessionValidated: false }), false);
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 500, profileRevision: 501 }), true);
});

test('same profile version causes no background Catalog request', () => {
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 500, profileRevision: 500 }), false);
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 510, profileRevision: 500 }), false);
});

test('session-validated local still works when profile token is unavailable', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 0, sessionValidated: true }), true);
});

test('Music Note revision uses strongest existing invalidation token', () => {
  assert.equal(readCatalogProfileRevision('musicNote', {
    syncVersions: { musicNote: 100 },
    favoriteSyncSignalUpdatedAt: 120,
    favoriteSyncSignal: { at: 110 },
  }), 120);
});

test('Library revision uses library syncVersion only', () => {
  assert.equal(readCatalogProfileRevision('library', {
    syncVersions: { library: 230, musicNote: 999 },
    favoriteSyncSignalUpdatedAt: 888,
  }), 230);
});
""",
    encoding="utf-8",
)

p = Path("src/lib/userDataEngine.ts")
s = p.read_text(encoding="utf-8")
s = once(
    s,
    "import { markCatalogRuntimeDiagnostic } from './catalogRuntimeDiagnostics';\n",
    "import { markCatalogRuntimeDiagnostic } from './catalogRuntimeDiagnostics';\nimport { canUseWarmCatalogWithoutRemote, readCatalogProfileRevision } from './catalogWarmCachePolicy';\n",
    "userDataEngine policy import",
)
old_fn = """const readKnownRemoteCatalogRevision = (kind: SoridrawCatalogKind, uid: string): number => {
  const profile = readUserProfileCache(uid) as any;
  if (!profile || typeof profile !== 'object') return 0;
  if (kind === 'library') {
    const libraryVersion = Number(profile?.syncVersions?.library || 0);
    return Number.isFinite(libraryVersion) && libraryVersion > 0 ? Math.floor(libraryVersion) : 0;
  }
  const candidates = [
    Number(profile?.syncVersions?.musicNote || 0),
    Number(profile?.favoriteSyncSignalUpdatedAt || 0),
    Number(profile?.favoriteSyncSignal?.at || 0),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length > 0 ? Math.floor(Math.max(...candidates)) : 0;
};"""
new_fn = """const readKnownRemoteCatalogRevision = (kind: SoridrawCatalogKind, uid: string): number => (
  readCatalogProfileRevision(kind, readUserProfileCache(uid))
);"""
s = once(s, old_fn, new_fn, "userDataEngine revision helper")
old_block = """    // Local cache may paint instantly, but it is never promoted to full-list
    // authority before one successful server Catalog response in this session.
    // This prevents an old 37-row cache from permanently masking a 500+ row R2 Catalog.
    if (local && sessionValidated && (knownRemoteRevision <= 0 || local.revision >= knownRemoteRevision)) {
      return local;
    }

    // Normal entry always validates against the already-materialized R2 object."""
new_block = """    // 1054: a V5 Catalog is server-authored and may survive app restarts without
    // a redundant Worker GET when the already-paid users profile invalidation token
    // proves it is current. Unknown profile state remains fail-safe and validates remotely.
    if (local && canUseWarmCatalogWithoutRemote({
      localRevision: local.revision,
      profileRevision: knownRemoteRevision,
      sessionValidated,
    })) {
      return local;
    }

    // Missing/stale/unknown proof still validates against the R2 Catalog."""
s = once(s, old_block, new_block, "userDataEngine warm condition")
p.write_text(s, encoding="utf-8")

p = Path("src/lib/adaptiveListIndexV2.ts")
s = p.read_text(encoding="utf-8")
s = once(s, "  updatedAtMs: number;\n};", "  updatedAtMs: number;\n  catalogRevision: number;\n};", "adaptive type revision")
s = once(s, "    updatedAtMs: snapshot.generatedAtMs,\n  };", "    updatedAtMs: snapshot.generatedAtMs,\n    catalogRevision: snapshot.revision,\n  };", "adaptive return revision")
p.write_text(s, encoding="utf-8")

p = Path("src/lib/listBundleCache.ts")
s = p.read_text(encoding="utf-8")
s = once(
    s,
    "import { isPreviewAdaptiveListIndexEnabled, readPreviewAdaptiveListIndexV2 } from './adaptiveListIndexV2';\n",
    "import { isPreviewAdaptiveListIndexEnabled, readPreviewAdaptiveListIndexV2 } from './adaptiveListIndexV2';\nimport { USER_PROFILE_CACHE_EVENT } from './userProfileCache';\nimport { readCatalogProfileRevision, shouldRefreshCatalogForProfile } from './catalogWarmCachePolicy';\n",
    "list bundle imports",
)
s = once(s, "  updatedAtMs: number;\n};", "  updatedAtMs: number;\n  catalogRevision?: number;\n};", "list bundle revision type")
s = once(
    s,
    "  let cancelled = false;\n  let started = false;\n",
    "  let cancelled = false;\n  let started = false;\n  let latestCatalogRevision = 0;\n  let profileRefreshInFlight = false;\n",
    "list bundle state",
)
anchor = """  const runOneShotRead = () => {
    if (cancelled || started) return;"""
helper = """  const deliverAdaptiveBundle = (
    bundle: ListBundleSnapshot,
    meta: { fromCache: boolean },
    onlyIfNewer = false,
  ) => {
    const revision = Math.max(0, Math.floor(Number(bundle.catalogRevision || 0)));
    if (onlyIfNewer && revision > 0 && revision <= latestCatalogRevision) return;
    if (revision > 0) latestCatalogRevision = Math.max(latestCatalogRevision, revision);
    callbacks.onData(bundle, meta);
  };

  const refreshCatalogAfterProfileAdvance = async (profileRevision: number) => {
    if (profileRefreshInFlight || cancelled || !started) return;
    profileRefreshInFlight = true;
    try {
      // Mutation publication is debounced by ~1.2s. Give the journal time to land,
      // then retry only while the already-paid profile token proves Catalog is stale.
      const retryDelays = [1400, 900, 1800];
      for (const delay of retryDelays) {
        if (cancelled) return;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        const bundle = await readPreviewAdaptiveListIndexV2(kind, uid);
        if (cancelled || !bundle) continue;
        const revision = Math.max(0, Math.floor(Number(bundle.catalogRevision || 0)));
        if (revision > latestCatalogRevision) deliverAdaptiveBundle(bundle, { fromCache: false }, true);
        if (revision >= profileRevision) return;
      }
    } finally {
      profileRefreshInFlight = false;
    }
  };

  const handleUserProfileCacheUpdate = (event: Event) => {
    if (cancelled || !started || !isPreviewAdaptiveListIndexEnabled()) return;
    const detail = (event as CustomEvent<{ uid?: string; profile?: any }>).detail;
    if (String(detail?.uid || '') !== uid) return;
    const profileRevision = readCatalogProfileRevision(kind, detail?.profile);
    if (!shouldRefreshCatalogForProfile({ catalogRevision: latestCatalogRevision, profileRevision })) return;
    void refreshCatalogAfterProfileAdvance(profileRevision);
  };

""" + anchor
s = once(s, anchor, helper, "list bundle profile refresh helper")
s = once(
    s,
    "        callbacks.onData(adaptiveBundle, { fromCache: false });\n        return;",
    "        deliverAdaptiveBundle(adaptiveBundle, { fromCache: false });\n        return;",
    "list bundle initial delivery",
)
add_listener_anchor = """  const handleMusicNotePageEntry = () => runOneShotRead();

  if (kind === 'musicNote') {"""
add_listener_new = """  const handleMusicNotePageEntry = () => runOneShotRead();

  if (typeof window !== 'undefined') {
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleUserProfileCacheUpdate as EventListener);
  }

  if (kind === 'musicNote') {"""
s = once(s, add_listener_anchor, add_listener_new, "profile listener add")
cleanup_anchor = """  return () => {
    cancelled = true;
    if (kind === 'musicNote' && typeof window !== 'undefined') {
      window.removeEventListener(MUSIC_NOTE_BUNDLE_PAGE_ENTRY_EVENT, handleMusicNotePageEntry as EventListener);
    }
  };"""
cleanup_new = """  return () => {
    cancelled = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleUserProfileCacheUpdate as EventListener);
      if (kind === 'musicNote') {
        window.removeEventListener(MUSIC_NOTE_BUNDLE_PAGE_ENTRY_EVENT, handleMusicNotePageEntry as EventListener);
      }
    }
  };"""
s = once(s, cleanup_anchor, cleanup_new, "profile listener cleanup")
p.write_text(s, encoding="utf-8")

print("WARM_CACHE_PATCH_APPLIED")
