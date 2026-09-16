from pathlib import Path
import json
import re

ROOT = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

# 1) Public-count display state: keep membership optimism local, but never let a
# fixed account-scoped number become the public total source of truth.
p = ROOT / 'src/services/exploreLikeDisplayStateService.ts'
s = p.read_text(encoding='utf-8')

s = replace_once(
    s,
    "// SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915\nconst STORAGE_VERSION_091 = 1;\nconst STORAGE_PREFIX_091 = 'soridraw:explore-like-display:091:';\nconst DISPLAY_TTL_MS_091 = 7 * 24 * 60 * 60_000;",
    "// SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915\n// SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916\n// Public aggregate numbers must come from the shared Feed/Profile canonical projection.\n// Account/device state may carry only a short optimistic membership delta.\nconst STORAGE_VERSION_106 = 2;\nconst STORAGE_PREFIX_106 = 'soridraw:explore-like-display:106:';\nconst LEGACY_STORAGE_PREFIX_091 = 'soridraw:explore-like-display:091:';\nconst PENDING_DISPLAY_TTL_MS_106 = 20 * 60_000;\nconst ACCEPTED_DISPLAY_TTL_MS_106 = 2 * 60_000;",
    'display constants',
)

s = replace_once(
    s,
    "const storageKey091 = (uid: string) => `${STORAGE_PREFIX_091}${uid}`;",
    "const storageKey091 = (uid: string) => `${STORAGE_PREFIX_106}${uid}`;\nconst legacyStorageKey091 = (uid: string) => `${LEGACY_STORAGE_PREFIX_091}${uid}`;",
    'storage key',
)

s = replace_once(
    s,
    "  if (typeof window === 'undefined') return states;\n  try {\n    const parsed = JSON.parse(window.localStorage.getItem(storageKey091(normalizedUid)) || 'null');\n    if (!parsed || parsed.version !== STORAGE_VERSION_091 || !Array.isArray(parsed.states)) return states;",
    "  if (typeof window === 'undefined') return states;\n  try {\n    // 106 invalidates only the old derived display overlay. Canonical/user data is untouched.\n    window.localStorage.removeItem(legacyStorageKey091(normalizedUid));\n    const parsed = JSON.parse(window.localStorage.getItem(storageKey091(normalizedUid)) || 'null');\n    if (!parsed || parsed.version !== STORAGE_VERSION_106 || !Array.isArray(parsed.states)) return states;",
    'load version',
)

s = replace_once(
    s,
    "      version: STORAGE_VERSION_091,",
    "      version: STORAGE_VERSION_106,",
    'persist version',
)

old_get = """export const getExploreLikeDisplayCount091 = (\n  uid: string,\n  trackId: string,\n  fallbackLikeCount = 0,\n) => {\n  const normalizedUid = normalizeUid091(uid);\n  const normalizedTrackId = normalizeTrackId091(trackId);\n  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);\n  const states = loadStates091(normalizedUid);\n  const state = states.get(normalizedTrackId);\n  if (state && state.expiresAt > Date.now()) return state.displayLikeCount;\n  if (state) {\n    states.delete(normalizedTrackId);\n    persistStates091(normalizedUid, states);\n  }\n  return getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);\n};"""
new_get = """export const getExploreLikeDisplayCount091 = (\n  uid: string,\n  trackId: string,\n  fallbackLikeCount = 0,\n) => {\n  const normalizedUid = normalizeUid091(uid);\n  const normalizedTrackId = normalizeTrackId091(trackId);\n  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);\n  const canonicalCount = getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);\n  const states = loadStates091(normalizedUid);\n  const state = states.get(normalizedTrackId);\n  if (state && state.expiresAt > Date.now()) {\n    // 106: never replay a fixed per-account count. Rebase only this account's\n    // pending membership delta on top of the latest shared canonical count.\n    const membershipDelta = Number(state.desiredLiked) - Number(state.baseLiked);\n    return clampCount091(canonicalCount + membershipDelta);\n  }\n  if (state) {\n    states.delete(normalizedTrackId);\n    persistStates091(normalizedUid, states);\n  }\n  return canonicalCount;\n};"""
s = replace_once(s, old_get, new_get, 'display getter')

# TTLs by function role.
for func_name, ttl in [
    ('beginExploreLikeDisplayTransition091', 'PENDING_DISPLAY_TTL_MS_106'),
    ('confirmExploreLikeDisplayTransition094', 'ACCEPTED_DISPLAY_TTL_MS_106'),
    ('rebaseExploreLikePendingDisplay094', 'PENDING_DISPLAY_TTL_MS_106'),
    ('acceptExploreLikeDisplayTransition091', 'ACCEPTED_DISPLAY_TTL_MS_106'),
]:
    start = s.index(f'export const {func_name}')
    end = s.find('\nexport const ', start + 1)
    if end < 0:
        end = len(s)
    block = s[start:end]
    if 'DISPLAY_TTL_MS_091' not in block:
        raise SystemExit(f'{func_name}: old TTL anchor missing')
    block = block.replace('DISPLAY_TTL_MS_091', ttl)
    s = s[:start] + block + s[end:]

