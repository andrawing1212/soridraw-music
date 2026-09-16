from pathlib import Path

path105 = Path('scripts/verify-105-explore-like-1min.mjs')
text105 = path105.read_text(encoding='utf-8')
old105 = "assert.ok(['105', '106', '107', '108'].includes(version.version), `105 one-minute contract incompatible with app ${version.version}`);"
new105 = "const appVersion = Number(version.version);\nassert.ok(Number.isFinite(appVersion) && appVersion >= 105, `105 one-minute contract incompatible with app ${version.version}`);"
if text105.count(old105) != 1:
    raise RuntimeError(f'109 verify-105 compatibility anchor count={text105.count(old105)}')
path105.write_text(text105.replace(old105, new105, 1), encoding='utf-8')

path103 = Path('scripts/verify-103-explore-like-event-batch.mjs')
text103 = path103.read_text(encoding='utf-8')
old103 = "if (['105', '106', '107', '108'].includes(version.version)) {"
new103 = "if (Number.isFinite(Number(version.version)) && Number(version.version) >= 105) {"
if text103.count(old103) != 1:
    raise RuntimeError(f'109 verify-103 compatibility anchor count={text103.count(old103)}')
path103.write_text(text103.replace(old103, new103, 1), encoding='utf-8')

print('109 verify-103/105 successor compatibility applied')
