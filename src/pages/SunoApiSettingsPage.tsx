import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, CheckCircle2, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const PROJECT_ID = "soridraw-app-866a5";
const REGION = "us-central1";
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

export default function SunoApiSettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  
  const [apiKey, setApiKey] = useState('');
  const [statusText, setStatusText] = useState<'확인 중...' | '등록됨' | '미등록' | '확인 실패'>('확인 중...');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isRegistered = statusText === '등록됨';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const loadSunoApiKeyStatus = useCallback(async (isRetry = false) => {
    if (!user) return;
    
    if (!isRetry) {
      const cached = localStorage.getItem('soridraw_suno_api_key_registered');
      if (cached === 'true') {
        setStatusText('등록됨');
      } else {
        setStatusText('확인 중...');
      }
    }
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BASE_URL}/getSunoApiKeyStatus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const result = await res.json();

      if (res.ok && result && (result.hasSunoApiKey || result.registered || result.hasApiKey || result.exists)) {
        setStatusText('등록됨');
        localStorage.setItem('soridraw_suno_api_key_registered', 'true');
      } else if (res.ok) {
        setStatusText('미등록');
        localStorage.removeItem('soridraw_suno_api_key_registered');
      } else {
        if (isRetry) {
          console.warn('Failed to load API key status after save/delete (server error)');
        } else {
          const cached = localStorage.getItem('soridraw_suno_api_key_registered');
          if (cached !== 'true') {
            setStatusText('확인 실패');
          } else {
            console.warn('Server error, but assumed registered by cached status.');
          }
        }
      }
    } catch (e) {
      if (isRetry) {
        console.warn('Failed to load API key status after save/delete:', e);
      } else {
        const cached = localStorage.getItem('soridraw_suno_api_key_registered');
        if (cached !== 'true') {
          setStatusText('확인 실패');
        } else {
          console.warn('Network error, but assumed registered by cached status.', e);
        }
      }
    }
  }, [user]);

  const saveSunoApiKey = async () => {
    if (!apiKey.trim() || !user) return;
    setIsLoading(true);
    setMessage('');
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BASE_URL}/saveSunoApiKey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const result = await res.json();
      
      if (res.ok && result.ok) {
        setStatusText('등록됨');
        localStorage.setItem('soridraw_suno_api_key_registered', 'true');
        setApiKey('');
        setMessage('API Key가 안전하게 등록되었습니다.');
        loadSunoApiKeyStatus(true);
      } else {
        setMessage('저장에 실패했습니다.');
      }
    } catch (e) {
      console.error('Failed to save API key:', e);
      setMessage('저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSunoApiKey = async () => {
    if (!user) return;
    setIsLoading(true);
    setMessage('');
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BASE_URL}/deleteSunoApiKey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const result = await res.json();

      if (res.ok && result.ok) {
        setStatusText('미등록');
        localStorage.removeItem('soridraw_suno_api_key_registered');
        setMessage('API Key가 삭제되었습니다.');
        loadSunoApiKeyStatus(true);
      } else {
        setMessage('삭제에 실패했습니다.');
      }
    } catch (e) {
      console.error('Failed to delete API key:', e);
      setMessage('삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSunoApiKeyStatus(false);
  }, [loadSunoApiKeyStatus]);


  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16 text-[var(--text-primary)]">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover transition-all flex items-center gap-2"
            >
              <Home className="w-4 h-4" />홈
            </button>
            <button
              onClick={() => navigate('/suno-library')}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover transition-all"
            >
              Library
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Key className="w-8 h-8 text-brand-orange" />
              Suno API 설정
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              개인 Suno API Key를 등록하면 허용된 플랜에서 API 생성 기능을 사용할 수 있습니다.
            </p>
          </div>
        </motion.div>

        {/* Warning Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-sm space-y-2"
        >
          <div className="flex items-center gap-2 font-bold text-amber-500 mb-1">
            <AlertTriangle className="w-4 h-4" />주의사항
          </div>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>API 생성 비용은 입력한 개인 API Key의 크레딧에서 차감됩니다.</li>
            <li>음원 파일은 앱 서버에 저장되지 않습니다.</li>
            <li>이번 단계에서는 실제 API 저장/호출은 준비 상태입니다.</li>
          </ul>
        </motion.div>

        {/* Key Status & Input Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-white/5 space-y-6"
        >
          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="font-medium text-[var(--text-secondary)]">등록 상태</div>
            <div className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg ${
              statusText === '등록됨' ? 'bg-green-500/10 text-green-400' 
              : statusText === '미등록' ? 'bg-red-500/10 text-red-400'
              : 'bg-white/10 text-white/50'
            }`}>
              {statusText === '등록됨' && <CheckCircle2 className="w-4 h-4" />}
              {statusText === '미등록' && <XCircle className="w-4 h-4" />}
              {(statusText === '확인 중...' || statusText === '확인 실패') && <AlertTriangle className="w-4 h-4" />}
              {statusText}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-[var(--text-secondary)] ml-1">
              API Key 입력
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isRegistered ? "새로운 API Key를 입력하여 변경..." : "sk-..."}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-orange/60 focus:ring-1 focus:ring-brand-orange/30 transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveSunoApiKey}
              disabled={isLoading || !apiKey.trim()}
              className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '처리 중...' : '저장하기'}
            </button>
            {isRegistered && (
              <button
                onClick={deleteSunoApiKey}
                disabled={isLoading}
                className="px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all font-bold flex items-center justify-center border border-red-500/20"
                title="API Key 삭제"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {message && (
            <div className="text-center text-sm font-medium text-brand-orange">
              {message}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
