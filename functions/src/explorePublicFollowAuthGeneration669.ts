// APP669 stable account-incarnation fence for publicly visible aggregate
// counters. The client never supplies this value and the Worker never derives
// it from D1 enrollment. Works for every Auth user, including unenrolled ones.
import {createHash} from 'node:crypto';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
export const publicFollowAuthGeneration669=(
 uid:string,creationTime:string,
):string|null=>{
 if(!UID.test(uid)||typeof creationTime!=='string')return null;
 const created=Date.parse(creationTime);
 if(!Number.isSafeInteger(created)||created<=0)return null;
 return createHash('sha256').update(JSON.stringify(
  ['soridraw-public-follow-auth-669',uid,created]
 )).digest('hex').slice(0,32);
};
