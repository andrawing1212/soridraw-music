from pathlib import Path

path = Path('scripts/verify-105-explore-like-1min.mjs')
text = path.read_text(encoding='utf-8')
old = "assert.ok(['105', '106', '107', '108'].includes(version.version), `105 one-minute contract incompatible with app ${version.version}`);"
new = "const appVersion = Number(version.version);\nassert.ok(Number.isFinite(appVersion) && appVersion >= 105, `105 one-minute contract incompatible with app ${version.version}`);"
if text.count(old) != 1:
    raise RuntimeError(f'109 verify-105 compatibility anchor count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('109 verify-105 successor compatibility applied')
