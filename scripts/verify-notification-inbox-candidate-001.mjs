import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  recordConfirmedSocialNotification001, readOwnNotificationInbox001,
  publishGlobalAnnouncement001, readGlobalAnnouncements001,
  NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001,
} from '../cloudflare/explore-worker/runtime/notification-inbox-001.mjs';
const sql = readFileSync('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql', 'utf8');
assert.match(sql,/CANDIDATE ONLY/);
assert.match(sql,/PRIMARY KEY\(receiver_uid, bucket_ms, category, actor_uid, subject_id\)/);
assert.match(sql,/WITHOUT ROWID/);
assert.doesNotMatch(sql,/CREATE INDEX|TRIGGER|DROP TABLE|DELETE FROM|INSERT INTO/);
assert.equal(NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001,
  'internal/notifications/global-announcements-v1.json');
class FakeDb {
  constructor(){this.calls=[];this.inbox=new Map();this.announcements=new Map();}
  prepare(sql) {
    const db=this;
    return {bind(...args){return{
      async run(){
        db.calls.push({op:'write',sql,args});
        if(sql.includes('soridraw_notification_inbox_001')){
          const key=JSON.stringify(args.slice(0,5));
          if(db.inbox.has(key))return {meta:{changes:0}};
          db.inbox.set(key,args);return {meta:{changes:1}};
        }
        if(sql.includes('soridraw_global_announcements_001')){
          if(db.announcements.has(args[0]))return {meta:{changes:0}};
          db.announcements.set(args[0],args);return {meta:{changes:1}};
        }
        throw Error('Unknown SQL write');
      },
      async all(){
        db.calls.push({op:'read',sql,args});
        if(sql.includes('soridraw_notification_inbox_001'))return{results:
          [...db.inbox.values()].filter(row=>row[0]===args[0])
            .sort((a,b)=>b[1]-a[1]).slice(0,args[1])
            .map(row=>({category:row[2],actorUid:row[3],subjectId:row[4],
              actorName:row[5],subjectTitle:row[6],createdAt:row[7]}))};
        if(sql.includes('soridraw_global_announcements_001'))return{results:
          [...db.announcements.values()].sort((a,b)=>b[3]-a[3]).slice(0,args[0])
            .map(a=>({id:a[0],title:a[1],body:a[2],publishedAt:a[3]}))};
        throw Error('Unknown SQL read');
      },
    }}};
  }
}
const db=new FakeDb(), now=1_800_000_000_000;
const proof={settled:true,changed:true,enabled:true,category:'like',actorUid:'actor-a',
  receiverUid:'owner-b',subjectId:'track-1',actorName:'Alice',subjectTitle:'Track',occurredAtMs:now};
const opts={db,sourceEvent:{untrusted:true},verifyFinalized:async()=>proof,now};
assert.deepEqual(await recordConfirmedSocialNotification001(opts),
  {status:'inactive',rowsWritten:0});
assert.equal(db.calls.length,0);
for(const changed of [false]){
  assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true,
    verifyFinalized:async()=>({...proof,changed})}),{status:'no-final-change',rowsWritten:0});
}
assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true,
  verifyFinalized:async()=>({...proof,enabled:false})}),
  {status:'no-final-change',rowsWritten:0});
assert.equal(db.calls.length,0,'no-op/unlike cannot write');
assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true}),
  {status:'recorded',rowsWritten:1});
assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true}),
  {status:'duplicate',rowsWritten:0});
const later={...proof,occurredAtMs:now+30*60*1000};
assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true,
  verifyFinalized:async()=>later,now:now+30*60*1000}),
  {status:'duplicate',rowsWritten:0});
assert.equal(db.inbox.size,1);
assert.deepEqual(await recordConfirmedSocialNotification001({...opts,activated:true,
  verifyFinalized:async()=>({...proof,actorUid:'owner-b'})}),{status:'self',rowsWritten:0});
await assert.rejects(recordConfirmedSocialNotification001({...opts,activated:true,
  verifyFinalized:async()=>({...proof,receiverUid:''})}),
  /NOTIFICATION_INVALID_FINALIZED_IDENTITY/);
assert.deepEqual(await readOwnNotificationInbox001({db,authenticate:async()=> 'owner-b',
  activated:true}),{status:'ok',items:[{category:'like',actorUid:'actor-a',
  subjectId:'track-1',actorName:'Alice',subjectTitle:'Track',createdAt:now}]});
assert.deepEqual(await readOwnNotificationInbox001({db,authenticate:async()=> 'other-user',
  activated:true}),{status:'ok',items:[]});
assert.equal(db.calls.filter(c=>c.op==='read').length,2);
await assert.rejects(readOwnNotificationInbox001({db,authenticate:async()=>null,
  activated:true}),/NOTIFICATION_NOT_AUTHENTICATED/);
const ann={id:'notice-1',title:'Notice',body:'Hello all',publishedAtMs:now};
assert.deepEqual(await publishGlobalAnnouncement001({db,announcement:ann,
  verifyAdmin:async()=>false}),{status:'inactive',rowsWritten:0});
await assert.rejects(publishGlobalAnnouncement001({db,announcement:ann,
  verifyAdmin:async()=>false,activated:true}),/NOTIFICATION_ADMIN_DENIED/);
assert.deepEqual(await publishGlobalAnnouncement001({db,announcement:ann,
  verifyAdmin:async()=>true,activated:true}),{status:'published',rowsWritten:1});
assert.deepEqual(await publishGlobalAnnouncement001({db,announcement:ann,
  verifyAdmin:async()=>true,activated:true}),{status:'duplicate',rowsWritten:0});
assert.equal(db.announcements.size,1);
assert.deepEqual((await readGlobalAnnouncements001({db,activated:true})).items,
  [{id:'notice-1',title:'Notice',body:'Hello all',publishedAt:now}]);
const active=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.doesNotMatch(active,/notification-inbox-001|soridraw_notification_inbox_001|soridraw_global_announcements_001/);
console.log('NOTIFICATION_CONFIRMED_ONLY_DEDUP_ONE_WRITE=PASS');
console.log('NOTIFICATION_RECIPIENT_ISOLATION_AND_READ_ON_OPEN_ONLY=PASS');
console.log('NOTIFICATION_GLOBAL_ANNOUNCEMENT_ONE_WRITE=PASS');
console.log('NOTIFICATION_SHARED_BACKEND_INACTIVE=PASS');
