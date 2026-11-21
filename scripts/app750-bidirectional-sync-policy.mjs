// APP750: immutable, one-change-set code handoff between PREVIEW and PRODUCTION.
// This policy may authorize a GitHub PR only. It NEVER authorizes any deployment,
// changes to shared resources, backend migrations or a production release.
const SHA=/^[0-9a-f]{40}$/;
const MAX_FILES=25;
const fail=reason=>{throw Error('APP750_SYNC_HOLD_'+reason)};
const VALID_BRANCHES=Object.freeze({preview:'production',production:'preview'});
const APP_FILES=/^(src\/(?!.*(?:\.env|\.pem|\.key)(?:$|\/))[A-Za-z0-9_.@+\/-]+|public\/(?!.*(?:\.env|\.pem|\.key)(?:$|\/))[A-Za-z0-9_.@+\/-]+|index\.html|package\.json|package-lock\.json|vite\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|tsconfig(?:\.[a-z0-9-]+)?\.json)$/;
const RUNTIME_FILES=/^(src\/(?:services|config|firebase|lib|contexts|hooks|stores)\/|src\/(?:App|main)\.|package(?:-lock)?\.json$|vite\.config\.|public\/app-version\.json$)/;
const SAFE_STATUS=new Set(['A','M','D']);
export function assessApp750Sync({origin,sourceSha,sourceParentSha,sourceLiveHead,
  destinationSha,destinationLiveHead,parents,changedFiles}={}){
  const destination=VALID_BRANCHES[origin];
  if(!destination)fail('ORIGIN_NOT_PREVIEW_OR_PRODUCTION');
  for(const [name,v] of Object.entries({sourceSha,sourceParentSha,sourceLiveHead,
     destinationSha,destinationLiveHead}))if(!SHA.test(v||''))fail('INVALID_'+name.toUpperCase());
  if(sourceSha!==sourceLiveHead)fail('SOURCE_BRANCH_MOVED');
  if(destinationSha!==destinationLiveHead)fail('DESTINATION_BRANCH_MOVED');
  if(sourceSha===destinationSha||sourceSha===sourceParentSha)fail('NO_NEW_SOURCE_CHANGE');
  if(!Array.isArray(parents)||parents.length!==1||parents[0]!==sourceParentSha)
    fail('NOT_EXACT_SINGLE_NONMERGE_COMMIT');
  if(!Array.isArray(changedFiles)||changedFiles.length<1||changedFiles.length>MAX_FILES)
    fail('CHANGED_FILE_COUNT_OUT_OF_SCOPE');
  const names=new Set();
  let sensitive=false;
  for(const row of changedFiles){
    const status=String(row?.status||''),path=String(row?.path||'');
    if(!SAFE_STATUS.has(status)||!APP_FILES.test(path)||path.includes('..')||
      path.includes('//')||path.startsWith('/')||names.has(path))
      fail('PROTECTED_OR_UNSUPPORTED_CHANGE');
    names.add(path);
    if(RUNTIME_FILES.test(path)||status==='D')sensitive=true;
  }
  return Object.freeze({status:'CODE_SYNC_PR_ONLY',origin,destination,
    sourceSha,sourceParentSha,destinationSha,fileCount:names.size,
    requiresRuntimeCompatibilityCheck:sensitive,
    targetBranch:destination,
    branchName:'sync/app750-'+origin+'-'+sourceSha.slice(0,12),
    releaseOrder:'PREVIEW_VERIFICATION_THEN_PRODUCTION_GATED',
    productionDeployAuthorized:false,previewDeployAuthorized:false,
    backendOrUserDataMutationAuthorized:false,
    fullBranchMergeAuthorized:false,testEnvironmentUsed:false});
}
