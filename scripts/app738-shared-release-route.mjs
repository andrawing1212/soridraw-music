// Offline release routing only. Does not create credentials or contact a server.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const requiredFalse=['functions_deploy','worker_deploy','release_shared_d1_migration','release_shared_user_data_change','main_test_change','production_change'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('APP738_RELEASE_ROUTE_HOLD_'+x)};
export function classifySharedRelease(raw){
 if(typeof raw!=='string')fail('INPUT');
 const rows=raw.trim().split(/\r?\n/);
 const get=k=>{
  const matches=rows.filter(x=>x.startsWith(k+'='));
  if(matches.length!==1)fail('MISSING_OR_DUPLICATE_'+k);
  const value=matches[0].slice(k.length+1);
  if(value!=='true'&&value!=='false')fail('INVALID_'+k);
  return value==='true';
 };
 const hosting=get('deploy_hosting'),rules=get('deploy_shared_rtdb_rules');
 for(const k of requiredFalse)if(get(k))fail('FOREIGN_SCOPE_'+k);
 // Mixed requests must not silently drop either component or race.
 if(hosting&&rules)fail('MIXED_REQUIRES_SEPARATE_APPROVALS');
 if(!hosting&&!rules)fail('EMPTY_SCOPE');
 return hosting?'hosting':'rules';
}
export function verifyRulesOnlyApproval({raw,approval,triggerSha256}={}){
 if(classifySharedRelease(raw)!=='rules')fail('NOT_RULES_ONLY');
 if(approval!=='APPLY_SHARED_RTDB_RULES_ONLY'||! /^[a-f0-9]{64}$/.test(triggerSha256||'')||sha(raw)!==triggerSha256)fail('EXACT_RULES_APPROVAL_REQUIRED');
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const raw=readFileSync('.deploy/preview-app-release.trigger','utf8');
  if(process.argv[2]!=='rules')fail('UNKNOWN_MODE');
  verifyRulesOnlyApproval({raw,approval:process.env.APPROVAL,triggerSha256:process.env.TRIGGER_SHA256});
  console.log('APP738_RULES_ONLY_ROUTE_PASS');
 }catch(e){console.error(e.message);process.exitCode=2;}
}
