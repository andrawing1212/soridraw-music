import assert from 'node:assert/strict';
import { compareApp728Bindings } from './app728-binding-diff.mjs';

const a = { activeVersion: 'preview-uuid', pinnedBindingsVerified: true, schedulesVerified: true,
  bindings: [{ name: 'DB', type: 'd1', id: 'same' }, { name: 'PROFILE_MEDIA', type: 'r2_bucket', bucket: 'shared' },
  { name: 'RATE_DB', type: 'd1', id: 'preview' }, { name: 'EXPERIMENT', type: 'plain_text', plainHash: 'hash1' },
  { name: 'SECRET_NAME', type: 'secret_text' }] };
const b = { activeVersion: 'production-uuid', pinnedBindingsVerified: true, schedulesVerified: true,
  bindings: [{ name: 'DB', type: 'd1', id: 'same' }, { name: 'PROFILE_MEDIA', type: 'r2_bucket', bucket: 'shared' },
  { name: 'RATE_DB', type: 'd1', id: 'production' }, { name: 'OLD_ONLY', type: 'plain_text' }] };
const x = compareApp728Bindings(a,b);
assert.equal(x.status,'HOLD');
assert.equal(x.deploymentPermitted,false);
assert.equal(x.summary.previewOnlyCount,2);
assert.equal(x.summary.productionOnlyCount,1);
assert.equal(x.summary.sharedBindingNames,3);
assert(x.onlyPreview.includes('EXPERIMENT:plain_text'));
assert(x.changedTargets.some(v => v.name === 'RATE_DB' && v.changedFields.includes('id')));
assert(x.shared.every(v=>v.presentInBoth && v.sameTarget));
const bad=structuredClone(b);bad.bindings[0].id='different';
assert(compareApp728Bindings(a,bad).anomalies.includes('SHARED_CANONICAL_TARGET_MISMATCH'));
const unverified=structuredClone(b);unverified.pinnedBindingsVerified=false;
assert(compareApp728Bindings(a,unverified).anomalies.includes('PINNED_BINDINGS_UNVERIFIED'));
const duplicated=structuredClone(a);duplicated.bindings.push({...duplicated.bindings[0]});
assert(compareApp728Bindings(duplicated,b).anomalies.includes('DUPLICATE_PREVIEW_BINDING_NAME'));
console.log('APP728_BINDING_DIFF_SYNTHETIC=PASS');
