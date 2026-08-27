from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8E4_MUSIC_NOTE_PUBLICATION_UI_956'

if marker in text:
    print('apply-956: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_PUBLICATION_UI_902' not in text:
    raise RuntimeError('apply-956: apply-902 must run first')


def replace_once(source: str, target: str, label: str) -> None:
    global text
    if source not in text:
        raise RuntimeError(f'apply-956: anchor not found: {label}')
    text = text.replace(source, target, 1)


def replace_between(start: str, end: str, replacement: str, label: str) -> None:
    global text
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f'apply-956: start anchor not found: {label}')
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f'apply-956: end anchor not found: {label}')
    text = text[:start_index] + replacement + text[end_index:]


replace_once(
    "  Heart as HeartIcon,\n  Lock,\n",
    "  Heart as HeartIcon,\n  Globe2,\n  Lock,\n",
    'Globe2 icon import',
)

replace_once(
    "  publishMusicNoteToExplore,\n  setExploreTrackVisibility,\n  type ExploreMusicNotePublicationState,\n} from '../services/explorePublicationService';\n",
    "  publishMusicNoteToExplore,\n  setExploreTrackPublicationOptions,\n  setExploreTrackVisibility,\n  type ExploreMusicNotePublicationState,\n  type ExplorePublicationOptions,\n} from '../services/explorePublicationService';\n",
    'Explore 8-E publication service imports',
)

replace_once(
    "  const [explorePublicationBusyId, setExplorePublicationBusyId] = useState<string | null>(null);\n",
    "  const [explorePublicationBusyId, setExplorePublicationBusyId] = useState<string | null>(null);\n"
    f"  {marker}\n"
    "  const [explorePublicationDialog, setExplorePublicationDialog] = useState<{\n"
    "    song: any;\n"
    "    sourceId: string;\n"
    "    state: ExploreMusicNotePublicationState;\n"
    "    options: ExplorePublicationOptions;\n"
    "  } | null>(null);\n"
    "  const [explorePublicationPrivateConfirm, setExplorePublicationPrivateConfirm] = useState(false);\n",
    'Explore 8-E dialog state',
)

helper_start = "  const toggleFavoriteExplorePublication = async (song: any) => {"
helper_end = "  const executeFavoriteMenuAction = (action:"
helper_code = r'''  const openFavoriteExplorePublicationDialog = async (song: any) => {
    setActiveFavoriteMenuId(null);
    setExplorePublicationPrivateConfirm(false);

    if (!user?.uid) {
      showFavoriteToast('로그인이 필요합니다.');
      onLogin?.();
      return;
    }
    if (!song || shouldHideSunoUrlControls(song)) {
      showFavoriteToast('내 뮤직노트 곡만 Explore 공개 설정을 변경할 수 있습니다.');
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
      const state = await getExploreMusicNotePublicationState(user, sourceId);
      setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: state }));
      setExplorePublicationDialog({
        song,
        sourceId,
        state,
        options: {
          allowNextSongApply: Boolean(state.allowNextSongApply),
          allowFollowerSave: Boolean(state.allowFollowerSave),
          profilePinned: Boolean(state.profilePinned),
        },
      });
    } catch (error) {
      console.error('explore publication dialog load failed:', error);
      showFavoriteToast(getExplorePublicationErrorMessage(error));
    } finally {
      setExplorePublicationBusyId((current) => current === sourceId ? null : current);
    }
  };

  const updateFavoriteExplorePublicationDialogOption = (key: keyof ExplorePublicationOptions) => {
    setExplorePublicationDialog((current) => current
      ? { ...current, options: { ...current.options, [key]: !current.options[key] } }
      : current);
  };

  const submitFavoriteExplorePublicationDialog = async () => {
    if (!user?.uid || !explorePublicationDialog) return;
    const { song, sourceId, state, options } = explorePublicationDialog;
    if (explorePublicationBusyId === sourceId) return;

    if (state.status !== 'public' && !hasConnectedFavoriteSunoUrl(song)) {
      showFavoriteToast('수노 URL을 먼저 등록하고 정상 연결해주세요. 연결이 확인되면 Explore에 공개할 수 있습니다.');
      return;
    }

    setExplorePublicationBusyId(sourceId);
    try {
      let nextState: ExploreMusicNotePublicationState;
      if (state.status === 'public') {
        const savedOptions = await setExploreTrackPublicationOptions(user, state.trackId, options);
        nextState = { ...state, ...savedOptions, status: 'public' };
        showFavoriteToast('공개 설정을 저장했습니다.');
      } else {
        nextState = await publishMusicNoteToExplore(user, sourceId, options);
        showFavoriteToast('Explore에 공개했습니다.');
      }

      setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: nextState }));
      setExplorePublicationDialog(null);
      setExplorePublicationPrivateConfirm(false);
    } catch (error) {
      console.error('explore publication submit failed:', error);
      showFavoriteToast(getExplorePublicationErrorMessage(error));
    } finally {
      setExplorePublicationBusyId((current) => current === sourceId ? null : current);
    }
  };

  const makeFavoriteExplorePublicationPrivate = async () => {
    if (!user?.uid || !explorePublicationDialog) return;
    const { sourceId, state, options } = explorePublicationDialog;
    if (state.status !== 'public' || explorePublicationBusyId === sourceId) return;

    if (!explorePublicationPrivateConfirm) {
      setExplorePublicationPrivateConfirm(true);
      return;
    }

    setExplorePublicationBusyId(sourceId);
    try {
      const visibilityState = await setExploreTrackVisibility(user, state.trackId, false);
      const nextState: ExploreMusicNotePublicationState = {
        ...visibilityState,
        ...options,
        status: 'private',
      };
      setExplorePublicationStateBySongId((prev) => ({ ...prev, [sourceId]: nextState }));
      setExplorePublicationDialog(null);
      setExplorePublicationPrivateConfirm(false);
      showFavoriteToast('Explore에서 비공개로 전환했습니다.');
    } catch (error) {
      console.error('explore publication private transition failed:', error);
      showFavoriteToast(getExplorePublicationErrorMessage(error));
    } finally {
      setExplorePublicationBusyId((current) => current === sourceId ? null : current);
    }
  };

'''
replace_between(helper_start, helper_end, helper_code, 'replace immediate publication toggle with dialog flow')

