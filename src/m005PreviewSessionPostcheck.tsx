import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

const PREVIEW_HOST = 'soridraw-music-git-preview-andrawing1212.vercel.app';
const ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';
const ALLOWED_VALIDATION = new Set(['verified', 'pending_or_empty', 'missing']);

type MediaProbe = {
  attempted: boolean;
  http: number | null;
  contentType: string;
  bytes: number;
  passed: boolean;
  note?: string;
};

type PostcheckResult = {
  passed: boolean;
  trackIdSuffix: string;
  functionHttp: number;
  functionOk: boolean;
  status: string;
  audioValidationStatus: string;
  audioUrlReturned: boolean;
  reportedCount: number | null;
  verifiedCount: number | null;
  media: MediaProbe;
  firestoreAfter: {
    status: string;
    audioValidationStatus: string;
    hasAudioUrl: boolean;
  };
  firestoreMatched: boolean;
  newMusicGeneration: 0;
  creditConsumingGeneration: 0;
};

const readFirstByte = async (response: Response): Promise<number> => {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return buffer.byteLength;
  }
  const reader = response.body.getReader();
  try {
    const first = await reader.read();
    return first.value?.byteLength || 0;
  } finally {
    try { await reader.cancel(); } catch { /* no-op */ }
  }
};

const probeReturnedAudio = async (audioUrl: string): Promise<MediaProbe> => {
  if (!audioUrl) {
    return {
      attempted: false,
      http: null,
      contentType: '',
      bytes: 0,
      passed: true,
      note: 'Function withheld the audio URL because validation was not verified.',
    };
  }

  const response = await fetch(audioUrl, {
    headers: { Range: 'bytes=0-0' },
    redirect: 'follow',
    cache: 'no-store',
  });
  const contentType = String(response.headers.get('content-type') || '').trim().toLowerCase();
  const bytes = await readFirstByte(response);
  return {
    attempted: true,
    http: response.status,
    contentType,
    bytes,
    passed: response.ok && contentType.startsWith('audio/') && bytes > 0,
  };
};

