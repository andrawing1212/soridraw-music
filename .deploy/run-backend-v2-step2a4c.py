from pathlib import Path
import subprocess
import tempfile

source = Path('.deploy/apply-backend-v2-step2a4c.py').read_text(encoding='utf-8')
old = "helper_anchor = \"const RAP_APP_CHECK_RECAPTCHA_SITE_KEY = import.meta.env.VITE_RAP_APP_CHECK_RECAPTCHA_SITE_KEY?.trim() || '';\""
new = "helper_anchor = \"import { createSoridrawSongId, isSoridrawSongId } from './data/v2LiveMutation';\""
if source.count(old) != 1:
    raise SystemExit('2-A4c helper anchor fixer mismatch')
source = source.replace(old, new, 1)
old_call = "replace_once(helper_anchor, helper + helper_anchor, 'helper insertion')"
new_call = "replace_once(helper_anchor, helper_anchor + '\\n\\n' + helper, 'helper insertion')"
if source.count(old_call) != 1:
    raise SystemExit('2-A4c helper insertion fixer mismatch')
source = source.replace(old_call, new_call, 1)

with tempfile.NamedTemporaryFile('w', suffix='.py', encoding='utf-8', delete=False) as handle:
    handle.write(source)
    temp_path = handle.name
subprocess.run(['python3', temp_path], check=True)
print('A4C_RUNNER=PASS')
