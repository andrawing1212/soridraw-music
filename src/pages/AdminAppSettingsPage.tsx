import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FlaskConical, Heart, Home, Library, Loader2, ShieldAlert, SlidersHorizontal, User as UserIcon, Zap } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { db } from '../firebase';
import { normalizeClicheTermList } from '../constants/lyricClicheGuard';
import {
  DEFAULT_NAVIGATION_VISIBILITY_SETTINGS,
  getNavigationFirestorePayload,
  normalizeNavigationVisibilitySettings,
  type NavigationMenuKey,
  type NavigationVisibilitySettings,
  readStoredNavigationVisibilitySettings,
  writeStoredNavigationVisibilitySettings,
} from '../constants/navigationVisibility';

const NAVIGATION_VISIBILITY_DOC = doc(db, 'app_settings', 'navigation_visibility');
const LYRIC_CLICHE_GUARD_DOC = doc(db, 'app_settings', 'lyric_cliche_guard');

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

type SavingTarget = NavigationMenuKey | 'libraryAdminOnly' | null;

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
  const [settings, setSettings] = useState<NavigationVisibilitySettings>(readStoredNavigationVisibilitySettings);
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
        const nextSettings = normalizeNavigationVisibilitySettings(data, readStoredNavigationVisibilitySettings());
        setSettings(nextSettings);
        writeStoredNavigationVisibilitySettings(nextSettings);
      } catch (error) {
        console.error('Failed to load app settings:', error);
        if (isMounted) {
          setSettings(DEFAULT_NAVIGATION_VISIBILITY_SETTINGS);
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
          ...getNavigationFirestorePayload(nextSettings),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      writeStoredNavigationVisibilitySettings(nextSettings);
      window.dispatchEvent(new CustomEvent('soridraw:navigation-visibility-updated', {
        detail: nextSettings,
      }));
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
      'libraryAdminOnly',
      nextValue
        ? '라이브러리를 관리자에게만 보이게 설정했습니다.'
        : '라이브러리의 관리자 전용 제한을 해제했습니다.'
    );
  };

  const updateMenuVisibility = (key: NavigationMenuKey, label: string) => {
    const nextValue = !settings.menuVisibility[key];
    const nextSettings: NavigationVisibilitySettings = {
      ...settings,
      menuVisibility: {
        ...settings.menuVisibility,
        [key]: nextValue,
      },
    };
    persistSettings(
      nextSettings,
      key,
      nextValue ? `${label} 메뉴를 켰습니다.` : `${label} 메뉴를 껐습니다.`
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

  const isSavingAdminOnly = savingTarget === 'libraryAdminOnly';
  const menuRows: Array<{
    key: NavigationMenuKey;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    { key: 'home', label: '홈', description: '메인 홈 화면과 홈 메뉴를 표시합니다.', icon: Home },
    { key: 'studio', label: '스튜디오', description: '가사·프롬프트 제작 화면을 표시합니다.', icon: Zap },
    { key: 'musicNote', label: '뮤직노트', description: '저장한 곡과 제작 데이터를 관리하는 화면을 표시합니다.', icon: Heart },
    { key: 'library', label: '라이브러리', description: 'Music API 생성곡과 재생 목록 화면을 표시합니다.', icon: Library },
    { key: 'lab', label: '실험실', description: '실험 기능과 개발 중인 도구 화면을 표시합니다.', icon: FlaskConical },
    { key: 'myPage', label: '마이페이지', description: '회원정보·API·플랜·개인 설정 화면을 표시합니다.', icon: UserIcon },
  ];

  return (
    <AdminPageLayout
      title="앱 설정"
      description="상단 메뉴처럼 사용자에게 보이는 앱 기능을 관리합니다."
    >
      <div className="space-y-5">
        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 md:p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-[var(--text-primary)]">상단 메뉴·페이지 표시</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                OFF로 설정하면 일반 사용자 메뉴에서 숨겨지고 해당 주소의 페이지 진입도 차단됩니다. 관리자는 점검을 위해 직접 주소로 진입할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {menuRows.map((item) => {
              const Icon = item.icon;
              const isLibrary = item.key === 'library';
              return (
                <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl bg-black/15 px-4 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-[#BBA8CA]">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-[var(--text-primary)]">{item.label}</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {isLibrary && (
                      <ToggleSwitch
                        label="관리자만"
                        isOn={settings.sunoLibraryMenuAdminOnly}
                        isSaving={isLoading || isSavingAdminOnly}
                        onClick={updateAdminOnlyVisibility}
                      />
                    )}
                    <ToggleSwitch
                      label="메뉴 표시"
                      isOn={settings.menuVisibility[item.key]}
                      isSaving={isLoading || savingTarget === item.key}
                      onClick={() => updateMenuVisibility(item.key, item.label)}
                    />
                  </div>
                </div>
              );
            })}
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
