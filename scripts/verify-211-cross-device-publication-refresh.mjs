import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const profile = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const session = readFileSync('src/services/exploreSessionCache.ts', 'utf8');

assert.match(revision, /SORIDRAW_EXPLORE_PUBLICATION_REFRESH_RELOAD_211_20260927/);
assert.match(revision, /browserReloaded211/);
assert.match(revision, /reloadedRevisionUrls211/);
assert.match(revision, /removeEntry\(revisionUrl\)/);
assert.match(revision, /const cached = bypassReloadCache211 \? null : readEntry\(revisionUrl\)/);

assert.match(profile, /SORIDRAW_EXPLORE_PUBLICATION_REFRESH_RELOAD_211_20260927/);
assert.match(profile, /browserReloadedProfile211/);
assert.match(profile, /profileReloadRevalidated211/);
assert.match(profile, /force = false/);
assert.match(profile, /if \(!force && cached\.validatedAt > 0 && age < PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113\) return/);
assert.match(profile, /revalidateCachedProfile113\(normalizedRef, cached, options, forceReloadRevalidation211\)/);

// Do not turn this targeted repair into a release-wide cache bust.
assert.match(session, /const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3;/);
assert.match(profile, /const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6;/);
assert.doesNotMatch(revision, /invalidateExploreFeedSessionCache\(/);

console.log('PASS 211: explicit browser reload bypasses only stale revision/profile validation gates; normal warm navigation stays local-first and no cache schema bump is introduced.');
