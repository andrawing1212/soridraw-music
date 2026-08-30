from pathlib import Path

checks = {
    'src/components/explore/ExploreProfileEditModal.tsx': [
        'ExploreImageCropModal',
        'suggestExploreProfileGenres',
        'soridraw-explore-profile-genre-refresh',
        'soridraw-explore-profile-genre-plus',
        '최근 10곡 기준',
        'backgroundBlob',
        'avatarBlob',
    ],
    'src/components/explore/ExploreImageCropModal.tsx': [
        'getExploreProfileCropRect',
        'prepareExploreProfileMedia',
        'onPointerMove',
        'type="range"',
        "kind === 'avatar' ? '프로필 사진 편집' : '배경 이미지 편집'",
    ],
    'src/services/exploreProfileGenreSuggestionService.ts': [
        "doc(db, 'user_recent_songs', normalizedUid)",
        'getDocFromServer(ref)',
        '.slice(0, 10)',
        'b.songHits - a.songHits',
        'a.bestTier - b.bestTier',
        'Keep ampersands intact so names like R&B are never split.',
    ],
    'src/services/exploreSocialService.ts': [
        'ExploreProfileMediaCrop',
        'getExploreProfileCropRect',
        'crop: ExploreProfileMediaCrop',
        'baseWidth / zoom',
        'offsetX * xRange',
    ],
    'src/components/explore/exploreProfileEdit.css': [
        '/* 976 crop + genre refresh */',
        '.soridraw-explore-crop-modal',
        '.soridraw-explore-profile-genre-refresh',
        '.soridraw-explore-profile-genre-plus',
        'border:0!important',
    ],
}

for file_name, fragments in checks.items():
    text = Path(file_name).read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise RuntimeError(f'apply-976: {file_name} missing {fragment}')

modal = Path('src/components/explore/ExploreProfileEditModal.tsx').read_text(encoding='utf-8')
if '<Plus aria-hidden="true" /> 추가' in modal:
    raise RuntimeError('apply-976: genre add button must remain icon-only')

service = Path('src/services/exploreProfileGenreSuggestionService.ts').read_text(encoding='utf-8')
if 'onSnapshot' in service or 'setDoc' in service or 'updateDoc' in service:
    raise RuntimeError('apply-976: genre refresh must be one-shot read-only')

print('apply-976: crop/zoom editor + manual one-read recent-10 genre refresh verified')
