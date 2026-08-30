from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8E4_STATE_BUTTON_FILL_LIVE_LIKE_958'

if marker in text:
    print('apply-958: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_8E4_INTERACTION_BUTTON_FIX_957' not in text:
    raise RuntimeError('apply-958: apply-957 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-958: anchor not found: {label}')
    text = text.replace(old, new, 1)


replace_once(
    '// SORIDRAW_EXPLORE_8E4_INTERACTION_BUTTON_FIX_957',
    '// SORIDRAW_EXPLORE_8E4_INTERACTION_BUTTON_FIX_957\n  ' + marker,
    '958 marker',
)

replace_once(
    "} from '../services/explorePublicationService';\n",
    "} from '../services/explorePublicationService';\n"
    "import { getExploreLikedTrackIds, setExploreTrackLike } from '../services/exploreLikeService';\n",
    'Explore like service import',
)

replace_once(
    "  const [explorePublicationPrivateConfirm, setExplorePublicationPrivateConfirm] = useState(false);\n",
    "  const [explorePublicationPrivateConfirm, setExplorePublicationPrivateConfirm] = useState(false);\n"
    "  const [exploreLikedTrackIds, setExploreLikedTrackIds] = useState<Record<string, boolean>>({});\n"
    "  const [exploreLikeBusySourceId, setExploreLikeBusySourceId] = useState<string | null>(null);\n",
    'Explore like UI state',
)

handler_anchor = "  const executeFavoriteMenuAction = (action:"
handler_code = r'''  const getFavoriteExploreTrackId = (song: any) => {
    const sourceId = getFavoriteDocumentId(song);
    return String(explorePublicationStateBySongId[sourceId]?.trackId || '').trim();
  };

  const isFavoriteExploreLiked = (song: any) => {
    const trackId = getFavoriteExploreTrackId(song);
    return Boolean(trackId && exploreLikedTrackIds[trackId]);
  };

  const toggleFavoriteExploreLike = async (song: any) => {
    if (!user?.uid) {
      showFavoriteToast('로그인이 필요합니다.');
      onLogin?.();
      return;
    }
    if (!song || shouldHideSunoUrlControls(song)) {
      showFavoriteToast('내 뮤직노트 곡에서만 사용할 수 있습니다.');
      return;
    }

    const sourceId = getFavoriteDocumentId(song);
    if (!sourceId || exploreLikeBusySourceId === sourceId) return;

    setExploreLikeBusySourceId(sourceId);
    try {
      let publicationState = explorePublicationStateBySongId[sourceId];
      if (!publicationState) {
        publicationState = await getExploreMusicNotePublicationState(user, sourceId);
        setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: publicationState }));
      }

      if (publicationState.status !== 'public') {
        showFavoriteToast('Explore에 공개한 곡에서 좋아요를 사용할 수 있습니다.');
        return;
      }

      const trackId = String(publicationState.trackId || '').trim();
      if (!trackId) {
        showFavoriteToast('Explore 곡 정보를 확인하지 못했습니다.');
        return;
      }

      const hasKnownState = Object.prototype.hasOwnProperty.call(exploreLikedTrackIds, trackId);
      const currentlyLiked = hasKnownState
        ? Boolean(exploreLikedTrackIds[trackId])
        : (await getExploreLikedTrackIds(user, [trackId])).includes(trackId);

      const result = await setExploreTrackLike(user, trackId, !currentlyLiked);
      setExploreLikedTrackIds((prev) => ({ ...prev, [trackId]: result.liked }));
      showFavoriteToast(result.liked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.');
    } catch (error) {
      console.error('explore like toggle failed:', error);
      showFavoriteToast(error instanceof Error ? error.message : '좋아요 처리에 실패했습니다.');
    } finally {
      setExploreLikeBusySourceId((current) => current === sourceId ? null : current);
    }
  };

'''
if handler_anchor not in text:
    raise RuntimeError('apply-958: execute action anchor not found')
text = text.replace(handler_anchor, handler_code + handler_anchor, 1)

replace_once(
    '''                            <button
                              data-no-card-long-press="true"
                              type="button"
                              disabled
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white/62 opacity-100"
                              aria-label="좋아요"
                              title="Explore 좋아요는 다음 단계에서 연결됩니다."
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>''',
    '''                            <button
                              data-no-card-long-press="true"
                              type="button"
                              disabled={exploreLikeBusySourceId === getFavoriteDocumentId(song)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void toggleFavoriteExploreLike(song);
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-60"
                              style={{
                                backgroundColor: isFavoriteExploreLiked(song) ? '#f7f7f7' : '#343438',
                                color: isFavoriteExploreLiked(song) ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: isFavoriteExploreLiked(song) ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={isFavoriteExploreLiked(song) ? '좋아요 취소' : '좋아요'}
                              title={isFavoriteExploreLiked(song) ? '좋아요 취소' : '좋아요'}
                            >
                              {exploreLikeBusySourceId === getFavoriteDocumentId(song)
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <ThumbsUp className="h-4 w-4" />}
                            </button>''',
    'live monochrome like button',
)

replace_once(
    '''                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
                                song.isLocked
                                  ? "bg-white text-[#171717] shadow-[0_2px_9px_rgba(0,0,0,0.28)]"
                                  : "bg-white/[0.10] text-white/62 hover:bg-white/[0.16] hover:text-white"
                              )}
                              aria-label={song.isLocked ? '잠금 해제' : '잠금'}''',
    '''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
                              style={{
                                backgroundColor: song.isLocked ? '#f7f7f7' : '#343438',
                                color: song.isLocked ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: song.isLocked ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={song.isLocked ? '잠금 해제' : '잠금'}''',
    'lock button visible fill',
)

replace_once(
    '''                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40",
                                explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'
                                  ? "bg-white text-[#171717] shadow-[0_2px_9px_rgba(0,0,0,0.28)]"
                                  : "bg-white/[0.10] text-white/62 hover:bg-white/[0.16] hover:text-white"
                              )}
                              aria-label={explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '공개 설정' : '공개'}''',
    '''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40"
                              style={{
                                backgroundColor: explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '#f7f7f7' : '#343438',
                                color: explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '공개 설정' : '공개'}''',
    'public button visible fill',
)

required = [
    marker,
    "from '../services/exploreLikeService'",
    'toggleFavoriteExploreLike',
    'getExploreLikedTrackIds',
    'setExploreTrackLike',
    "backgroundColor: isFavoriteExploreLiked(song) ? '#f7f7f7' : '#343438'",
    "backgroundColor: song.isLocked ? '#f7f7f7' : '#343438'",
    "status === 'public' ? '#f7f7f7' : '#343438'",
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-958 verification failed: missing {fragment}')

state_start = text.find('soridraw-musicnote-song-state-actions')
state_end = text.find('soridraw-musicnote-song-keywords', state_start)
if state_start < 0 or state_end < 0:
    raise RuntimeError('apply-958: state button region not found')
state_region = text[state_start:state_end]
if '#FF7A72' in state_region or '#FFC1BC' in state_region:
    raise RuntimeError('apply-958: colored state button styling remains')

path.write_text(text, encoding='utf-8')
print('apply-958: visible OFF fills + solid-white active fills + live Explore like applied')
