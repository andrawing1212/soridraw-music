from pathlib import Path
import runpy

checks = {
    'src/services/sunoAudioRecovery.ts': [
        'recoverSunoAudioUrl',
        'downloadSunoAudioWithRecovery',
        'getSunoTrackStatus',
        'soridraw:suno-audio-url-recovered',
        'source_audio_url',
        'source_stream_audio_url',
        'soridraw.suno.audioRecovery.v2',
        'RECOVERY_NEGATIVE_CACHE_MS',
        'RECOVERY_CACHE_MAX_ENTRIES = 200',
        'recoveryOnly: true',
        'cacheHit: true',
        'writeRecoveryFailure',
    ],
    'src/contexts/GlobalPlayerContext.tsx': [
        'SORIDRAW_SUNO_AUDIO_URL_AUTO_RECOVERY_955',
        'recoverAndRetryPlayback',
        'attempting Task ID URL recovery',
        'applyRecoveredSunoAudioUrl',
    ],
    'src/components/GlobalPlayer.tsx': [
        'SORIDRAW_SUNO_AUDIO_URL_AUTO_RECOVERY_955',
        'downloadSunoAudioWithRecovery',
    ],
    'src/pages/SunoLibraryPage.tsx': [
        'SORIDRAW_SUNO_AUDIO_URL_AUTO_RECOVERY_955',
        'resolveDownloadRecoveryTarget',
        'soridraw:suno-audio-url-recovered',
        'patchWorkspaceTrackLocally(trackId',
    ],
    'functions/scripts/apply-suno-recovery-readonly-972.cjs': [
        'SORIDRAW_SUNO_RECOVERY_READONLY_972',
        'const recoveryOnly = req.body?.recoveryOnly === true',
        'if (!recoveryOnly) {',
        'recoveryOnly skips track/share writes',
    ],
}

for file_name, fragments in checks.items():
    text = Path(file_name).read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise RuntimeError(f'verify-955: {file_name} missing {fragment}')

service = Path('src/services/sunoAudioRecovery.ts').read_text(encoding='utf-8')
if "method: 'POST'" not in service or 'trackId: context.trackId' not in service or 'taskId: context.taskId' not in service:
    raise RuntimeError('verify-955: recovery must reuse the existing status endpoint with trackId + taskId')
if 'recoveryOnly: true' not in service:
    raise RuntimeError('verify-955: playback recovery must request readonly recoveryOnly mode')
if '/api/v1/generate' in service:
    raise RuntimeError('verify-955: client recovery must not call a new generation endpoint')

functions_package = Path('functions/package.json').read_text(encoding='utf-8')
if 'apply-suno-recovery-readonly-972.cjs' not in functions_package:
    raise RuntimeError('verify-955: Functions prebuild must apply readonly recovery patch before secured build')

print('verify-955: PASS (local success cache + 24h negative cache + recoveryOnly contract)')

# SORIDRAW 8-E-4 build chain.
runpy.run_path('.deploy/apply-956-explore-8e4-music-note-publication-ui.py', run_name='__main__')
runpy.run_path('.deploy/apply-957-explore-8e4-interaction-button-visual-fix.py', run_name='__main__')
runpy.run_path('.deploy/apply-958-explore-8e4-state-button-fill-live-like.py', run_name='__main__')
runpy.run_path('.deploy/apply-959-explore-8e4-personal-like-fix.py', run_name='__main__')
runpy.run_path('.deploy/run-960-music-note-lightweight-card-state.py', run_name='__main__')
runpy.run_path('.deploy/apply-961-music-note-exit-only-card-state-sync.py', run_name='__main__')
runpy.run_path('.deploy/apply-962-music-note-state-button-fill-layer.py', run_name='__main__')
runpy.run_path('.deploy/apply-963-music-note-keyword-and-filled-icon-tune.py', run_name='__main__')
runpy.run_path('.deploy/apply-964-music-note-compact-suno-buttons.py', run_name='__main__')
runpy.run_path('.deploy/apply-965-explore-publication-state-hydration.py', run_name='__main__')
runpy.run_path('.deploy/apply-966-music-note-state-button-final-align.py', run_name='__main__')
runpy.run_path('.deploy/apply-967-music-note-state-button-hover-tone.py', run_name='__main__')
runpy.run_path('.deploy/apply-968-music-note-card-rhythm.py', run_name='__main__')
runpy.run_path('.deploy/apply-969-music-note-genre-and-color-dot-cleanup.py', run_name='__main__')
runpy.run_path('.deploy/apply-970-library-color-dot-menu-cleanup.py', run_name='__main__')
runpy.run_path('.deploy/apply-971-library-color-palette-layer-fix.py', run_name='__main__')
runpy.run_path('.deploy/apply-973-library-played-write-dedupe.py', run_name='__main__')
