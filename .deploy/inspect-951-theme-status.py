from pathlib import Path


def show(path: str, needles: list[str], radius: int = 18, max_hits: int = 6):
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    print(f'--- INSPECT {path} START ---')
    for needle in needles:
        hits = [i for i, line in enumerate(lines) if needle in line]
        print(f'### {needle} hits={len(hits)}')
        for i in hits[:max_hits]:
            lo = max(0, i - radius)
            hi = min(len(lines), i + radius + 1)
            print(f'--- lines {lo + 1}-{hi} ---')
            for n in range(lo, hi):
                print(f'{n + 1}: {lines[n]}')
    print(f'--- INSPECT {path} END ---')

show('src/App.tsx', [
    'soridraw_large_display_mode',
    'setDisplayMode',
    'displayMode',
    'studio-black',
    '분할',
    "navigate('/history')",
    "navigate('/suno-library')",
], 18, 8)

show('src/pages/SunoLibraryPage.tsx', [
    'syncStatusResponseToFirestore',
    'const checkStatus',
    '생성이 완료',
    '생성 완료',
    'resolved.status',
    '상태 확인 필요',
    'isTrackPastAutoCheckWindow',
], 22, 8)
