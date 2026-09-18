from pathlib import Path

path = Path('.deploy/apply-960-music-note-lightweight-card-state.py')
source = path.read_text(encoding='utf-8')
source = source.replace(
    "marker = '// SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960'",
    "marker = 'const SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960 = true;'",
    1,
)
exec(compile(source, str(path), 'exec'), {'__name__': '__main__'})
