// APP783: networkless smoke of the package that would be deployed to
// isolated Firebase QA. Never initialize Admin while source gate is OFF.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const app=require("./index.cjs");
assert.deepEqual(Object.keys(app),["app518QaExactFavoriteSource"]);
assert.equal(typeof app.app518QaExactFavoriteSource,"function");
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
console.log("APP783_QA_FUNCTIONS_ONLY_OFF_NO_REMOTE_FIRESTORE=PASS");
