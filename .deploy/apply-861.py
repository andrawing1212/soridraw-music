from pathlib import Path

# 861 combines two validated changes only:
# 1) Japanese native-phrasing quality guard from the latest 860 samples.
# 2) Gemini 3.7 timeout/cooldown 35s/45s + legacy client cooldown clamp.

# --- Japanese prompt quality refinement ---
p = Path('src/services/geminiService.ts')
s = p.read_text()
if '861: semantic-native Japanese line check' not in s:
    anchor = """- Before finalizing a line, make sure its modifier→noun and noun→predicate relationships are semantically natural in Japanese, not merely grammatically possible. Prefer verb-centered Japanese phrasing over stacked abstract nouns or mechanically translated spatial/quantity relations.\n- If a metaphor or image feels translated, over-explained, or semantically forced, rewrite it with a simpler everyday Japanese collocation that preserves the scene and emotion. Do not preserve source-language structure at the cost of natural Japanese.\n"""
    replacement = anchor + """- 861: semantic-native Japanese line check. Reject redundant meaning inside one phrase (for example, an adjective that merely repeats the noun's meaning), physically impossible location/body-part chains, and noun-noun or noun-predicate pairings whose semantic relationship is unclear in ordinary Japanese.\n- Abstract metaphors are allowed only when the relationship is immediately intelligible in Japanese. If an image depends on translated concepts such as an unnatural 'line/texture/name of time/day' construction, rewrite it as a concrete Japanese action, sensation, or scene instead of preserving the foreign-language metaphor.\n- Before finalizing, read each sung line as a standalone Japanese sentence fragment: the subject/object/location relationship must still make sense without relying on a source-language sentence that the listener cannot see.\n"""
    if anchor not in s:
        raise SystemExit('861 Japanese prompt anchor not found')
    s = s.replace(anchor, replacement, 1)
    p.write_text(s)

# --- Client cooldown migration/clamp ---
p = Path('src/services/geminiModelPreferences.ts')
s = p.read_text()
old = '''    const safeUntil = reason === "quota_or_rate_limit"\n      ? Math.min(until, now + 60_000)\n      : until;'''
new = '''    const isLegacy37BusyCooldown = model === "gemini-3.7-flash"\n      && ["model_response_timeout", "model_unavailable_or_overloaded", "temporary_model_cooldown"].includes(reason);\n    const safeUntil = reason === "quota_or_rate_limit"\n      ? Math.min(until, now + 60_000)\n      : isLegacy37BusyCooldown\n        ? Math.min(until, now + 45_000)\n        : until;'''
if old not in s:
    raise SystemExit('861 cooldown sanitize anchor not found')
s = s.replace(old, new, 1)
old = '''  const safeDurationMs = normalizedReason === "quota_or_rate_limit"\n    ? Math.min(60_000, requestedDurationMs)\n    : requestedDurationMs;'''
new = '''  const is37BusyCooldown = normalizedModel === "gemini-3.7-flash"\n    && ["model_response_timeout", "model_unavailable_or_overloaded", "temporary_model_cooldown"].includes(normalizedReason);\n  const safeDurationMs = normalizedReason === "quota_or_rate_limit"\n    ? Math.min(60_000, requestedDurationMs)\n    : is37BusyCooldown\n      ? Math.min(45_000, requestedDurationMs)\n      : requestedDurationMs;'''
if old not in s:
    raise SystemExit('861 cooldown write anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

# --- Server-side generated Function patch policy ---
p = Path('functions/scripts/apply-gemini-latency.cjs')
s = p.read_text()
if "'  \\\"gemini-3.7-flash\\\": 25_000,'" in s:
    s = s.replace("'  \\\"gemini-3.7-flash\\\": 25_000,'", "'  \\\"gemini-3.7-flash\\\": 35_000,'", 1)
elif "'  \"gemini-3.7-flash\": 25_000,'" in s:
    s = s.replace("'  \"gemini-3.7-flash\": 25_000,'", "'  \"gemini-3.7-flash\": 35_000,'", 1)
else:
    raise SystemExit('861 3.7 timeout anchor not found')
if 'const GEMINI_37_BUSY_SKIP_MS = 10 * 60_000;' not in s:
    raise SystemExit('861 3.7 cooldown anchor not found')
s = s.replace('const GEMINI_37_BUSY_SKIP_MS = 10 * 60_000;', 'const GEMINI_37_BUSY_SKIP_MS = 45_000;', 1)
s = s.replace('Applied SORIDRAW 855 Gemini policy:', 'Applied SORIDRAW 861 Gemini policy:', 1)
p.write_text(s)
