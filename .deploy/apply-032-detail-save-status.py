from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text()

repls = []

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)

replace_once(
"""  const favoriteDetailFlushInFlightRef = useRef<Promise<void> | null>(null);\n  const favoriteDetailDraftPersistInFlightRef = useRef<Promise<void> | null>(null);\n  const [isSearchFocused, setIsSearchFocused] = useState(false);\n""",
"""  const favoriteDetailFlushInFlightRef = useRef<Promise<void> | null>(null);\n  const favoriteDetailDraftPersistInFlightRef = useRef<Promise<void> | null>(null);\n  const [favoriteDetailSaveStatus, setFavoriteDetailSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');\n  const [isSearchFocused, setIsSearchFocused] = useState(false);\n""",
'state',
)

replace_once(
"""    favoriteDetailPendingPatchRef.current = null;\n\n    const task = (async () => {\n      try {\n""",
"""    favoriteDetailPendingPatchRef.current = null;\n    setFavoriteDetailSaveStatus('saving');\n\n    const task = (async () => {\n      try {\n""",
'flush-saving',
)

replace_once(
"""        } else {\n          await clearMusicNoteDetailDraft(user.uid, pending.songId);\n        }\n      } catch (error) {\n""",
"""        } else {\n          await clearMusicNoteDetailDraft(user.uid, pending.songId);\n        }\n        setFavoriteDetailSaveStatus(favoriteDetailPendingPatchRef.current ? 'pending' : 'saved');\n      } catch (error) {\n""",
'flush-success',
)

replace_once(
"""        if (Object.keys(restoredUpdates).length === 0) {\n          favoriteDetailPendingPatchRef.current = null;\n          await clearMusicNoteDetailDraft(user.uid, pending.songId);\n          return;\n        }\n""",
"""        if (Object.keys(restoredUpdates).length === 0) {\n          favoriteDetailPendingPatchRef.current = null;\n          await clearMusicNoteDetailDraft(user.uid, pending.songId);\n          setFavoriteDetailSaveStatus('idle');\n          return;\n        }\n""",
'flush-failed-netzero',
)

replace_once(
"""        favoriteDetailPendingPatchRef.current = restored;\n        await writeMusicNoteDetailDraft(user.uid, restored.songId, restored.baseVersion, restored.updates);\n        clearFavoriteDetailFlushTimer();\n""",
"""        favoriteDetailPendingPatchRef.current = restored;\n        setFavoriteDetailSaveStatus('pending');\n        await writeMusicNoteDetailDraft(user.uid, restored.songId, restored.baseVersion, restored.updates);\n        clearFavoriteDetailFlushTimer();\n""",
'flush-retry-pending',
)

replace_once(
"""    if (Object.keys(updates).length === 0) {\n      favoriteDetailPendingPatchRef.current = null;\n      clearFavoriteDetailFlushTimer();\n""",
"""    if (Object.keys(updates).length === 0) {\n      favoriteDetailPendingPatchRef.current = null;\n      setFavoriteDetailSaveStatus(favoriteDetailFlushInFlightRef.current ? 'saving' : 'idle');\n      clearFavoriteDetailFlushTimer();\n""",
'queue-netzero',
)

replace_once(
"""    favoriteDetailPendingPatchRef.current = pending;\n\n    const persistTask = writeMusicNoteDetailDraft(user.uid, safeSongId, baseVersion, updates);\n""",
"""    favoriteDetailPendingPatchRef.current = pending;\n    setFavoriteDetailSaveStatus('pending');\n\n    const persistTask = writeMusicNoteDetailDraft(user.uid, safeSongId, baseVersion, updates);\n""",
'queue-pending',
)

replace_once(
"""      activeFavoriteEditorSongIdRef.current = selectedSongId;\n      favoriteEditorReadySongIdRef.current = selectedSongId;\n      popupOpenedSongIdRef.current = selectedSongId;\n      skipNextFavoriteDraftSaveRef.current = false;\n""",
"""      activeFavoriteEditorSongIdRef.current = selectedSongId;\n      favoriteEditorReadySongIdRef.current = selectedSongId;\n      popupOpenedSongIdRef.current = selectedSongId;\n      setFavoriteDetailSaveStatus(favoriteDetailPendingPatchRef.current?.songId === selectedSongId ? 'pending' : 'idle');\n      skipNextFavoriteDraftSaveRef.current = false;\n""",
'open-reset',
)

