import assert from 'node:assert/strict';
import {hash661,patchActiveProfileConnections661} from './lib/profile-connections-661.mjs';
// Run the transformed ACTIVE function using synthetic D1/R2 only.
const old=`async function handleProfileConnections(request, url, env, cors, profileRef, direction) {
  const resolved=await resolvePublicProfileRef(env,profileRef);
  const limit=Math.min(30,getPageSize(url));
  const cursor=decodeCursor(url.searchParams.get("cursor"));
  const cutover=await readFollowCutoverState348(env);
  if(cutover.mode==="overlay348"){
    const rows2=await readEffectiveFollowConnectionPage348(env,resolved.uid,direction,limit,cursor);
    const hasMore2=rows2.length>limit;
    const visible2=rows2.slice(0,limit);
    const items2 = (await Promise.all(
      visible2.map((row) => readSharedProfileConnection348(env, row.uid, row.followed_at, cutover, request).catch(() => null))
    )).filter(Boolean);
    const last2=visible2[visible2.length-1];
    return json({ok:true,data:{
      items: items2,
      nextCursor: hasMore2 && last2 ? encodeCursor({ followedAt: Number(last2.followed_at || 0), uid: String(last2.uid || "") }) : null
    }},200,cors);
  }
}
__name(handleProfileConnections,"handleProfileConnections");`;
const patched=patchActiveProfileConnections661(old,hash661(old));
assert.notEqual(patched,old);
assert.match(patched,/FROM public_profiles p LEFT JOIN profile_stats/);
assert.match(patched,/WHERE p\.is_public=1 AND p\.uid IN/);
assert.match(patched,/countComplete: !hasMore2 && !unresolved661/);
assert.match(patched,/hasUnresolvedProfiles: unresolved661/);
assert.match(patched,/ids661\.length/);
assert.doesNotMatch(patched,/DELETE FROM|INSERT INTO|UPDATE public_profiles/);
assert.throws(()=>patchActiveProfileConnections661(old),/SOURCE_SHA_DRIFT/);
const impl=patched.replace(/__name\(handleProfileConnections,[^)]*\);/,'');
const compile=(rows,hydrate,query)=>{
 let batches=0,sqls=[];
 const env={DB:{prepare(sql){sqls.push(sql);return {bind(...args){batches++;
  assert.ok(args.length<=31,'one bounded batch of max 30 UIDs');
  return {all:async()=>({results:await query(args,sql)})};
 }}}}};
 const get=new Function('resolvePublicProfileRef','getPageSize','decodeCursor',
 'readFollowCutoverState348','readEffectiveFollowConnectionPage348',
 'readSharedProfileConnection348','json','encodeCursor','clampExploreSocialCount',
 impl+';return handleProfileConnections;')(
 async()=>({uid:'owner'}),()=>30,()=>null,async()=>({mode:'overlay348'}),
 async()=>rows,async(_env,uid)=>hydrate(uid),
 v=>v,({followedAt,uid})=>uid+':'+followedAt,v=>Number(v)||0
 );
 return {run:()=>get(new Request('https://preview.example/v1/profiles/owner/followers'),
 new URL('https://preview.example/v1/profiles/owner/followers'),env,{},'owner','followers'),
 get batches(){return batches},get sqls(){return sqls}};
};
const rows=[{uid:'A',followed_at:200},{uid:'B',followed_at:100}];
const card=uid=>({uid,nickname:uid});
let m=compile(rows,uid=>card(uid),async()=>[]);
let r=await m.run();
assert.equal(r.data.items.length,2);
assert.equal(r.data.countComplete,true);
assert.equal(m.batches,0,'healthy R2 path has no extra D1');
m=compile(rows,uid=>uid==='A'?card(uid):null,async()=>[{
 uid:'B',nickname:'public-B',handle:'b',avatar_url:'',bio:'',
 follower_count:1,following_count:0
}]);
r=await m.run();
assert.deepEqual(r.data.items.map(x=>x.uid),['A','B']);
assert.equal(r.data.items[1].nickname,'public-B');
assert.equal(r.data.countComplete,true);
assert.equal(m.batches,1,'one missing public R2 card needs one indexed SELECT');
assert.match(m.sqls[0],/p\.is_public=1/);
m=compile(rows,uid=>uid==='A'?card(uid):null,async()=>[]);
r=await m.run();
assert.deepEqual(r.data.items.map(x=>x.uid),['A']);
assert.equal(r.data.countComplete,false,'private/missing profile cannot certify count');
assert.equal(r.data.hasUnresolvedProfiles,true);
m=compile(Array.from({length:31},(_,i)=>({uid:'U'+i,followed_at:100-i})),uid=>card(uid),async()=>[]);
r=await m.run();
assert.equal(r.data.items.length,30);
assert.equal(r.data.countComplete,false);
assert.ok(r.data.nextCursor);
assert.equal(m.batches,0);
m=compile(rows,uid=>uid==='A'?card(uid):null,async()=>{throw Error('D1_DOWN')});
await assert.rejects(()=>m.run(),/D1_DOWN/,'failure must not silently return an incomplete list');
console.log('APP661_BOUND_PUBLIC_R2_FALLBACK_ONE_QUERY_ON_MISS_ONLY=PASS');
console.log('APP661_MISSING_PRIVATE_ROW_NOT_EXACT_AND_NO_SECRET_LEAK=PASS');
console.log('APP661_COMPLETE_AND_PAGINATED_COUNT_PROOFS=PASS');
