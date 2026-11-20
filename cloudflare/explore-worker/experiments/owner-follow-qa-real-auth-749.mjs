// APP749: pinned independent QA Firebase Auth + App Check JWT gate.
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
const fail=()=>{throw Error('APP749_QA_SIGNED_CREDENTIALS_REQUIRED')};
function parsePart(s){
  if(typeof s!=='string'||s.length>12000||!s.length)fail();
  try{
    const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded),c=>c.charCodeAt(0))));
  }catch{fail()}
}
function bytes(s){
  try{
    const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
    return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
  }catch{fail()}
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
    APP_ID.test(x.sub||'')&&x.app_id===x.sub;
}
export function createQaFirebaseVerifier749({send=fetch,now=Date.now,subtle=globalThis.crypto?.subtle}={}){
  const cache=new Map();
  async function keys(endpoint){
    const previous=cache.get(endpoint);
    if(previous&&now()<previous.expires)return previous.keys;
    const res=await send(endpoint,{method:'GET',redirect:'error',
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!res?.ok||res.status!==200)fail();
    const json=await res.json();
    if(!Array.isArray(json?.keys)||json.keys.length<1||json.keys.length>30)fail();
    const usable=json.keys.filter(k=>k?.kty==='RSA'&&k?.n&&k?.e&&
      /^[A-Za-z0-9_-]{1,256}$/.test(k?.kid||'')&&
      (!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
    if(!usable.length)fail();
    const maxAge=/\bmax-age=(\d+)\b/i.exec(res.headers?.get('cache-control')||'');
    const ttl=Math.min(21600,Math.max(0,Number(maxAge?.[1]||300)));
    cache.set(endpoint,{keys:usable,expires:now()+ttl*1000});
    return usable;
  }
  async function checkJwt(token,endpoint,auth){
    if(!subtle||typeof token!=='string'||token.length>12000||
      token.length<90||!TOKEN.test(token))fail();
    const [a,b,sig]=token.split('.');
    const head=parsePart(a);
    if(head?.alg!=='RS256'||head?.typ!=='JWT'||
      !/^[A-Za-z0-9_-]{1,256}$/.test(head.kid||'')||
      head.jku!==undefined||head.x5u!==undefined||head.crit!==undefined)fail();
    const pub=(await keys(endpoint)).find(k=>k.kid===head.kid);
    if(!pub)fail();
    let valid=false;
    try{
      const key=await subtle.importKey('jwk',pub,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
      valid=await subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(sig),new TextEncoder().encode(a+'.'+b));
    }catch{fail()}
    if(!valid)fail();
    const payload=parsePart(b);
    if(!claimsValid(payload,Math.floor(now()/1000),auth))fail();
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
      new URL(request.url).pathname!=='/qa730/verified/'+path)fail();
    const auth=await checkJwt(match[1],AUTH_JWKS,true);
    await checkJwt(appCheck,APP_JWKS,false);
    if((path==='status'&&auth.sub!==actorUid&&auth.sub!==ownerUid)||
       (path==='follow'&&auth.sub!==actorUid))fail();
    return {verified:true,uid:auth.sub,qaProject:PROJECT};
  };
}
