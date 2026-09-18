from pathlib import Path

GEMINI_MARKER = 'SORIDRAW_874_BUILD_SAFETY_GEMINI'
APP_MARKER = 'SORIDRAW_874_BUILD_SAFETY_APP'

# Fix the AppliedKeywords clone introduced by the staged language patch chain.
gemini_path = Path('src/services/geminiService.ts')
gemini = gemini_path.read_text(encoding='utf-8')
if GEMINI_MARKER not in gemini:
    anchor = "    appliedKeywords: { ...(result.appliedKeywords || {}) },"
    corrected = "    appliedKeywords: { ...result.appliedKeywords },"
    replacement = "    appliedKeywords: { ...result.appliedKeywords }, // SORIDRAW_874_BUILD_SAFETY_GEMINI"
    if gemini.count(anchor) == 1:
        gemini = gemini.replace(anchor, replacement, 1)
        gemini_path.write_text(gemini, encoding='utf-8')
    elif gemini.count(corrected) == 1:
        print('SORIDRAW 874 Gemini fix already present; no-op')
    else:
        raise SystemExit(f'874 gemini semantic state mismatch: old={gemini.count(anchor)} corrected={gemini.count(corrected)}')

# Remove an unreachable duplicate branch. pure-pane-hybrid is already handled by
# the outer if and therefore cannot reach this mapping chain.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if APP_MARKER not in app:
    import re
    old_pattern = re.compile(r":\s*mode === 'pure-pane'\s*\?\s*'pure-pane'\s*:\s*mode === 'pure-pane-hybrid'\s*\?\s*'pure-pane-hybrid'\s*:\s*mode === 'pure-pane-live'")
    corrected_pattern = re.compile(r":\s*mode === 'pure-pane'\s*\?\s*'pure-pane'\s*:\s*mode === 'pure-pane-live'")
    old_matches = list(old_pattern.finditer(app))
    corrected_matches = list(corrected_pattern.finditer(app))
    if len(old_matches) == 1:
        anchor = '''                            : mode === 'pure-pane'
                              ? 'pure-pane'
                              : mode === 'pure-pane-hybrid'
                                ? 'pure-pane-hybrid'
                                : mode === 'pure-pane-live'''
        replacement = '''                            : mode === 'pure-pane'
                              ? 'pure-pane'
                              : mode === 'pure-pane-live' // SORIDRAW_874_BUILD_SAFETY_APP'''
        if app.count(anchor) != 1:
            raise SystemExit(f'874 App exact old anchor mismatch despite semantic match: {app.count(anchor)}')
        app = app.replace(anchor, replacement, 1)
        app_path.write_text(app, encoding='utf-8')
    elif len(corrected_matches) == 1:
        print('SORIDRAW 874 App fix already present; no-op')
    else:
        raise SystemExit(f'874 App semantic state mismatch: old={len(old_matches)} corrected={len(corrected_matches)}')


print('Applied SORIDRAW 874: build safety fixes for strict TypeScript production checks')
