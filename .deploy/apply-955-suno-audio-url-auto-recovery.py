from pathlib import Path

MARKER = '// SORIDRAW_SUNO_AUDIO_URL_AUTO_RECOVERY_955'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'apply-955: anchor not found: {label}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Global player: playback failure -> refresh URL by taskId -> retry once.
# ---------------------------------------------------------------------------
context_path = Path('src/contexts/GlobalPlayerContext.tsx')
context = context_path.read_text(encoding='utf-8')
if MARKER not in context:
    context = replace_once(
        context,
        "import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';\n",
        "import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';\n"
        "import { applyRecoveredSunoAudioUrl, recoverSunoAudioUrl } from '../services/sunoAudioRecovery';\n"
        f"{MARKER}\n",
        'GlobalPlayerContext recovery import',
    )

    play_anchor = "  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {"
    recovery_helper = r'''  const recoverAndRetryPlayback = useCallback(async (track: Track, error?: any) => {
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

'''
    if play_anchor not in context:
        raise RuntimeError('apply-955: GlobalPlayerContext playTrack anchor not found')
    context = context.replace(play_anchor, recovery_helper + play_anchor, 1)

    old_async_catch = r'''        playPromise.catch((err) => {
          console.error('Audio play failed:', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
          notifyPlaybackUnavailable(track, err);
          updateMediaSession(track, 'paused');
        });'''
    new_async_catch = r'''        playPromise.catch((err) => {
          console.error('Audio play failed; attempting Task ID URL recovery:', err);
          void recoverAndRetryPlayback(track, err);
        });'''
    context = replace_once(context, old_async_catch, new_async_catch, 'GlobalPlayerContext async play catch')

    old_sync_catch = r'''    } catch (error) {
      console.error('Audio play failed:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      notifyPlaybackUnavailable(track, error);
      updateMediaSession(track, 'paused');
    }
  }, [notifyPlaybackUnavailable, updateMediaSession]);'''
    new_sync_catch = r'''    } catch (error) {
      console.error('Audio play failed; attempting Task ID URL recovery:', error);
      void recoverAndRetryPlayback(track, error);
    }
  }, [recoverAndRetryPlayback, updateMediaSession]);'''
    context = replace_once(context, old_sync_catch, new_sync_catch, 'GlobalPlayerContext sync play catch')

    context_path.write_text(context, encoding='utf-8')


# ---------------------------------------------------------------------------
# 2) Global player menu download uses the same Task ID recovery pipeline.
# ---------------------------------------------------------------------------
player_path = Path('src/components/GlobalPlayer.tsx')
player = player_path.read_text(encoding='utf-8')
if MARKER not in player:
    player = replace_once(
        player,
        "import { downloadAudioWithTitle } from '../lib/songUtils';",
        "import { downloadSunoAudioWithRecovery } from '../services/sunoAudioRecovery';\n" + MARKER,
        'GlobalPlayer download import',
    )

    old_handle_download = r'''  const handleDownload = (url: string, title?: string) => {
    if (!url) {
      alert('아직 다운로드할 음원이 없습니다.');
      return;
    }
    downloadAudioWithTitle(url, title);
  };'''
    new_handle_download = r'''  const handleDownload = async (url: string, title?: string) => {
    if (!url && !currentTrack) {
      alert('아직 다운로드할 음원이 없습니다.');
      return;
    }

    const target = currentTrack
      ? { ...currentTrack, url: url || currentTrack.url }
      : { url, title: title || 'SORIDRAW' };
    const result = await downloadSunoAudioWithRecovery(target, title || currentTrack?.title);
    if (!result.ok) {
      alert('Music API에서 현재 다운로드 가능한 음원 링크를 찾지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };'''
    player = replace_once(player, old_handle_download, new_handle_download, 'GlobalPlayer handleDownload')
    player_path.write_text(player, encoding='utf-8')


