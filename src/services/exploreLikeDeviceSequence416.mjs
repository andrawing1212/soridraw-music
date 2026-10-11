// Stage416 dormant: one persistent UID/device identity per browser origin.
// Web Locks serializes multi-tab counters. No lock means fail closed.
const uuid=v=>typeof v==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function reserveExploreLikeDeviceSequence416(uid,storage,locks,randomId){
 if(!uid||uid.length>128||!storage?.getItem||!storage?.setItem||
    !locks?.request||!randomId)throw Error('416_DEVICE_SEQUENCE_UNAVAILABLE');
 return locks.request('soridraw:416:seq:'+uid,{mode:'exclusive'},()=>{
   const key='soridraw:416:device:'+uid;
   let deviceId=storage.getItem(key);
   if(!uuid(deviceId)){deviceId=randomId();if(!uuid(deviceId))throw Error('416_BAD_DEVICE_ID');
     storage.setItem(key,deviceId);}
   const counterKey=key+':'+deviceId+':seq';
   const raw=storage.getItem(counterKey),n=raw===null?0:Number(raw);
   if(!Number.isSafeInteger(n)||n<0||n>=Number.MAX_SAFE_INTEGER)
     throw Error('416_DEVICE_COUNTER_CORRUPT');
   storage.setItem(counterKey,String(n+1));
   if(storage.getItem(counterKey)!==String(n+1))throw Error('416_COUNTER_NOT_DURABLE');
   return {deviceId,deviceSequence:n+1};
 });
}
