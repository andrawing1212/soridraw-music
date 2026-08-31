// SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE
// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Compass, ExternalLink, Heart, Loader2, Music2, Pencil, Pin, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  patchExploreFeedSessionCacheRow,
  readExploreFeedSessionCache,
  writeExploreFeedSessionCache,
} from '../services/exploreSessionCache';
import { getExploreLikedTrackIds, setExploreTrackLike } from '../services/exploreLikeService';
import { getExplorePublicProfileFirstView } from '../services/exploreProfileFirstViewService';
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
  profilePinned: boolean;
};

type ExploreApiResponse = {
  ok?: boolean;
  data?: {
    items?: Array<Record<string, unknown>>;
    nextCursor?: string | null;
  };
};

const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';

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
  profilePinned: Boolean(row.profilePinned ?? row.profile_pinned ?? (row.options as Record<string, unknown> | undefined)?.profilePinned),
});

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedTrackIds, setLikedTrackIds] = useState<Record<string, boolean>>({});
  const [likeBusyTrackId, setLikeBusyTrackId] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState('');
  const [profile, setProfile] = useState<ExplorePublicProfile | null>(null);
  const [profileTracks, setProfileTracks] = useState<ExploreTrack[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [followState, setFollowState] = useState<ExploreFollowState | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    likeHydrationKeyRef.current = '';
    if (!currentUser) setLikedTrackIds({});
  }), []);

  const requestUrl = useMemo(() => {
    const cleanQuery = submittedQuery.trim();
    if (cleanQuery) {
      const params = new URLSearchParams({ q: cleanQuery });
      return `${EXPLORE_API_BASE}/v1/search?${params.toString()}`;
    }
    const apiSort = sort === 'popular' ? 'popular' : 'latest';
    return `${EXPLORE_API_BASE}/v1/feed?sort=${apiSort}&limit=40`;
  }, [sort, submittedQuery]);

  useEffect(() => {
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
      .then(async (response) => {
        recordCloudflareResponse(response);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ExploreApiResponse>;
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        writeExploreFeedSessionCache(requestUrl, rows, safeText(payload?.data?.nextCursor) || null);
        setTracks(rows.map(normalizeTrack).filter((track) => track.id));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Explore feed load failed:', reason);
        setError('Explore 곡을 불러오지 못했어요.');
        setTracks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestUrl]);

  useEffect(() => {
    if (!profileUid) {
      setProfile(null);
      setProfileTracks([]);
      setProfileError('');
      setFollowState(null);
      setProfileEditOpen(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');
    setSocialNotice('');

    getExplorePublicProfileFirstView(profileUid)
      .then(async ({ profile: nextProfile, tracks: rows }) => {
        if (cancelled) return;
        const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
        normalizedTracks.sort((a, b) => Number(b.profilePinned) - Number(a.profilePinned));
        setProfile(nextProfile);
        setProfileTracks(normalizedTracks);

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

  const visibleTracks = profileUid ? profileTracks : tracks;

  useEffect(() => {
    if (!user || visibleTracks.length === 0) return;
    const ids = [...new Set(visibleTracks.map((track) => track.id).filter(Boolean))].slice(0, 50);
    const hydrationKey = `${user.uid}:${profileUid || 'feed'}:${ids.join(',')}`;
    if (!ids.length || likeHydrationKeyRef.current === hydrationKey) return;
    likeHydrationKeyRef.current = hydrationKey;

    let cancelled = false;
    getExploreLikedTrackIds(user, ids)
      .then((likedIds) => {
        if (cancelled) return;
        setLikedTrackIds((prev) => {
          const next = { ...prev };
          ids.forEach((id) => { next[id] = false; });
          likedIds.forEach((id) => { next[id] = true; });
          return next;
        });
      })
      .catch((reason) => {
        console.warn('Explore like state hydration failed:', reason);
        likeHydrationKeyRef.current = '';
      });

    return () => { cancelled = true; };
  }, [user, visibleTracks, profileUid]);

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

  const openProfile = (track: ExploreTrack) => {
    if (!track.ownerUid) return;
    setSearchParams({ profile: track.ownerUid });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProfile = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateTrackLikeCount = (trackId: string, likeCount: number) => {
    const patch = (list: ExploreTrack[]) => list.map((track) => track.id === trackId ? { ...track, likeCount } : track);
    setTracks(patch);
    setProfileTracks(patch);
  };

  const toggleLike = async (track: ExploreTrack) => {
    if (!user) {
      setSocialNotice('좋아요는 로그인 후 사용할 수 있어요.');
      return;
    }
    if (likeBusyTrackId) return;
    const currentLiked = Boolean(likedTrackIds[track.id]);
    setLikeBusyTrackId(track.id);
    try {
      const result = await setExploreTrackLike(user, track.id, !currentLiked);
      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));
      updateTrackLikeCount(track.id, result.likeCount);
      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });
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
      {items.map((track) => (
        <ExploreTrackCard
          key={track.id}
          track={track}
          liked={Boolean(likedTrackIds[track.id])}
          likeBusy={likeBusyTrackId === track.id}
          onToggleLike={toggleLike}
          onOpenProfile={openProfile}
        />
      ))}
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
                  if (nextProfile.handle) setSearchParams({ profile: `@${nextProfile.handle}` }, { replace: true });
                }}
              />
            )}

            {profileTracks.length === 0 ? (
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
      ) : renderTrackGrid(tracks, 'Explore 곡 목록')}
    </main>
  );
}
