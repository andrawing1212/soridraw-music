// APP713 exact active PREVIEW bundle patcher. No deploy/activation here.
// Unrecognized active code fails CLOSED. APP711 existing module retained.
import {createHash} from 'node:crypto';
export const PIN713={
 owner:'76c9d6df31bac01ceeaac1d171d0701621fac751a5017df19c6f8280e4c5c4d9',
 entry:'94d96147c57d741362935b3742e5d582174c387d671a0eaa3e9c9cdf6a8f7b91',
 canonical:'57ef11a2d8d34dd313add301b8c2cc40af37c797567a78fa37b89f618a9ed9a9',
};
const hash=s=>createHash('sha256').update(s).digest('hex');
const replaceOnce=(source,a,b,label)=>{
 if(source.split(a).length!==2)throw Error('APP713_HOLD_ANCHOR_'+label);
 return source.replace(a,b);
};
const pin=(s,expected,label)=>{
 if(hash(s)!==expected)throw Error('APP713_HOLD_ACTIVE_SHA_'+label);
};
const lines=(...rows)=>rows.join('\n');
export const APP713_EXTRA_MODULES={
 owner:['app713/owner-follow-click-service-713.mjs','app713/owner-follow-client-intent-713.mjs'],
 explore:['app713/owner-follow-click-ingress-713.mjs',
 'app713/owner-follow-click-canonical-entry-713.mjs',
 'app713/owner-follow-trusted-canonical-713.mjs'],
};
export function patchOwnerWorker713(source,{strict=true}={}){
 if(strict)pin(source,PIN713.owner,'OWNER');
 let result=lines(
  "import {routeOwnerFollowClickService713,createOwnerClickDoService713}",
  " from './app713/owner-follow-click-service-713.mjs';",'')+source;
 const old=lines(
  '  constructor(state, env) {',
  '    this.service = createOwnerDoService600({ state, env });',
  '  }',
  '  fetch(request) {',
  '    return this.service.fetch(request);',
  '  }',
  '  alarm() {',
  '    return this.service.alarm();',
  '  }');
 const newer=lines(
  '  constructor(state, env) {',
  '    this.service = createOwnerDoService600({ state, env });',
  "    this.click713 = String(state?.id?.name || '').startsWith('app713:pair:')",
  '      ? createOwnerClickDoService713({state,env,enabled:true}) : null;',
  '  }',
  '  fetch(request) {',
  '    if(this.click713)return this.click713.fetch(request);',
  '    return this.service.fetch(request);',
  '  }',
  '  alarm() {',
  '    if(this.click713)return this.click713.alarm();',
  '    return this.service.alarm();',
  '  }');
 result=replaceOnce(result,old,newer,'OWNER_DO_CLASS');
 const head=lines(
  'async function handleOwnerWorker600(request, env, {',
  '  enabled = APP600_OWNER_WORKER_COMPILED_OPEN,',
  '  syntheticOwnerUid',
  '} = {}) {',
  '  if (!active(env, enabled)) return reply(503, { ok: false, status: "disabled" });');
 result=replaceOnce(result,head,head+'\n'+lines(
  '  const click713=await routeOwnerFollowClickService713({request,env,enabled:true});',
  '  if(click713!==null)return click713;'),'OWNER_PRIVATE_ROUTE');
 return result;
}
export function patchExploreEntry713(source,{strict=true}={}){
 if(strict)pin(source,PIN713.entry,'EXPLORE_ENTRY');
 let result=source;
 const oldImport=lines(
  'import original, {',
  '  ExploreLikeBatchScheduler103,validateExploreAuth307,',
  "} from './preview-entry.mjs';");
 const newImport=lines(
  'import original, {',
  '  ExploreLikeBatchScheduler103,validateExploreAuth307,',
  '  readFollowCutoverState348,readFollowIntent354,',
  '  readEffectiveFollowMembership348,handleFollowOverlay354,',
  '  enforcePreAuthBurstLimit,',
  "} from './preview-entry.mjs';",
  'import {handleAuthenticatedFollowClick713}',
  " from './app713/owner-follow-click-ingress-713.mjs';",
  'import {routeTrustedFollowCanonical713}',
  " from './app713/owner-follow-click-canonical-entry-713.mjs';");
 result=replaceOnce(result,oldImport,newImport,'EXPLORE_IMPORT');
 const oldPrivate=lines(
  "  if(!(await activeFor607(this.env,uid)))return reply(503,{ok:false,status:'disabled'});",
  '  return handleOwnerFollowReplayService601({');
 const newPrivate=lines(
  "  if(!(await activeFor607(this.env,uid)))return reply(503,{ok:false,status:'disabled'});",
  '  const click=await routeTrustedFollowCanonical713({',
  '   request,env:this.env,ctx:this.ctx,enabled:true,',
  '   readCutover:readFollowCutoverState348,',
  '   readIntent:readFollowIntent354,',
  '   readMembership:readEffectiveFollowMembership348,',
  '   runPrecommit:runOwnerFollowPrecommit557,',
  '   reserve:(ticket)=>reserveOwnerFollowViaService601(ticket,this.env,{enabled:true}),',
  '   callCanonical:({request:canonicalRequest,env,actorUid,ownerUid,desired,cutover})=>',
  '    handleFollowOverlay354(canonicalRequest,env,{},actorUid,ownerUid,desired,cutover),',
  '  });',
  '  if(click!==null)return click;',
  '  return handleOwnerFollowReplayService601({');
 result=replaceOnce(result,oldPrivate,newPrivate,'EXPLORE_PRIVATE');
 const oldDefault=lines(
  ' async fetch(request,env,ctx){',
  '',
  '  // APP643: browser preflight');
 const newDefault=lines(
  ' async fetch(request,env,ctx){',
  '  const click=await handleAuthenticatedFollowClick713({',
  '   request,env,ctx,enabled:true,authenticate:validateExploreAuth307,',
  '   preAuthLimiter:enforcePreAuthBurstLimit,'
  '  });',
  '  if(click!==null)return click;',
  '',
  '  // APP643: browser preflight');
 result=replaceOnce(result,oldDefault,newDefault,'EXPLORE_PUBLIC');
 return result;
}
export function patchExploreCanonicalExports713(source,{strict=true}={}){
 if(strict)pin(source,PIN713.canonical,'CANONICAL');
 const names=['readFollowCutoverState348','readFollowIntent354',
  'readEffectiveFollowMembership348','handleFollowOverlay354',
  'enforcePreAuthBurstLimit'];
 for(const n of names){
  if(!source.includes('function '+n+'('))throw Error('APP713_HOLD_CANONICAL_SYMBOL_'+n);
 }
 return source+'\n// APP713 private module exports, no public HTTP route.\n'
  +'export { '+names.join(', ')+' };\n';
}
