// app518 PREVIEW single-song readiness: source-only, no live IO or mutations.
// Separates "connector code exists" from "safe to deploy/activate".
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const fn=read('functions/src/index.ts');
const bridge=read('functions/src/app518LiveConnector.ts');
const server=read('functions/src/app518ServerTransport.ts');
const worker=read('cloudflare/media-worker/src/index.js');
const r2=read('cloudflare/media-worker/src/catalogR2Provider518.js');
const serverBridge=read('cloudflare/media-worker/src/catalogServerBridge518.js');
const contract=read('DOCS/APP518_MUSIC_NOTE_CATALOG_REPAIR_CONTRACT.md');
const wrangler=read('cloudflare/media-worker/wrangler.jsonc');
for(const marker of [
 'export const app518FavoriteCatalogChanged=',
 'export const app518ExactFavoriteSource=',
 'app518BridgeActive()',
])assert.ok(fn.includes(marker),'missing Firebase source connector '+marker);
assert.ok(bridge.includes('matchesApp518PilotSong'),'single-song owner pilot guard missing');
assert.ok(server.includes('DENY_NOT_PREVIEW_PILOT_SONG'),'exact source must be owner pilot scoped');
for(const marker of [
 "url.pathname === '/v1/server/catalog518'",
 'const app518ServerConnector = (env)',
 'SORIDRAW_APP518_PILOT_UID','SORIDRAW_APP518_PILOT_FAVORITE_ID',
 'APPROVED_ALL_3_AND_NO_OLD_WRITERS',
 'if(!connector)return jsonResponse({code:\'HOLD_APP518_RELEASE_OFF\'},503)',
])assert.ok(worker.includes(marker),'missing fail-closed Worker source '+marker);
// Focused PREVIEW blocker: an installed connector is not an enabled bridge.
// The bridge requires an independently verified account-wide D1 cutover.
// Worker currently supplies no such proof, deliberately failing closed.
// Never replace this with an env VERIFIED string or unconditional true.
assert.match(serverBridge,/signedAccountD1CutoverVerified\\s*=\\s*false/,
 'missing independently verified D1 cutover gate');
assert.match(serverBridge,/signedAccountD1CutoverVerified\\s*===\\s*true/,
 'D1 cutover proof must be mandatory for activation');
const connector=worker.split('const app518ServerConnector = (env) => {')[1]
 ?.split('const handleApp518ServerRoute=')[0];
assert.ok(connector,'actual Worker bridge entrypoint missing');
assert.ok(connector.includes('createApp518ServerBridge({'),
 'Worker entrypoint must reach the gated bridge');
assert.doesNotMatch(connector,/signedAccountD1CutoverVerified\\s*:\\s*(?:true|env\\b)/,
 'do not bypass a signed account-wide cutover with a constant or env flag');
assert.ok(r2.includes("ENABLED_AFTER_SHARED_ROLLOUT"),'no explicit shared-catalog fence');
assert.ok(worker.includes('async scheduled(_event,env,ctx)'),'no bounded drain source');
assert.ok(contract.includes('실서버 활성화 없음'),'readiness must not claim live rollout');
for(const name of ['CATALOG_OUTBOX_518','ACCOUNT_D1_BUDGET_518','CATALOG_SERVER_HMAC_518',
 'SORIDRAW_CANONICAL_CATALOG_518','SORIDRAW_APP518_PILOT_UID']){
 assert.ok(!new RegExp('^\\s*(?:\\"?'+name+'\\"?)\\s*:', 'm').test(wrangler),
  'live D1/secret/pilot flag unexpectedly provisioned in source: '+name);
}
console.log('APP518_PREVIEW_PILOT_FIREBASE_WORKER_SOURCE_LINK=PASS');
console.log('APP518_PREVIEW_SINGLE_SONG_PILOT_AND_SHARED_FENCE=PASS');
console.log('APP518_PREVIEW_NO_DEPLOYMENT_CONFIG_OR_USER_DATA_MUTATION=PASS');
console.log('APP518_PREVIEW_ACCOUNT_D1_CUTOVER_PROOF=HOLD_UNWIRED_IN_ACTUAL_WORKER_ENTRYPOINT');
console.log('APP518_PREVIEW_LIVE_READINESS=HOLD_REQUIRES_3_ENV_WRITER_FENCE_D1_HMAC_FIREBASE_AND_DEPLOY_APPROVAL');
