import fs from 'node:fs';

const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(page.includes("useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')"), 'save status state missing');
assert(page.includes("setFavoriteDetailSaveStatus('pending')"), 'pending state missing');
assert(page.includes("setFavoriteDetailSaveStatus('saving')"), 'saving state missing');
assert(page.includes("favoriteDetailPendingPatchRef.current ? 'pending' : 'saved'"), 'saved transition missing');
assert(page.includes('data-music-note-detail-save-status={favoriteDetailSaveStatus}'), 'status UI marker missing');
assert(page.includes("favoriteDetailSaveStatus === 'pending' ? '저장 대기' : favoriteDetailSaveStatus === 'saving' ? '저장 중…' : '저장됨'"), 'status labels missing');
assert(!page.includes("flushFavoriteDetailPendingPatch('idle')"), 'idle server flush must stay disabled');
assert(!page.includes("flushFavoriteDetailPendingPatch('detail-close')"), 'detail-close server flush must stay disabled');
assert(page.includes("flushFavoriteDetailPendingPatch('page-exit')"), 'page-exit flush missing');
assert(page.includes('registerPageSyncHandler'), 'page sync coordinator missing');
assert(page.includes('writeMusicNoteDetailDraft(user.uid'), 'IndexedDB draft safety missing');

console.log('VERIFY_032_MUSIC_NOTE_DETAIL_SAVE_STATUS=PASS');
