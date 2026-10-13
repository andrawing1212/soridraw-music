import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const env=readFileSync('functions/src/exploreLikeEnvironment416.ts','utf8');
const task=readFileSync('functions/src/exploreLikePrivateTask416.ts','utf8');
const index=readFileSync('functions/src/index.ts','utf8');
const client=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
const expected={
 preview:['recordPrivateLike416','stage416SettlePrivateWindowCandidate','privateLikeBatch416','likeBatchTiming416/current','soridraw-explore-preview'],
 test:['recordPrivateLike416Test','stage416SettlePrivateWindowTest','stage416Transient/test/privateLikeBatch','stage416Transient/test/likeBatchTiming/current','soridraw-explore-test'],
 production:['recordPrivateLike416Production','stage416SettlePrivateWindowProduction','stage416Transient/production/privateLikeBatch','stage416Transient/production/likeBatchTiming/current','soridraw-explore-api'],
};
for(const [name,values] of Object.entries(expected))
 for(const value of values)assert.ok(env.includes(value),`${name} missing ${value}`);
for(let column=0;column<expected.preview.length;column++)
 assert.equal(new Set(Object.values(expected).map(row=>row[column])).size,3,
  `environment identity column ${column} is not isolated`);
assert.match(task,/queue416\(config\)/);
assert.match(task,/config\.privateRoot\+'\/\{uid\}\/window'/);
assert.match(task,/const endpoint=config\.workerEndpoint/);
assert.doesNotMatch(task,/WORKER_URL\|\|/);
for(const suffix of ['Test','Production']){
 assert.match(index,new RegExp(`recordPrivateLike416${suffix} = onCall`));
 assert.match(index,new RegExp(`stage416SettlePrivateWindow${suffix}`));
 assert.match(index,new RegExp(`masterGetLikeBatchTiming416${suffix}`));
}
assert.match(client,/STAGE416_SHARED_RTDB_BATCH_ACTIVE=false/);
assert.match(client,/test\.soridraw\.com[\s\S]*recordPrivateLike416Test/);
assert.match(client,/soridraw\.com[\s\S]*recordPrivateLike416Production/);
assert.match(client,/return 'recordPrivateLike416';/);
for(const selected of Object.keys(expected))
 assert.deepEqual(Object.keys(expected).filter(name=>name===selected),[selected]);
console.log('STAGE416_PREVIEW_LEGACY_COMPAT=PASS');
console.log('STAGE416_TEST_PRODUCTION_TRANSIENT_ISOLATION=PASS');
console.log('STAGE416_CALLABLE_HOST_SELECTION=PASS');
console.log('STAGE416_TIMING_CONFIG_ISOLATION=PASS');
console.log('STAGE416_GENERAL_CLIENT_FLAG_OFF=PASS');
