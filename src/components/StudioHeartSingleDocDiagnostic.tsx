import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  findSingleLocalFavoriteDocumentId,
  inspectExactStudioHeartDocument,
  type StudioHeartExactReadReport,
} from '../lib/studioHeartSingleDocDiagnostic';
import { repairSingleExactMusicNoteCatalog516 } from '../lib/musicNoteSingleDocCatalogRepair516';

// Admin-only existing CACHE LIVE panel: no action on render, and exactly one
// Firestore document read only on explicit "서버 1건 확인" button click.
export default function StudioHeartSingleDocDiagnostic() {
  const [title, setTitle] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<StudioHeartExactReadReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [alreadyRead, setAlreadyRead] = useState(false);
  const [repaired, setRepaired] = useState(false);
  const uid = String(auth.currentUser?.uid || '').trim();
  const uidRef = useRef(uid);
  const titleRef = useRef(title);
  const documentIdRef = useRef(documentId);
  const busyRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<{ sequence: number; uid: string; documentId: string; title: string } | null>(null);

  // A late response must never label a different document or signed-in user.
  // Invalidate synchronously when either input changes, even if an event
  // was already queued before the disabled input was painted.
  const invalidateRequest = () => {
    requestSequenceRef.current += 1;
    activeRequestRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setAlreadyRead(false);
    setRepaired(false);
    setReport(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const nextUid = String(user?.uid || '').trim();
      if (uidRef.current === nextUid) return;
      uidRef.current = nextUid;
      invalidateRequest();
      setMessage('로그인 계정이 변경되어 이전 조회 결과를 폐기했습니다.');
    });
    return () => {
      // Also discard responses from a hidden/unmounted diagnostic panel.
      requestSequenceRef.current += 1;
      activeRequestRef.current = null;
      busyRef.current = false;
      unsubscribe();
    };
  }, []);

  const findLocal = () => {
    if (busyRef.current) return;
    invalidateRequest();
    const match = findSingleLocalFavoriteDocumentId(String(auth.currentUser?.uid || '').trim(), titleRef.current);
    if (!match) {
      documentIdRef.current = '';
      setDocumentId('');
      setMessage('현재 기기에 정확히 일치하는 저장곡이 없거나 동명곡이 있습니다. 원본 PC에서 고유 문서번호를 확인하세요.');
      return;
    }
    documentIdRef.current = match;
    setDocumentId(match);
    setMessage('현재 브라우저에서 고유 문서번호를 찾았습니다. 서버 조회 전까지는 로컬 기록입니다.');
  };

  const inspect = async () => {
    const requestUid = String(auth.currentUser?.uid || '').trim();
    const requestDocumentId = documentIdRef.current.trim();
    const requestTitle = titleRef.current;
    if (busyRef.current || alreadyRead || !requestUid || requestUid !== uidRef.current
      || !requestDocumentId || documentId.trim() !== requestDocumentId || title !== requestTitle) return;
    const request = {
      sequence: ++requestSequenceRef.current,
      uid: requestUid,
      documentId: requestDocumentId,
      title: requestTitle,
    };
    activeRequestRef.current = request;
    busyRef.current = true;
    setBusy(true);
    setReport(null);
    setMessage('');
    setAlreadyRead(true);
    const isCurrentRequest = () => (
      activeRequestRef.current?.sequence === request.sequence
      && uidRef.current === request.uid
      && auth.currentUser?.uid === request.uid
      && documentIdRef.current.trim() === request.documentId
      && titleRef.current === request.title
    );
    try {
      const result = await inspectExactStudioHeartDocument(request.uid, request.documentId);
      if (!isCurrentRequest()) return;
      setReport(result);
      setMessage('서버 원본 1건만 읽었습니다. 곡이나 브라우저 캐시는 수정하지 않았습니다.');
    } catch {
      if (!isCurrentRequest()) return;
      setMessage('서버 확인 실패: 로그인 상태, 권한 또는 네트워크를 확인하세요. 실패를 저장곡 없음으로 해석하면 안 됩니다.');
    } finally {
      if (isCurrentRequest()) {
        activeRequestRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  // Explicit manual action after a successful exact owner/active canonical read.
  // Never auto-repair on render, route entry, or a failed/ambiguous diagnostic.
  const repair = async () => {
    const requestUid = String(auth.currentUser?.uid || '').trim();
    const requestId = documentIdRef.current.trim();
    const requestTitle = titleRef.current;
    if (busyRef.current || repaired || !alreadyRead
      || !report?.documentPresent || report.ownerMatchesSignedInUser !== true
      || report.serverActive !== true || report.devicePendingIntent
      || !requestUid || requestUid !== uidRef.current
      || requestId !== documentId.trim() || requestTitle !== title) return;
    const request = {
      sequence: ++requestSequenceRef.current,
      uid: requestUid,
      documentId: requestId,
      title: requestTitle,
    };
    activeRequestRef.current = request;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    const isCurrentRequest = () => (
      activeRequestRef.current?.sequence === request.sequence
      && uidRef.current === request.uid
      && auth.currentUser?.uid === request.uid
      && documentIdRef.current.trim() === request.documentId
      && titleRef.current === request.title
    );
    try {
      const outcome = await repairSingleExactMusicNoteCatalog516(request.uid, request.documentId);
      if (!isCurrentRequest()) return;
      setRepaired(true);
      setMessage(outcome === 'repaired'
        ? '서버에 있던 곡 1건을 공유 목록에 보완하고 다른 기기에 변경 신호를 보냈습니다. 곡 원본은 수정하지 않았습니다.'
        : '공유 서버 목록에는 이미 곡이 있습니다. 다른 기기에 변경 신호를 다시 보냈습니다. 원본은 수정하지 않았습니다.');
    } catch {
      if (!isCurrentRequest()) return;
      setMessage('목록 복구를 확정하지 못했습니다. 서버/권한/동기화 오류 또는 미확정 저장 여부를 확인하세요. 원본 곡은 수정하지 않았으며, 무작정 다시 누르지 마세요.');
    } finally {
      if (isCurrentRequest()) {
        activeRequestRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const label = (value: boolean | null) => value === null ? '판정 불가' : value ? '예' : '아니요';
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.035] p-2.5 text-[11px] text-white/75">
      <div className="font-black text-white/90">뮤직노트 특정곡 원본 확인 · 필요 시 수동 목록 복구</div>
      <div className="mt-1 text-[10px] leading-4 text-white/55">
        원본 PC에서 먼저 곡을 찾으세요. 하트·저장곡·브라우저 기록을 변경하지 않습니다.
      </div>
      <input
        aria-label="현재 기기에 있는 곡의 정확한 제목"
        value={title}
        disabled={busy}
        onChange={(event) => {
          titleRef.current = event.target.value;
          invalidateRequest();
          setTitle(event.target.value);
        }}
        placeholder="정확한 곡 제목 (로컬 검색만)"
        className="mt-2 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white"
      />
      <button type="button" disabled={busy} onClick={findLocal}
        className="mt-1 rounded border border-white/15 px-2 py-1 text-[11px] font-bold">
        이 브라우저에서 문서 찾기 · 서버 0회
      </button>
      <label className="mt-2 block text-[10px] text-white/55" htmlFor="studio-heart-exact-doc-id">
        저장 문서번호 (다른 기기에서는 원본 PC 번호 붙여넣기)
      </label>
      <input id="studio-heart-exact-doc-id" value={documentId}
        disabled={busy}
        onChange={(event) => {
          documentIdRef.current = event.target.value;
          invalidateRequest();
          setDocumentId(event.target.value);
        }}
        placeholder="정확한 저장 문서번호"
        className="mt-1 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white"
      />
      <div className="mt-1 flex flex-wrap gap-1">
        <button type="button" disabled={!documentId.trim() || busy}
          onClick={() => { if (documentId) void navigator.clipboard?.writeText(documentId); }}
          className="rounded border border-white/15 px-2 py-1 disabled:opacity-40">문서번호 복사</button>
        <button type="button" disabled={!uid || !documentId.trim() || busy || alreadyRead}
          onClick={() => void inspect()}
          className="rounded border border-white/25 bg-white/10 px-2 py-1 font-bold disabled:opacity-40">
          {busy ? '확인 중…' : '서버 저장문서 1건 확인 (읽기 1회)'}
        </button>
      </div>
      {message ? <div role="status" className="mt-2 break-words text-[10px]">{message}</div> : null}
      {report ? <div className="mt-2 space-y-0.5 rounded bg-black/20 px-2 py-1.5 text-[11px]">
        <div>이 계정의 서버 저장문서 존재: {label(report.documentPresent)}</div>
        <div>로그인 계정 소유: {label(report.ownerMatchesSignedInUser)}</div>
        <div>서버 저장 상태 활성: {label(report.serverActive)}</div>
        <div>이 기기 Music Note 목록: {label(report.deviceMusicNoteRow)}</div>
        <div>이 기기 임시 표시: {label(report.deviceRowIsOptimistic)}</div>
        <div>이 기기 미확정 저장 대기: {label(report.devicePendingIntent)}</div>
        <div>대기 중 저장 의도: {label(report.devicePendingDesiredSaved)}</div>
        <div>이 기기 하트 기록: {label(report.deviceRecentHeartAuthority)}</div>
        <div>이 기기 Catalog 캐시 존재: {label(report.deviceCatalogCached)}</div>
        <div>Catalog 캐시에 저장곡 포함: {label(report.deviceCatalogContainsDocument)}</div>
        <div className="pt-2 text-[10px] text-white/50">
          아래 버튼은 명시적으로 누를 때만 서버 원본 1건과 공유 목록을 재확인합니다.
          원본 저장곡은 변경하지 않고 공유 목록에 누락됐을 때만 해당 1건을 추가하며, 다른 기기에 변경 신호를 보냅니다.
        </div>
        <button type="button"
          disabled={busy || repaired || !report.documentPresent
            || report.ownerMatchesSignedInUser !== true || report.serverActive !== true
            || report.devicePendingIntent}
          onClick={() => void repair()}
          className="mt-1 rounded bg-white/10 px-2 py-1.5 text-[11px] font-bold disabled:opacity-40">
          {busy ? '단건 목록 확인 중…' : repaired ? '이번 단건 복구 완료' : '서버 원본 기준 · 저장곡 목록 1건 복구'}
        </button>
        <div className="pt-1 text-[10px] text-white/50">문서번호·계정번호·가사·인증정보는 결과에 포함되지 않습니다.</div>
      </div> : null}
    </div>
  );
}
