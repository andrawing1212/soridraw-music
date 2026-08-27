from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_PUBLICATION_UI_902'

if marker in text:
    print('apply-902: already applied')
    raise SystemExit(0)


def replace_once(source: str, target: str, label: str) -> None:
    global text
    if source not in text:
        raise RuntimeError(f'apply-902: anchor not found: {label}')
    text = text.replace(source, target, 1)


replace_once(
    "import { favoritesStore } from '../hooks/useFavoritesStore';\n",
    "import { favoritesStore } from '../hooks/useFavoritesStore';\n"
    "import {\n"
    "  getExploreMusicNotePublicationState,\n"
    "  getExplorePublicationErrorMessage,\n"
    "  publishMusicNoteToExplore,\n"
    "  setExploreTrackVisibility,\n"
    "  type ExploreMusicNotePublicationState,\n"
    "} from '../services/explorePublicationService';\n",
    'Explore publication service import',
)

replace_once(
    "  const [activeFavoriteMenuId, setActiveFavoriteMenuId] = useState<string | null>(null);\n",
    "  const [activeFavoriteMenuId, setActiveFavoriteMenuId] = useState<string | null>(null);\n"
    f"  {marker}\n"
    "  const [explorePublicationStateBySongId, setExplorePublicationStateBySongId] = useState<Record<string, ExploreMusicNotePublicationState>>({});\n"
    "  const [explorePublicationBusyId, setExplorePublicationBusyId] = useState<string | null>(null);\n",
    'Explore publication state',
)

helper_anchor = "  const executeFavoriteMenuAction = (action: 'details' | 'select' | 'apply' | 'share'"
helper_code = r'''  const hasConnectedFavoriteSunoUrl = (song: any) => {
    const mainUrl = String(getFavoriteSunoShareUrl(song) || '').trim();
    if (!mainUrl) return false;

    const links = getFavoriteSunoLinks(song);
    const connectedLink = links.find((link: any) => String(link?.url || '').trim() === mainUrl)
      || links.find((link: any) => String(link?.url || '').trim());
    if (!connectedLink) return false;

    // URL text alone is not enough. A successful Suno metadata connection leaves
    // fetchedAt or usable metadata on the normalized link. The metadata fallback
    // keeps older successfully-linked Music Note records compatible.
    return Boolean(
      connectedLink?.fetchedAt
      || String(connectedLink?.title || '').trim()
      || String(connectedLink?.coverUrl || connectedLink?.imageUrl || '').trim()
      || Number(connectedLink?.durationSeconds || 0) > 0
      || String(connectedLink?.durationText || '').trim()
    );
  };

  const canToggleFavoriteExplorePublication = (song: any) => {
    const sourceId = getFavoriteDocumentId(song);
    return explorePublicationStateBySongId[sourceId]?.status === 'public'
      || hasConnectedFavoriteSunoUrl(song);
  };

  const refreshFavoriteExplorePublicationState = async (song: any) => {
    if (!user?.uid || !song || shouldHideSunoUrlControls(song)) return;
    const sourceId = getFavoriteDocumentId(song);
    if (!sourceId) return;

    try {
      const state = await getExploreMusicNotePublicationState(user, sourceId);
      setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: state }));
    } catch (error) {
      console.warn('explore publication state load failed:', error);
    }
  };

  useEffect(() => {
    if (!activeFavoriteMenuId || !user?.uid) return;
    const song = activeFavoriteSource.find((item) => getFavoriteDocumentId(item) === activeFavoriteMenuId || item?.id === activeFavoriteMenuId);
    const sourceId = getFavoriteDocumentId(song);
    if (!song || !sourceId || explorePublicationStateBySongId[sourceId]) return;
    void refreshFavoriteExplorePublicationState(song);
  }, [activeFavoriteMenuId, user?.uid]);

  useEffect(() => {
    if (!selectedSong || !user?.uid || isSelectedSongReadOnly) return;
    const sourceId = getFavoriteDocumentId(selectedSong);
    if (!sourceId || explorePublicationStateBySongId[sourceId]) return;
    void refreshFavoriteExplorePublicationState(selectedSong);
  }, [selectedSong, user?.uid, isSelectedSongReadOnly]);

  const toggleFavoriteExplorePublication = async (song: any) => {
    setActiveFavoriteMenuId(null);

    if (!user?.uid) {
      showFavoriteToast('로그인이 필요합니다.');
      onLogin?.();
      return;
    }
    if (!song || shouldHideSunoUrlControls(song)) {
      showFavoriteToast('내 뮤직노트 곡만 Explore에 공개할 수 있습니다.');
      return;
    }

    const sourceId = getFavoriteDocumentId(song);
    if (!sourceId) {
      showFavoriteToast('뮤직노트 원본 정보를 확인하지 못했습니다.');
      return;
    }
    if (explorePublicationBusyId === sourceId) return;

    setExplorePublicationBusyId(sourceId);
    try {
      const currentState = await getExploreMusicNotePublicationState(user, sourceId);
      if (currentState.status !== 'public' && !hasConnectedFavoriteSunoUrl(song)) {
        showFavoriteToast('수노 URL을 먼저 등록하고 정상 연결해주세요. 연결이 확인되면 Explore에 공개할 수 있습니다.');
        return;
      }

      const nextState = currentState.status === 'public'
        ? await setExploreTrackVisibility(user, currentState.trackId, false)
        : await publishMusicNoteToExplore(user, sourceId);

      setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: nextState }));
      showFavoriteToast(nextState.status === 'public' ? 'Explore에 공개했습니다.' : 'Explore에서 비공개로 전환했습니다.');
    } catch (error) {
      console.error('explore publication toggle failed:', error);
      showFavoriteToast(getExplorePublicationErrorMessage(error));
    } finally {
      setExplorePublicationBusyId((current) => current === sourceId ? null : current);
    }
  };

'''
if helper_anchor not in text:
    raise RuntimeError('apply-902: anchor not found: Explore publication helpers')
