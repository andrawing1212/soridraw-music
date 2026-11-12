// APP582: one QA-only owner Auth-claim provisioner. No CLI/automatic run.
// Must be invoked explicitly with the QA project's Auth Admin instance.
// Never run against normal SORIDRAW Auth, users or shared Firebase.
import {randomBytes} from 'node:crypto';
const QA='soridraw-app',DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/;
export async function enrollQaOwnerClaim582({
 projectId,databaseURL,ownerUid,qaAdminAuth,authorized=false,
 makeEpoch=()=>randomBytes(16).toString('hex'),
}={}){
 // This source function is inert until an explicit, separate QA-only caller
 // provides *both* the exact QA target and an authorized one-owner request.
 if(!authorized||projectId!==QA||databaseURL!==DB||!UID.test(String(ownerUid||''))||
    !qaAdminAuth||typeof qaAdminAuth.getUser!=='function'||
    typeof qaAdminAuth.setCustomUserClaims!=='function')
  throw Error('APP582_QA_OWNER_ENROLLMENT_HOLD');
 const user=await qaAdminAuth.getUser(ownerUid);
 if(user.uid!==ownerUid||user.email!=='testa@example.com')
  throw Error('APP582_OWNER_A_MISMATCH');
 const created=Date.parse(String(user.metadata?.creationTime||''));
 if(!Number.isSafeInteger(created)||created<=0)
  throw Error('APP582_QA_AUTH_BIRTH_INVALID');
 const previous=user.customClaims||{};
 if(Object.hasOwn(previous,'soridrawFollowEpoch532')){
  if(typeof previous.soridrawFollowEpoch532!=='string'||
     !EPOCH.test(previous.soridrawFollowEpoch532))
   throw Error('APP582_INVALID_EXISTING_EPOCH_HOLD');
  return {ownerUid,epoch:previous.soridrawFollowEpoch532,reused:true};
 }
 const epoch=makeEpoch();
 if(typeof epoch!=='string'||!EPOCH.test(epoch))
  throw Error('APP582_EPOCH_GENERATION_INVALID');
 // Firebase Admin replaces all claims, so never drop other user claims.
 await qaAdminAuth.setCustomUserClaims(ownerUid,
  {...previous,soridrawFollowEpoch532:epoch});
 const verified=await qaAdminAuth.getUser(ownerUid);
 if(verified.uid!==ownerUid||verified.email!=='testa@example.com'||
    Date.parse(String(verified.metadata?.creationTime||''))!==created||
    verified.customClaims?.soridrawFollowEpoch532!==epoch)
  throw Error('APP582_QA_ENROLLMENT_VERIFY_FAILED');
 return {ownerUid,epoch,reused:false};
}
