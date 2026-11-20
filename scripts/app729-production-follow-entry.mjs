// APP729 SOURCE-ONLY candidate entrypoint generator.
// Original active PRODUCTION Worker module remains unchanged and imported only.
// The new follow relay seam is COMPILED OFF and no production relay exists.
import { createHash } from 'node:crypto';
export const APP729_ENTRYPOINT_SOURCE = Object.freeze({
  path: 'production-follow-entry.mjs',
  adapter: 'integration/app729-production-follow-adapter.mjs',
  canonical: 'production-main.mjs',
});
export function buildApp729ProductionIntegrationEntry() {
  const code=[
    '// APP729 review candidate ONLY. DO NOT DEPLOY. Original main is unchanged.',
    "import canonical from './production-main.mjs';",
    "import {APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,integrateApp729ProductionOwnerFollow}",
    " from './integration/app729-production-follow-adapter.mjs';",
    '// The old canonical fetch/scheduled/alarm exports stay the same when OFF.',
    'let verifiedBridge=null;',
    'if (APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN) {',
    '  // Source is present solely to expose the reviewed legacy signal components.',
    '  // None of these PREVIEW-only modules may be called on PROD without a',
    '  // separately approved, durable, correctly authenticated integration.',
    "  const owner=await import('./quarantined/owner-follow-postcommit-555.mjs');",
    "  const publicFollow=await import('./quarantined/public-follow-dual-ack-671.mjs');",
    "  const scope=await import('./quarantined/owner-follow-target-scope-659.mjs');",
    "  const durable=await import('./quarantined/owner-follow-recovery-556.mjs');",
    "  const precommit=await import('./quarantined/owner-follow-precommit-557.mjs');",
    "  const lifecycle=await import('./integration/app730-source-only-follow-bridge.mjs');",
    "  const productionBridge=await import('./integration/app743-production-follow-bridge.mjs');",
    '  // These legacy modules do NOT implement the certified production bridge.',
    '  // This object intentionally lacks its required functions/evidence and',
    '  // therefore fails CLOSED even if the compile constant is flipped.',
    '  verifiedBridge={candidateSourceOnly:true,',
    '    reviewedExports:[Boolean(owner.deliverOwnerFollowPostcommit555),',
    '      Boolean(publicFollow.handleOwnerAndPublicFollowReplay671),',
    '      Boolean(scope.ownerFollowTargetInScope659),',
    '      Boolean(durable.createOwnerFollowRecovery556),',
    '      Boolean(precommit.runOwnerFollowPrecommit557),',
    '      Boolean(lifecycle.createApp730SourceOnlyBridge),',
    '      Boolean(productionBridge.createApp743ProductionFollowBridge)]};',
    '}',
    'export default integrateApp729ProductionOwnerFollow(canonical,{',
    ' enabled:APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,bridge:verifiedBridge',
    '});',
    '',
  ].join('\n');
  if (!code.includes('APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN') ||
      !code.includes("import canonical from './production-main.mjs'") ||
      !code.includes('integrateApp729ProductionOwnerFollow(canonical'))
    throw Error('APP729_INVALID_INTEGRATION_ENTRY');
  return { code, sha256:createHash('sha256').update(code).digest('hex'),
    originalMainUntouched:true, runtimeEnabled:false, deployable:false,
    additionalBindings:0, additionalMigrations:0 };
}
