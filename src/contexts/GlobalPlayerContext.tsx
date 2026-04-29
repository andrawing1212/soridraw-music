import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface Track {
  url: string;
  title: string;
  imageUrl?: string;
  parent?: any;
  index?: number;
  duration?: number;
  lyrics?: any;
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
  // App lifecycle singleton audio instance. Do not recreate this per track.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMutedState] = useState(false);
  const [isShuffle, setIsShuffleState] = useState(false);
  const [repeatMode, setRepeatModeState] = useState<'none' | 'all' | 'one'>('none');
  const [isSharedPlayerMode, setIsSharedPlayerMode] = useState(false);

  // Refs keep the latest playback state available to background/lock-screen events.
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const isPlayingRef = useRef(false);
  const isShuffleRef = useRef(false);
  const repeatModeRef = useRef<'none' | 'all' | 'one'>('none');
  const volumeRef = useRef(1);
  const isMutedRef = useRef(false);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Sync volume and mute state to the audio object.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const updateMediaSession = useCallback((track: Track | null, state: 'playing' | 'paused' | 'none') => {
    if (!('mediaSession' in navigator)) return;

    if (!track || state === 'none') {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
      return;
    }

    const artworkSrc =
      track.imageUrl ||
      track.parent?.imageUrl ||
      track.parent?.image_url ||
      'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=512&auto=format&fit=crop';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled',
        artist: "SORIDRAW's Studio",
        album: track.parent?.style || track.parent?.prompt || 'SORIDRAW',
        artwork: [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      console.warn('MediaSession metadata update failed:', error);
    }
  }, []);

  const updateMediaSessionPosition = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;

    const audioDuration = audio.duration;
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: audioDuration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime || 0, audioDuration)
      });
    } catch {
      // Some mobile browsers throw if position state is temporarily invalid.
    }
  }, []);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (!track?.url || !audioRef.current) return;

    if (newQueue) {
      queueRef.current = newQueue;
      setQueue(newQueue);
    }

    currentTrackRef.current = track;
    setCurrentTrack(track);

    const audio = audioRef.current;
    const targetSrc = track.url;

    // Update lock-screen metadata before play to reduce media session flicker.
    updateMediaSession(track, 'playing');

    try {
      const currentSrc = audio.currentSrc || audio.src || '';
      if (currentSrc !== targetSrc) {
        audio.src = targetSrc;
        audio.load();
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.error('Audio play failed:', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
          updateMediaSession(track, 'paused');
        });
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (error) {
      console.error('Audio play failed:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      updateMediaSession(track, 'paused');
    }
  }, [updateMediaSession]);

  const findCurrentIndex = useCallback((current: Track | null, list: Track[]) => {
    if (!current || list.length === 0) return -1;

    const exactIdx = list.findIndex((t) =>
      t.url === current.url &&
      (t.index === current.index || t.parent?.id === current.parent?.id)
    );
    if (exactIdx >= 0) return exactIdx;

    return list.findIndex((t) => t.url === current.url);
  }, []);

  const playNext = useCallback(() => {
    const current = currentTrackRef.current;
    const list = queueRef.current;
    if (!current || list.length === 0) return;

    let nextTrack: Track | null = null;

    if (isShuffleRef.current && list.length > 1) {
      const currentIdx = findCurrentIndex(current, list);
      let nextIdx = Math.floor(Math.random() * list.length);
      if (currentIdx >= 0) {
        let guard = 0;
        while (nextIdx === currentIdx && guard < 10) {
          nextIdx = Math.floor(Math.random() * list.length);
          guard += 1;
        }
      }
      nextTrack = list[nextIdx];
    } else {
      const currentIdx = findCurrentIndex(current, list);
      if (currentIdx >= 0 && currentIdx < list.length - 1) {
        nextTrack = list[currentIdx + 1];
      } else if (repeatModeRef.current === 'all' && list.length > 0) {
        nextTrack = list[0];
      }
    }

    if (nextTrack) {
      playTrack(nextTrack);
    } else {
      setIsPlaying(false);
      isPlayingRef.current = false;
      updateMediaSession(current, 'paused');
    }
  }, [findCurrentIndex, playTrack, updateMediaSession]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    const current = currentTrackRef.current;
    const list = queueRef.current;
    if (!current || list.length === 0) return;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prevTrack: Track | null = null;
    const currentIdx = findCurrentIndex(current, list);
    if (currentIdx > 0) {
      prevTrack = list[currentIdx - 1];
    } else if (repeatModeRef.current === 'all' && list.length > 0) {
      prevTrack = list[list.length - 1];
    }

    if (prevTrack) {
      playTrack(prevTrack);
    }
  }, [findCurrentIndex, playTrack]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    const track = currentTrackRef.current;
    if (!audio || !track) return;

    if (isPlayingRef.current) {
      audio.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      updateMediaSession(track, 'paused');
    } else {
      updateMediaSession(track, 'playing');
      audio.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      }).catch((err) => {
        console.error('Play failed:', err);
        updateMediaSession(track, 'paused');
      });
    }
  }, [updateMediaSession]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      updateMediaSessionPosition();
    }
  }, [updateMediaSessionPosition]);

  const handleVolumeChange = useCallback((v: number) => {
    const nextVolume = Math.max(0, Math.min(1, v));
    setVolumeState(nextVolume);
    volumeRef.current = nextVolume;
    setIsMutedState(nextVolume === 0);
    isMutedRef.current = nextVolume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    setIsMutedState(nextMuted);
    isMutedRef.current = nextMuted;
  }, []);

  const handleSetIsShuffle = useCallback((v: boolean) => {
    isShuffleRef.current = v;
    setIsShuffleState(v);
  }, []);

  const handleSetRepeatMode = useCallback((v: 'none' | 'all' | 'one') => {
    repeatModeRef.current = v;
    setRepeatModeState(v);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime || 0);
      const audioDuration = audioRef.current.duration;
      if (Number.isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
      updateMediaSessionPosition();
    }
  }, [updateMediaSessionPosition]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    const current = currentTrackRef.current;

    if (repeatModeRef.current === 'one') {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch((err) => console.error('Repeat play failed:', err));
      }
      return;
    }

    playNext();

    if (current && 'mediaSession' in navigator) {
      // playNext updates metadata when next exists. If no next exists, paused state is set inside playNext.
      updateMediaSessionPosition();
    }
  }, [playNext, updateMediaSessionPosition]);

  const clearPlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current.currentTime = 0;
    }

    currentTrackRef.current = null;
    queueRef.current = [];
    isPlayingRef.current = false;

    setIsPlaying(false);
    setCurrentTrack(null);
    setQueue([]);
    setCurrentTime(0);
    setDuration(0);
    updateMediaSession(null, 'none');
  }, [updateMediaSession]);

  // Set up audio event listeners once. The handlers use refs, so they always see latest queue/currentTrack.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      updateMediaSession(currentTrackRef.current, 'playing');
    };

    const onPause = () => {
      // If pause fires during an immediate src switch, the next play event will set this back.
      if (!audio.ended) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        updateMediaSession(currentTrackRef.current, 'paused');
      }
    };

    const onEnded = () => handleEnded();
    const onTimeUpdate = () => handleTimeUpdate();
    const onLoadedMetadata = () => handleTimeUpdate();
    const onDurationChange = () => handleTimeUpdate();

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, [handleEnded, handleTimeUpdate, updateMediaSession]);

  // Media Session action handlers for lock-screen controls. Stable callbacks use refs internally.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        const audio = audioRef.current;
        const track = currentTrackRef.current;
        if (!audio || !track) return;
        updateMediaSession(track, 'playing');
        audio.play().catch((err) => console.error('MediaSession play failed:', err));
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - (details.seekOffset || 10), 0);
          updateMediaSessionPosition();
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audioRef.current) {
          const maxDuration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : Number.MAX_SAFE_INTEGER;
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + (details.seekOffset || 10), maxDuration);
          updateMediaSessionPosition();
        }
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          updateMediaSessionPosition();
        }
      });
    } catch (error) {
      console.warn('MediaSession action handler setup failed:', error);
    }
  }, [playNext, playPrev, updateMediaSession, updateMediaSessionPosition]);

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
        setIsShuffle: handleSetIsShuffle,
        setRepeatMode: handleSetRepeatMode,
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
