// Stage030: targeted read-only live check for the two screenshot profile handles.
// No user IDs, access tokens, message contents, or follower lists in logs.
import assert from 'node:assert/strict';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45', dbid='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const look='SELECT uid FROM public_profile_first_views WHERE handle = ? COLLATE NOCASE LIMIT 2';
const state=[
 'SELECT',
 '(SELECT created_at FROM follows WHERE follower_uid=? AND following_uid=? LIMIT 1) legacy_at,',
 '(SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_following,',
 '(SELECT baseline_following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_baseline,',
 '(SELECT updated_at FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_at,',
 '(SELECT mutation_id FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1) overlay_mutation,',
 '(SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1) collector_enabled'
].join(' ');
const notices=[
 'SELECT created_at FROM soridraw_notification_inbox_001',
 'WHERE receiver_uid=? AND bucket_ms>=? AND category=\'follow\'',
 'AND actor_uid=? AND subject_id=? ORDER BY bucket_ms DESC LIMIT 5'
].join(' ');
const readOnly=s=>/^SELECT\s/i.test(s.trim())&&!/\b(?:INSERT|REPLACE|UPDATE|DELETE|ALTER|DROP|CREATE|VACUUM|ATTACH)\b/i.test(s);
for(const sql of [look,state,notices])assert.ok(readOnly(sql),'MUST_SELECT_ONLY');
if(process.argv[2]==='--self-test'){
 console.log('FOLLOW_030_EXACT_TWO_PUBLIC_HANDLES_BOUNDED_READ_ONLY=PASS');
 process.exit(0);
}
assert.equal(process.argv[2],'--live','EXPLICIT_LIVE_REQUIRED');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token?.length>20,'CLOUDFLARE_TOKEN_REQUIRED');
const query=async(sql,params)=>{
 assert.ok(readOnly(sql)&&params.length<=10);
 const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
 '/d1/database/'+dbid+'/query',{method:'POST',headers:{
 Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(18000)});
 const json=await res.json(),q=json.result?.[0];
 assert.ok(res.ok&&json.success===true&&json.result?.length===1&&q?.success===true&&
 Array.isArray(q.results)&&Number(q.meta?.rows_written)===0,'READ_ONLY_D1_ACK_REQUIRED');
 assert.ok(q.results.length<=5,'RESULT_NOT_BOUNDED');
 return q.results;
};
const profile=async(handle)=>{
 const rows=[...await query(look,[handle]),...await query(look,['@'+handle])];
 const keys=[...new Set(rows.map(x=>String(x.uid||'')))];
 assert.equal(keys.length,1,'PROFILE_HANDLE_AMBIGUOUS_OR_MISSING');
 return keys[0];
};
const actor=await profile('andy.j'),owner=await profile('soridraw');
assert.notEqual(actor,owner);
const row=(await query(state,[actor,owner,actor,owner,actor,owner,actor,owner,actor,owner]))[0];
assert.ok(row&&[null,0,1].includes(row.overlay_following));
assert.equal(Number(row.collector_enabled),1);
const from=Math.floor((Date.now()-48*3600000)/7200000)*7200000;
const events=await query(notices,[owner,from,actor,owner]);
const dated=x=>x==null?null:new Date(Number(x)).toISOString();
const legacy=row.legacy_at==null?null:Number(row.legacy_at);
const overlay=row.overlay_at==null?null:Number(row.overlay_at);
const stamps=events.map(x=>Number(x.created_at));
console.log('FOLLOW_030_CANONICAL_TWO_ACCOUNT_READ_ONLY='+JSON.stringify({
 effectiveFollowing:row.overlay_following==null?legacy!==null:Number(row.overlay_following)===1,
 legacyRelationPresent:legacy!==null,
 overlayFollowing:row.overlay_following,
 overlayBaseline:row.overlay_baseline,
 followMutationPath: /^[a-f0-9]{8}_[a-f0-9]{4}_[a-f0-9]{4}_[a-f0-9]{4}_[a-f0-9]{12}$/i.test(String(row.overlay_mutation||'')) ? 'ordered354' : String(row.overlay_mutation||'').includes(':') ? 'nonordered350' : 'unknown',
 overlayUpdatedAt:dated(overlay),legacyCreatedAt:dated(legacy),
 recentFollowNotificationCount:events.length,
 recentFollowNotificationAt:stamps.length?dated(Math.max(...stamps)):null,
 noticeMatchesOverlayCommit:stamps.some(x=>x===overlay),
 noticeMatchesLegacyInsert:stamps.some(x=>x===legacy)
}));
console.log('FOLLOW_030_CANONICAL_RELATION_AND_ALERT_BOUNDED_R_ONLY_W0=PASS');
