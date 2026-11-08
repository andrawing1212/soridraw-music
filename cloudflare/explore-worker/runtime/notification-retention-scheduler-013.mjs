// Stage013: dormant notification-only scheduled hook. No cron is registered.
// Activation requires a separately approved release after all indexed tables
// exist. Never run this from fetch(), page load, login or an inbox read.
import {runNotificationRetention005}
  from './notification-retention-coordinator-005.mjs';
import {NOTIFICATION_RETENTION_MS_002}
  from './notification-preferences-retention-002.mjs';

// Proposed hourly UTC schedule, NOT present in any Wrangler triggers.crons.
// Bounded to 8 passes * 200 rows per category. Backlog is reported, not
// drained without bounds. Scale/cost must be reviewed before activation.
export const NOTIFICATION_RETENTION_CRON_013 = '37 * * * *';
export const NOTIFICATION_RETENTION_BATCH_LIMIT_013 = 200;
export const NOTIFICATION_RETENTION_MAX_PASSES_013 = 8;
const indices = [
  'idx_soridraw_notification_expiry_002',
  'idx_soridraw_direct_expiry_004',
  'idx_soridraw_global_expiry_005',
];
const failed = code => Object.assign(new Error(code), {code});
const zero = status => ({status,passes:0,rowsDeleted:0,r2Writes:0,
  byCategory:{social:0,direct:0,announcement:0}});
const bounded = (n,min,max) => Number.isSafeInteger(n)&&n>=min&&n<=max;

export async function runNotificationScheduled013({
  controller,env,compiledOpen=false,now=Date.now(),
  maxPasses=NOTIFICATION_RETENTION_MAX_PASSES_013,
}={}) {
  if(controller?.cron!==NOTIFICATION_RETENTION_CRON_013)
    return zero('not-notification-cron');
  if(compiledOpen!==true ||
     env?.SORIDRAW_NOTIFICATION_RETENTION_013!=='1' ||
     env?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013!=='1')
    return zero('inactive');

  const db=env?.DB,cache=env?.PROFILE_MEDIA;
  if(!db?.prepare||!cache?.get||!cache?.put ||
     !bounded(now,NOTIFICATION_RETENTION_MS_002+1,Number.MAX_SAFE_INTEGER) ||
     !bounded(maxPasses,1,NOTIFICATION_RETENTION_MAX_PASSES_013))
    throw failed('NOTIFICATION_013_MAINTENANCE_UNAVAILABLE');

  // Physical schema check before the first DELETE; no guessed presence of
  // direct-message or announcement indexes from an environment variable.
  const result=await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name IN (?,?,?)"
  ).bind(...indices).all();
  const found=result?.results;
  if(!Array.isArray(found)||found.length!==indices.length ||
     new Set(found.map(row=>row?.name)).size!==indices.length ||
     found.some(row=>!indices.includes(row?.name)))
    throw failed('NOTIFICATION_013_EXPIRY_INDEXES_MISSING');

  // Do NOT enable collection on a maintenance tick. Missing/OFF latch
  // prevents every deletion, even when all other flags are set.
  const latch=await db.prepare(
    'SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1'
  ).first();
  if(Number(latch?.enabled)!==1)return zero('latch-off');

  const aggregate={social:0,direct:0,announcement:0};
  let rowsDeleted=0,r2Writes=0;
  for(let pass=0;pass<maxPasses;pass++){
    const outcome=await runNotificationRetention005({
      db,cache,verifyMaintenance:async()=>true,enabled:true,now,
      limit:NOTIFICATION_RETENTION_BATCH_LIMIT_013,
    });
    if(!['ok','more-possible'].includes(outcome?.status) ||
       !bounded(outcome.rowsDeleted,0,3*NOTIFICATION_RETENTION_BATCH_LIMIT_013) ||
       !bounded(outcome.r2Writes,0,1) ||
       !outcome.byCategory ||
       !['social','direct','announcement'].every(k=>
         bounded(outcome.byCategory[k],0,NOTIFICATION_RETENTION_BATCH_LIMIT_013)) ||
       Object.values(outcome.byCategory).reduce((a,n)=>a+n,0)!==outcome.rowsDeleted)
      throw failed('NOTIFICATION_013_CLEANUP_RESULT_UNVERIFIED');
    for(const k of Object.keys(aggregate))aggregate[k]+=outcome.byCategory[k];
    rowsDeleted+=outcome.rowsDeleted;
    r2Writes+=outcome.r2Writes;
    if(outcome.status==='ok')return {
      status:'ok',passes:pass+1,rowsDeleted,r2Writes,byCategory:aggregate};
  }
  return {status:'backlog',passes:maxPasses,rowsDeleted,r2Writes,
    byCategory:aggregate};
}
