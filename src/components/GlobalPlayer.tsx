import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Volume2, VolumeX, ChevronDown, ChevronUp, Star, Music, X, MoreHorizontal, Info, Download, Share2, Trash2
} from 'lucide-react';
import { useGlobalPlayer } from '../contexts/GlobalPlayerContext';
import { auth, db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

  const [mode, setMode] = useState<'collapsed' | 'normal' | 'expanded'>('normal');
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const playerRef = useRef<HTMLDivElement>(null);

  const getClampedPosition = (x: number, y: number) => {
    const minVisible = 80;
    
    let width = 384; 
    let height = 100;
    if (playerRef.current) {
      width = playerRef.current.offsetWidth;
      height = playerRef.current.offsetHeight;
    }

    const minX = -(window.innerWidth - minVisible); 
    const maxX = Math.max(16, width - minVisible); 
    const minY = -(window.innerHeight - minVisible);
    const maxY = Math.max(16, height - minVisible);

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setPosition(prev => {
        const minVisible = 80;
        let width = playerRef.current?.offsetWidth || 384;
        let height = playerRef.current?.offsetHeight || 100;
        const minX = -(window.innerWidth - minVisible); 
        const maxX = Math.max(16, width - minVisible); 
        const minY = -(window.innerHeight - minVisible);
        const maxY = Math.max(16, height - minVisible);
        return {
          x: Math.max(minX, Math.min(prev.x, maxX)),
          y: Math.max(minY, Math.min(prev.y, maxY))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      const saved = localStorage.getItem('global_player_pos');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Wait for next tick so ref has dimensions
          setTimeout(() => setPosition(getClampedPosition(parsed.x, parsed.y)), 0);
        } catch (e) {}
      }
    }
    const savedMode = localStorage.getItem('soridraw_global_player_mode');
    if (savedMode === 'collapsed' || savedMode === 'normal' || savedMode === 'expanded') {
      setMode(savedMode as 'collapsed' | 'normal' | 'expanded');
      if (savedMode === 'expanded') {
         enforceStrictViewportClamp();
      }
    }
  }, []);

  const enforceStrictViewportClamp = () => {
    if (window.innerWidth < 768) return;
    setTimeout(() => {
      if (!playerRef.current) return;
      setPosition(prev => {
        const width = playerRef.current!.offsetWidth;
        const height = playerRef.current!.offsetHeight;
        const newY = Math.max(32 + height - window.innerHeight, Math.min(prev.y, 0));
        const newX = Math.max(48 + width - window.innerWidth, Math.min(prev.x, 16));
        return { x: newX, y: newY };
      });
    }, 100);
  };

  const handleModeChange = (newMode: 'collapsed' | 'normal' | 'expanded') => {
    setMode(newMode);
    localStorage.setItem('soridraw_global_player_mode', newMode);
    if (newMode === 'expanded') {
      enforceStrictViewportClamp();
    }
  };



  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Untitled',
        artist: "SORIDRAW's Studio",
        album: currentTrack.parent?.style || currentTrack.parent?.prompt || 'Suno Library',
        artwork: [
           { src: currentTrack.imageUrl || currentTrack.parent?.imageUrl || currentTrack.parent?.image_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=512&auto=format&fit=crop', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
         if (audioRef.current) audioRef.current.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
         if (audioRef.current) audioRef.current.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
         if (audioRef.current) audioRef.current.currentTime = Math.max(audioRef.current.currentTime - (details.seekOffset || 10), 0);
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
         if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.currentTime + (details.seekOffset || 10), duration);
      });
    }
  }, [currentTrack, playNext, playPrev, audioRef, duration]);

  const handleDownload = (url: string) => {
    if (!url) {
      alert('아직 다운로드할 음원이 없습니다.');
      return;
    }
    window.open(url, '_blank');
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

  const handleApplyNext = () => {
    if (!currentTrack) return;
    const group = currentTrack.parent || {};
    const data = {
      title: currentTrack.title || group.title,
      lyrics: group.lyrics,
      prompt: group.prompt,
      keywords: group.tags || group.style,
      genre: group.style || group.tags,
      taskId: group.taskId,
      source: 'suno-library'
    };
    localStorage.setItem('soridraw_next_suno_apply', JSON.stringify(data));
    alert('다음 곡에 적용할 정보가 저장되었습니다.');
  };

  const handleSavePlaylist = () => {
    if (!currentTrack) return;
    const group = currentTrack.parent || {};
    const data = {
      title: currentTrack.title || group.title,
      url: currentTrack.url,
      source: 'suno-library',
      groupId: group.id
    };
    localStorage.setItem('soridraw_playlists_pending', JSON.stringify(data));
    alert('플레이리스트 저장 준비가 완료되었습니다.');
  };

  const handleDelete = () => {
    alert('삭제 기능은 라이브러리 화면에서 이용 가능합니다.');
  };

  const handleDragStart = () => {
    isDragging.current = true;
  };

  const handleDragEnd = (e: any, info: any) => {
    if (isSharedPlayerMode || isMobile) return;
    setTimeout(() => { isDragging.current = false; }, 100);

    let newX = position.x + info.offset.x;
    let newY = position.y + info.offset.y;
    
    const newPos = getClampedPosition(newX, newY);
    setPosition(newPos);
    localStorage.setItem('global_player_pos', JSON.stringify(newPos));
  };

  if (!currentTrack) return null;

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <style>{`
        @keyframes sunoMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <audio 
        ref={audioRef}
        className="hidden" 
        src={currentTrack.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
      />

      <motion.div
        layout
        transition={{ 
          type: 'spring', 
          bounce: 0.1, 
          duration: 0.35,
        }}
        ref={playerRef}
        drag={isSharedPlayerMode || isMobile ? false : true}
        dragConstraints={{
          left: -(typeof window !== 'undefined' ? window.innerWidth : 1000) - 80,
          right: Math.max(16, (playerRef.current?.offsetWidth || 384) - 80),
          top: -(typeof window !== 'undefined' ? window.innerHeight : 1000) - 80,
          bottom: Math.max(16, (playerRef.current?.offsetHeight || 100) - 80)
        }}
        dragElastic={0.2}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        initial={false}
        animate={{ 
          x: isSharedPlayerMode || isMobile
            ? '-50%'
            : position.x,
          y: isSharedPlayerMode || isMobile
            ? (mode === 'expanded' ? '-50%' : 0)
            : position.y
        }}
        className={`fixed z-[100] flex flex-col ${
          isSharedPlayerMode || isMobile
            ? (mode === 'expanded' ? 'top-1/2 left-1/2 w-[calc(100vw-24px)] max-w-[430px]' : 'bottom-[12px] left-1/2 w-[calc(100vw-24px)] max-w-[420px] items-center')
            : (mode === 'expanded' ? 'bottom-4 right-3 md:left-auto md:right-8 items-end w-full md:w-auto' : 'bottom-4 right-4 md:left-auto md:right-8 items-end w-full md:w-auto')
        }`}
        style={{ touchAction: 'none' }}
      >
        <AnimatePresence mode="popLayout">
          {mode === 'collapsed' && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                 if (!isDragging.current) {
                    handleModeChange('normal');
                 }
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
                 if (!isDragging.current) {
                    handleModeChange('expanded');
                 }
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
                   <p className="text-[10px] opacity-50 truncate">{currentTrack.parent?.style || currentTrack.parent?.prompt || 'Music'}</p>
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
                  className="absolute inset-0 bg-cover bg-center opacity-10 blur-xl saturate-200 pointer-events-none"
                  style={{ backgroundImage: `url(${currentTrack.imageUrl})` }}
                />
              ) : (
                 <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/10 to-purple-500/10 opacity-20 blur-xl pointer-events-none" />
              )}

              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
                 <div className="relative">
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
                           { icon: Info, label: '상세정보', action: () => { alert('상세정보는 라이브러리 목록에서 확인해주세요.'); setShowMenu(false); } },
                           !isSharedPlayerMode ? { icon: Download, label: '다운로드', action: () => { handleDownload(currentTrack.url); setShowMenu(false); } } : null,
                           !isSharedPlayerMode ? { icon: Music, label: '다음곡에 적용', action: () => { handleApplyNext(); setShowMenu(false); } } : null,
                           { icon: Share2, label: isSharedPlayerMode ? '링크 복사' : '공유', action: () => { isSharedPlayerMode ? handleCopyShareLink() : handleShare(); setShowMenu(false); } },
                           { icon: Star, label: '플레이리스트 저장', action: () => { handleSavePlaylist(); setShowMenu(false); } },
                           !isSharedPlayerMode ? { icon: Trash2, label: '삭제', action: () => { handleDelete(); setShowMenu(false); }, danger: true } : null,
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

              <div className="w-full aspect-square mt-8 mb-6 shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-black/40 border border-white/5 flex items-center justify-center relative z-10">
                 {currentTrack.imageUrl ? (
                    <img src={currentTrack.imageUrl} alt={currentTrack.title} draggable={false} onDragStart={(e) => e.preventDefault()} className="w-full h-full object-cover" />
                 ) : (
                    <Music className="w-20 h-20 text-white/20" />
                 )}
              </div>

              <div className="relative z-10 flex-1 flex flex-col w-full min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                   <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                     <ScrollText text={currentTrack.title || 'Untitled Track'} className="text-xl font-bold leading-tight" />
                   </div>
                   <button onClick={() => alert('즐겨찾기는 준비 중입니다.')} className="text-white/40 hover:text-brand-orange shrink-0">
                      <Star className="w-5 h-5" />
                   </button>
                </div>
                <p className="text-sm opacity-60 mb-6 truncate">{currentTrack.parent?.style || currentTrack.parent?.prompt || 'No Genre Info'}</p>

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
    </>
  );
}
