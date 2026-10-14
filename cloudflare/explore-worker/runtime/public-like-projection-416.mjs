// Stage416 public projection materializer.
// Source-only / HARD OFF until independent audit and coordinated PREVIEW release.
// Reads only exact changed IDs plus one bounded popular top-41 rank. D1 writes 0.
export const PUBLIC_PROJECTION_CHUNK_416=50;
export const PUBLIC_FEED_LIMIT_416=40;

const cleanIds=(ids)=>{
 if(!Array.isArray(ids)||!ids.length)throw Error('416_PUBLIC_PROJECTION_NO_TRACKS');
 const out=[],seen=new Set();
 for(const raw of ids){
   const id=String(raw||'').trim();
   if(!id||id.length>512)throw Error('416_PUBLIC_PROJECTION_BAD_TRACK');
   if(!seen.has(id)){seen.add(id);out.push(id);}
 }
 return out;
};
const cardKey=id=>`internal/explore/shared-track-card-v115/${encodeURIComponent(id)}.json`;
const profileKey=uid=>`internal/explore/shared-profile-v113/${encodeURIComponent(uid)}.json`;
const feedKey=sort=>`internal/explore/shared-feed-v112/${sort==='popular'?'popular':'latest'}-40.json`;
const itemId=item=>String(item?.id||item?.trackId||'').trim();
const withCount=(item,count)=>({
 ...item,likeCount:count,
 ...(item?.stats&&typeof item.stats==='object'
   ?{stats:{...item.stats,likeCount:count}}:{}),
});
const parseJsonObject=async(object,label)=>{
 if(!object)return null;
 const value=JSON.parse(await object.text());
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label);
 return value;
};

export async function readCanonicalPublicLikeStates416(db,trackIds){
 if(!db?.prepare)throw Error('416_PUBLIC_PROJECTION_D1_UNAVAILABLE');
 const ids=cleanIds(trackIds);
 const states=new Map();let readQueries=0;
 for(let i=0;i<ids.length;i+=PUBLIC_PROJECTION_CHUNK_416){
   const chunk=ids.slice(i,i+PUBLIC_PROJECTION_CHUNK_416);
   const sql='SELECT t.id,t.owner_uid,COALESCE(s.like_count,0) AS like_count '+
     'FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id '+
     `WHERE t.id IN (${chunk.map(()=>'?').join(',')}) `+
     "AND t.is_public=1 AND t.status='published'";
   const result=await db.prepare(sql).bind(...chunk).all();readQueries++;
   for(const row of result?.results||[]){
     const id=String(row?.id||'').trim(),ownerUid=String(row?.owner_uid||'').trim();
     const count=Number(row?.like_count);
     if(!id||!ownerUid||!Number.isSafeInteger(count)||count<0)
       throw Error('416_PUBLIC_PROJECTION_CANONICAL_BAD');
     states.set(id,{trackId:id,ownerUid,likeCount:count});
   }
 }
 return {states,missingIds:ids.filter(id=>!states.has(id)),readQueries};
}

async function casJson416(r2,key,mutate,label){
 for(let attempt=0;attempt<8;attempt++){
   const object=await r2.get(key);
   if(!object)return {changed:false,cold:true,reads:1,writes:0};
   const before=await parseJsonObject(object,label+'_BAD_JSON');
   const next=mutate(before);
   if(next===null)return {changed:false,cold:false,reads:1,writes:0};
   const now=Date.now();
   const saved=await r2.put(key,JSON.stringify(next),{
     onlyIf:{etagMatches:object.etag},
     httpMetadata:{contentType:'application/json; charset=utf-8'},
     customMetadata:{...(object.customMetadata||{}),stage416Public:'1',updatedAt:String(now)},
   });
   if(saved)return {changed:true,cold:false,reads:1,writes:1};
 }
 throw Error(label+'_CAS_EXHAUSTED');
}

