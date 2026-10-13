import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/services/exploreLikeService.ts', 'utf8');
assert.match(source,/EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000/);
assert.match(source,/path === '\/v1\/me\/likes\/batch' \? \{ keepalive: true \}/);
assert.match(source,/persistLikeOutbox\(uid, outbox\);\s*installExitFlush413\(\)/);
assert.match(source,/exitFlushArmed413\.add\(current\.uid\)/);
assert.match(source,/exitFlushArmed413\.has\(uid\)\s*\? 0 : Math\.min\(8, current\.retryCount \+ 1\)/);
assert.match(source,/exitFlushArmed413\.delete\(uid\)/);
assert.match(source,/Object.values\(outbox\)[\s\S]*?installExitFlush413\(\);\s*schedulePendingFlush\(user\)/);

const a=source.indexOf('let exitFlushInstalled413 = false;');
const b=source.indexOf('// App 120 deliberately ignores',a);
assert.ok(a>=0&&b>a,'exact runtime exit handler not found');
const snippet=source.slice(a,b);
const callbackFactory=new Function('auth','readLikeOutbox','clearFlushTimer','flushPendingLikes','window','document','console','exitFlushArmed413','eligibleGuardedMutation420','STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE','STAGE416_SHARED_RTDB_BATCH_ACTIVE',snippet+'\nreturn installExitFlush413;');
const handlers={};const calls=[];let pending=false;
const user={uid:'tester'};
const auth={currentUser:user};
const w={addEventListener:(name,fn)=>{handlers[name]=fn;}};
const d={visibilityState:'visible',addEventListener:(name,fn)=>{handlers[name]=fn;}};
const armed=new Set();
let guardedEligible=true;let explicitReplay=true;
const install=callbackFactory(auth,()=>pending?{song:{retryCount:0,...(explicitReplay?{explicitReplayEligible412:true}:{})}}:{},uid=>calls.push('timer:'+uid),u=>{calls.push('send:'+u.uid);return Promise.resolve()},w,d,{warn:()=>{}},armed,()=>guardedEligible,false,false);
install();install();
assert.equal(Object.keys(handlers).length,2,'only one pair of listeners');
d.visibilityState='hidden';handlers.visibilitychange();
assert.equal(calls.length,0,'no mutation => no server send');
pending=true;d.visibilityState='visible';handlers.visibilitychange();
assert.equal(calls.length,0,'foreground => no server send');
d.visibilityState='hidden';explicitReplay=false;handlers.visibilitychange();
assert.equal(calls.length,0,'historical unmarked outbox must stay local-only on exit');
explicitReplay=true;guardedEligible=false;handlers.visibilitychange();
assert.equal(calls.length,0,'Stage420 unapproved outbox must never flush on exit');
guardedEligible=true;handlers.visibilitychange();
assert.deepEqual(calls,['timer:tester','send:tester'],'background approved or legacy pending like sends now');
assert.equal(armed.has('tester'),true,'exit-marked ambiguous send retains resumable outbox');
pending=false;handlers.pagehide();
assert.equal(calls.length,2,'no pending => close does not write');

const start=source.indexOf('const schedulePendingFlush = (user: User) => {');
const end=source.indexOf('// app412:',start);
assert.ok(start>0&&end>start,'exact schedulePendingFlush block not found');
const compiled=(await transform(source.slice(start,end),{loader:'ts',target:'es2022',format:'cjs'})).code;
const delays=[];const fakeWindow={setTimeout:(fn,delay)=>{delays.push(delay);return 1;},clearTimeout:()=>{}};
const schedule=new Function('readLikeOutbox','clearFlushTimer','flushTimerByUid','window','Date','EXPLORE_LIKE_IDLE_FLUSH_MS_120','flushPendingLikes','eligibleGuardedMutation420','STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE','STAGE416_SHARED_RTDB_BATCH_ACTIVE','privateBatchDeadline416','readPrivateBatchWindow416',
 compiled+'\nreturn schedulePendingFlush;')(
 ()=>({song:{retryCount:0,updatedAt:1000,explicitReplayEligible412:true}}),()=>{},new Map(),fakeWindow,{now:()=>3000},5000,()=>Promise.resolve(),()=>guardedEligible,false,false,()=>0,()=>null
);
schedule(user);
assert.deepEqual(delays,[3000],'5-second trailing window from last click');
guardedEligible=false;
schedule(user);
assert.deepEqual(delays,[3000],'unapproved Stage420 outbox must not schedule a canonical flush');

// app412 recovery is a separate Auth-ready bridge. Test it independently so
// the schedulePendingFlush harness never accidentally swallows later module code.
const recoveryStart=source.indexOf('// app412:',end);
const recoveryEnd=source.indexOf('// An earlier batch may be in flight',recoveryStart);
assert.ok(recoveryStart>0&&recoveryEnd>recoveryStart,'app409 startup recovery block not found');
const recoveryCompiled=(await transform(source.slice(recoveryStart,recoveryEnd),{
  loader:'ts',target:'es2022',format:'cjs'
})).code;
let authReadyHandler=null;let startupSchedules=0;let startupPending=false;let startupExplicit=false;
new Function('onAuthStateChanged','auth','readLikeOutbox','eligibleGuardedMutation420',
  'schedulePendingFlush','window','STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE',
  'EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE',
  recoveryCompiled)(
    (_auth,handler)=>{authReadyHandler=handler;},
    auth,
    ()=>startupPending?{song:{retryCount:0,...(startupExplicit?{explicitReplayEligible412:true}:{})}}:{},
    ()=>true,
    ()=>{startupSchedules++;},
    {},
    false,
    false,
  );
assert.equal(typeof authReadyHandler,'function','app409 must subscribe to Auth readiness');
authReadyHandler(user);
assert.equal(startupSchedules,0,'empty startup outbox must do zero canonical work');
startupPending=true;
authReadyHandler(user);
assert.equal(startupSchedules,0,'historical unmarked outbox must not auto-replay once Auth is ready');
startupExplicit=true;
authReadyHandler(user);
assert.equal(startupSchedules,1,'new explicit durable mutation schedules canonical recovery once Auth is ready');
startupPending=false;
authReadyHandler(null);
assert.equal(startupSchedules,1,'signed-out state cannot schedule a mutation');
console.log('413_STAGE420_UNAPPROVED_EXIT_AND_IDLE_FLUSH_DENIED=PASS');
console.log('413_REAL_CLIENT_BACKGROUND_SEND=PASS');
console.log('413_FIVE_SECOND_TRAILING_TIMER=PASS');
console.log('APP412_AUTH_READY_EXPLICIT_PENDING_ONLY=PASS');
console.log('413_KEEPALIVE_PENDING_ONLY_NO_NAVIGATION_WRITE=PASS');
console.log('413_FORCE_KILL_RELIABILITY=UNVERIFIED (must test mobile)');
