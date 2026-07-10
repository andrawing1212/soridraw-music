import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { db } from '../firebase';

const NAVIGATION_VISIBILITY_DOC = doc(db, 'app_settings', 'navigation_visibility');
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

        {message && (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#BBA8CA]">
            {message}
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
