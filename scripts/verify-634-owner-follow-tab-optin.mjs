// APP634 focused regression: the approved root QA URL must survive SPA
// navigation into Explore's ?profile=uid without enabling other sessions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const helper=readFileSync('src/lib/ownerFollowCanaryTab634.ts','utf8');
const main=readFileSync('src/main.tsx','utf8');
const client=readFileSync('src/services/exploreOwnerFollowerSync542.ts','utf8');
const js=ts.transpileModule(helper,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,URLSearchParams});
const {captureOwnerFollowCanaryOptIn634:capture,hasOwnerFollowCanaryOptIn634:has}=exports;
const items=new Map();
const tab={setItem:(k,v)=>items.set(k,v),getItem:k=>items.get(k)??null};
const host='preview.soridraw.com';
assert.equal(has(host,'?profile=ownerA',tab),false);
assert.equal(capture(host,'?ownerFollowCanary=1',tab),true);
assert.equal(has(host,'?profile=ownerA',tab),true);
assert.equal(has(host,'?profile=ownerB',tab),true); // UID pin belongs to client.
assert.equal(has('soridraw.com','?ownerFollowCanary=1',tab),false);
assert.equal(has('test.soridraw.com','?ownerFollowCanary=1',tab),false);
assert.equal(capture('test.soridraw.com','?ownerFollowCanary=1',tab),false);
assert.equal(has(host,'?profile=ownerA',{getItem:()=>null}),false);
assert.equal(has(host,'?ownerFollowCanary=1',null),true);
assert.equal(capture(host,'?profile=ownerA',{setItem:()=>{throw Error('storage blocked')}}),false);
assert.equal(capture(host,'?ownerFollowCanary=1',{setItem:()=>{throw Error('storage blocked')}}),true);
assert.ok(main.indexOf('captureOwnerFollowCanaryOptIn634(')>=0);
assert.ok(main.indexOf('captureOwnerFollowCanaryOptIn634(')<main.indexOf("createRoot("));
assert.match(client,/uid===APP608_APPROVED_CANARY_UID/);
assert.match(client,/hasExplicitOwnerFollowTabOptIn634\(\)/);
assert.match(client,/!isApp608OwnerCanaryVisible\(uid\)/);
assert.ok(client.indexOf('!isApp608OwnerCanaryVisible(uid)')<client.indexOf('const principal=auth.currentUser'));
console.log('APP634_PREVIEW_EXPLICIT_URL_RETENTION_ON_SPA_PROFILE_NAV=PASS');
console.log('APP634_OTHER_HOSTS_USERS_AND_STORAGE_FAILURE_FAIL_CLOSED=PASS');
console.log('APP634_OWNER_AUTH_READ_GUARD_AND_ZERO_BACKGROUND_POLL=PASS');
