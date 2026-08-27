from pathlib import Path


def show(path: str, needles: list[str], radius: int = 70):
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    print(f'--- INSPECT {path} START ---')
    for needle in needles:
        hits = [i for i, line in enumerate(lines) if needle in line]
        print(f'### {needle} hits={len(hits)}')
        for i in hits[:3]:
            lo = max(0, i - radius)
            hi = min(len(lines), i + radius + 1)
            print(f'--- lines {lo + 1}-{hi} ---')
            for n in range(lo, hi):
                print(f'{n + 1}: {lines[n]}')
    print(f'--- INSPECT {path} END ---')

show('src/App.tsx', [
    'const isCompactStudioMobileNavigation',
    'const goToCompactMobileNav',
    'soridraw-compact-nav-scroll',
], 45)

show('src/pages/SunoLibraryPage.tsx', [
    'const isTrackStuck',
    '[Suno Safety Hook]',
    'const eligibleGroups = tracks.filter',
    "case 'pending':",
], 70)
