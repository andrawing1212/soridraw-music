import assert from 'node:assert/strict';
import {patchFollowAbuse701} from './lib/follow-abuse-503-701.mjs';
const fixture=`${'x'.repeat(120000)}
function socialAbusePolicy380(domain) {
 if (domain === "follow") return {windowLimit:30,dayLimit:120,cooldowns: [3e4, 12e4, 6e5, 36e5],quietMs:864e5,pairMax:120};
 if (domain === "like") return {windowLimit:120,dayLimit:600,cooldowns: [3e4, 6e4, 3e5, 18e5],quietMs:216e5,pairMax:600};
}
function socialAbuseLimited380(delayMs) { return delayMs; }
function consumeSocialAbuse380(env, uid, domain, intents) {
 if (old.pairs.some(row => row.nextAllowedAt !== row.at + policy.cooldowns[row.level])) return;
 if (prior && prior.nextAllowedAt > now) blockedUntil = Math.max(blockedUntil, prior.nextAllowedAt);
 const level = prior ? Math.min(3, prior.level + 1) : 0;
}`;
const patched=patchFollowAbuse701(fixture);
assert.notEqual(patched,fixture);
assert.match(patched,/cooldowns: \[0, 0, 0, 3e4\]/);
assert.match(patched,/domain !== "follow" \|\| row.nextAllowedAt !== row.at \+ \[3e4, 12e4, 6e5, 36e5\]/);
assert.match(patched,/const allowedAt701/);
assert.match(patched,/now - prior.at < 6e4/);
assert.match(patched,/if \(domain === "like"\) return \{windowLimit:120,dayLimit:600,cooldowns: \[3e4, 6e4, 3e5, 18e5\]/);
assert.throws(()=>patchFollowAbuse701(patched),/APP701_HOLD_POLICY_NOT_UNIQUE/);
assert.throws(()=>patchFollowAbuse701(''),/APP701_HOLD_ACTIVE_SOURCE_SHAPE/);
assert.throws(()=>patchFollowAbuse701(fixture.replace('const level = prior ?', 'const level = other ?')),/APP701_HOLD_LEVEL_NOT_UNIQUE/);
console.log('APP701_ONLY_FOLLOW_GUARD_LEGACY_RECEIPT_PATCH_AND_HOLD=PASS');
