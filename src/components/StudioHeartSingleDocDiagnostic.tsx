import { useState } from 'react';
import { auth } from '../firebase';
import {
  findSingleLocalFavoriteDocumentId,
  inspectExactStudioHeartDocument,
  type StudioHeartExactReadReport,
} from '../lib/studioHeartSingleDocDiagnostic';

// Admin-only existing CACHE LIVE panel: no action on render, and exactly one
// Firestore document read only on explicit "서버 1건 확인" button click.
export default function StudioHeartSingleDocDiagnostic() {
  const [title, setTitle] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<StudioHeartExactReadReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [alreadyRead, setAlreadyRead] = useState(false);
  const uid = String(auth.currentUser?.uid || '').trim();

  const findLocal = () => {
    setReport(null);
    setAlreadyRead(false);
    const match = findSingleLocalFavoriteDocumentId(uid, title);
    if (!match) {
      setDocumentId('');
      setMessage('현재 기기에 정확히 일치하는 저장곡이 없거나 동명곡이 있습니다. 원본 PC에서 고유 문서번호를 확인하세요.');
      return;
    }
    setDocumentId(match);
    setMessage('현재 브라우저에서 고유 문서번호를 찾았습니다. 서버 조회 전까지는 로컬 기록입니다.');
  };

  const inspect = async () => {
    if (busy || alreadyRead || !uid || !documentId.trim()) return;
    setBusy(true);
    setReport(null);
    setMessage('');
    setAlreadyRead(true);
    try {
      const result = await inspectExactStudioHeartDocument(uid, documentId);
      setReport(result);
      setMessage('서버 원본 1건만 읽었습니다. 곡이나 브라우저 캐시는 수정하지 않았습니다.');
    } catch {
      setMessage('서버 확인 실패: 로그인 상태, 권한 또는 네트워크를 확인하세요. 실패를 저장곡 없음으로 해석하면 안 됩니다.');
    } finally { setBusy(false); }
  };

  const label = (value: boolean | null) => value === null ? '판정 불가' : value ? '예' : '아니요';
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.035] p-2.5 text-[11px] text-white/75">
      <div className="font-black text-white/90">뮤직노트 특정곡 원본 확인 · 읽기 전용</div>
      <div className="mt-1 text-[10px] leading-4 text-white/55">
        원본 PC에서 먼저 곡을 찾으세요. 하트·저장곡·브라우저 기록을 변경하지 않습니다.
      </div>
      <input
        aria-label="현재 기기에 있는 곡의 정확한 제목"
        value={title}
        onChange={(event) => { setTitle(event.target.value); setReport(null); setAlreadyRead(false); }}
        placeholder="정확한 곡 제목 (로컬 검색만)"
        className="mt-2 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white"
      />
      <button type="button" onClick={findLocal}
        className="mt-1 rounded border border-white/15 px-2 py-1 text-[11px] font-bold">
        이 브라우저에서 문서 찾기 · 서버 0회
      </button>
      <label className="mt-2 block text-[10px] text-white/55" htmlFor="studio-heart-exact-doc-id">
        저장 문서번호 (다른 기기에서는 원본 PC 번호 붙여넣기)
      </label>
      <input id="studio-heart-exact-doc-id" value={documentId}
        onChange={(event) => { setDocumentId(event.target.value); setReport(null); setAlreadyRead(false); }}
        placeholder="정확한 저장 문서번호"
        className="mt-1 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white"
      />
      <div className="mt-1 flex flex-wrap gap-1">
        <button type="button" disabled={!documentId.trim()}
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
        <div>Firestore 문서 존재: {label(report.documentPresent)}</div>
        <div>로그인 계정 소유: {label(report.ownerMatchesSignedInUser)}</div>
        <div>서버 저장 상태 활성: {label(report.serverActive)}</div>
        <div>이 기기 Music Note 목록: {label(report.deviceMusicNoteRow)}</div>
        <div>이 기기 임시 표시: {label(report.deviceRowIsOptimistic)}</div>
        <div>이 기기 미확정 저장 대기: {label(report.devicePendingIntent)}</div>
        <div>대기 중 저장 의도: {label(report.devicePendingDesiredSaved)}</div>
        <div>이 기기 하트 기록: {label(report.deviceRecentHeartAuthority)}</div>
        <div>이 기기 Catalog 캐시 존재: {label(report.deviceCatalogCached)}</div>
        <div>Catalog 캐시에 저장곡 포함: {label(report.deviceCatalogContainsDocument)}</div>
        <div className="pt-1 text-[10px] text-white/50">문서번호·계정번호·가사·인증정보는 결과에 포함되지 않습니다.</div>
      </div> : null}
    </div>
  );
}
