import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {stageQaFirebase518,QA518_FUNCTION_NAMES,QA518_CODEBASE} from './stage-qa-firebase518.mjs';
const source=process.env.APP518_PINNED_CANDIDATE_DIR;
assert.ok(source?.includes('app518-pinned-candidate'));
const home=mkdtempSync(join(tmpdir(),'app518-qa-firebase-stage-parent-'));
const where=join(home,'app518-qa-firebase-stage-45123456789');
try{
 const staged=stageQaFirebase518({
  candidateDir:source,stageRoot:where,runId:'45123456789',
 });
 assert.equal(staged.code,'APP518_QA_EXACT_FIREBASE_CODEBASE_STAGED');
 assert.equal(staged.bridgeActive,false);
 assert.equal(staged.uid,'qa518-45123456789-owner');
 assert.equal(staged.documentId,'qa518-45123456789-song');
 assert.deepEqual([...staged.functionNames],QA518_FUNCTION_NAMES);
 const config=JSON.parse(readFileSync(join(where,'firebase.json'),'utf8'));
 assert.deepEqual(config,{functions:{source:'functions',codebase:QA518_CODEBASE}});
 const env=readFileSync(join(where,'functions/.env.soridraw-app'),'utf8');
 assert.ok(env.includes('SORIDRAW_APP518_BRIDGE_ACTIVE=OFF\n'));
 assert.ok(env.includes('SORIDRAW_APP518_PILOT_FAVORITE_ID=qa518-45123456789-song\n'));
 assert.ok(!env.includes('PASSWORD')&&!env.includes('TOKEN')&&!env.includes('HMAC'));
 assert.deepEqual(readdirSync(join(where,'functions/lib')).sort(),[
  'app518CanonicalSourceProvider.js','app518EventSafetyFence.js',
  'app518ServerTransport.js'].sort());
 assert.throws(()=>stageQaFirebase518({
  candidateDir:source,stageRoot:where,runId:'45123456789',
 }),/HOLD_QA518_FIREBASE_STAGE_REUSE/);
 assert.throws(()=>stageQaFirebase518({
  candidateDir:source,stageRoot:join(home,'app518-qa-firebase-stage-bad'),
  runId:'real-uid',
 }),/HOLD_QA518_FIREBASE_STAGE_SCOPE/);
 console.log('APP518_QA_FIREBASE_CODEBASE_ISOLATION=PASS');
 console.log('APP518_QA_2_EXACT_EXPORTS_AND_SOURCE_MODULES=PASS');
 console.log('APP518_QA_PILOT_SCOPED_DEFAULT_OFF=PASS');
 console.log('APP518_QA_FIREBASE_STAGE_SOURCE_ONLY_NO_DEPLOY=PASS');
}finally{rmSync(home,{recursive:true,force:true});}
