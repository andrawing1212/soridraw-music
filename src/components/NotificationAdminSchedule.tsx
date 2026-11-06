import React, { useEffect, useState } from 'react';
import { Clock3, Save } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from '../lib/firestoreMeasured';
import { auth, db } from '../firebase';

const SCHEDULE_DOCUMENT = doc(db, 'app_settings', 'notification_schedule');
// Only the admin App Settings route mounts this component; Firestore Rules
// independently require appSettings permission for actual writes.
const OPTIONS = [1, 2, 3, 4, 6, 12, 24] as const;
const normalHours = (value: unknown): number =>
  typeof value === 'number' && OPTIONS.includes(value as typeof OPTIONS[number]) ? value : 2;

export default function NotificationAdminSchedule() {
  const [hours, setHours] = useState(2);
  const [savedHours, setSavedHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!auth.currentUser) { setLoaded(true); return; }
    void getDoc(SCHEDULE_DOCUMENT).then(snapshot => {
      if (!mounted) return;
      const value = normalHours(snapshot.data()?.intervalHours);
      setHours(value);
      setSavedHours(value);
    }).catch(() => {
      if (mounted) setMessage('관리자 설정을 읽지 못했습니다.');
    }).finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    if (busy || !loaded || hours === savedHours) return;
    setBusy(true);
    setMessage('');
    try {
      await setDoc(SCHEDULE_DOCUMENT, {
        intervalHours: hours,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || '',
      }, { merge: true });
      setSavedHours(hours);
      setMessage('수집 주기 설정을 저장했습니다.');
    } catch {
      setMessage('설정 저장에 실패했습니다. 관리자 권한을 확인해 주세요.');
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-3xl bg-[var(--bg-secondary)] px-5 py-5 shadow-sm md:px-6">
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-[#ffbb22]" />
        <h3 className="text-sm font-black text-[var(--text-primary)]">알림 취합 주기 · 관리자 전용</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        기본 2시간(하루 12회)입니다. 일반 사용자의 알림 설정에는 주기 변경 기능이 없습니다.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="notification-admin-hours" className="text-xs text-[var(--text-secondary)]">취합 간격</label>
        <select id="notification-admin-hours" value={hours}
          disabled={!loaded || busy} onChange={e => setHours(Number(e.target.value))}
          className="rounded-xl bg-[#303033] px-3 py-2 text-sm text-white">
          {OPTIONS.map(option => <option value={option} key={option}>{option}시간마다</option>)}
        </select>
        <button type="button" onClick={() => void save()}
          disabled={!loaded || busy || hours === savedHours}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ffbb22] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
          <Save className="h-4 w-4" /> 저장
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        발송 서버가 아직 연결되지 않아 이 설정만 저장됩니다. 사용자별 반복 조회를 시작하지 않습니다.
      </p>
      {message && <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p>}
    </section>
  );
}
