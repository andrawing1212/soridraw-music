// Stage416 source-only finalizer. One completed UID window pays only
// bounded changed-track D1 reads, one personal R2 CAS and one signed callback.
// It never runs on page entry/re-entry and is HARD OFF in preview-entry.
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH416=/^l069_[0-9]{13}_[0-9a-f]{64}$/;
const encoder416=new TextEncoder();
const hex416=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha416=async text=>hex416(await crypto.subtle.digest('SHA-256',encoder416.encode(text)));
const hmac416=async(text,secret)=>{
 const key=await crypto.subtle.importKey('raw',encoder416.encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex416(await crypto.subtle.sign('HMAC',key,encoder416.encode(text)));
};
const privateKey416=uid=>'internal/explore/shared-social-v114/likes/'+
 encodeURIComponent(uid)+'.json';
const validRows416=rows=>Array.isArray(rows)&&rows.length>0&&rows.length<=256&&
 rows.every(x=>x&&typeof x.trackId==='string'&&x.trackId.length>0&&
 x.trackId.length<=512&&UUID416.test(x.operationId)&&typeof x.liked==='boolean');
async function canonicalRows416(db,uid,rows,batchIds){
 if(!db?.prepare||!Array.isArray(batchIds)||batchIds.length<1||batchIds.length>6||
    batchIds.some(x=>typeof x!=='string'||!BATCH416.test(x)))
   throw Error('416_FINAL_D1_INPUT_INVALID');
 const pendingSql=batchIds.map(()=>'?').join(',');
 const waiting=await db.prepare(
   'SELECT COUNT(*) AS n FROM explore_like_batches_069 WHERE batch_id IN ('+
   pendingSql+')').bind(...batchIds).first();
 if(Number(waiting?.n||0)!==0)throw Error('416_FINAL_069_STILL_PENDING');
 const ids=rows.map(x=>x.trackId);
 const idSql=ids.map(()=>'?').join(',');
 const response=await db.prepare(
   'SELECT t.id AS track_id,t.owner_uid AS owner_uid,'+
   'COALESCE(s.like_count,0) AS like_count,'+
   'CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END AS liked '+
   'FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id '+
   'LEFT JOIN likes l ON l.track_id=t.id AND l.user_uid=? '+
   'WHERE t.id IN ('+idSql+')'
 ).bind(uid,...ids).all();
 const result=Array.isArray(response?.results)?response.results:[];
 if(result.length!==ids.length)throw Error('416_FINAL_CANONICAL_ROWS_INCOMPLETE');
 const byId=new Map(result.map(x=>[String(x.track_id||''),x]));
 return rows.map(row=>{
   const x=byId.get(row.trackId);
   const count=Number(x?.like_count);
   const ownerUid=String(x?.owner_uid||'');
   if(!x||ownerUid.length>128||!Number.isSafeInteger(count)||count<0||
      count>1000000000)throw Error('416_FINAL_CANONICAL_ROW_INVALID');
   return {trackId:row.trackId,operationId:row.operationId,
     ownerUid,liked:Number(x.liked||0)===1,likeCount:count};
 });
}
async function persistPersonal416(r2,uid,version,batchIds,rows,nowMs){
 if(!r2?.get||!r2?.put)throw Error('416_FINAL_R2_UNAVAILABLE');
 const digest=await sha416(JSON.stringify({uid,version,batchIds,
   rows:rows.map(x=>({trackId:x.trackId,operationId:x.operationId,liked:x.liked}))}));
 const key=privateKey416(uid);
 for(let attempt=0;attempt<10;attempt++){
   const obj=await r2.get(key);
   if(!obj)throw Error('416_FINAL_PERSONAL_R2_COLD');
   let prior;
   try{prior=JSON.parse(await obj.text());}
   catch{throw Error('416_FINAL_PERSONAL_R2_CORRUPT');}
   const ids=Array.isArray(prior?.likedTrackIds)?prior.likedTrackIds:[];
   if(prior?.schemaVersion!==1||prior?.uid!==uid||
      prior?.canonicalComplete156!==true||
      typeof prior?.canonicalSource156!=='string'||!prior.canonicalSource156||
      !Array.isArray(prior?.likedTrackIds)||ids.length>2000||
      new Set(ids).size!==ids.length||prior?.exactLikeCount156!==ids.length)
     throw Error('416_FINAL_PERSONAL_R2_NOT_EXACT');
   const prev=Number(prior.privateLikeVersion416||0);
   if(!Number.isSafeInteger(prev)||prev<0)throw Error('416_FINAL_PERSONAL_R2_VERSION_BAD');
   if(prev>version)throw Error('416_FINAL_PERSONAL_R2_STALE');
   if(prev===version){
     if(prior.privateLikeDigest416!==digest)throw Error('416_FINAL_PERSONAL_R2_CONFLICT');
     return {persisted:true,unchanged:true,digest};
   }
   const set=new Set(ids);
   for(const row of rows){if(row.liked)set.add(row.trackId);else set.delete(row.trackId);}
   if(set.size>2000)throw Error('416_FINAL_PERSONAL_R2_CAPACITY');
   const next={...prior,likedTrackIds:[...set],exactLikeCount156:set.size,
     privateLikeVersion416:version,privateLikeDigest416:digest,updatedAt:nowMs};
   const stored=await r2.put(key,JSON.stringify(next),{
     onlyIf:{etagMatches:obj.etag},
     httpMetadata:{contentType:'application/json; charset=utf-8'},
     customMetadata:{...(obj.customMetadata||{}),
       soridrawSharedLikes:'416-final',privateLikeVersion416:String(version)},
   });
   if(stored)return {persisted:true,unchanged:false,digest};
 }
 throw Error('416_FINAL_PERSONAL_R2_CAS_EXHAUSTED');
}
async function sendFinal416(endpoint,secret,claim,http){
 if(typeof endpoint!=='string'||typeof secret!=='string'||secret.length<32)
   throw Error('416_FINAL_CALLBACK_BINDING_MISSING');
 const u=new URL(endpoint);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
    !(u.hostname.endsWith('.cloudfunctions.net')||u.hostname.endsWith('.run.app')))
   throw Error('416_FINAL_CALLBACK_TARGET_REFUSED');
 const raw=JSON.stringify(claim);
 const signature=await hmac416(raw,secret);
 const response=await http(endpoint,{method:'POST',headers:{
   'Content-Type':'application/json',
   'X-Soridraw-416-Final-Signature':signature,
 },body:raw});
 const payload=await response.json().catch(()=>null);
 const status=String(payload?.data?.status||'');
 if(!response.ok||payload?.ok!==true||
    (status!=='PUBLISHED'&&status!=='DUPLICATE'))
   throw Error('416_FINAL_CALLBACK_NOT_CONFIRMED');
 return {status};
}
export async function finalizePrivateHandoff416({
 db,r2,uid,windowId,version,batchIds,rows,finalEndpoint,secret,
 nowMs=Date.now(),http=fetch,
}={}){
 if(typeof uid!=='string'||!uid||uid.length>128||!UUID416.test(windowId)||
    !Number.isSafeInteger(version)||version<=0||!Number.isSafeInteger(nowMs)||
    nowMs<=0||!validRows416(rows))
   throw Error('416_FINAL_INPUT_INVALID');
 const finalRows=await canonicalRows416(db,uid,rows,batchIds);
 await persistPersonal416(r2,uid,version,batchIds,finalRows,nowMs);
 const claim={uid,windowId,version,signedAtMs:nowMs,
   canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
   personalLikeSnapshot:'changed-track-r2',batchIds,
   settledBatchIds:[...batchIds],rows:finalRows};
 const delivered=await sendFinal416(finalEndpoint,secret,claim,http);
 return {settled:true,receiptStatus:delivered.status,rows:finalRows};
}
