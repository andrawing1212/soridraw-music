import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
// SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE
// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975
// SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000
// SORIDRAW_EXPLORE_PUBLIC_PROFILE_PARITY_048
// SORIDRAW_EXPLORE_FEED_COMPLETENESS_049
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Compass, ExternalLink, Heart, Loader2, Music2, Pencil, Pin, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readExploreFeedSessionCache,
  readExploreFeedSessionCacheCursor,
  readExploreFeedSessionCacheRevision,
  writeExploreFeedSessionCache,
  patchExploreFeedSessionCachesRow,
} from '../services/exploreSessionCache';
import {
  EXPLORE_LIKE_SYNC_ERROR_EVENT,
  EXPLORE_LIKE_SYNC_EVENT,
  EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT,
  flushPendingExploreLikesForPageExit,
  getExploreLikedTrackIds,
  ensureExplorePersonalLikeBaseline127,
  invalidateExplorePersonalLikeBaseline127,
  readExploreTrackLikeMembership127,
  overlayExploreLikeDisplayCounts,
  reconcileExploreLikedTrackCollectionState,
  setExploreTrackLike,
} from '../services/exploreLikeService';
import {
  getExploreLikedTrackCollectionIds,
  getExploreLikedTracks,
  patchExploreLikedTrackCachedCount091,
  rememberExploreLikedTrack,
} from '../services/exploreLikedTracksService';
import { getExplorePublicProfileFirstView, patchExplorePublicProfileFirstViewProfile, patchExplorePublicProfileFirstViewTrack, rememberExplorePublicProfileFirstViewProfile } from '../services/exploreProfileFirstViewService';
import {
  getExploreFollowState,
  getExplorePublicProfile,
  getExplorePublicProfileTracks,
  setExploreFollow,
  type ExploreFollowState,
  type ExplorePublicProfile,
} from '../services/exploreSocialService';
import ExploreProfileEditModal from '../components/explore/ExploreProfileEditModal';
import '../components/explore/explore.css';

type ExploreSort = 'recommended' | 'latest' | 'popular';

type ExploreTrack = {
  id: string;
  ownerUid: string;
  ownerHandle: string;
  title: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  sunoUrlPrimary?: string | null;
  openUrl?: string | null;
  likeCount: number;
  publishedAt: number;
  profilePinned: boolean;
};

type ExploreApiResponse = {
  ok?: boolean;
  data?: {
    items?: Array<Record<string, unknown>>;
    nextCursor?: string | null;
  };
};

// SORIDRAW_EXPLORE_FEED_REVISION_033_20260908
type ExploreFeedRevisionResponse = {
  ok?: boolean;
  data?: {
    sort?: string | null;
    revision?: string | null;
  };
};

const EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000;
const EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000;
// SORIDRAW_EXPLORE_ENTRY_REVISION_REVALIDATION_126_20260920
// The last successful check survives Explore route remounts within this tab.
// Rendering cached rows must never reset this clock: otherwise opening Explore
// hides a cross-device unlike behind a fresh two-minute delay.
const exploreFeedLastRevisionCheckAt126 = new Map<string, number>();
const shouldRevalidateExploreFeedOnEntry126 = (
  feedRequest: boolean,
  explicitRevision: boolean,
  lastCheckedAt: number,
  now: number,
) => feedRequest && (
  explicitRevision ||
  !lastCheckedAt ||
  now - lastCheckedAt >= EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS
);
// SORIDRAW_EXPLORE_LIKE_LATEST_CACHE_IDLE_BATCH_119_20260918
// Public Feed revision checks are capped at one per two minutes. The actor keeps the
// immediate optimistic heart/count locally; other users pick up the shared result
// after the Worker aggregate updates the shared revision.
// SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916
// First-page Feed refreshes use the already-materialized R2 snapshot directly.
// This keeps app-update/cache-recovery traffic off D1 while preserving local-first warm re-entry.
const EXPLORE_FEED_R2_SNAPSHOT_QUERY_108 = '__soridraw_r2_only';
const EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108 = '__soridraw_r2_revision';
const EXPLORE_FEED_R2_SNAPSHOT_VERSION_108 = '108';
// SORIDRAW_EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_20260918
// app123 fixed the shared R2 values, but devices that had already cached the old
// mixed counts (for example mobile 0/1/0/0 while PC was 1/1/1/1) can legitimately
// keep rendering that last-known cache. Repair that known legacy state exactly once
// per Feed sort by reading the current shared R2 snapshot directly (D1 R0/W0).
// The marker is scoped to the released app version: the first Explore visit after each
// update checks the current shared R2 snapshot once per sort. Unchanged revisits R0/W0.
const EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX = 'soridraw:explore:shared-like-cache-repair:124';

// SORIDRAW_EXPLORE_UPDATE_FIRST_SHARED_CONVERGENCE_125_20260920
// A release refreshes only the bounded shared first-page R2 snapshot, not canonical D1.
const exploreSharedLikeCacheRepairKey124 = (feedUrl: string) => {
  try {
    const parsed = new URL(feedUrl);
    const sort = parsed.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
    return `${EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX}:${__SORIDRAW_APP_VERSION__}:${sort}`;
  } catch {
    return `${EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX}:${__SORIDRAW_APP_VERSION__}:latest`;
  }
};

const hasExploreSharedLikeCacheRepair124 = (feedUrl: string) => {
  try {
    return window.localStorage.getItem(exploreSharedLikeCacheRepairKey124(feedUrl)) === '1';
  } catch {
    return false;
  }
};

