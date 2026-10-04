import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE='9c11b95cf4c95210011b1425cea23f3e51cbf34f';
const PATH='cloudflare/explore-worker/canonical/preview-worker.js';
const current=readFileSync(PATH,'utf8');
const baseline=execFileSync('git',['show',BASE+':'+PATH],{encoding:'utf8',maxBuffer:8*1024*1024});

function extract(name,source) {
  let start=source.indexOf('async function '+name+'(');
  if(start<0) start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote=null,esc=false,line=false,block=false;
  const tick=String.fromCharCode(96);
  for(let i=brace;i<source.length;i++) {
    const ch=source[i],next=source[i+1];
    if(line){if(ch==='\n')line=false;continue;}
    if(block){if(ch==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(ch==='\\'){esc=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='/'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){block=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch===tick){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.equal(
  extract('adjustExploreFollowCountersDelta',current),
  extract('adjustExploreFollowCountersDelta',baseline),
  'legacy counter mutation must be exact Worker341',
);
assert.equal(
  extract('syncExploreFollowingR2AfterMutation',current),
  extract('syncExploreFollowingR2AfterMutation',baseline),
  'legacy post-mutation R2 sync must be exact Worker341',
);

const baseCore=extract('handleFollowR2Core',baseline);
const anchor='  const authContext = await requireExploreAuth(request);\n';
assert.ok(baseCore.includes(anchor));
const expectedCore=baseCore.replace(anchor,anchor+
  '  const followCutover348 = await readFollowCutoverState348(env);\n'+
  '  if (followCutover348.mode === "overlay348") {\n'+
  '    return handleFollowOverlay354(request, env, cors, authContext.uid, targetUid, shouldFollow, followCutover348);\n'+
  '  }\n');
assert.equal(extract('handleFollowR2Core',current),expectedCore,'legacy core may differ only by the overlay router');
assert.doesNotMatch(extract('handleFollowR2Core',current),/syncExactSharedFollowing347/);
assert.doesNotMatch(extract('adjustExploreFollowCountersDelta',current),/SORIDRAW_FOLLOW_COMBINED_COUNTERS_345/);

const outer=extract('handleFollow',current);
const protocol=outer.indexOf('X-Soridraw-Follow-Protocol');
const legacySync=outer.indexOf('syncExploreFollowingR2AfterMutation');
assert.ok(protocol>=0 && legacySync>protocol,'overlay must exit before Worker341 legacy post-sync');

console.log('FOLLOW356_WORKER341_LEGACY_COUNTER_PARITY=PASS');
console.log('FOLLOW356_WORKER341_POSTSYNC_PARITY=PASS');
console.log('FOLLOW356_OVERLAY_ROUTER_DORMANT_LEGACY=PASS');
console.log('FOLLOW356_LEGACY_347_COMPAT_WRITE=ABSENT');
