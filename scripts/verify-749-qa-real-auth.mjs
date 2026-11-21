import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {createQaFirebaseVerifier749} from '../cloudflare/explore-worker/experiments/owner-follow-qa-real-auth-749.mjs';
import {createQaAuthEntry749} from '../cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs';
const now=1800000000000,sec=now/1000;
const keypair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...keypair.publicKey.export({format:'jwk'}),kid:'qa-key-749',alg:'RS256',use:'sig'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const sign=(payload,header={alg:'RS256',kid:jwk.kid,typ:'JWT'})=>{
  const input=enc(header)+'.'+enc(payload);
  const signature=createSign('RSA-SHA256').update(input).end().sign(keypair.privateKey);
  return input+'.'+signature.toString('base64url');
};
const authClaims=(uid)=>({iss:'https://securetoken.google.com/soridraw-app',
  aud:'soridraw-app',sub:uid,iat:sec-60,auth_time:sec-120,exp:sec+900});
const appId='1:1083981050742:web:deadbeef';
const appClaims=()=>({iss:'https://firebaseappcheck.googleapis.com/1083981050742',
  aud:['projects/1083981050742','projects/soridraw-app'],sub:appId,
  iat:sec-60,exp:sec+900});
let keyFetches=0;
const getKeys=async url=>{
  assert(['https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com',
    'https://firebaseappcheck.googleapis.com/v1/jwks'].includes(url));
  keyFetches++;
  return {ok:true,status:200,headers:new Headers({'Cache-Control':'public, max-age=120'}),
    json:async()=>({keys:[jwk]})};
};
const verify=createQaFirebaseVerifier749({send:getKeys,now:()=>now});
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
  ownerUid:'qaSyntheticA',actorUid:'qaSyntheticB',authEpoch:'b'.repeat(32),
  probeToken:'c'.repeat(64),hmacSecret:'d'.repeat(64)};
const request=(method,path,uid=cfg.actorUid,app=appClaims(),auth=authClaims(uid))=>new Request(
  'https://qa.example/qa730/verified/'+path,{method,headers:{
    Authorization:'Bearer '+sign(auth),'X-Firebase-AppCheck':sign(app),
  }});
const checkOpts=(method,path)=>({actorUid:cfg.actorUid,ownerUid:cfg.ownerUid,method,path});
const signed=request('PUT','follow');
assert.deepEqual(await verify(signed,checkOpts('PUT','follow')),
  {verified:true,uid:cfg.actorUid,qaProject:'soridraw-app'});
assert.equal(keyFetches,2,'only two public JWK reads; reuse cached keys');
await verify(request('DELETE','follow'),checkOpts('DELETE','follow'));
assert.equal(keyFetches,2,'do not refetch keys for every action');
const reject=async(req,o)=>assert.rejects(()=>verify(req,o),/APP749_QA_SIGNED_CREDENTIALS_REQUIRED/);
await reject(request('PUT','follow',cfg.ownerUid),checkOpts('PUT','follow'));
await reject(request('PUT','follow',cfg.actorUid,appClaims(),
  {...authClaims(cfg.actorUid),aud:'soridraw-app-866a5'}),checkOpts('PUT','follow'));
await reject(request('PUT','follow',cfg.actorUid,appClaims(),
  {...authClaims(cfg.actorUid),exp:sec-1}),checkOpts('PUT','follow'));
await reject(request('PUT','follow',cfg.actorUid,
  {...appClaims(),aud:['projects/other']}),checkOpts('PUT','follow'));
await reject(request('PUT','follow',cfg.actorUid,
  {...appClaims(),sub:'1:999999999:web:foreign'}),checkOpts('PUT','follow'));
await reject(request('PUT','follow',cfg.actorUid,appClaims(),
  {...authClaims(cfg.actorUid),iss:'https://securetoken.google.com/soridraw-app-866a5'}),
  checkOpts('PUT','follow'));
const unsignedBody=sign(authClaims(cfg.actorUid)).split('.');
unsignedBody[1]=enc({...authClaims(cfg.actorUid),sub:cfg.ownerUid});
await reject(new Request('https://qa.example/qa730/verified/follow',{
  method:'PUT',headers:{Authorization:'Bearer '+unsignedBody.join('.'),
    'X-Firebase-AppCheck':sign(appClaims())}}),checkOpts('PUT','follow'));
await reject(new Request('https://qa.example/qa730/verified/follow',{
  method:'PUT',headers:{'X-Owner583-Token':cfg.probeToken}}),checkOpts('PUT','follow'));