replace_once(
"""      popupOpenedSongIdRef.current = null;\n      activeFavoriteEditorSongIdRef.current = null;\n      favoriteEditorReadySongIdRef.current = null;\n      favoriteDetailServerBaselineRef.current = null;\n""",
"""      popupOpenedSongIdRef.current = null;\n      activeFavoriteEditorSongIdRef.current = null;\n      favoriteEditorReadySongIdRef.current = null;\n      favoriteDetailServerBaselineRef.current = null;\n      setFavoriteDetailSaveStatus('idle');\n""",
'close-reset',
)

replace_once(
"""                  <div className=\"text-[11px] font-bold uppercase tracking-[0.32em] text-[#FF8C85]\">music note detail</div>\n                  <h3 className=\"mt-1 text-[27px] font-bold tracking-tight text-white md:text-[32px]\">{isSelectedSongReadOnly ? '디테일' : '디테일 & Edit'}</h3>\n""",
"""                  <div className=\"flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.32em] text-[#FF8C85]\">\n                    <span className=\"shrink-0\">music note detail</span>\n                    {!isSelectedSongReadOnly && favoriteDetailSaveStatus !== 'idle' && (\n                      <span\n                        data-music-note-detail-save-status={favoriteDetailSaveStatus}\n                        className={cn(\n                          'min-w-0 truncate text-[10px] font-semibold normal-case tracking-normal',\n                          favoriteDetailSaveStatus === 'saved' ? 'text-emerald-300/70' : 'text-white/45'\n                        )}\n                      >\n                        {favoriteDetailSaveStatus === 'pending' ? '저장 대기' : favoriteDetailSaveStatus === 'saving' ? '저장 중…' : '저장됨'}\n                      </span>\n                    )}\n                  </div>\n                  <h3 className=\"mt-1 text-[27px] font-bold tracking-tight text-white md:text-[32px]\">{isSelectedSongReadOnly ? '디테일' : '디테일 & Edit'}</h3>\n""",
'header-status',
)

path.write_text(text)

verify = Path('scripts/verify-032-music-note-detail-save-status.mjs')
verify.write_text("""import fs from 'node:fs';\n\nconst page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');\nconst assert = (condition, message) => { if (!condition) throw new Error(message); };\n\nassert(page.includes(\"useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')\"), 'save status state missing');\nassert(page.includes(\"setFavoriteDetailSaveStatus('pending')\"), 'pending state missing');\nassert(page.includes(\"setFavoriteDetailSaveStatus('saving')\"), 'saving state missing');\nassert(page.includes(\"favoriteDetailPendingPatchRef.current ? 'pending' : 'saved'\"), 'saved transition missing');\nassert(page.includes('data-music-note-detail-save-status={favoriteDetailSaveStatus}'), 'status UI marker missing');\nassert(page.includes(\"favoriteDetailSaveStatus === 'pending' ? '저장 대기' : favoriteDetailSaveStatus === 'saving' ? '저장 중…' : '저장됨'\"), 'status labels missing');\nassert(page.includes('const MUSIC_NOTE_DETAIL_IDLE_FLUSH_MS = 60_000;'), '60s batching changed');\nassert(page.includes(\"await flushFavoriteDetailPendingPatch('detail-close');\"), 'detail-close flush missing');\nassert(page.includes(\"flushFavoriteDetailPendingPatch('page-exit')\"), 'page-exit flush missing');\nassert(page.includes('writeMusicNoteDetailDraft(user.uid'), 'IndexedDB draft safety missing');\n\nconsole.log('VERIFY_032_MUSIC_NOTE_DETAIL_SAVE_STATUS=PASS');\n""")

print('APPLY_032_DETAIL_SAVE_STATUS=PASS')
