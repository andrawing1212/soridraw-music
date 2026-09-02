from pathlib import Path
p = Path('.tmp/apply-tooltip-perf-v1.py')
s = p.read_text(encoding='utf-8')
old = """external_hover_clear = '    setIsTooltipHovered(false);\\n'
if s.count(external_hover_clear) != 1:
    raise SystemExit(f'external tooltip hovered clear count mismatch: {s.count(external_hover_clear)}')
s = s.replace(external_hover_clear, '', 1)
"""
new = """external_hover_clear = \"\"\"    setHoveredItem(null);\n    setIsTooltipHovered(false);\n\n    const normalizeGenreKey\"\"\"
external_hover_clear_next = \"\"\"    setHoveredItem(null);\n\n    const normalizeGenreKey\"\"\"
if s.count(external_hover_clear) != 1:
    raise SystemExit(f'external tooltip hovered clear block mismatch: {s.count(external_hover_clear)}')
s = s.replace(external_hover_clear, external_hover_clear_next, 1)
"""
if s.count(old) != 1:
    raise SystemExit(f'patch script selector block mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('temporary tooltip patch selector fixed')
