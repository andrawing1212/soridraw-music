import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { db } from '../firebase';

const NAVIGATION_VISIBILITY_DOC = doc(db, 'app_settings', 'navigation_visibility');

type NavigationVisibilitySettings = {
  showSunoLibraryMenu: boolean;
};

const DEFAULT_SETTINGS: NavigationVisibilitySettings = {
  showSunoLibraryMenu: false,
};

export default function AdminAppSettingsPage() {
  const [settings, setSettings] = useState<NavigationVisibilitySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  const updateLibraryVisibility = async () => {
    const nextValue = !settings.showSunoLibraryMenu;
    const previous = settings;

    setSettings({ showSunoLibraryMenu: nextValue });
    setIsSaving(true);
    setMessage('');

    try {
      await setDoc(
        NAVIGATION_VISIBILITY_DOC,
        {
          showSunoLibraryMenu: nextValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      try {
        localStorage.setItem('soridraw_navigation_show_suno_library_menu', nextValue ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('soridraw:navigation-visibility-updated', {
          detail: { showSunoLibraryMenu: nextValue },
        }));
      } catch {
        // Ignore localStorage errors. Firestore remains the source of truth.
      }
      setMessage(nextValue ? '라이브러리 메뉴를 보이게 했습니다.' : '라이브러리 메뉴를 숨겼습니다.');
    } catch (error) {
      console.error('Failed to save app settings:', error);
      setSettings(previous);
      setMessage('저장에 실패했습니다. 관리자 권한 또는 Firestore 규칙을 확인해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

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
                  OFF이면 상단 메뉴에서만 숨깁니다. 라이브러리 기능과 주소는 삭제하지 않습니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={updateLibraryVisibility}
              disabled={isLoading || isSaving}
              className={`relative flex h-9 w-16 shrink-0 items-center rounded-full px-1 transition-all disabled:cursor-wait disabled:opacity-60 ${settings.showSunoLibraryMenu ? 'bg-[#BBA8CA]' : 'bg-white/12'}`}
              aria-pressed={settings.showSunoLibraryMenu}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#1b1b1b] shadow-sm transition-transform ${settings.showSunoLibraryMenu ? 'translate-x-7' : 'translate-x-0'}`}
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : settings.showSunoLibraryMenu ? 'ON' : 'OFF'}
              </span>
            </button>
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
