// APP659: exact owner follow mutation target scope for a coordinated PREVIEW release.
// This helper has zero D1/R2/DO work. Caller still authenticates and checks
// receipt/epoch before reserving or publishing confirmed changes.
const UID=/^[A-Za-z0-9_-]{1,128}$/;
export function ownerFollowTargetInScope659(env,pathname){
 if(env?.SORIDRAW_ENVIRONMENT!=='preview')return false;
 const match=/^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/follow$/.exec(String(pathname||''));
 if(!match||!UID.test(match[1]))return false;
 if(env.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&
    env.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only'&&
    env.SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607==='1'&&
    env.SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607==='1')return true;
 const canary=String(env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');
 return UID.test(canary)&&match[1]===canary;
}
