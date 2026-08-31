from pathlib import Path

PATH = Path('src/services/sunoAudioRecovery.ts')
text = PATH.read_text(encoding='utf-8')

replacements = [
    (
        "const RECOVERY_CACHE_PREFIX = 'soridraw.suno.audioRecovery.v3';\n// SORIDRAW_LIBRARY_PLAYBACK_FAILURE_RECOVERY_991",
        "const RECOVERY_CACHE_PREFIX = 'soridraw.suno.audioRecovery.v4';\n// SORIDRAW_PROVEN_VERCEL_RECOVERY_992",
        'cache version',
    ),
    (
        "  // Restore the proven Vercel contract: after an actual playback failure, the\n  // failed URL is never accepted as a recovery result. A different provider URL\n  // (stream/source/audio) must be returned. URL-less recovery may use the first\n  // verified/candidate URL because there is no failed source to exclude.\n  if (normalizedFailed) return ordered.find((url) => url !== normalizedFailed) || '';\n  return ordered[0] || '';",
        "  // Restore the August 28 Vercel behavior that actually recovered aged tracks:\n  // prefer a different provider URL, but if record-info only returns the same URL,\n  // allow one forced reload of that URL. The resource behind an identical URL may\n  // have been refreshed/revalidated by the provider/CDN.\n  if (normalizedFailed) return ordered.find((url) => url !== normalizedFailed) || ordered[0] || '';\n  return ordered[0] || '';",
        'same-url fallback',
    ),
    (
        "  if (cached?.audioUrl && (!hasExplicitFailedUrl || cached.audioUrl !== failedUrl)) {",
        "  // Explicit playback/download failure is a user-requested recovery attempt.\n  // Never satisfy it from a previous recovery cache entry: hit record-info again.\n  if (!hasExplicitFailedUrl && cached?.audioUrl) {",
        'success cache bypass',
    ),
    (
        "  if (cached?.failedUntil && cached.failedUntil > Date.now()) {",
        "  // Negative cache is only for background/URL-less recovery. A user retry after\n  // an actual playback/download failure must be allowed immediately.\n  if (!hasExplicitFailedUrl && cached?.failedUntil && cached.failedUntil > Date.now()) {",
        'negative cache bypass',
    ),
    (
        "        body: JSON.stringify({\n          trackId: context.trackId,\n          taskId: context.taskId,\n          recoveryOnly: true,\n        }),",
        "        // Match the proven Vercel request contract: normal status refresh.\n        // This may refresh the provider/CDN state and lets the existing Function sync\n        // the single target track exactly as it did in the working deployment.\n        body: JSON.stringify({\n          trackId: context.trackId,\n          taskId: context.taskId,\n        }),",
        'normal status request',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'992 anchor missing: {label}')
    text = text.replace(old, new, 1)

required = [
    "soridraw.suno.audioRecovery.v4",
    "SORIDRAW_PROVEN_VERCEL_RECOVERY_992",
    "ordered.find((url) => url !== normalizedFailed) || ordered[0] || ''",
    "if (!hasExplicitFailedUrl && cached?.audioUrl)",
    "if (!hasExplicitFailedUrl && cached?.failedUntil",
    "body: JSON.stringify({\n          trackId: context.trackId,\n          taskId: context.taskId,\n        })",
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'992 verification failed: {needle}')
if 'recoveryOnly: true' in text:
    raise SystemExit('992 verification failed: recoveryOnly still present')

PATH.write_text(text, encoding='utf-8')
print('992: proven August 28 Vercel recovery contract restored')
