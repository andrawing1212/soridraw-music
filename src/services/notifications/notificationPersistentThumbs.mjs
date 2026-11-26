// Bounded device-local derivative only. Never download images.
export const THUMB_SIZE=96, THUMB_BYTES=5000, THUMB_COUNT=1000, THUMB_BUDGET=5000000;
const DB_NAME='soridraw-notification-thumbs-v1';
const safeBlob=b=>b?.type==='image/webp'&&Number.isSafeInteger(b.size)&&b.size>0&&b.size<=THUMB_BYTES;
export function encodeNotificationThumb(canvas){
 return new Promise(resolve=>{
  const qualities=[.48,.32,.18,.08];let i=0;
  const attempt=()=>{
   if(i>=qualities.length){resolve(null);return}
   try{canvas.toBlob(blob=>{
    if(safeBlob(blob)){resolve(blob);return}
    if(blob?.type==='image/webp'&&blob.size>THUMB_BYTES){attempt();return}
    resolve(null);
   },'image/webp',qualities[i++])}catch{resolve(null)}
  };
  if(typeof canvas?.toBlob!=='function'){resolve(null);return}
  attempt();
 });
}
export function createNotificationPersistentThumbs(win){
 let opening=null,closed=false;
 const pending=new Set();
 // Do not persist signed URL text or use another account's local pixels.
 const keyFor=async(uid,url)=>{
  try{
   const hash=await win.crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
   return JSON.stringify([uid,Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')]);
  }catch{return ''}
 };
 const open=()=>{
  if(closed||!win?.indexedDB)return Promise.resolve(null);
  if(opening)return opening;
  opening=new Promise(resolve=>{
   try{
    const req=win.indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
     const db=req.result;
     const store=db.createObjectStore('thumbs',{keyPath:'key'});
     store.createIndex('usedAt','usedAt');
     db.createObjectStore('meta');
    };
    req.onerror=()=>resolve(null);
    req.onblocked=()=>resolve(null);
    req.onsuccess=()=>{
     const db=req.result;if(closed){db.close();resolve(null);return}
     db.onversionchange=()=>{db.close();opening=null};resolve(db)
    };
   }catch{resolve(null)}
  });
  return opening;
 };
 const read=async(key,touch=false)=>{
  if(!key)return null;
  const db=await open();if(!db||closed)return null;
  return new Promise(resolve=>{
   try{
    const tx=db.transaction('thumbs',touch?'readwrite':'readonly');
    const store=tx.objectStore('thumbs');const req=store.get(key);
    let value=null;
    req.onsuccess=()=>{
     const row=req.result;if(!safeBlob(row?.blob))return;
     value=row.blob;
     if(touch&&Date.now()-row.usedAt>3600000)store.put({...row,usedAt:Date.now()});
    };
    tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>resolve(null);
   }catch{resolve(null)}
  });
 };
 const write=async(key,blob,current)=>{
  if(!key||!safeBlob(blob)||closed||!current())return false;
  const db=await open();if(!db||closed||!current())return false;
  return new Promise(resolve=>{
   try{
    const tx=db.transaction(['thumbs','meta'],'readwrite');
    const store=tx.objectStore('thumbs'),meta=tx.objectStore('meta');
    const total=meta.get('totals'),existing=store.get(key);
    let done=0;
    const start=()=>{
     if(++done!==2)return;
     if(closed||!current()){tx.abort();return}
     const before=existing.result;
     const info=total.result||{count:0,bytes:0};
     if(before&&safeBlob(before.blob))return;
     if(before){tx.abort();return}
     let count=info.count+1,bytes=info.bytes+blob.size;
     store.put({key,blob,usedAt:Date.now(),bytes:blob.size});
     const finish=()=>meta.put({count,bytes},'totals');
     if(count<=THUMB_COUNT&&bytes<=THUMB_BUDGET){finish();return}
     const cursor=store.index('usedAt').openCursor();
     cursor.onsuccess=()=>{
      if(closed||!current()){tx.abort();return}
      const item=cursor.result;
      if(count<=THUMB_COUNT&&bytes<=THUMB_BUDGET){finish();return}
      if(!item){tx.abort();return}
      count--;bytes-=item.value.bytes;item.delete();item.continue();
     };
    };
    total.onsuccess=existing.onsuccess=start;
    tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false);
   }catch{resolve(false)}
  });
 };
 const remember=async(uid,url,canvas,current)=>{
  if(closed||!win?.indexedDB||!current())return false;
  const key=await keyFor(uid,url);
  if(!key||closed||!current()||pending.has(key)||pending.size>=64)return false;
  pending.add(key);
  try{
   if(await read(key)||closed||!current())return false;
   const blob=await encodeNotificationThumb(canvas);
   return !!blob&&await write(key,blob,current);
  }catch{return false}finally{pending.delete(key)}
 };
 const restore=async(uid,url)=>{
  if(closed||!win?.indexedDB)return null;
  const key=await keyFor(uid,url);
  const blob=await read(key,true);
  if(!blob||closed||typeof win?.createImageBitmap!=='function')return null;
  try{return await win.createImageBitmap(blob)}catch{return null}
 };
 const close=()=>{closed=true;void opening?.then(db=>db?.close())};
 return {remember,restore,close};
}
