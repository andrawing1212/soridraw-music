# APP786 SORIDRAW QA one-time bootstrap. PowerShell 5.1+.
# Never use Google production, shared Firebase data, or service-account keys.
# Default: read-only plan. -Apply: bounded QA setup after one confirmation.
[CmdletBinding()]
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Project='soridraw-app'
$Number='1083981050742'
$Region='asia-northeast3'
$RepoId='1188157610'
$Pool='soridraw-qa-github'
$Provider='app518-readonly'
$Reader='soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com'
$Deployer='soridraw-qa-gh-deployer@soridraw-app.iam.gserviceaccount.com'
$Runtime='soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com'
$SecretName='SORIDRAW_CATALOG_SERVER_HMAC_518'
$Expires='2026-12-01T15:00:00Z'
$TemporaryCondition="expression=request.time < timestamp('$Expires'),title=APP518_QA_TEMP_TO_20261202,description=QA_ONLY_AUTO_EXPIRES"
$Principal="principalSet://iam.googleapis.com/projects/$Number/locations/global/workloadIdentityPools/$Pool/attribute.repository_id/$RepoId"

function Stop-Hold([string]$reason){throw "APP786 HOLD: $reason"}
function G([string[]]$Argv){
  $prev=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  try{
    $lines=@(& gcloud @Argv 2>&1)
    $exit=$LASTEXITCODE
  } finally {$ErrorActionPreference=$prev}
  if($exit -ne 0){
    $message=($lines | Out-String).Trim()
    if($message.Length -gt 500){$message=$message.Substring(0,500)}
    Stop-Hold ("gcloud command failed: "+($Argv[0..([Math]::Min($Argv.Count-1,2))] -join ' ')+"; "+$message)
  }
  return ($lines | Out-String).Trim()
}
function GJson([string[]]$Argv){
  $raw=G ($Argv+@('--format=json','--quiet'))
  if(!$raw){return @()}
  try{return ConvertFrom-Json -InputObject $raw} catch {Stop-Hold 'Unexpected gcloud JSON response'}
}
function Rows($value){return @($value | Where-Object { $null -ne $_ })}
function Assert-Project(){
  $num=(G @('projects','describe',$Project,'--format=value(projectNumber)','--quiet')).Trim()
  if($num -ne $Number){Stop-Hold 'QA project number does not match. No mutations.'}
}
function Find-MemberRole($policy,[string]$role,[string]$member){
  if($null -eq $policy -or $null -eq $policy.PSObject.Properties['bindings']){return @()}
  return @(Rows $policy.bindings | Where-Object {
    $_.role -eq $role -and (@($_.members) -contains $member)
  })
}
function Ensure-ProjectRole([string]$member,[string]$role,[bool]$temporary){
  $policy=GJson @('projects','get-iam-policy',$Project)
  $exists=@(Find-MemberRole $policy $role $member)
  if($exists.Count -gt 0){
    if($temporary){
      foreach($binding in $exists){
        if($null -eq $binding.PSObject.Properties['condition'] -or
          [string]$binding.condition.expression -notlike '*2026-12-01T15:00:00Z*'){
          Stop-Hold "Pre-existing broad or differently expiring QA deployer role $role; manual IAM review required"
        }
      }
    }
    Write-Host "SKIP existing role: $role"
    return
  }
  $cond=if($temporary){$TemporaryCondition}else{'None'}
  G @('projects','add-iam-policy-binding',$Project,"--member=$member","--role=$role","--condition=$cond",'--quiet') | Out-Null
  Write-Host "PASS QA role: $role"
}
function Ensure-ServiceAccount([string]$id){
  $email="$id@$Project.iam.gserviceaccount.com"
  $accounts=Rows (GJson @('iam','service-accounts','list',"--project=$Project"))
  if(@($accounts|Where-Object {$_.email -eq $email}).Count -gt 0){Write-Host "SKIP QA SA: $id";return}
  G @('iam','service-accounts','create',$id,"--project=$Project","--display-name=SORIDRAW QA APP518 $id",'--quiet')|Out-Null
  Write-Host "PASS QA SA: $id"
}
function Ensure-SaRole([string]$sa,[string]$member,[string]$role,[bool]$temporary){
  $policy=GJson @('iam','service-accounts','get-iam-policy',$sa,"--project=$Project")
  $exists=Find-MemberRole $policy $role $member
  if($exists.Count -gt 0){Write-Host "SKIP SA binding: $role";return}
  $cond=if($temporary){$TemporaryCondition}else{'None'}
  G @('iam','service-accounts','add-iam-policy-binding',$sa,"--project=$Project","--member=$member","--role=$role","--condition=$cond",'--quiet')|Out-Null
  Write-Host "PASS QA SA binding: $role"
}
function Ensure-SecretAccess([string]$email){
  $member="serviceAccount:$email"
  $policy=GJson @('secrets','get-iam-policy',$SecretName,"--project=$Project")
  $exists=@(Find-MemberRole $policy 'roles/secretmanager.secretAccessor' $member)
  if($exists.Count -gt 0){return}
  G @('secrets','add-iam-policy-binding',$SecretName,"--project=$Project","--member=$member",'--role=roles/secretmanager.secretAccessor','--quiet')|Out-Null
  Write-Host 'PASS exact QA secret access'
}
if(!(Get-Command gcloud -ErrorAction SilentlyContinue)){
  Stop-Hold 'Google Cloud CLI missing. Install from https://cloud.google.com/sdk/docs/install and reopen PowerShell.'
}
$active=(G @('auth','list','--filter=status:ACTIVE','--format=value(account)','--quiet')).Trim()
if(!$active){
  Write-Host 'Google browser login is needed once.'
  & gcloud auth login
  if($LASTEXITCODE -ne 0){Stop-Hold 'Google login not completed'}
}
Assert-Project
Write-Host "PASS exact QA project $Project ($Number)"
$providerInfo=GJson @('iam','workload-identity-pools','providers','describe',$Provider,"--workload-identity-pool=$Pool",'--location=global',"--project=$Project")
$cond=[string]$providerInfo.attributeCondition
$normalized=($cond -replace '\s+','')
if($normalized.Contains('||') -or $normalized.Contains(' or ')){
  Stop-Hold 'QA WIF provider contains an unapproved OR condition'
}
foreach($required in @(
  "assertion.repository_id=='1188157610'",
  "assertion.repository_owner_id=='268937716'",
  "assertion.event_name=='issue_comment'",
  "assertion.ref=='refs/heads/main'",
  "assertion.workflow_ref=='andrawing1212/soridraw-music/.github/workflows/app782-app518-qa-firebase-wif-readonly.yml@refs/heads/main'"
)){
  if(!$normalized.Contains($required)){Stop-Hold "Existing QA WIF provider condition mismatch"}
}
$mapping=$providerInfo.attributeMapping
foreach($entry in @(
  @('google.subject','assertion.sub'),
  @('attribute.repository_id','assertion.repository_id'),
  @('attribute.repository_owner_id','assertion.repository_owner_id')
)){
  $mapped=$mapping.PSObject.Properties[$entry[0]]
  if($null -eq $mapped -or [string]$mapped.Value -ne $entry[1]){
    Stop-Hold 'Existing QA WIF provider attribute mapping mismatch'
  }
}
if([string]$providerInfo.oidc.issuerUri -ne 'https://token.actions.githubusercontent.com'){
  Stop-Hold 'Unexpected OIDC issuer in QA provider'
}
Write-Host 'PASS existing QA OIDC provider/condition (unchanged)'
$databases=@(Rows (GJson @('firestore','databases','list',"--project=$Project")))
$default=@($databases | Where-Object {$_.name -eq "projects/$Project/databases/(default)"})
if($default.Count -gt 1){Stop-Hold 'More than one default database'}
if($default.Count -eq 0 -and $databases.Count -ne 0){
  Stop-Hold 'Other QA Firestore DBs exist; do not infer regional compatibility'
}
if($default.Count -eq 1){
  $db=$default[0]
  if([string]$db.locationId -ne $Region -or [string]$db.type -ne 'FIRESTORE_NATIVE' -or
     ([string]$db.databaseEdition -and [string]$db.databaseEdition -ne 'STANDARD')){
    Stop-Hold 'Existing default database has unexpected location/type/edition'
  }
  Write-Host 'PASS existing QA Firestore (default)'
}else{Write-Host 'PLAN QA Firestore (default) Standard/Native, Seoul, delete-protection'}
$billing=GJson @('billing','projects','describe',$Project)
if($billing.billingEnabled -ne $true -or [string]$billing.billingAccountName -notmatch '^billingAccounts/[A-Za-z0-9-]+$'){
  Stop-Hold 'QA billing connection not verified'
}
$billingId=([string]$billing.billingAccountName).Substring('billingAccounts/'.Length)
$billingAccount=GJson @('billing','accounts','describe',$billingId)
$currency=[string]$billingAccount.currencyCode
switch($currency){
  'KRW' { $BudgetName='SORIDRAW-APP518-QA-MONTHLY-5000KRW'; $BudgetAmount='5000KRW'; $BudgetUnits=5000 }
  'USD' { $BudgetName='SORIDRAW-APP518-QA-MONTHLY-5USD'; $BudgetAmount='5USD'; $BudgetUnits=5 }
  default { Stop-Hold 'Unsupported QA billing currency. No budget created.' }
}
$budgets=@(Rows (GJson @('billing','budgets','list',"--billing-account=$billingId")))
$sameName=@($budgets | Where-Object { $_.displayName -eq $BudgetName })
if($sameName.Count -gt 1){Stop-Hold 'Duplicate named QA budgets; manual review required'}
if($sameName.Count -eq 1){
  $scope=@($sameName[0].budgetFilter.projects)
  if($scope.Count -ne 1 -or $scope[0] -ne "projects/$Project"){
    Stop-Hold 'Existing named QA budget is not scoped to exact QA project'
  }
  $amount=$sameName[0].amount.specifiedAmount
  if([string]$amount.currencyCode -ne $currency -or [decimal]$amount.units -ne $BudgetUnits){
    Stop-Hold 'Existing named QA budget amount/currency mismatch'
  }
  $existingBudget=$sameName
}else{$existingBudget=@()}
if($existingBudget.Count -eq 0){Write-Host "PLAN $BudgetAmount/month QA-only budget alert"}
else{Write-Host "PASS existing QA-only $BudgetAmount budget alert"}
$buildInfo=GJson @('builds','get-default-service-account',"--project=$Project","--region=$Region")
$buildRef=[string]$buildInfo.serviceAccountEmail
if($buildRef -notmatch ('^projects/[^/]+/serviceAccounts/'+[regex]::Escape($Number)+'(-compute@developer\.gserviceaccount\.com|@cloudbuild\.gserviceaccount\.com)$')){
  Stop-Hold 'Cloud Build SA not exactly identified as QA project-owned'
}
$buildSa=$buildRef.Split('/')[-1]
Write-Host 'PASS identified QA Cloud Build SA'
if(!$Apply){
  Write-Host 'PLAN ONLY. No Google resources changed.'
  Write-Host 'To apply: powershell -ExecutionPolicy Bypass -File .\app786-qa-windows-bootstrap.ps1 -Apply'
  exit 0
}
if([DateTimeOffset]::UtcNow -gt [DateTimeOffset]::Parse($Expires).AddDays(-1)){
  Stop-Hold 'Temporary role expiry is too close. Update the audited expiry.'
}
Write-Host 'ABOUT TO MODIFY QA ONLY: budget, optional Firestore, two SAs, limited IAM, one HMAC secret.'
$answer=(Read-Host 'Type EXACTLY SORIDRAW-QA to proceed')
if($answer -cne 'SORIDRAW-QA'){Stop-Hold 'No confirmation; no resources changed'}
if($existingBudget.Count -eq 0){
  G @('billing','budgets','create',"--billing-account=$billingId","--display-name=$BudgetName","--budget-amount=$BudgetAmount",'--calendar-period=month',"--filter-projects=projects/$Project",'--threshold-rule=percent=0.5','--threshold-rule=percent=0.9','--threshold-rule=percent=1.0','--quiet')|Out-Null
  $createdBudgets=@(Rows (GJson @('billing','budgets','list',"--billing-account=$billingId")))
  $created=@($createdBudgets|Where-Object {$_.displayName -eq $BudgetName})
  if($created.Count -ne 1 -or @($created[0].budgetFilter.projects).Count -ne 1 -or
     @($created[0].budgetFilter.projects)[0] -ne "projects/$Project"){
    Stop-Hold 'QA budget create returned, but exact project scope not confirmed'
  }
  Write-Host "PASS QA $BudgetAmount monthly alert (NOT a hard spending cap)"
}
if($default.Count -eq 0){
  G @('firestore','databases','create',"--project=$Project",'--database=(default)',"--location=$Region",'--type=firestore-native','--edition=standard','--delete-protection','--quiet')|Out-Null
  $created=GJson @('firestore','databases','describe','--database=(default)',"--project=$Project")
  if([string]$created.locationId -ne $Region){Stop-Hold 'Firestore created, but verification failed'}
  Write-Host 'PASS QA (default) Firestore database created; Firebase client rules still require verification'
}
Ensure-ServiceAccount 'soridraw-qa-app518-runtime'
Ensure-ServiceAccount 'soridraw-qa-gh-deployer'
Ensure-ProjectRole "serviceAccount:$Runtime" 'roles/datastore.user' $false
$deployerMember="serviceAccount:$Deployer"
foreach($role in @('roles/cloudfunctions.developer','roles/cloudbuild.builds.editor','roles/run.admin','roles/serviceusage.serviceUsageConsumer','roles/datastore.user')){
  Ensure-ProjectRole $deployerMember $role $true
}
Ensure-SaRole $Runtime $deployerMember 'roles/iam.serviceAccountUser' $true
Ensure-SaRole $buildSa $deployerMember 'roles/iam.serviceAccountUser' $true
Ensure-SaRole $Deployer $Principal 'roles/iam.workloadIdentityUser' $false

