import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const like = read('src/services/exploreLikeService.ts');
const domain = read('src/services/userDomainSyncService.ts');
const display = read('src/services/exploreLikeDisplayStateService.ts');
const rulesText = read('database.rules.json');
const rules = JSON.parse(rulesText);

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(like.includes('SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915'), '093 like RTDB marker missing');
must(like.includes("setRealtimeValue(databaseRef(realtimeDb, `userSync/${uid}/exploreLike`), signal)"), 'Explore like RTDB publisher missing');
must(!like.includes("updateDoc(doc(db, 'users', uid), { exploreLikeSyncSignal: signal })"), 'Explore like Firestore users write still active');
must(!like.includes("from '../lib/firestoreMeasured'"), 'Explore like service still imports Firestore wrapper');

must(domain.includes('SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915'), 'RTDB subscriber marker missing');
must(domain.includes('userSync/${safeUid}/exploreLike'), 'UID-scoped Explore like RTDB subscriber missing');
must(domain.includes('observeExploreLikeAccountSyncSignal(currentUser, snapshot.val())'), 'Explore like RTDB signal consumer missing');
for (const marker of ['originDeviceId', 'operation', 'affectedCount', 'truncated']) {
  must(domain.includes(marker), `existing domain signal payload marker missing: ${marker}`);
}

const uidRules = rules?.rules?.userSync?.$uid;
must(uidRules?.exploreLike, 'Explore like RTDB rules missing');
must(!rulesText.includes('numChildren'), 'unsupported RTDB numChildren() remains');
const exploreIndexRule = String(uidRules.exploreLike?.results?.$index?.['.validate'] || '');
must(exploreIndexRule.includes('[1-4][0-9]'), 'Explore like max-50 index bound missing');
must(String(uidRules.exploreLike?.['.validate'] || '').includes("version').val() > newData.child('previousVersion').val()"), 'Explore like monotonic version guard missing');

for (const domainName of ['musicNote', 'recentSongs']) {
  const domainRules = uidRules?.[domainName];
  must(domainRules?.version && domainRules?.at && domainRules?.originDeviceId && domainRules?.operation, `${domainName} live scalar allow-list missing`);
  must(domainRules?.affectedCount && domainRules?.truncated, `${domainName} live count/truncated allow-list missing`);
  must(!domainRules?.previousVersion && !domainRules?.sourceId, `${domainName} stale incompatible rule fields remain`);
  const requiredRule = String(domainRules?.['.validate'] || '');
  for (const field of ['version','at','originDeviceId','operation','affectedCount','truncated']) {
    must(requiredRule.includes(`'${field}'`), `${domainName} required live field missing: ${field}`);
  }
  const idRule = String(domainRules?.documentIds?.$index?.['.validate'] || '');
  must(idRule.includes("matches(/^[0-9]$/)"), `${domainName} max-10 ID index bound missing`);
}

must(display.includes('SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915'), 'zero-count recovery marker missing');
must(display.includes("ZERO_COUNT_RECOVERY_ROUTE_093 = '/v1/me/liked-tracks'"), 'targeted liked-tracks recovery route missing');
must(display.includes('ZERO_COUNT_RECOVERY_BATCH_MAX_093 = 50'), 'zero-count recovery batch cap missing');
must(display.includes('resolved === 0 && isPersistentlyLiked093'), 'liked+zero contradiction gate missing');
must(display.includes('if (likeCount <= 0) return;'), 'no-fabricated-count guard missing');
must(!/setInterval\s*\(/.test(display), 'polling introduced in display recovery');
must(!/firebase\/firestore|getDocs\(|collection\(/.test(display), 'zero-count recovery must not read Firestore/full collections');

console.log('EXPLORE_LIKE_FIRESTORE_SYNC_WRITE=0_TARGET');
console.log('EXPLORE_LIKE_RTDB_ACCOUNT_SIGNAL=PASS');
console.log('RTDB_EXISTING_SIGNAL_PAYLOAD_COMPATIBLE=PASS');
console.log('LIKED_ZERO_COUNT_TARGETED_BATCH_RECOVERY=PASS');
console.log('FAKE_ZERO_TO_ONE_FLOOR=ABSENT');
console.log('NO_POLLING_NO_FULLSCAN=PASS');
