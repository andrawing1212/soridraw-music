// APP577 — independent QA-only route fence, source-only.
// NEVER import the live SORIDRAW src/firebase.js or functions/src/index.ts
// into an isolated QA deployment: they have shared PRODUCTION Firebase URLs.
export const QA_FIREBASE_PROJECT_ID_577='soridraw-app';
export const QA_FIREBASE_PROJECT_NUMBER_577='1083981050742';
export const QA_OWNER_FOLLOW_FUNCTION_URL_577=
 'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542';
const QA_DB_HOST_577=/^soridraw-app-default-rtdb(?:\.[a-z0-9-]+)?\.(?:firebaseio\.com|firebasedatabase\.app)$/;
const QA_FUNCTION_ENTRY_577='qa/owner-follow-functions/index.js';

// An explicit QA-only Firebase SDK initializer/harness MUST pass this guard.
// A Firebase key is not proof of project isolation; project number/IAM and
// service-account credentials must be checked independently in the console.
export function assertQaOwnerFollowConfiguration577({
 projectId,authDomain,databaseURL,storageBucket,
 endpoint,functionsEntry,projectNumber,
}={}){
 if(projectId!==QA_FIREBASE_PROJECT_ID_577||
   String(projectNumber||'')!==QA_FIREBASE_PROJECT_NUMBER_577||
   authDomain!=='soridraw-app.firebaseapp.com'||
   endpoint!==QA_OWNER_FOLLOW_FUNCTION_URL_577||
   functionsEntry!==QA_FUNCTION_ENTRY_577)
  throw Error('APP577_QA_PROJECT_OR_ENTRY_MISMATCH_HOLD');
 let db;
 try{db=new URL(String(databaseURL||''))}catch{
  throw Error('APP577_QA_DATABASE_URL_MISMATCH_HOLD');
 }
 if(db.protocol!=='https:'||db.username||db.password||
   db.port||db.pathname!=='/'||db.search||db.hash||
   !QA_DB_HOST_577.test(db.hostname))
  throw Error('APP577_QA_DATABASE_URL_MISMATCH_HOLD');
 if(storageBucket!==undefined &&
   storageBucket!=='soridraw-app.firebasestorage.app' &&
   storageBucket!=='soridraw-app.appspot.com')
  throw Error('APP577_QA_STORAGE_BUCKET_MISMATCH_HOLD');
 return {projectId:QA_FIREBASE_PROJECT_ID_577,endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577};
}
