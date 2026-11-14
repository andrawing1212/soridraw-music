// Minimal edits to the pinned, actually deployed PREVIEW modules.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

// Cloudflare omits migration_tag on an inactive version until it is deployed.
// This is metadata, NOT an instruction to create/migrate a Durable Object.
// Preserve the exact active compatibility, usage and any other runtime fields;
// reject an actual different migration tag or a change to runtime settings.
export function sameStagedWorkerRuntime660(active,staged){
 if(!active||!staged||typeof active!=='object'||typeof staged!=='object')return false;
 if(staged.migration_tag!==undefined&&
    staged.migration_tag!==active.migration_tag)return false;
 const before={...active},after={...staged};
 delete before.migration_tag;
 delete after.migration_tag;
 return isDeepStrictEqual(before,after);
}
export const hash660=s=>createHash('sha256').update(s).digest('hex');
const once=(s,old,next)=>{
 if(s.split(old).length!==2)throw Error('APP660_SOURCE_ANCHOR_MISMATCH');
 return s.replace(old,next);
};
const general=`function generalOwner660(env){
 return env?.SORIDRAW_ENVIRONMENT==='preview'&&
  env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&
  env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only';
}
`;
export function patchExplore660(source){
 if(hash660(source)!=='573ef2e641ba619c1f05a46744ebb06e6e83cb4195980a9d769109315358cbe7')
  throw Error('APP660_ACTIVE_EXPLORE_SOURCE_DRIFT');
 let s=once(source,'async function approvedCanary607(uid){',general+'async function approvedCanary607(uid){');
 s=once(s,"    String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'')!==ownerUid||",
  "    !UID.test(String(ownerUid||''))||\n    (!generalOwner660(env)&&String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'')!==ownerUid)||");
 s=once(s,' return approvedCanary607(ownerUid);',' return generalOwner660(env)||approvedCanary607(ownerUid);');
 s=once(s," const uid=String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');\n return UID.test(uid)&&p==='/v1/profiles/'+uid+'/follow'?uid:null;",
  " if(generalOwner660(env)&&request.headers.get('Origin')==='https://preview.soridraw.com'){\n  const match=/^\\/v1\\/profiles\\/([A-Za-z0-9_-]{1,128})\\/follow$/.exec(p);\n  return match?match[1]:null;\n }\n const uid=String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');\n return UID.test(uid)&&p==='/v1/profiles/'+uid+'/follow'?uid:null;");
 s=once(s,'request,env:this.env,enabled:true,allowedCanaryUid:uid,',
  'request,env:this.env,enabled:true,allowedCanaryUid:generalOwner660(this.env)?null:uid,');
 return s;
}
export function patchOwner660(source){
 if(hash660(source)!=='1c63c36cf3fdf35abd26f28960bb0239d27d2da2d5d083032aebcae738a278da')
  throw Error('APP660_ACTIVE_DO_SOURCE_DRIFT');
 let s=once(source,'async function approvedOwner600(uid, env, syntheticOwnerUid) {',
  general+'async function approvedOwner600(uid, env, syntheticOwnerUid) {');
 s=once(s,'  if (syntheticOwnerUid !== void 0) return uid === syntheticOwnerUid;',
  '  if (syntheticOwnerUid !== void 0) return uid === syntheticOwnerUid;\n  if (generalOwner660(env)) return true;');
 s=once(s,'if (!active(env, enabled) || !await approvedOwner600(String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || ""), env, syntheticOwnerUid))',
  'if (!active(env, enabled) || (!generalOwner660(env) && !await approvedOwner600(String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || ""), env, syntheticOwnerUid)))');
 return s;
}
export function patchEnrollment660(source){
 return once(source," if(event.uid!==String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||''))",
  " const general=env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&\n  env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only';\n if(!general&&event.uid!==String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||''))");
}
