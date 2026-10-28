import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyServerRequest518} from '../cloudflare/media-worker/src/catalogServerAuth518.js';
import {createExactFirebaseFetcher518} from '../cloudflare/media-worker/src/catalogFirebaseFetcher518.js';

const secret='app518-verified-server-key-must-be-at-least-32-chars';
const nowMs=1793152800000;
const url='https://functions.internal-example.test/app518-exact-source';
const payload={action:'enqueue',uid:'u-1',documentId:'song-1',
 sourceVersionNs:'001793152800000000001',desiredState:'removed'};
const sign=(body,ts=nowMs)=>createHmac('sha256',secret)
 .update(String(ts)+'\n'+body).digest('hex');
const request=(data,ts=nowMs,hash=null)=>new Request(url,{
 method:'POST',headers:{
  'content-type':'application/json',
  'x-soridraw-server-time-518':String(ts),
  'x-soridraw-server-signature-518':hash||sign(data,ts),
 },body:data,
});
const raw=JSON.stringify(payload);
let result=await verifyServerRequest518({
 request:request(raw),secret,nowMs,
});
assert.equal(result.code,'VERIFIED_SERVER_REQUEST');
assert.equal(result.payload.documentId,'song-1');
assert.equal((await verifyServerRequest518({
 request:request(JSON.stringify({...payload,uid:'other'}),nowMs,sign(raw)),
 secret,nowMs})).code,'DENY_BAD_SIGNATURE');
assert.equal((await verifyServerRequest518({
 request:request(raw,nowMs-300001),secret,nowMs})).code,'DENY_TIMESTAMP_WINDOW');
assert.equal((await verifyServerRequest518({
 request:request(raw),secret:'short',nowMs})).code,'DENY_SERVER_AUTH_CONFIGURATION');
assert.equal((await verifyServerRequest518({
 request:request(JSON.stringify({...payload,sourceVersionNs:'invalid'})),
 secret,nowMs})).code,'DENY_SIGNED_MUTATION_SHAPE');
assert.equal((await verifyServerRequest518({
 request:request('x'.repeat(4200)),secret,nowMs})).code,'DENY_PAYLOAD_SIZE');
const unsigned=new Request(url,{method:'POST',
 headers:{'content-type':'application/json'},body:raw});
assert.notEqual((await verifyServerRequest518({
 request:unsigned,secret,nowMs})).code,'VERIFIED_SERVER_REQUEST');

let received=0;
const exactFetcher=createExactFirebaseFetcher518({
 sourceUrl:url,expectedHostname:'functions.internal-example.test',secret,
 clock:()=>nowMs,fetcher:async(link,opts)=>{
  received++;
  assert.equal(link,url);
  const verified=await verifyServerRequest518({
   request:new Request(link,opts),secret,nowMs,
  });
  assert.equal(verified.code,'VERIFIED_SERVER_REQUEST');
  assert.equal(verified.payload.action,'exact-source');
  return {status:200,async json(){return {code:'SOURCE_VERIFIED',
   source:{uid:'u-1',documentId:'song-1',verifiedByServer:true,
    origin:'server-exact-read',state:'saved',
    updateTime:'2026-10-28T02:00:00.000000001Z',
    item:{id:'song-1',uid:'u-1'}}};}};
 }});
assert.equal(typeof exactFetcher,'function');
const source=await exactFetcher('u-1','song-1');
assert.equal(source.state,'saved');assert.equal(received,1);
assert.equal(createExactFirebaseFetcher518({
 sourceUrl:'http://internal-example.test',expectedHostname:'internal-example.test',secret,
}),null);
assert.equal(createExactFirebaseFetcher518({
 sourceUrl:'https://evil.example.test',expectedHostname:'functions.internal-example.test',secret,
}),null);
console.log('APP518_SERVER_HMAC_SHA256_TAMPER_EXPIRED_UNSIGNED_REJECT=PASS');
console.log('APP518_EXACT_FIREBASE_SERVER_URL_HOST_PINNED=PASS');
console.log('APP518_WORKER_SIGNED_SOURCE_CALLBACK=PASS');
console.log('APP518_SERVER_TRANSPORT_LIVE_REQUESTS=ZERO');
