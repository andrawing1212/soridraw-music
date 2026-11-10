// APP543: produce a pinned, reviewable, alternative Worker artifact without
// modifying canonical/preview-worker.js or breaking Stage416 immutable SHA.
// Use only in an explicit future approved Worker release's temporary directory.
// No live deployment, D1 change or backend activation is performed here.
import {createHash} from 'node:crypto';
export const CANONICAL_SHA_543='916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88';
const ORIGINAL="  const now = Date.now();\n  const stats = await adjustExploreFollowCountersDelta(env, authContext.uid, targetUid, shouldFollow, now);\n  await patchExploreFirstViewFollowCounts(env, authContext.uid, targetUid, stats, now);";
const REPLACEMENT="  const now = Date.now();\n  // APP543: no additional query until separately approved, deployed and\n  // per-owner Firebase Admin enrollment is durably bound to canonical D1.\n  // The overlay354 path returns above; historical unenrolled accounts use\n  // the original counter writer unchanged.\n  const ownerEpoch543 = await resolveOwnerFollowWriter543({\n    env, targetUid, mode: followCutover348.mode,\n  });\n  const stats = ownerEpoch543\n    ? await adjustExploreFollowCountersDelta540(\n        env, authContext.uid, targetUid, shouldFollow, now, ownerEpoch543)\n    : await adjustExploreFollowCountersDelta(\n        env, authContext.uid, targetUid, shouldFollow, now);\n  await patchExploreFirstViewFollowCounts(env, authContext.uid, targetUid, stats, now);";
const IMPORTS="import {resolveOwnerFollowWriter543} from '../runtime/owner-follow-writer-543.mjs';\nimport {adjustExploreFollowCountersDelta540} from '../runtime/owner-follow-inline-canonical-540.mjs';\n";
const digest=s=>createHash('sha256').update(s).digest('hex');
export function composeOwnerFollowWorker543(source){
 if(digest(source)!==CANONICAL_SHA_543)
  throw Error('543_CANONICAL_WORKER_SHA_CHANGED_HOLD');
 if(source.split(ORIGINAL).length!==2||source.includes('resolveOwnerFollowWriter543'))
  throw Error('543_CANONICAL_CALLSITE_NOT_EXACT');
 return IMPORTS+source.replace(ORIGINAL,REPLACEMENT);
}
