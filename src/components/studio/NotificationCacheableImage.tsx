import React, {useState} from 'react';

// Opt in only at normal image-rendering sites; never request images in the inbox.
// Preserve original display when a host refuses anonymous CORS.
const denied=new Set<string>();
function canTry(src?:string){
  if(!src||typeof window==='undefined'||denied.has(src))return false;
  try{
    const url=new URL(src,window.location.href);
    return url.protocol==='https:'&&!url.username&&!url.password&&url.origin!==window.location.origin;
  }catch{return false}
}
function SourceImage({src,onError,crossOrigin,...rest}:React.ImgHTMLAttributes<HTMLImageElement>){
  const [anonymous,setAnonymous]=useState(()=>!crossOrigin&&canTry(src));
  return <img {...rest} key={anonymous?'cors':'original'} crossOrigin={anonymous?'anonymous':crossOrigin}
    src={src} onError={event=>{
      if(anonymous){
        if(src){if(denied.size>=256)denied.delete(denied.values().next().value!);denied.add(src)}
        setAnonymous(false);
        return;
      }
      onError?.(event);
    }}/>;
}
export default function NotificationCacheableImage(props:React.ImgHTMLAttributes<HTMLImageElement>){
  return <SourceImage key={props.src||''} {...props}/>;
}
