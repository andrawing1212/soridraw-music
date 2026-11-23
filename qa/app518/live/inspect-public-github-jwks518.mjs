// Inspect ONLY GitHub public RSA signing keys. Never request an ID token,
// account credential, Cloudflare secret, or user data.
const url='https://token.actions.githubusercontent.com/.well-known/jwks';
const r=await fetch(url,{method:'GET',redirect:'error',
 headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
if(r.status!==200)throw Error('HOLD_QA_PUBLIC_JWKS_HTTP_'+r.status);
const d=await r.json();
if(!Array.isArray(d?.keys)||d.keys.length<1||d.keys.length>20)
 throw Error('HOLD_QA_PUBLIC_JWKS_UNEXPECTED');
const keys=d.keys.filter(x=>x.kty==='RSA'&&x.alg==='RS256'
 &&x.use==='sig'&&/^[A-Za-z0-9_-]+$/.test(x.n||'')
 &&x.e==='AQAB'&&/^[A-Za-z0-9:-]{1,128}$/.test(x.kid||''))
 .map(x=>({kid:x.kid,kty:x.kty,alg:x.alg,use:x.use,n:x.n,e:x.e}));
if(keys.length<1||keys.length>10)throw Error('HOLD_QA_NO_RSA_PUBLIC_KEYS');
console.log('APP518_QA_OFFICIAL_JWKS_PUBLIC_KEYS='+JSON.stringify(keys));
console.log('APP518_QA_PUBLIC_KEY_ONLY_NO_TOKEN_OR_SECRET=PASS');
