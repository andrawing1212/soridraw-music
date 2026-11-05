import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Single new account-private child; source/old-live may coexist.
// Never rewrite legacy RTDB signals, user data or Stage416 public roots.
const source=JSON.parse(readFileSync('database.rules.json','utf8'));
const expected=source?.rules?.userSync?.$uid?.studioHeartHandoffs;
assert.ok(expected && expected['.validate']==="newData.hasChild('version')");
assert.ok(expected.slots?.$slot?.['.validate']?.includes('$slot.matches'));
assert.equal(expected.slots?.$slot?.$other?.['.validate'],false);
const sorted = value => Array.isArray(value)?value.map(sorted)
  :value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
const same=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const without=x=>{
 const o=structuredClone(x);
 if(o.rules?.userSync?.$uid)delete o.rules.userSync.$uid.studioHeartHandoffs;
 return o;
};
const classify=live=>{
 assert.ok(live?.rules?.userSync?.$uid,'live UID rules missing');
 const installed=live.rules.userSync.$uid.studioHeartHandoffs;
 if(installed && !same(installed,expected))
   throw Error('STUDIO_HEART_SHARED_RULES_UNEXPECTED_EXISTING_ACL_STOP');
 const candidate=structuredClone(live);
 candidate.rules.userSync.$uid.studioHeartHandoffs=structuredClone(expected);
 assert.ok(same(without(candidate),without(live)),
   'STUDIO_HEART_SHARED_RULES_UNRELATED_ACL_DIFF_STOP');
 return {mode:installed?'ALREADY_EXACT':'ADD_ONLY_STUDIO_HEART_HANDOFF',candidate};
};
if(process.argv.includes('--self-test')){
 const original=without(source);
 const first=classify(original);
 assert.equal(first.mode,'ADD_ONLY_STUDIO_HEART_HANDOFF');
 assert.ok(same(first.candidate,source));
 assert.equal(classify(first.candidate).mode,'ALREADY_EXACT');
 const bad=structuredClone(source);
 bad.rules.userSync.$uid.studioHeartHandoffs.slots.$slot.songJson['.validate']='newData.isString()';
 assert.throws(()=>classify(bad),/UNEXPECTED_EXISTING_ACL/);
 const unauthorized=structuredClone(original);
 unauthorized.rules.userSync.$uid['.read']='auth != null';
 const check=spawnSync(process.execPath,['scripts/verify-418-rtdb-rules-delta.mjs','--self-test'],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr||check.stdout);
 console.log('STUDIO_HEART_SHARED_RTDB_ONE_EXACT_CHILD_NEGATIVE_SELFTEST=PASS');
 console.log('STUDIO_HEART_SHARED_RTDB_LIVE_PUT=NOT_RUN');
}else if(process.argv[2]==='--candidate'){
 const [input,candidatePath,modePath]=process.argv.slice(3);
 assert.ok(input&&candidatePath&&modePath,'LIVE_CANDIDATE_OUTPUTS_REQUIRED');
 const preflight=spawnSync(process.execPath,['scripts/verify-418-rtdb-rules-delta.mjs',input],{encoding:'utf8'});
 assert.equal(preflight.status,0,'STUDIO_HEART_SHARED_RTDB_418_DRIFT_STOP: '+(preflight.stderr||preflight.stdout));
 const live=JSON.parse(readFileSync(input,'utf8'));
 const {mode,candidate}=classify(live);
 writeFileSync(candidatePath,JSON.stringify(candidate),'utf8');
 writeFileSync(modePath,mode,'utf8');
 console.log('STUDIO_HEART_SHARED_RTDB_RULES_CANDIDATE='+mode);
 console.log('STUDIO_HEART_SHARED_RTDB_OTHER_NODE_CHANGES=0');
 console.log('STUDIO_HEART_SHARED_RTDB_LIVE_PUT=NOT_RUN');
}else throw Error('Use --self-test or --candidate LIVE OUTPUT MODE');
