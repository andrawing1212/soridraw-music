import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface Track {
  url: string;
  title: string;
  imageUrl?: string;
  parent?: any;
  index?: number;
}

interface GlobalPlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'none' | 'all' | 'one';
  audioRef: React.RefObject<HTMLAudioElement>;
  
  playTrack: (track: Track, newQueue?: Track[]) => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlayPause: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  seek: (time: number) => void;
  setIsShuffle: (v: boolean) => void;
  setRepeatMode: (v: 'none' | 'all' | 'one') => void;
  handleTimeUpdate: () => void;
  handleEnded: () => void;
  setIsPlaying: (v: boolean) => void;
  clearPlayer: () => void;
  isSharedPlayerMode: boolean;
  setIsSharedPlayerMode: (v: boolean) => void;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | null>(null);

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  // Use a permanent audio instance as a singleton for the app lifecycle
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
  }
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [isSharedPlayerMode, setIsSharedPlayerMode] = useState(false);

  // Sync volume and mute state to the audio object
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const updateMediaSession = (track: Track, state: 'playing' | 'paused') => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled',
        artist: "SORIDRAW's Studio",
        album: track.parent?.style || track.parent?.prompt || 'SORIDRAW',
        artwork: [
          { 
            src: track.imageUrl || track.parent?.imageUrl || track.parent?.image_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=512&auto=format&fit=crop', 
            sizes: '512x512', 
            type: 'image/jpeg' 
          }
        ]
      });
      navigator.mediaSession.playbackState = state;
    }
  };

  const clearPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.currentTime = 0;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
    }

    // 1. Update MediaSession Metadata FIRST to prevent OS player flickering
    updateMediaSession(track, 'playing');

    // 2. Set src and play imperatively
    if (audioRef.current) {
      // Use URL object comparison or just string comparison
      // The browser might normalize URLs, so be careful
      const currentSrc = audioRef.current.src;
      const targetSrc = track.url;
      
      // If URLs are actually different (or empty), update src
      if (currentSrc !== targetSrc && !currentSrc.endsWith(targetSrc)) {
        audioRef.current.src = targetSrc;
        audioRef.current.load();
      }
      
      // Attempt play - OS Media Session is already updated to 'playing'
      audioRef.current.play().catch(err => {
        console.error("Audio play failed:", err);
        // If play completely fails, update state back to paused
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        setIsPlaying(false);
      });
    }

    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const playNext = useCallback(() => {
    // Need access to latest state. Since we're in the same scope, 
    // we should use dependencies or refs.
    // However, if we want these to be stable, we need to be careful.
    // For now, let's just include them in dependencies.
    if (!currentTrack || queue.length === 0) return;
    
    let nextTrack: Track | null = null;
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      nextTrack = queue[nextIdx];
    } else {
      const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
      if (currentIdx >= 0 && currentIdx < queue.length - 1) {
        nextTrack = queue[currentIdx + 1];
      } else if (repeatMode === 'all' && queue.length > 0) {
        nextTrack = queue[0];
      }
    }

    if (nextTrack) {
      playTrack(nextTrack);
    }
  }, [currentTrack, queue, isShuffle, repeatMode, playTrack]);

  const playPrev = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevTrack: Track | null = null;
    const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
    if (currentIdx > 0) {
      prevTrack = queue[currentIdx - 1];
    } else if (repeatMode === 'all' && queue.length > 0) {
      prevTrack = queue[queue.length - 1];
    }

    if (prevTrack) {
      playTrack(prevTrack);
    }
  }, [currentTrack, queue, repeatMode, playTrack]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      audioRef.current.play().catch(err => console.error("Play failed:", err));
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrack]);

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
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

  const handleEnded = useCallback(() => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  }, [repeatMode, playNext]);

  // Set up audio event listeners and Media Session action handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => handleEnded();
    const onTimeUpdate = () => handleTimeUpdate();

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onTimeUpdate);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onTimeUpdate);
    };
  }, [currentTrack, queue, isShuffle, repeatMode]); // Re-attach when navigation logic dependencies change

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlayPause);
      navigator.mediaSession.setActionHandler('pause', togglePlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - (details.seekOffset || 10), 0);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + (details.seekOffset || 10), duration);
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [currentTrack, togglePlayPause, playNext, playPrev, duration]);

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
        isShuffle,
        repeatMode,
        audioRef,
        playTrack,
        playNext,
        playPrev,
        togglePlayPause,
        setVolume: handleVolumeChange,
        toggleMute,
        seek,
        setIsShuffle,
        setRepeatMode,
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
