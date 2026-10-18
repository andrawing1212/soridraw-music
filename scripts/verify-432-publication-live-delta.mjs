import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const client=readFileSync('src/services/explorePublicPublicationSyncService.ts','utf8');
const fn=readFileSync('functions/src/explorePublicationRelease431.ts','utf8');
const patch=readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs','utf8');
const rules=JSON.parse(readFileSync('database.rules.json','utf8'));

const start=page.indexOf('// app432: server-issued one-event live delta.');
const end=page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004',start);
assert.ok(start>=0&&end>start);
const live=page.slice(start,end);
assert.match(live,/fetchExplorePublicPublicationLiveCard432\(row432\)/);
assert.match(live,/subscribeExplorePublicProfilePublication432/);
assert.match(live,/subscribeExplorePublicPublicationInvalidation429/);
assert.match(live,/document\.visibilityState !== 'visible'/);
assert.match(live,/!submittedQuery\.trim\(\)/);
assert.match(live,/sort !== 'popular'/);
assert.match(live,/upsertExploreFeedSessionCacheRow\(row432\.trackId, snapshot432\)/);
assert.match(live,/\[normalized432, \.\.\.previous\]\.slice\(0, 40\)/);
assert.doesNotMatch(live,/fetchExplorePublicPublicationStates429|setInterval\s*\(|MIN_PUBLICATION_REFRESH_MS/);

assert.match(client,/publicSync\/explorePublicationProfiles/);
assert.match(client,/PUBLIC_PUBLICATION_SIGNAL_ROWS_432 = 1/);
assert.match(client,/PUBLIC_PUBLICATION_LIVE_CARD_ROUTE_432 = '\/v1\/publication-live-card'/);
assert.match(client,/fetchExplorePublicPublicationLiveCard432/);
assert.doesNotMatch(client,/cardJson|runTransaction/);

assert.match(fn,/rows:\[row\]/);
assert.match(fn,/PROFILE_SIGNAL_ROOT_432='publicSync\/explorePublicationProfiles'/);
assert.doesNotMatch(fn,/SIGNAL_MAX_431|retained=new Map|cardJson/);

assert.match(patch,/publicationLiveCard432/);
assert.match(patch,/handlePublicationLiveCard432/);
assert.match(patch,/caches\.default\.match\(edgeKey\)/);
assert.match(patch,/caches\.default\.put\(edgeKey/);
assert.match(patch,/const headers = publicationStateHeaders429\(cors,0\)/);
assert.match(patch,/PUBLICATION_LIVE_CARD_ROUTE_432/);
const liveHandler=patch.slice(
  patch.indexOf('async function handlePublicationLiveCard432'),
  patch.indexOf('function publicationStateHeaders429'),
);
assert.match(liveHandler,/requireExploreAuth\(request\.clone\(\)\)/);
assert.match(liveHandler,/state\.updatedAt !== updatedAt/);
assert.doesNotMatch(liveHandler,/env\?*\.DB|env\.DB|\.prepare\s*\(/);

assert.equal(rules?.rules?.publicSync?.explorePublication?.['.read'],'auth != null');
assert.equal(rules?.rules?.publicSync?.explorePublication?.['.write'],false);
assert.equal(rules?.rules?.publicSync?.explorePublication?.actorUid?.['.validate'],
  "newData.isString() && newData.val() === 'publication-server-431'");
assert.equal(rules?.rules?.publicSync?.explorePublication?.rows?.$index?.['.validate'],
  "$index === '0' && newData.hasChildren(['trackId','ownerUid','at','status'])");
assert.equal(rules?.rules?.publicSync?.explorePublication?.rows?.$index?.cardJson,undefined);
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.read'],'auth != null');
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.write'],false);

// Cost diagnostic only: measure UTF-8 bytes, never treat JS string length as
// billed bytes and never claim a 100k absolute billing/network ceiling.
const multibyteSignal={
  version:Number.MAX_SAFE_INTEGER,
  at:Number.MAX_SAFE_INTEGER,
  actorUid:'publication-server-431',
  rows:[{
    trackId:'가'.repeat(512),
    ownerUid:'나'.repeat(128),
    at:Number.MAX_SAFE_INTEGER,
    status:'public',
  }],
};
const serialized=JSON.stringify(multibyteSignal);
const UTF8_SAMPLE_BYTES=Buffer.byteLength(serialized,'utf8');
assert.ok(UTF8_SAMPLE_BYTES>serialized.length);
console.log('APP432_NEW_PUBLIC_TRACK_NO_NAVIGATION_EDGE_CARD=PASS');
console.log('APP432_R2_READ_EDGE_SHARED_NOT_PER_VIEWER=PASS');
console.log('APP432_PROFILE_OWNER_SCOPED_SUBSCRIPTION=PASS');
console.log('APP432_HIDDEN_SEARCH_POPULAR_GLOBAL_LISTENER_ZERO=PASS');
console.log('APP432_SIGNAL_ONE_ROW_NO_CARD_PAYLOAD=PASS');
console.log('APP432_UTF8_MULTIBYTE_SIGNAL_SAMPLE_BYTES='+UTF8_SAMPLE_BYTES);
console.log('APP432_100K_RTDB_WORKER_R2_BILLED_COST=UNVERIFIED_PREVIEW_MEASUREMENT_REQUIRED');
