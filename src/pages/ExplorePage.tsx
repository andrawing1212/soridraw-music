import { EXPLORE_VIEWER_GENRES_EVENT, readExploreViewerGenres } from '../services/exploreCreatorProfileCache';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { rankExploreCreators } from '../services/exploreCreatorRecommendations';
import { readCachedExplorePublicProfile } from '../services/exploreProfileFirstViewService';
// SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE
// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975
// SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000
// SORIDRAW_EXPLORE_PUBLIC_PROFILE_PARITY_048
// SORIDRAW_EXPLORE_FEED_COMPLETENESS_049
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Compass, Crown, Disc3, EllipsisVertical, Grid3X3, Heart, Instagram, List, Loader2, Music2, NotebookTabs, Pencil, Play, RefreshCw, Reply, Search, Settings, ThumbsDown, UserCheck, UserPlus, X, Youtube } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../firebase';
import { GENRES, GENRE_HIERARCHY } from '../constants';
import { doc, getDoc, updateDoc } from '../lib/firestoreMeasured';
import { favoritesStore } from '../hooks/useFavoritesStore';
import { runV1MutationBoundary } from '../data/v1MutationBoundary';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';
import {
  readExploreFeedSessionCache,
  readExploreFeedSessionCacheRevision,
  writeExploreFeedSessionCache,
  patchExploreFeedSessionCachesRow,
  upsertExploreFeedSessionCacheRow,
  removeExploreFeedSessionCacheRow,
  readExploreSearchCache340,
  writeExploreSearchCache340,
} from '../services/exploreSessionCache';
import {
  EXPLORE_LIKE_SYNC_ERROR_EVENT,
  EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT,
  flushPendingExploreLikesForPageExit,
  getExploreKnownLikeCandidateIds127,
  getExploreLikedTrackIds,
  checkExplorePersonalLikeRevision127,
  ensureExplorePersonalLikeBaseline127,
  ensureExplorePersonalLikeCrossOriginParity357,
  readExploreTrackLikeMembership127,
  normalizeExploreLikeDisplayPair129,
  overlayExploreLikeDisplayCounts,
  reconcileExploreLikedTrackCollectionState,
  setExploreTrackLike,
  subscribeExploreLikeUiSync139,
} from '../services/exploreLikeService';
import {
  getExploreLikedTrackCollectionIds,
  getExploreLikedTracks,
  patchExploreLikedTrackCachedCount091,
  rememberExploreLikedTrack,
} from '../services/exploreLikedTracksService';
import { getExplorePublicProfileFirstView, revalidateExplorePublicProfileFirstView335, patchExplorePublicProfileFirstViewProfile, patchExplorePublicProfileFirstViewTrack, upsertExplorePublicProfileFirstViewTrack, removeExplorePublicProfileFirstViewTrack, rememberExplorePublicProfileFirstViewProfile } from '../services/exploreProfileFirstViewService';
import {
  fetchExplorePublicLikeCards192,
  subscribeExplorePublicLikeInvalidation192,
  type ExplorePublicLikeSignalRow192,
} from '../services/explorePublicLikeSyncService';
import {
  getExploreFollowState,
  getExploreFollowingUids312,
  getExploreProfileConnections,
  patchExploreFollowLocalState377,
  readExploreFollowMembership379,
  readExploreFollowingExactCount379,
  readExploreProfileConnectionExactCount379,
  getExplorePublicProfile,
  getExplorePublicProfileTracks,
  setExploreFollow,
  type ExploreFollowState,
  type ExploreProfileConnection,
  type ExploreProfileConnectionDirection,
  type ExplorePublicProfile,
} from '../services/exploreSocialService';
import {
  publishExploreFollowSync377,
  subscribeExploreFollowSync377,
} from '../services/exploreFollowSyncService';
import {
  EXPLORE_FOLLOW_IDLE_FLUSH_MS_380,
  queueExploreFollowFinalState380,
  readPendingExploreFollowIntents380,
} from '../services/exploreFollowBatchService380';
import { syncSoridrawProfileAvatarAuthority } from '../services/profileAvatarAuthority';
import ExploreProfileEditModal from '../components/explore/ExploreProfileEditModal';
import ExplorePublicationSettingsModal from '../components/explore/ExplorePublicationSettingsModal';
import {
  buildExploreLegacyApplyKeywords,
  getExploreOwnMusicNoteApplyKeywords,
  getExploreTrackApplySource,
  getExploreTrackSaveAccess,
  markExploreTrackDisliked,
  readExploreDislikedTrackIds,
} from '../services/exploreTrackActionService';
import {
  getExploreSharedNoteFolders,
  getExploreSharedNoteSavedFolderLocal274,
  saveExploreTrackToSharedNote,
  type ExploreSharedNoteFolder,
} from '../services/exploreSharedNoteService';
import {
  refreshExploreMusicNotePublicationSource,
  setExploreTrackPublicationOptions,
  setExploreTrackVisibility,
  type ExplorePublicationOptions,
} from '../services/explorePublicationService';
import {
  EXPLORE_PUBLICATION_SYNC_EVENT,
  readLatestExplorePublicationSyncSignal,
  type ExplorePublicationSyncSignal,
} from '../services/userDomainSyncService';
import {
  getExploreCurationAccess307,
  getManagedSoridrawCuratedTracks307,
  getSoridrawCuratedTracks307,
  revalidateSoridrawCuratedTracks335,
  setSoridrawCuratedTrack307,
  type ExploreCurationAccess307,
} from '../services/exploreCurationService';
import '../components/explore/explore.css';

type ExploreSort = 'recommended' | 'latest' | 'popular';

const EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304 = 20;
const EXPLORE_POPULAR_FEED_REQUEST_URL_304 = `${EXPLORE_API_BASE}/v1/feed?sort=popular&limit=40`;

type ExploreTrack = {
  ownerProfileGenres?: string[] | null;
  id: string;
  ownerUid: string;
  ownerHandle: string;
  title: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  sunoUrlPrimary?: string | null;
  sunoUrlSecondary?: string | null;
  openUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceSubTrackKey?: string | null;
  sourceSubTrackIndex?: number | null;
  sourceSubTrackId?: string | null;
  durationSeconds?: number | null;
  style?: string | null;
  primaryGenre?: string | null;
  prompt?: string | null;
  lyrics?: string | null;
  lyricsParts?: { korean?: string | null; foreign?: string | null } | null;
  allowNextSongApply: boolean;
  allowFollowerSave: boolean;
  shareBundle?: {
    schemaVersion?: number;
    selectedKeywords?: Record<string, unknown>;
    nextSong?: Record<string, unknown> | null;
  } | null;
  likeCount: number;
  publishedAt: number;
  profilePinned: boolean;
};

type ExplorePublicationSunoLink = {
  url: string;
  title?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  durationText?: string | null;
  rank?: 1 | 2;
  updatedAt?: number;
  fetchedAt?: number;
};

type ExplorePublicationSettingsState = {
  track: ExploreTrack;
  options: ExplorePublicationOptions;
  sourceId: string;
  sourceSong: Record<string, any> | null;
  sunoLinks: ExplorePublicationSunoLink[];
  selectedSunoIndex: 0 | 1;
  initialSunoIndex: 0 | 1;
};

const normalizeExplorePublicationSunoLink = (raw: any, index: number): ExplorePublicationSunoLink | null => {
  const url = safeText(raw?.url ?? raw?.sunoShareUrl ?? raw?.sunoUrl);
  if (!url) return null;
  const duration = Number(raw?.durationSeconds ?? raw?.duration);
  const rankValue = Number(raw?.rank);
  return {
    url,
    title: safeText(raw?.title) || null,
    coverUrl: safeText(raw?.coverUrl ?? raw?.imageUrl ?? raw?.artworkUrl) || null,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
    durationText: safeText(raw?.durationText) || null,
    rank: rankValue === 2 ? 2 : rankValue === 1 ? 1 : (index === 0 ? 1 : 2),
    updatedAt: Number(raw?.updatedAt || 0) || undefined,
    fetchedAt: Number(raw?.fetchedAt || 0) || undefined,
  };
};

const getExplorePublicationSunoLinks = (song: any, track?: ExploreTrack | null): ExplorePublicationSunoLink[] => {
  const raw = Array.isArray(song?.sunoLinks)
    ? song.sunoLinks
    : Array.isArray(song?.sunoShareLinks)
      ? song.sunoShareLinks
      : [];
  const links = raw
    .map((link: any, index: number) => normalizeExplorePublicationSunoLink(link, index))
    .filter(Boolean) as ExplorePublicationSunoLink[];
  if (links.length) return links.slice(0, 2);

  const legacyPrimary = safeText(song?.sunoShareUrl ?? song?.sunoUrl ?? song?.sunoSongUrl ?? track?.sunoUrlPrimary);
  const legacySecondary = safeText(track?.sunoUrlSecondary);
  const fallback: ExplorePublicationSunoLink[] = [];
  if (legacyPrimary) fallback.push({
    url: legacyPrimary,
    title: safeText(song?.sunoTitle) || track?.title || null,
    coverUrl: safeText(song?.sunoCoverUrl ?? song?.sunoImageUrl ?? song?.sunoArtworkUrl ?? track?.coverUrl) || null,
    durationSeconds: Number(song?.sunoDurationSeconds || track?.durationSeconds || 0) || null,
    durationText: safeText(song?.sunoDurationText) || null,
    rank: 1,
  });
  if (legacySecondary && legacySecondary !== legacyPrimary) fallback.push({
    url: legacySecondary,
    title: track?.title || null,
    coverUrl: null,
    durationSeconds: track?.durationSeconds || null,
    durationText: null,
    rank: 2,
  });
  return fallback.slice(0, 2);
};

const readExplorePublicationSourceFromLocal = (uid: string, sourceId: string): Record<string, any> | null => {
  const safeSourceId = String(sourceId || '').trim();
  if (!uid || !safeSourceId) return null;
  const live = favoritesStore.getFavorites().find((item: any) => (
    String(item?.id || item?.firestoreId || '').trim() === safeSourceId
  ));
  if (live) return live as Record<string, any>;
  try {
    const raw = window.localStorage.getItem(`soridraw_favorites_cache_${uid}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return null;
    return parsed.find((item: any) => String(item?.id || item?.firestoreId || '').trim() === safeSourceId) || null;
  } catch {
    return null;
  }
};

const resolveExplorePublicationMainIndex = (
  song: any,
  track: ExploreTrack,
  links: ExplorePublicationSunoLink[],
): 0 | 1 => {
  if (links.length <= 1) return 0;
  const publicPrimary = safeText(track.sunoUrlPrimary);
  const publicIndex = links.findIndex((link) => safeText(link.url) === publicPrimary);
  if (publicIndex === 1) return 1;
  if (publicIndex === 0) return 0;
  const saved = Number(song?.mainSunoIndex);
  if (saved === 0 || saved === 1) return saved as 0 | 1;
  return links.findIndex((link) => Number(link.rank) === 1) === 1 ? 1 : 0;
};

const buildExplorePublicationMainSelectionUpdates = (
  links: ExplorePublicationSunoLink[],
  requestedIndex: 0 | 1,
) => {
  const mainIndex = (requestedIndex === 1 && links[1] ? 1 : 0) as 0 | 1;
  const selected = links[mainIndex] || links[0] || null;
  const now = Date.now();
  const rankedLinks = links.map((link, index) => ({ ...link, rank: index === mainIndex ? 1 as const : 2 as const }));
  return {
    sunoLinks: rankedLinks,
    mainSunoIndex: mainIndex,
    sunoLinkCount: rankedLinks.length,
    sunoShareUrl: selected?.url || null,
    sunoShareUrlUpdatedAt: now,
    sunoCoverUrl: selected?.coverUrl || null,
    sunoTitle: selected?.title || null,
    sunoDurationSeconds: selected?.durationSeconds ?? null,
    sunoDurationText: selected?.durationText || null,
    sunoCoverFetchedAt: selected?.fetchedAt || now,
    updatedAtMs: now,
  };
};

const patchExplorePublicationSourceLocalCache = (uid: string, sourceId: string, patch: Record<string, any>) => {
  const current = favoritesStore.getFavorites();
  let storeChanged = false;
  const next = current.map((item: any) => {
    if (String(item?.id || item?.firestoreId || '').trim() !== sourceId) return item;
    storeChanged = true;
    return { ...item, ...patch };
  });
  if (storeChanged) favoritesStore.setFavorites(next);

  try {
    const key = `soridraw_favorites_cache_${uid}`;
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return;
    let changed = false;
    const cached = parsed.map((item: any) => {
      if (String(item?.id || item?.firestoreId || '').trim() !== sourceId) return item;
      changed = true;
      return { ...item, ...patch };
    });
    if (changed) window.localStorage.setItem(key, JSON.stringify(cached));
  } catch {}
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
// SORIDRAW_EXPLORE_ENTRY_REVISION_REVALIDATION_126_20260920
// The last successful check survives Explore route remounts within this tab.
// Rendering cached rows must never reset this clock: otherwise opening Explore
// hides a cross-device unlike behind a fresh two-minute delay.
const exploreFeedLastRevisionCheckAt126 = new Map<string, number>();
// app334: keep the existing two-minute feed revision gate across browser reloads.
// The cached Feed remains the first paint; a reload itself is not a data-change signal.
const EXPLORE_FEED_REVISION_CHECK_STORAGE_PREFIX_334 = 'soridraw:explore:feed-revision-check-at:v1';
const exploreFeedRevisionCheckStorageKey334 = (key: string) =>
  `${EXPLORE_FEED_REVISION_CHECK_STORAGE_PREFIX_334}:${encodeURIComponent(key)}`;
const readExploreFeedLastRevisionCheckAt334 = (key: string) => {
  const memory = exploreFeedLastRevisionCheckAt126.get(key);
  if (memory) return memory;
  if (typeof window === 'undefined') return 0;
  try {
    const stored = Number(window.localStorage.getItem(exploreFeedRevisionCheckStorageKey334(key)) || 0);
    if (Number.isFinite(stored) && stored > 0) {
      exploreFeedLastRevisionCheckAt126.set(key, stored);
      return stored;
    }
  } catch {}
  return 0;
};
const writeExploreFeedLastRevisionCheckAt334 = (key: string, checkedAt = Date.now()) => {
  exploreFeedLastRevisionCheckAt126.set(key, checkedAt);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(exploreFeedRevisionCheckStorageKey334(key), String(checkedAt));
  } catch {}
};
// SORIDRAW_EXPLORE_CROSS_ACCOUNT_SHARED_FEED_REVALIDATION_154_20260924
// Public Feed data is shared, but a revision-check timestamp must never leak
// across signed-in accounts in the same browser/tab. Otherwise account B can
// inherit account A's recent gate and keep an older public like count.
const exploreFeedRevisionCheckKey154 = (uid: string | null | undefined, requestUrl: string) =>
  `${String(uid || 'guest').trim() || 'guest'}::${requestUrl}`;
const shouldRevalidateExploreFeedOnEntry126 = (
  feedRequest: boolean,
  explicitRevision: boolean,
  lastCheckedAt: number,
  now: number,
) => feedRequest
  && explicitRevision
  && (
    !lastCheckedAt
    || now - lastCheckedAt >= EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS
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
// The marker persists across app updates. A code release by itself cannot
// trigger another shared Feed data read; real revisions use the existing check.
const EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX = 'soridraw:explore:shared-like-cache-repair:124';

// SORIDRAW_EXPLORE_UPDATE_FIRST_SHARED_CONVERGENCE_125_20260920
// A release refreshes only the bounded shared first-page R2 snapshot, not canonical D1.
const exploreSharedLikeCacheRepairKey124 = (feedUrl: string) => {
  try {
    const parsed = new URL(feedUrl);
    const sort = parsed.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
    return `${EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX}:${sort}`;
  } catch {
    return `${EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX}:latest`;
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

// SORIDRAW_EXPLORE_KOREAN_GENRE_SEARCH_337_20261004
// The visible query stays exactly as the user typed it. Korean genre labels are
// translated only into extra R2 genre lookup hints, so one search request can
// match the same English genre labels stored on public tracks without creating
// extra D1 requests.
const normalizeExploreSearchLabel337 = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s_-]+/g, ' ')
  .trim();

const getExploreGenreAliases337 = (query: string) => {
  const normalized = normalizeExploreSearchLabel337(query);
  if (!normalized) return [] as string[];

  const aliases: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const text = safeText(value);
    const key = normalizeExploreSearchLabel337(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    aliases.push(text);
  };

  const broadAliases: Array<[RegExp, string[]]> = [
    [/발라드/, ['Ballad']],
    [/(?:시티\s*팝|시티팝)/, ['City Pop']],
    [/힙합/, ['Hip-hop']],
    [/(?:알앤비|r&b|rnb)/i, ['R&B']],
    [/재즈/, ['Jazz']],
    [/트로트/, ['Trot']],
    [/(?:록|락)/, ['Rock']],
    [/메탈/, ['Metal']],
    [/하우스/, ['House']],
    [/테크노/, ['Techno']],
    [/트랜스/, ['Trance']],
    [/(?:앰비언트|엠비언트)/, ['Ambient']],
    [/로파이/, ['Lo-fi']],
    [/포크/, ['Folk']],
    [/컨트리/, ['Country']],
    [/소울/, ['Soul']],
    [/펑크/, ['Funk', 'Punk']],
    [/클래식/, ['Classical']],
  ];
  broadAliases.forEach(([pattern, values]) => {
    if (pattern.test(normalized)) values.forEach(push);
  });

  GENRES.forEach((genre) => {
    const ko = normalizeExploreSearchLabel337(genre.labelKo);
    const en = normalizeExploreSearchLabel337(genre.label);
    if (!ko && !en) return;
    if (
      ko === normalized
      || en === normalized
      || (normalized.length >= 2 && ko.includes(normalized))
      || (ko.length >= 2 && normalized.includes(ko))
    ) {
      push(genre.label);
    }
  });
  return aliases.slice(0, 8);
};

const safeExternalSocialHref244 = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
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
  ownerProfileGenres: Array.isArray(row.ownerProfileGenres) ? row.ownerProfileGenres.filter((v): v is string => typeof v === 'string').slice(0, 5) : null,
  ownerHandle: safeText(row.ownerHandle ?? row.owner_handle).replace(/^@+/, ''),
  title: safeText(row.title, '제목 없는 곡'),
  displayName: safeText(row.ownerNickname ?? row.displayName ?? row.ownerDisplayName, 'SORiDRAW'),
  avatarUrl: safeText(row.ownerAvatarUrl ?? row.avatarUrl) || null,
  coverUrl: safeText(row.coverUrl) || null,
  sunoUrlPrimary: safeText(row.sunoUrlPrimary ?? row.suno_url_primary) || null,
  sunoUrlSecondary: safeText(row.sunoUrlSecondary ?? row.suno_url_secondary) || null,
  openUrl: safeText(row.openUrl) || null,
  sourceType: safeText(row.sourceType ?? row.source_type) || null,
  sourceId: safeText(row.sourceId ?? row.source_id) || null,
  sourceSubTrackKey: safeText(row.sourceSubTrackKey ?? row.source_subtrack_key) || null,
  sourceSubTrackIndex: Number.isFinite(Number(row.sourceSubTrackIndex ?? row.source_subtrack_index))
    ? Number(row.sourceSubTrackIndex ?? row.source_subtrack_index)
    : null,
  sourceSubTrackId: safeText(row.sourceSubTrackId ?? row.source_subtrack_id) || null,
  durationSeconds: Number.isFinite(Number(row.durationSeconds ?? row.duration_seconds))
    ? Number(row.durationSeconds ?? row.duration_seconds)
    : null,
  style: safeText(row.style) || null,
  primaryGenre: safeText(row.primaryGenre ?? row.primary_genre) || null,
  prompt: safeText(row.prompt) || null,
  lyrics: safeText(row.lyrics) || null,
  allowNextSongApply: Boolean(row.allowNextSongApply ?? row.allow_next_song_apply),
  allowFollowerSave: Boolean(row.allowFollowerSave ?? row.allow_follower_save),
  shareBundle: row.shareBundle && typeof row.shareBundle === 'object' && !Array.isArray(row.shareBundle)
    ? row.shareBundle as ExploreTrack['shareBundle']
    : null,
  likeCount: readNestedCount(row, 'likeCount'),
  publishedAt: safeCount(row.publishedAt ?? row.published_at),
  profilePinned: Boolean(row.profilePinned ?? row.profile_pinned ?? (row.options as Record<string, unknown> | undefined)?.profilePinned),
});

const comparePublicProfileTracks = (a: ExploreTrack, b: ExploreTrack) => {
  // Profile pinning is only for the dedicated "고정 곡" rail.
  // "전체 곡" must stay in normal publication order regardless of pin state.
  if (a.publishedAt !== b.publishedAt) return b.publishedAt - a.publishedAt;
  return b.id.localeCompare(a.id);
};

// SORIDRAW_EXPLORE_PROFILE_OWNER_CARD_SYNC_215_20260928
// A saved public-profile avatar/name must immediately repaint every already-loaded
// card owned by that profile. This is local-only; the Worker/D1 profile change
// signal remains the cross-device authority and no extra server read/write is added.
const patchExploreTrackOwnerProfile215 = (
  track: ExploreTrack,
  nextProfile: ExplorePublicProfile,
): ExploreTrack => track.ownerUid === nextProfile.uid ? {
  ...track,
  ownerHandle: nextProfile.handle,
  displayName: nextProfile.nickname,
  avatarUrl: nextProfile.avatarUrl || null,
} : track;

// SORIDRAW_EXPLORE_CARD_AVATAR_UNIFIED_218_20260928
// One display resolver is shared by Explore Feed and public-profile grids.
// - Public-profile page: the loaded public profile is authoritative.
// - Feed/search/recommended/latest/popular: the signed-in owner's effective
//   Firebase Auth photoURL is authoritative for that owner's own cards.
//   app194 keeps that photoURL aligned to SORIDRAW public-profile > Google.
// - Other owners keep the server-projected public-profile avatar already on track.
// This adds no request and does not touch like/publication logic.
const applyExploreCardAvatarAuthority218 = (
  track: ExploreTrack,
  currentUser: User | null,
  ownerProfileAuthority: ExplorePublicProfile | null,
): ExploreTrack => {
  if (ownerProfileAuthority && track.ownerUid === ownerProfileAuthority.uid) {
    return patchExploreTrackOwnerProfile215(track, ownerProfileAuthority);
  }
  if (currentUser?.uid && track.ownerUid === currentUser.uid && currentUser.photoURL) {
    return track.avatarUrl === currentUser.photoURL
      ? track
      : { ...track, avatarUrl: currentUser.photoURL };
  }
  return track;
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

const EXPLORE_PUBLIC_PROFILE_COMPLETE_WINDOW_LIMIT = 50;

const resolveExplorePublicTrackCount = (
  profileTrackCount: number,
  loadedTracks: ExploreTrack[],
) => {
  // The first-view profile window returns at most 50 public tracks. If fewer
  // than 50 are loaded, the device already has the complete public-track set,
  // so its exact length is safer than a stale maintained counter.
  if (loadedTracks.length < EXPLORE_PUBLIC_PROFILE_COMPLETE_WINDOW_LIMIT) {
    return loadedTracks.length;
  }
  return Math.max(safeCount(profileTrackCount), loadedTracks.length);
};

const formatCount = (value: number) => {
  if (value >= 10000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}K`;
  return String(value);
};

// SORIDRAW_EXPLORE_TITLE_DISPLAY_218_20260928
// Published titles may arrive as quoted single-language titles or quoted
// bilingual pairs such as '한국어' | 'English'. Keep the stored title intact
// and normalize only the Explore card display.
const stripExploreTitleWrapperQuotes218 = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const pairs: Array<[string, string]> = [
    ["'", "'"],
    ['"', '"'],
    ['‘', '’'],
    ['“', '”'],
  ];
  for (const [open, close] of pairs) {
    if (
      trimmed.length > open.length + close.length
      && trimmed.startsWith(open)
      && trimmed.endsWith(close)
    ) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return trimmed
    .replace(/^[‘’“”'"]+/, '')
    .replace(/[‘’“”'"]+$/, '')
    .trim();
};

const normalizeExploreDisplayTitle218 = (value: string) => value
  .split(/\s*[|│]\s*/)
  .map(stripExploreTitleWrapperQuotes218)
  .filter(Boolean)
  .join(' | ');

const getExploreCardDisplayTitle = (track: ExploreTrack) => {
  const raw = safeText(track.title, '제목 없는 곡');
  const genreMatch = raw.match(/^\s*(\[[^\]\r\n]{1,80}\])\s*(.*)$/);
  const titleGenre = genreMatch?.[1] || '';
  const selectedKeywords = track.shareBundle?.selectedKeywords;
  const selectedGenres = selectedKeywords && typeof selectedKeywords === 'object'
    ? (selectedKeywords as Record<string, unknown>).genres
    : null;
  const selectedGenre = Array.isArray(selectedGenres)
    ? safeText(selectedGenres.find((value) => safeText(value)))
    : safeText(selectedGenres);
  const fallbackGenre = safeText(track.primaryGenre) || selectedGenre;
  const normalizedFallbackGenre = fallbackGenre.replace(/^\[|\]$/g, '').trim();
  const genre = titleGenre || (normalizedFallbackGenre ? `[${normalizedFallbackGenre}]` : '');
  const titleSource = (genreMatch?.[2] ?? raw).trim();
  const title = normalizeExploreDisplayTitle218(titleSource) || '제목 없는 곡';
  return { genre, title };
};

type ExploreGenreTier343 = 'major' | 'detail';

type ExploreGenreRecommendation221 = {
  id: string;
  label: string;
  tier: ExploreGenreTier343;
  sortOrder: number;
  tracks: ExploreTrack[];
};

type ExploreCreatorRecommendation221 = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  track: ExploreTrack;
};

type ExploreRecommendationModel221 = {
  picks: ExploreTrack[];
  genres: ExploreGenreRecommendation221[];
  creators: ExploreCreatorRecommendation221[];
};

// SORIDRAW_EXPLORE_GENRE_MAJOR_DETAIL_ROWS_343_20261004
// The first row is always broad genres. The second row is independent detail
// genres from the current Feed. Clicking a broad genre never expands/replaces
// the detail row; both rows are local projections of the same already-loaded
// Feed and therefore add no Worker/D1/Firestore reads.
type ExploreGenreCatalogEntry342 = {
  id: string;
  label: string;
  labelKo: string;
  branchId: string;
};

type ExploreMajorGenre343 = {
  id: string;
  label: string;
  order: number;
};

const EXPLORE_MAJOR_GENRES_343: ExploreMajorGenre343[] = [
  { id: 'pop', label: '팝', order: 10 },
  { id: 'kpop', label: 'K-Pop', order: 20 },
  { id: 'jpop', label: 'J-Pop', order: 30 },
  { id: 'hiphop', label: '힙합', order: 40 },
  { id: 'rnb', label: 'R&B', order: 50 },
  { id: 'soul', label: '소울', order: 60 },
  { id: 'funk', label: '펑크', order: 70 },
  { id: 'rock', label: '록', order: 80 },
  { id: 'metal', label: '메탈', order: 90 },
  { id: 'edm', label: 'EDM', order: 100 },
  { id: 'jazz', label: '재즈', order: 110 },
  { id: 'folk', label: '포크', order: 120 },
  { id: 'acoustic', label: '어쿠스틱', order: 130 },
  { id: 'country', label: '컨트리', order: 140 },
  { id: 'world', label: '월드뮤직', order: 150 },
  { id: 'reggae', label: '레게', order: 160 },
  { id: 'latin', label: '라틴', order: 170 },
  { id: 'afro', label: '아프로', order: 180 },
  { id: 'trot', label: '트로트', order: 190 },
  { id: '7080', label: '7080 가요', order: 200 },
  { id: 'classical', label: '클래식', order: 210 },
  { id: 'cinematic', label: '시네마틱', order: 220 },
  { id: 'instrumental', label: '연주곡', order: 230 },
];

const EXPLORE_MAJOR_GENRE_BY_ID_343 = new Map(
  EXPLORE_MAJOR_GENRES_343.map((genre) => [genre.id, genre]),
);

const normalizeExploreGenreCatalogKey342 = (value: unknown) => safeText(value)
  .normalize('NFKC')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9가-힣]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compactExploreGenreCatalogKey342 = (value: unknown) => (
  normalizeExploreGenreCatalogKey342(value).replace(/\s+/g, '')
);

const EXPLORE_GENRE_CATALOG_342 = (() => {
  const entries: ExploreGenreCatalogEntry342[] = [];
  const seen = new Set<string>();

  const pushEntry = (node: any, branchId = '') => {
    if (!node || typeof node !== 'object') return;
    const id = safeText(node.id);
    const label = safeText(node.label);
    const labelKo = safeText(node.labelKo);
    if (!id || (!label && !labelKo) || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, label: label || id, labelKo, branchId });
  };

  // Hierarchy first so label/id aliases inherit their broad branch.
  (GENRE_HIERARCHY as any[]).forEach((group) => {
    if (!Array.isArray(group?.children)) return;
    group.children.forEach((branch: any) => {
      const branchId = safeText(branch?.id);
      pushEntry(branch, branchId);
      if (Array.isArray(branch?.children)) {
        branch.children.forEach((child: any) => {
          const visit = (node: any) => {
            pushEntry(node, branchId);
            if (Array.isArray(node?.children)) node.children.forEach(visit);
          };
          visit(child);
        });
      }
    });
  });

  (GENRES as any[]).forEach((entry) => pushEntry(entry, ''));
  return entries;
})();

const EXPLORE_GENRE_LOOKUP_342 = (() => {
  const lookup = new Map<string, ExploreGenreCatalogEntry342>();
  const add = (value: unknown, entry: ExploreGenreCatalogEntry342) => {
    const normalized = normalizeExploreGenreCatalogKey342(value);
    const compact = compactExploreGenreCatalogKey342(value);
    if (normalized && !lookup.has(normalized)) lookup.set(normalized, entry);
    if (compact && !lookup.has(compact)) lookup.set(compact, entry);
  };
  EXPLORE_GENRE_CATALOG_342.forEach((entry) => {
    add(entry.id, entry);
    add(entry.label, entry);
    add(entry.labelKo, entry);
  });
  return lookup;
})();

const formatUnknownExploreGenre342 = (value: string) => {
  const cleaned = safeText(value).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || /[가-힣]/.test(cleaned)) return cleaned;
  return cleaned
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (['r&b', 'edm', 'ost', 'bgm', 'k-pop', 'j-pop'].includes(lower)) return word.toUpperCase();
      return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
    })
    .join(' ');
};