export async function patchExactPublicCards416(r2,states){
 let reads=0,writes=0;
 for(const state of states.values()){
   const result=await casJson416(r2,cardKey(state.trackId),bundle=>{
     const card=bundle?.card;
     if(!card)return null;
     if(itemId(card)!==state.trackId)throw Error('416_PUBLIC_CARD_IDENTITY_MISMATCH');
     const current=Number(card?.likeCount??card?.stats?.likeCount??0);
     const nested=card?.stats&&typeof card.stats==='object'
       ?Number(card.stats.likeCount??state.likeCount):state.likeCount;
     if(current===state.likeCount&&nested===state.likeCount)return null;
     return {...bundle,updatedAt:Date.now(),card:withCount(card,state.likeCount)};
   },'416_PUBLIC_CARD');
   reads+=result.reads;writes+=result.writes;
 }
 return {reads,writes};
}

export async function patchExactPublicProfiles416(r2,states){
 const byOwner=new Map();
 for(const state of states.values()){
   const list=byOwner.get(state.ownerUid)||[];list.push(state);byOwner.set(state.ownerUid,list);
 }
 let reads=0,writes=0;
 for(const [uid,list] of byOwner){
   const expected=new Map(list.map(x=>[x.trackId,x.likeCount]));
   const result=await casJson416(r2,profileKey(uid),bundle=>{
     const data=bundle?.body?.data;
     if(!Array.isArray(data?.items))return null;
     let dirty=false;
     const items=data.items.map(item=>{
       const id=itemId(item);if(!expected.has(id))return item;
       const count=expected.get(id);
       const current=Number(item?.likeCount??item?.stats?.likeCount??0);
       const nested=item?.stats&&typeof item.stats==='object'
         ?Number(item.stats.likeCount??count):count;
       if(current===count&&nested===count)return item;
       dirty=true;return withCount(item,count);
     });
     if(!dirty)return null;
     const revision=Math.max(Number(bundle.revision||0),Number(data.revision||0))+1;
     return {...bundle,revision,updatedAt:Date.now(),
       body:{...bundle.body,data:{...data,items,revision}}};
   },'416_PUBLIC_PROFILE');
   reads+=result.reads;writes+=result.writes;
 }
 return {reads,writes,owners:byOwner.size};
}

export async function patchLatestPublicFeed416(r2,states){
 const expected=new Map([...states].map(([id,x])=>[id,x.likeCount]));
 return casJson416(r2,feedKey('latest'),bundle=>{
   const data=bundle?.payload?.data;
   if(!Array.isArray(data?.items)||data.items.length>PUBLIC_FEED_LIMIT_416)
     throw Error('416_PUBLIC_LATEST_FEED_BAD');
   let dirty=false;
   const items=data.items.map(item=>{
     const id=itemId(item);if(!expected.has(id))return item;
     const count=expected.get(id);
     const current=Number(item?.likeCount??item?.stats?.likeCount??0);
     const nested=item?.stats&&typeof item.stats==='object'
       ?Number(item.stats.likeCount??count):count;
     if(current===count&&nested===count)return item;
     dirty=true;return withCount(item,count);
   });
   if(!dirty)return null;
   return {...bundle,updatedAt:Date.now(),
     payload:{...bundle.payload,data:{...data,items}}};
 },'416_PUBLIC_LATEST');
}

export async function readPopularRank416(db){
 const result=await db.prepare(`SELECT d.id FROM explore_derived_tracks AS d
   INDEXED BY idx_explore_rank_popular
   JOIN tracks AS c ON c.id=d.id
   WHERE c.is_public=1 AND c.status='published'
   ORDER BY d.likes DESC,d.published_at DESC,d.id DESC LIMIT 41`).all();
 const ids=(result?.results||[]).map(row=>String(row?.id||'').trim()).filter(Boolean);
 if(ids.length>41||new Set(ids).size!==ids.length)throw Error('416_PUBLIC_POPULAR_RANK_BAD');
 return ids;
}

