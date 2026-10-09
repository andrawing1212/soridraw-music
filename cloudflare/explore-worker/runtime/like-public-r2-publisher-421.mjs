// SORIDRAW 421: bounded source-only public R2 generation publisher.
// NOT imported by the live Worker. It makes no D1, Firestore or RTDB calls.
// PREVIEW/TEST/PRODUCTION old projection writers are NOT generation-aware.
// NEVER activate while old 191/feed/card writers or legacy likes writers run.
const valid = (v, max) => typeof v === 'string' && v.length > 0 &&
  v.length <= max && v.trim() === v;
const feedKey = sort => 'internal/explore/shared-feed-v112/' + sort + '-40.json';
const cardKey = id => 'internal/explore/shared-track-card-v115/' + encodeURIComponent(id) + '.json';
const profileKey = uid => 'internal/explore/shared-profile-v113/' + encodeURIComponent(uid) + '.json';
const barrier = code => Object.assign(new Error(code), { code });

function projectRow421(item, id, count, generation) {
  const rowId=String(item?.id || item?.trackId || '');
  if (rowId !== id) return item;
  const known = item?.likeGeneration421;
  if (known !== undefined && (!Number.isSafeInteger(known) || known < 0)) {
    throw barrier('421_UNSAFE_GENERATION_METADATA');
  }
  if (known !== undefined && known > generation) {
    throw barrier('421_STALE_GENERATION_REJECTED'); // never notify stale membership
  }
  if (known === generation) {
    if (Number(item?.likeCount ?? item?.stats?.likeCount ?? 0) !== count) {
      throw barrier('421_SAME_GENERATION_COUNT_CONFLICT');
    }
    return item;
  }
  return {
    ...item, likeCount:count, likeGeneration421:generation,
    ...(item?.stats && typeof item.stats==='object'
      ? {stats:{...item.stats,likeCount:count}} : {}),
  };
}

async function patch421(bucket, key, transform, {optional=false}={}) {
  for (let retry=0;retry<8;retry++) {
    const object=await bucket.get(key);
    if (!object) {
      if(optional) return {status:'cold'};
      throw barrier('421_REQUIRED_R2_OBJECT_MISSING:' + key);
    }
    const payload=JSON.parse(await object.text());
    const next=transform(payload);
    if (next===payload) return {status:'already-current'};
    // R2 onlyIf checks ETag atomically. A concurrent profile edit, follow,
    // publication or other like cannot be silently overwritten.
    const saved=await bucket.put(key,JSON.stringify(next),{
      onlyIf:{etagMatches:object.etag},
      httpMetadata:{contentType:'application/json; charset=utf-8'},
      customMetadata:{...(object.customMetadata||{}),targetedLikeGeneration:'421'},
    });
    if(saved) return {status:'patched'};
  }
  throw barrier('421_R2_CAS_CONTENTION:' + key);
}

export function createLikeProjectionPublisher421({
  sharedR2, resolveOwnerUid, persistPersonalSnapshot,
  queueSameAccountSignal, now=()=>Date.now(),
}={}) {
  if (!sharedR2?.get || !sharedR2?.put ||
      typeof resolveOwnerUid!=='function' ||
      typeof persistPersonalSnapshot!=='function' ||
      typeof queueSameAccountSignal!=='function') {
    throw barrier('421_REQUIRED_SHARED_R2_AND_REAL_SIGNALS_MISSING');
  }

  return async function publishChangedTrack(change) {
    const {uid,trackId,liked,likeCount,revision,generation,operationId}=change||{};
    if (!valid(uid,256) || !valid(trackId,512) || !valid(operationId,128) ||
        typeof liked!=='boolean' || !Number.isSafeInteger(likeCount) || likeCount<0 ||
        !Number.isSafeInteger(revision) || revision<0 ||
        !Number.isSafeInteger(generation) || generation<0) {
      throw barrier('421_INVALID_CANONICAL_CHANGE');
    }
    const ownerUid=await resolveOwnerUid(trackId);
    if(!valid(ownerUid,256)) throw barrier('421_UNVERIFIED_TRACK_OWNER');
    const stamp=Math.max(1,Math.floor(Number(now())||0));
    // Publication order: card, profile, Feed(s), personal catalog, signal.
    // If later steps fail, retry same D1 operationId at W0 and re-run CAS.
    await patch421(sharedR2,cardKey(trackId), bundle => {
      if(String(bundle?.card?.id || bundle?.card?.trackId || '')!==trackId)
        throw barrier('421_CARD_IDENTITY_MISMATCH');
      const updated=projectRow421(bundle.card,trackId,likeCount,generation);
      return updated===bundle.card ? bundle : {
        ...bundle,updatedAt:stamp,card:updated,
      };
    });

    // A published track may not be in the profile top-40 or each Feed top-40.
    // Never modify membership or create a cold snapshot.
    await patch421(sharedR2,profileKey(ownerUid), bundle => {
      const data=bundle?.body?.data;
      if (!Array.isArray(data?.items) || data.items.length>100) {
        throw barrier('421_PROFILE_SCHEMA_UNSUPPORTED');
      }
      let dirty=false;
      const items=data.items.map(item=>{
        const next=projectRow421(item,trackId,likeCount,generation);
        if(next!==item)dirty=true;
        return next;
      });
      if(!dirty)return bundle;
      const newRev=Math.max(Number(data.revision||0),Number(bundle.revision||0))+1;
      return {
        ...bundle,revision:newRev,updatedAt:stamp,
        body:{...bundle.body,data:{...data,items,revision:newRev}},
      };
    },{optional:true});

    for(const sort of ['latest','popular']) {
      await patch421(sharedR2,feedKey(sort), bundle => {
        const data=bundle?.payload?.data;
        if(!Array.isArray(data?.items) || data.items.length>40)
          throw barrier('421_FEED_SCHEMA_UNSUPPORTED');
        let dirty=false;
        const items=data.items.map(item=>{
          const next=projectRow421(item,trackId,likeCount,generation);
          if(next!==item)dirty=true;
          return next;
        });
        return dirty ? {
          ...bundle,updatedAt:stamp,payload:{...bundle.payload,data:{...data,items}},
        } : bundle;
      });
    }
    const personal=await persistPersonalSnapshot({
      uid,trackId,liked,likeCount,revision,generation,operationId,
    });
    if(personal?.persisted!==true || personal?.trackId!==trackId ||
       personal?.revision!==revision) {
      throw barrier('421_PERSONAL_R2_NOT_DURABLE');
    }
    const signal=await queueSameAccountSignal({
      uid,trackId,liked,likeCount,revision,generation,operationId,
      ownerUid,acceptedAt:stamp,
    });
    if(signal?.queued!==true || signal?.trackId!==trackId ||
       signal?.revision!==revision) {
      throw barrier('421_CROSS_DEVICE_SIGNAL_NOT_DURABLE');
    }
    return {
      settled:true,trackId,generation,
      personalSnapshotPersisted:true,
      publicProjectionPersisted:true,
      sameAccountSignalQueued:true,
    };
  };
}
