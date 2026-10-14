import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const remoteDir=process.env.SORIDRAW_REMOTE_WORKER_DIR;
if(!remoteDir)throw Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath=join(remoteDir,'worker.js');
let source=readFileSync(workerPath,'utf8');
const marker='SORIDRAW_STAGE416_EXACT_PUBLIC_CHANGED_IDS_440_20261014';
if(source.includes(marker)){
 console.log('[099/440] Stage416 exact public deferral already applied.');
 process.exit(0);
}
const functionRange=name=>{
 const needles=[`async function ${name}(`,`function ${name}(`];
 let start=-1;for(const needle of needles){start=source.indexOf(needle);if(start>=0)break;}
 if(start<0)throw Error('[099] function missing: '+name);
 const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false,comment='';
 for(let i=brace;i<source.length;i++){
   const c=source[i],n=source[i+1];
   if(comment==='line'){if(c==='\n')comment='';continue;}
   if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
   if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
   if(c==='/'&&n==='/'){comment='line';i++;continue;}
   if(c==='/'&&n==='*'){comment='block';i++;continue;}
   if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
   if(c==='{')depth++;if(c==='}'&&--depth===0)return{start,end:i+1,text:source.slice(start,i+1)};
 }
 throw Error('[099] unterminated function: '+name);
};
const once=(text,before,after,label)=>{
 const count=text.split(before).length-1;
 if(count!==1)throw Error('[099] '+label+' count='+count);
 return text.replace(before,after);
};
const replaceFn=(name,edit)=>{
 const range=functionRange(name),next=edit(range.text);
 if(next===range.text)throw Error('[099] unchanged '+name);
 source=source.slice(0,range.start)+next+source.slice(range.end);
};

replaceFn('exploreLikeAggregateSnapshotCte039',t=>{
 t=once(t,
`        e.queue_kind,
        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,`,
`        e.queue_kind,
        CASE
          WHEN e.queue_kind = '069'
           AND json_type(j.value, '$.operationId') = 'text'
           AND json_type(j.value, '$.mutationAt') = 'integer'
           AND CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) > 0
           AND CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) <= e.created_at
          THEN 1 ELSE 0
        END AS stage416_signed,
        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,`,'cte expanded');
 return once(t,
  '      SELECT user_uid, track_id, desired_liked, created_at, batch_id, queue_kind',
  '      SELECT user_uid, track_id, desired_liked, created_at, batch_id, queue_kind,\n        stage416_signed',
  'cte latest');
});

replaceFn('processExploreLikeAggregateWave035',t=>{
 t=once(t,
  "if (!boundary) return { positiveTracks: 0, negativeTracks: 0, insertedLikes: 0, deletedLikes: 0, processedBatches: 0, oldProcessed: 0, compactProcessed: 0, w1Processed: 0, settledBatchIds418: [] };",
  "if (!boundary) return { positiveTracks: 0, negativeTracks: 0, insertedLikes: 0, deletedLikes: 0, processedBatches: 0, oldProcessed: 0, compactProcessed: 0, w1Processed: 0, settledBatchIds418: [], changedTrackIds416: [], stage416Changed416: false };",
  'wave empty');
 t=once(t,
`      ON CONFLICT(track_id) DO UPDATE SET like_count = track_stats.like_count + excluded.like_count, updated_at = excluded.updated_at
    \`).bind(...prefix, now),`,
`      ON CONFLICT(track_id) DO UPDATE SET like_count = track_stats.like_count + excluded.like_count, updated_at = excluded.updated_at
      RETURNING track_id,
        (SELECT MAX(CASE WHEN d.stage416_signed=1 AND d.delta<>0 THEN 1 ELSE 0 END)
         FROM deltas d WHERE d.track_id=track_stats.track_id) AS stage416_signed
    \`).bind(...prefix, now),`,'positive returning');
 t=once(t,
`      WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0)
    \`).bind(...prefix, now),`,
`      WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0)
      RETURNING track_id,
        (SELECT MAX(CASE WHEN d.stage416_signed=1 AND d.delta<>0 THEN 1 ELSE 0 END)
         FROM deltas d WHERE d.track_id=track_stats.track_id) AS stage416_signed
    \`).bind(...prefix, now),`,'negative returning');
 t=once(t,
  '  const oldProcessed = Number(result?.[4]?.meta?.changes || 0);',
  "  // ${marker}\n  // Reuse canonical track_stats RETURNING rows: zero extra D1 SELECT/query.\n  const changedRows416=[...(Array.isArray(result?.[0]?.results)?result[0].results:[]),...(Array.isArray(result?.[1]?.results)?result[1].results:[])];\n  const changedTrackIds416=[...new Set(changedRows416.map((row)=>String(row?.track_id||'').trim()).filter(Boolean))];\n  const stage416Changed416=changedRows416.some((row)=>Number(row?.stage416_signed||0)===1);\n  const oldProcessed = Number(result?.[4]?.meta?.changes || 0);",
  'wave returning ids');
 return once(t,
`    settledBatchIds418: w1Index >= 0 && Array.isArray(result?.[w1Index]?.results)
      ? result[w1Index].results.map((row) => String(row?.batch_id || '').trim()).filter(Boolean).slice(0, 2)
      : []
  };`,
`    settledBatchIds418: w1Index >= 0 && Array.isArray(result?.[w1Index]?.results)
      ? result[w1Index].results.map((row) => String(row?.batch_id || '').trim()).filter(Boolean).slice(0, 2)
      : [],
    changedTrackIds416,
    stage416Changed416
  };`,'wave return');
});

