import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Volume2, VolumeX, ChevronDown, ChevronUp, Star, Music, X, MoreHorizontal, Info, Download, Share2, Trash2, FolderOutput
} from 'lucide-react';
import { useGlobalPlayer } from '../contexts/GlobalPlayerContext';
import { auth, db } from '../firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureDefaultPlaylists, getPlaylistsByType, addPlaylistItem } from '../services/playlistService';
import { downloadAudioWithTitle } from '../lib/songUtils';
import SunoTrackDetailModal from './SunoTrackDetailModal';

function ScrollText({ text, className = '' }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (containerRef.current && textRef.current) {
        setNeedsScroll(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap flex relative items-center w-full ${className}`}>
      {needsScroll ? (
        <div className="flex shrink-0 w-max animate-[sunoMarquee_10s_linear_infinite]">
          <span className="pr-12 shrink-0">{text}</span>
          <span className="pr-12 shrink-0">{text}</span>
        </div>
      ) : (
        <span ref={textRef} className="truncate w-full block">{text}</span>
      )}
    </div>
  );
}



function toNonEmptyString(value: any): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getTrackArtistDisplay(track: any): string {
  const group = track?.parent || {};
  const user = auth.currentUser;
  const candidates = [
    track?.artist,
    track?.creatorDisplayId,
    track?.ownerNickname,
    track?.creatorNickname,
    track?.creatorName,
    track?.ownerName,
    track?.ownerDisplayName,
    track?.createdByName,
    track?.userName,
    group.artist,
    group.artistName,
    group.author,
    group.uploaderName,
    group.creatorDisplayId,
    group.ownerNickname,
    group.creatorNickname,
    group.ownerName,
    group.creatorName,
    group.ownerDisplayName,
    group.createdByName,
    group.userName,
    group.shareData?.creatorDisplayId,
    group.shareData?.ownerNickname,
    group.shareData?.creatorNickname,
    group.shareData?.ownerName,
    group.shareData?.creatorName,
    group.ownerEmail,
    group.creatorEmail,
    group.createdByEmail,
    track?.ownerEmail,
    track?.creatorEmail,
  ];

  for (const item of candidates) {
    const text = toNonEmptyString(item);
    if (!text) continue;
    if (text.startsWith('·GENRE:') || text.startsWith('GENRE:')) continue;
    const ownerUid = String(group.ownerUid || track?.ownerUid || group.uid || track?.uid || '');
    if (ownerUid && text === ownerUid) continue;
    if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) continue;
    return text;
  }

  const ownerUid = String(group.ownerUid || track?.ownerUid || group.uid || track?.uid || '');
  if (!ownerUid || (user?.uid && ownerUid === user.uid)) {
    const fallback = toNonEmptyString(user?.displayName) || toNonEmptyString(user?.email);
    if (fallback) return fallback;
  }

  return '원곡자 정보 없음';
}

function getLyricsText(track: any): string {
  const group = track?.parent || {};
  const candidates = [track?.lyrics, group.lyrics, group.lyricsText, group.lyric, group.promptLyrics];

  for (const value of candidates) {
    if (!value) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();

    if (typeof value === 'object') {
      const preferredKeys = ['korean', 'ko', 'english', 'en', 'japanese', 'ja', 'chinese', 'zh', 'spanish', 'es', 'french', 'fr'];
      for (const key of preferredKeys) {
        const text = toNonEmptyString(value[key]);
        if (text) return text;
      }
      for (const entry of Object.values(value)) {
        const text = toNonEmptyString(entry);
        if (text) return text;
      }
    }
  }

  return '';
}

function normalizeLyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLyricSectionLine(line: string): boolean {
  // Section labels must not be treated as singable lyric lines.
  // Supports [Verse 1], [Chorus / Drop], (Verse 1), and minor spacing/case variations.
  const normalized = line.trim().toLowerCase();
  if (/^[\[(]\s*(intro|verse|pre[-\s]?chorus|chorus|hook|drop|bridge|rap|rap verse|breakdown|instrumental|solo|final chorus|outro)[^\])]*[\])]$/.test(normalized)) {
    return true;
  }
  return /^\[[^\]]+\]$/.test(normalized) && /intro|verse|chorus|hook|drop|bridge|rap|breakdown|instrumental|solo|outro/.test(normalized);
}

function getApproxActiveLyricIndex(lines: string[], currentTime: number, duration: number): number {
  if (!lines.length || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime) || currentTime <= 0) return -1;

  const singableLineIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isLyricSectionLine(line));

  if (!singableLineIndexes.length) return -1;

  const ratio = Math.min(0.999, Math.max(0, currentTime / duration));
  const activeOrdinal = Math.floor(ratio * singableLineIndexes.length);
  return singableLineIndexes[activeOrdinal]?.index ?? -1;
}

export default function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    audioRef,
    togglePlayPause,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    seek,
    setIsShuffle,
    setRepeatMode,
    handleTimeUpdate,
    handleEnded,
    setIsPlaying,
    clearPlayer,
    isSharedPlayerMode
  } = useGlobalPlayer();

  const navigate = useNavigate();
  const [mode, setMode] = useState<'collapsed' | 'normal' | 'expanded'>('normal');
  const [showMenu, setShowMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [localDetailsOpen, setLocalDetailsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const playerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const lyricAutoScrollFrameRef = useRef<number | null>(null);
  const lyricTargetScrollTopRef = useRef(0);
  const lyricSmoothScrollTopRef = useRef(0);
  const lyricMetricsRef = useRef({ ready: false, singableStart: 0, singableEnd: 0, maxScroll: 0 });
  const latestPlaybackRef = useRef({ currentTime: 0, duration: 0 });
  const lyricUserPauseRef = useRef(false);
  const lyricResumeTimeoutRef = useRef<number | null>(null);
  const [lyricAutoScrollResumeTick, setLyricAutoScrollResumeTick] = useState(0);
  const mobileExpandedHistoryPushedRef = useRef(false);
  const [localFavoriteActive, setLocalFavoriteActive] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setShowLyrics(false);
  }, [currentTrack?.url, currentTrack?.title]);

  useEffect(() => {
    setLocalFavoriteActive(Boolean((currentTrack as any)?.favorite || currentTrack?.parent?.favorite));
  }, [currentTrack?.url, currentTrack?.title, (currentTrack as any)?.favorite, currentTrack?.parent?.favorite]);

  useEffect(() => {
    const handleFavoriteChanged = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const changedTrackId = String(detail.trackId || detail.sourceId || '');
      const changedPlaylistItemId = String(detail.playlistItemId || '');
      const parent = currentTrack?.parent || {};
      const currentIds = [
        parent.id,
        parent.trackId,
        parent.sourceId,
        parent.taskId,
        (currentTrack as any)?.trackId,
        (currentTrack as any)?.sourceId,
        (currentTrack as any)?.id,
      ].filter(Boolean).map(String);

      const matched =
        (changedTrackId && currentIds.includes(changedTrackId)) ||
        (changedPlaylistItemId && currentIds.includes(changedPlaylistItemId));

      if (!matched) return;
      const next = Boolean(detail.favorite);
      setLocalFavoriteActive(next);
      if (currentTrack) {
        (currentTrack as any).favorite = next;
        if (currentTrack.parent) {
          (currentTrack.parent as any).favorite = next;
        }
      }
    };

    window.addEventListener('soridraw:suno-favorite-changed', handleFavoriteChanged as EventListener);
    return () => window.removeEventListener('soridraw:suno-favorite-changed', handleFavoriteChanged as EventListener);
  }, [currentTrack]);

  useEffect(() => {
    if (!isMobile || mode !== 'expanded') {
      mobileExpandedHistoryPushedRef.current = false;
      return;
    }

    if (!mobileExpandedHistoryPushedRef.current) {
      window.history.pushState({ soridrawPlayerExpanded: true }, '');
      mobileExpandedHistoryPushedRef.current = true;
    }

    const handlePopState = () => {
      if (mobileExpandedHistoryPushedRef.current) {
        mobileExpandedHistoryPushedRef.current = false;
        handleModeChange('normal');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile, mode]);

  const pauseLyricAutoScroll = () => {
    lyricUserPauseRef.current = true;
    if (lyricResumeTimeoutRef.current) {
      window.clearTimeout(lyricResumeTimeoutRef.current);
    }
    lyricResumeTimeoutRef.current = window.setTimeout(() => {
      if (lyricScrollRef.current) {
        lyricSmoothScrollTopRef.current = lyricScrollRef.current.scrollTop;
      }
      lyricUserPauseRef.current = false;
      setLyricAutoScrollResumeTick((value) => value + 1);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (lyricAutoScrollFrameRef.current) {
        cancelAnimationFrame(lyricAutoScrollFrameRef.current);
      }
      if (lyricResumeTimeoutRef.current) {
        window.clearTimeout(lyricResumeTimeoutRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (!localDetailsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLocalDetailsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localDetailsOpen]);

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setShowMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMenu(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  useEffect(() => {
    const savedMode = localStorage.getItem('soridraw_global_player_mode');
    if (savedMode === 'collapsed' || savedMode === 'normal' || savedMode === 'expanded') {
      setMode(savedMode as 'collapsed' | 'normal' | 'expanded');
    }
  }, []);

  const handleModeChange = (newMode: 'collapsed' | 'normal' | 'expanded') => {
    setMode(newMode);
    localStorage.setItem('soridraw_global_player_mode', newMode);
  };




  const handleDownload = (url: string, title?: string) => {
    if (!url) {
      alert('아직 다운로드할 음원이 없습니다.');
      return;
    }
    downloadAudioWithTitle(url, title);
  };

  const handleCopyShareLink = async () => {
    if (!currentTrack?.parent?.id) return;
    const shareUrl = `${window.location.origin}/suno-library?track=${currentTrack.parent.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('링크 복사를 완료했습니다.');
    } catch (e) {
      console.error(e);
      alert('링크 복사에 실패했습니다.');
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    
    try {
      const group = currentTrack.parent || {};
      const user = auth.currentUser;
      
      if (user && group.id) {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
        await updateDoc(trackRef, {
          isPublic: true,
          hidden: false,
          shareType: 'public',
          publicSharedAt: serverTimestamp()
        });

        // Create a snapshot in suno_shares for robust sharing
        const shareRef = doc(db, 'suno_shares', group.id);
        await setDoc(shareRef, {
          trackId: group.id,
          taskId: group.taskId || '',
          title: currentTrack.title || group.title || 'Untitled',
          audioUrl: currentTrack.url,
          imageUrl: currentTrack.imageUrl || '',
          duration: currentTrack.duration || group.duration || null,
          status: group.status || 'completed',
          prompt: group.prompt || '',
          style: group.style || '',
          lyrics: group.lyrics || group.lyricsText || currentTrack.lyrics || null,
          sunoData: group.sunoData || null,
          apiResponse: group.apiResponse || null,
          apiStatusResponse: group.apiStatusResponse || null,
          appliedKeywords: group.appliedKeywords || {},
          createdAt: group.createdAt || serverTimestamp(),
          ownerUid: user.uid,
          isPublic: true
        });
      }
      
      const shareUrl = `${window.location.origin}/suno-library?track=${group.id || ''}`;
      const title = `SORIDRAW Music - ${currentTrack.title || group.title || 'Untitled'}`;
      const text = `SORIDRAW에서 만든 음악을 들어보세요.`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: title,
            text: text,
            url: shareUrl
          });
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            await navigator.clipboard.writeText(shareUrl);
            alert('공개 공유 링크를 복사했습니다.');
          }
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('공유 링크를 복사했습니다.');
      }
    } catch (e) {
      console.error('Error sharing:', e);
      alert('공유 처리 중 오류가 발생했습니다.');
    }
  };

  const isPlaylistTrack = Boolean(
    currentTrack?.parent?.__playlistContext ||
    (currentTrack as any)?.trackId ||
    currentTrack?.parent?.sourceType
  );

  const isFavoriteActive = Boolean(localFavoriteActive || (currentTrack as any)?.favorite || currentTrack?.parent?.favorite);

  const markCurrentTrackFavorite = (next: boolean) => {
    setLocalFavoriteActive(next);
    if (currentTrack) {
      (currentTrack as any).favorite = next;
      if (currentTrack.parent) {
        (currentTrack.parent as any).favorite = next;
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentTrack || isSharedPlayerMode) return;

    const next = !isFavoriteActive;

    if (dispatchLibraryAction('favorite')) {
      markCurrentTrackFavorite(next);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const parent = currentTrack.parent || {};

    if (isPlaylistTrack) {
      alert('플레이리스트 곡의 즐겨찾기 변경은 라이브러리 화면에서 이용해주세요.');
      return;
    }

    const trackId = parent.id || parent.trackId || parent.taskId;
    if (!trackId) {
      alert('즐겨찾기 정보를 저장할 곡 ID를 찾을 수 없습니다.');
      return;
    }

    try {
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', String(trackId));
      await updateDoc(trackRef, {
        favorite: next,
        favoriteUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      markCurrentTrackFavorite(next);
      alert(next ? '즐겨찾기에 저장되었습니다.' : '즐겨찾기에서 제외되었습니다.');
    } catch (error) {
      console.error('Global player favorite update failed:', error);
      alert('즐겨찾기 변경에 실패했습니다.');
    }
  };

  const dispatchLibraryAction = (action: 'details' | 'applyNext' | 'saveOrMove' | 'delete' | 'favorite') => {
    if (!currentTrack || typeof window === 'undefined') return false;
    const detail: any = { action, track: currentTrack, handled: false };
    window.dispatchEvent(new CustomEvent('soridraw:global-player-action', { detail }));
    return Boolean(detail.handled);
  };

  const handleShowDetails = () => {
    if (dispatchLibraryAction('details')) return;
    setLocalDetailsOpen(true);
  };

  const handleApplyNext = () => {
    if (dispatchLibraryAction('applyNext')) return;
    if (!currentTrack) return;
    const group = currentTrack.parent || {};

    const appliedKeywords = group.appliedKeywords;
    
    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      alert('이 곡은 키워드 정보가 없어 적용할 수 없습니다.');
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem('pendingAppliedKeywords', serialized);
    localStorage.setItem('pendingAppliedKeywordsBackup', serialized);

    if (!auth.currentUser) {
      if (confirm('로그인 후 다음 곡에 설정이 적용됩니다. 로그인 화면으로 이동할까요?')) {
        handleModeChange('collapsed');
        navigate('/');
      }
      return;
    }

    alert('다음 곡에 곡 설정이 복원되었습니다. 홈으로 이동합니다.');
    handleModeChange('collapsed');
    navigate('/?applyPending=1');
  };

  const handleSaveOrMovePlaylist = async () => {
    if (dispatchLibraryAction('saveOrMove')) return;
    if (!currentTrack) return;
    if (isPlaylistTrack) {
      alert('폴더 이동은 라이브러리 화면에서 이용 가능합니다.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const group = currentTrack.parent || {};
    try {
      await ensureDefaultPlaylists(user.uid);
      const lists = await getPlaylistsByType(user.uid, 'normal');
      const targetPlaylist = lists.find((p: any) => p?.id && !p?.isFallback) || lists[0];

      if (!targetPlaylist?.id || (targetPlaylist as any).isFallback) {
        alert('저장할 플레이리스트가 없습니다.');
        return;
      }

      const audioUrl = currentTrack.url || group.audioUrl || group.streamAudioUrl || '';
      if (!audioUrl) {
        alert('저장할 오디오 URL이 없습니다.');
        return;
      }

      const sourceId = String(
        currentTrack.parent?.id ||
        currentTrack.parent?.taskId ||
        (currentTrack as any)?.trackId ||
        currentTrack.url ||
        `global_${Date.now()}`
      );

      const itemData: any = {
        sourceType: 'suno_track',
        sourceId,
        ownerUid: user.uid || group.ownerUid || '',
        creatorDisplayId: group.creatorDisplayId || group.ownerNickname || group.creatorNickname || group.ownerEmail || group.creatorEmail || user.displayName || user.email || '',
        ownerNickname: group.ownerNickname || user.displayName || '',
        creatorNickname: group.creatorNickname || user.displayName || '',
        ownerEmail: group.ownerEmail || user.email || '',
        creatorEmail: group.creatorEmail || user.email || '',
        title: currentTrack.title || group.title || 'Untitled',
        audioUrl,
        imageUrl: currentTrack.imageUrl || group.imageUrl || group.image_url || null,
        duration: currentTrack.duration || group.duration || null,
        genreLabels: Array.isArray(group.genreLabels) ? group.genreLabels : [],
        appliedKeywords: group.appliedKeywords || null,
        prompt: group.prompt || '',
        style: group.style || '',
        lyrics: currentTrack.lyrics || group.lyrics || group.lyricsText || null,
        lyricsText: currentTrack.lyrics || group.lyricsText || group.lyrics || null,
        requestPayload: group.requestPayload || group.appliedKeywords || null,
        colorTag: null,
        likeCount: 0,
        order: 0,
        isUnavailable: false,
        unavailableReason: null,
      };
      Object.keys(itemData).forEach((key) => itemData[key] === undefined && delete itemData[key]);

      await addPlaylistItem(user.uid, targetPlaylist.id, itemData);
      alert(`'${targetPlaylist.title}' 플레이리스트에 저장되었습니다.`);
    } catch (error: any) {
      console.error('Global player playlist save failed:', error);
      alert(error?.message === 'DUPLICATE' ? '이미 이 플레이리스트에 저장된 곡입니다.' : '플레이리스트 저장에 실패했습니다.');
    }
  };

  const handleDelete = () => {
    if (dispatchLibraryAction('delete')) return;
    alert(isPlaylistTrack ? '리스트 삭제는 라이브러리 화면에서 이용 가능합니다.' : '삭제 기능은 라이브러리 화면에서 이용 가능합니다.');
  };

  const formatTime = (time: number | null | undefined) => {
    if (time === null || time === undefined || !Number.isFinite(time) || isNaN(time) || time < 0) return '--:--';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const artistDisplay = currentTrack ? getTrackArtistDisplay(currentTrack) : '';
  const lyricsText = currentTrack ? getLyricsText(currentTrack) : '';
  const lyricLines = normalizeLyricLines(lyricsText);

  useEffect(() => {
    latestPlaybackRef.current = { currentTime, duration };
  }, [currentTime, duration]);

  useEffect(() => {
    if (!showLyrics || !lyricLines.length) {
      lyricMetricsRef.current = { ready: false, singableStart: 0, singableEnd: 0, maxScroll: 0 };
      return;
    }

    let frame = 0;
    const measure = () => {
      const container = lyricScrollRef.current;
      if (!container) return;

      const singableIndexes = lyricLines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => !isLyricSectionLine(line))
        .map(({ index }) => index);

      if (!singableIndexes.length) {
        lyricMetricsRef.current = { ready: false, singableStart: 0, singableEnd: 0, maxScroll: 0 };
        return;
      }

      const firstLine = lyricLineRefs.current[singableIndexes[0]];
      const lastLine = lyricLineRefs.current[singableIndexes[singableIndexes.length - 1]];
      if (!firstLine || !lastLine) return;

      lyricMetricsRef.current = {
        ready: true,
        singableStart: firstLine.offsetTop,
        singableEnd: lastLine.offsetTop + lastLine.offsetHeight,
        maxScroll: Math.max(0, container.scrollHeight - container.clientHeight),
      };
      lyricSmoothScrollTopRef.current = container.scrollTop;
    };

    // Wait one frame so refs and layout are settled before measuring.
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [showLyrics, duration, lyricAutoScrollResumeTick, currentTrack?.id, currentTrack?.url, lyricLines.length]);

  useEffect(() => {
    if (!showLyrics) return;

    let mounted = true;
    const animate = () => {
      if (!mounted) return;
      const container = lyricScrollRef.current;

      if (container && !lyricUserPauseRef.current && lyricMetricsRef.current.ready) {
        const audioEl = audioRef?.current;
        const liveCurrentTime = audioEl && Number.isFinite(audioEl.currentTime)
          ? audioEl.currentTime
          : latestPlaybackRef.current.currentTime;
        const liveDuration = audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0
          ? audioEl.duration
          : latestPlaybackRef.current.duration;

        if (Number.isFinite(liveDuration) && liveDuration > 0) {
          const metrics = lyricMetricsRef.current;
          const ratio = Math.min(0.995, Math.max(0, liveCurrentTime / liveDuration));
          const estimatedCurrentY = metrics.singableStart + (metrics.singableEnd - metrics.singableStart) * ratio;

          // Put the estimated singing area slightly below center, closer to a natural reading position.
          const target = Math.min(
            metrics.maxScroll,
            Math.max(0, estimatedCurrentY - container.clientHeight * 0.72)
          );

          lyricTargetScrollTopRef.current = target;
          const distance = target - lyricSmoothScrollTopRef.current;

          // Keep a floating internal scroll value so tiny sub-pixel movements do not get rounded away.
          // This makes the motion feel closer to middle-mouse continuous scrolling.
          lyricSmoothScrollTopRef.current += distance * 0.028;
          container.scrollTop = lyricSmoothScrollTopRef.current;
        }
      } else if (container && lyricUserPauseRef.current) {
        lyricSmoothScrollTopRef.current = container.scrollTop;
      }

      lyricAutoScrollFrameRef.current = requestAnimationFrame(animate);
    };

    lyricAutoScrollFrameRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (lyricAutoScrollFrameRef.current) {
        cancelAnimationFrame(lyricAutoScrollFrameRef.current);
        lyricAutoScrollFrameRef.current = null;
      }
    };
  }, [showLyrics, currentTrack?.id, currentTrack?.url, audioRef]);

  if (!currentTrack) return null;

  return (
    <>
      <style>{`
        @keyframes sunoMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <motion.div
        layout
        transition={{ 
          type: 'spring', 
          bounce: 0.1, 
          duration: 0.35,
        }}
        ref={playerRef}
        initial={false}
        animate={{ 
          x: mode === 'expanded' ? (isMobile ? '-50%' : 0) : (isSharedPlayerMode || isMobile ? '-50%' : 0),
          y: mode === 'expanded' ? '-50%' : 0
        }}
        className={`fixed z-[100] flex flex-col ${
          mode === 'expanded'
            ? isMobile
              ? 'top-1/2 left-1/2 w-[calc(100vw-24px)] max-w-[430px]'
              : 'top-1/2 right-4 xl:right-10 w-[400px] max-w-[calc(100vw-32px)]'
            : isSharedPlayerMode || isMobile
            ? 'bottom-[12px] left-1/2 w-[calc(100vw-24px)] max-w-[420px] items-center'
            : 'bottom-6 right-6 w-auto items-end'
        }`}
      >
        <AnimatePresence mode="popLayout">
          {mode === 'collapsed' && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                 handleModeChange('normal');
              }}
              className="w-full bg-[var(--bg-secondary)] border border-white/10 rounded-full py-2 px-4 shadow-xl flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-black/40 flex items-center justify-center border border-white/5 relative">
                   {currentTrack.imageUrl ? (
                      <img src={currentTrack.imageUrl} alt={currentTrack.title} draggable={false} onDragStart={(e) => e.preventDefault()} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                   ) : (
                      <Music className="w-4 h-4 text-white/30" />
                   )}
                </div>
                <div className="min-w-0 pr-2 overflow-hidden max-w-[140px] md:max-w-[200px]">
                   <ScrollText text={currentTrack.title || 'Untitled'} className="font-bold text-xs" />
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 relative z-10 pointer-events-auto">
                 <button 
                    onClick={(e) => { e.stopPropagation(); playPrev(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                 >
                    <SkipBack className="w-4 h-4 fill-current" />
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shrink-0"
                 >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); playNext(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                 >
                    <SkipForward className="w-4 h-4 fill-current" />
                 </button>
              </div>
            </motion.div>
          )}

          {mode === 'normal' && (
            <motion.div
              key="normal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                 handleModeChange('expanded');
              }}
              className="w-full md:w-96 bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-2xl p-3 shadow-2xl flex flex-col cursor-pointer relative overflow-hidden"
            >
              {/* Normal mode top handle */}
              <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center z-20 pointer-events-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleModeChange('collapsed'); }}
                  className="px-4 py-1 hover:bg-white/10 rounded-b-xl transition-all text-white/40 hover:text-white/80"
                >
                  <div className="w-8 h-1 bg-white/20 rounded-full" />
                </button>
              </div>

              {/* Menu and Close buttons for Normal mode */}
              <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); clearPlayer(); }}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white/50 relative z-30 pointer-events-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 relative z-10 w-full mt-2">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/40 flex items-center justify-center border border-white/5 relative">
                   {currentTrack.imageUrl ? (
                      <img src={currentTrack.imageUrl} alt={currentTrack.title} draggable={false} onDragStart={(e) => e.preventDefault()} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                   ) : (
                      <Music className="w-6 h-6 text-white/30" />
                   )}
                </div>
                
                <div className="flex-1 min-w-0 pr-16 relative overflow-hidden">
                   <ScrollText text={currentTrack.title || 'Untitled'} className="font-bold text-sm" />
                   <p className="text-[10px] opacity-50 truncate">{artistDisplay}</p>
                </div>

                <div className="flex items-center gap-1.5 relative z-30 pointer-events-auto shrink-0 mr-1">
                   <button 
                      onClick={(e) => { e.stopPropagation(); playPrev(); }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                   >
                      <SkipBack className="w-4 h-4 fill-current" />
                   </button>
                   <button 
                      onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shrink-0"
                   >
                      {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                   </button>
                   <button 
                      onClick={(e) => { e.stopPropagation(); playNext(); }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                   >
                      <SkipForward className="w-4 h-4 fill-current" />
                   </button>
                </div>
              </div>

              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/10 rounded-full overflow-hidden pointer-events-none mt-2">
                 <div 
                   className="h-full bg-brand-orange transition-none" 
                   style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                 />
              </div>
            </motion.div>
          )}

          {mode === 'expanded' && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full md:w-[400px] max-h-[86vh] overflow-y-auto bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-3xl shadow-2xl flex flex-col pt-6 pb-8 px-6 relative scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {currentTrack.imageUrl ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-[0.06] saturate-150 pointer-events-none"
                  style={{ backgroundImage: `url(${currentTrack.imageUrl})` }}
                />
              ) : (
                 <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/10 to-purple-500/10 opacity-10 pointer-events-none" />
              )}

              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
                 <div ref={menuRef} className="relative">
                   <button 
                      onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                      className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"
                   >
                      <MoreHorizontal className="w-5 h-5" />
                   </button>
                   <AnimatePresence>
                     {showMenu && (
                       <motion.div
                         initial={{ opacity: 0, scale: 0.95, y: -10 }}
                         animate={{ opacity: 1, scale: 1, y: 0 }}
                         exit={{ opacity: 0, scale: 0.95, y: -10 }}
                         className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-2 z-30"
                       >
                       {[
                           { icon: Info, label: '상세정보', action: () => { handleShowDetails(); setShowMenu(false); } },
                           { icon: Download, label: '다운로드', action: () => { handleDownload(currentTrack.url, currentTrack.title); setShowMenu(false); } },
                           { icon: Music, label: '다음곡에 적용', action: () => { handleApplyNext(); setShowMenu(false); } },
                           { icon: Share2, label: isSharedPlayerMode ? '링크 복사' : '공유', action: () => { isSharedPlayerMode ? handleCopyShareLink() : handleShare(); setShowMenu(false); } },
                           !isSharedPlayerMode ? { icon: Star, label: isFavoriteActive ? '즐겨찾기 해제' : '즐겨찾기', action: () => { handleToggleFavorite(); setShowMenu(false); } } : null,
                           { icon: FolderOutput, label: isPlaylistTrack ? '폴더 이동' : '플레이리스트 저장', action: () => { handleSaveOrMovePlaylist(); setShowMenu(false); } },
                           !isSharedPlayerMode ? { icon: Trash2, label: isPlaylistTrack ? '리스트 삭제' : '삭제', action: () => { handleDelete(); setShowMenu(false); }, danger: true } : null,
                         ].filter(Boolean).map((m: any, i) => (
                           <button
                             key={i}
                             onClick={(e) => { e.stopPropagation(); m.action(); }}
                             className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-all
                               ${m.danger ? 'text-red-400 hover:text-red-300' : 'text-white/80 hover:text-white'}
                             `}
                           >
                             <m.icon className="w-4 h-4" />
                             {m.label}
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>

                 <button 
                    onClick={() => handleModeChange('normal')}
                    className="p-2 px-6 hover:bg-white/10 rounded-full transition-all text-white/50"
                 >
                    <div className="w-8 h-1.5 bg-white/20 rounded-full" />
                 </button>

                 <button 
                    onClick={() => clearPlayer()}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <button
                type="button"
                onClick={() => setShowLyrics((v) => !v)}
                className="w-full aspect-square mt-8 mb-6 shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-black/25 border border-white/5 flex items-center justify-center relative z-10 text-left group focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                aria-label={showLyrics ? '가사 닫기' : '가사 보기'}
              >
                 {currentTrack.imageUrl ? (
                    <img
                      src={currentTrack.imageUrl}
                      alt={currentTrack.title}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${showLyrics ? 'opacity-75' : 'opacity-100'}`}
                    />
                 ) : (
                    <Music className={`w-20 h-20 text-white/20 transition-opacity ${showLyrics ? 'opacity-20' : 'opacity-100'}`} />
                 )}

                 {showLyrics && (
                   <div className="absolute inset-0 bg-black/10" />
                 )}

                 <AnimatePresence mode="wait">
                   {showLyrics ? (
                     <motion.div
                       key="lyrics"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="absolute inset-0 z-10 flex flex-col p-4"
                     >
                       <div className="flex items-center justify-between mb-2 shrink-0">
                         <span className="text-brand-orange text-sm font-bold">가사</span>
                         <span className="text-[11px] text-white/60">다시 누르면 닫힘</span>
                       </div>

                       {lyricLines.length > 0 ? (
                         <div
                           ref={lyricScrollRef}
                           onWheel={pauseLyricAutoScroll}
                           onTouchStart={pauseLyricAutoScroll}
                           onPointerDown={pauseLyricAutoScroll}
                           className="flex-1 overflow-y-auto pr-1 space-y-1.5 text-[13px] leading-snug scrollbar-hide"
                         >
                           {lyricLines.map((line, index) => {
                             const isSection = isLyricSectionLine(line);
                             return (
                               <p
                                 key={`${line}-${index}`}
                                 ref={(el) => { lyricLineRefs.current[index] = el; }}
                                 className={`transition-colors duration-300 ${
                                   isSection
                                     ? 'text-brand-orange/90 font-bold pt-2 pb-0.5 tracking-wide text-[12px]'
                                     : 'text-white/90'
                                 }`}
                               >
                                 {line}
                               </p>
                             );
                           })}
                         </div>
                       ) : (
                         <div className="flex-1 flex items-center justify-center text-center text-white/70 text-sm leading-relaxed">
                           표시할 가사가 없습니다.
                         </div>
                       )}
                     </motion.div>
                   ) : null}
                 </AnimatePresence>
              </button>

              <div className="relative z-10 flex-1 flex flex-col w-full min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                   <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                     <ScrollText text={currentTrack.title || 'Untitled Track'} className="text-xl font-bold leading-tight" />
                   </div>
                   <button onClick={handleToggleFavorite} className={`shrink-0 transition-colors ${isFavoriteActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-white/40 hover:text-brand-orange'}`} title={isFavoriteActive ? '즐겨찾기 해제' : '즐겨찾기'}>
                      <Star className={`w-5 h-5 ${isFavoriteActive ? 'fill-yellow-400' : ''}`} />
                   </button>
                </div>
                <p className="text-sm opacity-60 mb-6 truncate">{artistDisplay}</p>

                <div className="w-full mb-6 group cursor-pointer">
                  <input 
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-orange [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 transition-all"
                    style={{
                      background: `linear-gradient(to right, #ff8200 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`
                    }}
                  />
                  <div className="flex justify-between text-[10px] font-mono opacity-50 mt-2">
                     <span>{formatTime(currentTime)}</span>
                     <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between gap-2 mb-6">
                   <button onClick={() => setIsShuffle(!isShuffle)} className={`p-2 transition-all ${isShuffle ? 'text-brand-orange' : 'text-white/40 hover:text-white/80'}`}>
                      <Shuffle className="w-5 h-5" />
                   </button>
                   <button onClick={playPrev} className="p-2 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95">
                      <SkipBack className="w-7 h-7 fill-current" />
                   </button>

                   <button onClick={togglePlayPause} className="w-16 h-16 bg-brand-orange text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-orange/20 shrink-0">
                      {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                   </button>

                   <button onClick={playNext} className="p-2 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95">
                      <SkipForward className="w-7 h-7 fill-current" />
                   </button>
                   <button 
                    onClick={() => setRepeatMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none')} 
                    className={`p-2 transition-all ${repeatMode !== 'none' ? 'text-brand-orange' : 'text-white/40 hover:text-white/80'}`}
                   >
                      {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                   </button>
                </div>

                <div className="w-full pt-4 border-t border-white/10 flex items-center gap-3 group">
                   <button onClick={toggleMute} className="text-white/50 hover:text-white">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                   </button>
                   <input 
                      type="range"
                      min={0} max={1} step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 transition-all"
                      style={{
                        background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`
                      }}
                   />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <SunoTrackDetailModal
        open={localDetailsOpen}
        track={{
          ...currentTrack,
          creatorDisplayId: artistDisplay,
          lyrics: lyricsText || currentTrack.lyrics || currentTrack.parent?.lyrics,
          style: currentTrack.parent?.style || currentTrack.parent?.prompt || currentTrack.style || currentTrack.prompt,
          status: currentTrack.parent?.status || currentTrack.status || 'Completed',
          createdAt: currentTrack.parent?.createdAt || currentTrack.createdAt,
          taskId: currentTrack.parent?.taskId || currentTrack.taskId || currentTrack.parent?.id || currentTrack.id,
          requestPayload: currentTrack.parent?.requestPayload || currentTrack.requestPayload,
          audioUrl: currentTrack.audioUrl || currentTrack.url || currentTrack.parent?.audioUrl,
          parent: currentTrack.parent,
        }}
        onClose={() => setLocalDetailsOpen(false)}
      />
    </>
  );
}
