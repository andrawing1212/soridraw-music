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
}

for file_name, fragments in checks.items():
    text = Path(file_name).read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise RuntimeError(f'verify-955: {file_name} missing {fragment}')

service = Path('src/services/sunoAudioRecovery.ts').read_text(encoding='utf-8')
if "method: 'POST'" not in service or 'trackId: context.trackId, taskId: context.taskId' not in service:
    raise RuntimeError('verify-955: recovery must reuse the existing status endpoint with trackId + taskId')
if '/api/v1/generate' in service:
    raise RuntimeError('verify-955: client recovery must not call a new generation endpoint')

print('verify-955: PASS')

# SORIDRAW 8-E-4 build chain.
runpy.run_path('.deploy/apply-956-explore-8e4-music-note-publication-ui.py', run_name='__main__')
runpy.run_path('.deploy/apply-957-explore-8e4-interaction-button-visual-fix.py', run_name='__main__')
runpy.run_path('.deploy/apply-958-explore-8e4-state-button-fill-live-like.py', run_name='__main__')
runpy.run_path('.deploy/apply-959-explore-8e4-personal-like-fix.py', run_name='__main__')
runpy.run_path('.deploy/run-960-music-note-lightweight-card-state.py', run_name='__main__')
runpy.run_path('.deploy/apply-961-music-note-exit-only-card-state-sync.py', run_name='__main__')
runpy.run_path('.deploy/apply-962-music-note-state-button-fill-layer.py', run_name='__main__')
runpy.run_path('.deploy/apply-963-music-note-keyword-and-filled-icon-tune.py', run_name='__main__')
