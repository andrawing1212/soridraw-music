// APP704: add safe stage classification ONLY when an authenticated follow
// mutation already fails with HTTP 503. Never change accepted mutations.
import {createHash} from 'node:crypto';
export const hash704=v=>createHash('sha256').update(v).digest('hex');
const fail=s=>{throw Error('APP704_HOLD_'+s)};
function once(s,a,b,label){
 const i=s.indexOf(a);if(i<0||s.indexOf(a,i+a.length)>=0)fail(label+'_MISSING_OR_AMBIGUOUS');
 return s.slice(0,i)+b+s.slice(i+a.length);
}
export function patchFollow503Stage704(src){
 if(typeof src!=='string'||src.length<100000)fail('ACTIVE_SOURCE_SIZE');
 const at=src.indexOf('function handleFollowOverlay354(');
 const end=src.indexOf('\n__name(handleFollowOverlay354',at);
 if(at<0||end<=at)fail('FOLLOW_HANDLER_BOUNDARY');
 const body=src.slice(at,end);
 const native='await enforceFollowEdgeRateLimit355(env, actor, target, following, payload.followOperationId);';
 const wrapNative=`try { ${native} } catch (error) {
    if (Number(error?.status || error?.statusCode) === 503) {
      return json({ok:false,error:{code:"FOLLOW_503_NATIVE_LIMITER",message:"팔로우 요청 제한 서버 연결을 확인해 주세요."}},503,cors);
    }
    throw error;
  }`;
 let updated=once(body,native,wrapNative,'NATIVE_LIMITER_CALL');
 const first='const result2 = await orchestrateFollowOverlay354(';
 const middle='    request\n  );\n  const state = await readFollowProfile354(env, target, cutover);';
 updated=once(updated,first,'let result2;\n  try { result2 = await orchestrateFollowOverlay354(','ORCHESTRATION_BEGIN');
 updated=once(updated,middle,`    request
  );
  } catch(error) {
    if (Number(error?.status || error?.statusCode) === 503) {
      return json({ok:false,error:{code:"FOLLOW_503_ORCHESTRATION",message:"팔로우 관계 저장 서버 연결을 확인해 주세요."}},503,cors);
    }
    throw error;
  }
  const state = await readFollowProfile354(env, target, cutover);`,'ORCHESTRATION_END');
 // No new GET/POST or bypass. Strictly localized to one existing handler.
 if(updated===body||updated.indexOf('FOLLOW_503_NATIVE_LIMITER')<0||
 updated.indexOf('FOLLOW_503_ORCHESTRATION')<0||
 updated.indexOf('await enforceFollowEdgeRateLimit355(')<0||
 updated.indexOf('await orchestrateFollowOverlay354(')<0)fail('PATCH_INVARIANT');
 const out=src.slice(0,at)+updated+src.slice(end);
 if(out.length-src.length>1500||out.length<=src.length)fail('SIZE_INVARIANT');
 return out;
}
