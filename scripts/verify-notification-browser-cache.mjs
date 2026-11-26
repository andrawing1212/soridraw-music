// Real Chromium, synthetic HTTPS routes only; no cloud account/data/credentials.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.NOTIFICATION_PLAYWRIGHT_ENTRY).href);
const entry=await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import Image from './src/components/studio/NotificationCacheableImage';
import {createNotificationImageCache} from './src/services/notifications/notificationImageCache.mjs';
const cache=createNotificationImageCache();
let active='A';
let off=cache.attach(active,document,()=>active==='A');
const root=createRoot(document.getElementById('root'));
window.mount=(url)=>root.render(React.createElement('div',{className:'soridraw-explore-cover-wrap'},React.createElement(Image,{src:url,alt:'test'})));
window.restore=async(url)=>{const c=document.createElement('canvas');c.width=c.height=64;return cache.drawStored(active,[url],c,()=>true)};
window.switchAccount=()=>{off();active='B';off=cache.attach('B',document,()=>active==='B')};
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const js=entry.outputFiles[0].text;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 const page=await context.newPage();
 const app='https://notification-app.example.test/', cdn='https://notification-cdn.example.test/';
 let requests=0;
 await context.route(app,route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/bundle.js"></script>'}));
 await context.route(app+'bundle.js',route=>route.fulfill({contentType:'application/javascript',body:js}));
 await context.route(cdn+'**',route=>{
  requests++;
  const cors=route.request().url().endsWith('allowed.svg');
  return route.fulfill({contentType:'image/svg+xml',headers:cors?{'access-control-allow-origin':'*','cache-control':'no-store'}:{'access-control-allow-origin':'https://unrelated.example.test','cache-control':'no-store'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="red"/></svg>'});
 });
 await page.goto(app);
 await page.evaluate(url=>window.mount(url),cdn+'allowed.svg');
 await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===128);
 await page.waitForFunction(async url=>await window.restore(url),cdn+'allowed.svg',{timeout:10000});
 assert.equal(requests,1,'CORS-capable normal display uses exactly one image request');
 await page.reload();
 await page.waitForFunction(()=>typeof window.restore==='function');
 assert.equal(await page.evaluate(url=>window.restore(url),cdn+'allowed.svg'),true,'reload restores actual IndexedDB bitmap without source DOM');
 assert.equal(requests,1,'reload and local restore must not download image');
 await page.evaluate(()=>window.switchAccount());
 assert.equal(await page.evaluate(url=>window.restore(url),cdn+'allowed.svg'),false,'account B cannot see A cache');
 // Explicit mismatched ACAO: Playwright route.fulfill may synthesize ACAO for omitted headers.
 const beforeDenied=requests;
 await page.evaluate(url=>window.mount(url),cdn+'denied.svg');
 await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===128&&document.querySelector('img')?.crossOrigin===null);
 assert.equal(requests-beforeDenied,2,'one denied CORS attempt, one original image fallback');
 assert.equal(await page.evaluate(url=>window.restore(url),cdn+'denied.svg'),false,'opaque image not persisted');
 console.log('NOTIFICATION_REAL_CHROMIUM_CORS_IDB_RELOAD_ACCOUNT_AND_FALLBACK=PASS');
}finally{await browser.close()}
