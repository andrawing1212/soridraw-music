import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fixture, functions, cutover, id } from './verify-354-follow-orchestration.mjs';

function consumerFixture() {
  const f = fixture();
  const cache = new Map(), deleted = [];
  for (const uid of ['actor','target','legacy','other']) {
    const row = f.records.get('profiles/' + uid), body = JSON.parse(row.body);
    body.body.data.profile.handle = uid + '_handle';
    row.body = JSON.stringify(body);
  }
  Object.assign(f.ctx, {
    readFollowCutoverState348: async () => cutover,
    readExploreSharedProfile060: async (_, ref) => {
      const uid = String(ref).replace(/^@/, '').replace(/_handle$/, '');
      const object = await f.env.PROFILE_MEDIA.get('profiles/' + uid);
      return object ? JSON.parse(await object.text()) : null;
    },
    readExploreSharedProfileByUid247: async (_, uid) => {
      const object = await f.env.PROFILE_MEDIA.get('profiles/' + uid);
      return object ? JSON.parse(await object.text()) : null;
    },
    writeExploreR2Json: async () => {}, exploreProfileR2Key: uid => 'local/' + uid,
    writeExploreProfileAlias020: async () => {}, exploreSharedProfileAliasR2Key060: h => 'aliases/' + h,
    EXPLORE_R2_FOLLOW_LIMIT: 5000, safeString: x => String(x || ''),
    decodeCursor: x => x ? JSON.parse(Buffer.from(x, 'base64url').toString()) : null,
    encodeCursor: x => Buffer.from(JSON.stringify(x)).toString('base64url'),
    getPublicProfileFirstViewEdgeCacheKey: (_, ref) => String(ref),
    caches: { default: {
      match: async key => cache.get(key)?.clone(),
      put: async (key, res) => cache.set(key, res.clone()),
      delete: async key => { deleted.push(key); return cache.delete(key); },
    } },
    clearSharedDataRevisionEdge031: async () => {},
    readPublicProfileFirstViewRevisionFromResponse: async r => r.headers.get('X-Revision'),
    withPublicProfileFirstViewEdgeHeader: r => r,
    withPublicProfileRevisionHeaders: (r, rev) => { r.headers.set('X-Revision', String(rev)); return r; },
    makePublicProfileFirstViewNotModified: (_, rev) => new Response(null, { status: 304, headers: { 'X-Revision': String(rev) } }),
    readSharedLikesState161: async () => ({ likedIds: [], exact: true, exactLikeCount: 0 }),
    readExploreFollowingR2Bundle: async () => { throw Error('overlay read legacy following'); },
    rebuildExploreFollowingR2Bundle: async () => { throw Error('overlay rebuilt legacy following'); },
    decodeTrackLyrics270: () => ({ combined: '' }), SORIDRAW_PUBLIC_SHARE_SCHEMA_015: 1,
  });
  for (const name of ['mergeSharedProfile355','readOverlayProfile355','readOverlayFollowing355',
    'handleOverlayFirstView355','readEffectiveFollowConnectionPage348','patchPublicProfileBundle245',
    'writeExploreSharedProfile060','handlePublicProfile','readSharedProfileConnection348',
    'handlePublicProfileFirstViewWithEdgeCache','handleMyFollowingR2Bundle','handleMySocialSnapshot042',
    'handleFollowerSaveAccess','invalidatePublicProfileFirstViewEdgeCacheCore031','invalidatePublicProfileFirstViewEdgeCache']) {
    vm.runInContext(functions.get(name), f.ctx);
  }
  return { ...f, cache, deleted };
}

// Actual stale profile writers, including a CAS conflict caused by a concurrent follow.
const p = consumerFixture(), stale = p.profile('target');
await p.call('actor','target',true,1001);
await p.ctx.patchPublicProfileBundle245(p.env,'target',{ nickname: 'edited' },'',stale);
assert.equal(p.profile('target').body.data.profile.followerCount,1);
assert.equal(p.profile('target').body.data.profile.nickname,'edited');
await p.ctx.writeExploreSharedProfile060(p.env,stale);
assert.equal(p.profile('target').body.data.profile.followerCount,1);
assert.equal(p.profile('target').followSync354.exact,true);
const race = consumerFixture(); let entered = false;
race.hooks(async (phase,key,body) => {
  if (!entered && phase === 'before' && key === 'profiles/target' && body.body?.data?.profile?.nickname === 'race') {
    entered = true; await race.call('actor','target',true,1002);
  }
});
await race.ctx.patchPublicProfileBundle245(race.env,'target',{ nickname: 'race' },'',race.profile('target'));
assert.equal(race.profile('target').body.data.profile.followerCount,1);
assert.equal(race.profile('target').body.data.profile.nickname,'race');

