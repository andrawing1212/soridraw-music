// APP582: isolated QA-only browser bridge. Never import src/firebase.js.
// A caller must supply web-app credentials from the separate QA project;
// no login, subscription or writes happen on module import.
import {assertQaOwnerFollowConfiguration577,QA_OWNER_FOLLOW_FUNCTION_URL_577}
 from '../../cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const QA_ID='soridraw-app';
const QA_NUMBER='1083981050742';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
export const QA_OWNER_FOLLOW_SG_URL_582=DB;
export const QA_OWNER_FOLLOW_API_KEY_PROOF_582='REQUIRES_QA_FIREBASE_WEB_APP_CONSOLE_VERIFICATION';
export function assertQaOwnerClient582(config,ownerUid){
 if(!config||typeof config!=='object'||Array.isArray(config)||
    !UID.test(String(ownerUid||''))||
    typeof config.apiKey!=='string'||!/^AIza[0-9A-Za-z_-]{30,}$/.test(config.apiKey)||
    typeof config.appId!=='string'||!config.appId.startsWith('1:'+QA_NUMBER+':web:')||
    String(config.messagingSenderId)!==QA_NUMBER)
  throw Error('APP582_QA_CLIENT_IDENTITY_HOLD');
 assertQaOwnerFollowConfiguration577({
  projectId:config.projectId,projectNumber:QA_NUMBER,
  authDomain:config.authDomain,databaseURL:config.databaseURL,
  storageBucket:config.storageBucket,
  endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577,
  functionsEntry:'qa/owner-follow-functions/index.js',
 });
 return {...config,databaseURL:DB};
}
const realSdk=async()=>{
 const [app,auth,db]=await Promise.all([
  import('firebase/app'),import('firebase/auth'),import('firebase/database'),
 ]);
 return {...app,...auth,...db};
};
// Explicit opt-in only: no default Firebase App and no main SORIDRAW auth.
// Supplying a mock sdk is solely for offline tests with zero network.
export async function createQaOwnerClient582({config,ownerUid,sdk}={}){
 const validated=assertQaOwnerClient582(config,ownerUid); // before SDK import
 const api=sdk||await realSdk();
 const app=api.initializeApp(validated,'soridraw-isolated-owner-qa582');
 const auth=api.getAuth(app);
 const database=api.getDatabase(app,DB); // never implicit US default
 return {
  async signInOwner(email,password){
   if(email!=='testa@example.com'||typeof password!=='string'||!password)
    throw Error('APP582_ONLY_QA_OWNER_A_EMAIL');
   const result=await api.signInWithEmailAndPassword(auth,email,password);
   if(result?.user?.uid!==ownerUid){
    await api.signOut(auth);
    throw Error('APP582_QA_OWNER_UID_MISMATCH');
   }
   return result.user.uid;
  },
  async subscribeOwner(onUpdate){
   if(typeof onUpdate!=='function')throw Error('APP582_CALLBACK_REQUIRED');
   const principal=auth.currentUser;
   if(!principal||principal.uid!==ownerUid)return ()=>{};
   let claims;
   try{claims=(await api.getIdTokenResult(principal)).claims;}catch{return ()=>{}}
   const epoch=claims?.soridrawFollowEpoch532;
   if(typeof epoch!=='string'||!EPOCH.test(epoch))return ()=>{};
   return api.onValue(api.ref(database,'ownerFollowerSync532/'+ownerUid),
    snapshot=>{
     if(auth.currentUser!==principal)return;
     const marker=snapshot?.val();
     if(!marker||marker.ownerUid!==ownerUid||marker.authEpoch!==epoch||
        !Number.isSafeInteger(marker.version)||marker.version<1)return;
     onUpdate(marker);
    },()=>{});
  },
  async signOut(){await api.signOut(auth);},
 };
}
