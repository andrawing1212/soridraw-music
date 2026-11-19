// APP732: source-only QA entry candidate. NOT the current deployed QA Worker.
// Preserve all APP583/APP558 routes by delegation to the exact previous entry.
// New QA730 routes use a separate DO ID in the *existing QA-only* DO binding,
// without a new DO namespace, D1/R2 binding, migration or user identities.
import originalWorker,{
  OwnerFollowIsolated558 as OriginalQaDurableObject,
} from './owner-follow-isolated-558-entry.mjs';
import {parseOwnerQaConfig583} from './owner-follow-qa-live-583.mjs';
import {createOwnerQa730Runtime} from './owner-follow-qa730-bridge.mjs';

const respond=(status)=>Response.json({ok:false,syntheticOnly:true},{status});
export class OwnerFollowIsolated558 extends OriginalQaDurableObject{
  constructor(state,env){
    super(state,env);
    this.qa730=createOwnerQa730Runtime({storage:state.storage,env});
  }
  async fetch(request){
    if(new URL(request.url).pathname.startsWith('/qa730/'))
      return this.qa730.fetch(request);
    return super.fetch(request);
  }
  async alarm(){
    if(await this.qa730.alarm())return;
    return super.alarm();
  }
}
export default {
  async fetch(request,env,ctx){
    const pathname=new URL(request.url).pathname;
    if(!pathname.startsWith('/qa730/'))
      return originalWorker.fetch(request,env,ctx);
    const cfg=parseOwnerQaConfig583(env?.OWNER583_QA_CONFIG);
    if(!cfg||env?.SORIDRAW_ENVIRONMENT!=='preview'||
       env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1'||
       env?.DB||env?.PROFILE_MEDIA||env?.RATE_DB||
       env?.EXPLORE_CACHE||env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539||
       request.headers.get('X-Owner583-Token')!==cfg.probeToken||
       !env?.OWNER558_DO)
      return respond(403);
    // NEVER use the existing APP583 DO instance for APP730 receipts,
    // to protect the existing QA proof and its alarm/replay state.
    const id=env.OWNER558_DO.idFromName('qa730-isolated-owner-only');
    return env.OWNER558_DO.get(id).fetch(request);
  },
};
