from pathlib import Path

p = Path('.deploy/apply-1025-music-note-pagination-continuity.py')
s = p.read_text(encoding='utf-8')

s = s.replace(
    '"const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;",\n    "const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;\\n"',
    '"// SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024",\n    "// SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024\\n"',
    1,
)

needle = '    "bundle cursor id",\n)\n\nload_more_pattern'
replacement = '''    "bundle cursor id",
)
# App contains another bundle-hydration path used by incremental sync. Never
# keep a timestamp-only cursor there either: recover the exact document id.
app = app.replace(bundle_old, bundle_new)
remaining_bundle_cursor = "favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;"
remaining_bundle_replacement = """favoritePaginationCursorRef.current = (() => {
        const cursorFavorite = Array.isArray(bundle.items) && bundle.items.length > 0
          ? bundle.items[bundle.items.length - 1]
          : null;
        const cursorId = String(cursorFavorite?.id || cursorFavorite?.firestoreId || '').trim();
        return bundle.hasMore && cursorId
          ? { id: cursorId, createdAtMs: Number(bundle.cursorCreatedAtMs || 0), legacy: false }
          : null;
      })();"""
app = app.replace(remaining_bundle_cursor, remaining_bundle_replacement)

load_more_pattern'''

if needle not in s:
    raise SystemExit('1025 normalizer: bundle insertion anchor missing')

s = s.replace(needle, replacement, 1)
p.write_text(s, encoding='utf-8')
print('1025 staging compatibility normalized')
