// APP749: pinned independent QA Firebase Auth + App Check JWT gate.
// App Check's raw signed JWT has sub=appId; app_id is added by the
// Firebase Admin SDK as a convenience and is NOT a raw JWT claim.
// Only for the existing QA Firebase project. Public verification keys only;
// never accepts client UID, QA probe secret, or an unsigned claim as identity.
// No Admin credentials, Firestore/RTDB access or production connections.
const PROJECT='soridraw-app';
const NUMBER='1083981050742';
const AUTH_JWKS='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const APP_JWKS='https://firebaseappcheck.googleapis.com/v1/jwks';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const APP_ID=/^1:1083981050742:(?:web|android|ios):[A-Za-z0-9]+$/;
const TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
// QA-only sanitized failure stage. Never include token, key ID, UID or claims.
const fail=(qaStage='CREDENTIALS_REJECTED')=>{
  const error=Error('APP749_QA_SIGNED_CREDENTIALS_REQUIRED');
  error.qaStage=qaStage;
  throw error;
};
function parsePart(s,stage='CREDENTIALS_REJECTED'){
  if(typeof s!=='string'||s.length>12000||!s.length)fail(stage);
  let value;
  try{
    const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
    value=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded),c=>c.charCodeAt(0))));
  }catch{fail(stage)}
  return value;
}
function bytes(s,stage='CREDENTIALS_REJECTED'){
  try{
    const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
    return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
  }catch{fail(stage)}
}
function claimsValid(x,time,auth){
  if(!x||typeof x!=='object'||!Number.isSafeInteger(x.iat)||x.iat<=0||
      !Number.isSafeInteger(x.exp)||x.exp<=time||x.exp<=x.iat||x.iat>time+30||
      (x.nbf!==undefined&&(!Number.isSafeInteger(x.nbf)||x.nbf>time+30)))return false;
  if(auth)return x.aud===PROJECT&&x.iss==='https://securetoken.google.com/'+PROJECT&&
    UID.test(x.sub||'')&&Number.isSafeInteger(x.auth_time)&&
    x.auth_time>0&&x.auth_time<=time+30;
  return x.iss==='https://firebaseappcheck.googleapis.com/'+NUMBER&&
    Array.isArray(x.aud)&&x.aud.includes('projects/'+NUMBER)&&
    APP_ID.test(x.sub||'');
}
const AUTH_FAILURE_STAGES=Object.freeze([
  'AUTH_TOKEN_FORMAT','AUTH_PUBLIC_KEYS','AUTH_KID_MISMATCH',
  'AUTH_SIGNATURE','AUTH_CLAIMS',
]);
export function createQaFirebaseVerifier749({send=fetch,now=Date.now,subtle=globalThis.crypto?.subtle}={}){
  const cache=new Map();
  async function keys(endpoint,stage){
    const previous=cache.get(endpoint);
    if(previous&&now()<previous.expires)return previous.keys;
    let res;
    try{
      res=await send(endpoint,{method:'GET',redirect:'error',
        headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    }catch{fail(stage)}
    if(!res?.ok||res.status!==200)fail(stage);
    let json;
    try{json=await res.json()}catch{fail(stage)}
    if(!Array.isArray(json?.keys)||json.keys.length<1||json.keys.length>30)
      fail(stage);
    const usable=json.keys.filter(k=>k?.kty==='RSA'&&k?.n&&k?.e&&
      /^[A-Za-z0-9_-]{1,256}$/.test(k?.kid||'')&&
      (!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
    if(!usable.length)fail(stage);
    const maxAge=/\bmax-age=(\d+)\b/i.exec(res.headers?.get('cache-control')||'');
    const ttl=Math.min(21600,Math.max(0,Number(maxAge?.[1]||300)));
    cache.set(endpoint,{keys:usable,expires:now()+ttl*1000});
    return usable;
  }
  async function checkJwt(token,endpoint,auth){
    const code=suffix=>(auth?'AUTH_':'APPCHECK_')+suffix;
    if(!subtle||typeof token!=='string'||token.length>12000||
      token.length<90||!TOKEN.test(token))fail(code('TOKEN_FORMAT'));
    const [a,b,sig]=token.split('.');
    const head=parsePart(a,code('TOKEN_FORMAT'));
    if(head?.alg!=='RS256'||head?.typ!=='JWT'||
      !/^[A-Za-z0-9_-]{1,256}$/.test(head.kid||'')||
      head.jku!==undefined||head.x5u!==undefined||head.crit!==undefined)
      fail(code('TOKEN_FORMAT'));
    const pub=(await keys(endpoint,code('PUBLIC_KEYS'))).find(k=>k.kid===head.kid);
    if(!pub)fail(code('KID_MISMATCH'));
    let valid=false;
    try{
      const key=await subtle.importKey('jwk',pub,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
      valid=await subtle.verify('RSASSA-PKCS1-v1_5',key,
        bytes(sig,code('SIGNATURE')),new TextEncoder().encode(a+'.'+b));
    }catch{fail(code('SIGNATURE'))}
    if(!valid)fail(code('SIGNATURE'));
    const payload=parsePart(b,code('CLAIMS'));
    if(!claimsValid(payload,Math.floor(now()/1000),auth))fail(code('CLAIMS'));
    return payload;
  }
  // Return only the verified uid, never return token bytes or untrusted claims.
  return async function verify(request,{actorUid,ownerUid,method,path}={}){
    const bearer=request?.headers?.get('Authorization')||'';
    const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(bearer);
    const appCheck=request?.headers?.get('X-Firebase-AppCheck');
    if(!match||!appCheck||!UID.test(actorUid||'')||
      !UID.test(ownerUid||'')||actorUid===ownerUid||
      !['GET','PUT','DELETE'].includes(method)||
      !['status','follow'].includes(path)||
      (path==='status'&&method!=='GET')||
      (path==='follow'&&method==='GET')||request.method!==method||
      new URL(request.url).pathname!=='/qa730/verified/'+path)fail('REQUEST_INVALID');
    let auth;
    try{auth=await checkJwt(match[1],AUTH_JWKS,true)}
    catch(error){
      fail(AUTH_FAILURE_STAGES.includes(error?.qaStage)
        ?error.qaStage:'AUTH_VALIDATION');
    }
    try{await checkJwt(appCheck,APP_JWKS,false)}
    catch{fail('APPCHECK_VALIDATION')}
    if((path==='status'&&auth.sub!==actorUid&&auth.sub!==ownerUid)||
       (path==='follow'&&auth.sub!==actorUid))fail('PRINCIPAL_MISMATCH');
    return {verified:true,uid:auth.sub,qaProject:PROJECT};
  };
}
