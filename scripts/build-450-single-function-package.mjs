import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const target = 'masterSetSplitFrameMode';
const compiled = 'functions/lib/masterSplitFrameMode450.js';
assert.ok(existsSync(compiled),'450_ISOLATED_COMPILED_MODULE_MISSING');
const code = readFileSync(compiled,'utf8');
assert.match(code,/exports\.masterSetSplitFrameMode\s*=/);
assert.doesNotMatch(code,/require\(["']\.\.?\//,
  '450_ISOLATED_ENTRY_MUST_NOT_IMPORT_ANY_UNRELATED_PROJECT_MODULE');
assert.doesNotMatch(code,/Stage416|Stage420|exploreLike|publicationRelease/,
  '450_ISOLATED_FUNCTION_MUST_NOT_SCAN_OTHER_SERVICES');

const mod = require(join(process.cwd(),compiled));
assert.deepEqual(Object.keys(mod).filter(k=>!k.startsWith('__')), [target],
  '450_ISOLATED_MODULE_EXPORT_SCOPE_NOT_EXACT');
assert.equal(typeof mod[target],'function');

const lock = JSON.parse(readFileSync('functions/package-lock.json','utf8'));
const version = (name) => {
  const value=lock?.packages?.['node_modules/'+name]?.version;
  assert.match(String(value||''),/^\d+\.\d+\.\d+$/,'450_DEPENDENCY_LOCK_MISSING '+name);
  return value;
};
const dir='.app450-only-functions';
mkdirSync(join(dir,'lib'),{recursive:true});
copyFileSync(compiled,join(dir,'lib','masterSplitFrameMode450.js'));
writeFileSync(join(dir,'lib','index.js'),`
'use strict';
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({
  databaseURL: 'https://soridraw-app-866a5-default-rtdb.firebaseio.com',
});
const handler = require('./masterSplitFrameMode450');
exports.masterSetSplitFrameMode = handler.masterSetSplitFrameMode;
if(Object.keys(exports).join(',') !== 'masterSetSplitFrameMode' ||
   typeof exports.masterSetSplitFrameMode !== 'function') {
  throw Error('450_ONE_FUNCTION_EXPORT_MISMATCH');
}
`);
writeFileSync(join(dir,'package.json'),JSON.stringify({
  name:'soridraw-app450-single-function',private:true,
  main:'lib/index.js', engines:{node:'22'},
  dependencies:{'firebase-admin':version('firebase-admin'),
                'firebase-functions':version('firebase-functions')},
},null,2)+'\n');
writeFileSync('preview.app450.single-function.firebase.json',
  JSON.stringify({functions:{source:dir}},null,2)+'\n');
const files=['masterSplitFrameMode450.js','index.js'];
for(const file of files){
  assert.ok(existsSync(join(dir,'lib',file)),'450_STAGING_MISSING '+file);
}
const expectedIndex=readFileSync(join(dir,'lib','index.js'),'utf8');
assert.match(expectedIndex,/exports\.masterSetSplitFrameMode =/);
assert.doesNotMatch(expectedIndex,/require\(['"]\.\/index|explore|Stage416|Stage420/);
console.log('450_SINGLE_FUNCTION_EXPORT_ONLY=PASS');
console.log('450_PINNED_NODE22_DEPENDENCIES=PASS');
console.log('450_STAGE_ONLY_NO_FUNCTION_DEPLOY=PASS');
