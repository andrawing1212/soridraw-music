import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { applyRecoveredSunoAudioUrl, recoverSunoAudioUrl } from '../services/sunoAudioRecovery';
import { archiveOldSunoMp3ToR2 } from '../services/sunoR2Archive';
// SORIDRAW_SUNO_AUDIO_URL_AUTO_RECOVERY_955

export interface Track {
  url: string;
  title: string;
  id?: string;
  trackId?: string;
  taskId?: string;
  audioUrl?: string;
  imageUrl?: string;
  creatorDisplayId?: string;
  ownerNickname?: string;
  creatorNickname?: string;
  ownerEmail?: string;
  creatorEmail?: string;
  style?: string;
  prompt?: string;
  status?: string;
  createdAt?: number;
  requestPayload?: unknown;
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

type GlobalPlayerControlsContextType = Pick<
  GlobalPlayerContextType,
  'currentTrack' | 'isPlaying' | 'playTrack' | 'togglePlayPause' | 'setIsSharedPlayerMode'
>;

const GlobalPlayerControlsContext = createContext<GlobalPlayerControlsContextType | null>(null);

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
  const wasClearedRef = useRef(false);
  const lastPlaybackErrorAtRef = useRef(0);
  const playbackRecoveryAttemptedRef = useRef(false);
  // SORIDRAW_MEDIA_ERROR_RECOVERY_993

  const notifyPlaybackUnavailable = useCallback((track: Track | null, error?: any) => {
    const now = Date.now();
    if (now - lastPlaybackErrorAtRef.current < 1200) return;
    lastPlaybackErrorAtRef.current = now;

    try {
      window.dispatchEvent(new CustomEvent('soridraw:audio-playback-unavailable', {
        detail: {
          trackId: track?.parent?.id || track?.parent?.trackId || (track as any)?.id || '',
          title: track?.title || track?.parent?.title || 'Untitled',
          url: track?.url || '',
          message: '외부 Music API의 음원 URL이 만료되었거나 현재 연결할 수 없습니다. 가사/프롬프트/설정값은 보존되어 있으며, 중요한 음원은 생성 직후 다운로드해 보관해주세요.',
          rawError: error?.message || String(error || ''),
        },
      }));
    } catch {
      // Ignore event dispatch issues.
    }
  }, []);

  // Media Session handlers are registered once. These refs keep their implementation fresh.
  const mediaPlayRef = useRef<() => void>(() => {});
  const mediaPauseRef = useRef<() => void>(() => {});
  const mediaNextRef = useRef<() => void>(() => {});
  const mediaPrevRef = useRef<() => void>(() => {});
  const mediaSeekRef = useRef<(time: number) => void>(() => {});

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

  const recoverAndRetryPlayback = useCallback(async (track: Track, error?: any) => {
    const failedUrl = String(track?.url || '').trim();
    setIsPlaying(false);
    isPlayingRef.current = false;

    const recovered = await recoverSunoAudioUrl(track, { failedUrl });
    if (!recovered?.audioUrl || !audioRef.current) {
      notifyPlaybackUnavailable(track, error);
      updateMediaSession(track, 'paused');
      return false;
    }

    const recoveredTrack = applyRecoveredSunoAudioUrl(track, recovered) as Track;
    currentTrackRef.current = recoveredTrack;
    setCurrentTrack(recoveredTrack);

    const sourceParentId = String(track?.parent?.id || track?.parent?.trackId || track?.parent?.sourceId || '').trim();
    const sourceIndex = Number(track?.index ?? 0);
    const nextQueue = queueRef.current.map((queued) => {
      const queuedParentId = String(queued?.parent?.id || queued?.parent?.trackId || queued?.parent?.sourceId || '').trim();
      const queuedIndex = Number(queued?.index ?? 0);
      if (sourceParentId && queuedParentId === sourceParentId && queuedIndex === sourceIndex) {
        return applyRecoveredSunoAudioUrl(queued, recovered) as Track;
      }
      if (!sourceParentId && queued.url === failedUrl) {
        return applyRecoveredSunoAudioUrl(queued, recovered) as Track;
      }
      return queued;
    });
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    const audio = audioRef.current;
    try {
      audio.pause();
      audio.src = recovered.audioUrl;
      audio.currentTime = 0;
      audio.load();
      await audio.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
      updateMediaSession(recoveredTrack, 'playing');
      return true;
    } catch (retryError) {
      console.error('Recovered audio play failed:', retryError);
      setIsPlaying(false);
      isPlayingRef.current = false;
      notifyPlaybackUnavailable(recoveredTrack, retryError);
      updateMediaSession(recoveredTrack, 'paused');
      return false;
    }
  }, [notifyPlaybackUnavailable, updateMediaSession]);

