"use strict";
// QA-only independent Firebase entrypoint. NOT imported by production
// functions/src/index.ts or securedIndex. Does not register a Firestore
// trigger, cron, existing production function, or browser-auth route.
const {onRequest} = require("firebase-functions/v2/https");
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
  return projectIds.length>0 && projectIds.every(x=>x===QA_PROJECT)
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