function failCountPut(f, target = 'target') {
  let once = false;
  f.hooks(async (phase,key,body) => {
    if (!once && phase === 'before' && key === 'profiles/' + target &&
        body.body?.data?.profile?.followerCount === 1 && !Object.keys(body.followSync354.pending).length) {
      once = true; throw Error('count_put_failed');
    }
  });
}
for (const reader of ['connection','profile','first-view']) {
  const f = consumerFixture(); failCountPut(f);
  await assert.rejects(f.call('actor','target',true,1010),/count_put_failed/); f.hooks();
  assert.equal(f.relation('actor','target'),1);
  // A profile edit while dirty must retain the recovery operation.
  await f.ctx.patchPublicProfileBundle245(f.env,'target',{ nickname: 'dirty edit' });
  assert.equal(Object.keys(f.profile('target').followSync354.pending).length,1);
  let profile;
  if (reader === 'connection') profile = await f.ctx.readSharedProfileConnection348(f.env,'target',1,cutover,new Request('https://fixture.invalid'));
  else if (reader === 'profile') profile = (await (await f.ctx.handlePublicProfile('target',f.env,{},new Request('https://fixture.invalid'))).json()).data.profile;
  else {
    f.cache.set('target_handle',new Response(JSON.stringify({ data: { profile: { followerCount: 0 } } }),{ headers: { 'X-Revision': '1' } }));
    const res = await f.ctx.handlePublicProfileFirstViewWithEdgeCache(new Request('https://fixture.invalid?knownRevision=1'),'target_handle',f.env,{});
    assert.equal(res.status,200); profile = (await res.json()).data.profile;
    assert.ok(f.deleted.includes('target_handle'));
    assert.ok(f.deleted.includes('actor_handle'));
  }
  assert.equal(profile.followerCount,1,reader);
  assert.equal(Object.keys(f.profile('target').followSync354.pending).length,0);
}
const missing = consumerFixture(); missing.records.delete('profiles/target');
await assert.rejects(missing.ctx.handlePublicProfile('target',missing.env,{}),{ code: 'FOLLOW_PROFILE_CACHE_UNAVAILABLE' });

const social = consumerFixture();
await social.call('actor','target',true,1020);
const req = new Request('https://fixture.invalid/v1/me/social-snapshot');
const snapshot = await (await social.ctx.handleMySocialSnapshot042(req,social.env,{})).json();
assert.deepEqual(snapshot.data.followingUids,['target','legacy']);
assert.equal(snapshot.data.followingComplete,true);
// Missing likes may run the existing like repair, but must not replace the effective follow list.
let likesReads = 0;
social.ctx.readSharedLikesState161 = async () => ++likesReads === 1 ? null : { likedIds: [],exact:true,exactLikeCount:0 };
social.ctx.rebuildExploreLikeR2Bundle = async () => {};
assert.deepEqual((await(await social.ctx.handleMySocialSnapshot042(req,social.env,{})).json()).data.followingUids,['target','legacy']);

const cap = consumerFixture();
cap.db.exec(`WITH RECURSIVE ids(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM ids WHERE n<5001)
  INSERT INTO follows SELECT 'actor','u'||n,n FROM ids;
  UPDATE profile_stats SET following_count=5002 WHERE uid='actor';`);
let actor = cap.profile('actor'); actor.body.data.profile.followingCount=5002;
cap.records.get('profiles/actor').body=JSON.stringify(actor);
const first = (await(await cap.ctx.handleMyFollowingR2Bundle(new Request('https://fixture.invalid'),cap.env,{})).json()).data;
assert.equal(first.followingUids.length,5000); assert.equal(first.followingComplete,false); assert.equal(first.truncated,true);
const second = (await(await cap.ctx.handleMyFollowingR2Bundle(new Request('https://fixture.invalid?cursor='+first.nextCursor),cap.env,{})).json()).data;
assert.equal(second.followingUids.length,2); assert.equal(second.followingComplete,false);
assert.equal(new Set([...first.followingUids,...second.followingUids]).size,5002);

