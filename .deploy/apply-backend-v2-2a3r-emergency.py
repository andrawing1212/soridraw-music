from pathlib import Path

MARKER = 'SORIDRAW_BACKEND_V2_2A3R_EMERGENCY_STABILIZATION'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'2-A3-R {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# 1) Preview App Check activation: exact preview hostname only.
path = Path('src/firebase.js')
source = path.read_text(encoding='utf-8')
if 'const isVercelPreviewApp =' not in source:
    source = replace_once(
        source,
        'const isVercelTestApp = currentHostname === "soridraw-music.vercel.app";\n',
        'const isVercelPreviewApp = currentHostname === "soridraw-music-git-preview-andrawing1212.vercel.app";\n'
        'const isVercelTestApp = currentHostname === "soridraw-music.vercel.app";\n',
        'preview hostname insertion',
    )
    source = replace_once(
        source,
        '// app and whose website-key domain list includes the Vercel test host and the\n// Firebase production hosts. AI Studio keeps the registered debug-provider\n',
        '// app and whose website-key domain list must include the exact Vercel preview/test hosts and\n// Firebase production hosts. AI Studio keeps the registered debug-provider\n',
        'app-check comment',
    )
    source = replace_once(
        source,
        'const shouldInitializeAppCheck = isAiStudioPreview || isVercelTestApp || isFirebaseHostedApp;\n',
        'const shouldInitializeAppCheck = isAiStudioPreview || isVercelPreviewApp || isVercelTestApp || isFirebaseHostedApp;\n',
        'preview app-check activation',
    )
path.write_text(source, encoding='utf-8')


# 2) Deduplicate default-playlist bootstrap reads within one SPA session.
path = Path('src/services/playlistService.ts')
source = path.read_text(encoding='utf-8')
if 'defaultPlaylistEnsurePromises' not in source:
    source = replace_once(
        source,
        "const isSamePlaylistSourceItem = (a: Partial<PlaylistItem> | any, b: Partial<PlaylistItem> | any) => {\n  const keyA = getPlaylistItemUniqueKey(a);\n  const keyB = getPlaylistItemUniqueKey(b);\n  return Boolean(keyA && keyB && keyA === keyB);\n};\n",
        "const isSamePlaylistSourceItem = (a: Partial<PlaylistItem> | any, b: Partial<PlaylistItem> | any) => {\n  const keyA = getPlaylistItemUniqueKey(a);\n  const keyB = getPlaylistItemUniqueKey(b);\n  return Boolean(keyA && keyB && keyA === keyB);\n};\n\n// 2-A3-R: default-playlist existence is a session bootstrap, not a tab-switch query.\n// Keep one successful promise per uid so My List <-> Shared List navigation cannot\n// re-scan the same V1 list collection over and over. Failures are removed so retry stays possible.\nconst defaultPlaylistEnsurePromises = new Map<string, Promise<void>>();\n",
        'playlist bootstrap cache insertion',
    )

    old = '''export const ensureDefaultPlaylists = async (uid: string) => {\n  if (!uid) return;\n\n  const listsRef = collection(db, 'user_playlists', uid, 'lists');\n  const listsSnap = await getDocs(listsRef);\n\n  let normalCount = 0;\n  let sharedCount = 0;\n\n  listsSnap.forEach((doc) => {\n    const data = doc.data() as Playlist;\n    if (data.type === 'normal') normalCount++;\n    if (data.type === 'shared') sharedCount++;\n  });\n\n  const batch = writeBatch(db);\n  let hasBatchOperations = false;\n\n  const defaultNormals = [\n    { title: '기본', order: 1 },\n    { title: '1', order: 2 },\n    { title: '2', order: 3 },\n    { title: '3', order: 4 }\n  ];\n\n  if (normalCount === 0) {\n    defaultNormals.forEach((def) => {\n      const newDocRef = doc(listsRef);\n      batch.set(newDocRef, {\n        title: def.title,\n        type: 'normal',\n        order: def.order,\n        isDefault: true,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n    });\n    hasBatchOperations = true;\n  }\n\n  const defaultShared = [\n    { title: '기본', order: 1 },\n    { title: '1', order: 2 },\n    { title: '2', order: 3 }\n  ];\n\n  if (sharedCount === 0) {\n    defaultShared.forEach((def) => {\n      const newDocRef = doc(listsRef);\n      batch.set(newDocRef, {\n        title: def.title,\n        type: 'shared',\n        order: def.order,\n        isDefault: true,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n    });\n    hasBatchOperations = true;\n  }\n\n  if (hasBatchOperations) {\n    try {\n      await batch.commit();\n    } catch (error) {\n      console.error("[Playlist] Failed to ensure default playlists:", error);\n    }\n  }\n};'''

    new = '''const ensureDefaultPlaylistsInternal = async (uid: string) => {\n  const listsRef = collection(db, 'user_playlists', uid, 'lists');\n  const listsSnap = await getDocs(listsRef);\n\n  let normalCount = 0;\n  let sharedCount = 0;\n\n  listsSnap.forEach((doc) => {\n    const data = doc.data() as Playlist;\n    if (data.type === 'normal') normalCount++;\n    if (data.type === 'shared') sharedCount++;\n  });\n\n  const batch = writeBatch(db);\n  let hasBatchOperations = false;\n\n  const defaultNormals = [\n    { title: '기본', order: 1 },\n    { title: '1', order: 2 },\n    { title: '2', order: 3 },\n    { title: '3', order: 4 }\n  ];\n\n  if (normalCount === 0) {\n    defaultNormals.forEach((def) => {\n      const newDocRef = doc(listsRef);\n      batch.set(newDocRef, {\n        title: def.title,\n        type: 'normal',\n        order: def.order,\n        isDefault: true,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n    });\n    hasBatchOperations = true;\n  }\n\n  const defaultShared = [\n    { title: '기본', order: 1 },\n    { title: '1', order: 2 },\n    { title: '2', order: 3 }\n  ];\n\n  if (sharedCount === 0) {\n    defaultShared.forEach((def) => {\n      const newDocRef = doc(listsRef);\n      batch.set(newDocRef, {\n        title: def.title,\n        type: 'shared',\n        order: def.order,\n        isDefault: true,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n    });\n    hasBatchOperations = true;\n  }\n\n  if (hasBatchOperations) {\n    await batch.commit();\n  }\n};\n\nexport const ensureDefaultPlaylists = async (uid: string) => {\n  if (!uid) return;\n\n  const existing = defaultPlaylistEnsurePromises.get(uid);\n  if (existing) return existing;\n\n  const task = ensureDefaultPlaylistsInternal(uid).catch((error) => {\n    defaultPlaylistEnsurePromises.delete(uid);\n    console.error("[Playlist] Failed to ensure default playlists:", error);\n    throw error;\n  });\n  defaultPlaylistEnsurePromises.set(uid, task);\n  return task;\n};'''
    source = replace_once(source, old, new, 'default playlist bootstrap replacement')
