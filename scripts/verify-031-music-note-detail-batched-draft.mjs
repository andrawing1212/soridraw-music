import fs from 'node:fs';

const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const detailCache = fs.readFileSync('src/lib/musicNoteDetailCache.ts', 'utf8');
const draft = fs.readFileSync('src/lib/musicNoteDetailDraft.ts', 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const block = (start, end) => {
  const from = page.indexOf(start);
  assert(from >= 0, `missing block start: ${start}`);
  const to = page.indexOf(end, from);
  assert(to > from, `missing block end: ${end}`);
  return page.slice(from, to);
};

assert(page.includes('const MUSIC_NOTE_DETAIL_IDLE_FLUSH_MS = 60_000;'), '60s idle flush missing');
assert(page.includes('favoriteDetailPendingPatchRef'), 'pending patch ref missing');
assert(page.includes('favoriteDetailServerBaselineRef'), 'server baseline ref missing');
assert(page.includes('pruneFavoriteDetailPatchAgainstBaseline'), 'net-change pruning missing');
assert(page.includes("await flushFavoriteDetailPendingPatch('detail-close');"), 'detail exit flush missing');
assert(page.includes("flushFavoriteDetailPendingPatch('page-exit')"), 'page exit flush missing');
assert(page.includes("prompt: catalogSummary ? prev.prompt"), 'catalog summary prompt preservation missing');
assert(page.includes('favoriteEditorReadySongIdRef.current === selectedSongId'), 'same-song editor reinit guard missing');
assert(page.includes('void openFavoriteDetail(song);'), 'Suno URL detail path bypasses hydration');
assert(page.includes('readMusicNoteDetailDraft(user.uid, sourceId)'), 'IndexedDB draft recovery missing');
assert(page.includes('favoriteDetailServerBaselineRef.current = { songId: sourceId, data: hydrated };'), 'hydrated server baseline missing');

const memo = block('  const saveMusicNoteMemo = async', '\n\n  const copyTextWithFallback');
assert(memo.includes('queueFavoriteDetailPatch(song.id'), 'memo does not use batched detail queue');
assert(!memo.includes('updateFavorite('), 'memo still writes Firestore immediately');

const commit = block('  const commitFavoriteDraftIfNeeded = async', '\n\n  const handleSave');
assert(commit.includes('queueFavoriteDetailPatch(payload.targetSongId, payload.updates)'), 'title/lyrics/prompt do not use batched detail queue');
assert(!commit.includes('await updateFavorite('), 'title/lyrics/prompt still write Firestore immediately');

const sunoSave = block('  const saveFavoriteSunoShareUrls = async', '\n\n  const saveFavoriteSunoShareUrl');
assert(sunoSave.includes("if (source === 'detail') queueFavoriteDetailPatch(song.id, updates);"), 'detail Suno URL save does not use batch queue');
assert(sunoSave.includes('else await updateFavorite(song.id, updates);'), 'non-detail Suno URL behavior changed unexpectedly');

const sunoRemove = block('  const removeFavoriteSunoShareUrl = async', '\n\n  const COLOR_SYNC_USAGE_KEY');
assert(sunoRemove.includes("if (source === 'detail') queueFavoriteDetailPatch(song.id, updates);"), 'detail Suno URL remove does not use batch queue');

const queue = block('  const queueFavoriteDetailPatch = (songId: string', '\n\n  useEffect(() => {\n    const flushOnPageExit');
assert(queue.includes('writeMusicNoteDetailDraft(user.uid'), 'pending changes are not persisted to IndexedDB');
assert(queue.includes('Object.keys(updates).length === 0'), 'net-zero edits do not collapse to zero writes');
assert(!queue.includes('patchMusicNoteDetailCache({'), 'pre-flush detail cache is mutated asynchronously');

const flush = block('  const flushFavoriteDetailPendingPatch = async', '\n\n  const scheduleFavoriteDetailFlush');
assert(flush.includes('await updateFavorite(pending.songId, pending.updates);'), 'single batched Firestore flush missing');
assert(flush.includes('await patchMusicNoteDetailCache({'), 'detail cache is not updated after successful flush');
assert(flush.includes('await clearMusicNoteDetailDraft'), 'successful flush does not clear recovery draft');
assert(flush.includes('baseVersion: committedVersion'), 'in-flight newer draft is not rebased after flush');

assert(draft.includes("indexedDB.open(DB_NAME, DB_VERSION)"), 'detail draft is not IndexedDB-backed');
assert(draft.includes('mergeMusicNoteDetailDraft'), 'detail draft merge helper missing');
assert(detailCache.includes('export const patchMusicNoteDetailCache'), 'detail cache patch API missing');
assert(detailCache.includes('sourceVersion: Math.max'), 'detail cache version is not advanced after flush');

console.log('VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS');
