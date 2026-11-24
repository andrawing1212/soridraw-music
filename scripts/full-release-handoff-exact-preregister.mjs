// Source-only repair for the confirmed legacy 035/066/069 handoff crash gap.
// Preserve the existing 448 window and SQL transaction; no schema change.
// Guard the actual batch against a late, previously unregistered track.
export function patchLegacyLikePreregister448(source){
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('448_PATCH_ANCHOR '+a.slice(0,100));return s.replace(a,b)};
 const fn=source.indexOf('async function processExploreLikeAggregateWave035(');
 const start=source.indexOf('if (env?.__SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_ACTIVE === true) {',fn);
 const end=source.indexOf('const statements = [',start);
 if(fn<0||start<0||end<0||end-start>20000)throw Error('448_PATCH_SCOPE');
 let block=source.slice(start,end);
 const anchor='const relationStatements448 = [';
 const before=`
    // 448 legacy handoff: durably cover every eligible track before canonical
    // membership and queue removal. The same common-window helper already
    // protects the 075 path. Bound the JSON fence; shrink only oversized waves.
    let waveCte448=cte, wavePrefix448=prefix, waveMax448=max;
    let ids448, coverage448;
    for (;;) {
      const planned448=await env.DB.prepare(waveCte448 + \`
        SELECT DISTINCT track_id FROM latest ORDER BY track_id
      \`).bind(...wavePrefix448).all();
      if(!Array.isArray(planned448?.results))throw Error('448_LEGACY_PREREGISTER_READ');
      ids448=planned448.results.map(row=>String(row?.track_id||'').trim());
      if(ids448.some(id=>!id||id.length>512)||new Set(ids448).size!==ids448.length)
        throw Error('448_LEGACY_PREREGISTER_INVALID');
      coverage448=JSON.stringify(ids448);
      if(new TextEncoder().encode(coverage448).byteLength<=65536)break;
      waveMax448=Math.floor(waveMax448/2);
      if(waveMax448<50)throw Error('448_LEGACY_PREREGISTER_BOUND');
      const smaller448=await selectExploreLikeAggregateBoundary039(
        env,cutoff,waveMax448,includeQueue066,includeQueue069);
      if(!smaller448)throw Error('448_LEGACY_PREREGISTER_BOUNDARY');
      waveCte448=exploreLikeAggregateSnapshotCte039(includeQueue066,includeQueue069,cutoff);
      wavePrefix448=[smaller448.createdAt,smaller448.batchId,smaller448.queueKind,cutoff];
    }
    if(ids448.length){
      const preregister448=env?.__SORIDRAW_COMMON_PUBLIC_LIKE_PREREGISTER_448;
      if(typeof preregister448!=='function')throw Error('448_LEGACY_PREREGISTER_UNAVAILABLE');
      const registered448=await preregister448(ids448);
      if(registered448?.registered!==true)throw Error('448_LEGACY_PREREGISTER_FAILED');
    }
    // Each statement sees the same atomic batch, with a shrinking eligible
    // set as queue rows are removed. An unregistered late track prevents
    // ALL membership mutations and queue removals; the fallback retries.
    const guardedCte448=waveCte448.trimEnd() + \`,
      coverage448 AS (SELECT NOT EXISTS (
        SELECT 1 FROM latest
        WHERE track_id NOT IN (SELECT value FROM json_each(?))
      ) AS ready)
    \`;
    const guardedPrefix448=[...wavePrefix448,coverage448];
    `;
 if(block.split(anchor).length!==2)throw Error('448_PATCH_STATEMENTS');
 // Change only the five existing membership/queue statements, not legacy mode.
 if(block.split('env.DB.prepare(cte +').length!==6||block.split('.bind(...prefix)').length!==6)
   throw Error('448_PATCH_SQL_SHAPE');
 block=block.replaceAll('env.DB.prepare(cte +','env.DB.prepare(guardedCte448 +')
   .replaceAll('.bind(...prefix)','.bind(...guardedPrefix448)');
 for(const desired of ['1','0'])block=once(block,'WHERE desired_liked = '+desired,
   'WHERE desired_liked = '+desired+' AND (SELECT ready FROM coverage448)=1');
 for(const kind of ['035','066','069'])block=once(block,"WHERE queue_kind = '"+kind+"'",
   "WHERE queue_kind = '"+kind+"' AND (SELECT ready FROM coverage448)=1");
 block=once(block,anchor,before+anchor);
 block=once(block,'const relationResult448 = await env.DB.batch(relationStatements448);',
   'const relationResult448 = await env.DB.batch(relationStatements448);');
 const ret='return {\n      positiveTracks: 0,';
 block=once(block,ret,`if(oldProcessed448+compactProcessed448+w1Processed448===0)
      throw Error('448_LEGACY_PREREGISTER_RETRY');
    `+ret);
 return source.slice(0,start)+block+source.slice(end);
}
