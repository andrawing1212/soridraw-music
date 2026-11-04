// Click-only, per-UID, per-item durable intent. Writing an entry never
// contacts Firestore/RTDB; an ACK clears only the exact click token, so
// a slow earlier response cannot erase a later red -> gray -> red choice.
export type ColorPendingScope = 'musicNote'|'workspace'|'playlist';
export type PendingColorIntent = {key:string;color:string;token:string};
const colorPendingPrefix = (uid:string,scope:ColorPendingScope) =>
  `soridraw.color.pending.v1:${encodeURIComponent(uid)}:${scope}:`;
const COLOR_PENDING_COLORS = new Set(['gray','red','orange','yellow','green','blue','purple']);
const validPending = (v:any):v is PendingColorIntent =>
  !!v && typeof v.key==='string' && v.key.length>0 && v.key.length<=350
  && typeof v.token==='string' && v.token.length<=120 && v.token.length>0
  && COLOR_PENDING_COLORS.has(v.color);
export const readColorPending = (uid:string,scope:ColorPendingScope,key:string):PendingColorIntent|null=>{
  if(typeof localStorage==='undefined' || !uid || !key) return null;
  try {
    const s=localStorage.getItem(colorPendingPrefix(uid,scope)+encodeURIComponent(key));
    const raw=s?JSON.parse(s):null;
    return validPending(raw) && raw.key===key ? raw : null;
  } catch {return null;}
};
export const listColorPending = (uid:string,scope:ColorPendingScope):PendingColorIntent[]=>{
  if(typeof localStorage==='undefined'||!uid) return [];
  const prefix=colorPendingPrefix(uid,scope);
  const found:PendingColorIntent[]=[];
  try {
    for(let i=0;i<localStorage.length;i++){
      const storageKey=localStorage.key(i);
      if(!storageKey?.startsWith(prefix)) continue;
      const entry=readColorPending(uid,scope,decodeURIComponent(storageKey.slice(prefix.length)));
      if(entry) found.push(entry);
      if(found.length>=1000) break;
    }
  } catch {return found;}
  return found;
};
export const stageColorPending = (uid:string,scope:ColorPendingScope,key:string,color:string):PendingColorIntent|null=>{
  if(!uid||!key||key.length>350||!COLOR_PENDING_COLORS.has(color)) return null;
  const entry={key,color,token:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,14)}`};
  try {localStorage.setItem(colorPendingPrefix(uid,scope)+encodeURIComponent(key),JSON.stringify(entry));}
  catch (error) {console.warn('[color] pending write not durable',error);}
  return entry;
};
export const acknowledgeColorPending = (uid:string,scope:ColorPendingScope,entry:PendingColorIntent):boolean=>{
  if(!validPending(entry)) return false;
  try {
    if(readColorPending(uid,scope,entry.key)?.token!==entry.token) return false;
    localStorage.removeItem(colorPendingPrefix(uid,scope)+encodeURIComponent(entry.key));
    return true;
  } catch{return false;}
};
