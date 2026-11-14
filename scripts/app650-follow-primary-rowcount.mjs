// APP650: candidate-only source patch; it never deploys, changes data or
// touches Cloudflare. Exact worker version activation needs separate approval.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

export function repairFollowPrimaryRowCount650(source) {
  const start=source.indexOf('async function mutateFollowOverlayRelation350(');
  const end=source.indexOf('async function patchSharedProfileFollowDelta352(',start);
  assert.ok(start>=0&&end>start,'APP650_FOLLOW_WRITER_ANCHOR');
  const body=source.slice(start,end);
  const targetStart=body.indexOf('  if (operation) {');
  const targetEnd=body.indexOf('  const mutationId = [',targetStart);
  assert.ok(targetStart>=0&&targetEnd>targetStart,'APP650_ORDERED_ONLY');
  let target=body.slice(targetStart,targetEnd);
  const sqlEnd='AND explore_follow_overrides_348.following <> excluded.following';
  assert.equal(target.split(sqlEnd).length,2,'APP650_EXACT_UPSERT_WHERE');
  const statement=sqlEnd+'\n      RETURNING 1 AS relation_changed';
  target=target.replace(sqlEnd,statement);
  const re=/\.run\(\);\s*const (\w+) = Number\((\w+)\?\.meta\?\.changes \|\| 0\);/g;
  const matches=[...target.matchAll(re)];
  assert.equal(matches.length,1,'APP650_ONE_D1_META_CHANGES_READER');
  const [old,variable,result]=matches[0];
  target=target.replace(old,'.all();\n    const '+variable+
    ' = Array.isArray('+result+'?.results) ? '+result+'.results.length : -1;');
  assert.match(target,/RETURNING 1 AS relation_changed/);
  assert.match(target,/Array\.isArray\(\w+\?\.results\)/);
  const changed=body.slice(0,targetStart)+target+body.slice(targetEnd);
  const output=source.slice(0,start)+changed+source.slice(end);
  assert.ok(output!==source,'APP650_MUST_CHANGE');
  assert.equal(output.length-source.length,
    changed.length-body.length,'APP650_SINGLE_FUNCTION_ONLY');
  assert.equal(source.slice(0,start),output.slice(0,start));
  assert.equal(source.slice(end),output.slice(start+changed.length));
  return output;
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 if(process.argv[2]!=='--self-test')throw Error('APP650_SOURCE_ONLY_NO_DEPLOY');
 const source=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
 const patched=repairFollowPrimaryRowCount650(source);
 assert.throws(()=>repairFollowPrimaryRowCount650(patched),'APP650_NO_DOUBLE_PATCH');
 console.log('APP650_PRIMARY_RELATION_RETURNING_1_NOT_TRIGGER_META_CHANGES=PASS');
 console.log('APP650_SOURCE_ONLY_NO_SHARED_BACKEND_CHANGE=PASS');
}
