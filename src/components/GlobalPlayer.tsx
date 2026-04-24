import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Volume2, VolumeX, X, Music, ChevronUp, ChevronDown, Star
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
    setIsPlaying
  } = useGlobalPlayer();

  const [isExpanded, setIsExpanded] = useState(false);

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

      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => setIsExpanded(true)}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-2xl p-3 shadow-2xl flex items-center gap-3 cursor-pointer group hover:bg-white/[0.05] transition-colors"
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

            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/10 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-brand-orange transition-all duration-300" 
                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
               />
            </div>
          </motion.div>
        )}

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-4 right-4 left-4 md:left-auto md:right-8 md:w-[400px] z-50 bg-[var(--bg-secondary)] border border-brand-orange/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col pt-6 pb-8 px-6"
          >
            {currentTrack.imageUrl ? (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-10 blur-xl saturate-200 pointer-events-none"
                style={{ backgroundImage: `url(${currentTrack.imageUrl})` }}
              />
            ) : (
               <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/10 to-purple-500/10 opacity-20 blur-xl pointer-events-none" />
            )}

            <button 
               onClick={() => setIsExpanded(false)}
               className="absolute top-4 left-1/2 -translate-x-1/2 p-2 hover:bg-white/10 rounded-full transition-all text-white/50 z-10"
            >
               <ChevronDown className="w-6 h-6" />
            </button>

            <div className="w-full aspect-square mt-4 mb-6 shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-black/40 border border-white/5 flex items-center justify-center relative z-10">
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
    </>
  );
}
