from pathlib import Path

MARKER = 'SORIDRAW_928_CACHE_LIVE_OPAQUE'

overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')

if MARKER not in overlay:
    before = 'className="fixed z-[9998] w-[380px] max-w-[calc(100vw-16px)] rounded-2xl bg-black/80 px-4 py-3.5 text-white/85 shadow-2xl backdrop-blur-md"'
    after = 'className="fixed z-[9998] w-[380px] max-w-[calc(100vw-16px)] rounded-2xl bg-black px-4 py-3.5 text-white/85 shadow-2xl"'
    if overlay.count(before) != 1:
        raise SystemExit(f'928 opaque panel anchor mismatch: {overlay.count(before)}')
    overlay = overlay.replace(before, after, 1)
    overlay = overlay.replace(
        "const PANEL_POSITION_STORAGE_KEY = 'soridraw_cache_live_position_v2';",
        f"// {MARKER}\nconst PANEL_POSITION_STORAGE_KEY = 'soridraw_cache_live_position_v2';",
        1,
    )
    overlay_path.write_text(overlay, encoding='utf-8')
    print('Applied SORIDRAW 928: CACHE LIVE uses a fully opaque black background.')
else:
    print('SORIDRAW 928 already applied.')

final_overlay = overlay_path.read_text(encoding='utf-8')
if 'bg-black/80' in final_overlay:
    raise SystemExit('928 safety failed: translucent CACHE LIVE background remains')
