from pathlib import Path

SERVICE = Path('src/services/sunoAudioRecovery.ts')
LIBRARY = Path('src/pages/SunoLibraryPage.tsx')
MARKER = '// SORIDRAW_LIBRARY_AGED_AUDIO_RECOVERY_990'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'990 anchor missing: {label}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Recovery service: keep explicit failure recovery strict, but let a
# user-initiated proactive refresh use the verified/cached URL. Avoid blocking
# a transient failure for a full day.
# ---------------------------------------------------------------------------
service = SERVICE.read_text(encoding='utf-8')
if MARKER not in service:
    service = replace_once(
        service,
        "const RECOVERY_NEGATIVE_CACHE_MS = 24 * 60 * 60 * 1000;",
        "const RECOVERY_NEGATIVE_CACHE_MS = 5 * 60 * 1000;\n" + MARKER,
        'negative cache duration',
    )
    service = replace_once(
        service,
        "type RecoveryResult = {\n  audioUrl: string;\n  trackId: string;\n  taskId: string;\n  index: number;\n  sunoData: any[] | null;\n  raw: any;\n};",
        "type RecoveryResult = {\n  audioUrl: string;\n  trackId: string;\n  taskId: string;\n  index: number;\n  sunoData: any[] | null;\n  raw: any;\n  recoveredAt: number;\n};",
        'recovery result timestamp',
    )
    service = replace_once(
        service,
        "  const normalizedFailed = toText(failedUrl);\n  return ordered.find((url) => url !== normalizedFailed) || '';",
        "  const normalizedFailed = toText(failedUrl);\n  const alternative = ordered.find((url) => !normalizedFailed || url !== normalizedFailed);\n  if (alternative) return alternative;\n  // The Function only exposes audioUrls after a byte probe succeeds. If the\n  // provider refreshed the resource behind the same URL, one retry is safe.\n  if (normalizedFailed && verified.includes(normalizedFailed)) return normalizedFailed;\n  return normalizedFailed ? '' : (ordered[0] || '');",
        'verified same-url fallback',
    )
    service = replace_once(
        service,
        "  parent.audioValidationStatus = 'verified';",
        "  parent.audioValidationStatus = 'verified';\n  parent.lastAudioUrlRecoveredAt = result.recoveredAt || Date.now();",
        'apply recovery timestamp',
    )
    service = replace_once(
        service,
        "  const cacheKey = `${context.trackId}:${context.taskId}:${context.index}`;\n  const inFlightKey = `${user.uid}:${cacheKey}`;\n  const failedUrl = toText(options?.failedUrl || context.currentUrl);\n  const cached = readRecoveryCacheEntry(user.uid, cacheKey);\n\n  if (cached?.audioUrl && cached.audioUrl !== failedUrl) {",
        "  const cacheKey = `${context.trackId}:${context.taskId}:${context.index}`;\n  const inFlightKey = `${user.uid}:${cacheKey}`;\n  const hasExplicitFailedUrl = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'failedUrl'));\n  const failedUrl = hasExplicitFailedUrl ? toText(options?.failedUrl) : '';\n  const cached = readRecoveryCacheEntry(user.uid, cacheKey);\n\n  if (cached?.audioUrl && (!hasExplicitFailedUrl || cached.audioUrl !== failedUrl)) {",
        'proactive cache semantics',
    )
    service = replace_once(
        service,
        "      sunoData: null,\n      raw: { cacheHit: true },\n    };",
        "      sunoData: null,\n      raw: { cacheHit: true },\n      recoveredAt: Number(cached.updatedAt || Date.now()),\n    };",
        'cached recovery timestamp',
    )
    service = replace_once(
        service,
        "        sunoData: getResponseSunoData(payload),\n        raw: payload,\n      };",
        "        sunoData: getResponseSunoData(payload),\n        raw: payload,\n        recoveredAt: Date.now(),\n      };",
        'network recovery timestamp',
    )
    SERVICE.write_text(service, encoding='utf-8')


