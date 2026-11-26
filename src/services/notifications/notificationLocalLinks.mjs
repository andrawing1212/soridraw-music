// Presentation-only linkage. No network, storage, fuzzy title matching or mutation.
export function notificationRecentKey(song){
 if(!song||typeof song!=='object')return '';
 const batch=String(song.appliedKeywords?.generationBatchId||'').trim();
 const index=Math.floor(Number(song.appliedKeywords?.generationIndex||0));
 if(batch&&Number.isFinite(index)&&index>0)return 'generation:'+batch+':'+index;
 const explicit=String(song.recentSongSyncKey||'').trim();
 if(explicit)return explicit;
 const sid=String(song.soridrawSongId||'').trim();
 return sid?'sid:'+sid:'';
}
export function notificationCreationLink(song){
 if(!song||typeof song!=='object')return undefined;
 const exact=value=>typeof value==='string'&&value.trim().length<=256?value.trim():'';
 const songId=exact(song.soridrawSongId);
 const noteId=exact(song.favoriteFirestoreId||song.musicNoteFavoriteId);
 const sourceId=exact(song.id||song.taskId||song.sourceId);
 const sourceCreatedAt=notificationGenerationTime(song.createdAtMs)||notificationGenerationTime(song.createdAt);
 return songId||noteId||sourceId?{
  ...(songId?{songId}:{}),...(noteId?{noteId}:{}),
  ...(sourceId?{sourceId}:{}),...(sourceId&&sourceCreatedAt?{sourceCreatedAt}:{})
 }:undefined;
}
// Same deterministic first-save document ID used by App's existing Studio-heart
// path. This is a lookup in the already-owned local notes, never a new read.
function notificationDerivedNoteId(uid,key){
 if(!uid||!key||!(/^(generation:|sid:)/.test(key)))return '';
 let hash=2166136261;
 const raw=uid+'|'+key;
 for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return 'rs_'+(key.replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,72)||'song')+'_'+(hash>>>0).toString(36);
}
export function notificationOwnNote(notes,uid,row,source){
 if(!uid||!row||!Array.isArray(notes))return null;
 const key=String(row.recentKey||notificationRecentKey(source)||'').trim();
 const raw=typeof row.id==='string'&&row.id.startsWith('generated:')?row.id.slice(10):'';
 const aliases=notificationCreationLink(source)||row.creationLink||{};
 const original=String(aliases.sourceId||'').trim();
 const legacy=original||(raw&&!raw.startsWith('recent-')?raw:'');
 const sourceSid=String(aliases.songId||'').trim();
 const linkedId=String(aliases.noteId||'').trim();
 const derivedId=notificationDerivedNoteId(uid,key);
 const generation=key.startsWith('generation:')?key:raw.startsWith('generation:')?raw:'';
 const matches=notes.filter(note=>{
  if(note?.uid!==uid)return false;
  const noteKey=notificationRecentKey(note);
  const explicit=String(note.recentSongSyncKey||'').trim();
  const sid=String(note.soridrawSongId||'').trim();
  const noteGeneration=noteKey.startsWith('generation:')?noteKey:explicit.startsWith('generation:')?explicit:'';
  if(generation&&noteGeneration&&generation!==noteGeneration)return false;
  const noteId=String(note.firestoreId||note.id||'').trim();
  if(linkedId&&noteId===linkedId)return true;
  // A deterministic document ID is useful for old cached summaries missing the
  // exact identity fields, but never override a conflicting identity.
  if(derivedId&&noteId===derivedId&&(!noteKey||noteKey===key)&&(!explicit||explicit===key))return true;
  if(key&&(key===noteKey||key===explicit||(sid&&key==='sid:'+sid)))return true;
  if(generation&&generation===noteGeneration)return true;
  if(sid&&(sourceSid===sid||raw===sid||raw==='sid:'+sid))return true;
  if(!legacy||String(note.recentLegacySourceId||'').trim()!==legacy)return false;
  const a=notificationGenerationTime(aliases.sourceCreatedAt)||notificationGenerationTime(row.createdAt);
  const b=notificationGenerationTime(note.recentLegacyCreatedAtMs);
  if(a&&b&&a!==b)return false;
  return (!generation&&!noteGeneration)||(!generation&&a>0&&b>0&&a===b);
 });
 return matches.length===1?matches[0]:null;
}
export function notificationOwnPublishedNote(notes,uid,trackId){
 if(!uid||!trackId||!Array.isArray(notes))return null;
 const matches=notes.filter(note=>note?.uid===uid&&note.isPublic===true&&String(note.exploreTrackId||'')===trackId);
 return matches.length===1?matches[0]:null;
}
export function notificationHttps(value){
 if(typeof value!=='string')return '';
 try{const u=new URL(value.trim());return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}
 catch{return ''}
}
export function notificationMedia(source){
 if(!source)return {audioUrl:'',shareUrl:'',coverUrl:''};
 const links=Array.isArray(source.sunoLinks)?source.sunoLinks:
  Array.isArray(source.sunoShareLinks)?source.sunoShareLinks:[];
 const valid=links.filter(link=>notificationHttps(link?.url||link?.sunoShareUrl||link?.sunoUrl)).slice(0,2);
 const index=Number(source.mainSunoIndex);
 const main=valid.length===1?valid[0]:valid[index===0||index===1?index:Math.max(0,valid.findIndex(link=>Number(link.rank)===1))];
 const shareUrl=notificationHttps(main?.url||main?.sunoShareUrl||main?.sunoUrl||
  source.sunoShareUrl||source.sunoUrl||source.sunoSongUrl||source.openUrl||source.sunoUrlPrimary);
 // An old top-level audio/cover may belong to the other ranked link.
 const legacyMatches=!main||notificationHttps(source.sunoShareUrl||source.sunoUrl||source.sunoSongUrl)===shareUrl;
 const audioUrl=notificationHttps(main?.audioUrl||main?.streamAudioUrl||(legacyMatches?(source.sunoAudioUrl||source.audioUrl||source.audio_url||source.streamAudioUrl||source.stream_audio_url):''));
 const coverUrl=notificationHttps(main?.coverUrl||main?.imageUrl||main?.thumbnailUrl||
  (legacyMatches?(source.sunoCoverUrl||source.sunoImageUrl||source.sunoArtworkUrl||source.coverUrl||source.imageUrl||source.thumbnailUrl):''));
 return {audioUrl,shareUrl,coverUrl};
}

