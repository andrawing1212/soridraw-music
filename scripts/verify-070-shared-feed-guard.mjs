import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = process.env.SORIDRAW_GENERATED_WORKER;
if (!path) throw Error('Set SORIDRAW_GENERATED_WORKER for exact patched canonical Worker');
const source = readFileSync(path, 'utf8');
function getFunction(name) {
  const start = source.indexOf('async function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for(let i = brace; i < source.length; i++){
    const c=source[i],next=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&next==='/'){i++;comment='';}continue;}
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='/'&&next==='/'){i++;comment='line';continue;}
    if(c==='/'&&next==='*'){i++;comment='block';continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw Error('unterminated '+name);
}
for(const name of ['mirrorExploreSharedFeeds059','mirrorExploreSharedFeedAfterDerivedSync064']){
  const body=getFunction(name);
  assert.match(body,/disabledBy070: true/);
  assert.doesNotMatch(body,/\.put\(/);
}
console.log('070_ALL_LEGACY_FULL_SNAPSHOT_WRITERS_DISABLED=PASS');

const patched=getFunction('patchSharedFeedLikeCounts065');
assert.match(patched,/onlyIf: \{ etagMatches: object\.etag \}/);
assert.match(patched,/patchSharedTrackCard062/);
assert.doesNotMatch(patched,/env\.DB|\.prepare\s*\(/);

const records = new Map();
const logs = [];
let seq=1, conflict=true;
const seed=(key, items)=>records.set(key,{etag:String(seq++),data:{payload:{data:{items:structuredClone(items)}},updatedAt:1}});
seed('shared/latest',[{id:'private',likeCount:1},{id:'other',likeCount:2}]);
seed('shared/popular',[{id:'other',likeCount:2}]);
const shared={
  async get(key){const value=records.get(key);if(!value)return null;
    return {etag:value.etag,customMetadata:{},text:async()=>JSON.stringify(structuredClone(value.data))};
  },
  async put(key,body,opts){
    const existing=records.get(key);
    if(key==='shared/latest'&&conflict){
      conflict=false;
      seed(key, existing.data.payload.data.items.filter(x=>x.id!=='private'));
      return null;
    }
    assert.equal(opts?.onlyIf?.etagMatches,existing.etag);
    const next=JSON.parse(body);
    records.set(key,{etag:String(seq++),data:next});
    logs.push(key);
    return {};
  },
};
const cards=[];
const fn = new Function(
  'normalizeSharedLikeRows065','exploreSharedFeedR2Key059','patchSharedFeedItemLike065','patchSharedTrackCard062',
  patched+'\nreturn patchSharedFeedLikeCounts065;',
)(
  xs=>xs,
  sort=>'shared/'+sort,
  (item,count)=>({item:{...item,likeCount:count},changed:item.likeCount!==count}),
  async(_env,id,patch)=>{cards.push({id,patch});return true;},
);
const result=await fn({PROFILE_MEDIA:shared},[{trackId:'private',likeCount:5},{trackId:'other',likeCount:3}]);
assert.equal(result.changedFeeds,2);
assert.equal(result.changedCards,2);
assert.equal(records.get('shared/latest').data.payload.data.items.some(x=>x.id==='private'),false);
assert.equal(records.get('shared/latest').data.payload.data.items.find(x=>x.id==='other').likeCount,3);
assert.equal(records.get('shared/popular').data.payload.data.items.find(x=>x.id==='other').likeCount,3);
assert.deepEqual(new Set(logs),new Set(['shared/latest','shared/popular']));
console.log('070_CONCURRENT_PRIVATE_NOT_RESURRECTED_BY_LIKE=PASS');
console.log('070_TARGETED_LIKE_CARD_PATH_PRESERVED=PASS');
console.log('070_NO_D1_AND_NO_USER_ORIGIN_WRITE=PASS');
