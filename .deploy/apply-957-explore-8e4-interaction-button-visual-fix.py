from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8E4_INTERACTION_BUTTON_FIX_957'

if marker in text:
    print('apply-957: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_8E4_MUSIC_NOTE_PUBLICATION_UI_956' not in text:
    raise RuntimeError('apply-957: apply-956 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-957: anchor not found: {label}')
    text = text.replace(old, new, 1)


# Marker + monochrome like icon.
replace_once(
    '// SORIDRAW_EXPLORE_8E4_MUSIC_NOTE_PUBLICATION_UI_956',
    '// SORIDRAW_EXPLORE_8E4_MUSIC_NOTE_PUBLICATION_UI_956\n  ' + marker,
    '957 marker',
)
replace_once(
    '  Heart as HeartIcon,\n  Globe2,\n',
    '  Heart as HeartIcon,\n  ThumbsUp,\n  Globe2,\n',
    'ThumbsUp icon import',
)

# Give the card enough vertical room for the larger three-button control row.
replace_once(
    'className="soridraw-musicnote-song-row flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4"',
    'className="soridraw-musicnote-song-row flex items-center gap-3 md:gap-4 px-4 md:px-6 py-5"',
    'Music Note row height',
)
replace_once(
    '<div className="mt-1.5 flex min-w-0 items-center gap-2">',
    '<div className="mt-2 flex min-h-8 min-w-0 items-center gap-2">',
    'Music Note state row height',
)

# Like: inactive placeholder for 8-E-5, but visually identical to the other OFF buttons.
replace_once(
    '''                              disabled\n                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/30 opacity-80"\n                              aria-label="좋아요"\n                              title="Explore 좋아요는 다음 단계에서 연결됩니다."\n                            >\n                              <HeartIcon className="h-3 w-3" />''',
    '''                              disabled\n                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white/62 opacity-100"\n                              aria-label="좋아요"\n                              title="Explore 좋아요는 다음 단계에서 연결됩니다."\n                            >\n                              <ThumbsUp className="h-4 w-4" />''',
    'larger monochrome like button',
)

# Lock: same icon in both states; state is communicated only by the circular fill.
replace_once(
    '''                              className={cn(\n                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",\n                                song.isLocked\n                                  ? "bg-[#FF7A72]/20 text-[#FFC1BC] shadow-[0_0_12px_rgba(255,122,114,0.18)]"\n                                  : "bg-white/[0.055] text-white/38 hover:bg-white/[0.09] hover:text-white/75"\n                              )}\n                              aria-label={song.isLocked ? '잠금 해제' : '잠금'}\n                              title={song.isLocked ? '잠금 해제' : '잠금'}\n                            >\n                              {song.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}''',
    '''                              className={cn(\n                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",\n                                song.isLocked\n                                  ? "bg-white text-[#171717] shadow-[0_2px_9px_rgba(0,0,0,0.28)]"\n                                  : "bg-white/[0.10] text-white/62 hover:bg-white/[0.16] hover:text-white"\n                              )}\n                              aria-label={song.isLocked ? '잠금 해제' : '잠금'}\n                              title={song.isLocked ? '잠금 해제' : '잠금'}\n                            >\n                              <Lock className="h-4 w-4" />''',
    'larger monochrome lock button',
)

# Public: same monochrome treatment as Lock. Active = solid white circle + dark icon.
replace_once(
    '''                              className={cn(\n                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40",\n                                explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'\n                                  ? "bg-[#FF7A72]/20 text-[#FFC1BC] shadow-[0_0_12px_rgba(255,122,114,0.18)]"\n                                  : "bg-white/[0.055] text-white/38 hover:bg-white/[0.09] hover:text-white/75"\n                              )}''',
    '''                              className={cn(\n                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40",\n                                explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'\n                                  ? "bg-white text-[#171717] shadow-[0_2px_9px_rgba(0,0,0,0.28)]"\n                                  : "bg-white/[0.10] text-white/62 hover:bg-white/[0.16] hover:text-white"\n                              )}''',
    'larger monochrome public button',
)
replace_once(
    '<Loader2 className="h-3 w-3 animate-spin" />\n                                : <Globe2 className="h-3 w-3" />',
    '<Loader2 className="h-4 w-4 animate-spin" />\n                                : <Globe2 className="h-4 w-4" />',
    'larger public icon',
)

# The Studio center host intentionally does not own pointer interaction. The modal backdrop
# must explicitly opt back in, otherwise clicks can target the pane behind the visible modal.
replace_once(
    '''              className="fixed inset-0 z-[430] flex items-end justify-center bg-black/58 px-4 py-5 backdrop-blur-sm md:items-center"\n              onClick={() => {''',
    '''              className="pointer-events-auto fixed inset-0 z-[430] flex items-end justify-center bg-black/58 px-4 py-5 backdrop-blur-sm md:items-center"\n              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}\n              onPointerDown={(event) => event.stopPropagation()}\n              onMouseDown={(event) => event.stopPropagation()}\n              onTouchStart={(event) => event.stopPropagation()}\n              onClick={() => {''',
    'modal backdrop pointer interaction',
)
replace_once(
    '''                className="w-full max-w-[430px] overflow-hidden rounded-[28px] bg-[#1b1b1b] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:p-6"\n                onClick={(event) => event.stopPropagation()}''',
    '''                className="pointer-events-auto w-full max-w-[430px] overflow-hidden rounded-[28px] bg-[#1b1b1b] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:p-6"\n                style={{ pointerEvents: 'auto' }}\n                onPointerDown={(event) => event.stopPropagation()}\n                onMouseDown={(event) => event.stopPropagation()}\n                onTouchStart={(event) => event.stopPropagation()}\n                onClick={(event) => event.stopPropagation()}''',
    'modal panel pointer interaction',
)

# Validate the exact user-facing contract for this follow-up.
required = [
    marker,
    'ThumbsUp',
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
    'bg-white text-[#171717]',
    'pointer-events-auto fixed inset-0 z-[430]',
    "style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}",
    'min-h-8',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-957 verification failed: missing {fragment}')

state_start = text.find('soridraw-musicnote-song-state-actions')
state_end = text.find('soridraw-musicnote-song-keywords', state_start)
if state_start < 0 or state_end < 0:
    raise RuntimeError('apply-957: state button region not found')
state_region = text[state_start:state_end]
if '#FF7A72' in state_region or '#FFC1BC' in state_region:
    raise RuntimeError('apply-957: colored state-button icon/fill remains')

path.write_text(text, encoding='utf-8')
print('apply-957: modal interaction restored + larger monochrome state buttons applied')
