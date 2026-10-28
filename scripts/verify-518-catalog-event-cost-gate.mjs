import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planFavoriteCatalogEvent518 } from '../cloudflare/media-worker/src/catalogEventGate518.js';

// Read the actual current Catalog projection whitelist. Do not maintain a
// second copied feature field list that can omit public/media/next-song fields.
const worker = readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const block = worker.match(/const MUSIC_NOTE_CATALOG_FIELDS = \[([\s\S]*?)\];/);
assert.ok(block, 'missing actual worker Music Note projection contract');
const fields = new Set([...block[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
for (const key of ['isPublic','title','appliedKeywords','sunoLinks','audioUrl',
  'folderId','saved','favoriteRemoved','hidden','isLocked','favoriteColor']) {
  assert.ok(fields.has(key), 'protect catalog field: ' + key);
}

const projection = (item, id) => {
  if (item.saved === false || item.favoriteRemoved === true || item.hidden === true
    || item.deletedAt || item.trashedAt || item.favoriteHidden === true) return null;
  const result = { id };
  for (const key of fields) {
    if (item[key] !== undefined) result[key] = item[key];
  }
  return result;
};
const uid = 'owner';
const documentId = 'favorite-1';
const base = { uid, title: 'Song', saved: true, isPublic: false,
  appliedKeywords: { style: ['indie'] }, audioUrl: 'https://example.test/song',
  isLocked: false, folderId: 'root', favoriteColor: '#aabbcc' };
const plan = (before, after, u=uid, id=documentId) => planFavoriteCatalogEvent518({
  uid:u, documentId:id, before, after, projectSummary:projection,
});
assert.equal(plan(base, {...base, transientEditorFocus:true}).code,'IGNORE_NO_CATALOG_CHANGE');
assert.equal(plan(base, {...base, nextSongTransientUiOnly:true}).canonicalReads,0,
  'next-song UI navigation must not cause any new canonical read or write');
assert.equal(plan(base, {...base, isPublic:true}).code, 'RECHECK_EXACT_CANONICAL',
  'visibility flip is relevant: preserve public/private');
assert.equal(plan(base, {...base, appliedKeywords:{style:['lofi']}}).canonicalReads,1,
  'applied keyword changes remain visible to existing next-song user flows');
assert.equal(plan(base, {...base, audioUrl:'https://example.test/updated'}).canonicalReads,1,
  'Suno media update must not be silently dropped');
assert.equal(plan(base, {...base, title:'Another'}).canonicalReads,1);
assert.equal(plan(base, {...base, folderId:'other'}).canonicalReads,1);
assert.equal(plan(base, {...base, saved:false}).code,'RECHECK_EXACT_CANONICAL');
assert.equal(plan(null, base).code,'RECHECK_EXACT_CANONICAL');
assert.equal(plan(base, null).code,'RECHECK_EXACT_CANONICAL');
assert.equal(plan(null,null).code,'IGNORE_EMPTY');
assert.equal(plan(base,{...base,uid:'intruder'}).code,'DENY_OWNER_MISMATCH');
assert.equal(plan(base,base,uid,'../wrong').code,'DENY_INVALID_EVENT');
const spoof = planFavoriteCatalogEvent518({uid,documentId,before:base,
  after:{...base,isPublic:true},projectSummary:() => ({id:'other'})});
assert.equal(spoof.code,'DENY_ID_MISMATCH');

// A stale Cloud Function event after a later delete is never accepted as a
// source of truth; the planner must mandate a fresh exact canonical check.
const meaningful = plan(base,{...base,isPublic:true});
assert.equal(meaningful.neverTrustEventAfter,true);
assert.equal(meaningful.canonicalReads,1);
assert.equal(meaningful.writes,0);
// Unchanged event storms must not add Cloudflare work/reads beyond the
// unavoidable Firebase trigger invocation itself.
for (let n=0; n<1000; n++) {
  const result=plan(base,{...base,sourceRevisionCounter:n});
  assert.equal(result.canonicalReads+result.writes,0);
}
console.log('APP518_EVENT_GATE_NO_CHANGE_R0_W0=PASS');
console.log('APP518_PUBLIC_PRIVATE_NEXT_SONG_MEDIA_FOLDER_PROJECTION=PASS');
console.log('APP518_EVENT_EXACT_CANONICAL_RECHECK_REQUIRED=PASS');
console.log('APP518_NO_LIVE_DB_OR_R2_IO=PASS');
