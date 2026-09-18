from pathlib import Path

MARKER = '// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988'

page_path = Path('src/pages/ExplorePage.tsx')
publication_path = Path('src/services/explorePublicationService.ts')
like_path = Path('src/services/exploreLikeService.ts')
session_cache_path = Path('src/services/exploreSessionCache.ts')

page = page_path.read_text(encoding='utf-8')
publication = publication_path.read_text(encoding='utf-8')
like = like_path.read_text(encoding='utf-8')

session_cache_source = r'''// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988
const EXPLORE_FEED_SESSION_TTL_MS = 30_000;

type ExploreFeedSessionEntry = {
  expiresAt: number;
  rows: Array<Record<string, unknown>>;
};

const exploreFeedSessionCache = new Map<string, ExploreFeedSessionEntry>();

const isFeedRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed';
  } catch {
    return url.includes('/v1/feed?');
  }
};

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const entry = exploreFeedSessionCache.get(url);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    exploreFeedSessionCache.delete(url);
    return null;
  }
  return entry.rows.map((row) => ({ ...row }));
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
) => {
  if (!isFeedRequest(url)) return;
  exploreFeedSessionCache.set(url, {
    expiresAt: Date.now() + EXPLORE_FEED_SESSION_TTL_MS,
    rows: rows.map((row) => ({ ...row })),
  });
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedSessionCache.clear();
};
'''

if not session_cache_path.exists() or MARKER not in session_cache_path.read_text(encoding='utf-8'):
    session_cache_path.write_text(session_cache_source, encoding='utf-8')

# ---------------------------------------------------------------------------
# Publication state: one owner-publication sweep per UID/browser session.
# Re-entering Music Note must use the UID-scoped session cache, while actual
# publish/private/options mutations update just that cached track immediately.
# ---------------------------------------------------------------------------
publication_import_anchor = "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n"
publication_import = publication_import_anchor + "import { invalidateExploreFeedSessionCache } from './exploreSessionCache';\n"
if "from './exploreSessionCache'" not in publication:
    if publication_import_anchor not in publication:
        raise RuntimeError('988 publication import anchor not found')
    publication = publication.replace(publication_import_anchor, publication_import, 1)

