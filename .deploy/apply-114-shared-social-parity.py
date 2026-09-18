from pathlib import Path
import json

ROOT = Path('.')
MANIFEST = ROOT / 'cloudflare/explore-worker/release-patches.json'
VERSION = ROOT / 'public/app-version.json'

manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
patches = list(manifest.get('patches') or [])
patch_name = '061-shared-social-r2-parity.mjs'
if patch_name not in patches:
    patches.append(patch_name)
manifest['patches'] = patches
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
VERSION.write_text('{"version":"114"}\n', encoding='utf-8')
print('[114] shared personal likes/following patch added to canonical release manifest; app version set to 114.')
