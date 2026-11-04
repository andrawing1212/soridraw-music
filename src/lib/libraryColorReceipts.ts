// Per-UID, changed-color-only local receipts. An RTDB click preview is not
// Firestore authority, but a stale local Catalog must not erase the last
// explicitly observed color when the Library route/browser remounts.
// No server reads/writes, cache reset, or canonical data mutation.
export type LibraryColorReceiptColor = 'gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple';
export type LibraryColorReceiptScope = 'workspace'|'playlist';
export type LibraryColorReceiptChange = {scope:LibraryColorReceiptScope;key:string;color:LibraryColorReceiptColor};
export type LibraryColorReceipt = {color:LibraryColorReceiptColor;version:number;source:'local'|'remote'};
export const LIBRARY_COLOR_RECEIPT_CONFIRMED_EVENT='soridraw:library-color-receipt-confirmed-v1';
const PREFIX='soridraw.library.color-receipts.v1:';
const LIMIT=600;
const COLORS=new Set<string>(['gray','red','orange','yellow','green','blue','purple']);
const keyFor=(uid:string)=>PREFIX+encodeURIComponent(uid);
const valid=(key:string,value:any):value is LibraryColorReceipt=>
  key.length>0 && key.length<=350
  && (key.startsWith('workspace:') || key.startsWith('playlist:'))
  && value && COLORS.has(value.color)
  && Number.isSafeInteger(value.version) && value.version>0
  && (value.source==='local' || value.source==='remote');

export const readLibraryColorReceipts=(uid:string):Record<string,LibraryColorReceipt>=>{
  if(!uid || typeof localStorage==='undefined')return {};
  try{
    const raw=localStorage.getItem(keyFor(uid));
    const parsed=raw?JSON.parse(raw):null;
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))return {};
    const clean:Record<string,LibraryColorReceipt>={};
    for(const [key,value] of Object.entries(parsed).slice(0,LIMIT*2)){
      if(key==='__proto__' || key==='constructor' || !valid(key,value))continue;
      clean[key]={color:(value as LibraryColorReceipt).color,version:(value as LibraryColorReceipt).version,source:(value as LibraryColorReceipt).source};
    }
    return clean;
  }catch{return {};}
};
const write=(uid:string,entries:Record<string,LibraryColorReceipt>):void=>{
  try{
    const limited=Object.entries(entries).sort((a,b)=>b[1].version-a[1].version).slice(0,LIMIT);
    localStorage.setItem(keyFor(uid),JSON.stringify(Object.fromEntries(limited)));
  }catch(error){console.warn('[color] Library receipt persistence unavailable',error);}
};
// force=true means an observed new live event or an explicit local click;
// a retained RTDB snapshot never forces an older event over a newer receipt.
export const rememberLibraryColorReceipts=(
  uid:string,version:number,changes:LibraryColorReceiptChange[],
  source:'local'|'remote'='remote',force=false,
):LibraryColorReceiptChange[]=>{
  if(!uid || typeof localStorage==='undefined' || !Number.isFinite(version)||version<=0)return [];
  const next=readLibraryColorReceipts(uid);
  const accepted:LibraryColorReceiptChange[]=[];
  for(const entry of Array.isArray(changes)?changes:[]){
    if(!entry || !['workspace','playlist'].includes(entry.scope)
      || !entry.key?.startsWith(entry.scope+':') || entry.key.length>350
      || !COLORS.has(entry.color))continue;
    const older=next[entry.key];
    if(!force && older && older.version>=version)continue;
    if(older && older.version===version && older.color===entry.color && older.source===source)continue;
    next[entry.key]={color:entry.color,version:Math.floor(version),source};
    accepted.push(entry);
  }
  if(accepted.length)write(uid,next);
  return accepted;
};
// Only a genuinely fetched canonical Catalog row with the SAME explicit
// color can retire a workspace receipt. Missing fields do not mean gray.
export const confirmMatchingLibraryWorkspaceReceipts=(
  uid:string,items:any[],
):string[]=>{
  if(!uid || !Array.isArray(items) || !items.length)return [];
  const receipts=readLibraryColorReceipts(uid);
  const byId=new Map(items.map(item=>[String(item?.id||item?.trackId||''),item]));
  const confirmed:string[]=[];
  for(const [key,receipt] of Object.entries(receipts)){
    const match=/^workspace:(colorTags|favoriteColorTags):([^:]+):(\d+)$/.exec(key);
    if(!match)continue;
    const row=byId.get(match[2]);
    const map=row?.[match[1]];
    if(!map || typeof map!=='object' || Array.isArray(map)
      || !Object.prototype.hasOwnProperty.call(map,match[3]))continue;
    const canonical=map[match[3]]||'gray';
    if(canonical!==receipt.color)continue;
    delete receipts[key];
    confirmed.push(key);
  }
  if(confirmed.length)write(uid,receipts);
  return confirmed;
};
