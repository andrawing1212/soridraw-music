// Real negative-auth HTTP smoke. This cannot prove a genuine signed user 200.
import assert from 'node:assert/strict';
const base='https://soridraw-explore-preview.andrawing1212.workers.dev';
const origin='https://preview.soridraw.com',p='/v1/me/notifications/inbox';
const send=async(path,method='GET',headers={})=>{
 const res=await fetch(base+path,{method,headers:{Origin:origin,...headers},signal:AbortSignal.timeout(20000)});
 return {res,body:await res.text()};
};
const {res:options}=await send(p,'OPTIONS');
assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),origin);
assert.match(options.headers.get('Access-Control-Allow-Headers')||'',/X-Firebase-AppCheck/);
let x=await send(p+'?uid=foreign');
assert.equal(x.res.status,401,'UNAUTH_GET_MUST_REFUSE');
assert.ok(!x.body.includes('"items"'),'NO_PRIVATE_DATA');
x=await send(p,'GET',{'Authorization':'Bearer invalid-id-token','X-Firebase-AppCheck':'invalid-appcheck'});
assert.equal(x.res.status,401,'INVALID_SIGNED_TOKENS_REFUSED');
assert.equal((await send(p,'POST')).res.status,405,'GET_ONLY');
assert.equal((await send(p,'GET',{Origin:'https://soridraw.com'})).res.status,403,'OTHER_ORIGIN_FORBIDDEN');
const feed=(await send('/v1/feed?sort=latest&limit=1')).res;
assert.equal(feed.status,200,'EXISTING_FEED_HEALTHY');
assert.equal(feed.headers.get('X-SORIDRAW-D1-Write'),'0','FEED_D1_W0');
console.log('NOTIFICATION_021_LIVE_OPTIONS_204_UNAUTH_401_POST_405_ORIGIN_403=PASS');
console.log('NOTIFICATION_021_EXISTING_FEED_200_W0=PASS');
console.log('NOTIFICATION_021_ACTUAL_SIGNED_USER_JWT_APPCHECK_200=NOT_TESTED_NO_TOKEN');
