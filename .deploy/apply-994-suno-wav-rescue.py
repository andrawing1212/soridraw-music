from pathlib import Path

path = Path('src/services/sunoAudioRecovery.ts')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_SUNO_WAV_RESCUE_994'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'994 {label} anchor count={count}')
    return source.replace(old, new, 1)


if marker not in text:
    text = replace_once(
        text,
        "const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';\n",
        "const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';\n"
        "const SUNO_WAV_RESCUE_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/rescueSunoTrackAudio';\n"
        f"{marker}\n",
        'endpoint',
    )

    helper_anchor = "export const recoverSunoAudioUrl = async (track: any, options?: { failedUrl?: string }): Promise<RecoveryResult | null> => {"
    helper = r'''const requestSunoWavRescue = async (track: any, context: ReturnType<typeof getTrackContext>): Promise<RecoveryResult | null> => {
  const user = auth.currentUser;
  if (!user || !context.trackId || !context.taskId || !context.subTrackId) return null;

  try {
    const token = await user.getIdToken();
    const appCheckToken = await getFirebaseAppCheckToken();
    const response = await fetch(SUNO_WAV_RESCUE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
      },
      body: JSON.stringify({
        trackId: context.trackId,
        taskId: context.taskId,
        audioId: context.subTrackId,
        index: context.index,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.audioUrl) {
      if (response.status !== 202) {
        console.warn('[Suno WAV Rescue] fallback unavailable', {
          status: response.status,
          code: payload?.code || '',
          pending: Boolean(payload?.pending),
        });
      }
      return null;
    }

    return {
      audioUrl: toText(payload.audioUrl),
      trackId: context.trackId,
      taskId: context.taskId,
      index: context.index,
      sunoData: null,
      raw: payload,
      recoveredAt: Date.now(),
    };
  } catch (error) {
    console.warn('[Suno WAV Rescue] request failed:', error);
    return null;
  }
};

'''
    if helper_anchor not in text:
        raise RuntimeError('994 recover helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

    old_failure = r'''      if (!response.ok || !payload) {
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const audioUrl = chooseRecoveredUrl(payload, track, failedUrl);'''
    new_failure = r'''      if (!response.ok || !payload) {
        if (hasExplicitFailedUrl && context.subTrackId) {
          const wavRescue = await requestSunoWavRescue(track, context);
          if (wavRescue?.audioUrl) {
            writeRecoverySuccess(user.uid, cacheKey, wavRescue.audioUrl);
            dispatchRecoveredAudioUrl(wavRescue);
            return wavRescue;
          }
        }
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const verifiedStatusUrls = Array.isArray(payload?.audioUrls)
        ? payload.audioUrls.map(toText).filter(Boolean)
        : [];

      // Aged provider records often keep URL strings after their bytes are gone.
      // If the server verified zero playable URLs, do not retry those dead strings.
      // Use the exact taskId + audioId WAV conversion path as the bounded last resort.
      if (hasExplicitFailedUrl && context.subTrackId && verifiedStatusUrls.length === 0) {
        const wavRescue = await requestSunoWavRescue(track, context);
        if (wavRescue?.audioUrl) {
          writeRecoverySuccess(user.uid, cacheKey, wavRescue.audioUrl);
          dispatchRecoveredAudioUrl(wavRescue);
          return wavRescue;
        }
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const audioUrl = chooseRecoveredUrl(payload, track, failedUrl);'''
    text = replace_once(text, old_failure, new_failure, 'fallback branch')

    path.write_text(text, encoding='utf-8')

verify = path.read_text(encoding='utf-8')
for expected in [
    marker,
    'SUNO_WAV_RESCUE_ENDPOINT',
    'requestSunoWavRescue',
    'verifiedStatusUrls.length === 0',
    'audioId: context.subTrackId',
]:
    if expected not in verify:
        raise RuntimeError(f'994 verification missing: {expected}')

print('apply-994-suno-wav-rescue: frontend fallback applied')
