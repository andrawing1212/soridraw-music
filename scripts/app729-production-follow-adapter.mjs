// APP729: production follow signal integration seam, SOURCE ONLY, fail closed.
// This module does NOT authorize deployment, enable a relay or alter PROD Worker.
// Preserve canonical production fetch/scheduled/alarm behavior byte-for-byte while OFF.
export const APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN = false;
const FOLLOW_PATH = /^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/follow$/;
// APP745: exact live SORIDRAW production origin set, not wildcard CORS.
// Candidate runs only when APP729 is independently verified and enabled.
const PROD_FOLLOW_ORIGINS = new Set([
  'https://soridraw.com',
  'https://www.soridraw.com',
  'https://soridraw.web.app',
  'https://soridraw.firebaseapp.com',
]);
const followOrderRequired=(request)=>{
  const headers=new Headers({
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'private, no-store',
    Vary:'Origin',
  });
  const origin=request.headers.get('Origin')||'';
  if(PROD_FOLLOW_ORIGINS.has(origin)){
    headers.set('Access-Control-Allow-Origin',origin);
    headers.set('Access-Control-Allow-Methods','GET, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Firebase-AppCheck');
  }
  return new Response(JSON.stringify({
    ok:false,error:{code:'FOLLOW_ORDER_REQUIRED',
      message:'The canonical follow revision is required before mutation'},
  }),{status:409,headers});
};
const FAIL = (code) => { throw Error('APP729_HOLD_' + code); };
const isFn = (f) => typeof f === 'function';

function requireBridgeProof729(bridge) {
  // An approved bridge must have durable PRE-COMMIT reservation, a canonical
  // post-commit settle proof and a reliable owner-only signal queue/replay.
  // Do not replace this with ctx.waitUntil, a browser-asserted UID, or a
  // best-effort Firebase call. Runtime wiring is deliberately not approved.
  if (!bridge || ![
    bridge.verifyFirebaseActorAndAppCheck,
    bridge.reserveDurableBeforeCommit,
    bridge.makeCanonicalRequest,
    bridge.verifyCanonicalSettledCommit,
    bridge.queueSettledOwnerSignal,
  ].every(isFn)) FAIL('BRIDGE_NOT_VERIFIED');
  if (bridge.ownerOnlyRulesProof !== true ||
      bridge.stableReceiptReplayProof !== true ||
      bridge.changedOnlyAndCanonicalOrderingProof !== true ||
      bridge.prodFunctionTargetVerified !== true) FAIL('DELIVERY_CONTRACT_NOT_PROVEN');
}
export function integrateApp729ProductionOwnerFollow(baseWorker,{
  enabled=APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,
  bridge=null,
}={}) {
  if (!baseWorker || !isFn(baseWorker.fetch)) FAIL('CANONICAL_WORKER_MISSING');
  if (enabled !== false && enabled !== true) FAIL('COMPILE_FLAG_INVALID');
  // Strongest OFF guarantee: exact SAME original object/function references.
  // No wrapper, no request body read, no subscription, no D1/R2/DO calls.
  if (!enabled) return baseWorker;
  requireBridgeProof729(bridge);
  // This ON code is a synthetic contract seam ONLY. No production bridge is
  // supplied, imported or enabled by the source-only generated entry.
  return {
    ...baseWorker,
    async fetch(request,env,ctx) {
      const pathname=new URL(request.url).pathname;
      const match=FOLLOW_PATH.exec(pathname);
      if (!match || (request.method!=='PUT' && request.method!=='DELETE'))
        return baseWorker.fetch(request,env,ctx);
      if (env?.SORIDRAW_ENVIRONMENT!=='production')
        return new Response(null,{status:503});
      const principal=await bridge.verifyFirebaseActorAndAppCheck({request,env,ctx});
      if (principal?.verified!==true ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(String(principal.uid||'')) ||
          principal.uid===match[1]) return new Response(null,{status:401});
      // APP745: APP354's first unversioned PUT/DELETE is a negotiation,
      // not an authorized mutation. Explicit click only; no canonical
      // Worker/D1/R2 read, DO reservation, Firebase signal or polling.
      // The existing client then GETs /follow-state once and retries with
      // stable followOperationId + followExpectedRevision.
      let raw;
      try { raw=await request.clone().text(); }
      catch { return new Response(null,{status:503}); }
      if(raw.trim()==='') return followOrderRequired(request);
      const reservation=await bridge.reserveDurableBeforeCommit({
        request,env,ctx,actorUid:principal.uid,ownerUid:match[1],
        desired:request.method==='PUT',
      });
      if (!reservation || reservation.durable!==true ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(String(reservation.operationId||'')))
        return new Response(null,{status:503});
      // Preserve APP354's canonical correlation ID while requiring it to be
      // bound to the distinct server-owned durable receipt. Legacy APP730
      // synthetic QA has no separate canonical ID and remains compatible.
      if (!Number.isSafeInteger(reservation.expectedRevision) ||
          reservation.expectedRevision < 0 || !reservation.cutoverToken ||
          !/^[0-9a-f]{32}$/.test(String(reservation.authEpoch||'')))
        return new Response(null,{status:503});
      let canonicalRequest;
      try {
        canonicalRequest=await bridge.makeCanonicalRequest({
          request,env,ctx,reservation,actorUid:principal.uid,ownerUid:match[1],
        });
        if (!(canonicalRequest instanceof Request) ||
            canonicalRequest.method!==request.method ||
            canonicalRequest.url!==request.url) throw Error('bad-canonical-request');
        const envelope=await canonicalRequest.clone().json();
        const canonicalId=reservation.canonicalOperationId??reservation.operationId;
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(canonicalId||'')) ||
            (reservation.canonicalOperationId!==undefined &&
             canonicalId===reservation.operationId) ||
            envelope?.followOperationId!==canonicalId ||
            envelope?.followExpectedRevision!==reservation.expectedRevision)
          throw Error('unmatched-canonical-operation');
      }catch{
        return new Response(null,{status:503});
      }
      // Canonical Worker retains the ONLY actual follow mutation.
      const response=await baseWorker.fetch(canonicalRequest,env,ctx);
      if (!response?.ok) return response;
      // The receipt must independently prove a CHANGED and fully SETTLED
      // canonical commit. Response.ok alone is NOT proof of a change.
      const proof=await bridge.verifyCanonicalSettledCommit({
        request,canonicalResponse:response.clone(),env,ctx,
        operationId:reservation.operationId,actorUid:principal.uid,
        ownerUid:match[1],desired:request.method==='PUT',
      });
      if (proof?.changed===true && proof?.settled===true &&
          proof?.operationId===reservation.operationId &&
          proof?.ownerUid===match[1] &&
          Number.isSafeInteger(proof?.revision) && proof.revision>0) {
        // Must be a durable server-owned queue operation, not waitUntil
        // delivery alone. The reservation is a replayable predecessor.
        await bridge.queueSettledOwnerSignal({
          env,ctx,reservation,proof,
          ownerUid:match[1],actorUid:principal.uid,
        });
      }
      return response;
    },
  };
}
