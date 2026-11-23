// APP518 account-wide D1 audit scope. This is an exact closed inventory,
// not deployment authorization. Every extra or changed Worker MUST HOLD
// until independent evidence is signed for its immutable active/rollback code.
// Cloudflare account read-only inventory: 2026-11-23, 9 Workers.
export const ACCOUNT_WORKER_NAMES_518=Object.freeze([
 'soridraw-explore-api','soridraw-explore-preview',
 'soridraw-explore-test','soridraw-explore-migration-inspect',
 'soridraw-media','soridraw-media-preview','soridraw-media-test',
 'soridraw-owner-follow-preview-candidate',
 'soridraw-owner558-proof-42959936171-1',
]);
// An indirect service route can reach a D1-bound Explore Worker even when
// the caller has no D1 binding. The exact connection topology is mandatory.
export const INDIRECT_ONLY_518=Object.freeze({
 'soridraw-owner-follow-preview-candidate':Object.freeze([
  {name:'OWNER_FOLLOW_CANONICAL_REPLAY_600',type:'service',
   service:'soridraw-explore-preview'},
  {name:'OWNER_FOLLOW_DO_600',type:'durable_object_namespace'},
 ]),
 'soridraw-owner558-proof-42959936171-1':Object.freeze([
  {name:'OWNER558_DO',type:'durable_object_namespace'},
 ]),
});
// Disallow extra D1 namespaces and invented binding names from being waved
// through as "indirect-only". Source audit must separately prove every
// service/DO code path and all reachable downstream D1 writers are metered.
export const normalizeIndirectBindings518=rows=>{
 if(!Array.isArray(rows))return null;
 const sorted=rows.map(x=>({
  name:x?.name,type:x?.type,
  ...(x?.type==='service'?{service:x?.service}:{}),
 })).sort((a,b)=>String(a.name).localeCompare(String(b.name),'en'));
 if(sorted.some(x=>typeof x.name!=='string'||!x.name
  ||!['service','durable_object_namespace','dispatch_namespace'].includes(x.type)
  ||(x.type==='service'&&(!x.service||typeof x.service!=='string'))
  ||(x.type!=='service'&&Object.hasOwn(x,'service'))
  ||new Set(sorted.map(v=>v.name)).size!==sorted.length))
  return null;
 return sorted;
};
export const exactIndirectBindings518=(actual,expected)=>
 JSON.stringify(normalizeIndirectBindings518(actual))===
 JSON.stringify(normalizeIndirectBindings518(expected))
 &&normalizeIndirectBindings518(actual)!==null
 &&normalizeIndirectBindings518(expected)!==null;