$secrets=@(Rows (GJson @('secrets','list',"--project=$Project")))
$found=@($secrets|Where-Object {$_.name -eq "projects/$Number/secrets/$SecretName" -or $_.name -eq "projects/$Project/secrets/$SecretName"})
if($found.Count -eq 0){
  G @('secrets','create',$SecretName,"--project=$Project",'--replication-policy=automatic','--quiet')|Out-Null
}
$versions=@(Rows (GJson @('secrets','versions','list',$SecretName,"--project=$Project")))
if($versions.Count -eq 0){
  $random=New-Object byte[] 48
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($random)}finally{$rng.Dispose()}
  $tmp=[System.IO.Path]::GetTempFileName()
  try{
    [System.IO.File]::WriteAllText($tmp,[Convert]::ToBase64String($random),[Text.Encoding]::ASCII)
    G @('secrets','versions','add',$SecretName,"--project=$Project","--data-file=$tmp",'--quiet')|Out-Null
  }finally{
    [Array]::Clear($random,0,$random.Length)
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}
Ensure-SecretAccess $Deployer
Ensure-SecretAccess $Runtime
Write-Host 'APP786_QA_BOOTSTRAP_PASS: exact QA only; no application/Worker deploy or user data writes.'
Write-Host 'IAM temporary grant expiry: 2026-12-02 00:00 KST (must be reviewed/revoked earlier after test).'
Write-Host 'Firestore client security rules require an independent deny-all verification before live QA.'