old_import = """export const importExploreLikeDisplaySignal091 = (\n  uid: string,\n  trackId: string,\n  ownerUid: string,\n  liked: boolean,\n  displayLikeCount: number | undefined,\n  preservePending: boolean,\n) => {\n  const normalizedUid = normalizeUid091(uid);\n  const normalizedTrackId = normalizeTrackId091(trackId);\n  const numericDisplay = Number(displayLikeCount);\n  if (!normalizedUid || !normalizedTrackId || !Number.isFinite(numericDisplay)) return;\n  const states = loadStates091(normalizedUid);\n  if (preservePending && states.get(normalizedTrackId)?.phase === 'pending') return;\n  const count = clampCount091(numericDisplay);\n  const now = Date.now();\n  states.set(normalizedTrackId, {\n    trackId: normalizedTrackId,\n    ownerUid: normalizeUid091(ownerUid),\n    baseLiked: liked,\n    desiredLiked: liked,\n    baseLikeCount: count,\n    displayLikeCount: count,\n    phase: 'accepted',\n    updatedAt: now,\n    expiresAt: now + DISPLAY_TTL_MS_091,\n  });\n  persistStates091(normalizedUid, states);\n};"""
new_import = """export const importExploreLikeDisplaySignal091 = (\n  _uid: string,\n  _trackId: string,\n  _ownerUid: string,\n  _liked: boolean,\n  _displayLikeCount: number | undefined,\n  _preservePending: boolean,\n) => {\n  // 106: account-scoped RTDB signals are membership-only. A number received on\n  // that channel must never overwrite the shared public aggregate display.\n};"""
s = replace_once(s, old_import, new_import, 'account display import')

if 'DISPLAY_TTL_MS_091' in s:
    raise SystemExit('legacy display TTL remains')
p.write_text(s, encoding='utf-8')

# 2) Same-account signal: sync membership, derive any short optimistic delta from
# local before/after membership, and never transport a public total through RTDB.
p = ROOT / 'src/services/exploreLikeService.ts'
s = p.read_text(encoding='utf-8')

s = replace_once(
    s,
    "  getExploreLikeDisplayCount091,\n  importExploreLikeDisplaySignal091,\n} from './exploreLikeDisplayStateService';",
    "  getExploreLikeDisplayCount091,\n} from './exploreLikeDisplayStateService';",
    'remove account count importer',
)

s = replace_once(
    s,
    "// SORIDRAW_EXPLORE_UPDATE_ZERO_READ_099_20260916\nconst EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 2;",
    "// SORIDRAW_EXPLORE_UPDATE_ZERO_READ_099_20260916\n// SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916\nconst EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 2;",
    'like marker',
)

old_loop = """  for (const result of effectiveResults) {\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    importExploreLikeDisplaySignal091(\n      uid, result.trackId, result.ownerUid, result.liked, result.displayLikeCount,\n      Boolean(pendingOutbox[result.trackId]),\n    );\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }"""
new_loop = """  for (const result of effectiveResults) {\n    const previousLiked = cache.get(result.trackId);\n    if (\n      !pendingOutbox[result.trackId]\n      && typeof previousLiked === 'boolean'\n      && previousLiked !== result.liked\n    ) {\n      // 106: same-account RTDB tells this device only that membership changed.\n      // Build a short local +/- delta from this device's shared canonical count;\n      // never import another device's absolute public count.\n      const publicBaseLikeCount = getExploreLikeCanonicalCount091(uid, result.trackId, result.likeCount);\n      const localDisplayLikeCount = beginExploreLikeDisplayTransition091(\n        uid, result.trackId, result.ownerUid, previousLiked, result.liked, publicBaseLikeCount,\n      );\n      confirmExploreLikeDisplayTransition094(\n        uid, result.trackId, result.ownerUid, previousLiked, result.liked,\n        publicBaseLikeCount, localDisplayLikeCount,\n      );\n    }\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n    });\n  }"""
s = replace_once(s, old_loop, new_loop, 'account signal loop')

old_confirmed = """      const confirmedResult = {\n        trackId: result.trackId,\n        liked: result.liked,\n        likeCount: result.likeCount,\n        displayLikeCount: acknowledgedDisplayLikeCount,\n      };"""
new_confirmed = """      // 106: RTDB/account replay carries membership plus the server response only.\n      // The optimistic display number is device-local and must not become a public total.\n      const confirmedResult = {\n        trackId: result.trackId,\n        liked: result.liked,\n        likeCount: result.likeCount,\n      };"""
s = replace_once(s, old_confirmed, new_confirmed, 'confirmed RTDB result')

p.write_text(s, encoding='utf-8')

# 3) App version.
p = ROOT / 'public/app-version.json'
version = json.loads(p.read_text(encoding='utf-8'))
if str(version.get('version')) != '105':
    raise SystemExit(f'expected app version 105, got {version.get("version")}')
version['version'] = '106'
p.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 4) Compatibility verifiers: 106 preserves the 105 one-minute server contract.
p = ROOT / 'scripts/verify-105-explore-like-1min.mjs'
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "assert.equal(version.version, '105');",
    "assert.ok(['105', '106'].includes(version.version), `105 one-minute contract incompatible with app ${version.version}`);",
    '105 verifier version',
)
p.write_text(s, encoding='utf-8')

p = ROOT / 'scripts/verify-103-explore-like-event-batch.mjs'
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "if (version.version === '105') {",
    "if (version.version === '105' || version.version === '106') {",
    '103 verifier successor',
)
p.write_text(s, encoding='utf-8')

print('APPLY_106=PASS')
