// APP729 + APP753 source-only production candidate entrypoint generator.
// The real production module is preserved byte-for-byte. OFF returns that
// original module object. ON is impossible without actual reviewed server
// dependencies and APP743 production evidence. NEVER deploy this candidate.
import { createHash } from 'node:crypto';
export const APP729_ENTRYPOINT_SOURCE = Object.freeze({
  path:'production-follow-entry.mjs',
  adapter:'integration/app729-production-follow-adapter.mjs',
  composition:'integration/app753-production-follow-composition.mjs',
  bridge:'integration/app743-production-follow-bridge.mjs',
  canonical:'production-main.mjs',
});
export function buildApp729ProductionIntegrationEntry(){
 const code=[
  '// APP753 review candidate ONLY. DO NOT DEPLOY. The original PROD module is untouched.',
  "import canonical from './production-main.mjs';",
  "import {APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN}",
  " from './integration/app729-production-follow-adapter.mjs';",
  "import {composeApp753ProductionFollow}",
  " from './integration/app753-production-follow-composition.mjs';",
  "import {createApp754ProductionPrincipalVerifier}",
  " from './integration/app754-production-firebase-principal.mjs';",
  '// OFF: original canonical fetch/scheduled/alarm identities are unchanged.',
  '// ON: cannot run without independently verified production Auth, DO receipt,',
  '// canonical settled revision, signed Function and owner-only Rules evidence.',
  '// Only the verified production project signed principal is supplied here.',
  '// The four DO/canonical/settlement callbacks and independent evidence',
  '// remain unconnected; flipping the flag alone ALWAYS fails closed.',
  'const deps=APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN',
  ' ? {verifyFirebasePrincipal:createApp754ProductionPrincipalVerifier()}',
  ' : null;',
  'export default composeApp753ProductionFollow(canonical,{',
  ' enabled:APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,dependencies:deps',
  '});',
  '',
 ].join('\n');
 if(!code.includes('APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN')||
    !code.includes("import canonical from './production-main.mjs'")||
    !code.includes('composeApp753ProductionFollow(canonical'))
   throw Error('APP729_INVALID_INTEGRATION_ENTRY');
 return {code,sha256:createHash('sha256').update(code).digest('hex'),
   originalMainUntouched:true,runtimeEnabled:false,deployable:false,
   productionDependenciesProvided:false,
   additionalBindings:0,additionalMigrations:0};
}
