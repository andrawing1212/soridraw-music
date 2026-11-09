import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const source=p=>readFileSync(p,'utf8');
const TS=source('src/services/notifications/notificationDotState017.ts');
const JS=(await transform(TS,{loader:'ts',format:'esm',target:'es2022'})).code;
const dot=await import('data:text/javascript;base64,'+Buffer.from(JS).toString('base64'));
const app=source('src/App.tsx'),panel=source('src/components/studio/NotificationPanel.tsx');
const css=source('src/components/studio/notificationPanel.css');
const back=source('cloudflare/explore-worker/runtime/notification-unified-inbox-004.mjs');
const sql=source('cloudflare/explore-worker/candidates/20261109_017_notification_dot_only_triggers_candidate.sql');
const entry=source('cloudflare/explore-worker/canonical/preview-entry.js');
const pref={like:true,follow:true,complete:true,announcement:true,message:true};
const clock=Date.now();
const row=(category,id,time=clock-1000)=>({id,category,createdAt:time,actorName:'Sender',text:id});
const records=[
 row('like','real-like'),row('follow','real-follow'),
 row('complete','generated:good'),row('message','direct:one'),
 row('announcement','global:one'),row('like','example-like')
];
const calls={writes:0,events:0};
const map=new Map();
const previous=globalThis.window;
globalThis.window={localStorage:{
 getItem:k=>map.get(k)||null,
 setItem:(k,v)=>{calls.writes++;map.set(k,v);}
},dispatchEvent:()=>{calls.events++;}};
const base={activity:true,creation:true,announcement:true};
try{
 const first=dot.getNotificationPinkDots017('alice',records,true,pref,clock);
 assert.deepEqual(first,base);
 assert.deepEqual(dot.getNotificationPinkDots017('alice',[row('like','example-only')],true,pref,clock),
  {activity:false,creation:false,announcement:false},'examples must never set pink dots');
 assert.deepEqual(dot.getNotificationPinkDots017('alice',records,false,pref,clock),
  {activity:false,creation:false,announcement:false},'master OFF affects dots only');
 assert.equal(records.length,6,'turning off dots must never delete records');
 const partial={...pref,message:false,like:false,follow:false};
 assert.deepEqual(dot.getNotificationPinkDots017('alice',records,true,partial,clock),
  {activity:false,creation:true,announcement:true},'category switches hide only corresponding dots');
 assert.equal(calls.writes,0,'notification indicator read cannot write storage');
 assert.equal(dot.acknowledgeNotificationTab017('alice','activity',records,clock),true);
 assert.deepEqual(dot.getNotificationPinkDots017('alice',records,true,pref,clock),
  {activity:false,creation:true,announcement:true},'tab read clears only its pink dot');
 assert.equal(dot.acknowledgeNotificationTab017('alice','activity',records,clock),false);
 assert.equal(calls.writes,1,'reopening same tab must use local W0');
 assert.equal(dot.acknowledgeNotificationTab017('alice','announcement',records,clock),true);
 assert.deepEqual(dot.getNotificationPinkDots017('alice',records,true,pref,clock),
  {activity:false,creation:true,announcement:false});
 assert.equal(dot.acknowledgeNotificationTab017('alice','creation',records,clock),true);
 assert.deepEqual(dot.getNotificationPinkDots017('alice',records,true,pref,clock),
  {activity:false,creation:false,announcement:false});
 assert.deepEqual(dot.getNotificationPinkDots017('bob',records,true,pref,clock),base,
  'different account must not inherit read flags');
 assert.equal(dot.getNotificationPinkDots017('alice',[row('like','new-like',clock-700)],true,pref,clock).activity,true,
  'newer actual event restores the pink dot');
 assert.equal(dot.getNotificationPinkDots017('alice',records,true,{...pref,message:false},clock).activity,false,
  'turning indicator OFF cannot delete or mark an event');
 assert.equal(dot.getNotificationPinkDots017('alice',[row('like','old',clock-31*86400000)],true,pref,clock).activity,false,
  'expired event never lights the dot');
 assert.ok(calls.events>=3,'read acknowledgement must notify other UI surfaces');
}finally{globalThis.window=previous;}
assert.match(panel,/\['announcement','공지'\]/);
assert.match(panel,/const allRows=useMemo/);
assert.match(panel,/acknowledge\(activeSection\)/);
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/#ff59b5/);
assert.match(app,/soridraw-notification-mobile-dot/);
assert.match(entry,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(entry,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.doesNotMatch(back,/if\(!settings\.master\)return/);
assert.doesNotMatch(back,/if\(!settings\[x\.category\]/);
assert.doesNotMatch(back,/WHERE NOT EXISTS \(SELECT 1 FROM soridraw_notification_preferences_002/);
assert.doesNotMatch(sql,/JOIN soridraw_notification_preferences_002/);
assert.equal((sql.match(/CREATE TRIGGER /g)||[]).length,4);
assert.equal((sql.match(/DROP TRIGGER IF EXISTS /g)||[]).length,4);
assert.match(sql,/notification_activation_002/);
console.log('NOTIFICATION_017_PINK_DOTS_REAL_UNREAD_AND_SETTINGS_ONLY=PASS');
console.log('NOTIFICATION_017_THREE_TABS_RAIL_MOBILE_SOURCE_PASS=PASS');
console.log('NOTIFICATION_017_SERVER_SOURCE_ONLY_NOT_APPLIED=PASS');