const resolveExploreMajorGenre343 = (
  entry: ExploreGenreCatalogEntry342 | null,
  rawValue: string,
): ExploreMajorGenre343 | null => {
  const branchId = safeText(entry?.branchId);
  const id = safeText(entry?.id).toLowerCase();
  const key = normalizeExploreGenreCatalogKey342(
    [entry?.id, entry?.label, entry?.labelKo, rawValue].filter(Boolean).join(' '),
  );

  let majorId = '';
  if (branchId === 'pop') majorId = 'pop';
  else if (branchId === 'kpop') majorId = 'kpop';
  else if (branchId === 'jpop') majorId = 'jpop';
  else if (branchId === 'hiphop') majorId = 'hiphop';
  else if (branchId === 'rnb') {
    if (['neo_soul', 'soul', 'soul_blues'].includes(id)) majorId = 'soul';
    else if (id === 'funk') majorId = 'funk';
    else majorId = 'rnb';
  } else if (branchId === 'rock') majorId = 'rock';
  else if (branchId === 'metal') majorId = 'metal';
  else if (branchId === 'edm' || branchId === 'bass_synth') majorId = 'edm';
  else if (branchId === 'jazz') majorId = 'jazz';
  else if (branchId === 'acoustic_folk') {
    if (/country|bluegrass/.test(key)) majorId = 'country';
    else if (/acoustic session|fingerstyle/.test(key)) majorId = 'acoustic';
    else majorId = 'folk';
  } else if (branchId === 'world_music_folk') majorId = 'world';
  else if (branchId === 'global_rhythm') {
    if (/reggae/.test(key) && !/reggaeton/.test(key)) majorId = 'reggae';
    else if (/afro/.test(key)) majorId = 'afro';
    else majorId = 'latin';
  } else if (branchId === 'trot') majorId = 'trot';
  else if (branchId === '7080_gayo') majorId = '7080';
  else if (branchId === 'classical') majorId = 'classical';
  else if (branchId === 'theme_score') majorId = 'cinematic';
  else if (branchId === 'instrumental_bgm') majorId = 'instrumental';

  // Historical/unknown labels may not have a hierarchy branch. Keep this
  // intentionally broad and never create combined "A / B" major labels.
  if (!majorId) {
    if (/k[ -]?pop|케이팝/.test(key)) majorId = 'kpop';
    else if (/j[ -]?pop|제이팝/.test(key)) majorId = 'jpop';
    else if (/hip hop|hiphop|힙합|rap|랩|drill|드릴|boom bap|붐뱁/.test(key)) majorId = 'hiphop';
    else if (/neo soul|soul|소울/.test(key)) majorId = 'soul';
    else if (/funk|펑크/.test(key)) majorId = 'funk';
    else if (/r and b|rnb|알앤비/.test(key)) majorId = 'rnb';
    else if (/metal|메탈|hardcore/.test(key)) majorId = 'metal';
    else if (/rock|록|락/.test(key)) majorId = 'rock';
    else if (/jazz|재즈|bossa|보사노바/.test(key)) majorId = 'jazz';
    else if (/edm|house|techno|trance|dubstep|electro|synth|hardstyle|전자/.test(key)) majorId = 'edm';
    else if (/country|bluegrass|컨트리|블루그래스/.test(key)) majorId = 'country';
    else if (/acoustic|어쿠스틱|fingerstyle|핑거스타일/.test(key)) majorId = 'acoustic';
    else if (/folk|포크/.test(key)) majorId = 'folk';
    else if (/reggae|레게/.test(key)) majorId = 'reggae';
    else if (/afro|아프로/.test(key)) majorId = 'afro';
    else if (/latin|salsa|reggaeton|차차차|라틴/.test(key)) majorId = 'latin';
    else if (/trot|트로트/.test(key)) majorId = 'trot';
    else if (/7080/.test(key)) majorId = '7080';
    else if (/classical|클래식|opera|오페라|orchestra|오케스트라/.test(key)) majorId = 'classical';
    else if (/cinematic|score|theme|trailer|bgm|시네마틱|스코어|테마/.test(key)) majorId = 'cinematic';
    else if (/instrumental|연주/.test(key)) majorId = 'instrumental';
    else if (/pop|팝/.test(key)) majorId = 'pop';
  }

  return EXPLORE_MAJOR_GENRE_BY_ID_343.get(majorId) || null;
};

const resolveExploreRecommendationGenre343 = (track: ExploreTrack) => {
  const raw = (
    getExploreCardDisplayTitle(track).genre.replace(/^\[|\]$/g, '').trim()
    || safeText(track.primaryGenre).replace(/^\[|\]$/g, '').trim()
  );
  if (!raw) return null;

  const normalized = normalizeExploreGenreCatalogKey342(raw);
  const compact = compactExploreGenreCatalogKey342(raw);
  const known = EXPLORE_GENRE_LOOKUP_342.get(normalized) || EXPLORE_GENRE_LOOKUP_342.get(compact) || null;
  const detailLabel = known
    ? (safeText(known.labelKo) || safeText(known.label, raw))
    : formatUnknownExploreGenre342(raw);
  const detailKey = normalizeExploreGenreCatalogKey342(known?.label || known?.id || detailLabel);
  const major = resolveExploreMajorGenre343(known, raw);

  const majorMatchesDetail = major && (
    normalizeExploreGenreCatalogKey342(major.label) === normalizeExploreGenreCatalogKey342(detailLabel)
    || normalizeExploreGenreCatalogKey342(major.id) === normalizeExploreGenreCatalogKey342(known?.id)
  );

  return {
    major,
    detail: majorMatchesDetail || !detailKey || !detailLabel
      ? null
      : { key: detailKey, label: detailLabel },
  };
};

const readExploreRecommendationGenre221 = (track: ExploreTrack) => {
  const genre = resolveExploreRecommendationGenre343(track);
  return genre?.detail?.label || genre?.major?.label || '';
};

const readExplorePinnedKeywordList235 = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => safeText(item).replace(/^\[|\]$/g, '').trim())
    .filter(Boolean);
};

