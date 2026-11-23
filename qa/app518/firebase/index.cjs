"use strict";
// QA-only independent Firebase entrypoint. NOT imported by production
// functions/src/index.ts or securedIndex. Does not register a Firestore
// trigger, cron, existing production function, or browser-auth route.
const {onRequest} = require("firebase-functions/v2/https");
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


// QA-only native CloudEvent target for *gcloud* deployment. Firebase SDK's
// onDocumentDeleted wrapper must be deployed with Firebase CLI, not gcloud.
// Google Cloud's Eventarc Firestore data is protobuf DocumentEventData.
// Decode exactly the before snapshot; no collection scan or user data writes.
const functionsFramework = require("@google-cloud/functions-framework");
const protobuf = require("protobufjs");
const eventRoot = new protobuf.Root();
protobuf.parse('syntax = "proto3"; package google.protobuf; message Timestamp { int64 seconds = 1; int32 nanos = 2; }',eventRoot);
protobuf.parse('syntax = "proto3"; package google.firestore.v1; message Value { bool boolean_value = 1; string string_value = 17; } message Document { string name = 1; map<string, Value> fields = 2; google.protobuf.Timestamp update_time = 4; }',eventRoot);
protobuf.parse('syntax = "proto3"; package google.events.cloud.firestore.v1; message DocumentEventData { google.firestore.v1.Document old_value = 2; }',eventRoot);
const firestoreDeleteEvent = eventRoot.lookupType("google.events.cloud.firestore.v1.DocumentEventData");
const qaRun = () => {
  const run=process.env.SORIDRAW_APP518_QA_RUN_ID;
  return /^[0-9]{8,20}$/.test(String(run||""))
    &&process.env.SORIDRAW_APP518_PILOT_UID==="qa518-"+run+"-owner"
    &&process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID==="qa518-"+run+"-song";
};
const safeTimestamp = stamp => {
  const sec=Number(stamp?.seconds);
  const nanos=Number(stamp?.nanos||0);
  if(!Number.isSafeInteger(sec)||sec<=0
    ||!Number.isSafeInteger(nanos)||nanos<0||nanos>=1000000000)return null;
  const date=new Date(sec*1000);
  if(!Number.isFinite(date.getTime()))return null;
  return date.toISOString().slice(0,19)+"."+String(nanos).padStart(9,"0")+"Z";
};
const nativeDeleteReceipt = async event => {
  if(!runtimeQa()||!pilotQa()||!qaRun()
    ||process.env.SORIDRAW_APP518_BRIDGE_ACTIVE!=="APPROVED_ISOLATED_ONE_SONG")
    return;
  const id=process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID;
  const run=process.env.SORIDRAW_APP518_QA_RUN_ID;
  if(event?.type!=="google.cloud.firestore.document.v1.deleted"
    ||event?.source!=="//firestore.googleapis.com/projects/soridraw-app/databases/(default)"
    ||event?.subject!=="documents/favorites/"+id)
    return;
  if(typeof event?.id!=="string"||!safeId(event.id,512))
    throw Error("APP518_QA_DELETE_EVENT_ID_INVALID");
  if(!(event.data instanceof Uint8Array))
    throw Error("APP518_QA_DELETE_EVENT_PROTOBUF_REQUIRED");
  const decoded=firestoreDeleteEvent.decode(event.data);
  const before=decoded?.oldValue;
  const exactName="projects/soridraw-app/databases/(default)/documents/favorites/"+id;
  if(before?.name!==exactName)return;
  const fields=before.fields||{};
  if(fields.qaOnly?.booleanValue!==true
    ||fields.qaRunId?.stringValue!==run
    ||fields.uid?.stringValue!==process.env.SORIDRAW_APP518_PILOT_UID)
    throw Error("APP518_QA_DELETE_EVENT_OWNER_OR_RUN_MISMATCH");
  if(fields.qa518CleanupFinal?.booleanValue===true)return;
  const updateTime=safeTimestamp(before.updateTime);
  if(!updateTime)throw Error("APP518_QA_DELETE_BEFORE_VERSION_INVALID");
  if(!admin.apps.length)admin.initializeApp({projectId:QA_PROJECT});
  const result=await recordHardDeleteApp518({
    db:admin.firestore(),
    uid:process.env.SORIDRAW_APP518_PILOT_UID,
    documentId:id,
    deleteEventId:event.id,
    beforeOwnerUid:fields.uid.stringValue,
    beforeUpdateTime:updateTime,
    verifiedServerDeleteEvent:true,
  });
  if(!["VERIFIED_DELETE_RECEIPT","SKIP_NEWER_SAVE_PRESENT"].includes(result.code))
    throw Error("APP518_QA_DELETE_RECEIPT_"+String(result.code).slice(0,60));
  console.log("APP518_QA_NATIVE_FIRESTORE_DELETE_RECEIPT="+result.code);
};
// The target is explicitly registered as CloudEvent for gcloud's Functions
// Framework, not as an HTTP handler or a Firebase SDK trigger.
functionsFramework.cloudEvent("app518QaSyntheticDeleteReceipt",nativeDeleteReceipt);
nativeDeleteReceipt.run=nativeDeleteReceipt; // existing networkless QA guard test
exports.app518QaSyntheticDeleteReceipt=nativeDeleteReceipt;
