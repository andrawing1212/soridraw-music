import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('src/services/exploreLikeService.ts','utf8');
const on='STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE';
assert.match(s,/const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.equal((s.match(/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE/g)||[]).length,6,
 'guard scheduler, canonical sender, on-exit, set-like scheduler, publisher and startup recovery');
const scheduler=s.slice(s.indexOf('const schedulePendingFlush ='),s.indexOf('const schedulePendingFlush =')+800);
const flush=s.slice(s.indexOf('flushPendingLikes = async'),s.indexOf('flushPendingLikes = async')+700);
const exit=s.slice(s.indexOf('const flushOnExit413 ='),s.indexOf('const flushOnExit413 =')+450);
assert(scheduler.includes('if ('+on+')'));
assert(flush.includes('if ('+on+') return;'));
assert(exit.includes('if ('+on+') return;'));
assert(s.includes('if (!('+on+')) {\n    schedulePendingFlush(user);'));
assert(s.includes('if (STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE &&\n    typeof window !== \'undefined\')'), 'startup recovery is also behind both hard-OFF flags');
console.log('STAGE416_CANDIDATE_NO_APP399_TIMER_FLUSH_OR_PAGE_EXIT_WRITE=PASS');
console.log('STAGE416_CURRENT_APP399_5SEC_FLUSH_PRESERVED_OFF=PASS');