text = text.replace('toggleFavoriteExplorePublication(song)', 'openFavoriteExplorePublicationDialog(song)')
text = text.replace('toggleFavoriteExplorePublication(selectedSong)', 'openFavoriteExplorePublicationDialog(selectedSong)')

keyword_anchor = '''                        <div
                          className="soridraw-musicnote-song-keywords favorite-keyword-strip flex h-5 min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-md pr-2"
'''
keyword_replacement = r'''                        {!shouldHideSunoUrlControls(song) && (
                          <div className="soridraw-musicnote-song-state-actions flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <button
                              data-no-card-long-press="true"
                              type="button"
                              disabled
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/30 opacity-80"
                              aria-label="좋아요"
                              title="Explore 좋아요는 다음 단계에서 연결됩니다."
                            >
                              <HeartIcon className="h-3 w-3" />
                            </button>
                            <button
                              data-no-card-long-press="true"
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleToggleLock(song);
                              }}
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                                song.isLocked
                                  ? "bg-[#FF7A72]/20 text-[#FFC1BC] shadow-[0_0_12px_rgba(255,122,114,0.18)]"
                                  : "bg-white/[0.055] text-white/38 hover:bg-white/[0.09] hover:text-white/75"
                              )}
                              aria-label={song.isLocked ? '잠금 해제' : '잠금'}
                              title={song.isLocked ? '잠금 해제' : '잠금'}
                            >
                              {song.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            </button>
                            <button
                              data-no-card-long-press="true"
                              type="button"
                              disabled={explorePublicationBusyId === getFavoriteDocumentId(song)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void openFavoriteExplorePublicationDialog(song);
                              }}
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40",
                                explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'
                                  ? "bg-[#FF7A72]/20 text-[#FFC1BC] shadow-[0_0_12px_rgba(255,122,114,0.18)]"
                                  : "bg-white/[0.055] text-white/38 hover:bg-white/[0.09] hover:text-white/75"
                              )}
                              aria-label={explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '공개 설정' : '공개'}
                              title={explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public' ? '공개 설정' : '공개'}
                            >
                              {explorePublicationBusyId === getFavoriteDocumentId(song)
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Globe2 className="h-3 w-3" />}
                            </button>
                          </div>
                        )}
                        <div
                          className="soridraw-musicnote-song-keywords favorite-keyword-strip flex h-5 min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-md pr-2"
'''
replace_once(keyword_anchor, keyword_replacement, 'fixed three card state buttons before keywords')

old_right_lock = r'''                    <div className="soridraw-musicnote-song-actions flex items-center gap-2 shrink-0">
                      {song.isLocked && (
                        <span className="hidden md:inline-flex h-10 w-10 items-center justify-center text-[#FF7A72]">
                          <Lock className="w-4 h-4" />
                        </span>
                      )}

                      {song.isLocked && (
                        <span className="inline-flex h-10 w-10 items-center justify-center text-[#FF7A72] md:hidden">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
<div className="relative">'''
new_right_lock = r'''                    <div className="soridraw-musicnote-song-actions flex items-center gap-2 shrink-0">
<div className="relative">'''
replace_once(old_right_lock, new_right_lock, 'remove duplicate conditional right lock badges')

