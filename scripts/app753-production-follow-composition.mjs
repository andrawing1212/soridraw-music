// APP753: review-only composition of the existing APP729 adapter with APP743.
// OFF is the immutable default. No production runtime imports or invokes this
// source; there is no credential, Cloudflare binding, Firebase or data access.
// ON is available only for isolated dependency-injected regression tests until
// independently reviewed production dependencies and rollback are supplied.
import {integrateApp729ProductionOwnerFollow}
  from './app729-production-follow-adapter.mjs';
import {createApp743ProductionFollowBridge}
  from './app743-production-follow-bridge.mjs';
export const APP753_PRODUCTION_FOLLOW_COMPILED_OPEN=false;
const fail=s=>{throw Error('APP753_PRODUCTION_FOLLOW_HOLD_'+s)};
const REQUIRED=[
 'verifyFirebasePrincipal',
 'readCanonicalPair',
 'findDurableReceipt',
 'reserveOwnerDurableAlarm',
 'verifyCanonicalCommit',
];
export function composeApp753ProductionFollow(base,{
  enabled=APP753_PRODUCTION_FOLLOW_COMPILED_OPEN,
  evidence=null,dependencies=null,
}={}){
  if(!base||typeof base.fetch!=='function')fail('CANONICAL_WORKER_MISSING');
  if(typeof enabled!=='boolean')fail('COMPILE_GATE_INVALID');
  // No wrapper, modified method, environment read or any dependency
  // access on the real production OFF path.
  if(!enabled)return base;
  if(!dependencies||typeof dependencies!=='object'||
    REQUIRED.some(name=>typeof dependencies[name]!=='function'))
    fail('PRODUCTION_DEPENDENCIES_UNVERIFIED');
  // APP743 requires signed Auth+AppCheck, durable receipt, settled canonical
  // revision, owner-only receiver and independently reviewed evidence.
  // Never infer proof from truthy env flags or the APP749 QA test result.
  const bridge=createApp743ProductionFollowBridge({
    evidence,
    verifyFirebasePrincipal:dependencies.verifyFirebasePrincipal,
    readCanonicalPair:dependencies.readCanonicalPair,
    findDurableReceipt:dependencies.findDurableReceipt,
    reserveOwnerDurableAlarm:dependencies.reserveOwnerDurableAlarm,
    verifyCanonicalCommit:dependencies.verifyCanonicalCommit,
  });
  return integrateApp729ProductionOwnerFollow(base,{enabled:true,bridge});
}
