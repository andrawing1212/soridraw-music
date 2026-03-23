import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { translateLyrics } from '../services/geminiService';
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
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function FavoritesPage({ 
  favorites, 
  toggleFavorite, 
  updateFavorite,
  clearAllFavorites,
  unlockAllFavorites,
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
  const [drafts, setDrafts] = useState<Record<string, { title: string; korean: string; english: string; isEditing: boolean }>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = [
    "제목으로 검색해보세요...",
    "가사 내용으로 검색해보세요...",
    "장르나 키워드로 검색해보세요...",
    "분위기로 검색해보세요..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

  const handleBulkDelete = () => {
    if (confirmDeleteAll === 0) {
      setConfirmDeleteAll(1);
      setTimeout(() => setConfirmDeleteAll(0), 3000);
    } else {
      clearAllFavorites();
      setConfirmDeleteAll(0);
    }
  };

  const handleBulkUnlock = () => {
    if (confirmUnlockAll === 0) {
      setConfirmUnlockAll(1);
      setTimeout(() => setConfirmUnlockAll(0), 3000);
    } else {
      unlockAllFavorites();
      setConfirmUnlockAll(0);
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
      `[Genres] ${song.appliedKeywords.genre.join(', ')}`,
      `[Moods] ${song.appliedKeywords.mood.join(', ')}`,
      `[Themes] ${song.appliedKeywords.theme.join(', ')}`,
      song.appliedKeywords.tempo ? `[Tempo] ${song.appliedKeywords.tempo}` : ''
    ].filter(Boolean).join('\n');

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
        <div className="p-6 rounded-full bg-zinc-900/50 mb-6">
          <HeartIcon className="w-12 h-12 text-gray-600" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-500 mb-8">보관함을 이용하려면 로그인을 해주세요.</p>
      </div>
    );
  }

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

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

  const filteredFavorites = favorites.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.lyrics.korean.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.lyrics.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.appliedKeywords.genre.some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
    song.appliedKeywords.mood.some((m: string) => m.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    const isKorean = (text: string) => /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);

    switch (sortBy) {
      case 'latest':
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'oldest':
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
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
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'locked-bottom':
        if (a.isLocked !== b.isLocked) return a.isLocked ? 1 : -1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-6 pt-32 pb-12 font-sans relative">
      {/* Suno Icon at Top Right (Symmetrical to Floating Bar, moved 2cm right) */}
      <div className="fixed top-[26px] md:top-[28px] right-4 md:right-6 xl:right-8 2xl:right-[calc((100vw-1152px)/2-82px)] z-50">
        <motion.div
          animate={{ 
            y: [0, -5, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <a 
            href="https://suno.com/create" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-12 h-12 md:w-[64px] md:h-[64px] rounded-2xl border border-white/10 flex items-center justify-center text-brand-orange text-[10px] md:text-[12px] font-black tracking-tighter hover:scale-110 transition-all bg-zinc-900/90 backdrop-blur-md shadow-2xl"
            title="Suno Create"
          >
            SUNO
          </a>
        </motion.div>
      </div>

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
            <Music className="w-10 h-10 text-brand-orange group-hover:scale-110 transition-transform" />
          </button>
        </motion.div>
        <div className="space-y-2">
          <h1 
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2 font-display"
            style={{ fontFamily: 'Verdana' }}
          >
            Music <span className="text-studio-brown">Note</span>
          </h1>
          <p className="text-gray-400 text-lg">세상에 단 하나뿐인 노래의 완성!</p>
          <p className="text-gray-500 text-sm">저장한 곡을 편집하고, 수노에서 음악을 만들어 보세요.</p>
        </div>
      </div>

      {/* Search Bar & Bulk Actions */}
      <div className="max-w-2xl mx-auto mb-12 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400 group-focus-within:text-brand-orange transition-colors" />
            </div>
            <input 
              type="text"
              placeholder={placeholders[placeholderIndex]}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-700/80 border border-white/20 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-brand-orange/50 transition-all placeholder:text-gray-400"
            />
          </div>
          
          {/* View All (모아보기) Button */}
          <div className="relative" ref={sortPopupRef}>
            <button
              onClick={toggleSortPopup}
              onMouseEnter={() => onHover({ id: 'sort', label: '정렬 방식', description: '곡 목록의 정렬 순서를 변경합니다.' })}
              onMouseLeave={() => onHover(null)}
              className="px-4 py-3 rounded-2xl bg-zinc-800/80 border border-white/20 text-white text-sm font-bold hover:bg-zinc-700 transition-all flex items-center gap-2 min-w-[120px] justify-center"
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
                  className="absolute top-full right-0 mt-2 w-40 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
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
                        "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white/5",
                        sortBy === option.id ? "text-brand-orange font-bold" : "text-gray-400"
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

        {favorites.length > 0 && (
          <div className="flex justify-center gap-3">
            <button
              onClick={handleBulkUnlock}
              onMouseEnter={() => onHover({ id: 'bulk-unlock', label: '전체 잠금 해제', description: '모든 곡의 잠금을 해제합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2",
                confirmUnlockAll === 1 
                  ? "bg-brand-orange text-white animate-pulse" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Unlock className="w-3.5 h-3.5" />
              {confirmUnlockAll === 1 ? "한 번 더 클릭하여 잠금 해제" : "잠금 해제"}
            </button>
            <button
              onClick={handleBulkDelete}
              onMouseEnter={() => onHover({ id: 'bulk-delete', label: '전체 삭제', description: '잠금되지 않은 모든 곡을 삭제합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2",
                confirmDeleteAll === 1 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDeleteAll === 1 ? "한 번 더 클릭하여 전체 삭제" : "전체 삭제"}
            </button>
          </div>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center bg-zinc-900/30 rounded-3xl border border-white/5 p-12">
          <Music className="w-12 h-12 text-zinc-800 mb-4" />
          <p className="text-gray-500 text-lg font-medium">아직 저장된 곡이 없습니다.</p>
          <Link to="/" className="mt-6 text-brand-orange font-bold hover:underline">
            첫 번째 곡 만들러 가기
          </Link>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center text-center">
          <Search className="w-10 h-10 text-zinc-800 mb-4" />
          <p className="text-gray-500">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFavorites.slice(0, visibleCount).map((song) => (
              <motion.div
                key={song.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-800/50 border border-white/15 rounded-3xl p-6 hover:bg-zinc-700/50 transition-all group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14.4px] font-bold text-white leading-tight">
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
                    <span className="text-[10px] text-gray-500 font-medium opacity-60">
                      {getRelativeTime(song.createdAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleToggleLock(song)}
                        onMouseEnter={() => onHover({ id: `lock-${song.id}`, label: song.isLocked ? '잠금 해제' : '잠금', description: song.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                        onMouseLeave={() => onHover(null)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          song.isLocked ? "bg-brand-orange/20 text-brand-orange" : "bg-white/5 text-gray-500 hover:bg-white/10"
                        )}
                      >
                        {song.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => toggleFavorite(song)}
                        disabled={song.isLocked}
                        onMouseEnter={() => onHover({ id: `delete-${song.id}`, label: '삭제', description: song.isLocked ? '잠긴 곡은 삭제할 수 없습니다.' : '이 곡을 목록에서 삭제합니다.' })}
                        onMouseLeave={() => onHover(null)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          song.isLocked 
                            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                            : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col flex-grow space-y-4">
                  <div className="flex flex-wrap gap-1.5 overflow-hidden">
                    {song.appliedKeywords.genre.map((g: string) => (
                      <span key={g} className="text-[8px] px-2 py-0.5 rounded-md bg-white/5 text-gray-500 whitespace-nowrap">#{g}</span>
                    ))}
                    {song.appliedKeywords.mood.map((m: string) => (
                      <span key={m} className="text-[8px] px-2 py-0.5 rounded-md bg-white/5 text-gray-500 whitespace-nowrap">#{m}</span>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button 
                      onClick={() => setSelectedSong(song)}
                      onMouseEnter={() => onHover({ id: `view-${song.id}`, label: '상세보기', description: '곡의 가사와 상세 정보를 확인합니다.' })}
                      onMouseLeave={() => {
                        onHover(null);
                        onLongPressEnd();
                      }}
                      onTouchStart={() => onLongPressStart({ id: `view-${song.id}`, label: '상세보기', description: '곡의 가사와 상세 정보를 확인합니다.' })}
                      onTouchEnd={onLongPressEnd}
                      className="flex-[4] py-3 rounded-xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all"
                    >
                      상세보기
                    </button>
                    <button 
                      onClick={() => copyAll(song)}
                      onMouseEnter={() => onHover({ id: `copy-all-${song.id}`, label: '곡 정보 모두 복사', description: '제목, 가사, 프롬프트 등 모든 정보를 복사합니다.' })}
                      onMouseLeave={() => {
                        onHover(null);
                        onLongPressEnd();
                      }}
                      onTouchStart={() => onLongPressStart({ id: `copy-all-${song.id}`, label: '곡 정보 모두 복사', description: '제목, 가사, 프롬프트 등 모든 정보를 복사합니다.' })}
                      onTouchEnd={onLongPressEnd}
                      className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center group/copy border border-brand-orange/20"
                    >
                      {copiedType === `all-${song.id}` ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 group-hover/copy:scale-110 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {visibleCount < filteredFavorites.length && (
            <div className="flex justify-center pt-8">
              <button
                onClick={() => setVisibleCount(prev => prev + 9)}
                onMouseEnter={() => onHover({ id: 'load-more', label: '더보기', description: '곡을 9개 더 불러옵니다.' })}
                onMouseLeave={() => onHover(null)}
                className="px-8 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all border border-white/10 flex items-center gap-2 group"
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
              onClick={() => setSelectedSong(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-800 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/10 bg-zinc-700/30 relative flex flex-col items-center">
                <button 
                  onClick={() => setSelectedSong(null)} 
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-gray-400 transition-colors z-10"
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
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                        >
                          {copiedType === 'title' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <input 
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full bg-black/30 border border-brand-orange/30 rounded-xl px-4 py-3 text-white font-bold text-xl focus:outline-none"
                      />
                    ) : (
                      <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                          {isTitleExpanded && (
                            <motion.h2 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-[19px] font-bold text-white leading-tight text-left w-full overflow-hidden"
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
                        onClick={() => handleToggleLock(selectedSong)}
                        onMouseEnter={() => onHover({ id: 'popup-lock', label: selectedSong.isLocked ? '잠금 해제' : '잠금', description: selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: 'popup-lock', label: selectedSong.isLocked ? '잠금 해제' : '잠금', description: selectedSong.isLocked ? '이 곡의 잠금을 해제합니다.' : '이 곡을 삭제되지 않도록 잠급니다.' })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedSong.isLocked 
                            ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30" 
                            : "bg-transparent text-white border-white hover:bg-white/10"
                        )}
                      >
                        {selectedSong.isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
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
                        className="px-6 py-3 rounded-2xl bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-all flex items-center gap-2 text-sm font-bold border border-brand-orange/20"
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
                          className="px-6 py-3 rounded-2xl bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-white/10"
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
                        className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-black tracking-tighter hover:scale-110 transition-all bg-transparent"
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
                          className="px-6 py-3 rounded-xl bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-white/10"
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
                        className="px-8 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-bold hover:bg-white/10 transition-all"
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
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center text-brand-orange hover:text-white hover:bg-brand-orange transition-all z-20 shadow-xl"
                  >
                    {isTitleExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                )}
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                {/* Keywords & Tempo */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 relative">
                  {!isEditing && (
                    <div className="absolute top-4 right-4">
                      <button 
                        onClick={() => copyToClipboard([...selectedSong.appliedKeywords.genre, ...selectedSong.appliedKeywords.mood, ...selectedSong.appliedKeywords.theme].join(', '), 'keywords')}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 transition-colors"
                      >
                        {copiedType === 'keywords' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[...selectedSong.appliedKeywords.genre, ...selectedSong.appliedKeywords.mood, ...selectedSong.appliedKeywords.theme].map((k: string) => (
                      <span key={k} className="px-2 py-1 rounded-lg bg-brand-orange/10 text-brand-orange text-[10px] font-bold">#{k}</span>
                    ))}
                  </div>
                  {selectedSong.appliedKeywords.tempo && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-sans">
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
                                : "bg-white/5 text-gray-500 border-white/10"
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
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                        >
                          {copiedType === 'lyrics-korean' ? <Check className="w-8 h-8 text-green-500" /> : <Copy className="w-8 h-8" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        value={editedKoreanLyrics}
                        onChange={(e) => setEditedKoreanLyrics(e.target.value)}
                        className="w-full h-48 bg-black/30 border border-brand-orange/30 rounded-xl p-4 text-white text-sm focus:outline-none custom-scrollbar"
                      />
                    ) : (
                      <p 
                        className="text-base text-white leading-6 whitespace-pre-wrap font-normal"
                        style={{ fontFamily: 'Arial, sans-serif' }}
                      >
                        {selectedSong.lyrics.korean}
                      </p>
                    )}
                  </div>
                  <div className="pt-8 border-t border-white/5">
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
                                : "bg-white/5 text-gray-500 border-white/10"
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
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                        >
                          {copiedType === 'lyrics-english' ? <Check className="w-8 h-8 text-green-500" /> : <Copy className="w-8 h-8" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        value={editedEnglishLyrics}
                        onChange={(e) => setEditedEnglishLyrics(e.target.value)}
                        className="w-full h-48 bg-black/30 border border-brand-orange/30 rounded-xl p-4 text-gray-400 text-sm focus:outline-none italic custom-scrollbar"
                      />
                    ) : (
                      <p 
                        className="text-base text-gray-400 leading-6 whitespace-pre-wrap font-normal"
                        style={{ fontFamily: 'Arial, sans-serif' }}
                      >
                        {selectedSong.lyrics.english}
                      </p>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <div className="pt-8 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-brand-orange font-bold text-[18px] uppercase tracking-widest"> 곡 프롬프트 Styles </h3>
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
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                      >
                        {copiedType === 'prompt' ? <Check className="w-8 h-8 text-green-500" /> : <Copy className="w-8 h-8" />}
                      </button>
                    )}
                  </div>
                  <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-gray-500 font-sans leading-relaxed">
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
