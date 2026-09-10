import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
const root='cloudflare/explore-worker/';
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(root+'scripts/fixtures/canonical-schema.sql','utf8'));
const canonicalTables=['tracks','track_stats','public_profiles','profile_stats'];
const canonical=()=>JSON.stringify(canonicalTables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY 1').all()));
db.exec(`INSERT INTO public_profiles(uid,nickname,handle,created_at,updated_at) VALUES('u','Owner','owner',1,1);
INSERT INTO profile_stats(uid,follower_count,following_count,updated_at) VALUES('u',2,3,1);`);
const insert=(id,rank,owner='u')=>{
 db.prepare(`INSERT INTO tracks(id,owner_uid,source_type,source_id,title,suno_url_primary,published_at,created_at,updated_at) VALUES(?,?,'suno_library',?,?,?, ?,1,1)`).run(id,owner,id,id,'audio/'+id,rank);
 db.prepare('INSERT INTO track_stats(track_id,like_count,updated_at) VALUES(?,?,1)').run(id,rank);
};
for(let i=1;i<=65;i++)insert('t'+String(i).padStart(3,'0'),i);
const before=canonical();
db.exec(readFileSync(root+'migrations/20260910_01_explore_derived_state.sql','utf8'));
const seed=readFileSync(root+'migrations/20260910_02_explore_derived_seed.sql','utf8');
db.exec('BEGIN;'+seed+'COMMIT;');
assert.equal(canonical(),before,'seed never changes canonical data');
const seedState=JSON.stringify(db.prepare('SELECT * FROM explore_derived_state').all());
db.exec('BEGIN;'+seed+'COMMIT;');
assert.equal(JSON.stringify(db.prepare('SELECT * FROM explore_derived_state').all()),seedState,'seed replay no-op');
assert.equal(db.prepare('SELECT track_count FROM explore_derived_profiles WHERE uid=?').get('u').track_count,65);
console.log('PASS additive seed preserves canonical data; second seed is a no-op');
for(const [index,where,order] of [['idx_explore_rank_popular','active=1','likes DESC,published_at DESC,id DESC'],['idx_explore_rank_latest','active=1','published_at DESC,id DESC'],['idx_explore_rank_profile',"owner_uid='u' AND active=1",'pinned DESC,published_at DESC,id DESC']]) {
 const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM explore_derived_tracks INDEXED BY ${index} WHERE ${where} ORDER BY ${order} LIMIT 41`).all();
 assert.ok(plan.some(x=>x.detail.includes('COVERING INDEX '+index)));assert.ok(!plan.some(x=>/TEMP B-TREE|SCAN /.test(x.detail)));
}
console.log('PASS rank refill uses covering indexes; no tracks scan or temporary sort');
const objects=new Map(),counts={query:0,items:0,rank:0,put:0,conflict:0};let etag=0;
const env={DB:{prepare(sql){assert.doesNotMatch(sql,/\b(FROM|JOIN)\s+(tracks|track_stats|public_profiles|profile_stats)\b/i,'runtime cannot read canonical data');return {bind(...args){return {async first(){counts.query++;return db.prepare(sql).get(...args);},async all(){counts.query++;if(sql.includes('WHERE t.id IN'))counts.items+=args.length;if(sql.includes('INDEXED BY'))counts.rank++;return {results:db.prepare(sql).all(...args)};}};}};}},EXPLORE_CACHE:{
 async get(key){const v=objects.get(key);return v?{etag:v.etag,text:async()=>v.body}:null;},
 async put(key,body,options){counts.put++;assert.ok(options.onlyIf);const v=objects.get(key);if(options.onlyIf.etagMatches?v?.etag!==options.onlyIf.etagMatches:Boolean(v)){counts.conflict++;return null;}const saved={etag:String(++etag),body};objects.set(key,saved);return saved;}
}};
const edge=new Map();
const ctx=vm.createContext({console,Request,Response,URL,Date,Headers,TextEncoder,TextDecoder,btoa,atob,crypto,
 caches:{default:{async match(k){return edge.get(k.url)?.clone();},async put(k,v){edge.set(k.url,v.clone());}}},
 EXPLORE_R2_FEED_SCHEMA_VERSION:1,EXPLORE_R2_PROFILE_SCHEMA_VERSION:1,
 exploreCacheBucket031:e=>e.EXPLORE_CACHE,exploreFeedR2Key:s=>'feed/'+s,exploreProfileR2Key:u=>'profile/'+u,
 readExploreR2Json:async(e,k)=>objects.has(k)?JSON.parse(objects.get(k).body):null,
 readExploreProfileCanonicalR2Bundle020:async(e,u)=>objects.has('profile/'+u)?JSON.parse(objects.get('profile/'+u).body):null,
 writeExploreProfileAlias020:async()=>{},json:(data,status,headers)=>Response.json(data,{status,headers}),
 parseProfileGenres:raw=>JSON.parse(raw||'[]'),encodeCursor:v=>JSON.stringify(v),getExploreFeedItemLikeCount012:i=>i.stats.likeCount,
 mapTrackRow:r=>({id:r.id,ownerUid:r.owner_uid,ownerNickname:r.owner_nickname,ownerAvatarUrl:r.owner_avatar_url,title:r.title,publishedAt:r.published_at,profilePinned:!!r.profile_pinned,stats:{likeCount:r.like_count},audio:r.suno_url_primary}),
});
if (process.env.SORIDRAW_GENERATED_WORKER) {
 const source=readFileSync(process.env.SORIDRAW_GENERATED_WORKER,'utf8').replace(/export \{[\s\S]*?\};/g,'');
 vm.runInContext(source,ctx);
 ctx.exploreFeedR2Key=s=>'feed/'+s;ctx.exploreProfileR2Key=u=>'profile/'+u;
} else {
 vm.runInContext(readFileSync(root+'runtime/cache-mutations.js','utf8'),ctx);
 vm.runInContext(readFileSync(root+'runtime/derived-cache.js','utf8'),ctx);
}
const read=k=>JSON.parse(objects.get(k).body);
const sync=()=>ctx.syncDerivedFeeds032(env);
const reset=()=>{for(const k in counts)counts[k]=0;};
const expected=(sort)=>db.prepare(`SELECT id FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.is_public=1 AND t.status='published' ORDER BY ${sort==='popular'?'s.like_count DESC,':''}t.published_at DESC,t.id DESC LIMIT 40`).all().map(r=>r.id);
const accurate=()=>{for(const sort of ['latest','popular'])assert.deepEqual(read('feed/'+sort).payload.data.items.map(i=>i.id),expected(sort));};
await sync();accurate();await ctx.syncDerivedCache032(env,'latest','u');
reset();await sync();assert.equal(counts.items,0);assert.equal(counts.rank,0);assert.equal(counts.put,0);
const req=new Request('https://preview.example/v1/feed-revision?sort=popular');
await ctx.handleExploreFeedRevision019(req,new URL(req.url),env,{});reset();await ctx.handleExploreFeedRevision019(req,new URL(req.url),env,{});assert.equal(counts.query,0);assert.equal(counts.put,0);
console.log('PASS unchanged cursor: item/rank/write 0; warm revision Edge: all D1 reads 0');
db.prepare('UPDATE track_stats SET like_count=100 WHERE track_id=?').run('t001');reset();await sync();accurate();assert.equal(read('feed/popular').payload.data.items[0].id,'t001');assert.ok(counts.items<=3);
console.log('PASS old Worker stats write captured; outside popular promotion exact lookup only');
db.prepare('UPDATE track_stats SET like_count=0 WHERE track_id=?').run('t001');reset();await sync();accurate();assert.ok(counts.items<=3);
db.prepare('DELETE FROM tracks WHERE id=?').run('t065');await sync();accurate();
console.log('PASS popular drop/delete exact top40 refill without canonical query');
db.prepare('UPDATE tracks SET is_public=0 WHERE id=?').run('t064');await sync();accurate();await ctx.syncDerivedCache032(env,'latest','u');assert.equal(read('profile/u').body.data.profile.trackCount,63);
db.prepare('UPDATE tracks SET is_public=1 WHERE id=?').run('t064');await sync();accurate();
db.prepare('UPDATE public_profiles SET nickname=? WHERE uid=?').run('Changed','u');reset();await sync();assert.equal(counts.rank,0);assert.equal(counts.items,0);assert.ok(read('feed/popular').payload.data.items.every(i=>i.ownerNickname==='Changed'));
db.prepare('UPDATE profile_stats SET follower_count=9 WHERE uid=?').run('u');await ctx.syncDerivedCache032(env,'latest','u');assert.equal(read('profile/u').body.data.profile.followerCount,9);
console.log('PASS visibility/profile/follow deltas with exact profile count; metadata edits need no rank/item query');
db.prepare('UPDATE track_stats SET like_count=200 WHERE track_id=?').run('t002');db.prepare('UPDATE track_stats SET like_count=201 WHERE track_id=?').run('t003');reset();await Promise.all([sync(),sync()]);accurate();assert.ok(counts.conflict>0);assert.deepEqual(read('feed/popular').payload.data.items.slice(0,2).map(x=>x.id),['t003','t002']);reset();await sync();assert.equal(counts.put,0);
console.log('PASS concurrent consumers preserve both changes; cursor replay produces no writes');
objects.set('feed/latest',{etag:String(++etag),body:'corrupt'});await sync();accurate();
const pr=new Request('https://preview.example/v1/profiles/u/first-view');await ctx.handlePublicProfileFirstViewWithEdgeCache(pr,'u',env,{});reset();const response=await ctx.handlePublicProfileFirstViewWithEdgeCache(pr,'u',env,{});assert.equal(response.status,200);assert.equal(counts.query,0);assert.equal(counts.put,0);
console.log('PASS corrupted cache bounded recovery; healthy cold profile has no materialize/write; warm profile D1 0');
// Old Worker writes are ordinary canonical SQL, without any frontend cache helper.
const seqBeforeRollback=db.prepare('SELECT seq FROM explore_derived_state').get().seq;
db.exec('BEGIN');db.prepare('UPDATE tracks SET title=? WHERE id=?').run('rolled back','t004');db.exec('ROLLBACK');
assert.equal(db.prepare('SELECT seq FROM explore_derived_state').get().seq,seqBeforeRollback);
assert.notEqual(db.prepare('SELECT title FROM tracks WHERE id=?').get('t004').title,'rolled back');
db.prepare('UPDATE tracks SET title=? WHERE id=?').run('new title','t063');reset();await sync();assert.equal(counts.rank,0);
db.prepare('UPDATE tracks SET profile_pinned=1 WHERE id=?').run('t004');await ctx.syncDerivedCache032(env,'latest','u');
assert.equal(read('profile/u').body.data.items[0].id,'t004');
const profileCursor=read('profile/u').body.data.nextCursor;
if(process.env.SORIDRAW_GENERATED_WORKER) assert.ok(Object.hasOwn(ctx.decodeCursor(profileCursor),'profilePinned'));
else assert.ok(Object.hasOwn(JSON.parse(profileCursor),'profilePinned'));
// Each environment independently catches up after an old Worker writes shared data.
const previewObject=objects.get('feed/popular');
objects.delete('feed/popular');await ctx.syncDerivedCache032(env,'popular');const secondEnvironment=objects.get('feed/popular');
objects.set('feed/popular',previewObject);db.prepare('UPDATE track_stats SET like_count=300 WHERE track_id=?').run('t005');
await ctx.syncDerivedCache032(env,'popular');assert.equal(read('feed/popular').payload.data.items[0].id,'t005');
objects.set('feed/popular',secondEnvironment);await ctx.syncDerivedCache032(env,'popular');assert.equal(read('feed/popular').payload.data.items[0].id,'t005');
console.log('PASS atomic trigger rollback, display-only no-rank patch, pinned profile cursor, independent environment catch-up');
const runtime=readFileSync(root+'runtime/derived-cache.js','utf8');assert.doesNotMatch(runtime,/max-age=0/,'derived head edge cache must not be immediately stale');assert.match(runtime,/public,max-age=10/,'derived head edge cache must stay fresh for 10 seconds');assert.doesNotMatch(runtime,/buildExploreFeedR2Payload\(/);assert.doesNotMatch(readFileSync('src/services/exploreProfileFirstViewService.ts','utf8'),/__soridraw_shared_profile/);
console.log('PASS cost regression suite; live Cloudflare rows_read remains unverified (no deployment)');
