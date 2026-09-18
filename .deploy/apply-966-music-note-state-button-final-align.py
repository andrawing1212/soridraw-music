from pathlib import Path

page_path = Path('src/pages/FavoritesPage.tsx')
text = page_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FINAL_ALIGN_966'

if marker in text:
    print('apply-966: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_PUBLICATION_STATE_HYDRATION_965' not in text:
    raise RuntimeError('apply-966: apply-965 must run first')

start = text.find('soridraw-musicnote-song-state-actions')
end = text.find('soridraw-musicnote-song-keywords', start)
if start < 0 or end < 0:
    raise RuntimeError('apply-966: state button region not found')
region = text[start:end]

# Slightly smaller circular controls: 30px -> 29px.
count = region.count('h-[30px] w-[30px]')
if count != 3:
    raise RuntimeError(f'apply-966: expected 3 compact buttons, found {count}')
region = region.replace('h-[30px] w-[30px]', 'h-[29px] w-[29px]')

old_like = '''                              {isMusicNoteCardLiked(song) ? (\n                                <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>\n                                  <path fill="currentColor" d="M2.8 20.2h3.4V9.7H2.8v10.5Zm18.1-9.35c0-.93-.75-1.68-1.68-1.68h-5.28l.8-3.87.03-.28c0-.35-.14-.69-.38-.93L13.5 3.2 7.9 8.8a1.7 1.7 0 0 0-.5 1.2v7.9c0 .93.75 1.68 1.68 1.68h7.58c.7 0 1.31-.42 1.57-1.03l2.53-5.9c.09-.2.14-.43.14-.67v-1.13Z" />\n                                </svg>\n                              ) : (\n                                <ThumbsUp className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />\n                              )}'''
new_like = '''                              <svg\n                                aria-hidden="true"\n                                viewBox="0 0 24 24"\n                                className="relative z-[1] h-[13px] w-[13px]"\n                                style={{\n                                  color: isMusicNoteCardLiked(song) ? '#202024' : 'rgba(255,255,255,0.66)',\n                                  transform: 'translateX(0.5px)',\n                                }}\n                              >\n                                <path fill="currentColor" d="M2.8 20.2h3.4V9.7H2.8v10.5Zm18.1-9.35c0-.93-.75-1.68-1.68-1.68h-5.28l.8-3.87.03-.28c0-.35-.14-.69-.38-.93L13.5 3.2 7.9 8.8a1.7 1.7 0 0 0-.5 1.2v7.9c0 .93.75 1.68 1.68 1.68h7.58c.7 0 1.31-.42 1.57-1.03l2.53-5.9c.09-.2.14-.43.14-.67v-1.13Z" />\n                              </svg>'''
if old_like not in region:
    raise RuntimeError('apply-966: like glyph anchor not found')
region = region.replace(old_like, new_like, 1)

old_lock = '''                              {isMusicNoteCardLocked(song) ? (\n                                <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>\n                                  <path fill="currentColor" fillRule="evenodd" d="M7.1 9V6.9a4.9 4.9 0 0 1 9.8 0V9h.7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h.7Zm2.2 0h5.4V6.9a2.7 2.7 0 0 0-5.4 0V9Z" clipRule="evenodd" />\n                                </svg>\n                              ) : (\n                                <Lock className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />\n                              )}'''
new_lock = '''                              <svg\n                                aria-hidden="true"\n                                viewBox="0 0 24 24"\n                                className="relative z-[1] h-[13px] w-[13px]"\n                                style={{ color: isMusicNoteCardLocked(song) ? '#202024' : 'rgba(255,255,255,0.66)' }}\n                              >\n                                <path fill="currentColor" fillRule="evenodd" d="M7.1 9V6.9a4.9 4.9 0 0 1 9.8 0V9h.7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h.7Zm2.2 0h5.4V6.9a2.7 2.7 0 0 0-5.4 0V9Z" clipRule="evenodd" />\n                              </svg>'''
if old_lock not in region:
    raise RuntimeError('apply-966: lock glyph anchor not found')
region = region.replace(old_lock, new_lock, 1)

public_state = "explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'"
old_public = '''                              {explorePublicationBusyId === getFavoriteDocumentId(song)\n                                ? <Loader2 className="relative z-[1] h-4 w-4 animate-spin" />\n                                : explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'\n                                  ? (\n                                    <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>\n                                      <path fill="currentColor" d="M12 2.2A9.8 9.8 0 1 0 12 21.8 9.8 9.8 0 0 0 12 2.2Zm6.55 5.9h-2.72a15.4 15.4 0 0 0-1.18-3.15 8.05 8.05 0 0 1 3.9 3.15ZM12 4.15c.72 1.08 1.3 2.4 1.68 3.95h-3.36c.38-1.55.96-2.87 1.68-3.95ZM4.65 14a7.95 7.95 0 0 1 0-4h3.17a17.5 17.5 0 0 0 0 4H4.65Zm.8 2h2.72c.27 1.13.67 2.2 1.18 3.15A8.05 8.05 0 0 1 5.45 16Zm2.72-7.9H5.45a8.05 8.05 0 0 1 3.9-3.15A15.4 15.4 0 0 0 8.17 8.1ZM12 19.85c-.72-1.08-1.3-2.4-1.68-3.85h3.36c-.38 1.45-.96 2.77-1.68 3.85ZM14.07 14H9.93a14.1 14.1 0 0 1 0-4h4.14a14.1 14.1 0 0 1 0 4Zm.58 5.15c.51-.95.91-2.02 1.18-3.15h2.72a8.05 8.05 0 0 1-3.9 3.15ZM16.18 14a17.5 17.5 0 0 0 0-4h3.17a7.95 7.95 0 0 1 0 4h-3.17Z" />\n                                    </svg>\n                                  )\n                                  : <Globe2 className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />}'''
new_public = f'''                              {{explorePublicationBusyId === getFavoriteDocumentId(song)\n                                ? <Loader2 className="relative z-[1] h-[13px] w-[13px] animate-spin" />\n                                : (\n                                  <svg\n                                    aria-hidden="true"\n                                    viewBox="0 0 24 24"\n                                    className="relative z-[1] h-[13px] w-[13px]"\n                                    style={{{{\n                                      color: {public_state} ? '#202024' : 'rgba(255,255,255,0.66)',\n                                      transform: 'translateX(0.5px)',\n                                    }}}}\n                                  >\n                                    <path fill="currentColor" d="M12 2.2A9.8 9.8 0 1 0 12 21.8 9.8 9.8 0 0 0 12 2.2Zm6.55 5.9h-2.72a15.4 15.4 0 0 0-1.18-3.15 8.05 8.05 0 0 1 3.9 3.15ZM12 4.15c.72 1.08 1.3 2.4 1.68 3.95h-3.36c.38-1.55.96-2.87 1.68-3.95ZM4.65 14a7.95 7.95 0 0 1 0-4h3.17a17.5 17.5 0 0 0 0 4H4.65Zm.8 2h2.72c.27 1.13.67 2.2 1.18 3.15A8.05 8.05 0 0 1 5.45 16Zm2.72-7.9H5.45a8.05 8.05 0 0 1 3.9-3.15A15.4 15.4 0 0 0 8.17 8.1ZM12 19.85c-.72-1.08-1.3-2.4-1.68-3.85h3.36c-.38 1.45-.96 2.77-1.68 3.85ZM14.07 14H9.93a14.1 14.1 0 0 1 0-4h4.14a14.1 14.1 0 0 1 0 4Zm.58 5.15c.51-.95.91-2.02 1.18-3.15h2.72a8.05 8.05 0 0 1-3.9 3.15ZM16.18 14a17.5 17.5 0 0 0 0-4h3.17a7.95 7.95 0 0 1 0 4h-3.17Z" />\n                                  </svg>\n                                )}}'''
if old_public not in region:
    raise RuntimeError('apply-966: public glyph anchor not found')
region = region.replace(old_public, new_public, 1)

text = text[:start] + region + text[end:]
text = text.replace('// SORIDRAW_EXPLORE_PUBLICATION_STATE_HYDRATION_965\n', '// SORIDRAW_EXPLORE_PUBLICATION_STATE_HYDRATION_965\n  ' + marker + '\n', 1)

required = [
    marker,
    'h-[29px] w-[29px]',
    "transform: 'translateX(0.5px)'",
    "color: isMusicNoteCardLiked(song) ? '#202024' : 'rgba(255,255,255,0.66)'",
    "color: isMusicNoteCardLocked(song) ? '#202024' : 'rgba(255,255,255,0.66)'",
    "color: explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '#202024' : 'rgba(255,255,255,0.66)'",
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-966 verification failed: missing {fragment}')

if text.count('h-[29px] w-[29px]') < 3:
    raise RuntimeError('apply-966 verification failed: three 29px buttons not found')

page_path.write_text(text, encoding='utf-8')
print('apply-966: 29px controls; like/public optically centered; same filled glyph used for ON/OFF with color-only state change')