publication_helper_anchor = "const getMusicNoteTrackId = (uid: string, sourceId: string) => `music_note_${uid}_${sourceId}`;\n"
publication_helpers = publication_helper_anchor + r'''

// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988
const PUBLICATION_SESSION_CACHE_BASE = 'soridraw_explore_publication_states_v1';
const publicationMemoryCache = new Map<string, Record<string, ExploreMusicNotePublicationState>>();
const publicationInflight = new Map<string, Promise<Record<string, ExploreMusicNotePublicationState>>>();

const publicationSessionKey = (uid: string) => `${PUBLICATION_SESSION_CACHE_BASE}_${uid}`;

const clonePublicationStates = (
  states: Record<string, ExploreMusicNotePublicationState>,
): Record<string, ExploreMusicNotePublicationState> => Object.fromEntries(
  Object.entries(states).map(([sourceId, state]) => [sourceId, { ...state }]),
);

const readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const memory = publicationMemoryCache.get(normalizedUid);
  if (memory) return clonePublicationStates(memory);
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(publicationSessionKey(normalizedUid));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const normalized: Record<string, ExploreMusicNotePublicationState> = {};
    Object.entries(parsed).forEach(([sourceId, value]) => {
      const state = value as Partial<ExploreMusicNotePublicationState> | null;
      const trackId = String(state?.trackId || '').trim();
      if (!sourceId || !trackId) return;
      normalized[sourceId] = {
        status: state?.status === 'public' ? 'public' : 'private',
        trackId,
        allowNextSongApply: Boolean(state?.allowNextSongApply),
        allowFollowerSave: Boolean(state?.allowFollowerSave),
        profilePinned: Boolean(state?.profilePinned),
      };
    });
    publicationMemoryCache.set(normalizedUid, normalized);
    return clonePublicationStates(normalized);
  } catch {
    try { window.sessionStorage.removeItem(publicationSessionKey(normalizedUid)); } catch { /* ignore */ }
    return null;
  }
};

const writePublicationStateCache = (
  uid: string,
  states: Record<string, ExploreMusicNotePublicationState>,
) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const cloned = clonePublicationStates(states);
  publicationMemoryCache.set(normalizedUid, cloned);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(publicationSessionKey(normalizedUid), JSON.stringify(cloned));
  } catch {
    // Memory cache still prevents repeated server sweeps during this app session.
  }
};

const patchPublicationStateBySourceId = (
  uid: string,
  sourceId: string,
  nextState: ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid) || {};
  writePublicationStateCache(uid, { ...existing, [sourceId]: { ...nextState } });
};

const patchPublicationStateByTrackId = (
  uid: string,
  trackId: string,
  patcher: (state: ExploreMusicNotePublicationState) => ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid);
  if (!existing) return;
  let changed = false;
  const next = clonePublicationStates(existing);
  Object.entries(next).forEach(([sourceId, state]) => {
    if (state.trackId !== trackId) return;
    next[sourceId] = patcher(state);
    changed = true;
  });
  if (changed) writePublicationStateCache(uid, next);
};

export const clearExplorePublicationSessionCache = (uid?: string | null) => {
  const normalizedUid = String(uid || '').trim();
  if (normalizedUid) {
    publicationMemoryCache.delete(normalizedUid);
    publicationInflight.delete(normalizedUid);
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem(publicationSessionKey(normalizedUid)); } catch { /* ignore */ }
    }
    return;
  }
  publicationMemoryCache.clear();
  publicationInflight.clear();
};
'''
if MARKER not in publication:
    if publication_helper_anchor not in publication:
        raise RuntimeError('988 publication helper anchor not found')
    publication = publication.replace(publication_helper_anchor, publication_helpers, 1)

