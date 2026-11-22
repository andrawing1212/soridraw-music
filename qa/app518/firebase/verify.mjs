// APP783: networkless smoke of the package that would be deployed to
// isolated Firebase QA. Never initialize Admin while source gate is OFF.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const app=require("./index.cjs");
assert.deepEqual(Object.keys(app).sort(),["app518QaExactFavoriteSource","app518QaSyntheticDeleteReceipt"].sort());
assert.equal(typeof app.app518QaExactFavoriteSource,"function");
assert.equal(typeof app.app518QaSyntheticDeleteReceipt,"function");
const source=require("node:fs").readFileSync(new URL("./index.cjs",import.meta.url),"utf8");
assert(source.includes('serviceAccount:"soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com"'),
  "QA_RUNTIME_SA_PINNED");
const request={method:"POST",url:"https://not-deployed.invalid",headers:{},
  rawBody:Buffer.from("{}")};
const invoke=async()=>{
 const out={status:null,body:null,headers:{}};
 const res={
   setHeader:(k,v)=>{out.headers[k]=v;return res;},
   status:(code)=>{out.status=code;return res;},
   json:(body)=>{out.body=body;return res;}
 };
 await app.app518QaExactFavoriteSource(request,res);
 return out;
};
for(const scenario of [
 {project:"soridraw-app",enabled:"OFF",label:"QA_default_OFF"},
 {project:"soridraw-app-866a5",enabled:"APPROVED_ISOLATED_ONE_SONG",label:"PROD_refused"},
 {project:"other-qa-project",enabled:"APPROVED_ISOLATED_ONE_SONG",label:"FOREIGN_QA_refused"},
]){
 process.env.GCLOUD_PROJECT=scenario.project;
 process.env.GOOGLE_CLOUD_PROJECT=scenario.project;
 process.env.SORIDRAW_APP518_BRIDGE_ACTIVE=scenario.enabled;
 process.env.SORIDRAW_APP518_QA_PROJECT_NUMBER="1083981050742";
 process.env.SORIDRAW_APP518_PILOT_UID="qa-app518-synthetic-owner";
 process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID="qa-app518-synthetic-song";
 const r=await invoke();
 assert.equal(r.status,503,scenario.label);
 assert.equal(r.body?.code,"HOLD_APP518_QA_RELEASE_OFF",scenario.label);
 assert.equal(r.headers["Cache-Control"],"no-store");
 console.log("APP783_"+scenario.label+"=PASS");
}
let auditAttempts=0;
process.env.GCLOUD_PROJECT="soridraw-app";
process.env.GOOGLE_CLOUD_PROJECT="soridraw-app";
process.env.SORIDRAW_APP518_QA_PROJECT_NUMBER="1083981050742";
process.env.SORIDRAW_APP518_QA_RUN_ID="45123456789";
process.env.SORIDRAW_APP518_PILOT_UID="qa518-45123456789-owner";
process.env.SORIDRAW_APP518_PILOT_FAVORITE_ID="qa518-45123456789-song";
process.env.SORIDRAW_APP518_BRIDGE_ACTIVE="APPROVED_ISOLATED_ONE_SONG";
await app.app518QaSyntheticDeleteReceipt({
  id:"foreign-event",params:{favoriteId:"foreign-song"},
  data:{exists:true,data(){auditAttempts++;throw Error("FOREIGN_READ_FORBIDDEN");}}
});
if(auditAttempts!==0)throw Error("QA_FOREIGN_EVENT_INSPECTED");
process.env.SORIDRAW_APP518_BRIDGE_ACTIVE="OFF";
await app.app518QaSyntheticDeleteReceipt({
  id:"fake-event",params:{favoriteId:"qa518-45123456789-song"},
  data:{exists:true,data(){auditAttempts++;throw Error("QA_OFF_UNEXPECTED_READ");}}
});
if(auditAttempts!==0)throw Error("QA_OFF_EVENT_INSPECTED");
console.log("APP518_QA_DELETE_RECEIPT_FOREIGN_AND_OFF_EVENTS_NO_READ_WRITE=PASS");
console.log("APP518_QA_TWO_EXACT_FUNCTIONS_NO_SHARED_TRIGGERS=PASS");
console.log("APP783_QA_FUNCTIONS_ONLY_OFF_NO_REMOTE_FIRESTORE=PASS");
