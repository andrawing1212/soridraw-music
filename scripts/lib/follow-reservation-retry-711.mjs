import {createHash} from 'node:crypto';
export const hash711=s=>createHash('sha256').update(s).digest('hex');
export const ACTIVE_OWNER_SHA711='99f30a31d757de95861a6fb371194ddf82bae40cf03bbc83c5c4090f4eef1223';
export function patchReservationRetry711(source){
 if(hash711(source)!==ACTIVE_OWNER_SHA711)throw Error('APP711_ACTIVE_OWNER_DRIFT');
 const once=(from,to)=>{
  if(source.split(from).length!==2)throw Error('APP711_ANCHOR_DRIFT');
  source=source.replace(from,to);
 };
 once('a.expectedRevision === b.expectedRevision && a.priorR2Revision === b.priorR2Revision',
  'a.expectedRevision === b.expectedRevision && b.priorR2Revision >= a.priorR2Revision');
 once('    if (old) return same(old, record) ? { ok: true, status: "already-reserved", generation: old.generation } : fail("operation-conflict");\n    if (entries.length >= MAX_QUEUE) return fail("owner-queue-full");',
  `    // APP711: preserve the first floor for the exact operation; reject regression.
    if (old && !same(old, record)) return fail("operation-conflict");
    if (old && !old.dead) {
      const scheduled = typeof storage.getAlarm === "function" ? await storage.getAlarm() : null;
      if (!Number.isSafeInteger(scheduled) || scheduled <= now()) await storage.setAlarm(now() + INITIAL_MS);
      return { ok: true, status: "already-reserved", generation: old.generation };
    }
    if (!old && entries.length >= MAX_QUEUE) return fail("owner-queue-full");`);
 once('    const next = {\n      ownerUid: record.ownerUid,',
  `    // Revive only this authenticated exact ticket; fence an older alarm.
    const entry = { ...(old || record), generation, attempts: 0, dead: false, nextAttemptAt: 0 };
    const next = {
      ownerUid: record.ownerUid,`);
 once('      entries: [...entries, { ...record, generation, attempts: 0, dead: false, nextAttemptAt: 0 }]',
  '      entries: old ? entries.map((x) => identity(x) === identity(old) ? entry : x) : [...entries, entry]');
 return source;
}
