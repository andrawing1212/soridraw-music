from pathlib import Path

LIBRARY = Path('src/pages/SunoLibraryPage.tsx')
SERVICE = Path('src/services/sunoAudioRecovery.ts')

library = LIBRARY.read_text(encoding='utf-8')
service = SERVICE.read_text(encoding='utf-8')

old_const = "const SUNO_AUDIO_URL_RECOVERY_AFTER_MS = 13 * 24 * 60 * 60 * 1000;\n// SORIDRAW_LIBRARY_AGED_AUDIO_RECOVERY_990\n"
if old_const not in library:
    raise SystemExit('991: aged recovery constant anchor missing')
library = library.replace(old_const, "// SORIDRAW_LIBRARY_PLAYBACK_FAILURE_RECOVERY_991\n", 1)

old_helpers = '''  const toAudioRecoveryMillis = (value: any): number => {
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
'''
new_helpers = '''  // Match the last known-good Vercel behavior: when a stored URL exists, try it
  // first and let GlobalPlayer recover only after a real playback failure. This
  // preserves the failed URL so recovery can reject it and select a different
  // verified provider URL. Only URL-less rows need pre-play recovery.
  const shouldRecoverAudioUrlBeforePlay = (group: any, item: any): boolean => {
    if (isSharedView || !group?.taskId) return false;
    return !getAudioUrl(item, group);
  };
'''
if old_helpers not in library:
    raise SystemExit('991: aged helper block anchor missing')
library = library.replace(old_helpers, new_helpers, 1)

old_prefix = "const RECOVERY_CACHE_PREFIX = 'soridraw.suno.audioRecovery.v2';"
new_prefix = "const RECOVERY_CACHE_PREFIX = 'soridraw.suno.audioRecovery.v3';\n// SORIDRAW_LIBRARY_PLAYBACK_FAILURE_RECOVERY_991"
if old_prefix not in service:
    raise SystemExit('991: recovery cache prefix anchor missing')
service = service.replace(old_prefix, new_prefix, 1)

old_choose = '''  const normalizedFailed = toText(failedUrl);
  const alternative = ordered.find((url) => !normalizedFailed || url !== normalizedFailed);
  if (alternative) return alternative;
  // The Function only exposes audioUrls after a byte probe succeeds. If the
  // provider refreshed the resource behind the same URL, one retry is safe.
  if (normalizedFailed && verified.includes(normalizedFailed)) return normalizedFailed;
  return normalizedFailed ? '' : (ordered[0] || '');
'''
new_choose = '''  const normalizedFailed = toText(failedUrl);
  // Restore the proven Vercel contract: after an actual playback failure, the
  // failed URL is never accepted as a recovery result. A different provider URL
  // (stream/source/audio) must be returned. URL-less recovery may use the first
  // verified/candidate URL because there is no failed source to exclude.
  if (normalizedFailed) return ordered.find((url) => url !== normalizedFailed) || '';
  return ordered[0] || '';
'''
if old_choose not in service:
    raise SystemExit('991: chooseRecoveredUrl anchor missing')
service = service.replace(old_choose, new_choose, 1)

for needle in [
    'SORIDRAW_LIBRARY_PLAYBACK_FAILURE_RECOVERY_991',
    'return !getAudioUrl(item, group);',
]:
    if needle not in library:
        raise SystemExit(f'991: library verification failed: {needle}')
for needle in [
    "soridraw.suno.audioRecovery.v3",
    "if (normalizedFailed) return ordered.find((url) => url !== normalizedFailed) || '';",
]:
    if needle not in service:
        raise SystemExit(f'991: service verification failed: {needle}')
if 'SUNO_AUDIO_URL_RECOVERY_AFTER_MS' in library:
    raise SystemExit('991: aged pre-play recovery constant still present')

LIBRARY.write_text(library, encoding='utf-8')
SERVICE.write_text(service, encoding='utf-8')
print('991: restored playback-failure-first recovery contract')
