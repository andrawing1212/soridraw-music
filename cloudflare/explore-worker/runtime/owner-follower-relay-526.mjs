// APP526 — PREVIEW server-only follower invalidation relay. Safe by default:
// neither a browser nor a merely accepted (or failed) follow request may publish.
// Runtime source stays OFF until secrets, backend and replay proof are ready.
export const OWNER_FOLLOW_RELAY_526_ENABLED = false;
const UID_526 = /^[A-Za-z0-9_-]{1,128}$/;
const hex = (bytes) => Array.from(new Uint8Array(bytes),
  (n) => n.toString(16).padStart(2, '0')).join('');

export const prepareOwnerFollowRelay526 = (receipt) => {
  if (!receipt || receipt.canonicalCommitted !== true ||
      receipt.materializedProfileReady !== true || receipt.changed !== true) return null;
  const actorUid = String(receipt.actorUid || '').trim();
  const ownerUid = String(receipt.targetUid || '').trim();
  const operationId = String(receipt.operationId || '').trim();
  if (!UID_526.test(actorUid) || !UID_526.test(ownerUid) ||
      actorUid === ownerUid || !operationId || operationId.length > 128 ||
      typeof receipt.following !== 'boolean' ||
      !Number.isSafeInteger(receipt.canonicalFollowerCount) ||
      receipt.canonicalFollowerCount < 0 ||
      receipt.canonicalFollowerCount > 1_000_000_000) return null;
  return { actorUid, ownerUid, operationId,
    following:receipt.following, canonicalFollowerCount:receipt.canonicalFollowerCount };
};

export const buildOwnerFollowEnvelope526 = async (receipt, at) => {
  const input=prepareOwnerFollowRelay526(receipt);
  if (!input || !Number.isSafeInteger(at) || at <= 0) return null;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(
    input.actorUid+'\n'+input.ownerUid+'\n'+input.operationId));
  return {
    version:1,at,actorUid:input.actorUid,ownerUid:input.ownerUid,
    receiptId:hex(digest), following:input.following,
    canonicalFollowerCount:input.canonicalFollowerCount,
  };
};

export const signOwnerFollowEnvelope526 = async (body,secret,at) => {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('OWNER_RELAY_SECRET_UNAVAILABLE_526');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,
    new TextEncoder().encode(String(at)+'.'+body)));
};

// Pure body/crypto helpers above are testable without network. Never log secrets.
export const invokeOwnerFollowRelay526 = async (receipt, {
  secret,endpoint,now=Date.now,send=fetch,
}={}) => {
  if (!OWNER_FOLLOW_RELAY_526_ENABLED) return {skipped:true,reason:'SOURCE_OFF'};
  if (typeof endpoint !== 'string' ||
      !/^https:\/\/asia-northeast3-soridraw-app-866a5\.cloudfunctions\.net\/publishExploreOwnerFollower526$/.test(endpoint))
    return {skipped:true,reason:'ENDPOINT_NOT_PINNED'};
  const at=now();
  const payload=await buildOwnerFollowEnvelope526(receipt,at);
  if (!payload) return {skipped:true,reason:'NOT_CANONICAL_CHANGED'};
  const body=JSON.stringify(payload);
  const signature=await signOwnerFollowEnvelope526(body,secret,at);
  // One bounded retry for an idempotent signed receipt. This is NOT a durable
  // retry queue; rollout requires a separately proven persistent source.
  for(let attempt=0;attempt<2;attempt++){
    try {
      const response=await send(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json',
          'X-Soridraw-Follow-Relay526-At':String(at),
          'X-Soridraw-Follow-Relay526-Signature':signature},
        body,
      });
      if(response.ok)return {skipped:false,delivered:true};
      if(response.status<500)break;
    }catch {}
  }
  return {skipped:false,delivered:false,reason:'WEBHOOK_DELIVERY_DEFERRED'};
};
