import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { db } from '../firebase';
import { normalizeClicheTermList } from '../constants/lyricClicheGuard';

const NAVIGATION_VISIBILITY_DOC = doc(db, 'app_settings', 'navigation_visibility');
const LYRIC_CLICHE_GUARD_DOC = doc(db, 'app_settings', 'lyric_cliche_guard');
const LIBRARY_MENU_STORAGE_KEY = 'soridraw_navigation_show_suno_library_menu';
const LIBRARY_ADMIN_ONLY_STORAGE_KEY = 'soridraw_navigation_suno_library_admin_only';

type NavigationVisibilitySettings = {
  showSunoLibraryMenu: boolean;
  sunoLibraryMenuAdminOnly: boolean;
};

const DEFAULT_SETTINGS: NavigationVisibilitySettings = {
  showSunoLibraryMenu: false,
  sunoLibraryMenuAdminOnly: false,
};

type LyricClicheDraft = {
  hardBanText: string;
  softBanText: string;
};

const DEFAULT_CLICHE_DRAFT: LyricClicheDraft = {
  hardBanText: '',
  softBanText: '',
};

const parseTerms = (value: string) => normalizeClicheTermList(value, 120);
const formatTerms = (value: unknown) => normalizeClicheTermList(value, 120).join('\n');

type SavingTarget = 'visibility' | 'adminOnly' | null;

function ToggleSwitch({
  isOn,
  isSaving,
  onClick,
  label,
}: {
  isOn: boolean;
  isSaving: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-black text-[var(--text-secondary)]">{label}</span>
      <button
        type="button"
        onClick={onClick}
        disabled={isSaving}
        className={`relative flex h-9 w-16 shrink-0 items-center rounded-full px-1 transition-all disabled:cursor-wait disabled:opacity-60 ${isOn ? 'bg-[#BBA8CA]' : 'bg-white/12'}`}
        aria-pressed={isOn}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#1b1b1b] shadow-sm transition-transform ${isOn ? 'translate-x-7' : 'translate-x-0'}`}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isOn ? 'ON' : 'OFF'}
        </span>
      </button>
    </div>
  );
}

