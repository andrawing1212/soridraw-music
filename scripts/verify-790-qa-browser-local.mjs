// APP790 exact browser route with real workerd SQLite DO/D1/R2 and locally
// signed credentials. All external Firebase/Google requests are intercepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,createSign,createHmac} from 'node:crypto';
const [bundle,installDir]=process.argv.slice(2);assert(bundle&&installDir);
const {Miniflare}=createRequire(resolve(installDir,'package.json'))('miniflare');
const c={ownerUid:'qa790Owner',actorUid:'qa790Actor',authEpoch:'a'.repeat(32),
 hmacSecret:'b'.repeat(64),probeToken:'c'.repeat(64),projectId:'soridraw-app',projectNumber:'1083981050742'};
const bindings={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 OWNER583_QA_CONFIG:JSON.stringify(c),QA790_ISOLATED:'1',QA790_LOCAL_TEST:'1',QA790_RUN:'123456789',
 QA790_ROW:'qa790_'+'d'.repeat(16),QA790_CUTOVER:'qa790_cutover_'+'e'.repeat(32),QA790_ACCESS:'f'.repeat(64)};
const key=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...key.publicKey.export({format:'jwk'}),kid:'qa790-local-key',alg:'RS256',use:'sig'};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const sign=x=>{const s=encode({alg:'RS256',typ:'JWT',kid:jwk.kid})+'.'+encode(x);return s+'.'+createSign('RSA-SHA256').update(s).end().sign(key.privateKey).toString('base64url')};
const t=Math.floor(Date.now()/1000);
const auth=(uid,project=c.projectId)=>sign({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,auth_time:t-30,iat:t-20,exp:t+600});
const aToken=auth(c.ownerUid),bToken=auth(c.actorUid),wrong=auth(c.actorUid,'soridraw-app-866a5');
const app=sign({iss:'https://firebaseappcheck.googleapis.com/1083981050742',aud:['projects/1083981050742'],
 sub:'1:1083981050742:web:aabbccdd',iat:t-20,exp:t+600});
let marker={authEpoch:c.authEpoch,version:16,followerCount:0},relayCalls=0,failOnce=true,markerReads=0;
const mf=new Miniflare({modules:true,script:readFileSync(resolve(bundle),'utf8'),compatibilityDate:'2026-06-17',cf:false,bindings,
 durableObjects:{OWNER558_DO:{className:'OwnerFollowIsolated558',useSQLite:true}},
 d1Databases:{QA790_D1:'00000000-0000-4000-8000-000000000790'},r2Buckets:['QA790_R2'],
 outboundService:async request=>{
  const u=new URL(request.url);
  if(u.href==='https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com'||
    u.href==='https://firebaseappcheck.googleapis.com/v1/jwks')return Response.json({keys:[jwk]},{headers:{'Cache-Control':'max-age=600'}});
  if(u.origin==='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'){
   assert.equal(u.pathname,'/ownerFollowerSync532/'+c.ownerUid+'.json');
   assert.equal(u.searchParams.get('auth'),aToken);assert.equal(request.method,'GET');markerReads++;
   return Response.json(marker);
  }
  assert.equal(u.href,'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542');
  assert.equal(request.method,'POST');relayCalls++;
  const body=await request.text(),at=request.headers.get('X-Soridraw-Follow-Relay529-At');
  assert.equal(request.headers.get('X-Soridraw-Follow-Relay529-Signature'),createHmac('sha256',c.hmacSecret).update(at+'.'+body).digest('hex'));
  const p=JSON.parse(body);assert.equal(p.ownerUid,c.ownerUid);assert.equal(p.authEpoch,c.authEpoch);
  if(failOnce){failOnce=false;return Response.json({ok:false},{status:503})}
  const applied=p.revision>marker.version;
  if(applied)marker={authEpoch:p.authEpoch,version:p.revision,followerCount:p.followerCount};
  return Response.json({ok:true,applied});
 }});
