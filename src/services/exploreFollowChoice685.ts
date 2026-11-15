// APP685: bounded local choice fence for same-account follow UI.
// A user's explicit latest choice is not a canonical server ACK. This local
// receipt only protects the visible button against an older GET/retained RTDB
// snapshot after navigation or reload. No network I/O or background polling.
const PREFIX685='soridraw_follow_choice_685:';
const RETAIN_MS685=10*60_000;
type LocalChoice685={targetUid:string;following:boolean;at:number;settled:boolean};
const safeUid685=(value:string)=>String(value||'').trim();
const storage685=(viewerUid:string)=>PREFIX685+viewerUid;

export const readExploreFollowLocalChoice685=(
  viewerUid:string,targetUid:string,now=Date.now(),
):LocalChoice685|null=>{
  const viewer=safeUid685(viewerUid),target=safeUid685(targetUid);
  if(!viewer||!target||typeof localStorage==='undefined')return null;
  try{
    const rows=JSON.parse(localStorage.getItem(storage685(viewer))||'{}') as
      Record<string,LocalChoice685>;
    const row=rows?.[target];
    if(!row||row.targetUid!==target||typeof row.following!=='boolean'||
      !Number.isSafeInteger(row.at)||row.at<=0||row.at>now+60_000||
      now-row.at>RETAIN_MS685)return null;
    return row;
  }catch{return null;}
};

export const rememberExploreFollowLocalChoice685=(
  viewerUid:string,targetUid:string,following:boolean,settled=false,
  now=Date.now(),
):void=>{
  const viewer=safeUid685(viewerUid),target=safeUid685(targetUid);
  if(!viewer||!target||viewer===target||typeof localStorage==='undefined')return;
  try{
    const stored=JSON.parse(localStorage.getItem(storage685(viewer))||'{}') as
      Record<string,LocalChoice685>;
    const rows:Record<string,LocalChoice685>={};
    if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
      for(const [uid,row] of Object.entries(stored)){
        if(uid&&row?.targetUid===uid&&Number.isSafeInteger(row.at)&&
          now-row.at<=RETAIN_MS685&&row.at<=now+60_000)
          rows[uid]=row;
      }
    }
    rows[target]={targetUid:target,following:following===true,at:now,settled};
    // Bounded local-only retention; never touch the user’s other caches.
    const recent=Object.entries(rows).sort((a,b)=>b[1].at-a[1].at).slice(0,48);
    localStorage.setItem(storage685(viewer),JSON.stringify(Object.fromEntries(recent)));
  }catch{}
};

export const shouldKeepExploreFollowChoice685=(
 viewerUid:string,targetUid:string,
 staleFollowing:boolean,
 serverStartedAt:number,
 now=Date.now(),
):boolean=>{
 const choice=readExploreFollowLocalChoice685(viewerUid,targetUid,now);
 // Only hold a post-click local decision against a request started before
 // that decision. A new canonical request started after it may verify anew.
 return Boolean(choice&&choice.following!==staleFollowing&&
   choice.at>=serverStartedAt);
};
export const shouldIgnoreExploreFollowSignal685=(
 viewerUid:string,targetUid:string,signalAt:number,now=Date.now(),
):boolean=>{
 const choice=readExploreFollowLocalChoice685(viewerUid,targetUid,now);
 return Boolean(choice&&signalAt<=choice.at);
};
