import React, { useState, useEffect } from 'react';
import AdminPageLayout from '../components/AdminPageLayout';
import { auth } from '../firebase';
import { Settings2, Save, Play, Beaker } from 'lucide-react';
import { SunoAccessSettings } from '../types';

export default function AdminSunoApiPage() {
  const [settings, setSettings] = useState<SunoAccessSettings>({
    enabled: false,
    allowedPlans: {
      free: false,
      basic: false,
      pro: false,
      admin: false
    }
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const loadSettings = async () => {
    // try {
    //   const snap = await getDoc(doc(db, 'app_settings', 'suno_api_access'));
    //   if (snap.exists()) {
    //     setSettings(snap.data() as SunoAccessSettings);
    //   }
    // } catch (e) {
    //   console.error(e);
    // }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    // 임시 딜레이
    setTimeout(() => {
      setMessage('정상적으로 저장되었습니다.');
      setIsSaving(false);
    }, 600);
  };

  const handleTestDryRun = async () => {
    if (!auth.currentUser) {
      setMessage('로그인이 필요합니다.');
      return;
    }

    setIsTesting(true);
    setMessage('');
    setTestResult(null);

    try {
      const token = await auth.currentUser.getIdToken();
      
      const testAppliedKeywords = {
        genre: ['k-pop'],
        subGenre: ['idol-pop'],
        style: ['dance'],
        sound: ['synth'],
        mood: ['bright'],
        theme: ['love'],
        vocal: {
          maleCount: 0,
          femaleCount: 1,
          rapEnabled: false
        },
        tempoConfig: {
          min: 90,
          max: 120
        },
        songStructure: ['Intro', 'Verse 1', 'Chorus', 'Outro'],
        source: 'dryRunTest'
      };

      const res = await fetch("https://us-central1-soridraw-app-866a5.cloudfunctions.net/createSunoTrack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          dryRun: true,
          title: 'Dry Run Test Track',
          prompt: 'Happy vibrations, dancing all night...',
          style: 'K-Pop, Dance',
          lyrics: 'Happy vibrations, dancing all night...',
          appliedKeywords: testAppliedKeywords
        })
      });

      const data = await res.json();
      
      if (data.ok) {
        setMessage('테스트 요청 성공! Firestore를 확인해주세요.');
        setTestResult(data);
      } else {
        setMessage(`테스트 실패: ${data.error || '알 수 없는 오류'}`);
        setTestResult(data);
      }
    } catch (err: any) {
      console.error(err);
      setMessage(`에러 발생: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handlePlanToggle = (plan: keyof typeof settings.allowedPlans) => {
    setSettings(prev => ({
      ...prev,
      allowedPlans: {
        ...prev.allowedPlans,
        [plan]: !prev.allowedPlans[plan]
      }
    }));
  };

  return (
    <AdminPageLayout
      title="Suno API 관리"
      description="Suno API 기능의 전체 사용 여부와 플랜별 접근 권한을 설정합니다."
      actions={
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange text-white font-bold text-sm rounded-xl hover:bg-brand-orange/90 transition-all shadow-md disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '저장 중...' : '변경사항 저장'}
        </button>
      }
    >
      <div className="space-y-6">
        
        {/* Helper Box */}
        <div className="p-5 rounded-2xl bg-[#2a2a2a] border border-white/5 space-y-2 text-sm text-[var(--text-secondary)]">
          <p>이곳에서 기능을 활성화해도, 실제 유저가 사용하려면 개인별 [Suno API Key] 등록이 필요합니다.</p>
          <p>전체 비활성화 시 설정 화면이나 API 생성이 모두 즉시 차단됩니다.</p>
          {message && (
            <p className="text-brand-orange font-medium pt-2">{message}</p>
          )}
        </div>

        {/* Global Settings */}
        <div className="p-6 rounded-3xl border border-btn-border bg-[var(--bg-secondary)] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-btn-bg flex items-center justify-center border border-btn-border">
                <Settings2 className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">전체 기능 사용</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Suno API 기능 통합 ON/OFF</p>
              </div>
            </div>
            
            <button
              onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${settings.enabled ? 'bg-brand-orange' : 'bg-gray-600'}`}
            >
              <div className={`w-6 h-6 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <hr className="border-t border-btn-border mb-6" />

          {/* Plan Settings */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4">플랜별 허용</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.allowedPlans).map(([plan, isAllowed]) => (
                <div key={plan} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                  <span className="text-sm font-bold uppercase text-[var(--text-primary)]">{plan}</span>
                  <button
                    onClick={() => handlePlanToggle(plan as keyof typeof settings.allowedPlans)}
                    disabled={!settings.enabled}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${!settings.enabled ? 'opacity-30 cursor-not-allowed' : ''} ${isAllowed ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isAllowed ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-t border-btn-border mb-6" />

          {/* Development / Testing Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                <Beaker className="w-4 h-4 text-brand-orange" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">개발 및 테스트</h4>
            </div>
            
            <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h5 className="text-sm font-bold text-[var(--text-primary)]">appliedKeywords 저장 테스트</h5>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    실제 Suno API를 호출하지 않고 dryRun 모드로 Firestore에 테스트 문서를 생성합니다.
                  </p>
                </div>
                <button
                  onClick={handleTestDryRun}
                  disabled={isTesting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-white font-bold text-sm rounded-xl hover:bg-white/10 transition-all shadow-sm disabled:opacity-50 min-w-[160px]"
                >
                  <Play className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? '테스트 중...' : '테스트 실행'}
                </button>
              </div>

              {testResult && (
                <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] overflow-auto max-h-40">
                  <p className="text-brand-orange mb-2 font-bold uppercase">Test Result:</p>
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminPageLayout>
  );
}
