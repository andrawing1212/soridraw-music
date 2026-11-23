// Execute the real SQL on local SQLite; R2 objects use exact existing
// shapes. No cloud/network; no production or QA resource access.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createApp791PreviewCanonicalProof,APP791_PREVIEW_CANONICAL_PROOF_COMPILED_OPEN} from './app791-preview-canonical-follow-proof.mjs';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,owner_follow_auth_epoch_532 TEXT);CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid)) WITHOUT ROWID');
const r={ownerUid:'fixtureOwner',actorUid:'fixtureActor',authEpoch:'a'.repeat(32),cutoverToken:'fixture-cutover',canonicalOperationId:'fixture_operation_0001',operationId:'fixture_durable_000001',expectedRevision:1700000000000,priorR2Revision:93,desired:true,beforeFollowing:false,durable:true,ownerDoAlarmScheduled:true};
const pairRev=1700000000123,ownerRev=97,actualCount=143;
db.prepare('INSERT INTO profile_stats VALUES(?,?)').run(r.ownerUid,r.authEpoch);
db.prepare('INSERT INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)').run(r.actorUid,r.ownerUid,1,0,pairRev,r.canonicalOperationId);
const manifest='internal/explore/follow-cutover-v348/active.json',intent='internal/explore/follow-intents-v354/'+r.cutoverToken+'/'+r.actorUid+'/'+r.ownerUid+'.json',profile='internal/explore/shared-profile-v113/'+r.ownerUid+'.json';
const records=new Map([
 [manifest,{relationMode:'overlay348',writeMode:'active',cutoverToken:r.cutoverToken,profileCountsR2Exact:true,crashConsistentWriter354:true,orderedClientRequests354:true,oneWayAuthority348:true,legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true}],
 [intent,{token:r.cutoverToken,actor:r.actorUid,target:r.ownerUid,id:r.canonicalOperationId,following:true,expectedRevision:r.expectedRevision,revision:pairRev,settled:true}],
 [profile,{schemaVersion:1,revision:ownerRev,updatedAt:1700000000200,followSync354:{token:r.cutoverToken,exact:true,pending:{}},body:{data:{items:[],profile:{uid:r.ownerUid,followerCount:actualCount}}}}]
]);
let queries=0,gets=0,heads=0,drift=false,readError=false,bound=true;
const dbWrapper={prepare(sql){assert.match(sql,/^SELECT /);assert(!/\b(?:INSERT|UPDATE|DELETE|COUNT|SUM)\b/.test(sql));return {bind(...args){assert.deepEqual(args,[r.actorUid,r.ownerUid]);return {async first(){queries++;return db.prepare(sql).get(...args)}}}}}};
const bucket={async get(k){gets++;if(readError)throw Error('R2');const v=records.get(k);return v?{etag:k+'-etag',text:async()=>JSON.stringify(v)}:null},
 async head(k){heads++;return {etag:k+'-etag'+(drift&&k===intent?'-changed':'')}}};
