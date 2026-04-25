import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { PlayMode, Track } from '../types';

interface GlobalPlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  audioRef: React.RefObject<HTMLAudioElement>;
  
  playTrack: (track: Track, newQueue?: Track[]) => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlayPause: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  seek: (time: number) => void;
  setPlayMode: (v: PlayMode) => void;
  handleTimeUpdate: () => void;
  handleEnded: () => void;
  setIsPlaying: (v: boolean) => void;
  clearPlayer: () => void;
  isSharedPlayerMode: boolean;
  setIsSharedPlayerMode: (v: boolean) => void;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | null>(null);

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('sequential');
  const [isSharedPlayerMode, setIsSharedPlayerMode] = useState(false);
  const [history, setHistory] = useState<Track[]>([]);

  const clearPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
    }
    
    setHistory(prev => {
      // Avoid duplicates at the end of history if same track re-plays
      if (prev.length > 0 && prev[prev.length - 1].url === track.url) return prev;
      return [...prev, track].slice(-50); // Keep last 50
    });

    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (!currentTrack || queue.length === 0) return;

    if (playMode === 'shuffle') {
      const nextIdx = Math.floor(Math.random() * queue.length);
      playTrack(queue[nextIdx]);
      return;
    }

    const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
    if (currentIdx >= 0 && currentIdx < queue.length - 1) {
      playTrack(queue[currentIdx + 1]);
    } else if (playMode === 'repeat-all' && queue.length > 0) {
      playTrack(queue[0]);
    } else if (playMode === 'repeat-one') {
      // In repeat-one, "next" button usually forces next track if existing app policy is so.
      // But user said: "현재 곡 다시 재생 또는 다음 곡 이동은 기존 앱 내부 정책과 동일"
      // Existing policy was move to next.
      if (currentIdx >= 0 && currentIdx < queue.length - 1) {
        playTrack(queue[currentIdx + 1]);
      } else if (queue.length > 0) {
        playTrack(queue[0]);
      }
    }
  };

  const playPrev = () => {
    if (!currentTrack || queue.length === 0) return;

    // Standard behavior: if more than 3s played, restart track
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    // If shuffle, try going back in history
    if (playMode === 'shuffle' && history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // Current track
      const prevTrack = newHistory.pop(); // Previous track
      if (prevTrack) {
        setHistory(newHistory);
        playTrack(prevTrack);
        return;
      }
    }

    const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
    if (currentIdx > 0) {
      playTrack(queue[currentIdx - 1]);
    } else if (playMode === 'repeat-all' && queue.length > 0) {
      playTrack(queue[queue.length - 1]);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = v === 0;
    }
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      const audioDuration = audioRef.current.duration;
      if (Number.isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
    }
  };

  const handleEnded = () => {
    if (playMode === 'repeat-one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

  // Media Session setup
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const coverUrl = currentTrack.imageUrl || currentTrack.parent?.imageUrl || currentTrack.parent?.image_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=512&auto=format&fit=crop';
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Untitled',
        artist: "SORIDRAW's Studio",
        album: currentTrack.parent?.style || currentTrack.parent?.prompt || 'SORIDRAW',
        artwork: [
          { src: coverUrl, sizes: '96x96', type: 'image/png' },
          { src: coverUrl, sizes: '192x192', type: 'image/png' },
          { src: coverUrl, sizes: '512x512', type: 'image/png' },
        ],
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
        if (audioRef.current) {
          const skip = details.seekOffset || 10;
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skip, 0);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audioRef.current) {
          const skip = details.seekOffset || 10;
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + skip, audioRef.current.duration);
        }
      });
      
      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
          }
        });
      } catch (error) {
        // seekto not supported in some browsers
      }
    }
    
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [currentTrack, playNext, playPrev]);

  // Sync playback state
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  return (
    <GlobalPlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playMode,
        audioRef,
        playTrack,
        playNext,
        playPrev,
        togglePlayPause,
        setVolume: handleVolumeChange,
        toggleMute,
        seek,
        setPlayMode,
        handleTimeUpdate,
        handleEnded,
        setIsPlaying,
        clearPlayer,
        isSharedPlayerMode,
        setIsSharedPlayerMode
      }}
    >
      {children}
    </GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer must be used within a GlobalPlayerProvider');
  }
  return context;
}
