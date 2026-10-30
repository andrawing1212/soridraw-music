// app518 INACTIVE trusted Firebase exact-source fetcher for a future
// server-only Cloudflare Worker route. No browser URL or user-supplied host.
// No page-open calls, no multiple favorites scan. HTTPS + HMAC secret needed.
// URL and secret remain unconfigured in all three deployed environments.
const txt=x=>typeof x==='string'?x.trim():'';
const hex=array=>[...new Uint8Array(array)].map(x=>x.toString(16).padStart(2,'0')).join('');
const valid=x=>txt(x).length>0&&txt(x).length<=240&&!/[\\/]/.test(txt(x));
// Server-verified 409 owner/receipt/schema violations are not retryable IO.
// Delayed missing hard-delete receipt is intentionally NOT terminal: the
// authenticated delete trigger may still be committing that receipt.
export class CatalogFirebaseSourceHold518 extends Error {
 constructor(code){super('APP518_EXACT_SOURCE_TERMINAL');this.name='CatalogFirebaseSourceHold518';this.code=code;}
}
export const createExactFirebaseFetcher518=({
 sourceUrl,expectedHostname,secret,fetcher=fetch,clock=Date.now,
}={})=>{
 let url;
 try{url=new URL(sourceUrl);}catch{return null;}
 if(url.protocol!=='https:'||url.hostname!==expectedHostname
   ||url.username||url.password||url.search||url.hash||url.port
   ||!txt(url.pathname).startsWith('/'))
   return null;
 if(typeof secret!=='string'||new TextEncoder().encode(secret).length<32
   ||typeof fetcher!=='function'||typeof clock!=='function')return null;
 return async(uid,documentId)=>{
  if(!valid(uid)||uid.length>128||!valid(documentId))
   throw new CatalogFirebaseSourceHold518('DENY_BAD_EXACT_ID');
  const time=String(clock());
  if(!/^\d{13}$/.test(time))
   throw new CatalogFirebaseSourceHold518('DENY_BAD_SERVER_CLOCK');
  const body=JSON.stringify({action:'exact-source',uid,documentId});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=hex(await crypto.subtle.sign('HMAC',key,
   new TextEncoder().encode(time+'\n'+body)));
  const response=await fetcher(url.href,{method:'POST',
   headers:{'content-type':'application/json',
    'x-soridraw-server-time-518':time,
    'x-soridraw-server-signature-518':signature},
   body,redirect:'error',
  });
  if(response?.status===409){
   let body;
   try{body=await response.json();}catch{
    throw new CatalogFirebaseSourceHold518('DENY_CORRUPT_SOURCE_CONFLICT');
   }
   const code=txt(body?.code);
   if(code==='HOLD_NO_HARD_DELETE_RECEIPT')
    throw new Error('APP518_EXACT_SOURCE_UNAVAILABLE');
   if(/^(DENY|HOLD)_[A-Z0-9_]{1,90}$/.test(code))
    throw new CatalogFirebaseSourceHold518(code);
   throw new CatalogFirebaseSourceHold518('DENY_UNRECOGNIZED_SOURCE_CONFLICT');
  }
  if(!response||response.status!==200)
   throw new Error('APP518_EXACT_SOURCE_UNAVAILABLE');
  let data;
  try{data=await response.json();}catch{
   throw new CatalogFirebaseSourceHold518('DENY_INVALID_SOURCE_RESPONSE');
  }
  const source=data?.source;
  if(data?.code!=='SOURCE_VERIFIED'||source?.verifiedByServer!==true
    ||source.uid!==uid||source.documentId!==documentId
    ||!['saved','removed'].includes(source.state)
    ||typeof source.updateTime!=='string')
   throw new CatalogFirebaseSourceHold518('DENY_SOURCE_OWNER_OR_STATE_MISMATCH');
  return source;
 };
};
