import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

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
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
    }
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (!currentTrack || queue.length === 0) return;
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      playTrack(queue[nextIdx]);
      return;
    }
    const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
    if (currentIdx >= 0 && currentIdx < queue.length - 1) {
      playTrack(queue[currentIdx + 1]);
    } else if (repeatMode === 'all' && queue.length > 0) {
      playTrack(queue[0]);
    }
  };

  const playPrev = () => {
    if (!currentTrack || queue.length === 0) return;
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const currentIdx = queue.findIndex(t => t.url === currentTrack.url);
    if (currentIdx > 0) {
      playTrack(queue[currentIdx - 1]);
    } else if (repeatMode === 'all' && queue.length > 0) {
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
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

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
        setIsPlaying
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
