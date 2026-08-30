from pathlib import Path
import runpy

app = Path('src/App.tsx')
source = app.read_text(encoding='utf-8')
sentinel = (
    "\n        // 987: no automatic full-list recovery on normal entry.\n"
    "        // Legacy rows are checked only if the user actually reaches the ordered server tail."
)
legacy_noop = "        const runFavoritesFullCacheRecoveryOnce = async () => {};"

# SORIDRAW 921 already disables the historical automatic full-collection read.
# 987 accepts the same state and adds its canonical-tail comment so the actual
# pagination patch can stay idempotent on both older and current preview code.
if sentinel not in source and legacy_noop in source:
    source = source.replace(legacy_noop, legacy_noop + sentinel, 1)
    app.write_text(source, encoding='utf-8')

runpy.run_path('.deploy/apply-987-preview-server-pagination-parity.py', run_name='__main__')
