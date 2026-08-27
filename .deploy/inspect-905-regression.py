from pathlib import Path


def show(path: str, needles: list[str], radius: int = 45):
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    print(f'--- INSPECT {path} START ---')
    for needle in needles:
        hits = [i for i, line in enumerate(lines) if needle in line]
        print(f'### {needle} hits={len(hits)}')
        for i in hits[:4]:
            lo = max(0, i - radius)
            hi = min(len(lines), i + radius + 1)
            print(f'--- lines {lo + 1}-{hi} ---')
            for n in range(lo, hi):
                print(f'{n + 1}: {lines[n]}')
    print(f'--- INSPECT {path} END ---')

show('src/App.tsx', [
    'isCompactStudioMobileNavigation',
    'goToCompactMobileNav',
    'soridraw-compact-nav-scroll',
    "item.key === 'musicNote'",
    "item.key === 'library'",
], 32)

show('src/pages/SunoLibraryPage.tsx', [
    'const isTrackStuck',
    'const checkStatus',
    'setStatusChecking(trackId)',
    'elapsedMs > 10 * 60 * 1000',
    "case 'pending':",
    'const isPending =',
], 48)
