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

// One audio element and one playback snapshot should survive provider remounts.
// Without this, mobile browsers can keep playing old audio while React loses currentTrack UI state.
let globalAudioElement: HTMLAudioElement | null = null;
let globalCurrentTrack: Track | null = null;
let globalQueue: Track[] = [];
let globalIsPlaying = false;
let globalCurrentTime = 0;
let globalDuration = 0;

function getGlobalAudioElement() {
  if (typeof window === 'undefined') return null;
  if (!globalAudioElement) {
    globalAudioElement = new Audio();
    globalAudioElement.preload = 'auto';
  }
  return globalAudioElement;
}

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  // App lifecycle singleton audio instance. Do not recreate this per track or route.
  const audioRef = useRef<HTMLAudioElement | null>(getGlobalAudioElement());
  const isSwitchingTrackRef = useRef(false);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => globalCurrentTrack);
  const [queue, setQueue] = useState<Track[]>(() => globalQueue);
  const [isPlaying, setIsPlaying] = useState(() => {
    const audio = audioRef.current;
    return globalIsPlaying || !!(audio && !audio.paused && !audio.ended && audio.src);
  });
  const [currentTime, setCurrentTime] = useState(() => audioRef.current?.currentTime || globalCurrentTime || 0);
  const [duration, setDuration] = useState(() => {
    const d = audioRef.current?.duration;
    return Number.isFinite(d) ? (d || globalDuration || 0) : (globalDuration || 0);
  });
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

  useEffect(() => { currentTrackRef.current = currentTrack; globalCurrentTrack = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; globalQueue = queue; }, [queue]);
  useEffect(() => { isPlayingRef.current = isPlaying; globalIsPlaying = isPlaying; }, [isPlaying]);
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
      const shouldSwitchSource = currentSrc !== targetSrc;

      if (shouldSwitchSource) {
        isSwitchingTrackRef.current = true;
        // Keep the same audio element. Setting src is enough; avoid audio.load() to reduce lock-screen session flicker.
        audio.src = targetSrc;
        audio.currentTime = 0;
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            isSwitchingTrackRef.current = false;
            setIsPlaying(true);
            isPlayingRef.current = true;
            globalIsPlaying = true;
            updateMediaSession(track, 'playing');
          })
          .catch((err) => {
            isSwitchingTrackRef.current = false;
            console.error('Audio play failed:', err);
            setIsPlaying(false);
            isPlayingRef.current = false;
            globalIsPlaying = false;
            updateMediaSession(track, 'paused');
          });
      } else if (typeof window !== 'undefined') {
        window.setTimeout(() => { isSwitchingTrackRef.current = false; }, 0);
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      globalIsPlaying = true;
    } catch (error) {
      isSwitchingTrackRef.current = false;
      console.error('Audio play failed:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      globalIsPlaying = false;
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
      const nextTime = audioRef.current.currentTime || 0;
      globalCurrentTime = nextTime;
      setCurrentTime(nextTime);
      const audioDuration = audioRef.current.duration;
      if (Number.isFinite(audioDuration) && audioDuration > 0) {
        globalDuration = audioDuration;
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
    globalCurrentTrack = null;
    globalQueue = [];
    globalIsPlaying = false;
    globalCurrentTime = 0;
    globalDuration = 0;

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
      // Ignore the synthetic pause emitted by some browsers while switching src to the next track.
      if (isSwitchingTrackRef.current) return;
      if (!audio.ended) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        globalIsPlaying = false;
        updateMediaSession(currentTrackRef.current, 'paused');
      }
    };

    const onEnded = () => handleEnded();
    const onTimeUpdate = () => handleTimeUpdate();
    const onLoadedMetadata = () => handleTimeUpdate();
    const onDurationChange = () => handleTimeUpdate();
    const onError = () => {
      console.warn('Global audio error:', audio.error, { src: audio.currentSrc || audio.src, track: currentTrackRef.current });
    };
    const onStalled = () => console.warn('Global audio stalled:', { src: audio.currentSrc || audio.src, track: currentTrackRef.current });
    const onWaiting = () => console.log('Global audio waiting:', { src: audio.currentSrc || audio.src });
    const onCanPlay = () => updateMediaSessionPosition();

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [handleEnded, handleTimeUpdate, updateMediaSession, updateMediaSessionPosition]);

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
