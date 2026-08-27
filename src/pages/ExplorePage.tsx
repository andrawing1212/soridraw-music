import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, ExternalLink, Heart, Loader2, MessageCircle, Music2, Search, X } from 'lucide-react';
import '../components/explore/explore.css';

type ExploreSort = 'recommended' | 'latest' | 'popular';

type ExploreTrack = {
  id: string;
  title: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  sunoUrlPrimary?: string | null;
  openUrl?: string | null;
  likeCount: number;
  commentCount: number;
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

const normalizeTrack = (row: Record<string, unknown>): ExploreTrack => ({
  id: safeText(row.id),
  title: safeText(row.title, '제목 없는 곡'),
  displayName: safeText(row.displayName ?? row.ownerDisplayName, 'SORiDRAW'),
  avatarUrl: safeText(row.avatarUrl) || null,
  coverUrl: safeText(row.coverUrl) || null,
  sunoUrlPrimary: safeText(row.sunoUrlPrimary) || null,
  openUrl: safeText(row.openUrl) || null,
  likeCount: safeCount(row.likeCount),
  commentCount: safeCount(row.commentCount),
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

function ExploreTrackCard({ track }: { track: ExploreTrack }) {
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
          {openUrl && (
            <span className="soridraw-explore-cover-open" aria-hidden="true">
              <ExternalLink />
            </span>
          )}
        </span>
      </button>

      <div className="soridraw-explore-card-copy">
        <h3 title={track.title}>{track.title}</h3>
        <div className="soridraw-explore-creator">
          <span className="soridraw-explore-avatar" aria-hidden="true">
            {track.avatarUrl ? <img src={track.avatarUrl} alt="" referrerPolicy="no-referrer" /> : track.displayName.charAt(0).toUpperCase()}
          </span>
          <span title={track.displayName}>{track.displayName}</span>
        </div>
      </div>

      <div className="soridraw-explore-card-actions" aria-label="곡 반응 정보">
        <span title="좋아요"><Heart aria-hidden="true" /> {formatCount(track.likeCount)}</span>
        <span title="댓글"><MessageCircle aria-hidden="true" /> {formatCount(track.commentCount)}</span>
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
  const [sort, setSort] = useState<ExploreSort>('recommended');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [tracks, setTracks] = useState<ExploreTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(requestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ExploreApiResponse>;
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
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
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const closeSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setSearchOpen(false);
  };

  return (
    <main className="soridraw-explore-page">
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
        <section className="soridraw-explore-grid" aria-label="Explore 곡 목록">
          {tracks.map((track) => <ExploreTrackCard key={track.id} track={track} />)}
        </section>
      )}
    </main>
  );
}