const markExploreSharedLikeCacheRepair124 = (feedUrl: string) => {
  try {
    window.localStorage.setItem(exploreSharedLikeCacheRepairKey124(feedUrl), '1');
  } catch {}
};
// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912
// SORIDRAW_EXPLORE_UID_SCOPED_SYNC_EVENT_075_20260913
// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914
// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915
// Forced like-count recovery must use the unique fresh Feed URL even when this
// browser has no session Feed cache yet (for example immediately after app update).

const isExploreFeedRequest = (value: string) => {
  try {
    return new URL(value).pathname === '/v1/feed';
  } catch {
    return false;
  }
};

const buildExploreFeedRevisionUrl = (feedUrl: string) => {
  const parsed = new URL(feedUrl);
  const sort = parsed.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  return `${parsed.origin}/v1/feed-revision?sort=${sort}`;
};

const buildExploreR2SnapshotFeedUrl108 = (feedUrl: string, revision: string | null = null) => {
  const parsed = new URL(feedUrl);
  parsed.searchParams.delete('__soridraw_revision');
  parsed.searchParams.delete('__soridraw_like_refresh');
  parsed.searchParams.set(EXPLORE_FEED_R2_SNAPSHOT_QUERY_108, EXPLORE_FEED_R2_SNAPSHOT_VERSION_108);
  if (revision) parsed.searchParams.set(EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108, revision);
  else parsed.searchParams.delete(EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108);
  return parsed.toString();
};

const safeText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const safeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const readNestedCount = (row: Record<string, unknown>, key: string) => {
  const stats = row.stats && typeof row.stats === 'object' ? row.stats as Record<string, unknown> : null;
  return safeCount(row[key] ?? stats?.[key]);
};

const normalizeTrack = (row: Record<string, unknown>): ExploreTrack => ({
  id: safeText(row.id),
  ownerUid: safeText(row.ownerUid ?? row.owner_uid),
  ownerHandle: safeText(row.ownerHandle ?? row.owner_handle).replace(/^@+/, ''),
  title: safeText(row.title, '제목 없는 곡'),
  displayName: safeText(row.ownerNickname ?? row.displayName ?? row.ownerDisplayName, 'SORiDRAW'),
  avatarUrl: safeText(row.ownerAvatarUrl ?? row.avatarUrl) || null,
  coverUrl: safeText(row.coverUrl) || null,
  sunoUrlPrimary: safeText(row.sunoUrlPrimary) || null,
  openUrl: safeText(row.openUrl) || null,
  likeCount: readNestedCount(row, 'likeCount'),
  publishedAt: safeCount(row.publishedAt ?? row.published_at),
  profilePinned: Boolean(row.profilePinned ?? row.profile_pinned ?? (row.options as Record<string, unknown> | undefined)?.profilePinned),
});

const comparePublicProfileTracks = (a: ExploreTrack, b: ExploreTrack) => {
  const pinnedOrder = Number(b.profilePinned) - Number(a.profilePinned);
  if (pinnedOrder !== 0) return pinnedOrder;
  if (a.publishedAt !== b.publishedAt) return b.publishedAt - a.publishedAt;
  return b.id.localeCompare(a.id);
};

const isOpenableUrl = (value?: string | null) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && (parsed.hostname === 'suno.com' || parsed.hostname === 'www.suno.com');
  } catch {
    return false;
  }
};

