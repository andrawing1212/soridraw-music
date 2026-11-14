// APP653: one PREVIEW-only rollout scope for the EXISTING three Functions.
// The shared Firebase project also serves TEST/PRODUCTION. No general owner
// may be enrolled or receive a relay unless both explicit environment fences
// are enabled by a deliberately scoped administrator release.
// The source is still compiled OFF until separately deployed.
export type OwnerScope653 =
  | {enabled:false;canaryUid:'';general:false}
  | {enabled:true;canaryUid:string|undefined;general:boolean};
const uid=/^[A-Za-z0-9_-]{1,128}$/;
export const ownerFollowScope653=(
 env:Record<string,string|undefined>,compiledOpen:boolean,
):OwnerScope653=>{
 if(!compiledOpen||env.SORIDRAW_OWNER_FOLLOW_READY_608!=='1')
  return {enabled:false,canaryUid:'',general:false};
 const general=env.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&
  env.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only';
 if(general)return {enabled:true,canaryUid:undefined,general:true};
 const canary=String(env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');
 return uid.test(canary)
  ? {enabled:true,canaryUid:canary,general:false}
  : {enabled:false,canaryUid:'',general:false};
};
// This is ONLY a browser transport origin gate, not proof of Auth ownership.
// Firebase Auth + AppCheck + per-owner lifecycle checks remain mandatory.
export const isPreviewOwnerEnrollmentOrigin653=(
 origin:unknown,
)=>origin==='https://preview.soridraw.com';
