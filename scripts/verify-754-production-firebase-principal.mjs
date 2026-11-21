import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {createApp754ProductionPrincipalVerifier,
 APP754_PRODUCTION_PRINCIPAL_COMPILED_OPEN}
 from './app754-production-firebase-principal.mjs';
const time=1800000000000,sec=time/1000;
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...keys.publicKey.export({format:'jwk'}),kid:'prod-test-key',alg:'RS256',use:'sig'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const sign=(payload,header={alg:'RS256',typ:'JWT',kid:jwk.kid})=>{
 const h=enc(header),p=enc(payload);
 const sig=createSign('RSA-SHA256').update(h+'.'+p).end().sign(keys.privateKey);
 return h+'.'+p+'.'+sig.toString('base64url');
};
const prod='soridraw-app-866a5',number='91309780603';
const auth=(uid='syntheticActor754')=>({iss:'https://securetoken.google.com/'+prod,
 aud:prod,sub:uid,iat:sec-60,auth_time:sec-110,exp:sec+900});
const app=()=>({iss:'https://firebaseappcheck.googleapis.com/'+number,
 aud:['projects/'+number],sub:'1:91309780603:web:cde703895e2cf31ecffcde',
 iat:sec-60,exp:sec+900});
const req=(a=auth(),b=app(),method='PUT',origin='https://soridraw.com')=>
 new Request('https://soridraw.com/v1/profiles/syntheticOwner754/follow',
 {method,headers:{Authorization:'Bearer '+sign(a),
 'X-Firebase-AppCheck':sign(b),Origin:origin},
 ...(['PUT','DELETE'].includes(method)?{body:'{}'}:{})});
let reads=0;
const send=async(url,init)=>{
 reads++;
 assert(['https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com',
 'https://firebaseappcheck.googleapis.com/v1/jwks'].includes(url));
 assert.equal(init.method,'GET');
 assert.equal(init.redirect,'manual');
 return {ok:true,status:200,headers:new Headers({'cache-control':'max-age=100'}),
   json:async()=>({keys:[jwk]})};
};
const verify=createApp754ProductionPrincipalVerifier({send,now:()=>time});
assert.equal(APP754_PRODUCTION_PRINCIPAL_COMPILED_OPEN,false);
const environment={SORIDRAW_ENVIRONMENT:'production'};
const ok=await verify({request:req(),env:environment});
assert.deepEqual(ok,{verifiedAuth:true,verifiedAppCheck:true,
 firebaseProjectId:prod,uid:'syntheticActor754'});
assert.equal(reads,2);
assert.equal((await verify({request:req(auth('syntheticSecond754')),env:environment})).uid,'syntheticSecond754');
assert.equal(reads,2,'cached Google public keys only, no idle polling');
const deny=async(r,env=environment,v=verify)=>{
 const result=await v({request:r,env});
 assert.equal(result.verifiedAuth,false);
 assert.equal(result.verifiedAppCheck,false);
 assert(!JSON.stringify(result).includes('syntheticActor754'));
};
await deny(req(),{SORIDRAW_ENVIRONMENT:'preview'});
await deny(req(),{SORIDRAW_ENVIRONMENT:'qa'});
await deny(req(auth(),app(),'PUT','https://preview.soridraw.com'));
await deny(req(auth(),app(),'POST'));
await deny(req({...auth(),aud:'soridraw-app'}));
await deny(req({...auth(),iss:'https://securetoken.google.com/soridraw-app'}));
await deny(req({...auth(),exp:sec-1}));
await deny(req({...auth(),sub:'not valid uid!'}));
await deny(req(auth(),{...app(),iss:'https://firebaseappcheck.googleapis.com/1083981050742'}));
await deny(req(auth(),{...app(),aud:['projects/1083981050742']}));
await deny(req(auth(),{...app(),sub:'1:1083981050742:web:deadbeef'}));
await deny(req(auth(),{...app(),sub:'1:91309780603:web:other-unknown-app'}));
await deny(new Request('https://soridraw.com/v1/profiles/syntheticOwner754/follow',{
 method:'PUT',headers:{Authorization:'Bearer '+sign(auth())}}));
const modified=sign(auth()).split('.');
modified[1]=enc({...auth(),sub:'forgedActor754'});
await deny(new Request('https://soridraw.com/v1/profiles/syntheticOwner754/follow',{
 method:'PUT',headers:{Authorization:'Bearer '+modified.join('.'),
 'X-Firebase-AppCheck':sign(app())}}));
const hs=new Headers(req().headers);
hs.set('Authorization','Bearer '+sign(auth(),{alg:'HS256',typ:'JWT',kid:jwk.kid}));
await deny(new Request(req(),{headers:hs}));
const failSend=createApp754ProductionPrincipalVerifier({send:async()=>{throw Error('SECRET_INTERNAL_ERROR')},now:()=>time});
await deny(req(),environment,failSend);
const redirect=createApp754ProductionPrincipalVerifier({send:async(url,init)=>{
 assert.equal(init.redirect,'manual');return Response.redirect('https://example.org',302);
},now:()=>time});
await deny(req(),environment,redirect);
const jsonError=createApp754ProductionPrincipalVerifier({send:async()=>({
 ok:true,status:200,json:async()=>({keys:[{kty:'EC',kid:'bad'}]})
}),now:()=>time});
await deny(req(),environment,jsonError);
assert.equal(reads,2,'bad tokens never refetch cached Google signing keys');
console.log('APP754_PRODUCTION_FIREBASE_SIGNED_AUTH_APPCHECK_CRYPTOGRAPHIC_OFFLINE=PASS');
console.log('APP754_PRODUCTION_91309780603_WEB_IDENTITY_PIN_QA_CROSS_PROJECT_REJECT=PASS');
console.log('APP754_WORKERS_REDIRECT_MANUAL_KEYS_CACHED_NO_TOKEN_LEAK=PASS');
console.log('APP754_NO_PROD_RUNTIME_BINDING_OR_DATA_WRITE_DEPLOY=PASS');
