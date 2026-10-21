import { useCallback, useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { auth, functions } from '../firebase';
import { normalizeStaffRole } from '../constants/adminPermissions';
import { USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache } from '../lib/userProfileCache';
import {
  getSplitFrameEnvironment,
  SPLIT_FRAME_CHOICES,
  type SplitFrameMode,
} from '../constants/splitFrameGlobal';
import { isSplitFrameServerReady, readCurrentSplitFrameMode, readCurrentSplitFrameRevision, subscribeSplitFrameMode } from '../services/navigationVisibilitySyncService';
import { publishConfirmedSplitFrameRemote } from '../services/versionSignalService';
import { cn } from '../lib/utils';

const labelFor = (mode: SplitFrameMode) =>
  SPLIT_FRAME_CHOICES.find((choice) => choice.value === mode)?.label || '품질우선';

export default function MasterSplitFramePanel() {
  // Located in Admin > App Settings; visible only to a verified Master.
  // The callable separately enforces Master on the server.
  const [isMaster, setIsMaster] = useState(() =>
    normalizeStaffRole(readUserProfileCache(auth.currentUser?.uid)) === 'master');
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const syncRole = () => setIsMaster(normalizeStaffRole(readUserProfileCache(uid)) === 'master');
    syncRole();
    const onProfileChange = (event: Event) => {
      if ((event as CustomEvent<{ uid?: string }>).detail?.uid === uid) syncRole();
    };
    const onStorageChange = (event: StorageEvent) => {
      if (isUserProfileCacheStorageKey(event.key, uid)) syncRole();
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, onProfileChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onProfileChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);
  const environment = getSplitFrameEnvironment();
  const [applied, setApplied] = useState<SplitFrameMode>(readCurrentSplitFrameMode);
  const [draft, setDraft] = useState<SplitFrameMode>(readCurrentSplitFrameMode);
  const [confirmedRevision, setConfirmedRevision] = useState(readCurrentSplitFrameRevision);
  // A cached/default RC value is not proof that the Master has loaded the
  // saved server setting. Keep Apply blocked until the server confirms it.
  const [serverReady, setServerReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const appliedRef = useRef<SplitFrameMode>(readCurrentSplitFrameMode());
  const revisionRef = useRef(-1);

  const receiveConfirmed = useCallback((mode: SplitFrameMode, revision: number) => {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision < revisionRef.current) return;
    // Never undo a later server-confirmed revision with an old RC cache event.
    if (revision === revisionRef.current && mode !== appliedRef.current) return;
    const previouslyApplied = appliedRef.current;
    revisionRef.current = revision;
    appliedRef.current = mode;
    setApplied(mode);
    setConfirmedRevision(revision);
    setDraft((previousDraft) => previousDraft === previouslyApplied ? mode : previousDraft);
  }, []);

  useEffect(() => subscribeSplitFrameMode((mode) => {
    if (!isSplitFrameServerReady()) return;
    receiveConfirmed(mode, readCurrentSplitFrameRevision());
  }), [receiveConfirmed]);

  const readSavedSetting = useCallback(async () => {
    if (!environment) return;
    setServerReady(false);
    try {
      const callable = httpsCallable<{ environment: string; action: 'read' },
        { ok: boolean; environment: string; mode: SplitFrameMode; revision: number }>(
        functions, 'masterSetSplitFrameMode');
      const result = await callable({ environment, action: 'read' });
      const value = result.data;
      if (!value?.ok || value.environment !== environment || !Number.isSafeInteger(value.revision)) {
        throw new Error('저장된 서버 설정을 확인하지 못했습니다.');
      }
      receiveConfirmed(value.mode, value.revision);
      setServerReady(true);
    } catch (error) {
      setServerReady(false);
      setMessage({ ok: false, text: error instanceof Error ? error.message : '저장된 설정을 불러오지 못했습니다.' });
    }
  }, [environment, receiveConfirmed]);

  useEffect(() => {
    if (!isMaster || !environment) return;
    void readSavedSetting();
    const offline = () => setServerReady(false);
    const online = () => void readSavedSetting();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [isMaster, environment, readSavedSetting]);

  const apply = async () => {
    if (!environment || !serverReady || saving || draft === applied ||
        (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const confirmed = window.confirm(
      `분할바 프레임을 '${labelFor(draft)}'으로 적용할까요?\\n현재 ${environment.toUpperCase()}에 연결된 사용자에게 전달됩니다.`,
    );
    if (!confirmed || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    setSaving(true);
    setMessage(null);
    try {
      const callable = httpsCallable<{ environment: string; action: 'apply'; mode: SplitFrameMode; expectedRevision: number },
        { ok: boolean; environment: string; mode: SplitFrameMode; revision: number }>(functions, 'masterSetSplitFrameMode');
      const result = await callable({
        environment, action: 'apply', mode: draft, expectedRevision: confirmedRevision,
      });
      if (!result.data?.ok || result.data.environment !== environment ||
          result.data.mode !== draft || !Number.isSafeInteger(result.data.revision) ||
          result.data.revision <= confirmedRevision) {
        throw new Error('서버의 적용 확인을 받지 못했습니다.');
      }
      // The successful callable is authoritative: update this browser now.
      // Realtime Remote Config then delivers the same revision to all others.
      receiveConfirmed(result.data.mode, result.data.revision);
      publishConfirmedSplitFrameRemote(result.data.mode, result.data.revision);
      setMessage({ ok: true, text: `${labelFor(result.data.mode)} 설정이 서버에 저장되었습니다.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : '분할바 프레임 적용에 실패했습니다.' });
      // Even after a stale Master conflict, reload current truth so the
      // operator does not need to navigate away to recover.
      await readSavedSetting();
    } finally {
      setSaving(false);
    }
  };

  if (!isMaster) return null;

  return (
    <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-[var(--text-primary)]">분할바 프레임</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            마스터 전용 · 선택 후 적용해야 변경됩니다. 현재 연결된 호환 앱은 로그인 여부와 관계없이 반영되고,
            드래그 중인 사용자는 마우스를 놓은 후 반영됩니다.
          </p>
          <p className="mt-2 text-xs font-black text-[var(--text-primary)]">
            현재 적용: {serverReady ? labelFor(applied) : '설정 확인 중'} {environment ? `· ${environment.toUpperCase()}` : '· 환경 확인 불가'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="분할바 프레임">
        {SPLIT_FRAME_CHOICES.map((choice) => (
          <button key={choice.value} type="button" role="radio"
            aria-checked={draft === choice.value}
            disabled={saving || !environment || !serverReady}
            onClick={() => { setDraft(choice.value); setMessage(null); }}
            className={cn(
              'rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-50',
              draft === choice.value
                ? 'bg-[#BBA8CA] text-[#1b161d]'
                : 'bg-black/15 text-[var(--text-secondary)] hover:bg-white/[0.06]',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {draft === applied ? '적용된 설정입니다.' : `변경 예정: ${labelFor(draft)}`}
        </p>
        <button type="button" disabled={!environment || !serverReady || saving || draft === applied}
          onClick={() => void apply()}
          className="inline-flex min-w-[112px] items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-black text-zinc-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          적용
        </button>
      </div>
      {message && <p role="status" className={cn('mt-4 text-xs font-bold', message.ok ? 'text-zinc-200' : 'text-red-300')}>{message.text}</p>}
      {!environment && <p className="mt-3 text-xs text-red-300">등록된 서비스 주소에서만 전체 적용이 가능합니다.</p>}
    </div>
  );
}
