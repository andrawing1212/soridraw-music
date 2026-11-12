'use strict';
// APP583: prepare ONE independent Cloudflare QA secret; never print secrets.
// Uses only QA Firebase Auth/Secret Manager and Cloud Shell's gcloud identity.
const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync}=require('node:fs');
const {homedir}=require('node:os');
const {join}=require('node:path');
const {randomBytes}=require('node:crypto');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const QA='soridraw-app',NUMBER='1083981050742';
const secretName='SORIDRAW_QA_OWNER_FOLLOW_HMAC_578';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const FILE=join(homedir(),'.soridraw-qa-583-worker-config.json');
const run=(...args)=>execFileSync('gcloud',args,{
 encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
const hold=s=>{throw Error('APP583_QA_CONFIG_HOLD_'+s)};
(async()=>{
 if(process.argv.slice(2).join(' ')!=='--qa-only')hold('EXPLICIT_OPT_IN');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  hold('CREDENTIAL_OVERRIDE');
 if(run('config','get-value','project').trim()!==QA||
  run('projects','describe',QA,'--format=value(projectNumber)').trim()!==NUMBER)
  hold('PROJECT_IDENTITY');
 const lines=readFileSync(__dirname+'/.env.soridraw-app','utf8').trim().split('\n');
 if(lines.length!==3||lines[0]!=='SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED=1'||
  lines[2]!=='SORIDRAW_QA_RTDB_URL_578='+DB||
  !/^SORIDRAW_QA_OWNER_UID_578=[A-Za-z0-9_-]{1,128}$/.test(lines[1]))
  hold('FUNCTION_CANARY_NOT_ENABLED');
 const uid=lines[1].split('=')[1];
 // The uploaded Firebase secret may contain a trailing newline from openssl.
 // Use exact Secret Manager bytes, never assume trim() on the HMAC key.
 const hmacSecret=run('secrets','versions','access','latest',
  '--secret='+secretName,'--project='+QA);
 const local=readFileSync(join(homedir(),'.soridraw-qa-578-hmac'),'utf8');
 if(hmacSecret.trim()!==local.trim()||
   !/^[0-9a-f]{64}\n?$/.test(hmacSecret))hold('QA_SIGNING_SECRET_MISMATCH');
 const credential={async getAccessToken(){return {
  access_token:run('auth','print-access-token').trim(),expires_in:300}}};
 const app=initializeApp({projectId:QA,databaseURL:DB,credential},
  'soridraw-owner-follow-qa578');
 try{
  const auth=getAuth(app);
  const [a,b]=await Promise.all([
   auth.getUserByEmail('testa@example.com'),
   auth.getUserByEmail('testb@example.com'),
  ]);
  const epoch=a.customClaims?.soridrawFollowEpoch532;
  if(a.uid!==uid||!b.uid||a.uid===b.uid||b.disabled||a.disabled||
     !/^[0-9a-f]{32}$/.test(String(epoch||''))||
     Object.hasOwn(b.customClaims||{},'soridrawFollowEpoch532'))
   hold('SYNTHETIC_IDENTITIES');
  const config={actorUid:b.uid,authEpoch:epoch,hmacSecret,ownerUid:a.uid,
   probeToken:randomBytes(32).toString('hex'),projectId:QA,projectNumber:NUMBER};
  writeFileSync(FILE,JSON.stringify(config),{mode:0o600,flag:'wx'});
  console.log('APP583_QA_SECRET_PREPARED');
  console.log('LOCAL_SECRET_FILE='+FILE);
  console.log('SET_CLOUDFLARE_SECRET_NAME=OWNER583_QA_CONFIG');
  console.log('NEVER_PASTE_SECRET_VALUE_IN_CHAT');
 }finally{await deleteApp(app)}
})().catch(e=>{console.error(String(e?.message||e));process.exitCode=1});
