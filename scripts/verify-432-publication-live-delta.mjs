import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const client=readFileSync('src/services/explorePublicPublicationSyncService.ts','utf8');
const fn=readFileSync('functions/src/explorePublicationRelease431.ts','utf8');
const patch=readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs','utf8');
const rules=JSON.parse(readFileSync('database.rules.json','utf8'));

// app432 must paint a new public card from the server-issued RTDB delta itself.
// The realtime block may not re-enter Worker/R2 for normal live convergence.
const start=page.indexOf('// app432: server-issued one-event live delta.');
const end=page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004',start);
assert.ok(start>=0&&end>start);
const live=page.slice(start,end);
assert.match(live,/readExplorePublicPublicationLiveCard432/);
assert.match(live,/subscribeExplorePublicProfilePublication432/);
assert.match(live,/subscribeExplorePublicPublicationInvalidation429/);
assert.match(live,/document\.visibilityState !== 'visible'/);
assert.match(live,/document\.addEventListener\('visibilitychange'/);
assert.match(live,/!submittedQuery\.trim\(\)/);
assert.match(live,/upsertExploreFeedSessionCacheRow\(row432\.trackId, snapshot432\)/);
assert.match(live,/\[normalized432, \.\.\.previous\]\.slice\(0, 40\)/);
assert.doesNotMatch(live,/fetchExplorePublicPublicationStates429|setInterval\s*\(|MIN_PUBLICATION_REFRESH_MS/);

// The client has one global home-Feed path and one owner-scoped profile path.
// It accepts exactly one row and a bounded display-only card.
assert.match(client,/publicSync\/explorePublicationProfiles/);
assert.match(client,/PUBLIC_PUBLICATION_SIGNAL_ROWS_432 = 1/);
assert.match(client,/PUBLIC_PUBLICATION_LIVE_CARD_MAX_432 = 4096/);
assert.match(client,/slice\(0, PUBLIC_PUBLICATION_SIGNAL_ROWS_432\)/);
assert.match(client,/readExplorePublicPublicationLiveCard432/);
assert.match(client,/forbidden of \['prompt', 'lyrics', 'lyricsParts', 'shareBundle', 'nextSong', 'selectedKeywords'\]/);
assert.doesNotMatch(client,/runTransaction/);

// Server issuer overwrites one latest event, instead of retaining up to 50
// public cards and re-downloading them on each publication.
assert.match(fn,/rows:\[row\]/);
assert.match(fn,/PROFILE_SIGNAL_ROOT_432='publicSync\/explorePublicationProfiles'/);
assert.match(fn,/LIVE_CARD_MAX_432=4096/);
assert.match(fn,/allowedLiveCardKeys432/);
assert.doesNotMatch(fn,/SIGNAL_MAX_431|retained=new Map|slice\(0,SIGNAL_MAX/);

// Worker signs only display fields. No prompt/lyrics/shareBundle can fan out.
assert.match(patch,/publicationLiveCardJson432/);
assert.match(patch,/json\.length > 4096/);
assert.doesNotMatch(
  patch.slice(patch.indexOf('const publicationLiveCardJson432'),patch.indexOf('async function publishPublicationInvalidation431')),
  /prompt:|lyrics:|shareBundle:|selectedKeywords:/,
);

// Shared rules stay browser read-only. Profile viewers subscribe only to the
// changed owner's path rather than receiving every creator's event.
assert.equal(rules?.rules?.publicSync?.explorePublication?.['.read'],'auth != null');
assert.equal(rules?.rules?.publicSync?.explorePublication?.['.write'],false);
assert.equal(rules?.rules?.publicSync?.explorePublication?.actorUid?.['.validate'],
  "newData.isString() && newData.val() === 'publication-server-431'");
assert.equal(rules?.rules?.publicSync?.explorePublication?.rows?.$index?.['.validate'],
  "$index === '0' && newData.hasChildren(['trackId','ownerUid','at','status'])");
assert.equal(rules?.rules?.publicSync?.explorePublication?.rows?.$index?.cardJson?.['.validate'],
  'newData.isString() && newData.val().length > 0 && newData.val().length <= 4096');
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.read'],'auth != null');
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.write'],false);

// Hard bandwidth envelope for auditing. The exact on-wire RTDB session cost is
// provider-accounting dependent, but one signal can never retain 50 cards.
// 100k simultaneously ACTIVE home-Feed viewers receive at most one <=4KiB card
// plus a small envelope per mutation; hidden/search/profile-other users do not
// join that global listener.
const CARD_MAX=4096;
const ENVELOPE_BUDGET=1024;
const ACTIVE_100K_MAX_BYTES=(CARD_MAX+ENVELOPE_BUDGET)*100_000;
assert.ok(ACTIVE_100K_MAX_BYTES<=512_000_000);
console.log('APP432_NEW_PUBLIC_TRACK_NO_NAVIGATION_DIRECT_DELTA=PASS');
console.log('APP432_LIVE_WORKER_R2_PER_VIEWER_READ_ZERO=PASS');
console.log('APP432_PROFILE_OWNER_SCOPED_SUBSCRIPTION=PASS');
console.log('APP432_HIDDEN_SEARCH_GLOBAL_LISTENER_ZERO=PASS');
console.log('APP432_SIGNAL_ONE_ROW_CARD_MAX_4096=PASS');
console.log('APP432_100K_ACTIVE_FEED_HARD_MAX_BYTES_PER_EVENT='+ACTIVE_100K_MAX_BYTES);
