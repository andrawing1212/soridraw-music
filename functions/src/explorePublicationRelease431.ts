import {createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'firebase-admin/database';

// app431: Worker -> Firebase server-only publication invalidation.
// Browsers can read the compact signal but can never write it. The claim is
// HMAC-authenticated only after the Worker successfully stores exact R2 state.
const SIGNAL_RETENTION_MS_431=3*60_000;
const SIGNAL_MAX_431=50;
const SERVER_ACTOR_431='publication-server-431';

export type PublicationReleaseClaim431={
  schemaVersion:1;
  trackId:string;
  ownerUid:string;
  status:'public'|'private';
  stateUpdatedAt:number;
  signedAtMs:number;
};

type SignalRow431={trackId:string;ownerUid:string;at:number};
type Signal431={
  version?:number;at?:number;actorUid?:string;
  rows?:SignalRow431[]|Record<string,SignalRow431>;
};

const validText431=(value:unknown,max:number)=>typeof value==='string'&&
  value.length>0&&value.length<=max;
const rows431=(value:Signal431['rows']):SignalRow431[]=>
  Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];

const parseClaim431=(raw:string,nowMs:number):PublicationReleaseClaim431=>{
  let claim:PublicationReleaseClaim431;
  try{claim=JSON.parse(raw) as PublicationReleaseClaim431;}
  catch{throw Error('431_PUBLICATION_RELEASE_BAD_JSON');}
  const trackId=String(claim?.trackId||'').trim();
  const ownerUid=String(claim?.ownerUid||'').trim();
  const status=claim?.status;
  const stateUpdatedAt=Number(claim?.stateUpdatedAt||0);
  const signedAtMs=Number(claim?.signedAtMs||0);
  if(claim?.schemaVersion!==1||
     !validText431(trackId,512)||!validText431(ownerUid,128)||
     !trackId.startsWith('music_note_'+ownerUid+'_')||
     (status!=='public'&&status!=='private')||
     !Number.isSafeInteger(stateUpdatedAt)||stateUpdatedAt<=0||
     !Number.isSafeInteger(signedAtMs)||signedAtMs<=0||
     signedAtMs<nowMs-5*60_000||signedAtMs>nowMs+30_000||
     stateUpdatedAt>signedAtMs+5_000||
     stateUpdatedAt<signedAtMs-2*60_000)
    throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
  return {schemaVersion:1,trackId,ownerUid,status,stateUpdatedAt,signedAtMs};
};

export async function publishPublicationRelease431(
  db:Database,raw:string,signature:string,secret:string,nowMs=Date.now(),
  signalPath='publicSync/explorePublication',
):Promise<{status:'PUBLISHED'|'DUPLICATE'|'STALE';trackId:string;signalChanged:boolean}>{
  if(!raw||raw.length>64_000||typeof secret!=='string'||secret.length<32||
     !/^[0-9a-f]{64}$/i.test(signature||'')||
     !Number.isSafeInteger(nowMs)||nowMs<=0||!signalPath)
    throw Error('431_PUBLICATION_RELEASE_INVALID_AUTH');
  const expected=createHmac('sha256',secret).update(raw,'utf8').digest();
  const claimed=Buffer.from(signature,'hex');
  if(claimed.length!==expected.length||!timingSafeEqual(claimed,expected))
    throw Error('431_PUBLICATION_RELEASE_BAD_SIGNATURE');

  const claim=parseClaim431(raw,nowMs);
  let outcome:'PUBLISHED'|'DUPLICATE'|'STALE'='PUBLISHED';
  let changed=false;
  const result=await db.ref(signalPath).transaction((rawState:unknown)=>{
    changed=false;
    outcome='PUBLISHED';
    const current=(rawState&&typeof rawState==='object'&&!Array.isArray(rawState)
      ?rawState:{}) as Signal431;
    const version=Number(current.version||0);
    const currentAt=Number(current.at||0);
    if(version&&(!Number.isSafeInteger(version)||version<0)||
       currentAt&&(!Number.isSafeInteger(currentAt)||currentAt>nowMs+60_000))
      throw Error('431_PUBLICATION_SIGNAL_CORRUPT');

    const cutoff=nowMs-SIGNAL_RETENTION_MS_431;
    const retained=new Map<string,SignalRow431>();
    for(const row of rows431(current.rows)){
      const trackId=String(row?.trackId||'').trim();
      const ownerUid=String(row?.ownerUid||'').trim();
      const at=Number(row?.at||0);
      if(!validText431(trackId,512)||!validText431(ownerUid,128)||
         !Number.isSafeInteger(at)||at<=0)continue;
      if(at>=cutoff)retained.set(trackId,{trackId,ownerUid,at});
    }

    const prior=retained.get(claim.trackId);
    if(prior&&prior.at>=claim.stateUpdatedAt){
      outcome=prior.at===claim.stateUpdatedAt?'DUPLICATE':'STALE';
      return;
    }
    retained.set(claim.trackId,{
      trackId:claim.trackId,ownerUid:claim.ownerUid,at:claim.stateUpdatedAt,
    });
    const ordered=[...retained.values()]
      .sort((a,b)=>b.at-a.at||a.trackId.localeCompare(b.trackId))
      .slice(0,SIGNAL_MAX_431);
    changed=true;
    return {
      version:Math.max(nowMs,version+1),
      at:nowMs,
      actorUid:SERVER_ACTOR_431,
      rows:ordered,
    };
  },undefined,false);

  if(!result.committed&&!changed&&outcome==='PUBLISHED')
    throw Error('431_PUBLICATION_SIGNAL_NOT_COMMITTED');
  return {status:outcome,trackId:claim.trackId,signalChanged:changed};
}
