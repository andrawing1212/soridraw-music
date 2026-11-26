// Display only: bounded decoded pixels, per signed-in account and browser tab.
// Already-loaded cross-origin images can be drawn without reading or exporting
// pixels. No new request, persistent storage or server write.
const SIZE=64, MAX_IMAGES=64;
const SELECTOR=[
 '.soridraw-profile-trigger img',
 '.soridraw-studio-rail-profile-avatar img',
 '.soridraw-explore-avatar img',
 '.soridraw-explore-profile-avatar img',
 '.soridraw-explore-recommend-creator-avatar img',
 '.soridraw-explore-connection-avatar-376 img',
 '.soridraw-explore-cover-wrap img',
 '.soridraw-explore-more-cover img',
 '.soridraw-musicnote-song-media img',
 '.soridraw-musicnote-suno-cover-image'
].join(',');
const exactUrl=value=>{
 if(typeof value!=='string'||value.length>4096)return '';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}
 catch{return ''}
};
const readyUrl=image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0
 ? exactUrl(image.currentSrc||image.src):'';
function copySquare(source,width,height,target){
 try{
  const context=target.getContext('2d');
  if(!context||width<=0||height<=0)return false;
  const side=Math.min(width,height);
  context.clearRect(0,0,target.width,target.height);
  context.drawImage(source,(width-side)/2,(height-side)/2,side,side,0,0,target.width,target.height);
  return true;
 }catch{return false}
}
export function createNotificationImageCache(){
 let owner='',doc=null,current=null;
 const users=new Set(),pixels=new Map();
 const remember=image=>{
  if(!doc||!owner||!current?.())return;
  const key=readyUrl(image);
  if(!key||pixels.has(key))return;
  const canvas=doc.createElement('canvas');
  canvas.width=canvas.height=SIZE;
  if(!copySquare(image,image.naturalWidth,image.naturalHeight,canvas))return;
  if(pixels.size>=MAX_IMAGES)pixels.delete(pixels.keys().next().value);
  pixels.set(key,canvas);
 };
 const onLoad=event=>{
  const image=event.target;
  if(image?.tagName==='IMG'&&image.matches(SELECTOR))remember(image);
 };
 const clear=()=>{
  doc?.removeEventListener('load',onLoad,true);
  pixels.clear();users.clear();doc=null;owner='';current=null;
 };
 const attach=(uid,document,isCurrent)=>{
  if(!uid||!isCurrent())return ()=>{};
  if(owner!==uid||doc!==document){
   clear();owner=uid;doc=document;current=isCurrent;
   document.addEventListener('load',onLoad,true);
   document.querySelectorAll(SELECTOR).forEach(remember);
  }
  const token=Symbol();users.add(token);
  return ()=>{if(users.delete(token)&&!users.size)clear()};
 };
 const draw=(uid,urls,target)=>{
  if(!uid||owner!==uid||!doc||!current?.())return false;
  for(const raw of urls){
   const key=exactUrl(raw);
   if(!key)continue;
   let cached=pixels.get(key);
   if(!cached){
    const image=Array.from(doc.images).find(image=>readyUrl(image)===key);
    if(image){remember(image);cached=pixels.get(key)}
   }
   if(cached&&copySquare(cached,cached.width,cached.height,target)){
    pixels.delete(key);pixels.set(key,cached);return true;
   }
  }
  return false;
 };
 return {attach,draw};
}
export const notificationImageCache=createNotificationImageCache();