# ---------------------------------------------------------------------------
# 2) Library: restore the old 13-day/missing-URL user-initiated recovery gate.
# No page-entry scan or background fan-out is introduced.
# ---------------------------------------------------------------------------
library = LIBRARY.read_text(encoding='utf-8')
if MARKER not in library:
    library = replace_once(
        library,
        "import { downloadSunoAudioWithRecovery } from '../services/sunoAudioRecovery';",
        "import { applyRecoveredSunoAudioUrl, downloadSunoAudioWithRecovery, recoverSunoAudioUrl } from '../services/sunoAudioRecovery';",
        'library recovery imports',
    )
    library = replace_once(
        library,
        "const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours",
        "const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours\nconst SUNO_AUDIO_URL_RECOVERY_AFTER_MS = 13 * 24 * 60 * 60 * 1000;\n" + MARKER,
        'library recovery age constant',
    )
    library = replace_once(
        library,
        "      const index = Number(detail.index ?? 0);\n      if (!trackId || !audioUrl) return;",
        "      const index = Number(detail.index ?? 0);\n      const recoveredAt = Number(detail.recoveredAt || Date.now());\n      if (!trackId || !audioUrl) return;",
        'recovered event timestamp',
    )
    library = replace_once(
        library,
        "          audioUrls: Array.from(new Set([...(Array.isArray(current?.audioUrls) ? current.audioUrls : []), audioUrl])),\n        };",
        "          audioUrls: Array.from(new Set([...(Array.isArray(current?.audioUrls) ? current.audioUrls : []), audioUrl])),\n          lastAudioUrlRecoveredAt: recoveredAt,\n        };",
        'workspace recovered timestamp',
    )
    library = replace_once(
        library,
        "        return { ...item, audioUrl, streamAudioUrl: audioUrl, url: audioUrl };",
        "        return { ...item, audioUrl, streamAudioUrl: audioUrl, url: audioUrl, lastAudioUrlRecoveredAt: recoveredAt };",
        'playlist recovered timestamp',
    )

    start = library.find("  const handlePlayTrack = (track: any, subIndex: number = 0) => {")
    end = library.find("\n\n  // Cost guard: old/stale Suno rows", start)
    if start < 0 or end < 0:
        raise RuntimeError('990 handlePlayTrack range missing')

    replacement = r'''  const toAudioRecoveryMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.toMillis === 'function') {
      const parsed = value.toMillis();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.toDate === 'function') {
      const parsed = value.toDate().getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };

  const getAudioRecoveryBaseTime = (group: any): number => (
    toAudioRecoveryMillis(group?.lastAudioUrlRecoveredAt)
      || toAudioRecoveryMillis(group?.completedAt)
      || toAudioRecoveryMillis(group?.createdAt)
      || 0
  );

  const shouldRecoverAudioUrlBeforePlay = (group: any, item: any): boolean => {
    if (isSharedView || !group?.taskId) return false;
    const currentUrl = getAudioUrl(item, group);
    if (!currentUrl) return true;
    const baseTime = getAudioRecoveryBaseTime(group);
    return baseTime > 0 && Date.now() - baseTime >= SUNO_AUDIO_URL_RECOVERY_AFTER_MS;
  };

  const handlePlayTrack = async (track: any, subIndex: number = 0) => {
    let playGroup = track;
    let items = extractSunoData(playGroup);
    let item = items[subIndex] || {};
    let url = getAudioUrl(item, playGroup);

    if (shouldRecoverAudioUrlBeforePlay(playGroup, item)) {
      const recovered = await recoverSunoAudioUrl({
        url: url || '',
        audioUrl: url || '',
        parent: playGroup,
        index: subIndex,
        trackId: playGroup?.id || playGroup?.trackId || '',
        taskId: playGroup?.taskId || '',
      });
      if (recovered?.audioUrl) {
        const recoveredPlayable = applyRecoveredSunoAudioUrl({
          url: url || '',
          audioUrl: url || '',
          parent: playGroup,
          index: subIndex,
        }, recovered);
        playGroup = recoveredPlayable?.parent || playGroup;
        items = extractSunoData(playGroup);
        item = items[subIndex] || item;
        url = recovered.audioUrl;
      } else if (!url) {
        showToast('Music API에서 현재 재생 가능한 음원 링크를 찾지 못했습니다.');
        return;
      }
    }

    if (!url) return;

    const title = getTitle(item, playGroup, subIndex);
    const imageUrl = getImageUrl(item, playGroup);
    const creatorMeta = resolveCreatorSnapshot(playGroup, item, { fallbackToCurrentUser: true });
    markWorkspaceItemPlayed(playGroup, subIndex);

    let newQueue = allPlayables.map(p => {
      const queuedCreatorMeta = resolveCreatorSnapshot(p.group, p.item, { fallbackToCurrentUser: true });
      return {
        url: p.url,
        title: getTitle(p.item, p.group, p.idx),
        imageUrl: getImageUrl(p.item, p.group),
        parent: { ...p.group, ...queuedCreatorMeta, __workspaceContext: true, __libraryViewMode: 'workspace' },
        index: p.idx,
        creatorDisplayId: queuedCreatorMeta.creatorDisplayId,
        ownerNickname: queuedCreatorMeta.ownerNickname,
        creatorNickname: queuedCreatorMeta.creatorNickname,
        ownerEmail: queuedCreatorMeta.ownerEmail,
        creatorEmail: queuedCreatorMeta.creatorEmail,
        lyrics: p.item?.lyrics || p.item?.lyricsText || p.group?.lyrics || p.group?.lyricsText || null
      };
    });

    const parentId = String(playGroup?.id || playGroup?.trackId || '').trim();
    const currentQueueIndex = newQueue.findIndex((queued: any) => (
      String(queued?.parent?.id || queued?.parent?.trackId || '').trim() === parentId
      && Number(queued?.index ?? 0) === Number(subIndex)
    ));
    const currentQueueTrack = {
      url,
      title,
      imageUrl,
      parent: { ...playGroup, ...creatorMeta, __workspaceContext: true, __libraryViewMode: 'workspace' },
      index: subIndex,
      creatorDisplayId: creatorMeta.creatorDisplayId,
      ownerNickname: creatorMeta.ownerNickname,
      creatorNickname: creatorMeta.creatorNickname,
      ownerEmail: creatorMeta.ownerEmail,
      creatorEmail: creatorMeta.creatorEmail,
      lyrics: item?.lyrics || item?.lyricsText || playGroup?.lyrics || playGroup?.lyricsText || null
    };
    if (currentQueueIndex >= 0) newQueue[currentQueueIndex] = currentQueueTrack;
    else newQueue = [currentQueueTrack, ...newQueue];

    playTrack(currentQueueTrack, newQueue);
  };'''
    library = library[:start] + replacement + library[end:]

    library = replace_once(
        library,
        "                      const isCompleted = Boolean(audioUrl && (isCompletedStatus || hasValidDuration));\n                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl;",
        "                      const isCompleted = Boolean(audioUrl && (isCompletedStatus || hasValidDuration));\n                      const canRecoverPlaybackUrl = !isSharedView && Boolean(group.taskId) && (isCompletedStatus || hasValidDuration);\n                      const canPlayOrRecover = Boolean(audioUrl) || canRecoverPlaybackUrl;\n                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl;",
        'workspace recoverable state',
    )
    old_click = """                             if (audioUrl) {\n                               if (isCurrent) togglePlayPause();\n                               else handlePlayTrack(group, idx);\n                             }"""
    new_click = """                             if (canPlayOrRecover) {\n                               if (audioUrl && isCurrent) togglePlayPause();\n                               else void handlePlayTrack(group, idx);\n                             }"""
    if library.count(old_click) < 2:
        raise RuntimeError(f'990 expected two workspace play click anchors, found {library.count(old_click)}')
    library = library.replace(old_click, new_click, 2)
    library = replace_once(
        library,
        "                            disabled={!audioUrl}",
        "                            disabled={!canPlayOrRecover}",
        'workspace play button recovery enable',
    )
    LIBRARY.write_text(library, encoding='utf-8')


# Strict source verification.
service = SERVICE.read_text(encoding='utf-8')
library = LIBRARY.read_text(encoding='utf-8')
for fragment in [
    MARKER,
    'RECOVERY_NEGATIVE_CACHE_MS = 5 * 60 * 1000',
    'hasExplicitFailedUrl',
    'verified.includes(normalizedFailed)',
    'recoveredAt: Date.now()',
]:
    if fragment not in service:
        raise RuntimeError(f'990 service verification missing: {fragment}')
for fragment in [
    MARKER,
    'SUNO_AUDIO_URL_RECOVERY_AFTER_MS = 13 * 24 * 60 * 60 * 1000',
    'shouldRecoverAudioUrlBeforePlay',
    'recoverSunoAudioUrl({',
    'disabled={!canPlayOrRecover}',
    'lastAudioUrlRecoveredAt: recoveredAt',
]:
    if fragment not in library:
        raise RuntimeError(f'990 library verification missing: {fragment}')
if 'disabled={!audioUrl}' in library:
    raise RuntimeError('990 stale disabled={!audioUrl} remains in workspace player')
print('apply-990: aged/missing Library audio URL recovery restored with user-initiated cost guard')
