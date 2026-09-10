// Environment-local R2 cursors; shared D1 projections are maintained by SQL triggers.
const EXPLORE_DERIVED_CONTRACT_032 = 1;
async function derivedHead032(env, scope, request = null) {
  const key = request && new Request(new URL('/__derived032/' + encodeURIComponent(scope), request.url));
  if (key) { const hit = await caches.default.match(key); if (hit) return Number(await hit.text()); }
  const row = await env.DB.prepare(`SELECT seeded,
    COALESCE((SELECT seq FROM explore_derived_changes WHERE scope=? ORDER BY seq DESC LIMIT 1),0) AS seq
    FROM explore_derived_state WHERE id=1`).bind(scope).first();
  if (!row?.seeded) throw new Error('Explore derived state must be seeded before enabling runtime');
  const seq = Number(row.seq);
  if (key) await caches.default.put(key, new Response(String(seq), { headers: { 'Cache-Control': 'public,max-age=10' } }));
  return seq;
}
async function derivedProfile032(env, uid) {
  const row = await env.DB.prepare('SELECT * FROM explore_derived_profiles WHERE uid=?').bind(uid).first();
  if (!row?.active) return null;
  const p = JSON.parse(row.row_json);
  return { uid, nickname: p.nickname || '', avatarUrl: p.avatar_url || '', backgroundUrl: p.background_url || '',
    bio: p.bio || '', handle: p.handle || '', genres: parseProfileGenres(p.genre_override),
    socialLinks: { spotify: p.spotify_url || '', instagram: p.instagram_url || '', tiktok: p.tiktok_url || '' },
    followerCount: row.followers, followingCount: row.following, trackCount: row.track_count,
    createdAt: p.created_at, updatedAt: p.updated_at };
}
async function derivedItems032(env, ids) {
  if (!ids.length) return [];
  const rows = await env.DB.prepare(`SELECT t.row_json, p.row_json AS profile_json,p.active AS profile_active
    FROM explore_derived_tracks t LEFT JOIN explore_derived_profiles p ON p.uid=t.owner_uid
    WHERE t.id IN (${ids.map(() => '?').join(',')}) AND t.active=1`).bind(...ids).all();
  return rows.results.map(row => { const p = row.profile_active ? JSON.parse(row.profile_json) : {};
    return mapTrackRow({ ...JSON.parse(row.row_json), owner_nickname: p.nickname || '', owner_avatar_url: p.avatar_url || '' }); });
}
async function derivedRank032(env, sort, uid) {
  const limit = uid ? 51 : 41;
  const index = uid ? 'idx_explore_rank_profile' : sort === 'popular' ? 'idx_explore_rank_popular' : 'idx_explore_rank_latest';
  const order = uid ? 'pinned DESC,published_at DESC,id DESC' : sort === 'popular' ? 'likes DESC,published_at DESC,id DESC' : 'published_at DESC,id DESC';
  // Covering index reads only 41/51 IDs, never sorts/scans canonical tracks.
  const rows = await env.DB.prepare(`SELECT id FROM explore_derived_tracks INDEXED BY ${index}
    WHERE ${uid ? 'owner_uid=? AND ' : ''}active=1 ORDER BY ${order} LIMIT ${limit}`).bind(...(uid ? [uid] : [])).all();
  return rows.results.map(row => row.id);
}
function derivedCursor032(items, sort, uid, overflow) {
  if (!overflow || !items.length) return null;
  const last = items.at(-1);
  return encodeCursor({ ...(uid ? { profilePinned: last.profilePinned ? 1 : 0 } : sort === 'popular' ? { likeCount: getExploreFeedItemLikeCount012(last) } : {}),
    publishedAt: Number(last.publishedAt), id: last.id });
}
async function derivedNext032(env, previous, sort, uid, head) {
  const scope = uid ? 'profile:' + uid : 'feed';
  const oldData = uid ? previous?.body?.data : previous?.payload?.data;
  const healthy = Array.isArray(oldData?.items) && (!uid || oldData?.profile?.uid === uid);
  const cursor = previous?.derived032?.contract === EXPLORE_DERIVED_CONTRACT_032 ? Number(previous.derived032.cursor) : -1;
  if (healthy && cursor >= head) return null;
  const bootstrap = !healthy || cursor < 0;
  const changes = await env.DB.prepare(`SELECT kind,id,seq FROM explore_derived_changes
    WHERE scope=? AND seq>? AND seq<=? ORDER BY seq LIMIT 64`).bind(scope, Math.max(0,cursor),head).all();
  const events = changes.results;
  const nextSeq = bootstrap ? head : events.length === 64 ? Number(events.at(-1).seq) : head;
  const touched = new Set(events.filter(e => e.kind === 'track').map(e => e.id));
  const owners = new Set(events.filter(e => e.kind === 'profile').map(e => e.id));
  let items = healthy ? oldData.items : [];
  let overflow = Boolean(oldData?.nextCursor);
  if (bootstrap || touched.size) {
    const limit = uid ? 50 : 40;
    const old = new Map(items.map(item => [item.id,item]));
    const changed = new Map((await derivedItems032(env,bootstrap ? [] : [...touched])).map(item => [item.id,item]));
    const rankKey = item => [uid ? Number(item.profilePinned) : sort === 'popular' ? getExploreFeedItemLikeCount012(item) : 0,Number(item.publishedAt),item.id];
    const compare = (left,right) => { const a=rankKey(left),b=rankKey(right); for(let i=0;i<a.length;i++) { if(a[i]!==b[i]) return a[i]>b[i] ? -1 : 1; } return 0; };
    let rerank = bootstrap;
    for (const id of touched) {
      const prev = old.get(id), next = changed.get(id);
      if (prev && (!next || next.ownerUid !== (uid || next.ownerUid) || compare(prev,next)!==0)) rerank=true;
      if (!prev && next && (!uid || next.ownerUid===uid) && (items.length<limit || compare(next,items.at(-1))<0)) rerank=true;
    }
    if (rerank) {
      const ids=await derivedRank032(env,sort,uid);
      overflow=ids.length>limit;
      const visible=ids.slice(0,limit);
      const missing=visible.filter(id=>!changed.has(id) && (bootstrap || !old.has(id)));
      for(const item of await derivedItems032(env,missing)) changed.set(item.id,item);
      items=visible.map(id=>changed.get(id) || (!touched.has(id) ? old.get(id) : null)).filter(Boolean);
    } else items=items.map(item=>changed.get(item.id) || item);
    // A concurrent delete is captured at a later sequence; never resurrect its row.
  }
  const changedOwners=[...owners].filter(owner=>items.some(item=>item.ownerUid===owner));
  if(changedOwners.length) {
    const rows=await env.DB.prepare(`SELECT uid,active,row_json FROM explore_derived_profiles WHERE uid IN (${changedOwners.map(()=>'?').join(',')})`).bind(...changedOwners).all();
    const profiles=new Map(rows.results.map(row=>[row.uid,row.active?JSON.parse(row.row_json):{}]));
    items=items.map(item=>profiles.has(item.ownerUid)?{...item,ownerNickname:profiles.get(item.ownerUid).nickname||'',ownerAvatarUrl:profiles.get(item.ownerUid).avatar_url||''}:item);
  }
  const derived032 = { contract: EXPLORE_DERIVED_CONTRACT_032,cursor:nextSeq };
  const now = Date.now();
  if (!uid) return { ...previous, schemaVersion: EXPLORE_R2_FEED_SCHEMA_VERSION,sort,limit:40,updatedAt:now,derived032,
    payload:{ ok:true,data:{ ...oldData,items,sort,nextCursor:derivedCursor032(items,sort,null,overflow) } } };
  const profile = bootstrap || owners.has(uid) || touched.size ? await derivedProfile032(env,uid) : oldData.profile;
  const revision = Math.max(Number(previous?.revision || 0),Number(oldData?.revision || 0)) + 1;
  return { ...previous,schemaVersion:EXPLORE_R2_PROFILE_SCHEMA_VERSION,uid,handle:profile?.handle || '',revision,updatedAt:now,derived032,
    body:profile ? { ok:true,data:{ ...oldData,profile,items,nextCursor:derivedCursor032(items,sort,uid,overflow),revision,updatedAt:now,schemaVersion:oldData?.schemaVersion || 1 } } : { ok:false,data:{profile:null,items:[],revision} } };
}
async function syncDerivedCache032(env, sort, uid = null, request = null) {
  const key = uid ? exploreProfileR2Key(uid) : exploreFeedR2Key(sort);
  const scope = uid ? 'profile:' + uid : 'feed';
  const head = await derivedHead032(env,scope,request);
  // Retain 63d's retry/recompute CAS for every valid existing document.
  const result = await mutateExploreR2Cache052(env,key,previous => derivedNext032(env,previous,sort,uid,head));
  if (!result.ok) {
    for (let attempt=0;attempt<8;attempt++) {
      const baseline = await exploreCacheBucket031(env).get(key);
      let previous = null;
      if (baseline) { try { previous=JSON.parse(await baseline.text()); } catch {} }
      const next = await derivedNext032(env,previous,sort,uid,head);
      if (!next) break;
      const saved=await exploreCacheBucket031(env).put(key,JSON.stringify(next),{
        onlyIf:baseline ? {etagMatches:baseline.etag} : {etagDoesNotMatch:'*'},
        httpMetadata:{contentType:'application/json; charset=utf-8'},customMetadata:{updatedAt:String(next.updatedAt)} });
      if (saved) break;
      if (attempt===7) throw new Error('Explore derived initialization contention');
    }
  }
  return readExploreR2Json(env,key);
}
async function syncDerivedFeeds032(env) {
  await Promise.all(['latest','popular'].map(sort => syncDerivedCache032(env,sort)));
}
async function handleExploreFeedRevision019(request,url,env,cors) {
  const sort=url.searchParams.get('sort')==='popular'?'popular':'latest';
  const bundle=await syncDerivedCache032(env,sort,null,request);
  return json({ok:true,data:{sort,revision:String(bundle.derived032.cursor)}},200,cors);
}
async function ensureExploreSharedFeedCache031(request,env) {
  return syncDerivedFeeds032(env);
}
async function ensureExploreFeedIntegrity030(request,env) {
  return syncDerivedFeeds032(env);
}
async function handleFeedWithEdgeCache(request,url,env,cors) {
  if (url.searchParams.get('cursor') || Number(url.searchParams.get('limit') || 40)!==40)
    return handleFeedWithEdgeCacheD1Core(request,url,env,cors);
  const sort=url.searchParams.get('sort')==='popular'?'popular':'latest';
  const bundle=await syncDerivedCache032(env,sort,null,request);
  return json(bundle.payload,200,cors);
}
async function handlePublicProfileFirstViewWithEdgeCache(request,profileRef,env,cors) {
  const existing=await readExploreProfileCanonicalR2Bundle020(env,profileRef);
  let uid=existing?.uid || existing?.body?.data?.profile?.uid;
  if (!uid) {
    const ref=String(profileRef).replace(/^@+/,'');
    const row=await env.DB.prepare(`SELECT uid FROM explore_derived_profiles WHERE uid=?
      UNION SELECT uid FROM explore_derived_profiles WHERE json_extract(row_json,'$.handle')=? LIMIT 1`).bind(ref,ref).first();
    uid=row?.uid;
  }
  if (!uid) return json({ok:false,error:'Profile not found'},404,cors);
  const bundle=await syncDerivedCache032(env,'latest',uid,request);
  if (!bundle?.body?.data?.profile) return json({ok:false,error:'Profile not found'},404,cors);
  if (!existing || existing.handle !== bundle.handle) await writeExploreProfileAlias020(env,bundle.handle,uid);
  const revision=String(bundle.revision);
  const headers={...cors,'X-SORIDRAW-Profile-Revision':revision,'ETag':'"'+revision+'"',
    'Access-Control-Expose-Headers':'X-SORIDRAW-Profile-Revision, ETag'};
  if (new URL(request.url).searchParams.get('knownRevision')===revision) return new Response(null,{status:304,headers});
  return json(bundle.body,200,headers);
}
async function patchExploreFeedR2LikeCount(env,trackId,likeCount) { return syncDerivedFeeds032(env); }
async function syncExploreFeedR2Publication012(env,item) { return syncDerivedFeeds032(env); }
async function syncExploreFeedR2OptionPatch017(env,trackId,patch) { return syncDerivedFeeds032(env); }
async function syncExploreFeedR2Private017(env,trackId) { return syncDerivedFeeds032(env); }
async function refreshExploreFeedR2Bundles(env) { return syncDerivedFeeds032(env); }
async function patchExploreProfileR2Counters020(env,uid,patch) { return syncDerivedCache032(env,'latest',uid); }
async function patchExploreProfileR2Like020(env,uid,trackId,likeCount) { return syncDerivedCache032(env,'latest',uid); }
async function patchExploreProfileR2Mutation019(env,uid,change) { return syncDerivedCache032(env,'latest',uid); }
async function refreshPublicProfileFirstViewProfile(env,uid) {
  const bundle=await syncDerivedCache032(env,'latest',uid);
  return [uid,bundle?.handle].filter(Boolean);
}
async function materializePublicProfileFirstView(env,uid) {
  const bundle=await syncDerivedCache032(env,'latest',uid);
  return bundle?.body?.data?.profile ? { uid,handle:bundle.handle,schema_version:1,revision:bundle.revision,payload_json:JSON.stringify(bundle.body.data),next_cursor:bundle.body.data.nextCursor,updated_at:bundle.updatedAt } : null;
}
async function rebuildExploreProfileR2Bounded020(env,ref,knownBundle=null) {
  const uid=knownBundle?.uid || (await resolvePublicProfileRef(env,ref))?.uid;
  return uid ? syncDerivedCache032(env,'latest',uid) : null;
}
async function refreshPublicProfileFirstViewTrackWindow(env,uid,trackCountDelta=0) {
  return refreshPublicProfileFirstViewProfile(env,uid);
}
async function refreshOrPrebuildPublicProfileTrackWindow(env,uid,trackCountDelta=0) {
  return refreshPublicProfileFirstViewProfile(env,uid);
}
