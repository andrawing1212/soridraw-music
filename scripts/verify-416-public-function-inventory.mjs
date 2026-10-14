// Stage416 PREVIEW public Functions — strict, read-only infrastructure inventory.
// No cloud credentials, delete, deploy, network access or shared-data mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';

export function parseInventory416(rows) {
  assert.ok(Array.isArray(rows) && rows.length>0,'416_FUNCTION_INVENTORY_EMPTY_OR_INVALID');
  const byName=new Map();
  for(const fn of rows){
    const name=String(fn?.name||'');
    assert.ok(name.startsWith('projects/')&&name.includes('/locations/')&&
      name.includes('/functions/'),'416_FUNCTION_INVENTORY_NAME_INVALID');
    assert.ok(!byName.has(name),'416_FUNCTION_INVENTORY_DUPLICATE');
    byName.set(name,fn);
  }
  return byName;
}
const shortName416=name=>String(name).split('/').at(-1);
const safeFields416=fn=>JSON.stringify({
  name:fn.name,state:fn.state||'',updateTime:fn.updateTime||'',
  environment:fn.environment||'',buildConfig:fn.buildConfig||null,
  serviceConfig:fn.serviceConfig||null,eventTrigger:fn.eventTrigger||null,
  labels:fn.labels||null,
});
export function compareInventory416(before,after,target,mode){
  const old=parseInventory416(before),now=parseInventory416(after);
  assert.ok(['initial_only','verify_existing'].includes(mode),'416_FUNCTION_RECOVERY_MODE_INVALID');
  assert.ok(['stage416ReleasePublicWindowCandidate','publicLikeRelease416Candidate'].includes(target),
    '416_UNAPPROVED_FUNCTION_TARGET');
  for(const [key,oldFn] of old){
    const current=now.get(key);
    assert.ok(current,'416_UNRELATED_FUNCTION_DELETED:'+key);
    if(shortName416(key)===target && mode==='verify_existing')continue;
    assert.equal(safeFields416(current),safeFields416(oldFn),
      '416_UNRELATED_FUNCTION_CHANGED:'+key);
  }
  const added=[...now.keys()].filter(key=>!old.has(key));
  if(mode==='initial_only'){
    assert.ok(![...old.keys()].some(key=>shortName416(key)===target),
      '416_PUBLIC_FUNCTION_ALREADY_PRESENT_REFUSE_INITIAL_DEPLOY');
    assert.equal(added.length,1,'416_FUNCTION_ADDED_SET_MISMATCH');
    assert.equal(shortName416(added[0]),target,'416_UNRELATED_FUNCTION_ADDED');
  }else{
    assert.equal(added.length,0,'416_RECOVERY_MUTATED_FUNCTION_SET');
    const existing=[...old.keys()].filter(key=>shortName416(key)===target);
    assert.equal(existing.length,1,'416_RECOVERY_CANDIDATE_AMBIGUOUS');
    assert.equal(safeFields416(now.get(existing[0])),safeFields416(old.get(existing[0])),
      '416_RECOVERY_CANDIDATE_CHANGED');
  }
  return {protectedCount:old.size-(mode==='verify_existing'?1:0),target};
}
export function validateAdopt416(fn,target,region){
  assert.ok(fn&&typeof fn==='object'&&!Array.isArray(fn));
  assert.ok(['stage416ReleasePublicWindowCandidate','publicLikeRelease416Candidate'].includes(target));
  assert.equal(shortName416(fn.name),target,'416_RECOVERY_WRONG_CANDIDATE');
  assert.ok(String(fn.name).includes('/locations/'+region+'/functions/'),
    '416_RECOVERY_WRONG_REGION');
  assert.equal(fn.state,'ACTIVE','416_RECOVERY_CANDIDATE_NOT_ACTIVE');
  assert.equal(fn.buildConfig?.runtime,'nodejs22','416_RECOVERY_RUNTIME_INVALID');
  assert.ok(fn.serviceConfig?.secretEnvironmentVariables?.some(x=>
    String(x.secret||x.secretName||'').includes('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET')),
    '416_RECOVERY_SECRET_NOT_BOUND');
  return true;
}
export function diagnoseFailure416(before,after,target){
  const old=parseInventory416(before),now=parseInventory416(after);
  const changed=[...old.keys()].filter(key=>
    !now.has(key)||safeFields416(old.get(key))!==safeFields416(now.get(key)));
  const added=[...now.keys()].filter(key=>!old.has(key));
  const targetRows=[...now.keys()].filter(key=>shortName416(key)===target);
  return {protectedChanges:changed,addedFunctions:added,targetExists:targetRows.length>0,
    recovery:'STOP_REVIEW_BEFORE_FURTHER_MUTATION'};
}
const args=process.argv.slice(2);
if(args[0]){
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  const [mode,first,second,third,fourth]=args;
  if(mode==='baseline'){
    const rows=read(first);
    console.log('416_SHARED_FUNCTIONS_BASELINE=PASS count='+parseInventory416(rows).size);
  }else if(mode==='compare'){
    const ok=compareInventory416(read(first),read(second),third,fourth);
    console.log('416_ALL_EXISTING_FUNCTIONS_UNCHANGED=PASS count='+ok.protectedCount);
  }else if(mode==='adopt'){
    validateAdopt416(read(first),second,third);
    console.log('416_PUBLIC_EXISTING_FUNCTION_ADOPTION_READONLY=PASS');
  }else if(mode==='diagnose'){
    console.log('416_PUBLIC_PARTIAL_FAILURE_STATE='+JSON.stringify(
      diagnoseFailure416(read(first),read(second),third)));
  }else if(mode==='selftest'){
    const mk=(n,t='2026-10-15T01:00:00Z')=>({name:'projects/p/locations/us-central1/functions/'+n,
      state:'ACTIVE',updateTime:t,buildConfig:{runtime:'nodejs22'},
      serviceConfig:{secretEnvironmentVariables:[{secret:'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'}]}});
    const orig=[mk('likeA'),mk('likeB')], target=mk('stage416ReleasePublicWindowCandidate');
    assert.equal(compareInventory416(orig,[...orig,target],
      'stage416ReleasePublicWindowCandidate','initial_only').protectedCount,2);
    assert.throws(()=>compareInventory416(orig,[mk('likeA'),target],
      'stage416ReleasePublicWindowCandidate','initial_only'),/DELETED/);
    assert.throws(()=>compareInventory416(orig,[mk('likeA','changed'),orig[1],target],
      'stage416ReleasePublicWindowCandidate','initial_only'),/CHANGED/);
    assert.throws(()=>compareInventory416(orig,[...orig,target,mk('other')],
      'stage416ReleasePublicWindowCandidate','initial_only'),/ADDED_SET/);
    assert.equal(compareInventory416([...orig,target],[...orig,target],
      'stage416ReleasePublicWindowCandidate','verify_existing').protectedCount,2);
    assert.equal(validateAdopt416(target,'stage416ReleasePublicWindowCandidate','us-central1'),true);
    assert.throws(()=>validateAdopt416({...target,state:'FAILED'},
      'stage416ReleasePublicWindowCandidate','us-central1'),/NOT_ACTIVE/);
    console.log('416_ALL_FUNCTIONS_INVENTORY_ADD_DELETE_DRIFT_RECOVERY=PASS');
  }else throw Error('416_UNKNOWN_FUNCTION_INVENTORY_MODE');
}