try{
 const db=await mf.getD1Database('QA790_D1');
 await db.prepare('CREATE TABLE app768_qa_synthetic_follow (k TEXT PRIMARY KEY, following INTEGER NOT NULL)').run();
 await db.prepare('INSERT INTO app768_qa_synthetic_follow(k,following) VALUES (?,0)').bind(bindings.QA790_ROW).run();
 const ns=await mf.getDurableObjectNamespace('OWNER558_DO'),stub=ns.get(ns.idFromName('qa730-isolated-owner-only'));
 const legacy={ownerUid:c.ownerUid,actorUid:c.actorUid,version:16,desired:false,followerCount:0,pending:null,operationId:null,lastStatus:'settled'};
 assert.equal((await stub.fetch('http://local/__local/seed',{method:'POST',headers:{'X-Local-Test':'local-fixture-only','Content-Type':'application/json'},body:JSON.stringify(legacy)})).status,200);
 const snapshot=async()=>await (await stub.fetch('http://local/__local/snapshot',{headers:{'X-Local-Test':'local-fixture-only'}})).json();
 const row=async()=>Number((await db.prepare('SELECT following FROM app768_qa_synthetic_follow WHERE k=?').bind(bindings.QA790_ROW).first()).following);
 const r2=await mf.getR2Bucket('QA790_R2');
 const call=async(method,path,token,extra={})=>{
  const v=await mf.dispatchFetch('http://localhost'+path,{method,headers:{...(token?{Authorization:'Bearer '+token,'X-Firebase-AppCheck':app,Origin:'https://soridraw-qa-owner-584.web.app'}:{}),...extra}});
  return {code:v.status,body:await v.json().catch(()=>null)};
 };
 const check=(v,code)=>assert.equal(v.code,code,JSON.stringify(v));
 const status='/qa730/verified/status',follow='/qa730/verified/follow';
 check(await call('GET',status),403);check(await call('GET',status,wrong),403);
 check(await call('PUT',follow,aToken),403);assert.equal(await row(),0);
 check(await call('PUT',follow,bToken),409);assert.equal(await row(),0);
 check(await call('GET',status,bToken),200);
 let v=await call('GET',status,aToken);check(v,200);assert.equal(v.body.version,16);
 assert.equal((await snapshot()).control.marker.version,16);
 const result=await call('PUT',follow,bToken);check(result,200);
 assert.equal(result.body.d1RowsWritten,1);assert.equal(result.body.settlementAdditionalD1Writes,0);
 assert.equal(await row(),1);
 check(await call('PUT',follow,bToken),409);
 const wait=async(version,count)=>{
  for(let i=0;i<35;i++){
   const a=await call('GET',status,aToken);
   if(a.code===200&&a.body.version===version&&!a.body.pending){
    const b=await call('GET',status,bToken);check(b,200);
    assert.equal(b.body.version,version);assert.equal(b.body.followerCount,count);return;
   }
   await new Promise(r=>setTimeout(r,250));
  }
  assert.fail('local relay marker/legacy baseline did not settle '+JSON.stringify({marker,relayCalls,stored:await snapshot()}));
 };
 await wait(17,1);assert.equal(marker.version,17);assert.equal(marker.followerCount,1);assert.equal(relayCalls,2);
 const cancel=await call('DELETE',follow,bToken);check(cancel,200);
 assert.equal(cancel.body.d1RowsWritten,1);assert.equal(cancel.body.settlementAdditionalD1Writes,0);assert.equal(await row(),0);
 await wait(18,0);assert.equal(marker.version,18);assert.equal(marker.followerCount,0);assert.equal(relayCalls,3);
 check(await call('PUT',follow,bToken),409);check(await call('DELETE',follow,bToken),409);
 assert.equal((await r2.list()).objects.length,7);
 check(await call('POST','/qa790/operator/cleanup'),403);
 const clean=await call('POST','/qa790/operator/cleanup',undefined,{'X-QA790-Access':bindings.QA790_ACCESS});
 check(clean,200);assert.equal(clean.body.completed,true);
 assert.equal((await r2.list()).objects.length,0);
 const s=await snapshot();assert.equal(s.old.version,18);assert.equal(s.old.desired,false);
 assert.equal(s.control,undefined);assert.equal(s.receipts,undefined);
 assert(markerReads>0);
 console.log('APP790_LOCAL_BROWSER_REAL_WORKERD_D1_R2_DO_SIGNED_TOKEN_AND_HMAC_503=PASS');
 console.log('APP790_LOCAL_W1_W0_EACH_FOLLOW_CANCEL_AND_EXACT_QA_LEGACY_BASELINE_CLEANUP=PASS');
 console.log('APP790_REMOTE_FIREBASE_AUTH_APPCHECK_RTDB=NOT_TESTED');
}finally{await mf.dispose()}
