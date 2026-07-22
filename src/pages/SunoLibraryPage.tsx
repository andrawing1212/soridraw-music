import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Zap, Music, RefreshCw, Loader2, AlertCircle, 
  Search, Filter, PlayCircle, MoreVertical, Download, 
  Share2, Star, Trash2, Info, ChevronRight, X, Play,
  Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX,
  Twitter, Facebook, Mail, Link, Copy, Send, MessageCircle, Edit2, Heart, FolderOutput, Globe2, Plus, Check, CheckSquare, Square, ListChecks, Palette, Lock
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, collectionGroup, where, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, orderBy, limit, startAfter } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useGlobalPlayer } from '../contexts/GlobalPlayerContext';
import { downloadAudioWithTitle } from '../lib/songUtils';
import { ensureDefaultPlaylists, getPlaylistsByType, createPlaylist, renamePlaylist, deletePlaylist, addPlaylistItem, deletePlaylistItem, movePlaylistItem, updatePlaylistItemColor, swapPlaylistItemOrder, getTrackGlobalId, fetchTrackLikes, toggleTrackLike, fetchSharedTracksStatus } from '../services/playlistService';
import { Playlist, PlaylistItem } from '../types';
import SunoTrackDetailModal from '../components/SunoTrackDetailModal';

const fallbackNormalPlaylists: Playlist[] = [
  { id: "fallback-normal-0", title: "기본", type: "normal", order: 1, isDefault: true, isFallback: true } as any,
  { id: "fallback-normal-1", title: "1", type: "normal", order: 2, isDefault: true, isFallback: true } as any,
  { id: "fallback-normal-2", title: "2", type: "normal", order: 3, isDefault: true, isFallback: true } as any,
  { id: "fallback-normal-3", title: "3", type: "normal", order: 4, isDefault: true, isFallback: true } as any,
];

const fallbackSharedPlaylists: Playlist[] = [
  { id: "fallback-shared-0", title: "기본", type: "shared", order: 1, isDefault: true, isFallback: true } as any,
  { id: "fallback-shared-1", title: "1", type: "shared", order: 2, isDefault: true, isFallback: true } as any,
  { id: "fallback-shared-2", title: "2", type: "shared", order: 3, isDefault: true, isFallback: true } as any,
];

const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours
const WORKSPACE_PAGE_SIZE = 20;
const WORKSPACE_SERVER_PAGE_SIZE = 20;
const WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE + 1;
const SHARED_PLAYED_STORAGE_KEY = 'soridraw.suno.sharedPlaylistPlayed.v1';
const SUNO_REMAINING_CREDITS_KEY = 'soridraw_suno_remaining_credits';
const SUNO_REMAINING_CREDITS_UPDATED_AT_KEY = 'soridraw_suno_remaining_credits_updated_at';
const scopedCreditStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;

const readStoredSunoCredits = (uid?: string | null): { credits: number | null; updatedAt: number | null } => {
  try {
    const creditRaw = localStorage.getItem(scopedCreditStorageKey(SUNO_REMAINING_CREDITS_KEY, uid))
      || localStorage.getItem(SUNO_REMAINING_CREDITS_KEY)
      || '';
    const updatedRaw = localStorage.getItem(scopedCreditStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_KEY, uid))
      || localStorage.getItem(SUNO_REMAINING_CREDITS_UPDATED_AT_KEY)
      || '';
    const creditValue = Number(creditRaw);
    const updatedValue = Number(updatedRaw);
    return {
      credits: Number.isFinite(creditValue) && creditValue >= 0 ? creditValue : null,
      updatedAt: Number.isFinite(updatedValue) && updatedValue > 0 ? updatedValue : null,
    };
  } catch {
    return { credits: null, updatedAt: null };
  }
};

const getSharedPlayedKeys = (item: any): string[] => {
  const rawKeys = [
    item?.id,
    item?.sourceId,
    item?.trackId,
    item?.originalTrackId,
    item?.parentTrackId,
    item?.audioUrl,
    item?.streamAudioUrl,
    item?.audio_url,
    item?.title ? `title:${item.title}` : ''
  ];

  return Array.from(new Set(
    rawKeys
      .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
      .map((value) => String(value).trim())
  ));
};

const COLOR_OPTIONS = [
  { value: 'gray', color: '#6b7280', label: '회색' },
  { value: 'red', color: '#ef4444', label: '빨강' },
  { value: 'orange', color: '#f97316', label: '주황' },
  { value: 'yellow', color: '#eab308', label: '노랑' },
  { value: 'green', color: '#22c55e', label: '초록' },
  { value: 'blue', color: '#3b82f6', label: '파랑' },
  { value: 'purple', color: '#a855f7', label: '보라' }
];

const getColorHex = (colorTag?: string | null) => {
  const found = COLOR_OPTIONS.find(c => c.value === colorTag);
  return found?.color || '#6b7280';
};

const cleanSunoTitlePart = (value: any): string => {
  return String(value || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
};

const formatSunoDisplayTitle = (rawTitle: any): string => {
  const raw = String(rawTitle || '').trim();
  if (!raw) return 'Untitled';

  const genreMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const genre = genreMatch?.[1]?.trim() || '';
  let body = genreMatch ? raw.slice(genreMatch[0].length).trim() : raw;

  const quotedPair = body.match(/^['"]([^'"]+)['"]\s*[|│]\s*['"]([^'"]+)['"]$/);
  if (quotedPair) {
    const first = cleanSunoTitlePart(quotedPair[1]);
    const second = cleanSunoTitlePart(quotedPair[2]);
    return `${genre ? `[${genre}] ` : ''}'${first}' | '${second}'`;
  }

  const bodyWithoutOuterQuotes = body.replace(/^['"]+|['"]+$/g, '').trim();
  const parts = bodyWithoutOuterQuotes.split(/[|│]/).map(cleanSunoTitlePart).filter(Boolean);
  if (parts.length >= 2) {
    return `${genre ? `[${genre}] ` : ''}'${parts[0]}' | '${parts[1]}'`;
  }

  return `${genre ? `[${genre}] ` : ''}'${cleanSunoTitlePart(body) || 'Untitled'}'`;
};


type SunoTitleParts = {
  genre: string;
  title: string;
};

const splitSunoDisplayTitleParts = (rawTitle: any): SunoTitleParts => {
  const formatted = formatSunoDisplayTitle(rawTitle);
  const genreMatch = formatted.match(/^\[([^\]]+)\]\s*/);
  const genre = genreMatch ? `[${genreMatch[1].trim()}]` : '';
  const title = genreMatch ? formatted.slice(genreMatch[0].length).trim() : formatted.trim();

  return {
    genre,
    title: title || 'Untitled',
  };
};


function AnimatedTrackPlayButton({
  imageUrl,
  isActive,
  isPlaying,
  onClick,
  disabled,
  durationLabel,
  unavailable = false,
}: {
  imageUrl?: string | null;
  isActive: boolean;
  isPlaying: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  disabled?: boolean;
  durationLabel?: string;
  unavailable?: boolean;
}) {
  const isNowPlaying = isActive && isPlaying;
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setImageLoadFailed(false);
  }, [imageUrl]);

  const shouldUseImage = Boolean(imageUrl && !imageLoadFailed);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center transition-all border border-black/20 ${
        unavailable
          ? 'opacity-50 cursor-not-allowed text-white/20'
          : isNowPlaying
            ? 'ring-[3px] ring-[#7FBD75]/20 shadow-[0_12px_30px_rgba(127,189,117,0.22)] scale-[1.03]'
            : isActive
              ? 'ring-2 ring-[#7FBD75]/45'
              : 'hover:ring-2 hover:ring-[#7FBD75]/35 group-hover:scale-[1.03]'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#7FBD75]/10 via-[#7FBD75]/6 to-white/[0.03]" />
      {shouldUseImage ? (
        <img
          src={imageUrl || ''}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageLoadFailed(true)}
        />
      ) : null}

      {isNowPlaying && <div className="pointer-events-none absolute inset-0 rounded-full suno-playing-ring" />}
      {isNowPlaying && <div className="pointer-events-none absolute inset-[2px] rounded-full border border-[#7FBD75]/22 shadow-[0_0_18px_rgba(127,189,117,0.20)]" />}

      <div className={`absolute inset-0 transition-colors ${isNowPlaying ? 'bg-black/30' : 'bg-black/45 group-hover:bg-black/35'}`} />

      <div className="relative z-10 flex items-center justify-center text-white drop-shadow">
        {isNowPlaying ? (
          <span className="suno-icon-stack is-playing" aria-hidden="true">
            <span className="suno-icon-pause">
              <span className="suno-icon-pause-bar" />
              <span className="suno-icon-pause-bar" />
            </span>
            <span className="suno-icon-wave">
              {[0, 1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className="suno-icon-wave-bar"
                  style={{ animationDelay: `${bar * 0.12}s` }}
                />
              ))}
            </span>
          </span>
        ) : (
          <Play className="w-5 h-5 md:w-6 md:h-6 fill-white ml-0.5" />
        )}
      </div>

      {durationLabel && (
        <span className="absolute right-0.5 bottom-0.5 z-10 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold leading-none text-white shadow-sm border border-black/20 tabular-nums">
          {durationLabel}
        </span>
      )}
    </button>
  );
}

