from pathlib import Path

OLD_BASE = "const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';\n"
OLD_URL = 'https://soridraw-explore-api.andrawing1212.workers.dev'
PREVIEW_URL = 'https://soridraw-explore-preview.andrawing1212.workers.dev'
TEST_URL = 'https://soridraw-explore-test.andrawing1212.workers.dev'

TARGETS = {
    Path('src/services/exploreLikeService.ts'): "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\n",
    Path('src/services/exploreSocialService.ts'): "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\n",
    Path('src/services/explorePublicationService.ts'): "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\n",
    Path('src/services/exploreProfileFirstViewService.ts'): "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\n",
    Path('src/pages/ExplorePage.tsx'): "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';\n",
}

for path, import_line in TARGETS.items():
    text = path.read_text(encoding='utf-8')
    if import_line not in text:
        text = import_line + text
    text = text.replace(OLD_BASE, '')
    path.write_text(text, encoding='utf-8')

preview_workflow = Path('.github/workflows/firebase-hosting-custom-preview.yml')
if preview_workflow.exists():
    text = preview_workflow.read_text(encoding='utf-8')
    text = text.replace(OLD_URL, PREVIEW_URL)
    preview_workflow.write_text(text, encoding='utf-8')

test_workflow = Path('.github/workflows/firebase-hosting-main-test-canary-v2.yml')
if test_workflow.exists():
    text = test_workflow.read_text(encoding='utf-8')
    text = text.replace(OLD_URL, TEST_URL)
    test_workflow.write_text(text, encoding='utf-8')

config_path = Path('src/config/exploreEnvironment.ts')
remaining = []
for path in Path('src').rglob('*'):
    if not path.is_file() or path == config_path:
        continue
    if path.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    if OLD_URL in text:
        remaining.append(str(path))
if remaining:
    raise SystemExit('Hard-coded production Explore API remains in src: ' + ', '.join(remaining))

for path in TARGETS:
    text = path.read_text(encoding='utf-8')
    if 'EXPLORE_API_BASE' not in text:
        raise SystemExit(f'Explore API base import/use missing: {path}')

print('EXPLORE_ENV_ROUTING_APPLIED=true')
print('PREVIEW_API=' + PREVIEW_URL)
print('TEST_API=' + TEST_URL)
print('PRODUCTION_API_UNCHANGED=' + OLD_URL)