const permission = consumerFixture();
permission.db.exec(`CREATE TABLE tracks(id TEXT,owner_uid TEXT,title TEXT,cover_url TEXT,duration_seconds INTEGER,
 lyrics TEXT,style TEXT,prompt TEXT,suno_url_primary TEXT,suno_url_secondary TEXT,source_type TEXT,source_id TEXT,
 source_subtrack_key TEXT,source_subtrack_index INTEGER,source_subtrack_id TEXT,allow_follower_save INTEGER,
 share_schema_version INTEGER,share_payload_json TEXT,is_public INTEGER,status TEXT);
 INSERT INTO tracks(id,owner_uid,allow_follower_save,is_public,status) VALUES('track','target',1,1,'published');`);
let result = await permission.call('actor','target',true,1030);
assert.equal((await(await permission.ctx.handleFollowerSaveAccess(req,permission.env,{},'track')).json()).data.allowed,true);
await permission.call('actor','target',false,1031,result.revision);
assert.equal((await(await permission.ctx.handleFollowerSaveAccess(req,permission.env,{},'track')).json()).data.allowed,false);

const noop = consumerFixture(); const followed = await noop.call('actor','target',true,1040);
const originalBatch=noop.env.DB.batch; let sums=0;
noop.env.DB.batch=async stmts=>{sums++;return originalBatch(stmts)};
const metrics=noop.metrics(); await noop.call('actor','target',true,1041,followed.revision);
assert.equal(sums,0); assert.equal(noop.metrics().writes-metrics.writes,1,'only the ordering receipt is required');
assert.equal(noop.metrics().changed-metrics.changed,0);