const cursor416=(last)=> {
 if(!last)return null;
 const payload={likeCount:Number(last?.likeCount??last?.stats?.likeCount??0),
   publishedAt:Number(last?.publishedAt||0),id:itemId(last)};
 const raw=JSON.stringify(payload);
 if(typeof Buffer!=='undefined')return Buffer.from(raw,'utf8').toString('base64url');
 const bytes=new TextEncoder().encode(raw);let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

export async function rebuildPopularPublicFeed416(db,r2,states){
 const ranked=await readPopularRank416(db);
 const visible=ranked.slice(0,PUBLIC_FEED_LIMIT_416),overflow=ranked.length>PUBLIC_FEED_LIMIT_416;
 const object=await r2.get(feedKey('popular'));
 if(!object)throw Error('416_PUBLIC_POPULAR_FEED_MISSING');
 const bundle=await parseJsonObject(object,'416_PUBLIC_POPULAR_FEED_BAD_JSON');
 const data=bundle?.payload?.data;
 if(!Array.isArray(data?.items)||data.items.length>PUBLIC_FEED_LIMIT_416)
   throw Error('416_PUBLIC_POPULAR_FEED_BAD');
 const current=new Map(data.items.map(item=>[itemId(item),item]));
 for(const state of states.values()){
   const item=current.get(state.trackId);
   if(item)current.set(state.trackId,withCount(item,state.likeCount));
 }
 let extraReads=1;
 for(const id of visible){
   if(current.has(id))continue;
   const cardObject=await r2.get(cardKey(id));extraReads++;
   const cardBundle=await parseJsonObject(cardObject,'416_PUBLIC_POPULAR_CARD_MISSING');
   const card=cardBundle?.card;
   if(!card||itemId(card)!==id)throw Error('416_PUBLIC_POPULAR_CARD_BAD');
   current.set(id,card);
 }
 const items=visible.map(id=>current.get(id));
 if(items.some(x=>!x))throw Error('416_PUBLIC_POPULAR_ITEM_MISSING');
 const unchanged=items.length===data.items.length&&
   items.every((item,index)=>JSON.stringify(item)===JSON.stringify(data.items[index]))&&
   Boolean(data.nextCursor)===Boolean(overflow);
 if(unchanged)return {changed:false,reads:extraReads,writes:0,rankReadQueries:1};
 const nextCursor=overflow?cursor416(items.at(-1)):null;
 const saved=await r2.put(feedKey('popular'),JSON.stringify({
   ...bundle,updatedAt:Date.now(),
   payload:{...bundle.payload,data:{...data,items,nextCursor}},
 }),{
   onlyIf:{etagMatches:object.etag},
   httpMetadata:{contentType:'application/json; charset=utf-8'},
   customMetadata:{...(object.customMetadata||{}),stage416Public:'1',updatedAt:String(Date.now())},
 });
 if(!saved)throw Error('416_PUBLIC_POPULAR_FEED_CAS');
 return {changed:true,reads:extraReads,writes:1,rankReadQueries:1};
}

export async function materializePublicLikeProjection416({db,r2,trackIds}){
 if(!r2?.get||!r2?.put)throw Error('416_PUBLIC_PROJECTION_R2_UNAVAILABLE');
 const canonical=await readCanonicalPublicLikeStates416(db,trackIds);
 const cards=await patchExactPublicCards416(r2,canonical.states);
 const profiles=await patchExactPublicProfiles416(r2,canonical.states);
 const latest=await patchLatestPublicFeed416(r2,canonical.states);
 const popular=await rebuildPopularPublicFeed416(db,r2,canonical.states);
 const releaseRows=[...canonical.states.values()]
   .map(({trackId,ownerUid})=>({trackId,ownerUid}))
   .sort((a,b)=>a.trackId.localeCompare(b.trackId));
 return {changedTracks:canonical.states.size,missingIds:canonical.missingIds,releaseRows,
   d1ReadQueries:canonical.readQueries+popular.rankReadQueries,d1Writes:0,
   r2Reads:cards.reads+profiles.reads+latest.reads+popular.reads,
   r2Writes:cards.writes+profiles.writes+latest.writes+popular.writes};
}