await verify(request('GET','status',cfg.ownerUid),checkOpts('GET','status'));
await reject(request('PUT','follow',cfg.actorUid),checkOpts('GET','status'));
const calls=[];
const doFetch=async req=>{
  calls.push({path:new URL(req.url).pathname,headers:Object.fromEntries(req.headers)});
  return Response.json({ok:true,syntheticOnly:true,changed:true,version:11});
};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
  SORIDRAW_QA749_REAL_AUTH:'1',OWNER583_QA_CONFIG:JSON.stringify(cfg),
  OWNER558_DO:{idFromName:()=> 'qa-only-id',get:()=>({fetch:doFetch})}};
const app=createQaAuthEntry749({verify,legacy:{fetch:()=>Response.json({legacy:true})}});
assert.equal((await app.fetch(new Request('https://qa.example/qa583/status'),env)).status,200);
let r=await app.fetch(request('PUT','follow'),env);
assert.equal(r.status,200);
assert.equal((await r.json()).qaFirebaseAuthAppCheckVerified,true);
assert.equal(calls.length,1);
assert.equal(calls[0].path,'/qa730/follow');
assert.equal(calls[0].headers['x-owner583-token'],cfg.probeToken);
assert.equal(calls[0].headers.authorization,undefined,'no Firebase credential to DO');
assert.equal(calls[0].headers['x-firebase-appcheck'],undefined);
const qaOrigin='https://soridraw-qa-owner-584.web.app';
const withQaOrigin=req=>{
 const headers=new Headers(req.headers);headers.set('Origin',qaOrigin);
 return new Request(req,{headers});
};
const denied=await app.fetch(withQaOrigin(request('PUT','follow',cfg.ownerUid)),env);
assert.equal(denied.status,403);
assert.deepEqual(await denied.json(),{ok:false,syntheticOnly:true,
  qa749AuthStage:'PRINCIPAL_MISMATCH'});
assert.equal(calls.length,1,'no DO call on wrong owner/actor');
// Signed-only QA auth diagnostics are read-only and report no secrets.
const badAuth=await app.fetch(withQaOrigin(request('PUT','follow',cfg.actorUid,
 appClaims(),{...authClaims(cfg.actorUid),exp:sec-1})),env);
assert.equal(badAuth.status,403);
assert.equal((await badAuth.json()).qa749AuthStage,'AUTH_CLAIMS');
const badApp=await app.fetch(withQaOrigin(request('PUT','follow',cfg.actorUid,
 {...appClaims(),sub:'1:999999999:web:foreign'})),env);
assert.equal(badApp.status,403);
assert.equal((await badApp.json()).qa749AuthStage,'APPCHECK_VALIDATION');
assert.equal(calls.length,1,'no DO mutation for malformed credentials');
// Specific QA-only failure stage remains safe: no token/header/UID/key ID revealed.
const assertStage=async(verifier,req,expected)=>{
  await assert.rejects(()=>verifier(req,checkOpts('PUT','follow')),
    e=>e.message==='APP749_QA_SIGNED_CREDENTIALS_REQUIRED'&&
       e.qaStage===expected&&
       !JSON.stringify(e).includes(cfg.actorUid));
};
const invalidHeader=new Request(signed,{headers:{
  Authorization:'Bearer '+sign(authClaims(cfg.actorUid),{
   alg:'HS256',kid:jwk.kid,typ:'JWT'}),
  'X-Firebase-AppCheck':sign(appClaims())
}});
await assertStage(verify,invalidHeader,'AUTH_TOKEN_FORMAT');
const noKeys=createQaFirebaseVerifier749({send:async()=>new Response('unavailable',{status:503}),
 now:()=>now});
await assertStage(noKeys,signed,'AUTH_KEYS_HTTP');
const network=createQaFirebaseVerifier749({send:async()=>{throw Error('network')},now:()=>now});
await assertStage(network,signed,'AUTH_KEYS_NETWORK');
const invalidJson=createQaFirebaseVerifier749({send:async()=>({
  ok:true,status:200,json:async()=>{throw Error('bad json')},
}),now:()=>now});
await assertStage(invalidJson,signed,'AUTH_KEYS_JSON');
const invalidShape=createQaFirebaseVerifier749({send:async()=>({
  ok:true,status:200,json:async()=>({notKeys:[]}),
}),now:()=>now});
await assertStage(invalidShape,signed,'AUTH_KEYS_SHAPE');
const filtered=createQaFirebaseVerifier749({send:async()=>({
  ok:true,status:200,json:async()=>({keys:[{kty:'EC',kid:'x',n:'bad',e:'AQAB'}]}),
}),now:()=>now});
await assertStage(filtered,signed,'AUTH_KEYS_FILTER');
const missingKid=createQaFirebaseVerifier749({send:async()=>({
 ok:true,status:200,headers:new Headers(),json:async()=>({keys:[{...jwk,kid:'not-current'}]})
}),now:()=>now});
await assertStage(missingKid,signed,'AUTH_KID_MISMATCH');
const badSignatureParts=sign(authClaims(cfg.actorUid)).split('.');
badSignatureParts[2]=(badSignatureParts[2][0]==='A'?'B':'A')+
 badSignatureParts[2].slice(1);
