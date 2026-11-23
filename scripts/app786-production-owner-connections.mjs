// APP786: the exact 18 missing PRODUCTION owner-follow connection declarations.
// SOURCE-ONLY and safe in a ZERO-TRAFFIC inactive Worker version. This does not
// create, copy, bind, enable or activate any resources or transport credentials.
// Review the two PRODUCTION-only legacy service bindings and the full active
// runtime contract before approving a later separate back-end cutover.
export const APP786_PRODUCTION_OWNER_CONNECTIONS_COMPILED_OPEN=false;
export const APP786_OWNER_CONNECTIONS=Object.freeze({
 canonicalDurability:Object.freeze([
  ['OWNER_FOLLOW_RESERVATION_SERVICE_600','service'],
  ['SORIDRAW_OWNER_DO_BRIDGE_SECRET_600','secret_text'],
  ['SORIDRAW_OWNER_DO_STANDALONE_600','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_BIND_544','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','secret_text'],
  ['SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653','plain_text'],
 ].map(v=>Object.freeze(v))),
 ownerDelivery:Object.freeze([
  ['SORIDRAW_OWNER_FOLLOW_ENDPOINT_539','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_HMAC_539','secret_text'],
  ['SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669','plain_text'],
 ].map(v=>Object.freeze(v))),
 audienceAndLegacy:Object.freeze([
  ['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_READY_669','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_SCOPE_669','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680','plain_text'],
 ].map(v=>Object.freeze(v))),
});
export const APP786_REQUIRED_EVIDENCE=Object.freeze({
 canonicalDurability:Object.freeze([
  'SIGNATURE_VERIFIED_PRODUCTION_AUTH_APP_CHECK',
  'ALL_LEGACY_NEW_WRITERS_SINGLE_CANONICAL_IDENTITY',
  'IMMUTABLE_HISTORY_COMPLETE_FROM_ORIGIN',
  'EXTERNAL_OWNER_REVISION_FLOOR_INDEPENDENT_OF_DO_PITR',
  'CANONICAL_D1_W1_W2_AND_R2_PROJECTION_SETTLEMENT',
  'EXACT_ACTIVE_PROD_DO_ALARM_REPLAY_AND_ROLLBACK',
 ]),
 ownerDelivery:Object.freeze([
  'SIGNED_PRODUCTION_FUNCTION542_RECEIVER',
  'RTDB_OWNER_ONLY_RULES_AND_ORDERED_VERIFIED_COMMIT',
  'EXACT_REAL_OWNER_PC_MOBILE_AUTOMATIC_DELIVERY',
 ]),
 audienceAndLegacy:Object.freeze([
  'ALL_SIGNED_IN_USERS_NOT_ONLY_PREVIEW_CANARY',
  'OLD_CLIENT_UNVERSIONED_FOLLOW_UNFOLLOW_REFOLLOW_PRESERVED',
  'CROSS_ENVIRONMENT_ORIGINS_PRODUCTION_TARGETS_VERIFIED',
 ]),
});
const rows=x=>Array.isArray(x)&&x.every(v=>v&&typeof v==='object'&&
 /^[A-Z][A-Z0-9_]{1,127}$/.test(v.name||'')&&typeof v.type==='string')?x:null;