export default function AdminAppSettingsPage() {
  const [settings, setSettings] = useState<NavigationVisibilitySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SavingTarget>(null);
  const [message, setMessage] = useState('');
  const [clicheDraft, setClicheDraft] = useState<LyricClicheDraft>(DEFAULT_CLICHE_DRAFT);
  const [isClicheLoading, setIsClicheLoading] = useState(true);
  const [isSavingCliche, setIsSavingCliche] = useState(false);
  const [clicheMessage, setClicheMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const snapshot = await getDoc(NAVIGATION_VISIBILITY_DOC);
        if (!isMounted) return;

        const data = snapshot.exists() ? snapshot.data() : null;
        setSettings({
          showSunoLibraryMenu: data?.showSunoLibraryMenu === true,
          sunoLibraryMenuAdminOnly: data?.sunoLibraryMenuAdminOnly === true,
        });
      } catch (error) {
        console.error('Failed to load app settings:', error);
        if (isMounted) {
          setSettings(DEFAULT_SETTINGS);
          setMessage('설정값을 불러오지 못했습니다. Firestore 권한을 확인해주세요.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadClicheGuard = async () => {
      try {
        const snapshot = await getDoc(LYRIC_CLICHE_GUARD_DOC);
        if (!isMounted) return;
        const data = snapshot.exists() ? snapshot.data() : null;
        setClicheDraft({
          hardBanText: formatTerms(data?.hardBanTerms),
          softBanText: formatTerms(data?.softBanTerms),
        });
      } catch (error) {
        console.error('Failed to load lyric cliche guard settings:', error);
        if (isMounted) setClicheMessage('클리셰 설정을 불러오지 못했습니다. Firestore 권한을 확인해주세요.');
      } finally {
        if (isMounted) setIsClicheLoading(false);
      }
    };

    loadClicheGuard();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSettings = async (nextSettings: NavigationVisibilitySettings, target: SavingTarget, successMessage: string) => {
    const previous = settings;
    setSettings(nextSettings);
    setSavingTarget(target);
    setMessage('');

    try {
      await setDoc(
        NAVIGATION_VISIBILITY_DOC,
        {
          ...nextSettings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      try {
        localStorage.setItem(LIBRARY_MENU_STORAGE_KEY, nextSettings.showSunoLibraryMenu ? 'true' : 'false');
        localStorage.setItem(LIBRARY_ADMIN_ONLY_STORAGE_KEY, nextSettings.sunoLibraryMenuAdminOnly ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('soridraw:navigation-visibility-updated', {
          detail: nextSettings,
        }));
      } catch {
        // Ignore localStorage errors. Firestore remains the source of truth.
      }
      setMessage(successMessage);
    } catch (error) {
      console.error('Failed to save app settings:', error);
      setSettings(previous);
      setMessage('저장에 실패했습니다. 관리자 권한 또는 Firestore 규칙을 확인해주세요.');
    } finally {
      setSavingTarget(null);
    }
  };

  const updateAdminOnlyVisibility = () => {
    const nextValue = !settings.sunoLibraryMenuAdminOnly;
    const nextSettings = { ...settings, sunoLibraryMenuAdminOnly: nextValue };
    persistSettings(
      nextSettings,
      'adminOnly',
      nextValue
        ? '라이브러리 메뉴를 관리자에게만 보이게 설정했습니다.'
        : '라이브러리 메뉴의 관리자 전용 제한을 해제했습니다.'
    );
  };

  const updateLibraryVisibility = () => {
    const nextValue = !settings.showSunoLibraryMenu;
    const nextSettings = { ...settings, showSunoLibraryMenu: nextValue };
    persistSettings(
      nextSettings,
      'visibility',
      nextValue ? '라이브러리 메뉴를 보이게 했습니다.' : '라이브러리 메뉴를 숨겼습니다.'
    );
  };

  const saveClicheGuard = async () => {
    setIsSavingCliche(true);
    setClicheMessage('');
    try {
      const hardBanTerms = parseTerms(clicheDraft.hardBanText);
      const softBanTerms = parseTerms(clicheDraft.softBanText);
      await setDoc(
        LYRIC_CLICHE_GUARD_DOC,
        {
          hardBanTerms,
          softBanTerms,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setClicheDraft({
        hardBanText: hardBanTerms.join('\n'),
        softBanText: softBanTerms.join('\n'),
      });
      setClicheMessage('전체 클리셰 설정을 저장했습니다.');
    } catch (error) {
      console.error('Failed to save lyric cliche guard settings:', error);
      setClicheMessage('저장에 실패했습니다. 관리자 권한 또는 Firestore 규칙을 확인해주세요.');
    } finally {
      setIsSavingCliche(false);
    }
  };

  const isSavingAdminOnly = savingTarget === 'adminOnly';
  const isSavingVisibility = savingTarget === 'visibility';
  return (
    <AdminPageLayout
      title="앱 설정"
      description="상단 메뉴처럼 사용자에게 보이는 앱 기능을 관리합니다."
    >
      <div className="space-y-5">
        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-[var(--text-primary)]">라이브러리 메뉴</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  메뉴 표시가 ON이면 상단 메뉴에 노출됩니다. 관리자만 ON이면 관리자 계정에만 보입니다.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-5">
              <ToggleSwitch
                label="관리자만"
                isOn={settings.sunoLibraryMenuAdminOnly}
                isSaving={isLoading || isSavingAdminOnly}
                onClick={updateAdminOnlyVisibility}
              />
              <ToggleSwitch
                label="메뉴 표시"
                isOn={settings.showSunoLibraryMenu}
                isSaving={isLoading || isSavingVisibility}
                onClick={updateLibraryVisibility}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-[var(--text-primary)]">전체 클리셰 관리</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  모든 사용자에게 공통 적용됩니다. 한 줄에 하나씩 입력하고, HardBan은 거의 금지 / SoftBan은 사용자가 직접 고른 경우만 허용합니다.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black text-[#D8A4A2]">HardBan · 전체 강한 금지</span>
                <textarea
                  value={clicheDraft.hardBanText}
                  onChange={(event) => setClicheDraft((prev) => ({ ...prev, hardBanText: event.target.value }))}
                  disabled={isClicheLoading || isSavingCliche}
                  placeholder={"미로\n궤도\n신기루"}
                  className="mt-2 h-44 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20 focus:border-[#D8A4A2]/55 disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black text-[#BBA8CA]">SoftBan · 전체 조건부 회피</span>
                <textarea
                  value={clicheDraft.softBanText}
                  onChange={(event) => setClicheDraft((prev) => ({ ...prev, softBanText: event.target.value }))}
                  disabled={isClicheLoading || isSavingCliche}
                  placeholder={"비\n바람\n그림자"}
                  className="mt-2 h-44 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20 focus:border-[#BBA8CA]/55 disabled:opacity-60"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                기본 내장 클리셰 목록은 유지되고, 여기 입력한 단어가 추가로 합쳐집니다.
              </p>
              <button
                type="button"
                onClick={saveClicheGuard}
                disabled={isClicheLoading || isSavingCliche}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D8A4A2] px-5 py-3 text-sm font-black text-[#211615] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingCliche ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                전체 클리셰 저장
              </button>
            </div>
          </div>
        </div>

        {clicheMessage && (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#BBA8CA]">
            {clicheMessage}
          </div>
        )}

        {message && (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#BBA8CA]">
            {message}
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