text = text.replace(helper_anchor, helper_code + helper_anchor, 1)

menu_anchor = '''                                <button onClick={() => executeFavoriteMenuAction('share', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Share2 className="w-4 h-4" />공유</button>
                                {!shouldHideSunoUrlControls(song) && (
'''
menu_replacement = '''                                <button onClick={() => executeFavoriteMenuAction('share', song)} className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 flex items-center gap-3"><Share2 className="w-4 h-4" />공유</button>
                                <button
                                  type="button"
                                  disabled={explorePublicationBusyId === getFavoriteDocumentId(song)}
                                  aria-disabled={!canToggleFavoriteExplorePublication(song) || undefined}
                                  onClick={() => toggleFavoriteExplorePublication(song)}
                                  className={cn(
                                    "flex w-full items-center gap-3 bg-transparent px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-35",
                                    canToggleFavoriteExplorePublication(song)
                                      ? "text-white/85 hover:bg-white/5 hover:text-[#FFC1BC]"
                                      : "cursor-pointer text-white/30 hover:bg-white/[0.025] hover:text-white/45"
                                  )}
                                  title={canToggleFavoriteExplorePublication(song) ? undefined : '수노 URL을 등록하고 정상 연결해주세요.'}
                                >
                                  {explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'
                                    ? <Lock className="h-4 w-4" />
                                    : <Unlock className="h-4 w-4" />}
                                  {explorePublicationBusyId === getFavoriteDocumentId(song)
                                    ? '처리 중...'
                                    : explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'
                                      ? '비공개'
                                      : '공개'}
                                </button>
                                {!shouldHideSunoUrlControls(song) && (
'''
replace_once(menu_anchor, menu_replacement, 'Music Note more-menu publication button')

detail_anchor = '''                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {isEditing && isModified && (
'''
detail_replacement = '''                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {!isSelectedSongReadOnly && (
                      <button
                        type="button"
                        onClick={() => toggleFavoriteExplorePublication(selectedSong)}
                        disabled={isEditing || explorePublicationBusyId === getFavoriteDocumentId(selectedSong)}
                        aria-disabled={!canToggleFavoriteExplorePublication(selectedSong) || undefined}
                        onMouseEnter={() => onHover({
                          id: 'detail-explore-visibility',
                          label: explorePublicationStateBySongId[getFavoriteDocumentId(selectedSong)]?.status === 'public' ? '비공개' : '공개',
                          description: canToggleFavoriteExplorePublication(selectedSong)
                            ? (explorePublicationStateBySongId[getFavoriteDocumentId(selectedSong)]?.status === 'public' ? 'Explore에서 이 곡을 비공개로 전환합니다.' : '이 곡을 Explore에 공개합니다.')
                            : '수노 URL을 먼저 등록하고 정상 연결해주세요. 연결이 확인되면 Explore에 공개할 수 있습니다.',
                        })}
                        onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                        className={cn(
                          "inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.035] transition-all disabled:cursor-wait disabled:opacity-30",
                          canToggleFavoriteExplorePublication(selectedSong)
                            ? "text-white/78 hover:bg-[#FF7A72]/12 hover:text-[#FFC1BC]"
                            : "cursor-pointer text-white/25 hover:bg-white/[0.055] hover:text-white/40"
                        )}
                        aria-label={explorePublicationStateBySongId[getFavoriteDocumentId(selectedSong)]?.status === 'public' ? 'Explore 비공개' : 'Explore 공개'}
                        title={canToggleFavoriteExplorePublication(selectedSong) ? undefined : '수노 URL을 등록하고 정상 연결해주세요.'}
                      >
                        {explorePublicationBusyId === getFavoriteDocumentId(selectedSong)
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : explorePublicationStateBySongId[getFavoriteDocumentId(selectedSong)]?.status === 'public'
                            ? <Lock className="h-5 w-5" />
                            : <Unlock className="h-5 w-5" />}
                      </button>
                    )}

                    {isEditing && isModified && (
'''
replace_once(detail_anchor, detail_replacement, 'Music Note detail publication button')

path.write_text(text, encoding='utf-8')
print('apply-902: Explore publication UI + verified Suno connection gate applied')