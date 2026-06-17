import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';

interface SunoTrackDetailModalProps {
  open: boolean;
  track: any | null;
  onClose: () => void;
  onEdit?: (track: any) => void;
}

const LIB_ACCENT = '#877198';
const LIB_ACCENT_SOFT = '#BBA8CA';

const normalizeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(', ');
  return '';
};

const firstText = (...values: any[]): string => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
};

const safeCreatorText = (value: any, ownerUid?: string): string => {
  const text = normalizeText(value);
  if (!text) return '';
  if (ownerUid && text === ownerUid) return '';
  if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) return '';
  if (text.startsWith('·GENRE:') || text.startsWith('GENRE:')) return '';
  return text;
};

const formatCreatedAt = (timestamp: any): string => {
  if (!timestamp) return '정보 없음';
  try {
    let date: Date;
    if (timestamp?.toDate) date = timestamp.toDate();
    else if (timestamp instanceof Date) date = timestamp;
    else if (typeof timestamp === 'number') date = new Date(timestamp);
    else date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '정보 없음';
    return date.toLocaleString('ko-KR');
  } catch {
    return '정보 없음';
  }
};

const extractLyrics = (track: any): string => {
  const parent = track?.parent || {};
  const applied = track?.appliedKeywords || parent?.appliedKeywords || {};
  const requestPayload = track?.requestPayload || parent?.requestPayload || {};
  const direct = firstText(
    track?.lyrics,
    track?.lyricsText,
    track?.lyric,
    track?.koreanLyrics,
    track?.englishLyrics,
    track?.lyrics?.korean,
    track?.lyrics?.ko,
    track?.lyrics?.english,
    track?.lyrics?.en,
    track?.lyrics?.japanese,
    track?.lyrics?.ja,
    parent?.lyrics,
    parent?.lyricsText,
    parent?.lyric,
    parent?.koreanLyrics,
    parent?.englishLyrics,
    parent?.lyrics?.korean,
    parent?.lyrics?.ko,
    parent?.lyrics?.english,
    parent?.lyrics?.en,
    parent?.lyrics?.japanese,
    parent?.lyrics?.ja,
    requestPayload?.lyrics,
    requestPayload?.lyricsText,
    applied?.lyrics,
    applied?.lyricsText,
    applied?.koreanLyrics,
    applied?.englishLyrics,
    applied?.generatedLyrics,
    applied?.generatedLyricsText
  );
  return direct || '가사 정보 없음';
};

const extractStyle = (track: any): string => {
  const parent = track?.parent || {};
  const applied = track?.appliedKeywords || parent?.appliedKeywords || {};
  const requestPayload = track?.requestPayload || parent?.requestPayload || {};
  const direct = firstText(
    track?.style,
    track?.prompt,
    track?.musicPrompt,
    parent?.style,
    parent?.prompt,
    parent?.musicPrompt,
    requestPayload?.style,
    requestPayload?.prompt,
    requestPayload?.musicPrompt,
    applied?.style,
    applied?.sound,
    applied?.mood,
    applied?.theme
  );
  return direct || '없음';
};

const getCreator = (track: any): string => {
  const parent = track?.parent || {};
  const user = auth.currentUser;
  const ownerUid = String(track?.ownerUid || parent?.ownerUid || track?.uid || parent?.uid || '');
  const candidates = [
    track?.artist,
    track?.artistName,
    track?.author,
    track?.uploaderName,
    track?.creatorDisplayId,
    track?.ownerNickname,
    track?.creatorNickname,
    track?.ownerName,
    track?.creatorName,
    track?.ownerDisplayName,
    track?.createdByName,
    track?.userName,
    parent?.artist,
    parent?.artistName,
    parent?.author,
    parent?.uploaderName,
    parent?.creatorDisplayId,
    parent?.ownerNickname,
    parent?.creatorNickname,
    parent?.ownerName,
    parent?.creatorName,
    parent?.ownerDisplayName,
    parent?.createdByName,
    parent?.userName,
    parent?.shareData?.creatorDisplayId,
    parent?.shareData?.ownerNickname,
    parent?.shareData?.creatorNickname,
    parent?.shareData?.ownerName,
    parent?.shareData?.creatorName,
    track?.ownerEmail,
    track?.creatorEmail,
    parent?.ownerEmail,
    parent?.creatorEmail,
  ];

  for (const value of candidates) {
    const text = safeCreatorText(value, ownerUid);
    if (text) return text;
  }

  const fallback = safeCreatorText(user?.displayName, ownerUid) || safeCreatorText(user?.email, ownerUid);
  if (fallback) return fallback;

  return '원곡자 정보 없음';
};

