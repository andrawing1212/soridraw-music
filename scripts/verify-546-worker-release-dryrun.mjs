// APP546 source-only PREVIEW release artifact dry-run.
// A future shared-Worker release may adopt its verified output by separate
// approval. This script has NO upload/activate path and always removes all
// scratch files. Canonical Stage416 source stays byte-for-byte pinned.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {composeOwnerFollowWorker543} from
 '../cloudflare/explore-worker/candidates/compose-follow-worker-543.mjs';
if(process.argv.length!==3||process.argv[2]!=='--dry-run')
 throw Error('APP546_ONLY_EXPLICIT_DRY_RUN');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=join(root,'cloudflare/explore-worker');
const entry=join(src,'canonical/preview-entry.js');
const raw=readFileSync(join(src,'canonical/preview-worker.js'),'utf8');
const compiled=composeOwnerFollowWorker543(raw);
const entrySource=readFileSync(entry,'utf8');
const config=JSON.parse(readFileSync(join(src,'canonical/wrangler.preview.jsonc'),'utf8'));
assert.equal(config.name,'soridraw-explore-preview');
assert.equal(config.main,'./preview-entry.js');
assert.equal(config.vars?.SORIDRAW_OWNER_FOLLOW_INLINE_543,undefined);
assert.equal(config.vars?.SORIDRAW_OWNER_FOLLOW_BIND_544,undefined);
assert.equal(config.vars?.SORIDRAW_OWNER_FOLLOW_PUSH_532,undefined);
assert.match(entrySource,/APP544_OWNER_EPOCH_BIND_COMPILED_OPEN &&/);
assert.match(entrySource,/OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN &&/);
for(const name of [
 'owner-follow-writer-543.mjs','owner-follow-inline-canonical-540.mjs',
 'owner-follow-enrollment-544.mjs','owner-follow-auth-epoch-532.mjs',
 'owner-follow-http-539.mjs'
]){
 const s=readFileSync(join(src,'runtime',name),'utf8');
 if(/(?:OWNER_FOLLOW_INLINE_543_COMPILED_OPEN|APP540_INLINE_CANONICAL_COMPILED_OPEN|APP544_OWNER_EPOCH_BIND_COMPILED_OPEN|OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN|APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN)\s*=\s*true/.test(s))
  throw Error('APP546_UNEXPECTED_ACTIVE_GATE_'+name);
}
const base=mkdtempSync(join(tmpdir(),'soridraw-546-dryrun-'));
try{
 const work=join(base,'explore-worker');
 mkdirSync(work,{recursive:true});
 cpSync(join(src,'canonical'),join(work,'canonical'),{recursive:true});
 cpSync(join(src,'runtime'),join(work,'runtime'),{recursive:true});
 writeFileSync(join(work,'canonical/preview-worker.js'),compiled);
 const candidate=readFileSync(join(work,'canonical/preview-worker.js'),'utf8');
 assert.equal(candidate,compiled);
 const hash=createHash('sha256').update(candidate).digest('hex');
 const wrangler=join(src,'node_modules/wrangler/bin/wrangler.js');
 if(!existsSync(wrangler))throw Error('APP546_WRANGLER_NOT_INSTALLED');
 const command=spawnSync(process.execPath,[
  wrangler,'deploy','--dry-run',
  '--config',join(work,'canonical/wrangler.preview.jsonc'),
  '--outdir',join(base,'output')
 ],{cwd:work,encoding:'utf8',timeout:180000});
 if(command.status!==0){
  console.error(String(command.stderr||'').slice(-4000));
  console.error(String(command.stdout||'').slice(-1500));
  throw Error('APP546_BUNDLE_DRYRUN_FAILED');
 }
 if(!existsSync(join(base,'output')))throw Error('APP546_MISSING_BUNDLE_OUTPUT');
 console.log('APP546_OFF_PREVIEW_WORKER_ASSEMBLED_DRYRUN=PASS SHA256='+hash);
 console.log('APP546_CANONICAL_STAGE416_UNCHANGED=PASS;DEPLOY=0;SHARED_D1_WRITE=0');
}finally{rmSync(base,{recursive:true,force:true})}
