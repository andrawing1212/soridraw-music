// One-time read-only evidence for director's PREVIEW two-account follow mismatch.
// Logs no UID, token, follower list or user metadata. No application mutation.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const handles=['andy.j','soridraw'];
const sqls={
 lookup:'SELECT uid FROM public_profile_first_views WHERE handle=? COLLATE NOCASE LIMIT 2',
 relation:[
 'SELECT (SELECT created_at FROM follows WHERE follower_uid=? AND following_uid=? LIMIT 1) legacy_at,',
 '(SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_following,',
 '(SELECT baseline_following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_baseline,',
 '(SELECT updated_at FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_updated_at'
 ].join(' '),
 count:[
 'SELECT (SELECT follower_count FROM profile_stats WHERE uid=? LIMIT 1) base_count,',
 '(SELECT COALESCE(SUM(following-baseline_following),0)',
 ' FROM explore_follow_overrides_348 INDEXED BY idx_explore_follow_overrides_348_reverse',
 ' WHERE following_uid=?) overlay_delta'
 ].join(' ')
};
const safe=q=>/^SELECT\s/i.test(q)&&!/;\s*\S/.test(q)&&!/\b(UPDATE|INSERT|DELETE|CREATE|DROP|REPLACE|ALTER|ATTACH|VACUUM)\b/i.test(q);
for(const q of Object.values(sqls))assert.ok(safe(q),'READ_ONLY_SQL_REQUIRED');
if(process.argv[2]==='--self-test'){
 console.log('FOLLOW_031_BOUNDED_INDEXED_READ_ONLY_TEST=PASS');process.exit(0);
}
assert.equal(process.argv[2],'--live','EXPLICIT_LIVE_DIAG');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token?.length>15,'CREDENTIAL_MISSING');
const query=async(sql,params)=>{
 assert.ok(safe(sql)&&params.length<=8,'READ_SCOPE');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+D1+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(18000)
 });
 const j=await response.json(),q=j.result?.[0];
 assert.ok(response.ok&&j.success===true&&j.result?.length===1&&q?.success===true&&Number(q.meta?.rows_written)===0,'NO_WRITE_PROOF');
 assert.ok(Array.isArray(q.results)&&q.results.length<=2,'BOUNDED_RESULTS_REQUIRED');
 return q.results;
};
const lookup=async handle=>{
 const a=[...await query(sqls.lookup,[handle]),...await query(sqls.lookup,['@'+handle])];
 const ids=[...new Set(a.map(x=>String(x.uid||'')))];
 assert.equal(ids.length,1,'HANDLE_NOT_RESOLVED_UNIQUELY');
 return ids[0];
};
const actor=await lookup(handles[0]),owner=await lookup(handles[1]);
assert.notEqual(actor,owner);
const edge=(await query(sqls.relation,[actor,owner,actor,owner,actor,owner,actor,owner]))[0];
const counts=(await query(sqls.count,[owner,owner]))[0];
assert.ok(edge&&counts,'TARGETED_ROWS_MISSING');
const baseline=edge.legacy_at!==null;
const effective=edge.overlay_following===null?baseline:Number(edge.overlay_following)===1;
const baseCount=Number(counts.base_count),delta=Number(counts.overlay_delta);
assert.ok(Number.isSafeInteger(baseCount)&&Number.isSafeInteger(delta),'COUNT_INVALID');
console.log('FOLLOW_031_DIRECTOR_TWO_ACCOUNT_CANONICAL='+JSON.stringify({
 dateUTC:new Date().toISOString(),
 actorEffectiveFollowing:effective,
 baselineFollowing:baseline,
 overlayFollowing:edge.overlay_following,
 overlayBaseline:edge.overlay_baseline,
 overlayUpdatedUTC:edge.overlay_updated_at===null?null:new Date(Number(edge.overlay_updated_at)).toISOString(),
 ownerBaseFollowers:baseCount,ownerOverlayDelta:delta,
 ownerCanonicalFollowerCount:baseCount+delta,
 note:'one identified relation; bounded indexed owner aggregate; no personal identifiers or content in logs'
}));
console.log('FOLLOW_031_SHARED_D1_ROWS_WRITTEN_ZERO=PASS');
