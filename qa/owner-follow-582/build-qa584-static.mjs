// APP584: QA-only static packaging. Offline: no credentials, no network, no deploy.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

assert.deepEqual(process.argv.slice(2),['--qa-only'],'Explicit --qa-only is required');
const folder=dirname(fileURLToPath(import.meta.url));
const repo=resolve(folder,'../..');
const output=join(folder,'dist-qa584');
const CDN='https://www.gstatic.com/firebasejs/12.19.0/';
const sources=[
 ['qa/owner-follow-582/owner-browser-proof-584.html','index.html'],
 ['qa/owner-follow-582/owner-browser-proof-584.mjs','qa/owner-follow-582/owner-browser-proof-584.mjs'],
 ['qa/owner-follow-582/owner-client.mjs','qa/owner-follow-582/owner-client.mjs'],
 ['cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs','cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs'],
];
const replaceModules=source=>{
 let result=source;
 for(const [module,url] of [
  ['firebase/app',CDN+'firebase-app.js'],
  ['firebase/auth',CDN+'firebase-auth.js'],
  ['firebase/database',CDN+'firebase-database.js'],
 ]) result=result.replaceAll("'"+module+"'","'"+url+"'");
 assert(!/['"]firebase\/(?:app|auth|database)['"]/.test(result),'Unmapped browser bare import');
 return result;
};
const artifacts=[];
for(const [src,dest] of sources){
 const text=readFileSync(join(repo,src),'utf8');
 if(/soridraw-app-866a5|91309780603|e1a30fc9ef497fda1d34f4ab3dc1da45/.test(text))
  throw Error('APP584_SHARED_PROJECT_OR_ACCOUNT_IN_PUBLIC_SOURCE');
 let content=dest.endsWith('.mjs')?replaceModules(text):text;
 if(dest==='index.html'){
  assert(content.includes('<script type="module" src="./owner-browser-proof-584.mjs"></script>'),
   'Unexpected source HTML entry');
  content=content.replace('<script type="module" src="./owner-browser-proof-584.mjs"></script>',
   '<script type="module" src="/qa/owner-follow-582/owner-browser-proof-584.mjs"></script>');
 }
 if(dest.endsWith('.mjs')) assert(!/\bfrom\s*['"](?:\.{1,2}\/)*src\/firebase/.test(content),
  'Normal SORIDRAW Firebase import forbidden');
 artifacts.push({path:dest,content,sha256:createHash('sha256').update(content).digest('hex')});
}
const expected=resolve(repo,'qa/owner-follow-582/dist-qa584');
assert.equal(resolve(output),expected,'Unexpected package destination');
if(existsSync(output))rmSync(output,{recursive:true,force:true});
for(const entry of artifacts){
 const target=join(output,entry.path);
 mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,entry.content,{mode:0o644});
}
console.log('APP584_QA_STATIC_PACKAGE_PASS');
for(const entry of artifacts)console.log(entry.path+' sha256='+entry.sha256);
console.log('QA_PROJECT_ID=soridraw-app (source-only; no deploy performed)');
