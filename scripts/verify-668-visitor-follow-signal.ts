import assert from 'node:assert/strict';
import {normalizePublicProfileFollow668 as normalize,
 acceptPublicProfileFollow668 as accept} from '../src/services/explorePublicFollowCore668';
const now=1800000000000;
const raw={profileUid:'subject',generation:'a'.repeat(32),
 revision:5,followerCount:3,followingCount:7,
 public:true,commitId:'b'.repeat(64),at:now-10_000};
const first=normalize(raw,'subject');
assert.ok(first);
assert.equal(accept(null,first!,now),true);
const next=normalize({...raw,revision:6,followerCount:4},'subject');
assert.ok(next);
assert.equal(accept(first!,next!,now),true);
assert.equal(accept(next!,first!,now),false);
assert.equal(accept(first!,first!,now),false);
assert.equal(accept(null,first!,now+11*60_000),false);
assert.equal(accept(null,{...first!,at:now+60_001},now),false);
assert.equal(accept(null,{...first!,at:now-10*60_000},now),true);
assert.equal(accept(null,{...first!,at:now-10*60_000-1},now),false);
assert.equal(accept(first!,{...next!,generation:'c'.repeat(32)},now),false);
assert.equal(accept(first!,{...next!,profileUid:'other'},now),false);
for(const invalid of [
 {...raw,profileUid:'someone-else'},
 {...raw,generation:'x'},
 {...raw,public:false},
 {...raw,followerCount:-1},
 {...raw,followerCount:1.2},
 {...raw,followingCount:Number.NaN},
 {...raw,revision:0},
 {...raw,revision:2.8},
 {...raw,commitId:'bad'},
 {...raw,ownerAuthEpoch:'private'},
 {...raw,rows:[{uid:'user'}]},
 {...raw,followerCount:null},
]){
 assert.equal(normalize(invalid,'subject'),null);
}
assert.equal(normalize(raw,'not/the/uid'),null);
console.log('APP668_PUBLIC_FOLLOW_PROFILE_SCOPED_FIELDS=PASS');
console.log('APP668_STALE_DUPLICATE_GENERATION_AND_RETAINED_HOLD=PASS');
console.log('APP668_NO_AUTH_PRIVATE_SIGNAL_OR_PROFILE_LIST=PASS');
