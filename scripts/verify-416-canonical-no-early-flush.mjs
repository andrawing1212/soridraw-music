import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const stage416ClientActive=appVersion>=400&&appVersion<408;
const s=readFileSync('src/services/exploreLikeService.ts','utf8');
const on='STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE';
if(stage416ClientActive) assert.match(s,/const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = true/);
else assert.match(s,/const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.equal((s.match(/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE/g)||[]).length,7,
 'guard scheduler, canonical sender, on-exit, set-like scheduler, publisher, startup recovery and final receipt');
const scheduler=s.slice(s.indexOf('const schedulePendingFlush ='),s.indexOf('const schedulePendingFlush =')+800);
const flush=s.slice(s.indexOf('flushPendingLikes = async'),s.indexOf('flushPendingLikes = async')+700);
const exit=s.slice(s.indexOf('const flushOnExit413 ='),s.indexOf('const flushOnExit413 =')+450);
assert(scheduler.includes('if ('+on+')'));
assert(flush.includes('if ('+on+') return;'));
assert(exit.includes('if ('+on+') return;'));
assert(s.includes('if (!('+on+')) {\n    schedulePendingFlush(user);'));
assert(s.includes('if (STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE &&\n    typeof window !== \'undefined\')'), 'startup recovery is also behind both hard-OFF flags');
assert(s.includes('if (STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE) {\n let receiverUid416'), 'final receipt receiver also behind both hard-OFF flags');
console.log('STAGE416_CANDIDATE_NO_APP399_TIMER_FLUSH_OR_PAGE_EXIT_WRITE=PASS');
console.log(stage416ClientActive
  ? 'STAGE416_APP400_TO_407_NO_EARLY_LEGACY_FLUSH_WHILE_ACTIVE=PASS'
  : appVersion>=408
    ? 'APP408_LEGACY_5SEC_CANONICAL_FLUSH_RESTORED=PASS'
    : 'STAGE416_CURRENT_APP399_5SEC_FLUSH_PRESERVED_OFF=PASS');
