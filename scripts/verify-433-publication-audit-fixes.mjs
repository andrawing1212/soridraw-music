import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const policyTs=readFileSync('src/services/explorePublicationLivePolicy433.ts','utf8');
const verify432=readFileSync('scripts/verify-432-publication-live-delta.mjs','utf8');

const liveStart=page.indexOf('// app432: server-issued one-event live delta.');
const liveEnd=page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004',liveStart);
assert.ok(liveStart>=0&&liveEnd>liveStart);
const live=page.slice(liveStart,liveEnd);

// Recommendation and Latest must be explicit policy, not inferred from the
// internal latest backing URL used by the recommendation home screen.
assert.match(live,/shouldInsertExplorePublicationTrack433\(sort\)/);
assert.doesNotMatch(live,/isLatestFeed432/);

// A delayed public Edge response must be checked against the latest signal both
// before normalization/cache mutation and immediately before apply.
assert.match(live,/latestSignalByTrack433/);
assert.match(live,/recordLatestExplorePublicationSignal433\(latestSignalByTrack433, signalState433\)/);
assert.match(live,/isExplorePublicationPublicResponseCurrent433\(latestSignalByTrack433, signalState433\)/);
const recordAt=live.indexOf('recordLatestExplorePublicationSignal433(latestSignalByTrack433, signalState433)');
const privateAt=live.indexOf("if (row432.status === 'private')");
const fetchAt=live.indexOf('fetchExplorePublicPublicationLiveCard432(row432)');
assert.ok(recordAt>=0&&privateAt>recordAt&&fetchAt>privateAt);

// Execute the exact pure policy used by ExplorePage.
const transpiled=ts.transpileModule(policyTs,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const mod={exports:{}};
new Function('require','module','exports',transpiled)(createRequire(import.meta.url),mod,mod.exports);
const {
  shouldInsertExplorePublicationTrack433,
  recordLatestExplorePublicationSignal433,
  isExplorePublicationPublicResponseCurrent433,
}=mod.exports;

assert.equal(shouldInsertExplorePublicationTrack433('recommended'),true);
assert.equal(shouldInsertExplorePublicationTrack433('latest'),true);
assert.equal(shouldInsertExplorePublicationTrack433('popular'),false);

const ledger=new Map();
const publicRow={trackId:'music_note_owner_a',at:1000,status:'public',version:10};
const privateRow={trackId:'music_note_owner_a',at:1001,status:'private',version:11};
assert.equal(recordLatestExplorePublicationSignal433(ledger,publicRow),true);
assert.equal(isExplorePublicationPublicResponseCurrent433(ledger,publicRow),true);
assert.equal(recordLatestExplorePublicationSignal433(ledger,privateRow),true);
assert.equal(isExplorePublicationPublicResponseCurrent433(ledger,publicRow),false,
  'late public response must not resurrect a newer private state');
assert.equal(recordLatestExplorePublicationSignal433(ledger,{...publicRow,version:9}),false,
  'older signal version must not roll back latest state');

// Even if R2 timestamps collide within one millisecond, the newer server signal
// version still blocks the older public response.
const sameAtLedger=new Map();
const publicSameAt={trackId:'music_note_owner_b',at:2000,status:'public',version:20};
const privateSameAt={trackId:'music_note_owner_b',at:2000,status:'private',version:21};
assert.equal(recordLatestExplorePublicationSignal433(sameAtLedger,publicSameAt),true);
assert.equal(recordLatestExplorePublicationSignal433(sameAtLedger,privateSameAt),true);
assert.equal(isExplorePublicationPublicResponseCurrent433(sameAtLedger,publicSameAt),false);

// The old 115.2 MB "absolute max" was invalid because JS character length is
// not UTF-8 bytes and Firebase/protocol overhead was excluded. Keep only a
// measured application-body diagnostic and an explicit unverified billing flag.
assert.match(verify432,/Buffer\.byteLength\(serialized,'utf8'\)/);
assert.match(verify432,/APP432_100K_RTDB_WORKER_R2_BILLED_COST=UNVERIFIED_PREVIEW_MEASUREMENT_REQUIRED/);
assert.doesNotMatch(verify432,/115_200_000|HARD_MAX_BYTES|SIGNAL_OVERHEAD_BUDGET/);

console.log('APP433_RECOMMENDED_AND_LATEST_NEW_PUBLIC_INSERT_POLICY=PASS');
console.log('APP433_LATE_PUBLIC_RESPONSE_AFTER_PRIVATE_BLOCKED=PASS');
console.log('APP433_SAME_TIMESTAMP_NEWER_SIGNAL_VERSION_WINS=PASS');
console.log('APP433_UTF8_BYTE_DIAGNOSTIC_NOT_FALSE_ABSOLUTE_BOUND=PASS');
console.log('APP433_100K_REAL_BILLING=UNVERIFIED_PREVIEW_MEASUREMENT_REQUIRED');
