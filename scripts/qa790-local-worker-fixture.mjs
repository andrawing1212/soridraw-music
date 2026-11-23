// LOCAL ONLY: seed previous QA730 state in the isolated workerd test.
// Never included in the physical candidate bundle.
import candidate,{OwnerFollowIsolated558 as Candidate} from '../cloudflare/explore-worker/experiments/owner-follow-qa790-entry.mjs';
export class OwnerFollowIsolated558 extends Candidate{
 async fetch(r){
  if(this.e.QA790_LOCAL_TEST==='1'&&r.headers.get('X-Local-Test')==='local-fixture-only'){
   const path=new URL(r.url).pathname;
   if(path==='/__local/seed'&&r.method==='POST'){
    const old=await r.json();await this.state.storage.put('qa730-durable-state-v1',old);
    return Response.json({ok:true});
   }
   if(path==='/__local/snapshot'&&r.method==='GET')return Response.json({
    old:await this.state.storage.get('qa730-durable-state-v1'),
    control:await this.state.storage.get('qa790-run-control-v1'),
    receipts:await this.state.storage.get('app755-owner-follow-pending-v1')});
  }
  return super.fetch(r);
 }
}
export default candidate;
