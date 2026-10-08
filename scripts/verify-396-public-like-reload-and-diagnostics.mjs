import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual TS public-like helper against deterministic browser storage.
// This must not issue any Cloudflare/Firebase calls or alter like mutation code.
const service = readFileSync('src/services/explorePublicLikeSyncService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const overlay = readFileSync('src/components/CacheDiagnosticsOverlay.tsx', 'utf8');
const kv = new Map();
const storage = {
  getItem: key => kv.get(key) ?? null,
  setItem: (key, value) => kv.set(key, String(value)),
};
const loadService = () => {
  const output = ts.transpileModule(service, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: name => {
      if (name === '../config/exploreEnvironment') return { EXPLORE_API_BASE: 'https://example.invalid' };
      if (name === '../firebase') return { realtimeDb: {} };
      if (name === '../lib/cloudflareDiagnostics') return { recordCloudflareResponse() {} };
      if (name === 'firebase/database') return { onValue() {}, ref() {}, runTransaction() {} };
      throw new Error('Unexpected service dependency: ' + name);
    },
    window: { localStorage: storage },
    Date,
    URLSearchParams,
  });
  return exports;
};
let api = loadService();
const first = 1_790_000_000_000;
const accepted = first - 12_000;
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted, first), false);
api.rememberSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted, first);
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted, first), true);
api = loadService(); // browser reload/new React mount, same persistent device
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted, first + 1_000), true);
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted + 1, first + 1_000), false,
  'genuine newer like must be revalidated');
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-2', accepted, first + 1_000), false,
  'different changed track cannot be suppressed');
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-B', 'track-1', accepted, first + 1_000), false,
  'another signed-in account must be able to revalidate');
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted,
  first + 4 * 60_000 + 1), false, 'expired acknowledgement cannot hide later recovery');
api.rememberSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted + 1, first + 2_000);
assert.equal(api.hasSettledExplorePublicLikeSignal396('viewer-A', 'track-1', accepted + 1, first + 3_000), true);
assert.match(page, /if \(hasSettledExplorePublicLikeSignal396\(user\.uid, row\.trackId, row\.at\)\) continue/);
assert.match(page, /if \(!card \|\| card\.updatedAt < row\.at\) continue;[\s\S]*?patchExploreFeedSessionCachesRow[\s\S]*?patchExploreLikedTrackCachedCount091\(user\.uid, row\.trackId, card\.likeCount\);[\s\S]*?rememberSettledExplorePublicLikeSignal396\(user\.uid, row\.trackId, row\.at\)/,
  'acknowledgement must happen only after settled R2 response and cached count update');
assert.match(page, /subscribeExplorePublicLikeInvalidation192/);
assert.match(page, /scheduleRefresh192\(5_000\)/, 'unresolved real change must retain bounded retry');
console.log('PUBLIC_LIKE_396_RELOAD_NO_REPEAT_WORKER_FOR_SETTLED_SIGNAL=PASS');
console.log('PUBLIC_LIKE_396_NEW_CHANGED_TRACK_AND_ACCOUNT_RECHECK=PASS');
console.log('PUBLIC_LIKE_396_CONFIRM_THEN_ACK_RETRY_PROTECTED=PASS');

// Check the exact rendering function, not the diagnostics accounting keys.
const start = overlay.indexOf('const getCloudflarePathLabel = ');
const end = overlay.indexOf('const readInitialPosition =', start);
assert.ok(start >= 0 && end > start);
const js = ts.transpileModule(overlay.slice(start, end), { compilerOptions: {
  target: ts.ScriptTarget.ES2022,
} }).outputText;
const render = vm.runInNewContext(js + '\ngetCloudflarePathLabel;', {});
assert.equal(render('/v1/public-like-cards'), '공개곡 좋아요 숫자 확인');
assert.equal(render('/v1/curated'), 'SORIDRAW 추천곡');
assert.equal(render('/v1/me/explore-management-access'), '추천곡 관리 권한 확인');
assert.equal(render('/v1/curated-revision'), '추천곡 변경 확인');
assert.equal(render('/v1/tracks/:id/like'), '좋아요 변경');
assert.equal(render('/v1/example-undocumented-endpoint'), '기타 서버 요청');
assert.doesNotMatch(render('/v1/example-undocumented-endpoint'), /\\/v1\\//);
console.log('CACHE_LIVE_396_KOREAN_ENDPOINT_TITLES=PASS');