old_states = r'''// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965
export const getExploreMusicNotePublicationStates = async (
  user: User,
): Promise<Record<string, ExploreMusicNotePublicationState>> => {
  const result: Record<string, ExploreMusicNotePublicationState> = {};
  let cursor = '';

  for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
    const query = new URLSearchParams({
      visibility: 'all',
      limit: String(PUBLICATION_PAGE_SIZE),
    });
    if (cursor) query.set('cursor', cursor);

    const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];

    items
      .map(normalizePublicationItem)
      .forEach((item) => {
        if (item.sourceType !== 'music_note') return;
        const sourceId = String(item.sourceId || '').trim();
        if (!sourceId) return;
        const expectedTrackId = getMusicNoteTrackId(user.uid, sourceId);
        result[sourceId] = {
          status: item.isPublic ? 'public' : 'private',
          trackId: item.trackId || item.id || expectedTrackId,
          allowNextSongApply: Boolean(item.allowNextSongApply),
          allowFollowerSave: Boolean(item.allowFollowerSave),
          profilePinned: Boolean(item.profilePinned),
        };
      });

    cursor = String(payload?.data?.nextCursor || '').trim();
    if (!cursor) break;
  }

  return result;
};

export const getExploreMusicNotePublicationState = async (
  user: User,
  sourceId: string,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedSourceId = String(sourceId || '').trim();
  const expectedTrackId = getMusicNoteTrackId(user.uid, normalizedSourceId);
  let cursor = '';

  for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
    const query = new URLSearchParams({
      visibility: 'all',
      limit: String(PUBLICATION_PAGE_SIZE),
    });
    if (cursor) query.set('cursor', cursor);

    const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    const match = items
      .map(normalizePublicationItem)
      .find((item) =>
        item.id === expectedTrackId
        || (item.sourceType === 'music_note' && item.sourceId === normalizedSourceId)
      );

    if (match) {
      return {
        status: match.isPublic ? 'public' : 'private',
        trackId: match.trackId || match.id || expectedTrackId,
        allowNextSongApply: Boolean(match.allowNextSongApply),
        allowFollowerSave: Boolean(match.allowFollowerSave),
        profilePinned: Boolean(match.profilePinned),
      };
    }

    cursor = String(payload?.data?.nextCursor || '').trim();
    if (!cursor) break;
  }

  return {
    status: 'private',
    trackId: expectedTrackId,
    ...DEFAULT_PUBLICATION_OPTIONS,
  };
};
'''
new_states = r'''// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965
export const getExploreMusicNotePublicationStates = async (
  user: User,
): Promise<Record<string, ExploreMusicNotePublicationState>> => {
  const cached = readPublicationStateCache(user.uid);
  if (cached) return cached;

  const inFlight = publicationInflight.get(user.uid);
  if (inFlight) return inFlight;

  const task = (async () => {
    const result: Record<string, ExploreMusicNotePublicationState> = {};
    let cursor = '';

    for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
      const query = new URLSearchParams({
        visibility: 'all',
        limit: String(PUBLICATION_PAGE_SIZE),
      });
      if (cursor) query.set('cursor', cursor);

      const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
      const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];

      items
        .map(normalizePublicationItem)
        .forEach((item) => {
          if (item.sourceType !== 'music_note') return;
          const sourceId = String(item.sourceId || '').trim();
          if (!sourceId) return;
          const expectedTrackId = getMusicNoteTrackId(user.uid, sourceId);
          result[sourceId] = {
            status: item.isPublic ? 'public' : 'private',
            trackId: item.trackId || item.id || expectedTrackId,
            allowNextSongApply: Boolean(item.allowNextSongApply),
            allowFollowerSave: Boolean(item.allowFollowerSave),
            profilePinned: Boolean(item.profilePinned),
          };
        });

      cursor = String(payload?.data?.nextCursor || '').trim();
      if (!cursor) break;
    }

    writePublicationStateCache(user.uid, result);
    return clonePublicationStates(result);
  })().finally(() => {
    publicationInflight.delete(user.uid);
  });

  publicationInflight.set(user.uid, task);
  return task;
};

export const getExploreMusicNotePublicationState = async (
  user: User,
  sourceId: string,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedSourceId = String(sourceId || '').trim();
  const expectedTrackId = getMusicNoteTrackId(user.uid, normalizedSourceId);
  const states = await getExploreMusicNotePublicationStates(user);
  const state = states[normalizedSourceId];
  return state ? { ...state } : {
    status: 'private',
    trackId: expectedTrackId,
    ...DEFAULT_PUBLICATION_OPTIONS,
  };
};
'''
if old_states in publication:
    publication = publication.replace(old_states, new_states, 1)
elif 'const cached = readPublicationStateCache(user.uid);' not in publication:
    raise RuntimeError('988 publication state function anchor mismatch')

old_publish_return = r'''  const trackId = String(payload?.data?.trackId || getMusicNoteTrackId(user.uid, normalizedSourceId)).trim();
  return {
    status: 'public',
    trackId,
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
};
'''
new_publish_return = r'''  const trackId = String(payload?.data?.trackId || getMusicNoteTrackId(user.uid, normalizedSourceId)).trim();
  const nextState: ExploreMusicNotePublicationState = {
    status: 'public',
    trackId,
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
  patchPublicationStateBySourceId(user.uid, normalizedSourceId, nextState);
  invalidateExploreFeedSessionCache();
  return nextState;
};
'''
if old_publish_return in publication:
    publication = publication.replace(old_publish_return, new_publish_return, 1)
elif 'patchPublicationStateBySourceId(user.uid, normalizedSourceId, nextState);' not in publication:
    raise RuntimeError('988 publish return anchor mismatch')

