// APP729: production follow signal integration seam, SOURCE ONLY, fail closed.
// This module does NOT authorize deployment, enable a relay or alter PROD Worker.
// Preserve canonical production fetch/scheduled/alarm behavior byte-for-byte while OFF.
export const APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN = false;
const FOLLOW_PATH = /^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/follow$/;
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
      const reservation=await bridge.reserveDurableBeforeCommit({
        request,env,ctx,actorUid:principal.uid,ownerUid:match[1],
        desired:request.method==='PUT',
      });
      if (!reservation || reservation.durable!==true ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(String(reservation.operationId||'')))
        return new Response(null,{status:503});
      // The original canonical Writer must see the exact ID reserved by the
      // server, not a second client-supplied or newly minted mutation ID.
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
        if (envelope?.followOperationId!==reservation.operationId ||
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
