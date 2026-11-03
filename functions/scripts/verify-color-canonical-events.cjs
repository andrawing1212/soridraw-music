const assert=require('node:assert/strict');
const pure=require('../lib/colorCatalogEventPure.js');
const t={seconds:1793680000,nanoseconds:123456789};
assert.match(pure.firestoreTimestampNano(t),/\.123456789Z$/);
assert.equal(pure.firestoreTimestampNano(null),'');
const old={uid:'owner',saved:true,favoriteColorTag:'red'};
const reset={uid:'owner',saved:true,favoriteColorTag:null};
assert.equal(pure.colorEventNeeded('musicNote',old,reset),true);
assert.equal(pure.colorEventNeeded('musicNote',old,{...old,title:'edited'}),false);
assert.equal(pure.colorEventNeeded('musicNote',old,{...reset,saved:false}),false);
assert.equal(pure.colorEventNeeded('musicNote',null,old),true);
assert.equal(pure.colorEventNeeded('library',{colorTags:{'0':'red'}},{colorTags:{'0':null}}),true);
assert.equal(pure.colorEventNeeded('library',{colorTags:{'0':'red'}},{colorTags:{'0':'red'},title:'new'}),false);
const plan=pure.buildCanonicalColorDelivery({
 kind:'musicNote',uid:'owner',documentId:'id-1',eventId:'firebase-event-1',
 data:reset,sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
});
assert.equal(plan.canonical.favoriteColorTag,null);
assert.equal(plan.canonical.title,undefined);
assert.equal(pure.buildCanonicalColorDelivery({
 kind:'musicNote',uid:'owner',documentId:'id-1',eventId:'firebase-event-2',
 data:{...old,uid:'foreign'},sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
}),null);
const source= require('node:fs').readFileSync('functions/src/colorCatalogPublisher.ts','utf8');
assert.match(source,/retry:true/);
assert.match(source,/secrets:\[signingKey\]/);
assert.match(source,/latest = await ref\.get\(\)/);
assert.match(source,/if \(!latest\.exists\) return/);
assert.match(source,/createHmac\('sha256',secret\)/);
assert.doesNotMatch(source,/(?:\.set\(|\.update\(|\.delete\(|runTransaction\()/,
 'publisher must not write to Firestore');
console.log('FIRESTORE_COLOR_CHANGE_FILTER_AND_LATEST_CANONICAL_READ=PASS');