const key=x=>x.name+':'+x.type;
const hold=r=>{throw Error('APP786_INACTIVE_OWNER_CONNECTION_HOLD_'+r)};
const groups=Object.entries(APP786_OWNER_CONNECTIONS);
const flattened=groups.flatMap(([group,items])=>items.map(([name,type])=>({group,name,type})));
const PREVIEW_TYPES=new Map(flattened.map(x=>[x.name,x.type]));
const OLD=[
 ['DB','d1'],['EXPLORE_LIKE_BATCH_SCHEDULER','durable_object_namespace'],
 ['EXPLORE_MIRROR_PREVIEW','service'],['EXPLORE_MIRROR_TEST','service'],
 ['EXPLORE_MIRROR_TOKEN','secret_text'],['LIKE_RATE_LIMITER','ratelimit'],
 ['PROFILE_MEDIA','r2_bucket'],['SORIDRAW_ENVIRONMENT','plain_text'],
 ['SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378','plain_text'],
 ['SORIDRAW_PUBLICATION_R2_ONLY_READ_V1','plain_text'],
 ['SORIDRAW_R2_CATALOG_V1','plain_text'],
 ['SORIDRAW_R2_HYBRID_READ_V1','plain_text'],
];
const ACTIVE_TYPES=new Map(OLD);
export function assessApp786InactiveOwnerConnections({
 previewBindings,productionBindings,candidateBindings,compiledOpen=false,
}={}){
 const p=rows(previewBindings),a=rows(productionBindings),c=rows(candidateBindings);
 if(!p||!a||!c||p.length!==41||a.length!==12||c.length!==12||
    new Set(p.map(v=>v.name)).size!==p.length||
    new Set(a.map(v=>v.name)).size!==a.length||
    new Set(c.map(v=>v.name)).size!==c.length)
  hold('ACTIVE_BINDING_COUNT_NAME_OR_SHAPE_CHANGED');
 if(compiledOpen!==false||APP786_PRODUCTION_OWNER_CONNECTIONS_COMPILED_OPEN!==false)
  hold('OWNER_FEATURE_MUST_REMAIN_OFF');
 for(const [name,type] of OLD){
  if(!a.some(v=>v.name===name&&v.type===type)||
     !c.some(v=>v.name===name&&v.type===type))
   hold('ACTIVE_LEGACY_PRODUCTION_BINDING_DRIFT');
 }
 if(a.some(v=>!ACTIVE_TYPES.has(v.name))||
    c.some(v=>!ACTIVE_TYPES.has(v.name)))
  hold('UNREVIEWED_INACTIVE_CANDIDATE_BINDING');
 for(const {name,type} of flattened){
  if(!p.some(v=>v.name===name&&v.type===type))
   hold('PREVIEW_FOLLOW_CONNECTION_SOURCE_OR_TYPE_DRIFT');
  if(a.some(v=>v.name===name))
   hold('PRODUCTION_FOLLOW_CONNECTION_ALREADY_CHANGED_RECHECK');
 }
 // Comparisons include only name/type. We never read or serialize secret
 // values, account tokens, service destinations, D1 IDs or RTDB URLs.
 const evidenceGroups=Object.fromEntries(groups.map(([group,items])=>[
  group,Object.freeze({count:items.length,
   missing:items.map(([name,type])=>name+':'+type),
   proofStillMissing:APP786_REQUIRED_EVIDENCE[group]})
 ]));
 const knownMissing=flattened.map(x=>key(x));
 const unknownMissing=p.filter(x=>!a.some(y=>y.name===x.name)).
   filter(x=>!PREVIEW_TYPES.has(x.name)).map(key);
 return Object.freeze({
  kind:'APP786_INACTIVE_PRODUCTION_FOLLOW_CONNECTION_REVIEW',
  status:'HOLD_NO_LIVE_FOLLOW_ENABLE',
  productionOriginalBindings:12,
  candidateBindingsInherited:12,
  missingFollowConnections:18,
  missingOtherConnections:unknownMissing.length,
  missingFollowNamesAndTypes:knownMissing,
  evidenceGroups,
  hasActualProductionFunctionConnection:false,
  hasActualProductionOwnerDoConnection:false,
  realSignedAuthAndCompleteHistoryProven:false,
  authenticatedPCMobileProofForProduction:false,
  allOriginalProdBindingsPreserved:true,
  originalLegacyPreviewAndTestServicePreserved:true,
  noSecretValuesRead:true,
  zeroTrafficCandidateAllowed:true,
  prodTrafficTransitionAuthorized:false,
  additionalBindingWritesAuthorized:false,
  doMigrationAuthorized:false,
  backendDeployAuthorized:false,
  productionReleaseAuthorized:false,
 });
}
