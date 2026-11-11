// APP566: compose a reviewable follow-guard Worker candidate without changing
// canonical/preview-worker.js or touching deployed shared backends.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const MARKER='// SORIDRAW_SOCIAL_ABUSE_STATE_380_20261008';
const OLD_POLICY='cooldowns: [30_000, 120_000, 600_000, 3_600_000]';
const NEW_POLICY='cooldowns: [0, 0, 0, 30_000]';
const LIKE_POLICY='cooldowns: [30_000, 60_000, 300_000, 1_800_000]';
const HASH=s=>createHash('sha256').update(s).digest('hex');

export function composeFollowGuard566(frozen,modifiedGuard,expectedSha){
 if(typeof frozen!=='string'||typeof modifiedGuard!=='string'||
   !/^[0-9a-f]{64}$/.test(expectedSha)||HASH(frozen)!==expectedSha)
  throw Error('APP566_FROZEN_CANONICAL_SHA_MISMATCH_HOLD');
 const at=frozen.indexOf(MARKER);
 if(at<0||at!==frozen.lastIndexOf(MARKER)||
   !frozen.slice(at).includes(OLD_POLICY)||
   !frozen.slice(at).includes(LIKE_POLICY)||
   !frozen.slice(at).trimEnd().endsWith('socialAbuseUnavailable380();\n}'))
  throw Error('APP566_FOLLOW_GUARD_BOUNDARY_DRIFT_HOLD');
 if(!modifiedGuard.startsWith(MARKER)||
   modifiedGuard.indexOf(MARKER)!==modifiedGuard.lastIndexOf(MARKER)||
   !modifiedGuard.includes(NEW_POLICY)||modifiedGuard.includes(OLD_POLICY)||
   !modifiedGuard.includes(LIKE_POLICY)||
   !modifiedGuard.includes('LEGACY_FOLLOW_COOLDOWNS_380')||
   !modifiedGuard.includes('if (domain === \'like\') blockedUntil')||
   !modifiedGuard.trimEnd().endsWith('socialAbuseUnavailable380();\n}'))
  throw Error('APP566_REPLACEMENT_GUARD_INVALID_HOLD');
 const merged=frozen.slice(0,at)+modifiedGuard.trimEnd()+'\n';
 if(merged===frozen||merged.indexOf(MARKER)!==merged.lastIndexOf(MARKER))
  throw Error('APP566_CANDIDATE_NOT_CHANGED_HOLD');
 return merged;
}

// Manual release-candidate generation only. Never replaces a canonical file or
// deploys a Worker, and refuses an output path under the canonical directory.
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const at=process.argv.indexOf('--out');
 if(at<0||at!==process.argv.length-2)throw Error('APP566_EXPLICIT_OUTPUT_REQUIRED');
 const output=resolve(process.argv[at+1]);
 const canonicalDir=resolve('cloudflare/explore-worker/canonical');
 if(output.startsWith(canonicalDir+'/')||output===canonicalDir||
   basename(output)==='preview-worker.js')throw Error('APP566_CANONICAL_OUTPUT_FORBIDDEN');
 const frozen=readFileSync(canonicalDir+'/preview-worker.js','utf8');
 const expected=readFileSync(canonicalDir+'/source-sha256.txt','utf8').trim();
 const guard=readFileSync('cloudflare/explore-worker/candidates/social-abuse-380.js','utf8');
 writeFileSync(output,composeFollowGuard566(frozen,guard,expected),'utf8');
 console.log('APP566_FOLLOW_ONLY_CANDIDATE_WRITTEN_NO_DEPLOY='+output);
}
