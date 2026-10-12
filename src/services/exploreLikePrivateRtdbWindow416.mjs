// Stage416 RTDB-only candidate: replace per-click shared-D1 W2 with a
// single account-private RTDB transaction. This is NOT active in app399.
// Separate sibling path prevents legacy 416 hints from overwriting the batch.
// Real RTDB ServerValue.TIMESTAMP is assigned at commit, not device Date.now().
export const PRIVATE_RTDB_MAX_TRACKS_416 = 256;
export const PRIVATE_RTDB_MAX_DEVICES_416 = 32;
export const PRIVATE_RTDB_MINUTES_416 = Object.freeze([1,3,5,10,20]);
const validUid = value => typeof value==='string' && value.length>0 && value.length<=128;
const validUuid = value => typeof value==='string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validSeq = n => Number.isSafeInteger(n) && n>0;
const validTrack = trackId => typeof trackId==='string' && trackId.length>0 && trackId.length<=512;
const validPending = row => !!row && validTrack(row.trackId) &&
  typeof row.liked==='boolean' && validUuid(row.operationId) &&
  validUuid(row.deviceId) && validSeq(row.deviceSequence) && validSeq(row.version) &&
  Number.isSafeInteger(row.mutationAt) && row.mutationAt>0;
const safeMap = x => x && typeof x==='object' && !Array.isArray(x)?x:{};
// Account seq is RTDB-transaction serialized. Device sequence ensures a replay
// after full settlement cannot mint a fresh account version with the same
// sender's previously used operation. Device ID + counter must be durable.
export function applyPrivateRtdbClick416(prior, input, serverTimestamp, configuredMinutes=5) {
  if (!validTrack(input?.trackId) || !validUuid(input?.operationId) ||
      !validUuid(input?.deviceId) || !validSeq(input?.deviceSequence) ||
      typeof input?.liked!=='boolean' || !PRIVATE_RTDB_MINUTES_416.includes(configuredMinutes) ||
      !serverTimestamp) throw Error('416_BAD_RTDB_CLICK');
  const state=safeMap(prior);
  const version=Number(state.version||0);
  const devices=safeMap(state.deviceSeq);
  const pending=safeMap(state.pending);
  const prevSeq=Number(devices[input.deviceId]||0);
  if (!Number.isSafeInteger(version) || version<0 || version===Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(prevSeq) || prevSeq<0) throw Error('416_BAD_RTDB_STATE');
  if (input.deviceSequence<=prevSeq) return null; // stale or duplicate: RTDB write 0
  if (!(input.trackKey && /^[a-f0-9]{64}$/.test(input.trackKey)))throw Error('416_BAD_RTDB_TRACK_HASH');
  if (Object.keys(devices).length>=PRIVATE_RTDB_MAX_DEVICES_416 &&
      !Object.hasOwn(devices,input.deviceId)) throw Error('416_RTDB_TOO_MANY_DEVICES');
  if (Object.keys(pending).length>=PRIVATE_RTDB_MAX_TRACKS_416 &&
      !Object.hasOwn(pending,input.trackKey)) throw Error('416_RTDB_BATCH_FULL');
  const window=state.window && typeof state.window==='object'?state.window:null;
  const nextVersion=version+1;
  // A live open window does not change its Master minutes; a server sealer
  // must close it before a future new window can adopt changed settings.
  const minutes=window?Number(window.minutes):configuredMinutes;
  if (!PRIVATE_RTDB_MINUTES_416.includes(minutes)) throw Error('416_BAD_RTDB_WINDOW');
  const nextPending={...pending,[input.trackKey]:{
    trackId:input.trackId,liked:input.liked,operationId:input.operationId,
    deviceId:input.deviceId,deviceSequence:input.deviceSequence,version:nextVersion,
    mutationAt:serverTimestamp,
  }};
  return {
    ...state,
    version:nextVersion,
    deviceSeq:{...devices,[input.deviceId]:input.deviceSequence},
    pending:nextPending,
    window:{
      id:window?.id || input.operationId,
      minutes,
      openedAtMs:window?.openedAtMs || serverTimestamp,
      lastClickAtMs:serverTimestamp,
      revision:nextVersion,
    },
  };
}
// Server-side sealing uses trusted admin clock and resolved RTDB timestamps.
// The eligible frozen payload survives retries until a separate authenticated
// canonical-Worker receipt arrives. Never delete on a failed POST.
export function sealPrivateRtdbWindow416(prior, serverNowMs) {
  const state=safeMap(prior);
  const window=state.window;
  if(!window) return {committed:false,reason:'EMPTY',value:state};
  if(!Number.isSafeInteger(serverNowMs)||serverNowMs<=0 ||
     !Number.isSafeInteger(window.lastClickAtMs) ||
     !PRIVATE_RTDB_MINUTES_416.includes(window.minutes))
    return {committed:false,reason:'UNTRUSTED_CLOCK',value:state};
  const deadline=window.lastClickAtMs+window.minutes*60_000;
  if(serverNowMs<deadline) return {committed:false,reason:'NOT_DUE',retryAfterMs:deadline-serverNowMs,value:state};
  if(state.sealed) return {committed:false,reason:'PRIOR_SEAL_UNACKNOWLEDGED',value:state};
  const pending=safeMap(state.pending);
  const rows=Object.values(pending);
  if(!rows.length||rows.length>PRIVATE_RTDB_MAX_TRACKS_416||rows.some(row=>!validPending(row)))
    return {committed:false,reason:'CORRUPT_PENDING',value:state};
  return {committed:true,reason:'SEALED',value:{
    ...state,window:null,pending:{},
    sealed:{id:window.id,version:window.revision,closedAtMs:serverNowMs,
      rows:rows.sort((a,b)=>a.trackId.localeCompare(b.trackId))},
  }};
}
// Complete only the exact authenticated canonical receipt. An older delayed
// ACK is not allowed to drop a newer sealed snapshot or active pending input.
export function acknowledgePrivateRtdbSeal416(prior,sealId,sealVersion){
  const state=safeMap(prior),sealed=state.sealed;
  if(!validUuid(sealId)||!validSeq(sealVersion) ||
     sealed?.id!==sealId||sealed?.version!==sealVersion)return null;
  const {sealed:_ignored,...rest}=state;
  return rest;
}
export const hashTrackIdForRtdb416=async trackId=>{
  if(!validTrack(trackId))throw Error('416_BAD_RTDB_TRACK');
  const raw=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(trackId)));
  return [...raw].map(x=>x.toString(16).padStart(2,'0')).join('');
};