const getExplorePinnedKeywords235 = (track: ExploreTrack): string[] => {
  const selected = track.shareBundle?.selectedKeywords && typeof track.shareBundle.selectedKeywords === 'object'
    ? track.shareBundle.selectedKeywords as Record<string, unknown>
    : {};
  const styleFallbacks = safeText(track.style)
    .split(/[,/|·;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [
    readExploreRecommendationGenre221(track),
    ...readExplorePinnedKeywordList235(selected.moods).slice(0, 1),
    ...readExplorePinnedKeywordList235(selected.themes).slice(0, 1),
    ...readExplorePinnedKeywordList235(selected.styles).slice(0, 1),
    ...readExplorePinnedKeywordList235(selected.sounds).slice(0, 1),
    ...styleFallbacks,
  ].filter(Boolean);

  const seen = new Set<string>();
  return candidates.filter((keyword) => {
    const normalized = keyword.toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 4);
};

// app221/app343 — Keep recommendations local-first. Broad and detail genre
// rows are independent projections of the already-loaded 40-card Feed.
const buildExploreRecommendationModel221 = (
  items: ExploreTrack[],
  currentUid = '',
): ExploreRecommendationModel221 => {
  const source = items.slice(0, 40);
  const majorBuckets = new Map<string, {
    label: string;
    sortOrder: number;
    tracks: ExploreTrack[];
    trackIds: Set<string>;
  }>();
  const detailBuckets = new Map<string, {
    label: string;
    firstIndex: number;
    tracks: ExploreTrack[];
    trackIds: Set<string>;
  }>();

  source.forEach((track, index) => {
    const genre = resolveExploreRecommendationGenre343(track);
    if (genre?.major) {
      const current = majorBuckets.get(genre.major.id);
      if (current) {
        if (!current.trackIds.has(track.id)) {
          current.trackIds.add(track.id);
          current.tracks.push(track);
        }
      } else {
        majorBuckets.set(genre.major.id, {
          label: genre.major.label,
          sortOrder: genre.major.order,
          tracks: [track],
          trackIds: new Set([track.id]),
        });
      }
    }

    if (genre?.detail?.key && genre.detail.label) {
      const current = detailBuckets.get(genre.detail.key);
      if (current) {
        if (!current.trackIds.has(track.id)) {
          current.trackIds.add(track.id);
          current.tracks.push(track);
        }
      } else {
        detailBuckets.set(genre.detail.key, {
          label: genre.detail.label,
          firstIndex: index,
          tracks: [track],
          trackIds: new Set([track.id]),
        });
      }
    }

  });

  const majorGenres: ExploreGenreRecommendation221[] = [...majorBuckets.entries()]
    .map(([key, bucket]) => ({
      id: `genre-major-${key}`,
      label: bucket.label,
      tier: 'major' as const,
      sortOrder: bucket.sortOrder,
      tracks: bucket.tracks.slice(0, 20),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const detailGenres: ExploreGenreRecommendation221[] = [...detailBuckets.entries()]
    .map(([key, bucket]) => ({
      id: `genre-detail-${key.replace(/[^a-z0-9가-힣]+/g, '-')}`,
      label: bucket.label,
      tier: 'detail' as const,
      sortOrder: bucket.firstIndex,
      tracks: bucket.tracks.slice(0, 20),
    }))
    .sort((a, b) => b.tracks.length - a.tracks.length || a.sortOrder - b.sortOrder);

  return {
    picks: source.slice(0, 20),
    genres: [...majorGenres, ...detailGenres],
    creators: [],
  };
};

const handleExploreGenreRowWheel342 = (event: React.WheelEvent<HTMLDivElement>) => {
  const row = event.currentTarget;
  const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
  if (maxScrollLeft <= 1) return;

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;
  const next = Math.min(maxScrollLeft, Math.max(0, row.scrollLeft + delta));
  if (Math.abs(next - row.scrollLeft) < 1) return;

  row.scrollLeft = next;
  event.preventDefault();
};

const EXPLORE_RAIL_RELEASE_ALIGN_DELAY_MS_261 = 100;
const EXPLORE_MOBILE_SHORT_DRAG_MAX_MS_241 = 240;
const EXPLORE_MOBILE_SHORT_DRAG_MIN_PX_241 = 8;
const EXPLORE_MOBILE_SHORT_DRAG_MAX_PX_241 = 46;
const EXPLORE_RAIL_CONTROLS_IDLE_HIDE_MS_251 = 500;
const EXPLORE_RAIL_CONTROLS_TAP_SHOW_MS_251 = 2_000;

function ExploreRecommendationRail({
  title,
  subtitle,
  itemCount,
  toolbar,
  trackClassName = '',
  itemLabel = '곡',
  mobileGroupSize = 3,
  resetToStartKey,
  children,
}: {
  title: string;
  subtitle?: string;
  itemCount: number;
  toolbar?: React.ReactNode;
  trackClassName?: string;
  itemLabel?: string;
  mobileGroupSize?: 1 | 2 | 3;
  resetToStartKey?: string;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railAlignTimerRef251 = useRef<number | null>(null);
  const railControlsTimerRef251 = useRef<number | null>(null);
  const railMouseHoverRef252 = useRef(false);
  const railPointerActiveRef261 = useRef(false);
  const railReleaseAlignPendingRef261 = useRef(false);
  const railReleaseMomentumSettleRef263 = useRef(false);
  const mobilePointerGestureRef241 = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
    startScrollLeft: number;
  } | null>(null);
  const suppressRailClickUntilRef241 = useRef(0);
  const previousResetToStartKey375 = useRef<string | undefined>(resetToStartKey);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [railControlsVisible251, setRailControlsVisible251] = useState(true);
  const isProfilePinnedRail242 = trackClassName.includes('soridraw-explore-recommend-track--profile-pinned');
  const mobileAlignGroupSize231 = mobileGroupSize;

  const clearRailAlignTimer251 = () => {
    if (railAlignTimerRef251.current == null) return;
    window.clearTimeout(railAlignTimerRef251.current);
    railAlignTimerRef251.current = null;
  };

  const clearRailControlsTimer251 = () => {
    if (railControlsTimerRef251.current == null) return;
    window.clearTimeout(railControlsTimerRef251.current);
    railControlsTimerRef251.current = null;
  };

  const scheduleRailControlsHide251 = (delayMs: number) => {
    clearRailControlsTimer251();
    if (railMouseHoverRef252.current) return;
    railControlsTimerRef251.current = window.setTimeout(() => {
      if (!railMouseHoverRef252.current) {
        setRailControlsVisible251(false);
      }
      railControlsTimerRef251.current = null;
    }, delayMs);
  };

  const revealRailControls251 = (visibleMs = EXPLORE_RAIL_CONTROLS_TAP_SHOW_MS_251) => {
    setRailControlsVisible251(true);
    scheduleRailControlsHide251(visibleMs);
  };

  const alignExploreRail251 = () => {
    railAlignTimerRef251.current = null;
    railReleaseAlignPendingRef261.current = false;
    railReleaseMomentumSettleRef263.current = false;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const track = scroller.firstElementChild as HTMLElement | null;
    if (!track) return;
    const cards = Array.from(track.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (cards.length <= mobileAlignGroupSize231) return;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (maxScrollLeft <= 1) return;

    const current = scroller.scrollLeft;

    // SORIDRAW_EXPLORE_RAIL_SYMMETRIC_HALF_SNAP_253_20260930
    // Snap to the nearest card-start anchor. The midpoint between adjacent
    // anchors is the exact 50% boundary, so right/left drags use the same rule
    // on mobile, tablet, and PC instead of direction-biased visible-group scoring.
    const anchors = cards
      .map((card) => Math.min(maxScrollLeft, Math.max(0, card.offsetLeft)))
      .filter((position, index, source) => (
        index === 0 || Math.abs(position - source[index - 1]) > 1
      ));

    let target = anchors[0] ?? 0;
    let bestDistance = Math.abs(current - target);
    for (let index = 1; index < anchors.length; index += 1) {
      const candidate = anchors[index];
      const distance = Math.abs(current - candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = candidate;
      }
    }

    if (Math.abs(target - current) < 1) return;
    scroller.scrollTo({ left: target, behavior: 'smooth' });
  };

  const scheduleExploreRailAlign251 = (fromPointerRelease261 = false) => {
    clearRailAlignTimer251();
    if (fromPointerRelease261) {
      railReleaseAlignPendingRef261.current = true;
    }
    railAlignTimerRef251.current = window.setTimeout(
      alignExploreRail251,
      EXPLORE_RAIL_RELEASE_ALIGN_DELAY_MS_261,
    );
  };

  const scheduleExploreRailMoveAfterRelease261 = (direction: -1 | 1) => {
    clearRailAlignTimer251();
    railReleaseAlignPendingRef261.current = true;
    railAlignTimerRef251.current = window.setTimeout(() => {
      railAlignTimerRef251.current = null;
      railReleaseAlignPendingRef261.current = false;
      moveRail(direction);
    }, EXPLORE_RAIL_RELEASE_ALIGN_DELAY_MS_261);
  };

  const syncScrollButtons = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setCanScrollLeft(scroller.scrollLeft > 2);
    setCanScrollRight(scroller.scrollLeft < maxScrollLeft - 2);
  };

  const syncRailVisualCenter256 = () => {
    const scroller = scrollerRef.current;
    const stage = scroller?.parentElement;
    const firstCard = scroller?.firstElementChild?.firstElementChild as HTMLElement | null;
    const visual = firstCard?.querySelector<HTMLElement>(
      '.soridraw-explore-cover-wrap, .soridraw-explore-recommend-creator-avatar',
    );
    if (!stage || !visual) return;

    const stageRect = stage.getBoundingClientRect();
    const visualRect = visual.getBoundingClientRect();
    const imageCenterY = visualRect.top - stageRect.top + (visualRect.height / 2);
    stage.style.setProperty('--soridraw-explore-rail-image-center-y', `${imageCenterY}px`);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncScrollButtons();
      syncRailVisualCenter256();
      scheduleRailControlsHide251(EXPLORE_RAIL_CONTROLS_IDLE_HIDE_MS_251);
    });
    const handleResize = () => {
      syncScrollButtons();
      syncRailVisualCenter256();
      setRailControlsVisible251(true);
      scheduleRailControlsHide251(EXPLORE_RAIL_CONTROLS_IDLE_HIDE_MS_251);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      clearRailAlignTimer251();
      clearRailControlsTimer251();
    };
  }, [itemCount]);

  useLayoutEffect(() => {
    if (resetToStartKey == null) return;
    const previousKey = previousResetToStartKey375.current;
    previousResetToStartKey375.current = resetToStartKey;
    if (previousKey === resetToStartKey) return;

    // app375 — when a newly published track becomes the first item in the
    // chronological Latest rail, the browser may preserve the old horizontal
    // scroll offset and leave that new first card just outside the left edge.
    // Reset only rails that explicitly opt in; other recommendation rails keep
    // the user's current position.
    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      clearRailAlignTimer251();
      scroller.scrollTo({ left: 0, behavior: 'auto' });
      syncScrollButtons();
      syncRailVisualCenter256();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetToStartKey]);

  const getRailCards241 = () => {
    const scroller = scrollerRef.current;
    const track = scroller?.firstElementChild as HTMLElement | null;
    if (!scroller || !track) return [];
    return Array.from(track.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
  };

  const getRailViewportStepCount243 = (cards: HTMLElement[]) => {
    const scroller = scrollerRef.current;
    if (!scroller || cards.length <= 1) return 1;

    const first = cards[0];
    const second = cards[1];
    const step = Math.abs(second.offsetLeft - first.offsetLeft);
    if (step <= 1) return 1;

    const cardWidth = Math.max(1, first.offsetWidth);
    const gap = Math.max(0, step - cardWidth);
    const visibleCount = Math.floor((scroller.clientWidth + gap + 1) / step);
    return Math.max(1, Math.min(cards.length, visibleCount));
  };

  const moveRail = (
    direction: -1 | 1,
    stepMode: 'single' | 'viewport' = 'single',
  ) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const cards = getRailCards241();
    if (cards.length === 0) return;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const current = scroller.scrollLeft;
    const rawPositions = cards.map((card) => Math.max(0, card.offsetLeft));
    const stepCount = stepMode === 'viewport' ? getRailViewportStepCount243(cards) : 1;
    const maxStartIndex = Math.max(0, cards.length - stepCount);

    let anchorIndex = 0;
    let anchorDistance = Number.POSITIVE_INFINITY;
    rawPositions.forEach((position, index) => {
      const clamped = Math.min(maxScrollLeft, position);
      const distance = Math.abs(clamped - current);
      if (distance < anchorDistance) {
        anchorIndex = index;
        anchorDistance = distance;
      }
    });

    const targetIndex = direction > 0
      ? Math.min(stepMode === 'viewport' ? maxStartIndex : cards.length - 1, anchorIndex + stepCount)
      : Math.max(0, anchorIndex - stepCount);
    const target = Math.min(maxScrollLeft, rawPositions[targetIndex] ?? 0);

    clearRailAlignTimer251();
    revealRailControls251();
    scroller.scrollTo({ left: target, behavior: 'smooth' });
  };

  const handleRailPointerDown241 = (event: React.PointerEvent<HTMLDivElement>) => {
    railPointerActiveRef261.current = true;
    railReleaseAlignPendingRef261.current = false;
    railReleaseMomentumSettleRef263.current = false;
    clearRailAlignTimer251();
    revealRailControls251();
    const scroller = scrollerRef.current;
    if (
      !scroller
      || event.pointerType !== 'touch'
    ) {
      mobilePointerGestureRef241.current = null;
      return;
    }
    mobilePointerGestureRef241.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      startScrollLeft: scroller.scrollLeft,
    };
  };

  const handleRailPointerUp241 = (event: React.PointerEvent<HTMLDivElement>) => {
    railPointerActiveRef261.current = false;
    const scroller = scrollerRef.current;
    const gesture = mobilePointerGestureRef241.current;
    mobilePointerGestureRef241.current = null;

    if (
      !scroller
      || !gesture
      || gesture.pointerId !== event.pointerId
    ) {
      scheduleExploreRailAlign251(true);
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const dragDistance = Math.abs(deltaX);
    const scrollDistance = Math.abs(scroller.scrollLeft - gesture.startScrollLeft);
    const elapsed = performance.now() - gesture.startedAt;
    const shortControlledDrag = (
      elapsed <= EXPLORE_MOBILE_SHORT_DRAG_MAX_MS_241
      && dragDistance >= EXPLORE_MOBILE_SHORT_DRAG_MIN_PX_241
      && dragDistance <= EXPLORE_MOBILE_SHORT_DRAG_MAX_PX_241
      && Math.abs(deltaY) <= 28
      && scrollDistance <= 72
    );

    if (shortControlledDrag) {
      suppressRailClickUntilRef241.current = performance.now() + 280;
      scheduleExploreRailMoveAfterRelease261(deltaX < 0 ? 1 : -1);
      return;
    }

    railReleaseMomentumSettleRef263.current = event.pointerType === 'touch';
    scheduleExploreRailAlign251(true);
  };

  const handleRailClickCapture241 = (event: React.MouseEvent<HTMLDivElement>) => {
    if (performance.now() >= suppressRailClickUntilRef241.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <section className="soridraw-explore-recommend-section">
      <header className="soridraw-explore-recommend-head">
        <div>
          <span>CURATED</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {toolbar}
      <div
        className={`soridraw-explore-recommend-stage${isProfilePinnedRail242 ? ' soridraw-explore-recommend-stage--profile-pinned' : ''}${!railControlsVisible251 ? ' is-controls-hidden' : ''}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'mouse') return;
          railMouseHoverRef252.current = true;
          clearRailControlsTimer251();
          setRailControlsVisible251(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') return;
          railMouseHoverRef252.current = false;
          clearRailControlsTimer251();
          setRailControlsVisible251(false);
        }}
      >
        <button
          type="button"
          className="soridraw-explore-recommend-edge soridraw-explore-recommend-edge--left"
          onClick={() => moveRail(-1, 'viewport')}
          disabled={!canScrollLeft}
          aria-label={`${title} 이전 ${itemLabel} 보기`}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div
          ref={scrollerRef}
          className="soridraw-explore-recommend-scroll"
          onPointerDown={handleRailPointerDown241}
          onPointerUp={handleRailPointerUp241}
          onPointerCancel={(event) => {
            mobilePointerGestureRef241.current = null;

            // app262 — touch pointercancel is not a real finger release.
            // Mobile browsers may cancel Pointer Events as soon as native
            // horizontal scrolling takes ownership, while the finger is still
            // on the screen. Keep the held guard active and wait for touchend.
            if (event.pointerType === 'touch') {
              return;
            }

            railPointerActiveRef261.current = false;
            scheduleExploreRailAlign251(true);
          }}
          onTouchEnd={() => {
            if (!railPointerActiveRef261.current) return;
            railPointerActiveRef261.current = false;
            railReleaseMomentumSettleRef263.current = true;

            // If pointerup already armed the release snap, do not restart it.
            if (!railReleaseAlignPendingRef261.current) {
              scheduleExploreRailAlign251(true);
            }
          }}
          onClickCapture={handleRailClickCapture241}
          onScroll={() => {
            syncScrollButtons();
            setRailControlsVisible251(true);
            scheduleRailControlsHide251(EXPLORE_RAIL_CONTROLS_IDLE_HIDE_MS_251);

            // app261 — while a finger or mouse button is still held, scrolling
            // must never arm the snap timer. The 0.1s snap starts from release.
            // Wheel/trackpad scrolling has no pointer-release signal, so it keeps
            // the bounded 0.1s scroll-idle fallback.
            if (railPointerActiveRef261.current) {
              return;
            }

            // app263 — after a strong touch flick, native momentum can continue
            // producing scroll events after the finger is released. Re-arm the
            // 0.1s settle from the latest inertial scroll so our smooth snap
            // never fights the browser's deceleration. Small releases with no
            // momentum still settle 0.1s after release.
            if (railReleaseMomentumSettleRef263.current) {
              scheduleExploreRailAlign251(true);
              return;
            }

            if (railReleaseAlignPendingRef261.current) {
              return;
            }
            scheduleExploreRailAlign251();
          }}
        >
          <div className={`soridraw-explore-recommend-track${trackClassName ? ` ${trackClassName}` : ''}`}>
            {children}
          </div>
        </div>
        <button
          type="button"
          className="soridraw-explore-recommend-edge soridraw-explore-recommend-edge--right"
          onClick={() => moveRail(1, 'viewport')}
          disabled={!canScrollRight}
          aria-label={`${title} 다음 ${itemLabel} 보기`}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function ExploreCreatorCard221({
  creator,
  onOpen,
}: {
  creator: ExploreCreatorRecommendation221;
  onOpen: (track: ExploreTrack) => void;
}) {
  return (
    <button
      type="button"
      className="soridraw-explore-recommend-creator-card"
      onClick={() => onOpen(creator.track)}
      aria-label={`${creator.displayName} 공개 프로필 보기`}
    >
      <span className="soridraw-explore-recommend-creator-avatar" aria-hidden="true">
        {creator.avatarUrl
          ? <img src={creator.avatarUrl} alt="" referrerPolicy="no-referrer" />
          : creator.displayName.charAt(0).toUpperCase()}
      </span>
      <strong>{creator.displayName}</strong>
      {creator.handle && <small>@{creator.handle}</small>}
    </button>
  );
}

const EXPLORE_PREVIEW_MAX_MS_222 = 210_000;
const EXPLORE_EQ_BUTTON_BAR_COUNT_225 = 5;
const EXPLORE_PREVIEW_SESSION_KEY_237 = 'soridraw:explore:preview-visual:v1';

type ExplorePreviewVisualState237 = {
  trackId: string;
  expiresAt: number;
};

const readExplorePreviewVisualState237 = (): ExplorePreviewVisualState237 | null => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(EXPLORE_PREVIEW_SESSION_KEY_237) || 'null');
    const trackId = safeText(parsed?.trackId);
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!trackId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(EXPLORE_PREVIEW_SESSION_KEY_237);
      return null;
    }
    return { trackId, expiresAt };
  } catch {
    try { window.sessionStorage.removeItem(EXPLORE_PREVIEW_SESSION_KEY_237); } catch {}
    return null;
  }
};

const writeExplorePreviewVisualState237 = (state: ExplorePreviewVisualState237) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(EXPLORE_PREVIEW_SESSION_KEY_237, JSON.stringify(state));
  } catch {}
};

const clearExplorePreviewVisualState237 = (trackId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (trackId) {
      const current = readExplorePreviewVisualState237();
      if (current?.trackId !== trackId) return;
    }
    window.sessionStorage.removeItem(EXPLORE_PREVIEW_SESSION_KEY_237);
  } catch {}
};

function ExploreTrackCard({
  track,
  liked,
  likeBusy,
  isPreviewing,
  onTogglePreview,
  onToggleLike,
  onOpenProfile,
  onApplyNext,
  onShare,
  onOpenMore,
  variant = 'default',
  showPublisher = true,
}: {
  track: ExploreTrack;
  liked: boolean;
  likeBusy: boolean;
  isPreviewing: boolean;
  onTogglePreview: (track: ExploreTrack) => void;
  onToggleLike: (track: ExploreTrack) => void;
  onOpenProfile: (track: ExploreTrack) => void;
  onApplyNext: (track: ExploreTrack) => void;
  onShare: (track: ExploreTrack) => void;
  onOpenMore: (track: ExploreTrack) => void;
  variant?: 'default' | 'profilePinnedBanner' | 'profileList';
  showPublisher?: boolean;
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
  const cardDisplayTitle = getExploreCardDisplayTitle(track);
  const pinnedKeywords235 = variant === 'profilePinnedBanner'
    ? getExplorePinnedKeywords235(track)
    : [];

  return (
    <article className={`soridraw-explore-card${variant === 'profilePinnedBanner' ? ' soridraw-explore-card--profile-pinned' : ''}${variant === 'profileList' ? ' soridraw-explore-card--profile-list' : ''}${isPreviewing ? ' is-previewing' : ''}`}>
      <div className="soridraw-explore-cover-wrap">
        {variant === 'profilePinnedBanner' ? (
          <div className="soridraw-explore-pinned-banner-235">
            {track.coverUrl && !imageFailed && (
              <img
                className="soridraw-explore-pinned-banner-blur-235"
                src={track.coverUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                aria-hidden="true"
              />
            )}
            <div className="soridraw-explore-pinned-banner-image-235">
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
            </div>
            <div className="soridraw-explore-pinned-banner-shade-235" aria-hidden="true" />
            <div className="soridraw-explore-pinned-banner-copy-235">
              <span>FEATURED</span>
              <h3 title={cardDisplayTitle.title}>{cardDisplayTitle.title}</h3>
              <div className="soridraw-explore-pinned-keywords-235" aria-label="곡 키워드">
                {pinnedKeywords235.map((keyword) => <em key={keyword}>{keyword}</em>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="soridraw-explore-cover-button">
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
            </span>
          </div>
        )}

        <button
          type="button"
          className="soridraw-explore-preview-trigger"
          onClick={(event) => {
            event.stopPropagation();
            // app225 — only the enlarged center control opens the Suno link.
            // The cover itself is visual-only, and active feedback stays inside
            // this control so it never looks like an in-app pause/play toggle.
            openSuno();
            onTogglePreview(track);
          }}
          disabled={!openUrl}
          aria-label={openUrl ? `${cardDisplayTitle.title} Suno에서 열기` : `${cardDisplayTitle.title} Suno 링크 없음`}
          title={openUrl ? 'Suno에서 열기' : 'Suno 링크 없음'}
        >
          {isPreviewing ? (
            <span className="soridraw-explore-preview-button-eq" aria-hidden="true">
              {Array.from({ length: EXPLORE_EQ_BUTTON_BAR_COUNT_225 }, (_, index) => (
                <i key={index} style={{ '--eq-index': index } as React.CSSProperties} />
              ))}
            </span>
          ) : (
            <Play aria-hidden="true" />
          )}
        </button>

        {variant === 'profilePinnedBanner' && (
          <div className="soridraw-explore-pinned-actions-255" aria-label="고정 곡 빠른 작업">
            <div className="soridraw-explore-pinned-top-actions-259">
              <button
                type="button"
                className={`soridraw-explore-pinned-action-255 soridraw-explore-pinned-apply-255${track.allowNextSongApply ? ' is-available' : ''}`}
                onClick={() => onApplyNext(track)}
                disabled={!track.allowNextSongApply}
                aria-label={track.allowNextSongApply ? '다음곡에 적용' : '다음곡 적용 불가'}
                title={track.allowNextSongApply ? '다음곡에 적용' : '다음곡 적용 불가'}
              >
                <RefreshCw aria-hidden="true" />
              </button>

              <button
                type="button"
                className="soridraw-explore-pinned-action-255 soridraw-explore-pinned-share-255"
                onClick={() => onShare(track)}
                aria-label="공유"
                title="공유"
              >
                <Reply className="soridraw-explore-share-icon" aria-hidden="true" />
              </button>

              <button
                type="button"
                className="soridraw-explore-pinned-action-255 soridraw-explore-pinned-more-255"
                onClick={() => onOpenMore(track)}
                aria-label="곡 더보기"
                title="더보기"
              >
                <EllipsisVertical aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              className={`soridraw-explore-like-button soridraw-explore-pinned-like-255${liked ? ' is-liked' : ''}`}
              onClick={() => onToggleLike(track)}
              disabled={likeBusy}
              title={liked ? '좋아요 취소' : '좋아요'}
              aria-label={liked ? '좋아요 취소' : '좋아요'}
            >
              {likeBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <Heart aria-hidden="true" />}
              <span>{formatCount(track.likeCount)}</span>
            </button>
          </div>
        )}
      </div>

      {variant !== 'profilePinnedBanner' && (
      <div className="soridraw-explore-card-copy">
        {cardDisplayTitle.genre && (
          <div className="soridraw-explore-card-genre">{cardDisplayTitle.genre}</div>
        )}
        <h3 title={cardDisplayTitle.title}>
          {cardDisplayTitle.title}
        </h3>
        {showPublisher && (
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
        )}
      </div>
      )}

      {variant !== 'profilePinnedBanner' && (
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
        <div className="soridraw-explore-card-quick-actions" aria-label="곡 빠른 작업">
          <button
            type="button"
            className={`soridraw-explore-quick-action soridraw-explore-quick-apply${track.allowNextSongApply ? ' is-available' : ''}`}
            onClick={() => onApplyNext(track)}
            disabled={!track.allowNextSongApply}
            aria-label={track.allowNextSongApply ? '다음곡에 적용' : '다음곡 적용 불가'}
            title={track.allowNextSongApply ? '다음곡에 적용' : '다음곡 적용 불가'}
          >
            <RefreshCw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="soridraw-explore-quick-action"
            onClick={() => onShare(track)}
            aria-label="공유"
            title="공유"
          >
            <Reply className="soridraw-explore-share-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="soridraw-explore-more-button"
            onClick={() => onOpenMore(track)}
            aria-label="곡 더보기"
            title="더보기"
          >
            <EllipsisVertical aria-hidden="true" />
          </button>
        </div>
      </div>
      )}
    </article>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileUid = safeText(searchParams.get('profile'));
  const curationManageRequested307 = searchParams.get('curation') === 'manage';
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [sort] = useState<ExploreSort>('recommended');
  const [recommendationGenreId221, setRecommendationGenreId221] = useState('');
  // SORIDRAW_EXPLORE_LATEST_FOLLOWING_FILTER_312_20261003
  // "전체" reuses the existing chronological latest Feed. "팔로잉" only
  // filters that already-loaded Feed with the viewer's existing local/R2 follow
  // bundle; it must not create a second D1 Feed query.
  const [latestPublicScope312, setLatestPublicScope312] = useState<'all' | 'following'>('all');
  const [followingUids312, setFollowingUids312] = useState<Set<string>>(() => new Set());
  const [followingLoadedUid312, setFollowingLoadedUid312] = useState('');
  const [followingLoading312, setFollowingLoading312] = useState(false);
  const [followingError312, setFollowingError312] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [tracks, setTracks] = useState<ExploreTrack[]>([]);
  const [popularTracks, setPopularTracks] = useState<ExploreTrack[]>([]);
  const [curatedTracks307, setCuratedTracks307] = useState<ExploreTrack[]>([]);
  const [curatedLoading307, setCuratedLoading307] = useState(true);
  const [managedCuratedTracks307, setManagedCuratedTracks307] = useState<ExploreTrack[]>([]);
  const [managedCuratedLoading307, setManagedCuratedLoading307] = useState(false);
  const [curationAccess307, setCurationAccess307] = useState<ExploreCurationAccess307>({ canCurate: false, curatorRole: null });
  const [curationBusyTrackId307, setCurationBusyTrackId307] = useState('');
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedTrackIds, setLikedTrackIds] = useState<Record<string, boolean>>({});
  const [likeBusyTrackId, setLikeBusyTrackId] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState('');
  const [profile, setProfile] = useState<ExplorePublicProfile | null>(null);
  const [profileTracks, setProfileTracks] = useState<ExploreTrack[]>([]);
  const [profileCollection, setProfileCollection] = useState<'public' | 'liked'>('public');
  const [profilePublicView239, setProfilePublicView239] = useState<'grid' | 'list'>('grid');
  const [profileLikedTracks, setProfileLikedTracks] = useState<ExploreTrack[]>([]);
  const [profileLikedLoading, setProfileLikedLoading] = useState(false);
  const [profileLikedError, setProfileLikedError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [followState, setFollowState] = useState<ExploreFollowState | null>(null);
  const [followBusyUid, setFollowBusyUid] = useState('');
  const activeProfileUidRef = useRef('');
  activeProfileUidRef.current = profile?.uid || profileUid || '';
  const followBusy = Boolean(profile?.uid && followBusyUid === profile.uid);
  // SORIDRAW_EXPLORE_PROFILE_CONNECTIONS_376_20261007
  // Connection cards are fetched only after an explicit followers/following click.
  // Reopening the same list in this mounted Explore session reuses the bounded page.
  const [profileConnectionsOpen376, setProfileConnectionsOpen376] = useState<ExploreProfileConnectionDirection | null>(null);
  const [profileConnectionsItems376, setProfileConnectionsItems376] = useState<ExploreProfileConnection[]>([]);
  const [profileConnectionsNextCursor376, setProfileConnectionsNextCursor376] = useState<string | null>(null);
  const [profileConnectionsLoading376, setProfileConnectionsLoading376] = useState(false);
  const [profileConnectionsLoadingMore376, setProfileConnectionsLoadingMore376] = useState(false);
  const [profileConnectionsError376, setProfileConnectionsError376] = useState('');
  const profileConnectionsCache376Ref = useRef<Map<string, { items: ExploreProfileConnection[]; nextCursor: string | null }>>(new Map());
  const profileConnectionsRequest376Ref = useRef(0);
  const followSignalVersion377Ref = useRef(0);
  const [profileEditOpen, setProfileEditOpen] = useState(false);

  useEffect(() => {
    const activeUid = String(profile?.uid || '').trim();
    if (!activeUid) return;
    // A successful local follow mutation changes the displayed count first.
    // Invalidate only the two potentially stale on-click pages; do not add any
    // server request or disturb the proven follow mutation function contract.
    profileConnectionsCache376Ref.current.delete(`${activeUid}:followers`);
    if (user?.uid) profileConnectionsCache376Ref.current.delete(`${user.uid}:following`);
  }, [profile?.followerCount, profile?.followingCount, profile?.uid, user?.uid]);
  const [moreTrack, setMoreTrack] = useState<ExploreTrack | null>(null);
  // app272 — keep the authorized full follower-save snapshot outside the lightweight
  // Feed card state. Folder selection must save this exact server-authorized object,
  // including prompt/lyrics, rather than a stale summary card from the More sheet.
  const sharedNoteAuthorizedTrackRef272 = useRef<ExploreTrack | null>(null);
  const [moreSheetMode, setMoreSheetMode] = useState<'actions' | 'folders'>('actions');
  const [moreActionBusy, setMoreActionBusy] = useState<'sharedNote' | 'apply' | 'curation' | null>(null);
  const [folderChoices, setFolderChoices] = useState<ExploreSharedNoteFolder[]>([]);
  const [sharedNoteSavedFolderId274, setSharedNoteSavedFolderId274] = useState<string | null>(null);
  const [publicationSettings, setPublicationSettings] = useState<ExplorePublicationSettingsState | null>(null);
  const [publicationSettingsBusy, setPublicationSettingsBusy] = useState(false);
  const [publicationPrivateConfirm, setPublicationPrivateConfirm] = useState(false);
  const [dislikedTrackIds, setDislikedTrackIds] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreHistoryPushedRef257 = useRef(false);
  const moreActionBusyRef257 = useRef<'sharedNote' | 'apply' | 'curation' | null>(null);
  const likeHydrationKeyRef = useRef('');
  const popularLikeHydrationKeyRef304 = useRef('');
  const [likeAccountSyncSignal, setLikeAccountSyncSignal] = useState(0);
  // app357: a retained same-account publication signal wakes only the affected
  // own-profile cache; unchanged profile entries remain local/Worker 0.
  const [profilePublicationSyncVersion357, setProfilePublicationSyncVersion357] = useState(0);
  const [feedRevisionSignal, setFeedRevisionSignal] = useState(0);
  const feedRevisionEventAtRef = useRef(0);
  const feedRevisionActivityAtRef = useRef(0);
  const feedRevisionRequestedUrlRef = useRef('');
  const likeInteractionVersionRef090 = useRef(0);
  // 192: a single Explore-level public-count listener. It never changes
  // another account's personal filled-heart state.
  const publicLikeVisibleTracksRef192 = useRef<Map<string, string>>(new Map());
  const publicLikePendingRowsRef192 = useRef<Map<string, ExplorePublicLikeSignalRow192>>(new Map());
  const publicLikeRefreshAttemptsRef192 = useRef<Map<string, number>>(new Map());
  const publicLikeRefreshTimerRef192 = useRef<number | null>(null);
  // app237 — keep the visual equalizer alive across Explore route unmounts.
  // sessionStorage preserves only a tiny local {trackId, expiresAt} marker:
  // no server read/write, and the original expiration clock never resets.
  const [activeExplorePreviewTrackId224, setActiveExplorePreviewTrackId224] = useState(
    () => readExplorePreviewVisualState237()?.trackId || '',
  );
  const explorePreviewTimerRef224 = useRef<number | null>(null);

  const clearExplorePreviewTimer224 = () => {
    if (explorePreviewTimerRef224.current == null) return;
    window.clearTimeout(explorePreviewTimerRef224.current);
    explorePreviewTimerRef224.current = null;
  };

  const expireExplorePreviewVisual237 = (trackId: string) => {
    setActiveExplorePreviewTrackId224((current) => current === trackId ? '' : current);
    clearExplorePreviewVisualState237(trackId);
    explorePreviewTimerRef224.current = null;
  };

  const scheduleExplorePreviewVisualExpiry237 = (trackId: string, expiresAt: number) => {
    clearExplorePreviewTimer224();
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      expireExplorePreviewVisual237(trackId);
      return;
    }
    explorePreviewTimerRef224.current = window.setTimeout(
      () => expireExplorePreviewVisual237(trackId),
      remainingMs,
    );
  };

  const showExploreLinkVisual224 = (track: ExploreTrack) => {
    const expiresAt = Date.now() + EXPLORE_PREVIEW_MAX_MS_222;
    setActiveExplorePreviewTrackId224(track.id);
    writeExplorePreviewVisualState237({ trackId: track.id, expiresAt });
    scheduleExplorePreviewVisualExpiry237(track.id, expiresAt);
  };

  useEffect(() => {
    const restored = readExplorePreviewVisualState237();
    if (restored) {
      setActiveExplorePreviewTrackId224(restored.trackId);
      scheduleExplorePreviewVisualExpiry237(restored.trackId, restored.expiresAt);
    } else {
      setActiveExplorePreviewTrackId224('');
    }

    return () => {
      // Route changes may unmount Explore. Stop only this component timer;
      // the persisted expiration remains authoritative until 3m30s elapses.
      clearExplorePreviewTimer224();
    };
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    likeHydrationKeyRef.current = '';
    setLikedTrackIds({});
  }), []);

  useEffect(() => {
    setDislikedTrackIds(user?.uid ? readExploreDislikedTrackIds(user.uid) : new Set());
  }, [user?.uid]);

  useEffect(() => {
    // Following membership is account-private local state. Never let another
    // account inherit the previous account's filter membership in the same tab.
    setLatestPublicScope312('all');
    setFollowingUids312(new Set());
    setFollowingLoadedUid312('');
    setFollowingLoading312(false);
    setFollowingError312('');
  }, [user?.uid]);

  // app307 — Only accounts already known locally as admin/master ask the Worker
  // for the tiny management permission. Ordinary Explore users add no auth/data read.
  useEffect(() => {
    if (!user?.uid) {
      setCurationAccess307({ canCurate: false, curatorRole: null });
      return undefined;
    }
    let cancelled = false;
    let requestInFlight = false;
    let lastSignature = '';

    const refreshAccess307 = () => {
      const cached = readUserProfileCache(user.uid) as any;
      const candidate = cached?.staffRole === 'master'
        || cached?.staffRole === 'admin'
        || cached?.role === 'admin';
      const signature = `${cached?.staffRole || ''}:${cached?.role || ''}`;
      if (!candidate) {
        lastSignature = signature;
        setCurationAccess307({ canCurate: false, curatorRole: null });
        return;
      }
      if (requestInFlight || (signature === lastSignature && lastSignature)) return;
      lastSignature = signature;
      requestInFlight = true;
      void getExploreCurationAccess307(user, signature)
        .then((access) => {
          if (!cancelled) setCurationAccess307(access);
        })
        .catch((reason) => {
          if (!cancelled) {
            console.warn('[app307] Explore management access check failed:', reason);
            setCurationAccess307({ canCurate: false, curatorRole: null });
          }
        })
        .finally(() => { requestInFlight = false; });
    };

    const onProfileCache307 = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (!detail?.uid || detail.uid === user.uid) {
        lastSignature = '';
        refreshAccess307();
      }
    };
    refreshAccess307();
    window.addEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache307);
    return () => {
      cancelled = true;
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache307);
    };
  }, [user?.uid]);

  useEffect(() => {
    sharedNoteAuthorizedTrackRef272.current = null;
    setMoreTrack(null);
    setMoreSheetMode('actions');
    setFolderChoices([]);
    setSharedNoteSavedFolderId274(null);
    setSharedNoteSavedFolderId274(null);
  }, [profileUid]);

  moreActionBusyRef257.current = moreActionBusy;

  useEffect(() => {
    if (!moreTrack || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dismissMoreFromHistory257 = () => {
      moreHistoryPushedRef257.current = false;
      sharedNoteAuthorizedTrackRef272.current = null;
      setMoreTrack(null);
      setMoreSheetMode('actions');
      setFolderChoices([]);
      setSharedNoteSavedFolderId274(null);
      setMoreActionBusy(null);
    };

    const handlePopState257 = () => {
      if (!moreHistoryPushedRef257.current) return;
      dismissMoreFromHistory257();
    };

    const handleKeyDown257 = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || moreActionBusyRef257.current !== null) return;
      if (moreHistoryPushedRef257.current) {
        window.history.back();
        return;
      }
      dismissMoreFromHistory257();
    };

    window.addEventListener('popstate', handlePopState257);
    window.addEventListener('keydown', handleKeyDown257);

    return () => {
      window.removeEventListener('popstate', handlePopState257);
      window.removeEventListener('keydown', handleKeyDown257);
      document.body.style.overflow = previousOverflow;

      if (moreHistoryPushedRef257.current) {
        moreHistoryPushedRef257.current = false;
        window.history.back();
      }
    };
  }, [moreTrack?.id]);

  // Keep a render-current index without resubscribing the RTDB listener whenever
  // React replaces a Feed/Profile array.
  publicLikeVisibleTracksRef192.current = new Map(
    [...tracks, ...popularTracks, ...curatedTracks307, ...managedCuratedTracks307, ...profileTracks, ...profileLikedTracks]
      .filter((track) => Boolean(track?.id))
      .map((track) => [track.id, track.ownerUid || '']),
  );

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    const scheduleRefresh192 = (delayMs: number) => {
      if (publicLikeRefreshTimerRef192.current != null) return;
      publicLikeRefreshTimerRef192.current = window.setTimeout(async () => {
        publicLikeRefreshTimerRef192.current = null;
        if (cancelled) return;
        const pending = [...publicLikePendingRowsRef192.current.values()];
        if (!pending.length) return;

        const ids = pending.map((row) => row.trackId);
        try {
          const cards = await fetchExplorePublicLikeCards192(ids);
          if (cancelled) return;
          const cardById = new Map(cards.map((card) => [card.trackId, card]));
          const settled = new Map<string, number>();

          for (const row of pending) {
            const card = cardById.get(row.trackId);
            // The invalidation is sent when W1 is accepted. Only an R2 card
            // written at/after that signal can be trusted as the new public count.
            if (!card || card.updatedAt < row.at) continue;
            settled.set(row.trackId, card.likeCount);
            publicLikePendingRowsRef192.current.delete(row.trackId);
            publicLikeRefreshAttemptsRef192.current.delete(row.trackId);
            const ownerUid = card.ownerUid || row.ownerUid;
            patchExploreFeedSessionCachesRow(row.trackId, { likeCount: card.likeCount });
            if (ownerUid) {
              patchExplorePublicProfileFirstViewTrack(ownerUid, row.trackId, { likeCount: card.likeCount });
            }
            patchExploreLikedTrackCachedCount091(user.uid, row.trackId, card.likeCount);
          }

          if (settled.size) {
            const patchPublicCounts192 = (previous: ExploreTrack[]) => previous.map((track) => (
              settled.has(track.id) ? { ...track, likeCount: settled.get(track.id)! } : track
            ));
            setTracks(patchPublicCounts192);
            setPopularTracks(patchPublicCounts192);
            setCuratedTracks307(patchPublicCounts192);
            setManagedCuratedTracks307(patchPublicCounts192);
            setProfileTracks(patchPublicCounts192);
            setProfileLikedTracks(patchPublicCounts192);
          }
        } catch (reason) {
          console.warn('[192] Changed-track public like refresh deferred:', reason);
        }

        // Bounded retry only while an actual changed-track signal is unresolved.
        // No idle timer and no D1 read are introduced.
        for (const [trackId] of publicLikePendingRowsRef192.current) {
          const attempts = (publicLikeRefreshAttemptsRef192.current.get(trackId) || 0) + 1;
          if (attempts >= 4) {
            publicLikePendingRowsRef192.current.delete(trackId);
            publicLikeRefreshAttemptsRef192.current.delete(trackId);
          } else {
            publicLikeRefreshAttemptsRef192.current.set(trackId, attempts);
          }
        }
        if (!cancelled && publicLikePendingRowsRef192.current.size) {
          scheduleRefresh192(5_000);
        }
      }, Math.max(0, delayMs));
    };

    const unsubscribe = subscribeExplorePublicLikeInvalidation192((signal) => {
      if (cancelled) return;
      const visible = publicLikeVisibleTracksRef192.current;
      let relevant = false;
      for (const row of signal.rows) {
        if (!visible.has(row.trackId)) continue;
        relevant = true;
        const previous = publicLikePendingRowsRef192.current.get(row.trackId);
        if (!previous || row.at >= previous.at) {
          publicLikePendingRowsRef192.current.set(row.trackId, row);
          publicLikeRefreshAttemptsRef192.current.set(row.trackId, 0);
        }
      }
      if (!relevant) return;

      // Worker192 settles the already 30-second-batched W1 queue five seconds
      // after acceptance. Wait slightly longer, then read only the changed R2 cards.
      const firstDelay = Math.max(0, signal.at + 7_000 - Date.now());
      scheduleRefresh192(firstDelay);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      publicLikePendingRowsRef192.current.clear();
      publicLikeRefreshAttemptsRef192.current.clear();
      if (publicLikeRefreshTimerRef192.current != null) {
        window.clearTimeout(publicLikeRefreshTimerRef192.current);
        publicLikeRefreshTimerRef192.current = null;
      }
    };
  }, [user?.uid]);

  // SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920
  // The same account-owned boolean drives every Heart in Feed/Profile/Liked.
  // Apply a remote accepted final-state only when no newer local outbox owns it;
  // never derive membership from the shared public likeCount.
  useEffect(() => {
    if (!user?.uid) return;
    const onRemote = (detail: {
      uid?: string; trackId?: string; ownerUid?: string; liked?: boolean; likeCount?: number; source?: string;
    }) => {
      if (detail?.source !== 'remote' || detail.uid !== user.uid ||
          !detail.trackId || typeof detail.liked !== 'boolean') return;
      // React may commit this event after a newer local click. Read the
      // service's effective membership again instead of trusting the event
      // payload as the latest state.
      const effectiveLiked127 = readExploreTrackLikeMembership127(user.uid, detail.trackId);
      if (effectiveLiked127 !== detail.liked) return;
      const pair129 = normalizeExploreLikeDisplayPair129(
        effectiveLiked127,
        Number.isSafeInteger(detail.likeCount) ? Number(detail.likeCount) : 0,
      );
      likeInteractionVersionRef090.current += 1;
      setLikedTrackIds((previous) => ({ ...previous, [detail.trackId!]: pair129.liked }));

      // Heart + count are one accepted like atom. When a canonical remote count
      // accompanies the account state, patch every loaded surface together.
      if (Number.isSafeInteger(detail.likeCount)) {
        const patchRemotePair129 = (previous: ExploreTrack[]) => previous.map((track) => (
          track.id === detail.trackId ? { ...track, likeCount: pair129.likeCount } : track
        ));
        setTracks(patchRemotePair129);
        setPopularTracks(patchRemotePair129);
        setCuratedTracks307(patchRemotePair129);
        setManagedCuratedTracks307(patchRemotePair129);
        setProfileTracks(patchRemotePair129);
        setProfileLikedTracks((previous) => {
          const patched = patchRemotePair129(previous);
          return pair129.liked ? patched : patched.filter((track) => track.id !== detail.trackId);
        });
        // A same-account RTDB acknowledgement is NOT a shared public publication.
        // Keep its count on the active UI and this account's liked-card cache only.
        patchExploreLikedTrackCachedCount091(user.uid, detail.trackId, pair129.likeCount);
      }

      // Own liked collection uses the same membership cache; load only a newly
      // liked missing card when that section is actually visible.
      setLikeAccountSyncSignal((value) => value + 1);
    };
    const onGap = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid !== user.uid) return;
      // Service only sends this after authenticated R2 reconciliation succeeds.
      // Never invalidate the just-verified baseline and start another repair.
      likeHydrationKeyRef.current = '';
      setLikeAccountSyncSignal((value) => value + 1);
    };
    const onResume = () => {
      if (document.visibilityState === 'hidden') return;
      // App134: focus/visibility may check only the tiny account-private R2
      // revision. Do not reset hydration or re-run /v1/me/likes on every focus.
      // A real revision change dispatches the existing account invalidation
      // event, which then performs one targeted reconciliation for visible IDs.
      void checkExplorePersonalLikeRevision127(user).catch((reason) => {
        console.warn('Explore like revision resume check failed:', reason);
      });
    };
    const unsubscribeLikeUi139 = subscribeExploreLikeUiSync139(user.uid, onRemote);
    // app335: focus can be emitted by a browser reload. A real tab resume is
    // represented by visibilitychange; keep that bounded private revision path.
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onGap);
    return () => {
      unsubscribeLikeUi139();
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, onGap);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (profileUid || submittedQuery) return undefined;
    let cancelled = false;
    setCuratedLoading307(true);
    void getSoridrawCuratedTracks307(false)
      .then((rows) => {
        if (cancelled) return;
        setCuratedTracks307(rows.map(normalizeTrack).filter((track) => Boolean(track.id)));
      })
      .catch((reason) => {
        if (!cancelled) console.warn('[app307] SORIDRAW curated load failed:', reason);
      })
      .finally(() => {
        if (!cancelled) setCuratedLoading307(false);
      });
    return () => { cancelled = true; };
  }, [profileUid, submittedQuery]);

  useEffect(() => {
    if (!user || !curationManageRequested307 || !curationAccess307.canCurate) return undefined;
    let cancelled = false;
    setManagedCuratedLoading307(true);
    void getManagedSoridrawCuratedTracks307(user)
      .then((rows) => {
        if (cancelled) return;
        const normalized = rows.map(normalizeTrack).filter((track) => Boolean(track.id));
        setManagedCuratedTracks307(normalized);
        // SORIDRAW_CURATED_MANAGER_PUBLIC_STATE_PARITY_311_20261003
        // Manager and public feed share the same curated R2 snapshot. When a
        // cross-device change is observed in the manager view, patch the public
        // feed state immediately too instead of showing the older local list
        // when the manager closes.
        setCuratedTracks307(normalized.slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304));
      })
      .catch((reason) => {
        if (!cancelled) setSocialNotice(reason instanceof Error ? reason.message : '승격 곡 목록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setManagedCuratedLoading307(false);
      });
    return () => { cancelled = true; };
  }, [user?.uid, curationManageRequested307, curationAccess307.canCurate]);

  const requestUrl = useMemo(() => {
    const cleanQuery = submittedQuery.trim();
    if (cleanQuery) {
      const params = new URLSearchParams({ q: cleanQuery });
      getExploreGenreAliases337(cleanQuery).forEach((genre) => params.append('genre', genre));
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
    setPopularTracks(applyPublicCounts110);
    setCuratedTracks307(applyPublicCounts110);
    setManagedCuratedTracks307(applyPublicCounts110);
    setProfileTracks(applyPublicCounts110);
    setProfileLikedTracks(applyPublicCounts110);

    // SORIDRAW_EXPLORE_PUBLIC_COUNT_CACHE_WRITE_SEPARATION_155_20260924
    // The actor's optimistic/locked count belongs only to that actor's UI and
    // personal liked cards. Never persist it into shared Feed/public-profile
    // caches where the next signed-in account would inherit a provisional count.
    sharedTracks.forEach((track) => {
      patchExploreFeedSessionCachesRow(track.id, { likeCount: track.likeCount });
      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
      if (activeUid) patchExploreLikedTrackCachedCount091(
        activeUid, track.id, countByTrackId.get(track.id) ?? track.likeCount,
      );
    });
  };

  // app355: same-account public/private/source changes arrive through one tiny
  // UID-scoped RTDB signal. Apply the returned compact public card directly to the
  // device cache/UI. This restores cross-device visibility without turning reload
  // or ordinary re-entry into a Cloudflare Worker request.
  useEffect(() => {
    const uid = String(user?.uid || '').trim();
    if (!uid) return undefined;

    const applyPublicationSignal355 = (signal: ExplorePublicationSyncSignal | null) => {
      if (!signal) return;
      const trackId = String(signal.trackId || '').trim();
      if (!trackId) return;
      if (profileUid === uid) {
        setProfilePublicationSyncVersion357((current) => Math.max(current, Number(signal.version || 0)));
      }

      let snapshotRow: Record<string, unknown> | null = null;
      if (signal.status === 'public' && signal.snapshotJson) {
        try {
          const parsed = JSON.parse(signal.snapshotJson);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            snapshotRow = parsed as Record<string, unknown>;
          }
        } catch {}
      }

      if (signal.status === 'private') {
        removeExploreFeedSessionCacheRow(trackId);
        removeExplorePublicProfileFirstViewTrack(uid, trackId);
        setTracks((previous) => previous.filter((track) => track.id !== trackId));
        setPopularTracks((previous) => previous.filter((track) => track.id !== trackId));
        if (profileUid === uid) {
          setProfileTracks((previous) => previous.filter((track) => track.id !== trackId));
        }
        return;
      }

      if (!snapshotRow) return;
      upsertExploreFeedSessionCacheRow(trackId, snapshotRow);
      upsertExplorePublicProfileFirstViewTrack(uid, snapshotRow);
      const normalized = normalizeTrack(snapshotRow);
      if (!normalized.id) return;

      if (!profileUid && isExploreFeedRequest(requestUrl)) {
        setTracks((previous) => {
          const index = previous.findIndex((track) => track.id === normalized.id);
          if (index >= 0) {
            const next = [...previous];
            next[index] = { ...next[index], ...normalized };
            return overlayActorLikeCounts120(next);
          }
          return overlayActorLikeCounts120([normalized, ...previous].slice(0, 40));
        });
        setPopularTracks((previous) => previous.map((track) => (
          track.id === normalized.id ? { ...track, ...normalized } : track
        )));
      }

      if (profileUid === uid) {
        setProfileTracks((previous) => {
          const without = previous.filter((track) => track.id !== normalized.id);
          const next = [normalized, ...without];
          next.sort(comparePublicProfileTracks);
          return overlayActorLikeCounts120(next.slice(0, 50));
        });
      }
    };

    applyPublicationSignal355(readLatestExplorePublicationSyncSignal(uid));

    const onPublicationSync355 = (event: Event) => {
      const detail = (event as CustomEvent<ExplorePublicationSyncSignal & { uid?: string }>).detail;
      if (String(detail?.uid || uid).trim() !== uid) return;
      applyPublicationSignal355(detail || null);
    };
    window.addEventListener(EXPLORE_PUBLICATION_SYNC_EVENT, onPublicationSync355 as EventListener);
    return () => {
      window.removeEventListener(EXPLORE_PUBLICATION_SYNC_EVENT, onPublicationSync355 as EventListener);
    };
  }, [user?.uid, requestUrl, profileUid]);

  useEffect(() => {
    // SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004
    // Exact warm searches are served from the device for two minutes: Worker 0 / D1 R0.
    const feedRequest = isExploreFeedRequest(requestUrl);
    const cachedRows = feedRequest
      ? readExploreFeedSessionCache(requestUrl)
      : readExploreSearchCache340(requestUrl);
    const revisionCheckKey154 = exploreFeedRevisionCheckKey154(user?.uid || null, requestUrl);
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
      if (revision) writeExploreFeedLastRevisionCheckAt334(revisionCheckKey154);
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
      } else {
        writeExploreSearchCache340(requestUrl, rows);
      }
      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      const displayTracks = overlayActorLikeCounts120(normalizedTracks);
      setTracks(displayTracks);
      if (feedRequest) {
        syncSharedPublicCountsToLocal110(normalizedTracks);
        // Mark only after the current snapshot is applied to Feed and loaded cards.
        markExploreSharedLikeCacheRepair124(requestUrl);
        writeExploreFeedLastRevisionCheckAt334(revisionCheckKey154);
      }
    };

    if (cachedRows) {
      setError('');
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
      const lastCheckedAt = readExploreFeedLastRevisionCheckAt334(revisionCheckKey154);
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
        setTracks([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [requestUrl, feedRevisionSignal, user?.uid]);

  // app304 — Latest and Popular now share the Explore home screen. The Worker
  // R2 first-page contract remains limit=40, while this UI exposes only 20
  // cards per section. Warm re-entry stays session-cache first and D1-free.
  useEffect(() => {
    if (profileUid || submittedQuery.trim()) return;

    const requestUrl304 = EXPLORE_POPULAR_FEED_REQUEST_URL_304;
    const cachedRows304 = readExploreFeedSessionCache(requestUrl304);
    const revisionCheckKey304 = exploreFeedRevisionCheckKey154(user?.uid || null, requestUrl304);
    const controller304 = new AbortController();

    const fetchPopularRevision304 = async (): Promise<string | null> => {
      const response = await fetch(buildExploreFeedRevisionUrl(requestUrl304), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller304.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`popular revision HTTP ${response.status}`);
      const payload = await response.json() as ExploreFeedRevisionResponse;
      const revision = safeText(payload?.data?.revision) || null;
      if (revision) writeExploreFeedLastRevisionCheckAt334(revisionCheckKey304);
      return revision;
    };

    const fetchPopularSnapshot304 = async (revision: string | null) => {
      const response = await fetch(buildExploreR2SnapshotFeedUrl108(requestUrl304, revision), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller304.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`popular R2 snapshot HTTP ${response.status}`);
      const payload = await response.json() as ExploreApiResponse;
      const actualRevision = safeText(response.headers.get('X-SORIDRAW-Feed-Revision')) || revision;
      return { payload, revision: actualRevision };
    };

    const applyPopularPayload304 = (payload: ExploreApiResponse, serverRevision: string | null) => {
      if (payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
        throw new Error('Invalid Explore popular snapshot; preserving the previous Feed');
      }
      const rows = payload.data.items;
      writeExploreFeedSessionCache(
        requestUrl304,
        rows,
        safeText(payload?.data?.nextCursor) || null,
        serverRevision,
      );
      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      setPopularTracks(overlayActorLikeCounts120(normalizedTracks));
      syncSharedPublicCountsToLocal110(normalizedTracks);
      markExploreSharedLikeCacheRepair124(requestUrl304);
      writeExploreFeedLastRevisionCheckAt334(revisionCheckKey304);
      setPopularError('');
    };

    if (cachedRows304) {
      const cachedTracks304 = cachedRows304.map(normalizeTrack).filter((track) => track.id);
      setPopularTracks(overlayActorLikeCounts120(cachedTracks304));
      setPopularLoading(false);
      setPopularError('');

      const oneTimeSharedRepair304 = !hasExploreSharedLikeCacheRepair124(requestUrl304);
      if (oneTimeSharedRepair304) {
        void (async () => {
          try {
            const snapshot = await fetchPopularSnapshot304(null);
            if (!controller304.signal.aborted) applyPopularPayload304(snapshot.payload, snapshot.revision);
          } catch (reason) {
            if (!controller304.signal.aborted) {
              console.warn('Explore popular one-time shared cache repair failed; keeping cached feed:', reason);
            }
          }
        })();
        return () => controller304.abort();
      }

      const lastCheckedAt304 = readExploreFeedLastRevisionCheckAt334(revisionCheckKey304);
      if (!shouldRevalidateExploreFeedOnEntry126(true, feedRevisionSignal > 0, lastCheckedAt304, Date.now())) {
        return () => controller304.abort();
      }

      void (async () => {
        try {
          const serverRevision = await fetchPopularRevision304();
          if (!serverRevision || controller304.signal.aborted) return;
          const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl304);
          if (cachedRevision === serverRevision) {
            syncSharedPublicCountsToLocal110(cachedTracks304);
            return;
          }
          const snapshot = await fetchPopularSnapshot304(serverRevision);
          if (!controller304.signal.aborted) applyPopularPayload304(snapshot.payload, snapshot.revision);
        } catch (reason) {
          if (!controller304.signal.aborted) {
            console.warn('Explore popular revision revalidation failed; keeping cached feed:', reason);
          }
        }
      })();

      return () => controller304.abort();
    }

    setPopularLoading(true);
    setPopularError('');
    void (async () => {
      try {
        const serverRevision = await fetchPopularRevision304().catch((reason) => {
          if (!controller304.signal.aborted) {
            console.warn('Explore popular revision bootstrap failed; continuing with R2 snapshot:', reason);
          }
          return null;
        });
        const snapshot = await fetchPopularSnapshot304(serverRevision);
        if (!controller304.signal.aborted) applyPopularPayload304(snapshot.payload, snapshot.revision);
      } catch (reason) {
        if (controller304.signal.aborted) return;
        console.error('Explore popular feed load failed:', reason);
        setPopularError('인기 곡을 불러오지 못했어요.');
        setPopularTracks([]);
      } finally {
        if (!controller304.signal.aborted) setPopularLoading(false);
      }
    })();

    return () => controller304.abort();
  }, [feedRevisionSignal, profileUid, submittedQuery, user?.uid]);

  useEffect(() => {
    if (!isExploreFeedRequest(requestUrl) || profileUid) return;

    const requestRevisionCheck = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const revisionKey = exploreFeedRevisionCheckKey154(user?.uid || null, requestUrl);
      const lastCheckedAt = readExploreFeedLastRevisionCheckAt334(revisionKey);
      if (lastCheckedAt > 0 && now - lastCheckedAt < EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS) return;
      if (now - feedRevisionEventAtRef.current < EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS) return;
      feedRevisionEventAtRef.current = now;
      feedRevisionRequestedUrlRef.current = requestUrl;
      setFeedRevisionSignal((value) => value + 1);

      // app335: SORIDRAW recommendation revision is checked only alongside a real
      // post-entry activity/resume, never merely because the page was opened/reloaded.
      void revalidateSoridrawCuratedTracks335()
        .then((rows) => {
          setCuratedTracks307(rows.map(normalizeTrack).filter((track) => Boolean(track.id)));
        })
        .catch((reason) => {
          console.warn('[app335] SORIDRAW curated activity revalidation failed:', reason);
        });
    };

    // app335: route entry, reload, focus, pageshow and ordinary pointer clicks are
    // not change signals. Revalidate only after a real hidden→visible tab resume;
    // mutation-specific like/publication signals keep their own targeted paths.
    document.addEventListener('visibilitychange', requestRevisionCheck);
    return () => {
      document.removeEventListener('visibilitychange', requestRevisionCheck);
    };
  }, [requestUrl, profileUid, user?.uid]);

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

      // app379: follow overlay freezes legacy D1 counters, so a stale response
      // must never overwrite an exact device-local count. Reconcile both own
      // social counters from complete local relation caches when available.
      let displayProfile379 = nextProfile;
      if (user?.uid === nextProfile.uid) {
        const exactFollowing379 =
          readExploreProfileConnectionExactCount379(nextProfile.uid, 'following')
          ?? readExploreFollowingExactCount379(nextProfile.uid);
        const exactFollowers379 =
          readExploreProfileConnectionExactCount379(nextProfile.uid, 'followers');
        const socialPatch379: Partial<ExplorePublicProfile> = {};
        if (exactFollowing379 !== null) socialPatch379.followingCount = exactFollowing379;
        if (exactFollowers379 !== null) socialPatch379.followerCount = exactFollowers379;
        if (Object.keys(socialPatch379).length > 0) {
          displayProfile379 = { ...nextProfile, ...socialPatch379 };
          patchExplorePublicProfileFirstViewProfile(nextProfile.uid, socialPatch379);
        }
      }

      setProfile(displayProfile379);
      setProfileTracks(displayTracks);
      if (user?.uid === displayProfile379.uid) {
        void syncSoridrawProfileAvatarAuthority(user, displayProfile379.avatarUrl)
          .catch((avatarSyncError) => console.warn('Explore own profile avatar authority sync failed.', avatarSyncError));
      }
    };

    const retainedPublicationSignal357 = user?.uid === profileUid
      ? readLatestExplorePublicationSyncSignal(profileUid)
      : null;
    const expectedPublicationSignalVersion357 = Math.max(
      profilePublicationSyncVersion357,
      Number(retainedPublicationSignal357?.version || 0),
    );

    getExplorePublicProfileFirstView(profileUid, {
      expectedPublicationSignalVersion: expectedPublicationSignalVersion357,
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
  }, [profileUid, user, profilePublicationSyncVersion357]);

  // app380: a real pending follow choice survives browser reload/update. Resume
  // only persisted user mutations; ordinary startup with no pending edge stays
  // Worker0/D1 R0 and does not create any follow request.
  useEffect(() => {
    const activeUser380 = user;
    const viewerUid380 = String(activeUser380?.uid || '').trim();
    if (!activeUser380 || !viewerUid380) return;

    const pending380 = readPendingExploreFollowIntents380(viewerUid380);
    for (const record380 of pending380) {
      const targetUid380 = String(record380.targetUid || '').trim();
      if (!targetUid380 || targetUid380 === viewerUid380) continue;

      patchExploreFollowLocalState377(
        viewerUid380,
        targetUid380,
        record380.desiredFollowing,
        record380.targetProfile,
        { deferTargetFollowers: true },
      );

      const remainingIdle380 = Math.max(
        0,
        EXPLORE_FOLLOW_IDLE_FLUSH_MS_380 - Math.max(0, Date.now() - Number(record380.updatedAt || 0)),
      );
      const remainingCooldown380 = Math.max(0, Number(record380.notBefore || 0) - Date.now());

      queueExploreFollowFinalState380({
        ...record380,
        initialDelayMs: Math.max(remainingIdle380, remainingCooldown380),
        restoredNotBefore: record380.notBefore,
        restoredUpdatedAt: record380.updatedAt,
        restoredRetryUsed: record380.retryUsed,
        restoredSuspended: record380.suspended,
        commit: (following380) => setExploreFollow(
          activeUser380,
          targetUid380,
          following380,
          record380.targetProfile,
        ),
        onSettled: (settlement380) => {
          const confirmed380 = Boolean(settlement380.result.isFollowing);
          const delta380 = Number(confirmed380) - Number(settlement380.baseFollowing);
          const exactActor380 =
            readExploreProfileConnectionExactCount379(viewerUid380, 'following')
            ?? readExploreFollowingExactCount379(viewerUid380);
          const actorCount380 = exactActor380 !== null
            ? exactActor380
            : settlement380.baseActorFollowingCount === null
              ? null
              : Math.max(0, Math.floor(settlement380.baseActorFollowingCount) + delta380);
          const targetFollower380 = Math.max(
            0,
            Math.floor(settlement380.baseTargetFollowerCount) + delta380,
          );
          const targetFollowing380 = Math.max(
            0,
            Math.floor(settlement380.baseTargetFollowingCount),
          );

          patchExplorePublicProfileFirstViewProfile(targetUid380, {
            followerCount: targetFollower380,
            followingCount: targetFollowing380,
          });
          if (actorCount380 !== null) {
            patchExplorePublicProfileFirstViewProfile(viewerUid380, {
              followingCount: actorCount380,
            });
          }

          if (auth.currentUser?.uid === viewerUid380) {
            setFollowingUids312((previous) => {
              const next = new Set(previous);
              if (confirmed380) next.add(targetUid380);
              else next.delete(targetUid380);
              return next;
            });
            setFollowState((previous) => {
              if (activeProfileUidRef.current !== targetUid380) return previous;
              return {
                isFollowing: confirmed380,
                followerCount: targetFollower380,
                followingCount: targetFollowing380,
                ...(actorCount380 === null ? {} : { actorFollowingCount: actorCount380 }),
              };
            });
            setProfile((previous) => {
              if (!previous) return previous;
              if (previous.uid === targetUid380) {
                return {
                  ...previous,
                  followerCount: targetFollower380,
                  followingCount: targetFollowing380,
                };
              }
              if (previous.uid === viewerUid380 && actorCount380 !== null) {
                return { ...previous, followingCount: actorCount380 };
              }
              return previous;
            });
          }

          void publishExploreFollowSync377(viewerUid380, {
            targetUid: targetUid380,
            following: confirmed380,
            actorFollowingCount: actorCount380
              ?? Math.max(0, Math.floor(Number(settlement380.result.actorFollowingCount || 0))),
            targetFollowerCount: targetFollower380,
          }).catch((reason) => {
            console.warn('[app380] resumed follow final-state live sync deferred:', reason);
          });
        },
        onError: (failure380) => {
          patchExploreFollowLocalState377(
            viewerUid380,
            targetUid380,
            failure380.baseFollowing,
            record380.targetProfile,
          );
          patchExplorePublicProfileFirstViewProfile(targetUid380, {
            followerCount: failure380.baseTargetFollowerCount,
            followingCount: failure380.baseTargetFollowingCount,
          });
          if (failure380.baseActorFollowingCount !== null) {
            patchExplorePublicProfileFirstViewProfile(viewerUid380, {
              followingCount: failure380.baseActorFollowingCount,
            });
          }
          if (auth.currentUser?.uid === viewerUid380 && activeProfileUidRef.current === targetUid380) {
            setFollowState({
              isFollowing: failure380.baseFollowing,
              followerCount: failure380.baseTargetFollowerCount,
              followingCount: failure380.baseTargetFollowingCount,
              ...(failure380.baseActorFollowingCount === null
                ? {}
                : { actorFollowingCount: failure380.baseActorFollowingCount }),
            });
            setSocialNotice(
              failure380.error instanceof Error
                ? failure380.error.message
                : '팔로우 처리에 실패했어요.',
            );
          }
        },
      });
    }
  }, [user?.uid]);

  // app377: same-account PC/mobile follow convergence is driven by one bounded
  // RTDB signal. Receiving it patches only local caches/UI; D1/Firestore I/O is 0.
  useEffect(() => {
    const viewerUid377 = String(user?.uid || '').trim();
    if (!viewerUid377) return undefined;
    return subscribeExploreFollowSync377(viewerUid377, (signal377) => {
      if (signal377.version <= followSignalVersion377Ref.current) return;
      followSignalVersion377Ref.current = signal377.version;

      const previousMembership379 = readExploreFollowMembership379(
        viewerUid377,
        signal377.targetUid,
      );
      const previousTargetProfile379 = readCachedExplorePublicProfile(signal377.targetUid);
      patchExploreFollowLocalState377(
        viewerUid377,
        signal377.targetUid,
        signal377.following,
      );
      const exactActorFollowing379 =
        readExploreProfileConnectionExactCount379(viewerUid377, 'following')
        ?? readExploreFollowingExactCount379(viewerUid377);
      const resolvedSignalActorFollowing379 = exactActorFollowing379
        ?? signal377.actorFollowingCount;
      const signalDelta379 = previousMembership379 === null
        ? 0
        : Number(signal377.following) - Number(previousMembership379);
      const resolvedSignalTargetFollower379 = previousMembership379 !== null && previousTargetProfile379
        ? Math.max(
          0,
          Math.floor(Number(previousTargetProfile379.followerCount || 0)) + signalDelta379,
        )
        : signal377.targetFollowerCount;

      patchExplorePublicProfileFirstViewProfile(viewerUid377, {
        followingCount: resolvedSignalActorFollowing379,
      });
      patchExplorePublicProfileFirstViewProfile(signal377.targetUid, {
        followerCount: resolvedSignalTargetFollower379,
      });

      profileConnectionsCache376Ref.current.delete(`${viewerUid377}:following`);
      profileConnectionsCache376Ref.current.delete(`${signal377.targetUid}:followers`);

      setFollowingUids312((previous) => {
        const next = new Set(previous);
        if (signal377.following) next.add(signal377.targetUid);
        else next.delete(signal377.targetUid);
        return next;
      });
      setFollowState((previous) => {
        if (activeProfileUidRef.current !== signal377.targetUid) return previous;
        return {
          isFollowing: signal377.following,
          followerCount: resolvedSignalTargetFollower379,
          followingCount: previous?.followingCount || 0,
          actorFollowingCount: resolvedSignalActorFollowing379,
        };
      });
      setProfile((previous) => {
        if (!previous) return previous;
        if (previous.uid === viewerUid377) {
          return { ...previous, followingCount: resolvedSignalActorFollowing379 };
        }
        if (previous.uid === signal377.targetUid) {
          return { ...previous, followerCount: resolvedSignalTargetFollower379 };
        }
        return previous;
      });

      // Only an actually changed relation may spend this bounded list refresh.
      // Ordinary reopen/reload stays persistent-cache local.
      const openDirection377 = profileConnectionsOpen376;
      const openUid377 = activeProfileUidRef.current;
      const affectedOpen377 =
        (openDirection377 === 'following' && openUid377 === viewerUid377) ||
        (openDirection377 === 'followers' && openUid377 === signal377.targetUid);
      if (affectedOpen377) {
        const request377 = ++profileConnectionsRequest376Ref.current;
        setProfileConnectionsLoading376(true);
        void getExploreProfileConnections(openUid377, openDirection377)
          .then((page377) => {
            if (request377 !== profileConnectionsRequest376Ref.current) return;
            profileConnectionsCache376Ref.current.set(
              `${openUid377}:${openDirection377}`,
              page377,
            );
            setProfileConnectionsItems376(page377.items);
            setProfileConnectionsNextCursor376(page377.nextCursor);
          })
          .catch((reason) => {
            if (request377 !== profileConnectionsRequest376Ref.current) return;
            console.warn('[app377] changed follow list refresh deferred:', reason);
          })
          .finally(() => {
            if (request377 === profileConnectionsRequest376Ref.current) {
              setProfileConnectionsLoading376(false);
            }
          });
      }
    });
  }, [user?.uid, profileConnectionsOpen376]);

  // app335: warm public-profile entry/reload is Worker 0. Preserve eventual
  // cross-device freshness by doing the existing 60s shared-R2 check only after
  // actual profile interaction or a real hidden→visible tab resume.
  useEffect(() => {
    if (!profileUid) return undefined;
    let cancelled = false;
    const requestProfileRevalidation335 = () => {
      if (document.visibilityState !== 'visible') return;
      revalidateExplorePublicProfileFirstView335(profileUid, {
        onRevalidated: ({ profile: refreshedProfile, tracks: refreshedRows }) => {
          if (cancelled) return;
          const normalizedTracks = refreshedRows.map(normalizeTrack).filter((track) => track.id);
          normalizedTracks.sort(comparePublicProfileTracks);
          syncSharedPublicCountsToLocal110(normalizedTracks);
          let displayRefreshedProfile379 = refreshedProfile;
          if (user?.uid === refreshedProfile.uid) {
            const exactFollowing379 =
              readExploreProfileConnectionExactCount379(refreshedProfile.uid, 'following')
              ?? readExploreFollowingExactCount379(refreshedProfile.uid);
            const exactFollowers379 =
              readExploreProfileConnectionExactCount379(refreshedProfile.uid, 'followers');
            const socialPatch379: Partial<ExplorePublicProfile> = {};
            if (exactFollowing379 !== null) socialPatch379.followingCount = exactFollowing379;
            if (exactFollowers379 !== null) socialPatch379.followerCount = exactFollowers379;
            if (Object.keys(socialPatch379).length > 0) {
              displayRefreshedProfile379 = { ...refreshedProfile, ...socialPatch379 };
              patchExplorePublicProfileFirstViewProfile(refreshedProfile.uid, socialPatch379);
            }
          }
          setProfile(displayRefreshedProfile379);
          setProfileTracks(overlayActorLikeCounts120(normalizedTracks));
        },
        onInvalidated: (message) => {
          if (cancelled) return;
          setProfile(null);
          setProfileTracks([]);
          setFollowState(null);
          setProfileError(message || '공개 프로필을 불러오지 못했어요.');
        },
      });
    };
    document.addEventListener('visibilitychange', requestProfileRevalidation335);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', requestProfileRevalidation335);
    };
  }, [profileUid, user?.uid]);

  const profileIsOwn = Boolean(profile && user?.uid === profile.uid);

  useEffect(() => {
    if (!profileUid || !profile || !user || user.uid !== profile.uid || profileCollection !== 'liked') return;
    let cancelled = false;
    setProfileLikedLoading(true);
    setProfileLikedError('');
    (async () => {
      try {
        // app357: only My Likes entry may repair an origin-specific historical
        // catalog gap, and only when a retained RTDB signal proves such history
        // exists. Normal Explore/app re-entry does not pay this reconciliation.
        await ensureExplorePersonalLikeCrossOriginParity357(user);
        // app360: My Likes tab navigation must stay local. The 5-minute
        // private-R2 revision fallback runs only on a real hidden->visible
        // browser resume; actual same-account changes arrive through RTDB.
        await ensureExplorePersonalLikeBaseline127(user);
      } catch (reason) {
        console.warn('[129] Personal like baseline pending; verifying known candidates directly:', reason);
      }

      // App129 single authority:
      // My Likes does not trust its own collection cache as membership truth.
      // It verifies every known candidate through the SAME membership service
      // that paints Feed/Profile hearts, then uses the collection service only
      // to supply card bodies.
      const collectionCandidates = getExploreLikedTrackCollectionIds(user.uid) || [];
      const heartCandidates = getExploreKnownLikeCandidateIds127(user.uid);
      const candidates = [...new Set([...collectionCandidates, ...heartCandidates])];

      for (let start = 0; start < candidates.length; start += 50) {
        await getExploreLikedTrackIds(user, candidates.slice(start, start + 50));
      }

      const effectiveLikedTrackIds = reconcileExploreLikedTrackCollectionState(user.uid, candidates);
      const rows = await getExploreLikedTracks(user, effectiveLikedTrackIds);
      return { rows, effectiveLikedTrackIds };
    })()
      .then(({ rows, effectiveLikedTrackIds }) => {
        if (cancelled) return;
        const effectiveLikedSet = new Set(effectiveLikedTrackIds);
        const normalizedRows = overlayActorLikeCounts120(
          rows.map(normalizeTrack).filter((track) => track.id && effectiveLikedSet.has(track.id)),
        );
        setLikedTrackIds((previous) => {
          const next = { ...previous };
          const knownScope = new Set([
            ...Object.keys(previous),
            ...(getExploreLikedTrackCollectionIds(user.uid) || []),
            ...getExploreKnownLikeCandidateIds127(user.uid),
          ]);
          knownScope.forEach((trackId) => { next[trackId] = effectiveLikedSet.has(trackId); });
          return next;
        });
        setProfileLikedTracks(normalizedRows);
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

    // App140: paint any already-known local catalog membership synchronously.
    // After an app update/reload, a healthy device must not show every heart as
    // a spinner while the tiny revision/baseline check runs in the background.
    // Unknown/new-device IDs still keep the loader until the normal bootstrap.
    const immediateLocal: Record<string, boolean> = {};
    ids.forEach((id) => {
      const liked = readExploreTrackLikeMembership127(user.uid, id);
      if (typeof liked === 'boolean') immediateLocal[id] = liked;
    });
    if (Object.keys(immediateLocal).length) {
      setLikedTrackIds((previous) => ({ ...previous, ...immediateLocal }));
    }

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
        const visibleById = new Map(visibleTracks.map((track) => [track.id, track]));
        const verifiedMembership = new Map<string, boolean>();
        ids.forEach((id) => {
          const liked = readExploreTrackLikeMembership127(user.uid, id) ?? likedSet.has(id);
          verifiedMembership.set(id, liked);
          const visibleTrack = visibleById.get(id);
          if (visibleTrack) {
            // Keep the My Likes card index aligned with the same verified
            // heart state. This is a cache projection, never a second source
            // of membership truth.
            rememberExploreLikedTrack(
              user.uid,
              visibleTrack as unknown as Record<string, unknown>,
              liked,
            );
          }
        });
        setLikedTrackIds((prev) => {
          const next = { ...prev };
          // This network response may have started before an optimistic
          // action. Never use its absence to clear a later local heart.
          verifiedMembership.forEach((liked, id) => { next[id] = liked; });
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
    if (!user || profileUid || submittedQuery || popularTracks.length === 0) return;
    const visiblePopular304 = popularTracks.slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304);
    const ids = [...new Set(visiblePopular304.map((track) => track.id).filter(Boolean))];
    if (!ids.length) return;

    const hydrationKey304 = `${user.uid}:${likeAccountSyncSignal}:${ids.join(',')}`;
    if (popularLikeHydrationKeyRef304.current === hydrationKey304) return;
    popularLikeHydrationKeyRef304.current = hydrationKey304;

    const immediateLocal: Record<string, boolean> = {};
    ids.forEach((id) => {
      const liked = readExploreTrackLikeMembership127(user.uid, id);
      if (typeof liked === 'boolean') immediateLocal[id] = liked;
    });
    if (Object.keys(immediateLocal).length) {
      setLikedTrackIds((previous) => ({ ...previous, ...immediateLocal }));
    }

    let cancelled = false;
    const interactionVersion = likeInteractionVersionRef090.current;
    getExploreLikedTrackIds(user, ids)
      .then((likedIds) => {
        if (cancelled) return;
        if (interactionVersion !== likeInteractionVersionRef090.current) {
          popularLikeHydrationKeyRef304.current = '';
          setLikeAccountSyncSignal((value) => value + 1);
          return;
        }
        const likedSet = new Set(likedIds);
        const visibleById = new Map(visiblePopular304.map((track) => [track.id, track]));
        setLikedTrackIds((previous) => {
          const next = { ...previous };
          ids.forEach((id) => {
            const liked = readExploreTrackLikeMembership127(user.uid, id) ?? likedSet.has(id);
            next[id] = liked;
            const visibleTrack = visibleById.get(id);
            if (visibleTrack) {
              rememberExploreLikedTrack(
                user.uid,
                visibleTrack as unknown as Record<string, unknown>,
                liked,
              );
            }
          });
          return next;
        });
      })
      .catch((reason) => {
        console.warn('Explore popular like state hydration failed:', reason);
        popularLikeHydrationKeyRef304.current = '';
      });

    return () => { cancelled = true; };
  }, [user, popularTracks, profileUid, submittedQuery, likeAccountSyncSignal]);

  useEffect(() => {
    if (!user || profileUid || curatedTracks307.length === 0) return undefined;
    const visibleCurated307 = curatedTracks307.slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304);
    const ids = [...new Set(visibleCurated307.map((track) => track.id).filter(Boolean))];
    if (!ids.length) return undefined;
    const immediateLocal: Record<string, boolean> = {};
    ids.forEach((id) => {
      const liked = readExploreTrackLikeMembership127(user.uid, id);
      if (typeof liked === 'boolean') immediateLocal[id] = liked;
    });
    if (Object.keys(immediateLocal).length) {
      setLikedTrackIds((previous) => ({ ...previous, ...immediateLocal }));
    }
    let cancelled = false;
    getExploreLikedTrackIds(user, ids)
      .then((likedIds) => {
        if (cancelled) return;
        const likedSet = new Set(likedIds);
        setLikedTrackIds((previous) => {
          const next = { ...previous };
          ids.forEach((id) => { next[id] = readExploreTrackLikeMembership127(user.uid, id) ?? likedSet.has(id); });
          return next;
        });
      })
      .catch((reason) => console.warn('[app307] curated like hydration failed:', reason));
    return () => { cancelled = true; };
  }, [user, curatedTracks307, profileUid, likeAccountSyncSignal]);

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

  const openMyProfile304 = async () => {
    if (!user?.uid) {
      setSocialNotice('MY 프로필은 로그인 후 사용할 수 있어요.');
      return;
    }
    await flushExploreLikeBoundary094();
    setSearchParams({ profile: user.uid });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProfile = async () => {
    await flushExploreLikeBoundary094();
    setProfileConnectionsOpen376(null);
    profileConnectionsRequest376Ref.current += 1;
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const profileConnectionCacheKey376 = (
    uid: string,
    direction: ExploreProfileConnectionDirection,
  ) => `${uid}:${direction}`;

  const closeProfileConnections376 = () => {
    profileConnectionsRequest376Ref.current += 1;
    setProfileConnectionsOpen376(null);
    setProfileConnectionsError376('');
    setProfileConnectionsLoading376(false);
    setProfileConnectionsLoadingMore376(false);
  };

  const openProfileConnections376 = async (direction: ExploreProfileConnectionDirection) => {
    const targetUid = String(profile?.uid || '').trim();
    if (!targetUid) return;

    setProfileConnectionsOpen376(direction);
    setProfileConnectionsError376('');
    const key = profileConnectionCacheKey376(targetUid, direction);
    const cached = profileConnectionsCache376Ref.current.get(key);
    if (cached) {
      setProfileConnectionsItems376(cached.items);
      setProfileConnectionsNextCursor376(cached.nextCursor);
      setProfileConnectionsLoading376(false);
      return;
    }

    const requestId = ++profileConnectionsRequest376Ref.current;
    setProfileConnectionsItems376([]);
    setProfileConnectionsNextCursor376(null);
    setProfileConnectionsLoading376(true);
    try {
      const page = await getExploreProfileConnections(targetUid, direction);
      if (
        requestId !== profileConnectionsRequest376Ref.current
        || activeProfileUidRef.current !== targetUid
      ) return;
      profileConnectionsCache376Ref.current.set(key, page);
      setProfileConnectionsItems376(page.items);
      setProfileConnectionsNextCursor376(page.nextCursor);
      // app377: a complete bounded relation page is exact authority for small
      // profiles. Repair a stale cached count locally without another server read.
      if (!page.nextCursor) {
        const exactCount377 = page.items.length;
        const exactPatch377 = direction === 'followers'
          ? { followerCount: exactCount377 }
          : { followingCount: exactCount377 };
        patchExplorePublicProfileFirstViewProfile(targetUid, exactPatch377);
        setProfile((previous) => previous?.uid === targetUid
          ? { ...previous, ...exactPatch377 }
          : previous);
      }
    } catch (reason) {
      if (requestId !== profileConnectionsRequest376Ref.current) return;
      console.warn('[app376] profile connections load failed:', reason);
      setProfileConnectionsError376(
        reason instanceof Error ? reason.message : '팔로우 목록을 불러오지 못했어요.',
      );
    } finally {
      if (requestId === profileConnectionsRequest376Ref.current) {
        setProfileConnectionsLoading376(false);
      }
    }
  };

  const loadMoreProfileConnections376 = async () => {
    const targetUid = String(profile?.uid || '').trim();
    const direction = profileConnectionsOpen376;
    const cursor = profileConnectionsNextCursor376;
    if (!targetUid || !direction || !cursor || profileConnectionsLoadingMore376) return;

    setProfileConnectionsLoadingMore376(true);
    setProfileConnectionsError376('');
    try {
      const page = await getExploreProfileConnections(targetUid, direction, cursor);
      if (activeProfileUidRef.current !== targetUid || profileConnectionsOpen376 !== direction) return;
      const seen = new Set(profileConnectionsItems376.map((item) => item.uid));
      const merged = [...profileConnectionsItems376];
      page.items.forEach((item) => {
        if (!seen.has(item.uid)) {
          seen.add(item.uid);
          merged.push(item);
        }
      });
      const key = profileConnectionCacheKey376(targetUid, direction);
      const next = { items: merged, nextCursor: page.nextCursor };
      profileConnectionsCache376Ref.current.set(key, next);
      setProfileConnectionsItems376(merged);
      setProfileConnectionsNextCursor376(page.nextCursor);
    } catch (reason) {
      console.warn('[app376] profile connections next page failed:', reason);
      setProfileConnectionsError376(
        reason instanceof Error ? reason.message : '팔로우 목록을 더 불러오지 못했어요.',
      );
    } finally {
      setProfileConnectionsLoadingMore376(false);
    }
  };

  const openProfileConnectionPerson376 = async (uid: string) => {
    const targetUid = String(uid || '').trim();
    if (!targetUid) return;
    closeProfileConnections376();
    await flushExploreLikeBoundary094();
    setSearchParams({ profile: targetUid });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setPopularTracks(patchOptimisticCount120);
      setCuratedTracks307(patchOptimisticCount120);
      setManagedCuratedTracks307(patchOptimisticCount120);
      setProfileTracks(patchOptimisticCount120);
      setProfileLikedTracks((previous) => {
        const patched = patchOptimisticCount120(previous);
        if (!result.liked) return patched.filter((item) => item.id !== track.id);
        const rest = patched.filter((item) => item.id !== track.id);
        return [optimisticTrack, ...rest];
      });
      // Optimistic count is account-private until the Worker publishes the
      // canonical shared count. Never contaminate public persistent caches.
      patchExploreLikedTrackCachedCount091(user.uid, track.id, result.likeCount);
      rememberExploreLikedTrack(user.uid, optimisticTrack as unknown as Record<string, unknown>, result.liked);
    } catch (reason) {
      console.error('Explore like failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '좋아요 처리에 실패했어요.');
    } finally {
      setLikeBusyTrackId(null);
    }
  };

  const selectLatestPublicScope312 = async (scope: 'all' | 'following') => {
    if (scope === 'all') {
      setLatestPublicScope312('all');
      return;
    }
    if (!user?.uid) {
      setSocialNotice('팔로잉 공개곡은 로그인 후 볼 수 있어요.');
      return;
    }

    setLatestPublicScope312('following');
    if (followingLoadedUid312 === user.uid) return;

    const viewerUid = user.uid;
    setFollowingLoading312(true);
    setFollowingError312('');
    try {
      const uids = await getExploreFollowingUids312(user);
      if (auth.currentUser?.uid !== viewerUid) return;
      setFollowingUids312(new Set(uids));
      setFollowingLoadedUid312(viewerUid);
    } catch (reason) {
      if (auth.currentUser?.uid !== viewerUid) return;
      console.warn('[app312] Explore following latest filter unavailable:', reason);
      setFollowingError312(reason instanceof Error ? reason.message : '팔로잉 목록을 확인하지 못했어요.');
    } finally {
      if (auth.currentUser?.uid === viewerUid) setFollowingLoading312(false);
    }
  };

  const toggleFollow = async () => {
    if (!profileUid || !profile) return;
    if (!user) {
      setSocialNotice('팔로우는 로그인 후 사용할 수 있어요.');
      return;
    }
    const targetUid = profile.uid;
    const viewerUid = user.uid;
    if (viewerUid === targetUid) return;

    const previousMembership380 = Boolean(followState?.isFollowing);
    const nextShouldFollow380 = !previousMembership380;
    const relationDelta380 = Number(nextShouldFollow380) - Number(previousMembership380);
    const previousProfile380 = profile;
    const previousViewerProfile380 = readCachedExplorePublicProfile(viewerUid);
    const exactActorBefore380 =
      readExploreProfileConnectionExactCount379(viewerUid, 'following')
      ?? readExploreFollowingExactCount379(viewerUid);
    const cachedActorBefore380 = Number(previousViewerProfile380?.followingCount);
    const actorBefore380 = exactActorBefore380 !== null
      ? exactActorBefore380
      : Number.isFinite(cachedActorBefore380)
        ? Math.max(0, Math.floor(cachedActorBefore380))
        : null;
    const canonicalTargetFollowerCount380 = Math.max(
      0,
      Math.floor(Number(previousProfile380.followerCount || 0)),
    );
    const canonicalTargetFollowing380 = Math.max(
      0,
      Math.floor(Number(previousProfile380.followingCount || 0)),
    );

    // app380: local-first. Paint and patch only this device immediately. The
    // final desired state for this viewer/target pair is sent once after 30s.
    patchExploreFollowLocalState377(
      viewerUid,
      targetUid,
      nextShouldFollow380,
      previousProfile380,
      { deferTargetFollowers: true },
    );
    const exactActorAfter380 =
      readExploreProfileConnectionExactCount379(viewerUid, 'following')
      ?? readExploreFollowingExactCount379(viewerUid);
    const optimisticActorFollowing380 = exactActorAfter380 !== null
      ? exactActorAfter380
      : actorBefore380 === null
        ? null
        : Math.max(0, actorBefore380 + relationDelta380);

    setFollowState({
      isFollowing: nextShouldFollow380,
      followerCount: canonicalTargetFollowerCount380,
      followingCount: canonicalTargetFollowing380,
      ...(optimisticActorFollowing380 === null
        ? {}
        : { actorFollowingCount: optimisticActorFollowing380 }),
    });
    if (followingLoadedUid312 === viewerUid) {
      setFollowingUids312((previous) => {
        const next = new Set(previous);
        if (nextShouldFollow380) next.add(targetUid);
        else next.delete(targetUid);
        return next;
      });
    }
    if (optimisticActorFollowing380 !== null) {
      patchExplorePublicProfileFirstViewProfile(viewerUid, {
        followingCount: optimisticActorFollowing380,
      });
    }
    // Public/target counters stay canonical until the final accepted state.
    // Only this account's own following cache/count is optimistic during batching.
    setProfile((previous) => previous?.uid === viewerUid && optimisticActorFollowing380 !== null
      ? { ...previous, followingCount: optimisticActorFollowing380 }
      : previous);

    queueExploreFollowFinalState380({
      viewerUid,
      targetUid,
      baseFollowing: previousMembership380,
      baseTargetFollowerCount: previousProfile380.followerCount,
      baseTargetFollowingCount: previousProfile380.followingCount,
      baseActorFollowingCount: actorBefore380,
      desiredFollowing: nextShouldFollow380,
      targetProfile: {
        uid: targetUid,
        nickname: previousProfile380.nickname,
        avatarUrl: previousProfile380.avatarUrl,
        handle: previousProfile380.handle,
      },
      commit: (following380) => setExploreFollow(
        user,
        targetUid,
        following380,
        previousProfile380,
      ),
      onBusy: (busy380) => {
        if (auth.currentUser?.uid !== viewerUid) return;
        setFollowBusyUid((current) => {
          if (busy380) return activeProfileUidRef.current === targetUid ? targetUid : current;
          return current === targetUid ? '' : current;
        });
      },
      onSettled: (settlement380) => {
        const confirmedMembership380 = Boolean(settlement380.result.isFollowing);
        const canonicalDelta380 =
          Number(confirmedMembership380) - Number(settlement380.baseFollowing);
        const exactActorFollowing380 =
          readExploreProfileConnectionExactCount379(viewerUid, 'following')
          ?? readExploreFollowingExactCount379(viewerUid);
        const resolvedActorFollowing380 = exactActorFollowing380 !== null
          ? exactActorFollowing380
          : settlement380.baseActorFollowingCount === null
            ? null
            : Math.max(
              0,
              Math.floor(settlement380.baseActorFollowingCount) + canonicalDelta380,
            );
        const resolvedTargetFollower380 = Math.max(
          0,
          Math.floor(settlement380.baseTargetFollowerCount) + canonicalDelta380,
        );
        const resolvedTargetFollowing380 = Math.max(
          0,
          Math.floor(settlement380.baseTargetFollowingCount),
        );

        patchExplorePublicProfileFirstViewProfile(targetUid, {
          followerCount: resolvedTargetFollower380,
          followingCount: resolvedTargetFollowing380,
        });
        if (resolvedActorFollowing380 !== null) {
          patchExplorePublicProfileFirstViewProfile(viewerUid, {
            followingCount: resolvedActorFollowing380,
          });
        }

        if (auth.currentUser?.uid === viewerUid) {
          if (activeProfileUidRef.current === targetUid) {
            setFollowState({
              ...settlement380.result,
              isFollowing: confirmedMembership380,
              followerCount: resolvedTargetFollower380,
              followingCount: resolvedTargetFollowing380,
              ...(resolvedActorFollowing380 === null
                ? {}
                : { actorFollowingCount: resolvedActorFollowing380 }),
            });
          }
          setFollowingUids312((previous) => {
            const next = new Set(previous);
            if (confirmedMembership380) next.add(targetUid);
            else next.delete(targetUid);
            return next;
          });
          setProfile((previous) => {
            if (!previous) return previous;
            if (previous.uid === targetUid) {
              return {
                ...previous,
                followerCount: resolvedTargetFollower380,
                followingCount: resolvedTargetFollowing380,
              };
            }
            if (previous.uid === viewerUid && resolvedActorFollowing380 !== null) {
              return { ...previous, followingCount: resolvedActorFollowing380 };
            }
            return previous;
          });
        }

        // Other devices/users see only the final accepted state, never the
        // intermediate local taps inside the 30-second aggregation window.
        const signalActorFollowing380 = resolvedActorFollowing380
          ?? Math.max(0, Math.floor(Number(settlement380.result.actorFollowingCount || 0)));
        void publishExploreFollowSync377(viewerUid, {
          targetUid,
          following: confirmedMembership380,
          actorFollowingCount: signalActorFollowing380,
          targetFollowerCount: resolvedTargetFollower380,
        }).catch((reason) => {
          console.warn('[app380] follow final-state live sync deferred:', reason);
        });
      },
      onError: (failure380) => {
        // Hard failure: return only this local optimistic edge to the state that
        // existed before the batch window. RATE_LIMITED is retried by the batch
        // service and never reaches this rollback path.
        patchExploreFollowLocalState377(
          viewerUid,
          targetUid,
          failure380.baseFollowing,
          previousProfile380,
        );
        patchExplorePublicProfileFirstViewProfile(targetUid, {
          followerCount: failure380.baseTargetFollowerCount,
          followingCount: failure380.baseTargetFollowingCount,
        });
        if (failure380.baseActorFollowingCount !== null) {
          patchExplorePublicProfileFirstViewProfile(viewerUid, {
            followingCount: failure380.baseActorFollowingCount,
          });
        }
        if (auth.currentUser?.uid !== viewerUid) return;
        if (activeProfileUidRef.current === targetUid) {
          setFollowState({
            isFollowing: failure380.baseFollowing,
            followerCount: failure380.baseTargetFollowerCount,
            followingCount: failure380.baseTargetFollowingCount,
            ...(failure380.baseActorFollowingCount === null
              ? {}
              : { actorFollowingCount: failure380.baseActorFollowingCount }),
          });
        }
        setFollowingUids312((previous) => {
          const next = new Set(previous);
          if (failure380.baseFollowing) next.add(targetUid);
          else next.delete(targetUid);
          return next;
        });
        setProfile((previous) => {
          if (!previous) return previous;
          if (previous.uid === targetUid) {
            return {
              ...previous,
              followerCount: failure380.baseTargetFollowerCount,
              followingCount: failure380.baseTargetFollowingCount,
            };
          }
          if (previous.uid === viewerUid && failure380.baseActorFollowingCount !== null) {
            return { ...previous, followingCount: failure380.baseActorFollowingCount };
          }
          return previous;
        });
        const reason = failure380.error;
        console.error('Explore follow final-state commit failed:', reason);
        setSocialNotice(reason instanceof Error ? reason.message : '팔로우 처리에 실패했어요.');
      },
    });
  };

  const closeMoreSheet = () => {
    sharedNoteAuthorizedTrackRef272.current = null;
    setMoreTrack(null);
    setMoreSheetMode('actions');
    setFolderChoices([]);
    setMoreActionBusy(null);
  };

  const shareExploreTrack = async (track: ExploreTrack) => {
    const shareUrl = safeText(track.openUrl || track.sunoUrlPrimary);
    if (!shareUrl) {
      setSocialNotice('공유할 공개 링크가 없어요.');
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: track.title,
          text: `${track.displayName} · ${track.title}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setSocialNotice('공유 링크를 복사했어요.');
      }
      closeMoreSheet();
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setSocialNotice('공유 링크를 복사했어요.');
        closeMoreSheet();
      } catch {
        setSocialNotice('공유 링크를 복사하지 못했어요.');
      }
    }
  };

  const applyExploreTrackToNextSong = async (track: ExploreTrack) => {
    if (!user) {
      setSocialNotice('다음곡 적용은 로그인 후 사용할 수 있어요.');
      return;
    }
    if (!track.allowNextSongApply) {
      setSocialNotice('이 곡은 다음곡 적용이 허용되지 않았어요.');
      return;
    }
    setMoreActionBusy('apply');
    try {
      let nextSong: Record<string, unknown> | null = track.shareBundle?.nextSong && typeof track.shareBundle.nextSong === 'object'
        ? { ...track.shareBundle.nextSong }
        : null;

      // Existing public rows were created before the command-window field was
      // included in the public share bundle. For the owner's own Music Note,
      // recover that one source document only when the user actually taps Apply.
      // getDoc remains cache-first, so a warm local document can still be R0.
      if (
        user.uid === track.ownerUid
        && track.sourceType === 'music_note'
        && track.sourceId
        && (!nextSong || !String((nextSong as any).userInput || '').trim())
      ) {
        const ownSource = await getExploreOwnMusicNoteApplyKeywords(user, track.sourceId);
        if (ownSource) nextSong = { ...(nextSong || {}), ...ownSource };
      }

      // Legacy public bundles can still have the five public keyword groups even
      // when the full nextSong object is absent. Use those locally before asking
      // the Worker, keeping the common fallback D1-free.
      if (!nextSong || Object.keys(nextSong).length === 0) {
        nextSong = buildExploreLegacyApplyKeywords({
          shareBundle: track.shareBundle || null,
        });
      }

      if (!nextSong || Object.keys(nextSong).length === 0) {
        const source = await getExploreTrackApplySource(user, track.id);
        nextSong = source?.nextSong && typeof source.nextSong === 'object'
          ? { ...source.nextSong }
          : source?.shareBundle?.nextSong && typeof source.shareBundle.nextSong === 'object'
            ? { ...source.shareBundle.nextSong }
            : buildExploreLegacyApplyKeywords(source);
      }

      if (!nextSong || Object.keys(nextSong).length === 0) {
        throw new Error('이 곡은 적용할 설정 정보가 없어요.');
      }
      const serialized = JSON.stringify(nextSong);
      sessionStorage.setItem('pendingAppliedKeywords', serialized);
      localStorage.setItem('pendingAppliedKeywordsBackup', serialized);
      await flushExploreLikeBoundary094();
      closeMoreSheet();
      navigate('/studio?applyPending=1');
    } catch (reason) {
      console.error('Explore next-song apply failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '다음곡 적용에 실패했어요.');
    } finally {
      setMoreActionBusy(null);
    }
  };

  const patchExplorePublicationTrack = (track: ExploreTrack, patch: Partial<ExploreTrack>) => {
    setTracks((previous) => previous.map((item) => item.id === track.id ? { ...item, ...patch } : item));
    setPopularTracks((previous) => previous.map((item) => item.id === track.id ? { ...item, ...patch } : item));
    setCuratedTracks307((previous) => previous.map((item) => item.id === track.id ? { ...item, ...patch } : item));
    setManagedCuratedTracks307((previous) => previous.map((item) => item.id === track.id ? { ...item, ...patch } : item));
    setProfileTracks((previous) => previous
      .map((item) => item.id === track.id ? { ...item, ...patch } : item)
      .sort(comparePublicProfileTracks));
    setProfileLikedTracks((previous) => previous.map((item) => item.id === track.id ? { ...item, ...patch } : item));
    patchExploreFeedSessionCachesRow(track.id, patch as Record<string, unknown>);
    if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, patch as Record<string, unknown>);
  };

  const patchExplorePublicationOptions = (track: ExploreTrack, options: ExplorePublicationOptions) => {
    patchExplorePublicationTrack(track, {
      allowNextSongApply: options.allowNextSongApply,
      allowFollowerSave: options.allowFollowerSave,
      profilePinned: options.profilePinned,
    });
  };

  const openExplorePublicationSettings = (track: ExploreTrack) => {
    if (!user || user.uid !== track.ownerUid || publicationSettingsBusy) return;
    setPublicationPrivateConfirm(false);
    closeMoreSheet();

    const sourceId = track.sourceType === 'music_note' ? safeText(track.sourceId) : '';
    const localSourceSong = sourceId
      ? readExplorePublicationSourceFromLocal(user.uid, sourceId)
      : null;

    const showPublicationSettings = (sourceSong: Record<string, any> | null) => {
      const sunoLinks = getExplorePublicationSunoLinks(sourceSong, track);
      const selectedSunoIndex = resolveExplorePublicationMainIndex(sourceSong, track, sunoLinks);
      setPublicationSettings({
        track,
        options: {
          allowNextSongApply: Boolean(track.allowNextSongApply),
          allowFollowerSave: Boolean(track.allowFollowerSave),
          profilePinned: Boolean(track.profilePinned),
        },
        sourceId,
        sourceSong,
        sunoLinks,
        selectedSunoIndex,
        initialSunoIndex: selectedSunoIndex,
      });
    };

    if (!sourceId || localSourceSong) {
      showPublicationSettings(localSourceSong);
      return;
    }

    void (async () => {
      let sourceSong: Record<string, any> | null = null;
      try {
        const snapshot = await getDoc(doc(db, 'favorites', sourceId));
        if (snapshot.exists()) {
          const data = snapshot.data() as Record<string, any>;
          const ownerUid = safeText(data.uid ?? data.ownerUid);
          if (!ownerUid || ownerUid === user.uid) {
            sourceSong = { ...data, id: snapshot.id, firestoreId: snapshot.id };
          }
        }
      } catch (reason) {
        console.warn('Explore publication source exact read unavailable; using public card fallback.', reason);
      }
      if (auth.currentUser?.uid !== user.uid) return;
      showPublicationSettings(sourceSong);
    })();
  };

  const toggleExplorePublicationSetting = (key: keyof ExplorePublicationOptions) => {
    if (publicationSettingsBusy) return;
    setPublicationSettings((current) => current
      ? { ...current, options: { ...current.options, [key]: !current.options[key] } }
      : current);
    setPublicationPrivateConfirm(false);
  };

  const saveExplorePublicationSettings = async () => {
    if (!user || !publicationSettings || user.uid !== publicationSettings.track.ownerUid || publicationSettingsBusy) return;

    const pendingSettings = publicationSettings;
    const previousCollections = {
      tracks,
      popularTracks,
      curatedTracks307,
      managedCuratedTracks307,
      profileTracks,
      profileLikedTracks,
    };
    const selectionChanged = Boolean(
      pendingSettings.sourceId
      && pendingSettings.sourceSong
      && pendingSettings.sunoLinks.length > 1
      && pendingSettings.selectedSunoIndex !== pendingSettings.initialSunoIndex
    );
    const selected = pendingSettings.sunoLinks[pendingSettings.selectedSunoIndex]
      || pendingSettings.sunoLinks[0]
      || null;
    const other = pendingSettings.sunoLinks.find((link) => link.url !== selected?.url) || null;
    const optimisticPatch: Partial<ExploreTrack> = {
      allowNextSongApply: pendingSettings.options.allowNextSongApply,
      allowFollowerSave: pendingSettings.options.allowFollowerSave,
      profilePinned: pendingSettings.options.profilePinned,
      ...(selectionChanged ? {
        coverUrl: selected?.coverUrl || pendingSettings.track.coverUrl || null,
        durationSeconds: selected?.durationSeconds ?? pendingSettings.track.durationSeconds ?? null,
        sunoUrlPrimary: selected?.url || pendingSettings.track.sunoUrlPrimary || null,
        sunoUrlSecondary: other?.url || null,
        openUrl: selected?.url || pendingSettings.track.openUrl || null,
      } : {}),
    };

    setPublicationSettingsBusy(true);
    if (selectionChanged && activeExplorePreviewTrackId224 === pendingSettings.track.id) {
      // app374 — the yellow title / center equalizer are local feedback for the
      // exact Suno link the user opened. Switching the published song changes
      // that playback target, so stale "playing" feedback must end immediately.
      clearExplorePreviewTimer224();
      setActiveExplorePreviewTrackId224('');
      clearExplorePreviewVisualState237(pendingSettings.track.id);
    }
    patchExplorePublicationTrack(pendingSettings.track, optimisticPatch);
    setPublicationSettings(null);
    setPublicationPrivateConfirm(false);

    try {
      if (selectionChanged) {
        const sourceId = pendingSettings.sourceId;
        const updates = buildExplorePublicationMainSelectionUpdates(
          pendingSettings.sunoLinks,
          pendingSettings.selectedSunoIndex,
        );
        const nextSourceSong = {
          ...pendingSettings.sourceSong,
          ...updates,
          id: sourceId,
          firestoreId: sourceId,
          uid: user.uid,
        };
        await runV1MutationBoundary({
          domain: 'musicNote',
          operation: 'update',
          uid: user.uid,
          documentIds: [sourceId],
          affectedCount: 1,
          syncItem: nextSourceSong,
        }, updateDoc(doc(db, 'favorites', sourceId), updates));
        patchExplorePublicationSourceLocalCache(user.uid, sourceId, updates);

        await refreshExploreMusicNotePublicationSource(
          user,
          sourceId,
          pendingSettings.options,
          pendingSettings.track.id,
        );
        setSocialNotice('선택한 곡으로 공개 설정을 저장했어요.');
      } else {
        const saved = await setExploreTrackPublicationOptions(user, pendingSettings.track.id, pendingSettings.options);
        patchExplorePublicationOptions(pendingSettings.track, saved);
        setSocialNotice('공개 설정을 저장했어요.');
      }
    } catch (reason) {
      setTracks(previousCollections.tracks);
      setPopularTracks(previousCollections.popularTracks);
      setCuratedTracks307(previousCollections.curatedTracks307);
      setManagedCuratedTracks307(previousCollections.managedCuratedTracks307);
      setProfileTracks(previousCollections.profileTracks);
      setProfileLikedTracks(previousCollections.profileLikedTracks);
      setPublicationSettings(pendingSettings);
      setPublicationPrivateConfirm(false);
      console.error('Explore publication settings save failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '공개 설정 저장에 실패했어요.');
    } finally {
      setPublicationSettingsBusy(false);
    }
  };

  const makeExploreTrackPrivate = async () => {
    if (!user || !publicationSettings || user.uid !== publicationSettings.track.ownerUid || publicationSettingsBusy) return;
    if (!publicationPrivateConfirm) {
      setPublicationPrivateConfirm(true);
      return;
    }

    const pendingSettings = publicationSettings;
    const track = pendingSettings.track;
    const previousCollections = {
      tracks,
      popularTracks,
      curatedTracks307,
      managedCuratedTracks307,
      profileTracks,
      profileLikedTracks,
    };

    setPublicationSettingsBusy(true);
    setTracks((previous) => previous.filter((item) => item.id !== track.id));
    setPopularTracks((previous) => previous.filter((item) => item.id !== track.id));
    setCuratedTracks307((previous) => previous.filter((item) => item.id !== track.id));
    setManagedCuratedTracks307((previous) => previous.filter((item) => item.id !== track.id));
    setProfileTracks((previous) => previous.filter((item) => item.id !== track.id));
    setProfileLikedTracks((previous) => previous.filter((item) => item.id !== track.id));
    setPublicationSettings(null);
    setPublicationPrivateConfirm(false);

    try {
      await setExploreTrackVisibility(user, track.id, false, pendingSettings.options);
      setSocialNotice('비공개로 전환했어요.');
    } catch (reason) {
      setTracks(previousCollections.tracks);
      setPopularTracks(previousCollections.popularTracks);
      setCuratedTracks307(previousCollections.curatedTracks307);
      setManagedCuratedTracks307(previousCollections.managedCuratedTracks307);
      setProfileTracks(previousCollections.profileTracks);
      setProfileLikedTracks(previousCollections.profileLikedTracks);
      setPublicationSettings(pendingSettings);
      setPublicationPrivateConfirm(true);
      console.error('Explore publication private switch failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '비공개 전환에 실패했어요.');
    } finally {
      setPublicationSettingsBusy(false);
    }
  };

  const openExploreSharedNotePicker = async (track: ExploreTrack) => {
    if (!user) {
      setSocialNotice('공유 노트 추가는 로그인 후 사용할 수 있어요.');
      return;
    }
    if (!track.allowFollowerSave) {
      setSocialNotice('공개자가 이 곡의 공유 노트 저장을 허용하지 않았어요.');
      return;
    }
    setMoreActionBusy('sharedNote');
    try {
      let authorizedTrack: ExploreTrack = track;
      if (user.uid !== track.ownerUid) {
        const access = await getExploreTrackSaveAccess(user, track.id);
        if (!access.allowed) {
          throw new Error(access.permissionEnabled
            ? '팔로우한 아티스트의 저장 허용곡만 공유 노트에 추가할 수 있어요.'
            : '공개자가 이 곡의 공유 노트 저장을 허용하지 않았어요.');
        }
        const saveSource = access.saveSource;
        if (saveSource) {
          authorizedTrack = {
            ...track,
            sourceType: saveSource.originalSourceType || track.sourceType,
            sourceId: saveSource.originalSourceId || track.sourceId,
            sourceSubTrackKey: saveSource.sourceSubTrackKey || track.sourceSubTrackKey,
            sourceSubTrackIndex: saveSource.sourceSubTrackIndex ?? track.sourceSubTrackIndex,
            sourceSubTrackId: saveSource.sourceSubTrackId || track.sourceSubTrackId,
            title: saveSource.title || track.title,
            coverUrl: saveSource.coverUrl || track.coverUrl,
            sunoUrlPrimary: saveSource.sunoUrlPrimary || track.sunoUrlPrimary,
            sunoUrlSecondary: saveSource.sunoUrlSecondary || track.sunoUrlSecondary,
            durationSeconds: saveSource.durationSeconds ?? track.durationSeconds,
            lyrics: saveSource.lyrics ?? track.lyrics,
            lyricsParts: saveSource.lyricsParts || track.lyricsParts,
            style: saveSource.style ?? track.style,
            prompt: saveSource.prompt ?? track.prompt,
            shareBundle: saveSource.shareBundle || track.shareBundle,
          };
        }
      }

      // Do not depend on React state flush timing between "open folders" and the
      // user's next click. The exact authorized payload is held synchronously.
      sharedNoteAuthorizedTrackRef272.current = authorizedTrack;
      setMoreTrack((current) => current?.id === track.id ? authorizedTrack : current);

      // app274 — saved-folder status is read only from the already-present local
      // Music Note cache/store. It adds no Firestore/D1/R2 read.
      const savedFolder = getExploreSharedNoteSavedFolderLocal274(user.uid, track.id);
      setSharedNoteSavedFolderId274(savedFolder?.folderId || null);

      const folders = await getExploreSharedNoteFolders(user);
      if (!folders.length) throw new Error('공유 노트 폴더를 확인하지 못했어요.');
      setFolderChoices(folders);
      setMoreSheetMode('folders');
    } catch (reason) {
      sharedNoteAuthorizedTrackRef272.current = null;
      console.error('Explore shared note picker failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '공유 노트를 불러오지 못했어요.');
    } finally {
      setMoreActionBusy(null);
    }
  };

  const saveExploreTrackToSharedNoteFolder = async (track: ExploreTrack, folder: ExploreSharedNoteFolder) => {
    if (!user) return;
    const authorizedTrack = sharedNoteAuthorizedTrackRef272.current?.id === track.id
      ? sharedNoteAuthorizedTrackRef272.current
      : track;
    if (!authorizedTrack.allowFollowerSave) {
      setSocialNotice('공개자가 이 곡의 공유 노트 저장을 허용하지 않았어요.');
      setMoreSheetMode('actions');
      return;
    }
    if (sharedNoteSavedFolderId274 === folder.id) {
      setSocialNotice(`이미 공유 노트 · '${folder.title}'에 저장되어 있어요.`);
      return;
    }
    setMoreActionBusy('sharedNote');
    try {
      await saveExploreTrackToSharedNote(user, authorizedTrack, folder);
      setSocialNotice(`공유 노트 · '${folder.title}'에 추가했어요.`);
      closeMoreSheet();
    } catch (reason) {
      console.error('Explore shared note save failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '공유 노트 추가에 실패했어요.');
    } finally {
      setMoreActionBusy(null);
    }
  };

  const dislikeExploreTrack = (track: ExploreTrack) => {
    if (!user) {
      setSocialNotice('싫어요는 로그인 후 사용할 수 있어요.');
      return;
    }
    markExploreTrackDisliked(user.uid, track.id);
    setDislikedTrackIds((previous) => new Set([...previous, track.id]));
    setSocialNotice('추천에서 제외했어요.');
    closeMoreSheet();
  };

  const curatedTrackIds307 = new Set(
    [...curatedTracks307, ...managedCuratedTracks307].map((track) => track.id).filter(Boolean),
  );

  const toggleSoridrawCuration307 = async (track: ExploreTrack, promoted: boolean) => {
    if (!user || !curationAccess307.canCurate || curationBusyTrackId307) return;
    setCurationBusyTrackId307(track.id);
    setMoreActionBusy('curation');
    try {
      await setSoridrawCuratedTrack307(user, track.id, promoted);
      if (promoted) {
        setCuratedTracks307((previous) => previous.some((item) => item.id === track.id)
          ? previous
          : [track, ...previous].slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304));
        setManagedCuratedTracks307((previous) => previous.some((item) => item.id === track.id)
          ? previous
          : [track, ...previous]);
        setSocialNotice('SORIDRAW 추천곡으로 승격했어요.');
      } else {
        setCuratedTracks307((previous) => previous.filter((item) => item.id !== track.id));
        setManagedCuratedTracks307((previous) => previous.filter((item) => item.id !== track.id));
        setSocialNotice('SORIDRAW 추천곡에서 해제했어요.');
      }
      closeMoreSheet();
    } catch (reason) {
      console.error('[app307] SORIDRAW curation mutation failed:', reason);
      setSocialNotice(reason instanceof Error ? reason.message : '추천곡 변경에 실패했어요.');
      setMoreActionBusy(null);
    } finally {
      setCurationBusyTrackId307('');
    }
  };

  const openCurationManager307 = () => {
    if (!curationAccess307.canCurate) return;
    setSearchParams({ curation: 'manage' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeCurationManager307 = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const visibleFeedTracks = sort === 'recommended' && !submittedQuery
    ? tracks.filter((track) => !dislikedTrackIds.has(track.id))
    : tracks;

  const latestPublicTracks312 = useMemo(() => {
    if (latestPublicScope312 === 'all') return tracks;
    if (!user?.uid || followingLoadedUid312 !== user.uid) return [];
    return tracks.filter((track) => followingUids312.has(track.ownerUid));
  }, [tracks, latestPublicScope312, user?.uid, followingLoadedUid312, followingUids312]);

  // Use the already-loaded three pools. Profile summaries are local reads only;
  // missing representative genres stay unknown, never inferred from song genres.
  const [viewerGenresRevision346, setViewerGenresRevision346] = useState(0);
  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<{ uid: string }>).detail?.uid === user?.uid) setViewerGenresRevision346(v => v + 1);
    };
    window.addEventListener(EXPLORE_VIEWER_GENRES_EVENT, listener);
    return () => window.removeEventListener(EXPLORE_VIEWER_GENRES_EVENT, listener);
  }, [user?.uid]);
  const recommendedCreators345 = useMemo(() => {
    if (sort !== 'recommended' || submittedQuery || profileUid) return [];
    const currentUid = user?.uid || '';
    const candidateUids = new Set(
      [...curatedTracks307.slice(0, 40), ...tracks.slice(0, 40), ...popularTracks.slice(0, 40)]
        .map((track) => track.ownerUid).filter(Boolean),
    );
    const profileGenres = new Map<string, string[]>();
    candidateUids.forEach((uid) => {
      const summary = profile?.uid === uid ? profile : readCachedExplorePublicProfile(uid);
      if (summary) profileGenres.set(uid, summary.genres);
    });
    [...curatedTracks307.slice(0, 40), ...tracks.slice(0, 40), ...popularTracks.slice(0, 40)].forEach(track => {
      if (!profileGenres.has(track.ownerUid) && Array.isArray(track.ownerProfileGenres)) profileGenres.set(track.ownerUid, track.ownerProfileGenres);
    });
    const viewer = profile?.uid === currentUid ? profile : readCachedExplorePublicProfile(currentUid);
    const genreSignal = (raw: string) => {
      const normalized = normalizeExploreGenreCatalogKey342(raw);
      const known = EXPLORE_GENRE_LOOKUP_342.get(normalized)
        || EXPLORE_GENRE_LOOKUP_342.get(compactExploreGenreCatalogKey342(raw)) || null;
      return {
        key: normalizeExploreGenreCatalogKey342(known?.id || raw),
        family: resolveExploreMajorGenre343(known, raw)?.id || '',
      };
    };
    return rankExploreCreators({
      currentUid, viewerGenres: viewer?.genres ?? readExploreViewerGenres(currentUid) ?? [], profileGenres,
      curated: curatedTracks307, latest: tracks.filter((track) => !dislikedTrackIds.has(track.id)), popular: popularTracks,
      genreSignal, songGenre: (track) => track.primaryGenre || readExploreRecommendationGenre221(track),
    }).map((track) => ({
      id: track.ownerUid, displayName: track.displayName, handle: track.ownerHandle,
      avatarUrl: track.avatarUrl || null, track,
    }));
  }, [sort, submittedQuery, profileUid, user?.uid, profile, curatedTracks307, tracks, popularTracks, dislikedTrackIds, viewerGenresRevision346]);
  const recommendationModel221 = sort === 'recommended' && !submittedQuery
    ? { ...buildExploreRecommendationModel221(visibleFeedTracks, user?.uid || ''), creators: recommendedCreators345 }
    : { picks: [], genres: [], creators: [] };
  const activeRecommendationGenre221 = recommendationModel221.genres.find(
    (genre) => genre.id === recommendationGenreId221,
  ) || recommendationModel221.genres[0] || null;
  const majorRecommendationGenres343 = recommendationModel221.genres.filter((genre) => genre.tier === 'major');
  const detailRecommendationGenres343 = recommendationModel221.genres.filter((genre) => genre.tier === 'detail');

  const renderMoreSheet = () => {
    if (!moreTrack) return null;
    const liked = likedTrackIds[moreTrack.id] === true;
    const likeBusy = likeBusyTrackId === moreTrack.id || (Boolean(user) && likedTrackIds[moreTrack.id] === undefined);
    const actionBusy = moreActionBusy !== null;

    return (
      <div
        className="soridraw-explore-more-backdrop"
        role="presentation"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.stopPropagation();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          event.stopPropagation();
          if (!actionBusy) {
            closeMoreSheet();
          }
        }}
      >
        <section
          className="soridraw-explore-more-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={moreSheetMode === 'folders' ? '공유 노트에 추가' : `${moreTrack.title} 더보기`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="soridraw-explore-more-handle" aria-hidden="true" />
          {moreSheetMode === 'folders' ? (
            <>
              <div className="soridraw-explore-more-folder-head">
                <button type="button" disabled={actionBusy} onClick={() => setMoreSheetMode('actions')} aria-label="더보기로 돌아가기">
                  <ChevronLeft aria-hidden="true" />
                </button>
                <strong>공유 노트에 추가</strong>
              </div>
              <div className="soridraw-explore-more-folder-list">
                {folderChoices.map((folder) => {
                  const isSavedHere274 = sharedNoteSavedFolderId274 === folder.id;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      disabled={moreActionBusy === 'sharedNote' || isSavedHere274}
                      className={isSavedHere274 ? 'is-saved' : undefined}
                      onClick={() => saveExploreTrackToSharedNoteFolder(moreTrack, folder)}
                    >
                      <NotebookTabs aria-hidden="true" />
                      <span>{folder.title}</span>
                      {isSavedHere274 && <small className="soridraw-explore-more-folder-saved">저장됨</small>}
                      {moreActionBusy === 'sharedNote' && !isSavedHere274 && <Loader2 className="soridraw-explore-spinner" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="soridraw-explore-more-track">
                <div className="soridraw-explore-more-cover" aria-hidden="true">
                  {moreTrack.coverUrl ? <img src={moreTrack.coverUrl} alt="" referrerPolicy="no-referrer" /> : <Music2 />}
                </div>
                <div>
                  <strong>{moreTrack.title}</strong>
                  <span>{moreTrack.displayName}</span>
                </div>
              </div>

              <div className="soridraw-explore-more-primary">
                <button
                  type="button"
                  disabled={actionBusy || (Boolean(user) && !moreTrack.allowFollowerSave)}
                  className={!moreTrack.allowFollowerSave ? 'is-disabled' : undefined}
                  onClick={() => openExploreSharedNotePicker(moreTrack)}
                >
                  {moreActionBusy === 'sharedNote' ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <NotebookTabs aria-hidden="true" />}
                  <span>공유 노트에 추가</span>
                </button>
                <button
                  type="button"
                  className={liked ? 'is-active' : undefined}
                  aria-pressed={liked}
                  disabled={likeBusy || actionBusy}
                  onClick={async () => {
                    await toggleLike(moreTrack);
                    closeMoreSheet();
                  }}
                >
                  {likeBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <Heart aria-hidden="true" />}
                  <span>좋아요</span>
                </button>
                <button type="button" disabled={actionBusy} onClick={() => shareExploreTrack(moreTrack)}>
                  <Reply className="soridraw-explore-share-icon" aria-hidden="true" />
                  <span>공유</span>
                </button>
              </div>

              <div className="soridraw-explore-more-rows">
                <button
                  type="button"
                  disabled={actionBusy}
                  className={moreTrack.allowNextSongApply ? 'is-available' : 'is-disabled'}
                  onClick={() => applyExploreTrackToNextSong(moreTrack)}
                >
                  {moreActionBusy === 'apply' ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                  <span>
                    <strong>다음곡에 적용</strong>
                    {!moreTrack.allowNextSongApply && <small>공개자가 사용을 허용하지 않았어요.</small>}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={actionBusy || !user || user.uid !== moreTrack.ownerUid}
                  className={!user || user.uid !== moreTrack.ownerUid ? 'is-disabled' : undefined}
                  onClick={() => openExplorePublicationSettings(moreTrack)}
                >
                  <Settings aria-hidden="true" />
                  <span>
                    <strong>공개 설정</strong>
                    {(!user || user.uid !== moreTrack.ownerUid) && <small>본인 곡에서만 변경할 수 있어요.</small>}
                  </span>
                </button>
                {curationAccess307.canCurate && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    className={curatedTrackIds307.has(moreTrack.id) ? 'is-active' : undefined}
                    onClick={() => void toggleSoridrawCuration307(moreTrack, !curatedTrackIds307.has(moreTrack.id))}
                  >
                    {curationBusyTrackId307 === moreTrack.id
                      ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" />
                      : <Crown aria-hidden="true" />}
                    <span>
                      <strong>{curatedTrackIds307.has(moreTrack.id) ? '추천곡 해제' : '추천곡 승격'}</strong>
                      <small>{curatedTrackIds307.has(moreTrack.id) ? 'SORIDRAW 추천에서 제거합니다.' : 'SORIDRAW 추천에 추가합니다.'}</small>
                    </span>
                  </button>
                )}
                <button type="button" disabled={actionBusy} onClick={() => dislikeExploreTrack(moreTrack)}>
                  <ThumbsDown aria-hidden="true" />
                  <span>
                    <strong>싫어요</strong>
                    <small>추천에서 이 곡을 제외합니다.</small>
                  </span>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    );
  };

  const renderPublicationSettingsModal = () => publicationSettings ? (
    <ExplorePublicationSettingsModal
      title={publicationSettings.track.title}
      options={publicationSettings.options}
      trackChoices={publicationSettings.sunoLinks.map((link, index) => ({
        index: (index === 1 ? 1 : 0) as 0 | 1,
        title: safeText(link.title, `수노 곡 ${index + 1}`),
        coverUrl: safeText(link.coverUrl) || null,
        available: Boolean(safeText(link.url)),
      }))}
      selectedTrackIndex={publicationSettings.selectedSunoIndex}
      onSelectTrackIndex={(index) => {
        if (publicationSettingsBusy) return;
        setPublicationSettings((current) => current ? { ...current, selectedSunoIndex: index } : current);
        setPublicationPrivateConfirm(false);
      }}
      busy={publicationSettingsBusy}
      privateConfirm={publicationPrivateConfirm}
      onToggle={toggleExplorePublicationSetting}
      onSave={() => void saveExplorePublicationSettings()}
      onPrivate={() => void makeExploreTrackPrivate()}
      onClose={() => {
        if (publicationSettingsBusy) return;
        setPublicationSettings(null);
        setPublicationPrivateConfirm(false);
      }}
    />
  ) : null;

  const renderTrackCard = (
    track: ExploreTrack,
    ownerProfileAuthority: ExplorePublicProfile | null = null,
    variant: 'default' | 'profilePinnedBanner' | 'profileList' = 'default',
    showPublisher = true,
  ) => {
    // SORIDRAW_EXPLORE_PROFILE_CARD_AVATAR_AUTHORITY_217_20260928
    // On a public-profile page, the already-loaded profile is the display
    // authority for that owner's cards. This fixes stale per-track avatar
    // snapshots without any new server read/write or cache invalidation.
    const authorityTrack217 = applyExploreCardAvatarAuthority218(
      track,
      user,
      ownerProfileAuthority,
    );
    const liked129 = likedTrackIds[authorityTrack217.id] === true;
    const pair129 = normalizeExploreLikeDisplayPair129(liked129, authorityTrack217.likeCount);
    const displayTrack129 = pair129.likeCount === authorityTrack217.likeCount
      ? authorityTrack217
      : { ...authorityTrack217, likeCount: pair129.likeCount };

    return (
      <ExploreTrackCard
        key={authorityTrack217.id}
        track={displayTrack129}
        liked={pair129.liked}
        likeBusy={likeBusyTrackId === track.id || (Boolean(user) && likedTrackIds[track.id] === undefined)}
        isPreviewing={activeExplorePreviewTrackId224 === track.id}
        onTogglePreview={showExploreLinkVisual224}
        onToggleLike={toggleLike}
        onOpenProfile={openProfile}
        onApplyNext={applyExploreTrackToNextSong}
        onShare={shareExploreTrack}
        variant={variant}
        showPublisher={showPublisher}
        onOpenMore={(selectedTrack) => {
          // app259 — reserve the modal history entry synchronously before
          // rendering the sheet. This matches the app's proven popup pattern
          // and prevents PC browser Back from reaching the previous page first.
          if (!moreHistoryPushedRef257.current) {
            window.history.pushState(
              { ...(window.history.state || {}), soridrawExploreMore259: true },
              '',
              window.location.href,
            );
            moreHistoryPushedRef257.current = true;
          }
          sharedNoteAuthorizedTrackRef272.current = null;
          setMoreTrack(selectedTrack);
          setMoreSheetMode('actions');
          setFolderChoices([]);
        }}
      />
    );
  };

  const renderTrackGrid = (
    items: ExploreTrack[],
    label: string,
    ownerProfileAuthority: ExplorePublicProfile | null = null,
    density: 'default' | 'latest' = 'default',
    feed = false,
    showPublisher = true,
  ) => (
    <section
      className={`soridraw-explore-grid${feed ? ' soridraw-explore-grid--feed' : ''}${density === 'latest' ? ' soridraw-explore-grid--latest' : ''}`}
      aria-label={label}
    >
      {items.map((track) => renderTrackCard(track, ownerProfileAuthority, 'default', showPublisher))}
    </section>
  );

  const profilePinnedTracks231 = profileTracks.filter((track) => track.profilePinned);
  const profileSocialLinks244 = profile ? ([
    {
      key: 'spotify',
      label: 'Spotify',
      href: safeExternalSocialHref244(profile.socialLinks?.spotify),
      icon: <Disc3 aria-hidden="true" />,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      href: safeExternalSocialHref244(profile.socialLinks?.instagram),
      icon: <Instagram aria-hidden="true" />,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      href: safeExternalSocialHref244(profile.socialLinks?.tiktok),
      icon: <Music2 aria-hidden="true" />,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      href: safeExternalSocialHref244(profile.socialLinks?.youtube),
      icon: <Youtube aria-hidden="true" />,
    },
  ] as const).filter((item) => Boolean(item.href)) : [];

  if (curationManageRequested307 && curationAccess307.canCurate) {
    return (
      <main className="soridraw-explore-page soridraw-explore-page--curation-manage-307">
        {renderMoreSheet()}
        {socialNotice && <div className="soridraw-explore-social-notice" role="status">{socialNotice}</div>}
        <section className="soridraw-explore-profile-toolbar soridraw-explore-curation-toolbar-307">
          <button type="button" onClick={closeCurationManager307} className="soridraw-explore-back-button" aria-label="Explore로 돌아가기">
            <ArrowLeft aria-hidden="true" />
          </button>
          <span>승격 곡 관리</span>
        </section>
        <header className="soridraw-explore-curation-manage-head-307">
          <div>
            <span>CURATED</span>
            <h1>SORIDRAW 추천곡</h1>
            <p>승격된 곡을 한곳에서 확인하고, 곡 더보기에서 추천곡 해제를 할 수 있어요.</p>
          </div>
        </header>
        {managedCuratedLoading307 ? (
          <div className="soridraw-explore-state" role="status">
            <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 승격 곡을 불러오는 중
          </div>
        ) : managedCuratedTracks307.length === 0 ? (
          <div className="soridraw-explore-state soridraw-explore-state--empty">
            <Crown aria-hidden="true" />
            <strong>아직 승격된 추천곡이 없어요.</strong>
          </div>
        ) : (
          renderTrackGrid(managedCuratedTracks307, '승격 곡 관리')
        )}
      </main>
    );
  }

  const renderProfileConnectionsModal376 = () => {
    const direction = profileConnectionsOpen376;
    if (!direction || !profile) return null;
    const emptyLabel = direction === 'followers' ? '아직 팔로워가 없어요.' : '아직 팔로잉한 사람이 없어요.';

    return (
      <div
        className="soridraw-explore-connections-backdrop-376"
        role="presentation"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeProfileConnections376();
        }}
      >
        <section
          className="soridraw-explore-connections-modal-376"
          role="dialog"
          aria-modal="true"
          aria-label={direction === 'followers' ? '팔로워 목록' : '팔로잉 목록'}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="soridraw-explore-connections-head-376">
            <div className="soridraw-explore-connections-tabs-376" role="tablist" aria-label="팔로우 목록">
              <button
                type="button"
                role="tab"
                aria-selected={direction === 'followers'}
                className={direction === 'followers' ? 'is-active' : undefined}
                onClick={() => void openProfileConnections376('followers')}
              >
                팔로워 <strong>{formatCount(profile.followerCount)}</strong>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={direction === 'following'}
                className={direction === 'following' ? 'is-active' : undefined}
                onClick={() => void openProfileConnections376('following')}
              >
                팔로잉 <strong>{formatCount(profile.followingCount)}</strong>
              </button>
            </div>
            <button
              type="button"
              className="soridraw-explore-connections-close-376"
              onClick={closeProfileConnections376}
              aria-label="팔로우 목록 닫기"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="soridraw-explore-connections-body-376">
            {profileConnectionsLoading376 ? (
              <div className="soridraw-explore-connections-state-376" role="status">
                <Loader2 className="soridraw-explore-spinner" aria-hidden="true" />
                목록을 불러오는 중
              </div>
            ) : profileConnectionsError376 && profileConnectionsItems376.length === 0 ? (
              <div className="soridraw-explore-connections-state-376">{profileConnectionsError376}</div>
            ) : profileConnectionsItems376.length === 0 ? (
              <div className="soridraw-explore-connections-state-376">{emptyLabel}</div>
            ) : (
              <>
                <div className="soridraw-explore-connections-list-376">
                  {profileConnectionsItems376.map((person) => (
                    <button
                      key={person.uid}
                      type="button"
                      className="soridraw-explore-connection-person-376"
                      onClick={() => void openProfileConnectionPerson376(person.uid)}
                    >
                      <span className="soridraw-explore-connection-avatar-376" aria-hidden="true">
                        {person.avatarUrl
                          ? <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />
                          : (person.nickname || 'S').charAt(0).toUpperCase()}
                      </span>
                      <span className="soridraw-explore-connection-copy-376">
                        <strong>{person.nickname || 'SORiDRAW'}</strong>
                        {person.handle && <span>@{person.handle}</span>}
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {profileConnectionsError376 && (
                  <div className="soridraw-explore-connections-inline-error-376">{profileConnectionsError376}</div>
                )}
                {profileConnectionsNextCursor376 && (
                  <button
                    type="button"
                    className="soridraw-explore-connections-more-376"
                    onClick={() => void loadMoreProfileConnections376()}
                    disabled={profileConnectionsLoadingMore376}
                  >
                    {profileConnectionsLoadingMore376 ? (
                      <>
                        <Loader2 className="soridraw-explore-spinner" aria-hidden="true" />
                        불러오는 중
                      </>
                    ) : '더 보기'}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    );
  };

  if (profileUid) {
    return (
      <main className="soridraw-explore-page soridraw-explore-page--profile">
        {renderMoreSheet()}
        {renderPublicationSettingsModal()}
        {renderProfileConnectionsModal376()}
        <section className="soridraw-explore-profile-toolbar">
          <button type="button" onClick={closeProfile} className="soridraw-explore-back-button" aria-label="Explore로 돌아가기">
            <ArrowLeft aria-hidden="true" />
          </button>
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
            <section className={`soridraw-explore-profile-head${profile.backgroundUrl ? ' has-background' : ''}${user?.uid === profile.uid ? ' is-own-profile-313' : ''}`}>
              {profile.backgroundUrl && (
                <div className="soridraw-explore-profile-background" aria-hidden="true">
                  <img src={profile.backgroundUrl} alt="" referrerPolicy="no-referrer" />
                  <span />
                </div>
              )}
              <div className="soridraw-explore-profile-content">
                <div className="soridraw-explore-profile-avatar-column-244">
                  <div className="soridraw-explore-profile-avatar" aria-hidden="true">
                    {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : profile.nickname.charAt(0).toUpperCase()}
                  </div>
                  {profile.bio && <p className="soridraw-explore-profile-bio">{profile.bio}</p>}
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
                        {followState?.isFollowing ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                        {followState?.isFollowing ? '팔로잉' : '팔로우'}
                      </button>
                    )}
                  </div>
                  {profile.handle && <div className="soridraw-explore-profile-handle">@{profile.handle}</div>}
                  <div className="soridraw-explore-profile-stats">
                    <button
                      type="button"
                      className="soridraw-explore-profile-stat-button-376"
                      onClick={() => void openProfileConnections376('followers')}
                      aria-label={`팔로워 ${formatCount(profile.followerCount)}명 보기`}
                    >
                      팔로워 <strong>{formatCount(profile.followerCount)}</strong>
                    </button>
                    <button
                      type="button"
                      className="soridraw-explore-profile-stat-button-376"
                      onClick={() => void openProfileConnections376('following')}
                      aria-label={`팔로잉 ${formatCount(profile.followingCount)}명 보기`}
                    >
                      팔로잉 <strong>{formatCount(profile.followingCount)}</strong>
                    </button>
                    <span>공개곡 <strong>{formatCount(resolveExplorePublicTrackCount(profile.trackCount, profileTracks))}</strong></span>
                  </div>
                  {profile.genres.length > 0 && <div className="soridraw-explore-profile-genres">{profile.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}
                  {profileSocialLinks244.length > 0 && (
                    <div className="soridraw-explore-profile-social-icons-244" aria-label="소셜 링크">
                      {profileSocialLinks244.map((item) => (
                        <a
                          key={item.key}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`${item.label} 열기`}
                          title={item.label}
                        >
                          {item.icon}
                        </a>
                      ))}
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
                  // Profile editing cannot change social relations. Preserve the
                  // already-displayed exact follower/following counters.
                  const nextProfile379 = {
                    ...nextProfile,
                    followerCount: profile.followerCount,
                    followingCount: profile.followingCount,
                  };
                  setProfile(nextProfile379);

                  const ownerCardPatch = {
                    ownerHandle: nextProfile.handle,
                    ownerNickname: nextProfile.nickname,
                    ownerAvatarUrl: nextProfile.avatarUrl,
                  };
                  const ownerTrackIds = new Set(
                    [...tracks, ...popularTracks, ...curatedTracks307, ...managedCuratedTracks307, ...profileTracks, ...profileLikedTracks]
                      .filter((track) => track.ownerUid === nextProfile.uid && Boolean(track.id))
                      .map((track) => track.id),
                  );

                  setTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  setPopularTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  setCuratedTracks307((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  setManagedCuratedTracks307((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  setProfileTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  setProfileLikedTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)));
                  ownerTrackIds.forEach((trackId) => {
                    patchExploreFeedSessionCachesRow(trackId, ownerCardPatch);
                    patchExplorePublicProfileFirstViewTrack(nextProfile.uid, trackId, ownerCardPatch);
                  });

                  rememberExplorePublicProfileFirstViewProfile(nextProfile379);
                  if (nextProfile379.handle) setSearchParams({ profile: `@${nextProfile379.handle}` }, { replace: true });
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
                renderTrackGrid(profileLikedTracks, `${profile.nickname} 좋아요 곡`, profile)
              )
            ) : profileTracks.length === 0 ? (
              <div className="soridraw-explore-state soridraw-explore-state--empty">
                <Music2 aria-hidden="true" />
                <strong>아직 공개된 곡이 없어요.</strong>
              </div>
            ) : (
              <>
                {profilePinnedTracks231.length > 0 && (
                  <div className="soridraw-explore-profile-pinned-rail-232">
                    <ExploreRecommendationRail
                      title="고정 곡"
                      itemCount={profilePinnedTracks231.length}
                      trackClassName="soridraw-explore-recommend-track--profile-pinned"
                      mobileGroupSize={1}
                    >
                      {profilePinnedTracks231.map((track) => renderTrackCard(track, profile, 'profilePinnedBanner', false))}
                    </ExploreRecommendationRail>
                  </div>
                )}
                <section className={`soridraw-explore-profile-public-list-234${profilePublicView239 === 'list' ? ' is-list' : ' is-grid'}`} aria-label="전체 곡">
                  <header className="soridraw-explore-profile-public-head-234">
                    <div className="soridraw-explore-profile-public-title-239">
                      <span>PUBLIC</span>
                      <h2>전체 곡</h2>
                    </div>
                    <div className="soridraw-explore-profile-view-toggle-239" aria-label="전체 곡 보기 방식">
                      <button
                        type="button"
                        className={profilePublicView239 === 'grid' ? 'is-active' : undefined}
                        onClick={() => setProfilePublicView239('grid')}
                        aria-label="그리드로 보기"
                        title="그리드로 보기"
                        aria-pressed={profilePublicView239 === 'grid'}
                      >
                        <Grid3X3 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={profilePublicView239 === 'list' ? 'is-active' : undefined}
                        onClick={() => setProfilePublicView239('list')}
                        aria-label="목록으로 보기"
                        title="목록으로 보기"
                        aria-pressed={profilePublicView239 === 'list'}
                      >
                        <List aria-hidden="true" />
                      </button>
                    </div>
                  </header>
                  {profilePublicView239 === 'grid' ? renderTrackGrid(
                    profileTracks,
                    `${profile.nickname} 전체 곡`,
                    profile,
                    'default',
                    true,
                    false,
                  ) : (
                    <section className="soridraw-explore-profile-song-list-239" aria-label={`${profile.nickname} 전체 곡 목록`}>
                      {profileTracks.map((track) => renderTrackCard(track, profile, 'profileList', false))}
                    </section>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="soridraw-explore-page">
      {renderMoreSheet()}
      {renderPublicationSettingsModal()}
      {socialNotice && <div className="soridraw-explore-social-notice" role="status">{socialNotice}</div>}
      <section className="soridraw-explore-head">
        <div>
          <div className="soridraw-explore-title-line">
            <Compass aria-hidden="true" />
            <h1>Explore</h1>
          </div>
          <p>SORiDRAW에서 발견한 음악을 Suno에서 바로 만나보세요.</p>
        </div>

        <div className="soridraw-explore-head-actions-307">
          {curationAccess307.canCurate && (
            <button
              type="button"
              className="soridraw-explore-curation-manage-button-307"
              onClick={openCurationManager307}
            >
              <Crown aria-hidden="true" />
              <span>승격 곡 관리</span>
            </button>
          )}
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
        </div>
      </section>

      <nav className="soridraw-explore-tabs" aria-label="내 프로필">
        <button
          type="button"
          className="is-active"
          onClick={() => void openMyProfile304()}
        >
          MY 프로필
        </button>
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
      ) : (submittedQuery ? visibleFeedTracks.length === 0 : tracks.length === 0 && popularTracks.length === 0 && !popularLoading) ? (
        <>
          <div className="soridraw-explore-state soridraw-explore-state--empty">
            <Compass aria-hidden="true" />
            <strong>{submittedQuery ? '검색 결과가 없어요.' : '아직 공개된 곡이 없어요.'}</strong>
            <span>{submittedQuery ? '다른 검색어로 찾아보세요.' : '공개된 곡이 생기면 이곳에 표시됩니다.'}</span>
          </div>
        </>
      ) : (
        <>
          {!submittedQuery ? (
            <div className="soridraw-explore-recommend-feed" aria-label="Explore 추천, 최신 및 인기">
              {curatedTracks307.length > 0 && (
                <ExploreRecommendationRail
                  title="SORIDRAW 추천"
                  subtitle="관리자가 직접 선정한 추천곡"
                  itemCount={Math.min(EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304, curatedTracks307.length)}
                  trackClassName="soridraw-explore-recommend-track--picks"
                  mobileGroupSize={2}
                >
                  {curatedTracks307.slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304).map((track) => renderTrackCard(track))}
                </ExploreRecommendationRail>
              )}
              {curatedLoading307 && curatedTracks307.length === 0 && (
                <div className="soridraw-explore-state soridraw-explore-curated-loading-307" role="status">
                  <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 추천곡을 확인하는 중
                </div>
              )}

              {tracks.length > 0 && (
                <ExploreRecommendationRail
                  title="최신 공개곡"
                  subtitle="새로 공개된 곡"
                  itemCount={Math.min(EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304, latestPublicTracks312.length)}
                  mobileGroupSize={3}
                  resetToStartKey={`${latestPublicScope312}:${latestPublicTracks312[0]?.id || ''}`}
                  toolbar={(
                    <div className="soridraw-explore-recommend-keywords" aria-label="최신 공개곡 범위 선택">
                      <button
                        type="button"
                        className={latestPublicScope312 === 'all' ? 'is-active' : undefined}
                        onClick={() => void selectLatestPublicScope312('all')}
                        aria-pressed={latestPublicScope312 === 'all'}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        className={latestPublicScope312 === 'following' ? 'is-active' : undefined}
                        onClick={() => void selectLatestPublicScope312('following')}
                        aria-pressed={latestPublicScope312 === 'following'}
                        disabled={followingLoading312}
                      >
                        {followingLoading312 ? '팔로잉 확인 중' : '팔로잉'}
                      </button>
                    </div>
                  )}
                >
                  {latestPublicTracks312
                    .slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304)
                    .map((track) => renderTrackCard(track))}
                </ExploreRecommendationRail>
              )}
              {latestPublicScope312 === 'following' && !followingLoading312 && followingError312 && (
                <div className="soridraw-explore-state">{followingError312}</div>
              )}

              {popularTracks.length > 0 ? (
                <ExploreRecommendationRail
                  title="인기"
                  subtitle="지금 많이 듣는 곡"
                  itemCount={Math.min(EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304, popularTracks.length)}
                  mobileGroupSize={3}
                >
                  {popularTracks.slice(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304).map((track) => renderTrackCard(track))}
                </ExploreRecommendationRail>
              ) : popularLoading ? (
                <div className="soridraw-explore-state" role="status"><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 인기 곡을 불러오는 중</div>
              ) : popularError ? (
                <div className="soridraw-explore-state">{popularError}</div>
              ) : null}

              {recommendationModel221.creators.length > 0 && (
                <ExploreRecommendationRail
                  title="좋아할 만한 크리에이터"
                  subtitle="추천 곡에서 발견한 크리에이터를 더 둘러보세요."
                  itemCount={recommendationModel221.creators.length}
                  itemLabel="크리에이터"
                  trackClassName="soridraw-explore-recommend-track--creators"
                >
                  {recommendationModel221.creators.map((creator) => (
                    <ExploreCreatorCard221
                      key={creator.id}
                      creator={creator}
                      onOpen={openProfile}
                    />
                  ))}
                </ExploreRecommendationRail>
              )}

              {activeRecommendationGenre221 && (
                <ExploreRecommendationRail
                  key={activeRecommendationGenre221.id}
                  title="장르별 추천"
                  subtitle="한 카테고리에서 장르만 골라 바로 바꿔보세요."
                  itemCount={activeRecommendationGenre221.tracks.length}
                  toolbar={(
                    <div className="soridraw-explore-recommend-genre-rows" aria-label="추천 장르 선택">
                      {majorRecommendationGenres343.length > 0 && (
                        <div
                          className="soridraw-explore-recommend-keywords soridraw-explore-recommend-genre-row"
                          aria-label="대분류 장르"
                          onWheel={handleExploreGenreRowWheel342}
                        >
                        {majorRecommendationGenres343.map((genre) => (
                          <button
                            key={genre.id}
                            type="button"
                            className={activeRecommendationGenre221.id === genre.id ? 'is-active' : undefined}
                            onClick={() => setRecommendationGenreId221(genre.id)}
                            aria-pressed={activeRecommendationGenre221.id === genre.id}
                          >
                            {genre.label}
                          </button>
                        ))}
                        </div>
                      )}
                      {detailRecommendationGenres343.length > 0 && (
                        <div
                          className="soridraw-explore-recommend-keywords soridraw-explore-recommend-genre-row"
                          aria-label="세부 장르"
                          onWheel={handleExploreGenreRowWheel342}
                        >
                        {detailRecommendationGenres343.map((genre) => (
                          <button
                            key={genre.id}
                            type="button"
                            className={activeRecommendationGenre221.id === genre.id ? 'is-active' : undefined}
                            onClick={() => setRecommendationGenreId221(genre.id)}
                            aria-pressed={activeRecommendationGenre221.id === genre.id}
                          >
                            {genre.label}
                          </button>
                        ))}
                        </div>
                      )}
                    </div>
                  )}
                >
                  {activeRecommendationGenre221.tracks.map((track) => renderTrackCard(track))}
                </ExploreRecommendationRail>
              )}
            </div>
          ) : (
            renderTrackGrid(
              visibleFeedTracks,
              'Explore 검색 결과',
              null,
              'default',
              true,
            )
          )}
        </>
      )}
    </main>
  );
}