  const attemptPlaybackRecovery = useCallback((track: Track | null, error?: any) => {
    if (!track || playbackRecoveryAttemptedRef.current) return;
    playbackRecoveryAttemptedRef.current = true;
    void recoverAndRetryPlayback(track, error);
  }, [recoverAndRetryPlayback]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (!track?.url || !audioRef.current) return;
    playbackRecoveryAttemptedRef.current = false;

    // Only an actual playback request starts lazy archival; current provider playback is not delayed.
    void archiveOldSunoMp3ToR2(track);

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
      const shouldResetSource = wasClearedRef.current || currentSrc !== targetSrc;

      if (shouldResetSource) {
        audio.pause();
        audio.src = targetSrc;
        audio.currentTime = 0;
        if (wasClearedRef.current) {
           audio.load();
        }
      }

      wasClearedRef.current = false;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.error('Audio play failed; attempting Task ID URL recovery:', err);
          attemptPlaybackRecovery(track, err);
        });
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (error) {
      console.error('Audio play failed; attempting Task ID URL recovery:', error);
      attemptPlaybackRecovery(track, error);
    }
  }, [attemptPlaybackRecovery, updateMediaSession]);

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
      playbackRecoveryAttemptedRef.current = false;
      updateMediaSession(track, 'playing');
      audio.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      }).catch((err) => {
        console.error('Play failed; attempting Task ID URL recovery:', err);
        setIsPlaying(false);
        isPlayingRef.current = false;
        attemptPlaybackRecovery(track, err);
      });
    }
  }, [attemptPlaybackRecovery, updateMediaSession]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      updateMediaSessionPosition();
    }
  }, [updateMediaSessionPosition]);

  // Keep Media Session action implementations current without re-registering OS handlers.
  useEffect(() => {
    mediaPlayRef.current = () => {
      const audio = audioRef.current;
      const track = currentTrackRef.current;
      if (!audio || !track) return;

      updateMediaSession(track, 'playing');
      audio.play()
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
        })
        .catch((err) => {
          console.error('MediaSession play failed:', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
          notifyPlaybackUnavailable(track, err);
          updateMediaSession(track, 'paused');
        });
    };

    mediaPauseRef.current = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
    };

    mediaNextRef.current = () => {
      playNext();
    };

    mediaPrevRef.current = () => {
      playPrev();
    };

    mediaSeekRef.current = (time: number) => {
      seek(time);
    };
  }, [notifyPlaybackUnavailable, playNext, playPrev, seek, updateMediaSession]);

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
    wasClearedRef.current = true;
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
    const onError = () => {
      const track = currentTrackRef.current;
      if (!track || wasClearedRef.current) return;
      setIsPlaying(false);
      isPlayingRef.current = false;
      attemptPlaybackRecovery(track, audio.error || new Error('audio element error'));
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('error', onError);
    };
  }, [attemptPlaybackRecovery, handleEnded, handleTimeUpdate, updateMediaSession]);

  // Media Session action handlers for lock-screen controls.
  // Register these once only; each handler delegates to refs above.
  // Re-registering handlers on every track/queue change can make mobile OS lock-screen
  // controls briefly close and reopen the media session.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => mediaPlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => mediaPauseRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => mediaPrevRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => mediaNextRef.current());

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextTime = Math.max(audio.currentTime - (details.seekOffset || 10), 0);
        mediaSeekRef.current(nextTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const audio = audioRef.current;
        if (!audio) return;
        const maxDuration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
        const nextTime = Math.min(audio.currentTime + (details.seekOffset || 10), maxDuration);
        mediaSeekRef.current(nextTime);
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          mediaSeekRef.current(details.seekTime);
        }
      });
    } catch (error) {
      console.warn('MediaSession action handler setup failed:', error);
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch {
        // Ignore unsupported cleanup cases.
      }
    };
  }, []);


  // List-heavy pages only need track identity and play controls. Keeping this
  // value separate prevents audio currentTime updates from re-rendering every
  // Library card several times per second while a song is playing.
  const controlsValue = useMemo<GlobalPlayerControlsContextType>(() => ({
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    setIsSharedPlayerMode,
  }), [currentTrack, isPlaying, playTrack, togglePlayPause, setIsSharedPlayerMode]);

  return (
    <GlobalPlayerControlsContext.Provider value={controlsValue}>
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
    </GlobalPlayerControlsContext.Provider>
  );
}

export function useGlobalPlayerControls() {
  const context = useContext(GlobalPlayerControlsContext);
  if (!context) {
    throw new Error('useGlobalPlayerControls must be used within a GlobalPlayerProvider');
  }
  return context;
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer must be used within a GlobalPlayerProvider');
  }
  return context;
}
