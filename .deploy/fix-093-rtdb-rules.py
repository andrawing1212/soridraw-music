from pathlib import Path
import json

RULES_PATH = Path('database.rules.json')
VERIFY_PATH = Path('scripts/verify-093-explore-like-rtdb-zero-count.mjs')

data = json.loads(RULES_PATH.read_text(encoding='utf-8'))
uid_rules = data['rules']['userSync']['$uid']

# Existing music/recent signals used an unsupported numChildren() expression and
# relied on $other=false without explicitly allowing their scalar fields. Preserve
# the same payload contract, but express the 10-ID bound with numeric child keys.
def build_domain_signal_rules():
    return {
        '.validate': "newData.hasChildren(['version','previousVersion','at','sourceId','documentIds'])",
        'version': {
            '.validate': 'newData.isNumber() && newData.val() > 0'
        },
        'previousVersion': {
            '.validate': 'newData.isNumber() && newData.val() >= 0'
        },
        'at': {
            '.validate': 'newData.isNumber() && newData.val() > 0'
        },
        'sourceId': {
            '.validate': "newData.isString() && newData.val().length > 0 && newData.val().length <= 128"
        },
        'documentIds': {
            '$index': {
                '.validate': "$index.matches(/^[0-9]$/) && newData.isString() && newData.val().length > 0 && newData.val().length <= 256"
            }
        },
        '$other': {
            '.validate': False
        }
    }

uid_rules['musicNote'] = build_domain_signal_rules()
uid_rules['recentSongs'] = build_domain_signal_rules()
uid_rules['exploreLike'] = {
    '.validate': "newData.hasChildren(['version','previousVersion','results'])",
    'version': {
        '.validate': 'newData.isNumber() && newData.val() > 0'
    },
    'previousVersion': {
        '.validate': 'newData.isNumber() && newData.val() >= 0'
    },
    'results': {
        '$index': {
            '.validate': "$index.matches(/^(0|[1-9]|[1-4][0-9])$/) && newData.hasChildren(['trackId','ownerUid','liked','likeCount'])",
            'trackId': {
                '.validate': "newData.isString() && newData.val().length > 0 && newData.val().length <= 512"
            },
            'ownerUid': {
                '.validate': "newData.isString() && newData.val().length <= 128"
            },
            'liked': {
                '.validate': 'newData.isBoolean()'
            },
            'likeCount': {
                '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000'
            },
            'displayLikeCount': {
                '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000'
            },
            '$other': {
                '.validate': False
            }
        }
    },
    '$other': {
        '.validate': False
    }
}

RULES_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

verifier = r'''import fs from 'node:fs';

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

const uidRules = rules?.rules?.userSync?.$uid;
must(uidRules?.exploreLike, 'Explore like RTDB rules missing');
must(!rulesText.includes('numChildren'), 'unsupported RTDB numChildren() remains');
const exploreIndexRule = String(uidRules.exploreLike?.results?.$index?.['.validate'] || '');
must(exploreIndexRule.includes('[1-4][0-9]'), 'Explore like max-50 index bound missing');
for (const domainName of ['musicNote', 'recentSongs']) {
  const domainRules = uidRules?.[domainName];
  must(domainRules?.version && domainRules?.previousVersion && domainRules?.at && domainRules?.sourceId, `${domainName} scalar allow-list missing`);
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
console.log('RTDB_EXISTING_SIGNAL_RULES_COMPILE_SAFE=PASS');
console.log('LIKED_ZERO_COUNT_TARGETED_BATCH_RECOVERY=PASS');
console.log('FAKE_ZERO_TO_ONE_FLOOR=ABSENT');
console.log('NO_POLLING_NO_FULLSCAN=PASS');
'''
VERIFY_PATH.write_text(verifier, encoding='utf-8')

print('093 RTDB rules rewritten to compile-safe bounded child-key validation.')
