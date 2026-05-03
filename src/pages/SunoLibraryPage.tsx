import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Home, Music, RefreshCw, Loader2, AlertCircle, 
  Search, Filter, PlayCircle, MoreVertical, Download, 
  Share2, Star, Trash2, Info, ChevronRight, X, Play,
  Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX,
  Twitter, Facebook, Mail, Link, Copy, Send, MessageCircle, Edit2, Heart, FolderOutput, Globe2, CheckSquare, Square, ListChecks, Palette
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, collectionGroup, where, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
const WORKSPACE_PAGE_SIZE = 30;

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

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center transition-all border border-white/10 ${
        unavailable
          ? 'opacity-50 cursor-not-allowed text-white/20'
          : isNowPlaying
            ? 'ring-[3px] ring-brand-orange/20 shadow-[0_12px_30px_rgba(249,115,22,0.22)] scale-[1.03]'
            : isActive
              ? 'ring-2 ring-brand-orange/45'
              : 'hover:ring-2 hover:ring-brand-orange/35 group-hover:scale-[1.03]'
      }`}
      title={durationLabel || undefined}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-white/5" />
      )}

      {isNowPlaying && <div className="pointer-events-none absolute inset-0 rounded-full suno-playing-ring" />}
      {isNowPlaying && <div className="pointer-events-none absolute inset-[2px] rounded-full border border-brand-orange/20 shadow-[0_0_18px_rgba(249,115,22,0.20)]" />}

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
        <span className="absolute right-0.5 bottom-0.5 z-10 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold leading-none text-white shadow-sm border border-white/10 tabular-nums">
          {durationLabel}
        </span>
      )}
    </button>
  );
}

export default function SunoLibraryPage() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusChecking, setStatusChecking] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
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
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [loadingPlaylistItems, setLoadingPlaylistItems] = useState(false);
  const [playlistSortMode, setPlaylistSortMode] = useState<'added' | 'genre' | 'custom'>('added');
  const [playlistColorFilter, setPlaylistColorFilter] = useState<string>('all');
  const [playlistSearchTerm, setPlaylistSearchTerm] = useState('');
  const [workspaceColorFilter, setWorkspaceColorFilter] = useState<string>('all');
  
  const [likesCache, setLikesCache] = useState<Record<string, { likeCount: number, likedByMe: boolean }>>({});
  const [sharedStatusCache, setSharedStatusCache] = useState<Record<string, { isPublic: boolean, checkedAt: number }>>({});
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [shareCreatorNameMap, setShareCreatorNameMap] = useState<Record<string, string>>({});

  const [renameModalArgs, setRenameModalArgs] = useState<{ playlist: Playlist, newTitle: string } | null>(null);
  const [moveModalArgs, setMoveModalArgs] = useState<{ item: PlaylistItem } | null>(null);

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
  const [filter, setFilter] = useState<'all' | 'completed' | 'favorite' | 'public' | 'private' | 'trash'>('all');
  const [workspaceVisibleCount, setWorkspaceVisibleCount] = useState(WORKSPACE_PAGE_SIZE);
  useEffect(() => {
    if (libraryViewMode === 'workspace') {
      setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
    }
  }, [libraryViewMode, searchTerm, filter, workspaceColorFilter]);

  useEffect(() => {
    setMultiSelectMode(false);
    setSelectedTrackMap({});
    setBulkMenuState(null);
  }, [libraryViewMode, selectedNormalPlaylistId, selectedSharedPlaylistId, activePlaylistSection, filter]);

  const [showDetails, setShowDetails] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  interface MenuState {
    id: string;
    position: { top: number; right: number };
    anchorEl?: HTMLElement | null;
    group: any;
    item: any;
    idx: number;
    audioUrl: string;
  }
  const [activeMenuState, setActiveMenuState] = useState<MenuState | null>(null);
  const [activePlaylistItemMenu, setActivePlaylistItemMenu] = useState<string | null>(null);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [multiSelectMode]);

  const computeFloatingMenuPosition = (anchorEl: HTMLElement, estimatedHeight = 280) => {
    const rect = anchorEl.getBoundingClientRect();
    const margin = 12;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

    // 메뉴는 클릭한 순간의 문서 좌표에 고정한다.
    // 스크롤 중 위치를 재계산하지 않아 화면을 따라오지 않게 한다.
    const topBelowViewport = rect.bottom + 8;
    const topAboveViewport = rect.top - estimatedHeight - 8;
    const viewportTop = topBelowViewport + estimatedHeight > window.innerHeight
      ? Math.max(margin, topAboveViewport)
      : Math.max(margin, topBelowViewport);
    const top = viewportTop + scrollTop;
    const right = Math.max(margin, window.innerWidth - rect.right);

    return { top, right };
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteAction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const checkingIdsRef = React.useRef<Set<string>>(new Set());
  const autoCheckCountsRef = React.useRef<Map<string, number>>(new Map());
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

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const trackId = searchParams.get('track');

    if (trackId) {
      setIsSharedView(true);
      setIsSharedPlayerMode(true);
      setSharedTrackLoading(true);

      const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        try {
          console.log("shared track search start", { trackId, isSharedView: true, hasUser: !!currentUser });
          
          if (currentUser) {
            const trackRef = doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId);
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
            setIsSharedOwner(currentUser?.uid === shareData.ownerUid);
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
        } catch (e) {
          console.error("shared track query failed", e);
          setTracks([]);
          setSharedError(true);
        } finally {
          setSharedTrackLoading(false);
          setLoading(false);
        }
      });
      return () => unsubAuth();
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        setTracks([]);
        return;
      }

      const q = query(
        collection(db, 'suno_tracks', currentUser.uid, 'tracks')
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        list.sort((a: any, b: any) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        setTracks(list);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching tracks:', error);
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

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
    
    const getNextNewFolderTitle = (playlists: Playlist[]) => {
      const titles = new Set(playlists.map(p => p.title));
      if (!titles.has("새폴더")) return "새폴더";

      let index = 2;
      while (titles.has(`새폴더 ${index}`)) {
        index++;
      }
      return `새폴더 ${index}`;
    };

    const newTitle = getNextNewFolderTitle(currentList);
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

  const activePlaylistId = activePlaylistSection === 'normal' ? selectedNormalPlaylistId : selectedSharedPlaylistId;

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
      const sharedSourceIdsToFetch = playlistItems
        .filter(p => p.sourceType === 'shared_track')
        .map(p => p.sourceId!)
        .filter(sid => {
           const cached = currentSharedCache[sid];
           return !cached || (now - cached.checkedAt > CACHE_EXPIRY_MS);
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

  }, [playlistItems, libraryViewMode, user]);

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

  const handleChangeColor = async (item: PlaylistItem, color: string | null) => {
    if (!user || !activePlaylistId) return;
    try {
      await updatePlaylistItemColor(user.uid, activePlaylistId, item.id!, color);
    } catch (e) {
      console.error(e);
      showToast("색상 변경에 실패했습니다.");
    }
  };

  const getWorkspaceItemColor = (group: any, idx: number): string => {
    const source = filter === 'favorite' ? group?.favoriteColorTags : group?.colorTags;
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
    if (!user) {
      showToast("로그인이 필요합니다.");
      return;
    }

    if (!group?.id) {
      showToast("색상 정보를 저장할 수 없습니다.");
      return;
    }

    try {
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
      const colorField = filter === 'favorite' ? 'favoriteColorTags' : 'colorTags';
      await updateDoc(trackRef, {
        [`${colorField}.${idx}`]: color || null,
        updatedAt: serverTimestamp()
      });
      setTracks((prev) => prev.map((track) => {
        if (track.id !== group.id) return track;
        return {
          ...track,
          [colorField]: {
            ...(track?.[colorField] || {}),
            [String(idx)]: color || null,
          }
        };
      }));
      if (filter === 'favorite') {
        group.favoriteColorTags = { ...(group.favoriteColorTags || {}), [String(idx)]: color || null };
      } else {
        group.colorTags = { ...(group.colorTags || {}), [String(idx)]: color || null };
      }
    } catch (e) {
      console.error('workspace color update failed:', e);
      showToast("색상 변경에 실패했습니다.");
    }
  };

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
    return item?.audioUrl || item?.streamAudioUrl || item?.audio_url || group?.audioUrl || group?.streamAudioUrl || '';
  };

  const getTitle = (item: any, group: any, idx: number) => {
    return item?.title || item?.name || group?.title || `Suno Track ${idx + 1}`;
  };

  const getImageUrl = (item: any, group: any) => {
    return item?.imageUrl || item?.image_url || group?.imageUrl || '';
  };

  const getDuration = (item: any, group: any) => {
    const rawVal = item?.duration ?? item?.durationSeconds ?? item?.metadata?.duration ?? item?.metadata?.durationSeconds ?? group?.duration;
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

  const hasMoreWorkspaceTracks = libraryViewMode === 'workspace' && workspaceVisibleCount < filteredTracks.length;

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
    if (isSharedView || !user) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      
      const eligibleGroups = tracks.filter(group => {
        if (group.status === 'failed') return false;

        const count = autoCheckCountsRef.current.get(group.id) || 0;
        if (count >= 25) return false;

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
        
        const now = Date.now();
        if (now - createdTime < 10000) return false; // Initial wait 10 seconds (Changed from 30s)

        if (checkingIdsRef.current.has(group.id)) return false;

        return true;
      });

      eligibleGroups.forEach(async (group) => {
        const id = group.id;
        checkingIdsRef.current.add(id);
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
          
          if (!res.ok) {
            console.warn(`Auto check failed for ${id}`);
          }
        } catch (e) {
          console.warn(`Auto check error for ${id}:`, e);
        } finally {
          checkingIdsRef.current.delete(id);
        }
      });
    }, 20000); // 20 seconds interval

    return () => clearInterval(intervalId);
  }, [tracks, user, isSharedView]);

  const checkStatus = async (trackId: string, taskId: string) => {
    if (!taskId) {
      alert('taskId가 없어 상태 확인을 할 수 없습니다.');
      return;
    }
    if (checkingIdsRef.current.has(trackId)) {
      return;
    }

    try {
      checkingIdsRef.current.add(trackId);
      setStatusChecking(trackId);
      const user = auth.currentUser;

      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ trackId, taskId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`상태 확인 실패: ${data.error || 'unknown error'}`);
        return;
      }

      if (data.status === 'completed') {
        alert('생성 완료되었습니다.');
      } else if (data.status === 'failed') {
        alert('생성에 실패했습니다.');
      } else {
        alert('아직 생성 중입니다.');
      }
    } catch (error) {
      console.error(error);
      alert('상태 확인 중 오류가 발생했습니다.');
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
  };

  const getVisiblePlaylistItemsForSelection = () => {
    const normalizedPlaylistSearch = playlistSearchTerm.trim().toLowerCase();
    let items = playlistItems.filter((item) => {
      if (playlistColorFilter === 'all') return true;
      if (playlistColorFilter === 'gray' && !item.colorTag) return true;
      return item.colorTag === playlistColorFilter;
    });

    if (normalizedPlaylistSearch) {
      items = items.filter((item) => {
        const searchable = [
          item.title,
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
    const { group } = sharePopupInfo;
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
      navigate(`/?applyPending=1&t=${Date.now()}`);
    }, 700);
  };

  const handleSavePlaylist = async (group: any, item: any, url: string, idx: number) => {
    if (!user) {
      showToast("로그인이 필요합니다.");
      return;
    }

    const isShared = Boolean(isSharedView || group?.sourceType === 'shared_track' || item?.sourceType === 'shared_track');

    try {
      await ensureDefaultPlaylists(user.uid);
    } catch (e) {
      console.error("Failed to ensure default playlists", e);
    }

    let targetPlaylist: Playlist | undefined;
    try {
      const dbLists = await getPlaylistsByType(user.uid, isShared ? "shared" : "normal");
      targetPlaylist = dbLists[0];
    } catch (e) {
      console.error("Failed to fetch target playlists", e);
    }

    if (!targetPlaylist?.id || (targetPlaylist as any).isFallback) {
      showToast(`저장할 ${isShared ? '공유 받은 곡 ' : ''}플레이리스트가 없습니다.`);
      return;
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
      showToast("저장할 오디오 URL이 없습니다.");
      return;
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
      itemData.genreLabels = labels;
    }

    try {
      await addPlaylistItem(user.uid, targetPlaylist.id!, itemData);
      showToast(`'${targetPlaylist.title}' 플레이리스트에 저장되었습니다.`);
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
        showToast("이미 이 플레이리스트에 저장된 곡입니다.");
      } else {
        showToast("플레이리스트 저장에 실패했습니다.");
      }
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
      title: item.title || selection.title,
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
    for (const selection of selectedTrackList) {
      if (selection.context === 'workspace') {
        await handleSavePlaylist(selection.group, selection.item, selection.audioUrl, selection.idx);
      } else {
        const { group, item, idx } = getBulkShareTarget(selection);
        await handleSavePlaylist(group, item, selection.audioUrl, idx ?? 0);
      }
    }
    setBulkMenuState(null);
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
    const targets = selectedTrackList.filter((selection) => selection.context !== 'workspace' && (selection.item as any)?.id);
    if (targets.length === 0) {
      showToast('이동할 플레이리스트 곡이 없습니다.');
      return;
    }

    let moved = 0;
    for (const selection of targets) {
      try {
        await movePlaylistItem(user.uid, activePlaylistId, targetPlaylistId, selection.item as PlaylistItem);
        moved += 1;
      } catch (e: any) {
        if (e?.message !== 'DUPLICATE') console.error('bulk move failed:', e);
      }
    }

    setBulkMoveModalOpen(false);
    setBulkMenuState(null);
    clearMultiSelect();
    showToast(moved > 0 ? `${moved}곡을 폴더 이동했습니다.` : '이미 대상 폴더에 있는 곡입니다.');
  };

  const handleBulkDeleteSelected = () => {
    if (!user || selectedTrackCount === 0) return;

    const hasWorkspace = selectedTrackList.some((selection) => selection.context === 'workspace');
    const title = hasWorkspace ? '선택한 곡을 휴지통으로 이동' : '선택한 곡을 리스트에서 삭제';
    const message = hasWorkspace
      ? '선택한 워크스페이스 곡을 휴지통으로 이동할까요?'
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
        }
      }

      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      setDeleteError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isModalOpen = !!sharePopupInfo || !!showDetails || !!deleteTarget || !!renameModalArgs || !!moveModalArgs || !!bulkShareModalOpen || !!bulkMoveModalOpen;

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
      push(applied?.tempo);
      push(applied?.bpm);
      
      push(requestPayload?.genre);
      push(requestPayload?.subGenre);
      push(requestPayload?.style);
      push(requestPayload?.sound);
      push(requestPayload?.mood);
      push(requestPayload?.theme);
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
      title: item.title || 'Untitled',
      status: item.sourceType === 'shared_track' ? '공유받은 곡' : '일반곡',
      createdAt: item.addedAt,
      taskId: item.sourceId,
      style: extractKeywordStyleTextForDetails(item, applied, reqPayload),
      prompt: normalizeDetailText(item.prompt || applied?.prompt || applied?.detailLayer || reqPayload?.prompt) || '',
      lyrics: extractActualLyricsForDetails(item, applied, reqPayload),
      audioUrl: item.audioUrl || '',
      streamAudioUrl: item.audioUrl || '',
      requestPayload: reqPayload || applied,
      creatorDisplayId: getPlaylistItemCreatorName(item),
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
          handleSavePlaylist(parent, workspaceItem || parent, track.url || '', itemIndex);
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

  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-32 text-[var(--text-primary)]"
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-floating-menu="true"]')) return;
        if (activeMenuState || activePlaylistItemMenu || activeColorMenu || bulkMenuState) {
          setActiveMenuState(null);
          setActivePlaylistItemMenu(null);
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
              className="bg-[#2a2a2a] w-full max-w-sm rounded-2xl flex flex-col overflow-hidden border border-white/10"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
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
                  className="w-full bg-[#1a1a1a] text-white rounded-xl px-4 py-3 outline-none border border-white/5 focus:border-brand-orange/50 transition-colors"
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
              <div className="p-4 bg-[#1a1a1a]/50 flex justify-end gap-2 border-t border-white/5">
                <button className="px-4 py-2 font-bold text-white/50 hover:text-white transition-colors" onClick={() => setRenameModalArgs(null)}>취소</button>
                <button className="px-4 py-2 font-bold bg-brand-orange text-white rounded-xl hover:bg-brand-orange/90 transition-colors" onClick={async () => {
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
              className="bg-[#2a2a2a] w-full max-w-sm rounded-2xl flex flex-col overflow-hidden border border-white/10 max-h-[80vh]"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
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
              <div className="p-4 bg-[#1a1a1a]/50 flex justify-end gap-2 border-t border-white/5 shrink-0">
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
              className="w-full max-w-sm rounded-[2rem] bg-[#1f1f1f] border border-white/10 shadow-2xl p-7 text-center"
            >
              <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-brand-orange/20 text-brand-orange flex items-center justify-center">
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
                  className="w-full py-4 rounded-2xl bg-brand-orange text-white font-black text-lg shadow-lg shadow-brand-orange/20 hover:bg-brand-orange/90 transition-all"
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

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-4 py-2.5 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn transition-all shrink-0 flex items-center gap-2"
            >
              <Home className="w-4 h-4" />홈
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <div className="flex gap-[5px] items-end justify-center w-8 h-8 text-brand-orange">
                  <div className="w-[6px] h-[22px] border-[2px] border-current rounded-[3px] opacity-80" />
                  <div className="w-[6px] h-[26px] border-[2px] border-current rounded-[3px]" />
                  <div className="w-[6px] h-[22px] border-[2px] border-current rounded-[3px] transform origin-bottom -rotate-12 translate-x-[2px] opacity-90" />
                </div>
                {isSharedView ? '공유된 음악' : 'Suno Library'}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {isSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : 'Suno API로 생성한 곡을 조회하고 재생합니다.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center self-end md:self-center">
          {!isSharedView && (
            <button
              onClick={() => navigate('/suno-api-settings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--bg-secondary)] border border-btn-border hover:bg-btn-hover transition-all"
            >
              <Settings className="w-4 h-4" />
              API 설정
            </button>
          )}
          </div>
        </motion.div>

        {/* Main Music Player relocated to GlobalPlayer */}

        {/* View Mode Tabs */}
        {!isSharedView && (
          <div className="flex gap-2 p-1 bg-white/5 backdrop-blur-md rounded-2xl w-fit border border-white/10 overflow-x-auto custom-scrollbar whitespace-nowrap max-w-full">
            <button
              onClick={() => setLibraryViewMode('workspace')}
              className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm ${libraryViewMode === 'workspace' ? 'bg-brand-orange text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              워크스페이스
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
              className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm ${libraryViewMode === 'playlist' ? 'bg-brand-orange text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
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
              className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm ${libraryViewMode === 'sharedPlaylist' ? 'bg-brand-orange text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              공유 플레이리스트
            </button>
          </div>
        )}

        {libraryViewMode === 'workspace' && (
          <>
            {/* Search & Filter */}
        {!isSharedView && (
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input 
                type="text" 
                placeholder="음악 제목이나 스타일 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[46px] pl-11 pr-4 rounded-2xl bg-[var(--bg-secondary)] border border-white/10 outline-none focus:border-brand-orange/50 transition-all text-sm"
              />
            </div>
            <div className="flex h-[46px] items-center gap-1.5 bg-[var(--bg-secondary)] border border-white/10 p-1 rounded-2xl shrink-0 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setWorkspaceColorFilter('all')}
                className={`h-9 text-xs font-bold px-4 transition-all rounded-xl ${workspaceColorFilter === 'all' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/70'}`}
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
                  title={opt.label}
                >
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color }}></div>
                </button>
              ))}
            </div>
            <div className="flex h-[46px] items-center bg-[var(--bg-secondary)] border border-white/10 p-1 rounded-2xl shrink-0">
              {(['all', 'completed', 'favorite', 'public', 'private', 'trash'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                    filter === f ? 'bg-brand-orange text-white' : 'hover:bg-white/5 opacity-60'
                  }`}
                >
                  {f === 'all' ? '전체' : f === 'completed' ? '완료' : f === 'favorite' ? '즐겨찾기' : f === 'public' ? '공개' : f === 'private' ? '비공개' : '휴지통'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading || sharedTrackLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
          </div>
        ) : (!user && !isSharedView) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
            <p className="text-[var(--text-secondary)]">Suno Library를 보려면 로그인해주세요.</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              {isSharedView ? <Info className="w-8 h-8 text-[var(--text-secondary)]/50" /> : <Music className="w-8 h-8 text-[var(--text-secondary)]/50" />}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isSharedView ? (sharedError ? '공유곡 조회 중 오류가 발생했습니다.' : '공유된 음악을 찾을 수 없습니다') : '검색 결과가 없습니다'}
            </h2>
            <p className="text-[var(--text-secondary)] mb-8">
              {isSharedView ? (sharedError ? '잠시 후 다시 시도해주세요.' : '비공개로 전환되었거나 삭제된 음악일 수 있습니다.') : '다른 검색어를 사용하거나 필터를 변경해보세요.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {displayedWorkspaceTracks.map((group) => {
              const dataItems = extractSunoData(group);
              const items = (dataItems.length > 0 ? dataItems : [{}])
                .map((item: any, idx: number) => ({ item, idx }))
                .filter(({ item, idx }: { item: any; idx: number }) => isWorkspaceItemVisible(group, item, idx));
              const dateStr = formatCreatedAt(group.createdAt);
              
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[var(--bg-secondary)] border border-white/10 rounded-2xl"
                >
                  {/* Group Header */}
                  <div className="px-4 md:px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3 bg-white/[0.02] rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-brand-orange">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold leading-tight">{group.title || 'Untitled Generation'}</h3>
                        <div className="flex items-center gap-2 mt-0.5 opacity-40 text-[10px]">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{items.length}곡</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 md:gap-3 flex-nowrap">
                      {getStatusBadge(group)}
                      {group.status !== 'completed' && group.status !== 'failed' && (
                        <button
                          onClick={() => checkStatus(group.id, group.taskId)}
                          disabled={statusChecking === group.id || !group.taskId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold border border-white/10 transition-all"
                        >
                          {statusChecking === group.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          상태 확인
                        </button>
                      )}
                      {!isSharedView && !group.taskId && <span className="text-[10px] opacity-30">Task ID 없음</span>}
                    </div>
                  </div>

                  {/* Tracks List */}
                  <div className="divide-y divide-white/5">
                    {items.map(({ item, idx }: { item: any; idx: number }) => {
                      const audioUrl = getAudioUrl(item, group);
                      const duration = getDuration(item, group);
                      const hasValidDuration = duration !== null;
                      const isFailed = group.status === 'failed';
                      const isCompleted = group.status === 'completed' && hasValidDuration;
                      const isPending = !isFailed && !isCompleted;
                      
                      const isCurrent = isCurrentWorkspaceItem(group, item, idx);
                      const selection = buildWorkspaceSelection(group, item, idx);
                      const isSelected = isTrackSelected(selection.key);
                      
                      return (
                        <div 
                          key={`${group.id}-${idx}`} 
                          className={`group flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 hover:bg-white/[0.03] transition-all cursor-pointer last:rounded-b-2xl ${isCurrent ? 'bg-brand-orange/5' : ''} ${item.hidden || group.hidden ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
                          onClick={(e) => {
                             if ((e.target as HTMLElement).closest('button')) return; // ignore if clicking buttons
                             if (multiSelectMode) {
                               toggleSelectedTrack(selection);
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
                              onClick={(e) => { e.stopPropagation(); toggleSelectedTrack(selection); }}
                              className={`flex h-9 w-9 shrink-0 items-center justify-center transition-all ${isSelected ? 'text-brand-orange' : 'text-white/35 hover:text-white/70'}`}
                              title={isSelected ? '선택 해제' : '선택'}
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
                              title="색상 지정"
                            />
                            {activeColorMenu === `workspace-${group.id}-${idx}` && (
                              <div data-floating-menu="true" className="absolute top-7 left-0 z-30 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-white/10" onClick={(e) => e.stopPropagation()}>
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
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            )}
                            <h4 className={`text-sm md:text-base font-bold truncate transition-colors ${isCurrent ? 'text-brand-orange' : 'text-[var(--text-primary)] group-hover:text-white'}`}>
                              {getTitle(item, group, idx)}
                            </h4>
                            {isFailed ? (
                              <span className="text-xs opacity-50 truncate flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                생성 실패: {group.apiStatusResponse?.msg || group.apiResponse?.msg || '알 수 없는 오류'}
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
                              className="w-2 h-2 rounded-full bg-brand-orange shadow-[0_0_10px_rgba(255,128,0,0.65)] shrink-0"
                              title="아직 재생하지 않은 완성곡"
                            />
                          )}

                          <div className="relative shrink-0 ml-2">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
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
                                    position: computeFloatingMenuPosition(e.currentTarget, 300),
                                    anchorEl: e.currentTarget,
                                    group,
                                    item,
                                    idx,
                                    audioUrl
                                  });
                                }
                              }}
                              className={`w-10 h-10 flex items-center justify-center transition-all ${multiSelectMode ? 'text-brand-orange hover:text-brand-orange/80' : 'rounded-full hover:bg-white/10 text-white/50'}`}
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
              <div className="flex flex-col items-center gap-2 pt-2 pb-4">
                <button
                  type="button"
                  onClick={() => setWorkspaceVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, filteredTracks.length))}
                  className="px-6 py-3 rounded-2xl border border-brand-orange/40 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange text-sm font-bold transition-all shadow-lg shadow-black/20"
                >
                  더보기 {Math.min(filteredTracks.length - workspaceVisibleCount, WORKSPACE_PAGE_SIZE)}곡
                </button>
                <p className="text-[11px] text-white/35">
                  {Math.min(workspaceVisibleCount, filteredTracks.length)} / {filteredTracks.length}개 묶음 표시 중
                </p>
              </div>
            )}
          </div>
        )}
          </>
        )}

        {(libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') && (
          <div className="space-y-6 mt-8">
            {/* Playlist Tabs Layout */}
            
            {libraryViewMode === 'playlist' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/50 px-2 uppercase tracking-wider">나의 플레이리스트</h3>
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar px-2 pb-2">
                {visibleNormalPlaylists.map((playlist) => (
                  <button 
                    key={playlist.id} 
                    onClick={() => {
                      setSelectedNormalPlaylistId(playlist.id!);
                      setActivePlaylistSection('normal');
                    }}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      activePlaylistSection === 'normal' && selectedNormalPlaylistId === playlist.id 
                        ? 'bg-brand-orange text-white border-brand-orange shadow-lg' 
                        : 'bg-[var(--bg-secondary)] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {playlist.title}
                  </button>
                ))}
                <button 
                  onClick={() => handleAddPlaylist('normal')}
                  className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all border bg-[var(--bg-secondary)] border-white/10 border-dashed text-white/40 hover:bg-white/5 hover:text-white hover:border-white/20 flex items-center gap-1"
                >
                  <span className="text-lg font-light leading-none">+</span>
                </button>
              </div>
            </div>
            )}

            {libraryViewMode === 'sharedPlaylist' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/50 px-2 uppercase tracking-wider">공유 받은 곡</h3>
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar px-2 pb-2">
                {visibleSharedPlaylists.map((playlist) => (
                  <button 
                    key={playlist.id} 
                    onClick={() => {
                      setSelectedSharedPlaylistId(playlist.id!);
                      setActivePlaylistSection('shared');
                    }}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-1.5 ${
                      activePlaylistSection === 'shared' && selectedSharedPlaylistId === playlist.id 
                        ? 'bg-brand-orange text-white border-brand-orange shadow-lg' 
                        : 'bg-[var(--bg-secondary)] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {playlist.title}
                  </button>
                ))}
                <button 
                  onClick={() => handleAddPlaylist('shared')}
                  className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all border bg-[var(--bg-secondary)] border-white/10 border-dashed text-white/40 hover:bg-white/5 hover:text-white hover:border-white/20 flex items-center gap-1"
                >
                  <span className="text-lg font-light leading-none">+</span>
                </button>
              </div>
            </div>
            )}

            {/* Selected Playlist Header */}
            {(() => {
              const activePlaylist = activePlaylistSection === 'normal' 
                ? visibleNormalPlaylists.find(p => p.id === selectedNormalPlaylistId)
                : visibleSharedPlaylists.find(p => p.id === selectedSharedPlaylistId);
                
              if (!activePlaylist) return null;
              const isFallback = (activePlaylist as any).isFallback;
              
              return (
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border border-white/5 rounded-2xl mb-4 mt-6 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/40 mb-1">
                      {activePlaylistSection === 'normal' ? '선택된 플레이리스트' : '선택된 공유 플레이리스트'}
                    </span>
                    <span className="text-base font-bold text-white flex items-center gap-1.5">
                      {activePlaylistSection === 'shared' && <Share2 className="w-4 h-4 text-brand-orange" />}
                      {activePlaylist.title}
                    </span>
                  </div>
                  {!isFallback && user && (
                    <div className="flex items-center gap-1">
                      {!(activePlaylist.id === (activePlaylistSection === 'normal' ? visibleNormalPlaylists[0]?.id : visibleSharedPlaylists[0]?.id)) && (
                        <button 
                          onClick={() => handleRenamePlaylist(activePlaylist)}
                          className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeletePlaylist(activePlaylist)}
                        className="p-2 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Playlist Controls (Search, Color Filter & Sort) */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-2 mt-2">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={playlistSearchTerm}
                  onChange={(e) => setPlaylistSearchTerm(e.target.value)}
                  placeholder="음악 제목이나 제작자 검색..."
                  className="w-full h-[46px] bg-[var(--bg-secondary)] border border-white/10 rounded-2xl pl-11 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-brand-orange/50 transition-all"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 lg:justify-end">
                {/* Color Filter */}
                <div className="flex h-[46px] items-center gap-1 bg-[var(--bg-secondary)] rounded-2xl p-1 px-2 border border-white/5 overflow-x-auto hide-scrollbar">
                  <button
                    onClick={() => setPlaylistColorFilter('all')}
                    className={`h-9 text-xs font-bold px-4 transition-all rounded-xl ${playlistColorFilter === 'all' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/70'}`}
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

                {/* Sort Options */}
                <div className="flex h-[46px] items-center gap-1 bg-[var(--bg-secondary)] rounded-2xl p-1 border border-white/5">
                  {[
                    { value: 'added', label: '저장순' },
                    { value: 'genre', label: '장르순' },
                    { value: 'custom', label: '사용자' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPlaylistSortMode(opt.value as any)}
                      className={`h-9 px-4 text-xs font-bold rounded-xl transition-all ${
                        playlistSortMode === opt.value
                          ? 'bg-white/10 text-white'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Playlist Items */}
            {loadingPlaylistItems ? (
              <div className="flex justify-center p-8 mt-2 border-t border-white/5">
                <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
              </div>
            ) : playlistItems.length > 0 ? (
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
                {(() => {
                  const normalizedPlaylistSearch = playlistSearchTerm.trim().toLowerCase();
                  let items = playlistItems.filter(item => {
                    if (playlistColorFilter === 'all') return true;
                    if (playlistColorFilter === 'gray' && !item.colorTag) return true;
                    return item.colorTag === playlistColorFilter;
                  });

                  if (normalizedPlaylistSearch) {
                    items = items.filter(item => {
                      const searchable = [
                        item.title,
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

                  return items.map((item, index) => {
                  const isActive = isCurrentPlaylistItem(item);
                  const isShared = item.sourceType === 'shared_track';
                  const sourceTrackForPlaylist = !isShared
                    ? getPlaylistItemSourceTrack(item)
                    : null;
                  const playlistFavoriteActive = Boolean(!isShared && (((sourceTrackForPlaylist as any)?.favorite) ?? ((item as any).favorite)));
                  const cachedSharedStatus = sharedStatusCache[item.sourceId];
                  const isUnavailable = isShared && cachedSharedStatus && cachedSharedStatus.isPublic === false;
                  
                  const globalId = getTrackGlobalId(item);
                  const likeData = likesCache[globalId] || { likeCount: 0, likedByMe: false };
                  const selection = buildPlaylistSelection(item);
                  const isSelected = isTrackSelected(selection.key);
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => {
                        if (multiSelectMode) toggleSelectedTrack(selection);
                      }}
                      className={`group relative flex items-center p-2 rounded-2xl transition-all border ${
                        isSelected ? 'border-brand-orange/50 bg-brand-orange/10' : isActive ? 'bg-brand-orange/10 border-brand-orange/30' : 'border-transparent hover:bg-white/5 hover:border-white/10'
                      } ${isUnavailable ? 'opacity-50 grayscale' : ''} ${multiSelectMode ? 'cursor-pointer' : ''}`}
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
                            const { getDoc } = await import('firebase/firestore');
                            const { doc } = await import('firebase/firestore');
                            try {
                              const shareRef = doc(db, 'suno_shares', item.sourceId);
                              const shareSnap = await getDoc(shareRef);
                              
                              if (!shareSnap.exists() || shareSnap.data().isPublic !== true) {
                                showToast("원곡자가 비공개로 전환하여 재생할 수 없습니다.");
                                setSharedStatusCache(prev => ({ ...prev, [item.sourceId]: { isPublic: false, checkedAt: Date.now() } }));
                                return;
                              } else {
                                setSharedStatusCache(prev => ({ ...prev, [item.sourceId]: { isPublic: true, checkedAt: Date.now() } }));
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }
                          
                          if (isActive) {
                            togglePlayPause();
                          } else {
                            const newQueue = playlistItems.map(p => ({
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
                                title: item.title,
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
                          onClick={(e) => { e.stopPropagation(); toggleSelectedTrack(selection); }}
                          className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center transition-all ${isSelected ? 'text-brand-orange' : 'text-white/35 hover:text-white/70'}`}
                          title={isSelected ? '선택 해제' : '선택'}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </button>
                      )}

                      {/* Main Info */}
                      <div className="flex flex-col ml-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 relative">
                          {/* Color Point */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveColorMenu(activeColorMenu === item.id ? null : item.id!); setActivePlaylistItemMenu(null); setBulkMenuState(null); }}
                            className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                            style={{ backgroundColor: item.colorTag === 'red' ? '#ef4444' : item.colorTag === 'orange' ? '#f97316' : item.colorTag === 'yellow' ? '#eab308' : item.colorTag === 'green' ? '#22c55e' : item.colorTag === 'blue' ? '#3b82f6' : item.colorTag === 'purple' ? '#a855f7' : '#6b7280' }}
                          />
                          {activeColorMenu === item.id && (
                            <div data-floating-menu="true" className="absolute top-6 left-0 z-10 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-white/10">
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
                          
                          <h3 className={`text-sm font-bold truncate ${isActive ? 'text-brand-orange' : 'text-white'}`}>
                            {item.title}
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
                            className="w-2 h-2 rounded-full bg-brand-orange shadow-[0_0_10px_rgba(255,128,0,0.65)] shrink-0 mr-3"
                            title="아직 재생하지 않은 완성곡"
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
                          onClick={() => handleToggleLike(item)}
                          className={`flex items-center gap-1 text-xs font-medium mr-3 p-1.5 rounded-lg transition-colors ${
                            likeData.likedByMe ? 'text-red-500 hover:bg-red-500/10' : 'text-white/40 hover:text-white hover:bg-white/5'
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
                            onClick={(e) => {
                              e.stopPropagation();
                              if (multiSelectMode) {
                                openBulkMenuFromButton(e.currentTarget);
                                return;
                              }
                              setActivePlaylistItemMenu(activePlaylistItemMenu === item.id ? null : item.id!);
                              setActiveColorMenu(null);
                            }}
                            className={`p-2 -mr-2 transition-colors ${multiSelectMode ? 'text-brand-orange hover:text-brand-orange/80' : 'rounded-full text-white/40 hover:text-white'}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activePlaylistItemMenu === item.id && (
                            <div data-floating-menu="true" className="absolute right-0 top-8 w-40 bg-[#2a2a2a] rounded-xl shadow-xl overflow-hidden z-20 border border-white/5 text-sm py-1">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleShowPlaylistItemDetails(item); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
                              >
                                <span className="flex items-center gap-2"><Info className="w-4 h-4 opacity-70" />상세정보</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enterMultiSelectWith(selection);
                                  setActivePlaylistItemMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-brand-orange/10 flex items-center justify-between group text-white/80 hover:text-brand-orange"
                              >
                                <span className="flex items-center gap-2"><CheckSquare className="w-4 h-4 opacity-70" />선택</span>
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (!item.audioUrl) { showToast("다운로드할 오디오 URL이 없습니다."); return; }
                                  if (item.sourceType === 'shared_track' && !user) { showToast("로그인이 필요합니다."); return; }
                                  handleDownload(item.audioUrl, item.title); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
                              >
                                <span className="flex items-center gap-2"><Download className="w-4 h-4 opacity-70" />다운로드</span>
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (!item.appliedKeywords || Object.keys(item.appliedKeywords).length === 0) {
                                    showToast("적용할 곡 설정 정보가 없습니다."); return;
                                  }
                                  handleApplyNext(item, item); 
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
                              >
                                <span className="flex items-center gap-2"><Music className="w-4 h-4 opacity-70" />다음곡에 적용</span>
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const fakeItem = { ...item, id: item.sourceId, trackId: item.sourceId, duration: item.duration, audio_url: item.audioUrl, image_url: item.imageUrl, ownerNickname: item.ownerNickname, creatorNickname: item.creatorNickname, creatorDisplayId: getPlaylistItemCreatorName(item), ownerEmail: item.ownerEmail, creatorEmail: item.creatorEmail, isPlaylistItem: true };
                                  setSharePopupInfo({ group: fakeItem, item: fakeItem, idx: undefined, mode: 'default' });
                                  setActivePlaylistItemMenu(null); 
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
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
                                onClick={(e) => { e.stopPropagation(); handleMoveToOtherPlaylist(item); setActivePlaylistItemMenu(null); }}
                                className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center justify-between group text-white/80 hover:text-white"
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
                })})()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center border-t border-white/5 mt-4">
                <Music className="w-12 h-12 text-brand-orange/40 mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  {activePlaylistSection === 'normal' ? '아직 저장된 곡이 없습니다.' : '아직 저장된 공유곡이 없습니다.'}
                </h2>
                <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
                  {activePlaylistSection === 'normal' 
                    ? '워크스페이스에서 플레이리스트 저장을 눌러 곡을 추가하세요.' 
                    : '공유받은 곡에서 플레이리스트 저장을 누르면 여기에 추가됩니다.'}
                </p>
                <button
                  onClick={() => setLibraryViewMode('workspace')}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                >
                  워크스페이스로 이동
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3 rounded-full bg-white text-black shadow-2xl pointer-events-none text-center"
          >
            <Share2 className="w-4 h-4 text-brand-orange shrink-0" />
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
              className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-black tracking-tight text-white mb-1">공유 설정</h2>
                <p className="text-xs text-white/40 font-medium lowercase">공유할 방법을 선택해주세요.</p>
              </div>
              
              {sharePopupInfo.mode === 'default' ? (
                <div className="space-y-6">
                  <button
                    onClick={handlePublicShare}
                    className="w-full py-4 bg-brand-orange text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-brand-orange/90 transition-all shadow-lg shadow-brand-orange/20"
                  >
                    <Share2 className="w-5 h-5" /> 링크 공유하기
                  </button>
                  
                  {canManageSharePrivacy(sharePopupInfo) && (
                    <div className="pt-4 border-t border-white/5">
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
                                : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'
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
        {bulkMenuState && multiSelectMode && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              data-floating-menu="true" className="absolute z-[9999] w-56 bg-[var(--bg-secondary)] border border-brand-orange/20 rounded-xl shadow-2xl py-2 overflow-hidden pointer-events-auto"
              style={{ top: bulkMenuState.top, right: bulkMenuState.right }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2 text-[11px] font-bold text-brand-orange border-b border-white/5">
                선택한 {selectedTrackCount}곡
              </div>

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

              {!isSharedView && libraryViewMode !== 'sharedPlaylist' && selectedTrackList.some((selection) => selection.context !== 'sharedPlaylist' && (selection.item as any)?.sourceType !== 'shared_track') && (
                <button
                  onClick={handleBulkFavorite}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                >
                  <Star className="w-4 h-4" />
                  즐겨찾기
                </button>
              )}

              <button
                onClick={handleBulkDownload}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>

              <button
                onClick={() => { setBulkMenuState(null); setBulkShareModalOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
              >
                <Share2 className="w-4 h-4" />
                공유
              </button>

              {(libraryViewMode !== 'sharedPlaylist' || isSharedView) && (
                <button
                  onClick={handleBulkPlaylistSave}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
                >
                  <FolderOutput className="w-4 h-4" />
                  플레이리스트 저장
                </button>
              )}

              {(libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist') && (
                <button
                  onClick={() => { setBulkMenuState(null); setBulkMoveModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all"
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
                  {libraryViewMode === 'workspace' ? '삭제(휴지통)' : '리스트 삭제'}
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkShareModalOpen && multiSelectMode && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/25" onClick={() => setBulkShareModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
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
                      className="w-full py-4 bg-brand-orange text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-brand-orange/90 transition-all shadow-lg shadow-brand-orange/20"
                    >
                      <Globe2 className="w-5 h-5" /> All 공개
                    </button>
                    <button
                      onClick={handleBulkPrivateShare}
                      className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-white/10"
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
        {bulkMoveModalOpen && multiSelectMode && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/25" onClick={() => setBulkMoveModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
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
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-left text-sm font-bold text-white/80 hover:text-white transition-all"
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
              data-floating-menu="true" className="absolute z-[9999] w-48 bg-[var(--bg-secondary)] border border-white/10 rounded-xl shadow-2xl py-2 overflow-hidden pointer-events-auto"
              style={{
                top: activeMenuState.position.top,
                right: activeMenuState.position.right,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { icon: Info, label: '상세정보', action: () => {
                  const creatorMeta = resolveCreatorSnapshot(activeMenuState.group, activeMenuState.item, { fallbackToCurrentUser: !isSharedView });
                  setShowDetails({ ...activeMenuState.group, ...creatorMeta, itemIndex: activeMenuState.idx });
                  setActiveMenuState(null);
                } },
                { icon: CheckSquare, label: '선택', action: () => {
                  enterMultiSelectWith(buildWorkspaceSelection(activeMenuState.group, activeMenuState.item, activeMenuState.idx));
                  setActiveMenuState(null);
                } },
                filter !== 'trash' ? { 
                  icon: Download, 
                  label: '다운로드', 
                  action: () => { 
                    const title = getTitle(activeMenuState.item, activeMenuState.group, activeMenuState.idx);
                    handleDownload(activeMenuState.audioUrl, title); 
                    setActiveMenuState(null); 
                  } 
                } : null,
                filter !== 'trash' ? { icon: Music, label: '다음곡에 적용', action: () => { handleApplyNext(activeMenuState.group, activeMenuState.item); setActiveMenuState(null); } } : null,
                filter !== 'trash' ? { icon: Share2, label: isSharedView ? '공유하기' : '공유', action: () => { isSharedView ? handleShareCurrentPage() : handleShare(activeMenuState.group, activeMenuState.item, activeMenuState.idx); setActiveMenuState(null); } } : null,
                !isSharedView && filter !== 'trash' ? { icon: Star, label: activeMenuState.group?.favorite ? '즐겨찾기 해제' : '즐겨찾기', filled: Boolean(activeMenuState.group?.favorite), action: () => { handleToggleWorkspaceFavorite(activeMenuState.group); setActiveMenuState(null); } } : null,
                filter !== 'trash' ? { icon: FolderOutput, label: '플레이리스트 저장', action: () => { handleSavePlaylist(activeMenuState.group, activeMenuState.item, activeMenuState.audioUrl, activeMenuState.idx); setActiveMenuState(null); } } : null,
                !isSharedView && filter !== 'trash' ? { icon: Trash2, label: '삭제(휴지통)', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'hide'); setActiveMenuState(null); }, danger: true } : null,
                !isSharedView && filter === 'trash' ? { icon: RefreshCw, label: '복구', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'restore'); setActiveMenuState(null); } } : null,
                !isSharedView && filter === 'trash' ? { icon: Trash2, label: '영구 삭제', action: () => { handleDeleteClick(activeMenuState.group.id, activeMenuState.idx, activeMenuState.group, 'permanentDelete'); setActiveMenuState(null); }, danger: true } : null,
              ].filter(Boolean).map((m: any, i) => (
                <button
                  key={i}
                  onClick={m.action}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all ${m.danger ? 'text-red-400' : ''}`}
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
              className="w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-secondary)] shadow-2xl"
            >
              <div className="px-5 pt-5 pb-4 border-b border-white/5">
                <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border ${playlistConfirmAction.danger ? 'border-red-400/25 bg-red-400/10 text-red-400' : 'border-brand-orange/25 bg-brand-orange/10 text-brand-orange'}`}>
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
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white/65 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
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
                  className={`h-11 rounded-2xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${playlistConfirmAction.danger ? 'bg-red-500 hover:bg-red-500/90 shadow-lg shadow-red-500/15' : 'bg-brand-orange hover:bg-brand-orange/90 shadow-lg shadow-brand-orange/15'}`}
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
      />

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25" onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-3xl shadow-2xl p-6"
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
