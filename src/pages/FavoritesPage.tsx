import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { translateLyrics } from '../services/geminiService';
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
  Home as HomeIcon,
  Heart as HeartIcon,
  Lock,
  Unlock,
  Edit2,
  Filter,
  Link2,
  Link2Off,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


function getKeywordMeta(labelOrId: string) {
  const allItems = [...GENRES, ...MOODS, ...THEMES, ...SOUND_STYLES, ...INSTRUMENT_SOUNDS];
  return allItems.find(
    (item) => item.label === labelOrId || item.id === labelOrId
  ) ?? null;
}


function getSongGenreValues(song: any): string[] {
  return song?.appliedKeywords?.genre ?? [];
}

function getSongMoodValues(song: any): string[] {
  return song?.appliedKeywords?.mood ?? [];
}

function getSongThemeValues(song: any): string[] {
  return song?.appliedKeywords?.theme ?? [];
}

function getSongStyleValues(song: any): string[] {
  return song?.appliedKeywords?.style ?? [];
}

function getSongInstrumentSoundValues(song: any): string[] {
  return song?.appliedKeywords?.instrumentSound ?? [];
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
  onLongPressEnd
}: { 
  favorites: any[]; 
  toggleFavorite: (song: any) => void; 
  updateFavorite: (id: string, updates: Partial<any>) => void;
  clearAllFavorites: () => void;
  unlockAllFavorites: () => void;
  lockAllFavorites: () => void;
  user: User | null;
  onHover: (item: { id: string; label: string; description: string; _ts?: number } | null) => void;
  hoveredItem: { id: string; label: string; description: string; _ts?: number } | null;
  onLongPressStart: (item: { id: string; label: string; description: string }) => void;
  onLongPressEnd: () => void;
}) {
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'genre-1' | 'genre-2' | 'title-en' | 'title-ko' | 'locked-top' | 'locked-bottom'>('latest');
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9);
  const sortPopupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalLyricsKo, setOriginalLyricsKo] = useState('');
  const [originalLyricsEn, setOriginalLyricsEn] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const popupOpenedRef = useRef(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedKoreanLyrics, setEditedKoreanLyrics] = useState('');
  const [editedEnglishLyrics, setEditedEnglishLyrics] = useState('');

  const isModified = selectedSong && (
    editedTitle !== originalTitle ||
    editedKoreanLyrics !== originalLyricsKo ||
    editedEnglishLyrics !== originalLyricsEn
  );
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(0); // 0: none, 1: warning, 2: execute
  const [confirmUnlockAll, setConfirmUnlockAll] = useState(0);
  const [confirmLockAll, setConfirmLockAll] = useState(0);
  const [confirmDeleteSong, setConfirmDeleteSong] = useState(false);
  const [confirmToggleLock, setConfirmToggleLock] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; korean: string; english: string; isEditing: boolean }>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [lastSelectionAction, setLastSelectionAction] = useState<'none' | 'lock' | 'unlock'>('none');
  const [pendingSelectionAction, setPendingSelectionAction] = useState<'delete' | 'lock' | 'unlock' | null>(null);
  const selectionLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
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
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
      // Set original lyrics when a song is selected (only if not already set for this song)
      if (!popupOpenedRef.current) {
        setOriginalLyricsKo(selectedSong.lyrics.korean);
        setOriginalLyricsEn(selectedSong.lyrics.english);
        setOriginalTitle(selectedSong.title);
        popupOpenedRef.current = true;
      }

      const draft = drafts[selectedSong.id];
      if (draft) {
        setEditedTitle(draft.title);
        setEditedKoreanLyrics(draft.korean);
        setEditedEnglishLyrics(draft.english);
        setIsEditing(draft.isEditing);
      } else {
        setEditedTitle(selectedSong.title);
        setEditedKoreanLyrics(selectedSong.lyrics.korean);
        setEditedEnglishLyrics(selectedSong.lyrics.english);
        setIsEditing(false);
      }
      setIsSyncEnabled(false);
    } else {
      setOriginalLyricsKo('');
      setOriginalLyricsEn('');
      setOriginalTitle('');
      popupOpenedRef.current = false;
      setIsSyncEnabled(false);
    }
  }, [selectedSong]);

  // Update draft whenever edit state changes
  useEffect(() => {
    if (selectedSong) {
      setDrafts(prev => ({
        ...prev,
        [selectedSong.id]: {
          title: editedTitle,
          korean: editedKoreanLyrics,
          english: editedEnglishLyrics,
          isEditing: isEditing
        }
      }));
    }
  }, [editedTitle, editedKoreanLyrics, editedEnglishLyrics, isEditing, selectedSong]);

  const handleSave = async () => {
    if (!selectedSong) return;
    
    let finalKorean = editedKoreanLyrics;
    let finalEnglish = editedEnglishLyrics;

    if (isSyncEnabled) {
      setIsTranslating(true);
      try {
        const koreanChanged = editedKoreanLyrics !== selectedSong.lyrics.korean;
        const englishChanged = editedEnglishLyrics !== selectedSong.lyrics.english;

        if (koreanChanged && !englishChanged) {
          finalEnglish = await translateLyrics(editedKoreanLyrics, 'english');
        } else if (englishChanged && !koreanChanged) {
          finalKorean = await translateLyrics(editedEnglishLyrics, 'korean');
        } else if (koreanChanged && englishChanged) {
          // Both changed, prioritize Korean for translation
          finalEnglish = await translateLyrics(editedKoreanLyrics, 'english');
        }
      } catch (error) {
        console.error("Translation failed:", error);
      } finally {
        setIsTranslating(false);
      }
    }

    await updateFavorite(selectedSong.id, {
      title: editedTitle,
      lyrics: {
        ...selectedSong.lyrics,
        korean: finalKorean,
        english: finalEnglish
      }
    });
    
    // Clear draft after successful save
    setDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[selectedSong.id];
      return newDrafts;
    });

    setSelectedSong({
      ...selectedSong,
      title: editedTitle,
      lyrics: {
        ...selectedSong.lyrics,
        korean: finalKorean,
        english: finalEnglish
      }
    });
    setIsEditing(false);
    setIsSyncEnabled(false);
  };

  const handleRestoreOriginal = () => {
    if (!originalLyricsKo && !originalLyricsEn) return;
    setEditedKoreanLyrics(originalLyricsKo);
    setEditedEnglishLyrics(originalLyricsEn);
    setEditedTitle(originalTitle);
    setIsEditing(true);
  };

  const handleToggleLock = async (song: any) => {
    const newLockedState = !song.isLocked;
    await updateFavorite(song.id, { isLocked: newLockedState });
    if (selectedSong && selectedSong.id === song.id) {
      setSelectedSong({ ...selectedSong, isLocked: newLockedState });
    }
  };

  const handlePopupToggleLock = async (song: any) => {
    if (!confirmToggleLock) {
      setConfirmToggleLock(true);
      return;
    }
    
    await handleToggleLock(song);
    setConfirmToggleLock(false);
  };

  const handlePopupDelete = async (song: any) => {
    if (song.isLocked) return;
    
    if (!confirmDeleteSong) {
      setConfirmDeleteSong(true);
      return;
    }
    
    toggleFavorite(song);
    setSelectedSong(null);
    setConfirmDeleteSong(false);
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

  const clearSelectionLongPressTimer = () => {
    if (selectionLongPressTimerRef.current) {
      clearTimeout(selectionLongPressTimerRef.current);
      selectionLongPressTimerRef.current = null;
    }
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

  const handleCardLongPressStart = (e: React.MouseEvent | React.TouchEvent, song: any) => {
    if (isScrollingRef.current) return;
    // Only trigger if not clicking a button
    if ((e.target as HTMLElement).closest('button')) return;

    longPressTriggeredRef.current = false;
    clearSelectionLongPressTimer();
    selectionLongPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (isSelectionMode) {
        cycleSelectionModeSelection(song.id);
      } else {
        selectionBeforeSelectAllRef.current = [];
        setIsSelectionMode(true);
        setLastSelectionAction('none');
        setPendingSelectionAction(null);
        setSelectedSongIds(prev => (prev.includes(song.id) ? prev : [...prev, song.id]));
      }
    }, 600);
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
    setConfirmDeleteAll(0);
    setConfirmUnlockAll(0);
    setConfirmLockAll(0);
    selectionBeforeSelectAllRef.current = [];
    clearSelectionLongPressTimer();
    longPressTriggeredRef.current = false;
    selectionHistoryPushedRef.current = false;
  };

  const closeSelectedSong = (source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && detailHistoryPushedRef.current) {
      window.history.back();
      return;
    }

    setSelectedSong(null);
    detailHistoryPushedRef.current = false;
    setConfirmDeleteSong(false);
    setConfirmToggleLock(false);
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
    
    await Promise.all(deletableSongs.map(song => Promise.resolve(toggleFavorite(song))));
    exitSelectionMode();
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
      `[Themes] ${getSongThemeValues(song).join(', ')}`,
      `[Styles] ${getSongStyleValues(song).join(', ')}`,
      `[Instruments / Sound] ${getSongInstrumentSoundValues(song).join(', ')}`,
      song.appliedKeywords.vocalType ? `[Vocal] ${song.appliedKeywords.vocalType}` : '',
      song.appliedKeywords.tempo ? `[Tempo] ${song.appliedKeywords.tempo}` : ''
    ].filter((line) => !line.endsWith('] ')).join('\n');

    const text = `
${keywords}

${song.title}

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
    if (diffInDays < 30) return `${diffInDays}일 전`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}달 전`;
    return `${Math.floor(diffInMonths / 12)}년 전`;
  };

  const selectedSongs = favorites.filter(song => selectedSongIds.includes(song.id));
  const selectedLockedCount = selectedSongs.filter(song => song.isLocked).length;
  const hasDeletableSongs = selectedSongs.some(s => !s.isLocked);

  const applyKeywordsToNext = (song: any) => {
    sessionStorage.setItem('pendingAppliedKeywords', JSON.stringify({
      genre: getSongGenreValues(song),
      mood: getSongMoodValues(song),
      theme: getSongThemeValues(song),
      style: getSongStyleValues(song),
      instrumentSound: getSongInstrumentSoundValues(song),
      tempo: song.appliedKeywords.tempo ?? null,
      lyricsLength: song.appliedKeywords.lyricsLength ?? 'normal',
      drumStyle: song.appliedKeywords.drumStyle ?? 'none',
      maleCount: song.appliedKeywords.maleCount ?? 0,
      femaleCount: song.appliedKeywords.femaleCount ?? 0,
      rapEnabled: song.appliedKeywords.rapEnabled ?? false,
      tempoConfig: song.appliedKeywords.tempoConfig ?? null,
      customStructure: song.appliedKeywords.customStructure ?? []
    }));
    navigate('/');
  };

  const filteredFavorites = favorites.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.lyrics.korean.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.lyrics.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getSongGenreValues(song).some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
    getSongMoodValues(song).some((m: string) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
    getSongThemeValues(song).some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
    getSongStyleValues(song).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
    getSongInstrumentSoundValues(song).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    const isKorean = (text: string) => /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);

    switch (sortBy) {
      case 'latest':
        return getTimestampMs(b.createdAtMs || b.createdAt) - getTimestampMs(a.createdAtMs || a.createdAt);
      case 'oldest':
        return getTimestampMs(a.createdAtMs || a.createdAt) - getTimestampMs(b.createdAtMs || b.createdAt);
      case 'genre-1':
        return (a.appliedKeywords.genre[0] || '').localeCompare(b.appliedKeywords.genre[0] || '');
      case 'genre-2':
        return (a.appliedKeywords.genre[1] || a.appliedKeywords.genre[0] || '').localeCompare(b.appliedKeywords.genre[1] || b.appliedKeywords.genre[0] || '');
      case 'title-en':
        return a.title.localeCompare(b.title);
      case 'title-ko':
        const aIsKo = isKorean(a.title);
        const bIsKo = isKorean(b.title);
        if (aIsKo && !bIsKo) return -1;
        if (!aIsKo && bIsKo) return 1;
        return a.title.localeCompare(b.title);
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

  return (
    <div 
      className="max-w-6xl mx-auto px-6 pt-32 pb-12 font-sans relative"
      onClick={(e) => {
        // If clicking the background (not a card or popup), exit selection mode
        if (isSelectionMode && e.target === e.currentTarget) {
          exitSelectionMode();
        }
      }}
    >
      <div className="flex flex-col items-center text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 10 }}
        >
          <button 
            onClick={() => navigate('/')}
            onMouseEnter={() => onHover({ id: 'back-home', label: '홈으로', description: '메인 페이지로 돌아갑니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'back-home', label: '홈으로', description: '메인 페이지로 돌아갑니다.' })}
            onTouchEnd={onLongPressEnd}
            className="mb-6 p-4 rounded-2xl bg-brand-orange/10 hover:bg-brand-orange/20 transition-all group"
          >
            <HeartIcon className="w-10 h-10 text-brand-orange fill-current group-hover:scale-110 transition-transform" />
          </button>
        </motion.div>
        <div className="space-y-2">
          <h1 
            className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-display"
            style={{ fontFamily: 'Verdana' }}
          >
            Music <span className="text-brand-orange">Note</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">세상에 단 하나뿐인 노래의 완성!</p>
          <p className="text-[var(--text-secondary)]/60 text-sm">저장한 곡을 편집하고, 수노에서 음악을 만들어 보세요.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 group overflow-hidden">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
              <Search className="w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-brand-orange transition-colors" />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-2xl py-3 pl-12 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-brand-orange/50 transition-all"
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
                    className="text-sm text-[var(--text-secondary)] whitespace-nowrap"
                  >
                    {placeholders[placeholderIndex]}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* View All (모아보기) Button */}
          <div className="relative" ref={sortPopupRef}>
            <button
              onClick={toggleSortPopup}
              onMouseEnter={() => onHover({ id: 'sort', label: '정렬 방식', description: '곡 목록의 정렬 순서를 변경합니다.' })}
              onMouseLeave={() => onHover(null)}
              className="px-4 py-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-bold hover:bg-[var(--hover-bg)] transition-all flex items-center gap-2 min-w-[120px] justify-center"
            >
              <Filter className="w-4 h-4 text-brand-orange" />
              {sortBy === 'latest' ? '최신 순' : 
               sortBy === 'oldest' ? '오래된 순' : 
               sortBy.startsWith('genre') ? '장르 순' : 
               sortBy.startsWith('title') ? '제목 순' : '잠금 순'}
            </button>

            <AnimatePresence>
              {showSortPopup && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-40 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl shadow-[var(--shadow-md)] z-50 overflow-hidden"
                >
                  {[
                    { id: 'latest', label: '최신 순' },
                    { id: 'oldest', label: '오래된 순' },
                    { id: 'genre', label: '장르 순' },
                    { id: 'title', label: '제목 순' },
                    { id: 'locked', label: '잠금 순' }
                  ].map((option) => (
            <button
              key={option.id}
              onClick={() => handleSortChange(option.id as any)}
              className={cn(
                "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--hover-bg)]",
                sortBy === option.id ? "text-brand-orange font-bold" : "text-[var(--text-secondary)]"
              )}
            >
              {option.label}
            </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Unified Sticky Action Popup */}
      <AnimatePresence mode="wait">
        {!selectedSong && (
          isSelectionMode ? (
            <motion.div
              key="selection-popup"
              initial={{ opacity: 0, y: -20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                x: isShaking ? [0, -2, 2, -2, 2, 0] : 0
              }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 30,
                x: { duration: 0.4 }
              }}
              className="sticky top-24 z-[120] flex justify-center mb-8 pointer-events-none"
            >
              <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 w-[300px] rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/90 backdrop-blur-xl shadow-[var(--shadow-md)] ring-1 ring-white/5">
                  <button
                    onClick={handleSelectedLock}
                    onMouseEnter={() => onHover(getSelectionLockHover())}
                    onMouseLeave={() => onHover(null)}
                    onTouchStart={() => onLongPressStart(getSelectionLockHover())}
                    onTouchEnd={onLongPressEnd}
                    disabled={selectedSongIds.length === 0}
                    className={cn(
                      "relative h-12 w-12 rounded-xl transition-all flex items-center justify-center border shrink-0",
                      selectedSongIds.length === 0
                        ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)]/30 border-[var(--border-color)] cursor-not-allowed"
                        : (pendingSelectionAction === 'lock' || pendingSelectionAction === 'unlock')
                          ? "bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(242,125,38,0.3)] animate-pulse"
                          : selectedSongs.every(s => s.isLocked)
                            ? lastSelectionAction === 'lock'
                              ? "bg-brand-orange/40 text-brand-orange border-brand-orange/30"
                              : "bg-brand-orange/10 text-brand-orange border-brand-orange/20 hover:bg-brand-orange/20"
                            : "bg-brand-orange/10 text-brand-orange border-brand-orange/20 hover:bg-brand-orange/20"
                    )}
                    aria-label={selectedSongs.every(s => s.isLocked) ? "선택 잠금 해제" : "선택 잠금"}
                  >
                  {selectedSongs.every(s => s.isLocked) ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  {selectedLockedCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 rounded-full bg-brand-orange text-[10px] leading-4.5 font-bold text-white text-center">
                      {selectedLockedCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleSelectionConfirm}
                  onMouseEnter={() => onHover({ 
                    id: 'selection-confirm', 
                    label: pendingSelectionAction ? '실행 확인' : '  확인', 
                    description: pendingSelectionAction ? '대기 중인 작업을 실행합니다.' : '현재 선택 상태를 확정합니다.' 
                  })}
                  onMouseLeave={() => onHover(null)}
                  onTouchStart={() => onLongPressStart({ 
                    id: 'selection-confirm', 
                    label: pendingSelectionAction ? '실행 확인' : '  확인', 
                    description: pendingSelectionAction ? '대기 중인 작업을 실행합니다.' : '현재 선택 상태를 확정합니다.' 
                  })}
                  onTouchEnd={onLongPressEnd}
                  className={cn(
                    "flex-1 h-12 px-2 rounded-xl transition-all flex items-center justify-center gap-2 border",
                    pendingSelectionAction
                      ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20"
                      : "bg-[var(--text-secondary)] text-[var(--bg-primary)] border-[var(--border-color)] hover:opacity-80"
                  )}
                >
                  <span className="text-[14px] font-bold">{selectedSongIds.length}곡</span>
                  <span className="text-[16px] font-medium opacity-80">{pendingSelectionAction ? '실행' : '확인'}</span>
                  <Check className={cn("w-5 h-5", pendingSelectionAction ? "text-white" : "text-brand-orange")} />
                </button>

                <button
                  onClick={handleSelectedDelete}
                  onMouseEnter={() => onHover({ id: 'selection-delete', label: '선택 삭제', description: '선택된 곡 중 잠기지 않은 곡만 삭제합니다.' })}
                  onMouseLeave={() => onHover(null)}
                  onTouchStart={() => onLongPressStart({ id: 'selection-delete', label: '선택 삭제', description: '선택된 곡 중 잠기지 않은 곡만 삭제합니다.' })}
                  onTouchEnd={onLongPressEnd}
                  disabled={selectedSongIds.length === 0}
                  className={cn(
                    "h-12 w-12 rounded-xl transition-all flex items-center justify-center border shrink-0",
                    selectedSongIds.length === 0
                      ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)]/30 border-[var(--border-color)] cursor-not-allowed"
                      : pendingSelectionAction === 'delete'
                        ? "bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
                        : hasDeletableSongs
                          ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                          : "bg-red-500/5 text-red-500/40 border-red-500/10 hover:bg-red-500/20"
                  )}
                  aria-label="선택 삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ) : (
            favorites.length > 0 && (
              <motion.div
                key="bulk-popup"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="sticky top-24 z-[120] flex justify-center mb-8 pointer-events-none"
              >
                <div className="pointer-events-auto flex items-center gap-2 px-3 py-3 w-[300px] rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/90 backdrop-blur-xl shadow-[var(--shadow-md)] ring-1 ring-[var(--border-color)]">
                  <button
                    onClick={handleBulkLock}
                    onMouseEnter={() => onHover(getBulkLockHover())}
                    onMouseLeave={() => onHover(null)}
                    className={cn(
                      "flex-1 h-12 rounded-xl transition-all flex items-center justify-center gap-1 font-bold text-xs border",
                      confirmLockAll === 1 
                        ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)] animate-pulse" 
                        : "bg-[var(--hover-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]/20"
                    )}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {confirmLockAll === 1 ? "확인" : "일괄잠금"}
                  </button>

                  <button
                    onClick={handleBulkUnlock}
                    onMouseEnter={() => onHover(getBulkUnlockHover())}
                    onMouseLeave={() => onHover(null)}
                    className={cn(
                      "flex-1 h-12 rounded-xl transition-all flex items-center justify-center gap-1 font-bold text-xs border",
                      confirmUnlockAll === 1 
                        ? "bg-brand-orange text-[var(--bg-primary)] border-brand-orange animate-pulse" 
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                    )}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    {confirmUnlockAll === 1 ? "확인" : "일괄해제"}
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    onMouseEnter={() => onHover(getBulkDeleteHover())}
                    onMouseLeave={() => onHover(null)}
                    className={cn(
                      "flex-1 h-12 rounded-xl transition-all flex items-center justify-center gap-1 font-bold text-xs border",
                      confirmDeleteAll === 1 
                        ? "bg-red-500 text-[var(--bg-primary)] border-red-500 animate-pulse" 
                        : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteAll === 1 ? "확인" : "전체삭제"}
                  </button>
                </div>
              </motion.div>
            )
          )
        )}
      </AnimatePresence>

      {favorites.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] p-12 shadow-[var(--shadow-md)]">
          <Music className="w-12 h-12 text-[var(--text-secondary)]/20 mb-4" />
          <p className="text-[var(--text-secondary)] text-lg font-medium">아직 저장된 곡이 없습니다.</p>
          <Link to="/" className="mt-6 text-brand-orange font-bold hover:underline">
            첫 번째 곡 만들러 가기
          </Link>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center text-center">
          <Search className="w-10 h-10 text-[var(--text-secondary)]/20 mb-4" />
          <p className="text-[var(--text-secondary)]">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFavorites.slice(0, visibleCount).map((song) => {
              const isSelected = selectedSongIds.includes(song.id);

              return (
              <motion.div
                key={song.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onMouseDown={(e) => handleCardLongPressStart(e, song)}
                onMouseUp={handleCardLongPressEnd}
                onMouseLeave={handleCardLongPressEnd}
                onTouchStart={(e) => handleCardLongPressStart(e, song)}
                onTouchEnd={handleCardLongPressEnd}
                onTouchCancel={handleCardLongPressEnd}
                onClick={(e) => {
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }

                  if (isSelectionMode) {
                    e.stopPropagation();
                    toggleSongSelection(song.id);
                    setPendingSelectionAction(null);
                  }
                }}
                className={cn(
                  "rounded-3xl p-6 transition-all group flex flex-col h-full border select-none shadow-[var(--shadow-md)]",
                  isSelectionMode
                    ? isSelected
                      ? "border-brand-orange/40 ring-1 ring-brand-orange/30 bg-[var(--card-bg)]"
                      : "bg-[var(--card-bg)]/40 border-[var(--border-color)] hover:bg-[var(--hover-bg)]/40 cursor-pointer"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
                )}
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14.4px] font-bold text-[var(--text-primary)] leading-tight">
                      {song.title.includes(']') ? (
                        <>
                          <span className="block mb-1">{song.title.split(']')[0]}]</span>
                          <span>{song.title.split(']')[1].trim()}</span>
                        </>
                      ) : (
                        song.title
                      )}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {isSelectionMode && isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-brand-orange flex items-center justify-center"
                        >
                          <Check className="w-3.5 h-3.5 text-[var(--bg-primary)] stroke-[3]" />
                        </motion.div>
                      )}
                      <span className="text-[10px] text-[var(--text-secondary)] font-semibold opacity-100">
                        {getRelativeTime(song.createdAt)}
                      </span>
                    </div>
                    {isSelectionMode ? (
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "relative p-2 rounded-xl transition-all",
                          song.isLocked ? "bg-brand-orange/20 text-brand-orange" : "bg-[var(--hover-bg)] text-[var(--text-secondary)]"
                        )}>
                          {song.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          <span className="absolute inset-0 flex items-center justify-center text-[var(--text-primary)]/80 text-lg leading-none pointer-events-none">╱</span>
                        </div>
                        <div className={cn(
                          "relative p-2 rounded-xl transition-all",
                          song.isLocked 
                            ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)]/30" 
                            : "bg-red-500/10 text-red-500"
                        )}>
                          <Trash2 className="w-4 h-4" />
                          <span className="absolute inset-0 flex items-center justify-center text-[var(--text-primary)]/80 text-lg leading-none pointer-events-none">╱</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLock(song);
                          }}
                          onMouseEnter={() => onHover({ id: `lock-${song.id}`, label: song.isLocked ? '잠금 해제' : '잠금', description: song.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                          onMouseLeave={() => onHover(null)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            song.isLocked ? "bg-brand-orange/20 text-brand-orange" : "bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]/20"
                          )}
                        >
                          {song.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (song.isLocked) return;

                            if (deletingSongId === song.id) {
                              toggleFavorite(song);
                              setDeletingSongId(null);
                              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
                            } else {
                              setDeletingSongId(song.id);
                              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
                              deleteTimerRef.current = setTimeout(() => setDeletingSongId(null), 5000);
                            }
                          }}
                          disabled={song.isLocked}
                          onMouseEnter={() => onHover({ 
                            id: `delete-${song.id}`, 
                            label: deletingSongId === song.id ? '삭제 확인' : '삭제', 
                            description: song.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : (deletingSongId === song.id ? '한번 더 누르면 삭제됩니다.' : '이 곡을 목록에서 삭제합니다.') 
                          })}
                          onMouseLeave={() => onHover(null)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            song.isLocked 
                              ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)]/30 cursor-not-allowed" 
                              : deletingSongId === song.id
                                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                                : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col flex-grow space-y-4">
                  <div className="flex flex-wrap gap-1.5 overflow-hidden">
                    {getSongGenreValues(song).map((g: string) => (
                      <span 
                        key={g} 
                        onClick={(e) => {
                          e.stopPropagation();
                          onHover({ id: `genre-${g}`, label: g, description: `${g} 장르입니다.`, _ts: Date.now() });
                        }}
                        className="text-[8px] px-2 py-0.5 rounded-md bg-[var(--hover-bg)] text-[var(--text-secondary)] whitespace-nowrap cursor-pointer hover:bg-[var(--hover-bg)]/80"
                      >
                        #{g}
                      </span>
                    ))}
                    {getSongMoodValues(song).map((m: string) => (
                      <span 
                        key={m} 
                        onClick={(e) => {
                          e.stopPropagation();
                          onHover({ id: `mood-${m}`, label: m, description: `${m} 감정 키워드입니다.`, _ts: Date.now() });
                        }}
                        className="text-[8px] px-2 py-0.5 rounded-md bg-[var(--hover-bg)] text-[var(--text-secondary)] whitespace-nowrap cursor-pointer hover:bg-[var(--hover-bg)]/80"
                      >
                        #{m}
                      </span>
                    ))}
                    {getSongThemeValues(song).map((t: string) => {
                      const item = getKeywordMeta(t);
                      return (
                        <span 
                          key={`theme-${t}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onHover({ id: `theme-${t}`, label: t, description: item?.description ?? `${t} 곡 주제입니다.`, _ts: Date.now() });
                          }}
                          className="text-[8px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 whitespace-nowrap cursor-pointer hover:bg-emerald-500/20"
                        >
                          #{t}
                        </span>
                      );
                    })}
                    {getSongStyleValues(song).map((s: string) => {
                      const item = getKeywordMeta(s);
                      return (
                        <span 
                          key={`style-${s}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onHover({ id: `style-${s}`, label: s, description: item?.description ?? `${s} 스타일입니다.`, _ts: Date.now() });
                          }}
                          className="text-[8px] px-2 py-0.5 rounded-md bg-brand-orange/10 text-brand-orange whitespace-nowrap cursor-pointer hover:bg-brand-orange/20"
                        >
                          #{s}
                        </span>
                      );
                    })}
                    {getSongInstrumentSoundValues(song).map((s: string) => {
                      const item = getKeywordMeta(s);
                      return (
                        <span 
                          key={`sound-${s}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onHover({ id: `sound-${s}`, label: s, description: item?.description ?? `${s} 악기/사운드 설정입니다.`, _ts: Date.now() });
                          }}
                          className="text-[8px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 whitespace-nowrap cursor-pointer hover:bg-sky-500/20"
                        >
                          #{s}
                        </span>
                      );
                    })}
                    {song.appliedKeywords.vocalType && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          onHover({ id: `vocal-${song.id}`, label: '보컬', description: `${song.appliedKeywords.vocalType} 구성입니다.`, _ts: Date.now() });
                        }}
                        className="text-[8px] px-2 py-0.5 rounded-md bg-brand-orange/10 text-brand-orange whitespace-nowrap cursor-pointer hover:bg-brand-orange/20"
                      >
                        #{song.appliedKeywords.vocalType}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    {isSelectionMode ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSongSelection(song.id);
                        }}
                        className={cn(
                          "w-full py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2",
                          isSelected
                            ? "bg-brand-orange/20 text-brand-orange border-brand-orange/40"
                            : "bg-[var(--hover-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]/20"
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4" />
                            확인
                          </>
                        ) : (
                          "선택"
                        )}
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSong(song);
                          }}
                          onMouseEnter={() => onHover({ id: `view-${song.id}`, label: '상세보기', description: '곡의 가사와 상세 정보를 확인합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: `view-${song.id}`, label: '상세보기', description: '곡의 가사와 상세 정보를 확인합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex-[4] py-3 rounded-xl bg-[var(--hover-bg)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--hover-bg)]/20 transition-all"
                        >
                          상세보기
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyAll(song);
                          }}
                          onMouseEnter={() => onHover({ id: `copy-all-${song.id}`, label: '곡 정보 모두 복사', description: '제목, 가사, 프롬프트 등 모든 정보를 복사합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: `copy-all-${song.id}`, label: '곡 정보 모두 복사', description: '제목, 가사, 프롬프트 등 모든 정보를 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex-1 py-3 rounded-xl bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]/20 hover:text-[var(--text-primary)] transition-all flex items-center justify-center group/copy border border-brand-orange/20"
                        >
                          {copiedType === `all-${song.id}` ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 group-hover/copy:scale-110 transition-transform" />
                          )}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            applyKeywordsToNext(song);
                          }}
                          onMouseEnter={() => onHover({ id: `apply-next-${song.id}`, label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: `apply-next-${song.id}`, label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="flex-1 py-3 rounded-xl bg-[var(--card-bg)] text-brand-orange hover:bg-brand-orange/10 transition-all flex items-center justify-center group/apply border border-brand-orange/30 active:scale-95"
                        >
                          <RefreshCw className="w-4 h-4 group-hover/apply:rotate-180 transition-transform duration-500" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>

          {visibleCount < filteredFavorites.length && (
            <div className="flex justify-center pt-8">
              <button
                onClick={() => setVisibleCount(prev => prev + 9)}
                onMouseEnter={() => onHover({ id: 'load-more', label: '더보기', description: '곡을 9개 더 불러옵니다.' })}
                onMouseLeave={() => onHover(null)}
                className="px-8 py-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] font-bold transition-all border border-[var(--border-color)] flex items-center gap-2 group shadow-[var(--shadow-md)]"
              >
                <Plus className="w-5 h-5 text-brand-orange group-hover:rotate-90 transition-transform" />
                더보기 ({filteredFavorites.length - visibleCount}개 남음)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lyrics Modal */}
      <AnimatePresence>
        {selectedSong && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 font-sans">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => closeSelectedSong()}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-[var(--shadow-md)] flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30 relative flex flex-col items-center">
                <button 
                  onClick={() => closeSelectedSong()} 
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors z-10"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="w-full max-w-lg space-y-6">
                  {/* Title Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-brand-orange font-bold text-[18px] uppercase tracking-widest">SONG INFO-Title</h3>
                      {!isEditing && (
                        <button 
                          onClick={() => copyToClipboard(selectedSong.title, 'title')}
                          onMouseEnter={() => onHover({ id: 'copy-title', label: '제목 복사', description: '곡 제목을 복사합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: 'copy-title', label: '제목 복사', description: '곡 제목을 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        >
                          {copiedType === 'title' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <input 
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full bg-[var(--input-bg)] border border-brand-orange/30 rounded-xl px-4 py-3 text-[var(--text-primary)] font-bold text-xl focus:outline-none"
                      />
                    ) : (
                      <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                          {isTitleExpanded && (
                            <motion.h2 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-[19px] font-bold text-[var(--text-primary)] leading-tight text-left w-full overflow-hidden"
                            >
                              {selectedSong.title.includes(']') ? (
                                <>
                                  <span className="block mb-1">{selectedSong.title.split(']')[0]}]</span>
                                  <span>{selectedSong.title.split(']')[1].trim()}</span>
                                </>
                              ) : (
                                selectedSong.title
                              )}
                            </motion.h2>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!isEditing && (
                    <div className="flex items-center justify-center gap-4">
                      <button 
                        onClick={() => handlePopupToggleLock(selectedSong)}
                        onMouseEnter={() => onHover({ 
                          id: 'popup-lock', 
                          label: confirmToggleLock ? (selectedSong.isLocked ? '해제 확인' : '잠금 확인') : (selectedSong.isLocked ? '잠금 해제' : '잠금'), 
                          description: confirmToggleLock ? '한번 더 누르면 실행됩니다.' : (selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.') 
                        })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ 
                          id: 'popup-lock', 
                          label: confirmToggleLock ? (selectedSong.isLocked ? '해제 확인' : '잠금 확인') : (selectedSong.isLocked ? '잠금 해제' : '잠금'), 
                          description: confirmToggleLock ? '한번 더 누르면 실행됩니다.' : (selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.') 
                        })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedSong.isLocked 
                            ? confirmToggleLock ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-orange/20 text-brand-orange border-brand-orange/30" 
                            : confirmToggleLock ? "bg-brand-orange text-white border-brand-orange" : "bg-transparent text-[var(--text-primary)] border-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                        )}
                      >
                        {selectedSong.isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </button>

                      <button 
                        onClick={() => handlePopupDelete(selectedSong)}
                        disabled={selectedSong.isLocked}
                        onMouseEnter={() => onHover({ 
                          id: 'popup-delete', 
                          label: confirmDeleteSong ? '삭제 확인' : '삭제', 
                          description: selectedSong.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : (confirmDeleteSong ? '한번 더 누르면 삭제됩니다.' : '이 곡을 목록에서 삭제합니다.') 
                        })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ 
                          id: 'popup-delete', 
                          label: confirmDeleteSong ? '삭제 확인' : '삭제', 
                          description: selectedSong.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : (confirmDeleteSong ? '한번 더 누르면 삭제됩니다.' : '이 곡을 목록에서 삭제합니다.') 
                        })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedSong.isLocked 
                            ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)]/30 border-[var(--border-color)] cursor-not-allowed" 
                            : confirmDeleteSong 
                              ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30" 
                              : "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white"
                        )}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => {
                          setIsEditing(true);
                          setIsSyncEnabled(false);
                        }}
                        onMouseEnter={() => onHover({ id: 'popup-edit', label: '수정하기', description: '곡 정보를 수정합니다.' })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: 'popup-edit', label: '수정하기', description: '곡 정보를 수정합니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="px-3.5 py-3 rounded-2xl bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-all flex items-center gap-2 text-xs font-bold border border-brand-orange/20"
                      >
                        <Edit2 className="w-4 h-4" />
                        수정하기
                      </button>

                      {isModified && (
                        <button 
                          onClick={handleRestoreOriginal}
                          onMouseEnter={() => onHover({ id: 'popup-restore', label: '원본 복원', description: '최초 원본 가사 상태로 되돌립니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: 'popup-restore', label: '원본 복원', description: '최초 원본 가사 상태로 되돌립니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="px-6 py-3 rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 text-sm font-bold border border-[var(--border-color)]"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          원본 복원
                        </button>
                      )}

                      <a 
                        href="https://suno.com/create" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onMouseEnter={() => onHover({ id: 'popup-suno', label: 'Suno Create', description: 'Suno에서 음악을 생성합니다.' })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: 'popup-suno', label: 'Suno Create', description: 'Suno에서 음악을 생성합니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="w-12 h-12 rounded-full border-2 border-[var(--text-primary)] flex items-center justify-center text-[var(--text-primary)] text-[10px] font-black tracking-tighter hover:scale-110 transition-all bg-transparent"
                      >
                        SUNO
                      </a>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex items-center justify-center gap-3">
                      {isModified && (
                        <button 
                          onClick={handleRestoreOriginal}
                          onMouseEnter={() => onHover({ id: 'popup-restore-edit', label: '원본 복원', description: '최초 원본 가사 상태로 되돌립니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: 'popup-restore-edit', label: '원본 복원', description: '최초 원본 가사 상태로 되돌립니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="px-6 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 text-sm font-bold border border-[var(--border-color)]"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          원본 복원
                        </button>
                      )}
                      <button 
                        onClick={handleSave}
                        disabled={isTranslating}
                        className={cn(
                          "px-8 py-3 rounded-xl bg-brand-orange text-white text-sm font-bold transition-all shadow-lg shadow-brand-orange/20 flex items-center gap-2",
                          isTranslating ? "opacity-70 cursor-wait" : "hover:brightness-110"
                        )}
                      >
                        {isTranslating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            번역 중...
                          </>
                        ) : '저장하기'}
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setDrafts(prev => {
                            const newDrafts = { ...prev };
                            delete newDrafts[selectedSong.id];
                            return newDrafts;
                          });
                          setEditedTitle(selectedSong.title);
                          setEditedKoreanLyrics(selectedSong.lyrics.korean);
                          setEditedEnglishLyrics(selectedSong.lyrics.english);
                        }}
                        className="px-8 py-3 rounded-xl bg-[var(--hover-bg)] text-[var(--text-secondary)] text-sm font-bold hover:bg-[var(--hover-bg)]/20 transition-all"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>

                {/* Expand Button at Bottom Center, overlapping border */}
                {!isEditing && (
                  <button
                    onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center text-brand-orange hover:text-white hover:bg-brand-orange transition-all z-20 shadow-xl"
                  >
                    {isTitleExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                )}
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                {/* Keywords & Tempo */}
                <div className="bg-[var(--bg-secondary)]/30 rounded-2xl p-4 border border-[var(--border-color)] relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <div className="space-y-2 pr-12 sm:pr-0">
                      {[
                        { title: 'Genre', values: getSongGenreValues(selectedSong), className: 'bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]/80' },
                        { title: 'Mood', values: getSongMoodValues(selectedSong), className: 'bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]/80' },
                        { title: 'Theme', values: getSongThemeValues(selectedSong), className: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
                        { title: 'Style', values: getSongStyleValues(selectedSong), className: 'bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20' },
                        { title: 'Sound', values: getSongInstrumentSoundValues(selectedSong), className: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' },
                      ].filter((section) => section.values.length > 0).map((section) => (
                        <div key={section.title} className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{section.title}</p>
                          <div className="flex flex-wrap gap-2">
                            {section.values.map((k: string) => {
                              const item = getKeywordMeta(k);
                              return (
                                <span
                                  key={`${section.title}-${k}`}
                                  onMouseEnter={() => {
                                    if (item) {
                                      onHover({ id: `keyword-${section.title}-${k}`, label: k, description: item.description });
                                    }
                                  }}
                                  onMouseLeave={() => onHover(null)}
                                  onTouchStart={() => {
                                    if (item) {
                                      onLongPressStart({ id: `keyword-${section.title}-${k}`, label: k, description: item.description });
                                    }
                                  }}
                                  onTouchEnd={onLongPressEnd}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-help transition-all active:scale-95 ${section.className}`}
                                >
                                  #{k}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => applyKeywordsToNext(selectedSong)}
                          onMouseEnter={() => onHover({ id: 'popup-apply-next', label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                          onMouseLeave={() => onHover(null)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--card-bg)] text-brand-orange hover:bg-brand-orange/10 transition-all shadow-sm text-[12px] font-bold whitespace-nowrap border border-brand-orange/30 active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          다음 곡에 적용
                        </button>
                        <button 
                          onClick={() => copyToClipboard([...getSongGenreValues(selectedSong), ...getSongMoodValues(selectedSong), ...getSongThemeValues(selectedSong), ...getSongStyleValues(selectedSong), ...getSongInstrumentSoundValues(selectedSong)].join(', '), 'keywords')}
                          className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        >
                          {copiedType === 'keywords' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedSong.appliedKeywords.vocalType && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-sans mb-1">
                      <span className="w-1 h-1 rounded-full bg-brand-orange" />
                      Vocal: {selectedSong.appliedKeywords.vocalType}
                    </div>
                  )}
                  {selectedSong.appliedKeywords.tempo && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-sans">
                      <span className="w-1 h-1 rounded-full bg-brand-orange" />
                      Tempo: {selectedSong.appliedKeywords.tempo} BPM
                    </div>
                  )}
                </div>

                {/* Lyrics */}
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-brand-orange font-bold text-[18px] uppercase tracking-widest">한글버전 Lyrics</h3>
                        {isEditing && (
                          <button
                            onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                            onMouseEnter={() => onHover({ id: 'sync-info-ko', label: '한/영 연동', description: 'ON 상태에서 저장하면, 마지막으로 수정한 언어를 기준으로 반대 언어 가사를 자동 번역하여 함께 저장합니다.' })}
                            onMouseLeave={() => {
                              onHover(null);
                              onLongPressEnd();
                            }}
                            onTouchStart={() => onLongPressStart({ id: 'sync-info-ko', label: '한/영 연동', description: 'ON 상태에서 저장하면, 마지막으로 수정한 언어를 기준으로 반대 언어 가사를 자동 번역하여 함께 저장합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                              isSyncEnabled 
                                ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30" 
                                : "bg-[var(--hover-bg)] text-[var(--text-secondary)] border-[var(--border-color)]"
                            )}
                          >
                            {isSyncEnabled ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                            한/영 연동 {isSyncEnabled ? 'ON' : 'OFF'}
                          </button>
                        )}
                      </div>
                      {!isEditing && (
                        <button 
                          onClick={() => copyToClipboard(selectedSong.lyrics.korean, 'lyrics-korean')}
                          onMouseEnter={() => onHover({ id: 'copy-lyrics-ko', label: '한글 가사 복사', description: '한글 버전 가사를 복사합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: 'copy-lyrics-ko', label: '한글 가사 복사', description: '한글 버전 가사를 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        >
                          {copiedType === 'lyrics-korean' ? <Check className="w-8 h-8 text-brand-orange" /> : <Copy className="w-8 h-8" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        value={editedKoreanLyrics}
                        onChange={(e) => setEditedKoreanLyrics(e.target.value)}
                        className="w-full h-48 bg-[var(--input-bg)] border border-brand-orange/30 rounded-xl p-4 text-[var(--text-primary)] text-sm focus:outline-none custom-scrollbar"
                      />
                    ) : (
                      <p 
                        className="text-base text-[var(--text-primary)] leading-6 whitespace-pre-wrap font-normal"
                        style={{ fontFamily: 'Arial, sans-serif' }}
                      >
                        {selectedSong.lyrics.korean}
                      </p>
                    )}
                  </div>
                  <div className="pt-8 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-brand-orange font-bold text-[18px] uppercase tracking-widest">영어버전 Lyrics</h3>
                        {isEditing && (
                          <button
                            onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                            onMouseEnter={() => onHover({ id: 'sync-info-en', label: '한/영 연동', description: 'ON 상태에서 저장하면, 마지막으로 수정한 언어를 기준으로 반대 언어 가사를 자동 번역하여 함께 저장합니다.' })}
                            onMouseLeave={() => {
                              onHover(null);
                              onLongPressEnd();
                            }}
                            onTouchStart={() => onLongPressStart({ id: 'sync-info-en', label: '한/영 연동', description: 'ON 상태에서 저장하면, 마지막으로 수정한 언어를 기준으로 반대 언어 가사를 자동 번역하여 함께 저장합니다.' })}
                            onTouchEnd={onLongPressEnd}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                              isSyncEnabled 
                                ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30" 
                                : "bg-[var(--hover-bg)] text-[var(--text-secondary)] border-[var(--border-color)]"
                            )}
                          >
                            {isSyncEnabled ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                            한/영 연동 {isSyncEnabled ? 'ON' : 'OFF'}
                          </button>
                        )}
                      </div>
                      {!isEditing && (
                        <button 
                          onClick={() => copyToClipboard(selectedSong.lyrics.english, 'lyrics-english')}
                          onMouseEnter={() => onHover({ id: 'copy-lyrics-en', label: '영어 가사 복사', description: '영어 버전 가사를 복사합니다.' })}
                          onMouseLeave={() => {
                            onHover(null);
                            onLongPressEnd();
                          }}
                          onTouchStart={() => onLongPressStart({ id: 'copy-lyrics-en', label: '영어 가사 복사', description: '영어 버전 가사를 복사합니다.' })}
                          onTouchEnd={onLongPressEnd}
                          className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        >
                          {copiedType === 'lyrics-english' ? <Check className="w-8 h-8 text-brand-orange" /> : <Copy className="w-8 h-8" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        value={editedEnglishLyrics}
                        onChange={(e) => setEditedEnglishLyrics(e.target.value)}
                        className="w-full h-48 bg-[var(--input-bg)] border border-brand-orange/30 rounded-xl p-4 text-[var(--text-secondary)] text-sm focus:outline-none italic custom-scrollbar"
                      />
                    ) : (
                      <p 
                        className="text-base text-[var(--text-secondary)] leading-6 whitespace-pre-wrap font-normal"
                        style={{ fontFamily: 'Arial, sans-serif' }}
                      >
                        {selectedSong.lyrics.english}
                      </p>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <div className="pt-8 border-t border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-brand-orange font-bold text-[18px] uppercase tracking-widest">곡 프롬프트 Prompt</h3>
                    {!isEditing && (
                      <button 
                        onClick={() => copyToClipboard(selectedSong.prompt, 'prompt')}
                        onMouseEnter={() => onHover({ id: 'copy-prompt', label: '프롬프트 복사', description: '곡 생성 프롬프트를 복사합니다.' })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: 'copy-prompt', label: '프롬프트 복사', description: '곡 생성 프롬프트를 복사합니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                      >
                        {copiedType === 'prompt' ? <Check className="w-8 h-8 text-brand-orange" /> : <Copy className="w-8 h-8" />}
                      </button>
                    )}
                  </div>
                  <div className="bg-[var(--input-bg)] rounded-2xl p-4 border border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed">
                      {selectedSong.prompt}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