old_visibility_return = r'''  return {
    status: Boolean(payload?.data?.isPublic) ? 'public' : 'private',
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    ...DEFAULT_PUBLICATION_OPTIONS,
  };
};
'''
new_visibility_return = r'''  const resolvedTrackId = String(payload?.data?.trackId || normalizedTrackId).trim();
  const status: ExploreMusicNotePublicationState['status'] = Boolean(payload?.data?.isPublic) ? 'public' : 'private';
  let cachedOptions = DEFAULT_PUBLICATION_OPTIONS;
  const cachedStates = readPublicationStateCache(user.uid);
  if (cachedStates) {
    const existing = Object.values(cachedStates).find((state) => state.trackId === resolvedTrackId);
    if (existing) {
      cachedOptions = {
        allowNextSongApply: existing.allowNextSongApply,
        allowFollowerSave: existing.allowFollowerSave,
        profilePinned: existing.profilePinned,
      };
    }
  }
  patchPublicationStateByTrackId(user.uid, resolvedTrackId, (state) => ({ ...state, status }));
  invalidateExploreFeedSessionCache();
  return {
    status,
    trackId: resolvedTrackId,
    ...cachedOptions,
  };
};
'''
if old_visibility_return in publication:
    publication = publication.replace(old_visibility_return, new_visibility_return, 1)
elif 'patchPublicationStateByTrackId(user.uid, resolvedTrackId' not in publication:
    raise RuntimeError('988 visibility return anchor mismatch')

old_options_return = r'''  return {
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
};
'''
new_options_return = r'''  const nextOptions: ExplorePublicationOptions = {
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
  patchPublicationStateByTrackId(user.uid, normalizedTrackId, (state) => ({ ...state, ...nextOptions }));
  invalidateExploreFeedSessionCache();
  return nextOptions;
};
'''
# Only replace the occurrence inside setExploreTrackPublicationOptions by splitting at its export.
if 'patchPublicationStateByTrackId(user.uid, normalizedTrackId, (state) => ({ ...state, ...nextOptions }))' not in publication:
    options_start = publication.find('export const setExploreTrackPublicationOptions = async')
    if options_start < 0:
        raise RuntimeError('988 publication options function not found')
    options_tail = publication[options_start:]
    if old_options_return not in options_tail:
        raise RuntimeError('988 publication options return anchor mismatch')
    options_tail = options_tail.replace(old_options_return, new_options_return, 1)
    publication = publication[:options_start] + options_tail

# ---------------------------------------------------------------------------
# Likes: UID-scoped in-memory truth. Re-entering Explore only asks /me/likes for
# IDs not already known in this login session. Mutation updates one cached ID.
# ---------------------------------------------------------------------------
like_import_anchor = "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n"
like_import = like_import_anchor + "import { invalidateExploreFeedSessionCache } from './exploreSessionCache';\n"
if "from './exploreSessionCache'" not in like:
    if like_import_anchor not in like:
        raise RuntimeError('988 like import anchor not found')
    like = like.replace(like_import_anchor, like_import, 1)

like_const_anchor = "const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';\n"
like_helpers = like_const_anchor + r'''

// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988
const likedStateByUid = new Map<string, Map<string, boolean>>();

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = new Map<string, boolean>();
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};
'''
if MARKER not in like:
    if like_const_anchor not in like:
        raise RuntimeError('988 like const anchor not found')
    like = like.replace(like_const_anchor, like_helpers, 1)

old_like_get = r'''export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return [];

  const query = new URLSearchParams({ trackIds: normalized.join(',') });
  const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
  return Array.isArray(payload?.data?.likedTrackIds)
    ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
    : [];
};
'''
new_like_get = r'''export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return [];

  const cache = getLikedStateCache(user.uid);
  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    const query = new URLSearchParams({ trackIds: missing.join(',') });
    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
    const likedIds = new Set(
      Array.isArray(payload?.data?.likedTrackIds)
        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
        : [],
    );
    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
  }

  return normalized.filter((trackId) => cache.get(trackId) === true);
};
'''
if old_like_get in like:
    like = like.replace(old_like_get, new_like_get, 1)
