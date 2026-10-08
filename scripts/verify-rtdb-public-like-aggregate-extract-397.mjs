import assert from 'node:assert/strict';
import { extractChangedLikeTrackIds397 as pick } from '../cloudflare/explore-worker/runtime/like-confirmed-event-397.mjs';
const wrap = (added, removed, insertChanges=added.length, deleteChanges=removed.length) =>
  [{}, {}, {meta:{changes:insertChanges},results:added.map(track_id=>({track_id}))},
    {meta:{changes:deleteChanges},results:removed.map(track_id=>({track_id}))}];
function test(name, fn) { fn(); console.log(name+'=PASS'); }
test('EXACT_CHANGED_IDS',()=>assert.deepEqual(pick(wrap(['not-first-page','track-2'],['track-3'])),['not-first-page','track-2','track-3']));
test('DEDUP_WITHIN_COMPLETED_AGGREGATE',()=>assert.deepEqual(pick(wrap(['track-1','track-1'],['track-1'])),['track-1']));
test('ZERO_CHANGE_NO_SIGNAL',()=>assert.deepEqual(pick(wrap([],[])),[]));
test('FAIL_IF_RETURNING_MISSING',()=>assert.throws(()=>pick([{}, {}, {meta:{changes:1},results:[]},{meta:{changes:0},results:[]}]))); 
test('FAIL_IF_RESULTS_NULL',()=>assert.throws(()=>pick([{}, {}, {meta:{changes:1},results:null},{meta:{changes:0},results:[]}]))); 
test('FAIL_IF_INVALID_TRACK',()=>assert.throws(()=>pick(wrap([' malformed '],[]))));
test('FAIL_IF_OVER_CAP',()=>assert.throws(()=>pick(wrap(['a','b','c'],[]),2)));
test('FAIL_IF_BAD_METADATA',()=>assert.throws(()=>pick([{}, {}, {meta:{},results:[]},{meta:{changes:0},results:[]}]))); 
console.log('AGGREGATE_RESULT_EXTRACTION_ONLY__NO_D1_COST_OR_LIVE_SYNC_CLAIM');
