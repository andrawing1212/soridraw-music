from pathlib import Path

path = Path('src/services/sunoAudioRecovery.ts')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_SUNO_EXISTING_WAV_REUSE_995'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'995 {label} anchor count={count}')
    return source.replace(old, new, 1)


if marker not in text:
    text = replace_once(
        text,
        "const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';\n",
        "const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';\n"
        "const SUNO_EXISTING_WAV_REUSE_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/rescueSunoTrackAudio';\n"
        f"{marker}\n",
        'endpoint',
    )

    helper_anchor = "export const recoverSunoAudioUrl = async (track: any, options?: { failedUrl?: string }): Promise<RecoveryResult | null> => {"
    helper = r'''const requestExistingSunoWavRescue = async (
  track: any,
  context: ReturnType<typeof getTrackContext>,
): Promise<RecoveryResult | null> => {
  const user = auth.currentUser;
  if (!user || !context.trackId || !context.taskId) return null;

  try {
    const token = await user.getIdToken();
    const appCheckToken = await getFirebaseAppCheckToken();
    const response = await fetch(SUNO_EXISTING_WAV_REUSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
      },
      body: JSON.stringify({
        trackId: context.trackId,
        taskId: context.taskId,
        ...(context.subTrackId ? { audioId: context.subTrackId } : {}),
        index: context.index,
        reuseOnly: true,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.audioUrl) {
      // 404 SUNO_RESCUE_NOT_PREVIOUSLY_RECOVERED is expected for tracks that
      // never spent a WAV rescue credit. Never escalate to a new WAV request here.
      return null;
    }

    const audioUrl = toText(payload.audioUrl);
    if (!audioUrl) return null;

    return {
      audioUrl,
      trackId: context.trackId,
      taskId: context.taskId,
      index: context.index,
      sunoData: null,
      raw: payload,
      recoveredAt: Date.now(),
    };
  } catch (error) {
    console.warn('[Suno Existing WAV Reuse] request failed:', error);
    return null;
  }
};

'''
    if helper_anchor not in text:
        raise RuntimeError('995 recover helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

    old_failure = r'''      if (!response.ok || !payload) {
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const audioUrl = chooseRecoveredUrl(payload, track, failedUrl);'''
    new_failure = r'''      if (!response.ok || !payload) {
        if (hasExplicitFailedUrl) {
          const existingRescue = await requestExistingSunoWavRescue(track, context);
          if (existingRescue?.audioUrl) {
            writeRecoverySuccess(user.uid, cacheKey, existingRescue.audioUrl);
            dispatchRecoveredAudioUrl(existingRescue);
            return existingRescue;
          }
        }
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const verifiedStatusUrls = Array.isArray(payload?.audioUrls)
        ? payload.audioUrls.map(toText).filter(Boolean)
        : [];

      // The provider can keep an expired cdn1.suno.ai URL string even after its
      // signed bytes are gone. When the status Function verifies zero playable
      // URLs, reuse a previously completed durable WAV rescue only. The backend
      // is explicitly called with reuseOnly:true, so this path cannot spend a
      // new Music API WAV credit.
      if (hasExplicitFailedUrl && verifiedStatusUrls.length === 0) {
        const existingRescue = await requestExistingSunoWavRescue(track, context);
        if (existingRescue?.audioUrl) {
          writeRecoverySuccess(user.uid, cacheKey, existingRescue.audioUrl);
          dispatchRecoveredAudioUrl(existingRescue);
          return existingRescue;
        }
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const audioUrl = chooseRecoveredUrl(payload, track, failedUrl);'''
    text = replace_once(text, old_failure, new_failure, 'zero-credit existing rescue branch')

    path.write_text(text, encoding='utf-8')

verify = path.read_text(encoding='utf-8')
for expected in [
    marker,
    'SUNO_EXISTING_WAV_REUSE_ENDPOINT',
    'requestExistingSunoWavRescue',
    'reuseOnly: true',
    'verifiedStatusUrls.length === 0',
    'SUNO_RESCUE_NOT_PREVIOUSLY_RECOVERED',
]:
    if expected not in verify:
        raise RuntimeError(f'995 verification missing: {expected}')

if '/api/v1/wav/generate' in verify:
    raise RuntimeError('995 frontend must never contain a WAV generation call')

print('apply-995-suno-existing-wav-reuse: zero-credit existing rescue reuse applied')
