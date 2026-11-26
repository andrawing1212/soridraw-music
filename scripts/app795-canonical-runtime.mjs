// APP795 canonical callsite integration; remains OFF until independently verified shared writer cutover.
// No certificate is manufactured from the old manifest or passed by a client.
import {APP794_PRIVATE_BRIDGE_COMPILED_OPEN} from './app794-preview-private-owner-bridge.mjs';
import {verifyApp794CanonicalWriterFence} from './app792-preview-common-follow.mjs';
export function app795WriterEnabled(env){
 return APP794_PRIVATE_BRIDGE_COMPILED_OPEN && env?.SORIDRAW_ENVIRONMENT==='preview';
}
// Reserved for an independently verified, generation-bound certificate.
// Deliberately fail closed: the existing shared TEST/PROD writers are not fenced.
export async function verifyApp795Cutover(){return null}
const fields=['ownerUid','actorUid','authEpoch','cutoverToken','generation','canonicalOperationId','expectedRevision','priorR2Revision','desired','beforeFollowing','sameStateOnly','operationId','durable','ownerDoAlarmScheduled'];
export function immutableApp795Receipt(a){
 return Object.freeze(Object.fromEntries(fields.filter(k=>a?.[k]!==undefined).map(k=>[k,a[k]])));
}
export async function requireApp795WriterFence({env,operation,reservation,phase,verifyCutover=verifyApp795Cutover}){
 if(!await verifyApp794CanonicalWriterFence({env,operation,reservation,phase,verifyCutover}))throw Error('APP795_EXACT_WRITER_ADMISSION_REQUIRED');
}