path.write_text(source, encoding='utf-8')


# 3) Do not tear down/recreate the list listener when switching My List <-> Shared List.
path = Path('src/pages/SunoLibraryPage.tsx')
source = path.read_text(encoding='utf-8')
if 'const playlistLiveModeActive =' not in source:
    old = '''  useEffect(() => {\n    if (!user || (libraryViewMode !== 'playlist' && libraryViewMode !== 'sharedPlaylist') || isSharedView) {\n      if (!user) {\n        setPlaylists([]);\n      }\n      return;\n    }'''
    new = '''  const playlistLiveModeActive = libraryViewMode === 'playlist' || libraryViewMode === 'sharedPlaylist';\n\n  useEffect(() => {\n    if (!user || !playlistLiveModeActive || isSharedView) {\n      if (!user) {\n        setPlaylists([]);\n      }\n      return;\n    }'''
    source = replace_once(source, old, new, 'playlist listener mode guard')
    source = replace_once(
        source,
        '  }, [user, libraryViewMode, isSharedView]);\n\n  useEffect(() => {\n    playlistsRef.current = playlists;\n',
        '  }, [user?.uid, playlistLiveModeActive, isSharedView]);\n\n  useEffect(() => {\n    playlistsRef.current = playlists;\n',
        'playlist listener dependencies',
    )

# When future backend validation says the provider returned empty media, do not offer a broken URL as playable.
old_get_audio = '''  const getAudioUrl = (item: any, group: any) => {\n    return item?.audioUrl || item?.streamAudioUrl || item?.audio_url || item?.stream_audio_url || item?.sourceAudioUrl || item?.source_audio_url || item?.sourceStreamAudioUrl || item?.source_stream_audio_url || group?.audioUrl || group?.streamAudioUrl || group?.audio_url || group?.stream_audio_url || '';\n  };'''
if "audioValidationStatus === 'pending_or_empty'" not in source:
    new_get_audio = '''  const getAudioUrl = (item: any, group: any) => {\n    if (group?.audioValidationStatus === 'pending_or_empty' || group?.audioValidationStatus === 'missing') return '';\n    return item?.audioUrl || item?.streamAudioUrl || item?.audio_url || item?.stream_audio_url || item?.sourceAudioUrl || item?.source_audio_url || item?.sourceStreamAudioUrl || item?.source_stream_audio_url || group?.audioUrl || group?.streamAudioUrl || group?.audio_url || group?.stream_audio_url || '';\n  };'''
    source = replace_once(source, old_get_audio, new_get_audio, 'validated audio playback guard')
