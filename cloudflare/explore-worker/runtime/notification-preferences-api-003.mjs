// SORIDRAW account notification preferences API — dormant HTTP adapter.
// Uses verified UID from the existing Firebase Auth + AppCheck boundary;
// caller-provided UID is never accepted. No Worker imports this unless a later
// guarded build is explicitly promoted.
import {
  readOwnNotificationPreferences002, saveOwnNotificationPreferences002,
} from './notification-preferences-retention-002.mjs';

const path003='/v1/me/notifications/preferences';
const noCacheHeaders003=(cors={})=>({
  ...cors, 'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store', 'Vary':'Origin, Authorization',
});
const response003=(status,payload,cors)=>new Response(JSON.stringify(payload),{
  status,headers:noCacheHeaders003(cors),
});
const fail003=(code,message)=>({ok:false,error:{code,message}});

// verifyAuthenticatedUid must be a SERVER callback proven by the Worker Auth
// boundary; never call this module with a client-supplied uid function.
export async function handleNotificationPreferencesApi003({
  request,db,verifyAuthenticatedUid,enabled=false,cors={},
}={}){
  if(!request || new URL(request.url).pathname!==path003 || enabled!==true)
    return response003(404,fail003('NOTIFICATION_API_NOT_ACTIVE','Not available.'),cors);
  if(request.method==='OPTIONS'){
    return new Response(null,{status:204,headers:{
      ...cors, 'Cache-Control':'private, no-store',
      'Access-Control-Allow-Methods':'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers':'Authorization, X-Firebase-AppCheck, Content-Type',
      'Access-Control-Max-Age':'300',
    }});
  }
  if(request.method!=='GET'&&request.method!=='PUT')
    return response003(405,fail003('METHOD_NOT_ALLOWED','Method not allowed.'),cors);
  if(typeof verifyAuthenticatedUid!=='function')
    return response003(503,fail003('NOTIFICATION_AUTH_NOT_READY','Service unavailable.'),cors);
  let uid;
  try {uid=await verifyAuthenticatedUid(request);}
  catch {return response003(401,fail003('AUTHENTICATION_REQUIRED','Login required.'),cors);}
  if(typeof uid!=='string'||!uid||uid.trim()!==uid||uid.length>256)
    return response003(401,fail003('AUTHENTICATION_REQUIRED','Login required.'),cors);
  const authenticate=async()=>uid;
  try{
    if(request.method==='GET'){
      const data=await readOwnNotificationPreferences002({db,authenticate,activated:true});
      if(data.status!=='ok'||!data.preferences)throw Error('NOTIFICATION_READ_UNVERIFIED');
      return response003(200,{ok:true,data},cors);
    }
    const stated=Number(request.headers.get('Content-Length')||0);
    if(Number.isFinite(stated) && stated>2048)
      return response003(413,fail003('NOTIFICATION_BODY_TOO_LARGE','Request too large.'),cors);
    const raw=await request.text();
    if(raw.length>2048)
      return response003(413,fail003('NOTIFICATION_BODY_TOO_LARGE','Request too large.'),cors);
    let requested;
    try {requested=JSON.parse(raw);}catch{
      return response003(400,fail003('NOTIFICATION_INVALID_JSON','Invalid settings.'),cors);
    }
    if(!requested || typeof requested!=='object' || Array.isArray(requested) ||
       Object.prototype.hasOwnProperty.call(requested,'userUid') ||
       Object.prototype.hasOwnProperty.call(requested,'uid'))
      return response003(400,fail003('NOTIFICATION_INVALID_BODY','Invalid settings.'),cors);
    let result;
    try{
      result=await saveOwnNotificationPreferences002({
        db,authenticate,activated:true,requested,
      });
    }catch(error){
      if(error?.code==='NOTIFICATION_PREFERENCES_INVALID')
        return response003(400,fail003('NOTIFICATION_PREFERENCES_INVALID','Invalid settings.'),cors);
      throw error;
    }
    if(result.status==='conflict')
      return response003(409,{ok:false,error:{code:'NOTIFICATION_REVISION_CONFLICT',
        message:'Settings changed on another device.'},data:{
          preferences:result.preferences,rowsWritten:0}},cors);
    if(!['saved','unchanged'].includes(result.status)||!result.preferences)
      throw Error('NOTIFICATION_SAVE_UNVERIFIED');
    return response003(200,{ok:true,data:result},cors);
  }catch{
    // Fail closed: do not reissue a write or claim client state is synchronized.
    return response003(503,fail003('NOTIFICATION_BACKEND_UNAVAILABLE','Please try again.'),cors);
  }
}