export default function M005PreviewSessionPostcheck() {
  const [phase, setPhase] = useState('실제 Preview 로그인 세션 확인 중…');
  const [result, setResult] = useState<PostcheckResult | null>(null);
  const [error, setError] = useState('');

  const isAllowedLocation = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.hostname === PREVIEW_HOST && params.get('m005-postcheck') === 'final-20260826';
  }, []);

  useEffect(() => {
    if (!isAllowedLocation) {
      setError('이 검증 화면은 승인된 Preview 전용 주소에서만 실행됩니다.');
      return;
    }

    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user) {
        setPhase('로그인 세션을 찾지 못했습니다.');
        setError('Preview 앱에 로그인한 같은 탭에서 이 검증 주소로 다시 이동해 주세요.');
        return;
      }

      unsubscribe();
      try {
        setPhase('기존 completed Suno 곡 1건 선택 중…');
        const tracksRef = collection(db, 'suno_tracks', user.uid, 'tracks');
        const completedQuery = query(tracksRef, where('status', '==', 'completed'), limit(10));
        const completedSnap = await getDocs(completedQuery);
        const chosen = completedSnap.docs
          .map((docSnap) => ({ docSnap, data: docSnap.data() as Record<string, any> }))
          .find(({ data }) => Boolean(data.taskId) && String(data.provider || '') !== 'dryRun');

        if (!chosen) throw new Error('기존 completed non-dryRun Suno 곡을 찾지 못했습니다.');

        const { docSnap, data: before } = chosen;
        const token = await user.getIdToken(false);
        if (!token) throw new Error('실제 Firebase ID Token을 가져오지 못했습니다.');

        setPhase('배포된 getSunoTrackStatus를 실제 로그인 토큰으로 호출 중…');
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ trackId: docSnap.id, taskId: before.taskId }),
        });

        const text = await response.text();
        let payload: any = null;
        try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 300) }; }

        if (!response.ok || payload?.ok !== true) {
          throw new Error(`getSunoTrackStatus 실패: HTTP ${response.status}`);
        }

        const validation = String(payload.audioValidationStatus || '');
        if (!ALLOWED_VALIDATION.has(validation)) {
          throw new Error(`예상하지 못한 audioValidationStatus: ${validation || '(empty)'}`);
        }
        if (validation === 'verified' && !payload.audioUrl) {
          throw new Error('verified 응답인데 audioUrl이 없습니다.');
        }
        if (validation !== 'verified' && payload.audioUrl) {
          throw new Error('검증되지 않은 상태인데 audioUrl이 노출되었습니다.');
        }

        setPhase(payload.audioUrl ? '반환 음원의 MIME + 실제 byte 독립검증 중…' : '무효 음원 URL 차단 결과 확인 중…');
        const media = await probeReturnedAudio(String(payload.audioUrl || ''));
        if (!media.passed) {
          throw new Error(`반환 음원 독립검증 실패: HTTP ${media.http}, ${media.contentType || 'no-content-type'}, ${media.bytes} bytes`);
        }

        setPhase('같은 Firestore 곡 문서의 반영 결과 확인 중…');
        const afterSnap = await getDoc(docSnap.ref);
        if (!afterSnap.exists()) throw new Error('검증 후 기존 Suno 곡 문서를 다시 읽지 못했습니다.');
        const after = afterSnap.data() as Record<string, any>;
        const firestoreValidation = String(after.audioValidationStatus || '');
        const firestoreMatched = firestoreValidation === validation;
        if (!firestoreMatched) {
          throw new Error(`Firestore audioValidationStatus 불일치: response=${validation}, firestore=${firestoreValidation || '(empty)'}`);
        }

        const nextResult: PostcheckResult = {
          passed: true,
          trackIdSuffix: docSnap.id.slice(-8),
          functionHttp: response.status,
          functionOk: payload?.ok === true,
          status: String(payload.status || ''),
          audioValidationStatus: validation,
          audioUrlReturned: Boolean(payload.audioUrl),
          reportedCount: Array.isArray(payload.reportedAudioUrls) ? payload.reportedAudioUrls.length : null,
          verifiedCount: Array.isArray(payload.audioUrls) ? payload.audioUrls.length : null,
          media,
          firestoreAfter: {
            status: String(after.status || ''),
            audioValidationStatus: firestoreValidation,
            hasAudioUrl: Boolean(after.audioUrl || after.streamAudioUrl),
          },
          firestoreMatched,
          newMusicGeneration: 0,
          creditConsumingGeneration: 0,
        };
        setResult(nextResult);
        setPhase('M-005 최종 실제 로그인 Post-check PASS');
      } catch (err: any) {
        setPhase('M-005 최종 실제 로그인 Post-check FAIL');
        setError(err?.message || String(err));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAllowedLocation]);

  const copyResult = async () => {
    const text = JSON.stringify({ phase, result, error: error || null }, null, 2);
    try { await navigator.clipboard.writeText(text); } catch { /* user can copy visible JSON */ }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#111214', color: '#f6f7f8', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: 'min(720px, 100%)', background: '#1b1d21', borderRadius: 22, padding: 28, boxShadow: '0 18px 60px rgba(0,0,0,.32)' }}>
        <div style={{ color: '#ffb400', fontWeight: 800, fontSize: 13, letterSpacing: '.08em' }}>SORIDRAW · M-005</div>
        <h1 style={{ margin: '10px 0 8px', fontSize: 24 }}>실제 Preview 로그인 세션 최종 검증</h1>
        <p style={{ margin: 0, color: '#b8bcc4', lineHeight: 1.6 }}>{phase}</p>

        {error && (
          <div style={{ marginTop: 20, background: '#292027', borderRadius: 16, padding: 16, color: '#ffb9c2', lineHeight: 1.6 }}>
            {error}
          </div>
        )}

        {result && (
          <>
            <div style={{ marginTop: 20, background: '#20251f', borderRadius: 16, padding: 16, color: '#c8f5c1', fontWeight: 800 }}>
              PASS · 신규 음악 생성 0 · 크레딧 사용 0
            </div>
            <pre style={{ marginTop: 16, background: '#0f1012', borderRadius: 16, padding: 16, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            <button type="button" onClick={copyResult} style={{ marginTop: 14, border: 0, borderRadius: 14, padding: '11px 16px', background: '#ffb400', color: '#111214', fontWeight: 800, cursor: 'pointer' }}>
              결과 복사
            </button>
          </>
        )}

        {!result && !error && (
          <div style={{ marginTop: 20, height: 8, borderRadius: 99, background: '#292c31', overflow: 'hidden' }}>
            <div style={{ width: '48%', height: '100%', borderRadius: 99, background: '#ffb400' }} />
          </div>
        )}

        <p style={{ margin: '20px 0 0', color: '#7f858f', fontSize: 12, lineHeight: 1.6 }}>
          이 화면은 Preview 전용 일회성 검증 경로입니다. ID Token, API Key, taskId, 전체 음원 URL은 화면이나 로그에 출력하지 않습니다.
        </p>
      </section>
    </main>
  );
}
