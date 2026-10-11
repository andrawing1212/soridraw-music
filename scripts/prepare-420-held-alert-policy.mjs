// Stage420 HELD alert manifest generator. Source-only: this never deploys
// a policy, writes shared user data, or contacts any Google Cloud API.
// Operator must configure an existing notification channel and explicitly
// apply the generated JSON during the approved coordinated cutover.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const marker='420_DELIVERY_HELD_FOR_OPERATOR';
const projectPattern=/^(?:soridraw-app-866a5|demo-soridraw-stage420)$/;
const documentation =
  'Stage420 Firestore approval has NOT reached the private user signal. '+
  'An exact operationId was preserved at privateLikeGuardV2_420/{uid}/'+
  'deliveryFailures/{operationId}; an authenticated Master must verify '+
  'the existing approval receipt and recover that ONE event. Never '+ 
  'reapprove the click, backfill old UUIDv4, scan all users, or suppress '+
  'this alert merely because a Firestore HOLD write succeeded. '+
  'See DOCS/STAGE420_OPERATOR_RECOVERY_RUNBOOK.md.';
export function createPolicy(project,channel) {
  assert(projectPattern.test(project),
    'must explicitly name the known shared project or isolated demo project');
  assert.equal(channel.startsWith('projects/'+project+'/notificationChannels/'),
    true,'notification channel must belong to the target project');
  const channelId=channel.split('/').pop();
  assert(/^[0-9]+$/.test(channelId),
    'notification channel must be an actual numeric Cloud Monitoring ID');
  return {
    displayName:'SORIDRAW Stage420 terminal receipt HOLD — Master response',
    combiner:'OR',
    enabled:true,
    documentation:{content:documentation,mimeType:'text/markdown'},
    conditions:[{
      displayName:'Cloud Run Functions approval receipt terminal delivery hold',
      conditionMatchedLog:{
        filter:'resource.type="cloud_run_revision" AND severity>=ERROR AND SEARCH("'+marker+'")',
      },
    }],
    alertStrategy:{
      notificationRateLimit:{period:'300s'},
      autoClose:'604800s',
    },
    notificationChannels:[channel],
  };
}

const src=readFileSync('functions/src/exploreLikeAtomicLedgerCandidate420.ts','utf8');
assert(src.includes(marker),'terminal hold must use the exact searchable log marker');
assert(src.includes("state: 'needs-manual-reconciliation'"),
  'a terminal alert must have a corresponding durable Firestore HOLD');
assert(src.includes("logError('420_DELIVERY_HELD_FOR_OPERATOR'"),
  'Firebase structured logger ERROR severity is required for the policy filter');
assert(src.includes("import { error as logError } from 'firebase-functions/logger'"),
  'Cloud Monitoring requires explicit firebase-functions structured logger');
const run=process.argv.slice(2);
if(run.length===1 && run[0]==='--self-test') {
  const project='demo-soridraw-stage420';
  const channel='projects/'+project+'/notificationChannels/123456789';
  const policy=createPolicy(project,channel);
  assert.equal(policy.conditions.length,1);
  assert(policy.conditions[0].conditionMatchedLog.filter.includes(marker));
  assert.equal(policy.enabled,true);
  assert.equal(policy.alertStrategy.notificationRateLimit.period,'300s');
  assert.equal(policy.notificationChannels[0],channel);
  assert.throws(()=>createPolicy('other-project',channel));
  assert.throws(()=>createPolicy(project,'projects/'+project+'/notificationChannels/placeholder'));
  const index=readFileSync('functions/src/index.ts','utf8');
  assert.doesNotMatch(index,/export const createLikeReceiptDeliveryTriggerCandidate420/,
    'an alert manifest does NOT authorize live Eventarc export');
  console.log('STAGE420_OPERATOR_HELD_LOG_ALERT_POLICY_SCHEMA=PASS');
  console.log('STAGE420_OPERATOR_NO_REMOTE_ALERT_OR_EVENTARC_DEPLOY=PASS');
} else if(run.length===4 && run[0]==='--project' && run[2]==='--channel') {
  const policy=createPolicy(run[1],run[3]);
  process.stdout.write(JSON.stringify(policy,null,2)+'\n');
} else {
  process.stderr.write(
    'Usage: node scripts/prepare-420-held-alert-policy.mjs '+
    '--project soridraw-app-866a5 '+
    '--channel projects/soridraw-app-866a5/notificationChannels/NUMERIC_ID\n'+
    'or: node scripts/prepare-420-held-alert-policy.mjs --self-test\n');
  process.exitCode=2;
}
