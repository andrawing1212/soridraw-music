import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { translateLyrics } from '../services/geminiService';
import MusicApiGenerateModal, { LanguageCode, SunoModelVersion } from '../components/MusicApiGenerateModal';
import { GENRES, MOODS, THEMES, SOUND_STYLES, INSTRUMENT_SOUNDS } from '../constants';
import {
  Music,
  Copy,
  Check,
  Search,
  X,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Plus,
  Menu,
  MoreVertical,
  Info,
  Share2,
  Star,
  FolderOutput,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Zap,
  Heart as HeartIcon,
  Lock,
  Unlock,
  Edit2,
  Filter,
  Link2,
  Link2Off,
  Play,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Settings,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { updatePlaylistItemColor } from '../services/playlistService';
import { getResolvedGenre, resolveKeywordsForDisplay, getKeywordMeta } from '../lib/songUtils';


const PROJECT_ID = 'soridraw-app-866a5';
const REGION = 'us-central1';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const SUNO_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_suno_api_key_registered';

const scopedApiStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;

const getCachedSunoApiStatus = (uid?: string | null) => {
  try {
    return localStorage.getItem(scopedApiStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';
  } catch {
    return false;
  }
};

const fetchFavoriteSunoApiKeyStatus = async (user?: User | null): Promise<boolean> => {
  if (!user?.uid) return false;
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BASE_URL}/getSunoApiKeyStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const result = await res.json().catch(() => null);
    if (res.ok) {
      const hasKey = Boolean(result && (result.hasSunoApiKey || result.hasMusicApiKey || result.registered || result.hasApiKey || result.exists));
      try {
        if (hasKey) localStorage.setItem(scopedApiStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
        else localStorage.removeItem(scopedApiStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
      } catch {
        // localStorage may be unavailable.
      }
      return hasKey;
    }
  } catch {
    // Network/server failures fall back to local hint.
  }
  return getCachedSunoApiStatus(user.uid);
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


function SunoUrlGuideCard({ compact = false, collapsible = false }: { compact?: boolean; collapsible?: boolean }) {
  const [isGuideExpanded, setIsGuideExpanded] = useState(() => {
    if (!collapsible) return true;
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });

  const showGuideContent = !collapsible || isGuideExpanded;

  return (
    <div className={cn(
      'rounded-[24px] border border-white/10 bg-white/[0.025] p-4',
      compact ? 'mt-3' : 'mt-4'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D8A4A2]/75">guide</div>
          <h5 className="mt-1 text-sm font-bold text-white">{showGuideContent ? '수노 링크 복사 방법' : '수노 URL 연결 방법'}</h5>
          {showGuideContent && (
            <p className="mt-1 text-xs leading-5 text-white/45">수노 곡 카드의 메뉴에서 공유 링크를 복사한 뒤, 이 입력칸에 그대로 붙여 넣으면 됩니다.</p>
          )}
        </div>
        {showGuideContent && (
          <button
            type="button"
            onClick={() => window.open('https://suno.com/create', '_blank', 'noopener,noreferrer')}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-[11px] font-semibold text-white/72 transition-all hover:border-[#D8A4A2]/35 hover:text-white"
          >
            SUNO 열기
          </button>
        )}
      </div>

      {showGuideContent && (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_132px]">
          <div className="space-y-2 text-xs text-white/62">
            <div className="flex gap-2"><span className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AC6B69]/16 text-[11px] font-bold text-[#D8A4A2]">1</span><span>수노에서 원하는 곡 카드의 <span className="font-semibold text-white/84">...</span> 메뉴를 누르세요.</span></div>
            <div className="flex gap-2"><span className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AC6B69]/16 text-[11px] font-bold text-[#D8A4A2]">2</span><span><span className="font-semibold text-white/84">Share → Copy Link</span> 순서로 링크를 복사하세요.</span></div>
            <div className="flex gap-2"><span className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AC6B69]/16 text-[11px] font-bold text-[#D8A4A2]">3</span><span>복사한 주소를 여기 입력하고 <span className="font-semibold text-white/84">저장</span>하면 됩니다.</span></div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <img src="/suno-copy-link-guide.png" alt="Suno 링크 복사 방법 예시" className="h-full w-full object-cover object-top" />
          </div>
        </div>
      )}

      {collapsible && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setIsGuideExpanded((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-[#AC6B69]/25 bg-[#AC6B69]/10 px-4 text-xs font-bold text-[#D8A4A2] transition-all hover:bg-[#AC6B69]/16 hover:text-white"
            aria-expanded={isGuideExpanded}
          >
            {isGuideExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {isGuideExpanded ? '접기' : '수노 URL 연결 방법'}
          </button>
        </div>
      )}
    </div>
  );
}


const getAppliedKeywordChipClass = (typeOrKey: string, isRandom = false) => {
  const normalized = String(typeOrKey || '').toLowerCase();

  if (normalized.includes('genre') || normalized === 'subgenre') {
    return 'border-[#AC5045]/25 bg-[#AC5045]/10 text-[#AC5045] shadow-[0_0_10px_rgba(172,80,69,0.08)]';
  }
  if (normalized.includes('style')) {
    return 'border-[#AC5045]/20 bg-[#AC5045]/8 text-[#D8A4A2] shadow-[0_0_10px_rgba(172,80,69,0.06)]';
  }
  if (normalized.includes('sound') || normalized.includes('instrument') || normalized.includes('point')) {
    return 'border-[#AC5045]/20 bg-[#AC5045]/8 text-[#D8A4A2] shadow-[0_0_10px_rgba(172,80,69,0.06)]';
  }
  if (normalized.includes('mood') || normalized.includes('atmosphere')) {
    return 'border-[#AC5045]/22 bg-[#AC5045]/10 text-[#D8A4A2] shadow-[0_0_10px_rgba(172,80,69,0.07)]';
  }
  if (normalized.includes('theme') || normalized.includes('topic')) {
    return 'border-[#AC5045]/22 bg-[#AC5045]/10 text-[#D8A4A2] shadow-[0_0_10px_rgba(172,80,69,0.07)]';
  }
  if (isRandom) {
    return 'border-[#AC5045]/30 bg-[#AC5045]/16 text-[#AC5045] font-bold';
  }
  return 'border-white/10 bg-white/[0.04] text-white/72';
};

function getSongGenreValues(song: any): string[] {
  return song?.appliedKeywords?.genre ?? [];
}

function getSongMoodValues(song: any): string[] {
  return song?.appliedKeywords?.mood ?? [];
}

function getSongThemeValues(song: any): string[] {
  return song?.appliedKeywords?.theme ?? [];
}

function getSongSituationSummary(song: any): string {
  return song?.appliedKeywords?.situationSummary || song?.appliedKeywords?.situation?.summary || '';
}

function getSongStyleValues(song: any): string[] {
  return song?.appliedKeywords?.style ?? [];
}

function getSongInstrumentSoundValues(song: any): string[] {
  return song?.appliedKeywords?.instrumentSound ?? [];
}

function getSongSubGenreValues(song: any): string[] {
  return song?.appliedKeywords?.subGenre ?? song?.appliedKeywords?.subGenreIds ?? [];
}

function getTimestampMs(value: any): number {
  if (!value) return 0;

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  if (typeof value?.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  if (typeof value?.seconds === 'number') {
    const millis = typeof value?.nanoseconds === 'number'
      ? value.seconds * 1000 + Math.floor(value.nanoseconds / 1_000_000)
      : value.seconds * 1000;
    return Number.isFinite(millis) ? millis : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  return 0;
}

function getFavoriteDetailCreatedAt(song: any): string {
  const timestamp = song?.createdAt ?? song?.timestamp ?? song?.updatedAt;
  const ms = getTimestampMs(timestamp);
  if (!ms) return '';

  try {
    return new Date(ms).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '';
  }
}


function getFavoriteDetailCreator(song: any, user?: User | null): string {
  const candidates = [
    song?.creatorDisplayId,
    song?.ownerNickname,
    song?.creatorNickname,
    song?.ownerName,
    song?.creatorName,
    song?.ownerDisplayName,
    song?.createdByName,
    song?.artist,
    song?.artistName,
    song?.author,
    song?.ownerEmail,
    song?.creatorEmail,
    user?.displayName,
    user?.email,
  ];
  const ownerUid = String(song?.ownerUid || song?.uid || '');
  for (const value of candidates) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    if (ownerUid && text === ownerUid) continue;
    if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) continue;
    return text;
  }
  return '';
}

function getFavoriteStructureText(song: any): string {
  if (!song?.appliedKeywords) return '구조 정보 없음';

  if (song.appliedKeywords.songStructure === 'custom') {
    const custom = song.appliedKeywords.customStructure ?? [];
    if (custom.length === 0) return '구조 정보 없음';
    return custom.map((section: any) => {
      if (section.section === 'Instrumental' && (section.tags ?? []).length > 0) {
        return `${section.section}: ${(section.tags ?? [])[0]}`;
      }
      return `${section.section}${(section.tags ?? []).length > 0 ? ` (${(section.tags ?? []).join(', ')})` : ''}`;
    }).join(' → ');
  }

  if (song.appliedKeywords.songStructure === '1') {
    return 'Intro → Verse 1 → Chorus / Drop → Outro';
  }

  if (song.appliedKeywords.songStructure === '2') {
    return 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro';
  }

  if (song.appliedKeywords.songStructure) {
    return 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro';
  }

  return '구조 정보 없음';
}

function inferForeignLyricTargetLanguage(text: string): string {
  const value = String(text || '').trim();
  if (!value) return 'English';

  if (/[ぁ-ゟ゠-ヿ]/.test(value)) return 'Japanese';
  if (/[一-鿿]/.test(value) && !/[ぁ-ゟ゠-ヿ]/.test(value)) return 'Chinese';
  if (/[가-힣]/.test(value) && !/[A-Za-zぁ-ゟ゠-ヿ一-鿿]/.test(value)) return 'English';
  if (/[А-Яа-яЁё]/.test(value)) return 'Russian';
  if (/[ก-๙]/.test(value)) return 'Thai';
  if (/[À-ÿ]/.test(value)) return 'the same foreign language as the existing foreign lyrics';
  return 'English';
}

function buildLyricContentOnlyTranslationTarget(targetLanguage: string): string {
  return `${targetLanguage}. Translate only the actual lyric content. Keep any section header line exactly unchanged, including bracketed or parenthesized labels such as [Intro], [Verse 1], [Chorus / Drop], (Intro), (Verse 1), and similar song-structure markers. Do not translate, rewrite, remove, or add section headers. Preserve all line breaks.`;
}

type FavoriteSunoLink = {
  url: string;
  title?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  durationText?: string | null;
  rank?: 1 | 2;
  updatedAt?: number;
  fetchedAt?: number;
};

type MusicNoteFolderMode = 'myNote' | 'sharedNote';
type MusicNoteFolder = { id: string; title: string; order?: number; isDefault?: boolean; createdAt?: number; updatedAt?: number };

const DEFAULT_MY_NOTE_FOLDERS: MusicNoteFolder[] = [
  { id: 'default', title: '기본', order: 1, isDefault: true },
  { id: '1', title: '1', order: 2 },
  { id: '2', title: '2', order: 3 },
  { id: '3', title: '3', order: 4 },
];

const DEFAULT_SHARED_NOTE_FOLDERS: MusicNoteFolder[] = [
  { id: 'default', title: '기본', order: 1, isDefault: true },
  { id: '1', title: '1', order: 2 },
  { id: '2', title: '2', order: 3 },
];

const normalizeMusicNoteFolders = (value: any, fallback: MusicNoteFolder[]): MusicNoteFolder[] => {
  const rawList = Array.isArray(value) ? value : [];
  // 저장된 폴더가 있으면 저장값을 기준으로 삼는다.
  // 그래야 기본 외 폴더(1, 2, 3)를 이름 변경/삭제했을 때 fallback이 다시 덮어쓰지 않는다.
  const defaultFolder = fallback.find((folder) => folder.id === 'default') || { id: 'default', title: '기본', order: 1, isDefault: true };
  const sourceList = rawList.length > 0 ? rawList : fallback;
  const sourceWithDefault = sourceList.some((folder) => folder?.id === 'default' || folder?.folderId === 'default')
    ? sourceList
    : [defaultFolder, ...sourceList];

  const merged = sourceWithDefault
    .filter((folder) => folder && typeof folder === 'object')
    .map((folder, index) => ({
      id: String(folder.id || folder.folderId || `folder-${index}`).trim(),
      title: String(folder.title || folder.name || '').trim(),
      order: Number.isFinite(Number(folder.order)) ? Number(folder.order) : index + 1,
      isDefault: Boolean(folder.isDefault || folder.id === 'default' || folder.folderId === 'default'),
      createdAt: Number.isFinite(Number(folder.createdAt)) ? Number(folder.createdAt) : undefined,
      updatedAt: Number.isFinite(Number(folder.updatedAt)) ? Number(folder.updatedAt) : undefined,
    }))
    .filter((folder) => folder.id && folder.title);

  const seen = new Set<string>();
  return merged
    .filter((folder) => {
      if (seen.has(folder.id)) return false;
      seen.add(folder.id);
      return true;
    })
    .sort((a, b) => {
      if (a.id === 'default') return -1;
      if (b.id === 'default') return 1;
      return (a.order || 999) - (b.order || 999);
    })
    .map((folder, index) => ({ ...folder, order: index + 1, isDefault: folder.id === 'default' || folder.isDefault }));
};

const getMusicNoteFolderIdFromSong = (song: any, mode: MusicNoteFolderMode): string => {
  if (!song) return '__unassigned__';
  const raw = mode === 'sharedNote'
    ? song.sharedNoteFolderId || song.sharedNoteFolder || song.noteSharedFolderId
    : song.noteFolderId || song.myNoteFolderId || song.favoriteFolderId || song.folderId;
  const normalized = String(raw || '').trim();
  if (normalized) return normalized;

  // 노트 스페이스에 저장된 곡을 마이 노트 기본 폴더로 자동 포함하지 않는다.
  // 사용자가 폴더 저장에서 직접 기본 폴더를 선택한 곡만 기본 폴더에 표시한다.
  return '__unassigned__';
};

const isFavoriteInTrash = (song: any): boolean => Boolean(song?.hidden === true || song?.favoriteHidden === true || song?.deletedAt || song?.trashedAt);


export default function FavoritesPage({ 
  favorites, 
  toggleFavorite, 
  updateFavorite,
  clearAllFavorites,
  unlockAllFavorites,
  lockAllFavorites,
  user,
  onHover,
  hoveredItem,
  onLongPressStart,
  onLongPressEnd,
  isFavoritesLoading = false
}: { 
  favorites: any[]; 
  toggleFavorite: (song: any) => void; 
  updateFavorite: (id: string, updates: Partial<any>) => void;
  clearAllFavorites: () => void;
  unlockAllFavorites: () => void;
  lockAllFavorites: () => void;
  user: User | null;
  onHover: (item: { id: string; label: string; labelKo?: string; description: string; descriptionKo?: string; _ts?: number } | null) => void;
  hoveredItem: { id: string; label: string; labelKo?: string; description: string; descriptionKo?: string; _ts?: number } | null;
  onLongPressStart: (item: { id: string; label: string; labelKo?: string; description: string; descriptionKo?: string }) => void;
  onLongPressEnd: () => void;
  isFavoritesLoading?: boolean;
}) {
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [musicNoteViewMode, setMusicNoteViewMode] = useState<'noteSpace' | 'myNote' | 'sharedNote'>('noteSpace');
  const [myNoteFolders, setMyNoteFolders] = useState<MusicNoteFolder[]>(DEFAULT_MY_NOTE_FOLDERS);
  const [sharedNoteFolders, setSharedNoteFolders] = useState<MusicNoteFolder[]>(DEFAULT_SHARED_NOTE_FOLDERS);
  const [selectedMyNoteFolderId, setSelectedMyNoteFolderId] = useState('default');
  const [selectedSharedNoteFolderId, setSelectedSharedNoteFolderId] = useState('default');
  const [musicNoteFolderPicker, setMusicNoteFolderPicker] = useState<{ mode: MusicNoteFolderMode; songIds: string[] } | null>(null);
  const [musicNoteFolderRenameArgs, setMusicNoteFolderRenameArgs] = useState<{ mode: MusicNoteFolderMode; folder: MusicNoteFolder; newTitle: string } | null>(null);
  const [musicNoteFolderDeleteArgs, setMusicNoteFolderDeleteArgs] = useState<{ mode: MusicNoteFolderMode; folder: MusicNoteFolder } | null>(null);
  const [musicNoteFolderDragging, setMusicNoteFolderDragging] = useState<{ mode: MusicNoteFolderMode; folderId: string } | null>(null);
  const musicNoteFolderButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const musicNoteFolderBarRefs = useRef<Record<MusicNoteFolderMode, HTMLDivElement | null>>({ myNote: null, sharedNote: null });
  const musicNoteFolderPressTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const musicNoteFolderDragRef = useRef<{
    mode: MusicNoteFolderMode;
    folderId: string;
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
  const musicNoteFolderSuppressClickRef = useRef<string | null>(null);
  const myNoteFoldersRef = useRef<MusicNoteFolder[]>(DEFAULT_MY_NOTE_FOLDERS);
  const sharedNoteFoldersRef = useRef<MusicNoteFolder[]>(DEFAULT_SHARED_NOTE_FOLDERS);
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'genre-1' | 'genre-2' | 'title-en' | 'title-ko' | 'locked-top' | 'locked-bottom'>('latest');
  const [favoriteTrashView, setFavoriteTrashView] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const sortPopupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [favoriteToastMessage, setFavoriteToastMessage] = useState<string | null>(null);
  const favoriteToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalLyricsKo, setOriginalLyricsKo] = useState('');
  const [originalLyricsEn, setOriginalLyricsEn] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const popupOpenedSongIdRef = useRef<string | null>(null);
  const activeFavoriteEditorSongIdRef = useRef<string | null>(null);
  const favoriteEditorReadySongIdRef = useRef<string | null>(null);
  const skipNextFavoriteDraftSaveRef = useRef(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState<'title' | 'lyrics-ko' | 'lyrics-en' | 'prompt' | null>(null);
  const [showFavoriteMusicApiModal, setShowFavoriteMusicApiModal] = useState(false);
  const [isFavoriteMusicApiGenerating, setIsFavoriteMusicApiGenerating] = useState(false);
  const [favoriteMusicApiMessage, setFavoriteMusicApiMessage] = useState<string | null>(null);
  const [isFavoriteMusicApiSectionExpanded, setIsFavoriteMusicApiSectionExpanded] = useState(false);
  const [hasFavoriteSunoApiKey, setHasFavoriteSunoApiKey] = useState<boolean>(() => getCachedSunoApiStatus(user?.uid));
  const [foreignTargetLanguage, setForeignTargetLanguage] = useState<string>('English');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedKoreanLyrics, setEditedKoreanLyrics] = useState('');
  const [editedEnglishLyrics, setEditedEnglishLyrics] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [sunoUrlEditorSong, setSunoUrlEditorSong] = useState<any | null>(null);
  const [sunoUrlInputs, setSunoUrlInputs] = useState<[string, string]>(['', '']);
  const [sunoUrlMainIndex, setSunoUrlMainIndex] = useState<0 | 1>(0);
  const [sunoUrlError, setSunoUrlError] = useState('');
  const [detailSunoUrlInputs, setDetailSunoUrlInputs] = useState<[string, string]>(['', '']);
  const [detailSunoUrlMainIndex, setDetailSunoUrlMainIndex] = useState<0 | 1>(0);
  const [detailSunoUrlError, setDetailSunoUrlError] = useState('');
  const detailScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const detailSunoUrlSectionRef = useRef<HTMLElement | null>(null);
  const pendingDetailSunoUrlScrollRef = useRef(false);
  const [isDetailSunoUrlHighlighted, setIsDetailSunoUrlHighlighted] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setHasFavoriteSunoApiKey(getCachedSunoApiStatus(user?.uid));
    fetchFavoriteSunoApiKeyStatus(user).then((hasKey) => {
      if (!isCancelled) setHasFavoriteSunoApiKey(hasKey);
    });
    return () => {
      isCancelled = true;
    };
  }, [user]);

  // 제목/장르 표시 정규화
  const getDisplaySubGenre = (song: any): string => {
    return getResolvedGenre(song);
  };

  const parseLegacyTitles = (song: any): { korean: string; english: string } => {
    const rawTitle = String(song?.title || '').trim();

    if (!rawTitle) {
      return { korean: '', english: '' };
    }

    const cleaned = rawTitle.replace(/^(\[[^\]]+\]\s*)+/g, '');

    const pipeParts = cleaned
      .split(/[|│]/)
      .map((v: string) => v.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    if (pipeParts.length >= 2) {
      const first = pipeParts[0];
      const second = pipeParts[1];
      const firstHasKorean = /[가-힣]/.test(first);
      const secondHasKorean = /[가-힣]/.test(second);

      if (firstHasKorean && !secondHasKorean) {
        return { korean: first, english: second };
      }

      if (!firstHasKorean && secondHasKorean) {
        return { korean: second, english: first };
      }

      return { korean: first, english: second };
    }

    const quotedParts = [...cleaned.matchAll(/'([^']+)'|\"([^\"]+)\"/g)]
      .map((match) => (match[1] || match[2] || '').trim())
      .filter(Boolean);

    if (quotedParts.length >= 2) {
      const first = quotedParts[0];
      const second = quotedParts[1];
      const firstHasKorean = /[가-힣]/.test(first);
      const secondHasKorean = /[가-힣]/.test(second);

      if (firstHasKorean && !secondHasKorean) {
        return { korean: first, english: second };
      }

      if (!firstHasKorean && secondHasKorean) {
        return { korean: second, english: first };
      }

      return { korean: first, english: second };
    }

    const single = cleaned.replace(/^['"]|['"]$/g, '').trim();
    if (/[가-힣]/.test(single)) {
      return { korean: single, english: '' };
    }

    return { korean: '', english: single };
  };

  const getNormalizedTitles = (song: any) => {
    const legacy = parseLegacyTitles(song);

    return {
      korean: String(song?.koreanTitle || '').trim() || legacy.korean,
      english: String(song?.englishTitle || '').trim() || legacy.english,
    };
  };

  const cleanTitlePart = (value: any): string => {
    return String(value || '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim();
  };

  const quoteTitlePart = (value: any): string => `'${cleanTitlePart(value) || 'Untitled'}'`;

  const getCombinedFavoriteTitle = (song: any): string => {
    const genre = getDisplaySubGenre(song);
    const genreLabel = genre ? `[${genre}] ` : '';
    const { korean, english } = getNormalizedTitles(song);
    const ko = cleanTitlePart(korean);
    const foreign = cleanTitlePart(english);

    if (ko && foreign && ko !== foreign) {
      return `${genreLabel}${quoteTitlePart(ko)} | ${quoteTitlePart(foreign)}`;
    }

    return `${genreLabel}${quoteTitlePart(ko || foreign || 'Untitled')}`;
  };

  const getFavoriteKoreanTitle = (song: any): string => {
    const { korean, english } = getNormalizedTitles(song);
    return quoteTitlePart(korean || english || 'Untitled');
  };

  const getFavoriteEnglishTitle = (song: any): string => {
    const { korean, english } = getNormalizedTitles(song);
    return quoteTitlePart(english || korean || 'Untitled');
  };

  // 1. 보관함 목록 카드 제목 렌더 (1줄 형식)
  const renderFavoriteListTitle = (song: any) => {
    const titleText = getCombinedFavoriteTitle(song);
    return (
      <div className="text-center font-bold">
        {getCombinedFavoriteTitle(song)}
      </div>
    );
  };

  // 2. 보관함 상세 팝업 제목 렌더 (2줄 형식 + 상시 노출 복사 버튼)
  const renderFavoriteDetailTitles = (song: any) => {
    const koLine = getFavoriteKoreanTitle(song);
    const enLine = getFavoriteEnglishTitle(song);

    const DetailActionCopyBtn = ({
      text,
      type,
      label,
    }: {
      text: string;
      type: string;
      label: string;
    }) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(text, type);
        }}
        onMouseEnter={() =>
          onHover({
            id: `copy-${type}`,
            label: `${label} 제목 복사`,
            description: `${label} 제목 한 줄을 복사합니다.`,
          })
        }
        onMouseLeave={() => {
          onHover(null);
          onLongPressEnd();
        }}
        onTouchStart={() =>
          onLongPressStart({
            id: `copy-${type}`,
            label: `${label} 제목 복사`,
            description: `${label} 제목 한 줄을 복사합니다.`,
          })
        }
        onTouchEnd={onLongPressEnd}
        className="inline-flex items-center gap-1.5 p-1 px-2 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] transition-all shrink-0 active:scale-95 border border-black/20 ml-2 shadow-sm"
        title={`${label} 복사`}
      >
        {copiedType === type ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 opacity-60" />
        )}
        <span className="text-[10px] font-bold opacity-70">{label}</span>
      </button>
    );

    return (
      <div className="relative w-full flex items-center justify-center min-h-[80px] md:min-h-[100px]">
        {/* 중앙 제목 영역 */}
        <div className="flex flex-col items-center justify-center gap-2 px-10 md:px-14 w-full overflow-hidden">
          <h2 className="text-[17px] md:text-[22px] font-bold text-[var(--text-primary)] leading-tight text-center break-keep">
            {koLine}
          </h2>
          {enLine && enLine !== koLine && (
            <h2 className="text-[13px] md:text-[16px] font-bold text-[var(--text-primary)]/70 leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full">
              {enLine}
            </h2>
          )}
        </div>

        {/* 우측 복사 버튼 그룹 - 세로 1열 고정 */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
          <DetailActionCopyBtn text={koLine} type="title-ko" label="KO" />
          {enLine && enLine !== koLine && (
            <DetailActionCopyBtn text={enLine} type="title-en" label="EN" />
          )}
        </div>
      </div>
    );
  };
      const getCombinedFavoriteCopyText = (song: any): string => {
        return getCombinedFavoriteTitle(song);
      };
      
  const isModified = selectedSong && (
    editedTitle !== originalTitle ||
    editedKoreanLyrics !== originalLyricsKo ||
    editedEnglishLyrics !== originalLyricsEn ||
    editedPrompt !== originalPrompt
  );
  const isTitleEditChanged = Boolean(selectedSong && editedTitle !== selectedSong.title);
  const isKoreanLyricsEditChanged = Boolean(selectedSong && editedKoreanLyrics !== selectedSong.lyrics.korean);
  const isForeignLyricsEditChanged = Boolean(selectedSong && editedEnglishLyrics !== selectedSong.lyrics.english);
  const isPromptEditChanged = Boolean(selectedSong && editedPrompt !== (selectedSong.prompt || ''));
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(0); // 0: none, 1: warning, 2: execute
  const [confirmUnlockAll, setConfirmUnlockAll] = useState(0);
  const [confirmLockAll, setConfirmLockAll] = useState(0);
  const [confirmDeleteSong, setConfirmDeleteSong] = useState(false);
  const [confirmToggleLock, setConfirmToggleLock] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; korean: string; english: string; prompt: string; isEditing: boolean; activeEditSection: 'title' | 'lyrics-ko' | 'lyrics-en' | 'prompt' | null; foreignTargetLanguage?: string }>>({});
  const favoriteDraftCommitRef = useRef(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [activeFavoriteMenuId, setActiveFavoriteMenuId] = useState<string | null>(null);
  const [favoriteColorMap, setFavoriteColorMap] = useState<Record<string, string>>({});
  const [activeFavoriteColorMenuId, setActiveFavoriteColorMenuId] = useState<string | null>(null);
  const [favoriteColorFilter, setFavoriteColorFilter] = useState<string>('all');
  const [, setFavoriteColorSyncTick] = useState(0);
  const [isFavoriteAdminUser, setIsFavoriteAdminUser] = useState(false);
  const lastFavoriteServerColorMapRef = useRef<Record<string, string>>({});
  const favoriteColorMapRef = useRef<Record<string, string>>({});
  const favoriteColorBaselineRef = useRef<string>('{}');
  const favoriteColorDirtyRef = useRef(false);
  const favoriteColorsAutoSyncingRef = useRef(false);
  const favoritesRef = useRef<any[]>(favorites || []);
  const favoriteUserRef = useRef<User | null>(user);
  const [lastSelectionAction, setLastSelectionAction] = useState<'none' | 'lock' | 'unlock'>('none');
  const [pendingSelectionAction, setPendingSelectionAction] = useState<'delete' | 'lock' | 'unlock' | null>(null);
  const [favoriteSelectionMoreOpen, setFavoriteSelectionMoreOpen] = useState(false);
  const recentlyUnlockedFavoriteIdsRef = useRef<Set<string>>(new Set());
  const selectionLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectionLongPressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const cardClickStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressNextCardClickRef = useRef(false);
  const selectionBeforeSelectAllRef = useRef<string[]>([]);
  const selectionHistoryPushedRef = useRef(false);
  const detailHistoryPushedRef = useRef(false);
  const placeholders = [
    "제목으로 검색해보세요...",
    "가사 내용으로 검색해보세요...",
    "장르나 키워드로 검색해보세요...",
    "분위기로 검색해보세요..."
  ];

  useEffect(() => {
    let cancelled = false;
    const loadAdminRole = async () => {
      if (!user?.uid) {
        if (!cancelled) setIsFavoriteAdminUser(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) setIsFavoriteAdminUser(snap.exists() && snap.data()?.role === 'admin');
      } catch (error) {
        console.warn('favorite admin role check failed', error);
        if (!cancelled) setIsFavoriteAdminUser(false);
      }
    };
    loadAdminRole();
    return () => { cancelled = true; };
  }, [user?.uid]);


  const FAVORITE_COLOR_OPTIONS = [
    { value: 'gray', color: '#6b7280', label: '회색' },
    { value: 'red', color: '#ef4444', label: '빨강' },
    { value: 'orange', color: '#f97316', label: '주황' },
    { value: 'yellow', color: '#eab308', label: '노랑' },
    { value: 'green', color: '#22c55e', label: '초록' },
    { value: 'blue', color: '#3b82f6', label: '파랑' },
    { value: 'purple', color: '#a855f7', label: '보라' },
  ];

  const getFavoriteColorValue = (song: any): string => {
    return favoriteColorMap[song?.id] || song?.favoriteColorTag || song?.colorTag || 'gray';
  };

  const getFavoriteColorHex = (songId: string, song?: any) => {
    const saved = song ? getFavoriteColorValue(song) : (favoriteColorMap[songId] || 'gray');
    return FAVORITE_COLOR_OPTIONS.find(c => c.value === saved)?.color || '#6b7280';
  };

  const showFavoriteToast = (message: string) => {
    if (favoriteToastTimerRef.current) {
      clearTimeout(favoriteToastTimerRef.current);
    }
    setFavoriteToastMessage(message);
    favoriteToastTimerRef.current = setTimeout(() => {
      setFavoriteToastMessage(null);
      favoriteToastTimerRef.current = null;
    }, 2200);
  };


  useEffect(() => {
    let cancelled = false;

    const loadMusicNoteFolders = async () => {
      if (!user?.uid) {
        setMyNoteFolders(DEFAULT_MY_NOTE_FOLDERS);
        setSharedNoteFolders(DEFAULT_SHARED_NOTE_FOLDERS);
        setSelectedMyNoteFolderId('default');
        setSelectedSharedNoteFolderId('default');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'user_structures', user.uid));
        if (cancelled) return;
        const data: any = snap.exists() ? snap.data() : {};
        const stored = data?.musicNoteFolders || {};
        const nextMy = normalizeMusicNoteFolders(stored.myNote || data?.myNoteFolders, DEFAULT_MY_NOTE_FOLDERS);
        const nextShared = normalizeMusicNoteFolders(stored.sharedNote || data?.sharedNoteFolders, DEFAULT_SHARED_NOTE_FOLDERS);
        setMyNoteFolders(nextMy);
        setSharedNoteFolders(nextShared);
        setSelectedMyNoteFolderId((prev) => nextMy.some((folder) => folder.id === prev) ? prev : 'default');
        setSelectedSharedNoteFolderId((prev) => nextShared.some((folder) => folder.id === prev) ? prev : 'default');
      } catch (error) {
        console.warn('load music note folders failed:', error);
        if (!cancelled) {
          setMyNoteFolders(DEFAULT_MY_NOTE_FOLDERS);
          setSharedNoteFolders(DEFAULT_SHARED_NOTE_FOLDERS);
        }
      }
    };

    loadMusicNoteFolders();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    myNoteFoldersRef.current = myNoteFolders;
  }, [myNoteFolders]);

  useEffect(() => {
    sharedNoteFoldersRef.current = sharedNoteFolders;
  }, [sharedNoteFolders]);

  useEffect(() => () => {
    if (musicNoteFolderPressTimerRef.current) window.clearTimeout(musicNoteFolderPressTimerRef.current);
    document.body.classList.remove('soridraw-folder-dragging');
  }, []);

  const persistMusicNoteFolders = async (mode: MusicNoteFolderMode, folders: MusicNoteFolder[]) => {
    if (!user?.uid) return;
    const normalized = normalizeMusicNoteFolders(folders, mode === 'sharedNote' ? DEFAULT_SHARED_NOTE_FOLDERS : DEFAULT_MY_NOTE_FOLDERS);
    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: {
        [mode]: normalized.map((folder, index) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order || index + 1,
          isDefault: Boolean(folder.isDefault || folder.id === 'default'),
          createdAt: folder.createdAt || Date.now(),
          updatedAt: Date.now(),
        })),
        updatedAt: Date.now(),
      },
    }, { merge: true });
  };

  const openMusicNoteFolderPicker = (songIds: string[], preferredMode?: MusicNoteFolderMode) => {
    const safeSongIds = Array.from(new Set(songIds.filter(Boolean)));
    if (safeSongIds.length === 0) return;
    const mode: MusicNoteFolderMode = preferredMode || (musicNoteViewMode === 'sharedNote' ? 'sharedNote' : 'myNote');
    setMusicNoteFolderPicker({ mode, songIds: safeSongIds });
    setActiveFavoriteMenuId(null);
  };

  const saveSongsToMusicNoteFolder = async (folderId: string) => {
    if (!user?.uid || !musicNoteFolderPicker) return;
    const picker = musicNoteFolderPicker;
    const mode = picker.mode;
    const folders = mode === 'sharedNote' ? sharedNoteFolders : myNoteFolders;
    const folder = folders.find((item) => item.id === folderId) || folders[0];
    if (!folder) return;

    const targetSongIds = Array.from(new Set(picker.songIds.filter(Boolean)));
    if (targetSongIds.length === 0) return;

    const updates = mode === 'sharedNote'
      ? { sharedNoteFolderId: folder.id, sharedNoteFolderTitle: folder.title, sharedNoteFolderUpdatedAt: Date.now() }
      : { noteFolderId: folder.id, noteFolderTitle: folder.title, noteFolderUpdatedAt: Date.now() };

    // 폴더를 누르는 순간 선택 UI를 즉시 닫고, 저장은 뒤에서 바로 진행한다.
    // 이렇게 해야 폴더 목록이 아래로 내려가는 중간 절차 없이 바로 이동된 것처럼 보인다.
    setMusicNoteFolderPicker(null);
    setFavoriteSelectionMoreOpen(false);
    if (isSelectionMode) exitSelectionMode('history');

    if (mode === 'sharedNote') {
      setMusicNoteViewMode('sharedNote');
      setSelectedSharedNoteFolderId(folder.id);
    } else {
      setMusicNoteViewMode('myNote');
      setSelectedMyNoteFolderId(folder.id);
    }

    try {
      await Promise.all(
        targetSongIds.map((id) => updateDoc(doc(db, 'favorites', id), updates))
      );
      showFavoriteToast(`${folder.title} 폴더에 저장했습니다.`);
    } catch (error) {
      console.error('save music note folder failed:', error);
      showFavoriteToast('폴더 저장에 실패했습니다.');
    }
  };

  const removeSongsFromCurrentMusicNoteFolder = async (songIds: string[], modeOverride?: MusicNoteFolderMode): Promise<boolean> => {
    if (!user?.uid) return false;
    const mode = modeOverride || (musicNoteViewMode === 'sharedNote' ? 'sharedNote' : musicNoteViewMode === 'myNote' ? 'myNote' : null);
    const safeSongIds = Array.from(new Set(songIds.filter(Boolean)));
    if (!mode || safeSongIds.length === 0) return false;

    const updates = mode === 'sharedNote'
      ? { sharedNoteFolderId: null, sharedNoteFolderTitle: null, sharedNoteFolderUpdatedAt: Date.now() }
      : { noteFolderId: null, noteFolderTitle: null, noteFolderUpdatedAt: Date.now() };

    try {
      await Promise.all(safeSongIds.map((id) => updateDoc(doc(db, 'favorites', id), updates)));
      showFavoriteToast(`${safeSongIds.length}곡을 현재 폴더에서 제거했습니다.`);
      return true;
    } catch (error) {
      console.error('remove songs from music note folder failed:', error);
      showFavoriteToast('폴더에서 제거하지 못했습니다.');
      return false;
    }
  };

  const moveSongsToFavoriteTrash = async (songIds: string[]): Promise<boolean> => {
    if (!user?.uid) return false;
    const safeSongIds = Array.from(new Set(songIds.filter(Boolean)));
    if (safeSongIds.length === 0) return false;

    try {
      await Promise.all(
        safeSongIds.map((id) => updateDoc(doc(db, 'favorites', id), {
          hidden: true,
          favoriteHidden: true,
          isPublic: false,
          deletedAt: serverTimestamp(),
          trashedAt: Date.now(),
        }))
      );
      showFavoriteToast(`${safeSongIds.length}곡을 휴지통으로 이동했습니다.`);
      return true;
    } catch (error) {
      console.error('move songs to favorite trash failed:', error);
      showFavoriteToast('휴지통 이동에 실패했습니다.');
      return false;
    }
  };

  const restoreSongsFromFavoriteTrash = async (songIds: string[]): Promise<boolean> => {
    if (!user?.uid) return false;
    const safeSongIds = Array.from(new Set(songIds.filter(Boolean)));
    if (safeSongIds.length === 0) return false;

    try {
      await Promise.all(
        safeSongIds.map((id) => updateDoc(doc(db, 'favorites', id), {
          hidden: false,
          favoriteHidden: false,
          deletedAt: null,
          trashedAt: null,
        }))
      );
      showFavoriteToast(`${safeSongIds.length}곡을 복구했습니다.`);
      return true;
    } catch (error) {
      console.error('restore songs from favorite trash failed:', error);
      showFavoriteToast('복구에 실패했습니다.');
      return false;
    }
  };

  const permanentlyDeleteFavoriteSongs = async (songIds: string[]): Promise<boolean> => {
    if (!user?.uid) return false;
    const safeSongIds = Array.from(new Set(songIds.filter(Boolean)));
    if (safeSongIds.length === 0) return false;

    try {
      await Promise.all(
        safeSongIds.map((id) => deleteDoc(doc(db, 'favorites', id)))
      );
      showFavoriteToast(`${safeSongIds.length}곡을 영구 삭제했습니다.`);
      return true;
    } catch (error) {
      console.error('permanently delete favorite songs failed:', error);
      showFavoriteToast('영구 삭제에 실패했습니다.');
      return false;
    }
  };

  const handleSelectionRestoreFromTrash = () => {
    if (selectedSongIds.length === 0) return;
    restoreSongsFromFavoriteTrash(selectedSongIds).then((restored) => {
      if (restored) {
        setFavoriteSelectionMoreOpen(false);
        exitSelectionMode();
      }
    });
  };

  const handleSelectionPermanentDeleteFromTrash = () => {
    if (selectedSongIds.length === 0) return;
    permanentlyDeleteFavoriteSongs(selectedSongIds).then((deleted) => {
      if (deleted) {
        setFavoriteSelectionMoreOpen(false);
        exitSelectionMode();
      }
    });
  };

  const deleteSongsByMusicNoteContext = async (songs: any[]): Promise<boolean> => {
    const deletableSongs = songs.filter((song) => song?.id && !song.isLocked);
    if (deletableSongs.length === 0) {
      showFavoriteToast(songs.length === 0 ? '삭제할 곡을 선택해주세요.' : '잠긴 곡은 삭제할 수 없습니다.');
      return false;
    }

    if (musicNoteViewMode === 'myNote' || musicNoteViewMode === 'sharedNote') {
      return removeSongsFromCurrentMusicNoteFolder(deletableSongs.map((song) => song.id), musicNoteViewMode);
    }

    return moveSongsToFavoriteTrash(deletableSongs.map((song) => song.id));
  };


  const normalizeFavoriteSunoLink = (link: any, index = 0): FavoriteSunoLink | null => {
    const rawUrl = String(link?.url || link?.sunoShareUrl || link?.sunoUrl || '').trim();
    if (!rawUrl) return null;

    const rankValue = Number(link?.rank);
    return {
      url: rawUrl,
      title: typeof link?.title === 'string' ? link.title : null,
      coverUrl: typeof link?.coverUrl === 'string' ? link.coverUrl : null,
      durationSeconds: typeof link?.durationSeconds === 'number' ? link.durationSeconds : null,
      durationText: typeof link?.durationText === 'string' ? link.durationText : null,
      rank: rankValue === 1 || rankValue === 2 ? rankValue as 1 | 2 : (index === 0 ? 1 : 2),
      updatedAt: typeof link?.updatedAt === 'number' ? link.updatedAt : undefined,
      fetchedAt: typeof link?.fetchedAt === 'number' ? link.fetchedAt : undefined,
    };
  };

  const getFavoriteSunoLinks = (song: any): FavoriteSunoLink[] => {
    const list = Array.isArray(song?.sunoLinks)
      ? song.sunoLinks.map((link: any, index: number) => normalizeFavoriteSunoLink(link, index)).filter(Boolean) as FavoriteSunoLink[]
      : [];

    if (list.length > 0) return list.slice(0, 2);

    const legacyUrl = String(song?.sunoShareUrl || song?.sunoUrl || song?.sunoSongUrl || '').trim();
    if (!legacyUrl) return [];

    return [{
      url: legacyUrl,
      title: song?.sunoTitle || null,
      coverUrl: song?.sunoCoverUrl || song?.sunoImageUrl || song?.sunoArtworkUrl || null,
      durationSeconds: typeof song?.sunoDurationSeconds === 'number' ? song.sunoDurationSeconds : null,
      durationText: song?.sunoDurationText || null,
      rank: 1,
      updatedAt: song?.sunoShareUrlUpdatedAt || undefined,
      fetchedAt: song?.sunoCoverFetchedAt || undefined,
    }];
  };

  const getFavoriteSunoMainIndex = (song: any): 0 | 1 => {
    const links = getFavoriteSunoLinks(song);
    if (links.length <= 1) return 0;

    const saved = Number(song?.mainSunoIndex);
    if (saved === 0 || saved === 1) return saved as 0 | 1;

    const rankOneIndex = links.findIndex(link => Number(link.rank) === 1);
    return rankOneIndex === 1 ? 1 : 0;
  };

  const getFavoriteMainSunoLink = (song: any): FavoriteSunoLink | null => {
    const links = getFavoriteSunoLinks(song);
    if (!links.length) return null;
    return links[getFavoriteSunoMainIndex(song)] || links[0] || null;
  };

  const getFavoriteSunoLinkCount = (song: any): number => {
    return getFavoriteSunoLinks(song).filter(link => String(link?.url || '').trim()).length;
  };

  const getFavoriteSunoShareUrl = (song: any): string => {
    return String(getFavoriteMainSunoLink(song)?.url || '').trim();
  };

  const normalizeFavoriteSunoShareUrl = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase();
      if (!host.includes('suno.com') && !host.includes('suno.ai')) {
        throw new Error('not suno url');
      }
      return url.toString();
    } catch {
      throw new Error('수노 공유 URL만 등록할 수 있습니다.');
    }
  };

  const getFavoriteSunoCoverUrl = (song: any): string => {
    return String(getFavoriteMainSunoLink(song)?.coverUrl || song?.sunoCoverUrl || song?.sunoImageUrl || song?.sunoArtworkUrl || '').trim();
  };

  const getFavoriteSunoDurationText = (song: any): string => {
    const mainLink = getFavoriteMainSunoLink(song);
    const savedText = String(mainLink?.durationText || song?.sunoDurationText || '').trim();
    if (savedText) return savedText;

    const seconds = Number(mainLink?.durationSeconds || song?.sunoDurationSeconds || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';

    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  };

  const shouldRefreshFavoriteSunoMetadata = (song: any): boolean => {
    if (!getFavoriteSunoShareUrl(song)) return false;
    const title = String(getFavoriteMainSunoLink(song)?.title || song?.sunoTitle || '');
    return !getFavoriteSunoCoverUrl(song) || !getFavoriteSunoDurationText(song) || /&#\d+;|&#x[0-9a-f]+;/i.test(title);
  };

  const fetchFavoriteSunoShareMetadata = async (normalizedUrl: string) => {
    if (!user?.uid) return null;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BASE_URL}/fetchSunoShareMetadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        console.warn('[Suno URL metadata] fetch failed', payload);
        return null;
      }

      return {
        coverUrl: typeof payload.sunoCoverUrl === 'string' ? payload.sunoCoverUrl.trim() : '',
        title: typeof payload.sunoTitle === 'string' ? payload.sunoTitle.trim() : '',
        durationSeconds: typeof payload.sunoDurationSeconds === 'number' ? payload.sunoDurationSeconds : null,
        durationText: typeof payload.sunoDurationText === 'string' ? payload.sunoDurationText.trim() : '',
      };
    } catch (error) {
      console.warn('[Suno URL metadata] fetch failed', error);
      return null;
    }
  };

  const buildFavoriteSunoEditorState = (song: any): { inputs: [string, string]; mainIndex: 0 | 1 } => {
    const links = getFavoriteSunoLinks(song);
    return {
      inputs: [links[0]?.url || '', links[1]?.url || ''],
      mainIndex: getFavoriteSunoMainIndex(song),
    };
  };

  const openFavoriteSunoUrl = (song: any) => {
    const url = getFavoriteSunoShareUrl(song);
    if (!url) {
      showFavoriteToast('등록된 수노 URL이 없습니다.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openFavoriteSunoLinkAt = (song: any, index: number) => {
    const links = getFavoriteSunoLinks(song);
    const url = String(links[index]?.url || '').trim();
    if (!url) {
      showFavoriteToast(`수노 URL ${index + 1}이 없습니다.`);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const scrollDetailToSunoUrlSection = (behavior: ScrollBehavior = 'smooth') => {
    window.setTimeout(() => {
      detailSunoUrlSectionRef.current?.scrollIntoView({ behavior, block: 'start' });
      window.setTimeout(() => detailScrollContainerRef.current?.scrollBy({ top: -10, behavior }), 40);
    }, 80);
  };

  const openFavoriteSunoUrlEditor = (song: any) => {
    // Mobile safety: do not open the old tall URL-only modal.
    // Open Detail & Edit and move to the embedded SUNO URL section instead.
    pendingDetailSunoUrlScrollRef.current = true;
    setIsDetailSunoUrlHighlighted(true);
    setSelectedSong(song);
    setSunoUrlEditorSong(null);
    setSunoUrlError('');
    setActiveFavoriteMenuId(null);

    if (selectedSong?.id === song?.id) {
      scrollDetailToSunoUrlSection();
      window.setTimeout(() => setIsDetailSunoUrlHighlighted(false), 1400);
    }
  };

  const closeFavoriteSunoUrlEditor = () => {
    setSunoUrlEditorSong(null);
    setSunoUrlInputs(['', '']);
    setSunoUrlMainIndex(0);
    setSunoUrlError('');
  };

  const saveFavoriteSunoShareUrls = async (song: any, rawUrls: [string, string], requestedMainIndex: 0 | 1, source: 'modal' | 'detail' = 'modal') => {
    if (!song?.id) return;

    const normalizedSlots: (string | null)[] = [];
    const seen = new Set<string>();

    for (const raw of rawUrls) {
      const value = String(raw || '').trim();
      if (!value) {
        normalizedSlots.push(null);
        continue;
      }

      let normalized = '';
      try {
        normalized = normalizeFavoriteSunoShareUrl(value);
      } catch (error: any) {
        const message = error?.message || '수노 URL 형식을 확인해주세요.';
        if (source === 'detail') setDetailSunoUrlError(message);
        else setSunoUrlError(message);
        return;
      }

      if (seen.has(normalized)) {
        const message = '같은 수노 URL이 중복되어 있습니다.';
        if (source === 'detail') setDetailSunoUrlError(message);
        else setSunoUrlError(message);
        return;
      }

      seen.add(normalized);
      normalizedSlots.push(normalized);
    }

    const filled = normalizedSlots
      .map((url, index) => ({ url, index }))
      .filter((item): item is { url: string; index: number } => !!item.url);

    if (!filled.length) {
      if (source === 'detail' && getFavoriteSunoShareUrl(song)) {
        await removeFavoriteSunoShareUrl(song, 'detail');
        return;
      }
      const message = '수노 URL을 1개 이상 입력해주세요.';
      if (source === 'detail') setDetailSunoUrlError(message);
      else setSunoUrlError(message);
      return;
    }

    const mainSlotIndex = normalizedSlots[requestedMainIndex] ? requestedMainIndex : filled[0].index;
    const existingLinks = getFavoriteSunoLinks(song);
    const now = Date.now();

    const links: FavoriteSunoLink[] = [];
    for (const item of filled) {
      const existing = existingLinks.find(link => link.url === item.url);
      const metadata = await fetchFavoriteSunoShareMetadata(item.url);

      links.push({
        url: item.url,
        title: metadata?.title || existing?.title || null,
        coverUrl: metadata?.coverUrl || existing?.coverUrl || null,
        durationSeconds: metadata?.durationSeconds ?? existing?.durationSeconds ?? null,
        durationText: metadata?.durationText || existing?.durationText || null,
        rank: item.index === mainSlotIndex ? 1 : 2,
        updatedAt: now,
        fetchedAt: now,
      });
    }

    const rawMainIndex = links.findIndex(link => link.rank === 1);
    const mainIndex = (rawMainIndex === 1 ? 1 : 0) as 0 | 1;
    const mainLink = links[mainIndex] || links[0];

    const updates = {
      sunoLinks: links,
      mainSunoIndex: mainIndex,
      sunoLinkCount: links.length,
      sunoShareUrl: mainLink?.url || null,
      sunoShareUrlUpdatedAt: now,
      sunoCoverUrl: mainLink?.coverUrl || null,
      sunoTitle: mainLink?.title || null,
      sunoDurationSeconds: mainLink?.durationSeconds || null,
      sunoDurationText: mainLink?.durationText || null,
      sunoCoverFetchedAt: now,
    };

    await updateFavorite(song.id, updates);

    const nextSong = { ...(selectedSong?.id === song.id ? selectedSong : song), ...updates };
    if (selectedSong?.id === song.id) {
      setSelectedSong(nextSong);
      const nextState = buildFavoriteSunoEditorState(nextSong);
      setDetailSunoUrlInputs(nextState.inputs);
      setDetailSunoUrlMainIndex(nextState.mainIndex);
      setDetailSunoUrlError('');
    }

    if (source === 'modal') closeFavoriteSunoUrlEditor();
    showFavoriteToast(links.length > 1 ? '수노 URL 2곡을 연결했습니다.' : '수노 URL을 연결했습니다.');
  };

  const saveFavoriteSunoShareUrl = async (song: any, rawUrl: string, source: 'modal' | 'detail' = 'modal') => {
    await saveFavoriteSunoShareUrls(song, [rawUrl, ''], 0, source);
  };

  const removeFavoriteSunoShareUrl = async (song: any, source: 'modal' | 'detail' = 'modal') => {
    if (!song?.id) return;
    const updates = {
      sunoLinks: [],
      mainSunoIndex: 0,
      sunoLinkCount: 0,
      sunoShareUrl: null,
      sunoShareUrlUpdatedAt: Date.now(),
      sunoCoverUrl: null,
      sunoTitle: null,
      sunoDurationSeconds: null,
      sunoDurationText: null,
      sunoCoverFetchedAt: null,
    };
    await updateFavorite(song.id, updates);
    if (selectedSong?.id === song.id) {
      setSelectedSong({ ...(selectedSong || {}), ...updates });
      setDetailSunoUrlInputs(['', '']);
      setDetailSunoUrlMainIndex(0);
      setDetailSunoUrlError('');
    }
    if (source === 'modal') closeFavoriteSunoUrlEditor();
    showFavoriteToast('수노 URL 연결을 제거했습니다.');
  };

  const COLOR_SYNC_USAGE_KEY = 'soridraw.colorSyncUsage.v1';
  const getColorSyncDateKey = () => new Date().toISOString().slice(0, 10);
  const getScopedColorStorageKey = (baseKey: string) => `${baseKey}.${user?.uid || 'anonymous'}`;
  const serializeColorMap = (value: Record<string, string>) => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
  const getColorSyncUsageStorageKey = () => getScopedColorStorageKey(COLOR_SYNC_USAGE_KEY);
  const getFavoriteColorSyncCount = () => {
    try {
      const raw = localStorage.getItem(getColorSyncUsageStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.date === getColorSyncDateKey() ? Number(parsed?.count || 0) : 0;
    } catch {
      return 0;
    }
  };
  const markFavoriteColorSynced = () => {
    if (isFavoriteAdminUser) {
      setFavoriteColorSyncTick((v) => v + 1);
      return;
    }
    const next = Math.min(5, getFavoriteColorSyncCount() + 1);
    localStorage.setItem(getColorSyncUsageStorageKey(), JSON.stringify({ date: getColorSyncDateKey(), count: next }));
    setFavoriteColorSyncTick((v) => v + 1);
  };
  const favoriteColorSyncRemaining = isFavoriteAdminUser ? 5 : Math.max(0, 5 - getFavoriteColorSyncCount());
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
      console.warn('color map save failed', error);
    }
  };
  const getUnifiedColorSyncDescription = () => `색상 변경사항은 이 페이지를 나갈 때 1회 자동 저장됩니다.
페이지 안에서는 로컬 상태만 바뀌며, 변경이 없으면 저장하지 않습니다.
필요하면 이 버튼으로 즉시 저장할 수 있습니다.`;

  const handleSyncFavoriteColors = async () => {
    if (!user) {
      showFavoriteToast('로그인이 필요합니다.');
      return;
    }
    const count = getFavoriteColorSyncCount();
    if (!isFavoriteAdminUser && count >= 5) {
      showFavoriteToast('오늘 색상 동기화 횟수를 모두 사용했습니다. 내일 다시 동기화됩니다.');
      return;
    }

    const existingIds = new Set(favorites.map(song => song.id));
    const favoriteMap = { ...readLocalColorMap('soridraw.favoriteColorTags'), ...favoriteColorMap };
    const workspaceMap = readLocalColorMap('soridraw.library.workspaceColorTags');
    const playlistMap = readLocalColorMap('soridraw.library.playlistColorTags');

    const favoriteEntries = Object.entries(favoriteMap).filter(([id]) => existingIds.has(id));
    const workspaceEntries = Object.entries(workspaceMap);
    const playlistEntries = Object.entries(playlistMap);

    if (favoriteEntries.length === 0 && workspaceEntries.length === 0 && playlistEntries.length === 0) {
      showFavoriteToast('동기화할 색상 변경 내역이 없습니다.');
      return;
    }

    try {
      await Promise.all(favoriteEntries.map(([id, color]) => updateFavorite(id, { favoriteColorTag: color === 'gray' ? null : color } as any)));

      for (const [key, color] of workspaceEntries) {
        const [, colorField, trackId, idx] = key.split(':');
        if (!trackId || idx === undefined || (colorField !== 'colorTags' && colorField !== 'favoriteColorTags')) continue;
        await updateDoc(doc(db, 'suno_tracks', user.uid, 'tracks', trackId), {
          [`${colorField}.${idx}`]: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        });
      }

      for (const [key, color] of playlistEntries) {
        const [, playlistId, itemId] = key.split(':');
        if (!playlistId || !itemId || playlistId === 'unknown' || itemId === 'unknown') continue;
        await updatePlaylistItemColor(user.uid, playlistId, itemId, color === 'gray' ? null : color);
      }

      markFavoriteColorSynced();
      showFavoriteToast(`색상 설정을 동기화했습니다. 오늘 남은 횟수: ${isFavoriteAdminUser ? '무제한' : `${Math.max(0, 5 - getFavoriteColorSyncCount())}회`}`);
    } catch (error) {
      console.error('unified color sync failed', error);
      showFavoriteToast('색상 동기화에 실패했습니다.');
    }
  };


  const syncFavoriteColorsOnExit = async (silent = true) => {
    const currentUser = favoriteUserRef.current;
    if (!currentUser || favoriteColorsAutoSyncingRef.current) return;

    const currentMap = favoriteColorMapRef.current || {};
    const currentSerialized = serializeColorMap(currentMap);
    if (currentSerialized === favoriteColorBaselineRef.current) return;

    const existingIds = new Set((favoritesRef.current || []).map(song => song?.id).filter(Boolean));
    const entries = Object.entries(currentMap).filter(([id]) => existingIds.has(id));
    if (entries.length === 0) {
      favoriteColorBaselineRef.current = currentSerialized;
      favoriteColorDirtyRef.current = false;
      return;
    }

    favoriteColorsAutoSyncingRef.current = true;
    try {
      await Promise.all(entries.map(([id, color]) => updateFavorite(id, { favoriteColorTag: color === 'gray' ? null : color } as any)));
      favoriteColorBaselineRef.current = currentSerialized;
      favoriteColorDirtyRef.current = false;
      if (!silent) showFavoriteToast('색상 변경사항을 저장했습니다.');
    } catch (error) {
      console.error('favorite color exit sync failed', error);
      if (!silent) showFavoriteToast('색상 변경사항 저장에 실패했습니다.');
    } finally {
      favoriteColorsAutoSyncingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      void syncFavoriteColorsOnExit(true);
    };
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (favoriteToastTimerRef.current) {
        clearTimeout(favoriteToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    favoriteColorMapRef.current = favoriteColorMap;
  }, [favoriteColorMap]);

  useEffect(() => {
    favoritesRef.current = favorites || [];
  }, [favorites]);

  useEffect(() => {
    favoriteUserRef.current = user;
  }, [user]);

  useEffect(() => {
    try {
      const loaded = readLocalColorMap('soridraw.favoriteColorTags');
      setFavoriteColorMap(loaded);
      favoriteColorMapRef.current = loaded;
      favoriteColorBaselineRef.current = serializeColorMap(loaded);
      favoriteColorDirtyRef.current = false;
    } catch (error) {
      console.warn('favorite color map load failed', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    writeLocalColorMap('soridraw.favoriteColorTags', favoriteColorMap);
  }, [favoriteColorMap, user?.uid]);

  useEffect(() => {
    const serverMap: Record<string, string> = {};
    for (const song of favorites || []) {
      if (!song?.id) continue;
      const rawColor = song.favoriteColorTag || song.colorTag || null;
      if (rawColor && rawColor !== 'gray') serverMap[song.id] = rawColor;
    }

    const previous = lastFavoriteServerColorMapRef.current || {};
    const allIds = new Set([...Object.keys(previous), ...Object.keys(serverMap)]);
    if (allIds.size === 0) {
      lastFavoriteServerColorMapRef.current = serverMap;
      return;
    }

    if (favoriteColorDirtyRef.current) {
      lastFavoriteServerColorMapRef.current = serverMap;
      return;
    }

    let changed = false;
    setFavoriteColorMap((prev) => {
      const next = { ...prev };
      for (const id of allIds) {
        const before = previous[id] || 'gray';
        const current = serverMap[id] || 'gray';
        if (before !== current) {
          changed = true;
          if (current === 'gray') delete next[id];
          else next[id] = current;
        }
      }
      return changed ? next : prev;
    });

    if (changed) {
      try {
        const merged = { ...readLocalColorMap('soridraw.favoriteColorTags') };
        for (const id of allIds) {
          const before = previous[id] || 'gray';
          const current = serverMap[id] || 'gray';
          if (before !== current) {
            if (current === 'gray') delete merged[id];
            else merged[id] = current;
          }
        }
        writeLocalColorMap('soridraw.favoriteColorTags', merged);
        favoriteColorMapRef.current = merged;
        favoriteColorBaselineRef.current = serializeColorMap(merged);
        favoriteColorDirtyRef.current = false;
      } catch (error) {
        console.warn('favorite server color merge failed', error);
      }
    }
    lastFavoriteServerColorMapRef.current = serverMap;
  }, [favorites]);

  useEffect(() => {
    const closeMenus = () => {
      setActiveFavoriteMenuId(null);
      setActiveFavoriteColorMenuId(null);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => clearSelectionLongPressTimer();
  }, []);

  useEffect(() => {
    if (isSelectionMode && !selectionHistoryPushedRef.current) {
      window.history.pushState({ favoritesOverlay: 'selection-mode' }, '');
      selectionHistoryPushedRef.current = true;
    }

    if (!isSelectionMode) {
      selectionHistoryPushedRef.current = false;
    }
  }, [isSelectionMode]);

  useEffect(() => {
    if (selectedSong && !detailHistoryPushedRef.current) {
      window.history.pushState({ favoritesOverlay: 'song-detail' }, '');
      detailHistoryPushedRef.current = true;
    }

    if (!selectedSong) {
      detailHistoryPushedRef.current = false;
    }
  }, [selectedSong]);

  const navigate = useNavigate();

  useEffect(() => {
    if (selectedSong) {
      const selectedSongId = String(selectedSong.id || '');
      const sourceTitle = selectedSong.title || '';
      const sourceKorean = selectedSong.lyrics?.korean || '';
      const sourceEnglish = selectedSong.lyrics?.english || '';
      const sourcePrompt = selectedSong.prompt || '';

      // Always hydrate the editor from the currently opened song itself.
      // Do not restore cross-screen drafts here: stale drafts were able to attach
      // song A's fields to song B and then save them on browser back navigation.
      activeFavoriteEditorSongIdRef.current = selectedSongId;
      favoriteEditorReadySongIdRef.current = selectedSongId;
      popupOpenedSongIdRef.current = selectedSongId;
      skipNextFavoriteDraftSaveRef.current = false;

      setOriginalLyricsKo(sourceKorean);
      setOriginalLyricsEn(sourceEnglish);
      setOriginalTitle(sourceTitle);
      setOriginalPrompt(sourcePrompt);
      setEditedTitle(sourceTitle);
      setEditedKoreanLyrics(sourceKorean);
      setEditedEnglishLyrics(sourceEnglish);
      setEditedPrompt(sourcePrompt);
      setIsEditing(false);
      setActiveEditSection(null);
      setForeignTargetLanguage(inferForeignLyricTargetLanguage(sourceEnglish));
      const nextSunoState = buildFavoriteSunoEditorState(selectedSong);
      setDetailSunoUrlInputs(nextSunoState.inputs);
      setDetailSunoUrlMainIndex(nextSunoState.mainIndex);
      setDetailSunoUrlError('');
      setIsSyncEnabled(false);
      setDrafts(prev => {
        if (!prev[selectedSongId]) return prev;
        const next = { ...prev };
        delete next[selectedSongId];
        return next;
      });
    } else {
      setOriginalLyricsKo('');
      setOriginalLyricsEn('');
      setOriginalTitle('');
      setOriginalPrompt('');
      popupOpenedSongIdRef.current = null;
      activeFavoriteEditorSongIdRef.current = null;
      favoriteEditorReadySongIdRef.current = null;
      skipNextFavoriteDraftSaveRef.current = false;
      setActiveEditSection(null);
      setForeignTargetLanguage('English');
      setDetailSunoUrlInputs(['', '']);
      setDetailSunoUrlMainIndex(0);
      setDetailSunoUrlError('');
      setIsSyncEnabled(false);
    }
  }, [selectedSong]);

  useEffect(() => {
    if (!selectedSong || !pendingDetailSunoUrlScrollRef.current) return;

    pendingDetailSunoUrlScrollRef.current = false;
    scrollDetailToSunoUrlSection('auto');
    const timer = window.setTimeout(() => setIsDetailSunoUrlHighlighted(false), 1400);
    return () => window.clearTimeout(timer);
  }, [selectedSong]);

  // Data safety: do not auto-cache text edit drafts by song id.
  // The previous draft cache could briefly pair the old song's edit fields with
  // the newly opened song's id, which caused destructive overwrite on back.

  const buildFavoriteDraftPayload = async () => {
    if (!selectedSong?.id) return null;

    const selectedSongId = String(selectedSong.id || '');
    if (
      activeFavoriteEditorSongIdRef.current !== selectedSongId ||
      favoriteEditorReadySongIdRef.current !== selectedSongId ||
      popupOpenedSongIdRef.current !== selectedSongId
    ) {
      console.warn('favorite draft commit blocked: stale editor state', { selectedSongId });
      return null;
    }

    let finalKorean = editedKoreanLyrics;
    let finalEnglish = editedEnglishLyrics;

    if (isSyncEnabled) {
      setIsTranslating(true);
      try {
        const koreanChanged = editedKoreanLyrics !== originalLyricsKo;
        const englishChanged = editedEnglishLyrics !== originalLyricsEn;

        const targetLanguage = buildLyricContentOnlyTranslationTarget(
          foreignTargetLanguage || inferForeignLyricTargetLanguage(originalLyricsEn || selectedSong.lyrics?.english || '')
        );
        const koreanTargetLanguage = buildLyricContentOnlyTranslationTarget('Korean');

        if (koreanChanged && !englishChanged) {
          finalEnglish = await translateLyrics(editedKoreanLyrics, targetLanguage);
        } else if (englishChanged && !koreanChanged) {
          finalKorean = await translateLyrics(editedEnglishLyrics, koreanTargetLanguage);
        } else if (koreanChanged && englishChanged) {
          finalEnglish = await translateLyrics(editedKoreanLyrics, targetLanguage);
        }
      } catch (error) {
        console.error("Translation failed:", error);
      } finally {
        setIsTranslating(false);
      }
    }

    const parsedEditedTitles = parseLegacyTitles({ title: editedTitle });
    const fallbackTitlePart = cleanTitlePart(editedTitle);
    const nextKoreanTitle = parsedEditedTitles.korean || (/[가-힣]/.test(fallbackTitlePart) ? fallbackTitlePart : '');
    const nextEnglishTitle = parsedEditedTitles.english || (!/[가-힣]/.test(fallbackTitlePart) ? fallbackTitlePart : '');

    const nextSong = {
      ...selectedSong,
      title: editedTitle,
      koreanTitle: nextKoreanTitle,
      englishTitle: nextEnglishTitle,
      prompt: editedPrompt,
      lyrics: {
        ...(selectedSong.lyrics || {}),
        korean: finalKorean,
        english: finalEnglish,
      },
    };

    const updates: Partial<any> = {};

    if (editedTitle !== originalTitle) {
      updates.title = editedTitle;
      updates.koreanTitle = nextKoreanTitle;
      updates.englishTitle = nextEnglishTitle;
    }

    if (editedPrompt !== originalPrompt) {
      updates.prompt = editedPrompt;
    }

    if (finalKorean !== originalLyricsKo || finalEnglish !== originalLyricsEn) {
      updates.lyrics = {
        ...(selectedSong.lyrics || {}),
        korean: finalKorean,
        english: finalEnglish,
      };
    }

    return {
      targetSongId: selectedSongId,
      updates,
      nextSong,
      finalKorean,
      finalEnglish,
      hasChanges: Object.keys(updates).length > 0,
    };
  };

  const applyFavoriteDraftLocally = async () => {
    if (!selectedSong) return;
    const payload = await buildFavoriteDraftPayload();
    if (!payload) return;

    setEditedKoreanLyrics(payload.finalKorean);
    setEditedEnglishLyrics(payload.finalEnglish);
    setSelectedSong(payload.nextSong);
    setIsEditing(false);
    setActiveEditSection(null);
    setIsSyncEnabled(false);
  };

  const commitFavoriteDraftIfNeeded = async () => {
    if (!selectedSong || favoriteDraftCommitRef.current) return;

    const payload = await buildFavoriteDraftPayload();
    if (!payload?.hasChanges) return;

    favoriteDraftCommitRef.current = true;
    try {
      await updateFavorite(payload.targetSongId, payload.updates);

      setSelectedSong(payload.nextSong);
      setOriginalTitle(payload.nextSong.title);
      setOriginalLyricsKo(payload.nextSong.lyrics?.korean || '');
      setOriginalLyricsEn(payload.nextSong.lyrics?.english || '');
      setOriginalPrompt(payload.nextSong.prompt || '');
      setEditedKoreanLyrics(payload.finalKorean);
      setEditedEnglishLyrics(payload.finalEnglish);
      setDrafts(prev => {
        const next = { ...prev };
        delete next[payload.targetSongId];
        return next;
      });
    } finally {
      favoriteDraftCommitRef.current = false;
    }
  };

  const handleSave = async () => {
    await commitFavoriteDraftIfNeeded();
    setIsEditing(false);
    setActiveEditSection(null);
    setIsSyncEnabled(false);
  };

  const handleRestoreOriginal = () => {
    if (!originalLyricsKo && !originalLyricsEn && !originalTitle && !originalPrompt) return;
    setEditedKoreanLyrics(originalLyricsKo);
    setEditedEnglishLyrics(originalLyricsEn);
    setEditedTitle(originalTitle);
    setEditedPrompt(originalPrompt);
    setIsEditing(true);
  };

  const handleToggleLock = async (song: any) => {
    const newLockedState = !song.isLocked;
    await updateFavorite(song.id, { isLocked: newLockedState });

    if (newLockedState) {
      recentlyUnlockedFavoriteIdsRef.current.delete(song.id);
    } else {
      recentlyUnlockedFavoriteIdsRef.current.add(song.id);
    }

    if (selectedSong && selectedSong.id === song.id) {
      setSelectedSong({ ...selectedSong, isLocked: newLockedState });
    }
  };

  const forceDeleteUnlockedFavoriteIfNeeded = (song: any) => {
    if (!song?.id) return;

    const canForceDelete = recentlyUnlockedFavoriteIdsRef.current.has(song.id);
    if (!canForceDelete) {
      onHover({
        id: 'favorite-locked-delete-blocked',
        label: '삭제 불가',
        description: '잠긴 곡은 삭제할 수 없습니다.',
        _ts: Date.now(),
      });
      return;
    }

    const confirmed = window.confirm('잠금 상태에 오류가 있습니다. 강제로 삭제할까요?');
    if (!confirmed) return;

    recentlyUnlockedFavoriteIdsRef.current.delete(song.id);
    toggleFavorite({ ...song, isLocked: false, __forceDeleteFavoriteById: true } as any);

    if (selectedSong?.id === song.id) {
      setSelectedSong(null);
      setConfirmDeleteSong(false);
      detailHistoryPushedRef.current = false;
    }
  };

  const handlePopupToggleLock = async (song: any) => {
    await handleToggleLock(song);
    setConfirmToggleLock(false);
  };

  const handlePopupDelete = async (song: any) => {
    if (song.isLocked) {
      forceDeleteUnlockedFavoriteIfNeeded(song);
      return;
    }
    
    if (!confirmDeleteSong) {
      setConfirmDeleteSong(true);
      return;
    }
    
    const deleted = await deleteSongsByMusicNoteContext([song]);
    if (deleted) {
      setSelectedSong(null);
      setConfirmDeleteSong(false);
    }
  };

  const getBulkLockHover = (isConfirm = confirmLockAll === 1) => ({
    id: 'bulk-lock',
    label: '일괄잠금',
    description: isConfirm ? '주의: 한번 더 누르면 실행!!' : '모든 곡을 삭제되지 않도록 잠급니다.'
  });

  const getBulkUnlockHover = (isConfirm = confirmUnlockAll === 1) => ({
    id: 'bulk-unlock',
    label: '일괄해제',
    description: isConfirm ? '주의: 한번 더 누르면 실행!!' : '모든 곡의 잠금을 해제합니다.'
  });

  const getBulkDeleteHover = (isConfirm = confirmDeleteAll === 1) => ({
    id: 'bulk-delete',
    label: '전체삭제',
    description: isConfirm ? '주의: 한번 더 누르면 실행!!' : '잠금되지 않은 모든 곡을 삭제합니다.'
  });

  const getSelectionLockHover = (
    allSelectedLocked = selectedSongs.length > 0 && selectedSongs.every(song => song.isLocked)
  ) => ({
    id: 'selection-lock',
    label: allSelectedLocked ? '선택 잠금 해제' : '선택 잠금',
    description: allSelectedLocked
      ? '선택된 곡들의 잠금을 해제합니다.'
      : '선택된 곡들을 삭제되지 않도록 잠급니다.'
  });


  const handleBulkLock = () => {
    if (confirmLockAll === 0) {
      setConfirmLockAll(1);
      onHover(getBulkLockHover(true));
      setTimeout(() => {
        setConfirmLockAll(0);
        if (hoveredItem?.id === 'bulk-lock') {
          onHover(getBulkLockHover(false));
        }
      }, 3000);
    } else {
      lockAllFavorites();
      setConfirmLockAll(0);
      if (hoveredItem?.id === 'bulk-lock') {
        onHover(getBulkLockHover(false));
      }
    }
  };

  const handleBulkDelete = () => {
    if (confirmDeleteAll === 0) {
      setConfirmDeleteAll(1);
      onHover(getBulkDeleteHover(true));
      setTimeout(() => {
        setConfirmDeleteAll(0);
        if (hoveredItem?.id === 'bulk-delete') {
          onHover(getBulkDeleteHover(false));
        }
      }, 3000);
    } else {
      clearAllFavorites();
      setConfirmDeleteAll(0);
      if (hoveredItem?.id === 'bulk-delete') {
        onHover(getBulkDeleteHover(false));
      }
    }
  };

  const handleBulkUnlock = () => {
    if (confirmUnlockAll === 0) {
      setConfirmUnlockAll(1);
      onHover(getBulkUnlockHover(true));
      setTimeout(() => {
        setConfirmUnlockAll(0);
        if (hoveredItem?.id === 'bulk-unlock') {
          onHover(getBulkUnlockHover(false));
        }
      }, 3000);
    } else {
      unlockAllFavorites();
      setConfirmUnlockAll(0);
      if (hoveredItem?.id === 'bulk-unlock') {
        onHover(getBulkUnlockHover(false));
      }
    }
  };


  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      isScrollingRef.current = true;
      clearSelectionLongPressTimer();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeFavoriteMenuId) return;

    const closeMoreMenuOnBack = () => {
      setActiveFavoriteMenuId(null);
    };

    window.addEventListener('popstate', closeMoreMenuOnBack);
    return () => {
      window.removeEventListener('popstate', closeMoreMenuOnBack);
    };
  }, [activeFavoriteMenuId]);

  const clearSelectionLongPressTimer = () => {
    if (selectionLongPressTimerRef.current) {
      clearTimeout(selectionLongPressTimerRef.current);
      selectionLongPressTimerRef.current = null;
    }
    selectionLongPressStartPointRef.current = null;
  };

  const getLongPressPoint = (event: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in event) {
      const touch = event.touches[0] || event.changedTouches[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    return { x: event.clientX, y: event.clientY };
  };

  const handleCardLongPressMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!selectionLongPressTimerRef.current || !selectionLongPressStartPointRef.current) return;

    const point = getLongPressPoint(event);
    if (!point) {
      clearSelectionLongPressTimer();
      return;
    }

    const dx = point.x - selectionLongPressStartPointRef.current.x;
    const dy = point.y - selectionLongPressStartPointRef.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);

    // 누른 지점에서 벗어나면 길게 누르기 진입/해제 실행 취소
    if (movedDistance > 10) {
      clearSelectionLongPressTimer();
    }
  };

  const shouldIgnoreFavoriteCardClickFromPointerTravel = (event: React.MouseEvent) => {
    if (!cardClickStartPointRef.current) return false;

    const dx = event.clientX - cardClickStartPointRef.current.x;
    const dy = event.clientY - cardClickStartPointRef.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);
    cardClickStartPointRef.current = null;

    return movedDistance > 10;
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const cycleSelectionModeSelection = (fallbackSongId?: string) => {
    const allSongIds = favorites.map(song => song.id);
    if (allSongIds.length === 0) return;

    const isAllSelected = selectedSongIds.length === allSongIds.length && allSongIds.every(id => selectedSongIds.includes(id));

    if (isAllSelected) {
      const restoredSelection = selectionBeforeSelectAllRef.current.length > 0
        ? selectionBeforeSelectAllRef.current.filter(id => allSongIds.includes(id))
        : (fallbackSongId ? [fallbackSongId] : []);
      setSelectedSongIds(restoredSelection);
      return;
    }

    selectionBeforeSelectAllRef.current = selectedSongIds.length > 0
      ? [...selectedSongIds]
      : (fallbackSongId ? [fallbackSongId] : []);
    setSelectedSongIds(allSongIds);
  };

  const handleCardLongPressStart = (event: React.MouseEvent | React.TouchEvent, song: any) => {
    clearSelectionLongPressTimer();

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"], [data-floating-menu="true"], [data-no-card-long-press="true"]')) {
      return;
    }

    if (isScrollingRef.current) return;

    const startPoint = getLongPressPoint(event);
    if (!startPoint) return;
    selectionLongPressStartPointRef.current = startPoint;
    cardClickStartPointRef.current = startPoint;

    selectionLongPressTimerRef.current = setTimeout(() => {
      if (isScrollingRef.current) return;

      longPressTriggeredRef.current = true;
      suppressNextCardClickRef.current = true;

      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedSongIds([]);
        setPendingSelectionAction(null);
        setActiveFavoriteMenuId(null);
        setActiveFavoriteColorMenuId(null);
      } else {
        setIsSelectionMode(true);
        setSelectedSongIds(prev => prev.includes(song.id) ? prev : [...prev, song.id]);
        setPendingSelectionAction(null);
        setActiveFavoriteMenuId(null);
        setActiveFavoriteColorMenuId(null);
      }
    }, 800);
  };

  const handleCardLongPressEnd = () => {
    clearSelectionLongPressTimer();
  };

  const exitSelectionMode = (source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && selectionHistoryPushedRef.current) {
      window.history.back();
      return;
    }

    setIsSelectionMode(false);
    setSelectedSongIds([]);
    setLastSelectionAction('none');
    setPendingSelectionAction(null);
    setFavoriteSelectionMoreOpen(false);
    setConfirmDeleteAll(0);
    setConfirmUnlockAll(0);
    setConfirmLockAll(0);
    selectionBeforeSelectAllRef.current = [];
    clearSelectionLongPressTimer();
    longPressTriggeredRef.current = false;
    selectionHistoryPushedRef.current = false;
  };

  useEffect(() => {
    if (!isSelectionMode) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-selection-keep="true"]')) return;

      exitSelectionMode('history');
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  }, [isSelectionMode]);

  const closeSelectedSong = async (source: 'ui' | 'history' = 'ui') => {
    const shouldPopOverlayHistory = source === 'ui' && detailHistoryPushedRef.current;

    // Closing with the browser/app back button must never write to Firestore.
    // Only the explicit check/save button commits edits. This protects existing
    // Music Note data from cross-song overwrites during history navigation.
    setDrafts(prev => {
      if (!selectedSong?.id || !prev[selectedSong.id]) return prev;
      const next = { ...prev };
      delete next[selectedSong.id];
      return next;
    });

    setSelectedSong(null);
    detailHistoryPushedRef.current = false;
    setConfirmDeleteSong(false);
    setConfirmToggleLock(false);
    setIsEditing(false);
    setActiveEditSection(null);
    setIsSyncEnabled(false);
    setDetailSunoUrlInputs(['', '']);
    setDetailSunoUrlMainIndex(0);
    setDetailSunoUrlError('');

    if (shouldPopOverlayHistory) {
      try {
        window.history.back();
      } catch (error) {
        console.warn('detail modal history close failed', error);
      }
    }
  };

  const cancelModalEditing = () => {
    if (!selectedSong) return;

    setIsEditing(false);
    setActiveEditSection(null);
    setIsSyncEnabled(false);
    setEditedTitle(selectedSong.title);
    setEditedKoreanLyrics(selectedSong.lyrics.korean);
    setEditedEnglishLyrics(selectedSong.lyrics.english);
    setEditedPrompt(selectedSong.prompt || '');
    const nextSunoState = buildFavoriteSunoEditorState(selectedSong);
    setDetailSunoUrlInputs(nextSunoState.inputs);
    setDetailSunoUrlMainIndex(nextSunoState.mainIndex);
    setDetailSunoUrlError('');
    setDrafts(prev => {
      const next = { ...prev };
      delete next[selectedSong.id];
      return next;
    });
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Clear any pending actions on back navigation
      setPendingSelectionAction(null);

      // If we have pending confirmations in popup, cancel them first
      if (confirmDeleteSong || confirmToggleLock) {
        setConfirmDeleteSong(false);
        setConfirmToggleLock(false);
        // Push state back to stay on current view
        window.history.pushState({ favoritesOverlay: 'song-detail' }, '');
        return;
      }

      // If we have bulk confirmations, cancel them first
      if (confirmDeleteAll > 0 || confirmUnlockAll > 0 || confirmLockAll > 0) {
        setConfirmDeleteAll(0);
        setConfirmUnlockAll(0);
        setConfirmLockAll(0);
        // Push state back to stay on current view
        window.history.pushState({ favoritesOverlay: 'selection-mode' }, '');
        return;
      }

      if (selectedSong) {
        closeSelectedSong('history');
        return;
      }

      if (isSelectionMode) {
        exitSelectionMode('history');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedSong) {
          closeSelectedSong();
        } else if (isSelectionMode) {
          exitSelectionMode();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, [selectedSong, isSelectionMode, confirmDeleteSong, confirmToggleLock, confirmDeleteAll, confirmUnlockAll, confirmLockAll]);

  const handleSelectedLock = async () => {
    if (pendingSelectionAction === 'lock' || pendingSelectionAction === 'unlock') {
      setPendingSelectionAction(null);
      return;
    }
    
    const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
    if (selectedSongs.length === 0) return;

    const allLocked = selectedSongs.every(song => song.isLocked);
    setPendingSelectionAction(allLocked ? 'unlock' : 'lock');
  };

  const executeSelectedLock = async (shouldLock: boolean) => {
    const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
    if (selectedSongs.length === 0) return;

    await Promise.all(selectedSongs.map(song => updateFavorite(song.id, { isLocked: shouldLock })));
    setLastSelectionAction(shouldLock ? 'lock' : 'unlock');
    
    if (selectedSong && selectedSongIds.includes(selectedSong.id)) {
      setSelectedSong({ ...selectedSong, isLocked: shouldLock });
    }
    setPendingSelectionAction(null);
  };

  const handleSelectedDelete = async () => {
    if (pendingSelectionAction === 'delete') {
      setPendingSelectionAction(null);
      return;
    }

    const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
    const deletableSongs = selectedSongs.filter(song => !song.isLocked);

    if (deletableSongs.length === 0) {
      setIsShaking(true);
      onHover({ 
        id: 'selection-delete-error', 
        label: '삭제 불가', 
        description: selectedSongIds.length === 0 
          ? '삭제할 곡을 선택해주세요.' 
          : '선택된 곡이 모두 잠겨있어 삭제할 수 없습니다.' 
      });
      setTimeout(() => {
        setIsShaking(false);
        onHover(null);
      }, 1500);
      return;
    }

    setPendingSelectionAction('delete');
  };

  const executeSelectedDelete = async () => {
    const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
    const deletableSongs = selectedSongs.filter(song => !song.isLocked);
    
    const deleted = await deleteSongsByMusicNoteContext(deletableSongs);
    if (deleted) exitSelectionMode();
  };

  const handleSelectionConfirm = () => {
    if (pendingSelectionAction === 'delete') {
      executeSelectedDelete();
    } else if (pendingSelectionAction === 'lock') {
      executeSelectedLock(true);
    } else if (pendingSelectionAction === 'unlock') {
      executeSelectedLock(false);
    } else {
      exitSelectionMode();
    }
  };

  const handleSortChange = (newSort: 'latest' | 'oldest' | 'genre' | 'title' | 'locked') => {
    setFavoriteTrashView(false);
    if (newSort === 'title') {
      setSortBy(prev => prev === 'title-en' ? 'title-ko' : 'title-en');
    } else if (newSort === 'genre') {
      setSortBy(prev => prev === 'genre-1' ? 'genre-2' : 'genre-1');
    } else if (newSort === 'locked') {
      setSortBy(prev => prev === 'locked-top' ? 'locked-bottom' : 'locked-top');
    } else {
      setSortBy(newSort as any);
    }
    // Reset timer when a sort option is clicked
    if (sortPopupTimerRef.current) clearTimeout(sortPopupTimerRef.current);
    sortPopupTimerRef.current = setTimeout(() => setShowSortPopup(false), 5000);
  };

  const toggleSortPopup = () => {
    if (showSortPopup) {
      setShowSortPopup(false);
      if (sortPopupTimerRef.current) clearTimeout(sortPopupTimerRef.current);
    } else {
      setShowSortPopup(true);
      if (sortPopupTimerRef.current) clearTimeout(sortPopupTimerRef.current);
      sortPopupTimerRef.current = setTimeout(() => setShowSortPopup(false), 5000);
    }
  };

  // Close sort popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortPopupRef.current && !sortPopupRef.current.contains(event.target as Node)) {
        setShowSortPopup(false);
        if (sortPopupTimerRef.current) clearTimeout(sortPopupTimerRef.current);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const copyAll = (song: any) => {
    const keywords = [
      `[Genres] ${getSongGenreValues(song).join(', ')}`,
      `[Moods] ${getSongMoodValues(song).join(', ')}`,
      getSongSituationSummary(song) ? `[Situation] ${getSongSituationSummary(song)}` : '',
      `[Themes] ${getSongThemeValues(song).join(', ')}`,
      `[Styles] ${getSongStyleValues(song).join(', ')}`,
      `[Instruments / Sound] ${getSongInstrumentSoundValues(song).join(', ')}`,
      song.appliedKeywords.vocalType ? `[Vocal] ${song.appliedKeywords.vocalType}${song.appliedKeywords.vocal?.isToneSelected && song.appliedKeywords.vocalTone ? ` (${song.appliedKeywords.vocalTone})` : ''}` : '',
      song.appliedKeywords.tempo ? `[Tempo] ${song.appliedKeywords.tempo}` : ''
    ].filter((line) => !line.endsWith('] ')).join('\n');

    const songTitleCopy = getCombinedFavoriteTitle(song);

    const text = `
${keywords}

${songTitleCopy}

[Lyrics - English]
${song.lyrics.english}

[Lyrics - Korean]
${song.lyrics.korean}

[Music Prompt]
${song.prompt}
    `.trim();
    copyToClipboard(text, `all-${song.id}`);
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 font-sans">
        <div className="p-6 rounded-full bg-[var(--bg-secondary)]/50 mb-6">
          <HeartIcon className="w-12 h-12 text-[var(--text-secondary)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">로그인이 필요합니다</h2>
        <p className="text-[var(--text-secondary)] mb-8">보관함을 이용하려면 로그인을 해주세요.</p>
      </div>
    );
  }

  const getRelativeTime = (timestamp: any) => {
    const ms = getTimestampMs(timestamp);
    if (!ms) return '방금 전';

    const now = Date.now();
    const diffInSeconds = Math.floor((now - ms) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}일 전`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}주 전`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}달 전`;
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}년 전`;
  };

  const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
  const isFavoriteTrashMode = musicNoteViewMode === 'noteSpace' && favoriteTrashView;
  const selectedLockedCount = selectedSongs.filter(song => song.isLocked).length;
  const hasDeletableSongs = selectedSongs.some(s => !s.isLocked);
  const areSelectedSongsAllLocked = selectedSongs.length > 0 && selectedSongs.every(song => song.isLocked);

  const handleSelectionMoveToFolder = () => {
    if (selectedSongIds.length === 0) return;
    setFavoriteSelectionMoreOpen(false);
    openMusicNoteFolderPicker(selectedSongIds, musicNoteViewMode === 'sharedNote' ? 'sharedNote' : 'myNote');
  };

  const handleSelectionQuickLock = async () => {
    if (selectedSongs.length === 0) return;
    const shouldLock = !areSelectedSongsAllLocked;
    await Promise.all(selectedSongs.map(song => updateFavorite(song.id, { isLocked: shouldLock })));
    setFavoriteSelectionMoreOpen(false);
    showFavoriteToast(shouldLock ? `${selectedSongs.length}곡을 잠금 처리했습니다.` : `${selectedSongs.length}곡 잠금을 해제했습니다.`);
  };

  const handleSelectionQuickDelete = () => {
    if (selectedSongIds.length === 0) return;
    const deletable = favorites.filter(item => selectedSongIds.includes(item.id) && !item.isLocked);
    if (deletable.length === 0) {
      showFavoriteToast('잠긴 곡은 삭제할 수 없습니다.');
      return;
    }
    deleteSongsByMusicNoteContext(deletable).then((deleted) => {
      if (deleted) {
        setFavoriteSelectionMoreOpen(false);
        exitSelectionMode();
      }
    });
  };

  const applyKeywordsToNext = (song: any) => {
    onHover(null);
    onLongPressEnd();
    try {
      window.dispatchEvent(new CustomEvent('soridraw:clear-interaction-hints'));
      const activeElement = document.activeElement as HTMLElement | null;
      activeElement?.blur?.();
    } catch {
      // ignore transient UI cleanup failures
    }

    const pendingKeywords = {
      ...song.appliedKeywords,
      genre: getSongGenreValues(song),
      subGenre: getSongSubGenreValues(song),
      mood: getSongMoodValues(song),
      theme: getSongThemeValues(song),
      situation: song.appliedKeywords?.situation,
      situationSummary: getSongSituationSummary(song),
      style: getSongStyleValues(song),
      instrumentSound: getSongInstrumentSoundValues(song),
      tempo: song.appliedKeywords?.tempo ?? null,
      lyricsLength: song.appliedKeywords?.lyricsLength ?? 'normal',
      maleCount: song.appliedKeywords?.maleCount ?? 0,
      femaleCount: song.appliedKeywords?.femaleCount ?? 0,
      rapEnabled: song.appliedKeywords?.rapEnabled ?? false,
      isKoreanEnglishMix: song.appliedKeywords?.isKoreanEnglishMix ?? false,
      vocal: song.appliedKeywords?.vocal ?? null,
      kpopMode: song.appliedKeywords?.kpopMode ?? 0,
      citypopMode: song.appliedKeywords?.citypopMode ?? 0,
      songStructure: song.appliedKeywords?.songStructure ?? '2',
      customStructure: song.appliedKeywords?.customStructure ?? [],
      userInput: song.appliedKeywords?.userInput ?? song.userInput ?? (song as any).commandInput ?? (song as any).directInput ?? (song as any).customPrompt ?? '',
      lyricDraft: '',
      isLyricMode: false,
    };
    const serialized = JSON.stringify(pendingKeywords);
    sessionStorage.setItem('pendingAppliedKeywords', serialized);
    localStorage.setItem('pendingAppliedKeywordsBackup', serialized);
    setSelectedSong(null);
    setActiveFavoriteMenuId(null);

    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('soridraw:clear-interaction-hints'));
      navigate(`/studio?applyPending=1&t=${Date.now()}`);
    });
  };


  const FAVORITE_MUSIC_API_LANGUAGE_ORDER: LanguageCode[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr'];

  const normalizeFavoriteMusicApiLanguage = (value: any): LanguageCode | null => {
    const lang = String(value || '').toLowerCase();
    if (lang === 'kr' || lang === 'kor' || lang === 'korean') return 'ko';
    if (lang === 'jp' || lang === 'jpn' || lang === 'japanese') return 'ja';
    if (lang === 'cn' || lang === 'chinese' || lang === 'zh-cn' || lang === 'zh-tw') return 'zh';
    if (lang === 'english') return 'en';
    if (lang === 'spanish') return 'es';
    if (lang === 'french') return 'fr';
    return FAVORITE_MUSIC_API_LANGUAGE_ORDER.includes(lang as LanguageCode) ? (lang as LanguageCode) : null;
  };

  const getFavoriteForeignLyricLanguage = (song: any): LanguageCode => {
    const applied = song?.appliedKeywords || {};
    const candidates = [
      ...(((applied.lyricLanguages || []) as any[]).filter(Boolean)),
      ...(((applied.titleLanguages || []) as any[]).filter(Boolean)),
      applied.secondaryLanguage,
      applied.foreignLanguage,
      applied.lyricLanguage,
    ];

    const found = candidates
      .map(normalizeFavoriteMusicApiLanguage)
      .find((lang): lang is LanguageCode => Boolean(lang && lang !== 'ko'));

    return found || 'en';
  };

  const getFavoriteMusicApiAvailableLyricLanguages = (song: any): LanguageCode[] => {
    if (!song) return [];
    const langs: LanguageCode[] = [];
    if (editedKoreanLyrics.trim()) langs.push('ko');
    if (editedEnglishLyrics.trim()) langs.push(getFavoriteForeignLyricLanguage(song));
    return Array.from(new Set(langs));
  };

  const getFavoriteMusicApiLyricsByLanguage = (song: any, lang: LanguageCode): string => {
    if (lang === 'ko') return editedKoreanLyrics.trim();
    const foreignLang = getFavoriteForeignLyricLanguage(song);
    if (lang === foreignLang) return editedEnglishLyrics.trim();
    return '';
  };

  const getFavoriteMusicApiTitle = (song: any): string => {
    const titleSource = {
      ...song,
      title: editedTitle || song?.title || '',
      koreanTitle: '',
      englishTitle: '',
    };
    return getCombinedFavoriteCopyText(titleSource);
  };

  const handleFavoriteMusicApiGenerate = async (
    _titleLanguage: LanguageCode = 'ko',
    includeLyrics: boolean = true,
    lyricLanguages: LanguageCode[] = ['ko'],
    options?: { sunoModelVersion?: SunoModelVersion }
  ) => {
    if (!selectedSong || isFavoriteMusicApiGenerating) return;

    try {
      setIsFavoriteMusicApiGenerating(true);
      setFavoriteMusicApiMessage(null);

      if (!user) {
        setFavoriteMusicApiMessage('로그인이 필요합니다.');
        return;
      }

      const token = await user.getIdToken();
      const sunoModelVersion: SunoModelVersion = options?.sunoModelVersion || 'V5_5';
      const selectedLanguage = includeLyrics
        ? (lyricLanguages || [])[0] || getFavoriteMusicApiAvailableLyricLanguages(selectedSong)[0]
        : null;
      const resolvedLyrics = includeLyrics && selectedLanguage
        ? getFavoriteMusicApiLyricsByLanguage(selectedSong, selectedLanguage)
        : '';

      if (includeLyrics && !resolvedLyrics.trim()) {
        setFavoriteMusicApiMessage('선택한 언어의 가사가 없습니다. 다른 언어를 선택하거나 가사 미포함으로 생성해주세요.');
        return;
      }

      const appliedKeywords = {
        ...(selectedSong.appliedKeywords || {}),
        source: 'music-note-edit',
      };

      const res = await fetch(
        'https://us-central1-soridraw-app-866a5.cloudfunctions.net/createSunoTrack',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: getFavoriteMusicApiTitle(selectedSong),
            prompt: editedPrompt || '',
            style: editedPrompt || '',
            lyrics: resolvedLyrics,
            appliedKeywords,
            titleLanguage: selectedLanguage || null,
            includeLyrics,
            lyricLanguages: includeLyrics && selectedLanguage ? [selectedLanguage] : [],
            lyricLanguage: selectedLanguage || null,
            model: sunoModelVersion,
            sunoVersion: sunoModelVersion,
            sunoModelVersion,
            generationIndex: 1,
            generationCount: 1,
            sourceGenerationBatchId: (selectedSong.appliedKeywords as any)?.generationBatchId || null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFavoriteMusicApiMessage(`Music API 생성 요청에 실패했습니다. ${data.error || ''}`.trim());
        return;
      }

      setFavoriteMusicApiMessage('Music API 생성 요청이 완료되었습니다. 라이브러리에서 자동으로 상태가 갱신됩니다.');
    } catch (error) {
      console.error('Music Note Music API generate failed:', error);
      setFavoriteMusicApiMessage('Music API 생성 요청 중 오류가 발생했습니다.');
    } finally {
      setIsFavoriteMusicApiGenerating(false);
    }
  };

  const getVisibleFavoriteIds = () => filteredFavorites.slice(0, visibleCount).map(song => song.id);

  const enterFavoriteSelectionMode = (song: any) => {
    setIsSelectionMode(true);
    setPendingSelectionAction(null);
    setSelectedSongIds(prev => prev.includes(song.id) ? prev : [...prev, song.id]);
    setActiveFavoriteMenuId(null);
  };

  const selectAllVisibleFavorites = () => {
    const visibleIds = getVisibleFavoriteIds();
    setSelectedSongIds(visibleIds);
    setIsSelectionMode(true);
    setPendingSelectionAction(null);
  };

  const handleFavoriteColorSelect = (song: any, color: string) => {
    const targetIds = isSelectionMode && selectedSongIds.length > 0
      ? selectedSongIds
      : [song.id];

    setFavoriteColorMap(prev => {
      const next = { ...prev };
      targetIds.forEach(id => { next[id] = color; });
      writeLocalColorMap('soridraw.favoriteColorTags', next);
      favoriteColorMapRef.current = next;
      favoriteColorDirtyRef.current = serializeColorMap(next) !== favoriteColorBaselineRef.current;
      return next;
    });

    setActiveFavoriteColorMenuId(null);
    if (isSelectionMode) exitSelectionMode();
  };


  const getFavoriteFullShareText = (song: any): string => {
    const sections = resolveKeywordsForDisplay(song)
      .map(section => `${section.title}: ${section.items.map(item => item.label).join(', ')}`)
      .filter(Boolean)
      .join('\n');

    return [
      `제목: ${getCombinedFavoriteTitle(song)}`,
      sections ? `\n[키워드]\n${sections}` : '',
      song?.lyrics?.korean ? `\n[한글 가사]\n${song.lyrics.korean}` : '',
      song?.lyrics?.english ? `\n[외국어 가사]\n${song.lyrics.english}` : '',
      song?.prompt ? `\n[프롬프트]\n${song.prompt}` : ''
    ].filter(Boolean).join('\n');
  };

  const shareFavoriteSong = async (song: any) => {
    const title = getCombinedFavoriteTitle(song);
    const text = getFavoriteFullShareText(song);
    try {
      if (navigator.share) {
        await navigator.share({ title: `SORIDRAW - ${title}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopiedType(`share-${song.id}`);
        setTimeout(() => setCopiedType(null), 1800);
      }
    } catch (error) {
      console.warn('favorite share cancelled or failed', error);
    }
  };


  const shareSelectedFavoriteSongs = async () => {
    const targets = favorites.filter(song => selectedSongIds.includes(song.id));
    if (targets.length === 0) return;

    const text = targets.map((song, index) => `--- ${index + 1}. ${getCombinedFavoriteTitle(song)} ---\n${getFavoriteFullShareText(song)}`).join('\n\n');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `SORIDRAW 선택한 ${targets.length}곡`,
          text: `SORIDRAW Music Note에서 선택한 ${targets.length}곡입니다.\n\n${text}`,
        });
      } else {
        await navigator.clipboard.writeText(`SORIDRAW Music Note 선택곡 ${targets.length}곡\n\n${text}`);
        setCopiedType('share-selected');
        setTimeout(() => setCopiedType(null), 1800);
      }
    } catch (error) {
      console.warn('selected favorites share cancelled or failed', error);
    } finally {
      setActiveFavoriteMenuId(null);
    }
  };

  const executeFavoriteMenuAction = (action: 'details' | 'select' | 'apply' | 'share' | 'sunoOpen' | 'sunoUrl' | 'sunoRemove' | 'favorite' | 'folder' | 'delete' | 'restore' | 'permanentDelete' | 'selectAll' | 'clearSelection' | 'lock' | 'unlock' | 'lockSelected' | 'unlockSelected' | 'shareSelected' | 'favoriteSelected' | 'unfavoriteSelected' | 'folderSelected' | 'deleteSelected' | 'restoreSelected' | 'permanentDeleteSelected', song: any) => {
    setActiveFavoriteMenuId(null);

    if (action === 'details') {
      setSelectedSong(song);
      return;
    }

    if (action === 'select') {
      enterFavoriteSelectionMode(song);
      return;
    }

    if (action === 'selectAll') {
      selectAllVisibleFavorites();
      return;
    }

    if (action === 'clearSelection') {
      exitSelectionMode();
      return;
    }

    if (action === 'lock') {
      if (!song.isLocked) handleToggleLock(song);
      return;
    }

    if (action === 'unlock') {
      if (song.isLocked) handleToggleLock(song);
      return;
    }

    if (action === 'lockSelected') {
      selectedSongIds.forEach(id => updateFavorite(id, { isLocked: true }));
      exitSelectionMode();
      return;
    }

    if (action === 'unlockSelected') {
      selectedSongIds.forEach(id => updateFavorite(id, { isLocked: false }));
      exitSelectionMode();
      return;
    }

    if (action === 'shareSelected') {
      shareSelectedFavoriteSongs();
      return;
    }

    if (action === 'favoriteSelected') {
      onHover({ id: 'favorites-already-saved', label: '즐겨찾기', description: '선택한 곡은 이미 보관함에 저장되어 있습니다.', _ts: Date.now() });
      setActiveFavoriteMenuId(null);
      return;
    }

    if (action === 'unfavoriteSelected') {
      favorites.filter(item => selectedSongIds.includes(item.id) && !item.isLocked).forEach(item => toggleFavorite(item));
      exitSelectionMode();
      return;
    }

    if (action === 'folderSelected') {
      openMusicNoteFolderPicker(selectedSongIds, musicNoteViewMode === 'sharedNote' ? 'sharedNote' : 'myNote');
      return;
    }

    if (action === 'deleteSelected') {
      const targets = favorites.filter(item => selectedSongIds.includes(item.id) && !item.isLocked);
      deleteSongsByMusicNoteContext(targets).then((deleted) => { if (deleted) exitSelectionMode(); });
      return;
    }

    if (action === 'restoreSelected') {
      handleSelectionRestoreFromTrash();
      return;
    }

    if (action === 'permanentDeleteSelected') {
      handleSelectionPermanentDeleteFromTrash();
      return;
    }

    if (action === 'apply') {
      applyKeywordsToNext(song);
      return;
    }

    if (action === 'share') {
      shareFavoriteSong(song);
      return;
    }

    if (action === 'sunoOpen') {
      openFavoriteSunoUrl(song);
      return;
    }

    if (action === 'sunoUrl') {
      openFavoriteSunoUrlEditor(song);
      return;
    }

    if (action === 'sunoRemove') {
      removeFavoriteSunoShareUrl(song);
      return;
    }

    if (action === 'favorite') {
      toggleFavorite(song);
      return;
    }

    if (action === 'folder') {
      openMusicNoteFolderPicker([song.id], musicNoteViewMode === 'sharedNote' ? 'sharedNote' : 'myNote');
      return;
    }

    if (action === 'restore') {
      restoreSongsFromFavoriteTrash([song.id]);
      return;
    }

    if (action === 'permanentDelete') {
      permanentlyDeleteFavoriteSongs([song.id]);
      return;
    }

    if (action === 'delete') {
      if (song.isLocked) {
        forceDeleteUnlockedFavoriteIfNeeded(song);
      } else {
        deleteSongsByMusicNoteContext([song]);
      }
    }
  };

  const renderFavoriteKeywordChips = (song: any) => {
    const entries = [
      ...getSongGenreValues(song).map((value: string) => ({ type: 'genre', value })),
      ...getSongMoodValues(song).map((value: string) => ({ type: 'mood', value })),
      ...getSongThemeValues(song).map((value: string) => ({ type: 'theme', value })),
      ...(getSongSituationSummary(song) ? [{ type: 'situation', value: getSongSituationSummary(song) }] : []),
      ...getSongStyleValues(song).map((value: string) => ({ type: 'style', value })),
      ...getSongInstrumentSoundValues(song).map((value: string) => ({ type: 'sound', value })),
    ];

    if (song.appliedKeywords?.vocalType) {
      entries.push({ type: 'vocal', value: song.appliedKeywords.vocalType });
    }

    return entries.map((entry) => {
      const meta = getKeywordMeta(entry.value);
      return (
        <span
          key={`${entry.type}-${entry.value}`}
          onClick={(event) => {
            event.stopPropagation();
            onHover({
              id: `favorite-${entry.type}-${entry.value}`,
              label: entry.value,
              labelKo: meta?.labelKo,
              description: meta?.descriptionKo || meta?.description || `${entry.value} 키워드입니다.`,
              _ts: Date.now(),
            });
          }}
          className="text-[9px] px-2 py-0.5 rounded-md whitespace-nowrap cursor-pointer border border-black/20 bg-white/[0.075] text-white/58 transition-colors hover:text-white/78"
        >
          #{meta?.labelKo || entry.value}
        </span>
      );
    });
  };

  const filteredFavorites = favorites.filter(song => {
    const matchesSearch = (song.koreanTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.englishTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.lyrics.korean.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.lyrics.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getSongGenreValues(song).some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getSongMoodValues(song).some((m: string) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getSongThemeValues(song).some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getSongStyleValues(song).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getSongInstrumentSoundValues(song).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesColor = favoriteColorFilter === 'all' || getFavoriteColorValue(song) === favoriteColorFilter;
    const isTrashed = isFavoriteInTrash(song);
    const matchesTrashState = favoriteTrashView
      ? musicNoteViewMode === 'noteSpace' && isTrashed
      : !isTrashed;
    const matchesFolder = musicNoteViewMode === 'noteSpace'
      ? true
      : musicNoteViewMode === 'myNote'
        ? getMusicNoteFolderIdFromSong(song, 'myNote') === selectedMyNoteFolderId
        : getMusicNoteFolderIdFromSong(song, 'sharedNote') === selectedSharedNoteFolderId;
    return matchesSearch && matchesColor && matchesTrashState && matchesFolder;
  }).sort((a, b) => {
    const isKorean = (text: string) => /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);

    switch (sortBy) {
      case 'latest':
        return getTimestampMs(b.createdAtMs || b.createdAt) - getTimestampMs(a.createdAtMs || a.createdAt);
      case 'oldest':
        return getTimestampMs(a.createdAtMs || a.createdAt) - getTimestampMs(b.createdAtMs || b.createdAt);
      case 'genre-1':
        return (getDisplaySubGenre(a) || '').localeCompare(getDisplaySubGenre(b) || '');
      case 'genre-2': {
        const aG = a.appliedKeywords.genre[1] || a.appliedKeywords.genre[0] || '';
        const bG = b.appliedKeywords.genre[1] || b.appliedKeywords.genre[0] || '';
        return aG.localeCompare(bG);
      }
      case 'title-en': {
        const aT = (a.englishTitle || a.title || '').toLowerCase();
        const bT = (b.englishTitle || b.title || '').toLowerCase();
        return aT.localeCompare(bT);
      }
      case 'title-ko': {
        const aT = a.koreanTitle || a.title || '';
        const bT = b.koreanTitle || b.title || '';
        const aIsKo = isKorean(aT);
        const bIsKo = isKorean(bT);
        if (aIsKo && !bIsKo) return -1;
        if (!aIsKo && bIsKo) return 1;
        return aT.localeCompare(bT);
      }
      case 'locked-top':
        if (a.isLocked !== b.isLocked) return a.isLocked ? -1 : 1;
        return getTimestampMs(b.createdAtMs || b.createdAt) - getTimestampMs(a.createdAtMs || a.createdAt);
      case 'locked-bottom':
        if (a.isLocked !== b.isLocked) return a.isLocked ? 1 : -1;
        return getTimestampMs(b.createdAtMs || b.createdAt) - getTimestampMs(a.createdAtMs || a.createdAt);
      default:
        return 0;
    }
  });

  const musicNoteTabs = [
    { id: 'noteSpace' as const, label: '노트 스페이스', description: '내가 저장한 전체 뮤직노트입니다.' },
    { id: 'myNote' as const, label: '마이 노트', description: '개인 폴더별로 정리할 노트 공간입니다.' },
    { id: 'sharedNote' as const, label: '공유 노트', description: '공유받은 곡을 저장하고 조회 전용으로 관리할 공간입니다.' },
  ];

  const handleAddMusicNoteFolder = async (mode: MusicNoteFolderMode) => {
    const folders = mode === 'sharedNote' ? sharedNoteFolders : myNoteFolders;
    if (folders.length >= 10) {
      showFavoriteToast('최대 개수까지 생성되었습니다.');
      return;
    }

    const numberTitles = folders
      .map((folder) => Number(folder.title))
      .filter((value) => Number.isFinite(value) && value > 0);
    const nextNumber = numberTitles.length > 0 ? Math.max(...numberTitles) + 1 : 1;
    const nextFolder: MusicNoteFolder = {
      id: `note-${mode}-${Date.now()}`,
      title: String(nextNumber),
      order: folders.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nextFolders = [...folders, nextFolder];

    if (mode === 'sharedNote') {
      setSharedNoteFolders(nextFolders);
      setSelectedSharedNoteFolderId(nextFolder.id);
    } else {
      setMyNoteFolders(nextFolders);
      setSelectedMyNoteFolderId(nextFolder.id);
    }

    try {
      await persistMusicNoteFolders(mode, nextFolders);
      showFavoriteToast('폴더를 추가했습니다.');
    } catch (error) {
      console.error('add music note folder failed:', error);
      showFavoriteToast('폴더 추가에 실패했습니다.');
    }
  };

  const commitRenameMusicNoteFolder = async () => {
    if (!musicNoteFolderRenameArgs || !user?.uid) return;
    const { mode, folder, newTitle } = musicNoteFolderRenameArgs;
    if (folder.isDefault || folder.id === 'default') {
      showFavoriteToast('기본 폴더 이름은 변경할 수 없습니다.');
      return;
    }
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      showFavoriteToast('폴더 이름을 입력해주세요.');
      return;
    }
    if (trimmedTitle.length > 20) {
      showFavoriteToast('폴더 이름은 최대 20자까지 가능합니다.');
      return;
    }

    const folders = mode === 'sharedNote' ? sharedNoteFolders : myNoteFolders;
    if (folders.some((item) => item.id !== folder.id && item.title === trimmedTitle)) {
      showFavoriteToast('같은 이름의 폴더가 이미 있습니다.');
      return;
    }

    const nextFolders = folders.map((item) => item.id === folder.id
      ? { ...item, title: trimmedTitle, updatedAt: Date.now() }
      : item
    );

    if (mode === 'sharedNote') setSharedNoteFolders(nextFolders);
    else setMyNoteFolders(nextFolders);

    try {
      await persistMusicNoteFolders(mode, nextFolders);
      const affectedSongs = favorites.filter((song) => getMusicNoteFolderIdFromSong(song, mode) === folder.id);
      const titleUpdates = mode === 'sharedNote'
        ? { sharedNoteFolderTitle: trimmedTitle, sharedNoteFolderUpdatedAt: Date.now() }
        : { noteFolderTitle: trimmedTitle, noteFolderUpdatedAt: Date.now() };
      await Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), titleUpdates)));
      setMusicNoteFolderRenameArgs(null);
      showFavoriteToast('폴더 이름이 변경되었습니다.');
    } catch (error) {
      console.error('rename music note folder failed:', error);
      showFavoriteToast('폴더 이름 변경에 실패했습니다.');
    }
  };

  const openDeleteMusicNoteFolder = (mode: MusicNoteFolderMode, folder: MusicNoteFolder) => {
    if (folder.isDefault || folder.id === 'default') {
      showFavoriteToast('기본 폴더는 삭제할 수 없습니다.');
      return;
    }
    setMusicNoteFolderDeleteArgs({ mode, folder });
  };

  const commitDeleteMusicNoteFolder = async () => {
    if (!musicNoteFolderDeleteArgs || !user?.uid) return;
    const { mode, folder } = musicNoteFolderDeleteArgs;
    if (folder.isDefault || folder.id === 'default') {
      showFavoriteToast('기본 폴더는 삭제할 수 없습니다.');
      return;
    }

    const folders = mode === 'sharedNote' ? sharedNoteFolders : myNoteFolders;
    const nextFolders = normalizeMusicNoteFolders(
      folders.filter((item) => item.id !== folder.id).map((item, index) => ({ ...item, order: index + 1, updatedAt: Date.now() })),
      mode === 'sharedNote' ? DEFAULT_SHARED_NOTE_FOLDERS : DEFAULT_MY_NOTE_FOLDERS
    );

    if (mode === 'sharedNote') {
      setSharedNoteFolders(nextFolders);
      if (selectedSharedNoteFolderId === folder.id) setSelectedSharedNoteFolderId('default');
    } else {
      setMyNoteFolders(nextFolders);
      if (selectedMyNoteFolderId === folder.id) setSelectedMyNoteFolderId('default');
    }

    try {
      await persistMusicNoteFolders(mode, nextFolders);
      const affectedSongs = favorites.filter((song) => getMusicNoteFolderIdFromSong(song, mode) === folder.id);
      const fallbackUpdates = mode === 'sharedNote'
        ? { sharedNoteFolderId: 'default', sharedNoteFolderTitle: '기본', sharedNoteFolderUpdatedAt: Date.now() }
        : { noteFolderId: 'default', noteFolderTitle: '기본', noteFolderUpdatedAt: Date.now() };
      await Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), fallbackUpdates)));
      setMusicNoteFolderDeleteArgs(null);
      showFavoriteToast('폴더를 삭제했습니다. 곡은 기본 폴더로 이동했습니다.');
    } catch (error) {
      console.error('delete music note folder failed:', error);
      showFavoriteToast('폴더 삭제에 실패했습니다.');
    }
  };

  const FOLDER_REORDER_LONG_PRESS_MS = 700;
  const FOLDER_REORDER_RIGHT_TRIGGER_RATIO = 0.62;
  const FOLDER_REORDER_LEFT_TRIGGER_RATIO = 0.42;

  const getMusicNoteFolderDragKey = (mode: MusicNoteFolderMode, folderId: string) => `${mode}:${folderId}`;

  const getMusicNoteFoldersByMode = (mode: MusicNoteFolderMode) => (
    mode === 'sharedNote' ? sharedNoteFoldersRef.current : myNoteFoldersRef.current
  );

  const setMusicNoteFoldersByMode = (mode: MusicNoteFolderMode, folders: MusicNoteFolder[]) => {
    if (mode === 'sharedNote') {
      sharedNoteFoldersRef.current = folders;
      setSharedNoteFolders(folders);
    } else {
      myNoteFoldersRef.current = folders;
      setMyNoteFolders(folders);
    }
  };

  const autoScrollMusicNoteFolderBar = (mode: MusicNoteFolderMode, clientX: number) => {
    const container = musicNoteFolderBarRefs.current[mode];
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

  const reorderMusicNoteFoldersByPointer = (mode: MusicNoteFolderMode, folderId: string, clientX: number) => {
    const folders = getMusicNoteFoldersByMode(mode);
    const draggedFolder = folders.find((folder) => folder.id === folderId);
    if (!draggedFolder || draggedFolder.isDefault || draggedFolder.id === 'default') return;

    const defaultFolders = folders.filter((folder) => folder.isDefault || folder.id === 'default');
    const movableFolders = folders.filter((folder) => !(folder.isDefault || folder.id === 'default'));
    const currentIndex = movableFolders.findIndex((folder) => folder.id === folderId);
    if (currentIndex < 0) return;

    const centers = movableFolders
      .map((folder, index) => {
        const element = musicNoteFolderButtonRefs.current[getMusicNoteFolderDragKey(mode, folder.id)];
        const rect = element?.getBoundingClientRect();
        return rect ? { id: folder.id, index, center: rect.left + rect.width / 2 } : null;
      })
      .filter(Boolean) as Array<{ id: string; index: number; center: number }>;

    if (centers.length <= 1) return;

    const currentCenter = centers.find((item) => item.id === folderId)?.center;
    if (!Number.isFinite(currentCenter)) return;

    let targetIndex = currentIndex;
    const nextCenter = centers[currentIndex + 1]?.center;
    const previousCenter = centers[currentIndex - 1]?.center;

    if (nextCenter !== undefined && clientX > currentCenter! + (nextCenter - currentCenter!) * FOLDER_REORDER_RIGHT_TRIGGER_RATIO) {
      targetIndex = currentIndex + 1;
    } else if (previousCenter !== undefined && clientX < currentCenter! - (currentCenter! - previousCenter) * FOLDER_REORDER_LEFT_TRIGGER_RATIO) {
      targetIndex = currentIndex - 1;
    }

    if (targetIndex === currentIndex) return;

    const nextMovable = [...movableFolders];
    const [moving] = nextMovable.splice(currentIndex, 1);
    nextMovable.splice(targetIndex, 0, moving);

    const nextFolders = [...defaultFolders, ...nextMovable].map((folder, index) => ({
      ...folder,
      order: index + 1,
      updatedAt: Date.now(),
    }));
    setMusicNoteFoldersByMode(mode, nextFolders);
  };

  const handleMusicNoteFolderPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    mode: MusicNoteFolderMode,
    folder: MusicNoteFolder,
  ) => {
    if (folder.isDefault || folder.id === 'default') return;
    if (event.button !== undefined && event.button !== 0) return;

    if (musicNoteFolderPressTimerRef.current) window.clearTimeout(musicNoteFolderPressTimerRef.current);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    musicNoteFolderDragRef.current = { mode, folderId: folder.id, pointerId, startX, startY, active: false, target };

    musicNoteFolderPressTimerRef.current = window.setTimeout(() => {
      const drag = musicNoteFolderDragRef.current;
      if (!drag || drag.pointerId !== pointerId || drag.folderId !== folder.id || drag.mode !== mode) return;
      drag.active = true;
      setMusicNoteFolderDragging({ mode, folderId: folder.id });
      document.body.classList.add('soridraw-folder-dragging');
      const handleWindowPointerMove = (nativeEvent: PointerEvent) => {
        const currentDrag = musicNoteFolderDragRef.current;
        if (!currentDrag?.active || currentDrag.pointerId !== pointerId) return;
        if (nativeEvent.pointerType === 'touch') return;
        nativeEvent.preventDefault();
        autoScrollMusicNoteFolderBar(currentDrag.mode, nativeEvent.clientX);
        reorderMusicNoteFoldersByPointer(currentDrag.mode, currentDrag.folderId, nativeEvent.clientX);
      };
      const handleWindowTouchMove = (nativeEvent: TouchEvent) => {
        const currentDrag = musicNoteFolderDragRef.current;
        if (!currentDrag?.active || currentDrag.pointerId !== pointerId) return;
        const touch = nativeEvent.touches?.[0];
        if (!touch) return;
        nativeEvent.preventDefault();
        autoScrollMusicNoteFolderBar(currentDrag.mode, touch.clientX);
        reorderMusicNoteFoldersByPointer(currentDrag.mode, currentDrag.folderId, touch.clientX);
      };
      const handleWindowPointerEnd = (nativeEvent: PointerEvent) => {
        const currentDrag = musicNoteFolderDragRef.current;
        if (!currentDrag || currentDrag.pointerId !== pointerId) return;
        void finishMusicNoteFolderDrag();
      };
      const handleWindowTouchEnd = () => {
        const currentDrag = musicNoteFolderDragRef.current;
        if (!currentDrag || currentDrag.pointerId !== pointerId) return;
        void finishMusicNoteFolderDrag();
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
        // Ignore capture failures on older mobile browsers.
      }
    }, FOLDER_REORDER_LONG_PRESS_MS);
  };

  const handleMusicNoteFolderPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = musicNoteFolderDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active && moved > 10) {
      if (musicNoteFolderPressTimerRef.current) window.clearTimeout(musicNoteFolderPressTimerRef.current);
      musicNoteFolderPressTimerRef.current = null;
      musicNoteFolderDragRef.current = null;
      return;
    }

    if (!drag.active) return;
    if (event.pointerType === 'touch') return;
    event.preventDefault();
    // Keep the drag responsive while the cursor is still inside the original folder button.
    // Touch dragging is handled by the window-level touch listener so native scroll does not trap it.
    autoScrollMusicNoteFolderBar(drag.mode, event.clientX);
    reorderMusicNoteFoldersByPointer(drag.mode, drag.folderId, event.clientX);
  };

  const finishMusicNoteFolderDrag = async (event?: React.PointerEvent<HTMLButtonElement>) => {
    if (musicNoteFolderPressTimerRef.current) window.clearTimeout(musicNoteFolderPressTimerRef.current);
    musicNoteFolderPressTimerRef.current = null;

    const drag = musicNoteFolderDragRef.current;
    musicNoteFolderDragRef.current = null;
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
      setMusicNoteFolderDragging(null);
      return;
    }

    const dragKey = getMusicNoteFolderDragKey(drag.mode, drag.folderId);
    musicNoteFolderSuppressClickRef.current = dragKey;
    window.setTimeout(() => {
      if (musicNoteFolderSuppressClickRef.current === dragKey) musicNoteFolderSuppressClickRef.current = null;
    }, 250);

    try {
      (event?.currentTarget || drag.target)?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // Ignore release failures.
    }

    setMusicNoteFolderDragging(null);
    try {
      await persistMusicNoteFolders(drag.mode, getMusicNoteFoldersByMode(drag.mode));
      showFavoriteToast('폴더 순서를 변경했습니다.');
    } catch (error) {
      console.error('reorder music note folders failed:', error);
      showFavoriteToast('폴더 순서 저장에 실패했습니다.');
    }
  };

  const renderMusicNoteFolderBar = (mode: 'myNote' | 'sharedNote') => {
    const isShared = mode === 'sharedNote';
    const folders = isShared ? sharedNoteFolders : myNoteFolders;
    const selectedId = isShared ? selectedSharedNoteFolderId : selectedMyNoteFolderId;
    const setSelectedId = isShared ? setSelectedSharedNoteFolderId : setSelectedMyNoteFolderId;

    return (
      <div className="mt-4 md:mt-5 space-y-3" data-selection-keep="true">
        <h3 className="px-2 text-[12px] md:text-sm font-bold text-[#D8A4A2]/80 tracking-wide">
          {isShared ? '공유 받은 노트' : '나의 노트폴더'}
        </h3>
        <div
          ref={(element) => { musicNoteFolderBarRefs.current[mode] = element; }}
          className="soridraw-folder-drag-scrollbar flex items-center gap-2 overflow-x-auto hide-scrollbar px-2 pb-2"
        >
          {folders.map((folder) => {
            const dragKey = getMusicNoteFolderDragKey(mode, folder.id);
            const isDraggingFolder = musicNoteFolderDragging?.mode === mode && musicNoteFolderDragging.folderId === folder.id;
            const isDefaultFolder = folder.isDefault || folder.id === 'default';
            return (
              <button
                key={folder.id}
                ref={(element) => { musicNoteFolderButtonRefs.current[dragKey] = element; }}
                type="button"
                onPointerDown={(event) => handleMusicNoteFolderPointerDown(event, mode, folder)}
                onPointerMove={handleMusicNoteFolderPointerMove}
                onPointerUp={finishMusicNoteFolderDrag}
                onPointerCancel={finishMusicNoteFolderDrag}
                onClick={() => {
                  if (musicNoteFolderSuppressClickRef.current === dragKey) return;
                  setSelectedId(folder.id);
                }}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border select-none',
                  !isDefaultFolder && 'cursor-grab active:cursor-grabbing touch-pan-x',
                  isDefaultFolder && 'touch-pan-x',
                  isDraggingFolder && 'soridraw-folder-drag-active touch-none z-10',
                  selectedId === folder.id
                    ? 'bg-[#AC5045]/78 text-white border-[#AC5045]/55 shadow-lg'
                    : 'bg-[var(--bg-secondary)] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                )}
                title={isDefaultFolder ? folder.title : '0.7초 길게 눌러 순서 변경'}
              >
                {folder.title}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleAddMusicNoteFolder(mode)}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all bg-[var(--bg-secondary)] text-white/40 hover:bg-white/5 hover:text-white flex items-center gap-1 shadow-btn"
            title={isShared ? '공유 노트폴더 추가' : '노트폴더 추가'}
          >
            <span className="text-lg font-light leading-none">+</span>
          </button>
          {(() => {
            const activeFolder = folders.find((folder) => folder.id === selectedId);
            if (!activeFolder || activeFolder.isDefault || activeFolder.id === 'default') return null;
            return (
              <div className="shrink-0 inline-flex items-center overflow-hidden rounded-xl bg-[var(--bg-secondary)] shadow-btn border border-white/10">
                <button
                  type="button"
                  onClick={() => setMusicNoteFolderRenameArgs({ mode, folder: activeFolder, newTitle: activeFolder.title })}
                  className="h-9 w-9 flex items-center justify-center text-white/45 hover:text-[#D8A4A2] hover:bg-white/5 transition-all"
                  title="폴더 이름 변경"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteMusicNoteFolder(mode, activeFolder)}
                  className="h-9 w-9 flex items-center justify-center text-white/45 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="폴더 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderMusicNotePendingView = (mode: 'myNote' | 'sharedNote') => {
    const isShared = mode === 'sharedNote';
    return (
      <>
        {renderMusicNoteFolderBar(mode)}
        <div className="mt-2 md:mt-3 min-h-[34vh] rounded-3xl border border-black/20 bg-[var(--card-bg)] p-8 text-center shadow-[var(--shadow-md)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-[#D8A4A2]">
            {isShared ? <Share2 className="h-6 w-6" /> : <FolderOutput className="h-6 w-6" />}
          </div>
          <h3 className="mt-5 text-xl font-black text-white">{isShared ? '공유 노트' : '마이 노트'}</h3>
          <p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-white/48">
            {isShared
              ? '공유받은 뮤직노트를 저장하고 조회 전용으로 관리하는 공간입니다. 다음 단계에서 공유 저장과 읽기 전용 상세 화면을 연결합니다.'
              : '내 뮤직노트를 개인 폴더로 정리하는 공간입니다. 다음 단계에서 폴더 생성과 곡 저장 기능을 연결합니다.'}
          </p>
        </div>
      </>
    );
  };

  return (
    <div 
      className="soridraw-musicnote-theme mx-auto w-full max-w-[1548px] px-4 md:px-6 pt-24 pb-12 font-sans relative"
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;

        if (activeFavoriteMenuId && !target.closest('[data-more-menu-panel="true"]')) {
          e.preventDefault();
          e.stopPropagation();
          setActiveFavoriteMenuId(null);
          return;
        }

        if (!isSelectionMode) return;
        if (target.closest('[data-selection-keep="true"]')) return;
        exitSelectionMode('history');
      }}
    >
      <style>{`
        .favorite-keyword-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y;
          cursor: grab;
        }
        .favorite-keyword-strip:active { cursor: grabbing; }
        .favorite-keyword-strip::-webkit-scrollbar { display: none; }
        .favorite-mobile-title-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y;
          cursor: grab;
        }
        .favorite-mobile-title-strip:active { cursor: grabbing; }
        .favorite-mobile-title-strip::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="md:hidden h-7" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="mb-4 md:mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 translate-y-2 md:translate-y-3"
      >
          <div>
            <h1 className="text-3xl md:text-5xl font-black leading-none tracking-tight text-white font-display flex items-center gap-3">
              <HeartIcon className="w-9 h-9 text-[#AC5045] shrink-0" />
              <span>Music <span className="text-[#AC5045]">Note</span></span>
            </h1>
            <p className="text-[var(--text-secondary)] text-sm md:text-base mt-2 mb-[2px]">저장한 곡을 편집하고, 다음 곡에 적용합니다.</p>
          </div>

      </motion.div>

      <div className="space-y-4 md:space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => navigate('/studio')}
              className="h-[46px] w-[46px] shrink-0 rounded-2xl border border-black/20 bg-[var(--bg-secondary)] text-white/75 hover:bg-white/5 hover:text-[#DFA05D] transition-all flex items-center justify-center"
              title="스튜디오"
            >
              <Zap className="w-4 h-4" />
            </button>
            <div className="relative flex-1 min-w-0 group overflow-hidden">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
              <Search className="w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[#AC5045] transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full h-[46px] bg-[var(--bg-secondary)] border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#AC5045]/50 transition-all"
            />
            {!searchQuery && !isSearchFocused && (
              <div className="absolute inset-0 flex items-center pl-12 pr-4 pointer-events-none overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={placeholderIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35 }}
                    className="text-sm text-white/40 whitespace-nowrap"
                  >
                    {placeholders[placeholderIndex]}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            </div>
          </div>

          <div className="flex h-[46px] items-center gap-1.5 rounded-2xl border border-black/20 bg-[var(--bg-secondary)] p-1 shrink-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
            <button
              onClick={() => setFavoriteColorFilter('all')}
              className={`h-9 shrink-0 whitespace-nowrap px-4 rounded-xl text-xs font-bold transition-all ${favoriteColorFilter === 'all' ? 'bg-[#AC5045]/24 text-[#D8A4A2]' : 'bg-transparent text-white/60 hover:text-white/75'}`}
            >
              전체
            </button>
            <div className="mx-1 h-3 w-px bg-white/10" />
            {FAVORITE_COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                onClick={() => setFavoriteColorFilter(color.value)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${favoriteColorFilter === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-secondary)] scale-110' : 'hover:scale-110 brightness-75 hover:brightness-100'}`}
                title={color.label}
              >
                <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color.color }} />
              </button>
            ))}

          </div>

          <div className="flex h-[46px] items-center rounded-2xl border border-black/20 bg-[var(--bg-secondary)] p-1 shrink-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
            {(['latest', 'oldest', 'genre', 'title', 'locked'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSortChange(mode)}
                className={`h-9 shrink-0 whitespace-nowrap px-3.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                  (mode === 'latest' && sortBy === 'latest') ||
                  (mode === 'oldest' && sortBy === 'oldest') ||
                  (mode === 'genre' && sortBy.startsWith('genre')) ||
                  (mode === 'title' && sortBy.startsWith('title')) ||
                  (mode === 'locked' && sortBy.startsWith('locked'))
                    ? 'bg-[#AC5045]/72 text-white'
                    : 'bg-transparent text-white/50 hover:text-white/75'
                }`}
              >
                {mode === 'latest' ? '최신' : mode === 'oldest' ? '오래된' : mode === 'genre' ? '장르' : mode === 'title' ? '제목' : '잠금'}
              </button>
            ))}
            <button
              onClick={() => {
                setMusicNoteViewMode('noteSpace');
                setFavoriteTrashView((prev) => !prev);
                setVisibleCount(15);
                exitSelectionMode('ui');
              }}
              className={`h-9 shrink-0 whitespace-nowrap px-3.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${favoriteTrashView ? 'bg-[#AC5045]/72 text-white' : 'bg-transparent text-white/50 hover:text-white/75'}`}
            >
              휴지통
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 md:mt-5 flex items-center gap-2 max-w-full whitespace-nowrap" data-selection-keep="true">
        <div className="grid grid-cols-3 gap-0 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-black/20 w-full max-w-[480px] shadow-[var(--shadow-md)]">
          {musicNoteTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMusicNoteViewMode(tab.id);
                setFavoriteTrashView(false);
                setVisibleCount(15);
                exitSelectionMode('ui');
              }}
              onMouseEnter={() => onHover({ id: `music-note-tab-${tab.id}`, label: tab.label, description: tab.description, _ts: Date.now() })}
              onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
              onTouchStart={() => onLongPressStart({ id: `music-note-tab-${tab.id}`, label: tab.label, description: tab.description })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                'min-w-0 whitespace-nowrap px-2 md:px-5 py-2.5 rounded-xl font-bold text-[11px] sm:text-xs md:text-sm truncate transition-all',
                musicNoteViewMode === tab.id
                  ? 'bg-[#AC5045]/78 text-white shadow-lg'
                  : 'text-white/60 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {(musicNoteViewMode === 'myNote' || musicNoteViewMode === 'sharedNote') && (
        renderMusicNoteFolderBar(musicNoteViewMode)
      )}

      {(isFavoritesLoading && favorites.length === 0) ? (
        <div className="mt-[13px] md:mt-[21px] min-h-[40vh] flex flex-col items-center justify-center text-center bg-[var(--card-bg)] rounded-3xl border border-black/20 p-12 shadow-[var(--shadow-md)]">
          <Loader2 className="w-12 h-12 text-[#AC5045] animate-spin mb-4" />
          <p className="text-[var(--text-secondary)] text-lg font-medium">노트를 불러오는 중...</p>
        </div>
      ) : favorites.length === 0 ? (
        <div className="mt-[13px] md:mt-[21px] min-h-[40vh] flex flex-col items-center justify-center text-center bg-[var(--card-bg)] rounded-3xl border border-black/20 p-12 shadow-[var(--shadow-md)]">
          <Music className="w-12 h-12 text-[var(--text-secondary)]/20 mb-4" />
          <p className="text-[var(--text-secondary)] text-lg font-medium">아직 저장된 곡이 없습니다.</p>
          <Link to="/" className="mt-6 text-[#AC5045] font-bold hover:underline">
            첫 번째 곡 만들러 가기
          </Link>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="mt-[13px] md:mt-[21px] min-h-[30vh] flex flex-col items-center justify-center text-center">
          <Search className="w-10 h-10 text-[var(--text-secondary)]/20 mb-4" />
          <p className="text-[var(--text-secondary)]">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="mt-[13px] md:mt-[21px] space-y-12">
          <div className="space-y-4">
            {filteredFavorites.slice(0, visibleCount).map((song) => {
              const isSelected = selectedSongIds.includes(song.id);
              const colorHex = getFavoriteColorHex(song.id, song);
              const isBulkMenu = isSelectionMode && selectedSongIds.length > 0;
              const mobileGenreLabel = getDisplaySubGenre(song);
              const mobileTitles = getNormalizedTitles(song);
              const mobileTitleText = mobileTitles.korean && mobileTitles.english
                ? `${mobileTitles.korean} | ${mobileTitles.english}`
                : mobileTitles.korean || mobileTitles.english || 'Untitled';

              return (
                <motion.div
                  key={song.id}
                  data-selection-keep="true"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onMouseDown={(event) => handleCardLongPressStart(event, song)}
                  onMouseMove={handleCardLongPressMove}
                  onMouseUp={handleCardLongPressEnd}
                  onTouchStart={(event) => handleCardLongPressStart(event, song)}
                  onTouchMove={handleCardLongPressMove}
                  onTouchEnd={handleCardLongPressEnd}
                  onTouchCancel={handleCardLongPressEnd}
                  onContextMenu={(event) => {
                    if (isSelectionMode) event.preventDefault();
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = '#171717';
                  }}
                  onMouseLeave={(event) => {
                    handleCardLongPressEnd();
                    event.currentTarget.style.backgroundColor = '';
                  }}
                  onClick={(e) => {
                    if (longPressTriggeredRef.current || suppressNextCardClickRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      longPressTriggeredRef.current = false;
                      suppressNextCardClickRef.current = false;
                      cardClickStartPointRef.current = null;
                      return;
                    }

                    if (shouldIgnoreFavoriteCardClickFromPointerTravel(e)) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }

                    if (isSelectionMode) {
                      e.stopPropagation();
                      toggleSongSelection(song.id);
                      setPendingSelectionAction(null);
                      return;
                    }

                    setSelectedSong(song);
                  }}
                  className={cn(
                    "group relative overflow-visible rounded-2xl border border-black/24 bg-[var(--bg-secondary)] select-none",
                    isSelectionMode ? "cursor-pointer" : ""
                  )}
                >
                  <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4">
                    {isSelectionMode && (
                      <button
                        data-no-card-long-press="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSongSelection(song.id);
                        }}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'border-[#D8A4A2]/75 bg-[#D8A4A2]/20 text-[#D8A4A2] shadow-[0_0_0_1px_rgba(216,164,162,0.18)]' : 'border-white/35 bg-white/[0.08] text-white/65 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:border-white/55 hover:bg-white/[0.12] hover:text-white/85'
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : null}
                      </button>
                    )}

                    {getFavoriteSunoShareUrl(song) ? (
                      <button
                        data-no-card-long-press="true"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openFavoriteSunoUrl(song);
                        }}
                        onMouseEnter={() => onHover({ id: `favorite-suno-open-${song.id}`, label: '수노에서 열기', description: '연결된 수노 공유 링크를 새 창으로 엽니다.' })}
                        onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                        onTouchStart={() => onLongPressStart({ id: `favorite-suno-open-${song.id}`, label: '수노에서 열기', description: '연결된 수노 공유 링크를 새 창으로 엽니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="-ml-1 relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#C76559]/24 text-[#F2B8AE] transition-all hover:bg-[#C76559]/34 hover:text-white md:ml-0 md:h-12 md:w-12 md:bg-[#C76559]/22 md:hover:bg-[#C76559]/30 shadow-[0_0_0_1px_rgba(216,164,162,0.16)]"
                        title="수노에서 열기"
                      >
                        {getFavoriteSunoLinkCount(song) > 1 && (
                          <span className="absolute right-0.5 top-0.5 z-20 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/30 bg-[#D8A4A2] px-1 text-[9px] font-black leading-none text-[#211615] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                            {getFavoriteSunoLinkCount(song)}
                          </span>
                        )}
                        {getFavoriteSunoCoverUrl(song) ? (
                          <>
                            <img
                              src={getFavoriteSunoCoverUrl(song)}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover opacity-95 transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                            <span className="absolute inset-0 bg-black/18" />
                            <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white shadow-[0_0_12px_rgba(0,0,0,0.35)]">
                              <Play className="h-3 w-3 translate-x-[1px] fill-current" />
                            </span>
                          </>
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                      </button>
                    ) : (
                      <div className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-[#E98F7F] md:ml-0 md:h-12 md:w-12 md:bg-white/[0.07] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                        <Music className="w-5 h-5" />
                      </div>
                    )}

                    <button
                      data-no-card-long-press="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveFavoriteColorMenuId(activeFavoriteColorMenuId === song.id ? null : song.id);
                        setActiveFavoriteMenuId(null);
                      }}
                      className="w-3 h-3 rounded-full shrink-0 hover:scale-110 transition-transform"
                      style={{ backgroundColor: colorHex }}
                      title="색상 지정"
                    />

                    {activeFavoriteColorMenuId === song.id && (
                      <div className="absolute left-14 md:left-20 top-[54px] z-40 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#2a2a2a] p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        {FAVORITE_COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleFavoriteColorSelect(song, color.value);
                            }}
                            className="w-5 h-5 rounded-full outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a2a2a]"
                            style={{ backgroundColor: color.color }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    )}

                                        <div className="flex-1 min-w-0 pl-1 pr-1 md:pl-0 md:pr-0">
                      <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 cursor-default">
                        <div className="md:hidden min-w-0 leading-tight cursor-default">
                          <div className="text-[13px] font-extrabold text-white truncate select-none cursor-default">
                            {mobileGenreLabel ? `[${mobileGenreLabel}]` : '[Music]'}
                          </div>
                          <div className="favorite-mobile-title-strip mt-0.5 max-w-[calc(100vw-192px)] overflow-x-auto overflow-y-hidden whitespace-nowrap text-[14px] font-bold text-white/92 md:max-w-none cursor-default">
                            <span
                              data-no-card-long-press="true"
                              className="inline-block max-w-full select-text cursor-text"
                              onMouseDown={(event) => {
                                const point = getLongPressPoint(event);
                                if (point) cardClickStartPointRef.current = point;
                              }}
                              onTouchStart={(event) => {
                                const point = getLongPressPoint(event);
                                if (point) cardClickStartPointRef.current = point;
                              }}
                            >
                              {mobileTitleText}
                            </span>
                          </div>
                        </div>
                        <h3 className="hidden md:block min-w-0 text-[15px] font-bold text-white truncate cursor-default">
                          <span
                            data-no-card-long-press="true"
                            className="inline-block max-w-full truncate align-bottom select-text cursor-text"
                            onMouseDown={(event) => {
                              const point = getLongPressPoint(event);
                              if (point) cardClickStartPointRef.current = point;
                            }}
                            onTouchStart={(event) => {
                              const point = getLongPressPoint(event);
                              if (point) cardClickStartPointRef.current = point;
                            }}
                          >
                            {getCombinedFavoriteTitle(song)}
                          </span>
                        </h3>
                        <span className="hidden md:inline text-[10px] text-white/35 shrink-0 select-none cursor-default">{getRelativeTime(song.createdAtMs || song.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 min-w-0">
                        <div
                          className="favorite-keyword-strip relative flex w-full max-w-[calc(100vw-232px)] md:max-w-[260px] gap-1.5 overflow-x-auto overflow-y-hidden rounded-lg pr-2"
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            const target = event.currentTarget;
                            const startX = event.pageX;
                            const startScrollLeft = target.scrollLeft;

                            const onMove = (moveEvent: MouseEvent) => {
                              target.scrollLeft = startScrollLeft - (moveEvent.pageX - startX);
                            };

                            const onUp = () => {
                              document.removeEventListener('mousemove', onMove);
                              document.removeEventListener('mouseup', onUp);
                            };

                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                          }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {renderFavoriteKeywordChips(song)}
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-white/35 md:hidden">
                          {getRelativeTime(song.createdAtMs || song.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {song.isLocked && (
                        <span className="hidden md:inline-flex h-10 w-10 items-center justify-center text-[#AC5045]" title="잠김">
                          <Lock className="w-4 h-4" />
                        </span>
                      )}

                      {song.isLocked && (
                        <span className="inline-flex h-10 w-10 items-center justify-center text-[#AC5045] md:hidden" title="잠김">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
<div className="relative">
                        <button
                          data-floating-menu="true"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveFavoriteMenuId(activeFavoriteMenuId === song.id ? null : song.id);
                            setActiveFavoriteColorMenuId(null);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isSelectionMode ? 'text-[#AC5045]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                          {activeFavoriteMenuId === song.id && (
                            <motion.div
                              data-more-menu-panel="true"
                              initial={{ opacity: 0, scale: 0.9, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -10 }}
                              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-[#AC5045]/30 bg-[#181818] py-2 shadow-2xl"
                              onClick={(event) => event.stopPropagation()}
                            >
                            {isFavoriteTrashMode ? (
                              isBulkMenu ? (
                                <>
                                  <div className="px-4 py-2 text-xs font-bold text-[#AC5045]">선택한 {selectedSongIds.length}곡</div>
                                  <button onClick={() => executeFavoriteMenuAction('selectAll', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><CheckSquare className="w-4 h-4" />전체선택</button>
                                  <button onClick={() => executeFavoriteMenuAction('restoreSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><RefreshCw className="w-4 h-4" />복구</button>
                                  <button onClick={() => executeFavoriteMenuAction('permanentDeleteSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"><Trash2 className="w-4 h-4" />영구 삭제</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => executeFavoriteMenuAction('details', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Info className="w-4 h-4" />디테일</button>
                                  <button onClick={() => executeFavoriteMenuAction('select', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Square className="w-4 h-4" />선택</button>
                                  <button onClick={() => executeFavoriteMenuAction('restore', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><RefreshCw className="w-4 h-4" />복구</button>
                                  <button onClick={() => executeFavoriteMenuAction('permanentDelete', song)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"><Trash2 className="w-4 h-4" />영구 삭제</button>
                                </>
                              )
                            ) : isBulkMenu ? (
                              <>
                                <div className="px-4 py-2 text-xs font-bold text-[#AC5045]">선택한 {selectedSongIds.length}곡</div>
                                <button onClick={() => executeFavoriteMenuAction('selectAll', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><CheckSquare className="w-4 h-4" />전체선택</button>
                                <button onClick={() => executeFavoriteMenuAction('clearSelection', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Square className="w-4 h-4" />선택해제</button>
                                <button onClick={() => executeFavoriteMenuAction('lockSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Lock className="w-4 h-4" />선택잠금</button>
                                <button onClick={() => executeFavoriteMenuAction('unlockSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Unlock className="w-4 h-4" />잠금해제</button>
                                <button onClick={() => executeFavoriteMenuAction('shareSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Share2 className="w-4 h-4" />공유</button>
                                <button onClick={() => executeFavoriteMenuAction('folderSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><FolderOutput className="w-4 h-4" />폴더 저장</button>
                                <button onClick={() => executeFavoriteMenuAction('deleteSelected', song)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"><Trash2 className="w-4 h-4" />선택 삭제</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => executeFavoriteMenuAction('details', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Info className="w-4 h-4" />디테일 & Edit</button>
                                <button onClick={() => executeFavoriteMenuAction('select', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Square className="w-4 h-4" />선택</button>
                                {!song.isLocked ? (
                                  <button onClick={() => executeFavoriteMenuAction('lock', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Lock className="w-4 h-4" />잠금</button>
                                ) : (
                                  <button onClick={() => executeFavoriteMenuAction('unlock', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Unlock className="w-4 h-4" />잠금해제</button>
                                )}
                                <button onClick={() => executeFavoriteMenuAction('apply', song)} className="w-full px-4 py-2.5 text-left text-sm text-[#D45A66] hover:text-[#F07882] hover:bg-transparent flex items-center gap-3"><RefreshCw className="w-4 h-4" />다음곡에 적용</button>
                                <button onClick={() => executeFavoriteMenuAction('share', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Share2 className="w-4 h-4" />공유</button>
                                <button onClick={() => executeFavoriteMenuAction('sunoUrl', song)} className="w-full px-4 py-2.5 text-left text-sm text-[#D8A4A2] hover:bg-white/5 flex items-center gap-3"><Link2 className="w-4 h-4" />수노 URL 연결</button>
                                <button onClick={() => executeFavoriteMenuAction('folder', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><FolderOutput className="w-4 h-4" />폴더 저장</button>
                                <button onClick={() => executeFavoriteMenuAction('delete', song)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"><Trash2 className="w-4 h-4" />삭제</button>
                              </>
                            )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {visibleCount < filteredFavorites.length && (
            <div className="flex justify-center pt-8">
              <button
                onClick={() => setVisibleCount(prev => prev + 15)}
                onMouseEnter={() => onHover({ id: 'load-more', label: '더보기', description: '곡을 15개 더 불러옵니다.' })}
                onMouseLeave={() => onHover(null)}
                className="px-8 py-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] font-bold transition-all border border-black/20 flex items-center gap-2 group shadow-[var(--shadow-md)]"
              >
                <Plus className="w-5 h-5 text-[#AC5045] group-hover:rotate-90 transition-transform" />
                더보기 ({filteredFavorites.length - visibleCount}개 남음)
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {musicNoteFolderRenameArgs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[155] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
            onClick={() => setMusicNoteFolderRenameArgs(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px] overflow-hidden rounded-[24px] border border-[#AC5045]/25 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h3 className="text-base font-black text-white">폴더 이름 변경</h3>
                <button
                  type="button"
                  onClick={() => setMusicNoteFolderRenameArgs(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/55 transition-all hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <input
                  type="text"
                  value={musicNoteFolderRenameArgs.newTitle}
                  onChange={(event) => setMusicNoteFolderRenameArgs({ ...musicNoteFolderRenameArgs, newTitle: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRenameMusicNoteFolder();
                  }}
                  placeholder="폴더 이름 (최대 20자)"
                  maxLength={20}
                  autoFocus
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-[#AC5045]/55"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 bg-black/20 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setMusicNoteFolderRenameArgs(null)}
                  className="px-4 py-2 text-sm font-bold text-white/50 transition-colors hover:text-white"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={commitRenameMusicNoteFolder}
                  className="rounded-xl bg-[#AC5045]/85 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#AC5045]"
                >
                  저장
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {musicNoteFolderDeleteArgs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[155] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
            onClick={() => setMusicNoteFolderDeleteArgs(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px] overflow-hidden rounded-[24px] border border-red-400/25 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="text-base font-black text-white">폴더 삭제</h3>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  <span className="font-bold text-white/80">{musicNoteFolderDeleteArgs.folder.title}</span> 폴더를 삭제할까요? 안의 곡은 기본 폴더로 이동합니다.
                </p>
              </div>
              <div className="flex justify-end gap-2 bg-black/20 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setMusicNoteFolderDeleteArgs(null)}
                  className="px-4 py-2 text-sm font-bold text-white/50 transition-colors hover:text-white"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={commitDeleteMusicNoteFolder}
                  className="rounded-xl bg-red-500/18 px-4 py-2 text-sm font-black text-red-300 transition-colors hover:bg-red-500/28"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSelectionMode && selectedSongIds.length > 0 && !musicNoteFolderPicker && (
          <motion.div
            data-selection-keep="true"
            data-selection-action-bar="true"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-5 left-1/2 z-[170] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-[34px] border border-white/10 bg-[#242424]/78 px-3 py-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl favorite-keyword-strip md:bottom-7 md:gap-3 md:px-5 md:py-3"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {isFavoriteTrashMode ? (
              <>
                <button
                  type="button"
                  onClick={selectAllVisibleFavorites}
                  className="flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[82px] md:px-3"
                >
                  <CheckSquare className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">전체선택</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectionRestoreFromTrash}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <RefreshCw className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">복구</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectionPermanentDeleteFromTrash}
                  className="flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-red-500/10 md:min-w-[82px] md:px-3"
                >
                  <Trash2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">영구삭제</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFavoriteSelectionMoreOpen(prev => !prev)}
                    className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                  >
                    <MoreVertical className="h-6 w-6 md:h-7 md:w-7" />
                    <span className="text-[12px] font-black md:text-sm">더보기</span>
                  </button>
                  <AnimatePresence>
                    {favoriteSelectionMoreOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.16 }}
                        className="absolute bottom-[calc(100%+12px)] right-0 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#1f1f1f]/95 py-2 text-sm text-white shadow-2xl backdrop-blur-xl"
                      >
                        <button onClick={selectAllVisibleFavorites} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-white/80 hover:bg-white/5"><CheckSquare className="h-4 w-4" />전체선택</button>
                        <button onClick={() => exitSelectionMode()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-white/80 hover:bg-white/5"><Square className="h-4 w-4" />선택해제</button>
                        <button onClick={handleSelectionRestoreFromTrash} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-white/80 hover:bg-white/5"><RefreshCw className="h-4 w-4" />복구</button>
                        <button onClick={handleSelectionPermanentDeleteFromTrash} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />영구 삭제</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSelectionMoveToFolder}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <FolderOutput className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">이동</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectionQuickLock}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  {areSelectedSongsAllLocked ? <Unlock className="h-6 w-6 md:h-7 md:w-7" /> : <Lock className="h-6 w-6 md:h-7 md:w-7" />}
                  <span className="text-[12px] font-black md:text-sm">잠금</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFavoriteSelectionMoreOpen(false); shareSelectedFavoriteSongs(); }}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                >
                  <Share2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">공유</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectionQuickDelete}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-red-500/10 md:min-w-[72px] md:px-3"
                >
                  <Trash2 className="h-6 w-6 md:h-7 md:w-7" />
                  <span className="text-[12px] font-black md:text-sm">삭제</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFavoriteSelectionMoreOpen(prev => !prev)}
                    className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-white transition-all hover:bg-white/8 md:min-w-[72px] md:px-3"
                  >
                    <MoreVertical className="h-6 w-6 md:h-7 md:w-7" />
                    <span className="text-[12px] font-black md:text-sm">더보기</span>
                  </button>
                  <AnimatePresence>
                    {favoriteSelectionMoreOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.16 }}
                        className="absolute bottom-[calc(100%+12px)] right-0 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#1f1f1f]/95 py-2 text-sm text-white shadow-2xl backdrop-blur-xl"
                      >
                        <button onClick={selectAllVisibleFavorites} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-white/80 hover:bg-white/5"><CheckSquare className="h-4 w-4" />전체선택</button>
                        <button onClick={() => exitSelectionMode()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-white/80 hover:bg-white/5"><Square className="h-4 w-4" />선택해제</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {musicNoteFolderPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className={cn(
              "fixed inset-0 z-[220] flex items-end justify-center bg-black/55 px-4 backdrop-blur-sm md:items-center",
              isSelectionMode && selectedSongIds.length > 0
                ? "pb-[128px] md:pb-[142px]"
                : "pb-6 md:pb-0"
            )}
            onClick={() => setMusicNoteFolderPicker(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 0, scale: 1 }}
              transition={{ duration: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-[#AC5045]/25 bg-[#181818] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D8A4A2]/75">music note folder</p>
                  <h3 className="mt-1 text-lg font-black text-white">폴더 저장</h3>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    {musicNoteFolderPicker.mode === 'sharedNote' ? '공유 노트 폴더를 선택하세요.' : '마이 노트 폴더를 선택하세요.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMusicNoteFolderPicker(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/55 transition-all hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-2">
                {(musicNoteFolderPicker.mode === 'sharedNote' ? sharedNoteFolders : myNoteFolders).map((folder) => {
                  const selectedId = musicNoteFolderPicker.mode === 'sharedNote' ? selectedSharedNoteFolderId : selectedMyNoteFolderId;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => saveSongsToMusicNoteFolder(folder.id)}
                      className={cn(
                        'flex h-12 items-center justify-between rounded-2xl border px-4 text-sm font-bold transition-all',
                        selectedId === folder.id
                          ? 'border-[#AC5045]/45 bg-[#AC5045]/22 text-white'
                          : 'border-white/10 bg-white/[0.035] text-white/72 hover:border-[#AC5045]/32 hover:text-white'
                      )}
                    >
                      <span className="inline-flex items-center gap-2"><FolderOutput className="h-4 w-4 text-[#D8A4A2]" />{folder.title}</span>
                      {selectedId === folder.id && <Check className="h-4 w-4 text-[#D8A4A2]" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {favoriteToastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className={cn(
              "fixed left-1/2 z-[160] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1c1c1c]/95 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl",
              isSelectionMode && selectedSongIds.length > 0 ? "bottom-[7.75rem] md:bottom-[8.75rem]" : "bottom-6"
            )}
          >
            <span className="inline-flex items-center gap-2 whitespace-pre-line">
              <Check className="h-4 w-4 text-[#AC5045]" />
              {favoriteToastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {sunoUrlEditorSong && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={closeFavoriteSunoUrlEditor}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }} className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[#AC6B69]/25 bg-[#181818] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]/80">suno url</div>
                  <h3 className="mt-1 text-xl font-bold text-white">수노 URL 연결</h3>
                  <p className="mt-1 truncate text-sm text-white/45">{getCombinedFavoriteTitle(sunoUrlEditorSong)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open('https://suno.com/create', '_blank', 'noopener,noreferrer')}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-all hover:scale-[1.04] hover:border-[#D8A4A2]/35 hover:shadow-[0_8px_24px_rgba(216,164,162,0.18)]"
                    title="수노 열기"
                    aria-label="수노 열기"
                  >
                    <img src="/suno-icon.webp" alt="SUNO" className="h-full w-full rounded-2xl object-cover" />
                  </button>
                  <button type="button" onClick={closeFavoriteSunoUrlEditor} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/65 transition-all hover:text-white"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[0, 1].map((index) => (
                  <div key={`suno-url-modal-${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex h-7 items-center rounded-full border border-[#FF927F]/45 bg-[#FF6F5F]/18 px-3 text-xs font-black text-[#FFD7CF] shadow-[0_6px_18px_rgba(255,111,95,0.12)]">수노 URL {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setSunoUrlMainIndex(index as 0 | 1)}
                        disabled={!sunoUrlInputs[index].trim()}
                        className={cn(
                          'inline-flex h-8 items-center justify-center rounded-xl border px-3 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35',
                          sunoUrlMainIndex === index ? 'border-[#D8A4A2]/45 bg-[#AC6B69]/18 text-[#D8A4A2] border-[#FF927F]/60 bg-[#FF6F5F]/26 text-[#FFD7CF]' : 'border-white/10 bg-white/[0.035] text-white/50 hover:text-white/75'
                        )}
                      >
                        {sunoUrlMainIndex === index ? '1순위' : '1순위로'}
                      </button>
                    </div>
                    <input
                      autoFocus={index === 0}
                      value={sunoUrlInputs[index]}
                      onChange={(event) => {
                        const next = [...sunoUrlInputs] as [string, string];
                        next[index] = event.target.value;
                        setSunoUrlInputs(next);
                        setSunoUrlError('');
                        if (!event.target.value.trim() && sunoUrlMainIndex === index) setSunoUrlMainIndex(index === 0 ? 1 : 0);
                      }}
                      placeholder={index === 0 ? 'https://suno.com/song/...  또는 https://suno.com/s/...' : '두 번째 수노 URL 선택 입력'}
                      className="w-full rounded-2xl border border-black/20 bg-black/20 px-4 py-3 text-sm text-white/82 outline-none transition-all placeholder:text-white/25 focus:border-[#AC6B69]/45"
                    />
                  </div>
                ))}
                {sunoUrlError ? <p className="mt-2 text-xs font-semibold text-red-300">{sunoUrlError}</p> : <p className="mt-2 text-xs leading-5 text-white/38">수노에서 한 번에 생성된 2곡까지 연결할 수 있습니다. 1순위 곡이 목록의 메인 커버/재생 대상이 됩니다.</p>}
                <SunoUrlGuideCard compact />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {getFavoriteSunoShareUrl(sunoUrlEditorSong) && (
                  <button type="button" onClick={() => removeFavoriteSunoShareUrl(sunoUrlEditorSong)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/60 transition-all hover:text-red-300"><Trash2 className="h-4 w-4" />전체 제거</button>
                )}
                <button type="button" onClick={closeFavoriteSunoUrlEditor} className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition-all hover:text-white">취소</button>
                <button type="button" onClick={() => saveFavoriteSunoShareUrls(sunoUrlEditorSong, sunoUrlInputs, sunoUrlMainIndex)} disabled={!sunoUrlInputs.some(value => value.trim())} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#AC6B69]/35 bg-[#AC6B69]/14 px-4 text-sm font-bold text-[#D8A4A2] transition-all hover:bg-[#AC6B69]/22 disabled:cursor-not-allowed disabled:opacity-35"><Check className="h-4 w-4" />저장</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics Modal */}
      <AnimatePresence>
        {selectedSong && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 font-sans">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => closeSelectedSong()}
              className="absolute inset-0 bg-black/72 backdrop-blur-[7px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.965, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 18 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative flex w-full max-w-[1120px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#131313] shadow-[0_40px_140px_rgba(0,0,0,0.58)] max-h-[92vh] musicnote-edit-mobile-boost"
              onClick={(e) => e.stopPropagation()}
              onClickCapture={(e) => {
                if (confirmDeleteSong && !(e.target as HTMLElement).closest('[data-detail-delete-button="true"]')) {
                  setConfirmDeleteSong(false);
                }
              }}
            >
              <style>{`
                  .musicnote-edit-mobile-boost {
                    --mn-edit-hot: #FF6F5F;
                    --mn-edit-hot-2: #FF927F;
                    --mn-edit-hot-soft: rgba(255, 111, 95, 0.24);
                    --mn-edit-hot-border: rgba(255, 146, 127, 0.48);
                    --mn-edit-hot-glow: rgba(255, 111, 95, 0.28);
                  }

                  .musicnote-edit-mobile-boost [class*="D8A4A2"],
                  .musicnote-edit-mobile-boost [class*="F2B8AE"] {
                    color: var(--mn-edit-hot-2) !important;
                  }

                  .musicnote-edit-mobile-boost [class*="AC6B69"],
                  .musicnote-edit-mobile-boost [class*="C76559"] {
                    border-color: var(--mn-edit-hot-border) !important;
                    background-color: var(--mn-edit-hot-soft) !important;
                    color: #FFD7CF !important;
                    box-shadow: 0 0 0 1px rgba(255, 146, 127, 0.12), 0 10px 28px rgba(255, 111, 95, 0.10) !important;
                  }

                  .musicnote-edit-mobile-boost button[class*="AC6B69"],
                  .musicnote-edit-mobile-boost button[class*="C76559"],
                  .musicnote-edit-mobile-boost [role="button"][class*="AC6B69"],
                  .musicnote-edit-mobile-boost [role="button"][class*="C76559"] {
                    filter: saturate(1.28) brightness(1.12);
                  }

                  .musicnote-edit-mobile-boost [class*="D45A66"],
                  .musicnote-edit-mobile-boost [class*="F07882"] {
                    border-color: rgba(255, 118, 136, 0.52) !important;
                    background-color: rgba(255, 92, 112, 0.18) !important;
                    color: #FF9CA7 !important;
                  }

                  .musicnote-edit-mobile-boost input:focus,
                  .musicnote-edit-mobile-boost textarea:focus {
                    border-color: rgba(255, 146, 127, 0.62) !important;
                    box-shadow: 0 0 0 1px rgba(255, 146, 127, 0.18), 0 0 22px rgba(255, 111, 95, 0.16) !important;
                  }
.musicnote-edit-mobile-boost .mn-mobile-edit-color-wash {
                    opacity: 1 !important;
                  }
              `}</style>
              <div className="mn-mobile-edit-color-wash pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200" style={{
                background: 'radial-gradient(circle at top, rgba(255, 111, 95, 0.14), transparent 34%), radial-gradient(circle at bottom right, rgba(255, 146, 127, 0.10), transparent 30%)'
              }} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(172,107,105,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(172,107,105,0.08),transparent_28%)]" />

              <div className="relative flex items-center justify-between gap-4 border-b border-black/20 px-5 py-4 md:px-8 md:py-5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#D8A4A2] text-[#FF927F]">music note detail</div>
                  <h3 className="mt-1 text-[27px] font-bold tracking-tight text-white md:text-[32px]">디테일 & Edit</h3>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <a
                    href="https://suno.com/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => onHover({ id: 'detail-suno', label: 'SUNO', description: 'Suno 생성 페이지를 엽니다.' })}
                    onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                    onTouchStart={() => onLongPressStart({ id: 'detail-suno', label: 'SUNO', description: 'Suno 생성 페이지를 엽니다.' })}
                    onTouchEnd={onLongPressEnd}
                    className={cn(
                      'inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.025] p-1 transition-all hover:bg-white/[0.06] hover:scale-[1.03]',
                      isEditing && 'pointer-events-none opacity-35'
                    )}
                  >
                    <img src="/suno-icon.webp" alt="SUNO" className="h-full w-full rounded-[14px] object-cover" />
                  </a>
                  <button
                    onClick={() => closeSelectedSong()}
                    onMouseEnter={() => onHover({ id: 'detail-close', label: '닫기', description: '상세정보 창을 닫습니다.' })}
                    onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                    onTouchStart={() => onLongPressStart({ id: 'detail-close', label: '닫기', description: '상세정보 창을 닫습니다.' })}
                    onTouchEnd={onLongPressEnd}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:text-[#D8A4A2]"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div ref={detailScrollContainerRef} className="relative flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-4 py-4 md:px-8 md:py-7 space-y-5" style={{ overscrollBehavior: 'contain' }}>
                <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-5 py-5 md:px-7 md:py-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#D8A4A2]">title</div>
                      <h4 className="mt-1 text-2xl font-bold text-white">제목</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setActiveEditSection('title');
                          }}
                          onMouseEnter={() => onHover({ id: 'detail-title-edit', label: '제목 수정', description: '곡 제목을 수정합니다.' })}
                          onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                          onTouchStart={() => onLongPressStart({ id: 'detail-title-edit', label: '제목 수정', description: '곡 제목을 수정합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/70 transition-all hover:text-[#D8A4A2]"
                          title="제목 수정"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {isEditing && activeEditSection === 'title' && (
                        <>
                          {isTitleEditChanged && (
                            <button
                              onClick={handleSave}
                              disabled={isTranslating}
                              onMouseEnter={() => onHover({ id: 'detail-title-save', label: '저장', description: '수정한 제목을 저장합니다.' })}
                              onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                              onTouchStart={() => onLongPressStart({ id: 'detail-title-save', label: '저장', description: '수정한 제목을 저장합니다.' })}
                              onTouchEnd={onLongPressEnd}
                              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] text-white/82 transition-all hover:text-[#D8A4A2] disabled:opacity-60"
                              title="저장"
                            >
                              {isTranslating ? <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={cancelModalEditing}
                            onMouseEnter={() => onHover({ id: 'detail-title-cancel', label: '취소', description: '제목 수정을 취소합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-title-cancel', label: '취소', description: '제목 수정을 취소합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="취소"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => copyToClipboard(getCombinedFavoriteCopyText(selectedSong), 'title-all')}
                        onMouseEnter={() => onHover({ id: 'detail-title-copy', label: '제목 복사', description: '한글/외국어 통합 제목을 복사합니다.' })}
                        onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                        onTouchStart={() => onLongPressStart({ id: 'detail-title-copy', label: '제목 복사', description: '한글/외국어 통합 제목을 복사합니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-[12px] font-semibold text-white/72 transition-all hover:text-[#D8A4A2]"
                        title="통합 제목 복사"
                      >
                        {copiedType === 'title-all' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        <span className="hidden sm:inline">제목 복사</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    {isEditing && activeEditSection === 'title' ? (
                      <input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="mx-auto w-full max-w-[820px] rounded-2xl border border-white/10 bg-black/15 px-5 py-3 text-center text-[24px] font-extrabold leading-tight tracking-tight text-white outline-none transition-all focus:border-[#AC6B69]/35 md:text-[34px]"
                      />
                    ) : (
                      <>
                        {getDisplaySubGenre(selectedSong) && (
                          <p className="mx-auto mb-2 max-w-[720px] text-[13px] font-bold leading-tight text-white/54 md:text-[16px]">
                            [{getDisplaySubGenre(selectedSong)}]
                          </p>
                        )}
                        <h2 className="mx-auto max-w-[820px] text-[24px] font-extrabold leading-tight tracking-tight text-white md:text-[34px]">
                          {getFavoriteKoreanTitle(selectedSong)}
                        </h2>
                        {getFavoriteEnglishTitle(selectedSong) !== getFavoriteKoreanTitle(selectedSong) && (
                          <p className="mx-auto mt-3 max-w-[720px] text-[15px] font-semibold leading-tight text-white/64 md:text-[21px]">
                            {getFavoriteEnglishTitle(selectedSong)}
                          </p>
                        )}
                      </>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {getDisplaySubGenre(selectedSong) && (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/70">
                          {getDisplaySubGenre(selectedSong)}
                        </span>
                      )}
                      {getFavoriteDetailCreator(selectedSong, user) && (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/70">
                          제작자: {getFavoriteDetailCreator(selectedSong, user)}
                        </span>
                      )}
                      {getFavoriteDetailCreatedAt(selectedSong) && (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/70">
                          생성일: {getFavoriteDetailCreatedAt(selectedSong)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => handlePopupToggleLock(selectedSong)}
                      disabled={isEditing}
                      onMouseEnter={() => onHover({ id: 'detail-lock', label: selectedSong.isLocked ? '잠금 해제' : '잠금', description: selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                      onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                      onTouchStart={() => onLongPressStart({ id: 'detail-lock', label: selectedSong.isLocked ? '잠금 해제' : '잠금', description: selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                      onTouchEnd={onLongPressEnd}
                      className={cn(
                        'inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-sm transition-all disabled:cursor-not-allowed disabled:opacity-35 hover:text-[#D8A4A2]',
                        selectedSong.isLocked
                          ? 'border-[#AC6B69]/25 bg-white/[0.035] text-[#D8A4A2]'
                          : 'border-white/10 bg-white/[0.035] text-white/78'
                      )}
                    >
                      {selectedSong.isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                    </button>
                    <button
                      data-detail-delete-button="true"
                      onClick={() => handlePopupDelete(selectedSong)}
                      disabled={isEditing}
                      onMouseEnter={() => onHover({ id: 'detail-delete', label: confirmDeleteSong ? '삭제 확인' : '삭제', description: selectedSong.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : (confirmDeleteSong ? '한번 더 누르면 삭제됩니다.' : '이 곡을 삭제합니다.') })}
                      onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                      onTouchStart={() => onLongPressStart({ id: 'detail-delete', label: confirmDeleteSong ? '삭제 확인' : '삭제', description: selectedSong.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : (confirmDeleteSong ? '한번 더 누르면 삭제됩니다.' : '이 곡을 삭제합니다.') })}
                      onTouchEnd={onLongPressEnd}
                      className={cn(
                        'inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition-all disabled:cursor-not-allowed disabled:opacity-35',
                        selectedSong.isLocked
                          ? 'border-black/20 bg-white/[0.03] text-white/18'
                          : confirmDeleteSong
                            ? 'border-red-500/55 bg-white/[0.035] text-red-500'
                            : 'border-white/10 bg-white/[0.035] text-white/78 hover:text-red-500'
                      )}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {isEditing && isModified && (
                      <button
                        onClick={handleRestoreOriginal}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/72 transition-all hover:text-[#D8A4A2]"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        원본 복원
                      </button>
                    )}
                  </div>
                </section>

                <section ref={detailSunoUrlSectionRef} className={cn('rounded-[28px] border border-white/10 bg-white/[0.02] p-5 transition-all md:p-6', isDetailSunoUrlHighlighted && 'border-[#FFB5AA]/60 shadow-[0_0_0_1px_rgba(255,181,170,0.22),0_18px_52px_rgba(255,111,95,0.22)]')}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2] text-[#FF927F]">suno link</div>
                      <h4 className="mt-1 text-xl font-bold text-white">수노 URL 연결</h4>
                      <p className="mt-1 text-sm leading-6 text-white/45">수노 공유 링크를 최대 2곡까지 보관합니다. 각 커버의 재생 버튼으로 해당 곡을 수노에서 열 수 있고, 1순위 곡이 목록의 메인 커버와 재생 대상입니다.</p>
                    </div>
                    <div className="hidden" />
                  </div>
                  {getFavoriteSunoLinks(selectedSong).length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[0, 1].map((index) => {
                        const link = getFavoriteSunoLinks(selectedSong)[index];
                        const isMain = getFavoriteSunoMainIndex(selectedSong) === index;
                        return (
                          <div
                            key={`suno-cover-preview-${index}`}
                            className={cn(
                              'overflow-hidden rounded-2xl border bg-black/15',
                              link ? 'border-white/10' : 'border-white/[0.055] opacity-55',
                              isMain && link ? 'ring-1 ring-[#D8A4A2]/35' : ''
                            )}
                          >
                            <div className="relative aspect-[16/9] bg-black/25">
                              {link?.coverUrl ? (
                                <img
                                  src={link.coverUrl}
                                  alt={`수노 URL ${index + 1} 커버`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/32">
                                  {link ? '커버 이미지 없음' : `수노 URL ${index + 1} 미등록`}
                                </div>
                              )}

                              {link?.url && (
                                <button
                                  type="button"
                                  onClick={() => openFavoriteSunoLinkAt(selectedSong, index)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/10 transition-all hover:bg-black/24"
                                  title={`수노 URL ${index + 1} 열기`}
                                >
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_8px_22px_rgba(0,0,0,0.35)] backdrop-blur">
                                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                                  </span>
                                </button>
                              )}

                              {link && (
                                <div className="absolute left-2 top-2 rounded-full border border-black/20 bg-black/55 px-2 py-1 text-[10px] font-black text-white/86 backdrop-blur">
                                  {isMain ? '1순위' : '2순위'}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 p-3">
                              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D8A4A2]/75 text-[#FF927F]">suno url {index + 1}</div>
                              <p className="mt-1 truncate text-sm font-semibold text-white/82">
                                {link?.title || (link ? `수노 URL ${index + 1} 연결됨` : `수노 URL ${index + 1}`)}
                              </p>
                              {link?.durationText && (
                                <p className="mt-1 text-xs font-semibold text-[#D8A4A2]/80">곡 길이 {link.durationText}</p>
                              )}
                              <p className="mt-1 truncate text-xs text-white/35">{link?.url || 'URL을 입력하면 커버를 불러옵니다.'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4 grid gap-3">
                    {[0, 1].map((index) => (
                      <div key={`detail-suno-url-${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex h-7 items-center rounded-full border border-[#FF927F]/45 bg-[#FF6F5F]/18 px-3 text-xs font-black text-[#FFD7CF] shadow-[0_6px_18px_rgba(255,111,95,0.12)]">수노 URL {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => setDetailSunoUrlMainIndex(index as 0 | 1)}
                            disabled={!detailSunoUrlInputs[index].trim()}
                            className={cn(
                              'inline-flex h-8 items-center justify-center rounded-xl border px-3 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35',
                              detailSunoUrlMainIndex === index ? 'border-[#D8A4A2]/45 bg-[#AC6B69]/18 text-[#D8A4A2] border-[#FF927F]/60 bg-[#FF6F5F]/26 text-[#FFD7CF]' : 'border-white/10 bg-white/[0.035] text-white/50 hover:text-white/75'
                            )}
                          >
                            {detailSunoUrlMainIndex === index ? '1순위' : '1순위로'}
                          </button>
                        </div>
                        <input
                          value={detailSunoUrlInputs[index]}
                          onChange={(event) => {
                            const next = [...detailSunoUrlInputs] as [string, string];
                            next[index] = event.target.value;
                            setDetailSunoUrlInputs(next);
                            setDetailSunoUrlError('');
                            if (!event.target.value.trim() && detailSunoUrlMainIndex === index) setDetailSunoUrlMainIndex(index === 0 ? 1 : 0);
                          }}
                          placeholder={index === 0 ? 'https://suno.com/song/...  또는 https://suno.com/s/...' : '두 번째 수노 URL 선택 입력'}
                          className="w-full rounded-2xl border border-[#FF927F]/38 bg-transparent px-4 py-3 text-sm text-white/82 outline-none transition-all placeholder:text-white/30 focus:border-[#FF927F]/70 focus:bg-transparent"
                        />
                      </div>
                    ))}
                    <button type="button" onClick={() => saveFavoriteSunoShareUrls(selectedSong, detailSunoUrlInputs, detailSunoUrlMainIndex, 'detail')} disabled={!getFavoriteSunoShareUrl(selectedSong) && !detailSunoUrlInputs.some(value => value.trim())} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#AC6B69]/30 bg-[#AC6B69]/12 px-4 text-sm font-bold text-[#D8A4A2] border-[#FF927F]/60 bg-[#FF6F5F]/26 text-[#FFD7CF] transition-all hover:bg-[#AC6B69]/18 disabled:cursor-not-allowed disabled:opacity-35">
                      <Check className="h-4 w-4" />
                      저장
                    </button>
                  </div>
                  {detailSunoUrlError ? (
                    <p className="mt-2 text-xs font-semibold text-red-300">{detailSunoUrlError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-white/35">1순위 수노 URL이 뮤직노트 목록의 메인 커버와 재생 대상이 됩니다. 두 URL을 모두 비우고 저장하면 연결이 해제됩니다.</p>
                  )}
                  <SunoUrlGuideCard collapsible />
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">info set</div>
                      <h4 className="mt-1 text-[22px] font-bold text-white">키워드</h4>
                      <p className="mt-1 text-sm text-white/45">곡의 키워드와 핵심 정보를 확인합니다.</p>
                    </div>
                    <div className="-mt-1 flex shrink-0 items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => applyKeywordsToNext(selectedSong)}
                          onMouseEnter={() => onHover({ id: 'popup-apply-next', label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                          onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                          onTouchStart={() => onLongPressStart({ id: 'popup-apply-next', label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="inline-flex h-11 min-w-[136px] items-center justify-center gap-2 rounded-2xl border border-[#55D7FF]/55 bg-[#1F9DFF]/20 px-3 text-[#D9FAFF] shadow-[0_10px_28px_rgba(31,157,255,0.18)] transition-all hover:border-[#8EEBFF]/70 hover:bg-[#1F9DFF]/30 hover:text-white"
                        >
                          <RefreshCw className="h-4.5 w-4.5" />
                          <span className="whitespace-nowrap text-xs font-black">다음곡에 적용</span>
                        </button>
                      )}
                      <button
                        onClick={() => setIsInfoExpanded((prev) => !prev)}
                        onMouseEnter={() => onHover({ id: 'detail-keyword-toggle', label: isInfoExpanded ? '키워드 접기' : '키워드 펼치기', description: isInfoExpanded ? '키워드와 핵심정보를 접습니다.' : '키워드와 핵심정보를 펼칩니다.' })}
                        onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                        onTouchStart={() => onLongPressStart({ id: 'detail-keyword-toggle', label: isInfoExpanded ? '키워드 접기' : '키워드 펼치기', description: isInfoExpanded ? '키워드와 핵심정보를 접습니다.' : '키워드와 핵심정보를 펼칩니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                      >
                        {isInfoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {!isInfoExpanded && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/68">
                        Genre: {getDisplaySubGenre(selectedSong) || '정보 없음'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/68">
                        Tempo: {selectedSong.appliedKeywords.tempo || '정보 없음'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/68">
                        {resolveKeywordsForDisplay(selectedSong).length}개 카테고리
                      </span>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {isInfoExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
                          <section className="rounded-[24px] border border-black/20 bg-black/10 p-5">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">keywords</div>
                                <h4 className="mt-1 text-xl font-bold text-white">곡 키워드 & 스타일</h4>
                              </div>
                              {!isEditing && (
                                <button
                                  onClick={() => {
                                    const sections = resolveKeywordsForDisplay(selectedSong);
                                    const text = sections.map(s => s.items.map(i => i.label).join(', ')).join(', ');
                                    copyToClipboard(text, 'keywords');
                                  }}
                                  onMouseEnter={() => onHover({ id: 'detail-keywords-copy', label: '키워드 복사', description: '곡의 키워드와 스타일 정보를 복사합니다.' })}
                                  onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                                  onTouchStart={() => onLongPressStart({ id: 'detail-keywords-copy', label: '키워드 복사', description: '곡의 키워드와 스타일 정보를 복사합니다.' })}
                                  onTouchEnd={onLongPressEnd}
                                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                                >
                                  {copiedType === 'keywords' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                            <div className="space-y-4">
                              {resolveKeywordsForDisplay(selectedSong).map((section) => (
                                <div key={section.key} className="space-y-2.5">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/38">{section.title}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {section.items.map((item, idx) => (
                                      <span
                                        key={`${section.key}-${idx}`}
                                        className={cn(
                                          'rounded-full border px-3 py-1.5 text-[12px] font-medium',
                                          getAppliedKeywordChipClass(section.key || section.accent || '', item.isRandom)
                                        )}
                                      >
                                        {item.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="rounded-[24px] border border-black/20 bg-black/10 p-5">
                            <div className="mb-4">
                              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">overview</div>
                              <h4 className="mt-1 text-xl font-bold text-white">핵심 정보</h4>
                            </div>
                            <div className="grid gap-3">
                              <div className="rounded-2xl border border-black/20 bg-white/[0.03] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">genre</p>
                                <p className="mt-2 text-lg font-semibold text-white/90">{getDisplaySubGenre(selectedSong) || '정보 없음'}</p>
                              </div>
                              <div className="rounded-2xl border border-black/20 bg-white/[0.03] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">vocal</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/75">{selectedSong.appliedKeywords.vocalType || '정보 없음'}</span>
                                  {selectedSong.appliedKeywords.vocal?.isToneSelected && selectedSong.appliedKeywords.vocalTone && (
                                    <span className="rounded-full border border-[#AC6B69]/25 bg-[#AC6B69]/10 px-3 py-1 text-[12px] text-[#D8A4A2]">보컬톤: {selectedSong.appliedKeywords.vocalTone}</span>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-black/20 bg-white/[0.03] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">tempo</p>
                                <p className="mt-2 text-base font-semibold text-white/88">{selectedSong.appliedKeywords.tempo || '정보 없음'}</p>
                              </div>
                              <div className="rounded-2xl border border-black/20 bg-white/[0.03] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">structure</p>
                                <div className="mt-2 rounded-xl border border-black/20 bg-black/20 px-3 py-3 text-[12px] leading-6 text-white/72" style={{ wordBreak: 'break-word' }}>
                                  {getFavoriteStructureText(selectedSong)}
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5 md:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">lyrics ko</div>
                        <h4 className="mt-1 text-xl font-bold text-white">한글 가사</h4>
                        {isEditing && (activeEditSection === 'lyrics-ko' || activeEditSection === 'lyrics-en') && (
                          <div className="mt-3 space-y-2">
                            <button
                              onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                                isSyncEnabled ? 'border-[#AC6B69]/30 bg-[#AC6B69]/15 text-[#D8A4A2]' : 'border-white/10 bg-white/[0.04] text-white/60'
                              )}
                            >
                              {isSyncEnabled ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                              한글/외국어 연동 {isSyncEnabled ? 'ON' : 'OFF'}
                            </button>
                            {isSyncEnabled && (
                              <select
                                value={foreignTargetLanguage}
                                onChange={(e) => setForeignTargetLanguage(e.target.value)}
                                className="block max-w-[180px] rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-2 text-[11px] font-bold text-white/72 outline-none focus:border-[#AC6B69]/30"
                              >
                                <option value="English">영어</option>
                                <option value="Japanese">일본어</option>
                                <option value="Chinese">중국어</option>
                                <option value="Spanish">스페인어</option>
                                <option value="French">프랑스어</option>
                                <option value="German">독일어</option>
                                <option value="Russian">러시아어</option>
                                <option value="Thai">태국어</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditing && activeEditSection === 'lyrics-ko' ? (
                          <>
                            {isKoreanLyricsEditChanged && (
                              <button
                                onClick={handleSave}
                                disabled={isTranslating}
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] text-white/82 transition-all hover:text-[#D8A4A2] disabled:opacity-60"
                                title="저장"
                              >
                                {isTranslating ? <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              onClick={cancelModalEditing}
                              onMouseEnter={() => onHover({ id: 'detail-cancel', label: '취소', description: '수정을 취소합니다.' })}
                              onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                              onTouchStart={() => onLongPressStart({ id: 'detail-cancel', label: '취소', description: '수정을 취소합니다.' })}
                              onTouchEnd={onLongPressEnd}
                              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                              title="취소"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : !isEditing && (
                          <button
                            onClick={() => { setIsEditing(true); setActiveEditSection('lyrics-ko'); }}
                            onMouseEnter={() => onHover({ id: 'detail-lyrics-ko-edit', label: '한글 가사 수정', description: '한글 가사를 수정합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-lyrics-ko-edit', label: '한글 가사 수정', description: '한글 가사를 수정합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="한글 가사 수정"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(selectedSong.lyrics.korean, 'lyrics-korean')}
                          onMouseEnter={() => onHover({ id: 'detail-lyrics-ko-copy', label: '한글 가사 복사', description: '한글 가사를 복사합니다.' })}
                          onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                          onTouchStart={() => onLongPressStart({ id: 'detail-lyrics-ko-copy', label: '한글 가사 복사', description: '한글 가사를 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                          title="한글 가사 복사"
                        >
                          {copiedType === 'lyrics-korean' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isEditing && activeEditSection === 'lyrics-ko' ? (
                      <textarea
                        value={editedKoreanLyrics}
                        onChange={(e) => setEditedKoreanLyrics(e.target.value)}
                        className="custom-scrollbar h-[380px] w-full resize-none rounded-2xl border border-black/20 bg-black/15 p-4 text-[15px] leading-7 text-white/88 outline-none transition-all focus:border-[#AC6B69]/30"
                      />
                    ) : (
                      <div className="custom-scrollbar max-h-[380px] overflow-y-auto overscroll-contain rounded-2xl border border-black/20 bg-black/15 p-4 text-[15px] leading-7 text-white/88 whitespace-pre-wrap">
                        {selectedSong.lyrics.korean}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5 md:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">lyrics foreign</div>
                        <h4 className="mt-1 text-xl font-bold text-white">외국어 가사</h4>
                        {isEditing && (activeEditSection === 'lyrics-ko' || activeEditSection === 'lyrics-en') && (
                          <div className="mt-3 space-y-2">
                            <button
                              onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                                isSyncEnabled ? 'border-[#AC6B69]/30 bg-[#AC6B69]/15 text-[#D8A4A2]' : 'border-white/10 bg-white/[0.04] text-white/60'
                              )}
                            >
                              {isSyncEnabled ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                              한글/외국어 연동 {isSyncEnabled ? 'ON' : 'OFF'}
                            </button>
                            {isSyncEnabled && (
                              <select
                                value={foreignTargetLanguage}
                                onChange={(e) => setForeignTargetLanguage(e.target.value)}
                                className="block max-w-[180px] rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-2 text-[11px] font-bold text-white/72 outline-none focus:border-[#AC6B69]/30"
                              >
                                <option value="English">영어</option>
                                <option value="Japanese">일본어</option>
                                <option value="Chinese">중국어</option>
                                <option value="Spanish">스페인어</option>
                                <option value="French">프랑스어</option>
                                <option value="German">독일어</option>
                                <option value="Russian">러시아어</option>
                                <option value="Thai">태국어</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditing && activeEditSection === 'lyrics-en' ? (
                          <>
                            {isForeignLyricsEditChanged && (
                              <button
                                onClick={handleSave}
                                disabled={isTranslating}
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] text-white/82 transition-all hover:text-[#D8A4A2] disabled:opacity-60"
                                title="저장"
                              >
                                {isTranslating ? <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              onClick={cancelModalEditing}
                              onMouseEnter={() => onHover({ id: 'detail-cancel', label: '취소', description: '수정을 취소합니다.' })}
                              onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                              onTouchStart={() => onLongPressStart({ id: 'detail-cancel', label: '취소', description: '수정을 취소합니다.' })}
                              onTouchEnd={onLongPressEnd}
                              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                              title="취소"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : !isEditing && (
                          <button
                            onClick={() => { setIsEditing(true); setActiveEditSection('lyrics-en'); }}
                            onMouseEnter={() => onHover({ id: 'detail-lyrics-foreign-edit', label: '외국어 가사 수정', description: '외국어 가사를 수정합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-lyrics-foreign-edit', label: '외국어 가사 수정', description: '외국어 가사를 수정합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="외국어 가사 수정"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(selectedSong.lyrics.english, 'lyrics-foreign')}
                          onMouseEnter={() => onHover({ id: 'detail-lyrics-foreign-copy', label: '외국어 가사 복사', description: '외국어 가사를 복사합니다.' })}
                          onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                          onTouchStart={() => onLongPressStart({ id: 'detail-lyrics-foreign-copy', label: '외국어 가사 복사', description: '외국어 가사를 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                          title="외국어 가사 복사"
                        >
                          {copiedType === 'lyrics-foreign' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isEditing && activeEditSection === 'lyrics-en' ? (
                      <textarea
                        value={editedEnglishLyrics}
                        onChange={(e) => setEditedEnglishLyrics(e.target.value)}
                        className="custom-scrollbar h-[380px] w-full resize-none rounded-2xl border border-black/20 bg-black/15 p-4 text-[15px] leading-7 text-white/72 italic outline-none transition-all focus:border-[#AC6B69]/30"
                      />
                    ) : (
                      <div className="custom-scrollbar max-h-[380px] overflow-y-auto overscroll-contain rounded-2xl border border-black/20 bg-black/15 p-4 text-[15px] leading-7 text-white/72 whitespace-pre-wrap">
                        {selectedSong.lyrics.english}
                      </div>
                    )}
                  </section>
                </div>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]">prompt</div>
                      <h4 className="mt-1 text-xl font-bold text-white">곡 프롬프트</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing && activeEditSection === 'prompt' ? (
                        <>
                          {isPromptEditChanged && (
                            <button
                              onClick={handleSave}
                              onMouseEnter={() => onHover({ id: 'detail-save', label: '저장', description: '수정한 내용을 저장합니다.' })}
                              onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                              onTouchStart={() => onLongPressStart({ id: 'detail-save', label: '저장', description: '수정한 내용을 저장합니다.' })}
                              onTouchEnd={onLongPressEnd}
                              disabled={isTranslating}
                              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] text-white/82 transition-all hover:text-[#D8A4A2] disabled:opacity-60"
                              title="저장"
                            >
                              {isTranslating ? <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={cancelModalEditing}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="취소"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : !isEditing && (
                        <button
                          onClick={() => { setIsEditing(true); setActiveEditSection('prompt'); }}
                          onMouseEnter={() => onHover({ id: 'detail-prompt-edit', label: '프롬프트 수정', description: '곡 프롬프트를 수정합니다.' })}
                          onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                          onTouchStart={() => onLongPressStart({ id: 'detail-prompt-edit', label: '프롬프트 수정', description: '곡 프롬프트를 수정합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                          title="프롬프트 수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(selectedSong.prompt, 'prompt')}
                        onMouseEnter={() => onHover({ id: 'detail-prompt-copy', label: '프롬프트 복사', description: '곡 프롬프트를 복사합니다.' })}
                        onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                        onTouchStart={() => onLongPressStart({ id: 'detail-prompt-copy', label: '프롬프트 복사', description: '곡 프롬프트를 복사합니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                        title="프롬프트 복사"
                      >
                        {copiedType === 'prompt' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {isEditing && activeEditSection === 'prompt' ? (
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      className="custom-scrollbar h-[220px] w-full resize-none rounded-2xl border border-black/20 bg-black/15 p-4 text-sm leading-7 text-white/68 outline-none transition-all focus:border-[#AC6B69]/30"
                    />
                  ) : (
                    <div className="rounded-2xl border border-black/20 bg-black/15 p-4 md:p-5">
                      <p className="text-sm leading-7 text-white/68">{selectedSong.prompt || '프롬프트 정보가 없습니다.'}</p>
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-4 md:p-5">
                  <button
                    type="button"
                    onClick={() => setIsFavoriteMusicApiSectionExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/20 bg-black/10 px-4 py-3 text-left transition-all hover:border-white/14 hover:bg-white/[0.035]"
                    aria-expanded={isFavoriteMusicApiSectionExpanded}
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#D8A4A2]/85">music api</div>
                      <h4 className="mt-0.5 truncate text-base font-bold text-white md:text-lg">Music API 생성</h4>
                      <p className="mt-0.5 text-xs text-white/42 md:text-sm">현재 Edit 화면의 제목, 가사, 프롬프트 기준으로 생성합니다.</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65">
                      {isFavoriteMusicApiSectionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isFavoriteMusicApiSectionExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <button
                            onClick={() => navigate('/suno-api-settings')}
                            onMouseEnter={() => onHover({ id: 'detail-api-settings', label: 'Music API 설정', description: 'Music API 키 설정 페이지로 이동합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-api-settings', label: 'Music API 설정', description: 'Music API 키 설정 페이지로 이동합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="Music API 설정"
                          >
                            <SlidersHorizontal className="h-5 w-5" />
                          </button>

                          <button
                            onClick={async () => {
                              setHasFavoriteSunoApiKey(await fetchFavoriteSunoApiKeyStatus(user));
                              setFavoriteMusicApiMessage(null);
                              setShowFavoriteMusicApiModal(true);
                            }}
                            disabled={isFavoriteMusicApiGenerating}
                            onMouseEnter={() => onHover({ id: 'detail-api-generate', label: 'Music API로 생성', description: '현재 Edit 화면의 수정값 기준으로 Music API 생성을 요청합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-api-generate', label: 'Music API로 생성', description: '현재 Edit 화면의 수정값 기준으로 Music API 생성을 요청합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className={cn(
                              'h-12 flex-1 rounded-2xl text-sm font-bold text-white transition-all whitespace-nowrap',
                              isFavoriteMusicApiGenerating
                                ? 'cursor-not-allowed bg-purple-600/40'
                                : 'bg-purple-600 shadow-lg shadow-purple-600/20 hover:bg-purple-700'
                            )}
                          >
                            {isFavoriteMusicApiGenerating ? 'Music API 요청 중...' : 'Music API로 생성'}
                          </button>

                          <button
                            onClick={() => navigate('/suno-library')}
                            onMouseEnter={() => onHover({ id: 'detail-api-library', label: '라이브러리', description: 'Suno Library로 이동합니다.' })}
                            onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                            onTouchStart={() => onLongPressStart({ id: 'detail-api-library', label: '라이브러리', description: 'Suno Library로 이동합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className="flex h-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-white/70 transition-all hover:text-[#D8A4A2]"
                            title="라이브러리로 이동"
                          >
                            Library
                          </button>
                        </div>

                        {favoriteMusicApiMessage && (
                          <p className="mt-3 rounded-2xl border border-black/20 bg-black/15 px-4 py-3 text-center text-xs font-semibold text-white/62 whitespace-pre-line">
                            {favoriteMusicApiMessage}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFavoriteMusicApiModal && selectedSong && (
          <MusicApiGenerateModal
            variant="musicApi"
            hasApiKey={hasFavoriteSunoApiKey}
            isNoLyrics={!editedKoreanLyrics.trim() && !editedEnglishLyrics.trim()}
            availableLyricLanguages={getFavoriteMusicApiAvailableLyricLanguages(selectedSong)}
            maxLyricLanguages={1}
            onClose={() => setShowFavoriteMusicApiModal(false)}
            onConfirm={(titleLang, includeLyrics, lyricLanguages, _generationCount, options) => {
              setShowFavoriteMusicApiModal(false);
              handleFavoriteMusicApiGenerate(titleLang, includeLyrics, lyricLanguages, options);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
