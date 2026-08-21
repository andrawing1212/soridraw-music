from pathlib import Path

GEMINI_MARKER = 'SORIDRAW_874_BUILD_SAFETY_GEMINI'
APP_MARKER = 'SORIDRAW_874_BUILD_SAFETY_APP'

# Fix the AppliedKeywords clone introduced by the staged language patch chain.
gemini_path = Path('src/services/geminiService.ts')
gemini = gemini_path.read_text(encoding='utf-8')
if GEMINI_MARKER not in gemini:
    anchor = "    appliedKeywords: { ...(result.appliedKeywords || {}) },"
    replacement = "    appliedKeywords: { ...result.appliedKeywords }, // SORIDRAW_874_BUILD_SAFETY_GEMINI"
    if gemini.count(anchor) != 1:
        raise SystemExit(f'874 gemini AppliedKeywords anchor mismatch: {gemini.count(anchor)}')
    gemini = gemini.replace(anchor, replacement, 1)
    gemini_path.write_text(gemini, encoding='utf-8')

# Remove an unreachable duplicate branch. pure-pane-hybrid is already handled by
# the outer if and therefore cannot reach this mapping chain.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if APP_MARKER not in app:
    anchor = """                            : mode === 'pure-pane'\n                              ? 'pure-pane'\n                              : mode === 'pure-pane-hybrid'\n                                ? 'pure-pane-hybrid'\n                                : mode === 'pure-pane-live'"""
    replacement = """                            : mode === 'pure-pane'\n                              ? 'pure-pane'\n                              : mode === 'pure-pane-live' // SORIDRAW_874_BUILD_SAFETY_APP"""
    if app.count(anchor) != 1:
        raise SystemExit(f'874 App unreachable branch anchor mismatch: {app.count(anchor)}')
    app = app.replace(anchor, replacement, 1)
    app_path.write_text(app, encoding='utf-8')

print('Applied SORIDRAW 874: build safety fixes for strict TypeScript production checks')