// Read the existing UID-scoped Recent cache, not the backup and never the server.
// An explicit empty snapshot must not revive previous songs.
export function notificationRecentSnapshot(uid,history,storage,preferCache=false){
 if(!uid)return [];
 const live=Array.isArray(history)?history.slice(0,10):[];
 if(!preferCache&&live.length)return live;
 try{
  const raw=storage?.getItem('soridraw_recent_songs_cache_'+uid);
  const value=raw?JSON.parse(raw):null;
  if(Array.isArray(value?.history))return value.history.slice(0,10);
 }catch{}
 return preferCache?[]:live;
}
export function notificationCachedNotes(uid,live,cached,storage){
 if(!uid)return [];
 let deleted=new Set();
 try{
  const raw=JSON.parse(storage?.getItem('soridraw_favorite_deleted_tombstones_'+uid)||'[]');
  if(Array.isArray(raw))deleted=new Set(raw.map(String));
 }catch{return []}
 let payload=[];
 try{
  const raw=storage?.getItem('soridraw_favorites_cache_'+uid);
  const value=raw?JSON.parse(raw):[];
  if(Array.isArray(value))payload=value;
 }catch{}
 const byId=new Map(),payloadById=new Map();
 const idOf=note=>String(note?.firestoreId||note?.id||'').trim();
 const owned=note=>note?.uid===uid&&idOf(note)&&!deleted.has(idOf(note));
 const removed=note=>note?.favoriteRemoved===true||note?.saved===false||note?.hidden===true||
  note?.favoriteHidden===true||!!note?.deletedAt||!!note?.trashedAt||
  (note?.saved!==true&&note?.favoriteRemoved!==false&&!!(note?.favoriteRemovedAt||note?.unlikedAt||note?.unsavedAt));
 const mediaTime=note=>Math.max(0,Number(note?.sunoShareUrlUpdatedAt)||0,Number(note?.sunoCoverFetchedAt)||0);
 const mediaKeys=['sunoLinks','sunoShareLinks','mainSunoIndex','sunoShareUrl','sunoUrl','sunoSongUrl',
  'sunoCoverUrl','sunoImageUrl','sunoArtworkUrl','imageUrl','coverUrl','audioUrl','audio_url',
  'sunoAudioUrl','streamAudioUrl','stream_audio_url','sunoShareUrlUpdatedAt','sunoCoverFetchedAt'];
 const newerMedia=(row,alternative)=>{
  if(!alternative||removed(row)||removed(alternative)||mediaTime(alternative)<=mediaTime(row))return row;
  const next={...row};
  for(const key of mediaKeys){
   if(Object.prototype.hasOwnProperty.call(alternative,key))next[key]=alternative[key];
  }
  return next;
 };
 for(const note of payload)if(owned(note))payloadById.set(idOf(note),note);
 for(const note of [...(Array.isArray(cached)?cached:payload),...(live||[])]){
  if(!owned(note))continue;
  const id=idOf(note),prior=byId.get(id);
  byId.set(id,newerMedia(newerMedia(note,prior),payloadById.get(id)));
 }
 return [...byId.values()];
}
export function notificationGenerationTime(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:0;
 if(typeof value==='string'&&value.trim()){
  const numeric=Number(value);
  const ms=Number.isSafeInteger(numeric)&&numeric>0?numeric:Date.parse(value);
  return Number.isSafeInteger(ms)&&ms>0?ms:0;
 }
 if(value&&typeof value==='object'){
  const seconds=Number(value.seconds??value._seconds);
  const nanos=Number(value.nanoseconds??value._nanoseconds??0);
  const ms=Math.floor(seconds*1000+nanos/1000000);
  if(Number.isSafeInteger(ms)&&ms>0)return ms;
 }
 return 0;
}
