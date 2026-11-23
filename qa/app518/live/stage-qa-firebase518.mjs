// APP518 QA-only Firebase codebase package stage. No cloud calls or deployment.
// Separate codebase prevents Firebase CLI from treating an existing QA follow
// function as missing. Only the two exact APP518 exports are included.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const SHA='864f796da24413309567198c9de502b13cdedd50';
export const QA518_FUNCTION_NAMES=Object.freeze([
 'app518QaExactFavoriteSource','app518QaSyntheticDeleteReceipt',
]);
export const QA518_CODEBASE='app518qa';
const libs=Object.freeze([
 'app518CanonicalSourceProvider.js',
 'app518EventSafetyFence.js',
 'app518ServerTransport.js',
]);
const fail=code=>{throw Error(code);};
export function stageQaFirebase518({
 candidateDir,stageRoot,runId,repoDir=process.cwd(),
 bridgeActive=false,
}={}){
 if(typeof candidateDir!=='string'||!candidateDir.includes('app518-pinned-candidate')
  ||typeof stageRoot!=='string'||!stageRoot.includes('app518-qa-firebase-stage')
  ||!/^[0-9]{8,20}$/.test(String(runId||'')))
  fail('HOLD_QA518_FIREBASE_STAGE_SCOPE');
 const checkout=resolve(candidateDir),target=resolve(stageRoot);
 const actual=execFileSync('git',['rev-parse','HEAD'],{
  cwd:checkout,encoding:'utf8',timeout:12000,
 }).trim();
 if(actual!==SHA)fail('HOLD_QA518_FIREBASE_CANDIDATE_DRIFT');
 if(existsSync(target))fail('HOLD_QA518_FIREBASE_STAGE_REUSE');
 const source=join(resolve(repoDir),'qa/app518/firebase');
 const entry=readFileSync(join(source,'index.cjs'),'utf8');
 const pkg=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));
 if(pkg.main!=='index.cjs'||pkg.engines?.node!=='22'
  ||Object.keys(pkg.dependencies||{}).sort().join(',')!=='firebase-admin,firebase-functions'
  ||!entry.includes('const QA_PROJECT = "soridraw-app";')
  ||!entry.includes('exports.app518QaExactFavoriteSource = onRequest(')
  ||!entry.includes('exports.app518QaSyntheticDeleteReceipt = onDocumentDeleted(')
  ||entry.includes('soridraw-app-866a5')
  ||entry.includes('exports.publishExploreOwnerFollower542')
  ||entry.includes('onDocumentWritten(')||entry.includes('onWrite('))
  fail('HOLD_QA518_FIREBASE_UNSAFE_SOURCE');
 mkdirSync(join(target,'functions/lib'),{recursive:true,mode:0o700});
 copyFileSync(join(source,'index.cjs'),join(target,'functions/index.cjs'));
 copyFileSync(join(source,'package.json'),join(target,'functions/package.json'));
 copyFileSync(join(source,'verify.mjs'),join(target,'functions/verify.mjs'));
 for(const file of libs){
  const from=join(checkout,'functions/lib',file);
  if(!existsSync(from))fail('HOLD_QA518_PINNED_LIB_NOT_COMPILED');
  const body=readFileSync(from,'utf8');
  if(body.length<120||body.length>180000||(!body.includes('app518')&&!body.includes('App518')))
   fail('HOLD_QA518_PINNED_LIB_INVALID');
  copyFileSync(from,join(target,'functions/lib',file));
 }
 const uid='qa518-'+runId+'-owner';
 const id='qa518-'+runId+'-song';
 const vars={
  SORIDRAW_APP518_QA_PROJECT_ID:'soridraw-app',
  SORIDRAW_APP518_QA_PROJECT_NUMBER:'1083981050742',
  SORIDRAW_APP518_QA_RUN_ID:String(runId),
  SORIDRAW_APP518_PILOT_UID:uid,
  SORIDRAW_APP518_PILOT_FAVORITE_ID:id,
  SORIDRAW_APP518_BRIDGE_ACTIVE:
   bridgeActive===true?'APPROVED_ISOLATED_ONE_SONG':'OFF',
 };
 if(readdirSync(join(target,'functions')).some(x=>x.startsWith('.env')))
  fail('HOLD_QA518_STAGE_ENV_COLLISION');
 const env=Object.entries(vars).map(([k,v])=>k+'='+v).join('\n')+'\n';
 writeFileSync(join(target,'functions/.env.soridraw-app'),env,{mode:0o600,flag:'wx'});
 const config={functions:{source:'functions',codebase:QA518_CODEBASE}};
 writeFileSync(join(target,'firebase.json'),JSON.stringify(config,null,2)+'\n',
  {mode:0o600,flag:'wx'});
 const files=readdirSync(join(target,'functions')).sort();
 if(files.some(x=>x==='securedIndex.js'||x==='index.js'||x==='firebase.json')
  ||!files.includes('index.cjs')||!files.includes('package.json'))
  fail('HOLD_QA518_UNEXPECTED_FUNCTION_ENTRYPOINT');
 return Object.freeze({code:'APP518_QA_EXACT_FIREBASE_CODEBASE_STAGED',
  root:target,codebase:QA518_CODEBASE,functionNames:QA518_FUNCTION_NAMES,
  runId:String(runId),uid,documentId:id,
  bridgeActive:bridgeActive===true,cloudMutations:0});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 if(process.argv[2]!=='--stage-only')fail('HOLD_QA518_FIREBASE_STAGE_NO_DEPLOY_MODE');
 const result=stageQaFirebase518({
  candidateDir:process.env.APP518_PINNED_CANDIDATE_DIR,
  stageRoot:process.env.APP518_QA_FUNCTION_STAGE,
  runId:process.env.GITHUB_RUN_ID,
 });
 assert.equal(result.bridgeActive,false);
 console.log('APP518_QA_FIREBASE_TWO_FUNCTIONS_SEPARATE_CODEBASE=PASS');
 console.log('APP518_QA_FIREBASE_STAGE_ONLY=PASS; DEPLOY=0');
}