path.write_text(source, encoding='utf-8')


# 4) Never save a 0-byte MP3 as if download succeeded.
path = Path('src/lib/songUtils.ts')
source = path.read_text(encoding='utf-8')
if 'Audio download is empty' not in source:
    source = replace_once(
        source,
        '    const blob = await response.blob();\n    const blobUrl = URL.createObjectURL(blob);\n',
        "    const blob = await response.blob();\n    if (!blob || blob.size <= 0) throw new Error('Audio download is empty');\n    const blobUrl = URL.createObjectURL(blob);\n",
        'zero-byte download guard',
    )
path.write_text(source, encoding='utf-8')


# 5) Stage backend source hardening only. This source is NOT deployed by this workflow.
path = Path('functions/src/index.ts')
source = path.read_text(encoding='utf-8')
if 'const probeSunoAudioUrlHasBytes' not in source:
    helper = r'''const getSunoAudioCandidateUrls = (item: any): string[] => Array.from(new Set(
  [
    item?.audioUrl,
    item?.streamAudioUrl,
    item?.audio_url,
    item?.stream_audio_url,
    item?.sourceAudioUrl,
    item?.source_audio_url,
    item?.sourceStreamAudioUrl,
    item?.source_stream_audio_url,
  ]
    .map((value) => pickFirstString(value))
    .filter(Boolean)
));

const probeSunoAudioUrlHasBytes = async (url: string): Promise<boolean> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Range: "bytes=0-0" },
    });
    if (!response.ok) return false;

    const reader = response.body?.getReader();
    if (!reader) {
      const buffer = await response.arrayBuffer();
      return buffer.byteLength > 0;
    }

    const first = await reader.read();
    try { await reader.cancel(); } catch {}
    return Boolean(first.value && first.value.byteLength > 0);
  } catch (error: any) {
    console.warn("[Music API] audio validation probe failed", {
      host: parsed.hostname,
      message: error?.message || String(error),
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const findFirstUsableSunoAudioUrl = async (item: any): Promise<string> => {
  const candidates = getSunoAudioCandidateUrls(item);
  for (const candidate of candidates) {
    if (await probeSunoAudioUrlHasBytes(candidate)) return candidate;
  }
  return "";
};

'''
    source = replace_once(
        source,
        'export const getSunoTrackStatus = onRequest(\n',
        helper + 'export const getSunoTrackStatus = onRequest(\n',
        'audio validation helper insertion',
    )

    old_audio = '''      const audioUrls: string[] = sunoData\n        .map((item: any) => pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url))\n        .filter(Boolean);'''
    new_audio = '''      const reportedAudioUrls = Array.from(new Set(sunoData.flatMap((item: any) => getSunoAudioCandidateUrls(item))));\n      const verifiedAudioUrls: string[] = [];\n      for (const item of sunoData) {\n        const verified = await findFirstUsableSunoAudioUrl(item);\n        if (verified) verifiedAudioUrls.push(verified);\n      }\n      const allReportedAudioVerified = sunoData.length > 0 && verifiedAudioUrls.length === sunoData.length;'''
    source = replace_once(source, old_audio, new_audio, 'reported/verified audio split')

    old_status = '''        const hasAnyAudio = audioUrls.length > 0;\n        const hasAllAudio = sunoData.length > 0 && sunoData.every((item: any) => !!pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url));\n        const anyItemFailed = sunoData.some((item: any) => isFailedStatus(item?.status));\n        const allItemsCompleted = sunoData.length > 0 && sunoData.every((item: any) => isCompleteStatus(item?.status) || !!pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url));\n        const apiReportedComplete = isCompleteStatus(data?.status) || isCompleteStatus(responseData?.status) || isCompleteStatus(responseObj?.status);'''
    new_status = '''        const hasAnyAudio = verifiedAudioUrls.length > 0;\n        const hasAllAudio = allReportedAudioVerified;\n        const anyItemFailed = sunoData.some((item: any) => isFailedStatus(item?.status));\n        const allItemsCompleted = sunoData.length > 0 && sunoData.every((item: any) => isCompleteStatus(item?.status));\n        const apiReportedComplete = isCompleteStatus(data?.status) || isCompleteStatus(responseData?.status) || isCompleteStatus(responseObj?.status);'''
    source = replace_once(source, old_status, new_status, 'status audio verification')

    source = replace_once(
        source,
        '''        } else if (hasAnyAudio) {\n          // One result may be ready before the second one. Keep polling instead of freezing as completed.\n          status = "processing";\n        } else if (apiReportedComplete) {\n          // API can report SUCCESS before audio URLs become available. Keep polling.\n          status = "processing";''',
        '''        } else if (reportedAudioUrls.length > 0 || hasAnyAudio) {\n          // A URL string alone is not completion. Empty/temporarily unavailable media keeps polling.\n          status = "processing";\n        } else if (apiReportedComplete) {\n          // API can report SUCCESS before usable audio bytes become available. Keep polling.\n          status = "processing";''',
        'processing fallback',
    )

    source = replace_once(
        source,
        '''      const updates: any = {\n        apiStatusResponse: data,\n        sunoData: sunoData,\n        audioUrls: audioUrls,\n        updatedAt: admin.firestore.FieldValue.serverTimestamp()\n      };''',
        '''      const audioValidationStatus = allReportedAudioVerified\n        ? "verified"\n        : (reportedAudioUrls.length > 0 ? "pending_or_empty" : "missing");\n\n      const updates: any = {\n        apiStatusResponse: data,\n        sunoData: sunoData,\n        audioUrls: verifiedAudioUrls,\n        reportedAudioUrls: reportedAudioUrls,\n        audioValidationStatus,\n        updatedAt: admin.firestore.FieldValue.serverTimestamp()\n      };''',
        'track update audio validation fields',
    )

    old_final = '''      finalAudioUrl =\n        pickFirstString(\n          first?.audioUrl,\n          first?.streamAudioUrl,\n          first?.audio_url,\n          first?.stream_audio_url,\n          first?.sourceAudioUrl,\n          first?.sourceStreamAudioUrl,\n          responseObj?.audioUrl,\n          responseObj?.audio_url\n        );'''
    source = replace_once(source, old_final, '      finalAudioUrl = verifiedAudioUrls[0] || "";', 'verified final audio url')

    source = replace_once(
        source,
        '''        audioUrls: audioUrls,\n        sunoData: sunoData,\n        apiStatusResponse: data''',
        '''        audioUrls: verifiedAudioUrls,\n        reportedAudioUrls: reportedAudioUrls,\n        audioValidationStatus,\n        sunoData: sunoData,\n        apiStatusResponse: data''',
        'status response validation fields',
    )
