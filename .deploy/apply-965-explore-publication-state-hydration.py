from pathlib import Path

page_path = Path('src/pages/FavoritesPage.tsx')
service_path = Path('src/services/explorePublicationService.ts')
page = page_path.read_text(encoding='utf-8')
service = service_path.read_text(encoding='utf-8')
page_marker = '// SORIDRAW_EXPLORE_PUBLICATION_STATE_HYDRATION_965'
service_marker = '// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965'

if page_marker in page and service_marker in service:
    print('apply-965: already applied')
    raise SystemExit(0)

if '// SORIDRAW_MUSIC_NOTE_COMPACT_SUNO_BUTTONS_964' not in page:
    raise RuntimeError('apply-965: apply-964 must run first')

# 1) Service: one paged /me/publications sweep -> sourceId keyed state map.
if service_marker not in service:
    anchor = '''export const getExploreMusicNotePublicationState = async (\n  user: User,\n  sourceId: string,\n): Promise<ExploreMusicNotePublicationState> => {\n'''
    if anchor not in service:
        raise RuntimeError('apply-965: publication service anchor not found')

    batch_code = r'''// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965
export const getExploreMusicNotePublicationStates = async (
  user: User,
): Promise<Record<string, ExploreMusicNotePublicationState>> => {
  const result: Record<string, ExploreMusicNotePublicationState> = {};
  let cursor = '';

  for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
    const query = new URLSearchParams({
      visibility: 'all',
      limit: String(PUBLICATION_PAGE_SIZE),
    });
    if (cursor) query.set('cursor', cursor);

    const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];

    items
      .map(normalizePublicationItem)
      .forEach((item) => {
        if (item.sourceType !== 'music_note') return;
        const sourceId = String(item.sourceId || '').trim();
        if (!sourceId) return;
        const expectedTrackId = getMusicNoteTrackId(user.uid, sourceId);
        result[sourceId] = {
          status: item.isPublic ? 'public' : 'private',
          trackId: item.trackId || item.id || expectedTrackId,
          allowNextSongApply: Boolean(item.allowNextSongApply),
          allowFollowerSave: Boolean(item.allowFollowerSave),
          profilePinned: Boolean(item.profilePinned),
        };
      });

    cursor = String(payload?.data?.nextCursor || '').trim();
    if (!cursor) break;
  }

  return result;
};

'''
    service = service.replace(anchor, batch_code + anchor, 1)

# 2) FavoritesPage import.
import_anchor = '''  getExploreMusicNotePublicationState,\n  getExplorePublicationErrorMessage,\n'''
if 'getExploreMusicNotePublicationStates,' not in page:
    if import_anchor not in page:
        raise RuntimeError('apply-965: FavoritesPage publication import anchor not found')
    page = page.replace(
        import_anchor,
        '''  getExploreMusicNotePublicationState,\n  getExploreMusicNotePublicationStates,\n  getExplorePublicationErrorMessage,\n''',
        1,
    )

# 3) One hydration guard per signed-in user.
dialog_state_anchor = '''  const [explorePublicationPrivateConfirm, setExplorePublicationPrivateConfirm] = useState(false);\n'''
if page_marker not in page:
    if dialog_state_anchor not in page:
        raise RuntimeError('apply-965: publication dialog state anchor not found')
    page = page.replace(
        dialog_state_anchor,
        dialog_state_anchor
        + f'  {page_marker}\n'
        + '  const explorePublicationHydratedUidRef = useRef<string | null>(null);\n',
        1,
    )

# 4) Hydrate the card map once after Music Note source is available.
selected_effect = '''  useEffect(() => {\n    if (!selectedSong || !user?.uid || isSelectedSongReadOnly) return;\n    const sourceId = getFavoriteDocumentId(selectedSong);\n    if (!sourceId || explorePublicationStateBySongId[sourceId]) return;\n    void refreshFavoriteExplorePublicationState(selectedSong);\n  }, [selectedSong, user?.uid, isSelectedSongReadOnly]);\n'''

hydration_effect = selected_effect + r'''

  useEffect(() => {
    const uid = String(user?.uid || '').trim();
    if (!uid) {
      explorePublicationHydratedUidRef.current = null;
      return;
    }
    if (!Array.isArray(activeFavoriteSource) || activeFavoriteSource.length === 0) return;
    if (explorePublicationHydratedUidRef.current === uid) return;

    explorePublicationHydratedUidRef.current = uid;
    void getExploreMusicNotePublicationStates(user)
      .then((states) => {
        if (explorePublicationHydratedUidRef.current !== uid) return;
        // Server hydration restores persisted state after reload. Any state changed in
        // this live session wins so an in-flight hydration cannot undo a recent click.
        setExplorePublicationStateBySongId((prev) => ({ ...states, ...prev }));
      })
      .catch((error) => {
        console.warn('explore publication list hydration failed:', error);
        if (explorePublicationHydratedUidRef.current === uid) {
          explorePublicationHydratedUidRef.current = null;
        }
      });
  }, [user?.uid, activeFavoriteSource.length]);
'''

if 'explore publication list hydration failed:' not in page:
    if selected_effect not in page:
        raise RuntimeError('apply-965: selected-song publication effect anchor not found')
    page = page.replace(selected_effect, hydration_effect, 1)

required_page = [
    page_marker,
    'getExploreMusicNotePublicationStates,',
    'const explorePublicationHydratedUidRef = useRef<string | null>(null);',
    "setExplorePublicationStateBySongId((prev) => ({ ...states, ...prev }));",
    '[user?.uid, activeFavoriteSource.length]',
]
for fragment in required_page:
    if fragment not in page:
        raise RuntimeError(f'apply-965 verification failed: page missing {fragment}')

required_service = [
    service_marker,
    'export const getExploreMusicNotePublicationStates = async',
    "visibility: 'all'",
    'result[sourceId] = {',
]
for fragment in required_service:
    if fragment not in service:
        raise RuntimeError(f'apply-965 verification failed: service missing {fragment}')

page_path.write_text(page, encoding='utf-8')
service_path.write_text(service, encoding='utf-8')
print('apply-965: Music Note public/private state hydrates in one paged owner-publication sweep after reload')
