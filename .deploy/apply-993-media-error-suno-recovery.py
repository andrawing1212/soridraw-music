from pathlib import Path

ctx_path = Path('src/contexts/GlobalPlayerContext.tsx')
svc_path = Path('src/services/sunoAudioRecovery.ts')
ctx = ctx_path.read_text(encoding='utf-8')
svc = svc_path.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'993 anchor missing: {label}')
    return text.replace(old, new, 1)

# Recovery request follows the same App Check-capable security contract as the rest of the app.
svc = replace_once(
    svc,
    "import { auth } from '../firebase';",
    "import { auth, getFirebaseAppCheckToken } from '../firebase';\n// SORIDRAW_MEDIA_ERROR_RECOVERY_993",
    'recovery firebase import',
)
svc = replace_once(
    svc,
    "      const token = await user.getIdToken();\n      const response = await fetch(SUNO_STATUS_ENDPOINT, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${token}`,\n        },",
    "      const token = await user.getIdToken();\n      const appCheckToken = await getFirebaseAppCheckToken();\n      const response = await fetch(SUNO_STATUS_ENDPOINT, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${token}`,\n          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),\n        },",
    'recovery App Check header',
)

# A media element can accept play() first and fail later via the `error` event.
# Guard one recovery attempt per explicit playback attempt to avoid duplicate promise/error retries.
ctx = replace_once(
    ctx,
    "  const lastPlaybackErrorAtRef = useRef(0);",
    "  const lastPlaybackErrorAtRef = useRef(0);\n  const playbackRecoveryAttemptedRef = useRef(false);\n  // SORIDRAW_MEDIA_ERROR_RECOVERY_993",
    'playback recovery guard ref',
)

recover_block_end = "  }, [notifyPlaybackUnavailable, updateMediaSession]);\n\n  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {"
if recover_block_end not in ctx:
    raise RuntimeError('993 anchor missing: recover helper end')
ctx = ctx.replace(
    recover_block_end,
    "  }, [notifyPlaybackUnavailable, updateMediaSession]);\n\n"
    "  const attemptPlaybackRecovery = useCallback((track: Track | null, error?: any) => {\n"
    "    if (!track || playbackRecoveryAttemptedRef.current) return;\n"
    "    playbackRecoveryAttemptedRef.current = true;\n"
    "    void recoverAndRetryPlayback(track, error);\n"
    "  }, [recoverAndRetryPlayback]);\n\n"
    "  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {",
    1,
)

ctx = replace_once(
    ctx,
    "  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {\n    if (!track?.url || !audioRef.current) return;",
    "  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {\n    if (!track?.url || !audioRef.current) return;\n    playbackRecoveryAttemptedRef.current = false;",
    'reset guard on explicit track play',
)
ctx = replace_once(
    ctx,
    "          void recoverAndRetryPlayback(track, err);",
    "          attemptPlaybackRecovery(track, err);",
    'async play catch recovery',
)
ctx = replace_once(
    ctx,
    "      void recoverAndRetryPlayback(track, error);\n    }\n  }, [recoverAndRetryPlayback, updateMediaSession]);",
    "      attemptPlaybackRecovery(track, error);\n    }\n  }, [attemptPlaybackRecovery, updateMediaSession]);",
    'sync play catch recovery',
)

# Explicit retry from the player must also get one fresh recovery attempt.
ctx = replace_once(
    ctx,
    "    } else {\n      updateMediaSession(track, 'playing');\n      audio.play().then(() => {",
    "    } else {\n      playbackRecoveryAttemptedRef.current = false;\n      updateMediaSession(track, 'playing');\n      audio.play().then(() => {",
    'toggle reset guard',
)
ctx = replace_once(
    ctx,
    "      }).catch((err) => {\n        console.error('Play failed:', err);\n        setIsPlaying(false);\n        isPlayingRef.current = false;\n        notifyPlaybackUnavailable(track, err);\n        updateMediaSession(track, 'paused');\n      });\n    }\n  }, [notifyPlaybackUnavailable, updateMediaSession]);",
    "      }).catch((err) => {\n        console.error('Play failed; attempting Task ID URL recovery:', err);\n        setIsPlaying(false);\n        isPlayingRef.current = false;\n        attemptPlaybackRecovery(track, err);\n      });\n    }\n  }, [attemptPlaybackRecovery, updateMediaSession]);",
    'toggle recovery catch',
)

# This is the regression: late HTMLMediaElement errors previously only notified and never recovered.
ctx = replace_once(
    ctx,
    "    const onError = () => {\n      const track = currentTrackRef.current;\n      setIsPlaying(false);\n      isPlayingRef.current = false;\n      notifyPlaybackUnavailable(track, audio.error || new Error('audio element error'));\n      updateMediaSession(track, 'paused');\n    };",
    "    const onError = () => {\n      const track = currentTrackRef.current;\n      if (!track || wasClearedRef.current) return;\n      setIsPlaying(false);\n      isPlayingRef.current = false;\n      attemptPlaybackRecovery(track, audio.error || new Error('audio element error'));\n    };",
    'audio element error recovery',
)
ctx = replace_once(
    ctx,
    "  }, [handleEnded, handleTimeUpdate, notifyPlaybackUnavailable, updateMediaSession]);",
    "  }, [attemptPlaybackRecovery, handleEnded, handleTimeUpdate, updateMediaSession]);",
    'audio listener dependencies',
)

required_ctx = [
    'SORIDRAW_MEDIA_ERROR_RECOVERY_993',
    'const playbackRecoveryAttemptedRef = useRef(false);',
    'const attemptPlaybackRecovery = useCallback',
    "attemptPlaybackRecovery(track, audio.error || new Error('audio element error'))",
    'playbackRecoveryAttemptedRef.current = false;',
]
for needle in required_ctx:
    if needle not in ctx:
        raise RuntimeError(f'993 context verification failed: {needle}')
required_svc = [
    'getFirebaseAppCheckToken',
    "'X-Firebase-AppCheck': appCheckToken",
    "ordered.find((url) => url !== normalizedFailed) || ordered[0] || ''",
]
for needle in required_svc:
    if needle not in svc:
        raise RuntimeError(f'993 service verification failed: {needle}')

ctx_path.write_text(ctx, encoding='utf-8')
svc_path.write_text(svc, encoding='utf-8')
print('993: late media error -> one Task-ID recovery attempt + App Check-capable request applied')
