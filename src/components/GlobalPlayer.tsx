import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Volume2, VolumeX, ChevronDown, Star, Music, X, MoreHorizontal, Info, Download, Share2, Trash2
} from 'lucide-react';
import { useGlobalPlayer } from '../contexts/GlobalPlayerContext';

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
    clearPlayer
  } = useGlobalPlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('global_player_pos');
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

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
      alert('다운로드 링크를 찾을 수 없습니다.');
      return;
    }
    window.open(url, '_blank');
  };

  const handleShare = async (url: string) => {
    if (!url) {
       alert('공유할 주소가 없습니다.');
       return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Suno Music',
          url: url
        });
      } catch (e) {
        console.log('Share failed', e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('공유 링크를 복사했습니다.');
      } catch (e) {
        alert('링크 복사에 실패했습니다.');
      }
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
    setTimeout(() => { isDragging.current = false; }, 100);
    const newPos = { 
      x: position.x + info.offset.x, 
      y: position.y + info.offset.y 
    };
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
        drag
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        initial={false}
        animate={{ x: position.x, y: position.y }}
        className={`fixed z-[100] ${isExpanded ? 'bottom-4 right-4 md:right-8' : 'bottom-4 right-4 left-4 md:left-auto md:right-8'} flex flex-col items-end`}
        style={{ touchAction: 'none' }}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="mini"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                 if (!isDragging.current) setIsExpanded(true);
              }}
              className="w-full md:w-96 bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-2xl p-3 shadow-2xl flex items-center gap-3 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/40 flex items-center justify-center border border-white/5 relative">
                 {currentTrack.imageUrl ? (
                    <img src={currentTrack.imageUrl} alt={currentTrack.title} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''} rounded-full absolute inset-1 w-10 h-10`} />
                 ) : (
                    <Music className="w-6 h-6 text-white/30" />
                 )}
              </div>
              
              <div className="flex-1 min-w-0">
                 <h3 className="font-bold text-sm truncate">{currentTrack.title || 'Untitled'}</h3>
                 <p className="text-[10px] opacity-50 truncate">{currentTrack.parent?.style || currentTrack.parent?.prompt || 'Music'}</p>
              </div>

              <div className="flex items-center gap-2">
                 <button 
                    onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shrink-0"
                 >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); playNext(); }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                 >
                    <SkipForward className="w-5 h-5 fill-current" />
                 </button>
                 <div className="w-px h-6 bg-white/10 mx-1"></div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); clearPlayer(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
                 >
                    <X className="w-4 h-4" />
                 </button>
              </div>

              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/10 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-brand-orange transition-all duration-300" 
                   style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                 />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full md:w-[400px] bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col pt-6 pb-8 px-6 relative"
            >
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
                           { icon: Download, label: '다운로드', action: () => { handleDownload(currentTrack.url); setShowMenu(false); } },
                           { icon: Music, label: '다음곡에 적용', action: () => { handleApplyNext(); setShowMenu(false); } },
                           { icon: Share2, label: '공유', action: () => { handleShare(currentTrack.url || window.location.href); setShowMenu(false); } },
                           { icon: Star, label: '플레이리스트 저장', action: () => { handleSavePlaylist(); setShowMenu(false); } },
                           { icon: Trash2, label: '삭제', action: () => { handleDelete(); setShowMenu(false); }, danger: true },
                         ].map((m, i) => (
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
                    onClick={() => setIsExpanded(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"
                 >
                    <ChevronDown className="w-6 h-6" />
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
                    <img src={currentTrack.imageUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                 ) : (
                    <Music className="w-20 h-20 text-white/20" />
                 )}
              </div>

              <div className="relative z-10 flex-1 flex flex-col w-full">
                <div className="flex items-center justify-between gap-4 mb-1">
                   <h2 className="text-xl font-bold leading-tight truncate">{currentTrack.title || 'Untitled Track'}</h2>
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
