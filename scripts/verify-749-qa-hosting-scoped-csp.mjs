import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{join}from'node:path';import{tmpdir}from'node:os';
import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{qa749ScopedCsp,runApp749QaScopedCsp}from'./app749-qa-hosting-scoped-csp.mjs';
const html=readFileSync('qa/app749/qa749.html','utf8');
const css=readFileSync('qa/app749/qa749.css','utf8');
const js=readFileSync('qa/app749/qa749.js','utf8');
const temporary=mkdtempSync(join(tmpdir(),'qa749-csp-live-'));
try{
 const file=join(temporary,'qa749.mjs');
 writeFileSync(file,js);execFileSync(process.execPath,['--check',file]);
}finally{rmSync(temporary,{recursive:true,force:true})}
assert(html.includes('<style>')&&html.includes('src="/qa749.js"'));
assert(!html.includes('<script type="module">'));
assert(js.includes("fetch('/qa749-config.json'"));
assert(!js.includes("for(const url of ['/__/firebase/init.json'"));
const policy="default-src 'none'; script-src 'self' https://www.gstatic.com https://*.asia-southeast1.firebasedatabase.app; style-src 'unsafe-inline'; connect-src https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app wss://soridraw-qa-sg.asia-southeast1.firebasedatabase.app https://*.asia-southeast1.firebasedatabase.app wss://*.asia-southeast1.firebasedatabase.app";
const scoped=qa749ScopedCsp(policy);
assert(scoped.includes("default-src 'none'"));
assert(scoped.includes("style-src 'unsafe-inline'"));
assert(scoped.includes("connect-src https://identitytoolkit.googleapis.com"));
assert(scoped.includes(" 'self' https://firebaseappcheck.googleapis.com"));
assert(scoped.includes('https://soridraw-owner-qa-583.soridraw-qa.workers.dev'));
assert(scoped.includes('frame-src https://www.google.com/recaptcha/'));
assert(scoped.includes('script-src'));
assert(!scoped.includes("'unsafe-eval'"));
assert(!scoped.includes("https://soridraw.com"));
await assert.rejects(async()=>qa749ScopedCsp("default-src *; connect-src *; script-src *; style-src *"),/QA_CSP_DEFAULT_DRIFT/);
const c={apiKey:'AIza'+'b'.repeat(35),appId:'1:1083981050742:web:aabbcc',
 projectId:'soridraw-app',authDomain:'soridraw-app.firebaseapp.com',
 messagingSenderId:'1083981050742',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'};
const sha=s=>createHash('sha256').update(gzipSync(Buffer.from(s),{level:9,mtime:0})).digest('hex');
const oldJs=String.raw