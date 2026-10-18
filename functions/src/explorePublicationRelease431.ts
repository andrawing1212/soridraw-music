import {createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'firebase-admin/database';

// app431 server issuer + app432 one-event compact live delta.
// Browsers are read-only. Worker signs only after exact R2 state/tombstone write.
// The Function writes one latest global Feed event plus one owner-scoped profile
// event, so public-profile viewers never receive unrelated creators' traffic.
const SERVER_ACTOR_431='publication-server-431';
const LIVE_CARD_MAX_432=4096;
const FEED_SIGNAL_PATH_432='publicSync/explorePublication';
const PROFILE_SIGNAL_ROOT_432='publicSync/explorePublicationProfiles';

export type PublicationReleaseClaim431={
  schemaVersion:1;
  trackId:string;
  ownerUid:string;
  status:'public'|'private';
  stateUpdatedAt:number;
  signedAtMs:number;
  cardJson?:string;
};

type SignalRow431={
  trackId:string;
  ownerUid:string;
  at:number;
  status:'public'|'private';
  cardJson?:string;
};
type Signal431={
  version?:number;
  at?:number;
  actorUid?:string;
  rows?:SignalRow431[]|Record<string,SignalRow431>;
};

const validText431=(value:unknown,max:number)=>typeof value==='string'&&
  value.length>0&&value.length<=max;

const allowedLiveCardKeys432=new Set([
  'id','ownerUid','ownerHandle','ownerNickname','ownerAvatarUrl',
  'title','coverUrl','sunoUrlPrimary','durationSeconds','style','primaryGenre',
  'allowNextSongApply','allowFollowerSave','likeCount','publishedAt','profilePinned',
]);

const validateLiveCard432=(
  raw:string|undefined,
  trackId:string,
  ownerUid:string,
  status:'public'|'private',
)=>{
  if(status==='private'){
    if(raw)throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
    return undefined;
  }
  if(typeof raw!=='string'||!raw||raw.length>LIVE_CARD_MAX_432)
    throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
  let card:Record<string,unknown>;
  try{card=JSON.parse(raw) as Record<string,unknown>;}
  catch{throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');}
  if(!card||typeof card!=='object'||Array.isArray(card)||
     String(card.id||'').trim()!==trackId||
     String(card.ownerUid||'').trim()!==ownerUid)
    throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
  for(const key of Object.keys(card)){
    if(!allowedLiveCardKeys432.has(key))throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
  }
  for(const forbidden of ['prompt','lyrics','lyricsParts','shareBundle','nextSong','selectedKeywords']){
    if(Object.prototype.hasOwnProperty.call(card,forbidden))
      throw Error('431_PUBLICATION_RELEASE_BAD_CLAIM');
  }
  return raw;
};

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
  const cardJson=validateLiveCard432(claim.cardJson,trackId,ownerUid,status);
  return {
    schemaVersion:1,trackId,ownerUid,status,stateUpdatedAt,signedAtMs,
    ...(cardJson?{cardJson}:{}),
  };
};

const firstRow431=(value:Signal431['rows']):SignalRow431|null=>{
  const rows=Array.isArray(value)?value:
    value&&typeof value==='object'?Object.values(value):[];
  const row=rows[0];
  if(!row||typeof row!=='object')return null;
  const trackId=String(row.trackId||'').trim();
  const ownerUid=String(row.ownerUid||'').trim();
  const at=Number(row.at||0);
  const status=row.status;
  if(!validText431(trackId,512)||!validText431(ownerUid,128)||
     !Number.isSafeInteger(at)||at<=0||
     (status!=='public'&&status!=='private'))return null;
  return {
    trackId,ownerUid,at,status,
    ...(typeof row.cardJson==='string'?{cardJson:row.cardJson}:{}),
  };
};

const publishLatest431=async(
  db:Database,
  path:string,
  claim:PublicationReleaseClaim431,
  nowMs:number,
):Promise<{status:'PUBLISHED'|'DUPLICATE'|'STALE';changed:boolean}>=>{
  let outcome:'PUBLISHED'|'DUPLICATE'|'STALE'='PUBLISHED';
  let changed=false;
  const result=await db.ref(path).transaction((rawState:unknown)=>{
    changed=false;
    outcome='PUBLISHED';
    const current=(rawState&&typeof rawState==='object'&&!Array.isArray(rawState)
      ?rawState:{}) as Signal431;
    const version=Number(current.version||0);
    const currentAt=Number(current.at||0);
    if(version&&(!Number.isSafeInteger(version)||version<0)||
       currentAt&&(!Number.isSafeInteger(currentAt)||currentAt>nowMs+60_000))
      throw Error('431_PUBLICATION_SIGNAL_CORRUPT');

    const prior=firstRow431(current.rows);
    if(prior&&prior.trackId===claim.trackId&&prior.at===claim.stateUpdatedAt){
      outcome='DUPLICATE';
      return;
    }
    if(prior&&prior.at>claim.stateUpdatedAt){
      outcome='STALE';
      return;
    }

    changed=true;
    const row:SignalRow431={
      trackId:claim.trackId,
      ownerUid:claim.ownerUid,
      at:claim.stateUpdatedAt,
      status:claim.status,
      ...(claim.cardJson?{cardJson:claim.cardJson}:{}),
    };
    return {
      version:Math.max(nowMs,version+1),
      at:nowMs,
      actorUid:SERVER_ACTOR_431,
      rows:[row],
    };
  },undefined,false);

  if(!result.committed&&!changed&&outcome==='PUBLISHED')
    throw Error('431_PUBLICATION_SIGNAL_NOT_COMMITTED');
  return {status:outcome,changed};
};

export async function publishPublicationRelease431(
  db:Database,raw:string,signature:string,secret:string,nowMs=Date.now(),
  feedPath=FEED_SIGNAL_PATH_432,
  profileRoot=PROFILE_SIGNAL_ROOT_432,
):Promise<{status:'PUBLISHED'|'DUPLICATE'|'STALE';trackId:string;signalChanged:boolean}>{
  if(!raw||raw.length>12_000||typeof secret!=='string'||secret.length<32||
     !/^[0-9a-f]{64}$/i.test(signature||'')||
     !Number.isSafeInteger(nowMs)||nowMs<=0||!feedPath||!profileRoot)
    throw Error('431_PUBLICATION_RELEASE_INVALID_AUTH');
  const expected=createHmac('sha256',secret).update(raw,'utf8').digest();
  const claimed=Buffer.from(signature,'hex');
  if(claimed.length!==expected.length||!timingSafeEqual(claimed,expected))
    throw Error('431_PUBLICATION_RELEASE_BAD_SIGNATURE');

  const claim=parseClaim431(raw,nowMs);
  const profilePath=profileRoot+'/'+encodeURIComponent(claim.ownerUid);
  const feed=await publishLatest431(db,feedPath,claim,nowMs);
  const profile=await publishLatest431(db,profilePath,claim,nowMs);

  const changed=feed.changed||profile.changed;
  const status: 'PUBLISHED'|'DUPLICATE'|'STALE'=
    changed?'PUBLISHED':
    feed.status==='DUPLICATE'&&profile.status==='DUPLICATE'?'DUPLICATE':'STALE';
  return {status,trackId:claim.trackId,signalChanged:changed};
}