# ---------------------------------------------------------------------------
# 3) Library: download recovery + recovered URL reflected in UI/session/cache.
# apply-954 runs before this script, so the shared local patch helper exists.
# ---------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    library = replace_once(
        library,
        "import { downloadAudioWithTitle } from '../lib/songUtils';",
        "import { downloadSunoAudioWithRecovery } from '../services/sunoAudioRecovery';\n" + MARKER,
        'Library recovery import',
    )

    old_run_download = r'''  const runDownload = async (audioUrl?: string, title?: string) => {
    if (!audioUrl) {
      showToast('아직 다운로드할 음원이 없습니다.');
      return;
    }
    // Use the optimized blob downloader instead of window.open
    downloadAudioWithTitle(audioUrl, title);
  };'''
    new_run_download = r'''  const resolveDownloadRecoveryTarget = (audioUrl?: string, title?: string) => {
    const normalizedUrl = String(audioUrl || '').trim();
    if (normalizedUrl) {
      for (const group of tracks) {
        const items = extractSunoData(group);
        const idx = items.findIndex((entry: any) => String(getAudioUrl(entry, group) || '').trim() === normalizedUrl);
        if (idx >= 0) {
          return {
            url: normalizedUrl,
            title: title || getTitle(items[idx], group, idx),
            parent: group,
            index: idx,
          };
        }
      }
    }

    if (currentTrack && (!normalizedUrl || getCurrentPlayableUrl() === normalizedUrl)) {
      return { ...currentTrack, url: normalizedUrl || currentTrack.url };
    }

    return { url: normalizedUrl, title: title || 'SORIDRAW' };
  };

  const runDownload = async (audioUrl?: string, title?: string) => {
    const target = resolveDownloadRecoveryTarget(audioUrl, title);
    if (!target?.url && !target?.parent?.taskId) {
      showToast('아직 다운로드할 음원이 없습니다.');
      return;
    }

    const result = await downloadSunoAudioWithRecovery(target, title || target.title);
    if (!result.ok) {
      showToast('Music API에서 현재 다운로드 가능한 음원 링크를 찾지 못했습니다.');
    } else if (result.directFallback) {
      showToast('브라우저에서 새 음원 링크를 열었습니다.');
    } else if (result.recovered) {
      showToast('최신 음원 링크로 갱신해 다운로드했습니다.');
    }
  };'''
    library = replace_once(library, old_run_download, new_run_download, 'Library runDownload')

    filtered_anchor = "  const filteredTracks = useMemo(() => {"
    recovered_event_effect = r'''  useEffect(() => {
    const handleRecoveredAudioUrl = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const trackId = String(detail.trackId || '').trim();
      const audioUrl = String(detail.audioUrl || '').trim();
      const index = Number(detail.index ?? 0);
      if (!trackId || !audioUrl) return;

      patchWorkspaceTrackLocally(trackId, (current) => {
        const next: any = {
          ...current,
          audioValidationStatus: 'verified',
          reportedAudioUrls: Array.from(new Set([...(Array.isArray(current?.reportedAudioUrls) ? current.reportedAudioUrls : []), audioUrl])),
          audioUrls: Array.from(new Set([...(Array.isArray(current?.audioUrls) ? current.audioUrls : []), audioUrl])),
        };
        if (Array.isArray(current?.sunoData) && current.sunoData.length > 0) {
          next.sunoData = current.sunoData.map((entry: any, entryIndex: number) => entryIndex === index
            ? { ...entry, audioUrl, streamAudioUrl: audioUrl, url: audioUrl }
            : entry);
        }
        if (index === 0 || !Array.isArray(current?.sunoData) || current.sunoData.length <= 1) {
          next.audioUrl = audioUrl;
          next.streamAudioUrl = audioUrl;
        }
        return next;
      });

      setPlaylistItems((prev) => prev.map((item: any) => {
        const sourceId = String(item?.sourceId || item?.trackId || item?.parentTrackId || '').trim();
        const itemIndexRaw = item?.sourceSubTrackIndex ?? item?.subTrackIndex ?? 0;
        const itemIndex = Number.isFinite(Number(itemIndexRaw)) ? Number(itemIndexRaw) : 0;
        if (sourceId !== trackId || itemIndex !== index) return item;
        return { ...item, audioUrl, streamAudioUrl: audioUrl, url: audioUrl };
      }));
    };

    window.addEventListener('soridraw:suno-audio-url-recovered', handleRecoveredAudioUrl as EventListener);
    return () => window.removeEventListener('soridraw:suno-audio-url-recovered', handleRecoveredAudioUrl as EventListener);
  }, [user?.uid]);

'''
    if filtered_anchor not in library:
        raise RuntimeError('apply-955: Library filteredTracks anchor not found')
    library = library.replace(filtered_anchor, recovered_event_effect + filtered_anchor, 1)
    library_path.write_text(library, encoding='utf-8')


for file_path, required in [
    (context_path, [
        MARKER,
        'recoverAndRetryPlayback',
        'recoverSunoAudioUrl(track',
        'applyRecoveredSunoAudioUrl',
        'attempting Task ID URL recovery',
    ]),
    (player_path, [
        MARKER,
        'downloadSunoAudioWithRecovery',
        'Music API에서 현재 다운로드 가능한 음원 링크',
    ]),
    (library_path, [
        MARKER,
        'resolveDownloadRecoveryTarget',
        'downloadSunoAudioWithRecovery',
        'soridraw:suno-audio-url-recovered',
        'patchWorkspaceTrackLocally(trackId',
    ]),
]:
    built = file_path.read_text(encoding='utf-8')
    for fragment in required:
        if fragment not in built:
            raise RuntimeError(f'apply-955 verification failed: {file_path} missing {fragment}')

print('apply-955: Task ID audio URL recovery + playback/download retry applied')
