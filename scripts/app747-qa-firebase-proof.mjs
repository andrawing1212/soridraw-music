// APP747: physically verify two existing synthetic QA Firebase Auth identities
// and a QA Firebase App Check token with the official Firebase Admin SDK.
// Read-only, no account creation, no RTDB/Worker mutation and NO log of tokens
// or UIDs. Run only from the existing soridraw-app QA Cloud Shell.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readQaConfig} from './app740-qa-cloudshell.mjs';

const PROJECT='soridraw-app';
const NUMBER='1083981050742';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const APP_ID=/^1:1083981050742:(?:web|android|ios):[a-zA-Z0-9]+$/;
const guard=(ok,code)=>{if(!ok)throw Error('APP747_QA_HOLD_'+code)};
const jwtForm=s=>typeof s==='string'&&s.length>80&&
 /^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(s);
export async function verifyApp747QaFirebasePrincipals({
 config,actorIdToken,ownerIdToken,appCheckToken,qaAppId,
 verifyAuth,verifyAppCheck,now=Date.now,
}={}){
 const cfg=readQaConfig(config);
 guard(APP_ID.test(String(qaAppId||'')),'QA_APP_ID_NOT_PINNED');
 guard([actorIdToken,ownerIdToken,appCheckToken].every(jwtForm),
   'REAL_FIREBASE_TOKENS_NOT_SUPPLIED');
 guard(actorIdToken!==ownerIdToken,'AUTH_IDENTITIES_COLLAPSED');
 guard([verifyAuth,verifyAppCheck].every(x=>typeof x==='function'),
   'OFFICIAL_SDK_VERIFIERS_MISSING');
 // Production Firebase (soridraw-app-866a5) must never be initialized.
 // Each implementation must be the Firebase Admin verifier initialized with
 // projectId 'soridraw-app' and Auth revocation check enabled.
 const [actor,owner,app]=await Promise.all([
   verifyAuth(actorIdToken,true),verifyAuth(ownerIdToken,true),
   verifyAppCheck(appCheckToken),
 ]);
 const epoch=Math.floor(now()/1000);
 const validAuth=(token,expectedUid)=>token?.uid===expectedUid&&
   UID.test(String(token.uid||''))&&token.sub===expectedUid&&
   token.aud===PROJECT&&
   token.iss==='https://securetoken.google.com/'+PROJECT&&
   Number.isSafeInteger(token.iat)&&token.iat>0&&token.iat<=epoch+30&&
   Number.isSafeInteger(token.auth_time)&&token.auth_time>0&&
   token.auth_time<=epoch+30&&
   Number.isSafeInteger(token.exp)&&token.exp>epoch;
 guard(validAuth(actor,cfg.actorUid),'QA_ACTOR_AUTH_UNVERIFIED');
 guard(validAuth(owner,cfg.ownerUid),'QA_OWNER_AUTH_UNVERIFIED');
 // Firebase Admin AppCheck.verifyToken() returns a wrapper:
 // { appId, token: DecodedAppCheckToken, alreadyConsumed? }.
 // The JWT claims are INSIDE .token, never on the wrapper itself.
 // Verify both the signed token's app identity and exact QA audience.
 const claim=app?.token;
 guard(app?.appId===qaAppId&&claim?.app_id===qaAppId&&
   claim?.sub===qaAppId&&
   claim?.iss==='https://firebaseappcheck.googleapis.com/'+NUMBER&&
   Array.isArray(claim?.aud)&&
   claim.aud.includes('projects/'+NUMBER)&&
   claim.aud.includes('projects/'+PROJECT)&&
   Number.isSafeInteger(claim?.iat)&&claim.iat>0&&claim.iat<=epoch+30&&
   Number.isSafeInteger(claim?.exp)&&claim.exp>epoch,
   'QA_APPCHECK_UNVERIFIED');
 // This verifies actual tokens ONLY. The APP730 QA Worker still accepts the
 // synthetic probe token and does not yet enforce these Firebase tokens.
 return Object.freeze({
   status:'PASS',scope:'QA_ONLY_AUTH_APPCHECK_OFFICIAL_SDK',
   qaProjectId:PROJECT,qaProjectNumber:NUMBER,
   existingSyntheticActorAndOwnerVerified:true,
   appCheckVerified:true,
   noTokensReturned:true,serverMutations:0,
   ownerWorkerRealTokenGateVerified:false,
   functionsRtdbPhysical747:false,forced503Physical747:false,
 });
}

async function main(){
 const project=execFileSync('gcloud',['config','get-value','project'],{
   encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 guard(project===PROJECT,'WRONG_GCLOUD_PROJECT');
 const cfg=JSON.parse(readFileSync(homedir()+
   '/.soridraw-qa-583-worker-config.json','utf8'));
 const id=process.env;
 // Credential material remains only in the local QA Cloud Shell environment,
 // never commit it, print it, or send it through ChatGPT.
 const [{initializeApp,applicationDefault,deleteApp},{getAuth},
   {getAppCheck}]=await Promise.all([
   import('firebase-admin/app'),import('firebase-admin/auth'),
   import('firebase-admin/app-check'),
 ]);
 const app=initializeApp({credential:applicationDefault(),
   projectId:PROJECT},'app747-isolated-qa');
 try{
   const r=await verifyApp747QaFirebasePrincipals({
     config:cfg,actorIdToken:id.QA747_ACTOR_ID_TOKEN,
     ownerIdToken:id.QA747_OWNER_ID_TOKEN,
     appCheckToken:id.QA747_APPCHECK_TOKEN,
     qaAppId:id.QA747_QA_APP_ID,
     verifyAuth:(token,checkRevoked)=>getAuth(app).verifyIdToken(token,checkRevoked),
     verifyAppCheck:(token)=>getAppCheck(app).verifyToken(token),
   });
   console.log('APP747_QA_FIREBASE_AUTH_APPCHECK='+r.status);
   console.log('APP747_QA_WORKER_REAL_AUTH_HANDOFF=NOT_VERIFIED');
   console.log('APP747_QA_FORCED_503_PHYSICAL=NOT_RUN');
 }finally{await deleteApp(app)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(
   String(e?.message||'APP747_QA_HOLD_UNSPECIFIED').replace(
     /[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED]'));
   process.exitCode=2;
 });
}
