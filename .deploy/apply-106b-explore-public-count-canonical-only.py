from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

# Public number is never account-local. Heart membership remains instant/local,
# while the displayed number is always the latest shared canonical Feed/Profile value.
p = Path('src/services/exploreLikeDisplayStateService.ts')
s = p.read_text(encoding='utf-8')
old = """export const getExploreLikeDisplayCount091 = (\n  uid: string,\n  trackId: string,\n  fallbackLikeCount = 0,\n) => {\n  const normalizedUid = normalizeUid091(uid);\n  const normalizedTrackId = normalizeTrackId091(trackId);\n  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);\n  const canonicalCount = getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);\n  const states = loadStates091(normalizedUid);\n  const state = states.get(normalizedTrackId);\n  if (state && state.expiresAt > Date.now()) {\n    // 106: never replay a fixed per-account count. Rebase only this account's\n    // pending membership delta on top of the latest shared canonical count.\n    const membershipDelta = Number(state.desiredLiked) - Number(state.baseLiked);\n    return clampCount091(canonicalCount + membershipDelta);\n  }\n  if (state) {\n    states.delete(normalizedTrackId);\n    persistStates091(normalizedUid, states);\n  }\n  return canonicalCount;\n};"""
new = """export const getExploreLikeDisplayCount091 = (\n  uid: string,\n  trackId: string,\n  fallbackLikeCount = 0,\n) => {\n  const normalizedUid = normalizeUid091(uid);\n  const normalizedTrackId = normalizeTrackId091(trackId);\n  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);\n  // 106 final rule: the heart is personal, the number is public. Never add or\n  // subtract an account-local membership delta from the public number. The\n  // shared Feed/Profile canonical projection is the only displayed count source.\n  return getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);\n};"""
s = replace_once(s, old, new, 'canonical-only display getter')
p.write_text(s, encoding='utf-8')

# Same-account RTDB changes only heart membership. It cannot synthesize or patch
# the public number, even from this device's cached canonical value.
p = Path('src/services/exploreLikeService.ts')
s = p.read_text(encoding='utf-8')
old = """  for (const result of effectiveResults) {\n    const previousLiked = cache.get(result.trackId);\n    if (\n      !pendingOutbox[result.trackId]\n      && typeof previousLiked === 'boolean'\n      && previousLiked !== result.liked\n    ) {\n      // 106: same-account RTDB tells this device only that membership changed.\n      // Build a short local +/- delta from this device's shared canonical count;\n      // never import another device's absolute public count.\n      const publicBaseLikeCount = getExploreLikeCanonicalCount091(uid, result.trackId, result.likeCount);\n      const localDisplayLikeCount = beginExploreLikeDisplayTransition091(\n        uid, result.trackId, result.ownerUid, previousLiked, result.liked, publicBaseLikeCount,\n      );\n      confirmExploreLikeDisplayTransition094(\n        uid, result.trackId, result.ownerUid, previousLiked, result.liked,\n        publicBaseLikeCount, localDisplayLikeCount,\n      );\n    }\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n    });\n  }"""
new = """  for (const result of effectiveResults) {\n    // 106 final rule: account RTDB synchronizes only personal heart membership.\n    // Its likeCount/displayLikeCount fields remain parse-compatible for older\n    // clients, but this client never uses them to alter the public number.\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n    });\n  }"""
s = replace_once(s, old, new, 'membership-only RTDB observer')
p.write_text(s, encoding='utf-8')

# Strengthen 106 verifier to lock the director-level invariant.
p = Path('scripts/verify-106-explore-public-count-separation.mjs')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "assert.match(display, /const canonicalCount = getExploreLikeCanonicalCount091\\(normalizedUid, normalizedTrackId, fallbackLikeCount\\);/);\nassert.match(display, /const membershipDelta = Number\\(state\\.desiredLiked\\) - Number\\(state\\.baseLiked\\);/);\nassert.match(display, /return clampCount091\\(canonicalCount \\+ membershipDelta\\);/);\nassert.doesNotMatch(display, /if \\(state && state\\.expiresAt > Date\\.now\\(\\)\\) return state\\.displayLikeCount;/);",
    "assert.match(display, /shared Feed\\/Profile canonical projection is the only displayed count source/);\nassert.match(display, /return getExploreLikeCanonicalCount091\\(normalizedUid, normalizedTrackId, fallbackLikeCount\\);/);\nassert.doesNotMatch(display, /membershipDelta|canonicalCount \\+ membershipDelta/);\nassert.doesNotMatch(display, /if \\(state && state\\.expiresAt > Date\\.now\\(\\)\\) return state\\.displayLikeCount;/);",
    'verifier display contract',
)
s = replace_once(
    s,
    "assert.match(like, /const previousLiked = cache\\.get\\(result\\.trackId\\);/);\nassert.match(like, /previousLiked !== result\\.liked/);\nassert.match(like, /const publicBaseLikeCount = getExploreLikeCanonicalCount091\\(uid, result\\.trackId, result\\.likeCount\\);/);\nassert.match(like, /beginExploreLikeDisplayTransition091\\([\\s\\S]*previousLiked, result\\.liked, publicBaseLikeCount/);\nassert.match(like, /confirmExploreLikeDisplayTransition094\\([\\s\\S]*publicBaseLikeCount, localDisplayLikeCount/);",
    "assert.match(like, /account RTDB synchronizes only personal heart membership/);\nconst observerStart = like.indexOf('for (const result of effectiveResults) {');\nconst observerEnd = like.indexOf('persistLikedStateCache(uid, cache);', observerStart);\nassert.ok(observerStart >= 0 && observerEnd > observerStart, 'account observer block missing');\nconst observerBlock = like.slice(observerStart, observerEnd);\nassert.doesNotMatch(observerBlock, /beginExploreLikeDisplayTransition091|confirmExploreLikeDisplayTransition094|getExploreLikeCanonicalCount091/);",
    'verifier RTDB contract',
)
s = s.replace("console.log('LOCAL_OPTIMISM=CANONICAL_PLUS_MEMBERSHIP_DELTA');", "console.log('PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE');")
p.write_text(s, encoding='utf-8')

print('APPLY_106B=PASS')
