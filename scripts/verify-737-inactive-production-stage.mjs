import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeInactiveVersionBody} from './app737-stage-inactive-production-follow.mjs';
const version='af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const names=[['DB','d1'],['PROFILE_MEDIA','r2_bucket'],
['EXPLORE_MIRROR_PREVIEW','service'],['EXPLORE_MIRROR_TEST','service'],
['EXPLORE_LIKE_BATCH_SCHEDULER','durable_object_namespace'],
['EXPLORE_MIRROR_TOKEN','secret_text'],...Array.from({length:6},(_,i)=>['X'+i,'plain_text'])];
const bindings=names.map(([name,type])=>({name,type}));
const v={id:version,bindings,compatibility_date:'2026-10-01',compatibility_flags:[]};
const root=mkdtempSync(join(tmpdir(),'app737-inactive-'));
mkdirSync(join(root,'integration'));
writeFileSync(join(root,'production-main.mjs'),'export default {fetch(){return new Response("ok")}};\n');
writeFileSync(join(root,'production-follow-entry.mjs'),
 "import base from './production-main.mjs';\n"+
 "export * from './production-main.mjs';\n"+
 "import {APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN} from './integration/app729-production-follow-adapter.mjs';\n"+
 "export default base;\n");
writeFileSync(join(root,'integration','app729-production-follow-adapter.mjs'),
 'export const APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN = false;\n');
try{
 const body=makeInactiveVersionBody({oldVersion:version,oldSettings:{bindings},
  pinnedVersion:v,candidateDir:root});
 assert.equal(body.main_module,'production-follow-entry.mjs');
 assert.equal(body.bindings.length,12);
 assert(body.bindings.every(x=>x.type==='inherit'&&x.version_id===version));
 assert.equal(body.modules.length,3);
 assert.equal(body.deploy,undefined);
 const inheritedDate=makeInactiveVersionBody({oldVersion:version,
  oldSettings:{bindings,compatibility_date:'2026-10-01',compatibility_flags:[]},
  pinnedVersion:{...v,compatibility_date:undefined,compatibility_flags:undefined},candidateDir:root});
 assert.equal(inheritedDate.compatibility_date,'2026-10-01');
 assert.deepEqual(inheritedDate.compatibility_flags,[]);
 assert.throws(()=>makeInactiveVersionBody({oldVersion:version,
  oldSettings:{bindings},pinnedVersion:{...v,id:'00000000-0000-0000-0000-000000000000'},candidateDir:root}),/HOLD/);
 assert.throws(()=>makeInactiveVersionBody({oldVersion:version,
  oldSettings:{bindings},pinnedVersion:{...v,bindings:bindings.slice(0,11)},candidateDir:root}),/HOLD/);
 console.log('APP737_INACTIVE_PRODUCTION_VERSION_SOURCE_TEST=PASS; TRAFFIC_WRITE=0');
}finally{rmSync(root,{recursive:true,force:true})}