replaceFn('processExploreLikeUserQueueWave075',t=>{
 t=once(t,
  'async function processExploreLikeUserQueueWave075(env, cutoff, now) {',
  'async function processExploreLikeUserQueueWave075(env, cutoff, now, deferPublic416 = false) {',
  '075 signature');
 const start=t.indexOf('  await Promise.allSettled(changedRows.flatMap((row) => {');
 const end=t.indexOf('  return {\n    positiveTracks:',start);
 if(start<0||end<0)throw Error('[099] 075 public block missing');
 const block=t.slice(start,end).split('\n').map(line=>'  '+line).join('\n');
 t=t.slice(0,start)+'  if(!deferPublic416){\n'+block+'\n  }\n\n'+t.slice(end);
 return once(t,
  '    advanced: Number(result?.[4]?.meta?.changes || 0) > 0,\n  };',
  "    advanced: Number(result?.[4]?.meta?.changes || 0) > 0,\n    changedTrackIds416:[...new Set(changedRows.map((row)=>String(row?.track_id||'').trim()).filter(Boolean))],\n    stage416Changed416:false,\n  };",
  '075 return');
});

replaceFn('processExploreLikeBatches035Core056',t=>{
 t=once(t,
  "const idle = { skipped: true, reason: 'idle', idleWriteZero: true, waves: 0, processedBatches: 0, processedUserWaves: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0 };",
  "const idle = { skipped: true, reason: 'idle', idleWriteZero: true, waves: 0, processedBatches: 0, processedUserWaves: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, changedTrackIds416: [], stage416Changed416: false };",
  'core idle');
 t=once(t,'    settledBatchIds418: []\n  };',
  '    settledBatchIds418: [],\n    changedTrackIds416: [],\n    stage416Changed416: false\n  };','core totals');
 t=once(t,
  '        totals.changedTracks += current.positiveTracks + current.negativeTracks;\n        if (!current.processedBatches) break;',
  "        totals.changedTracks += current.positiveTracks + current.negativeTracks;\n        for(const id of current.changedTrackIds416||[]){if(!totals.changedTrackIds416.includes(id))totals.changedTrackIds416.push(id);}\n        if(current.stage416Changed416===true)totals.stage416Changed416=true;\n        if (!current.processedBatches) break;",
  'core aggregate merge');
 t=once(t,
  '        const current = await processExploreLikeUserQueueWave075(env, now, Date.now());',
  '        const current = await processExploreLikeUserQueueWave075(env, now, Date.now(), env?.__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE===true&&(env?.__SORIDRAW_DEFER_PUBLIC_416===true||totals.stage416Changed416===true));',
  'core 075 call');
 return once(t,
  "        totals.changedTracks += current.positiveTracks + current.negativeTracks;\n      }\n    }\n    console.log('[SORIDRAW 042] like aggregate', JSON.stringify(totals));",
  "        totals.changedTracks += current.positiveTracks + current.negativeTracks;\n        for(const id of current.changedTrackIds416||[]){if(!totals.changedTrackIds416.includes(id))totals.changedTrackIds416.push(id);}\n      }\n    }\n    console.log('[SORIDRAW 042] like aggregate', JSON.stringify(totals));",
  'core 075 merge');
});

replaceFn('processExploreLikeBatches035Core059',t=>once(t,
 "  if (!totals || Number(totals.changedTracks || 0) <= 0) return totals;\n  try {",
 "  if (!totals || Number(totals.changedTracks || 0) <= 0) return totals;\n  const deferPublic416=env?.__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE===true&&(env?.__SORIDRAW_DEFER_PUBLIC_416===true||totals.stage416Changed416===true);\n  if(deferPublic416)return {...totals,publicProjection:'deferred-416',publicDeferred416:true};\n  try {",
 'core059 defer'));

replaceFn('processExploreLikeBatches035',t=>once(t,
 "  const totals = await processExploreLikeBatches035Core065(env, scheduledTime);\n  const changedItems = Array.isArray(totals?.publicProjectionDetail?.changedItems)",
 "  const totals = await processExploreLikeBatches035Core065(env, scheduledTime);\n  if(totals?.publicDeferred416===true)return totals;\n  const changedItems = Array.isArray(totals?.publicProjectionDetail?.changedItems)",
 'top defer'));

if(!source.includes(marker))throw Error('[099] marker missing after patch');
writeFileSync(workerPath,source,'utf8');
console.log('[099/440] Stage416 exact canonical changed IDs defer public projection without delaying D1 settlement.');