const getSubValue = (track: any, key: string): string => {
  const parent = track?.parent || {};
  const item = track?.item || track?.sourceItem || {};
  return firstText(track?.[key], item?.[key], parent?.[key]);
};

export default function SunoTrackDetailModal({ open, track, onClose, onEdit }: SunoTrackDetailModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const parent = track?.parent || {};
  const displayTrack = track || {};
  const requestPayload = displayTrack?.requestPayload || parent?.requestPayload || {};

  const title = firstText(displayTrack?.title, parent?.title, displayTrack?.name, parent?.name) || 'Untitled';
  const status = firstText(displayTrack?.status, parent?.status) || 'Completed';
  const createdAt = displayTrack?.createdAt || parent?.createdAt || displayTrack?.completedAt || parent?.completedAt || displayTrack?.addedAt;
  const taskId = firstText(displayTrack?.taskId, parent?.taskId, displayTrack?.id, parent?.id, displayTrack?.trackId, parent?.trackId) || '정보 없음';
  const model = firstText(requestPayload?.model, displayTrack?.sunoVersion, parent?.sunoVersion, displayTrack?.model, parent?.model, displayTrack?.version, parent?.version) || '정보 없음';
  const audioUrl = firstText(displayTrack?.audioUrl, displayTrack?.streamAudioUrl, displayTrack?.url, parent?.audioUrl, parent?.streamAudioUrl, parent?.url) || '정보 없음';
  const imageUrl = firstText(displayTrack?.imageUrl, displayTrack?.coverUrl, displayTrack?.sourceImageUrl, parent?.imageUrl, parent?.coverUrl, parent?.sourceImageUrl) || '';
  const duration = firstText(displayTrack?.duration, parent?.duration) || '';
  const lyrics = extractLyrics(displayTrack);
  const style = extractStyle(displayTrack);
  const prompt = firstText(displayTrack?.prompt, parent?.prompt, displayTrack?.musicPrompt, parent?.musicPrompt, requestPayload?.prompt, requestPayload?.style) || style;
  const creator = getCreator(displayTrack);

  const metaItems = useMemo(() => [
    { label: '상태', value: status, type: 'status' },
    { label: '제작자', value: creator },
    { label: '생성일', value: formatCreatedAt(createdAt) },
    { label: 'Task ID', value: taskId, mono: true },
    { label: '버전', value: model },
    { label: '길이', value: duration || '정보 없음' },
    { label: 'URL', value: audioUrl, mono: true, full: true },
    ...(imageUrl ? [{ label: '커버 URL', value: imageUrl, mono: true, full: true }] : []),
  ], [status, creator, createdAt, taskId, model, duration, audioUrl, imageUrl]);

  const copyToClipboard = async (key: string, value: string) => {
    if (!value || value === '정보 없음' || value === 'N/A') return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1300);
  };

  return (
    <AnimatePresence>
      {open && track && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 py-6" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[34px] border border-[#877198]/28 bg-[#171719]/96 shadow-[0_30px_90px_rgba(0,0,0,0.52)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-white/8 bg-[radial-gradient(circle_at_12%_0%,rgba(135,113,152,0.22),transparent_38%),linear-gradient(135deg,rgba(20,20,21,0.98),rgba(24,22,26,0.98))] px-6 py-5 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.34em] text-[#BBA8CA]">LIBRARY DETAIL</div>
                  <h3 className="mt-2 text-[28px] font-black tracking-tight text-white md:text-[36px]">디테일</h3>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(displayTrack)}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#8A4EAD]/35 bg-[#8A4EAD]/10 text-[#A567CF] shadow-[0_0_16px_rgba(138,78,173,0.14)] transition-all hover:bg-[#8A4EAD]/16 hover:border-[#A567CF]/50 hover:text-[#C084F5]"
                      aria-label="다음곡에 적용"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </button>
                  )}
                  <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/55 transition-all hover:bg-white/[0.06] hover:text-white">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="custom-scrollbar overflow-y-auto px-6 py-7 md:px-8 space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5 md:p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  {imageUrl && (
                    <img src={imageUrl} alt="cover" className="h-28 w-28 rounded-3xl object-cover shadow-[0_18px_60px_rgba(0,0,0,0.38)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black uppercase tracking-[0.30em] text-[#BBA8CA]">TITLE</div>
                    <h4 className="mt-2 break-keep text-[24px] font-black leading-tight text-white md:text-[32px]">{title}</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#877198]/30 bg-[#877198]/13 px-3 py-1 text-xs font-bold text-[#DCCDEA]">{status}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">{formatCreatedAt(createdAt)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.30em] text-[#BBA8CA]">INFO SET</div>
                    <h4 className="mt-1 text-[22px] font-black text-white">상세 정보</h4>
                  </div>
                  <button
                    onClick={() => copyToClipboard('all-meta', metaItems.map((item) => `${item.label}: ${item.value}`).join('\n'))}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/60 hover:text-[#DCCDEA]"
                  >
                    {copiedKey === 'all-meta' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    정보 복사
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {metaItems.map((item) => (
                    <DetailItem
                      key={item.label}
                      {...item}
                    />
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DetailTextCard title="프롬프트 / 스타일" label="PROMPT" value={prompt} copied={copiedKey === 'prompt'} onCopy={() => copyToClipboard('prompt', prompt)} />
                <DetailTextCard title="가사" label="LYRICS" value={lyrics} copied={copiedKey === 'lyrics'} onCopy={() => copyToClipboard('lyrics', lyrics)} />
              </div>
            </div>

            <div className="border-t border-white/8 bg-[#151516]/96 px-6 py-5 text-center">
              <button onClick={onClose} className="h-12 rounded-2xl bg-white/[0.06] px-9 text-sm font-black text-white/86 transition-all hover:bg-white/[0.09]">
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DetailItem({ label, value, full = false, type, mono = false }: any) {
  const normalizedValue = value || 'N/A';
  const statusText = String(normalizedValue).toLowerCase();
  const dotClass = statusText.includes('complete') || statusText.includes('완료') || statusText.includes('일반') || statusText.includes('공유')
    ? 'bg-emerald-400'
    : statusText.includes('fail') || statusText.includes('error')
      ? 'bg-red-400'
      : 'bg-[#BBA8CA] animate-pulse';

  return (
    <div className={`${full ? 'md:col-span-2' : ''} rounded-2xl border border-white/8 bg-black/12 p-4`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.26em] text-[#BBA8CA]/72">{label}</span>
      </div>
      {type === 'status' ? (
        <div className="flex items-center gap-2 text-sm font-bold text-white/82">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span>{normalizedValue}</span>
        </div>
      ) : (
        <div className={`text-sm leading-relaxed text-white/72 ${mono ? 'break-all font-mono text-[12px]' : ''}`}>{normalizedValue}</div>
      )}
    </div>
  );
}

function DetailTextCard({ title, label, value, copied, onCopy }: any) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.30em] text-[#BBA8CA]">{label}</div>
          <h4 className="mt-1 text-[22px] font-black text-white">{title}</h4>
        </div>
        <button onClick={onCopy} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/55 transition-all hover:text-[#DCCDEA]">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="custom-scrollbar max-h-[360px] overflow-y-auto rounded-2xl border border-white/8 bg-black/14 p-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/72">{value || '정보 없음'}</pre>
      </div>
    </section>
  );
}
