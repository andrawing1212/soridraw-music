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

must(display.includes('SORIDRAW_EXPLORE_LIKE_ZERO_READ_DISPLAY_095_20260915'), 'zero-read display marker missing');
must(!display.includes('/v1/me/liked-tracks'), 'display count path must not call liked-tracks D1 recovery');
must(!display.includes('fetch('), 'display count path must remain network-free');
must(!display.includes('ZERO_COUNT_RECOVERY_'), 'legacy zero-count recovery state remains');
must(display.includes('if (aggregateCaughtUp) {'), 'accepted count must clear only when canonical aggregate catches up');
must(!display.includes('confirmAccepted'), 'forced accepted-count clear remains');
must(!/setInterval\s*\(/.test(display), 'polling introduced in display state');
must(!/firebase\/firestore|getDocs\(|collection\(/.test(display), 'display state must not read Firestore/full collections');

console.log('EXPLORE_LIKE_FIRESTORE_SYNC_WRITE=0_TARGET');
console.log('EXPLORE_LIKE_RTDB_ACCOUNT_SIGNAL=PASS');
console.log('RTDB_EXISTING_SIGNAL_PAYLOAD_COMPATIBLE=PASS');
console.log('LIKED_ZERO_COUNT_NETWORK_RECOVERY=REMOVED');
console.log('ACKNOWLEDGED_LOCAL_COUNT=CANONICAL_CATCHUP_ONLY');
console.log('NO_POLLING_NO_FULLSCAN=PASS');