const formatCount = (value: number) => {
  if (value >= 10000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}K`;
  return String(value);
};

function ExploreTrackCard({
  track,
  liked,
  likeBusy,
  onToggleLike,
  onOpenProfile,
}: {
  track: ExploreTrack;
  liked: boolean;
  likeBusy: boolean;
  onToggleLike: (track: ExploreTrack) => void;
  onOpenProfile: (track: ExploreTrack) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const openUrl = isOpenableUrl(track.openUrl)
    ? track.openUrl
    : isOpenableUrl(track.sunoUrlPrimary)
      ? track.sunoUrlPrimary
      : null;

  const openSuno = () => {
    if (!openUrl) return;
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="soridraw-explore-card">
      <button
        type="button"
        className="soridraw-explore-cover-button"
        onClick={openSuno}
        disabled={!openUrl}
        aria-label={openUrl ? `${track.title} Suno에서 열기` : `${track.title} 썸네일`}
      >
        <span className="soridraw-explore-cover-shell">
          {track.coverUrl && !imageFailed ? (
            <img
              src={track.coverUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="soridraw-explore-cover-fallback" aria-hidden="true">
              <Music2 />
            </span>
          )}
          {track.profilePinned && (
            <span className="soridraw-explore-pin-badge" title="공개 프로필 고정" aria-label="공개 프로필 고정">
              <Pin aria-hidden="true" />
            </span>
          )}
          {openUrl && (
            <span className="soridraw-explore-cover-open" aria-hidden="true">
              <ExternalLink />
            </span>
          )}
        </span>
      </button>

      <div className="soridraw-explore-card-copy">
        <h3 title={track.title}>{track.title}</h3>
        <button
          type="button"
          className="soridraw-explore-creator"
          onClick={() => onOpenProfile(track)}
          disabled={!track.ownerUid}
          title={track.ownerUid ? `${track.displayName} 공개 프로필` : track.displayName}
        >
          <span className="soridraw-explore-avatar" aria-hidden="true">
            {track.avatarUrl ? <img src={track.avatarUrl} alt="" referrerPolicy="no-referrer" /> : track.displayName.charAt(0).toUpperCase()}
          </span>
          <span>{track.displayName}</span>
        </button>
      </div>

      <div className="soridraw-explore-card-actions" aria-label="곡 반응 정보">
        <button
          type="button"
          className={`soridraw-explore-like-button${liked ? ' is-liked' : ''}`}
          onClick={() => onToggleLike(track)}
          disabled={likeBusy}
          title={liked ? '좋아요 취소' : '좋아요'}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
        >
          {likeBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <Heart aria-hidden="true" />}
          <span>{formatCount(track.likeCount)}</span>
        </button>
        <button
          type="button"
          className="soridraw-explore-open-button"
          onClick={openSuno}
          disabled={!openUrl}
          aria-label="Suno에서 열기"
          title={openUrl ? 'Suno에서 열기' : 'Suno 링크 없음'}
        >
          <ExternalLink aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const profileUid = safeText(searchParams.get('profile'));
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [sort, setSort] = useState<ExploreSort>('recommended');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [tracks, setTracks] = useState<ExploreTrack[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedTrackIds, setLikedTrackIds] = useState<Record<string, boolean>>({});
  const [likeBusyTrackId, setLikeBusyTrackId] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState('');
  const [profile, setProfile] = useState<ExplorePublicProfile | null>(null);
  const [profileTracks, setProfileTracks] = useState<ExploreTrack[]>([]);
  const [profileCollection, setProfileCollection] = useState<'public' | 'liked'>('public');
  const [profileLikedTracks, setProfileLikedTracks] = useState<ExploreTrack[]>([]);
  const [profileLikedLoading, setProfileLikedLoading] = useState(false);
  const [profileLikedError, setProfileLikedError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [followState, setFollowState] = useState<ExploreFollowState | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');
  const [likeAccountSyncSignal, setLikeAccountSyncSignal] = useState(0);
  const [feedRevisionSignal, setFeedRevisionSignal] = useState(0);
  const feedRevisionEventAtRef = useRef(0);
  const feedRevisionActivityAtRef = useRef(0);
  const feedRevisionRequestedUrlRef = useRef('');
  const likeInteractionVersionRef090 = useRef(0);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    likeHydrationKeyRef.current = '';
    setLikedTrackIds({});
  }), []);

  // SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920
  // The same account-owned boolean drives every Heart in Feed/Profile/Liked.
  // Apply a remote accepted final-state only when no newer local outbox owns it;
  // never derive membership from the shared public likeCount.
  useEffect(() => {
    if (!user?.uid) return;
    const onRemote = (event: Event) => {
      const detail = (event as CustomEvent<{
        uid?: string; trackId?: string; liked?: boolean; source?: string;
      }>).detail;
      if (detail?.source !== 'remote' || detail.uid !== user.uid ||
          !detail.trackId || typeof detail.liked !== 'boolean') return;
      likeInteractionVersionRef090.current += 1;
      setLikedTrackIds((previous) => ({ ...previous, [detail.trackId!]: detail.liked! }));
      // Own liked collection uses the same membership cache; load only a newly
      // liked missing card when that section is actually visible.
      setLikeAccountSyncSignal((value) => value + 1);
    };
    const onGap = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid !== user.uid) return;
      invalidateExplorePersonalLikeBaseline127(user.uid);
      likeHydrationKeyRef.current = '';
      setLikeAccountSyncSignal((value) => value + 1);
    };
    window.addEventListener(EXPLORE_LIKE_SYNC_EVENT, onRemote);
    window.addEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onGap);
    return () => {
      window.removeEventListener(EXPLORE_LIKE_SYNC_EVENT, onRemote);
      window.removeEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onGap);
    };
  }, [user?.uid]);

  const requestUrl = useMemo(() => {
    const cleanQuery = submittedQuery.trim();
    if (cleanQuery) {
      const params = new URLSearchParams({ q: cleanQuery });
      return `${EXPLORE_API_BASE}/v1/search?${params.toString()}`;
    }
    const apiSort = sort === 'popular' ? 'popular' : 'latest';
    return `${EXPLORE_API_BASE}/v1/feed?sort=${apiSort}&limit=40`;
  }, [sort, submittedQuery]);

  // SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916
  // SORIDRAW_EXPLORE_PUBLIC_COUNT_CONVERGENCE_116_20260917
  // Only server-confirmed/shared payloads may become public-count authority. Once a count is
  // confirmed, patch every already-loaded Feed/Profile/Liked cache by track id so Recommended,
  // Latest, Popular and Public Profile cannot display different counts on the same device.
  // SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918
  // Shared/public payloads remain the public authority, except while this user's
  // newest local mutation is still pending or waiting for the one-minute shared
  // publication. During that short window the actor's latest count must not jump.
  const overlayActorLikeCounts120 = (rows: ExploreTrack[]) => {
    const activeUid = auth.currentUser?.uid || user?.uid || '';
    return activeUid ? overlayExploreLikeDisplayCounts(activeUid, rows) : rows;
  };

  const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[], authoritative = true) => {
    if (!sharedTracks.length || !authoritative) return;
    const activeUid = auth.currentUser?.uid || user?.uid || '';
    const effectiveSharedTracks = activeUid
      ? overlayExploreLikeDisplayCounts(activeUid, sharedTracks)
      : sharedTracks;
    const countByTrackId = new Map(effectiveSharedTracks.map((track) => [track.id, track.likeCount]));
    const applyPublicCounts110 = (previous: ExploreTrack[]) => previous.map((track) => {
      const nextCount = countByTrackId.get(track.id);
      return nextCount === undefined || nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
    });

    setTracks(applyPublicCounts110);
    setProfileTracks(applyPublicCounts110);
    setProfileLikedTracks(applyPublicCounts110);

    effectiveSharedTracks.forEach((track) => {
      patchExploreFeedSessionCachesRow(track.id, { likeCount: track.likeCount });
      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
      if (activeUid) patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);
    });
  };

  useEffect(() => {
    const cachedRows = readExploreFeedSessionCache(requestUrl);
    const feedRequest = isExploreFeedRequest(requestUrl);
    const controller = new AbortController();

    const fetchPayload = async (url: string): Promise<ExploreApiResponse> => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<ExploreApiResponse>;
    };

    const fetchRevision = async (): Promise<string | null> => {
      if (!feedRequest) return null;
      const response = await fetch(buildExploreFeedRevisionUrl(requestUrl), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`revision HTTP ${response.status}`);
      const payload = await response.json() as ExploreFeedRevisionResponse;
      const revision = safeText(payload?.data?.revision) || null;
      if (revision) exploreFeedLastRevisionCheckAt126.set(requestUrl, Date.now());
      return revision;
    };

    const fetchFeedSnapshot108 = async (revision: string | null) => {
      const response = await fetch(buildExploreR2SnapshotFeedUrl108(requestUrl, revision), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`R2 snapshot HTTP ${response.status}`);
      const payload = await response.json() as ExploreApiResponse;
      const actualRevision = safeText(response.headers.get('X-SORIDRAW-Feed-Revision')) || revision;
      return { payload, revision: actualRevision };
    };

    const applyPayload = (payload: ExploreApiResponse, serverRevision: string | null) => {
      // Never replace a known-good local Feed or mark this release converged on
      // a malformed/failed R2 response. A failed first refresh must stay retryable.
      if (payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
        throw new Error('Invalid Explore snapshot; preserving the previous Feed');
      }
      const rows = payload.data.items;
      const nextCursor = feedRequest ? (safeText(payload?.data?.nextCursor) || null) : null;
      if (feedRequest) {
        writeExploreFeedSessionCache(
          requestUrl,
          rows,
          nextCursor,
          serverRevision,
        );
      }
      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      const displayTracks = overlayActorLikeCounts120(normalizedTracks);
      setFeedNextCursor(nextCursor);
      setLoadMoreError('');
      setTracks(displayTracks);
      if (feedRequest) {
        syncSharedPublicCountsToLocal110(normalizedTracks);
        // Mark only after the current snapshot is applied to Feed and loaded cards.
        markExploreSharedLikeCacheRepair124(requestUrl);
        exploreFeedLastRevisionCheckAt126.set(requestUrl, Date.now());
      }
    };

    if (cachedRows) {
      setError('');
      setFeedNextCursor(feedRequest ? readExploreFeedSessionCacheCursor(requestUrl) : null);
      setLoadMoreError('');
      const cachedTracks = cachedRows.map(normalizeTrack).filter((track) => track.id);
      // SORIDRAW_EXPLORE_UPDATE_LAST_KNOWN_FEED_123_20260918
      // App updates and ordinary re-entry render the last known good Feed immediately
      // and do not spend a revision request merely because code/version changed.
      setTracks(overlayActorLikeCounts120(cachedTracks));
      setLoading(false);

      const oneTimeSharedRepair124 = feedRequest && !hasExploreSharedLikeCacheRepair124(requestUrl);
      if (oneTimeSharedRepair124) {
        const now = Date.now();
        feedRevisionEventAtRef.current = now;
        feedRevisionActivityAtRef.current = now;
        void (async () => {
          try {
            // Direct current shared R2 snapshot: bypass the 60s revision edge cache so
            // previously stale mobile/PC caches converge immediately, with D1 R0/W0.
            const snapshot = await fetchFeedSnapshot108(null);
            if (controller.signal.aborted) return;
            applyPayload(snapshot.payload, snapshot.revision);
          } catch (reason) {
            if (!controller.signal.aborted) {
              console.warn('Explore one-time shared like cache repair failed; keeping cached feed:', reason);
            }
          }
        })();
        return () => controller.abort();
      }

      const revalidateRequested = feedRequest && feedRevisionRequestedUrlRef.current === requestUrl;
      const lastCheckedAt = exploreFeedLastRevisionCheckAt126.get(requestUrl) || 0;
      const shouldRevalidate = shouldRevalidateExploreFeedOnEntry126(
        feedRequest,
        revalidateRequested,
        lastCheckedAt,
        Date.now(),
      );
      // Recommended and Latest share one URL. On entry, validate a stale cache
      // with the small edge-cached revision, not by opening Popular or reading D1.
      // Freshly checked entries stay local-first, with zero Feed-data reads.
      if (!shouldRevalidate) return () => controller.abort();

      const now = Date.now();
      feedRevisionEventAtRef.current = now;
      feedRevisionActivityAtRef.current = now;
      if (revalidateRequested) feedRevisionRequestedUrlRef.current = '';
      void (async () => {
        try {
          const serverRevision = await fetchRevision();
          if (!serverRevision || controller.signal.aborted) return;
          const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);
          if (cachedRevision === serverRevision) {
            syncSharedPublicCountsToLocal110(cachedTracks);
            return;
          }
          const snapshot = await fetchFeedSnapshot108(serverRevision);
          if (controller.signal.aborted) return;
          applyPayload(snapshot.payload, snapshot.revision);
        } catch (reason) {
          if (!controller.signal.aborted) {
            console.warn('Explore feed revision revalidation failed; keeping cached feed:', reason);
          }
        }
      })();

      return () => controller.abort();
    }

    setLoading(true);
    setError('');

    void (async () => {
      try {
        if (feedRequest) {
          const serverRevision = await fetchRevision().catch((reason) => {
            if (!controller.signal.aborted) {
              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);
            }
            return null;
          });
          const snapshot = await fetchFeedSnapshot108(serverRevision);
          if (controller.signal.aborted) return;
          applyPayload(snapshot.payload, snapshot.revision);
          return;
        }

        const payload = await fetchPayload(requestUrl);
        if (controller.signal.aborted) return;
        applyPayload(payload, null);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        console.error('Explore feed load failed:', reason);
        setError('Explore 곡을 불러오지 못했어요.');
        setFeedNextCursor(null);
        setLoadMoreError('');
        setTracks([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [requestUrl, feedRevisionSignal]);

  useEffect(() => {
    if (!isExploreFeedRequest(requestUrl) || profileUid) return;

    const requestRevisionCheck = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - feedRevisionEventAtRef.current < EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS) return;
      feedRevisionEventAtRef.current = now;
      feedRevisionRequestedUrlRef.current = requestUrl;
      setFeedRevisionSignal((value) => value + 1);
    };

    // SORIDRAW_EXPLORE_ACTIVE_REVALIDATION_045_20260908
    // A tab can remain visible for a long time without focus/visibility events.
    // Re-check only the zero-D1 revision endpoint on real user interaction, throttled.
    const requestActivityRevisionCheck = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - feedRevisionActivityAtRef.current < EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS) return;
      feedRevisionActivityAtRef.current = now;
      requestRevisionCheck();
    };

    window.addEventListener('focus', requestRevisionCheck);
    window.addEventListener('pageshow', requestRevisionCheck);
    window.addEventListener('pointerdown', requestActivityRevisionCheck, { passive: true });
    document.addEventListener('visibilitychange', requestRevisionCheck);
    return () => {
      window.removeEventListener('focus', requestRevisionCheck);
      window.removeEventListener('pageshow', requestRevisionCheck);
      window.removeEventListener('pointerdown', requestActivityRevisionCheck);
      document.removeEventListener('visibilitychange', requestRevisionCheck);
    };
  }, [requestUrl, profileUid]);

  useEffect(() => {
    if (!profileUid) {
      setProfile(null);
      setProfileTracks([]);
      setProfileCollection('public');
      setProfileLikedTracks([]);
      setProfileLikedLoading(false);
      setProfileLikedError('');
      setProfileError('');
      setFollowState(null);
      setProfileEditOpen(false);
      return;
    }

    let cancelled = false;
    setProfileCollection('public');
    // 088: entering this user's own profile from Explore must not discard the
    // optimistic liked cards created moments earlier in the same page session.
    setProfileLikedTracks((previous) => profileUid === user?.uid ? previous : []);
    setProfileLikedLoading(false);
    setProfileLikedError('');
    setProfileLoading(true);
    setProfileError('');
    setSocialNotice('');

    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>, authoritative = false) => {
      if (cancelled) return;
      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      normalizedTracks.sort(comparePublicProfileTracks);
      const displayTracks = overlayActorLikeCounts120(normalizedTracks);
      if (authoritative) syncSharedPublicCountsToLocal110(normalizedTracks);
      setProfile(nextProfile);
      setProfileTracks(displayTracks);
    };

    getExplorePublicProfileFirstView(profileUid, {
      onRevalidated: ({ profile: refreshedProfile, tracks: refreshedRows }) => {
        applyProfileFirstView(refreshedProfile, refreshedRows, true);
      },
      onInvalidated: (message) => {
        if (cancelled) return;
        setProfile(null);
        setProfileTracks([]);
        setFollowState(null);
        setProfileError(message || '공개 프로필을 불러오지 못했어요.');
      },
    })
      .then(async ({ profile: nextProfile, tracks: rows }) => {
        if (cancelled) return;
        applyProfileFirstView(nextProfile, rows);

        if (user && user.uid !== nextProfile.uid) {
          try {
            const nextFollowState = await getExploreFollowState(user, nextProfile.uid);
            if (!cancelled) setFollowState(nextFollowState);
          } catch (reason) {
            console.warn('Explore follow state load failed:', reason);
            if (!cancelled) setFollowState(null);
          }
        } else {
          setFollowState(null);
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error('Explore public profile load failed:', reason);
        setProfile(null);
        setProfileTracks([]);
        setProfileError(reason instanceof Error ? reason.message : '공개 프로필을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, [profileUid, user]);

  const profileIsOwn = Boolean(profile && user?.uid === profile.uid);

  useEffect(() => {
    if (!profileUid || !profile || !user || user.uid !== profile.uid || profileCollection !== 'liked') return;
    let cancelled = false;
    setProfileLikedLoading(true);
    setProfileLikedError('');
    (async () => {
      try {
        await ensureExplorePersonalLikeBaseline127(user);
      } catch (reason) {
        // Keep cached cards visible, but block new unverified like mutations.
        console.warn('[127] Liked collection baseline pending:', reason);
      }
      return getExploreLikedTracks(user);
    })()
      .then((rows) => {
        if (cancelled) return;
        const normalizedRows = overlayActorLikeCounts120(
          rows.map(normalizeTrack).filter((track) => track.id),
        );
        const canonicalLikedTrackIds = getExploreLikedTrackCollectionIds(user.uid)
          ?? normalizedRows.map((track) => track.id);
        const effectiveLikedTrackIds = reconcileExploreLikedTrackCollectionState(
          user.uid,
          canonicalLikedTrackIds,
        );
        const effectiveLikedSet = new Set(effectiveLikedTrackIds);
        setLikedTrackIds((previous) => {
          const next = { ...previous };
          Object.keys(next).forEach((trackId) => { next[trackId] = effectiveLikedSet.has(trackId); });
          effectiveLikedTrackIds.forEach((trackId) => { next[trackId] = true; });
          return next;
        });
        const normalizedLikedRows = normalizedRows;
        setProfileLikedTracks((previous) => {
          const merged = new Map(normalizedLikedRows.map((track) => [track.id, track]));
          previous.forEach((track) => {
            if (!effectiveLikedSet.has(track.id) || merged.has(track.id)) return;
            merged.set(track.id, track);
          });
          return [...merged.values()];
        });
        likeHydrationKeyRef.current = '';
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error('Explore liked track collection load failed:', reason);
        setProfileLikedError(reason instanceof Error ? reason.message : '좋아요 곡을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setProfileLikedLoading(false);
      });
    return () => { cancelled = true; };
  }, [profileUid, profile, user, profileCollection, likeAccountSyncSignal]);

  const visibleTracks = profileUid
    ? (profileIsOwn && profileCollection === 'liked' ? profileLikedTracks : profileTracks)
    : tracks;

  useEffect(() => {
    if (!user || visibleTracks.length === 0) return;
    const ids = [...new Set(visibleTracks.map((track) => track.id).filter(Boolean))].slice(0, 50);
    const hydrationKey = `${user.uid}:${profileUid || 'feed'}:${profileUid ? profileCollection : 'feed'}:${ids.join(',')}`;
    if (!ids.length || likeHydrationKeyRef.current === hydrationKey) return;
    likeHydrationKeyRef.current = hydrationKey;

    let cancelled = false;
    const interactionVersion = likeInteractionVersionRef090.current;
    getExploreLikedTrackIds(user, ids)
      .then((likedIds) => {
        if (cancelled) return;
        if (interactionVersion !== likeInteractionVersionRef090.current) {
          likeHydrationKeyRef.current = '';
          setLikeAccountSyncSignal((value) => value + 1);
          return;
        }
        const likedSet = new Set(likedIds);
        setLikedTrackIds((prev) => {
          const next = { ...prev };
          ids.forEach((id) => { next[id] = false; });
          likedIds.forEach((id) => { next[id] = true; });
          return next;
        });
        // 089: heart membership is personal; numeric likeCount stays on the shared public feed/profile value.
      })
      .catch((reason) => {
        console.warn('Explore like state hydration failed:', reason);
        likeHydrationKeyRef.current = '';
      });

    return () => { cancelled = true; };
  }, [user, visibleTracks, profileUid, profileCollection, likeAccountSyncSignal]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    if (!socialNotice) return;
    const timer = window.setTimeout(() => setSocialNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [socialNotice]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const closeSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setSearchOpen(false);
  };

  const flushExploreLikeBoundary094 = async () => {
    if (!user) return;
    try {
      await flushPendingExploreLikesForPageExit(user);
    } catch (reason) {
      console.warn('[094] Explore like boundary sync retained locally:', reason);
      setSocialNotice('좋아요 변경분은 기기에 보관됐어요. 다음 화면 이동 때 다시 동기화합니다.');
    }
  };

  const openProfile = async (track: ExploreTrack) => {
    if (!track.ownerUid) return;
    await flushExploreLikeBoundary094();
    setSearchParams({ profile: track.ownerUid });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProfile = async () => {
    await flushExploreLikeBoundary094();
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadMoreFeed = async () => {
    if (profileUid || submittedQuery || !feedNextCursor || loadingMore) return;
    const apiSort = sort === 'popular' ? 'popular' : 'latest';
    const params = new URLSearchParams({ sort: apiSort, limit: '40', cursor: feedNextCursor });
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const response = await fetch(EXPLORE_API_BASE + '/v1/feed?' + params.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json() as ExploreApiResponse;
      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
      const normalized = rows.map(normalizeTrack).filter((track) => track.id);
      const displayRows = overlayActorLikeCounts120(normalized);
      syncSharedPublicCountsToLocal110(normalized);
      setTracks((previous) => {
        const seen = new Set(previous.map((track) => track.id));
        return [...previous, ...displayRows.filter((track) => !seen.has(track.id))];
      });
      setFeedNextCursor(safeText(payload?.data?.nextCursor) || null);
    } catch (reason) {
      console.warn('Explore feed load-more failed:', reason);
      setLoadMoreError('이전 공개곡을 불러오지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoadingMore(false);
    }
  };

  // App 120 no longer reads or writes the old 069/071 actor refresh cache.
  // Heart/count state is immediate locally; failed 20-second batch attempts surface
  // a notice while the newest outbox remains durable for the next interaction.
  useEffect(() => {
    const onLikeSyncError = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string; message?: string }>).detail;
      if (!user?.uid || String(detail?.uid || '').trim() !== user.uid) return;
      setSocialNotice(String(detail?.message || '좋아요 변경분을 최신 기기 캐시에 보관했어요.'));
    };
    window.addEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);
    return () => window.removeEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);
  }, [user?.uid]);

  const toggleLike = async (track: ExploreTrack) => {
    if (!user) {
      setSocialNotice('좋아요는 로그인 후 사용할 수 있어요.');
      return;
    }
    // The service's one effective membership includes any pending click.
    // Never toggle from a possibly stale/undefined React display boolean.
    const currentLiked = readExploreTrackLikeMembership127(user.uid, track.id);
    if (currentLiked === undefined) {
      setSocialNotice('좋아요 상태를 확인하고 있어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    likeInteractionVersionRef090.current += 1;
    setLikeBusyTrackId(track.id);
    try {
      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);
      const optimisticTrack = { ...track, likeCount: result.likeCount };
      const patchOptimisticCount120 = (previous: ExploreTrack[]) => previous.map((item) => (
        item.id === track.id ? { ...item, likeCount: result.likeCount } : item
      ));
      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));
      setTracks(patchOptimisticCount120);
      setProfileTracks(patchOptimisticCount120);
      setProfileLikedTracks((previous) => {
        const patched = patchOptimisticCount120(previous);
        if (!result.liked) return patched.filter((item) => item.id !== track.id);
        const rest = patched.filter((item) => item.id !== track.id);
        return [optimisticTrack, ...rest];
      });
      patchExploreFeedSessionCachesRow(track.id, { likeCount: result.likeCount });
      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: result.likeCount });
      patchExploreLikedTrackCachedCount091(user.uid, track.id, result.likeCount);
      rememberExploreLikedTrack(user.uid, optimisticTrack as unknown as Record<string, unknown>, result.liked);
    } catch (reason) {
      console.error('Explore like failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '좋아요 처리에 실패했어요.');
    } finally {
      setLikeBusyTrackId(null);
    }
  };

  const toggleFollow = async () => {
    if (!profileUid || !profile) return;
    if (!user) {
      setSocialNotice('팔로우는 로그인 후 사용할 수 있어요.');
      return;
    }
    if (user.uid === profile.uid || followBusy) return;
    const nextShouldFollow = !Boolean(followState?.isFollowing);
    setFollowBusy(true);
    try {
      const result = await setExploreFollow(user, profile.uid, nextShouldFollow);
      setFollowState(result);
      patchExplorePublicProfileFirstViewProfile(profile.uid, {
        followerCount: result.followerCount || (nextShouldFollow ? profile.followerCount + 1 : Math.max(0, profile.followerCount - 1)),
        followingCount: result.followingCount || profile.followingCount,
      });
      setProfile((prev) => prev ? {
        ...prev,
        followerCount: result.followerCount || (nextShouldFollow ? prev.followerCount + 1 : Math.max(0, prev.followerCount - 1)),
        followingCount: result.followingCount || prev.followingCount,
      } : prev);
    } catch (reason) {
      console.error('Explore follow failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '팔로우 처리에 실패했어요.');
    } finally {
      setFollowBusy(false);
    }
  };

  const renderTrackGrid = (items: ExploreTrack[], label: string) => (
    <section className="soridraw-explore-grid" aria-label={label}>
      {items.map((track) => {
        return (
          <ExploreTrackCard
            key={track.id}
            track={track}
            liked={Boolean(likedTrackIds[track.id])}
            likeBusy={likeBusyTrackId === track.id || (Boolean(user) && likedTrackIds[track.id] === undefined)}
            onToggleLike={toggleLike}
            onOpenProfile={openProfile}
          />
        );
      })}
    </section>
  );

  if (profileUid) {
    return (
      <main className="soridraw-explore-page">
        <section className="soridraw-explore-profile-toolbar">
          <button type="button" onClick={closeProfile} className="soridraw-explore-back-button" aria-label="Explore로 돌아가기">
            <ArrowLeft aria-hidden="true" />
          </button>
          <span>공개 프로필</span>
        </section>

        {socialNotice && <div className="soridraw-explore-social-notice" role="status">{socialNotice}</div>}

        {profileLoading ? (
          <div className="soridraw-explore-state" role="status"><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 프로필을 불러오는 중</div>
        ) : profileError || !profile ? (
          <div className="soridraw-explore-state soridraw-explore-state--empty">
            <Compass aria-hidden="true" />
            <strong>공개 프로필을 열지 못했어요.</strong>
            <span>{profileError || '잠시 후 다시 시도해주세요.'}</span>
          </div>
        ) : (
          <>
            <section className={`soridraw-explore-profile-head${profile.backgroundUrl ? ' has-background' : ''}`}>
              {profile.backgroundUrl && (
                <div className="soridraw-explore-profile-background" aria-hidden="true">
                  <img src={profile.backgroundUrl} alt="" referrerPolicy="no-referrer" />
                  <span />
                </div>
              )}
              <div className="soridraw-explore-profile-content">
                <div className="soridraw-explore-profile-avatar" aria-hidden="true">
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : profile.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="soridraw-explore-profile-copy">
                  <div className="soridraw-explore-profile-name-line">
                    <h1>{user?.uid === profile.uid && ['SORIDRAW 사용자', 'SORIDRAW User', 'SORiDRAW', 'SORIDRAW'].includes(profile.nickname) ? (user.displayName || user.email?.split('@')[0] || profile.nickname) : profile.nickname}</h1>
                    {user?.uid === profile.uid ? (
                      <button type="button" className="soridraw-explore-profile-edit-button" onClick={() => setProfileEditOpen(true)}>
                        <Pencil aria-hidden="true" /> 편집
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={toggleFollow}
                        disabled={followBusy}
                        className={`soridraw-explore-follow-button${followState?.isFollowing ? ' is-following' : ''}`}
                      >
                        {followBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : followState?.isFollowing ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                        {followState?.isFollowing ? '팔로잉' : '팔로우'}
                      </button>
                    )}
                  </div>
                  {profile.handle && <div className="soridraw-explore-profile-handle">@{profile.handle}</div>}
                  {profile.bio && <p>{profile.bio}</p>}
                  <div className="soridraw-explore-profile-stats">
                    <span>팔로워 <strong>{formatCount(profile.followerCount)}</strong></span>
                    <span>팔로잉 <strong>{formatCount(profile.followingCount)}</strong></span>
                    <span>공개곡 <strong>{formatCount(profile.trackCount || profileTracks.length)}</strong></span>
                  </div>
                  {profile.genres.length > 0 && <div className="soridraw-explore-profile-genres">{profile.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}
                  {(profile.socialLinks.spotify || profile.socialLinks.instagram || profile.socialLinks.tiktok) && (
                    <div className="soridraw-explore-profile-social-links">
                      {profile.socialLinks.spotify && <a href={profile.socialLinks.spotify} target="_blank" rel="noreferrer">Spotify</a>}
                      {profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                      {profile.socialLinks.tiktok && <a href={profile.socialLinks.tiktok} target="_blank" rel="noreferrer">TikTok</a>}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {profileEditOpen && user?.uid === profile.uid && (
              <ExploreProfileEditModal
                user={user}
                profile={profile}
                onClose={() => setProfileEditOpen(false)}
                onSaved={(nextProfile) => {
                  setProfile(nextProfile);
                  rememberExplorePublicProfileFirstViewProfile(nextProfile);
                  if (nextProfile.handle) setSearchParams({ profile: `@${nextProfile.handle}` }, { replace: true });
                }}
              />
            )}

            {profileIsOwn && (
              <nav className="soridraw-explore-tabs" aria-label="내 공개 프로필 곡 보기">
                <button
                  type="button"
                  className={profileCollection === 'public' ? 'is-active' : undefined}
                  onClick={() => setProfileCollection('public')}
                  aria-current={profileCollection === 'public' ? 'page' : undefined}
                >
                  공개곡
                </button>
                <button
                  type="button"
                  className={profileCollection === 'liked' ? 'is-active' : undefined}
                  onClick={() => setProfileCollection('liked')}
                  aria-current={profileCollection === 'liked' ? 'page' : undefined}
                >
                  좋아요 곡
                </button>
              </nav>
            )}

            {profileIsOwn && profileCollection === 'liked' ? (
              profileLikedLoading ? (
                <div className="soridraw-explore-state" role="status"><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 좋아요 곡을 불러오는 중</div>
              ) : profileLikedError ? (
                <div className="soridraw-explore-state">{profileLikedError}</div>
              ) : profileLikedTracks.length === 0 ? (
                <div className="soridraw-explore-state soridraw-explore-state--empty">
                  <Heart aria-hidden="true" />
                  <strong>아직 좋아요한 곡이 없어요.</strong>
                </div>
              ) : (
                renderTrackGrid(profileLikedTracks, `${profile.nickname} 좋아요 곡`)
              )
            ) : profileTracks.length === 0 ? (
              <div className="soridraw-explore-state soridraw-explore-state--empty">
                <Music2 aria-hidden="true" />
                <strong>아직 공개된 곡이 없어요.</strong>
              </div>
            ) : (
              <>
                {profileTracks.some((track) => track.profilePinned) && (
                  <div className="soridraw-explore-profile-section-label"><Pin aria-hidden="true" /> 고정된 공개곡</div>
                )}
                {renderTrackGrid(profileTracks, `${profile.nickname} 공개곡`)}
              </>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="soridraw-explore-page">
      {socialNotice && <div className="soridraw-explore-social-notice" role="status">{socialNotice}</div>}
      <section className="soridraw-explore-head">
        <div>
          <div className="soridraw-explore-title-line">
            <Compass aria-hidden="true" />
            <h1>Explore</h1>
          </div>
          <p>SORiDRAW에서 발견한 음악을 Suno에서 바로 만나보세요.</p>
        </div>

        <div className={`soridraw-explore-search${searchOpen ? ' is-open' : ''}`}>
          {searchOpen ? (
            <form onSubmit={submitSearch}>
              <Search aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="곡 또는 크리에이터 검색"
                aria-label="Explore 검색"
              />
              <button type="button" onClick={closeSearch} aria-label="검색 닫기"><X aria-hidden="true" /></button>
            </form>
          ) : (
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Explore 검색 열기" title="검색">
              <Search aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      <nav className="soridraw-explore-tabs" aria-label="Explore 정렬">
        {([
          ['recommended', '추천'],
          ['latest', '최신'],
          ['popular', '인기'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={sort === value ? 'is-active' : undefined}
            onClick={() => {
              setSort(value);
              if (submittedQuery) {
                setSubmittedQuery('');
                setQuery('');
              }
            }}
            aria-current={sort === value ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {submittedQuery && (
        <div className="soridraw-explore-search-result-label">
          <strong>“{submittedQuery}”</strong> 검색 결과
        </div>
      )}

      {loading ? (
        <div className="soridraw-explore-state" role="status"><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 곡을 불러오는 중</div>
      ) : error ? (
        <div className="soridraw-explore-state">{error}</div>
      ) : tracks.length === 0 ? (
        <div className="soridraw-explore-state soridraw-explore-state--empty">
          <Compass aria-hidden="true" />
          <strong>{submittedQuery ? '검색 결과가 없어요.' : '아직 공개된 곡이 없어요.'}</strong>
          <span>{submittedQuery ? '다른 검색어로 찾아보세요.' : '공개된 곡이 생기면 이곳에 표시됩니다.'}</span>
        </div>
      ) : (
        <>
          {renderTrackGrid(tracks, 'Explore 곡 목록')}
          {!submittedQuery && feedNextCursor && (
            <div className="soridraw-explore-load-more">
              <button type="button" onClick={loadMoreFeed} disabled={loadingMore}>
                {loadingMore ? <><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 불러오는 중</> : '더 보기'}
              </button>
            </div>
          )}
          {loadMoreError && <div className="soridraw-explore-load-more-error" role="status">{loadMoreError}</div>}
        </>
      )}
    </main>
  );
}
