// Stage022 — PREVIEW authenticated inbox app wiring. No real user credentials,
// server writes or browser storage mutations. One fetch per explicit open.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build,transform} from 'esbuild';

const read=p=>readFileSync(p,'utf8');
const helper=read('src/services/notifications/notificationPreviewHost022.ts');
const hostMod=await import('data:text/javascript;base64,'+
  Buffer.from((await transform(helper,{loader:'ts',format:'esm'})).code).toString('base64'));
const base=hostMod.NOTIFICATION_PREVIEW_WORKER_022;
for(const host of ['preview.soridraw.com','soridraw-preview.web.app','soridraw-preview.firebaseapp.com']){
 assert.equal(hostMod.canUsePreviewInbox022(host,base),true,'APPROVED_HOST_'+host);
}
for(const host of ['soridraw.com','www.soridraw.com','test.soridraw.com',
 'localhost','127.0.0.1','preview.soridraw.com.evil.tld','']){
 assert.equal(hostMod.canUsePreviewInbox022(host,base),false,'OTHER_HOST_BLOCKED_'+host);
}
for(const wrong of ['https://soridraw-explore-api.andrawing1212.workers.dev',
 'https://soridraw-explore-test.andrawing1212.workers.dev',
 'https://preview.soridraw.com/v1','']){
 assert.equal(hostMod.canUsePreviewInbox022('preview.soridraw.com',wrong),false,
  'MISMATCHED_WORKER_BLOCKED');
}
const src=read('src/services/notifications/notificationInbox004.ts');
const panel=read('src/components/studio/NotificationPanel.tsx');
const dots=read('src/services/notifications/useNotificationDots017.ts');
const sync=read('src/services/notifications/notificationAccountSyncCore003.ts');
assert.match(src,/NOTIFICATION_INBOX_ENABLED_004=[\s\S]*?canUsePreviewInbox022\(window.location.hostname,EXPLORE_API_BASE\)/);
assert.match(panel,/if \(!open \|\| !NOTIFICATION_INBOX_ENABLED_004\) return;/);
assert.match(panel,/loadOwnNotifications004\(current,controller.signal\)/);
assert.match(panel,/return \(\) => \{ live = false; controller.abort\(\); \}/);
assert.match(panel,/remoteInbox.uid===uid \? \[\.\.\.remoteInbox.items,\.\.\.localCompletions\] : \[\.\.\.localCompletions\]/);
assert.match(panel,/NOTIFICATION_INBOX_ENABLED_004 && NOTIFICATION_ACCOUNT_SYNC_ENABLED_003/);
assert.match(panel,/readCompletedGenerationLog016\(uid\)/);
assert.match(panel,/visualExample = isNotificationVisualPreview\(\)/);
assert.match(panel,/withPreviewNotificationExamples023\(collapseRepeatedFollowNoticesByActor554\(genuineRows\),visualExample\)/);
assert.match(panel,/sampleHeader = visualExample && rows\.some\(isPreviewSample\)/);
// Stage027: real signed-account GET result is visible, but never requests
// additional endpoints or mistakes clearly labelled sample rows as genuine.
assert.match(panel,/setRemoteAuthProof027\(\{uid:current\.uid,state:'checking'/);
assert.match(panel,/setRemoteAuthProof027\(\{uid:current\.uid,state:'verified',count:items\.length/);
assert.match(panel,/setRemoteAuthProof027\(\{uid:current\.uid,state:'failed',count:0,httpCode\}/);
assert.match(panel,/remoteAuthProof027\.uid === uid && remoteAuthProof027\.state !== 'idle'/);
assert.match(panel,/PREVIEW 서버 인증 연결 정상/);
assert.match(panel,/NOTIFICATION_INBOX_HTTP_\(\[1-5\]/);
assert.doesNotMatch(panel,/console\.log\(.*(?:IdToken|AppCheck|jwt|Authorization)/);
assert.match(dots,/isNotificationVisualPreview\(\) \|\| NOTIFICATION_INBOX_ENABLED_004/);
assert.match(sync,/NOTIFICATION_ACCOUNT_SYNC_ENABLED_003 = false/);
assert.doesNotMatch(panel,/setInterval\(|onSnapshot\(|getDocs\(|getDoc\(/);
assert.doesNotMatch(src,/(?:method:'PUT'|method:'POST'|localStorage\.setItem)/);

let checks=0,network=0,stored=0;
const previousWindow=globalThis.window,oldFetch=globalThis.fetch;
globalThis.window={location:{hostname:'preview.soridraw.com'},localStorage:{
  getItem:()=>null,setItem:()=>{stored++;},
}};
const moduleBuild=await build({
 entryPoints:['src/services/notifications/notificationInbox004.ts'],
 bundle:true,write:false,platform:'node',target:'es2022',format:'esm',logLevel:'silent',
 plugins:[{
  name:'mock-appcheck-and-selected-api',
  setup(plugin){
   plugin.onResolve({filter:/^\.\.\/\.\.\/firebase$/},()=>({path:'auth',namespace:'notify022'}));
   plugin.onResolve({filter:/^\.\.\/\.\.\/config\/exploreEnvironment$/},
    ()=>({path:'config',namespace:'notify022'}));
   plugin.onLoad({filter:/.*/,namespace:'notify022'},args=>({
    contents:args.path==='auth'
      ? "export async function getFirebaseAppCheckToken(){return globalThis.__notifyAppCheck022;}"
      : "export const EXPLORE_API_BASE='https://soridraw-explore-preview.andrawing1212.workers.dev';",
    loader:'js',
   }));
  }
 }]
});
try{
 const app=await import('data:text/javascript;base64,'+
   Buffer.from(moduleBuild.outputFiles[0].text).toString('base64'));
 assert.equal(app.NOTIFICATION_INBOX_ENABLED_004,true,'REAL_PREVIEW_HOST_ENABLED');
 const user={uid:'user-022',getIdToken:async()=> 'jwt-022'};
 const defaultPrefs={revision:0,master:true,like:true,follow:true,
   complete:true,announcement:true,message:true};
 globalThis.__notifyAppCheck022='appcheck-022';
 const alert={id:'social:follow:example',category:'follow',actorName:'Friend',
   text:'나를 팔로우했습니다.',createdAt:Date.now()-1000,actorUid:'other-022'};
 globalThis.fetch=async(url,options)=>{
   checks++;network++;
   assert.equal(url,base+'/v1/me/notifications/inbox');
   assert.equal(options.method,'GET');
   assert.equal(options.cache,'no-store');
   assert.equal(options.headers.Authorization,'Bearer jwt-022');
   assert.equal(options.headers['X-Firebase-AppCheck'],'appcheck-022');
   assert.equal(options.signal?.aborted,false);
   return new Response(JSON.stringify({ok:true,data:{items:[alert],preferences:defaultPrefs}}),
    {status:200,headers:{'Content-Type':'application/json'}});
 };
 const controller=new AbortController();
 const first=await app.loadOwnNotifications004(user,controller.signal);
 assert.equal(network,1,'ONE_GET_PER_OPEN');
 assert.equal(first.items.length,1);
 assert.equal(first.items[0].actorUid,'other-022');
 assert.deepEqual(first.preferences,defaultPrefs);
 controller.abort();
 globalThis.__notifyAppCheck022='';
 await assert.rejects(app.loadOwnNotifications004(user),/AUTH_UNAVAILABLE/);
 assert.equal(network,1,'NO_GET_IF_APPCHECK_MISSING');
 globalThis.__notifyAppCheck022='appcheck-022';
 globalThis.fetch=async()=>{network++;return new Response('{}',{status:503});};
 await assert.rejects(app.loadOwnNotifications004(user),/HTTP_503/);
 assert.equal(network,2,'ONE_FAILED_GET_NO_AUTO_RETRY');
 globalThis.fetch=async()=>{network++;return new Response(JSON.stringify({ok:true,data:{
   items:[alert],preferences:{...defaultPrefs,master:'false'}
 }}),{status:200});};
 await assert.rejects(app.loadOwnNotifications004(user),/INVALID_ACCOUNT_SETTINGS/);
 assert.equal(network,3,'MALFORMED_DATA_MUST_NOT_FALLBACK_TO_FOREIGN_CACHE');
 assert.equal(stored,0,'READING_INBOX_MUST_NOT_WRITE_BROWSER_STORAGE');
 assert.equal(checks,1,'ONLY_ONE_VERIFIED_SUCCESSFUL_FETCH');
 console.log('NOTIFICATION_022_PREVIEW_HOST_AND_EXACT_WORKER_ONLY=PASS');
 console.log('NOTIFICATION_022_EXPLICIT_GET_AUTH_APPCHECK_ONE_READ_NO_RETRY=PASS');
 console.log('NOTIFICATION_022_LOCAL_GENERATIONS_AND_PINK_DOTS_PRESERVED=PASS');
 console.log('NOTIFICATION_022_ERROR_AND_UID_ISOLATION_NO_STORAGE_WRITE=PASS');
}finally{
 if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
 delete globalThis.__notifyAppCheck022;
}
