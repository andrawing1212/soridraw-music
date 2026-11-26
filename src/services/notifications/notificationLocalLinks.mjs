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
export function notificationOwnNote(notes,uid,row,source){
 if(!uid||!row||!Array.isArray(notes))return null;
 const key=row.recentKey||notificationRecentKey(source);
 const original=String(source?.id||source?.taskId||'').trim();
 const legacy=original||(/^generated:(?!recent-).+/.test(row.id)?row.id.slice(10):'');
 const matches=notes.filter(note=>{
  if(note?.uid!==uid)return false;
  if(key)return notificationRecentKey(note)===key;
  return !!legacy&&String(note.recentLegacySourceId||'')===legacy;
 });
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
 const audioUrl=notificationHttps(main?.audioUrl||(legacyMatches?(source.sunoAudioUrl||source.audioUrl):''));
 const coverUrl=notificationHttps(main?.coverUrl||main?.imageUrl||main?.thumbnailUrl||
  (legacyMatches?(source.sunoCoverUrl||source.sunoImageUrl||source.sunoArtworkUrl||source.coverUrl||source.imageUrl||source.thumbnailUrl):''));
 return {audioUrl,shareUrl,coverUrl};
}
