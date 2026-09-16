from pathlib import Path
p = Path('DOCS/NEXT_CODEX_TASK.md')
text = p.read_text(encoding='utf-8')
old = '''## 106 PREVIEW 배포 결과
- PREVIEW App Release Run: `35059625879` — **SUCCESS**.
- 배포 source/trigger commit: `caf6f458096f876ae93bfb07c60f9445d6a14c76`.
- 실제 PREVIEW 앱: **107** — `https://preview.soridraw.com`.
'''
new = '''## 106 PREVIEW 배포 결과
- PREVIEW App Release Run: `35059625879` — **SUCCESS**.
- 배포 source/trigger commit: `caf6f458096f876ae93bfb07c60f9445d6a14c76`.
- 당시 실제 PREVIEW 앱: **106** — `https://preview.soridraw.com`.
'''
if old not in text:
    raise RuntimeError('106 historical block missing')
text = text.replace(old, new, 1)
old2 = '''## 현재 기준
- branch: `preview`
- 107 최종 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`
- 106 초기 separation commit: `31b91b02b0aa6692401b457e6286ffad250c7b03`
- 106 최종 검증 Run: `35058485482` — PASS
- 실제 PREVIEW 앱: **106** — `https://preview.soridraw.com`
'''
new2 = '''## 현재 기준
- branch: `preview`
- 107 최종 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`
- 107 구현·검증 Run: `35061505658` — PASS
- 107 PREVIEW App Release Run: `35061844172` — PASS
- 실제 PREVIEW 앱: **107** — `https://preview.soridraw.com`
'''
if old2 not in text:
    raise RuntimeError('current basis block missing')
text = text.replace(old2, new2, 1)
p.write_text(text, encoding='utf-8')
