// app518 INACTIVE: pure, fail-closed release barrier for three Workers
// sharing the same private R2 CATALOG. Never probes or mutates Cloudflare.
// A single updated PREVIEW Worker can NOT fence an older TEST/PROD Worker.
// Caller must independently obtain immutable active-version and live-binding
// evidence from the Cloudflare control plane; browser headers are not proof.
export const FENCE_CONTRACT_518='app518-music-note-fence-v1';
export const MEDIA_TARGETS_518=Object.freeze([
 {stage:'preview',script:'soridraw-media-preview',media:'soridraw-media-preview'},
 {stage:'test',script:'soridraw-media-test',media:'soridraw-media-test'},
 {stage:'production',script:'soridraw-media',media:'soridraw-media'},
]);
const SHARED='soridraw-user-catalog';
const MIN_STABLE_MS=10*60*1000;
const MAX_EVIDENCE_AGE_MS=2*60*1000;
const cutover='ENABLED_AFTER_SHARED_ROLLOUT';
const deny=code=>({code,pass:false,canEnableCanonical:false});
const safeVersion=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
const flat=rows=>Array.isArray(rows)&&rows.length===3;
const marker=s=>s?.fenceContract===FENCE_CONTRACT_518
 &&s?.sourceInstalled===true
 &&s?.canonicalEnabled===false;
const active=v=>Array.isArray(v)&&v.length===1
 &&safeVersion(v[0]?.versionId)&&v[0]?.percentage===100;
const validWorker=(row,target,approvedVersions)=>{
 if(row?.stage!==target.stage||row?.script!==target.script
  ||row?.mediaBucket!==target.media||row?.catalogBucket!==SHARED
  ||row?.sharedFlag!=='1'||row?.canonicalFlag!=null
  ||!active(row?.activeVersions)||!marker(row?.health))
  return false;
 // A text field exposed by /health is not enough: the actual version must
 // have been independently verified against an audited immutable artifact.
 return approvedVersions?.[target.stage]===row.activeVersions[0].versionId;
};
export const assessSharedWriterCutover518=({
 snapshots,approvedVersions,retiredOldFlights,rollbackVersions,nowMs,
}={})=>{
 if(!Array.isArray(snapshots)||snapshots.length!==2
  ||!Number.isSafeInteger(nowMs)||nowMs<=0)
  return deny('HOLD_NO_TWO_CLOUDFLARE_SNAPSHOTS');
 const [before,after]=snapshots;
 if(!Number.isSafeInteger(before?.atMs)||!Number.isSafeInteger(after?.atMs)
  ||before.atMs<=0||after.atMs-before.atMs<MIN_STABLE_MS
  ||after.atMs>nowMs||nowMs-after.atMs>MAX_EVIDENCE_AGE_MS)
  return deny('HOLD_OLD_WORKER_DRAIN_WINDOW_UNPROVEN');
 if(!flat(before?.workers)||!flat(after?.workers))
  return deny('HOLD_MISSING_WORKER');
 if(!approvedVersions||!rollbackVersions)
  return deny('HOLD_MISSING_IMMUTABLE_RELEASE_ATTESTATION');
 for(const expected of MEDIA_TARGETS_518){
  const old=before.workers.find(x=>x.stage===expected.stage);
  const current=after.workers.find(x=>x.stage===expected.stage);
  if(!validWorker(old,expected,approvedVersions)
    ||!validWorker(current,expected,approvedVersions))
    return deny('HOLD_LEGACY_WRITER_OR_SHARED_BINDING_'+expected.stage.toUpperCase());
  if(old.activeVersions[0].versionId!==current.activeVersions[0].versionId)
    return deny('HOLD_WORKER_VERSION_CHANGED_DURING_DRAIN');
  // Any automatic rollback path to a pre-fence version would reopen the
  // shared R2 hole after canonical writes, even if traffic is 100% today.
  const rollback=rollbackVersions[expected.stage];
  if(!safeVersion(rollback)||rollback!==approvedVersions[expected.stage])
   return deny('HOLD_UNFENCED_ROLLBACK_'+expected.stage.toUpperCase());
 }
 // Cloudflare 100%-traffic is not proof of completed in-flight requests.
 // Require separately auditable drain evidence for all three exact versions,
 // produced after the beginning of the stable-version observation window.
 if(!flat(retiredOldFlights))return deny('HOLD_OLD_INFLIGHT_UNVERIFIED');
 for(const expected of MEDIA_TARGETS_518){
  const proof=retiredOldFlights.find(x=>x.stage===expected.stage);
  if(proof?.source!=='INDEPENDENT_RELEASE_AUDIT'
    ||proof?.outcome!=='VERIFIED'
    ||proof?.versionId!==approvedVersions[expected.stage]
    ||!Number.isSafeInteger(proof.checkedAtMs)
    ||proof.checkedAtMs<before.atMs||proof.checkedAtMs>after.atMs)
    return deny('HOLD_OLD_INFLIGHT_UNVERIFIED');
 }
 // The caller must still separately verify Firebase transport, D1/R2,
 // exact-source/tombstone delivery and ask the director for deployment
 // approval. This is ONLY a three-Worker fence compatibility preflight.
 return {code:'THREE_WORKER_FENCE_PREFLIGHT_PASS',
  pass:true,canEnableCanonical:false,
  require:'FIREBASE_DELIVERY_AND_EXPLICIT_DIRECTOR_DEPLOY_APPROVAL'};
};

/**
 * Fail-closed boundary for the EXISTING three-environment Media Worker release
 * runner (upload/activate/restore). This cannot authorize a canonical cutover.
 * A canonical flag present in source OR any currently bound live Worker closes
 * all old release paths, including emergency rollback. A separate audited
 * canonical-aware controller must handle post-cutover repairs.
 */
export const assessLegacyMediaMutation518=({
 action,sourceCanonicalFlag,liveCanonicalFlags,
}={})=>{
 if(!['upload','activate','restore'].includes(action))
  return deny('HOLD_NOT_A_MEDIA_MUTATION');
 if(!Array.isArray(liveCanonicalFlags)||liveCanonicalFlags.length!==3)
  return deny('HOLD_ALL_THREE_LIVE_FLAGS_REQUIRED');
 const flags=[sourceCanonicalFlag,...liveCanonicalFlags];
 if(flags.some(f=>f!==null&&f!==undefined&&f!==''))
  return deny('HOLD_CANONICAL_518_USE_FENCED_RELEASE_CONTROLLER');
 return {code:'LEGACY_MEDIA_MUTATION_BEFORE_CANONICAL_ONLY',pass:true,
  canEnableCanonical:false};
};
