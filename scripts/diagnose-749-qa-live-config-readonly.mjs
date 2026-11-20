// APP749 QA584 real HTTP READ-ONLY diagnostics (no writes, auth, or tokens).
// All responses are inspected in memory; never print Firebase apiKey or Web App ID.
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
const base='https://soridraw-qa-owner-584.web.app';
const expected={
 '/qa749.html':readFileSync('qa/app749/qa749.html','utf8'),
 '/qa749.js':readFileSync('qa/app749/qa749.js','utf8'),
 '/qa749.css':readFileSync('qa/app749/qa749.css','utf8'),
};
const paths=['/qa749.html','/qa749.js','/qa749.css',
 '/qa749-config.json','/__/firebase/init.json'];
const sha=s=>createHash('sha256').update(s).digest('hex');
const number='1083981050742';
let results=[];
for(const path of paths){
 let r;
 try{r=await fetch(base+path,{
   redirect:'manual',headers:{'Accept':path.endsWith('.json')?'application/json':'text/plain',
    'Cache-Control':'no-store'},signal:AbortSignal.timeout(12000)
  })}catch(e){
   const code=String(e?.cause?.code??e?.name??'ERROR').replace(/[^A-Z0-9_]/gi,'').slice(0,50);
   console.log('APP749_QA_LIVE_GET '+path+' NETWORK_'+code);
   results.push({path,status:null});continue;
 }
 let body='';try{body=await r.text()}catch{
   console.log('APP749_QA_LIVE_GET '+path+' BODY_READ_ERROR');continue;
 }
 const info={path,status:r.status,mime:(r.headers.get('content-type')||'').split(';')[0],
   bytes:new TextEncoder().encode(body).length};
 if(path==='/qa749.html'){
   const header=r.headers.get('content-security-policy')||'';
   const directives=Object.fromEntries(header.split(';')
     .map(x=>x.trim()).filter(Boolean)
     .map(x=>{const tokens=x.split(/\s+/);return[tokens[0],tokens.slice(1).join(' ')];})
     .filter(([name])=>['default-src','connect-src','script-src','script-src-elem',
       'style-src','style-src-elem'].includes(name)));
   console.log('APP749_QA_LIVE_PAGE_CSP '+JSON.stringify({
     hasCsp:header.length>0,directives}));
 }
 if(expected[path]!==undefined){
   info.matchesRepo=sha(expected[path])===sha(body);
   info.isHTML=path.endsWith('.html')?body.includes('QA Firebase 연결'):undefined;
   info.jsConfigFallback=path.endsWith('.js')?body.includes('/qa749-config.json'):undefined;
 }
 if(path.endsWith('.json')){
  try{
   const d=JSON.parse(body);
   info.jsonValid=true;
   info.projectMatches=d?.projectId==='soridraw-app';
   info.numberMatches=String(d?.messagingSenderId)===number;
   info.appIdFormat=typeof d?.appId==='string'&&
    /^1:1083981050742:web:[A-Za-z0-9]+$/.test(d.appId);
   info.apiKeyPresent=typeof d?.apiKey==='string'&&d.apiKey.length>20;
   info.authDomainMatches=d?.authDomain==='soridraw-app.firebaseapp.com';
   info.databaseAllowed=!(d?.databaseURL)&&true||
    d?.databaseURL==='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
   info.userCanAutoConnect=info.projectMatches&&info.numberMatches&&
    info.appIdFormat&&info.apiKeyPresent&&info.authDomainMatches&&info.databaseAllowed;
  }catch{info.jsonValid=false;}
 }
 // Public flags and statuses only. NEVER output the response body, API key or app ID.
 console.log('APP749_QA_LIVE_GET '+path+' '+JSON.stringify(info));
 results.push(info);
}
const files=results.filter(x=>Object.hasOwn(expected,x.path));
const config=results.find(x=>x.path==='/qa749-config.json');
if(files.every(x=>x.status===200&&x.matchesRepo===true)){
 console.log('APP749_QA_LIVE_BROWSER_SOURCE_SAME_AS_MAIN=PASS');
}else console.log('APP749_QA_LIVE_BROWSER_SOURCE_SAME_AS_MAIN=FAIL');
if(config?.status===200&&config?.userCanAutoConnect===true){
 console.log('APP749_QA_LIVE_FALLBACK_CONFIG_VALID=PASS');
}else console.log('APP749_QA_LIVE_FALLBACK_CONFIG_VALID=FAIL');
console.log('APP749_QA_LIVE_DIAG_NO_WRITE_NO_AUTH=PASS');