// Exercise the actual client rather than assuming absence means false.
function clientContext(path, stubs, expose='') {
  const source=readFileSync(path,'utf8'),ast=ts.createSourceFile(path,source,99,true);
  let stripped=source;for(const n of [...ast.statements].reverse())if(ts.isImportDeclaration(n)) stripped=stripped.slice(0,n.getStart(ast))+stripped.slice(n.end);
  const ctx={exports:{},console,...stubs};vm.createContext(ctx);
  vm.runInContext(ts.transpileModule(stripped,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+expose,ctx);
  return ctx;
}
const store=new Map();let targetReads=0;
const client=clientContext('src/services/exploreSocialService.ts',{
  EXPLORE_API_BASE:'https://fixture.invalid',getFirebaseAppCheckToken:async()=> 'fixture',
  recordCloudflareResponse:()=>{},recordCloudflareLocalCacheHit:()=>{},
  readSoridrawPersistentCache:o=>store.get(o.uid),writeSoridrawPersistentCache:o=>store.set(o.uid,{data:o.data}),
  getExplorePersonalSocialSnapshot:async()=>({followingUids:['known'],followingComplete:false}),
  fetch:async()=>{targetReads++;return new Response(JSON.stringify({data:{following:true}}))},
});
const user={uid:'viewer',getIdToken:async()=> 'fixture'};
assert.equal((await client.exports.getExploreFollowState(user,'omitted')).isFollowing,true);
assert.equal(targetReads,1);assert.equal(store.get('viewer').data.complete,false);
assert.equal((await client.exports.getExploreFollowState(user,'omitted')).isFollowing,true);assert.equal(targetReads,1);

// Upgrade an existing schema2 capped cache without resetting any cache/version.
const legacyStore=new Map();let legacyReads=0,legacyWrites=0;
let reply=true,fail=false;
const legacyClient=clientContext('src/services/exploreSocialService.ts',{
  EXPLORE_API_BASE:'https://fixture.invalid',getFirebaseAppCheckToken:async()=> 'fixture',
  recordCloudflareResponse:()=>{},recordCloudflareLocalCacheHit:()=>{},
  readSoridrawPersistentCache:o=>{assert.equal(o.schemaVersion,2);return legacyStore.get(o.uid)},
  writeSoridrawPersistentCache:o=>{assert.equal(o.schemaVersion,2);legacyWrites++;legacyStore.set(o.uid,{data:o.data})},
  getExplorePersonalSocialSnapshot:async()=>{throw Error('Partial-cache target must not hydrate a snapshot')},
  fetch:async(url)=>{
    assert.ok(url.endsWith('/follow-state'));legacyReads++;
    if(fail)throw Error('fixture network failure');
    return Response.json({data:{following:reply}});
  },
});
const legacyUser={...user,uid:'legacy-capped'};
const legacyStates=Object.fromEntries(Array.from({length:5000},(_,i)=>['known-'+i,true]));
legacyStates['known-negative']=false;
legacyStore.set(legacyUser.uid,{data:{complete:true,states:legacyStates}});
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'known-0')).isFollowing,true);
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'known-negative')).isFollowing,false);
assert.equal(legacyReads,0);assert.equal(legacyWrites,0);
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'omitted-followed')).isFollowing,true);
assert.equal(legacyReads,1);assert.equal(legacyWrites,1);
assert.equal(legacyStore.get(legacyUser.uid).data.complete,false);
assert.equal(legacyStore.get(legacyUser.uid).data.states['known-4999'],true);
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'omitted-followed')).isFollowing,true);
assert.equal(legacyReads,1);assert.equal(legacyWrites,1);
reply=false;
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'omitted-unfollowed')).isFollowing,false);
assert.equal(legacyReads,2);
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'omitted-unfollowed')).isFollowing,false);
assert.equal(legacyReads,2);
fail=true;const saved=legacyStore.get(legacyUser.uid);
await assert.rejects(legacyClient.exports.getExploreFollowState(legacyUser,'unknown-on-failure'),/fixture network failure/);
assert.equal(legacyStore.get(legacyUser.uid),saved);
assert.equal(Object.hasOwn(saved.data.states,'unknown-on-failure'),false);
fail=false;reply=true;
assert.equal((await legacyClient.exports.getExploreFollowState(legacyUser,'unknown-on-failure')).isFollowing,true);
// Known complete cache: both positive and absent targets remain read/write zero.
const healthy={...user,uid:'healthy'};
legacyStore.set(healthy.uid,{data:{complete:true,states:{known:true,...Object.fromEntries(Array.from({length:5000},(_,i)=>['negative-'+i,false]))}}});
const readsBefore=legacyReads,writesBefore=legacyWrites;
assert.equal((await legacyClient.exports.getExploreFollowState(healthy,'known')).isFollowing,true);
assert.equal((await legacyClient.exports.getExploreFollowState(healthy,'absent')).isFollowing,false);
assert.equal(legacyReads,readsBefore);assert.equal(legacyWrites,writesBefore);
const partial={...user,uid:'new-partial'};
legacyStore.set(partial.uid,{data:{complete:false,states:{known:true}}});
assert.equal((await legacyClient.exports.getExploreFollowState(partial,'missing')).isFollowing,true);
assert.equal(legacyReads,readsBefore+1);
console.log('FOLLOW355_LEGACY_SCHEMA2_CAPPED_CACHE_TARGET_RECOVERY_AND_HEALTHY_ZERO_READ=PASS');
const normalized=clientContext('src/services/exploreSocialSnapshotService.ts',{},'\nglobalThis.normalize=normalizeSnapshot;');
assert.equal(normalized.normalize({followingUids:Array.from({length:5000},(_,i)=>String(i))}).followingComplete,false);
assert.equal(normalized.normalize({followingUids:['target'],followingComplete:false,followProtocol:354}).followProtocol,354);