export default function SunoLibraryPage({ appUser = null }: { appUser?: any } = {}) {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusChecking, setStatusChecking] = useState<string | null>(null);
  const [user, setUser] = useState<any>(() => appUser || auth.currentUser);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(() => readStoredSunoCredits(auth.currentUser?.uid).credits);
  const [remainingCreditsUpdatedAt, setRemainingCreditsUpdatedAt] = useState<number | null>(() => readStoredSunoCredits(auth.currentUser?.uid).updatedAt);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isSharedOwner, setIsSharedOwner] = useState(false);
  const [sharedTrackLoading, setSharedTrackLoading] = useState(false);
  const [sharedError, setSharedError] = useState(false);
  const [showKakaoWarning, setShowKakaoWarning] = useState(false);
  
  const [libraryViewMode, setLibraryViewMode] = useState<"workspace" | "playlist" | "sharedPlaylist">("workspace");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedNormalPlaylistId, setSelectedNormalPlaylistId] = useState<string | null>(null);
  const [selectedSharedPlaylistId, setSelectedSharedPlaylistId] = useState<string | null>(null);
  const [activePlaylistSection, setActivePlaylistSection] = useState<'normal' | 'shared'>('normal');
  const [playlistDragging, setPlaylistDragging] = useState<{ section: 'normal' | 'shared'; playlistId: string } | null>(null);
  const playlistButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const playlistBarRefs = useRef<Record<'normal' | 'shared', HTMLDivElement | null>>({ normal: null, shared: null });
  const playlistPressTimerRef = useRef<number | null>(null);
  const playlistDragRef = useRef<{
    section: 'normal' | 'shared';
    playlistId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    target?: HTMLButtonElement | null;
    windowMoveHandler?: (event: PointerEvent) => void;
    windowEndHandler?: (event: PointerEvent) => void;
    windowTouchMoveHandler?: (event: TouchEvent) => void;
    windowTouchEndHandler?: (event: TouchEvent) => void;
  } | null>(null);
  const playlistSuppressClickRef = useRef<string | null>(null);
  const playlistsRef = useRef<Playlist[]>([]);
  const activePlaylistId = activePlaylistSection === 'normal' ? selectedNormalPlaylistId : selectedSharedPlaylistId;
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistVisibleCount, setPlaylistVisibleCount] = useState(WORKSPACE_PAGE_SIZE);
  const [loadingPlaylistItems, setLoadingPlaylistItems] = useState(false);
  const [playlistSortMode, setPlaylistSortMode] = useState<'added' | 'genre' | 'custom'>('added');
  const [playlistVisibilityFilter, setPlaylistVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [playlistColorFilter, setPlaylistColorFilter] = useState<string>('all');
  const [playlistSearchTerm, setPlaylistSearchTerm] = useState('');
  const [workspaceColorFilter, setWorkspaceColorFilter] = useState<string>('all');
  const [workspaceLocalColorMap, setWorkspaceLocalColorMap] = useState<Record<string, string>>({});
  const [playlistLocalColorMap, setPlaylistLocalColorMap] = useState<Record<string, string>>({});
  const [, setLibraryColorSyncTick] = useState(0);
  const [isLibraryAdminUser, setIsLibraryAdminUser] = useState(false);
  const lastWorkspaceServerColorMapRef = React.useRef<Record<string, string>>({});
  const lastPlaylistServerColorMapRef = React.useRef<Record<string, string>>({});
  const pendingWorkspaceColorKeysRef = React.useRef<Set<string>>(new Set());
  const pendingPlaylistColorKeysRef = React.useRef<Set<string>>(new Set());
  const workspaceLocalColorMapRef = React.useRef<Record<string, string>>({});
  const playlistLocalColorMapRef = React.useRef<Record<string, string>>({});
  const workspaceColorBaselineRef = React.useRef<string>('{}');
  const playlistColorBaselineRef = React.useRef<string>('{}');
  const workspaceColorDirtyRef = React.useRef(false);
  const playlistColorDirtyRef = React.useRef(false);
  const libraryColorsAutoSyncingRef = React.useRef(false);
  const libraryUserRef = React.useRef(user);
  
  const [likesCache, setLikesCache] = useState<Record<string, { likeCount: number, likedByMe: boolean }>>({});
  const [sharedStatusCache, setSharedStatusCache] = useState<Record<string, { isPublic: boolean, checkedAt: number }>>({});
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [shareCreatorNameMap, setShareCreatorNameMap] = useState<Record<string, string>>({});
  const [sharedPlayedMap, setSharedPlayedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (appUser) {
      setUser(appUser);
    }
  }, [appUser?.uid]);

  useEffect(() => {
    const readCachedCredits = () => {
      const currentUid = (appUser || auth.currentUser || user)?.uid;
      const cached = readStoredSunoCredits(currentUid);
      setRemainingCredits(cached.credits);
      setRemainingCreditsUpdatedAt(cached.updatedAt);
    };

    const handleUpdate = (event?: Event) => {
      const customEvent = event as CustomEvent<{ remainingCredits?: number | null; updatedAt?: number | null }>;
      if (customEvent?.detail && Object.prototype.hasOwnProperty.call(customEvent.detail, 'remainingCredits')) {
        const nextCredits = customEvent.detail.remainingCredits;
        const nextUpdatedAt = customEvent.detail.updatedAt;
        setRemainingCredits(typeof nextCredits === 'number' && Number.isFinite(nextCredits) && nextCredits >= 0 ? nextCredits : null);
        setRemainingCreditsUpdatedAt(typeof nextUpdatedAt === 'number' && Number.isFinite(nextUpdatedAt) && nextUpdatedAt > 0 ? nextUpdatedAt : null);
        return;
      }
      readCachedCredits();
    };

    readCachedCredits();
    window.addEventListener('storage', handleUpdate as EventListener);
    window.addEventListener('soridraw:suno-credits-updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', handleUpdate as EventListener);
      window.removeEventListener('soridraw:suno-credits-updated', handleUpdate as EventListener);
    };
  }, [appUser, user]);

  const formatCreditCheckedAt = (value: number | null) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCreditShortcutClick = () => {
    navigate('/my-page?section=music-api');
  };

  useEffect(() => {
    let cancelled = false;
    const loadAdminRole = async () => {
      if (!user?.uid) {
        if (!cancelled) setIsLibraryAdminUser(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) setIsLibraryAdminUser(snap.exists() && snap.data()?.role === 'admin');
      } catch (error) {
        console.warn('library admin role check failed', error);
        if (!cancelled) setIsLibraryAdminUser(false);
      }
    };
    loadAdminRole();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHARED_PLAYED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setSharedPlayedMap(parsed);
      }
    } catch (error) {
      console.warn('load shared playlist played map failed:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const loadedWorkspaceMap = readLocalColorMap('soridraw.library.workspaceColorTags');
      const loadedPlaylistMap = readLocalColorMap('soridraw.library.playlistColorTags');
      setWorkspaceLocalColorMap(loadedWorkspaceMap);
      setPlaylistLocalColorMap(loadedPlaylistMap);
      workspaceLocalColorMapRef.current = loadedWorkspaceMap;
      playlistLocalColorMapRef.current = loadedPlaylistMap;
      workspaceColorBaselineRef.current = serializeColorMap(loadedWorkspaceMap);
      playlistColorBaselineRef.current = serializeColorMap(loadedPlaylistMap);
      workspaceColorDirtyRef.current = false;
      playlistColorDirtyRef.current = false;
    } catch (error) {
      console.warn('load library color map failed:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    workspaceLocalColorMapRef.current = workspaceLocalColorMap;
  }, [workspaceLocalColorMap]);

  useEffect(() => {
    playlistLocalColorMapRef.current = playlistLocalColorMap;
  }, [playlistLocalColorMap]);

  useEffect(() => {
    libraryUserRef.current = user;
  }, [user]);

  useEffect(() => {
    writeLocalColorMap('soridraw.library.workspaceColorTags', workspaceLocalColorMap);
  }, [workspaceLocalColorMap, user?.uid]);

  useEffect(() => {
    writeLocalColorMap('soridraw.library.playlistColorTags', playlistLocalColorMap);
  }, [playlistLocalColorMap, user?.uid]);

  useEffect(() => {
    const serverMap: Record<string, string> = {};
    const loadedTrackIds = new Set<string>();

    for (const track of tracks || []) {
      const trackId = track?.id || track?.trackId;
      if (!trackId) continue;
      loadedTrackIds.add(String(trackId));
      for (const colorField of ['colorTags', 'favoriteColorTags']) {
        const source = track?.[colorField] || {};
        Object.entries(source).forEach(([idx, color]) => {
          serverMap[`workspace:${colorField}:${trackId}:${idx}`] = color && color !== 'gray' ? String(color) : 'gray';
        });
      }
    }

    const localWorkspaceMap = { ...readLocalColorMap('soridraw.library.workspaceColorTags'), ...workspaceLocalColorMap };
    Object.keys(localWorkspaceMap).forEach((key) => {
      const [, colorField, trackId, idx] = key.split(':');
      if (!trackId || idx === undefined || (colorField !== 'colorTags' && colorField !== 'favoriteColorTags')) return;
      if (loadedTrackIds.has(trackId) && serverMap[key] === undefined) serverMap[key] = 'gray';
    });

    const previous = lastWorkspaceServerColorMapRef.current || {};
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(serverMap)]);
    if (allKeys.size === 0) {
      lastWorkspaceServerColorMapRef.current = serverMap;
      return;
    }

    if (workspaceColorDirtyRef.current) {
      lastWorkspaceServerColorMapRef.current = serverMap;
      return;
    }

    let changed = false;
    setWorkspaceLocalColorMap((prev) => {
      const next = { ...prev };
      for (const key of allKeys) {
        if (pendingWorkspaceColorKeysRef.current.has(key)) continue;
        const before = previous[key] || 'gray';
        const current = serverMap[key] || 'gray';
        if (before !== current) {
          changed = true;
          if (current === 'gray') delete next[key];
          else next[key] = current;
        }
      }
      return changed ? next : prev;
    });
    if (changed) {
      try {
        const merged = { ...readLocalColorMap('soridraw.library.workspaceColorTags') };
        for (const key of allKeys) {
          if (pendingWorkspaceColorKeysRef.current.has(key)) continue;
          const before = previous[key] || 'gray';
          const current = serverMap[key] || 'gray';
          if (before !== current) {
            if (current === 'gray') delete merged[key];
            else merged[key] = current;
          }
        }
        writeLocalColorMap('soridraw.library.workspaceColorTags', merged);
        workspaceLocalColorMapRef.current = merged;
        workspaceColorBaselineRef.current = serializeColorMap(merged);
        workspaceColorDirtyRef.current = false;
      } catch (error) {
        console.warn('workspace server color merge failed:', error);
      }
    }
    lastWorkspaceServerColorMapRef.current = serverMap;
  }, [tracks, workspaceLocalColorMap]);

  useEffect(() => {
    const serverMap: Record<string, string> = {};
    const loadedPlaylistId = activePlaylistId || 'unknown';

    for (const item of playlistItems || []) {
      const playlistId = (item as any)?.playlistId || loadedPlaylistId;
      const itemId = (item as any)?.id || 'unknown';
      const color = (item as any)?.colorTag;
      if (playlistId !== 'unknown' && itemId !== 'unknown') {
        serverMap[`playlist:${playlistId}:${itemId}`] = color && color !== 'gray' ? String(color) : 'gray';
      }
    }

    const localPlaylistMap = { ...readLocalColorMap('soridraw.library.playlistColorTags'), ...playlistLocalColorMap };
    Object.keys(localPlaylistMap).forEach((key) => {
      const [, playlistId, itemId] = key.split(':');
      if (!playlistId || !itemId || playlistId === 'unknown' || itemId === 'unknown') return;
      if (playlistId === loadedPlaylistId && serverMap[key] === undefined) serverMap[key] = 'gray';
    });

    const previous = lastPlaylistServerColorMapRef.current || {};
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(serverMap)]);
    if (allKeys.size === 0) {
      lastPlaylistServerColorMapRef.current = serverMap;
      return;
    }

    if (playlistColorDirtyRef.current) {
      lastPlaylistServerColorMapRef.current = serverMap;
      return;
    }

    let changed = false;
    setPlaylistLocalColorMap((prev) => {
      const next = { ...prev };
      for (const key of allKeys) {
        if (pendingPlaylistColorKeysRef.current.has(key)) continue;
        const before = previous[key] || 'gray';
        const current = serverMap[key] || 'gray';
        if (before !== current) {
          changed = true;
          if (current === 'gray') delete next[key];
          else next[key] = current;
        }
      }
      return changed ? next : prev;
    });
    if (changed) {
      try {
        const merged = { ...readLocalColorMap('soridraw.library.playlistColorTags') };
        for (const key of allKeys) {
          if (pendingPlaylistColorKeysRef.current.has(key)) continue;
          const before = previous[key] || 'gray';
          const current = serverMap[key] || 'gray';
          if (before !== current) {
            if (current === 'gray') delete merged[key];
            else merged[key] = current;
          }
        }
        writeLocalColorMap('soridraw.library.playlistColorTags', merged);
        playlistLocalColorMapRef.current = merged;
        playlistColorBaselineRef.current = serializeColorMap(merged);
        playlistColorDirtyRef.current = false;
      } catch (error) {
        console.warn('playlist server color merge failed:', error);
      }
    }
    lastPlaylistServerColorMapRef.current = serverMap;
  }, [playlistItems, activePlaylistId, playlistLocalColorMap]);

  const [renameModalArgs, setRenameModalArgs] = useState<{ playlist: Playlist, newTitle: string } | null>(null);
  const [moveModalArgs, setMoveModalArgs] = useState<{ item: PlaylistItem } | null>(null);
  type PlaylistSaveTarget = { group: any; item: any; audioUrl: string; idx: number };
  const [playlistSavePicker, setPlaylistSavePicker] = useState<{ isShared: boolean; targets: PlaylistSaveTarget[]; playlists: Playlist[] } | null>(null);
  const [playlistSaveCreateTitle, setPlaylistSaveCreateTitle] = useState<string | null>(null);

  const isKakaoInAppBrowser = /KAKAOTALK/i.test(navigator.userAgent || '');

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuState(null);
      setActivePlaylistItemMenu(null);
      setActiveColorMenu(null);
      setBulkMenuState(null);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [libraryPlaceholderIndex, setLibraryPlaceholderIndex] = useState(0);
  const [isLibrarySearchFocused, setIsLibrarySearchFocused] = useState(false);
  const librarySearchPlaceholders = [
    "음악 제목이나 스타일 검색...",
    "곡 제목으로 검색해보세요...",
    "장르나 키워드로 검색해보세요...",
    "제작자 이름으로 검색해보세요..."
  ];
  const playlistSearchPlaceholders = [
    "음악 제목이나 제작자 검색...",
    "플레이리스트 이름으로 검색해보세요...",
    "공유 플레이리스트를 찾아보세요...",
    "곡 제목으로 검색해보세요..."
  ];
  const [filter, setFilter] = useState<'all' | 'completed' | 'favorite' | 'public' | 'private' | 'trash'>('all');
  const [workspaceVisibleCount, setWorkspaceVisibleCount] = useState(WORKSPACE_PAGE_SIZE);
  const [hasMoreWorkspaceServerTracks, setHasMoreWorkspaceServerTracks] = useState(false);
  const [isLoadingMoreWorkspaceTracks, setIsLoadingMoreWorkspaceTracks] = useState(false);
  const workspaceLastTrackDocRef = useRef<any>(null);
  const workspacePaginationFallbackRef = useRef(false);
  const [showWorkspaceMoreTooltip, setShowWorkspaceMoreTooltip] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLibraryPlaceholderIndex((prev) => (prev + 1) % librarySearchPlaceholders.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (libraryViewMode === 'workspace') {
      setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
    }
  }, [libraryViewMode, searchTerm, filter, workspaceColorFilter]);

  useEffect(() => {
    if (libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') {
      setPlaylistVisibleCount(WORKSPACE_PAGE_SIZE);
    }
  }, [libraryViewMode, activePlaylistId, playlistSearchTerm, playlistVisibilityFilter, playlistColorFilter, playlistSortMode]);

  useEffect(() => {
    setMultiSelectMode(false);
    setSelectedTrackMap({});
    setBulkMenuState(null);
  }, [libraryViewMode, selectedNormalPlaylistId, selectedSharedPlaylistId, activePlaylistSection, filter]);

  const [showDetails, setShowDetails] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  interface MenuState {
    id: string;
    position: { top: number; left: number };
    anchorEl?: HTMLElement | null;
    group: any;
    item: any;
    idx: number;
    audioUrl: string;
  }
  const [activeMenuState, setActiveMenuState] = useState<MenuState | null>(null);
  const [activePlaylistItemMenu, setActivePlaylistItemMenu] = useState<string | null>(null);
  const [playlistItemContextMenuPosition, setPlaylistItemContextMenuPosition] = useState<{ id: string; top: number; left: number } | null>(null);
  const [activeColorMenu, setActiveColorMenu] = useState<string | null>(null);
  type MultiSelectContext = 'workspace' | 'playlist' | 'sharedPlaylist';
  type MultiSelectedTrack = {
    key: string;
    context: MultiSelectContext;
    group?: any;
    item: any;
    idx: number;
    audioUrl: string;
    title: string;
  };
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedTrackMap, setSelectedTrackMap] = useState<Record<string, MultiSelectedTrack>>({});
  const [bulkMenuState, setBulkMenuState] = useState<{ top: number; right: number; anchorEl?: HTMLElement | null } | null>(null);
  const selectedTrackList = useMemo(() => Object.values(selectedTrackMap), [selectedTrackMap]);
  const selectedTrackCount = selectedTrackList.length;
  const isLibraryTrashMode = filter === 'trash' && libraryViewMode === 'workspace';
  const libraryPageRootRef = useRef<HTMLDivElement | null>(null);
  const libraryLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryLongPressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const libraryCardClickStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const libraryLongPressTriggeredRef = useRef(false);
  const librarySuppressNextCardClickRef = useRef(false);
  const librarySuppressNextCardClickKeyRef = useRef<string | null>(null);
  const libraryDragSelectActiveRef = useRef(false);
  const libraryDragSelectMovedRef = useRef(false);
  const libraryDragSelectStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const libraryDragSelectStartSelectionRef = useRef<MultiSelectedTrack | null>(null);
  const libraryDragSelectActionRef = useRef<'select' | 'deselect'>('select');
  const libraryDragSelectVisitedKeysRef = useRef<Set<string>>(new Set());
  const libraryDragSelectSuppressClickRef = useRef(false);

  useEffect(() => {
    const stopLibraryDragSelect = () => handleLibraryDragSelectEnd();
    window.addEventListener('mouseup', stopLibraryDragSelect);
    return () => window.removeEventListener('mouseup', stopLibraryDragSelect);
  }, []);

  useEffect(() => {
    const closeFloatingMenus = () => {
      setActiveMenuState(null);
      setActivePlaylistItemMenu(null);
      setActiveColorMenu(null);
      setBulkMenuState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeFloatingMenus();
      if (multiSelectMode) {
        setMultiSelectMode(false);
        setSelectedTrackMap({});
        setBulkShareModalOpen(false);
        setBulkMoveModalOpen(false);
        setLibrarySelectionMoreOpen(false);
      }
    };

    const handlePopState = () => {
      setActiveMenuState(null);
      setActivePlaylistItemMenu(null);
      setBulkMenuState(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [multiSelectMode]);

  const computeFloatingMenuPosition = (anchorEl: HTMLElement, estimatedHeight = 280) => {
    const rect = anchorEl.getBoundingClientRect();
    const margin = 12;

    const topBelowViewport = rect.bottom + 8;
    const topAboveViewport = rect.top - estimatedHeight - 8;
    const maxTop = Math.max(margin, window.innerHeight - estimatedHeight - margin);
    const preferredTop = topBelowViewport + estimatedHeight > window.innerHeight
      ? topAboveViewport
      : topBelowViewport;
    const top = Math.min(Math.max(margin, preferredTop), maxTop);
    const right = Math.max(margin, window.innerWidth - rect.right);

    return { top, right };
  };

  const getWorkspaceMoreMenuEstimatedHeight = (group: any) => {
    const isFailed = group?.status === 'failed';
    const baseCount = 2; // 디테일, 선택
    let itemCount = baseCount;

    if (filter === 'trash') {
      if (!isSharedView) itemCount += 2; // 복구, 영구 삭제
    } else if (isFailed) {
      if (!isSharedView) itemCount += 1; // 삭제(휴지통)
    } else {
      itemCount += 4; // 다운로드, 다음곡에 적용, 공유, 플레이리스트 저장
      if (!isSharedView) itemCount += 2; // 즐겨찾기, 삭제(휴지통)
    }

    const screenType = typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-screen-type')
      : null;
    const isFhdCompact = screenType === 'fhd-desktop';

    // FHD compact CSS reduces menu button vertical padding, so the actual menu height
    // is smaller than the default px-4 py-2.5 estimate. If we keep the larger estimate,
    // menus that open upward float too far above the ... button.
    const itemHeight = isFhdCompact ? 30.5 : 36;
    const panelPadding = isFhdCompact ? 12 : 16;
    const minHeight = isFhdCompact ? 120 : 144;

    return Math.max(minHeight, itemCount * itemHeight + panelPadding);
  };

  const computeWorkspaceMoreMenuPosition = (anchorEl: HTMLElement, estimatedHeight = 300, estimatedWidth = 192) => {
    const rect = anchorEl.getBoundingClientRect();
    const rootRect = libraryPageRootRef.current?.getBoundingClientRect();
    const margin = 12;
    const anchorGap = 8;

    // 메뉴는 라이브러리 페이지 root 내부 absolute 요소로 렌더링된다.
    // 그래서 getBoundingClientRect()의 viewport 좌표를 그대로 top/left에 쓰면,
    // mx-auto 컨테이너의 left/top 오프셋만큼 위치가 밀린다.
    // 먼저 viewport 안에서 안전한 위치를 잡고, 마지막에 root 기준 좌표로 변환한다.
    const openBelowTop = rect.bottom + anchorGap;
    const openAboveTop = rect.top - estimatedHeight - anchorGap;
    const hasEnoughBelow = openBelowTop + estimatedHeight <= window.innerHeight - margin;
    const hasEnoughAbove = openAboveTop >= margin;

    let viewportTop = hasEnoughBelow || !hasEnoughAbove ? openBelowTop : openAboveTop;
    viewportTop = Math.min(
      Math.max(margin, viewportTop),
      Math.max(margin, window.innerHeight - estimatedHeight - margin)
    );

    let viewportLeft = rect.right - estimatedWidth;
    viewportLeft = Math.min(
      Math.max(margin, viewportLeft),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );

    const rootViewportTop = rootRect?.top ?? 0;
    const rootViewportLeft = rootRect?.left ?? 0;

    return {
      top: viewportTop - rootViewportTop,
      left: viewportLeft - rootViewportLeft,
    };
  };

  const computePointerMenuPosition = (clientX: number, clientY: number, estimatedHeight = 300, estimatedWidth = 192) => {
    const rootRect = libraryPageRootRef.current?.getBoundingClientRect();
    const margin = 12;
    const viewportLeft = Math.min(
      Math.max(margin, clientX),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );
    const viewportTop = Math.min(
      Math.max(margin, clientY),
      Math.max(margin, window.innerHeight - estimatedHeight - margin)
    );

    return {
      top: viewportTop - (rootRect?.top ?? 0),
      left: viewportLeft - (rootRect?.left ?? 0),
    };
  };

  const computePointerBulkMenuPosition = (clientX: number, clientY: number, estimatedHeight = 300, estimatedWidth = 224) => {
    const margin = 12;
    const viewportLeft = Math.min(
      Math.max(margin, clientX),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );
    const top = Math.min(
      Math.max(margin, clientY),
      Math.max(margin, window.innerHeight - estimatedHeight - margin)
    );

    return {
      top,
      right: Math.max(margin, window.innerWidth - viewportLeft - estimatedWidth),
    };
  };

  const computeInlinePointerMenuPosition = (card: HTMLElement, clientX: number, clientY: number, estimatedHeight = 340, estimatedWidth = 160) => {
    const menuButton = card.querySelector<HTMLElement>('[data-playlist-more-menu-button="true"]');
    const anchor = menuButton?.parentElement;
    if (!anchor) return null;

    const anchorRect = anchor.getBoundingClientRect();
    const margin = 12;
    const viewportLeft = Math.min(
      Math.max(margin, clientX),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );
    const viewportTop = Math.min(
      Math.max(margin, clientY),
      Math.max(margin, window.innerHeight - estimatedHeight - margin)
    );

    return {
      left: viewportLeft - anchorRect.left,
      top: viewportTop - anchorRect.top,
    };
  };

  interface DeleteAction {
    groupId: string;
    itemIndex: number;
    group: any;
    action: 'hide' | 'restore' | 'permanentDelete';
  }
  interface PlaylistConfirmAction {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
  }
  const [playlistConfirmAction, setPlaylistConfirmAction] = useState<PlaylistConfirmAction | null>(null);
  const [isPlaylistConfirming, setIsPlaylistConfirming] = useState(false);
  const [bulkShareModalOpen, setBulkShareModalOpen] = useState(false);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [librarySelectionMoreOpen, setLibrarySelectionMoreOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteAction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const checkingIdsRef = React.useRef<Set<string>>(new Set());
  const autoCheckCountsRef = React.useRef<Map<string, number>>(new Map());
  const autoCheckLastRunAtRef = React.useRef<Map<string, number>>(new Map());
  const firstAudioDetectedAtRef = React.useRef<Map<string, number>>(new Map());
  const modalHistoryPushedRef = React.useRef(false);
  const multiSelectHistoryPushedRef = React.useRef(false);

  const { currentTrack, isPlaying, playTrack, togglePlayPause, setIsSharedPlayerMode } = useGlobalPlayer();

  // Scroll to top on page enter
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    console.log("Shared page browser check:", {
      userAgent: navigator.userAgent,
      isKakaoInAppBrowser,
      isSharePage: isSharedView,
    });

    if (isSharedView && isKakaoInAppBrowser) {
      setShowKakaoWarning(true);
    }
  }, [isSharedView, isKakaoInAppBrowser]);

  useEffect(() => {
    if ((window as any).Kakao && !(window as any).Kakao.isInitialized()) {
      (window as any).Kakao.init("YOUR_KAKAO_JAVASCRIPT_KEY");
    }
  }, []);

  useEffect(() => {
    return () => {
      setIsSharedPlayerMode(false);
    };
  }, []);


  const getTrackCreatedAtMs = (track: any): number => {
    const value = track?.createdAt;
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const mergeWorkspaceTracks = (incoming: any[], previous: any[] = []): any[] => {
    const map = new Map<string, any>();
    previous.forEach((track: any) => {
      const id = String(track?.id || '').trim();
      if (id) map.set(id, track);
    });
    incoming.forEach((track: any) => {
      const id = String(track?.id || '').trim();
      if (id) map.set(id, { ...(map.get(id) || {}), ...track });
    });
    return Array.from(map.values()).sort((a: any, b: any) => getTrackCreatedAtMs(b) - getTrackCreatedAtMs(a));
  };

  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    try {
      localStorage.setItem(`soridraw_suno_tracks_cache_${uid}`, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save suno_tracks to cache:', e);
    }
  };

  const removeWorkspaceTracksLocally = (trackIds: string[]) => {
    const removedIds = new Set(
      trackIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );
    if (removedIds.size === 0) return;

    setTracks((prev) => {
      const next = (Array.isArray(prev) ? prev : []).filter(
        (track: any) => !removedIds.has(String(track?.id || '').trim())
      );
      const uid = user?.uid || appUser?.uid || auth.currentUser?.uid;
      if (uid) saveWorkspaceTrackCache(uid, next);
      return next;
    });
  };

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const trackId = searchParams.get('track');

    if (trackId) {
      setIsSharedView(true);
      setIsSharedPlayerMode(true);
      setSharedTrackLoading(true);

      const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
        const resolvedUser = currentUser || appUser || auth.currentUser;
        setUser(resolvedUser);
        try {
          console.log("shared track search start", { trackId, isSharedView: true, hasUser: !!resolvedUser });

          if (resolvedUser) {
            const trackRef = doc(db, 'suno_tracks', resolvedUser.uid, 'tracks', trackId);
            const snap = await getDoc(trackRef);
            if (snap.exists() && !snap.data().hidden) {
              setTracks([{ id: snap.id, ...snap.data() }]);
              setIsSharedOwner(true);
              setSharedTrackLoading(false);
              setLoading(false);
              return;
            }
          }

          const shareSnap = await getDoc(doc(db, 'suno_shares', trackId));
          if (shareSnap.exists() && shareSnap.data().isPublic) {
            const shareData = shareSnap.data();
            let safeSunoData = shareData.sunoData || [];
            if (typeof shareData.subTrackIndex === 'number' && safeSunoData.length > shareData.subTrackIndex) {
               safeSunoData = [safeSunoData[shareData.subTrackIndex]];
            }
            
            setTracks([{ 
              ...shareData,
              id: trackId,
              trackId: shareData.trackId,
              sunoData: safeSunoData
            }]);
            setIsSharedOwner(resolvedUser?.uid === shareData.ownerUid);
            setSharedTrackLoading(false);
            setLoading(false);
            return;
          }
          
          const q = query(
            collectionGroup(db, 'tracks'),
            where('isPublic', '==', true)
          );
          const querySnapshot = await getDocs(q);
          console.log("public tracks count", querySnapshot.size);
          
          let publicTrack = null;
          for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            console.log("public track candidate", {
              docId: docSnap.id,
              isPublic: data.isPublic,
              hidden: data.hidden,
              title: data.title
            });
            
            if (docSnap.id === trackId && data.isPublic === true && data.hidden !== true) {
              publicTrack = docSnap;
              break;
            }
          }
          
          if (publicTrack) {
            setTracks([{ id: publicTrack.id, ...publicTrack.data() }]);
          } else {
            setTracks([]);
          }
        } catch (e: any) {
          console.error("shared track query failed", e);
          setTracks([]);
          // Private shares are intentionally unreadable by Firestore rules.
          // Treat permission-denied as an unavailable/private track, not as a system error.
          setSharedError(e?.code && e.code !== 'permission-denied');
        } finally {
          setSharedTrackLoading(false);
          setLoading(false);
        }
      });
      return () => unsubAuth();
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      const resolvedUser = currentUser || appUser || auth.currentUser;
      setUser(resolvedUser);

      if (!resolvedUser) {
        setLoading(false);
        setTracks([]);
        return;
      }

      const cacheKey = `soridraw_suno_tracks_cache_${resolvedUser.uid}`;
      workspaceLastTrackDocRef.current = null;
      workspacePaginationFallbackRef.current = false;
      setHasMoreWorkspaceServerTracks(false);
      setIsLoadingMoreWorkspaceTracks(false);

      let cachedTracks: any[] = [];
      try {
        const cachedJson = localStorage.getItem(cacheKey);
        if (cachedJson) {
          cachedTracks = JSON.parse(cachedJson);
        }
      } catch (e) {
        console.error('Failed to parse cached suno_tracks:', e);
      }

      if (Array.isArray(cachedTracks) && cachedTracks.length > 0) {
        setTracks(cachedTracks);
        setLoading(false);
      } else {
        setTracks([]);
        setLoading(true);
      }

      const tracksRef = collection(db, 'suno_tracks', resolvedUser.uid, 'tracks');
      const pageQuery = query(
        tracksRef,
        orderBy('createdAt', 'desc'),
        limit(WORKSPACE_SERVER_FETCH_SIZE)
      );

      const startFullWorkspaceFallback = () => {
        workspacePaginationFallbackRef.current = true;
        setHasMoreWorkspaceServerTracks(false);
        const fallbackQuery = query(tracksRef);
        return onSnapshot(fallbackQuery, (snapshot) => {
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          const sorted = mergeWorkspaceTracks(list, []);
          setTracks(sorted);
          setLoading(false);
          saveWorkspaceTrackCache(resolvedUser.uid, sorted);
        }, (error) => {
          console.error('Error fetching tracks fallback:', error);
          setLoading(false);
        });
      };

      let unsubscribeFallback: (() => void) | undefined;
      const unsubscribeSnapshot = onSnapshot(pageQuery, (snapshot) => {
        const docs = snapshot.docs;
        const hasMore = docs.length > WORKSPACE_SERVER_PAGE_SIZE;
        const visibleDocs = docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
        workspaceLastTrackDocRef.current = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
        setHasMoreWorkspaceServerTracks(hasMore);

        const list = visibleDocs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setTracks((prev) => {
          const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
          saveWorkspaceTrackCache(resolvedUser.uid, merged);
          return merged;
        });
        setLoading(false);
      }, (error: any) => {
        console.error('Error fetching paged tracks:', error);
        setLoading(false);
        if (!unsubscribeFallback) {
          unsubscribeFallback = startFullWorkspaceFallback();
        }
      });

      return () => {
        unsubscribeSnapshot();
        if (unsubscribeFallback) unsubscribeFallback();
      };
    });

    return () => unsubscribeAuth();
  }, [appUser?.uid]);


  const loadMoreWorkspaceTracks = async () => {
    if (!user || isSharedView || workspacePaginationFallbackRef.current) {
      setWorkspaceVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, filteredTracks.length));
      return;
    }

    if (workspaceVisibleCount < filteredTracks.length) {
      setWorkspaceVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, filteredTracks.length));
      return;
    }

    if (!hasMoreWorkspaceServerTracks || !workspaceLastTrackDocRef.current || isLoadingMoreWorkspaceTracks) return;

    setIsLoadingMoreWorkspaceTracks(true);
    try {
      const tracksRef = collection(db, 'suno_tracks', user.uid, 'tracks');
      const nextQuery = query(
        tracksRef,
        orderBy('createdAt', 'desc'),
        startAfter(workspaceLastTrackDocRef.current),
        limit(WORKSPACE_SERVER_FETCH_SIZE)
      );
      const snapshot = await getDocs(nextQuery);
      const docs = snapshot.docs;
      const hasMore = docs.length > WORKSPACE_SERVER_PAGE_SIZE;
      const visibleDocs = docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
      workspaceLastTrackDocRef.current = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : workspaceLastTrackDocRef.current;
      setHasMoreWorkspaceServerTracks(hasMore);

      const list = visibleDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTracks((prev) => {
        const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
        saveWorkspaceTrackCache(user.uid, merged);
        return merged;
      });
      setWorkspaceVisibleCount((prev) => prev + WORKSPACE_PAGE_SIZE);
    } catch (error) {
      console.error('load more workspace tracks failed:', error);
      workspacePaginationFallbackRef.current = true;
      setHasMoreWorkspaceServerTracks(false);
    } finally {
      setIsLoadingMoreWorkspaceTracks(false);
    }
  };

  useEffect(() => {
    if (!user || (libraryViewMode !== 'playlist' && libraryViewMode !== 'sharedPlaylist') || isSharedView) {
      if (!user) {
        setPlaylists([]);
      }
      return;
    }

    let unsub: (() => void) | undefined;

    const initPlaylists = async () => {
      try {
        await ensureDefaultPlaylists(user.uid);
      } catch (error) {
        console.error("ensureDefaultPlaylists failed:", error);
      }

      const listsRef = collection(db, 'user_playlists', user.uid, 'lists');
      unsub = onSnapshot(listsRef, (snapshot) => {
        const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
        setPlaylists(lists);
      }, (error) => {
        console.error("playlist snapshot failed:", error);
      });
    };

    initPlaylists();

    return () => {
      if (unsub) unsub();
    };
  }, [user, libraryViewMode, isSharedView]);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  useEffect(() => () => {
    if (playlistPressTimerRef.current) window.clearTimeout(playlistPressTimerRef.current);
    document.body.classList.remove('soridraw-folder-dragging');
  }, []);

  const actualNormalPlaylists = useMemo(() => playlists.filter(p => p.type === 'normal').sort((a, b) => a.order - b.order), [playlists]);
  const actualSharedPlaylists = useMemo(() => playlists.filter(p => p.type === 'shared').sort((a, b) => a.order - b.order), [playlists]);

  const visibleNormalPlaylists = actualNormalPlaylists.length > 0 ? actualNormalPlaylists : fallbackNormalPlaylists;
  const visibleSharedPlaylists = actualSharedPlaylists.length > 0 ? actualSharedPlaylists : fallbackSharedPlaylists;

  useEffect(() => {
    if (libraryViewMode !== 'playlist' && libraryViewMode !== 'sharedPlaylist') return;
    
    console.log("Playlist mode data:", {
      userId: user?.uid,
      normalCount: actualNormalPlaylists.length,
      sharedCount: actualSharedPlaylists.length,
      usingNormalFallback: actualNormalPlaylists.length === 0,
      usingSharedFallback: actualSharedPlaylists.length === 0
    });

    if (visibleNormalPlaylists.length > 0 && !visibleNormalPlaylists.some(p => p.id === selectedNormalPlaylistId)) {
      setSelectedNormalPlaylistId(visibleNormalPlaylists[0].id!);
    }
    if (visibleSharedPlaylists.length > 0 && !visibleSharedPlaylists.some(p => p.id === selectedSharedPlaylistId)) {
      setSelectedSharedPlaylistId(visibleSharedPlaylists[0].id!);
    }
  }, [
    libraryViewMode, 
    user?.uid, 
    actualNormalPlaylists.length, 
    actualSharedPlaylists.length, 
    visibleNormalPlaylists, 
    visibleSharedPlaylists,
    selectedNormalPlaylistId,
    selectedSharedPlaylistId
  ]);

  const handleRenamePlaylist = (playlist: Playlist) => {
    if (!user || (playlist as any).isFallback) return;

    const isShared = playlist.type === 'shared';
    const firstPlaylist = isShared ? visibleSharedPlaylists[0] : visibleNormalPlaylists[0];
    if (firstPlaylist && firstPlaylist.id === playlist.id) {
      showToast("기본 플레이리스트 이름은 변경할 수 없습니다.");
      return;
    }

    setRenameModalArgs({ playlist, newTitle: playlist.title });
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    if (!user || (playlist as any).isFallback) return;

    const isNormal = playlist.type === 'normal';
    const currentList = isNormal ? actualNormalPlaylists : actualSharedPlaylists;

    if (currentList.length > 0 && currentList[0].id === playlist.id) {
      showToast("기본 플레이리스트는 삭제할 수 없습니다.");
      return;
    }

    if (currentList.length <= 1) {
      showToast(isNormal ? '최소 1개의 플레이리스트는 남겨야 합니다.' : '최소 1개의 공유 받은 곡 플레이리스트는 남겨야 합니다.');
      return;
    }

    setPlaylistConfirmAction({
      title: '플레이리스트 삭제',
      message: '이 플레이리스트를 삭제할까요? 저장된 곡도 내 목록에서 함께 제거됩니다.',
      confirmLabel: '삭제',
      danger: true,
      onConfirm: async () => {
        try {
          await deletePlaylist(user.uid, playlist.id!);
          
          // Update selection if the deleted one was selected
          if (isNormal && selectedNormalPlaylistId === playlist.id) {
            const remaining = currentList.filter(p => p.id !== playlist.id);
            if (remaining.length > 0) {
              setSelectedNormalPlaylistId(remaining[0].id!);
            }
          } else if (!isNormal && selectedSharedPlaylistId === playlist.id) {
            const remaining = currentList.filter(p => p.id !== playlist.id);
            if (remaining.length > 0) {
              setSelectedSharedPlaylistId(remaining[0].id!);
            }
          }
          showToast('플레이리스트가 삭제되었습니다.');
        } catch (error) {
          console.error(error);
          showToast('삭제에 실패했습니다.');
        }
      }
    });
  };

  const handleAddPlaylist = async (type: 'normal' | 'shared') => {
    if (!user) return;
    const isNormal = type === 'normal';
    const listCount = isNormal ? actualNormalPlaylists.length : actualSharedPlaylists.length;
    const maxCount = isNormal ? 10 : 10;

    if (listCount >= maxCount) {
      showToast('최대 개수까지 생성되었습니다.');
      return;
    }

    const currentList = isNormal ? actualNormalPlaylists : actualSharedPlaylists;
    const newTitle = '새폴더';
    const newOrder = currentList.length > 0 ? Math.max(...currentList.map(p => p.order)) + 1 : 1;

    try {
      const newId = await createPlaylist(user.uid, type, newTitle, newOrder);
      if (isNormal) {
        setSelectedNormalPlaylistId(newId);
      } else {
        setSelectedSharedPlaylistId(newId);
      }
    } catch (e) {
      console.error(e);
      showToast('플레이리스트 생성에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!user || (libraryViewMode !== 'playlist' && libraryViewMode !== 'sharedPlaylist') || !activePlaylistId) {
      setPlaylistItems([]);
      return;
    }

    setLoadingPlaylistItems(true);
    const itemsRef = collection(db, 'user_playlists', user.uid, 'lists', activePlaylistId, 'items');
    
    // Subscribe to items without ordering first, or order by order asc
    const unsub = onSnapshot(itemsRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlaylistItem));
      items.sort((a, b) => a.order - b.order);
      setPlaylistItems(items);
      setLoadingPlaylistItems(false);
    }, (error) => {
      console.error("Failed to fetch playlist items:", error);
      setLoadingPlaylistItems(false);
    });

    return () => unsub();
  }, [user, libraryViewMode, activePlaylistId]);

  useEffect(() => {
    if (playlistItems.length === 0) return;

    const uniqueOwnerUids = Array.from(
      new Set<string>(
        playlistItems
          .map((item: any) => item.ownerUid)
          .filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0)
      )
    ).filter((uid) => !userNameMap[uid]);

    if (uniqueOwnerUids.length === 0) return;

    let cancelled = false;

    const fetchUserNames = async () => {
      const nextMap: Record<string, string> = {};

      await Promise.all(
        uniqueOwnerUids.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (!userSnap.exists()) return;
            const data: any = userSnap.data();
            const displayName = data.nickname || data.displayName || data.name || data.email || uid;
            if (displayName) nextMap[uid] = String(displayName);
          } catch (error) {
            console.warn('Failed to fetch playlist creator name:', uid, error);
          }
        })
      );

      if (!cancelled && Object.keys(nextMap).length > 0) {
        setUserNameMap((prev) => ({ ...prev, ...nextMap }));
      }
    };

    fetchUserNames();

    return () => {
      cancelled = true;
    };
  }, [playlistItems, userNameMap]);

  useEffect(() => {
    const sharedSourceIds = Array.from(
      new Set<string>(
        playlistItems
          .filter((item: any) => item.sourceType === 'shared_track')
          .map((item: any) => item.sourceId)
          .filter((sourceId): sourceId is string => typeof sourceId === 'string' && sourceId.trim().length > 0)
      )
    ).filter((sourceId) => !shareCreatorNameMap[sourceId]);

    if (sharedSourceIds.length === 0) return;

    let cancelled = false;

    const fetchSharedCreatorNames = async () => {
      const nextMap: Record<string, string> = {};

      await Promise.all(
        sharedSourceIds.map(async (sourceId) => {
          try {
            const shareSnap = await getDoc(doc(db, 'suno_shares', sourceId));
            if (!shareSnap.exists()) return;
            const data: any = shareSnap.data();
            const displayName =
              data.creatorDisplayId ||
              data.ownerNickname ||
              data.creatorNickname ||
              data.ownerName ||
              data.nickname ||
              data.displayName ||
              data.ownerEmail ||
              data.creatorEmail ||
              '';
            if (displayName) nextMap[sourceId] = String(displayName);
          } catch (error) {
            console.warn('Failed to fetch shared track creator name:', sourceId, error);
          }
        })
      );

      if (!cancelled && Object.keys(nextMap).length > 0) {
        setShareCreatorNameMap((prev) => ({ ...prev, ...nextMap }));
      }
    };

    fetchSharedCreatorNames();

    return () => {
      cancelled = true;
    };
  }, [playlistItems, shareCreatorNameMap]);

  // Handle caching of likes and shared statuses
  useEffect(() => {
    if (playlistItems.length === 0 || (libraryViewMode !== 'playlist' && libraryViewMode !== 'sharedPlaylist')) return;

    const currentLikesCache = JSON.parse(localStorage.getItem('soridraw_like_count_cache') || '{}');
    const checkedAtStr = localStorage.getItem('soridraw_like_count_cache_checked_at');
    const checkedAt = checkedAtStr ? parseInt(checkedAtStr, 10) : 0;
    
    setLikesCache(currentLikesCache);

    const now = Date.now();
    const needsLikeUpdate = (now - checkedAt) > CACHE_EXPIRY_MS;

    const currentSharedCache = JSON.parse(localStorage.getItem('soridraw_shared_track_status_cache') || '{}');
    setSharedStatusCache(currentSharedCache);

    const checkCaches = async () => {
      let updatedLikes = { ...currentLikesCache };
      let updatedShared = { ...currentSharedCache };
      let didUpdateLikes = false;
      let didUpdateShared = false;

      // 1. Likes Cache
      if (needsLikeUpdate) {
        const globalIds = playlistItems.map(p => getTrackGlobalId(p));
        // unique
        const uniqueGlobalIds = Array.from(new Set<string>(globalIds));
        const fetchedLikes = await fetchTrackLikes(uniqueGlobalIds, user?.uid);
        updatedLikes = { ...updatedLikes, ...fetchedLikes };
        didUpdateLikes = true;
      }

      // 2. Shared Status Cache
      // Shared playlists must reflect private/public changes immediately.
      // Do not rely on the long local cache here, otherwise a track can look public for hours after the owner made it private.
      const forceSharedStatusRefresh = libraryViewMode === 'sharedPlaylist' || activePlaylistSection === 'shared';
      const sharedSourceIdsToFetch = playlistItems
        .filter(p => p.sourceType === 'shared_track')
        .map(p => p.sourceId!)
        .filter(sid => {
           const cached = currentSharedCache[sid];
           return forceSharedStatusRefresh || !cached || (now - cached.checkedAt > CACHE_EXPIRY_MS);
        });

      if (sharedSourceIdsToFetch.length > 0) {
        // unique
        const uniqueSourceIds = Array.from(new Set<string>(sharedSourceIdsToFetch));
        const fetchedShared = await fetchSharedTracksStatus(uniqueSourceIds);
        updatedShared = { ...updatedShared, ...fetchedShared };
        didUpdateShared = true;
      }
      
      if (didUpdateLikes) {
        localStorage.setItem('soridraw_like_count_cache', JSON.stringify(updatedLikes));
        localStorage.setItem('soridraw_like_count_cache_checked_at', now.toString());
        setLikesCache(updatedLikes);
      }

      if (didUpdateShared) {
        localStorage.setItem('soridraw_shared_track_status_cache', JSON.stringify(updatedShared));
        setSharedStatusCache(updatedShared);
      }
    };

    checkCaches();

  }, [playlistItems, libraryViewMode, activePlaylistSection, user]);

  const handleRemoveFromPlaylist = async (item: PlaylistItem) => {
    if (!user || !activePlaylistId) return;
    
    const isShared = item.sourceType === 'shared_track';
    const msg = isShared 
      ? "이 공유곡을 내 플레이리스트에서 삭제할까요? 원곡자 데이터에는 영향이 없습니다."
      : "이 곡을 현재 플레이리스트에서 삭제할까요? 원곡은 삭제되지 않습니다.";

    setPlaylistConfirmAction({
      title: '리스트에서 삭제',
      message: msg,
      confirmLabel: '삭제',
      danger: true,
      onConfirm: async () => {
        try {
          await deletePlaylistItem(user.uid, activePlaylistId, item.id!);
          showToast("곡이 삭제되었습니다.");
        } catch (e) {
          console.error(e);
          showToast("곡 삭제에 실패했습니다.");
        }
      }
    });
  };

  const handleMoveToOtherPlaylist = (item: PlaylistItem) => {
    if (!user || !activePlaylistId) return;

    const isShared = item.sourceType === 'shared_track';
    const targetLists = isShared ? actualSharedPlaylists : actualNormalPlaylists;
    const availableLists = targetLists.filter(p => !(p as any).isFallback && p.id !== activePlaylistId);

    if (availableLists.length === 0) {
      showToast("이동할 대상 플레이리스트가 없습니다.");
      return;
    }

    setMoveModalArgs({ item });
  };

  const getWorkspaceColorField = () => filter === 'favorite' ? 'favoriteColorTags' : 'colorTags';
  const getWorkspaceColorKey = (group: any, idx: number, colorField = getWorkspaceColorField()) => `workspace:${colorField}:${group?.id || group?.trackId || 'unknown'}:${idx}`;
  const getPlaylistColorKey = (playlistId: string | null, itemId?: string | null) => `playlist:${playlistId || 'unknown'}:${itemId || 'unknown'}`;

  const COLOR_SYNC_USAGE_KEY = 'soridraw.colorSyncUsage.v1';
  const getColorSyncDateKey = () => new Date().toISOString().slice(0, 10);
  const getScopedColorStorageKey = (baseKey: string) => `${baseKey}.${user?.uid || 'anonymous'}`;
  const serializeColorMap = (value: Record<string, string>) => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
  const getColorSyncUsageStorageKey = () => getScopedColorStorageKey(COLOR_SYNC_USAGE_KEY);
  const getLibraryColorSyncCount = () => {
    try {
      const raw = localStorage.getItem(getColorSyncUsageStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.date === getColorSyncDateKey() ? Number(parsed?.count || 0) : 0;
    } catch {
      return 0;
    }
  };
  const markLibraryColorSynced = () => {
    if (isLibraryAdminUser) {
      setLibraryColorSyncTick((v) => v + 1);
      return;
    }
    const next = Math.min(5, getLibraryColorSyncCount() + 1);
    localStorage.setItem(getColorSyncUsageStorageKey(), JSON.stringify({ date: getColorSyncDateKey(), count: next }));
    setLibraryColorSyncTick((v) => v + 1);
  };
  const libraryColorSyncRemaining = isLibraryAdminUser ? 5 : Math.max(0, 5 - getLibraryColorSyncCount());
  const readLocalColorMap = (key: string): Record<string, string> => {
    try {
      const scopedRaw = localStorage.getItem(getScopedColorStorageKey(key));
      const legacyRaw = localStorage.getItem(key);
      const raw = scopedRaw || legacyRaw;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const writeLocalColorMap = (key: string, value: Record<string, string>) => {
    try {
      localStorage.setItem(getScopedColorStorageKey(key), JSON.stringify(value));
    } catch (error) {
      console.warn('library color map save failed:', error);
    }
  };
  const getUnifiedColorSyncDescription = () => `색상 변경사항은 이 페이지를 나갈 때 1회 자동 저장됩니다.
페이지 안에서는 로컬 상태만 바뀌며, 변경이 없으면 저장하지 않습니다.
필요하면 이 버튼으로 즉시 저장할 수 있습니다.`;

  const handleChangeColor = async (item: PlaylistItem, color: string | null) => {
    if (!activePlaylistId || !item.id) return;
    const targetPlaylistId = (item as any)?.playlistId || activePlaylistId;
    const key = getPlaylistColorKey(targetPlaylistId, item.id);
    const nextColor = color || 'gray';
    pendingPlaylistColorKeysRef.current.add(key);
    setPlaylistLocalColorMap(prev => {
      const next = { ...prev, [key]: nextColor };
      writeLocalColorMap('soridraw.library.playlistColorTags', next);
      playlistLocalColorMapRef.current = next;
      playlistColorDirtyRef.current = serializeColorMap(next) !== playlistColorBaselineRef.current;
      return next;
    });
    setPlaylistItems(prev => prev.map(row => row.id === item.id ? { ...row, colorTag: nextColor === 'gray' ? null : nextColor } : row));
  };

  const getPlaylistItemColor = (item: PlaylistItem, playlistId = activePlaylistId): string => {
    const local = playlistLocalColorMap[getPlaylistColorKey(playlistId, item?.id)];
    return local || item?.colorTag || 'gray';
  };

  const getWorkspaceItemColor = (group: any, idx: number): string => {
    const colorField = getWorkspaceColorField();
    const local = workspaceLocalColorMap[getWorkspaceColorKey(group, idx, colorField)];
    if (local) return local;
    const source = colorField === 'favoriteColorTags' ? group?.favoriteColorTags : group?.colorTags;
    const raw = source?.[String(idx)] ?? source?.[idx] ?? null;
    return raw || 'gray';
  };

  const isWorkspaceItemVisible = (group: any, item: any, idx: number): boolean => {
    if (filter === 'trash') {
      if (!item?.hidden && !group?.hidden) return false;
    } else if (item?.hidden || group?.hidden) {
      return false;
    }

    if (workspaceColorFilter === 'all') return true;

    const color = getWorkspaceItemColor(group, idx);
    return workspaceColorFilter === 'gray' ? color === 'gray' : color === workspaceColorFilter;
  };

  const handleChangeWorkspaceColor = async (group: any, idx: number, color: string | null) => {
    if (!group?.id) {
      showToast("색상 정보를 저장할 수 없습니다.");
      return;
    }

    const colorField = getWorkspaceColorField();
    const nextColor = color || 'gray';
    const key = getWorkspaceColorKey(group, idx, colorField);
    pendingWorkspaceColorKeysRef.current.add(key);
    setWorkspaceLocalColorMap(prev => {
      const next = { ...prev, [key]: nextColor };
      writeLocalColorMap('soridraw.library.workspaceColorTags', next);
      workspaceLocalColorMapRef.current = next;
      workspaceColorDirtyRef.current = serializeColorMap(next) !== workspaceColorBaselineRef.current;
      return next;
    });
    setTracks((prev) => prev.map((track) => {
      if (track.id !== group.id) return track;
      return {
        ...track,
        [colorField]: {
          ...(track?.[colorField] || {}),
          [String(idx)]: nextColor === 'gray' ? null : nextColor,
        }
      };
    }));
    if (colorField === 'favoriteColorTags') {
      group.favoriteColorTags = { ...(group.favoriteColorTags || {}), [String(idx)]: nextColor === 'gray' ? null : nextColor };
    } else {
      group.colorTags = { ...(group.colorTags || {}), [String(idx)]: nextColor === 'gray' ? null : nextColor };
    }
  };

  const handleSyncLibraryColors = async () => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      return;
    }
    const count = getLibraryColorSyncCount();
    if (!isLibraryAdminUser && count >= 5) {
      showToast('오늘 색상 동기화 횟수를 모두 사용했습니다.');
      return;
    }

    const favoriteMap = readLocalColorMap('soridraw.favoriteColorTags');
    const workspaceMap = { ...readLocalColorMap('soridraw.library.workspaceColorTags'), ...workspaceLocalColorMap };
    const playlistMap = { ...readLocalColorMap('soridraw.library.playlistColorTags'), ...playlistLocalColorMap };

    const favoriteEntries = Object.entries(favoriteMap);
    const workspaceEntries = Object.entries(workspaceMap);
    const playlistEntries = Object.entries(playlistMap);

    if (favoriteEntries.length === 0 && workspaceEntries.length === 0 && playlistEntries.length === 0) {
      showToast('동기화할 색상 변경 내역이 없습니다.');
      return;
    }

    try {
      for (const [id, color] of favoriteEntries) {
        if (!id) continue;
        await updateDoc(doc(db, 'favorites', id), {
          favoriteColorTag: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        });
      }

      for (const [key, color] of workspaceEntries) {
        const [, colorField, trackId, idx] = key.split(':');
        if (!trackId || idx === undefined || (colorField !== 'colorTags' && colorField !== 'favoriteColorTags')) continue;
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
        await updateDoc(trackRef, {
          [`${colorField}.${idx}`]: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        });
      }

      for (const [key, color] of playlistEntries) {
        const [, playlistId, itemId] = key.split(':');
        if (!playlistId || !itemId || playlistId === 'unknown' || itemId === 'unknown') continue;
        await updatePlaylistItemColor(user.uid, playlistId, itemId, (color === 'gray' ? null : color) as any);
      }

      pendingWorkspaceColorKeysRef.current.clear();
      pendingPlaylistColorKeysRef.current.clear();
      workspaceColorBaselineRef.current = serializeColorMap(workspaceLocalColorMapRef.current || {});
      playlistColorBaselineRef.current = serializeColorMap(playlistLocalColorMapRef.current || {});
      workspaceColorDirtyRef.current = false;
      playlistColorDirtyRef.current = false;
      markLibraryColorSynced();
      showToast(`색상 설정을 동기화했습니다. 오늘 남은 횟수: ${isLibraryAdminUser ? '무제한' : `${Math.max(0, 5 - getLibraryColorSyncCount())}회`}`);
    } catch (error) {
      console.error('unified color sync failed:', error);
      showToast('색상 동기화에 실패했습니다.');
    }
  };


  const syncLibraryColorsOnExit = async (silent = true) => {
    const currentUser = libraryUserRef.current;
    if (!currentUser || libraryColorsAutoSyncingRef.current) return;

    const workspaceMap = workspaceLocalColorMapRef.current || {};
    const playlistMap = playlistLocalColorMapRef.current || {};
    const workspaceSerialized = serializeColorMap(workspaceMap);
    const playlistSerialized = serializeColorMap(playlistMap);
    const workspaceChanged = workspaceSerialized !== workspaceColorBaselineRef.current;
    const playlistChanged = playlistSerialized !== playlistColorBaselineRef.current;
    if (!workspaceChanged && !playlistChanged) return;

    const workspaceEntries = workspaceChanged ? Object.entries(workspaceMap) : [];
    const playlistEntries = playlistChanged ? Object.entries(playlistMap) : [];
    if (workspaceEntries.length === 0 && playlistEntries.length === 0) {
      workspaceColorBaselineRef.current = workspaceSerialized;
      playlistColorBaselineRef.current = playlistSerialized;
      workspaceColorDirtyRef.current = false;
      playlistColorDirtyRef.current = false;
      return;
    }

    libraryColorsAutoSyncingRef.current = true;
    try {
      for (const [key, color] of workspaceEntries) {
        const [, colorField, trackId, idx] = key.split(':');
        if (!trackId || idx === undefined || (colorField !== 'colorTags' && colorField !== 'favoriteColorTags')) continue;
        await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), {
          [`${colorField}.${idx}`]: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        });
      }

      for (const [key, color] of playlistEntries) {
        const [, playlistId, itemId] = key.split(':');
        if (!playlistId || !itemId || playlistId === 'unknown' || itemId === 'unknown') continue;
        await updatePlaylistItemColor(currentUser.uid, playlistId, itemId, (color === 'gray' ? null : color) as any);
      }

      pendingWorkspaceColorKeysRef.current.clear();
      pendingPlaylistColorKeysRef.current.clear();
      workspaceColorBaselineRef.current = workspaceSerialized;
      playlistColorBaselineRef.current = playlistSerialized;
      workspaceColorDirtyRef.current = false;
      playlistColorDirtyRef.current = false;
      if (!silent) showToast('색상 변경사항을 저장했습니다.');
    } catch (error) {
      console.error('library color exit sync failed:', error);
      if (!silent) showToast('색상 변경사항 저장에 실패했습니다.');
    } finally {
      libraryColorsAutoSyncingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      void syncLibraryColorsOnExit(true);
    };
  }, [user?.uid]);

  const handleToggleWorkspaceFavorite = async (group: any, nextValue?: boolean) => {
    if (!user) {
      showToast("로그인이 필요합니다.");
      return;
    }

    if (!group?.id) {
      showToast("즐겨찾기 정보를 저장할 수 없습니다.");
      return;
    }

    const next = typeof nextValue === 'boolean' ? nextValue : !Boolean(group.favorite);

    try {
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
      await updateDoc(trackRef, {
        favorite: next,
        favoriteUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      group.favorite = next;
      setTracks((prev) => prev.map((track) => track.id === group.id ? { ...track, favorite: next } : track));
      setPlaylistItems((prev) => prev.map((playlistItem: any) => {
        const match = String(playlistItem.sourceId || playlistItem.trackId || '') === String(group.id);
        return match && playlistItem.sourceType !== 'shared_track' ? { ...playlistItem, favorite: next } : playlistItem;
      }));
      window.dispatchEvent(new CustomEvent('soridraw:suno-favorite-changed', {
        detail: { trackId: group.id, favorite: next }
      }));
      showToast(next ? "즐겨찾기에 저장되었습니다." : "즐겨찾기에서 제외되었습니다.");
    } catch (e) {
      console.error('workspace favorite update failed:', e);
      showToast("즐겨찾기 변경에 실패했습니다.");
    }
  };

  const handleTogglePlaylistItemFavorite = async (item: PlaylistItem, nextValue?: boolean) => {
    if (!user || !item) {
      showToast("즐겨찾기 정보를 저장할 수 없습니다.");
      return;
    }

    if ((item as any).sourceType === 'shared_track' || libraryViewMode === 'sharedPlaylist' || activePlaylistSection === 'shared') {
      showToast("공유 플레이리스트 곡은 즐겨찾기를 사용할 수 없습니다.");
      return;
    }

    const sourceTrack = getPlaylistItemSourceTrack(item);
    const sourceTrackId = String((sourceTrack as any)?.id || (sourceTrack as any)?.trackId || (item as any).sourceId || (item as any).trackId || '').trim();
    if (!sourceTrackId) {
      showToast("원본 곡 정보를 찾을 수 없습니다.");
      return;
    }

    const itemAudio = String((item as any).audioUrl || (item as any).streamAudioUrl || (item as any).audio_url || '').trim();
    const currentValue = Boolean((sourceTrack as any)?.favorite ?? (item as any).favorite);
    const next = typeof nextValue === 'boolean' ? nextValue : !currentValue;

    try {
      const ownerUid = String((sourceTrack as any)?.ownerUid || (item as any).ownerUid || user.uid);
      const trackRef = doc(db, 'suno_tracks', ownerUid, 'tracks', sourceTrackId);
      await updateDoc(trackRef, {
        favorite: next,
        favoriteUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      (item as any).favorite = next;
      setTracks((prev) => prev.map((track: any) => {
        const match = String(track.id) === sourceTrackId || String(track.trackId || '') === sourceTrackId;
        return match ? { ...track, favorite: next } : track;
      }));
      setPlaylistItems((prev) => prev.map((playlistItem: any) => {
        const playlistSourceId = String(playlistItem.sourceId || playlistItem.trackId || '');
        const playlistAudio = String(playlistItem.audioUrl || playlistItem.streamAudioUrl || playlistItem.audio_url || '').trim();
        const match =
          playlistItem.id === item.id ||
          playlistSourceId === sourceTrackId ||
          (itemAudio && playlistAudio === itemAudio);
        return match ? { ...playlistItem, favorite: next, sourceId: playlistItem.sourceType === 'shared_track' ? playlistItem.sourceId : sourceTrackId } : playlistItem;
      }));
      window.dispatchEvent(new CustomEvent('soridraw:suno-favorite-changed', {
        detail: { trackId: sourceTrackId, playlistItemId: item.id, favorite: next }
      }));
      showToast(next ? "즐겨찾기에 저장되었습니다." : "즐겨찾기에서 제외되었습니다.");
    } catch (e) {
      console.error('playlist source favorite update failed:', e);
      showToast("즐겨찾기 변경에 실패했습니다.");
    }
  };

  const handleCustomSort = async (itemA: PlaylistItem, itemB: PlaylistItem) => {
    if (!user || !activePlaylistId) return;
    try {
      await swapPlaylistItemOrder(user.uid, activePlaylistId, itemA, itemB);
    } catch (e) {
      console.error(e);
      showToast("순서 변경에 실패했습니다.");
    }
  };

  const handleToggleLike = async (item: PlaylistItem) => {
    if (!user) {
      showToast("로그인이 필요합니다.");
      return;
    }
    
    const globalId = getTrackGlobalId(item);
    const cached = likesCache[globalId] || { likeCount: 0, likedByMe: false };
    
    // Optimistic UI update
    const newLikedByMe = !cached.likedByMe;
    const newCount = newLikedByMe ? cached.likeCount + 1 : Math.max(0, cached.likeCount - 1);
    
    const newCacheValue = { likeCount: newCount, likedByMe: newLikedByMe };
    setLikesCache(prev => ({ ...prev, [globalId]: newCacheValue }));
    
    // Also update localStorage immediately so it doesn't revert during re-render
    const currentLikesCache = JSON.parse(localStorage.getItem('soridraw_like_count_cache') || '{}');
    currentLikesCache[globalId] = newCacheValue;
    localStorage.setItem('soridraw_like_count_cache', JSON.stringify(currentLikesCache));

    try {
      const actualCount = await toggleTrackLike(globalId, user.uid, cached.likedByMe);
      // Sync with actual count
      if (actualCount !== newCount) {
        const syncedCacheValue = { likeCount: actualCount, likedByMe: newLikedByMe };
        setLikesCache(prev => ({ ...prev, [globalId]: syncedCacheValue }));
        
        const finalCache = JSON.parse(localStorage.getItem('soridraw_like_count_cache') || '{}');
        finalCache[globalId] = syncedCacheValue;
        localStorage.setItem('soridraw_like_count_cache', JSON.stringify(finalCache));
      }
    } catch (e) {
      console.error(e);
      showToast("좋아요 변경에 실패했습니다.");
      // Rollback
      setLikesCache(prev => ({ ...prev, [globalId]: cached }));
      const rbCache = JSON.parse(localStorage.getItem('soridraw_like_count_cache') || '{}');
      rbCache[globalId] = cached;
      localStorage.setItem('soridraw_like_count_cache', JSON.stringify(rbCache));
    }
  };

  const getAudioUrl = (item: any, group: any) => {
    return item?.audioUrl || item?.streamAudioUrl || item?.audio_url || item?.stream_audio_url || item?.sourceAudioUrl || item?.source_audio_url || item?.sourceStreamAudioUrl || item?.source_stream_audio_url || group?.audioUrl || group?.streamAudioUrl || group?.audio_url || group?.stream_audio_url || '';
  };

  const getTitle = (item: any, group: any, idx: number) => {
    return item?.title || item?.name || group?.title || `Suno Track ${idx + 1}`;
  };

  const getSunoModelVersionLabel = (item: any, group: any) => {
    const raw = item?.sunoVersion || item?.model || item?.requestPayload?.sunoVersion || item?.requestPayload?.model || group?.sunoVersion || group?.model || group?.requestPayload?.sunoVersion || group?.requestPayload?.model;
    if (!raw) return '';
    const normalized = String(raw).trim().toUpperCase().replace(/-/g, '_').replace(/\./g, '_');
    if (normalized === 'V5_5' || normalized === '5_5') return 'v5.5';
    if (normalized === 'V5' || normalized === '5') return 'v5';
    if (normalized === 'V4_5' || normalized === '4_5') return 'v4.5';
    return String(raw).replace(/^v/i, 'v');
  };

  const getSunoModelVersionBadgeClass = (label: string) => {
    const normalized = String(label || '').trim().toLowerCase();
    if (normalized === 'v5.5' || normalized === '5.5') {
      return 'border-[#EC5BA6]/35 bg-[#EC5BA6]/14 text-[#FFB4D7] shadow-[0_0_14px_rgba(236,91,166,0.18)]';
    }
    if (normalized === 'v5' || normalized === '5') {
      return 'border-[#9B7AE6]/35 bg-[#9B7AE6]/14 text-[#CAB8FF] shadow-[0_0_14px_rgba(155,122,230,0.18)]';
    }
    if (normalized === 'v4.5' || normalized === '4.5') {
      return 'border-[#4CB3D8]/35 bg-[#4CB3D8]/14 text-[#A8E8FF] shadow-[0_0_14px_rgba(76,179,216,0.18)]';
    }
    return 'border-white/20 bg-white/10 text-white/70';
  };

  const getImageUrl = (item: any, group: any) => {
    return item?.imageUrl || item?.image_url || group?.imageUrl || '';
  };

  const getDuration = (item: any, group: any) => {
    const rawVal = item?.duration ?? item?.durationSeconds ?? item?.duration_seconds ?? item?.metadata?.duration ?? item?.metadata?.durationSeconds ?? item?.metadata?.duration_seconds ?? item?.metadata?.playDuration ?? item?.playDuration ?? group?.duration ?? group?.durationSeconds;
    if (rawVal === undefined || rawVal === null) return null;
    const num = Number(rawVal);
    if (Number.isFinite(num) && num > 0) return num;
    return null;
  };

  const getPlaylistItemSourceTrack = (item: any) => {
    if (!item || item.sourceType === 'shared_track') return null;

    const candidateIds = [
      item.sourceId,
      item.trackId,
      item.originalTrackId,
      item.parentTrackId
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
      .map((value) => String(value));

    let found = tracks.find((track: any) => {
      const trackIds = [track.id, track.trackId, track.sourceId, track.taskId]
        .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
        .map((value) => String(value));
      return candidateIds.some((id) => trackIds.includes(id));
    });
    if (found) return found;

    const itemAudio = String(item.audioUrl || item.streamAudioUrl || item.audio_url || '').trim();
    if (itemAudio) {
      found = tracks.find((track: any) => {
        const directAudio = String(track.audioUrl || track.streamAudioUrl || track.audio_url || '').trim();
        if (directAudio && directAudio === itemAudio) return true;
        return extractSunoData(track).some((subItem: any) => {
          const subAudio = String(subItem.audioUrl || subItem.streamAudioUrl || subItem.audio_url || subItem.url || '').trim();
          return subAudio && subAudio === itemAudio;
        });
      });
      if (found) return found;
    }

    const itemTitle = String(item.title || '').trim();
    const itemDuration = Number(item.duration || 0);
    if (itemTitle) {
      found = tracks.find((track: any) => {
        const directTitle = String(track.title || '').trim();
        if (directTitle && directTitle === itemTitle) return true;
        return extractSunoData(track).some((subItem: any) => {
          const subTitle = String(subItem.title || subItem.name || '').trim();
          const subDuration = Number(subItem.duration || subItem.durationSeconds || 0);
          return subTitle === itemTitle && (!itemDuration || !subDuration || Math.abs(subDuration - itemDuration) < 2);
        });
      });
    }

    return found || null;
  };

  const getPlaylistItemSourceTrackId = (item: any) => {
    const sourceTrack = getPlaylistItemSourceTrack(item);
    return sourceTrack?.id ? String(sourceTrack.id) : String(item?.sourceId || item?.trackId || '').trim();
  };

  const hasBeenPlayed = (target: any) => Boolean(
    target?.playedAt ||
    target?.firstPlayedAt ||
    target?.lastPlayedAt ||
    target?.hasPlayed ||
    target?.played === true
  );

  const isSharedPlaylistItem = (item: any) => Boolean(
    item?.sourceType === 'shared_track' ||
    libraryViewMode === 'sharedPlaylist' ||
    activePlaylistSection === 'shared'
  );

  const isSharedPlaylistItemPlayedLocal = (item: any) => {
    const keys = getSharedPlayedKeys(item);
    return keys.some((key) => Boolean(sharedPlayedMap[key]));
  };

  const markSharedPlaylistItemPlayedLocal = (item: any, playedAt: string) => {
    const keys = getSharedPlayedKeys(item);
    if (keys.length === 0) return;

    setSharedPlayedMap((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = playedAt;
      });

      try {
        localStorage.setItem(SHARED_PLAYED_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn('save shared playlist played map failed:', error);
      }

      return next;
    });
  };

  const isWorkspaceItemUnplayed = (group: any, item: any, idx: number) => {
    const audioUrl = getAudioUrl(item, group);
    const duration = getDuration(item, group);
    const completed = Boolean(audioUrl && duration !== null && group?.status === 'completed');
    if (!completed) return false;

    const playedMap = group?.playedItemIndexes || group?.playedItems || {};
    const playedByIndex = playedMap?.[String(idx)] || playedMap?.[idx];
    return !(hasBeenPlayed(item) || hasBeenPlayed(playedByIndex));
  };

  const markWorkspaceItemPlayed = async (group: any, idx: number) => {
    if (!user || !group?.id) return;
    const playedAt = new Date().toISOString();

    setTracks((prev) => prev.map((track: any) => {
      if (track.id !== group.id) return track;
      const next = { ...track, playedItemIndexes: { ...(track.playedItemIndexes || {}), [String(idx)]: { playedAt } } };
      if (Array.isArray(track.sunoData)) {
        next.sunoData = track.sunoData.map((entry: any, entryIndex: number) => entryIndex === idx ? { ...entry, playedAt, hasPlayed: true } : entry);
      }
      return next;
    }));

    try {
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
      if (Array.isArray(group.sunoData) && group.sunoData.length > 0) {
        const nextSunoData = group.sunoData.map((entry: any, entryIndex: number) => entryIndex === idx ? { ...entry, playedAt, hasPlayed: true } : entry);
        await updateDoc(trackRef, {
          sunoData: nextSunoData,
          [`playedItemIndexes.${idx}`]: { playedAt },
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(trackRef, {
          playedAt,
          hasPlayed: true,
          [`playedItemIndexes.${idx}`]: { playedAt },
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn('mark workspace item played failed:', e);
    }
  };

  const isPlaylistItemUnplayed = (item: any) => {
    if (!item?.audioUrl && !item?.streamAudioUrl && !item?.audio_url) return false;
    if (formatPlaylistDuration(item.duration) === '--:--') return false;

    if (isSharedPlaylistItem(item) && isSharedPlaylistItemPlayedLocal(item)) return false;

    const sourceTrack = getPlaylistItemSourceTrack(item);
    const itemAudio = String(item?.audioUrl || item?.streamAudioUrl || item?.audio_url || '').trim();
    const sourceItems = sourceTrack ? extractSunoData(sourceTrack) : [];
    const sourceItem = sourceItems.find((entry: any) => String(getAudioUrl(entry, sourceTrack) || '').trim() === itemAudio);
    return !(hasBeenPlayed(item) || hasBeenPlayed(sourceItem));
  };

  const markPlaylistItemPlayed = async (item: any) => {
    if (!user || !item) return;
    const playedAt = new Date().toISOString();
    const itemAudio = String(item?.audioUrl || item?.streamAudioUrl || item?.audio_url || '').trim();

    if (isSharedPlaylistItem(item)) {
      markSharedPlaylistItemPlayedLocal(item, playedAt);
    }

    setPlaylistItems((prev) => prev.map((playlistItem: any) => playlistItem.id === item.id ? { ...playlistItem, playedAt, hasPlayed: true } : playlistItem));

    const sourceTrack = getPlaylistItemSourceTrack(item);
    if (sourceTrack?.id && item?.sourceType !== 'shared_track') {
      const sourceItems = extractSunoData(sourceTrack);
      const sourceIdx = sourceItems.findIndex((entry: any) => String(getAudioUrl(entry, sourceTrack) || '').trim() === itemAudio);
      setTracks((prev) => prev.map((track: any) => {
        if (String(track.id) !== String(sourceTrack.id)) return track;
        const next = { ...track };
        if (sourceIdx >= 0) {
          next.playedItemIndexes = { ...(track.playedItemIndexes || {}), [String(sourceIdx)]: { playedAt } };
          if (Array.isArray(track.sunoData)) {
            next.sunoData = track.sunoData.map((entry: any, entryIndex: number) => entryIndex === sourceIdx ? { ...entry, playedAt, hasPlayed: true } : entry);
          }
        } else {
          next.playedAt = playedAt;
          next.hasPlayed = true;
        }
        return next;
      }));

      try {
        const ownerUid = String((sourceTrack as any)?.ownerUid || (item as any)?.ownerUid || user.uid);
        const trackRef = doc(db, 'suno_tracks', ownerUid, 'tracks', sourceTrack.id);
        if (sourceIdx >= 0 && Array.isArray((sourceTrack as any).sunoData)) {
          const nextSunoData = (sourceTrack as any).sunoData.map((entry: any, entryIndex: number) => entryIndex === sourceIdx ? { ...entry, playedAt, hasPlayed: true } : entry);
          await updateDoc(trackRef, {
            sunoData: nextSunoData,
            [`playedItemIndexes.${sourceIdx}`]: { playedAt },
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(trackRef, { playedAt, hasPlayed: true, updatedAt: serverTimestamp() });
        }
      } catch (e) {
        console.warn('mark playlist source item played failed:', e);
      }
    }
  };


  const normalizePlayableUrl = (value: any) => String(value || '').trim();

  const getCurrentPlayableUrl = () => {
    const parent: any = currentTrack?.parent || {};
    return normalizePlayableUrl(
      (currentTrack as any)?.url ||
      (currentTrack as any)?.audioUrl ||
      parent.audioUrl ||
      parent.streamAudioUrl ||
      parent.audio_url
    );
  };

  const isSamePlayableUrl = (candidateUrl: any) => {
    const currentUrl = getCurrentPlayableUrl();
    const nextUrl = normalizePlayableUrl(candidateUrl);
    return Boolean(currentUrl && nextUrl && currentUrl === nextUrl);
  };

  const isCurrentWorkspaceItem = (group: any, item: any, idx: number) => {
    if (!currentTrack) return false;
    const audioUrl = getAudioUrl(item, group);
    if (isSamePlayableUrl(audioUrl)) return true;

    const parent: any = currentTrack.parent || {};
    const groupId = String(group?.id || group?.trackId || group?.sourceId || '').trim();
    const parentIds = [parent.id, parent.trackId, parent.sourceId]
      .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
      .map((value) => String(value));

    return Boolean(groupId && parentIds.includes(groupId) && Number((currentTrack as any).index) === idx);
  };

  const isCurrentPlaylistItem = (item: any) => {
    if (!currentTrack) return false;
    if (isSamePlayableUrl(item?.audioUrl || item?.streamAudioUrl || item?.audio_url)) return true;

    const itemId = String(item?.id || '').trim();
    const sourceId = String(getPlaylistItemSourceTrackId(item) || item?.sourceId || item?.trackId || '').trim();
    const parent: any = currentTrack.parent || {};
    const currentIds = [
      (currentTrack as any)?.trackId,
      (currentTrack as any)?.id,
      (currentTrack as any)?.sourceId,
      parent.id,
      parent.trackId,
      parent.sourceId
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
      .map((value) => String(value));

    return Boolean((itemId && currentIds.includes(itemId)) || (sourceId && currentIds.includes(sourceId)));
  };

  const extractSunoData = (group: any) => {
    let sunoData = null;
    if (Array.isArray(group?.sunoData) && group.sunoData.length > 0) {
      sunoData = group.sunoData;
    } else if (Array.isArray(group?.apiStatusResponse?.data?.response?.sunoData) && group.apiStatusResponse.data.response.sunoData.length > 0) {
      sunoData = group.apiStatusResponse.data.response.sunoData;
    } else if (Array.isArray(group?.apiResponse?.response?.sunoData) && group.apiResponse.response.sunoData.length > 0) {
      sunoData = group.apiResponse.response.sunoData;
    }

    if (sunoData) {
      return sunoData;
    }

    return [{
      audioUrl: group?.audioUrl || group?.streamAudioUrl,
      title: group?.title,
      imageUrl: group?.imageUrl,
      duration: getDuration(group, group),
      hidden: !!group?.hidden
    }];
  };

  const isTrackStuck = (group: any) => {
    if (!group || !group.id) return false;

    const statusStr = String(group.status || '').toLowerCase();
    
    // Normal completed tracks should absolutely NEVER be marked as failed
    if (statusStr === 'completed' || statusStr === 'success') {
      return false;
    }

    // Check if we already have audio or sunodata or audiurls
    const items = extractSunoData(group);
    const hasAudioUrl = items.some((item: any) => {
      const url = getAudioUrl(item, group);
      return typeof url === 'string' && url.trim().length > 0;
    });
    const hasSunoData = Array.isArray(group?.sunoData) && group.sunoData.length > 0;
    const hasAudioUrls = Array.isArray(group?.audioUrls) && group.audioUrls.length > 0;
    
    if (hasAudioUrl || hasSunoData || hasAudioUrls) {
      return false;
    }

    // Must be in one of these generating/pending/processing statuses, or status is empty/null/missing while loading
    const isPendingStatus = !statusStr || ['processing', 'pending', 'generating', 'submitted', 'queued', 'queue', 'running', 'in_progress', '생성', '진행', '대기'].includes(statusStr);
    if (!isPendingStatus) return false;

    // Let's get the creation time
    let createdTime = 0;
    if (group.createdAt?.seconds) {
      createdTime = group.createdAt.seconds * 1000;
    } else if (group.createdAt?.toDate) {
      createdTime = group.createdAt.toDate().getTime();
    } else if (typeof group.createdAt === 'string' || typeof group.createdAt === 'number') {
      createdTime = new Date(group.createdAt).getTime();
    }

    if (!createdTime) return false;

    const elapsedMs = Date.now() - createdTime;
    const isTimedOut = elapsedMs > 3 * 60 * 1000; // 3 minutes timeout

    return isTimedOut;
  };



  const collectStatusCandidates = (source: any): string[] => {
    const candidates: string[] = [];
    const pushValue = (value: any) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        candidates.push(String(value).trim().toLowerCase());
      }
    };

    const visit = (obj: any, depth = 0) => {
      if (!obj || depth > 5 || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.slice(0, 12).forEach((item) => visit(item, depth + 1));
        return;
      }

      Object.entries(obj).forEach(([key, value]) => {
        const normalizedKey = String(key).toLowerCase();
        if (
          normalizedKey === 'status' ||
          normalizedKey === 'state' ||
          normalizedKey === 'taskstatus' ||
          normalizedKey === 'task_status' ||
          normalizedKey === 'generationstatus' ||
          normalizedKey === 'generation_status' ||
          normalizedKey === 'code'
        ) {
          pushValue(value);
        }
        if (value && typeof value === 'object') visit(value, depth + 1);
      });
    };

    visit(source);
    return candidates;
  };

  const resolveSunoStatusFromResponse = (data: any) => {
    const candidates = collectStatusCandidates(data);
    const raw = candidates.join(' | ');
    const failed = candidates.some((value) =>
      /fail|failed|failure|error|errored|reject|rejected|cancel|cancelled|canceled|timeout|timed_out|expired|실패|취소|오류/.test(value)
    );
    if (failed) return { status: 'failed', raw };

    const completed = candidates.some((value) =>
      /complete|completed|success|succeeded|done|finished|finish|ready|generated|완료|성공/.test(value)
    );
    if (completed) return { status: 'completed', raw };

    const processing = candidates.some((value) =>
      /processing|pending|queued|queue|running|submitted|in_progress|generating|생성|진행|대기/.test(value)
    );
    if (processing) return { status: 'processing', raw };

    return { status: null, raw };
  };

  const extractStatusSunoData = (data: any) => {
    const candidates = [
      data?.sunoData,
      data?.data?.sunoData,
      data?.response?.sunoData,
      data?.data?.response?.sunoData,
      data?.result?.sunoData,
      data?.data?.result?.sunoData,
      data?.tracks,
      data?.data?.tracks,
      data?.response?.tracks,
      data?.data?.response?.tracks,
      data?.audios,
      data?.data?.audios,
    ];
    return candidates.find((value) => Array.isArray(value) && value.length > 0) || null;
  };

  const isMeaningfulSunoFailureText = (value: any) => {
    const text = String(value || '').trim();
    if (!text) return false;
    // Cloud Function wrappers often return msg/message: "success" even when the provider task itself failed.
    // Do not show that wrapper text as the failure reason in the app.
    if (/^(success|ok|complete|completed|done|true)$/i.test(text)) return false;
    return true;
  };

  const getSunoFailureReason = (data: any, rawStatus?: string | null) => {
    const candidates = [
      data?.errorMessage,
      data?.failedReason,
      data?.failureReason,
      data?.reason,
      data?.error,
      data?.data?.errorMessage,
      data?.data?.failedReason,
      data?.data?.failureReason,
      data?.data?.reason,
      data?.data?.error,
      data?.response?.errorMessage,
      data?.response?.failedReason,
      data?.response?.failureReason,
      data?.response?.reason,
      data?.response?.error,
      data?.data?.response?.errorMessage,
      data?.data?.response?.failedReason,
      data?.data?.response?.failureReason,
      data?.data?.response?.reason,
      data?.data?.response?.error,
    ];

    const found = candidates.find(isMeaningfulSunoFailureText);
    if (found) {
      const foundStr = String(found).trim();
      // Remove any internal http code or debug payload slop from the reason string if present
      if (foundStr.length > 0 && !/pending|success|completed|complete/i.test(foundStr)) {
        return foundStr;
      }
    }
    return '';
  };

  const getSunoFailureDisplayMessage = (group: any) => {
    if (!group) return '알 수 없는 오류가 발생했습니다.';

    const dbReason = String(group.failureReason || group.errorMessage || '').trim();
    
    // Check if it's a timeout (stuck error)
    const isTimeout = 
      dbReason.toLowerCase().includes('시간 초과') || 
      dbReason.toLowerCase().includes('timeout') || 
      dbReason.toLowerCase().includes('timed_out') || 
      dbReason.toLowerCase().includes('시간초과') ||
      dbReason.toLowerCase().includes('3분 경과') ||
      dbReason.toLowerCase().includes('20분 경과');

    if (isTimeout) {
      return 'Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.';
    }

    // Default or explicit error message
    if (dbReason && !/pending|success|completed|complete/i.test(dbReason) && dbReason.length > 2) {
      return dbReason;
    }

    return 'Suno 생성 과정에서 오류가 발생했습니다. 잠시 후 다시 생성해주세요.';
  };

  const syncStatusResponseToFirestore = async (trackId: string, taskId: string, data: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !trackId) return { status: null as string | null, raw: '' };

    const resolved = resolveSunoStatusFromResponse(data);
    const updatePayload: any = {
      apiStatusResponse: data || null,
      lastStatusCheckedAt: serverTimestamp(),
      lastStatusRaw: resolved.raw || null,
    };

    if (taskId) updatePayload.taskId = taskId;

    if (resolved.status === 'failed') {
      updatePayload.status = 'failed';
      updatePayload.failedAt = serverTimestamp();
      updatePayload.failureReason = getSunoFailureReason(data, resolved.raw);
    } else if (resolved.status === 'completed') {
      updatePayload.status = 'completed';
      updatePayload.completedAt = serverTimestamp();
      const nextSunoData = extractStatusSunoData(data);
      if (nextSunoData) updatePayload.sunoData = nextSunoData;
    } else if (resolved.status === 'processing') {
      updatePayload.status = 'processing';
    }

    if (resolved.status) {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    } else {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    }

    return resolved;
  };


  const filteredTracks = useMemo(() => {
    return tracks.filter(t => {
      if (filter === 'trash') {
        const hasHiddenItem = extractSunoData(t).some((i: any) => i.hidden);
        if (!t.hidden && !hasHiddenItem) return false;
      } else {
        if (t.hidden) return false;
        const allHidden = extractSunoData(t).every((i: any) => i.hidden);
        if (allHidden) return false;
      }

      const matchesSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (t.prompt || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filter === 'all' || filter === 'trash' ||
                            (filter === 'completed' && t.status === 'completed') || 
                            (filter === 'favorite' && t.favorite) ||
                            (filter === 'public' && t.isPublic === true) ||
                            (filter === 'private' && t.isPublic !== true);

      const matchesColor = extractSunoData(t).some((item: any, idx: number) => isWorkspaceItemVisible(t, item, idx));

      return matchesSearch && matchesFilter && matchesColor;
    });
  }, [tracks, searchTerm, filter, workspaceColorFilter]);

  const displayedWorkspaceTracks = useMemo(() => {
    if (libraryViewMode !== 'workspace') return filteredTracks;
    return filteredTracks.slice(0, workspaceVisibleCount);
  }, [filteredTracks, libraryViewMode, workspaceVisibleCount]);

  const canShowCachedWorkspaceMore = libraryViewMode === 'workspace' && workspaceVisibleCount < filteredTracks.length;
  const canRequestMoreWorkspacePage = Boolean(
    libraryViewMode === 'workspace' &&
    !isSharedView &&
    !searchTerm.trim() &&
    filter === 'all' &&
    workspaceColorFilter === 'all' &&
    hasMoreWorkspaceServerTracks &&
    filteredTracks.length >= WORKSPACE_PAGE_SIZE
  );
  const hasMoreWorkspaceTracks = libraryViewMode === 'workspace' && (canShowCachedWorkspaceMore || canRequestMoreWorkspacePage);

  const allPlayables = useMemo(() => {
    const list: any[] = [];
    filteredTracks.forEach(group => {
      const items = extractSunoData(group);
      items.forEach((item: any, idx: number) => {
        if (!isWorkspaceItemVisible(group, item, idx)) return;

        const audioUrl = getAudioUrl(item, group);
        if (audioUrl) {
          list.push({ group, item, idx, url: audioUrl });
        }
      });
    });
    return list;
  }, [filteredTracks, filter, workspaceColorFilter]);

  const handlePlayTrack = (track: any, subIndex: number = 0) => {
    const items = extractSunoData(track);
    const item = items[subIndex] || {};
    const url = getAudioUrl(item, track);
    const title = getTitle(item, track, subIndex);
    const imageUrl = getImageUrl(item, track);
    const creatorMeta = resolveCreatorSnapshot(track, item, { fallbackToCurrentUser: true });

    if (url) {
      markWorkspaceItemPlayed(track, subIndex);
      const newQueue = allPlayables.map(p => {
        const queuedCreatorMeta = resolveCreatorSnapshot(p.group, p.item, { fallbackToCurrentUser: true });
        return {
          url: p.url,
          title: getTitle(p.item, p.group, p.idx),
          imageUrl: getImageUrl(p.item, p.group),
          parent: { ...p.group, ...queuedCreatorMeta, __workspaceContext: true, __libraryViewMode: 'workspace' },
          index: p.idx,
          creatorDisplayId: queuedCreatorMeta.creatorDisplayId,
          ownerNickname: queuedCreatorMeta.ownerNickname,
          creatorNickname: queuedCreatorMeta.creatorNickname,
          ownerEmail: queuedCreatorMeta.ownerEmail,
          creatorEmail: queuedCreatorMeta.creatorEmail,
          lyrics: p.item?.lyrics || p.item?.lyricsText || p.group?.lyrics || p.group?.lyricsText || null
        };
      });
      playTrack({
        url,
        title,
        imageUrl,
        parent: { ...track, ...creatorMeta, __workspaceContext: true, __libraryViewMode: 'workspace' },
        index: subIndex,
        creatorDisplayId: creatorMeta.creatorDisplayId,
        ownerNickname: creatorMeta.ownerNickname,
        creatorNickname: creatorMeta.creatorNickname,
        ownerEmail: creatorMeta.ownerEmail,
        creatorEmail: creatorMeta.creatorEmail,
        lyrics: item?.lyrics || item?.lyricsText || track?.lyrics || track?.lyricsText || null
      }, newQueue);
    }
  };

  useEffect(() => {
    if (!user || isSharedView || tracks.length === 0) return;

    // Identify tracks that have been stuck for more than 3 minutes without audio URLs
    const stuckTracks = tracks.filter(isTrackStuck);
    if (stuckTracks.length === 0) return;

    // Quietly update each stuck track status to failed in firestore
    stuckTracks.forEach(async (group) => {
      try {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
        const reason = '생성 시간 초과 (3분 경과)';
        await updateDoc(trackRef, {
          status: 'failed',
          failedAt: serverTimestamp(),
          failureReason: reason,
          errorMessage: reason, // Add errorMessage
          lastStatusRaw: 'timeout | timed_out',
          lastStatusCheckedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log(`[Suno Safety Hook] Automatically marked stuck Suno track ${group.id} as failed.`);
      } catch (e) {
        console.error('Failed to update stuck track to failed:', e);
      }
    });
  }, [tracks, user, isSharedView]);

  useEffect(() => {
    if (isSharedView || !user) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      
      const eligibleGroups = tracks.filter(group => {
        if (group.status === 'failed') return false;

        const count = autoCheckCountsRef.current.get(group.id) || 0;
        if (count >= 30) return false;

        const items = extractSunoData(group);
        const isFullyCompleted = group.status === 'completed' && items.every((item: any) => !!getAudioUrl(item, group) && getDuration(item, group) !== null);

        if (isFullyCompleted) return false;

        if (!group.taskId) return false;

        let createdTime = 0;
        if (group.createdAt?.seconds) {
          createdTime = group.createdAt.seconds * 1000;
        } else if (group.createdAt?.toDate) {
          createdTime = group.createdAt.toDate().getTime();
        } else if (typeof group.createdAt === 'string' || typeof group.createdAt === 'number') {
          createdTime = new Date(group.createdAt).getTime();
        }
        
        const elapsedMs = now - createdTime;
        if (elapsedMs < 8000) return false; // Initial wait before first status check
        if (elapsedMs > 10 * 60 * 1000) return false; // Stop automatic polling after 10 minutes

        const nextIntervalMs = elapsedMs < 3 * 60 * 1000
          ? 15 * 1000
          : elapsedMs < 6 * 60 * 1000
            ? 30 * 1000
            : 60 * 1000;

        const lastRunAt = autoCheckLastRunAtRef.current.get(group.id) || 0;
        if (lastRunAt && now - lastRunAt < nextIntervalMs) return false;

        if (checkingIdsRef.current.has(group.id)) return false;

        return true;
      });

      eligibleGroups.forEach(async (group) => {
        const id = group.id;
        checkingIdsRef.current.add(id);
        autoCheckLastRunAtRef.current.set(id, Date.now());
        const currentCount = autoCheckCountsRef.current.get(id) || 0;
        autoCheckCountsRef.current.set(id, currentCount + 1);

        try {
          const token = await user.getIdToken();
          const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ trackId: id, taskId: group.taskId })
          });
          
          let data: any = null;
          try {
            data = await res.json();
          } catch {
            data = null;
          }

          if (!res.ok) {
            console.warn(`Auto check failed for ${id}`, data);
          }

          if (data) {
            await syncStatusResponseToFirestore(id, group.taskId, data);
          }
        } catch (e) {
          console.warn(`Auto check error for ${id}:`, e);
        } finally {
          checkingIdsRef.current.delete(id);
        }
      });
    }, 15000); // Base tick is 15s; network checks use progressive intervals: 15s -> 30s -> 60s, max 10min

    return () => clearInterval(intervalId);
  }, [tracks, user, isSharedView]);

  const checkStatus = async (trackId: string, taskId: string) => {
    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!taskId) {
      const group = tracks.find(t => t.id === trackId);
      if (group && isTrackStuck(group)) {
        try {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: '생성 시간 초과 (3분 경과)',
            errorMessage: '생성 시간 초과 (3분 경과)',
            updatedAt: serverTimestamp(),
          });
          alert('Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.');
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('taskId가 없어 상태 확인을 할 수 없습니다.');
      }
      return;
    }

    if (checkingIdsRef.current.has(trackId)) {
      return;
    }

    try {
      checkingIdsRef.current.add(trackId);
      setStatusChecking(trackId);

      const token = await user.getIdToken();
      let res: Response | null = null;
      let data: any = null;
      let fetchFailed = false;

      try {
        res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ trackId, taskId })
        });
        
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          fetchFailed = true;
        }
      } catch (err) {
        console.error('Fetch error in checkStatus:', err);
        fetchFailed = true;
      }

      const group = tracks.find(t => t.id === trackId);

      if (fetchFailed) {
        if (group && isTrackStuck(group)) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: '상태 조회 실패 및 생성 시간 초과 (3분 경과)',
            errorMessage: '상태 조회 실패 및 생성 시간 초과 (3분 경과)',
            updatedAt: serverTimestamp(),
          });
          alert('Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.');
          return;
        }

        alert('Suno 생성 과정에서 오류가 발생했습니다. 잠시 후 다시 생성해주세요.');
        return;
      }

      const resolved = data ? await syncStatusResponseToFirestore(trackId, taskId, data) : { status: null, raw: '' };

      if (resolved.status === 'completed') {
        alert('생성 완료되었습니다.');
      } else if (resolved.status === 'failed') {
        const displayMsg = getSunoFailureDisplayMessage({ ...group, failureReason: group?.failureReason, errorMessage: group?.errorMessage });
        alert(displayMsg);
      } else if (resolved.status === 'processing') {
        if (group && isTrackStuck(group)) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: '생성 시간 초과 (3분 경과)',
            errorMessage: '생성 시간 초과 (3분 경과)',
            updatedAt: serverTimestamp(),
          });
          alert('Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.');
        } else {
          alert('아직 생성 중입니다.');
        }
      } else {
        if (group && isTrackStuck(group)) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: '생성 시간 초과 (3분 경과)',
            errorMessage: '생성 시간 초과 (3분 경과)',
            updatedAt: serverTimestamp(),
          });
          alert('Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.');
        } else {
          alert('상태 응답을 받았지만 완료/실패 상태를 확정하지 못했습니다.');
        }
      }
    } catch (error) {
      console.error(error);
      const group = tracks.find(t => t.id === trackId);
      if (group && isTrackStuck(group)) {
        try {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: '생성 시간 초과 (3분 경과)',
            errorMessage: '생성 시간 초과 (3분 경과)',
            updatedAt: serverTimestamp(),
          });
          alert('Music API에서 완료 결과를 받지 못했습니다. 다시 생성해주세요.');
          return;
        } catch (dbErr) {
          console.error(dbErr);
        }
      }
      alert('Suno 생성 과정에서 오류가 발생했습니다. 잠시 후 다시 생성해주세요.');
    } finally {
      checkingIdsRef.current.delete(trackId);
      setStatusChecking(null);
    }
  };

  const getStatusBadge = (group: any) => {
    const badges = [];
    if (group.isPublic) {
      badges.push(
        <span
          key="public"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 md:px-3.5 text-[11px] font-semibold tracking-tight text-emerald-300 shadow-[0_8px_24px_rgba(16,185,129,0.14)]"
        >
          <Globe2 className="h-3.5 w-3.5" />
          공개
        </span>
      );
    }
    switch (group.status) {
      case 'failed':
      case 'cancelled':
      case 'canceled':
        badges.push(<span key="failed" className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">실패</span>);
        break;
      case 'processing':
      case 'submitted':
      case 'pending':
        badges.push(
          <span key="processing" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
             <Loader2 className="w-3 h-3 animate-spin" />
             생성 중...
          </span>
        );
        break;
    }
    return badges;
  };

  const formatCreatedAt = (createdAt: any) => {
    try {
      if (!createdAt) return '';
      if (typeof createdAt.toDate === 'function') {
        return new Date(createdAt.toDate()).toLocaleString();
      }
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
      return new Date(createdAt).toLocaleString();
    } catch (error) {
      console.error('createdAt format error:', error);
      return '';
    }
  };

  const runDownload = async (audioUrl?: string, title?: string) => {
    if (!audioUrl) {
      showToast('아직 다운로드할 음원이 없습니다.');
      return;
    }
    // Use the optimized blob downloader instead of window.open
    downloadAudioWithTitle(audioUrl, title);
  };

  const handleDownload = async (url: string, title?: string) => {
    if (isSharedView) {
      const shareTrackId = new URL(window.location.href).searchParams.get('track');
      if (shareTrackId) {
        const isPublic = await ensureSharedItemIsPublic(shareTrackId, false);
        if (!isPublic) {
          showToast('원곡자가 비공개로 전환하여 다운로드할 수 없습니다.');
          return;
        }
      }
    }

    if (isSharedView && !user) {
      console.log("Login required for shared download");

      if (isKakaoInAppBrowser) {
        setShowKakaoWarning(true);
        return;
      }
      
      const shareUrl = window.location.href;
      sessionStorage.setItem("pendingSharedDownload", JSON.stringify({
        audioUrl: url,
        title,
        shareUrl
      }));
      
      showToast("다운로드하려면 로그인이 필요합니다.");
      
      const googleProvider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, googleProvider);
        
        // 로그인 성공 후 같은 페이지에서 다운로드 실행
        const pendingStr = sessionStorage.getItem("pendingSharedDownload");
        if (pendingStr) {
          const pending = JSON.parse(pendingStr);
          sessionStorage.removeItem("pendingSharedDownload");
          await runDownload(pending.audioUrl, pending.title);
        }
      } catch (error: any) {
        console.error("Shared download login failed:", error);
        if (error?.code === 'auth/popup-blocked') {
          showToast("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.");
        } else {
          showToast("로그인이 취소되었거나 실패했습니다.");
        }
        sessionStorage.removeItem("pendingSharedDownload");
      }
      return;
    }

    await runDownload(url, title);
  };

  const [sharePopupInfo, setSharePopupInfo] = useState<{ group: any, item: any, idx?: number, mode: 'default' | 'pc-panel' } | null>(null);
  const [shareToastInfo, setShareToastInfo] = useState<string | null>(null);

  const canManageSharePrivacy = (info: typeof sharePopupInfo) => {
    if (!info || !user) return false;

    const group = info.group || {};

    // Shared-link pages and shared playlist items are re-share only.
    // Public/private scope control belongs to the original owner only.
    if (isSharedView || group.sourceType === 'shared_track') return false;

    if (group.isPlaylistItem) {
      return group.sourceType === 'suno_track' && (!group.ownerUid || group.ownerUid === user.uid);
    }

    return !group.ownerUid || group.ownerUid === user.uid;
  };

  const getShareIdsForTarget = (group: any, item?: any, idx?: number) => {
    const ids = new Set<string>();
    const addId = (value: any) => {
      const id = String(value || '').trim();
      if (id) ids.add(id);
    };

    const baseIds = [
      group?.shareId,
      item?.shareId,
      group?.id,
      group?.trackId,
      group?.sourceId,
      item?.sourceId,
      item?.trackId,
    ].map((value) => String(value || '').trim()).filter(Boolean);

    baseIds.forEach(addId);

    const rawSubIndex = idx ?? item?.sourceSubTrackIndex ?? item?.subTrackIndex ?? group?.sourceSubTrackIndex ?? group?.subTrackIndex;
    const subIndex = Number(rawSubIndex);
    if (Number.isFinite(subIndex)) {
      baseIds.forEach((baseId) => addId(`${baseId}_${subIndex}`));
    }

    const items = group && !group.isPlaylistItem ? extractSunoData(group) : [];
    if (items.length > 0) {
      baseIds.forEach((baseId) => {
        items.forEach((_: any, itemIndex: number) => addId(`${baseId}_${itemIndex}`));
      });
    }

    return Array.from(ids);
  };

  const closeShareDocumentsForTarget = async (group: any, item?: any, idx?: number) => {
    const shareIds = getShareIdsForTarget(group, item, idx);
    let closedCount = 0;

    await Promise.all(shareIds.map(async (shareId) => {
      try {
        const shareRef = doc(db, 'suno_shares', shareId);
        const shareSnap = await getDoc(shareRef);
        if (!shareSnap.exists()) return;
        const shareData = shareSnap.data();
        if (shareData.ownerUid && user && shareData.ownerUid !== user.uid) return;

        await updateDoc(shareRef, {
          isPublic: false,
          shareType: 'private',
          privateUpdatedAt: serverTimestamp()
        });
        closedCount += 1;
      } catch (error) {
        console.warn('share document private update skipped:', shareId, error);
      }
    }));

    return closedCount;
  };

  const ensureSharedItemIsPublic = async (sourceId?: string | null, showMessage = true) => {
    const safeSourceId = String(sourceId || '').trim();
    if (!safeSourceId) return false;

    try {
      const shareSnap = await getDoc(doc(db, 'suno_shares', safeSourceId));
      const isPublic = shareSnap.exists() && shareSnap.data().isPublic === true;
      setSharedStatusCache(prev => ({ ...prev, [safeSourceId]: { isPublic, checkedAt: Date.now() } }));

      if (!isPublic && showMessage) {
        showToast('원곡자가 비공개로 전환하여 사용할 수 없습니다.');
      }

      return isPublic;
    } catch (error) {
      console.error('shared track status check failed:', error);
      if (showMessage) showToast('공유곡 상태를 확인할 수 없습니다.');
      return false;
    }
  };

  const showToast = (msg: string) => {
    setShareToastInfo(msg);
    setTimeout(() => setShareToastInfo(null), 3000);
  };

  const getWorkspaceSelectionKey = (group: any, idx: number, audioUrl?: string) => {
    const item = extractSunoData(group)[idx] || {};
    const subId = item?.id || item?.audioId || item?.taskId || idx;
    return `workspace:${group?.id || group?.trackId || 'unknown'}:${idx}:${subId}:${audioUrl || ''}`;
  };

  const getPlaylistSelectionKey = (item: any) => {
    return `${libraryViewMode}:${activePlaylistId || 'none'}:${item?.playlistUniqueKey || item?.id || item?.sourceSubTrackId || item?.sourceId || item?.audioUrl || ''}`;
  };

  const buildWorkspaceSelection = (group: any, item: any, idx: number): MultiSelectedTrack => {
    const audioUrl = getAudioUrl(item, group);
    return {
      key: getWorkspaceSelectionKey(group, idx, audioUrl),
      context: 'workspace',
      group,
      item,
      idx,
      audioUrl,
      title: getTitle(item, group, idx),
    };
  };

  const buildPlaylistSelection = (item: any): MultiSelectedTrack => ({
    key: getPlaylistSelectionKey(item),
    context: libraryViewMode === 'sharedPlaylist' || activePlaylistSection === 'shared' ? 'sharedPlaylist' : 'playlist',
    group: item,
    item,
    idx: Number.isFinite(Number(item?.sourceSubTrackIndex)) ? Number(item.sourceSubTrackIndex) : 0,
    audioUrl: item?.audioUrl || item?.streamAudioUrl || item?.audio_url || '',
    title: item?.title || 'Untitled',
  });

  const isTrackSelected = (key: string) => Boolean(selectedTrackMap[key]);

  const clearLibrarySelectionClickGuards = () => {
    clearLibraryLongPressTimer();
    libraryLongPressTriggeredRef.current = false;
    librarySuppressNextCardClickRef.current = false;
    librarySuppressNextCardClickKeyRef.current = null;
    libraryDragSelectSuppressClickRef.current = false;
    libraryCardClickStartPointRef.current = null;
  };

  const toggleSelectedTrack = (selection: MultiSelectedTrack, force?: boolean) => {
    setSelectedTrackMap((prev) => {
      const exists = Boolean(prev[selection.key]);
      const shouldSelect = typeof force === 'boolean' ? force : !exists;
      if (!shouldSelect) {
        const next = { ...prev };
        delete next[selection.key];
        return next;
      }
      return { ...prev, [selection.key]: selection };
    });
  };

  const setLibraryTrackSelection = (selection: MultiSelectedTrack | null, shouldSelect: boolean) => {
    if (!selection) return;
    setSelectedTrackMap((prev) => {
      const exists = Boolean(prev[selection.key]);
      if (shouldSelect) return exists ? prev : { ...prev, [selection.key]: selection };
      if (!exists) return prev;
      const next = { ...prev };
      delete next[selection.key];
      return next;
    });
  };

  const applyLibraryTrackDragSelection = (selection: MultiSelectedTrack | null) => {
    if (!selection || libraryDragSelectVisitedKeysRef.current.has(selection.key)) return;
    libraryDragSelectVisitedKeysRef.current.add(selection.key);
    setLibraryTrackSelection(selection, libraryDragSelectActionRef.current === 'select');
  };

  const resetLibraryDragSelectState = () => {
    libraryDragSelectActiveRef.current = false;
    libraryDragSelectMovedRef.current = false;
    libraryDragSelectStartPointRef.current = null;
    libraryDragSelectStartSelectionRef.current = null;
    libraryDragSelectActionRef.current = 'select';
    libraryDragSelectVisitedKeysRef.current.clear();
  };

  const handleLibraryDragSelectStart = (event: React.MouseEvent, selection: MultiSelectedTrack) => {
    if (!multiSelectMode || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    const isSelectionCheckbox = Boolean(target?.closest('[data-selection-checkbox="true"]'));
    if (!isSelectionCheckbox && target?.closest('button, a, input, textarea, select, [contenteditable="true"], [data-floating-menu="true"], [data-no-card-long-press="true"]')) {
      return;
    }

    event.preventDefault();
    libraryDragSelectActiveRef.current = true;
    libraryDragSelectMovedRef.current = false;
    libraryDragSelectStartPointRef.current = { x: event.clientX, y: event.clientY };
    libraryDragSelectStartSelectionRef.current = selection;
    libraryDragSelectActionRef.current = selectedTrackMap[selection.key] ? 'deselect' : 'select';
    libraryDragSelectVisitedKeysRef.current.clear();
  };

  const handleLibraryDragSelectMove = (event: React.MouseEvent, selection: MultiSelectedTrack) => {
    if (!multiSelectMode || !libraryDragSelectActiveRef.current || !libraryDragSelectStartPointRef.current) return;

    event.preventDefault();
    const dx = event.clientX - libraryDragSelectStartPointRef.current.x;
    const dy = event.clientY - libraryDragSelectStartPointRef.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);

    if (movedDistance <= 5 && !libraryDragSelectMovedRef.current) return;

    libraryDragSelectMovedRef.current = true;
    applyLibraryTrackDragSelection(libraryDragSelectStartSelectionRef.current);
    applyLibraryTrackDragSelection(selection);
  };

  const handleLibraryDragSelectEnter = (event: React.MouseEvent, selection: MultiSelectedTrack) => {
    if (!multiSelectMode || !libraryDragSelectActiveRef.current) return;

    event.preventDefault();
    libraryDragSelectMovedRef.current = true;
    applyLibraryTrackDragSelection(libraryDragSelectStartSelectionRef.current);
    applyLibraryTrackDragSelection(selection);
  };

  const handleLibraryDragSelectEnd = () => {
    if (libraryDragSelectActiveRef.current && libraryDragSelectMovedRef.current) {
      libraryDragSelectSuppressClickRef.current = true;
    }
    resetLibraryDragSelectState();
  };

  const consumeLibraryDragSelectClick = (event: React.MouseEvent) => {
    if (!libraryDragSelectSuppressClickRef.current) return false;

    event.preventDefault();
    event.stopPropagation();
    (event.nativeEvent as any)?.stopImmediatePropagation?.();
    libraryDragSelectSuppressClickRef.current = false;
    return true;
  };

  const enterMultiSelectWith = (selection: MultiSelectedTrack) => {
    setMultiSelectMode(true);
    setBulkMenuState(null);
    setBulkShareModalOpen(false);
    setBulkMoveModalOpen(false);
    setActiveMenuState(null);
    setActivePlaylistItemMenu(null);
    setActiveColorMenu(null);
    toggleSelectedTrack(selection, true);
  };

  const clearMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedTrackMap({});
    setBulkMenuState(null);
    setBulkShareModalOpen(false);
    setBulkMoveModalOpen(false);
    setLibrarySelectionMoreOpen(false);
    librarySuppressNextCardClickKeyRef.current = null;
  };

  const clearLibraryLongPressTimer = () => {
    if (libraryLongPressTimerRef.current) {
      clearTimeout(libraryLongPressTimerRef.current);
      libraryLongPressTimerRef.current = null;
    }
    libraryLongPressStartPointRef.current = null;
  };

  const getLibraryLongPressPoint = (event: any) => {
    if ('touches' in event) {
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    return { x: event.clientX, y: event.clientY };
  };

  const handleLibraryCardLongPressStart = (event: any, selection: MultiSelectedTrack) => {
    clearLibraryLongPressTimer();
    if (typeof event?.button === 'number' && event.button !== 0) return;
    if (multiSelectMode) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"], [data-floating-menu="true"], [data-no-card-long-press="true"]')) {
      return;
    }

    const startPoint = getLibraryLongPressPoint(event);
    if (!startPoint) return;
    const shouldStartDragSelectAfterLongPress = !('touches' in event);
    libraryLongPressStartPointRef.current = startPoint;
    libraryCardClickStartPointRef.current = startPoint;

    libraryLongPressTimerRef.current = setTimeout(() => {
      libraryLongPressTriggeredRef.current = true;
      librarySuppressNextCardClickRef.current = true;
      librarySuppressNextCardClickKeyRef.current = selection.key;

      if (multiSelectMode) {
        clearMultiSelect();
      } else {
        enterMultiSelectWith(selection);
        if (shouldStartDragSelectAfterLongPress) {
          libraryDragSelectActiveRef.current = true;
          libraryDragSelectMovedRef.current = false;
          libraryDragSelectStartPointRef.current = startPoint;
          libraryDragSelectStartSelectionRef.current = selection;
          libraryDragSelectActionRef.current = 'select';
          libraryDragSelectVisitedKeysRef.current = new Set([selection.key]);
        }
      }
    }, 500);
  };

  const handleLibraryCardLongPressMove = (event: any) => {
    if (!libraryLongPressTimerRef.current || !libraryLongPressStartPointRef.current) return;

    const point = getLibraryLongPressPoint(event);
    if (!point) {
      clearLibraryLongPressTimer();
      return;
    }

    const dx = point.x - libraryLongPressStartPointRef.current.x;
    const dy = point.y - libraryLongPressStartPointRef.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);

    if (movedDistance > 10) {
      clearLibraryLongPressTimer();
    }
  };

  const handleLibraryCardLongPressEnd = () => {
    clearLibraryLongPressTimer();
  };

  const consumeLibrarySuppressedClick = (event: any, selectionKey?: string) => {
    if (!libraryLongPressTriggeredRef.current && !librarySuppressNextCardClickRef.current) return false;

    const suppressKey = librarySuppressNextCardClickKeyRef.current;
    if (suppressKey && selectionKey && suppressKey !== selectionKey) {
      libraryLongPressTriggeredRef.current = false;
      librarySuppressNextCardClickRef.current = false;
      librarySuppressNextCardClickKeyRef.current = null;
      libraryCardClickStartPointRef.current = null;
      return false;
    }

    event.preventDefault?.();
    event.stopPropagation?.();
    event.nativeEvent?.stopImmediatePropagation?.();
    libraryLongPressTriggeredRef.current = false;
    librarySuppressNextCardClickRef.current = false;
    librarySuppressNextCardClickKeyRef.current = null;
    libraryCardClickStartPointRef.current = null;
    return true;
  };

  const shouldIgnoreLibraryCardClickFromPointerTravel = (event: any) => {
    if (!libraryCardClickStartPointRef.current) return false;
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
      libraryCardClickStartPointRef.current = null;
      return false;
    }

    const dx = event.clientX - libraryCardClickStartPointRef.current.x;
    const dy = event.clientY - libraryCardClickStartPointRef.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);
    libraryCardClickStartPointRef.current = null;

    return movedDistance > 10;
  };

  const getPlaylistItemVisibilityState = (item: any): 'public' | 'private' => {
    if (item?.sourceType === 'shared_track') {
      const sourceId = String(item?.sourceId || '').trim();
      const cached = sourceId ? sharedStatusCache[sourceId] : null;
      return cached?.isPublic === false ? 'private' : 'public';
    }

    const sourceTrack = getPlaylistItemSourceTrack(item);
    const isPublicValue = ((sourceTrack as any)?.isPublic ?? item?.isPublic);
    return isPublicValue === false ? 'private' : 'public';
  };

  const isUnavailableSharedSelection = (selection: MultiSelectedTrack) => {
    const item = selection.item as any;
    if (selection.context !== 'sharedPlaylist' && item?.sourceType !== 'shared_track') return false;
    const sourceId = String(item?.sourceId || '').trim();
    if (!sourceId) return false;
    return sharedStatusCache[sourceId]?.isPublic === false;
  };

  const hasUnavailableSharedSelection = selectedTrackList.some(isUnavailableSharedSelection);
  const blockedBulkActionClass = "w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-all text-white/25 cursor-not-allowed";
  const normalBulkActionClass = "w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all";

  const matchesPlaylistVisibilityFilter = (item: any) => {
    if (playlistVisibilityFilter === 'all') return true;
    return getPlaylistItemVisibilityState(item) === playlistVisibilityFilter;
  };

  const getVisiblePlaylistItemsForSelection = () => {
    const normalizedPlaylistSearch = playlistSearchTerm.trim().toLowerCase();
    let items = playlistItems.filter((item) => {
      if (!matchesPlaylistVisibilityFilter(item)) return false;
      if (playlistColorFilter === 'all') return true;
      const itemColor = getPlaylistItemColor(item);
      if (playlistColorFilter === 'gray') return itemColor === 'gray';
      return itemColor === playlistColorFilter;
    });

    if (normalizedPlaylistSearch) {
      items = items.filter((item) => {
        const searchable = [
          item.title,
          formatSunoDisplayTitle(item.title),
          getPlaylistItemCreatorName(item),
          item.ownerNickname,
          item.creatorNickname,
          item.ownerEmail,
          item.creatorEmail,
          item.ownerUid,
          item.sourceId,
          ...(item.genreLabels || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedPlaylistSearch);
      });
    }

    if (playlistSortMode === 'added') {
      items = [...items].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        const timeA = a.addedAt ? (typeof a.addedAt.toMillis === 'function' ? a.addedAt.toMillis() : 0) : 0;
        const timeB = b.addedAt ? (typeof b.addedAt.toMillis === 'function' ? b.addedAt.toMillis() : 0) : 0;
        return timeA - timeB;
      });
    } else if (playlistSortMode === 'genre') {
      items = [...items].sort((a, b) => {
        const genreA = (a.genreLabels && a.genreLabels[0]) || '';
        const genreB = (b.genreLabels && b.genreLabels[0]) || '';
        return genreA.localeCompare(genreB);
      });
    } else if (playlistSortMode === 'custom') {
      items = [...items].sort((a, b) => a.order - b.order);
    }

    return items;
  };

  const getVisibleMultiSelections = () => {
    if (libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') {
      return getVisiblePlaylistItemsForSelection().map((item) => buildPlaylistSelection(item));
    }

    const selections: MultiSelectedTrack[] = [];
    displayedWorkspaceTracks.forEach((group) => {
      const dataItems = extractSunoData(group);
      const items = (dataItems.length > 0 ? dataItems : [{}])
        .map((item: any, idx: number) => ({ item, idx }))
        .filter(({ item, idx }: { item: any; idx: number }) => isWorkspaceItemVisible(group, item, idx));

      items.forEach(({ item, idx }: { item: any; idx: number }) => {
        selections.push(buildWorkspaceSelection(group, item, idx));
      });
    });

    return selections;
  };

  const selectAllVisibleTracks = () => {
    const selections = getVisibleMultiSelections();
    if (selections.length === 0) {
      showToast('선택할 곡이 없습니다.');
      return;
    }

    const nextMap: Record<string, MultiSelectedTrack> = {};
    selections.forEach((selection) => {
      nextMap[selection.key] = selection;
    });

    setMultiSelectMode(true);
    setSelectedTrackMap(nextMap);
    setBulkMenuState(null);
  };

  const openBulkMenuFromButton = (button: HTMLButtonElement) => {
    if (!multiSelectMode) return;
    const position = computeFloatingMenuPosition(button, 300);
    setBulkMenuState({ ...position, anchorEl: button });
  };

  useEffect(() => {
    if (!multiSelectMode) {
      multiSelectHistoryPushedRef.current = false;
      return;
    }

    if (!multiSelectHistoryPushedRef.current) {
      window.history.pushState({ soridrawMultiSelect: true }, '', window.location.href);
      multiSelectHistoryPushedRef.current = true;
    }

    const handlePopState = () => {
      clearMultiSelect();
      multiSelectHistoryPushedRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [multiSelectMode]);


  const normalizeCreatorName = (value: any, ownerUid?: string | null) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return '';
    if (ownerUid && text === ownerUid) return '';
    // Firebase UID-like values should not be treated as display names.
    if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) return '';
    return text;
  };

  const resolveCreatorSnapshot = (group: any, item: any, options?: { fallbackToCurrentUser?: boolean }) => {
    const ownerUid = group?.ownerUid || item?.ownerUid || group?.uid || item?.uid || user?.uid || '';
    const currentUserName = options?.fallbackToCurrentUser
      ? (userNameMap[user?.uid || ''] || user?.displayName || user?.email || '')
      : '';

    const creatorName =
      normalizeCreatorName(group?.artist, ownerUid) ||
      normalizeCreatorName(group?.artistName, ownerUid) ||
      normalizeCreatorName(group?.author, ownerUid) ||
      normalizeCreatorName(group?.uploaderName, ownerUid) ||
      normalizeCreatorName(group?.ownerNickname, ownerUid) ||
      normalizeCreatorName(group?.creatorNickname, ownerUid) ||
      normalizeCreatorName(group?.creatorDisplayId, ownerUid) ||
      normalizeCreatorName(group?.ownerName, ownerUid) ||
      normalizeCreatorName(group?.nickname, ownerUid) ||
      normalizeCreatorName(group?.displayName, ownerUid) ||
      normalizeCreatorName(group?.shareData?.ownerNickname, ownerUid) ||
      normalizeCreatorName(group?.shareData?.creatorNickname, ownerUid) ||
      normalizeCreatorName(group?.shareData?.creatorDisplayId, ownerUid) ||
      normalizeCreatorName(group?.shareData?.ownerName, ownerUid) ||
      normalizeCreatorName(item?.artist, ownerUid) ||
      normalizeCreatorName(item?.artistName, ownerUid) ||
      normalizeCreatorName(item?.author, ownerUid) ||
      normalizeCreatorName(item?.uploaderName, ownerUid) ||
      normalizeCreatorName(item?.ownerNickname, ownerUid) ||
      normalizeCreatorName(item?.creatorNickname, ownerUid) ||
      normalizeCreatorName(item?.creatorDisplayId, ownerUid) ||
      normalizeCreatorName(item?.ownerName, ownerUid) ||
      normalizeCreatorName(currentUserName, ownerUid) ||
      '';

    const ownerEmail =
      group?.ownerEmail ||
      group?.creatorEmail ||
      group?.shareData?.ownerEmail ||
      group?.shareData?.creatorEmail ||
      item?.ownerEmail ||
      item?.creatorEmail ||
      (options?.fallbackToCurrentUser ? user?.email : null) ||
      null;

    const creatorEmail =
      group?.creatorEmail ||
      group?.ownerEmail ||
      group?.shareData?.creatorEmail ||
      group?.shareData?.ownerEmail ||
      item?.creatorEmail ||
      item?.ownerEmail ||
      (options?.fallbackToCurrentUser ? user?.email : null) ||
      null;

    return {
      creatorDisplayId: creatorName || null,
      ownerNickname: creatorName || null,
      creatorNickname: creatorName || null,
      ownerEmail,
      creatorEmail,
    };
  };

  const handleShare = (group: any, item: any, idx: number) => {
    setSharePopupInfo({ group, item, idx, mode: 'default' });
  };

  const getSharePageUrl = (group?: any, idx?: number) => {
    if (isSharedView) return window.location.href;

    const appOrigin = window.location.hostname.includes("run.app") || window.location.hostname.includes("aistudio.google.com")
      ? "https://soridraw-music.vercel.app"
      : window.location.origin;

    const shareId = idx !== undefined && group ? `${group.id}_${idx}` : group?.id || '';
    return `${appOrigin}/suno-library?track=${shareId}`;
  };

  const handleShareCurrentPage = async () => {
    const shareUrl = window.location.href;

    console.log("Shared page share action:", {
      shareUrl,
      canUseNativeShare: !!navigator.share,
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title: "SORIDRAW Music 공유 음악",
          text: "SORIDRAW에서 공유된 음악입니다.",
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      showToast("공유 링크가 복사되었습니다.");
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error("Shared page share failed:", e);
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("공유 링크가 복사되었습니다.");
      } catch {
        showToast("공유에 실패했습니다.");
      }
    }
  };

  const openCurrentShareInChrome = () => {
    const currentUrl = window.location.href.replace(/^https?:\/\//, '');
    window.location.href = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const handleKakaoModalShare = async () => {
    await handleShareCurrentPage();
  };

  const handleCopyShareLink = async (group: any) => {
    if (isSharedView) {
      await handleShareCurrentPage();
      return;
    }

    const shareUrl = getSharePageUrl(group);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("링크가 복사되었습니다");
    } catch (e) {
      showToast("링크 복사에 실패했습니다.");
    }
  };

  const handlePublicShare = async () => {
    if (!sharePopupInfo) return;
    const { group, item, idx } = sharePopupInfo;
    try {
      if (user) {
        if (!group.isPlaylistItem) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
          await updateDoc(trackRef, {
            isPublic: true,
            hidden: false,
            shareType: 'public',
            publicSharedAt: serverTimestamp()
          });
        }

        const creatorMeta = resolveCreatorSnapshot(group, item, { fallbackToCurrentUser: !group?.isPlaylistItem });
        const shareId = idx !== undefined ? `${group.id}_${idx}` : group.id;
        const shareRef = doc(db, 'suno_shares', shareId);
        await setDoc(shareRef, {
          trackId: group.id,
          subTrackIndex: idx ?? null,
          taskId: group.taskId || '',
          title: item?.title || item?.name || group.title || 'Untitled',
          audioUrl: item?.audio_url || item?.url || '',
          imageUrl: item?.image_url || item?.imageUrl || group.imageUrl || '',
          duration: item?.duration || group.duration || null,
          status: group.status || 'completed',
          prompt: group.prompt || group?.requestPayload?.prompt || group?.appliedKeywords?.prompt || '',
          style: group.style || group?.appliedKeywords?.style || '',
          lyrics: group.lyrics || group.lyricsText || item?.lyrics || item?.lyricsText || group?.requestPayload?.lyrics || group?.requestPayload?.lyricsText || null,
          lyricsText: group.lyricsText || group.lyrics || item?.lyricsText || item?.lyrics || group?.requestPayload?.lyricsText || group?.requestPayload?.lyrics || null,
          koreanLyrics: group.koreanLyrics || item?.koreanLyrics || group?.requestPayload?.koreanLyrics || null,
          englishLyrics: group.englishLyrics || item?.englishLyrics || group?.requestPayload?.englishLyrics || null,
          requestPayload: group.requestPayload || group.appliedKeywords || null,
          sunoData: group.sunoData || null,
          apiResponse: group.apiResponse || null,
          apiStatusResponse: group.apiStatusResponse || null,
          appliedKeywords: group.appliedKeywords || {},
          createdAt: group.createdAt || serverTimestamp(),
          ownerUid: user.uid,
          creatorDisplayId: creatorMeta.creatorDisplayId,
          ownerNickname: creatorMeta.ownerNickname,
          creatorNickname: creatorMeta.creatorNickname,
          ownerEmail: creatorMeta.ownerEmail,
          creatorEmail: creatorMeta.creatorEmail,
          isPublic: true
        });

        setSharePopupInfo(prev => prev ? { ...prev, group: { ...prev.group, isPublic: true } } : null);
      }
      
      const shareUrl = getSharePageUrl(group, idx);
      const title = item?.title || item?.name || group.title || 'SORIDRAW Music';

      try {
        if (navigator.share) {
          await navigator.share({
            title,
            text: '공유 음악 재생하기🎵',
            url: shareUrl,
          });
          closeModal();
          return;
        }

        await navigator.clipboard.writeText(shareUrl);
        showToast("공유 링크가 복사되었습니다.");
        closeModal();
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('Native share failed:', e);
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast("공유 링크가 복사되었습니다.");
          closeModal();
        } catch {
          showToast("공유에 실패했습니다.");
        }
      }
    } catch (e) {
      console.error(e);
      showToast('공유 처리 중 오류가 발생했습니다.');
    }
  };

  const handlePublicStatus = async () => {
    if (!sharePopupInfo) return;
    if (!canManageSharePrivacy(sharePopupInfo)) {
      showToast('공개 범위 설정은 원제작자만 변경할 수 있습니다.');
      return;
    }
    const { group, item, idx } = sharePopupInfo;
    try {
      if (user) {
        if (!group.isPlaylistItem) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
          await updateDoc(trackRef, {
            isPublic: true,
            hidden: false,
            shareType: 'public',
            publicSharedAt: serverTimestamp()
          });
        }

        const creatorMeta = resolveCreatorSnapshot(group, item, { fallbackToCurrentUser: !group?.isPlaylistItem });
        const shareId = idx !== undefined ? `${group.id}_${idx}` : group.id;
        const shareRef = doc(db, 'suno_shares', shareId);
        await setDoc(shareRef, {
          trackId: group.id,
          subTrackIndex: idx ?? null,
          taskId: group.taskId || '',
          title: item?.title || item?.name || group.title || 'Untitled',
          audioUrl: item?.audio_url || item?.url || '',
          imageUrl: item?.image_url || item?.imageUrl || group.imageUrl || '',
          duration: item?.duration || group.duration || null,
          status: group.status || 'completed',
          prompt: group.prompt || group?.requestPayload?.prompt || group?.appliedKeywords?.prompt || '',
          style: group.style || group?.appliedKeywords?.style || '',
          lyrics: group.lyrics || group.lyricsText || item?.lyrics || item?.lyricsText || group?.requestPayload?.lyrics || group?.requestPayload?.lyricsText || null,
          lyricsText: group.lyricsText || group.lyrics || item?.lyricsText || item?.lyrics || group?.requestPayload?.lyricsText || group?.requestPayload?.lyrics || null,
          koreanLyrics: group.koreanLyrics || item?.koreanLyrics || group?.requestPayload?.koreanLyrics || null,
          englishLyrics: group.englishLyrics || item?.englishLyrics || group?.requestPayload?.englishLyrics || null,
          requestPayload: group.requestPayload || group.appliedKeywords || null,
          sunoData: group.sunoData || null,
          apiResponse: group.apiResponse || null,
          apiStatusResponse: group.apiStatusResponse || null,
          appliedKeywords: group.appliedKeywords || {},
          createdAt: group.createdAt || serverTimestamp(),
          ownerUid: user.uid,
          creatorDisplayId: creatorMeta.creatorDisplayId,
          ownerNickname: creatorMeta.ownerNickname,
          creatorNickname: creatorMeta.creatorNickname,
          ownerEmail: creatorMeta.ownerEmail,
          creatorEmail: creatorMeta.creatorEmail,
          isPublic: true
        });

        setSharePopupInfo(prev => prev ? { ...prev, group: { ...prev.group, isPublic: true } } : null);
        showToast('공개 상태로 전환되었습니다');
      }
    } catch (e) {
      console.error(e);
      showToast('공개 전환 중 오류가 발생했습니다.');
    }
  };

  const handlePrivateShare = async () => {
    if (!sharePopupInfo) return;
    if (!canManageSharePrivacy(sharePopupInfo)) {
      showToast('공개 범위 설정은 원제작자만 변경할 수 있습니다.');
      return;
    }
    const { group, item, idx } = sharePopupInfo;
    try {
      if (user) {
        if (!group.isPlaylistItem) {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
          await updateDoc(trackRef, {
            isPublic: false,
            shareType: 'private',
            privateUpdatedAt: serverTimestamp()
          });
        }

        await closeShareDocumentsForTarget(group, item, idx);

        setSharePopupInfo(prev => prev ? { ...prev, group: { ...prev.group, isPublic: false } } : null);
        showToast('비공개 상태로 전환되었습니다');
      }
    } catch (e) {
      console.error(e);
      showToast('비공개 전환 중 오류가 발생했습니다.');
    }
  };

  const handlePlatformShare = async (platform: string) => {
    if (!sharePopupInfo) return;
    const { group, item, idx } = sharePopupInfo;
    const shareUrl = getSharePageUrl(group, idx);
    const title = item?.title || item?.name || group.title || 'SORIDRAW Music';

    try {
      if (platform === 'copy') {
        if (navigator.share) {
          try {
            await navigator.share({
              title,
              text: '공유 음악 재생하기🎵',
              url: shareUrl,
            });
          } catch (e: any) {
            if (e?.name === 'AbortError') return;
            await navigator.clipboard.writeText(shareUrl);
            showToast("공유 링크가 복사되었습니다.");
          }
        } else {
          await navigator.clipboard.writeText(shareUrl);
          showToast("공유 링크가 복사되었습니다.");
        }
      } else if (platform === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`;
      } else if (platform === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
      } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
      } else if (platform === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`, '_blank');
      } else if (platform === 'kakao' || platform === 'kakao_me') {
        const kakao = (window as any).Kakao;
        if (kakao && kakao.isInitialized()) {
          try {
            kakao.Share.sendDefault({
              objectType: 'feed',
              content: {
                title: title,
                description: '공유 음악 재생하기🎵',
                imageUrl: getImageUrl(item, group) || 'https://soridraw-music.vercel.app/og-image.png',
                link: {
                  mobileWebUrl: shareUrl,
                  webUrl: shareUrl,
                },
              },
            });
          } catch (e) {
            console.error("Kakao share failed", e);
            showToast("카카오톡 공유에 실패했습니다.");
          }
        } else {
          showToast("카카오톡 SDK가 초기화되지 않았습니다.");
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast("링크가 복사되었습니다. 원하는 앱에 붙여넣어 공유해주세요.");
      }
    } catch(e) {
      console.error("Platform share failed:", e);
      showToast("공유 실패");
    }
  };


  const resolveSunoAppliedKeywords = (...sources: any[]) => {
    for (const source of sources) {
      if (!source) continue;

      const keywords =
        source?.appliedKeywords ||
        source?.requestPayload?.appliedKeywords ||
        source?.shareData?.appliedKeywords ||
        source?.shareData?.requestPayload?.appliedKeywords ||
        source?.track?.appliedKeywords ||
        source?.track?.requestPayload?.appliedKeywords ||
        source?.group?.appliedKeywords ||
        source?.group?.requestPayload?.appliedKeywords ||
        source?.tracks?.[0]?.appliedKeywords ||
        source?.tracks?.[0]?.requestPayload?.appliedKeywords ||
        null;

      if (
        keywords &&
        typeof keywords === "object" &&
        !Array.isArray(keywords) &&
        Object.keys(keywords).length > 0
      ) {
        return keywords;
      }
    }

    return null;
  };

  const handleApplyNext = (group: any, item: any) => {
    if (!group && !item) return;

    const appliedKeywords = resolveSunoAppliedKeywords(
      item,
      group,
      group?.item,
      group?.track,
      group?.shareData,
      group?.tracks?.[0]
    );

    console.log("Shared/Library apply source:", {
      group,
      item,
      resolvedAppliedKeywords: appliedKeywords,
    });

    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      showToast("이 곡은 키워드 정보가 없어 적용할 수 없습니다.");
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem("pendingAppliedKeywords", serialized);
    localStorage.setItem("pendingAppliedKeywordsBackup", serialized);

    console.log("Saved pendingAppliedKeywords:", {
      appliedKeywords,
      sessionValue: sessionStorage.getItem("pendingAppliedKeywords"),
      localBackup: localStorage.getItem("pendingAppliedKeywordsBackup"),
    });

    showToast("다음 곡에 곡 설정이 복원되었습니다.");

    setTimeout(() => {
      navigate(`/studio?applyPending=1&t=${Date.now()}`);
    }, 700);
  };

  const getPlaylistSaveIsShared = (group: any, item: any) => (
    Boolean(isSharedView || group?.sourceType === 'shared_track' || item?.sourceType === 'shared_track')
  );

  const handleSavePlaylist = async (
    group: any,
    item: any,
    url: string,
    idx: number,
    targetPlaylistOverride?: Playlist,
    options?: { silent?: boolean }
  ): Promise<'saved' | 'duplicate' | 'failed' | 'blocked'> => {
    const silent = Boolean(options?.silent);
    if (!user) {
      if (!silent) showToast("로그인이 필요합니다.");
      return 'blocked';
    }

    const isShared = getPlaylistSaveIsShared(group, item);

    try {
      await ensureDefaultPlaylists(user.uid);
    } catch (e) {
      console.error("Failed to ensure default playlists", e);
    }

    let targetPlaylist: Playlist | undefined = targetPlaylistOverride;
    if (!targetPlaylist?.id) {
      try {
        const dbLists = await getPlaylistsByType(user.uid, isShared ? "shared" : "normal");
        targetPlaylist = dbLists.find((list) => !(list as any).isFallback) || dbLists[0];
      } catch (e) {
        console.error("Failed to fetch target playlists", e);
      }
    }

    if (!targetPlaylist?.id || (targetPlaylist as any).isFallback) {
      if (!silent) showToast(`저장할 ${isShared ? '공유 받은 곡 ' : ''}플레이리스트가 없습니다.`);
      return 'blocked';
    }

    const finalAudioUrl =
      url ||
      item?.audioUrl ||
      item?.streamAudioUrl ||
      item?.sourceAudioUrl ||
      item?.sourceStreamAudioUrl ||
      group?.audioUrl ||
      group?.streamAudioUrl ||
      group?.sourceAudioUrl ||
      group?.sourceStreamAudioUrl ||
      "";

    if (!finalAudioUrl) {
      if (!silent) showToast("저장할 오디오 URL이 없습니다.");
      return 'blocked';
    }

    const safeShareId =
      group?.shareId ||
      group?.id ||
      group?.trackId ||
      group?.sourceId ||
      group?.shareData?.id ||
      item?.shareId ||
      item?.id ||
      item?.audioId ||
      item?.taskId ||
      `shared_${Date.now()}_${idx}`;

    const sourceId = isShared
      ? String(safeShareId)
      : String(group?.id || group?.trackId || item?.sourceId || item?.id || item?.audioId || item?.taskId || `${group?.id || 'unknown'}_${idx}`);

    if (isShared) {
      const isPublic = await ensureSharedItemIsPublic(sourceId, false);
      if (!isPublic) {
        if (!silent) showToast('원곡자가 비공개로 전환하여 플레이리스트에 저장할 수 없습니다.');
        return 'blocked';
      }
    }

    const creatorMeta = resolveCreatorSnapshot(group, item, { fallbackToCurrentUser: !isShared });

    const itemData: Omit<PlaylistItem, 'id' | 'addedAt' | 'updatedAt'> = {
      sourceType: isShared ? 'shared_track' : 'suno_track',
      sourceId: sourceId,
      sourceSubTrackId: !isShared ? String(item?.id || item?.audioId || item?.taskId || idx || '') : null,
      ownerUid: (isShared ? (group?.ownerUid || group?.uid || '') : (user.uid || group?.ownerUid)) || '',
      creatorDisplayId: creatorMeta.creatorDisplayId,
      ownerNickname: creatorMeta.ownerNickname,
      creatorNickname: creatorMeta.creatorNickname,
      ownerEmail: creatorMeta.ownerEmail,
      creatorEmail: creatorMeta.creatorEmail,
      title: getTitle(item, group, idx) || "Shared Track",
      audioUrl: finalAudioUrl,
      imageUrl: item?.image_url || item?.imageUrl || group?.imageUrl || getImageUrl(item, group) || null,
      duration: item?.duration || group?.duration || getDuration(item, group) || null,
      genreLabels: [],
      appliedKeywords: resolveSunoAppliedKeywords(item, group, group?.item, group?.track, group?.shareData) || group?.appliedKeywords || null,
      prompt: group?.prompt || item?.prompt || group?.shareData?.prompt || group?.requestPayload?.prompt || group?.appliedKeywords?.prompt || null,
      style: group?.style || item?.style || group?.shareData?.style || group?.appliedKeywords?.style || null,
      lyrics: group?.lyrics || group?.lyricsText || item?.lyrics || item?.lyricsText || group?.shareData?.lyrics || group?.shareData?.lyricsText || group?.requestPayload?.lyrics || group?.requestPayload?.lyricsText || null,
      lyricsText: group?.lyricsText || group?.lyrics || item?.lyricsText || item?.lyrics || group?.shareData?.lyricsText || group?.shareData?.lyrics || group?.requestPayload?.lyricsText || group?.requestPayload?.lyrics || null,
      koreanLyrics: group?.koreanLyrics || item?.koreanLyrics || group?.shareData?.koreanLyrics || group?.requestPayload?.koreanLyrics || null,
      englishLyrics: group?.englishLyrics || item?.englishLyrics || group?.shareData?.englishLyrics || group?.requestPayload?.englishLyrics || null,
      requestPayload: group?.requestPayload || group?.shareData?.requestPayload || group?.appliedKeywords || null,
      colorTag: null,
      likeCount: 0,
      order: 0,
      isUnavailable: false,
      unavailableReason: null
    };

    // Remove undefined values to prevent Firestore errors
    (Object.keys(itemData) as Array<keyof typeof itemData>).forEach(key => {
      if (itemData[key] === undefined) {
        delete itemData[key];
      }
    });

    if (itemData.appliedKeywords) {
      const labels: string[] = [];
      if (itemData.appliedKeywords.genre) labels.push(...itemData.appliedKeywords.genre);
      if (itemData.appliedKeywords.subGenre) labels.push(...itemData.appliedKeywords.subGenre);
      if (itemData.appliedKeywords.style) labels.push(...itemData.appliedKeywords.style);
      if (itemData.appliedKeywords.situationSummary) labels.push(itemData.appliedKeywords.situationSummary);
      itemData.genreLabels = labels;
    }

    try {
      await addPlaylistItem(user.uid, targetPlaylist.id!, itemData);
      if (!silent) showToast(`'${targetPlaylist.title}' 플레이리스트에 저장되었습니다.`);
      return 'saved';
    } catch (error: any) {
      console.error("shared playlist save failed:", {
        error,
        targetPlaylist,
        finalAudioUrl,
        sourceId,
        group,
        item,
        isSharedView
      });
      if (error.message === 'DUPLICATE') {
        if (!silent) showToast("이미 이 플레이리스트에 저장된 곡입니다.");
        return 'duplicate';
      }
      if (!silent) showToast("플레이리스트 저장에 실패했습니다.");
      return 'failed';
    }
  };

  const openPlaylistSavePicker = async (targets: PlaylistSaveTarget[]) => {
    if (!user) {
      showToast("로그인이 필요합니다.");
      return;
    }

    const safeTargets = targets.filter((target) => target && (target.group || target.item));
    if (safeTargets.length === 0) return;

    if (safeTargets.some(({ group, item }) => getPlaylistSaveIsShared(group, item))) {
      const hasPrivateShared = await Promise.all(
        safeTargets
          .filter(({ group, item }) => getPlaylistSaveIsShared(group, item))
          .map(async ({ group, item, idx }) => {
            const sourceId = String(
              group?.shareId ||
              group?.id ||
              group?.trackId ||
              group?.sourceId ||
              group?.shareData?.id ||
              item?.shareId ||
              item?.id ||
              item?.audioId ||
              item?.taskId ||
              `shared_${Date.now()}_${idx}`
            );
            return !(await ensureSharedItemIsPublic(sourceId, false));
          })
      );
      if (hasPrivateShared.some(Boolean)) {
        showToast('원곡자가 비공개로 전환하여 플레이리스트에 저장할 수 없습니다.');
        return;
      }
    }

    const isShared = safeTargets.every(({ group, item }) => getPlaylistSaveIsShared(group, item));
    if (!isShared && safeTargets.some(({ group, item }) => getPlaylistSaveIsShared(group, item))) {
      showToast('일반 곡과 공유곡은 한 번에 같은 플레이리스트로 저장할 수 없습니다.');
      return;
    }

    try {
      await ensureDefaultPlaylists(user.uid);
    } catch (e) {
      console.error("Failed to ensure default playlists", e);
    }

    let targetLists = (isShared ? actualSharedPlaylists : actualNormalPlaylists).filter((playlist) => !(playlist as any).isFallback);
    if (targetLists.length === 0) {
      try {
        const dbLists = await getPlaylistsByType(user.uid, isShared ? "shared" : "normal");
        targetLists = dbLists.filter((playlist) => playlist.id && !(playlist as any).isFallback);
      } catch (e) {
        console.error("Failed to fetch target playlists", e);
      }
    }

    if (targetLists.length === 0) {
      showToast(`저장할 ${isShared ? '공유 받은 곡 ' : ''}플레이리스트가 없습니다.`);
      return;
    }

    setPlaylistSavePicker({ isShared, targets: safeTargets, playlists: targetLists });
    setPlaylistSaveCreateTitle(null);
    setActiveMenuState(null);
    setBulkMenuState(null);
  };

  const savePlaylistPickerTargets = async (targetPlaylist: Playlist) => {
    if (!playlistSavePicker) return;
    const picker = playlistSavePicker;
    setPlaylistSavePicker(null);
    setPlaylistSaveCreateTitle(null);
    setBulkMenuState(null);

    let saved = 0;
    let duplicate = 0;
    let failed = 0;
    for (const target of picker.targets) {
      const result = await handleSavePlaylist(target.group, target.item, target.audioUrl, target.idx, targetPlaylist, { silent: true });
      if (result === 'saved') saved += 1;
      else if (result === 'duplicate') duplicate += 1;
      else failed += 1;
    }

    if (saved > 0) {
      if (multiSelectMode) {
        clearMultiSelect();
      }
      showToast(picker.targets.length > 1 ? `${targetPlaylist.title} 플레이리스트에 ${saved}곡 저장되었습니다.` : `'${targetPlaylist.title}' 플레이리스트에 저장되었습니다.`);
    } else if (duplicate > 0 && failed === 0) {
      showToast('이미 이 플레이리스트에 저장된 곡입니다.');
    } else {
      showToast('플레이리스트 저장에 실패했습니다.');
    }
  };


  const commitCreateAndSavePlaylist = async () => {
    if (!user || !playlistSavePicker) return;

    const picker = playlistSavePicker;
    const type: 'normal' | 'shared' = picker.isShared ? 'shared' : 'normal';
    const currentList = picker.playlists.filter((playlist) => !(playlist as any).isFallback);
    const trimmedTitle = (playlistSaveCreateTitle || '').trim();

    if (currentList.length >= 10) {
      showToast('최대 개수까지 생성되었습니다.');
      return;
    }
    if (!trimmedTitle) {
      showToast('폴더 이름을 입력해주세요.');
      return;
    }
    if (trimmedTitle.length > 20) {
      showToast('폴더 이름은 최대 20자까지 가능합니다.');
      return;
    }
    if (currentList.some((playlist) => playlist.title === trimmedTitle)) {
      showToast('같은 이름의 폴더가 이미 있습니다.');
      return;
    }

    const newOrder = currentList.length > 0 ? Math.max(...currentList.map((playlist) => playlist.order || 0)) + 1 : 1;

    try {
      const newId = await createPlaylist(user.uid, type, trimmedTitle, newOrder);
      const nextPlaylist: Playlist = {
        id: newId,
        title: trimmedTitle,
        type,
        order: newOrder,
        isDefault: false,
      };

      if (type === 'normal') {
        setSelectedNormalPlaylistId(newId);
      } else {
        setSelectedSharedPlaylistId(newId);
      }

      setPlaylistSaveCreateTitle(null);
      await savePlaylistPickerTargets(nextPlaylist);
    } catch (error) {
      console.error('create and save playlist failed:', error);
      showToast('새 폴더 저장에 실패했습니다.');
    }
  };

  const getBulkShareTarget = (selection: MultiSelectedTrack) => {
    if (selection.context === 'workspace') {
      return { group: selection.group, item: selection.item, idx: selection.idx };
    }

    const item = selection.item || {};
    const subIndexRaw = item.sourceSubTrackIndex ?? item.subTrackIndex ?? item.trackIndex;
    const subIndex = Number.isFinite(Number(subIndexRaw)) ? Number(subIndexRaw) : undefined;
    const stableId = String(
      item.shareId ||
      item.playlistUniqueKey ||
      (subIndex !== undefined ? `${item.sourceId || item.trackId || item.id}_${subIndex}` : '') ||
      (item.sourceSubTrackId ? `${item.sourceId || item.trackId || item.id}_${item.sourceSubTrackId}` : '') ||
      item.sourceId ||
      item.trackId ||
      item.id ||
      selection.key
    );
    const fakeItem = {
      ...item,
      id: stableId,
      trackId: item.sourceId || item.trackId || stableId,
      duration: item.duration,
      audio_url: item.audioUrl || item.streamAudioUrl || item.audio_url || selection.audioUrl,
      url: item.audioUrl || item.streamAudioUrl || item.audio_url || selection.audioUrl,
      image_url: item.imageUrl || item.image_url,
      ownerNickname: item.ownerNickname,
      creatorNickname: item.creatorNickname,
      creatorDisplayId: getPlaylistItemCreatorName(item),
      ownerEmail: item.ownerEmail,
      creatorEmail: item.creatorEmail,
      isPlaylistItem: true,
      sourceType: item.sourceType,
      title: formatSunoDisplayTitle(item.title || selection.title),
    };
    return { group: fakeItem, item: fakeItem, idx: undefined };
  };

  const createShareRecordForSelection = async (selection: MultiSelectedTrack) => {
    if (!user) throw new Error('NO_USER');
    const { group, item, idx } = getBulkShareTarget(selection);
    if (!group || !item) throw new Error('NO_TARGET');

    if (!group.isPlaylistItem && group?.id) {
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
      await updateDoc(trackRef, {
        isPublic: true,
        hidden: false,
        shareType: 'public',
        publicSharedAt: serverTimestamp()
      });
    }

    const creatorMeta = resolveCreatorSnapshot(group, item, { fallbackToCurrentUser: !group?.isPlaylistItem });
    const shareId = idx !== undefined ? `${group.id}_${idx}` : String(group.id || selection.key);
    const shareRef = doc(db, 'suno_shares', shareId);
    await setDoc(shareRef, {
      trackId: group.id,
      subTrackIndex: idx ?? null,
      taskId: group.taskId || '',
      title: item?.title || item?.name || group.title || selection.title || 'Untitled',
      audioUrl: item?.audio_url || item?.url || selection.audioUrl || '',
      imageUrl: item?.image_url || item?.imageUrl || group.imageUrl || '',
      duration: item?.duration || group.duration || null,
      status: group.status || 'completed',
      prompt: group.prompt || group?.requestPayload?.prompt || group?.appliedKeywords?.prompt || '',
      style: group.style || group?.appliedKeywords?.style || '',
      lyrics: group.lyrics || group.lyricsText || item?.lyrics || item?.lyricsText || group?.requestPayload?.lyrics || group?.requestPayload?.lyricsText || null,
      lyricsText: group.lyricsText || group.lyrics || item?.lyricsText || item?.lyrics || group?.requestPayload?.lyricsText || group?.requestPayload?.lyrics || null,
      koreanLyrics: group.koreanLyrics || item?.koreanLyrics || group?.requestPayload?.koreanLyrics || null,
      englishLyrics: group.englishLyrics || item?.englishLyrics || group?.requestPayload?.englishLyrics || null,
      requestPayload: group.requestPayload || group.appliedKeywords || item?.appliedKeywords || null,
      sunoData: group.sunoData || null,
      apiResponse: group.apiResponse || null,
      apiStatusResponse: group.apiStatusResponse || null,
      appliedKeywords: group.appliedKeywords || item?.appliedKeywords || {},
      createdAt: group.createdAt || serverTimestamp(),
      ownerUid: user.uid,
      creatorDisplayId: creatorMeta.creatorDisplayId,
      ownerNickname: creatorMeta.ownerNickname,
      creatorNickname: creatorMeta.creatorNickname,
      ownerEmail: creatorMeta.ownerEmail,
      creatorEmail: creatorMeta.creatorEmail,
      isPublic: true
    });

    return getSharePageUrl({ ...group, id: shareId }, undefined);
  };

  const handleBulkChangeColor = async (color: string | null) => {
    if (selectedTrackCount === 0) return;
    try {
      for (const selection of selectedTrackList) {
        if (selection.context === 'workspace') {
          await handleChangeWorkspaceColor(selection.group, selection.idx, color);
        } else {
          await handleChangeColor(selection.item as PlaylistItem, color);
        }
      }
      setActiveColorMenu(null);
      clearMultiSelect();
      showToast(`${selectedTrackCount}곡 색상이 변경되었습니다.`);
    } catch (e) {
      console.error(e);
      showToast('선택한 곡 색상 변경에 실패했습니다.');
    }
  };

  const handleBulkFavorite = async () => {
    const targets = selectedTrackList.filter((selection) => {
      if (selection.context === 'sharedPlaylist') return false;
      if ((selection.item as any)?.sourceType === 'shared_track') return false;
      return true;
    });

    if (targets.length === 0) {
      showToast('공유 플레이리스트 곡은 즐겨찾기를 사용할 수 없습니다.');
      return;
    }

    for (const selection of targets) {
      if (selection.context === 'workspace') {
        await handleToggleWorkspaceFavorite(selection.group, true);
      } else {
        await handleTogglePlaylistItemFavorite(selection.item as PlaylistItem, true);
      }
    }
    setBulkMenuState(null);
    showToast(`${targets.length}곡을 즐겨찾기에 저장했습니다.`);
  };

  const handleBulkDownload = async () => {
    if (selectedTrackList.some(isUnavailableSharedSelection)) {
      showToast('비공개로 전환된 공유곡은 다운로드할 수 없습니다.');
      return;
    }
    const targets = selectedTrackList.filter((selection) => selection.audioUrl);
    if (targets.length === 0) {
      showToast('다운로드할 오디오 URL이 없습니다.');
      return;
    }
    for (const selection of targets) {
      await runDownload(selection.audioUrl, selection.title);
    }
    setBulkMenuState(null);
    showToast(`${targets.length}곡 다운로드를 시작했습니다.`);
  };

  const handleBulkPlaylistSave = async () => {
    if (selectedTrackCount === 0) return;
    if (selectedTrackList.some(isUnavailableSharedSelection)) {
      showToast('비공개로 전환된 공유곡은 플레이리스트에 저장할 수 없습니다.');
      return;
    }

    const targets: PlaylistSaveTarget[] = selectedTrackList.map((selection) => {
      if (selection.context === 'workspace') {
        return { group: selection.group, item: selection.item, audioUrl: selection.audioUrl, idx: selection.idx };
      }
      const { group, item, idx } = getBulkShareTarget(selection);
      return { group, item, audioUrl: selection.audioUrl, idx: idx ?? 0 };
    });

    await openPlaylistSavePicker(targets);
  };

  const buildBulkShareItem = (selection: MultiSelectedTrack) => {
    const { group, item, idx } = getBulkShareTarget(selection);
    const source = item || {};
    const parent = group || {};
    return {
      ...source,
      id: source.id || source.sourceSubTrackId || source.trackId || source.sourceId || `${selection.key}`,
      title: source.title || source.name || parent.title || selection.title || 'Untitled',
      audioUrl: source.audioUrl || source.streamAudioUrl || source.audio_url || source.url || selection.audioUrl || '',
      streamAudioUrl: source.streamAudioUrl || source.audioUrl || source.audio_url || source.url || selection.audioUrl || '',
      audio_url: source.audio_url || source.audioUrl || source.streamAudioUrl || source.url || selection.audioUrl || '',
      imageUrl: source.imageUrl || source.image_url || parent.imageUrl || parent.image_url || '',
      image_url: source.image_url || source.imageUrl || parent.imageUrl || parent.image_url || '',
      duration: source.duration || parent.duration || null,
      lyrics: source.lyrics || source.lyricsText || parent.lyrics || parent.lyricsText || null,
      lyricsText: source.lyricsText || source.lyrics || parent.lyricsText || parent.lyrics || null,
      koreanLyrics: source.koreanLyrics || parent.koreanLyrics || null,
      englishLyrics: source.englishLyrics || parent.englishLyrics || null,
      prompt: source.prompt || parent.prompt || parent?.requestPayload?.prompt || parent?.appliedKeywords?.prompt || '',
      style: source.style || parent.style || parent?.appliedKeywords?.style || '',
      sourceSubTrackIndex: Number.isFinite(Number(source.sourceSubTrackIndex ?? idx)) ? Number(source.sourceSubTrackIndex ?? idx) : idx ?? 0,
      sourceSubTrackId: source.sourceSubTrackId || `${parent.id || source.sourceId || source.trackId || 'track'}_${idx ?? 0}`,
      creatorDisplayId: source.creatorDisplayId || parent.creatorDisplayId || getPlaylistItemCreatorName(source) || null,
      ownerNickname: source.ownerNickname || parent.ownerNickname || null,
      creatorNickname: source.creatorNickname || parent.creatorNickname || null,
      ownerEmail: source.ownerEmail || parent.ownerEmail || null,
      creatorEmail: source.creatorEmail || parent.creatorEmail || null,
      appliedKeywords: source.appliedKeywords || parent.appliedKeywords || null,
      requestPayload: source.requestPayload || parent.requestPayload || null,
    };
  };

  const createBulkSharePage = async (options?: { makePublic?: boolean }) => {
    if (!user) throw new Error('NO_USER');
    if (selectedTrackCount === 0) throw new Error('NO_SELECTION');
    if (selectedTrackList.some(isUnavailableSharedSelection)) throw new Error('PRIVATE_SHARED_TRACK_SELECTED');

    const first = selectedTrackList[0];
    const firstTarget = getBulkShareTarget(first);
    const firstGroup = firstTarget.group || {};
    const firstItem = firstTarget.item || {};
    const creatorMeta = resolveCreatorSnapshot(firstGroup, firstItem, { fallbackToCurrentUser: true });
    const shareId = `bulk_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const shareRef = doc(db, 'suno_shares', shareId);
    const bulkSunoData = selectedTrackList.map(buildBulkShareItem).filter((entry) => entry.audioUrl || entry.streamAudioUrl || entry.audio_url);

    if (options?.makePublic) {
      for (const selection of selectedTrackList) {
        if (selection.context !== 'workspace') continue;
        const target = getBulkShareTarget(selection);
        if (!target.group?.id) continue;
        try {
          const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', target.group.id);
          await updateDoc(trackRef, {
            isPublic: true,
            hidden: false,
            shareType: 'public',
            publicSharedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('bulk source public update skipped:', e);
        }
      }
    }

    await setDoc(shareRef, {
      trackId: shareId,
      shareId,
      shareType: 'bulk',
      isBulkShare: true,
      bulkTrackCount: bulkSunoData.length,
      title: `선택한 ${bulkSunoData.length}곡`,
      status: 'completed',
      sunoData: bulkSunoData,
      prompt: firstGroup.prompt || firstItem.prompt || firstGroup?.requestPayload?.prompt || '',
      style: firstGroup.style || firstItem.style || '',
      lyrics: firstGroup.lyrics || firstItem.lyrics || null,
      lyricsText: firstGroup.lyricsText || firstItem.lyricsText || null,
      requestPayload: firstGroup.requestPayload || firstItem.requestPayload || null,
      appliedKeywords: firstGroup.appliedKeywords || firstItem.appliedKeywords || {},
      createdAt: serverTimestamp(),
      ownerUid: user.uid,
      creatorDisplayId: creatorMeta.creatorDisplayId,
      ownerNickname: creatorMeta.ownerNickname,
      creatorNickname: creatorMeta.creatorNickname,
      ownerEmail: creatorMeta.ownerEmail,
      creatorEmail: creatorMeta.creatorEmail,
      isPublic: true
    });

    return getSharePageUrl({ id: shareId }, undefined);
  };

  const createBulkShareLinks = async () => {
    return [await createBulkSharePage()];
  };

  const canBulkManageSharePrivacy = () => !isSharedView && selectedTrackList.some((selection) => (
    selection.context !== 'sharedPlaylist' && (selection.item as any)?.sourceType !== 'shared_track'
  ));

  const handleBulkAllPublic = async () => {
    if (selectedTrackCount === 0) return;
    if (!canBulkManageSharePrivacy()) {
      showToast('공유 플레이리스트에서는 공개 전환을 사용할 수 없습니다.');
      return;
    }

    try {
      await createBulkSharePage({ makePublic: true });
      setBulkShareModalOpen(false);
      setBulkMenuState(null);
      showToast(`선택한 ${selectedTrackCount}곡을 All 공개 상태로 설정했습니다.`);
    } catch (e) {
      console.error(e);
      showToast('선택한 곡 공개 처리에 실패했습니다.');
    }
  };

  const handleBulkAllLinkShare = async () => {
    if (selectedTrackCount === 0) return;

    try {
      const shareUrl = await createBulkSharePage();
      const title = `SORIDRAW 선택한 ${selectedTrackCount}곡`;
      const text = `SORIDRAW에서 선택한 ${selectedTrackCount}곡을 한 페이지로 공유합니다.`;

      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text,
            url: shareUrl,
          });
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          await navigator.clipboard.writeText(`${title}\n${shareUrl}`);
          showToast('공유 링크가 복사되었습니다.');
        }
      } else {
        await navigator.clipboard.writeText(`${title}\n${shareUrl}`);
        showToast('공유 링크가 복사되었습니다.');
      }

      setBulkShareModalOpen(false);
      setBulkMenuState(null);
    } catch (e) {
      console.error(e);
      showToast('선택한 곡 링크 공유에 실패했습니다.');
    }
  };

  const handleBulkPrivateShare = async () => {
    if (!user || selectedTrackCount === 0) return;
    if (!canBulkManageSharePrivacy()) {
      showToast('공유 플레이리스트에서는 비공개 전환을 사용할 수 없습니다.');
      return;
    }

    let changed = 0;
    for (const selection of selectedTrackList) {
      try {
        if (selection.context === 'workspace' && selection.group?.id) {
          await updateDoc(doc(db, 'suno_tracks', user.uid, 'tracks', selection.group.id), {
            isPublic: false,
            shareType: 'private',
            privateUpdatedAt: serverTimestamp()
          });
          await closeShareDocumentsForTarget(selection.group, selection.item, selection.idx);
          changed += 1;
        } else if ((selection.item as any)?.sourceType !== 'shared_track') {
          const sourceId = String((selection.item as any)?.sourceId || (selection.item as any)?.trackId || '').trim();
          const ownerUid = String((selection.item as any)?.ownerUid || user.uid).trim();
          if (sourceId) {
            await updateDoc(doc(db, 'suno_tracks', ownerUid, 'tracks', sourceId), {
              isPublic: false,
              shareType: 'private',
              privateUpdatedAt: serverTimestamp()
            });
            await closeShareDocumentsForTarget(selection.group || selection.item, selection.item, selection.idx);
            changed += 1;
          }
        }
      } catch (e) {
        console.error('bulk private share failed:', e);
      }
    }
    setBulkShareModalOpen(false);
    setBulkMenuState(null);
    showToast(changed > 0 ? `${changed}곡을 비공개로 전환했습니다.` : '비공개로 전환할 수 있는 원곡이 없습니다.');
  };

  const handleBulkMoveToPlaylist = async (targetPlaylistId: string) => {
    if (!user || !activePlaylistId || !targetPlaylistId) return;
    if (selectedTrackList.some(isUnavailableSharedSelection)) {
      showToast('비공개로 전환된 공유곡은 폴더 이동할 수 없습니다.');
      return;
    }
    const targets = selectedTrackList.filter((selection) => selection.context !== 'workspace' && (selection.item as any)?.id);
    if (targets.length === 0) {
      showToast('이동할 플레이리스트 곡이 없습니다.');
      return;
    }

    const fromPlaylistId = activePlaylistId;
    const targetItems = targets.map((selection) => selection.item as PlaylistItem);

    // 폴더 선택창만 닫고 선택모드는 유지한다.
    // 모바일에서 선택 액션바/모달이 동시에 사라지면 폴더 목록이 튕겨 보일 수 있다.
    setBulkMoveModalOpen(false);
    setBulkMenuState(null);

    let moved = 0;
    for (const item of targetItems) {
      try {
        await movePlaylistItem(user.uid, fromPlaylistId, targetPlaylistId, item);
        moved += 1;
      } catch (e: any) {
        if (e?.message !== 'DUPLICATE') console.error('bulk move failed:', e);
      }
    }

    if (moved > 0) {
      clearMultiSelect();
    }
    showToast(moved > 0 ? `${moved}곡을 폴더 이동했습니다.` : '이미 대상 폴더에 있는 곡입니다.');
  };

  const handleBulkRestoreSelectedFromTrash = async () => {
    if (!user || selectedTrackCount === 0) return;
    setLibrarySelectionMoreOpen(false);
    setBulkMenuState(null);

    try {
      const workspaceGroups = new Map<string, { group: any; indices: Set<number> }>();
      for (const selection of selectedTrackList) {
        if (selection.context !== 'workspace') continue;
        const groupId = selection.group?.id;
        if (!groupId) continue;
        if (!workspaceGroups.has(groupId)) workspaceGroups.set(groupId, { group: selection.group, indices: new Set<number>() });
        workspaceGroups.get(groupId)!.indices.add(selection.idx);
      }

      for (const [groupId, payload] of workspaceGroups.entries()) {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', groupId);
        const items = extractSunoData(payload.group);
        if (items.length > 0) {
          const nextSunoData = items.map((entry: any, entryIndex: number) => payload.indices.has(entryIndex) ? { ...entry, hidden: false } : entry);
          await updateDoc(trackRef, { sunoData: nextSunoData, hidden: false, deletedAt: null });
        } else {
          await updateDoc(trackRef, { hidden: false, deletedAt: null });
        }
      }

      clearMultiSelect();
      showToast('선택한 곡을 복구했습니다.');
    } catch (e) {
      console.error('bulk restore failed:', e);
      showToast('선택한 곡 복구에 실패했습니다.');
    }
  };

  const handleBulkPermanentDeleteSelectedFromTrash = async () => {
    if (!user || selectedTrackCount === 0) return;
    setLibrarySelectionMoreOpen(false);
    setBulkMenuState(null);

    try {
      const { deleteDoc } = await import('firebase/firestore');
      const workspaceGroups = new Map<string, { group: any; indices: Set<number> }>();
      for (const selection of selectedTrackList) {
        if (selection.context !== 'workspace') continue;
        const groupId = selection.group?.id;
        if (!groupId) continue;
        if (!workspaceGroups.has(groupId)) workspaceGroups.set(groupId, { group: selection.group, indices: new Set<number>() });
        workspaceGroups.get(groupId)!.indices.add(selection.idx);
      }

      for (const [groupId, payload] of workspaceGroups.entries()) {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', groupId);
        const items = extractSunoData(payload.group);
        if (items.length > 0) {
          const nextSunoData = items.filter((_: any, entryIndex: number) => !payload.indices.has(entryIndex));
          if (nextSunoData.length === 0) {
            await deleteDoc(trackRef);
            removeWorkspaceTracksLocally([groupId]);
          } else {
            await updateDoc(trackRef, { sunoData: nextSunoData });
          }
        } else {
          await deleteDoc(trackRef);
          removeWorkspaceTracksLocally([groupId]);
        }
      }

      clearMultiSelect();
      showToast('선택한 곡을 영구 삭제했습니다.');
    } catch (e) {
      console.error('bulk permanent delete failed:', e);
      showToast('선택한 곡 영구 삭제에 실패했습니다.');
    }
  };

  const handleBulkDeleteSelected = () => {
    if (!user || selectedTrackCount === 0) return;

    const hasWorkspace = selectedTrackList.some((selection) => selection.context === 'workspace');
    const title = hasWorkspace ? '선택한 곡을 휴지통으로 이동' : '선택한 곡을 리스트에서 삭제';
    const message = hasWorkspace
      ? '선택한 뮤직 스페이스 곡을 휴지통으로 이동할까요?'
      : '선택한 곡을 현재 플레이리스트에서 삭제할까요? 원곡은 삭제되지 않습니다.';

    setBulkMenuState(null);
    setPlaylistConfirmAction({
      title,
      message,
      confirmLabel: '삭제',
      danger: true,
      onConfirm: async () => {
        try {
          const workspaceGroups = new Map<string, { group: any; indices: Set<number> }>();
          for (const selection of selectedTrackList) {
            if (selection.context === 'workspace') {
              const groupId = selection.group?.id;
              if (!groupId) continue;
              if (!workspaceGroups.has(groupId)) workspaceGroups.set(groupId, { group: selection.group, indices: new Set<number>() });
              workspaceGroups.get(groupId)!.indices.add(selection.idx);
            } else if ((selection.item as any)?.id && activePlaylistId) {
              await deletePlaylistItem(user.uid, activePlaylistId, (selection.item as any).id);
            }
          }

          for (const [groupId, payload] of workspaceGroups.entries()) {
            const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', groupId);
            const items = extractSunoData(payload.group);
            if (items.length > 0) {
              const nextSunoData = items.map((entry: any, entryIndex: number) => payload.indices.has(entryIndex) ? { ...entry, hidden: true } : entry);
              const allHidden = nextSunoData.length > 0 && nextSunoData.every((entry: any) => entry.hidden === true);
              const updatePayload: any = { sunoData: nextSunoData };
              if (allHidden) {
                updatePayload.hidden = true;
                updatePayload.isPublic = false;
                updatePayload.deletedAt = serverTimestamp();
              }
              await updateDoc(trackRef, updatePayload);
            } else {
              await updateDoc(trackRef, { hidden: true, isPublic: false, deletedAt: serverTimestamp() });
            }
          }

          clearMultiSelect();
          showToast('선택한 곡을 삭제했습니다.');
        } catch (e) {
          console.error('bulk delete failed:', e);
          showToast('선택한 곡 삭제에 실패했습니다.');
        }
      }
    });
  };

  const handleLibrarySelectionMove = async () => {
    if (selectedTrackCount === 0) return;
    setLibrarySelectionMoreOpen(false);
    setBulkMenuState(null);

    if (libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') {
      if (hasUnavailableSharedSelection) {
        showToast('비공개로 전환된 공유곡은 폴더 이동할 수 없습니다.');
        return;
      }
      setBulkMoveModalOpen(true);
      return;
    }

    await handleBulkPlaylistSave();
  };

  const handleLibrarySelectionLock = () => {
    setLibrarySelectionMoreOpen(false);
    clearMultiSelect();
    showToast('라이브러리 잠금 기능은 다음 단계에서 연결합니다.');
  };

  const handleDeleteClick = (groupId: string, itemIndex: number, group: any, action: 'hide' | 'restore' | 'permanentDelete') => {
    setDeleteTarget({ groupId, itemIndex, group, action });
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { doc, updateDoc, serverTimestamp, deleteDoc } = await import('firebase/firestore');
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', deleteTarget.groupId);

      const items = extractSunoData(deleteTarget.group);
      let newSunoData = [...items];
      let deletedTrackDocument = false;

      if (items.length > 0 && !(!deleteTarget.group.sunoData?.length && newSunoData.length === 1 && !newSunoData[0].audioUrl && !newSunoData[0].streamAudioUrl)) {
        // Normal case: treat extracted items as the root sunoData array.
        if (deleteTarget.action === 'hide') {
            newSunoData[deleteTarget.itemIndex] = { ...newSunoData[deleteTarget.itemIndex], hidden: true };
        } else if (deleteTarget.action === 'restore') {
            newSunoData[deleteTarget.itemIndex] = { ...newSunoData[deleteTarget.itemIndex], hidden: false };
        } else if (deleteTarget.action === 'permanentDelete') {
            newSunoData.splice(deleteTarget.itemIndex, 1);
        }

        if (deleteTarget.action === 'permanentDelete' && newSunoData.length === 0) {
            await deleteDoc(trackRef);
            deletedTrackDocument = true;
        } else {
            const allHidden = newSunoData.length > 0 && newSunoData.every(i => i.hidden === true);
            const updatePayload: any = { sunoData: newSunoData };
            if (allHidden) {
              updatePayload.hidden = true;
              updatePayload.isPublic = false;
              updatePayload.deletedAt = serverTimestamp();
            } else if (deleteTarget.action === 'restore') {
              updatePayload.hidden = false;
            }
            await updateDoc(trackRef, updatePayload);
        }
      } else {
        // Fallback case: just update document hidden field.
        if (deleteTarget.action === 'hide') {
            await updateDoc(trackRef, { hidden: true, isPublic: false, deletedAt: serverTimestamp() });
        } else if (deleteTarget.action === 'restore') {
            await updateDoc(trackRef, { hidden: false });
        } else if (deleteTarget.action === 'permanentDelete') {
            await deleteDoc(trackRef);
            deletedTrackDocument = true;
        }
      }

      if (deletedTrackDocument) {
        removeWorkspaceTracksLocally([deleteTarget.groupId]);
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      setDeleteError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isModalOpen = !!sharePopupInfo || !!showDetails || !!deleteTarget || !!renameModalArgs || !!moveModalArgs || !!playlistSavePicker || !!bulkShareModalOpen || !!bulkMoveModalOpen;

  const closeModal = () => {
    modalHistoryPushedRef.current = false;
    setSharePopupInfo(null);
    setShowDetails(null);
    setDeleteTarget(null);
    setRenameModalArgs(null);
    setMoveModalArgs(null);
    setBulkShareModalOpen(false);
    setBulkMoveModalOpen(false);
  };

  useEffect(() => {
    if (!isModalOpen) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    if (!modalHistoryPushedRef.current) {
      window.history.pushState({ soridrawModal: true }, '', window.location.href);
      modalHistoryPushedRef.current = true;
    }

    const handlePopState = () => {
      closeModal();
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isModalOpen]);

  const normalizeDetailText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value
        .map((v) => normalizeDetailText(v))
        .filter(Boolean)
        .join(', ');
    }
    return '';
  };

  const firstMeaningfulText = (...values: any[]): string => {
    for (const value of values) {
      const text = normalizeDetailText(value);
      if (text) return text;
    }
    return '';
  };

  const extractActualLyricsForDetails = (item: any, applied: any = {}, requestPayload: any = {}): string => {
    const directLyrics = firstMeaningfulText(
      item?.lyrics,
      item?.lyricsText,
      item?.koreanLyrics,
      item?.englishLyrics,
      item?.lyrics?.korean,
      item?.lyrics?.english,
      requestPayload?.lyrics,
      requestPayload?.lyricsText,
      applied?.lyrics,
      applied?.lyricsText,
      applied?.koreanLyrics,
      applied?.englishLyrics,
      applied?.generatedLyrics,
      applied?.generatedLyricsText
    );

    return directLyrics || '가사 정보 없음';
  };

  const extractKeywordStyleTextForDetails = (item: any, applied: any = {}, requestPayload: any = {}): string => {
    const parts: string[] = [];
    const push = (value: any) => {
      const text = normalizeDetailText(value);
      if (text) parts.push(text);
    };

    push(item?.style);
    if (parts.length === 0) {
      push(item?.genreLabels);
      push(applied?.genre);
      push(applied?.selectedGenres);
      push(applied?.subGenre);
      push(applied?.selectedSubGenres);
      push(applied?.style);
      push(applied?.selectedStyles);
      push(applied?.sound);
      push(applied?.selectedSounds);
      push(applied?.mood);
      push(applied?.selectedMoods);
      push(applied?.theme);
      push(applied?.selectedThemes);
      push(applied?.situationSummary);
      push(applied?.situation?.summary);
      push(applied?.situation?.description);
      push(applied?.tempo);
      push(applied?.bpm);
      
      push(requestPayload?.genre);
      push(requestPayload?.subGenre);
      push(requestPayload?.style);
      push(requestPayload?.sound);
      push(requestPayload?.mood);
      push(requestPayload?.theme);
      push(requestPayload?.situationSummary);
      push(requestPayload?.situation?.summary);
      push(requestPayload?.situation?.description);
      push(requestPayload?.tempo);
    }

    const unique = Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)));
    return unique.length > 0 ? unique.join(' / ') : '없음';
  };

  const getPlaylistItemCreatorName = (item: any): string => {
    const normalizeCreatorValue = (value: any) => {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text) return '';
      // Older shared playlist items sometimes stored Firebase UID in display fields.
      // Do not show UID-like values before trying nickname/email fallbacks.
      if (item?.ownerUid && text === item.ownerUid) return '';
      if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) return '';
      return text;
    };

    return (
      normalizeCreatorValue(item?.ownerNickname) ||
      normalizeCreatorValue(item?.creatorNickname) ||
      normalizeCreatorValue(item?.creatorDisplayId) ||
      (item?.sourceId ? shareCreatorNameMap[item.sourceId] : '') ||
      (item?.ownerUid ? userNameMap[item.ownerUid] : '') ||
      normalizeCreatorValue(item?.ownerEmail) ||
      normalizeCreatorValue(item?.creatorEmail) ||
      item?.ownerUid ||
      'Unknown'
    );
  };

  const formatPlaylistDuration = (duration: any): string => {
    const numeric = typeof duration === 'number' ? duration : Number(duration);
    if (!Number.isFinite(numeric) || numeric <= 0) return '--:--';
    const totalSeconds = Math.round(numeric);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const buildPlaylistItemDetails = (item: PlaylistItem) => {
    const applied = (item as any).appliedKeywords || {};
    const reqPayload = item.requestPayload || {};

    return {
      title: formatSunoDisplayTitle(item.title || 'Untitled'),
      status: item.sourceType === 'shared_track' ? '공유받은 곡' : '일반곡',
      createdAt: item.addedAt,
      taskId: item.sourceId,
      style: extractKeywordStyleTextForDetails(item, applied, reqPayload),
      situation: applied?.situationSummary || reqPayload?.situationSummary || applied?.situation?.summary || reqPayload?.situation?.summary || '',
      prompt: normalizeDetailText(item.prompt || applied?.prompt || applied?.detailLayer || reqPayload?.prompt) || '',
      lyrics: extractActualLyricsForDetails(item, applied, reqPayload),
      audioUrl: item.audioUrl || '',
      streamAudioUrl: item.audioUrl || '',
      requestPayload: reqPayload || applied,
      creatorDisplayId: getPlaylistItemCreatorName(item),
      sourceItem: item,
      item,
    };
  };

  const handleShowPlaylistItemDetails = async (item: PlaylistItem) => {
    let details = buildPlaylistItemDetails(item);
    
    // Fallback: If prompt and lyrics are missing, try fetching from the source
    if (
      (!details.prompt || details.prompt === '없음') && 
      (!details.lyrics || details.lyrics === '가사 정보 없음')
    ) {
      try {
        if (item.sourceType === 'shared_track') {
          const shareDoc = await getDoc(doc(db, 'suno_shares', item.sourceId));
          if (shareDoc.exists()) {
            const data = shareDoc.data();
            const enrichedItem = { ...item, ...data };
            details = buildPlaylistItemDetails(enrichedItem as PlaylistItem);
          }
        } else if (item.sourceType === 'suno_track' && item.ownerUid) {
          const trackDoc = await getDoc(doc(db, 'suno_tracks', item.ownerUid, 'tracks', item.sourceId));
          if (trackDoc.exists()) {
            const data = trackDoc.data();
            const enrichedItem = { ...item, ...data };
            details = buildPlaylistItemDetails(enrichedItem as PlaylistItem);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch fallback details:', error);
      }
    }

    setShowDetails(details);
  };

  useEffect(() => {
    const handleGlobalPlayerAction = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      const detail = customEvent.detail || {};
      const action = detail.action as 'details' | 'applyNext' | 'saveOrMove' | 'delete' | 'favorite' | undefined;
      const track = detail.track || null;
      if (!action || !track) return;

      detail.handled = true;

      const parent = track.parent || {};
      const itemIndex = Number.isInteger(track.index) ? track.index : 0;
      const isPlaylistTrack = Boolean(parent.__playlistContext || track.trackId || parent.sourceType);
      const workspaceItem = !isPlaylistTrack ? (extractSunoData(parent)[itemIndex] || {}) : null;

      if (action === 'details') {
        if (isPlaylistTrack) {
          handleShowPlaylistItemDetails(parent as PlaylistItem);
        } else {
          setShowDetails({
            ...parent,
            itemIndex,
            title: track.title || parent.title || 'Untitled',
            status: parent.status || 'completed',
            audioUrl: track.url || workspaceItem?.audioUrl || workspaceItem?.streamAudioUrl || parent.audioUrl || parent.streamAudioUrl || '',
            streamAudioUrl: track.url || workspaceItem?.streamAudioUrl || workspaceItem?.audioUrl || parent.streamAudioUrl || parent.audioUrl || '',
            lyrics: track.lyrics || workspaceItem?.lyrics || workspaceItem?.lyricsText || parent.lyrics || parent.lyricsText || '',
            style: parent.style || workspaceItem?.style || parent.prompt || '',
            prompt: parent.prompt || workspaceItem?.prompt || '',
            ...resolveCreatorSnapshot(parent, workspaceItem || parent, { fallbackToCurrentUser: true }),
            creatorDisplayId: resolveCreatorSnapshot(parent, workspaceItem || parent, { fallbackToCurrentUser: true }).creatorDisplayId || parent.creatorDisplayId || parent.ownerNickname || parent.creatorNickname || parent.ownerEmail || parent.creatorEmail || ''
          });
        }
        return;
      }

      if (action === 'applyNext') {
        if (isPlaylistTrack) {
          handleApplyNext(parent, parent);
        } else {
          handleApplyNext(parent, workspaceItem || parent);
        }
        return;
      }

      if (action === 'saveOrMove') {
        if (isPlaylistTrack) {
          handleMoveToOtherPlaylist(parent as PlaylistItem);
        } else {
          void openPlaylistSavePicker([{ group: parent, item: workspaceItem || parent, audioUrl: track.url || '', idx: itemIndex }]);
        }
        return;
      }

      if (action === 'favorite') {
        if (isPlaylistTrack) {
          if ((parent as any).sourceType === 'shared_track' || (parent as any).__libraryViewMode === 'sharedPlaylist') {
            showToast('공유 플레이리스트 곡은 즐겨찾기를 사용할 수 없습니다.');
            return;
          }
          handleTogglePlaylistItemFavorite(parent as PlaylistItem);
        } else {
          handleToggleWorkspaceFavorite(parent);
        }
        return;
      }

      if (action === 'delete') {
        if (isPlaylistTrack) {
          handleRemoveFromPlaylist(parent as PlaylistItem);
        } else if (parent?.id) {
          handleDeleteClick(parent.id, itemIndex, parent, 'hide');
        } else {
          showToast('삭제할 곡 정보를 찾을 수 없습니다.');
        }
      }
    };

    window.addEventListener('soridraw:global-player-action', handleGlobalPlayerAction as EventListener);
    return () => window.removeEventListener('soridraw:global-player-action', handleGlobalPlayerAction as EventListener);
  }, [playlistItems, tracks, activePlaylistId, libraryViewMode, user, isSharedView]);


  const renderLibraryTopControls = () => {
    if (isSharedView) return null;
    const isWorkspaceMode = libraryViewMode === 'workspace';

    return (
      <>
        <div className="-mt-[12px] md:mt-0 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => navigate('/studio')}
              className="h-[46px] w-[46px] shrink-0 flex items-center justify-center rounded-2xl border border-black/20 bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[#FFBB22] hover:bg-white/5 shadow-btn transition-all"
            >
              <Zap className="w-4 h-4" />
            </button>
            <div className="relative flex-1 min-w-0 group overflow-hidden">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[#7FBD75] transition-colors" />
              <input
                type="text"
                value={isWorkspaceMode ? searchTerm : playlistSearchTerm}
                onChange={(e) => {
                  if (isWorkspaceMode) setSearchTerm(e.target.value);
                  else setPlaylistSearchTerm(e.target.value);
                }}
                onFocus={() => setIsLibrarySearchFocused(true)}
                onBlur={() => setIsLibrarySearchFocused(false)}
                className="w-full h-[46px] pl-12 pr-4 rounded-2xl bg-white/[0.145] border border-white/[0.14] outline-none focus:bg-white/[0.17] focus:border-[#7FBD75]/45 transition-all text-sm text-[var(--text-primary)]"
              />
              {!(isWorkspaceMode ? searchTerm : playlistSearchTerm) && !isLibrarySearchFocused && (
                <div className="absolute inset-0 flex items-center pl-12 pr-4 pointer-events-none overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${isWorkspaceMode ? 'workspace' : 'playlist'}-${libraryPlaceholderIndex}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35 }}
                      className="text-sm text-white/40 whitespace-nowrap"
                    >
                      {(isWorkspaceMode ? librarySearchPlaceholders : playlistSearchPlaceholders)[libraryPlaceholderIndex % (isWorkspaceMode ? librarySearchPlaceholders.length : playlistSearchPlaceholders.length)]}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {isWorkspaceMode ? (
            <>
              <div className="flex h-[46px] items-center gap-1.5 bg-[var(--bg-secondary)] border border-black/20 p-1 rounded-2xl shrink-0 overflow-x-auto hide-scrollbar">
                <button
                  onClick={() => setWorkspaceColorFilter('all')}
                  className={`h-9 text-xs font-bold px-4 transition-all rounded-xl ${workspaceColorFilter === 'all' ? 'text-[#C7F7BD] bg-[#7FBD75]/24' : 'text-white/40 hover:text-white/70'}`}
                >
                  전체
                </button>
                <div className="w-px h-3 bg-white/10 mx-1"></div>
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setWorkspaceColorFilter(opt.value)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      workspaceColorFilter === opt.value ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-110 brightness-75 hover:brightness-100'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color }}></div>
                  </button>
                ))}
              </div>
              <div className="flex h-[46px] items-center bg-[var(--bg-secondary)] border border-black/20 p-1 rounded-2xl shrink-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
                {(['all', 'completed', 'favorite', 'public', 'private', 'trash'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`h-9 shrink-0 whitespace-nowrap px-3.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                      filter === f ? 'bg-[#7FBD75]/78 text-white' : 'bg-transparent text-white/50 hover:text-white/75'
                    }`}
                  >
                    {f === 'all' ? '전체' : f === 'completed' ? '완료' : f === 'favorite' ? '즐겨찾기' : f === 'public' ? '공개' : f === 'private' ? '비공개' : '휴지통'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex h-[46px] items-center gap-1 bg-[var(--bg-secondary)] rounded-2xl p-1 px-2 border border-black/15 shrink-0 overflow-x-auto hide-scrollbar">
                <button
                  onClick={() => setPlaylistColorFilter('all')}
                  className={`h-9 text-xs font-bold px-4 transition-all rounded-xl ${playlistColorFilter === 'all' ? 'text-[#C7F7BD] bg-[#7FBD75]/24' : 'text-white/40 hover:text-white/70'}`}
                >
                  전체
                </button>
                <div className="w-px h-3 bg-white/10 mx-1"></div>
                {[
                  { value: 'gray', color: '#6b7280' },
                  { value: 'red', color: '#ef4444' },
                  { value: 'orange', color: '#f97316' },
                  { value: 'yellow', color: '#eab308' },
                  { value: 'green', color: '#22c55e' },
                  { value: 'blue', color: '#3b82f6' },
                  { value: 'purple', color: '#a855f7' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPlaylistColorFilter(opt.value)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      playlistColorFilter === opt.value ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-110 brightness-75 hover:brightness-100'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color }}></div>
                  </button>
                ))}
              </div>
              <div className="flex h-[46px] items-center gap-1 bg-[var(--bg-secondary)] rounded-2xl p-1 border border-black/15 shrink-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
                {[
                  { value: 'added', label: '저장순' },
                  { value: 'genre', label: '장르순' },
                  { value: 'custom', label: '사용자' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPlaylistSortMode(opt.value as any)}
                    className={`h-9 shrink-0 whitespace-nowrap px-3.5 sm:px-4 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                      playlistSortMode === opt.value
                        ? 'bg-[#7FBD75]/24 text-[#C7F7BD]'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-white/10 mx-1" />
                {[
                  { value: 'all', label: '전체' },
                  { value: 'public', label: '공개' },
                  { value: 'private', label: '비공개' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPlaylistVisibilityFilter(opt.value as any)}
                    className={`h-9 shrink-0 whitespace-nowrap px-3.5 sm:px-4 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                      playlistVisibilityFilter === opt.value
                        ? 'bg-[#7FBD75]/24 text-[#C7F7BD]'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </>
    );
  };

  const renderLibraryModeTabs = () => {
    if (isSharedView) return null;
    return (
      <div className="flex items-center gap-2 max-w-full whitespace-nowrap">
        <div className="grid grid-cols-3 gap-0 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-black/20 w-full max-w-[520px] md:w-fit md:max-w-none">
          <button
            onClick={() => setLibraryViewMode('workspace')}
            className={`min-w-0 whitespace-nowrap px-2 md:px-5 py-2.5 rounded-xl font-bold text-[11px] sm:text-xs md:text-sm truncate ${libraryViewMode === 'workspace' ? 'bg-[#7FBD75]/78 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
          >
            뮤직 스페이스
          </button>
          <button
            onClick={() => {
              if (libraryViewMode !== 'playlist') {
                setLibraryViewMode('playlist');
                setActivePlaylistSection('normal');
                if (visibleNormalPlaylists.length > 0 && !selectedNormalPlaylistId) {
                  setSelectedNormalPlaylistId(visibleNormalPlaylists[0].id!);
                }
              }
            }}
            className={`min-w-0 whitespace-nowrap px-2 md:px-5 py-2.5 rounded-xl font-bold text-[11px] sm:text-xs md:text-sm truncate ${libraryViewMode === 'playlist' ? 'bg-[#7FBD75]/78 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
          >
            플레이리스트
          </button>
          <button
            onClick={() => {
              if (libraryViewMode !== 'sharedPlaylist') {
                setLibraryViewMode('sharedPlaylist');
                setActivePlaylistSection('shared');
                if (visibleSharedPlaylists.length > 0 && !selectedSharedPlaylistId) {
                  setSelectedSharedPlaylistId(visibleSharedPlaylists[0].id!);
                }
              }
            }}
            className={`min-w-0 whitespace-nowrap px-2 md:px-5 py-2.5 rounded-xl font-bold text-[11px] sm:text-xs md:text-sm truncate ${libraryViewMode === 'sharedPlaylist' ? 'bg-[#7FBD75]/78 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
          >
            공유 플레이리스트
          </button>
        </div>
      </div>
    );
  };

  const PLAYLIST_REORDER_LONG_PRESS_MS = 700;
  const PLAYLIST_REORDER_RIGHT_TRIGGER_RATIO = 0.62;
  const PLAYLIST_REORDER_LEFT_TRIGGER_RATIO = 0.42;

  const getPlaylistDragKey = (section: 'normal' | 'shared', playlistId: string) => `${section}:${playlistId}`;

  const getPlaylistsBySectionForDrag = (section: 'normal' | 'shared') => (
    playlistsRef.current
      .filter((playlist) => playlist.type === section)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  );

  const autoScrollPlaylistBar = (section: 'normal' | 'shared', clientX: number) => {
    const container = playlistBarRefs.current[section];
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeSize = Math.min(72, Math.max(46, rect.width * 0.18));
    let delta = 0;

    if (clientX < rect.left + edgeSize) {
      const strength = Math.min(1, Math.max(0, (rect.left + edgeSize - clientX) / edgeSize));
      delta = -(0.25 + strength * 0.55);
    } else if (clientX > rect.right - edgeSize) {
      const strength = Math.min(1, Math.max(0, (clientX - (rect.right - edgeSize)) / edgeSize));
      delta = 0.25 + strength * 0.55;
    }

    if (delta !== 0) {
      container.scrollLeft += delta;
    }
  };

  const reorderPlaylistsByPointer = (section: 'normal' | 'shared', playlistId: string, clientX: number) => {
    const currentSectionList = getPlaylistsBySectionForDrag(section);
    const draggedPlaylist = currentSectionList.find((playlist) => playlist.id === playlistId);
    if (!draggedPlaylist || (draggedPlaylist as any).isFallback) return;

    const defaultPlaylist = currentSectionList[0];
    if (!defaultPlaylist || defaultPlaylist.id === playlistId) return;

    const movablePlaylists = currentSectionList.slice(1);
    const currentIndex = movablePlaylists.findIndex((playlist) => playlist.id === playlistId);
    if (currentIndex < 0) return;

    const centers = movablePlaylists
      .map((playlist, index) => {
        const key = getPlaylistDragKey(section, playlist.id!);
        const element = playlistButtonRefs.current[key];
        const rect = element?.getBoundingClientRect();
        return rect ? { id: playlist.id!, index, center: rect.left + rect.width / 2 } : null;
      })
      .filter(Boolean) as Array<{ id: string; index: number; center: number }>;

    if (centers.length <= 1) return;

    const currentCenter = centers.find((item) => item.id === playlistId)?.center;
    if (!Number.isFinite(currentCenter)) return;

    let targetIndex = currentIndex;
    const nextCenter = centers[currentIndex + 1]?.center;
    const previousCenter = centers[currentIndex - 1]?.center;

    if (nextCenter !== undefined && clientX > currentCenter! + (nextCenter - currentCenter!) * PLAYLIST_REORDER_RIGHT_TRIGGER_RATIO) {
      targetIndex = currentIndex + 1;
    } else if (previousCenter !== undefined && clientX < currentCenter! - (currentCenter! - previousCenter) * PLAYLIST_REORDER_LEFT_TRIGGER_RATIO) {
      targetIndex = currentIndex - 1;
    }

    if (targetIndex === currentIndex) return;

    const nextMovable = [...movablePlaylists];
    const [moving] = nextMovable.splice(currentIndex, 1);
    nextMovable.splice(targetIndex, 0, moving);

    const nextSectionList = [defaultPlaylist, ...nextMovable].map((playlist, index) => ({
      ...playlist,
      order: index + 1,
    }));
    const nextById = new Map(nextSectionList.map((playlist) => [playlist.id, playlist]));
    const nextPlaylists = playlistsRef.current.map((playlist) => nextById.get(playlist.id) || playlist);
    playlistsRef.current = nextPlaylists;
    setPlaylists(nextPlaylists);
  };

  const persistPlaylistOrder = async (section: 'normal' | 'shared') => {
    if (!user?.uid) return;
    const sectionList = getPlaylistsBySectionForDrag(section).map((playlist, index) => ({ ...playlist, order: index + 1 }));
    await Promise.all(
      sectionList
        .filter((playlist) => playlist.id && !(playlist as any).isFallback)
        .map((playlist) => updateDoc(doc(db, 'user_playlists', user.uid, 'lists', playlist.id!), { order: playlist.order }))
    );
  };

  const handlePlaylistPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    section: 'normal' | 'shared',
    playlist: Playlist,
  ) => {
    const sectionList = section === 'normal' ? visibleNormalPlaylists : visibleSharedPlaylists;
    const isDefaultPlaylist = playlist.id === sectionList[0]?.id;
    if (isDefaultPlaylist || (playlist as any).isFallback || !playlist.id) return;
    if (event.button !== undefined && event.button !== 0) return;

    if (playlistPressTimerRef.current) window.clearTimeout(playlistPressTimerRef.current);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    playlistDragRef.current = { section, playlistId: playlist.id, pointerId, startX, startY, active: false, target };

    playlistPressTimerRef.current = window.setTimeout(() => {
      const drag = playlistDragRef.current;
      if (!drag || drag.pointerId !== pointerId || drag.playlistId !== playlist.id || drag.section !== section) return;
      drag.active = true;
      setPlaylistDragging({ section, playlistId: playlist.id! });
      document.body.classList.add('soridraw-folder-dragging');
      const handleWindowPointerMove = (nativeEvent: PointerEvent) => {
        const currentDrag = playlistDragRef.current;
        if (!currentDrag?.active || currentDrag.pointerId !== pointerId) return;
        if (nativeEvent.pointerType === 'touch') return;
        nativeEvent.preventDefault();
        autoScrollPlaylistBar(currentDrag.section, nativeEvent.clientX);
        reorderPlaylistsByPointer(currentDrag.section, currentDrag.playlistId, nativeEvent.clientX);
      };
      const handleWindowTouchMove = (nativeEvent: TouchEvent) => {
        const currentDrag = playlistDragRef.current;
        if (!currentDrag?.active || currentDrag.pointerId !== pointerId) return;
        const touch = nativeEvent.touches?.[0];
        if (!touch) return;
        nativeEvent.preventDefault();
        autoScrollPlaylistBar(currentDrag.section, touch.clientX);
        reorderPlaylistsByPointer(currentDrag.section, currentDrag.playlistId, touch.clientX);
      };
      const handleWindowPointerEnd = (nativeEvent: PointerEvent) => {
        const currentDrag = playlistDragRef.current;
        if (!currentDrag || currentDrag.pointerId !== pointerId) return;
        void finishPlaylistDrag();
      };
      const handleWindowTouchEnd = () => {
        const currentDrag = playlistDragRef.current;
        if (!currentDrag || currentDrag.pointerId !== pointerId) return;
        void finishPlaylistDrag();
      };
      drag.windowMoveHandler = handleWindowPointerMove;
      drag.windowEndHandler = handleWindowPointerEnd;
      drag.windowTouchMoveHandler = handleWindowTouchMove;
      drag.windowTouchEndHandler = handleWindowTouchEnd;
      window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
      window.addEventListener('pointerup', handleWindowPointerEnd, { passive: false });
      window.addEventListener('pointercancel', handleWindowPointerEnd, { passive: false });
      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
      window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
      window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // Ignore capture failures.
      }
    }, PLAYLIST_REORDER_LONG_PRESS_MS);
  };

  const handlePlaylistPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = playlistDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active && moved > 10) {
      if (playlistPressTimerRef.current) window.clearTimeout(playlistPressTimerRef.current);
      playlistPressTimerRef.current = null;
      playlistDragRef.current = null;
      return;
    }

    if (!drag.active) return;
    if (event.pointerType === 'touch') return;
    event.preventDefault();
    // Keep the drag responsive while the cursor is still inside the original playlist button.
    // Touch dragging is handled by the window-level touch listener so native scroll does not trap it.
    autoScrollPlaylistBar(drag.section, event.clientX);
    reorderPlaylistsByPointer(drag.section, drag.playlistId, event.clientX);
  };

  const finishPlaylistDrag = async (event?: React.PointerEvent<HTMLButtonElement>) => {
    if (playlistPressTimerRef.current) window.clearTimeout(playlistPressTimerRef.current);
    playlistPressTimerRef.current = null;

    const drag = playlistDragRef.current;
    playlistDragRef.current = null;
    if (drag?.windowMoveHandler) window.removeEventListener('pointermove', drag.windowMoveHandler);
    if (drag?.windowEndHandler) {
      window.removeEventListener('pointerup', drag.windowEndHandler);
      window.removeEventListener('pointercancel', drag.windowEndHandler);
    }
    if (drag?.windowTouchMoveHandler) window.removeEventListener('touchmove', drag.windowTouchMoveHandler);
    if (drag?.windowTouchEndHandler) {
      window.removeEventListener('touchend', drag.windowTouchEndHandler);
      window.removeEventListener('touchcancel', drag.windowTouchEndHandler);
    }
    document.body.classList.remove('soridraw-folder-dragging');

    if (!drag?.active) {
      setPlaylistDragging(null);
      return;
    }

    const dragKey = getPlaylistDragKey(drag.section, drag.playlistId);
    playlistSuppressClickRef.current = dragKey;
    window.setTimeout(() => {
      if (playlistSuppressClickRef.current === dragKey) playlistSuppressClickRef.current = null;
    }, 250);

    try {
      (event?.currentTarget || drag.target)?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // Ignore release failures.
    }

    setPlaylistDragging(null);
    try {
      await persistPlaylistOrder(drag.section);
      showToast('플레이리스트 순서를 변경했습니다.');
    } catch (error) {
      console.error('playlist reorder failed:', error);
      showToast('플레이리스트 순서 저장에 실패했습니다.');
    }
  };

  const renderActivePlaylistManageButtons = (section: 'normal' | 'shared') => {
    const list = section === 'normal' ? visibleNormalPlaylists : visibleSharedPlaylists;
    const selectedId = section === 'normal' ? selectedNormalPlaylistId : selectedSharedPlaylistId;
    const activePlaylist = list.find(p => p.id === selectedId);
    if (!activePlaylist || !user || (activePlaylist as any).isFallback) return null;
    const isDefaultPlaylist = activePlaylist.id === list[0]?.id;
    if (isDefaultPlaylist) return null;

    return (
      <div className="shrink-0 inline-flex items-center overflow-hidden rounded-xl bg-[var(--bg-secondary)] shadow-btn">
        <button
          onClick={() => handleRenamePlaylist(activePlaylist)}
          className="h-9 w-9 flex items-center justify-center text-white/45 hover:text-[#C7F7BD] hover:bg-white/5 transition-all"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleDeletePlaylist(activePlaylist)}
          className="h-9 w-9 flex items-center justify-center text-white/45 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div
      ref={libraryPageRootRef}
      className={`soridraw-library-theme mx-auto w-full max-w-[1548px] min-h-screen overflow-x-hidden bg-[var(--bg-primary)] px-4 md:px-6 pt-18 md:pt-24 pb-32 text-[var(--text-primary)] relative ${multiSelectMode ? 'select-none' : ''}`}
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        const isSelectionActionTarget = Boolean(target.closest('[data-selection-action-bar="true"], [data-more-menu-panel="true"]'));
        const hasOpenMoreMenu = Boolean(activeMenuState || activePlaylistItemMenu || bulkMenuState);

        if (multiSelectMode && isSelectionActionTarget) return;

        if (hasOpenMoreMenu && !target.closest('[data-more-menu-panel="true"]')) {
          e.preventDefault();
          e.stopPropagation();
          setActiveMenuState(null);
          setActivePlaylistItemMenu(null);
          setPlaylistItemContextMenuPosition(null);
          setBulkMenuState(null);
          return;
        }

        if (target.closest('[data-floating-menu="true"]')) return;

        if (multiSelectMode && consumeLibraryDragSelectClick(e)) return;

        if (multiSelectMode && !target.closest('[data-selection-keep="true"]')) {
          clearMultiSelect();
        }

        if (activeMenuState || activePlaylistItemMenu || activeColorMenu || bulkMenuState) {
          setActiveMenuState(null);
          setActivePlaylistItemMenu(null);
          setPlaylistItemContextMenuPosition(null);
          setActiveColorMenu(null);
          setBulkMenuState(null);
        }
      }}
    >
      <style>{`
        .suno-playing-ring {
          background: conic-gradient(
            from 0deg,
            rgba(249,115,22,0) 0deg,
            rgba(249,115,22,0.04) 105deg,
            rgba(251,191,36,0.18) 142deg,
            rgba(249,115,22,0.95) 174deg,
            rgba(249,115,22,0.12) 210deg,
            rgba(249,115,22,0) 360deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          animation: sunoOrbitGlow 5.8s linear infinite;
          filter: drop-shadow(0 0 7px rgba(249, 115, 22, 0.38));
        }

        .suno-icon-stack {
          position: relative;
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .suno-icon-pause,
        .suno-icon-wave {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .suno-icon-pause {
          gap: 4px;
        }

        .suno-icon-pause-bar {
          width: 4px;
          height: 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.96);
        }

        .suno-icon-wave {
          gap: 2px;
          opacity: 0;
          transform: scale(0.78);
        }

        .suno-icon-wave-bar {
          width: 3px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.96);
          transform-origin: center bottom;
          animation: sunoWaveBounce 0.92s ease-in-out infinite;
        }

        .is-playing .suno-icon-pause {
          animation: sunoPauseMorph 4.2s ease-in-out infinite;
        }

        .is-playing .suno-icon-wave {
          animation: sunoWaveMorph 4.2s ease-in-out infinite;
        }

        @keyframes sunoOrbitGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes sunoWaveBounce {
          0%, 100% { transform: scaleY(0.7); }
          50% { transform: scaleY(1.45); }
        }

        @keyframes sunoPauseMorph {
          0%, 24% { opacity: 1; transform: scale(1); }
          34%, 72% { opacity: 0; transform: scale(0.72); }
          82%, 100% { opacity: 1; transform: scale(1); }
        }

        @keyframes sunoWaveMorph {
          0%, 24% { opacity: 0; transform: scale(0.72); }
          34%, 68% { opacity: 1; transform: scale(1); }
          78%, 100% { opacity: 0; transform: scale(0.82); }
        }

        .suno-mobile-title-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y;
          overscroll-behavior-x: contain;
          cursor: grab;
        }
        .suno-mobile-title-strip:active { cursor: grabbing; }
        .suno-mobile-title-strip::-webkit-scrollbar { display: none; }

        @keyframes sunoFailureMarquee {
          0%, 14% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .suno-failure-marquee {
          min-width: 0;
          flex: 1 1 180px;
          max-width: min(420px, 48vw);
        }

        .suno-failure-marquee-window {
          display: block;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
        }

        .suno-failure-marquee-track {
          display: inline-flex;
          align-items: center;
          width: max-content;
          min-width: 100%;
        }

        .suno-failure-marquee-text {
          display: inline-block;
          padding-right: 2rem;
        }

        .suno-failure-marquee-copy {
          display: none;
        }

        @media (max-width: 767px) {
          .suno-failure-marquee {
            flex: 1 1 0;
            max-width: min(42vw, 220px);
          }

          .suno-failure-marquee-track {
            animation: sunoFailureMarquee 12s linear infinite;
          }

          .suno-failure-marquee-copy {
            display: inline-block;
          }
        }
      `}</style>
      <AnimatePresence>
        {renameModalArgs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25"
               onClick={() => setRenameModalArgs(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#2a2a2a] w-full max-w-sm rounded-2xl flex flex-col overflow-hidden border border-black/20"
            >
              <div className="p-4 border-b border-black/15 flex items-center justify-between">
                <h3 className="font-bold text-white">플레이리스트 이름 변경</h3>
                <button onClick={() => setRenameModalArgs(null)} className="p-1 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <input 
                  type="text" 
                  value={renameModalArgs.newTitle} 
                  onChange={e => setRenameModalArgs({ ...renameModalArgs, newTitle: e.target.value })}
                  placeholder="플레이리스트 이름 (최대 20자)"
                  maxLength={20}
                  className="w-full bg-[#1a1a1a] text-white rounded-xl px-4 py-3 outline-none border border-black/15 focus:border-[#7FBD75]/45 transition-colors"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      if (!user || (renameModalArgs.playlist as any).isFallback) return;
                      const trimmedTitle = renameModalArgs.newTitle.trim();
                      if (!trimmedTitle) { showToast('이름을 입력해주세요.'); return; }
                      if (trimmedTitle.length > 20) { showToast('이름은 최대 20자까지 가능합니다.'); return; }
                      const isNormal = renameModalArgs.playlist.type === 'normal';
                      const currentList = isNormal ? actualNormalPlaylists : actualSharedPlaylists;
                      if (currentList.some(p => p.id !== renameModalArgs.playlist.id && p.title === trimmedTitle)) {
                        showToast('같은 이름의 플레이리스트가 이미 있습니다.'); return;
                      }
                      try {
                        await renamePlaylist(user.uid, renameModalArgs.playlist.id!, trimmedTitle);
                        setRenameModalArgs(null);
                        showToast('플레이리스트 이름이 변경되었습니다.');
                      } catch (error) { showToast('이름 변경에 실패했습니다.'); }
                    }
                  }}
                />
              </div>
              <div className="p-4 bg-[#1a1a1a]/50 flex justify-end gap-2 border-t border-black/15">
                <button className="px-4 py-2 font-bold text-white/50 hover:text-white transition-colors" onClick={() => setRenameModalArgs(null)}>취소</button>
                <button className="px-4 py-2 font-bold bg-[#7FBD75] text-white rounded-xl hover:bg-[#7FBD75]/90 transition-colors" onClick={async () => {
                  if (!user || (renameModalArgs.playlist as any).isFallback) return;
                  const trimmedTitle = renameModalArgs.newTitle.trim();
                  if (!trimmedTitle) { showToast('이름을 입력해주세요.'); return; }
                  if (trimmedTitle.length > 20) { showToast('이름은 최대 20자까지 가능합니다.'); return; }
                  const isNormal = renameModalArgs.playlist.type === 'normal';
                  const currentList = isNormal ? actualNormalPlaylists : actualSharedPlaylists;
                  if (currentList.some(p => p.id !== renameModalArgs.playlist.id && p.title === trimmedTitle)) {
                    showToast('같은 이름의 플레이리스트가 이미 있습니다.'); return;
                  }
                  try {
                    await renamePlaylist(user.uid, renameModalArgs.playlist.id!, trimmedTitle);
                    setRenameModalArgs(null);
                    showToast('플레이리스트 이름이 변경되었습니다.');
                  } catch (error) { showToast('이름 변경에 실패했습니다.'); }
                }}>저장</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moveModalArgs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25"
               onClick={() => setMoveModalArgs(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#2a2a2a] w-full max-w-sm rounded-2xl flex flex-col overflow-hidden border border-black/20 max-h-[80vh]"
            >
              <div className="p-4 border-b border-black/15 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-white">폴더 이동</h3>
                <button onClick={() => setMoveModalArgs(null)} className="p-1 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex flex-col gap-2">
                {(() => {
                  const isShared = moveModalArgs.item.sourceType === 'shared_track';
                  const targetLists = isShared ? actualSharedPlaylists : actualNormalPlaylists;
                  const availableLists = targetLists.filter(p => !(p as any).isFallback && p.id !== activePlaylistId);
                  
                  return availableLists.map(list => (
                    <button
                      key={list.id}
                      onClick={async () => {
                        if (!user || !activePlaylistId) return;
                        try {
                          const targetItemsRef = collection(db, 'user_playlists', user.uid, 'lists', list.id!, 'items');
                          const q = query(targetItemsRef, where('sourceId', '==', moveModalArgs.item.sourceId));
                          const targetDocs = await getDocs(q);
                          
                          if (!targetDocs.empty) {
                            showToast("이미 대상 플레이리스트에 있는 곡입니다.");
                            return;
                          }

                          await movePlaylistItem(user.uid, activePlaylistId, list.id!, moveModalArgs.item);
                          showToast("플레이리스트를 이동했습니다.");
                          setMoveModalArgs(null);
                        } catch (error) {
                          console.error("move playlist item failed:", {
                            error,
                            fromPlaylistId: activePlaylistId,
                            toPlaylistId: list.id,
                            itemId: moveModalArgs.item?.id,
                            item: moveModalArgs.item,
                            activePlaylistType: activePlaylistSection
                          });
                          showToast("곡 이동에 실패했습니다."); 
                        }
                      }}
                      className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium text-white flex items-center"
                    >
                      [{list.title}]
                    </button>
                  ));
                })()}
              </div>
              <div className="p-4 bg-[#1a1a1a]/50 flex justify-end gap-2 border-t border-black/15 shrink-0">
                <button className="px-4 py-2 font-bold bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors" onClick={() => setMoveModalArgs(null)}>닫기</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSharedView && showKakaoWarning && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/25">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="w-full max-w-sm rounded-[2rem] bg-[#1f1f1f] border border-black/20 shadow-2xl p-7 text-center"
            >
              <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-[#7FBD75]/20 text-[#7FBD75] flex items-center justify-center">
                <Info className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">Chrome에서 열어주세요</h2>
              <p className="text-sm leading-relaxed text-white/60 mb-6">
                카카오톡 브라우저에서는 Google 로그인 및 일부 기능이 제한될 수 있습니다.<br />
                정상적인 음악 감상과 저장 기능 사용을 위해 Chrome에서 열어주세요.
              </p>
              <div className="space-y-3">
                <button
                  onClick={openCurrentShareInChrome}
                  className="w-full py-4 rounded-2xl bg-[#7FBD75] text-white font-black text-lg shadow-lg shadow-[#7FBD75]/18 hover:bg-[#7FBD75]/90 transition-all"
                >
                  공유 음악 듣기
                </button>
                <button
                  onClick={handleKakaoModalShare}
                  className="w-full py-4 rounded-2xl bg-white/10 text-white font-black text-lg flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                >
                  <Share2 className="w-5 h-5" /> 공유하기
                </button>
                <button
                  onClick={() => setShowKakaoWarning(false)}
                  className="w-full pt-3 pb-1 text-white/40 hover:text-white/70 font-bold transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full space-y-3 md:space-y-5">
        
        {!isSharedView && typeof remainingCredits === 'number' && (
          <div className="flex md:hidden items-center justify-end">
            <button
              type="button"
              onClick={handleCreditShortcutClick}
              className="h-10 flex items-center px-3 rounded-xl text-xs font-bold bg-[#7FBD75]/12 border border-[#7FBD75]/22 text-[#C7F7BD] transition-all hover:bg-[#7FBD75]/18 active:scale-[0.98]"
            >
              {remainingCredits.toLocaleString()} credit
            </button>
          </div>
        )}

        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 translate-y-2 md:translate-y-3"
        >
          <div className="flex items-start gap-4 min-w-0">
            {isSharedView && (
              <button
                onClick={() => navigate('/studio')}
                className="hidden md:flex mt-1 px-4 py-2.5 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:text-[#FFBB22] hover:bg-btn-hover shadow-btn transition-all shrink-0 items-center gap-2"
              >
                <Zap className="w-4 h-4" />스튜디오
              </button>
            )}
            <div className="min-w-0">
              <h1 className={`text-3xl md:text-5xl font-black leading-none tracking-tight text-white flex items-center gap-3 ${isSharedView ? 'font-sans' : 'font-display'}`}>
                <div className="soridraw-library-title-icon flex gap-[5px] items-end justify-center w-9 h-9 text-[#7FBD75] shrink-0">
                  <div className="w-[6px] h-[24px] border-[2px] border-current rounded-[3px] opacity-80" />
                  <div className="w-[6px] h-[29px] border-[2px] border-current rounded-[3px]" />
                  <div className="w-[6px] h-[24px] border-[2px] border-current rounded-[3px] transform origin-bottom -rotate-12 translate-x-[2px] opacity-90" />
                </div>
                {isSharedView ? '공유 라이브러리' : <>Suno <span className="text-[#7FBD75]">Library</span></>}
              </h1>
              <p className="text-[var(--text-secondary)] text-sm md:text-base mt-2 mb-[2px]">
                {isSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : 'Music API로 생성한 곡을 듣고, 관리하고, 공유할수 있습니다.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center self-end md:self-center">
          {!isSharedView && (
            <>
              {typeof remainingCredits === 'number' && (
                <button
                  type="button"
                  onClick={handleCreditShortcutClick}
                  className="hidden md:flex h-12 items-center justify-center gap-2 px-4 rounded-2xl border border-[#7FBD75]/22 bg-[#7FBD75]/12 text-xs font-bold text-[#C7F7BD] transition-all hover:bg-[#7FBD75]/18 active:scale-[0.98]"
                >
                  남은 크레딧 {remainingCredits.toLocaleString()}
                </button>
              )}
            </>
          )}
          </div>
        </motion.div>

        {/* Main Music Player relocated to GlobalPlayer */}

        {renderLibraryTopControls()}

        {renderLibraryModeTabs()}

        {libraryViewMode === 'workspace' && (
          <>
        {loading || sharedTrackLoading ? (
          <div className="!mt-3 pt-0 flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#7FBD75]" />
          </div>
        ) : (!(user || appUser || auth.currentUser) && !isSharedView) ? (
          <div className="!mt-3 pt-0 flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
            <p className="text-[var(--text-secondary)]">Suno Library를 보려면 로그인해주세요.</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="!mt-3 pt-0 flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[#7FBD75]/16 bg-white/[0.015]"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              {isSharedView ? <Info className="w-8 h-8 text-[var(--text-secondary)]/50" /> : <Music className="w-8 h-8 text-[var(--text-secondary)]/50" />}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isSharedView ? (sharedError ? '공유곡 조회 중 오류가 발생했습니다.' : '공유된 음악을 이용할 수 없습니다') : '검색 결과가 없습니다'}
            </h2>
            <p className="text-[var(--text-secondary)] mb-8">
              {isSharedView ? (sharedError ? '잠시 후 다시 시도해주세요.' : '비공개로 전환되었거나 삭제된 음악일 수 있습니다.') : '다른 검색어를 사용하거나 필터를 변경해보세요.'}
            </p>
          </motion.div>
        ) : (
          <div className="!mt-3 pt-0 space-y-4 md:space-y-5" data-selection-keep="true">
            {displayedWorkspaceTracks.map((group) => {
              const dataItems = extractSunoData(group);
              const items = (dataItems.length > 0 ? dataItems : [{}])
                .map((item: any, idx: number) => ({ item, idx }))
                .filter(({ item, idx }: { item: any; idx: number }) => isWorkspaceItemVisible(group, item, idx));
              const dateStr = formatCreatedAt(group.createdAt);
              
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 1, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0 }}
                  className="bg-[#151515] border border-black/24 rounded-2xl shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                >
                  {/* Group Header */}
                  <div className="px-4 md:px-6 py-4 border-b border-[#7FBD75]/10 flex items-start md:items-center justify-between gap-2 md:gap-3 bg-[#171717] rounded-t-2xl overflow-hidden">
                    <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-[#7FBD75] shrink-0">
                        <Music className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1 pr-1 md:pr-0">
                        {(() => {
                          const titleParts = splitSunoDisplayTitleParts(group.title || 'Untitled Generation');
                          return (
                            <>
                              <h3 className="hidden md:block font-bold leading-tight truncate">
                                {formatSunoDisplayTitle(group.title || 'Untitled Generation')}
                              </h3>
                              <div className="md:hidden min-w-0 leading-tight">
                                {titleParts.genre && (
                                  <div className="text-sm font-black text-[var(--text-primary)] truncate">
                                    {titleParts.genre}
                                  </div>
                                )}
                                <div className="mt-0.5 text-sm font-black text-[var(--text-primary)] truncate">
                                  {titleParts.title}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                        <div className="flex items-center gap-2 mt-1 opacity-40 text-[10px] min-w-0">
                          <span className="truncate">{dateStr}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0">{items.length}곡</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start md:items-center justify-end gap-1.5 md:gap-3 flex-nowrap max-w-[112px] md:max-w-none">
                      {getStatusBadge(group)}
                      {group.status !== 'completed' && (
                        <button
                          onClick={() => checkStatus(group.id, group.taskId)}
                          disabled={statusChecking === group.id || !group.taskId}
                          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold border border-black/20 transition-all"
                        >
                          {statusChecking === group.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          <span className="hidden sm:inline">{group.status === 'failed' || group.status === 'cancelled' || group.status === 'canceled' ? '재확인' : '상태 확인'}</span>
                        </button>
                      )}
                      {!isSharedView && !group.taskId && <span className="hidden md:inline text-[10px] opacity-30">Task ID 없음</span>}
                    </div>
                  </div>

                  {/* Tracks List */}
                  <div className="divide-y divide-[#7FBD75]/8">
                    {items.map(({ item, idx }: { item: any; idx: number }) => {
                      const audioUrl = getAudioUrl(item, group);
                      const duration = getDuration(item, group);
                      const hasValidDuration = duration !== null;
                      const isFailed = group.status === 'failed';
                      const isCompleted = Boolean(audioUrl && (group.status === 'completed' || group.status === 'success' || hasValidDuration));
                      const isPending = !isFailed && !audioUrl;
                      const sunoVersionLabel = getSunoModelVersionLabel(item, group);
                      
                      const isCurrent = isCurrentWorkspaceItem(group, item, idx);
                      const selection = buildWorkspaceSelection(group, item, idx);
                      const isSelected = isTrackSelected(selection.key);
                      
                      return (
                        <div 
                          key={`${group.id}-${idx}`} 
                          data-selection-keep="true"
                          className={`group flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 bg-[var(--bg-secondary)] transition-all cursor-pointer last:rounded-b-2xl ${item.hidden || group.hidden ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
                          onMouseDown={(event) => {
                            handleLibraryDragSelectStart(event, selection);
                            handleLibraryCardLongPressStart(event, selection);
                          }}
                          onMouseMove={(event) => {
                            handleLibraryDragSelectMove(event, selection);
                            handleLibraryCardLongPressMove(event);
                          }}
                          onMouseUp={() => {
                            handleLibraryDragSelectEnd();
                            handleLibraryCardLongPressEnd();
                          }}
                          onTouchStart={(event) => handleLibraryCardLongPressStart(event, selection)}
                          onTouchMove={handleLibraryCardLongPressMove}
                          onTouchEnd={handleLibraryCardLongPressEnd}
                          onTouchCancel={handleLibraryCardLongPressEnd}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleLibraryCardLongPressEnd();
                            setActiveColorMenu(null);
                            setActivePlaylistItemMenu(null);
                            setPlaylistItemContextMenuPosition(null);

                            if (multiSelectMode) {
                              setActiveMenuState(null);
                              setBulkMenuState({ ...computePointerBulkMenuPosition(event.clientX, event.clientY, 300, 224), anchorEl: null });
                              return;
                            }

                            const id = `${group.id}-${idx}`;
                            setBulkMenuState(null);
                            setActiveMenuState({
                              id,
                              position: computePointerMenuPosition(event.clientX, event.clientY, getWorkspaceMoreMenuEstimatedHeight(group), 192),
                              anchorEl: null,
                              group,
                              item,
                              idx,
                              audioUrl,
                            });
                          }}
                          onMouseEnter={(event) => {
                            handleLibraryDragSelectEnter(event, selection);
                            event.currentTarget.style.backgroundColor = '#171717';
                          }}
                          onMouseLeave={(event) => {
                            handleLibraryCardLongPressEnd();
                            event.currentTarget.style.backgroundColor = '';
                          }}
                          onClick={(e) => {
                             if (consumeLibrarySuppressedClick(e, selection.key)) return;
                             if (consumeLibraryDragSelectClick(e)) return;
                             if (shouldIgnoreLibraryCardClickFromPointerTravel(e)) return;
                             if ((e.target as HTMLElement).closest('button')) return; // ignore if clicking buttons
                             if (multiSelectMode) {
                               e.preventDefault();
                               e.stopPropagation();
                               toggleSelectedTrack(selection);
                               clearLibrarySelectionClickGuards();
                               resetLibraryDragSelectState();
                               return;
                             }
                             if (audioUrl) {
                               if (isCurrent) togglePlayPause();
                               else handlePlayTrack(group, idx);
                             }
                          }}
                        >
                          <AnimatedTrackPlayButton
                            imageUrl={getImageUrl(item, group)}
                            isActive={isCurrent}
                            isPlaying={isPlaying}
                            disabled={!audioUrl}
                            durationLabel={isCompleted && hasValidDuration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (multiSelectMode) {
                                toggleSelectedTrack(selection);
                                return;
                              }
                              if (audioUrl) {
                                if (isCurrent) togglePlayPause();
                                else handlePlayTrack(group, idx);
                              }
                            }}
                          />
                          {multiSelectMode && (
                            <button
                              type="button"
                              data-no-card-long-press="true"
                              data-selection-checkbox="true"
                              onClick={(e) => {
                            if (consumeLibraryDragSelectClick(e)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSelectedTrack(selection);
                            clearLibrarySelectionClickGuards();
                            resetLibraryDragSelectState();
                          }}
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isSelected ? 'border-[#7FBD75]/75 bg-[#7FBD75]/20 text-[#B8F0AE] shadow-[0_0_0_1px_rgba(127,189,117,0.18)]' : 'border-white/35 bg-white/[0.08] text-white/65 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:border-white/55 hover:bg-white/[0.12] hover:text-white/85'}`}
                            >
                              {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                            </button>
                          )}
                          
                          <div className="flex-1 min-w-0 pr-2 flex items-center gap-3 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const colorMenuId = `workspace-${group.id}-${idx}`;
                                setActiveColorMenu(activeColorMenu === colorMenuId ? null : colorMenuId);
                                setActiveMenuState(null);
                                setActivePlaylistItemMenu(null);
                                setBulkMenuState(null);
                              }}
                              className="w-3 h-3 rounded-full shrink-0 hover:scale-110 transition-transform"
                              style={{ backgroundColor: getColorHex(getWorkspaceItemColor(group, idx)) }}
                            />
                            {activeColorMenu === `workspace-${group.id}-${idx}` && (
                              <div data-floating-menu="true" className="absolute top-7 left-0 z-30 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-black/20" onClick={(e) => e.stopPropagation()}>
                                {COLOR_OPTIONS.map(c => (
                                  <button
                                    key={c.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (multiSelectMode && selectedTrackCount > 0) {
                                        handleBulkChangeColor(c.value);
                                      } else {
                                        handleChangeWorkspaceColor(group, idx, c.value);
                                        setActiveColorMenu(null);
                                      }
                                    }}
                                    className="w-5 h-5 rounded-full outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a2a2a]"
                                    style={{ backgroundColor: c.color }}
                                  />
                                ))}
                              </div>
                            )}
                            <h4 className={`text-sm md:text-base font-bold transition-colors min-w-0 flex-1 max-w-full overflow-hidden ${isCurrent ? 'text-[#7FBD75]' : 'text-[var(--text-primary)] group-hover:text-white'}`}>
                              <span className="suno-mobile-title-strip block md:hidden w-full max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap">
                                {getTitle(item, group, idx)}
                              </span>
                              <span className="hidden md:block truncate">
                                {getTitle(item, group, idx)}
                              </span>
                            </h4>
                            {sunoVersionLabel && (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${getSunoModelVersionBadgeClass(sunoVersionLabel)}`}
                              >
                                {sunoVersionLabel}
                              </span>
                            )}
                            {isFailed ? (
                              <span className="suno-failure-marquee text-xs opacity-50 flex items-center gap-1.5 min-w-0">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span className="suno-failure-marquee-window">
                                  <span className="suno-failure-marquee-track">
                                    <span className="suno-failure-marquee-text">생성 실패: {getSunoFailureDisplayMessage(group)}</span>
                                    <span className="suno-failure-marquee-text suno-failure-marquee-copy" aria-hidden="true">생성 실패: {getSunoFailureDisplayMessage(group)}</span>
                                  </span>
                                </span>
                              </span>
                            ) : isPending ? (
                              <span className="text-xs opacity-50 truncate flex items-center gap-1.5 text-blue-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                생성 중...
                              </span>
                            ) : null}
                          </div>

                          {isCompleted && isWorkspaceItemUnplayed(group, item, idx) && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#7FBD75] shadow-[0_0_10px_rgba(255,128,0,0.65)] shrink-0"
                            />
                          )}

                          <div className="relative shrink-0 ml-2">
                            <button
                              type="button"
                              data-floating-menu="true"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { 
                                e.stopPropagation();
                                setPlaylistItemContextMenuPosition(null);
                                if (multiSelectMode) {
                                  openBulkMenuFromButton(e.currentTarget);
                                  return;
                                }
                                const id = `${group.id}-${idx}`;
                                if (activeMenuState?.id === id) {
                                  setActiveMenuState(null);
                                } else {
                                  setActiveMenuState({
                                    id,
                                    position: computeWorkspaceMoreMenuPosition(e.currentTarget, getWorkspaceMoreMenuEstimatedHeight(group), 192),
                                    anchorEl: e.currentTarget,
                                    group,
                                    item,
                                    idx,
                                    audioUrl
                                  });
                                }
                              }}
                              className={`w-10 h-10 flex items-center justify-center transition-all ${multiSelectMode ? 'text-[#7FBD75] hover:text-[#7FBD75]/80' : 'rounded-full hover:bg-white/10 text-white/50'}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
            {hasMoreWorkspaceTracks && (
              <div className="flex flex-col items-center gap-2 pt-1 pb-4" data-selection-keep="true">
                <button
                  type="button"
                  data-selection-keep="true"
                  disabled={isLoadingMoreWorkspaceTracks}
                  onPointerDown={(event) => { if (multiSelectMode) event.stopPropagation(); }}
                  onClick={(event) => { event.stopPropagation(); void loadMoreWorkspaceTracks(); }}
                  onMouseEnter={() => setShowWorkspaceMoreTooltip(true)}
                  onMouseLeave={() => setShowWorkspaceMoreTooltip(false)}
                  onFocus={() => setShowWorkspaceMoreTooltip(true)}
                  onBlur={() => setShowWorkspaceMoreTooltip(false)}
                  className={`px-8 py-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] font-bold transition-all border border-[var(--border-color)] flex items-center gap-2 group shadow-[var(--shadow-md)] ${isLoadingMoreWorkspaceTracks ? 'cursor-wait opacity-60' : ''}`}
                >
                  <span className="text-[#7FBD75] text-xl leading-none group-hover:rotate-90 transition-transform">+</span>
                  {isLoadingMoreWorkspaceTracks
                    ? '불러오는 중...'
                    : `더보기 (${Math.max(0, filteredTracks.length - workspaceVisibleCount) + (canRequestMoreWorkspacePage ? WORKSPACE_PAGE_SIZE : 0)}세트 남음)`}
                </button>
                {false && showWorkspaceMoreTooltip && (
                  <div className="fixed left-1/2 bottom-8 z-[500] -translate-x-1/2 rounded-2xl border border-[#7FBD75]/28 bg-[#171717] px-5 py-3 text-center shadow-2xl shadow-black/40 pointer-events-none">
                    <p className="text-xs font-bold text-[#7FBD75]">더보기</p>
                    <p className="mt-1 text-[11px] text-white/60">곡을 20세트 더 불러옵니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}

        {(libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') && (
          <div className="space-y-5 mt-3" data-selection-keep="true">
            {/* Playlist Tabs Layout */}
            
            {libraryViewMode === 'playlist' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/50 px-2 uppercase tracking-wider">나의 플레이리스트</h3>
              <div
                ref={(element) => { playlistBarRefs.current.normal = element; }}
                className="soridraw-folder-drag-scrollbar flex items-center gap-2 overflow-x-auto hide-scrollbar px-2 pb-2"
              >
                {visibleNormalPlaylists.map((playlist) => {
                  const dragKey = getPlaylistDragKey('normal', playlist.id!);
                  const isDefaultPlaylist = playlist.id === visibleNormalPlaylists[0]?.id;
                  const isDraggingPlaylist = playlistDragging?.section === 'normal' && playlistDragging.playlistId === playlist.id;
                  return (
                    <button 
                      key={playlist.id}
                      ref={(element) => { playlistButtonRefs.current[dragKey] = element; }}
                      onPointerDown={(event) => handlePlaylistPointerDown(event, 'normal', playlist)}
                      onPointerMove={handlePlaylistPointerMove}
                      onPointerUp={finishPlaylistDrag}
                      onPointerCancel={finishPlaylistDrag}
                      onClick={() => {
                        if (playlistSuppressClickRef.current === dragKey) return;
                        setSelectedNormalPlaylistId(playlist.id!);
                        setActivePlaylistSection('normal');
                      }}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border select-none ${
                        !isDefaultPlaylist && !(playlist as any).isFallback ? 'cursor-grab active:cursor-grabbing touch-pan-x' : 'touch-pan-x'
                      } ${
                        isDraggingPlaylist ? 'soridraw-folder-drag-active touch-none z-10' : ''
                      } ${
                        activePlaylistSection === 'normal' && selectedNormalPlaylistId === playlist.id 
                          ? 'bg-[#7FBD75]/78 text-white border-[#7FBD75]/55 shadow-lg' 
                          : 'bg-[var(--bg-secondary)] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {playlist.title}
                    </button>
                  );
                })}
                <button 
                  onClick={() => handleAddPlaylist('normal')}
                  className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all bg-[var(--bg-secondary)] text-white/40 hover:bg-white/5 hover:text-white flex items-center gap-1 shadow-btn"
                >
                  <span className="text-lg font-light leading-none">+</span>
                </button>
                {renderActivePlaylistManageButtons('normal')}
              </div>
            </div>
            )}

            {libraryViewMode === 'sharedPlaylist' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/50 px-2 uppercase tracking-wider">공유 받은 곡</h3>
              <div
                ref={(element) => { playlistBarRefs.current.shared = element; }}
                className="soridraw-folder-drag-scrollbar flex items-center gap-2 overflow-x-auto hide-scrollbar px-2 pb-2"
              >
                {visibleSharedPlaylists.map((playlist) => {
                  const dragKey = getPlaylistDragKey('shared', playlist.id!);
                  const isDefaultPlaylist = playlist.id === visibleSharedPlaylists[0]?.id;
                  const isDraggingPlaylist = playlistDragging?.section === 'shared' && playlistDragging.playlistId === playlist.id;
                  return (
                    <button 
                      key={playlist.id}
                      ref={(element) => { playlistButtonRefs.current[dragKey] = element; }}
                      onPointerDown={(event) => handlePlaylistPointerDown(event, 'shared', playlist)}
                      onPointerMove={handlePlaylistPointerMove}
                      onPointerUp={finishPlaylistDrag}
                      onPointerCancel={finishPlaylistDrag}
                      onClick={() => {
                        if (playlistSuppressClickRef.current === dragKey) return;
                        setSelectedSharedPlaylistId(playlist.id!);
                        setActivePlaylistSection('shared');
                      }}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-1.5 touch-pan-x select-none ${
                        !isDefaultPlaylist && !(playlist as any).isFallback ? 'cursor-grab active:cursor-grabbing touch-pan-x' : 'touch-pan-x'
                      } ${
                        isDraggingPlaylist ? 'soridraw-folder-drag-active touch-none z-10' : ''
                      } ${
                        activePlaylistSection === 'shared' && selectedSharedPlaylistId === playlist.id 
                          ? 'bg-[#7FBD75]/78 text-white border-[#7FBD75]/55 shadow-lg' 
                          : 'bg-[var(--bg-secondary)] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {playlist.title}
                    </button>
                  );
                })}
                <button 
                  onClick={() => handleAddPlaylist('shared')}
                  className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all bg-[var(--bg-secondary)] text-white/40 hover:bg-white/5 hover:text-white flex items-center gap-1 shadow-btn"
                >
                  <span className="text-lg font-light leading-none">+</span>
                </button>
                {renderActivePlaylistManageButtons('shared')}
              </div>
            </div>
            )}

            {/* Playlist Items */}
            {loadingPlaylistItems ? (
              <div className="flex justify-center p-6 mt-3 border-t border-black/15">
                <Loader2 className="w-6 h-6 animate-spin text-[#7FBD75]" />
              </div>
            ) : playlistItems.length > 0 ? (
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-black/15" data-selection-keep="true">
                {(() => {
                  const normalizedPlaylistSearch = playlistSearchTerm.trim().toLowerCase();
                  let items = playlistItems.filter(item => {
                    if (!matchesPlaylistVisibilityFilter(item)) return false;
                    if (playlistColorFilter === 'all') return true;
                    const itemColor = getPlaylistItemColor(item);
                    if (playlistColorFilter === 'gray') return itemColor === 'gray';
                    return itemColor === playlistColorFilter;
                  });

                  if (normalizedPlaylistSearch) {
                    items = items.filter(item => {
                      const searchable = [
                        item.title,
                        formatSunoDisplayTitle(item.title),
                        getPlaylistItemCreatorName(item),
                        item.ownerNickname,
                        item.creatorNickname,
                        item.ownerEmail,
                        item.creatorEmail,
                        item.ownerUid,
                        item.sourceId,
                        ...(item.genreLabels || [])
                      ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                      return searchable.includes(normalizedPlaylistSearch);
                    });
                  }

                  if (playlistSortMode === 'added') {
                    items = items.sort((a, b) => {
                      if (a.order !== b.order) return a.order - b.order;
                      const timeA = a.addedAt ? (typeof a.addedAt.toMillis === 'function' ? a.addedAt.toMillis() : 0) : 0;
                      const timeB = b.addedAt ? (typeof b.addedAt.toMillis === 'function' ? b.addedAt.toMillis() : 0) : 0;
                      return timeA - timeB;
                    });
                  } else if (playlistSortMode === 'genre') {
                    items = items.sort((a, b) => {
                      const genreA = (a.genreLabels && a.genreLabels[0]) || '';
                      const genreB = (b.genreLabels && b.genreLabels[0]) || '';
                      return genreA.localeCompare(genreB);
                    });
                  } else if (playlistSortMode === 'custom') {
                    items = items.sort((a, b) => a.order - b.order);
                  }

                  const displayedItems = items.slice(0, playlistVisibleCount);
                  const hasMorePlaylistItems = playlistVisibleCount < items.length;

                  return (
                    <>
                      {displayedItems.map((item, index) => {
                  const isActive = isCurrentPlaylistItem(item);
                  const isShared = item.sourceType === 'shared_track';
                  const sourceTrackForPlaylist = !isShared
                    ? getPlaylistItemSourceTrack(item)
                    : null;
                  const playlistFavoriteActive = Boolean(!isShared && (((sourceTrackForPlaylist as any)?.favorite) ?? ((item as any).favorite)));
                  const cachedSharedStatus = sharedStatusCache[item.sourceId];
                  const isUnavailable = isShared && cachedSharedStatus && cachedSharedStatus.isPublic === false;
                  const blockedPlaylistActionClass = "w-full text-left px-4 py-2 flex items-center justify-between group text-white/25 cursor-not-allowed";
                  const normalPlaylistActionClass = "w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white";
                  
                  const globalId = getTrackGlobalId(item);
                  const likeData = likesCache[globalId] || { likeCount: 0, likedByMe: false };
                  const selection = buildPlaylistSelection(item);
                  const isSelected = isTrackSelected(selection.key);
                  
                  return (
                    <div 
                      key={item.id} 
                      onMouseDown={(event) => {
                        handleLibraryDragSelectStart(event, selection);
                        handleLibraryCardLongPressStart(event, selection);
                      }}
                      onMouseMove={(event) => {
                        handleLibraryDragSelectMove(event, selection);
                        handleLibraryCardLongPressMove(event);
                      }}
                      onMouseUp={() => {
                        handleLibraryDragSelectEnd();
                        handleLibraryCardLongPressEnd();
                      }}
                      onMouseEnter={(event) => handleLibraryDragSelectEnter(event, selection)}
                      onMouseLeave={handleLibraryCardLongPressEnd}
                      onTouchStart={(event) => handleLibraryCardLongPressStart(event, selection)}
                      onTouchMove={handleLibraryCardLongPressMove}
                      onTouchEnd={handleLibraryCardLongPressEnd}
                      onTouchCancel={handleLibraryCardLongPressEnd}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleLibraryCardLongPressEnd();
                        setActiveMenuState(null);
                        setActiveColorMenu(null);

                        if (multiSelectMode) {
                          setActivePlaylistItemMenu(null);
                          setPlaylistItemContextMenuPosition(null);
                          setBulkMenuState({ ...computePointerBulkMenuPosition(event.clientX, event.clientY, 300, 224), anchorEl: null });
                          return;
                        }

                        const position = computeInlinePointerMenuPosition(event.currentTarget, event.clientX, event.clientY, 340, 160);
                        if (!position || !item.id) return;
                        setBulkMenuState(null);
                        setPlaylistItemContextMenuPosition({ id: item.id, ...position });
                        setActivePlaylistItemMenu(item.id);
                      }}
                      onClick={(event) => {
                        if (consumeLibrarySuppressedClick(event, selection.key)) return;
                        if (consumeLibraryDragSelectClick(event)) return;
                        if (shouldIgnoreLibraryCardClickFromPointerTravel(event)) return;
                        if (multiSelectMode) {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleSelectedTrack(selection);
                          clearLibrarySelectionClickGuards();
                          resetLibraryDragSelectState();
                        }
                      }}
                      data-selection-keep="true"
                      className={`group relative flex items-center p-2 rounded-2xl transition-all border border-transparent hover:bg-white/5 hover:border-white/10 ${index < items.length - 1 ? 'after:absolute after:left-[5.25rem] md:after:left-[5.75rem] after:right-7 after:bottom-[-0.25rem] after:h-px after:bg-white/[0.035] after:content-[""]' : ''} ${multiSelectMode ? 'cursor-pointer' : ''}`}
                    >
                      {/* Left: Play/Pause */}
                      <AnimatedTrackPlayButton
                        imageUrl={item.imageUrl}
                        isActive={isActive}
                        isPlaying={isPlaying}
                        unavailable={isUnavailable}
                        disabled={isUnavailable}
                        durationLabel={formatPlaylistDuration(item.duration) !== '--:--' ? formatPlaylistDuration(item.duration) : undefined}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (multiSelectMode) {
                            toggleSelectedTrack(selection);
                            return;
                          }
                          if (isUnavailable) return;
                          
                          if (item.sourceType === 'shared_track') {
                            const isPublic = await ensureSharedItemIsPublic(item.sourceId, false);
                            if (!isPublic) {
                              showToast("원곡자가 비공개로 전환하여 재생할 수 없습니다.");
                              return;
                            }
                          }
                          
                          if (isActive) {
                            togglePlayPause();
                          } else {
                            const newQueue = playlistItems
                              .filter(p => {
                                if (p.sourceType !== 'shared_track') return true;
                                const cached = p.sourceId ? sharedStatusCache[p.sourceId] : null;
                                return cached?.isPublic !== false;
                              })
                              .map(p => ({
                                url: p.audioUrl!,
                                title: p.title,
                                imageUrl: p.imageUrl,
                                parent: {
                                  ...p,
                                  creatorDisplayId: getPlaylistItemCreatorName(p),
                                  ownerNickname: getPlaylistItemCreatorName(p) || p.ownerNickname,
                                  creatorNickname: getPlaylistItemCreatorName(p) || p.creatorNickname,
                                  __playlistContext: true,
                                  __activePlaylistId: activePlaylistId,
                                  __libraryViewMode: libraryViewMode,
                                  favorite: p.sourceType === 'shared_track' ? false : Boolean((getPlaylistItemSourceTrack(p) as any)?.favorite ?? (p as any).favorite)
                                },
                                index: 0,
                                trackId: p.id,
                                creatorDisplayId: getPlaylistItemCreatorName(p),
                                lyrics: p.lyrics || p.lyricsText || p.koreanLyrics || p.englishLyrics || null
                              })).filter(q => q.url);

                            if (item.audioUrl) {
                              markPlaylistItemPlayed(item);
                              playTrack({
                                url: item.audioUrl,
                                title: formatSunoDisplayTitle(item.title),
                                imageUrl: item.imageUrl,
                                parent: {
                                  ...item,
                                  creatorDisplayId: getPlaylistItemCreatorName(item),
                                  ownerNickname: getPlaylistItemCreatorName(item) || item.ownerNickname,
                                  creatorNickname: getPlaylistItemCreatorName(item) || item.creatorNickname,
                                  __playlistContext: true,
                                  __activePlaylistId: activePlaylistId,
                                  __libraryViewMode: libraryViewMode,
                                  favorite: playlistFavoriteActive,
                                  sourceId: isShared ? item.sourceId : (sourceTrackForPlaylist as any)?.id || item.sourceId
                                },
                                index: 0,
                                trackId: item.id,
                                creatorDisplayId: getPlaylistItemCreatorName(item),
                                lyrics: item.lyrics || item.lyricsText || item.koreanLyrics || item.englishLyrics || null
                              }, newQueue);
                            } else {
                              showToast('이 곡은 재생할 수 없습니다.');
                            }
                          }
                        }}
                      />
                      {multiSelectMode && (
                        <button
                          type="button"
                          data-no-card-long-press="true"
                          data-selection-checkbox="true"
                          onClick={(e) => {
                            if (consumeLibraryDragSelectClick(e)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSelectedTrack(selection);
                            clearLibrarySelectionClickGuards();
                            resetLibraryDragSelectState();
                          }}
                          className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isSelected ? 'border-[#7FBD75]/75 bg-[#7FBD75]/20 text-[#B8F0AE] shadow-[0_0_0_1px_rgba(127,189,117,0.18)]' : 'border-white/35 bg-white/[0.08] text-white/65 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:border-white/55 hover:bg-white/[0.12] hover:text-white/85'}`}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </button>
                      )}

                      {/* Main Info */}
                      <div className={`flex flex-col ml-3 flex-1 min-w-0 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-center gap-2 relative">
                          {/* Color Point */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveColorMenu(activeColorMenu === item.id ? null : item.id!); setActivePlaylistItemMenu(null); setBulkMenuState(null); }}
                            className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                            style={{ backgroundColor: getColorHex(getPlaylistItemColor(item)) }}
                          />
                          {activeColorMenu === item.id && (
                            <div data-floating-menu="true" className="absolute top-6 left-0 z-10 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-black/20">
                              {[
                                { value: 'gray', color: '#6b7280' },
                                { value: 'red', color: '#ef4444' },
                                { value: 'orange', color: '#f97316' },
                                { value: 'yellow', color: '#eab308' },
                                { value: 'green', color: '#22c55e' },
                                { value: 'blue', color: '#3b82f6' },
                                { value: 'purple', color: '#a855f7' }
                              ].map(c => (
                                <button
                                  key={c.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (multiSelectMode && selectedTrackCount > 0) {
                                      handleBulkChangeColor(c.value);
                                    } else {
                                      handleChangeColor(item, c.value);
                                      setActiveColorMenu(null);
                                    }
                                  }}
                                  className="w-5 h-5 rounded-full outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a2a2a]"
                                  style={{ backgroundColor: c.color }}
                                />
                              ))}
                            </div>
                          )}
                          
                          <h3 className={`text-sm font-bold min-w-0 flex-1 max-w-full overflow-hidden ${isActive ? 'text-[#7FBD75]' : 'text-white'}`}>
                            <span className="suno-mobile-title-strip block md:hidden w-full max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap">
                              {formatSunoDisplayTitle(item.title)}
                            </span>
                            <span className="hidden md:block truncate">
                              {formatSunoDisplayTitle(item.title)}
                            </span>
                          </h3>
                        </div>
                        
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <span className="truncate">
                              {getPlaylistItemCreatorName(item)}
                            </span>
                          </div>
                          {isUnavailable && (
                            <span className="text-[10px] text-red-400 font-bold bg-red-400/10 px-1.5 py-0.5 rounded w-fit pb-0">
                              원곡자가 비공개로 전환했습니다.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center pr-2 ml-2">
                        {isPlaylistItemUnplayed(item) && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#7FBD75] shadow-[0_0_10px_rgba(255,128,0,0.65)] shrink-0 mr-3"
                          />
                        )}
                        {playlistSortMode === 'custom' && (
                          <div className="flex flex-col items-center mr-3 gap-1">
                            <button 
                              onClick={() => { if (index > 0) handleCustomSort(item, items[index - 1]); }}
                              disabled={index === 0}
                              className={`p-1 rounded-sm ${index === 0 ? 'text-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button 
                              onClick={() => { if (index < items.length - 1) handleCustomSort(item, items[index + 1]); }}
                              disabled={index === items.length - 1}
                              className={`p-1 rounded-sm ${index === items.length - 1 ? 'text-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => { if (!isUnavailable) handleToggleLike(item); }}
                          disabled={isUnavailable}
                          className={`flex items-center gap-1 text-xs font-medium mr-3 p-1.5 rounded-lg transition-colors ${
                            isUnavailable ? 'text-white/20 cursor-not-allowed' : likeData.likedByMe ? 'text-red-500 hover:bg-red-500/10' : 'text-white/40 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {likeData.likedByMe ? (
                            <Heart className="w-4 h-4 fill-current" />
                          ) : (
                            <Heart className="w-4 h-4" />
                          )}
                          <span>{likeData.likeCount}</span>
                        </button>
                        
                        <div className="relative">
                          <button 
                            data-floating-menu="true"
                            data-playlist-more-menu-button="true"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistItemContextMenuPosition(null);
                              if (multiSelectMode) {
                                openBulkMenuFromButton(e.currentTarget);
                                return;
                              }
                              setActivePlaylistItemMenu(activePlaylistItemMenu === item.id ? null : item.id!);
                              setActiveColorMenu(null);
                            }}
                            className={`p-2 -mr-2 transition-colors ${multiSelectMode ? 'text-[#7FBD75] hover:text-[#7FBD75]/80' : 'rounded-full text-white/40 hover:text-white'}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activePlaylistItemMenu === item.id && (
                            <div
                              data-floating-menu="true"
                              data-more-menu-panel="true"
                              className={`absolute w-40 max-h-[calc(100vh-24px)] bg-[#2a2a2a] rounded-xl shadow-xl overflow-y-auto z-20 border border-black/15 text-sm py-1 ${playlistItemContextMenuPosition?.id === item.id ? '' : 'right-0 top-8'}`}
                              style={playlistItemContextMenuPosition?.id === item.id ? {
                                top: playlistItemContextMenuPosition.top,
                                left: playlistItemContextMenuPosition.left,
                              } : undefined}
                              onContextMenu={(event) => event.preventDefault()}
                            >
                              <button 
                                disabled={isUnavailable}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isUnavailable) return;
                                  handleShowPlaylistItemDetails(item); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className={isUnavailable ? blockedPlaylistActionClass : normalPlaylistActionClass}
                              >
                                <span className="flex items-center gap-2"><Info className="w-4 h-4 opacity-70" />디테일</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enterMultiSelectWith(selection);
                                  setActivePlaylistItemMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#7FBD75]/10 flex items-center justify-between group text-white/80 hover:text-[#7FBD75]"
                              >
                                <span className="flex items-center gap-2"><CheckSquare className="w-4 h-4 opacity-70" />선택</span>
                              </button>
                              <button 
                                disabled={isUnavailable}
                                onClick={async (e) => { 
                                  e.stopPropagation(); 
                                  if (isUnavailable) return;
                                  if (!item.audioUrl) { showToast("다운로드할 오디오 URL이 없습니다."); return; }
                                  if (item.sourceType === 'shared_track' && !user) { showToast("로그인이 필요합니다."); return; }
                                  if (item.sourceType === 'shared_track') {
                                    const isPublic = await ensureSharedItemIsPublic(item.sourceId, false);
                                    if (!isPublic) { showToast("원곡자가 비공개로 전환하여 다운로드할 수 없습니다."); return; }
                                  }
                                  handleDownload(item.audioUrl, formatSunoDisplayTitle(item.title)); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className={isUnavailable ? blockedPlaylistActionClass : normalPlaylistActionClass}
                              >
                                <span className="flex items-center gap-2"><Download className="w-4 h-4 opacity-70" />다운로드</span>
                              </button>
                              <button 
                                disabled={isUnavailable}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isUnavailable) return;
                                  if (!item.appliedKeywords || Object.keys(item.appliedKeywords).length === 0) {
                                    showToast("적용할 곡 설정 정보가 없습니다."); return;
                                  }
                                  handleApplyNext(item, item); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className={isUnavailable ? blockedPlaylistActionClass : "w-full text-left px-4 py-2 flex items-center justify-between group text-[#8A4EAD] hover:text-[#A567CF] hover:bg-transparent"}
                              >
                                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 opacity-90" />다음곡에 적용</span>
                              </button>
                              <button 
                                disabled={isUnavailable}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isUnavailable) return;
                                  const fakeItem = { ...item, id: item.sourceId, trackId: item.sourceId, duration: item.duration, audio_url: item.audioUrl, image_url: item.imageUrl, ownerNickname: item.ownerNickname, creatorNickname: item.creatorNickname, creatorDisplayId: getPlaylistItemCreatorName(item), ownerEmail: item.ownerEmail, creatorEmail: item.creatorEmail, isPlaylistItem: true };
                                  setSharePopupInfo({ group: fakeItem, item: fakeItem, idx: undefined, mode: 'default' });
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className={isUnavailable ? blockedPlaylistActionClass : normalPlaylistActionClass}
                              >
                                <span className="flex items-center gap-2"><Share2 className="w-4 h-4 opacity-70" />공유</span>
                              </button>
                              {!isShared && activePlaylistSection !== 'shared' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleTogglePlaylistItemFavorite(item); setActivePlaylistItemMenu(null); }}
                                  className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
                                >
                                  <span className="flex items-center gap-2"><Star className={`w-4 h-4 opacity-70 ${playlistFavoriteActive ? 'fill-yellow-400 text-yellow-400' : ''}`} />{playlistFavoriteActive ? '즐겨찾기 해제' : '즐겨찾기'}</span>
                                </button>
                              )}
                              <button 
                                disabled={isUnavailable}
                                onClick={(e) => { e.stopPropagation(); if (isUnavailable) return; handleMoveToOtherPlaylist(item); setActivePlaylistItemMenu(null); }}
                                className={isUnavailable ? blockedPlaylistActionClass : normalPlaylistActionClass}
                              >
                                <span className="flex items-center gap-2"><FolderOutput className="w-4 h-4 opacity-70" />폴더 이동</span>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(item); setActivePlaylistItemMenu(null); }}
                                className="w-full text-left px-4 py-2 hover:bg-red-400/10 text-red-400 font-bold transition-colors"
                              >
                                <span className="flex items-center gap-2"><Trash2 className="w-4 h-4 opacity-70" />리스트 삭제</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                      {hasMorePlaylistItems && (
                        <div className="flex justify-center pt-2 pb-4" data-selection-keep="true">
                          <button
                            type="button"
                            data-selection-keep="true"
                            onPointerDown={(event) => { if (multiSelectMode) event.stopPropagation(); }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPlaylistVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, items.length));
                            }}
                            className="px-8 py-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] font-bold transition-all border border-[var(--border-color)] flex items-center gap-2 group shadow-[var(--shadow-md)]"
                          >
                            <span className="text-[#7FBD75] text-xl leading-none group-hover:rotate-90 transition-transform">+</span>
                            {`더보기 (${Math.max(0, items.length - playlistVisibleCount)}곡 남음)`}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border-t border-black/15 mt-3">
                <Music className="w-12 h-12 text-[#7FBD75]/40 mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  {activePlaylistSection === 'normal' ? '아직 저장된 곡이 없습니다.' : '아직 저장된 공유곡이 없습니다.'}
                </h2>
                <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
                  {activePlaylistSection === 'normal' 
                    ? '뮤직 스페이스에서 플레이리스트 저장을 눌러 곡을 추가하세요.' 
                    : '공유받은 곡에서 플레이리스트 저장을 누르면 여기에 추가됩니다.'}
                </p>
                <button
                  onClick={() => setLibraryViewMode('workspace')}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                >
                  뮤직 스페이스로 이동
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {shareToastInfo && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3 rounded-full bg-white text-black shadow-2xl pointer-events-none text-center ${multiSelectMode && selectedTrackCount > 0 ? 'bottom-[7.75rem] md:bottom-[8.75rem]' : 'bottom-24'}`}
          >
            <Share2 className="w-4 h-4 text-[#7FBD75] shrink-0" />
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">{shareToastInfo}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {sharePopupInfo && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/25" onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-black/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-black tracking-tight text-white mb-1">공유 설정</h2>
                <p className="text-xs text-white/40 font-medium lowercase">공유할 방법을 선택해주세요.</p>
              </div>
              
              {sharePopupInfo.mode === 'default' ? (
                <div className="space-y-6">
                  <button
                    onClick={handlePublicShare}
                    className="w-full py-4 bg-[#7FBD75] text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-[#7FBD75]/90 transition-all shadow-lg shadow-[#7FBD75]/18"
                  >
                    <Share2 className="w-5 h-5" /> 링크 공유하기
                  </button>
                  
                  {canManageSharePrivacy(sharePopupInfo) && (
                    <div className="pt-4 border-t border-black/15">
                      <div className="text-[10px] text-white/30 mb-3 font-bold uppercase tracking-widest text-center">공개 범위 설정</div>
                      <div className="flex gap-2">
                        {[
                          { id: 'public', label: '공개', active: sharePopupInfo.group?.isPublic, action: handlePublicStatus, color: 'green' },
                          { id: 'private', label: '비공개', active: !sharePopupInfo.group?.isPublic, action: handlePrivateShare, color: 'red' }
                        ].map(btn => (
                          <button
                            key={btn.id}
                            onClick={btn.action}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                              btn.active 
                                ? btn.color === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-white/5 text-white/40 border-black/15 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <button
                    onClick={() => handlePlatformShare('copy')}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-lg"
                  >
                    <Share2 className="w-5 h-5" /> 공유하기
                  </button>

                  <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                    {[
                      { id: 'kakao', label: '카카오톡', icon: MessageCircle, bgColor: 'bg-[#FEE500]', iconColor: 'text-[#3C1E1E]', disabled: !(window as any).Kakao?.isInitialized() },
                      { id: 'email', label: '이메일', icon: Mail, bgColor: 'bg-white/10', iconColor: 'text-white' },
                      { id: 'facebook', label: 'Facebook', icon: Facebook, bgColor: 'bg-[#1877F2]', iconColor: 'text-white' },
                      { id: 'twitter', label: 'X (Twitter)', icon: Twitter, bgColor: 'bg-black border border-white/20', iconColor: 'text-white' },
                      { id: 'telegram', label: '텔레그램', icon: Send, bgColor: 'bg-[#0088cc]', iconColor: 'text-white' },
                    ].map(platform => (
                      <button
                        key={platform.id}
                        disabled={platform.disabled}
                        onClick={() => handlePlatformShare(platform.id)}
                        className={`flex flex-col items-center gap-2 group transition-opacity ${platform.disabled ? 'opacity-30 cursor-not-allowed' : 'opacity-100'}`}
                      >
                        <div className={`w-12 h-12 rounded-xl ${platform.bgColor} flex items-center justify-center transition-all group-hover:scale-110 shadow-lg`}>
                          <platform.icon className={`w-6 h-6 ${platform.iconColor}`} />
                        </div>
                        <span className="text-[10px] font-bold text-white/50 group-hover:text-white transition-colors text-center">
                          {platform.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setSharePopupInfo(prev => prev ? { ...prev, mode: 'default' } : null)}
                    className="w-full py-3 text-xs text-white/50 hover:text-white transition-all font-bold tracking-tight"
                  >
                    기본 설정으로 돌아가기
                  </button>
                </div>
              )}
              
              <button
                onClick={closeModal}
                className="w-full py-3 text-white/20 text-[10px] font-black uppercase tracking-widest hover:text-white/60 transition-all mt-4"
              >
                닫기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {multiSelectMode && selectedTrackCount > 0 && !bulkMoveModalOpen && !bulkShareModalOpen && (
          <motion.div
            data-selection-keep="true"
            data-floating-menu="true"
            data-selection-action-bar="true"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-5 left-1/2 z-[170] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-[34px] border border-white/10 bg-[#242424]/78 px-3 py-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl favorite-keyword-strip md:bottom-7 md:gap-3 md:px-5 md:py-3"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {isLibraryTrashMode ? (
              <>
                <button
                  type="button"
                  onClick={selectAllVisibleTracks}
                  className="flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[82px] md:px-3"
                >
                  <CheckSquare className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">전체선택</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkRestoreSelectedFromTrash}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <RefreshCw className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">복구</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkPermanentDeleteSelectedFromTrash}
                  className="flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-red-500/10 md:min-w-[82px] md:px-3"
                >
                  <Trash2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">영구삭제</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); setLibrarySelectionMoreOpen(false); setBulkMenuState(null); showToast('아직 준비중입니다.'); }}
                  onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onTouchStart={(event) => event.stopPropagation()}
                  data-selection-keep="true"
                  data-floating-menu="true"
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <MoreVertical className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">더보기</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleLibrarySelectionMove}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <FolderOutput className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">이동</span>
                </button>
                <button
                  type="button"
                  onClick={handleLibrarySelectionLock}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <Lock className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">잠금</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setLibrarySelectionMoreOpen(false); setBulkShareModalOpen(true); setBulkMenuState(null); }}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <Share2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">공유</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-red-500/10 md:min-w-[72px] md:px-3"
                >
                  <Trash2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">삭제</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); setLibrarySelectionMoreOpen(false); setBulkMenuState(null); showToast('아직 준비중입니다.'); }}
                  onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onTouchStart={(event) => event.stopPropagation()}
                  data-selection-keep="true"
                  data-floating-menu="true"
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <MoreVertical className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">더보기</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkMenuState && multiSelectMode && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              data-selection-keep="true" data-floating-menu="true" data-more-menu-panel="true" className="fixed z-[9999] w-56 bg-[var(--bg-secondary)] border border-[#7FBD75]/22 rounded-xl shadow-2xl py-2 overflow-hidden pointer-events-auto"
              style={{ top: bulkMenuState.top, right: bulkMenuState.right }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2 text-[11px] font-bold text-[#7FBD75] border-b border-black/15">
                선택한 {selectedTrackCount}곡
              </div>

              {isLibraryTrashMode ? (
                <>
                  <button
                    onClick={selectAllVisibleTracks}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                  >
                    <CheckSquare className="w-4 h-4" />
                    전체선택
                  </button>

                  <button
                    onClick={clearMultiSelect}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                    선택해제
                  </button>

                  <button
                    onClick={handleBulkRestoreSelectedFromTrash}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    복구
                  </button>

                  <button
                    onClick={handleBulkPermanentDeleteSelectedFromTrash}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-red-500/10 transition-all text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    영구 삭제
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={selectAllVisibleTracks}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                  >
                    <CheckSquare className="w-4 h-4" />
                    전체선택
                  </button>

                  <button
                    onClick={clearMultiSelect}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                    선택해제
                  </button>

                  <button
                    disabled={hasUnavailableSharedSelection}
                    onClick={handleBulkDownload}
                    className={hasUnavailableSharedSelection ? blockedBulkActionClass : normalBulkActionClass}
                  >
                    <Download className="w-4 h-4" />
                    다운로드
                  </button>

                  <button
                    disabled={hasUnavailableSharedSelection}
                    onClick={() => {
                      if (hasUnavailableSharedSelection) { showToast('비공개로 전환된 공유곡은 공유할 수 없습니다.'); return; }
                      setBulkMenuState(null); setBulkShareModalOpen(true);
                    }}
                    className={hasUnavailableSharedSelection ? blockedBulkActionClass : normalBulkActionClass}
                  >
                    <Share2 className="w-4 h-4" />
                    공유
                  </button>

                  {!isSharedView && libraryViewMode !== 'sharedPlaylist' && selectedTrackList.some((selection) => selection.context !== 'sharedPlaylist' && (selection.item as any)?.sourceType !== 'shared_track') && (
                    <button
                      onClick={handleBulkFavorite}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                    >
                      <Star className="w-4 h-4" />
                      즐겨찾기
                    </button>
                  )}

                  {(libraryViewMode !== 'sharedPlaylist' || isSharedView) && (
                    <button
                      disabled={hasUnavailableSharedSelection}
                      onClick={handleBulkPlaylistSave}
                      className={hasUnavailableSharedSelection ? blockedBulkActionClass : normalBulkActionClass}
                    >
                      <FolderOutput className="w-4 h-4" />
                      플레이리스트 저장
                    </button>
                  )}

                  {(libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') && (
                    <button
                      disabled={hasUnavailableSharedSelection}
                      onClick={() => {
                        if (hasUnavailableSharedSelection) { showToast('비공개로 전환된 공유곡은 폴더 이동할 수 없습니다.'); return; }
                        setBulkMenuState(null); setBulkMoveModalOpen(true);
                      }}
                      className={hasUnavailableSharedSelection ? blockedBulkActionClass : normalBulkActionClass}
                    >
                      <FolderOutput className="w-4 h-4" />
                      폴더 이동
                    </button>
                  )}

                  {!isSharedView && (
                    <button
                      onClick={handleBulkDeleteSelected}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-red-500/10 transition-all text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      {libraryViewMode === 'workspace' ? '선택삭제(휴지통)' : '리스트 삭제'}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkShareModalOpen && multiSelectMode && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/25" onClick={() => setBulkShareModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-black/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-black tracking-tight text-white mb-1">선택한 곡 공유</h2>
                <p className="text-xs text-white/40 font-medium">선택한 {selectedTrackCount}곡에 적용할 공유 방식을 선택해주세요.</p>
              </div>

              <div className="space-y-3">
                {!isSharedView && libraryViewMode !== 'sharedPlaylist' && canBulkManageSharePrivacy() && (
                  <>
                    <button
                      onClick={handleBulkAllPublic}
                      className="w-full py-4 bg-[#7FBD75] text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-[#7FBD75]/90 transition-all shadow-lg shadow-[#7FBD75]/18"
                    >
                      <Globe2 className="w-5 h-5" /> All 공개
                    </button>
                    <button
                      onClick={handleBulkPrivateShare}
                      className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-black/20"
                    >
                      <X className="w-5 h-5" /> All 비공개
                    </button>
                  </>
                )}

                <button
                  onClick={handleBulkAllLinkShare}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-lg"
                >
                  <Share2 className="w-5 h-5" /> All 링크공유하기
                </button>
              </div>

              <button
                onClick={() => setBulkShareModalOpen(false)}
                className="w-full py-3 text-white/20 text-[10px] font-black uppercase tracking-widest hover:text-white/60 transition-all mt-4"
              >
                닫기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistSavePicker && (
          <motion.div
            data-selection-keep="true"
            data-floating-menu="true"
            className={`fixed inset-0 z-[220] flex items-end justify-center bg-black/55 px-4 backdrop-blur-sm md:items-center ${multiSelectMode && selectedTrackCount > 0 ? 'pb-[128px] md:pb-[142px]' : 'pb-6 md:pb-0'}`}
            onClick={() => { setPlaylistSavePicker(null); setPlaylistSaveCreateTitle(null); }}
          >
            <motion.div
              data-selection-keep="true"
              data-floating-menu="true"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 0, scale: 1 }}
              transition={{ duration: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-[#7FBD75]/25 bg-[#181818] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C7F7BD]/75">playlist folder</p>
                  <h3 className="mt-1 text-lg font-black text-white">플레이리스트 저장</h3>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    {playlistSavePicker.isShared ? '공유 받은 곡 플레이리스트를 선택하세요.' : '저장할 플레이리스트를 선택하세요.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPlaylistSavePicker(null); setPlaylistSaveCreateTitle(null); }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/55 transition-all hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {playlistSavePicker.playlists.map((playlist) => {
                  const selectedId = playlistSavePicker.isShared ? selectedSharedPlaylistId : selectedNormalPlaylistId;
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() => savePlaylistPickerTargets(playlist)}
                      className={`flex h-12 items-center justify-between rounded-2xl border px-4 text-sm font-bold transition-all ${selectedId === playlist.id ? 'border-[#7FBD75]/45 bg-[#7FBD75]/22 text-white' : 'border-white/10 bg-white/[0.035] text-white/72 hover:border-[#7FBD75]/32 hover:text-white'}`}
                    >
                      <span className="inline-flex items-center gap-2"><FolderOutput className="h-4 w-4 text-[#C7F7BD]" />{playlist.title}</span>
                      {selectedId === playlist.id && <CheckSquare className="h-4 w-4 text-[#C7F7BD]" />}
                    </button>
                  );
                })}

                {playlistSaveCreateTitle === null ? (
                  <button
                    type="button"
                    onClick={() => setPlaylistSaveCreateTitle('')}
                    className="mt-1 flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-[#7FBD75]/35 bg-[#7FBD75]/8 px-4 text-sm font-black text-[#C7F7BD] transition-all hover:bg-[#7FBD75]/14 hover:text-white"
                  >
                    <Plus className="h-4 w-4" /> 새 폴더 만들기
                  </button>
                ) : (
                  <div className="mt-1 flex h-12 items-center gap-2 rounded-2xl border border-[#7FBD75]/35 bg-black/20 px-3">
                    <input
                      type="text"
                      value={playlistSaveCreateTitle}
                      onChange={(event) => setPlaylistSaveCreateTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitCreateAndSavePlaylist();
                        if (event.key === 'Escape') setPlaylistSaveCreateTitle(null);
                      }}
                      placeholder="새 폴더명"
                      maxLength={20}
                      autoFocus
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                    />
                    <button
                      type="button"
                      onClick={commitCreateAndSavePlaylist}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7FBD75]/18 text-[#C7F7BD] transition-all hover:bg-[#7FBD75]/28 hover:text-white"
                      aria-label="새 폴더 생성 후 저장"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaylistSaveCreateTitle(null)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/45 transition-all hover:text-white"
                      aria-label="새 폴더 생성 취소"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkMoveModalOpen && multiSelectMode && (
          <div data-selection-keep="true" data-floating-menu="true" className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/25" onClick={() => setBulkMoveModalOpen(false)}>
            <motion.div
              data-selection-keep="true"
              data-floating-menu="true"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ duration: 0.08 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-black/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white">폴더 이동</h2>
                  <p className="text-xs text-white/40 mt-1">선택한 {selectedTrackCount}곡을 이동할 폴더를 선택해주세요.</p>
                </div>
                <button onClick={() => setBulkMoveModalOpen(false)} className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {(() => {
                  const lists = activePlaylistSection === 'shared' ? actualSharedPlaylists : actualNormalPlaylists;
                  const availableLists = lists.filter(p => !(p as any).isFallback && p.id !== activePlaylistId);
                  if (availableLists.length === 0) {
                    return <div className="px-4 py-8 text-center text-sm text-white/40">이동할 수 있는 다른 폴더가 없습니다.</div>;
                  }
                  return availableLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => handleBulkMoveToPlaylist(list.id!)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-black/15 text-left text-sm font-bold text-white/80 hover:text-white transition-all"
                    >
                      {list.title}
                    </button>
                  ));
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMenuState && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              data-floating-menu="true" data-more-menu-panel="true" className="absolute z-[9999] w-48 bg-[var(--bg-secondary)] border border-black/20 rounded-xl shadow-2xl py-2 overflow-hidden pointer-events-auto"
              style={{
                top: activeMenuState.position.top,
                left: activeMenuState.position.left,
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const isFailed = activeMenuState.group?.status === 'failed';
                return [
                  { icon: Info, label: '디테일', action: () => {
                    const creatorMeta = resolveCreatorSnapshot(activeMenuState.group, activeMenuState.item, { fallbackToCurrentUser: !isSharedView });
                    setShowDetails({ ...activeMenuState.group, ...creatorMeta, item: activeMenuState.item, itemIndex: activeMenuState.idx });
                    setActiveMenuState(null);
                  } },
                  { icon: CheckSquare, label: '선택', action: () => {
                    enterMultiSelectWith(buildWorkspaceSelection(activeMenuState.group, activeMenuState.item, activeMenuState.idx));
                    setActiveMenuState(null);
                  } },
                  filter !== 'trash' && !isFailed ? { 
                    icon: Download, 
                    label: '다운로드', 
                    action: () => { 
                      const title = getTitle(activeMenuState.item, activeMenuState.group, activeMenuState.idx);
                      handleDownload(activeMenuState.audioUrl, title); 
                      setActiveMenuState(null); 
                    } 
                  } : null,
                  filter !== 'trash' && !isFailed ? { icon: RefreshCw, label: '다음곡에 적용', highlight: true, action: () => { handleApplyNext(activeMenuState.group, activeMenuState.item); setActiveMenuState(null); } } : null,
                  filter !== 'trash' && !isFailed ? { icon: Share2, label: isSharedView ? '공유하기' : '공유', action: () => { isSharedView ? handleShareCurrentPage() : handleShare(activeMenuState.group, activeMenuState.item, activeMenuState.idx); setActiveMenuState(null); } } : null,
                  !isSharedView && filter !== 'trash' && !isFailed ? { icon: Star, label: activeMenuState.group?.favorite ? '즐겨찾기 해제' : '즐겨찾기', filled: Boolean(activeMenuState.group?.favorite), action: () => { handleToggleWorkspaceFavorite(activeMenuState.group); setActiveMenuState(null); } } : null,
                  filter !== 'trash' && !isFailed ? { icon: FolderOutput, label: '플레이리스트 저장', action: () => { void openPlaylistSavePicker([{ group: activeMenuState.group, item: activeMenuState.item, audioUrl: activeMenuState.audioUrl, idx: activeMenuState.idx }]); } } : null,
                  !isSharedView && filter !== 'trash' ? { icon: Trash2, label: '삭제(휴지통)', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'hide'); setActiveMenuState(null); }, danger: true } : null,
                  !isSharedView && filter === 'trash' ? { icon: RefreshCw, label: '복구', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'restore'); setActiveMenuState(null); } } : null,
                  !isSharedView && filter === 'trash' ? { icon: Trash2, label: '영구 삭제', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'permanentDelete'); setActiveMenuState(null); }, danger: true } : null,
                ];
              })().filter(Boolean).map((m: any, i) => (
                <button
                  key={i}
                  onClick={m.action}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-all ${m.highlight ? 'text-[#8A4EAD] hover:text-[#A567CF] hover:bg-transparent' : 'hover:bg-white/5'} ${m.danger ? 'text-red-400' : ''}`}
                >
                  <m.icon className={`w-4 h-4 ${m.filled ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  {m.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistConfirmAction && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/35"
            onClick={() => {
              if (!isPlaylistConfirming) setPlaylistConfirmAction(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] overflow-hidden rounded-3xl border border-black/20 bg-[var(--bg-secondary)] shadow-2xl"
            >
              <div className="px-5 pt-5 pb-4 border-b border-black/15">
                <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border ${playlistConfirmAction.danger ? 'border-red-400/25 bg-red-400/10 text-red-400' : 'border-[#7FBD75]/25 bg-[#7FBD75]/10 text-[#7FBD75]'}`}>
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-center text-lg font-black text-white tracking-tight">
                  {playlistConfirmAction.title}
                </h3>
                <p className="mt-2 text-center text-sm leading-relaxed text-white/55">
                  {playlistConfirmAction.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-black/10">
                <button
                  type="button"
                  disabled={isPlaylistConfirming}
                  onClick={() => setPlaylistConfirmAction(null)}
                  className="h-11 rounded-2xl border border-black/20 bg-white/5 text-sm font-bold text-white/65 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isPlaylistConfirming}
                  onClick={async () => {
                    if (!playlistConfirmAction) return;
                    setIsPlaylistConfirming(true);
                    try {
                      await playlistConfirmAction.onConfirm();
                      setPlaylistConfirmAction(null);
                    } finally {
                      setIsPlaylistConfirming(false);
                    }
                  }}
                  className={`h-11 rounded-2xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${playlistConfirmAction.danger ? 'bg-red-500 hover:bg-red-500/90 shadow-lg shadow-red-500/15' : 'bg-[#7FBD75] hover:bg-[#7FBD75]/90 shadow-lg shadow-[#7FBD75]/15'}`}
                >
                  {isPlaylistConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                  {playlistConfirmAction.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <SunoTrackDetailModal
        open={!!showDetails}
        track={showDetails}
        onClose={closeModal}
        onEdit={(detailTrack) => {
          handleApplyNext(detailTrack?.parent || detailTrack, detailTrack?.item || detailTrack?.sourceItem || detailTrack);
          setShowDetails(null);
        }}
      />

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25" onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[#7FBD75]/28 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex flex-col items-center text-center">
                 <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                 </div>
                 <h3 className="text-xl font-bold mb-2">
                   {deleteTarget.action === 'permanentDelete' ? '이 곡을 영구 삭제할까요?' : 
                    deleteTarget.action === 'restore' ? '이 곡을 복구할까요?' : 
                    '이 곡을 휴지통으로 이동할까요?'}
                 </h3>
                 <p className="text-sm text-[var(--text-secondary)] mb-6">
                   {deleteTarget.action === 'permanentDelete' ? '이 작업은 앱에서 복구할 수 없습니다.' : 
                    deleteTarget.action === 'restore' ? '복구된 곡은 다시 라이브러리에 표시됩니다.' : 
                    '휴지통에서 나중에 복구하거나 영구 삭제할 수 있습니다.'}
                 </p>
                 
                 {deleteError && (
                   <div className="w-full text-xs text-red-400 bg-red-500/10 px-4 py-2 rounded-xl mb-4 border border-red-500/20">
                     {deleteError}
                   </div>
                 )}
                 
                 <div className="flex w-full gap-3">
                   <button
                     onClick={closeModal}
                     disabled={isDeleting}
                     className="flex-1 py-3 px-4 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white disabled:opacity-50"
                   >
                     취소
                   </button>
                   <button
                     onClick={confirmDelete}
                     disabled={isDeleting}
                     className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
                       deleteTarget.action === 'permanentDelete' ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' :
                       deleteTarget.action === 'restore' ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20' :
                       'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                     }`}
                   >
                     {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                      deleteTarget.action === 'permanentDelete' ? '영구 삭제' : 
                      deleteTarget.action === 'restore' ? '복구' : '휴지통으로 이동'}
                   </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
