// APP783: stage only compiled APP518 exact-source dependencies from an
// exact pinned PR #528 source tree. Never deploy or access cloud resources.
// Usage: node qa/app518/firebase/stage.mjs PATH_TO_COMPILED_FUNCTIONS_LIB
import assert from "node:assert/strict";
import {copyFileSync,existsSync,mkdirSync,readFileSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||"");
assert(process.argv.length===3,"APP783_DENY_MISSING_EXACT_CANDIDATE_LIB");
assert(root.includes("/functions/lib"),"APP783_DENY_NON_FUNCTIONS_LIB");
const files=[
  "app518CanonicalSourceProvider.js",
  "app518EventSafetyFence.js",
  "app518ServerTransport.js",
];
const dest=join(here,"lib");
mkdirSync(dest,{recursive:true});
for(const file of files){
  const path=join(root,file);
  assert(existsSync(path),"APP783_MISSING_CANDIDATE_MODULE_"+file);
  const content=readFileSync(path,"utf8");
  assert(content.includes("app518")||content.includes("App518"),
    "APP783_UNEXPECTED_MODULE_SOURCE_"+file);
  copyFileSync(path,join(dest,file));
}
const entry=readFileSync(join(here,"index.cjs"),"utf8");
const pkg=JSON.parse(readFileSync(join(here,"package.json"),"utf8"));
assert.equal(pkg.main,"index.cjs");
assert.equal(pkg.engines.node,"22");
assert(entry.includes('exports.app518QaExactFavoriteSource = onRequest('));
assert(!entry.includes("onWrite(")&&!entry.includes("onDocumentWritten("));
assert(!entry.includes("soridraw-app-866a5"));
assert(entry.includes('const QA_PROJECT = "soridraw-app";'));
assert(entry.includes('secrets:[secret]'));
console.log("APP783_QA_EXACT_SOURCE_COMPILED_DEPENDENCIES_STAGED=PASS");
console.log("APP783_QA_FIREBASE_ONLY_ONE_FUNCTION_NO_TRIGGER=PASS");
console.log("APP783_QA_DEPLOY=0; GOOGLE_CLOUD_MUTATIONS=0");
