// APP710: leave canonical follow writer available when the public-only
// notification reservation receiver is deliberately compiled OFF.
// This does not bypass active notification routes or actor security checks.
import {createHash} from 'node:crypto';
export const hash710=x=>createHash('sha256').update(x).digest('hex');
const hold=s=>{throw Error('APP710_HOLD_'+s)};
export function patchGate710(main,publicReceiver){
 if(typeof main!=='string'||main.length<5000||main.length>10000||
    typeof publicReceiver!=='string'||publicReceiver.length<2000)hold('SOURCE_SHAPE');
 const flag=publicReceiver.match(/(?:export\s+)?const\s+APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN\s*=\s*(true|false)\s*;/);
 if(!flag)hold('PUBLIC_RECEIVER_COMPILE_FLAG_MISSING');
 // Only the currently disabled public notification path can be repaired;
 // an enabled path must be repaired at its actual delivery service.
 if(flag[1]!=='false')hold('PUBLIC_RECEIVER_ALREADY_ENABLED');
 const importAnchor="import {reserveOwnerFollowViaService601,handleOwnerFollowReplayService601}\n  from './app605/owner-follow-service-601.mjs';";
 const gateAnchor="publicWithoutEpoch:generalOwner660(env)&&env?.SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680==='1',";
 if(main.split(importAnchor).length!==2||main.split(gateAnchor).length!==2)hold('ENTRY_ANCHORS_NOT_UNIQUE');
 const withImport=main.replace(importAnchor,importAnchor+"\nimport {APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN} from './app605/public-follow-dual-ack-671.mjs';");
 const patched=withImport.replace(gateAnchor,
   "publicWithoutEpoch:generalOwner660(env)&&APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN&&env?.SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680==='1',");
 if(patched.length<=main.length||patched.length-main.length>190||
   patched.split('APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN').length!==3||
   !patched.includes('return runOwnerFollowPrecommit557(')||
   !patched.includes('callCanonical:(canonicalRequest=request)=>'))
   hold('PATCH_INVARIANTS');
 return patched;
}
