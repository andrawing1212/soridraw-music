from pathlib import Path
import json

def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'{label}=PASS')

replace_once(
    'src/pages/MasterPermissionsPage.tsx',
    "useEffect(() => { void loadAdmins(false); }, [loadAdmins]);",
    """useEffect(() => {
  if (activeTab !== 'admin-permissions') {
    setIsLoading(false);
    return;
  }
  void loadAdmins(false);
}, [activeTab, loadAdmins]);""",
    'MASTER_LAZY_ADMIN_LIST',
)

replace_once(
    'src/pages/AdminUserManagementPage.tsx',
    "      if (cached && cached.users.length > 0) {",
    "      if (cached) {",
    'ADMIN_EMPTY_CACHE_VALID',
)

config_path = Path('firebase.hosting-preview.json')
config = json.loads(config_path.read_text(encoding='utf-8'))
hosting = config.get('hosting') or {}
headers = hosting.setdefault('headers', [])
all_rule = next((rule for rule in headers if rule.get('source') == '**'), None)
if not all_rule:
    raise SystemExit('PREVIEW_CACHE_HEADER: missing ** header rule')
header_list = all_rule.setdefault('headers', [])
header_list = [h for h in header_list if str(h.get('key','')).lower() != 'cache-control']
header_list.append({'key': 'Cache-Control', 'value': 'no-cache, no-store, must-revalidate'})
all_rule['headers'] = header_list
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PREVIEW_CACHE_HEADER=PASS')

check_path = Path('.deploy/check-firebase-custom-preview.mjs')
check = check_path.read_text(encoding='utf-8')
anchor = "pass('isolated soridraw-preview Hosting config');\n"
addition = """pass('isolated soridraw-preview Hosting config');
const previewHeaders = Array.isArray(hostingConfig.hosting.headers) ? hostingConfig.hosting.headers : [];
const allPathHeaderRule = previewHeaders.find((rule) => rule?.source === '**');
const cacheControlHeader = Array.isArray(allPathHeaderRule?.headers)
  ? allPathHeaderRule.headers.find((header) => String(header?.key || '').toLowerCase() === 'cache-control')
  : null;
const previewCacheControl = String(cacheControlHeader?.value || '').toLowerCase();
if (!previewCacheControl.includes('no-cache') || !previewCacheControl.includes('no-store') || !previewCacheControl.includes('must-revalidate')) {
  fail('preview shell must disable stale browser caching');
}
pass('preview shell cache policy is no-cache/no-store');
"""
if check.count(anchor) != 1:
    raise SystemExit(f'CUSTOM_PREVIEW_CHECK: anchor count {check.count(anchor)}')
check_path.write_text(check.replace(anchor, addition, 1), encoding='utf-8')
print('CUSTOM_PREVIEW_CHECK=PASS')

workflow_path = Path('.github/workflows/firebase-hosting-custom-preview.yml')
workflow = workflow_path.read_text(encoding='utf-8')
anchor = """          done

      - name: Diagnose shared backend origin boundaries
"""
replacement = """          done

          preview_cache_control=\"$(curl -fsSI --max-time 30 'https://preview.soridraw.com/' | tr -d '\\r' | awk -F': ' 'tolower($1)==\"cache-control\" {print tolower($2); exit}')\"
          echo \"[Custom Preview] Live Cache-Control: ${preview_cache_control:-missing}\"
          echo \"$preview_cache_control\" | grep -q 'no-cache'
          echo \"$preview_cache_control\" | grep -q 'no-store'
          echo \"$preview_cache_control\" | grep -q 'must-revalidate'
          echo '[Custom Preview] Live stale-shell prevention: PASS'

      - name: Diagnose shared backend origin boundaries
"""
if workflow.count(anchor) != 1:
    raise SystemExit(f'LIVE_HEADER_ASSERT: anchor count {workflow.count(anchor)}')
workflow_path.write_text(workflow.replace(anchor, replacement, 1), encoding='utf-8')
print('LIVE_HEADER_ASSERT=PASS')