const env={SORIDRAW_ENVIRONMENT:'preview',DB:dbWrapper,PROFILE_MEDIA:bucket};
const proof=createApp791PreviewCanonicalProof({enabled:true,verifyBoundReceipt:async()=>bound});
assert.equal(APP791_PREVIEW_CANONICAL_PROOF_COMPILED_OPEN,false);assert.equal(createApp791PreviewCanonicalProof(),null);
const call=()=>proof({env,reservation:r});
const v=await call();assert.equal(v.status,'CURRENT_EXACT_CHANGED_COMMIT_OBSERVED');
assert.equal(v.pairRevision,pairRev);assert.equal(v.ownerProjectionRevision,ownerRev);
assert.equal(v.ownerEventCandidate.version,ownerRev);assert.equal(v.ownerEventCandidate.followerCount,actualCount);
assert.equal(v.relayAuthorized,false);assert.equal(v.independentHistoryVerified,false);assert.equal(v.allWritersCutoverVerified,false);
assert.deepEqual([queries,gets,heads],[1,3,2]);
const expect=async reason=>{const x=await call();assert.equal(x.status,'HOLD');assert.equal(x.reason,reason);assert.equal(x.relayAuthorized,false)};
bound=false;const before=[queries,gets,heads];await expect('BOUND_DURABLE_RECEIPT_UNVERIFIED');assert.deepEqual([queries,gets,heads],before);bound=true;
for(const scope of ['production','test','isolated-qa'])assert.equal((await proof({env:{...env,SORIDRAW_ENVIRONMENT:scope},reservation:r})).status,'HOLD');
const m=records.get(manifest);m.legacyCounterWritersFrozen=false;await expect('CANONICAL_MANIFEST_UNVERIFIED');m.legacyCounterWritersFrozen=true;
const i=records.get(intent);i.settled=false;await expect('PAIR_INTENT_NOT_SETTLED');i.settled=true;
i.id='fixture_other_operation';await expect('PAIR_INTENT_IDENTITY_MISMATCH');i.id=r.canonicalOperationId;
db.prepare('UPDATE explore_follow_overrides_348 SET mutation_id=?').run('older_operation_id');await expect('D1_EXACT_MUTATION_OR_OWNER_EPOCH_MISMATCH');
db.prepare('UPDATE explore_follow_overrides_348 SET mutation_id=?').run(r.canonicalOperationId);
db.prepare('UPDATE profile_stats SET owner_follow_auth_epoch_532=?').run('b'.repeat(32));await expect('D1_EXACT_MUTATION_OR_OWNER_EPOCH_MISMATCH');
db.prepare('UPDATE profile_stats SET owner_follow_auth_epoch_532=?').run(r.authEpoch);
const p=records.get(profile);p.followSync354.pending={x:{}};await expect('OWNER_PROJECTION_NOT_EXACT_OR_NOT_ADVANCED');p.followSync354.pending={};
p.followSync354.token='other';await expect('OWNER_PROJECTION_NOT_EXACT_OR_NOT_ADVANCED');p.followSync354.token=r.cutoverToken;
p.revision=r.priorR2Revision;await expect('OWNER_PROJECTION_NOT_EXACT_OR_NOT_ADVANCED');p.revision=ownerRev;
drift=true;await expect('CANONICAL_OBSERVATION_CHANGED');drift=false;
readError=true;await expect('CANONICAL_READ_UNAVAILABLE_OR_CORRUPT');readError=false;
r.desired=false;r.beforeFollowing=true;r.expectedRevision=pairRev;r.priorR2Revision=ownerRev;
r.canonicalOperationId='fixture_cancel_operation_0001';r.operationId='fixture_durable_cancel_0001';
Object.assign(i,{id:r.canonicalOperationId,expectedRevision:pairRev,revision:pairRev+1234,following:false});
db.prepare('UPDATE explore_follow_overrides_348 SET following=0,updated_at=?,mutation_id=?').run(i.revision,i.id);
p.revision=ownerRev+4;p.updatedAt+=1000;p.body.data.profile.followerCount=actualCount-1;
const cancel=await call();assert.equal(cancel.status,'CURRENT_EXACT_CHANGED_COMMIT_OBSERVED');assert.equal(cancel.ownerEventCandidate.followerCount,142);
assert.equal(cancel.pairRevision,pairRev+1234);assert.equal(cancel.ownerProjectionRevision,ownerRev+4);
assert.equal(cancel.relayAuthorized,false);
console.log('APP791_LOCAL_SQLITE_EXACT_MUTATION_AND_DISTINCT_OWNER_REVISION_MULTI_FOLLOWER_COUNT=PASS');
console.log('APP791_STALE_NOOP_MISMATCH_PENDING_EPOCH_DRIFT_AND_NETWORK_HOLD=PASS');
console.log('APP791_OBSERVATION_ONE_SQL_THREE_R2_GET_TWO_HEAD_ZERO_WRITES; LIVE_ACTIVATION=0');
db.close();
