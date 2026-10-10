
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
const dir=await mkdtemp(join(tmpdir(),'soridraw-split-'));
let server,browser;
try {
 await build({entryPoints:['scripts/fixtures/394-split-drag-entry.tsx'],
  bundle:true,format:'esm',platform:'browser',splitting:true,
  jsx:'automatic',target:'es2020',outdir:dir,entryNames:'main',logLevel:'error'});
 await writeFile(join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/main.css"/></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>');
 server=createServer(async(req,res)=>{
  const name=(req.url||'/').split('?')[0].replace(/^\/+/,'')||'index.html';
  const f=resolve(dir,name);
  if(!f.startsWith(dir+'/') && f!==join(dir,'index.html')){res.writeHead(403);res.end();return}
  try{const buf=await readFile(f);res.writeHead(200,{'Content-Type':extname(f)==='.css'?'text/css':extname(f)==='.js'?'text/javascript':'text/html'});res.end(buf)}
  catch{res.writeHead(404);res.end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const bin=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(existsSync);
 assert.ok(bin,'Chrome unavailable');
 browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const profile of [{name:'pc',width:1800,height:940},{name:'tablet-emulated',width:1280,height:900}]) {
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.__splitLongTasks=[];
   try{new PerformanceObserver(list=>{for(const t of list.getEntries())window.__splitLongTasks.push(t.duration)})
   .observe({type:'longtask',buffered:false})}catch{}
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load',timeout:25000});
  const divider=page.locator('.soridraw-lite-studio-splitter');
  await divider.waitFor({state:'visible',timeout:15000});
  const sample=()=>page.evaluate(()=>{
   const a=document.querySelector('[data-soridraw-lite-pane="builder"]').getBoundingClientRect();
   const b=document.querySelector('[data-soridraw-lite-pane="result"]').getBoundingClientRect();
   const c=document.querySelector('.soridraw-lite-studio-splitter').getBoundingClientRect();
   return {builderWidth:Math.round(a.width),resultWidth:Math.round(b.width),
    gap:Math.round(b.left-a.right),splitterX:Math.round(c.left+c.width/2),
    scrollBuilder:document.querySelector('#builder-list').scrollTop,
    scrollResult:document.querySelector('#result-list').scrollTop,
    dragActive:document.documentElement.classList.contains('soridraw-lite-split-dragging')};
  });
  const before=await sample();
  const scroll=await page.evaluate(()=>{
   document.querySelector('#builder-list').scrollTop=260;
   document.querySelector('#result-list').scrollTop=330;
   return {builder:document.querySelector('#builder-list').scrollTop,result:document.querySelector('#result-list').scrollTop}
  });
  const box=await divider.boundingBox();
  assert.ok(box && box.width>0,'Missing real splitter '+profile.name);
  const sx=box.x+box.width/2, sy=Math.max(box.y+10,Math.min(box.y+box.height/2,profile.height-100));
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move(sx+(profile.name==='pc'?140:70),sy,{steps:18});
  await page.waitForTimeout(70);
  const during=await sample();
  await page.mouse.up();
  await page.waitForTimeout(320);
  const after=await sample();
  const longs=await page.evaluate(()=>window.__splitLongTasks||[]);
  const sorted=[...longs].sort((a,b)=>a-b);
  console.log('APP394_SPLIT_CHROME='+JSON.stringify({device:profile.name,before,during,after,
   longTaskCount:longs.length,longTaskP95Ms:sorted.length?Math.round(sorted[Math.ceil(sorted.length*.95)-1]):0,
   errors}));
  assert.ok(Math.abs(after.builderWidth-before.builderWidth)>8,profile.name+' drag did not move the real pane');
  assert.ok(Math.abs(after.builderWidth-during.builderWidth)<35,profile.name+' release snap');
  assert.ok(Math.abs(after.scrollBuilder-scroll.builder)<6 && Math.abs(after.scrollResult-scroll.result)<6,
   profile.name+' scroll drift');
  assert.deepEqual(errors,[],profile.name+' browser JS error');
  await context.close();
 }
 console.log('APP394_SPLIT_ISOLATED=PASS profiles=2');
 console.log('APP394_REAL_TOUCH_AND_AUTH_STUDIO=NOT_TESTED');
} finally {
 if(browser) await browser.close();
 if(server) await new Promise(done=>server.close(done));
 await rm(dir,{recursive:true,force:true});
}
