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
  " if(!row||row.epoch==='')return callCanonical();",
  " // An un-enrolled PUBLIC target still needs a durable public-counter relay.\n // No private owner notification is attempted with this reserved sentinel.\n // Private or missing profiles retain the canonical-only legacy behavior.\n let publicOnly680=false;\n if(publicWithoutEpoch===true&&env?.SORIDRAW_ENVIRONMENT==='preview'&&\n    env?.SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680==='1'&&row?.epoch===''){\n  // Only the newly approved public-only path pays the one indexed lookup.\n  // Old owner/canary and private follow requests keep their original SQL.\n  let publicStatus;\n  try{publicStatus=await env.DB.prepare(\n   'SELECT is_public FROM public_profiles WHERE uid=? LIMIT 1'\n  ).bind(parts[3]).first();}\n  catch{return callCanonical()}\n  publicOnly680=Number(publicStatus?.is_public)===1;\n }\n if(!row||(row.epoch===''&&!publicOnly680))return callCanonical();",'unenrolled');
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
