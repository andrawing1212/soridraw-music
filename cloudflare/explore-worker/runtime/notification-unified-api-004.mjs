// Dormant authenticated notification routes, not active in any Worker.
import {readUnifiedNotificationInbox004,publishPrivateNotification004,
  publishSharedAnnouncement004} from './notification-unified-inbox-004.mjs';
import {NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001} from './notification-inbox-001.mjs';
import {reconcileGlobalAnnouncementSnapshot005}
  from './notification-retention-coordinator-005.mjs';

const noCache=cors=>({...cors,'Cache-Control':'private, no-store',
  'Content-Type':'application/json; charset=utf-8','Vary':'Origin, Authorization'});
const result=(status,data,cors)=>new Response(JSON.stringify(data),{
  status,headers:noCache(cors)});
const fail=(code,cors,status=403)=>result(status,{ok:false,error:{code}},cors);
const inbox='/v1/me/notifications/inbox';
const message='/v1/admin/notifications/message';
const notice='/v1/admin/notifications/announcement';

export async function handleUnifiedNotificationsApi004({
  request,db,cache,verifyUid,verifyAdmin,enabled=false,cors={}
}={}){
  if(!enabled||!request)return fail('NOTIFICATION_NOT_ACTIVE',cors,404);
  const path=new URL(request.url).pathname;
  if(![inbox,message,notice].includes(path))return fail('NOT_FOUND',cors,404);
  if(request.method==='OPTIONS'){
    return new Response(null,{status:204,headers:{...cors,
      'Cache-Control':'private, no-store',
      'Access-Control-Allow-Headers':'Authorization, X-Firebase-AppCheck, Content-Type',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
  }
  if(path===inbox?request.method!=='GET':request.method!=='POST')
    return fail('METHOD_NOT_ALLOWED',cors,405);
  if(typeof verifyUid!=='function')return fail('AUTH_NOT_READY',cors,503);
  let uid;
  try {uid=await verifyUid(request);}catch{return fail('AUTH_REQUIRED',cors,401)}
  if(typeof uid!=='string'||uid.length===0||uid.length>256||uid.trim()!==uid)
    return fail('AUTH_REQUIRED',cors,401);
  if(!db?.prepare)return fail('DB_NOT_READY',cors,503);
  const readCommon=async()=>{
    if(!cache?.get)throw Error('CACHE_NOT_READY');
    const obj=await cache.get(NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001);
    if(!obj)return [];
    const value=await obj.json();
    if(value?.schema!==1||!Array.isArray(value.items))throw Error('CACHE_INVALID');
    return value.items;
  };
  try{
    if(path===inbox){
      const data=await readUnifiedNotificationInbox004({
        db,authenticate:async()=>uid,readSharedAnnouncements:readCommon,
        enabled:true
      });
      if(data.status!=='ok')throw Error('INBOX_UNVERIFIED');
      return result(200,{ok:true,data:{items:data.items}},cors);
    }
    if(typeof verifyAdmin!=='function'||await verifyAdmin(request,uid)!==true)
      return fail('ADMIN_REQUIRED',cors,403);
    const length=Number(request.headers.get('Content-Length')||0);
    if(!Number.isFinite(length)||length>6000)
      return fail('BODY_TOO_LARGE',cors,413);
    const raw=await request.text();
    if(raw.length>6000)return fail('BODY_TOO_LARGE',cors,413);
    let body;
    try{body=JSON.parse(raw)}catch{return fail('INVALID_JSON',cors,400)}
    if(!body||typeof body!=='object'||Array.isArray(body))
      return fail('INVALID_BODY',cors,400);
    if(path===message){
      if(Object.keys(body).sort().join(',')!=='body,id,receiverUid,title')
        return fail('INVALID_BODY',cors,400);
      const written=await publishPrivateNotification004({
        db,verifyAdmin:async()=>true,receiverUid:body.receiverUid,
        message:{id:body.id,title:body.title,body:body.body},enabled:true
      });
      return result(200,{ok:true,data:written},cors);
    }
    if(Object.keys(body).sort().join(',')!=='body,id,publishedAtMs,title')
      return fail('INVALID_BODY',cors,400);
    const written=await publishSharedAnnouncement004({
      db,announcement:body,verifyAdmin:async()=>true,
      reconcileSharedSnapshot:()=>reconcileGlobalAnnouncementSnapshot005({db,cache}),enabled:true
    });
    return result(200,{ok:true,data:written},cors);
  }catch(error){
    if(['NOTIFICATION_MESSAGE_INVALID','NOTIFICATION_INVALID_ANNOUNCEMENT'].includes(error?.code))
      return fail(error.code,cors,400);
    return fail('NOTIFICATION_BACKEND_UNAVAILABLE',cors,503);
  }
}
