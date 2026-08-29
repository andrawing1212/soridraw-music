// SORIDRAW_894_GEMINI_KEY_IDENTITY_SINGLE_CACHE
// SORIDRAW_893_GOOGLE_KEY_CACHE_RESTORE_HARDENING
// SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION
// SORIDRAW_891_GOOGLE_KEY_CACHE_FIRST
// SORIDRAW_890_GEMINI_KEY_SIMPLE_UI
// SORIDRAW_889_GEMINI_KEY_IDENTITY
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, ExternalLink, Key, Music2, RefreshCw, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, getFirebaseAppCheckToken } from '../firebase';
import CacheDiagnosticBadge from './CacheDiagnosticBadge';
import { markCacheDiagnostic } from '../lib/cacheDiagnostics';

const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;

const PROJECT_ID = "soridraw-app-866a5";
const REGION = "us-central1";
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const GOOGLE_GEMINI_API_KEY_STORAGE_BASE = 'soridraw_google_gemini_api_key';
const GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_google_gemini_api_key_registered';
const GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE = 'soridraw_google_gemini_api_key_meta';
const GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE = 'soridraw_google_gemini_api_key_last6';
const SUNO_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_suno_api_key_registered';
const SUNO_REMAINING_CREDITS_STORAGE_BASE = 'soridraw_suno_remaining_credits';
const SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE = 'soridraw_suno_remaining_credits_updated_at';

const GOOGLE_API_CREATE_URL = 'https://aistudio.google.com/app/apikey';
const MUSIC_API_CREATE_URL = 'https://sunoapi.org/ko';

type SunoApiSettingsPanelProps = {
 className?: string;
 showHeader?: boolean;
 googleGeminiApiKeyVersion?: number | null;
};

type ApiModalType = 'google' | 'music' | null;

type GoogleKeyMeta = { registered: boolean; last6: string; updatedAt: string | null; version: number };

function scopedStorageKey(base: string, uid?: string | null) {
 return `${base}_${uid || 'guest'}`;
}

function getMusicApiErrorMessage(result: any): string {
 if (result?.userMessage) return result.userMessage;

 if (result?.errorCode === 'SUNO_API_TLS_CERTIFICATE_ERROR') {
 return 'Music API 서버의 보안 연결에 문제가 있어 잠시 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
 }

 if (result?.errorCode === 'SUNO_API_CONNECTION_ERROR') {
 return 'Music API 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
 }

 if (typeof result?.details === 'string' && (
 result.details.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
 result.details.includes('unable to verify the first certificate') ||
 result.details.toLowerCase().includes('certificate')
 )) {
 return 'Music API 서버의 보안 연결에 문제가 있어 잠시 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
 }

 if (result?.error === 'Failed to fetch remaining credits') {
 return 'Music API 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
 }

 return result?.error || 'Music API 남은 크레딧 확인에 실패했습니다.';
}

function getStoredGoogleApiKey(_uid?: string | null) {
 // 실제 Gemini API Key는 로컬에 저장하지 않는다.
 return '';
}

function getStoredGoogleApiKeyStatus(uid?: string | null) {
 try {
 const stored = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) || '');
 return stored === 'true' || stored.startsWith('true|');
 } catch {
 return false;
 }
}

function getStoredGoogleRegisteredLast6(uid?: string | null): string {
 try {
 const stored = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) || '');
 if (!stored.startsWith('true|')) return '';
 return String(stored.slice(5)).slice(-6);
 } catch {
 return '';
 }
}

