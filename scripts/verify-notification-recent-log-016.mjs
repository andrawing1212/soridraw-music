import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const helper=readFileSync('src/services/notifications/notificationRecentLog016.ts','utf8');
const source=(await transform(helper,{loader:'ts',format:'esm',target:'es2022'})).code;
const lib=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const app=readFileSync('src/App.tsx','utf8'),panel=readFileSync('src/components/studio/NotificationPanel.tsx','utf8');
assert.match(app,/rememberCompletedGenerationLog016\(user\.uid,[\s\S]*?projectCompletedExistingGenerations004\(\[\.\.\.generatedResults,\.\.\.existingLocal\]\)/);
assert.ok(app.indexOf('rememberCompletedGenerationLog016(user.uid,')<
          app.indexOf('const localHistory = [...generatedResults, ...existingLocal].slice(0, 10);'));
assert.match(panel,/readCompletedGenerationLog016\(uid\)/);
assert.match(panel,/localLogVersion/);
assert.doesNotMatch(panel,/생성기록은 최대 10곡이 표시됩니다\./);
const store=new Map();
let writes=0;
const oldWindow=globalThis.window;
globalThis.window={localStorage:{
 getItem:k=>store.get(k)||null,
 setItem:(k,v)=>{writes++;store.set(k,v);}
}};
const now=Date.now(),oneDay=86400000;
const notice=(id,n,at=now-1000)=>({
 id:'generated:'+id,category:'complete',actorName:'SORIDRAW',
 text:'Song '+n+' 생성이 완료되었습니다.',createdAt:at,
 song:{id:'track'+id,title:'Song '+n}
});
try{
 const ten=Array.from({length:10},(_,i)=>notice(String(i),i));
 const extra=Array.from({length:8},(_,i)=>notice(String(i+10),i+10));
 assert.deepEqual(lib.readCompletedGenerationLog016('alice',now),[]);
 assert.equal(writes,0,'reading alone cannot touch any storage');
 lib.rememberCompletedGenerationLog016('alice',ten,now);
 lib.rememberCompletedGenerationLog016('alice',extra,now);
 assert.equal(lib.readCompletedGenerationLog016('alice',now).length,18,
   'lightweight notices must survive crossing Recent Studio limit ten');
 assert.equal(lib.readCompletedGenerationLog016('bob',now).length,0,
   'different account cannot inherit notification history');
 const saved=store.get(lib.notificationRecentLogKey016('alice'));
 assert.ok(saved&&!/prompt|lyrics|songResult|userInput/.test(saved),
   'no full prompt, lyrics or user input stored in notification metadata');
 assert.equal(writes,2);
 lib.rememberCompletedGenerationLog016('alice',extra,now);
 assert.equal(writes,2,'same generation events must not write again');
 const visible=lib.mergeCompletedGenerationNotices016(
   [notice('17',99),notice('18',18)],lib.readCompletedGenerationLog016('alice',now),now);
 assert.equal(visible.length,19);
 assert.equal(visible.find(x=>x.id==='generated:17').text,'Song 99 생성이 완료되었습니다.');
 const old=notice('expired',1,now-31*oneDay),fresh=notice('edge',1,now-30*oneDay);
 lib.rememberCompletedGenerationLog016('alice',[old,fresh],now);
 const atEdge=lib.readCompletedGenerationLog016('alice',now);
 assert.equal(atEdge.some(x=>x.id==='generated:expired'),false);
 assert.equal(atEdge.some(x=>x.id==='generated:edge'),true);
 const beforeReadWrites=writes;
 lib.readCompletedGenerationLog016('alice',now+oneDay);
 assert.equal(writes,beforeReadWrites,'reading at a later date must never run cleanup writes');
 // Stored data stays bounded to small metadata rows, not 10 full song blobs.
 const many=Array.from({length:350},(_,i)=>notice('bulk'+i,i,now-i*1000));
 lib.rememberCompletedGenerationLog016('alice',many,now);
 assert.equal(lib.readCompletedGenerationLog016('alice',now).length,300);
 const failedNoPermission=()=>{throw Error('Storage disabled')};
 globalThis.window.localStorage.setItem=failedNoPermission;
 assert.doesNotThrow(()=>lib.rememberCompletedGenerationLog016('alice',[notice('newer',1)],now));
 console.log('NOTIFICATION_016_MORE_THAN_10_INDEPENDENT_LOCAL_METADATA=PASS');
 console.log('NOTIFICATION_016_UID_PRIVACY_DEDUP_RETENTION_NO_READ_WRITES=PASS');
 console.log('NOTIFICATION_016_EXISTING_RECENT_10_UNCHANGED_NO_REMOTE_DB=PASS');
}finally{globalThis.window=oldWindow;}
