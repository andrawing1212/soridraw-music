"use strict";
// QA-only independent Firebase entrypoint. NOT imported by production
// functions/src/index.ts or securedIndex. Does not register a Firestore
// trigger, cron, existing production function, or browser-auth route.
const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {recordHardDeleteApp518} = require("./lib/app518CanonicalSourceProvider");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const {handleVerifiedApp518ExactSource} = require("./lib/app518ServerTransport");

const QA_PROJECT = "soridraw-app";
const QA_NUMBER = "1083981050742";
const secret = defineSecret("SORIDRAW_CATALOG_SERVER_HMAC_518");
const safeId = (s,max) => typeof s === "string" &&
  s.length>0 && s.length<=max && !/[\\/]/.test(s) && s!=="." && s!=="..";
const runtimeQa = () => {
  const projectIds = [process.env.GCLOUD_PROJECT, process.env.GCP_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  const config = process.env.FIREBASE_CONFIG;
  let configProject = null;
  if(config){try{configProject=JSON.parse(config).projectId;}catch{return false;}}
  // Direct QA gen2 gcloud deployments need not provide Firebase CLI's
  // GCLOUD_PROJECT or FIREBASE_CONFIG. The QA-only deployment controller
  // pins this explicit project ID together with the project number.
  return process.env.SORIDRAW_APP518_QA_PROJECT_ID===QA_PROJECT
    && projectIds.every(x=>x===QA_PROJECT)
    && (!configProject || configProject===QA_PROJECT);
};
const pilotQa = () => safeId(process.env.SORIDRAW_APP518_PILOT_UID,128)
  && safeId(process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID,240)
  && process.env.SORIDRAW_APP518_QA_PROJECT_NUMBER===QA_NUMBER;

const deny = (res,code,status=503) => {
  res.status(status).json({code});
};

exports.app518QaExactFavoriteSource = onRequest({
  region:"asia-northeast3",
  memory:"256MiB",
  timeoutSeconds:30,
  serviceAccount:"soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com",
  minInstances:0,
  maxInstances:1,
  secrets:[secret],
},async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(!runtimeQa() || !pilotQa() ||
    process.env.SORIDRAW_APP518_BRIDGE_ACTIVE!=="APPROVED_ISOLATED_ONE_SONG"){
    deny(res,"HOLD_APP518_QA_RELEASE_OFF");
    return;
  }
  if(req.method!=="POST"){
    deny(res,"DENY_METHOD",405);return;
  }
  try{
    const signing=secret.value();
    if(typeof signing!=="string"||Buffer.byteLength(signing)<32){
      deny(res,"HOLD_QA_SERVER_SECRET_NOT_READY");return;
    }
    if(!admin.apps.length) admin.initializeApp({projectId:QA_PROJECT});
    const outcome=await handleVerifiedApp518ExactSource({
      request:{method:req.method,headers:req.headers,rawBody:req.rawBody},
      db:admin.firestore(),secret:signing,nowMs:Date.now(),
      pilotUid:process.env.SORIDRAW_APP518_PILOT_UID,
      pilotDocumentId:process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID,
    });
    res.status(outcome.status).json(outcome);
  }catch{
    deny(res,"HOLD_APP518_QA_SOURCE_UNAVAILABLE");
  }
});


// Independent QA ONLY, exact one synthetic ID. No user-data listeners in
// shared/preview/test/production Functions. The Firestore event itself
// supplies the verified BEFORE snapshot and event id; never a client field.
const qaRun = () => {
  const run = process.env.SORIDRAW_APP518_QA_RUN_ID;
  return /^[0-9]{8,20}$/.test(String(run||""))
    && process.env.SORIDRAW_APP518_PILOT_UID === "qa518-"+run+"-owner"
    && process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID === "qa518-"+run+"-song";
};
const beforeUpdateTime = (snapshot) => {
  const stamp = snapshot?.updateTime;
  if(!Number.isSafeInteger(stamp?.seconds)
    ||!Number.isSafeInteger(stamp?.nanoseconds)
    ||stamp.nanoseconds<0||stamp.nanoseconds>=1_000_000_000)return null;
  const date=new Date(stamp.seconds*1000);
  if(!Number.isFinite(date.getTime()))return null;
  return date.toISOString().slice(0,19)+"."+
    String(stamp.nanoseconds).padStart(9,"0")+"Z";
};
exports.app518QaSyntheticDeleteReceipt = onDocumentDeleted({
  document:"favorites/{favoriteId}",
  region:"asia-northeast3",
  memory:"256MiB",
  timeoutSeconds:30,
  minInstances:0,
  maxInstances:1,
  retry:false,
  serviceAccount:"soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com",
},async(event)=>{
  // The trigger can receive other QA favorite events, but never reads/writes
  // any such data. It is registered in the QA project only, never shared.
  if(!runtimeQa()||!pilotQa()||!qaRun()
    ||process.env.SORIDRAW_APP518_BRIDGE_ACTIVE!=="APPROVED_ISOLATED_ONE_SONG"
    ||event?.params?.favoriteId!==process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID)
    return;
  const before=event.data;
  const item=before?.data();
  const run=process.env.SORIDRAW_APP518_QA_RUN_ID;
  if(!before?.exists||item?.qaOnly!==true||item?.qaRunId!==run
    ||item?.uid!==process.env.SORIDRAW_APP518_PILOT_UID
    ||typeof event.id!=="string"||!safeId(event.id,512))
    throw new Error("APP518_QA_HOLD_UNVERIFIED_DELETE_EVENT");
  // The final QA cleanup marks its own synthetic document before deletion.
  // Only this exact run-owned marker may suppress the second receipt.
  if(item.qa518CleanupFinal===true)return;
  const updateTime=beforeUpdateTime(before);
  if(!updateTime)throw new Error("APP518_QA_HOLD_MISSING_BEFORE_VERSION");
  if(!admin.apps.length)admin.initializeApp({projectId:QA_PROJECT});
  const result=await recordHardDeleteApp518({
    db:admin.firestore(),
    uid:process.env.SORIDRAW_APP518_PILOT_UID,
    documentId:process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID,
    deleteEventId:event.id,
    beforeOwnerUid:item.uid,
    beforeUpdateTime:updateTime,
    verifiedServerDeleteEvent:true,
  });
  if(!["VERIFIED_DELETE_RECEIPT","SKIP_NEWER_SAVE_PRESENT"].includes(result.code))
    throw new Error("APP518_QA_HOLD_DELETE_RECEIPT_NOT_CONFIRMED");
});
