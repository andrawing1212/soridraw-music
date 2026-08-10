import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FlaskConical, Gauge, Heart, Home, Library, Loader2, ShieldAlert, SlidersHorizontal, User as UserIcon, Zap } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { db } from '../firebase';
import { normalizeClicheTermList } from '../constants/lyricClicheGuard';
import { readSplitPerfToolVisibility, writeSplitPerfToolVisibility } from '../components/studio/splitPerfDiagnostics';
import {
  DEFAULT_NAVIGATION_VISIBILITY_SETTINGS,
  getNavigationFirestorePayload,
  getNavigationMenuAccessMode,
  normalizeNavigationVisibilitySettings,
  setNavigationMenuAccessMode,
  type NavigationMenuAccessMode,
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

const ACCESS_OPTIONS: Array<{ mode: NavigationMenuAccessMode; label: string }> = [
  { mode: 'public', label: '전체공개' },
  { mode: 'admin', label: '관리자만' },
  { mode: 'hidden', label: '숨김' },
];

function AccessModeSelector({
  value,
  disabled,
  onChange,
}: {
  value: NavigationMenuAccessMode;
  disabled: boolean;
  onChange: (mode: NavigationMenuAccessMode) => void;
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-1 rounded-2xl bg-black/20 p-1 sm:w-auto sm:min-w-[252px]">
      {ACCESS_OPTIONS.map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            disabled={disabled}
            aria-pressed={active}
            className={`rounded-xl px-3 py-2 text-[11px] font-black transition-all disabled:cursor-wait disabled:opacity-60 ${
              active
                ? 'bg-[#BBA8CA] text-[#1b161d] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminAppSettingsPage() {
  const initialNavigationSettings = readStoredNavigationVisibilitySettings();
  const [savedSettings, setSavedSettings] = useState<NavigationVisibilitySettings>(initialNavigationSettings);
  const [draftSettings, setDraftSettings] = useState<NavigationVisibilitySettings>(initialNavigationSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [message, setMessage] = useState('');
  const [clicheDraft, setClicheDraft] = useState<LyricClicheDraft>(DEFAULT_CLICHE_DRAFT);
  const [isClicheLoading, setIsClicheLoading] = useState(true);
  const [isSavingCliche, setIsSavingCliche] = useState(false);
  const [clicheMessage, setClicheMessage] = useState('');
  const [perfToolsVisible, setPerfToolsVisible] = useState(() => readSplitPerfToolVisibility());

  const hasUnsavedNavigationChanges = useMemo(
    () => JSON.stringify(savedSettings) !== JSON.stringify(draftSettings),
    [draftSettings, savedSettings],
  );

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const snapshot = await getDoc(NAVIGATION_VISIBILITY_DOC);
        if (!isMounted) return;

        const data = snapshot.exists() ? snapshot.data() : null;
        const nextSettings = normalizeNavigationVisibilitySettings(data, readStoredNavigationVisibilitySettings());
        setSavedSettings(nextSettings);
        setDraftSettings(nextSettings);
        writeStoredNavigationVisibilitySettings(nextSettings);
      } catch (error) {
        console.error('Failed to load app settings:', error);
        if (isMounted) {
          setSavedSettings(DEFAULT_NAVIGATION_VISIBILITY_SETTINGS);
          setDraftSettings(DEFAULT_NAVIGATION_VISIBILITY_SETTINGS);
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

  const updateMenuAccessMode = (key: NavigationMenuKey, mode: NavigationMenuAccessMode) => {
    setDraftSettings((current) => setNavigationMenuAccessMode(current, key, mode));
    setMessage('');
  };

  const saveNavigationSettings = async () => {
    if (!hasUnsavedNavigationChanges || isSavingSettings) return;

    setIsSavingSettings(true);
    setMessage('');

    try {
      await setDoc(
        NAVIGATION_VISIBILITY_DOC,
        {
          ...getNavigationFirestorePayload(draftSettings),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSavedSettings(draftSettings);
      writeStoredNavigationVisibilitySettings(draftSettings);
      window.dispatchEvent(new CustomEvent('soridraw:navigation-visibility-updated', {
        detail: draftSettings,
      }));
      setMessage('메뉴 설정을 한 번에 적용했습니다.');
    } catch (error) {
      console.error('Failed to save app settings:', error);
      setMessage('저장에 실패했습니다. 관리자 권한 또는 Firestore 규칙을 확인해주세요.');
    } finally {
      setIsSavingSettings(false);
    }
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

  const menuRows: Array<{
    key: NavigationMenuKey;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    { key: 'home', label: '홈', description: '메인 홈 화면과 홈 메뉴를 관리합니다.', icon: Home },
    { key: 'studio', label: '스튜디오', description: '가사·프롬프트 제작 화면을 관리합니다.', icon: Zap },
    { key: 'musicNote', label: '뮤직노트', description: '저장한 곡과 제작 데이터 관리 화면을 관리합니다.', icon: Heart },
    { key: 'library', label: '라이브러리', description: 'Music API 생성곡과 재생 목록 화면을 관리합니다.', icon: Library },
    { key: 'lab', label: '실험실', description: '실험 기능과 개발 중인 도구 화면을 관리합니다.', icon: FlaskConical },
    { key: 'myPage', label: '마이페이지', description: '회원정보·API·플랜·개인 설정 화면을 관리합니다.', icon: UserIcon },
  ];

  return (
    <AdminPageLayout
      title="앱 설정"
      description="상단 메뉴와 페이지 이용 범위를 한 번에 관리합니다."
    >
      <div className="space-y-5">
        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-[var(--text-primary)]">상단 메뉴·페이지 이용 설정</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                전체공개는 모든 회원, 관리자만은 관리자 계정만 이용할 수 있습니다. 숨김은 메뉴에서 제거되며 일반 회원의 직접 주소 진입도 차단됩니다.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {menuRows.map((item) => {
              const Icon = item.icon;
              const accessMode = getNavigationMenuAccessMode(draftSettings, item.key);
              return (
                <div key={item.key} className="flex flex-col gap-4 rounded-2xl bg-black/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-[#BBA8CA]">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-[var(--text-primary)]">{item.label}</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
                    </div>
                  </div>
                  <AccessModeSelector
                    value={accessMode}
                    disabled={isLoading || isSavingSettings}
                    onChange={(mode) => updateMenuAccessMode(item.key, mode)}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              여러 메뉴를 변경해도 아래 버튼을 누를 때 Firestore 쓰기 1회로 저장됩니다.
            </p>
            <button
              type="button"
              onClick={saveNavigationSettings}
              disabled={isLoading || isSavingSettings || !hasUnsavedNavigationChanges}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#BBA8CA] px-5 py-3 text-sm font-black text-[#1b161d] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              설정 적용
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-[var(--text-primary)]">품질·성능 진단 도구</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  관리자 전용 품질·성능 도구 모음입니다. 자동 분할 벤치마크, 뮤직노트 정밀/렌더/영역/좌표 A/B, 실제 마우스 입력 A/B, 입력 샘플링 A/B, 연속 rAF A/B, DEV·PROD 실행 환경 진단과 종합 진단서 복사를 함께 보관합니다. 자동 벤치마크는 1400×900 고정 표면·고정 스크롤·고정 이동거리로 실행되어 창 크기를 사람이 맞출 필요가 없습니다. 591차의 직접 pane 좌표 실런타임은 유지합니다. 595차 연속 rAF A/B는 같은 PointerMove 입력을 사용한 채 기존 이벤트 예약형 rAF와 화면 프레임 연속 추적형 rAF를 실제 손 드래그로 비교하고, 테스트 종료 후 기존 입력 방식으로 자동 복구합니다.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">자동 벤치마크</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">뮤직노트 정밀 A/B</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">실사용 Pointer A/B</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">렌더 A/B</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">영역 이진 스캔</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">좌표 A/B</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">1400×900 고정 표면</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">실행 환경·CSS cascade</span>
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1">종합 진단서</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-pressed={perfToolsVisible}
              onClick={() => {
                const next = !perfToolsVisible;
                setPerfToolsVisible(next);
                writeSplitPerfToolVisibility(next);
              }}
              className={`inline-flex min-w-[118px] items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition-[background-color,color,opacity] ${
                perfToolsVisible
                  ? 'bg-[#BBA8CA] text-[#1b161d]'
                  : 'bg-black/25 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]'
              }`}
            >
              진단 {perfToolsVisible ? '표시' : '숨김'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-[var(--bg-secondary)] p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex min-w-0 items-start gap-3">
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
                  placeholder={'미로\n궤도\n신기루'}
                  className="mt-2 h-44 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20 focus:border-[#D8A4A2]/55 disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black text-[#BBA8CA]">SoftBan · 전체 조건부 회피</span>
                <textarea
                  value={clicheDraft.softBanText}
                  onChange={(event) => setClicheDraft((prev) => ({ ...prev, softBanText: event.target.value }))}
                  disabled={isClicheLoading || isSavingCliche}
                  placeholder={'비\n바람\n그림자'}
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
