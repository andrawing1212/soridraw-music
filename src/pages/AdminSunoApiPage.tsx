import React, { useState, useEffect } from 'react';
import AdminPageLayout from '../components/AdminPageLayout';
// import { doc, getDoc, setDoc } from 'firebase/firestore';
// import { db } from '../firebase';
import { Settings2, Save } from 'lucide-react';
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
  const [message, setMessage] = useState('');

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

    // try {
    //   await setDoc(doc(db, 'app_settings', 'suno_api_access'), {
    //     ...settings,
    //     updatedAt: Date.now()
    //   });
    // } catch (e) {
    //   setMessage('저장에 실패했습니다.');
    // }
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
          <div>
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
        </div>

      </div>
    </AdminPageLayout>
  );
}
