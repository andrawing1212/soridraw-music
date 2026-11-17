import {createHash} from 'node:crypto';
export const hash710=s=>createHash('sha256').update(s).digest('hex');
export const ACTIVE_SERVICE_SHA710='ded26d6bf39a092fcafed658b73b96330dfb7f12b937637e28a52a5ab6b97e9e';
export function patchReservationDiagnostic710(source){
 if(hash710(source)!==ACTIVE_SERVICE_SHA710)throw Error('APP710_ACTIVE_SERVICE_DRIFT');
 const from="  if(response.status!==200)return {ok:false,status:'reservation-unavailable'};";
 if(source.split(from).length!==2)throw Error('APP710_ANCHOR_DRIFT');
 return source.replace(from,`  if(response.status!==200){
   // Log only fixed reason labels, never ticket, owner, actor, headers or body.
   // The durable ACK requirement and public failure response stay unchanged.
   let reason='unclassified';
   try{
    const raw=await response.text();
    if(raw.length<=1024){
     const status=JSON.parse(raw)?.status;
     if(['disabled','invalid-reservation','generation-held','operation-conflict',
         'owner-queue-full','storage-unavailable','owner-not-approved',
         'missing-do-binding','reservation-unavailable'].includes(status))reason=status;
    }
   }catch{}
   console.warn('APP710_RESERVATION_FAILURE',JSON.stringify({http:response.status,reason}));
   return {ok:false,status:'reservation-unavailable'};
  }`);
}