elif 'const missing = normalized.filter((trackId) => !cache.has(trackId));' not in like:
    raise RuntimeError('988 like getter anchor mismatch')

old_like_return = r'''  return {
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    liked: Boolean(payload?.data?.liked),
    likeCount: Number(payload?.data?.likeCount || 0),
  };
};
'''
new_like_return = r'''  const result = {
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    liked: Boolean(payload?.data?.liked),
    likeCount: Number(payload?.data?.likeCount || 0),
  };
  getLikedStateCache(user.uid).set(result.trackId, result.liked);
  invalidateExploreFeedSessionCache();
  return result;
};
'''
if old_like_return in like:
    like = like.replace(old_like_return, new_like_return, 1)
elif 'getLikedStateCache(user.uid).set(result.trackId, result.liked);' not in like:
    raise RuntimeError('988 like mutation return anchor mismatch')

# ---------------------------------------------------------------------------
# Explore feed: module-level 30s session cache. Explore -> Studio -> Explore in
# the hot window must do zero Worker/D1 feed reads. Search stays live/uncached.
# ---------------------------------------------------------------------------
page_import_anchor = "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n"
page_import = page_import_anchor + "import { readExploreFeedSessionCache, writeExploreFeedSessionCache } from '../services/exploreSessionCache';\n"
if "readExploreFeedSessionCache" not in page:
    if page_import_anchor not in page:
        raise RuntimeError('988 ExplorePage import anchor not found')
    page = page.replace(page_import_anchor, page_import, 1)

page_effect_anchor = r'''  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(requestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
'''
page_effect_replacement = r'''  useEffect(() => {
    const cachedRows = readExploreFeedSessionCache(requestUrl);
    if (cachedRows) {
      setError('');
      setTracks(cachedRows.map(normalizeTrack).filter((track) => track.id));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(requestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
'''
if 'const cachedRows = readExploreFeedSessionCache(requestUrl);' not in page:
    if page_effect_anchor not in page:
        raise RuntimeError('988 ExplorePage effect anchor not found')
    page = page.replace(page_effect_anchor, page_effect_replacement, 1)

page_rows_anchor = r'''      .then((payload) => {
        const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        setTracks(rows.map(normalizeTrack).filter((track) => track.id));
      })
'''
page_rows_replacement = r'''      .then((payload) => {
        const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        writeExploreFeedSessionCache(requestUrl, rows);
        setTracks(rows.map(normalizeTrack).filter((track) => track.id));
      })
'''
if 'writeExploreFeedSessionCache(requestUrl, rows);' not in page:
    if page_rows_anchor not in page:
        raise RuntimeError('988 ExplorePage rows anchor not found')
    page = page.replace(page_rows_anchor, page_rows_replacement, 1)

publication_path.write_text(publication, encoding='utf-8')
like_path.write_text(like, encoding='utf-8')
page_path.write_text(page, encoding='utf-8')

required = {
    str(session_cache_path): [MARKER, 'EXPLORE_FEED_SESSION_TTL_MS = 30_000', 'invalidateExploreFeedSessionCache'],
    str(publication_path): [MARKER, 'publicationMemoryCache', 'window.sessionStorage', 'publicationInflight', 'patchPublicationStateByTrackId'],
    str(like_path): [MARKER, 'likedStateByUid', 'const missing = normalized.filter', 'invalidateExploreFeedSessionCache'],
    str(page_path): ['readExploreFeedSessionCache(requestUrl)', 'writeExploreFeedSessionCache(requestUrl, rows)'],
}
for file_name, fragments in required.items():
    text = Path(file_name).read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise RuntimeError(f'988 verification failed: {file_name} missing {fragment}')

print('apply-988: Explore/Music Note client session cache parity applied')
