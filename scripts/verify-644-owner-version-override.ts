// APP644: targeted invariant checks. No network, browser, Auth or user data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerFollowOverrideHeaders644} from '../src/lib/ownerFollowRequestOverride644';
import {captureOwnerFollowCanaryOptIn634} from '../src/lib/ownerFollowCanaryTab634';

const approved = 'synthetic-one-approved-owner';
const other = 'synthetic-unrelated-owner';
const key = 'Cloudflare-Workers-Version-Overrides';
const value = 'soridraw-explore-preview="6b13cde4-4a53-42d2-873f-361f7cf5a931"';
const store = new Map<string,string>();
const storage = {
  getItem(k:string){return store.get(k)??null;},
  setItem(k:string,v:string){store.set(k,v);}
};
const choose = (host:string,search:string,target:string) =>
  ownerFollowOverrideHeaders644(host,search,storage,target,approved);
assert.deepEqual(choose('preview.soridraw.com','',approved),{});
assert.deepEqual(choose('preview.soridraw.com','?ownerFollowCanary=0',approved),{});
assert.deepEqual(choose('preview.soridraw.com','?ownerFollowCanary=1',other),{});
assert.deepEqual(choose('soridraw.com','?ownerFollowCanary=1',approved),{});
assert.deepEqual(choose('test.soridraw.com','?ownerFollowCanary=1',approved),{});
assert.deepEqual(choose('localhost','?ownerFollowCanary=1',approved),{});
assert.deepEqual(choose('preview.soridraw.com','?ownerFollowCanary=1',approved),
  {[key]:value});
assert.equal(captureOwnerFollowCanaryOptIn634(
  'preview.soridraw.com','?ownerFollowCanary=1',storage),true);
assert.deepEqual(choose('preview.soridraw.com','',approved),{[key]:value});
assert.deepEqual(choose('preview.soridraw.com','',other),{});
assert.deepEqual(choose('soridraw.com','',approved),{});
assert.deepEqual(ownerFollowOverrideHeaders644('preview.soridraw.com','',null,approved,approved),{});
assert.deepEqual(ownerFollowOverrideHeaders644('preview.soridraw.com',
  '?ownerFollowCanary=1',null,approved,approved),{[key]:value});
assert.deepEqual(ownerFollowOverrideHeaders644('preview.soridraw.com',
  '?ownerFollowCanary=1',null,approved,''),{});

// Ensure only the actual follow mutation uses the selector, not profile,
// feed, follower-list, auth or notification GETs.
const source=readFileSync(new URL('../src/services/exploreSocialService.ts',
  import.meta.url),'utf8');
const block=source.slice(source.indexOf('export const setExploreFollow ='),
  source.indexOf('patchExploreFollowLocalState377',source.indexOf('export const setExploreFollow =')));
assert.match(block,/ownerFollowOverrideHeaders644\(/);
assert.match(block,/requestOrderedExploreFollow354\(/);
assert.match(block,/hasCanaryOverride644/);
assert.equal((source.match(/ownerFollowOverrideHeaders644\(/g)||[]).length,1);
assert.equal((source.match(/Cloudflare-Workers-Version-Overrides/g)||[]).length,0);
console.log('APP644_EXACT_PREVIEW_OWNER_EXPLICIT_TAB_ROUTING=PASS');
console.log('APP644_OTHER_USERS_HOSTS_ROUTES_AND_DEFAULT_HEADERS_UNCHANGED=PASS');
console.log('APP644_NO_ADDITIONAL_SERVER_REQUESTS=PASS');