modal_anchor = '''      <AnimatePresence>
        {musicNoteFolderPicker && (
'''
modal_code = r'''      <AnimatePresence>
        {explorePublicationDialog && (
          <StudioCenterModalPortal themeClassName="soridraw-explore-publication-modal-portal">
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
              className="fixed inset-0 z-[430] flex items-end justify-center bg-black/58 px-4 py-5 backdrop-blur-sm md:items-center"
              onClick={() => {
                if (explorePublicationBusyId !== explorePublicationDialog.sourceId) {
                  setExplorePublicationDialog(null);
                  setExplorePublicationPrivateConfirm(false);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0 }}
                className="w-full max-w-[430px] overflow-hidden rounded-[28px] bg-[#1b1b1b] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFC1BC]/72">Explore</p>
                    <h3 className="mt-1 text-xl font-black text-white">공개 설정</h3>
                    <p className="mt-1 truncate text-xs font-semibold text-white/42">
                      {String(explorePublicationDialog.song?.title || explorePublicationDialog.song?.koreanTitle || explorePublicationDialog.song?.englishTitle || '제목 없는 곡')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (explorePublicationBusyId !== explorePublicationDialog.sourceId) {
                        setExplorePublicationDialog(null);
                        setExplorePublicationPrivateConfirm(false);
                      }
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/50 transition-all hover:bg-white/[0.09] hover:text-white"
                    aria-label="공개 설정 닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 space-y-2.5">
                  {([
                    { key: 'allowNextSongApply', label: '다음곡에 적용 허용', description: '다른 사용자가 이 곡의 공개 설정을 다음곡에 활용할 수 있습니다.' },
                    { key: 'allowFollowerSave', label: '팔로워 곡 저장 허용', description: '나를 팔로우한 사용자가 이 공개곡을 공유 노트에 저장할 수 있습니다.' },
                    { key: 'profilePinned', label: '공개 프로필에 고정', description: '공개 프로필의 상단에 이 곡을 고정합니다.' },
                  ] as const).map((item) => {
                    const active = explorePublicationDialog.options[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="switch"
                        aria-checked={active}
                        onClick={() => updateFavoriteExplorePublicationDialogOption(item.key)}
                        className="flex w-full items-center gap-4 rounded-2xl bg-white/[0.045] px-4 py-3.5 text-left transition-all hover:bg-white/[0.07]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-white/88">{item.label}</span>
                          <span className="mt-1 block text-[11px] leading-5 text-white/38">{item.description}</span>
                        </span>
                        <span
                          className={cn(
                            "relative h-7 w-12 shrink-0 rounded-full transition-all",
                            active ? "bg-[#FF7A72]" : "bg-white/[0.11]"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-all",
                              active ? "left-6" : "left-1"
                            )}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {explorePublicationDialog.state.status === 'public' && explorePublicationPrivateConfirm && (
                  <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-semibold leading-5 text-red-200/85">
                    비공개로 전환하면 Explore와 공개 프로필에서 즉시 숨겨집니다. D1 기록은 삭제하지 않습니다.
                  </div>
                )}

                <div className="mt-6 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void submitFavoriteExplorePublicationDialog()}
                    disabled={explorePublicationBusyId === explorePublicationDialog.sourceId}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7A72] text-sm font-black text-white shadow-[0_12px_28px_rgba(255,122,114,0.18)] transition-all hover:bg-[#FF8C85] disabled:cursor-wait disabled:opacity-45"
                  >
                    {explorePublicationBusyId === explorePublicationDialog.sourceId && <Loader2 className="h-4 w-4 animate-spin" />}
                    {explorePublicationDialog.state.status === 'public' ? '저장' : '공개'}
                  </button>

                  {explorePublicationDialog.state.status === 'public' && (
                    <button
                      type="button"
                      onClick={() => void makeFavoriteExplorePublicationPrivate()}
                      disabled={explorePublicationBusyId === explorePublicationDialog.sourceId}
                      className={cn(
                        "flex h-11 w-full items-center justify-center rounded-2xl text-sm font-black transition-all disabled:cursor-wait disabled:opacity-45",
                        explorePublicationPrivateConfirm
                          ? "bg-red-500/18 text-red-200 hover:bg-red-500/24"
                          : "bg-white/[0.055] text-white/48 hover:bg-white/[0.085] hover:text-white/78"
                      )}
                    >
                      {explorePublicationPrivateConfirm ? '비공개 전환 확인' : '비공개로 전환'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (explorePublicationBusyId !== explorePublicationDialog.sourceId) {
                        setExplorePublicationDialog(null);
                        setExplorePublicationPrivateConfirm(false);
                      }
                    }}
                    className="h-10 w-full rounded-2xl bg-transparent text-xs font-bold text-white/30 transition-colors hover:text-white/60"
                  >
                    취소
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </StudioCenterModalPortal>
        )}
      </AnimatePresence>

'''
if modal_anchor not in text:
    raise RuntimeError('apply-956: modal insertion anchor not found')
text = text.replace(modal_anchor, modal_code + modal_anchor, 1)

if 'toggleFavoriteExplorePublication(' in text:
    raise RuntimeError('apply-956: immediate publication toggle call remains')

required_fragments = [
    marker,
    'soridraw-musicnote-song-state-actions',
    'openFavoriteExplorePublicationDialog',
    'submitFavoriteExplorePublicationDialog',
    'setExploreTrackPublicationOptions',
    '다음곡에 적용 허용',
    '팔로워 곡 저장 허용',
    '공개 프로필에 고정',
    '비공개 전환 확인',
]
for fragment in required_fragments:
    if fragment not in text:
        raise RuntimeError(f'apply-956 verification failed: missing {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-956: Music Note fixed state buttons + Explore publication settings dialog applied')
