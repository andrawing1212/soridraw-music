from pathlib import Path

MARKER = 'SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_20260904'

service_path = Path('src/services/explorePublicationService.ts')
service = service_path.read_text(encoding='utf-8')
if MARKER not in service:
    anchor = """  const task = (async () => {\n    const result: Record<string, ExploreMusicNotePublicationState> = {};\n    let cursor = '';\n"""
    if service.count(anchor) != 1:
        raise SystemExit(f'publication service task anchor count mismatch: {service.count(anchor)}')
    replacement = """  const task = (async () => {\n    // SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_20260904\n    // Cold browsers read one per-user D1 bundle row. The owner-wide paged sweep is\n    // retained only as a recovery fallback for an unavailable/corrupt derived cache.\n    try {\n      const payload = await requestExplore(user, '/v1/me/music-note-publications-bundle');\n      const data = payload?.data;\n      const rawStates = data?.states;\n      const entries = rawStates && typeof rawStates === 'object' && !Array.isArray(rawStates)\n        ? Object.entries(rawStates as Record<string, any>)\n        : [];\n      const isValidBundle = Number(data?.schemaVersion || 0) === 1\n        && rawStates\n        && typeof rawStates === 'object'\n        && !Array.isArray(rawStates)\n        && Number(data?.itemCount ?? -1) === entries.length\n        && entries.every(([sourceId, value]) => Boolean(\n          String(sourceId || '').trim()\n          && String((value as any)?.trackId || '').trim(),\n        ));\n\n      if (!isValidBundle) {\n        throw new ExploreApiError(\n          'MUSIC_NOTE_PUBLICATION_BUNDLE_INVALID',\n          '뮤직노트 공개상태 번들을 확인하지 못했습니다.',\n        );\n      }\n\n      const bundledStates: Record<string, ExploreMusicNotePublicationState> = {};\n      entries.forEach(([sourceId, value]) => {\n        const state = value as any;\n        bundledStates[sourceId] = {\n          status: state?.status === 'public' ? 'public' : 'private',\n          trackId: String(state?.trackId || '').trim(),\n          allowNextSongApply: Boolean(state?.allowNextSongApply),\n          allowFollowerSave: Boolean(state?.allowFollowerSave),\n          profilePinned: Boolean(state?.profilePinned),\n        };\n      });\n\n      writePublicationStateCache(user.uid, bundledStates);\n      return clonePublicationStates(bundledStates);\n    } catch (bundleError) {\n      console.warn('[Explore publication] one-row bundle unavailable; using legacy recovery sweep.', bundleError);\n    }\n\n    const result: Record<string, ExploreMusicNotePublicationState> = {};\n    let cursor = '';\n"""
    service = service.replace(anchor, replacement, 1)
    service_path.write_text(service, encoding='utf-8')
    print('patched explorePublicationService.ts')
else:
    print('publication client bundle patch already applied')

overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
label_anchor = "  if (path === '/v1/me/publications') return '뮤직노트 공개상태';"
label_line = "  if (path === '/v1/me/music-note-publications-bundle') return '뮤직노트 공개상태';"
if label_line not in overlay:
    if overlay.count(label_anchor) != 1:
        raise SystemExit(f'CACHE LIVE label anchor count mismatch: {overlay.count(label_anchor)}')
    overlay = overlay.replace(label_anchor, label_anchor + '\n' + label_line, 1)
    overlay_path.write_text(overlay, encoding='utf-8')
    print('patched CacheDiagnosticsOverlay.tsx')
else:
    print('CACHE LIVE bundle label already applied')