function getStoredGoogleKeyMeta(uid?: string | null): GoogleKeyMeta | null {
 try {
 const raw = localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, uid));
 const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || getStoredGoogleRegisteredLast6(uid) || '').slice(-6);
 if (!raw) {
 return fallbackLast6
 ? { registered: true, last6: fallbackLast6, updatedAt: null, version: 0 }
 : null;
 }
 const parsed = JSON.parse(raw);
 const last6 = String(parsed?.last6 || fallbackLast6 || '').slice(-6);
 const version = Number(parsed?.version || 0);
 const registered = parsed?.registered === false ? false : Boolean(last6);
 if (!last6 && registered) return null;
 if (!last6 && !version && parsed?.registered !== false) return null;
 return { registered, last6, updatedAt: parsed?.updatedAt || null, version: Number.isFinite(version) ? version : 0 };
 } catch {
 try {
 const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || getStoredGoogleRegisteredLast6(uid) || '').slice(-6);
 return fallbackLast6 ? { registered: true, last6: fallbackLast6, updatedAt: null, version: 0 } : null;
 } catch {
 return null;
 }
 }
}

function readStoredCredits(uid?: string | null): number | null {
 try {
 const saved = Number(localStorage.getItem(scopedStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE, uid)) || '');
 return Number.isFinite(saved) && saved >= 0 ? saved : null;
 } catch {
 return null;
 }
}

function readStoredCreditsUpdatedAt(uid?: string | null): string | null {
 try {
 const saved = localStorage.getItem(scopedStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE, uid));
 if (!saved) return null;
 const numeric = Number(saved);
 if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString();
 return saved;
 } catch {
 return null;
 }
}


function ApiKeyModal({
 type,
 title,
 description,
 guideText,
 createUrl,
 inputValue,
 setInputValue,
 isRegistered,
 isLoading,
 googleKeyMeta,
 onClose,
 onSave,
 onDelete,
}: {
 type: 'google' | 'music';
 title: string;
 description: string;
 guideText: string;
 createUrl: string;
 inputValue: string;
 setInputValue: (value: string) => void;
 isRegistered: boolean;
 isLoading: boolean;
 googleKeyMeta?: GoogleKeyMeta | null;
 onClose: () => void;
 onSave: () => void;
 onDelete: () => void;
}) {
 const inputPlaceholder = isRegistered ? '새 API Key를 입력하면 기존 키를 변경합니다.' : 'API Key를 입력하세요.';
 const hasCachedGoogleKeyIdentity = type === 'google' && Boolean(googleKeyMeta?.last6);
 const maskedGoogleKey = hasCachedGoogleKeyIdentity ? `••••••••••••••••••••••${googleKeyMeta?.last6}` : '';
 const displayedPlaceholder = maskedGoogleKey || inputPlaceholder;
 const googleInputLabel = type === 'google' && (isRegistered || hasCachedGoogleKeyIdentity) ? 'API 저장완료' : 'API Key 입력';

 return (
 <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={(event) => {
 if (event.target === event.currentTarget) onClose();
 }}>
 <motion.div
 initial={false}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 16, scale: 0.98 }}
 className="w-full max-w-xl overflow-hidden rounded-[28px] bg-[#171717] shadow-2xl"
 >
 <div className="flex items-start justify-between gap-4 px-5 py-4">
 <div>
 <div className="flex items-center gap-2">
 <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${type === 'google' ? ' bg-[#ff5f9f]/12 text-[#ff8fb4]' : ' bg-[#b990ff]/12 text-[#c9a6ff]'}`}>
 {type === 'google' ? <Sparkles className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
 </span>
 <div>
 <h3 className="text-lg font-black text-white">{title}</h3>
 <p className="mt-0.5 text-xs font-medium text-white/45">{description}</p>
 </div>
 </div>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="rounded-2xl bg-white/[0.04] p-2 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
 aria-label="닫기"
 >
 <X className="h-5 w-5" />
 </button>
 </div>

 <div className="space-y-4 p-5">
 <div className={`rounded-2xl p-4 text-sm leading-relaxed ${type === 'google' ? ' bg-[#ff5f9f]/[0.06] text-[#F2D1CF]/75' : ' bg-[#b990ff]/[0.06] text-[#E6DDF0]/75'}`}>
 {guideText}
 </div>

 <a
 href={createUrl}
 target="_blank"
 rel="noopener noreferrer"
 className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${type === 'google' ? ' bg-[#ff5f9f]/12 text-[#ff8fb4] hover:bg-[#ff5f9f]/20' : ' bg-[#b990ff]/12 text-[#c9a6ff] hover:bg-[#b990ff]/20'}`}
 >
 API Key 생성 페이지 열기 <ExternalLink className="h-4 w-4" />
 </a>

 <div className="space-y-2">
 <label className="ml-1 block text-sm font-black text-white/60">{type === 'google' ? googleInputLabel : 'API Key 입력'}</label>
 <input
 type={type === 'google' ? 'text' : 'password'}
 value={inputValue}
 onChange={(event) => setInputValue(event.target.value)}
 placeholder={displayedPlaceholder}
 name={type === 'google' ? 'soridraw-gemini-api-token' : 'soridraw-music-api-token'}
 autoComplete={type === 'google' ? 'off' : 'new-password'}
 autoCapitalize="none"
 spellCheck={false}
 style={type === 'google' && inputValue ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties & { WebkitTextSecurity?: string }) : undefined}
 autoFocus
 className={`w-full rounded-2xl bg-white/[0.045] px-4 py-3 font-mono text-white transition-all outline-none placeholder:text-white/30 ${type === 'google' ? ' focus:ring-1 focus:ring-[#ff5f9f]/25' : ' focus:ring-1 focus:ring-[#b990ff]/25'}`}
 />
 </div>

 <div className="flex items-center gap-3 pt-1">
 <button
 type="button"
 onClick={onSave}
 disabled={isLoading || !inputValue.trim()}
 className={`flex-1 rounded-2xl py-3 font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${type === 'google' ? ' bg-[#ff5f9f]/15 text-[#ff8fb4] hover:bg-[#ff5f9f]/25' : ' bg-[#b990ff]/15 text-[#c9a6ff] hover:bg-[#b990ff]/25'}`}
 >
 {isLoading ? '처리 중...' : '저장하기'}
 </button>
 {isRegistered && (
 <button
 type="button"
 onClick={onDelete}
 disabled={isLoading}
 className="flex items-center justify-center rounded-2xl bg-rose-500/10 px-4 py-3 font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
 title="API Key 삭제"
 >
 <Trash2 className="h-5 w-5" />
 </button>
 )}
 </div>
 </div>
 </motion.div>
 </div>
 );
}

