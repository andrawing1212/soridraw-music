// APP680: exact, source-checked expansion of the already active PREVIEW
// private owner DO + public follower notification. No D1 schema or new DO class.
import {readFileSync} from 'node:fs';
import {hash660,patchExplore660,patchOwner660,patchEnrollment660}
 from './owner-follow-general660.mjs';
import {patchOwnerServiceDualAck671} from './public-follow-active-patch-671.mjs';
const read=p=>readFileSync(p,'utf8');
const exact=(value,expected,label)=>{
 if(hash660(value)!==hash660(expected))
  throw Error('APP680_ACTIVE_SOURCE_DRIFT_'+label);
};
const one=(value,old,next,label)=>{
 if(value.split(old).length!==2)throw Error('APP680_ANCHOR_DRIFT_'+label);
 return value.replace(old,next);
};
const runtime='cloudflare/explore-worker/runtime/';
const precommit=runtime+'owner-follow-precommit-557.mjs';
const http=runtime+'public-follow-http-669.mjs';
const dual=runtime+'public-follow-dual-ack-671.mjs';
const enrollment=runtime+'owner-follow-enrollment-544.mjs';
const fixture='scripts/fixtures/owner-follow660/owner-follow-service-601.mjs';
export const patchPrecommit680=source=>{
 let out=one(source,
  'enabled=APP557_OWNER_PRECOMMIT_COMPILED_OPEN,\\n}={}){',
  'enabled=APP557_OWNER_PRECOMMIT_COMPILED_OPEN,publicWithoutEpoch=false,\\n}={}){','signature');
 out=one(out,
  '   owner_follow_auth_epoch_532 AS epoch,\\n   EXISTS(',
  '   owner_follow_auth_epoch_532 AS epoch,\\n   EXISTS(SELECT 1 FROM public_profiles p WHERE p.uid=? AND p.is_public=1) AS public_target,\\n   EXISTS(','sql');
 out=one(out,
  '.bind(auth.uid,parts[3],auth.uid,parts[3],parts[3]).first();',
  '.bind(parts[3],auth.uid,parts[3],auth.uid,parts[3],parts[3]).first();','sql-bind');
 out=one(out,
  " if(!row||row.epoch==='')return callCanonical();",
  " // An un-enrolled PUBLIC target still needs a durable public-counter relay.\\n"+
  " // No private owner notification is attempted with this reserved sentinel.\\n"+
  " // Private or missing profiles retain the canonical-only legacy behavior.\\n"+
  " const publicOnly680=publicWithoutEpoch===true\\u0026\\u0026\\n"+
  "  env?.SORIDRAW_ENVIRONMENT==='preview'\\u0026\\u0026\\n"+
  "  env?.SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680==='1'\\u0026\\u0026\\n"+
  "  row?.epoch===''\\u0026\\u0026Number(row?.public_target)===1;\\n"+
  " if(!row||(row.epoch===''\\u0026\\u0026!publicOnly680))return callCanonical();".replaceAll('\\u0026','&'),'unenrolled');
 out=one(out,
  " if(!/^[0-9a-f]{32}$/.test(String(row.epoch||'')))",
  " if(!publicOnly680&&!/^[0-9a-f]{32}$/.test(String(row.epoch||'')))",'epoch-guard');
 out=one(out,
  '   authEpoch:String(row.epoch),operationId,',
  "   authEpoch:publicOnly680?'0'.repeat(32):String(row.epoch),operationId,",'ticket');
 exact(out,read(precommit),'precommit');
 return out;
};
export const patchPublicHttp680=source=>{
 const authored=read(http);
 const prior=one(authored,
  "return {status:'delivered',deliveredRevision:proof.claim.target.revision};",
  "return {status:'delivered'};",'http-baseline');
 exact(source,prior,'public-http');
 return authored;
};
export const patchDualAck680=source=>{
 const authored=one(read(dual),
  'APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=false',
  'APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=true','dual-on');
 const first=authored.indexOf(' // Public counters for a visible target');
 const last=authored.indexOf(' const existing=await ownerHandler();',first);
 if(first<0||last<0||last<=first)throw Error('APP680_DUAL_SOURCE_ANCHORS');
 let prior=authored.slice(0,first)+authored.slice(last);
 prior=one(prior,
  ' authorizePublicOnly=()=>false,\\n','',
  'dual-callback');
 exact(source,prior,'dual-ack');
 return authored;
};
export const patchService680=source=>{
 const authored=patchOwnerServiceDualAck671(read(fixture));
 const start=authored.indexOf('  authorizePublicOnly:(request,reservation)=>');
 const end=authored.indexOf('  ownerHandler:',start);
 // This callback is after ownerHandler, so its end is the enclosing call.
 const close=authored.indexOf(' });',start);
 if(start<0||close<0||end!==-1)throw Error('APP680_SERVICE_ANCHOR');
 const prior=authored.slice(0,start)+authored.slice(close);
 exact(source,prior,'service-binding');
 return authored;
};
export const patchEnrollment680=source=>{
 const expected=read(enrollment);
 if(hash660(source)===hash660(expected))return source;
 const amended=patchEnrollment660(source);
 exact(amended,expected,'owner-enrollment');
 return amended;
};
export const patchEntry680=source=>patchExplore660(source);
export const patchDo680=source=>patchOwner660(source);