const sigHeaders=new Headers(signed.headers);
sigHeaders.set('Authorization','Bearer '+badSignatureParts.join('.'));
await assertStage(verify,new Request(signed,{headers:sigHeaders}),'AUTH_SIGNATURE');
assert.equal(calls.length,1,'all reject stages require zero DO mutations');
const noOrigin=await app.fetch(new Request('https://qa.example/qa730/verified/follow',{
 method:'PUT'}),env);
assert.equal(noOrigin.status,403);
assert.equal(Object.hasOwn(await noOrigin.json(),'qa749AuthStage'),false,
 'stage labels only exposed to pinned QA origin');
const oldOnly={...env,SORIDRAW_QA749_REAL_AUTH:'0'};
assert.equal((await app.fetch(request('PUT','follow'),oldOnly)).status,403);
assert.equal(calls.length,1,'default QA app never enables new auth');
assert.equal((await app.fetch(new Request('https://qa.example/qa730/follow',{method:'PUT'}),env)).status,403);
assert.equal(calls.length,1,'legacy synthetic remains probe-protected');
assert.equal((await app.fetch(request('POST','follow'),env)).status,404);
assert.equal(calls.length,1);
assert.equal((await app.fetch(request('PUT','follow'),{...env,DB:{}})).status,403);
assert.equal(calls.length,1,'no shared binding bypass');

const preflight=(origin,method='PUT',headers='authorization,x-firebase-appcheck')=>
  app.fetch(new Request('https://qa.example/qa730/verified/follow',{
    method:'OPTIONS',headers:{Origin:origin,
      'Access-Control-Request-Method':method,
      'Access-Control-Request-Headers':headers}}),env);
const pf=await preflight(qaOrigin);
assert.equal(pf.status,204);
assert.equal(pf.headers.get('Access-Control-Allow-Origin'),qaOrigin);
assert.equal(pf.headers.get('Access-Control-Allow-Methods'),'PUT, DELETE, OPTIONS');
assert.equal((await preflight('https://soridraw.com')).status,403);
assert.equal((await preflight(qaOrigin,'POST')).status,403);
assert.equal((await preflight(qaOrigin,'PUT','authorization,x-secret')).status,403);
assert.equal(calls.length,1,'CORS preflight must never call DO');
const fromQa=request('PUT','follow');
const signedHeaders=new Headers(fromQa.headers);
signedHeaders.set('Origin',qaOrigin);
const accepted=await app.fetch(new Request(fromQa,{headers:signedHeaders}),env);
assert.equal(accepted.status,200);
assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),qaOrigin);
assert.equal(calls.length,2,'signed QA browser request forwarded to DO');
const outsiderHeaders=new Headers(fromQa.headers);
outsiderHeaders.set('Origin','https://preview.soridraw.com');
const outside=await app.fetch(new Request(fromQa,{headers:outsiderHeaders}),env);
assert.equal(outside.status,403);
assert.equal(outside.headers.get('Access-Control-Allow-Origin'),null);
assert.equal(Object.hasOwn(await outside.json(),'qa749AuthStage'),false,
  'non-QA origin never gets stage details');
assert.equal(calls.length,2,'non-QA origin must never reach DO');
const noBearer=new Request('https://qa.example/qa730/verified/follow',{
  method:'PUT',headers:{Origin:qaOrigin,'X-Owner583-Token':cfg.probeToken}});
const deniedBrowser=await app.fetch(noBearer,env);
assert.equal(deniedBrowser.status,403);
assert.equal(deniedBrowser.headers.get('Access-Control-Allow-Origin'),qaOrigin);
assert.equal((await deniedBrowser.json()).qa749AuthStage,'REQUEST_INVALID');
assert.equal(calls.length,2,'probe token cannot bypass signed auth');
console.log('APP749_QA_BROWSER_CORS_PINNED_584_PREFLIGHT=PASS');
console.log('APP749_QA_REAL_SIGNED_AUTH_APPCHECK_PUBLIC_KEY_OFFLINE=PASS');
console.log('APP749_QA_AUTH_GATE_NO_PROBE_BYPASS_NO_SHARED_BINDINGS=PASS');
console.log('APP749_EXISTING_APP583_DELEGATION_AND_SYNTHETIC_PATH_PRESERVED=PASS');
console.log('APP749_QA_REAL_FIREBASE_TOKENS_AND_PC_MOBILE=NOT_RUN');
