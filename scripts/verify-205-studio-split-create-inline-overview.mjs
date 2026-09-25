import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const marker = 'data-studio-create-inline-overview="true"';
const markerIndex = app.indexOf(marker);
assert.ok(markerIndex >= 0, 'split Create inline overview must exist');

const start = app.lastIndexOf('{isStudioBlackActionMode', markerIndex);
const end = app.indexOf('</StudioBuilderPane>', markerIndex);
assert.ok(start >= 0 && end > start, 'inline overview must stay inside Studio Builder');
const block = app.slice(start, end);

assert.match(
  block,
  /isStudioBlackActionMode\s*&&\s*!isStudioCompactMobileLayout\s*&&\s*studioWorkspaceView === 'create'/,
  'inline overview must be split Create only and must not duplicate compact mobile',
);
assert.match(block, /liveSelectedKeywordItems\.map\(/, 'selected keywords must reuse the current in-memory selection');
assert.match(block, /removeLiveSelectedKeyword\(item\)/, 'inline keyword chips must keep the existing removal action');
assert.match(block, /history\.slice\(0, 10\)\.map\(/, 'inline recent list must be capped at the existing 10-song history');
assert.match(block, /selectStudioWorkspaceView\('recent'\)/, 'clicking an inline recent song must open the existing Recent workspace');
assert.match(block, /openStudioDashboardSong\(song, index\)/, 'inline recent song must reuse the existing open-song action');

for (const forbidden of ['getDoc(', 'getDocs(', 'onSnapshot(', 'fetch(', 'setDoc(', 'updateDoc(', 'addDoc(']) {
  assert.ok(!block.includes(forbidden), `inline overview must be render-only; forbidden token: ${forbidden}`);
}

console.log('APP205_SPLIT_CREATE_INLINE_KEYWORDS=PASS');
console.log('APP205_SPLIT_CREATE_RECENT_10=PASS');
console.log('APP205_COMPACT_MOBILE_NO_DUPLICATE=PASS');
console.log('APP205_RENDER_ONLY_ZERO_SERVER_IO=PASS');
