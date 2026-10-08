import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
function exact(name) {
  const start=source.indexOf('async function '+name+'(');
  const end=source.indexOf('\n}\n\n',start);
  assert.ok(start>=0 && end>start,'missing function '+name);
  return source.slice(start,end+2);
}
const writerFactory=new Function('deps',
  'const {validExploreProfileR2Bundle020,readFollowCutoverState348,mergeSharedProfile355,'+
  'exploreSharedProfileR2Key060,exploreSharedProfileAliasR2Key060,'+
  'normalizeSharedTrackCard062,exploreSharedTrackCardKey062,EXPLORE_SHARED_TRACK_CARD_SCHEMA_062}=deps;\n'+
  exact('writeExploreSharedProfile060')+'\n'+exact('writeSharedTrackCard062')+
  '\nreturn {profile:writeExploreSharedProfile060,card:writeSharedTrackCard062};');
const row=n=>({id:'song',ownerUid:'owner',likeCount:n,stats:{likeCount:n}});
const profile=(n,revision)=>({uid:'owner',handle:'owner',revision,body:{data:{revision,items:[row(n)]}}});
const clone=x=>JSON.parse(JSON.stringify(x));
function create() {
 let seq=0,inject=null;
 const objects=new Map(),usage={r2Reads:0,r2Writes:0,d1Writes:0};
 const save=(key,obj)=>objects.set(key,{etag:'E'+(++seq),body:clone(obj),customMetadata:{}});
 const bucket={
   async head(){return null;},
   async get(key){usage.r2Reads++;const o=objects.get(key);return o&&{etag:o.etag,customMetadata:o.customMetadata,text:async()=>JSON.stringify(o.body)};},
   async put(key,payload,options={}) {
     usage.r2Writes++;
     if(inject){const f=inject;inject=null;await f(key,save,objects);}
     const current=objects.get(key),c=options.onlyIf||{};
     if(c.etagMatches&&current?.etag!==c.etagMatches)return false;
     if(c.etagDoesNotMatch==='*'&&current)return false;
     save(key,JSON.parse(payload));return {etag:objects.get(key).etag};
   }
 };
 const deps={
   validExploreProfileR2Bundle020:x=>Boolean(x?.body?.data?.items),
   readFollowCutoverState348:async()=>({mode:'normal'}),
   mergeSharedProfile355:async(_,p)=>p,
   exploreSharedProfileR2Key060:uid=>'profile:'+uid,
   exploreSharedProfileAliasR2Key060:uid=>'alias:'+uid,
   normalizeSharedTrackCard062:x=>x,
   exploreSharedTrackCardKey062:id=>'card:'+id,
   EXPLORE_SHARED_TRACK_CARD_SCHEMA_062:1
 };
 const writer=writerFactory(deps);
 return {writer,env:{PROFILE_MEDIA:bucket},usage,objects,save,inject:f=>inject=f};
}
const get=(m,k)=>m.objects.get(k).body;
let passed=0;
async function test(name,run){await run();passed++;console.log('412_'+name+'=PASS');}
await test('OLD_PROFILE_CANNOT_ROLL_BACK_REPAIRED_COUNT',async()=>{
 const m=create();m.save('profile:owner',profile(1,5));
 await m.writer.profile(m.env,profile(0,4));
 assert.equal(get(m,'profile:owner').body.data.items[0].likeCount,1);
 assert.equal(m.usage.d1Writes,0);
});
await test('NEWER_PROFILE_CAN_APPLY_TRUE_UNLIKE',async()=>{
 const m=create();m.save('profile:owner',profile(1,5));
 await m.writer.profile(m.env,profile(0,6));
 assert.equal(get(m,'profile:owner').body.data.items[0].likeCount,0);
});
await test('PROFILE_CAS_COMPETITOR_RETRY',async()=>{
 const m=create();m.save('profile:owner',profile(0,4));
 m.inject((k,save)=>{if(k==='profile:owner')save(k,profile(1,8));});
 await m.writer.profile(m.env,profile(0,5));
 assert.equal(get(m,'profile:owner').body.data.items[0].likeCount,1);
});
await test('OLD_CARD_CANNOT_ROLL_BACK_REPAIRED_COUNT',async()=>{
 const m=create();m.save('card:song',{schemaVersion:1,card:row(1)});
 await m.writer.card(m.env,row(0));
 assert.equal(get(m,'card:song').card.likeCount,1);
});
await test('CANONICAL_CARD_PATCH_PRESERVES_UNLIKE',async()=>{
 const m=create();m.save('card:song',{schemaVersion:1,card:row(1)});
 await m.writer.card(m.env,row(0),{authoritativeLikeCount:true});
 assert.equal(get(m,'card:song').card.likeCount,0);
});
await test('CARD_CAS_COMPETITOR_RETRY',async()=>{
 const m=create();m.save('card:song',{schemaVersion:1,card:row(0)});
 m.inject((k,save)=>{if(k==='card:song')save(k,{schemaVersion:1,card:row(1)});});
 await m.writer.card(m.env,row(0));
 assert.equal(get(m,'card:song').card.likeCount,1);
});
await test('COLD_NEW_CARD_AND_PROFILE',async()=>{
 const m=create();
 await m.writer.profile(m.env,profile(0,1));
 await m.writer.card(m.env,row(0));
 assert.equal(get(m,'profile:owner').body.data.items[0].likeCount,0);
 assert.equal(get(m,'card:song').card.likeCount,0);
});
await test('NO_ADDED_D1_WRITE',async()=>{
 const m=create();await m.writer.card(m.env,row(0));
 assert.equal(m.usage.d1Writes,0);
});
console.log('412_ACTUAL_WORKER_SOURCE_PROTECTION=PASS '+passed+'/'+passed);