export default function SunoApiSettingsPanel({ className = '', showHeader = true, googleGeminiApiKeyVersion = null }: SunoApiSettingsPanelProps) {
 const [user, setUser] = useState<User | null>(auth.currentUser);
 const [musicApiKey, setMusicApiKey] = useState('');
 const [googleApiKey, setGoogleApiKey] = useState('');
 const initialGoogleKeyMeta = getStoredGoogleKeyMeta(auth.currentUser?.uid);
 const [googleKeyMeta, setGoogleKeyMeta] = useState<GoogleKeyMeta | null>(initialGoogleKeyMeta);
 const [googleRegistered, setGoogleRegistered] = useState(() => getStoredGoogleApiKeyStatus(auth.currentUser?.uid));
 const [statusText, setStatusText] = useState<'확인 중...' | '등록됨' | '미등록' | '확인 실패'>('확인 중...');
 const [isLoading, setIsLoading] = useState(false);
 const [isCreditRefreshing, setIsCreditRefreshing] = useState(false);
 const [message, setMessage] = useState('');
 const [activeModal, setActiveModal] = useState<ApiModalType>(null);
 const [remainingCredits, setRemainingCredits] = useState<number | null>(() => readStoredCredits(auth.currentUser?.uid));
 const [remainingCreditsUpdatedAt, setRemainingCreditsUpdatedAt] = useState<string | null>(() => readStoredCreditsUpdatedAt(auth.currentUser?.uid));

 const isMusicRegistered = statusText === '등록됨';

 const cacheRemainingCredits = (credits: number | null, updatedAt?: string | null) => {
 const resolvedUpdatedAt = credits === null ? null : (updatedAt || new Date().toISOString());
 setRemainingCredits(credits);
 setRemainingCreditsUpdatedAt(resolvedUpdatedAt);

 try {
 if (credits === null) {
 if (user?.uid) {
 localStorage.removeItem(scopedStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE, user.uid));
 localStorage.removeItem(scopedStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE, user.uid));
 }
 window.dispatchEvent(new CustomEvent('soridraw:suno-credits-updated', {
 detail: { remainingCredits: null, updatedAt: null }
 }));
 } else {
 const ms = resolvedUpdatedAt ? Date.parse(resolvedUpdatedAt) : Date.now();
 const resolvedMs = Number.isFinite(ms) ? ms : Date.now();
 if (user?.uid) {
 localStorage.setItem(scopedStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE, user.uid), String(credits));
 localStorage.setItem(scopedStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE, user.uid), String(resolvedMs));
 }
 window.dispatchEvent(new CustomEvent('soridraw:suno-credits-updated', {
 detail: { remainingCredits: credits, updatedAt: resolvedMs }
 }));
 }
 } catch {
 // localStorage may be unavailable.
 }
 };

 const formatCreditCheckedAt = (value: string | null) => {
 if (!value) return '';
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return '';
 return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
 };

 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
 setUser(currentUser);
 const storedGoogleKeyMeta = getStoredGoogleKeyMeta(currentUser?.uid);
 setGoogleRegistered(getStoredGoogleApiKeyStatus(currentUser?.uid) || Boolean(storedGoogleKeyMeta?.registered && storedGoogleKeyMeta.last6));
 setGoogleKeyMeta(storedGoogleKeyMeta);
 setRemainingCredits(readStoredCredits(currentUser?.uid));
 setRemainingCreditsUpdatedAt(readStoredCreditsUpdatedAt(currentUser?.uid));
 });
 return () => unsubscribe();
 }, []);

 const loadSunoApiKeyStatus = useCallback(async (isRetry = false) => {
 if (!user) return;

 if (!isRetry) {
 const cached = localStorage.getItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
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

 if (res.ok && result && (result.hasSunoApiKey || result.hasMusicApiKey || result.registered || result.hasApiKey || result.exists)) {
 setStatusText('등록됨');
 localStorage.setItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
 if (typeof result.sunoRemainingCredits === 'number') {
 cacheRemainingCredits(result.sunoRemainingCredits, result.sunoRemainingCreditsUpdatedAt || null);
 }
 } else if (res.ok) {
 setStatusText('미등록');
 localStorage.removeItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 cacheRemainingCredits(null);
 } else if (isRetry) {
 console.warn('Failed to load API key status after save/delete (server error)');
 } else {
 const cached = localStorage.getItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 if (cached !== 'true') setStatusText('확인 실패');
 }
 } catch (e) {
 if (isRetry) {
 console.warn('Failed to load API key status after save/delete:', e);
 } else {
 const cached = localStorage.getItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 if (cached !== 'true') setStatusText('확인 실패');
 }
 }
 }, [user]);

 const loadGoogleApiKeyStatus = useCallback(async (isRetry = false) => {
 if (!user) return;

 const cachedRegistered = getStoredGoogleApiKeyStatus(user.uid);
 const cachedMeta = getStoredGoogleKeyMeta(user.uid);
 const remoteVersion = Number(googleGeminiApiKeyVersion || 0);
 const cacheVersionMatches = remoteVersion <= 0 || Number(cachedMeta?.version || 0) === remoteVersion;
 if (!isRetry && cachedMeta && cacheVersionMatches) {
 if (cachedMeta.registered && cachedMeta.last6) {
 setGoogleRegistered(true);
 setGoogleKeyMeta(cachedMeta);
 markCacheDiagnostic('googleGeminiApiKey', 'CACHE', 0);
 return;
 }
 if (!cachedMeta.registered) {
 setGoogleRegistered(false);
 setGoogleKeyMeta(cachedMeta);
 markCacheDiagnostic('googleGeminiApiKey', 'CACHE', 0);
 return;
 }
 }

 if (!isRetry) {
 setGoogleRegistered(cachedRegistered);
 setGoogleKeyMeta(cachedMeta);
 }

 markCacheDiagnostic('googleGeminiApiKey', 'SYNC', 1);
 try {
 const token = await user.getIdToken();
 const appCheckToken = await getFirebaseAppCheckToken();
 const res = await fetch(`${BASE_URL}/getGoogleGeminiApiKeyStatus`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "Authorization": `Bearer ${token}`,
 ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {})
 },
 body: JSON.stringify({})
 });
 const result = await res.json();

 if (res.ok && result?.ok && result.hasGoogleGeminiApiKey) {
 setGoogleRegistered(true);
 const storedGoogleKeyMeta = getStoredGoogleKeyMeta(user.uid);
 const nextGoogleKeyMeta = String(result.keyLast6 || '').trim()
 ? { registered: true, last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null, version: Number(result.syncVersion || googleGeminiApiKeyVersion || storedGoogleKeyMeta?.version || 0) }
 : storedGoogleKeyMeta;
 setGoogleKeyMeta(nextGoogleKeyMeta);
 if (nextGoogleKeyMeta?.last6) {
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);
 }
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), nextGoogleKeyMeta?.last6 ? `true|${nextGoogleKeyMeta.last6}` : 'true');
 } else if (res.ok) {
 setGoogleRegistered(false);
 const emptyGoogleKeyMeta: GoogleKeyMeta = { registered: false, last6: '', updatedAt: result?.updatedAt || null, version: Number(result?.syncVersion || googleGeminiApiKeyVersion || 0) };
 setGoogleKeyMeta(emptyGoogleKeyMeta);
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(emptyGoogleKeyMeta));
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid));
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 } else if (!isRetry) {
 setGoogleRegistered(getStoredGoogleApiKeyStatus(user.uid));
 }
 } catch (e) {
 if (!isRetry) setGoogleRegistered(getStoredGoogleApiKeyStatus(user.uid));
 }
 }, [user, googleGeminiApiKeyVersion]);

 const saveGoogleApiKey = async () => {
 if (!googleApiKey.trim() || !user) return;
 setIsLoading(true);
 setMessage('');
 try {
 const token = await user.getIdToken();
 const appCheckToken = await getFirebaseAppCheckToken();
 const res = await fetch(`${BASE_URL}/saveGoogleGeminiApiKey`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "Authorization": `Bearer ${token}`,
 ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {})
 },
 body: JSON.stringify({ apiKey: googleApiKey.trim() })
 });
 const result = await res.json();

 if (res.ok && result?.ok) {
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
 setGoogleRegistered(true);
 const nextGoogleKeyMeta: GoogleKeyMeta = { registered: true, last6: String(result?.keyLast6 || googleApiKey.trim()).slice(-6), updatedAt: new Date().toISOString(), version: Number(result?.syncVersion || googleGeminiApiKeyVersion || Date.now()) };
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), `true|${nextGoogleKeyMeta.last6}`);
 setGoogleKeyMeta(nextGoogleKeyMeta);
 setGoogleApiKey('');
 setActiveModal(null);
 setMessage('Google Gemini API Key가 현재 계정 기준으로 서버에 저장되었습니다. 같은 아이디로 로그인하면 다른 환경에서도 사용할 수 있습니다.');
 } else {
 setMessage(result?.error || 'Google API Key 저장에 실패했습니다.');
 }
 } catch {
 setMessage('Google API Key 저장에 실패했습니다.');
 } finally {
 setIsLoading(false);
 }
 };

 const deleteGoogleApiKey = async () => {
 if (!user) return;
 setIsLoading(true);
 setMessage('');
 try {
 const token = await user.getIdToken();
 const appCheckToken = await getFirebaseAppCheckToken();
 const res = await fetch(`${BASE_URL}/deleteGoogleGeminiApiKey`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "Authorization": `Bearer ${token}`,
 ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {})
 },
 body: JSON.stringify({})
 });
 const result = await res.json();

 if (res.ok && result?.ok) {
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 setGoogleRegistered(false);
 setGoogleApiKey('');
 const deletedGoogleKeyMeta: GoogleKeyMeta = { registered: false, last6: '', updatedAt: new Date().toISOString(), version: Number(result?.syncVersion || googleGeminiApiKeyVersion || Date.now()) };
 setGoogleKeyMeta(deletedGoogleKeyMeta);
 localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(deletedGoogleKeyMeta));
 localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid));
 setActiveModal(null);
 setMessage('Google Gemini API Key가 삭제되었습니다.');
 } else {
 setMessage(result?.error || 'Google API Key 삭제에 실패했습니다.');
 }
 } catch {
 setMessage('Google API Key 삭제에 실패했습니다.');
 } finally {
 setIsLoading(false);
 }
 };

 const saveSunoApiKey = async () => {
 if (!musicApiKey.trim() || !user) return;
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
 body: JSON.stringify({ apiKey: musicApiKey.trim() })
 });
 const result = await res.json();

 if (res.ok && result.ok) {
 setStatusText('등록됨');
 localStorage.setItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
 cacheRemainingCredits(null);
 setMusicApiKey('');
 setActiveModal(null);
 setMessage('Music API Key가 안전하게 등록되었습니다.');
 loadSunoApiKeyStatus(true);
 } else {
 setMessage('Music API Key 저장에 실패했습니다.');
 }
 } catch (e) {
 console.error('Failed to save API key:', e);
 setMessage('Music API Key 저장에 실패했습니다.');
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
 localStorage.removeItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
 cacheRemainingCredits(null);
 setMusicApiKey('');
 setActiveModal(null);
 setMessage('Music API Key가 삭제되었습니다.');
 loadSunoApiKeyStatus(true);
 } else {
 setMessage('Music API Key 삭제에 실패했습니다.');
 }
 } catch (e) {
 console.error('Failed to delete API key:', e);
 setMessage('Music API Key 삭제에 실패했습니다.');
 } finally {
 setIsLoading(false);
 }
 };

 const refreshSunoRemainingCredits = async () => {
 if (!user || !isMusicRegistered) return;
 setIsCreditRefreshing(true);
 setMessage('');

 try {
 const token = await user.getIdToken();
 const res = await fetch(`${BASE_URL}/getSunoRemainingCredits`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "Authorization": `Bearer ${token}`
 },
 body: JSON.stringify({ source: 'settings-manual' })
 });
 const result = await res.json();

 if (res.ok && result?.ok && typeof result.remainingCredits === 'number') {
 cacheRemainingCredits(result.remainingCredits, result.checkedAt || new Date().toISOString());
 setMessage('Music API 남은 크레딧을 새로 확인했습니다.');
 } else {
 setMessage(getMusicApiErrorMessage(result));
 }
 } catch (e) {
 console.error('Failed to refresh Suno remaining credits:', e);
 setMessage('Music API 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
 } finally {
 setIsCreditRefreshing(false);
 }
 };

 useEffect(() => {
 loadGoogleApiKeyStatus(false);
 loadSunoApiKeyStatus(false);
 }, [loadGoogleApiKeyStatus, loadSunoApiKeyStatus]);

 const openGoogleApiModal = () => {
 const storedGoogleKeyMeta = getStoredGoogleKeyMeta(user?.uid);
 if (storedGoogleKeyMeta?.last6) {
 setGoogleKeyMeta(storedGoogleKeyMeta);
 setGoogleRegistered(true);
 }
 setActiveModal('google');
 };

 const StatusBadge = ({ registered, pending = false }: { registered: boolean; pending?: boolean }) => (
 <div className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-black ${
 registered ? 'bg-emerald-500/10 text-emerald-300' : pending ? 'bg-white/10 text-white/50' : 'bg-rose-500/10 text-rose-300'
 }`}>
 {registered ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : pending ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
 {registered ? '등록됨' : pending ? '확인 중' : '미등록'}
 </div>
 );

 return (
 <motion.section
 initial={false}
 animate={{ opacity: 1, y: 0 }}
 className={`rounded-[28px] bg-gradient-to-br from-[#24191f]/95 via-[#181824]/95 to-[#11161f]/95 p-5 md:p-6 shadow-2xl backdrop-blur-xl ${className}`}
 >
 {showHeader && (
 <div className="mb-5">
 <h2 className="flex items-center gap-2 text-lg font-black"><Key className="w-5 h-5 text-[#ff8fb4]" /> API 연결</h2>
 <p className="mt-1 text-sm text-white/56">Google API와 Music API를 구분해서 관리합니다.</p>
 </div>
 )}
 <CacheDiagnosticBadge domain="googleGeminiApiKey" readLabel="조회" className="mb-3 ml-1" />

 <div className="rounded-[22px] bg-gradient-to-r from-[#ff5f9f]/12 to-[#ffb400]/8 p-4 text-sm leading-relaxed text-white/64">
 <b className="text-[#ff8fb4]">Google Gemini API</b>는 가사/프롬프트 생성에 사용되고, <b className="text-[#c9a6ff]">Music API</b>는 음원 생성 및 크레딧 확인에 사용됩니다. SORIDRAW 플랜은 API 비용이 아니라 편의 기능과 고급 기능을 여는 구조입니다.
 </div>

 <div className="mt-4 grid gap-4">
 <div className="rounded-[24px] bg-gradient-to-br from-[#ff5f9f]/14 to-[#ffb400]/7 p-4 shadow-lg shadow-[#ff5f9f]/8">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-[#ff8fb4]" />
 <h3 className="text-base font-black text-white">Google Gemini API</h3>
 </div>
 <p className="mt-2 text-xs leading-relaxed text-white/45">가사, 프롬프트, 번역, 보정 같은 텍스트 생성에 사용됩니다.</p>
 </div>
 <StatusBadge registered={googleRegistered} />
 </div>
 <div className="mt-4 flex flex-col gap-2 sm:flex-row">
 <a href={GOOGLE_API_CREATE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ff5f9f]/12 px-3 py-2.5 text-xs font-black text-[#ff8fb4] transition hover:bg-[#ff5f9f]/20">
 API Key 생성 <ExternalLink className="h-3.5 w-3.5" />
 </a>
 <button type="button" onClick={openGoogleApiModal} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/[0.07] hover:text-white">
 API Key 입력/변경
 </button>
 </div>
 </div>

 <div className="rounded-[24px] bg-gradient-to-br from-[#b990ff]/15 to-[#4fc3ff]/7 p-4 shadow-lg shadow-[#b990ff]/8">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <Music2 className="h-5 w-5 text-[#c9a6ff]" />
 <h3 className="text-base font-black text-white">Music API</h3>
 </div>
 <p className="mt-2 text-xs leading-relaxed text-white/45">Suno 기반 음원 생성, 생성 완료 후 남은 크레딧 확인에 사용됩니다.</p>
 </div>
 <StatusBadge registered={isMusicRegistered} pending={statusText === '확인 중...'} />
 </div>
 <div className="mt-4 rounded-[20px] bg-black/20 p-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-xs font-bold text-white/45">남은 크레딧</div>
 <div className="mt-1 text-xl font-black text-[#c9a6ff]">{remainingCredits === null ? '-' : remainingCredits.toLocaleString()}</div>
 </div>
 <button
 type="button"
 onClick={refreshSunoRemainingCredits}
 disabled={!isMusicRegistered || isCreditRefreshing}
 className="shrink-0 rounded-xl bg-[#b990ff]/12 px-3 py-2 text-xs font-bold text-[#c9a6ff] hover:bg-[#b990ff]/20 transition-all disabled:cursor-not-allowed disabled:opacity-40 flex items-center gap-2"
 >
 <RefreshCw className={`w-3.5 h-3.5 ${isCreditRefreshing ? 'animate-spin' : ''}`} />
 새로고침
 </button>
 </div>
 {remainingCreditsUpdatedAt && <div className="mt-2 text-[11px] text-white/35">{formatCreditCheckedAt(remainingCreditsUpdatedAt)} 확인</div>}
 </div>
 <div className="mt-4 flex flex-col gap-2 sm:flex-row">
 <a href={MUSIC_API_CREATE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#b990ff]/12 px-3 py-2.5 text-xs font-black text-[#c9a6ff] transition hover:bg-[#b990ff]/20">
 API Key 생성 <ExternalLink className="h-3.5 w-3.5" />
 </a>
 <button type="button" onClick={() => setActiveModal('music')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/[0.07] hover:text-white">
 API Key 입력/변경
 </button>
 </div>
 </div>
 </div>

 <div className="mt-4 rounded-[22px] bg-white/[0.045] p-4 text-sm text-white/58">
 <div className="mb-2 flex items-center gap-2 font-black text-[#ff8fb4]">
 <AlertTriangle className="w-4 h-4" /> 사용 안내
 </div>
 <ul className="list-disc list-inside space-y-1">
 <li>Google Gemini API 비용은 사용자의 Google 계정 기준으로 처리됩니다.</li>
 <li>Music API 생성 비용은 입력한 개인 Music API Key의 크레딧에서 차감됩니다.</li>
 <li>음원 파일은 앱 서버에 저장되지 않습니다.</li>
 </ul>
 </div>

 {message && (
 <div className="mt-4 rounded-2xl bg-[#ff5f9f]/[0.06] px-4 py-3 text-center text-sm font-bold text-[#ff8fb4]">
 {message}
 </div>
 )}

 {activeModal === 'google' && (
 <ApiKeyModal
 type="google"
 title="Google Gemini API Key"
 description="가사/프롬프트 생성을 위한 개인 Google API Key"
 guideText="Google AI Studio에서 새 승인(Auth) API Key를 발급받아 입력합니다. 기존 Standard 키도 당분간 사용할 수 있지만 Google 공지에 따라 2026년 9월부터 거부될 예정이므로 새 승인 키로 교체해야 합니다. 키 원문은 브라우저에 저장되지 않고 로그인 계정의 Firebase 서버 보관소에 저장되며, Gemini 호출도 서버에서 실행됩니다."
 createUrl={GOOGLE_API_CREATE_URL}
 inputValue={googleApiKey}
 setInputValue={setGoogleApiKey}
 isRegistered={googleRegistered}
 isLoading={isLoading}
 googleKeyMeta={googleKeyMeta}
 onClose={() => setActiveModal(null)}
 onSave={saveGoogleApiKey}
 onDelete={deleteGoogleApiKey}
 />
 )}

 {activeModal === 'music' && (
 <ApiKeyModal
 type="music"
 title="Music API Key"
 description="Suno 음원 생성을 위한 개인 Music API Key"
 guideText="Music API 사이트에서 API Key를 발급받아 입력합니다. 저장된 키는 서버 함수로 전달되어 음원 생성과 크레딧 확인에 사용됩니다."
 createUrl={MUSIC_API_CREATE_URL}
 inputValue={musicApiKey}
 setInputValue={setMusicApiKey}
 isRegistered={isMusicRegistered}
 isLoading={isLoading}
 onClose={() => setActiveModal(null)}
 onSave={saveSunoApiKey}
 onDelete={deleteSunoApiKey}
 />
 )}
 </motion.section>
 );
}
