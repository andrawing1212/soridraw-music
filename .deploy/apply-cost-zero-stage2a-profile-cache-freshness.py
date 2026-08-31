from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'src/services/exploreProfileFirstViewService.ts'
source = TARGET.read_text(encoding='utf-8')

limit_anchor = "const PROFILE_FIRST_VIEW_LIMIT = 50;\n"
ttl_line = "const PROFILE_FIRST_VIEW_COMPAT_TTL_MS = 5 * 60 * 1000; // temporary until shared revision signal activation\n"
if ttl_line not in source:
    if limit_anchor not in source:
        raise SystemExit('profile cache limit anchor missing')
    source = source.replace(limit_anchor, limit_anchor + ttl_line, 1)

old = "      expiresAt: null,\n"
new = "      // Cross-user profile changes cannot safely keep an unbounded local copy before\n      // the shared revision signal is activated. Immediate re-entry is still 0-read.\n      expiresAt: Date.now() + PROFILE_FIRST_VIEW_COMPAT_TTL_MS,\n"
if old in source:
    source = source.replace(old, new, 1)
elif new not in source:
    raise SystemExit('profile cache expiry anchor missing')

TARGET.write_text(source, encoding='utf-8')
print('COST_ZERO_STAGE2A_PROFILE_CACHE_FRESHNESS=APPLIED')