// Full handler cost: optionally replace only DB with a freshly owned remote D1.
// R2/native limiter are deterministic conditional fixtures, never live buckets.
export async function measureHttp355(query = null, prefix = '') {
  const f=consumerFixture(), samples=[];let sqlEvents=[], rateCalls=0;
  const actorUid=prefix+'actor',targetUid=prefix+'target';
  if(prefix)for(const uid of ['actor','target','legacy','other']){
    const old=f.records.get('profiles/'+uid),bundle=JSON.parse(old.body);
    bundle.uid=prefix+uid;bundle.body.data.profile.uid=prefix+uid;
    bundle.body.data.profile.handle=prefix+uid+'_handle';bundle.handle=prefix+uid+'_handle';
    f.records.set('profiles/'+prefix+uid,{...old,body:JSON.stringify(bundle)});
  }
  const original=f.env.DB.prepare;
  const prepare=(sql,params=[])=>({
    bind(...p){return prepare(sql,p)},
    async first(){const r=await execute('first',sql,params);return query?r.results?.[0]||null:r},
    async all(){return execute('all',sql,params)},async run(){return execute('run',sql,params)},
  });
  async function execute(method,sql,params){
    const r=query?await query(sql,params):await original(sql).bind(...params)[method]();
    sqlEvents.push({method,sql,meta:r?.meta||{}});return r;
  }
  f.env.DB={prepare,batch:async stmts=>Promise.all(stmts.map(s=>s.all()))};
  f.env.RATE_DB={prepare(){throw Error('unexpected RATE_DB access')}};
  f.env.LIKE_RATE_LIMITER={limit:async({key})=>{assert.equal(key,'follow:'+actorUid);rateCalls++;return{success:true}}};
  async function sample(name,following,n,expected,crash=false){
    sqlEvents=[];const before=f.metrics(),rateBefore=rateCalls;
    if(crash)failCountPut(f,targetUid);
    let response,error;
    try {response=await f.ctx.handleFollowOverlay354(new Request('https://fixture.invalid/v1/profiles/target/follow',{
      method:'POST',body:JSON.stringify({followOperationId:id(n),followExpectedRevision:expected})}),f.env,{},actorUid,targetUid,following,cutover)}
    catch(e){error=e}
    f.hooks();
    const after=f.metrics();
    const stats={name,status:response?.status||error?.code||error?.message,
      DB:{queryR:sqlEvents.filter(e=>e.method!=='run').length,queryW:sqlEvents.filter(e=>e.method==='run').length,
        ...(query?{rowsRead:sqlEvents.reduce((n,e)=>n+Number(e.meta.rows_read||0),0),rowsWritten:sqlEvents.reduce((n,e)=>n+Number(e.meta.rows_written||0),0)}:{sqliteChanges:after.changed-before.changed})},
      RATE_DB:{queryR:0,queryW:0,rowsWritten:0},R2Fixture:{putAttempts:after.putAttempts-before.putAttempts,getAttempts:after.reads-before.reads,successfulPuts:after.writes-before.writes},nativeLimiter:rateCalls-rateBefore};
    samples.push(stats);console.log('FOLLOW355_HTTP_COST='+JSON.stringify(stats));
    return response?(await response.json()).data:null;
  }
  const first=await sample('new-follow',true,1100,0);
  await sample('duplicate',true,1100,0);
  const same=await sample('new-id-noop',true,1101,first.revision);
  const off=await sample('unfollow',false,1102,same.revision);
  await sample('stale',true,1103,0);
  await sample('relation-saved-r2-failure',true,1104,off.revision,true);
  await sample('recovery-retry',true,1104,off.revision);
  assert.equal(f.profile(targetUid).body.data.profile.followerCount,1);
  if(query)assert.ok(samples.every(s=>s.DB.rowsWritten<=2),'HTTP physical W3+');
  assert.equal(samples[1].DB.queryW,0);assert.equal(samples[2].DB.queryW,0);
  return samples;
}
await measureHttp355();
// App380: native limiter and ordered abuse guard replace old follow-rate-v355.
// Actual durable R2/CAS/rolling rate limits are independently tested by 388.
const limits=consumerFixture();let nativeCalls=0;
limits.env.LIKE_RATE_LIMITER.limit=async({key})=>{
  assert.equal(key,'follow:actor');
  nativeCalls++;return{success:nativeCalls===1};
};
await limits.ctx.enforceFollowEdgeRateLimit355(limits.env,'actor','target',true,id(1400));
await assert.rejects(
  limits.ctx.enforceFollowEdgeRateLimit355(limits.env,'actor','target',true,id(1401)),
  {code:'RATE_LIMITED'});
assert.equal(nativeCalls,2);
limits.env.LIKE_RATE_LIMITER.limit=async()=>({success:false});
await assert.rejects(
  limits.ctx.enforceFollowEdgeRateLimit355(limits.env,'other','target',true,id(1402)),
  {code:'RATE_LIMITED'});
const newerWindow=consumerFixture();
newerWindow.env.LIKE_RATE_LIMITER.limit=async()=>{throw Error('native limiter offline')};
const rateBefore=newerWindow.metrics().writes;
await assert.rejects(
  newerWindow.ctx.enforceFollowEdgeRateLimit355(newerWindow.env,'actor','target',false,id(1403)),
  {code:'RATE_LIMIT_UNAVAILABLE'});
assert.equal(newerWindow.metrics().writes,rateBefore,'limiter outage must not write unrelated R2');
console.log('FOLLOW355_EIGHT_AUDIT_REPAIRS_ACTUAL_CONSUMERS_AND_HTTP_COST=PASS');
