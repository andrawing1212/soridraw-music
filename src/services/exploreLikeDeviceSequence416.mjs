// Stage416 dormant: one persistent UID/device identity per browser origin.
// Web Locks serializes multi-tab counters. No lock means fail closed.
const uuid=v=>typeof v==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sequenceLockName416=uid=>'soridraw:416:seq:'+uid;
const registrationLockName416=uid=>'soridraw:416:register:'+uid;

const allocateUnlocked416=(uid,storage,randomId)=>{
 if(!uid||uid.length>128||!storage?.getItem||!storage?.setItem||!randomId)
  throw Error('416_DEVICE_SEQUENCE_UNAVAILABLE');
 const key='soridraw:416:device:'+uid;
 let deviceId=storage.getItem(key);
 if(!uuid(deviceId)){
  deviceId=randomId();
  if(!uuid(deviceId))throw Error('416_BAD_DEVICE_ID');
  storage.setItem(key,deviceId);
 }
 const counterKey=key+':'+deviceId+':seq';
 const raw=storage.getItem(counterKey),n=raw===null?0:Number(raw);
 if(!Number.isSafeInteger(n)||n<0||n>=Number.MAX_SAFE_INTEGER)
  throw Error('416_DEVICE_COUNTER_CORRUPT');
 storage.setItem(counterKey,String(n+1));
 if(storage.getItem(counterKey)!==String(n+1))throw Error('416_COUNTER_NOT_DURABLE');
 return {deviceId,deviceSequence:n+1};
};

export async function reserveExploreLikeDeviceSequence416(uid,storage,locks,randomId){
 if(!locks?.request)throw Error('416_DEVICE_SEQUENCE_UNAVAILABLE');
 return locks.request(sequenceLockName416(uid),{mode:'exclusive'},
   ()=>allocateUnlocked416(uid,storage,randomId));
}

// Reserve the next sequence AND durably attach it to the local outbox while
// the same origin-wide lock is still held. This closes the tiny multi-tab gap
// where seq N+1 could be persisted/sent before seq N was even visible.
export async function reserveAndPersistExploreLikeDeviceSequence416(
 uid,storage,locks,randomId,persist,
){
 if(!locks?.request||typeof persist!=='function')
  throw Error('416_DEVICE_SEQUENCE_UNAVAILABLE');
 return locks.request(sequenceLockName416(uid),{mode:'exclusive'},async()=>{
  const token=allocateUnlocked416(uid,storage,randomId);
  await persist(token);
  return token;
 });
}

// All Stage416 server registrations for one signed-in account/origin share this
// lock. Combined with the durable outbox sort, multiple tabs cannot send a
// higher deviceSequence before an already-persisted lower sequence.
export async function withExploreLikeRegistrationLock416(uid,locks,run){
 if(!uid||uid.length>128||!locks?.request||typeof run!=='function')
  throw Error('416_DEVICE_REGISTRATION_LOCK_UNAVAILABLE');
 return locks.request(registrationLockName416(uid),{mode:'exclusive'},run);
}
