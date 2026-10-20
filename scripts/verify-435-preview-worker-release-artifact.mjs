import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const AUDITED_SHA='8b793206c67277dbe78b97426a340bcb2a613cdb';
const workerPath='cloudflare/explore-worker/canonical/preview-worker.js';
const hashPath='cloudflare/explore-worker/canonical/source-sha256.txt';
const patch100='cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs';
const patch101='cloudflare/explore-worker/patches/101-publication-live-convergence.mjs';

const git=(args,{trim=true,...options}={})=>{
  const r=spawnSync('git',args,{
    encoding:'utf8',
    maxBuffer:32*1024*1024,
    ...options,
  });
  if(r.status!==0) throw new Error(r.stderr||r.error?.message||('git '+args.join(' ')+' failed'));
  return trim?r.stdout.trim():r.stdout;
};

if(spawnSync('git',['cat-file','-e',AUDITED_SHA+'^{commit}']).status!==0){
  git(['fetch','--no-tags','--depth=1','origin',AUDITED_SHA]);
}

for(const path of [patch100,patch101]){
  const audited=git(['rev-parse',AUDITED_SHA+':'+path]);
  const current=git(['hash-object',path]);
  assert.equal(current,audited,path+' must remain byte-identical to the audited source');
}

const temp=mkdtempSync(join(tmpdir(),'soridraw-app434-release-'));
try{
  const base=git(['show',AUDITED_SHA+':'+workerPath],{trim:false});
  writeFileSync(join(temp,'worker.js'),base,'utf8');
  for(const patch of [patch100,patch101]){
    const r=spawnSync(process.execPath,[resolve(patch)],{
      encoding:'utf8',
      env:{...process.env,SORIDRAW_REMOTE_WORKER_DIR:temp},
    });
    assert.equal(r.status,0,r.stderr||r.stdout);
  }
  const generated=readFileSync(join(temp,'worker.js'),'utf8');
  const canonical=readFileSync(workerPath,'utf8');
  assert.equal(canonical,generated,
    'canonical PREVIEW Worker must equal audited base + patch100 + patch101 exactly');

  for(const marker of [
    'SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018',
    'SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_432_20261019',
    'handlePublicationLiveCard432',
    'writeAndPublishPublicationState431',
    'PUBLICATION_LIVE_CARD_ROUTE_432',
  ]) assert.ok(canonical.includes(marker),'missing materialized marker '+marker);

  const digest=createHash('sha256').update(canonical,'utf8').digest('hex');
  assert.equal(readFileSync(hashPath,'utf8').trim(),digest,
    'canonical/source-sha256.txt must lock the materialized Worker bytes');

  const wrangler=readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8');
  assert.match(wrangler,/SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT/);
  assert.match(wrangler,/publicationRelease431Candidate/);

  const appVersion=JSON.parse(readFileSync('public/app-version.json','utf8'));
  assert.ok([434, 435, 436, 437, 438, 439, 440, 441, 442].includes(Number(appVersion.version)),
    'frozen app434 Worker contract remains exact while Hosting advances through app442');
} finally {
  rmSync(temp,{recursive:true,force:true});
}

console.log('APP434_WORKER_PATCH100_101_EXACT_MATERIALIZATION=PASS');
console.log('APP434_WORKER_CANONICAL_SHA256=PASS');
console.log('APP434_PUBLICATION_FUNCTION_ENDPOINT_BINDING=PASS');
console.log('APP434_WORKER_APP442_HOSTING_VERSION_COMPATIBLE=PASS');