path.write_text(source, encoding='utf-8')


# 6) Record the emergency state in repository handoff docs.
report = Path('docs/SORIDRAW_BACKEND_V2_STEP2A3R_EMERGENCY_STABILIZATION.md')
report.write_text('''# SORIDRAW Backend V2 · Step 2-A3-R Emergency Stabilization\n\nStatus: code staged on `preview`; authenticated Preview revalidation pending.\n\n## Trigger\n- Preview generated Music API track did not appear after refresh.\n- The same Firestore track appeared on the main/test app.\n- The created track was provider-reported `completed`, but read-only endpoint diagnostics found the candidate audio endpoints returning zero audio bytes.\n- Library My List / Shared List navigation showed repeated V1 playlist collection reads.\n\n## Risk review before modification\n- `src/App.tsx`, generation prompt construction, recent-song save, Music Note mutation paths, Firestore Rules and RTDB Rules remain no-touch.\n- Main and Firebase Hosting remain no-touch.\n- The reCAPTCHA Enterprise key configuration could not be read by the existing Actions service account because `recaptchaenterprise.keys.get` is not granted. No IAM permission was changed.\n- Because Preview currently does not initialize App Check while the test app does, the code change enables App Check only for the exact known Preview hostname. The domain must still be accepted by the existing reCAPTCHA Enterprise website key; authenticated Preview validation is required.\n\n## Changes staged\n1. `src/firebase.js`\n   - enable App Check on the exact Vercel Preview hostname only.\n2. `src/services/playlistService.ts`\n   - deduplicate `ensureDefaultPlaylists()` collection scans to one successful bootstrap per uid per SPA session.\n3. `src/pages/SunoLibraryPage.tsx`\n   - keep the same playlist-list listener when switching My List <-> Shared List instead of tearing it down and re-reading the same collection.\n   - honor future backend `audioValidationStatus` so invalid media is not offered as playable.\n4. `src/lib/songUtils.ts`\n   - reject zero-byte downloads instead of saving a fake 0 KB audio file.\n5. `functions/src/index.ts`\n   - source-only hardening: Music API status completion requires actual readable audio bytes, not only a non-empty URL string.\n   - candidate media URLs are probed with a one-byte range request and the first readable URL is selected.\n   - this Functions source is NOT deployed in Step 2-A3-R. It needs a separate backend deployment approval because the deployed Functions are shared by preview/test/production clients.\n\n## Safety boundaries\n- Firestore data migration: 0\n- Firestore deletes: 0\n- V2 reads/writes/shadow writes: 0\n- Rules deployment: 0\n- Functions deployment: 0\n- Firebase Hosting deployment: 0\n- Main branch modification: 0\n- New Music API generation required for this code-validation step: 0\n\n## Validation required\n1. Automated frontend type/lint + production build.\n2. Functions TypeScript no-deploy compile.\n3. Existing Step 2-A adapter safety workflow must remain green.\n4. User checks Preview Library: existing generated card should become visible after App Check succeeds.\n5. User switches My List <-> Shared List while diagnostics are visible and confirms the list-level read counter no longer repeats as before.\n6. Do not spend another Music API credit for this validation.\n\n## Known blocker / next gate\nThe zero-byte completion fix in `functions/src/index.ts` is not live until a separately approved Functions deployment. Do not deploy it implicitly as part of a preview frontend change.\n''', encoding='utf-8')

master = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
master_source = master.read_text(encoding='utf-8')
master_source = replace_once(
    master_source,
    'Status: IMPLEMENTATION / Step 2-A in progress — 2-A1 + 2-A2 complete, 2-A3 implemented and awaiting authenticated Preview validation\n',
    'Status: IMPLEMENTATION / Step 2-A3-R emergency stabilization staged on preview — authenticated Preview revalidation pending\n',
    'master status',
)
if '### 2-A3-R emergency stabilization staged' not in master_source:
    insertion = '''\n### 2-A3-R emergency stabilization staged — user revalidation pending\n- Triggered by authenticated Preview validation: provider track completed in backend but did not appear on Preview; the same track appeared on the main/test app.\n- Read-only diagnostics confirmed the generated record and two audio results existed, while candidate audio endpoints returned zero bytes.\n- Preview App Check code path was missing. Existing Actions credentials cannot inspect reCAPTCHA Enterprise allowed domains (`recaptchaenterprise.keys.get` denied); no IAM change was made.\n- Preview-only frontend App Check activation, playlist bootstrap/listener read dedupe and zero-byte download guard are staged.\n- Music API byte-validation hardening is staged in Functions source but is NOT deployed because Functions are shared backend infrastructure and require separate explicit deployment approval.\n- No V1 data, Rules, Functions deployment, main branch or Firebase Hosting has been modified by 2-A3-R.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2A3R_EMERGENCY_STABILIZATION.md`.\n\n'''
    master_source = replace_once(master_source, '\n## 9. Work stages and progress tracker\n', insertion + '## 9. Work stages and progress tracker\n', 'master 2-A3-R insertion')
master.write_text(master_source, encoding='utf-8')


# Final omission/self-review gates before CI even starts.
checks = {
    'src/firebase.js': ['isVercelPreviewApp', 'isVercelPreviewApp || isVercelTestApp'],
    'src/services/playlistService.ts': ['defaultPlaylistEnsurePromises', 'ensureDefaultPlaylistsInternal'],
    'src/pages/SunoLibraryPage.tsx': ['playlistLiveModeActive', "audioValidationStatus === 'pending_or_empty'"],
    'src/lib/songUtils.ts': ['blob.size <= 0', 'Audio download is empty'],
    'functions/src/index.ts': ['probeSunoAudioUrlHasBytes', 'verifiedAudioUrls', 'reportedAudioUrls', 'audioValidationStatus'],
}
for file, markers in checks.items():
    text = Path(file).read_text(encoding='utf-8')
    for marker in markers:
        if marker not in text:
            raise SystemExit(f'2-A3-R omission check failed: {marker} missing in {file}')

protected = ['src/App.tsx', 'firestore.rules', 'database.rules.json']
for file in protected:
    if not Path(file).exists():
        raise SystemExit(f'2-A3-R protected file unexpectedly missing: {file}')

print(f'Applied {MARKER}: preview App Check path, playlist read dedupe, zero-byte client guard, backend source validation (no deploy), docs.')
