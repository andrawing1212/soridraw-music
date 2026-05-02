import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface SunoTrackDetailModalProps {
  open: boolean;
  track: any | null;
  onClose: () => void;
}

const normalizeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(', ');
  }
  return '';
};

const firstText = (...values: any[]): string => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
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
  const ownerUid = String(parent?.ownerUid || track?.ownerUid || parent?.uid || track?.uid || '');
  const candidates = [
    track?.creatorDisplayId,
    track?.ownerNickname,
    track?.creatorNickname,
    track?.ownerName,
    track?.creatorName,
    track?.ownerDisplayName,
    track?.displayName,
    parent?.creatorDisplayId,
    parent?.ownerNickname,
    parent?.creatorNickname,
    parent?.ownerName,
    parent?.creatorName,
    parent?.ownerDisplayName,
    parent?.displayName,
    parent?.shareData?.creatorDisplayId,
    parent?.shareData?.ownerNickname,
    parent?.shareData?.creatorNickname,
    parent?.shareData?.ownerName,
    parent?.ownerEmail,
    parent?.creatorEmail,
    track?.ownerEmail,
    track?.creatorEmail,
  ];

  for (const value of candidates) {
    const text = normalizeText(value);
    if (!text) continue;
    if (text === ownerUid) continue;
    if (text.startsWith('·GENRE:') || text.startsWith('GENRE:')) continue;
    if (!text.includes('@') && /^[A-Za-z0-9_-]{20,}$/.test(text)) continue;
    return text;
  }

  return '원곡자 정보 없음';
};


export default function SunoTrackDetailModal({ open, track, onClose }: SunoTrackDetailModalProps) {
  const parent = track?.parent || {};
  const displayTrack = track || {};
  const requestPayload = displayTrack?.requestPayload || parent?.requestPayload || {};

  const title = firstText(displayTrack?.title, parent?.title, displayTrack?.name, parent?.name) || 'Untitled';
  const status = firstText(displayTrack?.status, parent?.status) || 'Completed';
  const createdAt = displayTrack?.createdAt || parent?.createdAt || displayTrack?.completedAt || parent?.completedAt;
  const taskId = firstText(displayTrack?.taskId, parent?.taskId, displayTrack?.id, parent?.id, displayTrack?.trackId, parent?.trackId) || '정보 없음';
  const model = firstText(requestPayload?.model, displayTrack?.sunoVersion, parent?.sunoVersion, displayTrack?.model, parent?.model) || 'V5_5';
  const audioUrl = firstText(displayTrack?.audioUrl, displayTrack?.streamAudioUrl, displayTrack?.url, parent?.audioUrl, parent?.streamAudioUrl, parent?.url) || '정보 없음';

  return (
    <AnimatePresence>
      {open && track && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-[var(--bg-secondary)] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-xl font-bold">상세 정보</h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-all"
              >
                <X className="w-6 h-6 opacity-40" />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <DetailItem label="제목" value={title} />
                <DetailItem label="상태" value={status} isStatus />
                <DetailItem label="제작자" value={getCreator(displayTrack)} />
                <DetailItem label="생성일" value={formatCreatedAt(createdAt)} />
                <DetailItem label="Task ID" value={taskId} isMono />
                <DetailItem label="Suno Version" value={model} />
                <DetailItem label="키워드/스타일" value={extractStyle(displayTrack)} full />
                <DetailItem label="가사" value={extractLyrics(displayTrack)} full isPre />
                <DetailItem label="오디오 URL" value={audioUrl} full isMono />
              </div>
            </div>
            <div className="p-6 border-t border-white/5 text-center">
              <button
                onClick={onClose}
                className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition-all"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DetailItem({ label, value, full = false, isStatus = false, isMono = false, isPre = false }: any) {
  const normalizedValue = value || 'N/A';
  return (
    <div className={`${full ? 'col-span-2' : 'col-span-1'} space-y-1.5`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-30">{label}</span>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/5 text-sm ${isMono ? 'font-mono break-all' : ''}`}>
        {isStatus ? (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${String(normalizedValue).toLowerCase() === 'completed' ? 'bg-green-500' : String(normalizedValue).toLowerCase() === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
            <span className="capitalize">{normalizedValue}</span>
          </div>
        ) : isPre ? (
          <pre className="whitespace-pre-wrap font-sans leading-relaxed opacity-70 italic">{normalizedValue}</pre>
        ) : (
          <span className="opacity-80">{normalizedValue}</span>
        )}
      </div>
    </div>
  );
}
