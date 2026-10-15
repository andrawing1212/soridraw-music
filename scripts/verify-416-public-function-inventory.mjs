// Stage416 PREVIEW Functions — strict, read-only infrastructure inventory.
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
const normalizeEventTrigger416=trigger=>{
  if(!trigger||typeof trigger!=='object')return trigger||null;
  const out={...trigger};
  if(Array.isArray(out.eventFilters)){
    out.eventFilters=[...out.eventFilters]
      .map(item=>item&&typeof item==='object'?{...item}:item)
      .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return out;
};
const safeFields416=fn=>JSON.stringify({
  name:fn.name,state:fn.state||'',updateTime:fn.updateTime||'',
  environment:fn.environment||'',buildConfig:fn.buildConfig||null,
  serviceConfig:fn.serviceConfig||null,
  eventTrigger:normalizeEventTrigger416(fn.eventTrigger||null),
  labels:fn.labels||null,
});
const INITIAL_TARGETS_416=new Set([
  'stage416ReleasePublicWindowCandidate',
  'publicLikeRelease416Candidate',
]);
const AUDITED_UPDATE_TARGETS_416=new Set([
  'recordPrivateLike416',
  'privateLikeFinalReceipt416Candidate',
  'stage416ReleasePublicWindowCandidate',
  'publicLikeRelease416Candidate',
]);

export function compareInventory416(before,after,target,mode){
  const old=parseInventory416(before),now=parseInventory416(after);
  if(mode==='initial_only'){
    assert.ok(INITIAL_TARGETS_416.has(target),'416_UNAPPROVED_FUNCTION_TARGET');
    for(const [key,oldFn] of old){
      const current=now.get(key);
      assert.ok(current,'416_UNRELATED_FUNCTION_DELETED:'+key);
      assert.equal(safeFields416(current),safeFields416(oldFn),
        '416_UNRELATED_FUNCTION_CHANGED:'+key);
    }
    const added=[...now.keys()].filter(key=>!old.has(key));
    assert.ok(![...old.keys()].some(key=>shortName416(key)===target),
      '416_PUBLIC_FUNCTION_ALREADY_PRESENT_REFUSE_INITIAL_DEPLOY');
    assert.equal(added.length,1,'416_FUNCTION_ADDED_SET_MISMATCH');
    assert.equal(shortName416(added[0]),target,'416_UNRELATED_FUNCTION_ADDED');
    return {protectedCount:old.size,target,mode};
  }

  assert.equal(mode,'audited_update_only','416_UNVERIFIED_RECOVERY_MODE_REFUSED');
  assert.ok(AUDITED_UPDATE_TARGETS_416.has(target),'416_UNAPPROVED_FUNCTION_TARGET');
  const oldTarget=[...old.entries()].filter(([key])=>shortName416(key)===target);
  const newTarget=[...now.entries()].filter(([key])=>shortName416(key)===target);
  assert.equal(oldTarget.length,1,'416_AUDITED_UPDATE_TARGET_MISSING_BEFORE');
  assert.equal(newTarget.length,1,'416_AUDITED_UPDATE_TARGET_MISSING_AFTER');
  assert.equal(old.size,now.size,'416_AUDITED_UPDATE_FUNCTION_COUNT_DRIFT');
  const added=[...now.keys()].filter(key=>!old.has(key));
  const deleted=[...old.keys()].filter(key=>!now.has(key));
  assert.equal(added.length,0,'416_AUDITED_UPDATE_UNRELATED_FUNCTION_ADDED');
  assert.equal(deleted.length,0,'416_AUDITED_UPDATE_FUNCTION_DELETED');

  const targetKey=oldTarget[0][0];
  assert.equal(newTarget[0][0],targetKey,'416_AUDITED_UPDATE_TARGET_IDENTITY_CHANGED');
  for(const [key,oldFn] of old){
    const current=now.get(key);
    assert.ok(current,'416_AUDITED_UPDATE_FUNCTION_DELETED:'+key);
    if(key===targetKey){
      assert.equal(current.state,'ACTIVE','416_AUDITED_UPDATE_TARGET_NOT_ACTIVE');
      assert.equal(current.buildConfig?.runtime,'nodejs22',
        '416_AUDITED_UPDATE_TARGET_RUNTIME_DRIFT');
      assert.equal(current.serviceConfig?.serviceAccountEmail,
        oldFn.serviceConfig?.serviceAccountEmail,
        '416_AUDITED_UPDATE_TARGET_SERVICE_ACCOUNT_DRIFT');
      continue;
    }
    assert.equal(safeFields416(current),safeFields416(oldFn),
      '416_UNRELATED_FUNCTION_CHANGED:'+key);
  }
  return {protectedCount:old.size-1,target,mode,
    beforeUpdateTime:oldTarget[0][1].updateTime||'',
    afterUpdateTime:newTarget[0][1].updateTime||''};
}

export function validateAdopt416(_fn,_target,_region){
  // Metadata cannot attest deployed source. Never adopt blindly.
  throw Error('416_RECOVERY_SOURCE_NOT_ATTESTED_STOP');
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
    console.log('416_FUNCTION_INVENTORY_COMPARE=PASS mode='+ok.mode+
      ' protected='+ok.protectedCount+' target='+ok.target);
  }else if(mode==='adopt'){
    validateAdopt416(read(first),second,third);
    throw Error('416_PUBLIC_UNVERIFIED_ADOPTION_DENIED');
  }else if(mode==='diagnose'){
    console.log('416_PUBLIC_PARTIAL_FAILURE_STATE='+JSON.stringify(
      diagnoseFailure416(read(first),read(second),third)));
  }else if(mode==='selftest'){
    const mk=(n,t='2026-10-15T01:00:00Z',region='us-central1')=>({
      name:'projects/p/locations/'+region+'/functions/'+n,
      state:'ACTIVE',updateTime:t,buildConfig:{runtime:'nodejs22'},
      serviceConfig:{serviceAccountEmail:'stage416@example.iam.gserviceaccount.com',
        secretEnvironmentVariables:[{secret:'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'}]},
    });
    const orig=[mk('likeA'),mk('likeB')], target=mk('stage416ReleasePublicWindowCandidate');
    const refFilter={attribute:'ref',operator:'match-path-pattern',value:'privateLikeBatch416/{uid}/window'};
    const instanceFilter={attribute:'instance',operator:'match-path-pattern',value:'*'};
    const withFilters=(fn,filters)=>({...fn,eventTrigger:{
      eventType:'google.firebase.database.ref.v1.created',
      eventFilters:filters,
      retryPolicy:'RETRY_POLICY_DO_NOT_RETRY',
    }});
    const ordered=withFilters(orig[0],[refFilter,instanceFilter]);
    const reordered=withFilters(orig[0],[instanceFilter,refFilter]);
    assert.equal(safeFields416(ordered),safeFields416(reordered),
      '416_EVENT_FILTER_ORDER_MUST_BE_SEMANTICALLY_STABLE');
    const changedFilter=withFilters(orig[0],[instanceFilter,{...refFilter,
      value:'privateLikeBatch416/CHANGED/window'}]);
    assert.notEqual(safeFields416(ordered),safeFields416(changedFilter),
      '416_EVENT_FILTER_VALUE_CHANGE_MUST_STILL_FAIL');
    assert.equal(compareInventory416([ordered,orig[1]],[reordered,orig[1],target],
      'stage416ReleasePublicWindowCandidate','initial_only').protectedCount,2);
    assert.throws(()=>compareInventory416([ordered,orig[1]],[changedFilter,orig[1],target],
      'stage416ReleasePublicWindowCandidate','initial_only'),/CHANGED/);
    assert.equal(compareInventory416(orig,[...orig,target],
      'stage416ReleasePublicWindowCandidate','initial_only').protectedCount,2);
    assert.throws(()=>compareInventory416(orig,[mk('likeA'),target],
      'stage416ReleasePublicWindowCandidate','initial_only'),/DELETED/);
    assert.throws(()=>compareInventory416(orig,[mk('likeA','changed'),orig[1],target],
      'stage416ReleasePublicWindowCandidate','initial_only'),/CHANGED/);
    assert.throws(()=>compareInventory416(orig,[...orig,target,mk('other')],
      'stage416ReleasePublicWindowCandidate','initial_only'),/ADDED_SET/);

    const existingPublic=mk('stage416ReleasePublicWindowCandidate');
    const updatedPublic=mk('stage416ReleasePublicWindowCandidate',
      '2026-10-15T02:00:00Z');
    const existingReceipt=mk('publicLikeRelease416Candidate',
      '2026-10-15T01:00:00Z','asia-northeast3');
    const updatedReceipt=mk('publicLikeRelease416Candidate',
      '2026-10-15T02:00:00Z','asia-northeast3');
    const base39=[...orig,existingPublic,existingReceipt];
    assert.equal(compareInventory416(base39,
      [...orig,updatedPublic,existingReceipt],
      'stage416ReleasePublicWindowCandidate','audited_update_only').protectedCount,3);
    assert.equal(compareInventory416(base39,
      [...orig,existingPublic,updatedReceipt],
      'publicLikeRelease416Candidate','audited_update_only').protectedCount,3);
    assert.throws(()=>compareInventory416(base39,
      [mk('likeA','changed'),orig[1],updatedPublic,existingReceipt],
      'stage416ReleasePublicWindowCandidate','audited_update_only'),/UNRELATED_FUNCTION_CHANGED/);
    assert.throws(()=>compareInventory416(base39,
      [...base39,mk('other')],
      'stage416ReleasePublicWindowCandidate','audited_update_only'),/COUNT_DRIFT|ADDED/);
    assert.throws(()=>compareInventory416(base39,
      [...orig,existingReceipt],
      'stage416ReleasePublicWindowCandidate','audited_update_only'),/MISSING_AFTER|COUNT_DRIFT/);
    assert.throws(()=>compareInventory416([...orig,target],[...orig,target],
      'stage416ReleasePublicWindowCandidate','verify_existing'),
      /UNVERIFIED_RECOVERY_MODE_REFUSED/);
    assert.throws(()=>validateAdopt416(target,'stage416ReleasePublicWindowCandidate','us-central1'),
      /RECOVERY_SOURCE_NOT_ATTESTED_STOP/);
    assert.throws(()=>validateAdopt416({...target,state:'ACTIVE',deployedSource:'DIFFERENT_CODE'},
      'stage416ReleasePublicWindowCandidate','us-central1'),/RECOVERY_SOURCE_NOT_ATTESTED_STOP/);
    console.log('416_ALL_FUNCTIONS_INVENTORY_ADD_DELETE_DRIFT_RECOVERY=PASS');
    console.log('416_AUDITED_EXISTING_UPDATE_ONLY_SELFTEST=PASS');
  }else throw Error('416_UNKNOWN_FUNCTION_INVENTORY_MODE');
}
