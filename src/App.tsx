import React, { useState, useEffect, useLayoutEffect, useRef, Component, useCallback, useMemo, lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate,
  useLocation,
  Navigate
} from 'react-router-dom';
import { 
  Music, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  Search, 
  X, 
  Info,
  Languages,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Trash2,
  History,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Shuffle,
  Dices,
  Menu,
  Home as HomeIcon,
  Heart as HeartIcon,
  User as UserIcon,
  Heart,
  AlertCircle,
  Lock,
  Unlock,
  Edit2,
  Filter,
  RefreshCw,
  CheckCircle2,
  Mic2,
  Tag,
  Users,
  Shield,
  Settings,
  Play,
  ThumbsUp,
  LogOut,
  ThumbsDown,
  Youtube as YoutubeIcon,
  ExternalLink,
  Zap,
  Key,
  Bookmark,
  Library
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

// Portal component for top-level rendering
function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}


const isDocumentFullscreenActive = () => {
  if (typeof document === 'undefined') return false;
  const webkitFullscreenElement = (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
  return Boolean(document.fullscreenElement || webkitFullscreenElement);
};

const SORIDRAW_CLOSE_STUDIO_MODALS_EVENT = 'soridraw:close-studio-modals';

const CUSTOM_MOOD_PREFIX = '__custom_mood__:';
const CUSTOM_THEME_PREFIX = '__custom_theme__:';

const makeCustomKeywordId = (prefix: string, text: string) => `${prefix}${encodeURIComponent(text.trim())}`;

const getCustomKeywordText = (id: string, prefix: string) => {
  if (!id.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(id.slice(prefix.length)).trim();
  } catch {
    return id.slice(prefix.length).trim();
  }
};

const isCustomMoodKeyword = (id: string) => getCustomKeywordText(id, CUSTOM_MOOD_PREFIX) !== null;
const isCustomThemeKeyword = (id: string) => getCustomKeywordText(id, CUSTOM_THEME_PREFIX) !== null;
const getMoodKeywordLabel = (id: string) => getCustomKeywordText(id, CUSTOM_MOOD_PREFIX) || MOODS.find((item) => item.id === id)?.labelKo || MOODS.find((item) => item.id === id)?.label || id;
const getThemeKeywordLabel = (id: string) => getCustomKeywordText(id, CUSTOM_THEME_PREFIX) || THEMES.find((item) => item.id === id)?.labelKo || THEMES.find((item) => item.id === id)?.label || id;


type VocalEmotionLine = {
  id: string;
  labelKo: string;
  label: string;
  descriptionKo: string;
  promptCore: string;
  promptShort: string;
  group: string;
};

const VOCAL_EMOTION_LINES: VocalEmotionLine[] = [
  { id: 'emotion_smiling_hidden_pain', group: '숨기는 아픔', labelKo: '아무렇지 않은 척하지만 속으로 우는', label: 'Smiling through pain', descriptionKo: '겉으로는 웃거나 평온해 보이지만, 내면은 슬픔과 상처로 곪아 있어 위태로운 감정 상태입니다.', promptCore: 'smiling through pain, crying inside, emotionally wounded underneath', promptShort: 'smiling through hidden pain' },
  { id: 'emotion_resentful_lingering', group: '미련과 원망', labelKo: '원망스럽지만 여전히 미련이 남은', label: 'Resentful but still clinging', descriptionKo: '상대가 밉고 화가 나면서도 끝내 다 놓지 못해 미련과 그리움이 질척이게 남아있는 상태입니다.', promptCore: 'resentful but still clinging to lingering feelings, angry yet unable to let go', promptShort: 'resentful but still longing' },
  { id: 'emotion_resigned_empty', group: '체념과 공허', labelKo: '모든 것을 체념하고 텅 빈', label: 'Numb and empty', descriptionKo: '슬픔이나 분노마저 다 지나가 버려 어떤 기대나 희망도 없이 마음이 무감각하고 공허해진 상태입니다.', promptCore: 'completely resigned, numb and empty inside, no hope left', promptShort: 'numb and resigned' },
  { id: 'emotion_too_exhausted_to_anger', group: '체념과 공허', labelKo: '화낼 기력조차 없이 지쳐버린', label: 'Too exhausted to be angry', descriptionKo: '화가 나고 억울하지만 감정을 너무 많이 소모해서 더 이상 따질 힘조차 남아있지 않은 상태입니다.', promptCore: 'too exhausted to be angry, emotionally drained, no strength left to fight', promptShort: 'exhausted beyond anger' },
  { id: 'emotion_pushing_away_fear', group: '불안과 방어', labelKo: '상처받을까 두려워 먼저 차갑게 밀어내는', label: 'Pushing away out of fear', descriptionKo: '사실은 다가가고 싶지만 또 상처받는 것이 두려워 자기방어적으로 선을 긋고 냉정하게 구는 상태입니다.', promptCore: 'pushing away out of fear of getting hurt, guarded longing, defensive coldness', promptShort: 'pushing away out of fear' },
  { id: 'emotion_cold_suppressed_anger', group: '분노와 억제', labelKo: '터질 듯한 분노를 차갑게 억누르는', label: 'Coldly suppressed anger', descriptionKo: '당장이라도 폭발할 것 같은 거대한 분노를 품고 있지만, 이성을 붙잡고 싸늘하게 다스리는 상태입니다.', promptCore: 'coldly suppressing explosive anger, controlled rage, icy restraint', promptShort: 'coldly suppressed anger' },
  { id: 'emotion_abandonment_anxiety', group: '불안과 방어', labelKo: '버림받을까 봐 조마조마하고 불안한', label: 'Terrified of losing', descriptionKo: '겉으로는 태연해 보이려 하지만 상대방의 마음이 떠날까 봐 속으로 극도로 초조하고 불안한 상태입니다.', promptCore: 'anxious and terrified of losing, insecure attachment, fear of being left behind', promptShort: 'anxious fear of losing' },
  { id: 'emotion_awkward_sincere_approach', group: '진심과 다가감', labelKo: '어색하지만 진심을 다해 조심스럽게 다가가는', label: 'Awkward but sincere', descriptionKo: '표현이 서툴고 쑥스럽지만, 용기를 내어 진심을 조심스럽게 전하려는 상태입니다.', promptCore: 'awkward but sincerely and carefully approaching, clumsy honesty, careful affection', promptShort: 'awkward but sincere' },
  { id: 'emotion_bitter_regret_self_blame', group: '후회와 자책', labelKo: '지난날을 뼈저리게 후회하며 자책하는', label: 'Bitter regret and self-blame', descriptionKo: '되돌릴 수 없는 과거의 잘못이나 선택을 깊이 후회하며 스스로를 깎아내리고 원망하는 상태입니다.', promptCore: 'bitterly regretting and blaming oneself, painful remorse, self-directed guilt', promptShort: 'bitter regret and self-blame' },
  { id: 'emotion_secret_yearning', group: '숨기는 아픔', labelKo: '들킬까 봐 숨죽이며 애태우는', label: 'Secretly yearning', descriptionKo: '진짜 마음이 들통날까 봐 전전긍긍하며 혼자 속앓이를 하는 상태입니다.', promptCore: 'secretly yearning, painfully hiding true feelings, breath-held longing', promptShort: 'secret yearning held back' },
  { id: 'emotion_choked_gratitude', group: '벅찬 감정', labelKo: '벅찬 감동에 가슴이 메이는', label: 'Overwhelmed and choked up', descriptionKo: '큰 기쁨, 사랑, 위로를 받아 감정이 북받쳐 오르고 말을 잇지 못할 만큼 벅찬 상태입니다.', promptCore: 'overwhelmed with emotion, choked up with gratitude, heart-swelling tenderness', promptShort: 'overwhelmed and choked up' },
  { id: 'emotion_burden_released', group: '해방과 정리', labelKo: '오랜 짐을 벗어던지고 온전히 후련한', label: 'Free from a heavy burden', descriptionKo: '오랫동안 짓누르던 억압, 상처, 인연 등에서 벗어나 진정한 해방감과 자유를 느끼는 상태입니다.', promptCore: 'completely free, letting go of a heavy burden, cathartic release', promptShort: 'free from a heavy burden' },
];

const getVocalEmotionLine = (emotionIdOrLabel: string | undefined) => {
  if (!emotionIdOrLabel) return undefined;
  const normalized = emotionIdOrLabel.trim().toLowerCase();
  return VOCAL_EMOTION_LINES.find((item) =>
    item.id.toLowerCase() === normalized ||
    item.label.toLowerCase() === normalized ||
    item.labelKo.toLowerCase() === normalized
  );
};

const getVocalEmotionDisplayLabel = (emotionIdOrLabel: string | undefined) => {
  if (!emotionIdOrLabel) return '';
  const matched = getVocalEmotionLine(emotionIdOrLabel);
  return matched?.labelKo || emotionIdOrLabel;
};

const getVocalEmotionPromptValue = (emotionIdOrLabel: string | undefined) => {
  if (!emotionIdOrLabel) return undefined;
  const matched = getVocalEmotionLine(emotionIdOrLabel);
  return matched?.promptCore || emotionIdOrLabel;
};
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  GENRES,
  MOODS,
  THEMES,
  GENRE_GROUPS,
  GENRE_HIERARCHY,
  SOUND_STYLES,
  INSTRUMENT_SOUNDS,
  STYLE_CYCLES,
  SOUND_TEXTURE_CYCLES,
  STYLE_VARIANT_LOOKUP,
  STYLE_LABEL_TO_ID,
  SOUND_VARIANT_LOOKUP,
  SOUND_LABEL_TO_ID,
  ALLOWED_TAGS_BY_SECTION,
  TAG_DESCRIPTIONS,
  TAG_META,
  SECTION_META,
  TagTier,
  INSTRUMENTAL_SOLO_TAGS,
  INSTRUMENT_TAGS,
  INSTRUMENT_TAG_DESCRIPTIONS,
  VOCAL_TECHNIQUES,
  VOCAL_VOICE_TONES,
  VOCAL_PERSONALITIES
} from './constants';
import { VOCAL_TONES } from './constants/vocalTones';
import { CategoryItem, SongResult, LyricsLength, SongStructure, CustomSectionItem, VocalMode, VocalTone, VocalMember, VocalRole, SectionTag, UserRole, AccountStatus, SituationConfig, VocalSectionTagOption, UserCustomSectionDefinition, UserCustomSectionTagDefinition, CustomSectionKind } from './types';
import { PROMPT_TEMPLATES, PromptTemplate } from './constants/templates';
import { getResolvedGenre, getSubGenre, formatKoreanTitle, formatEnglishTitle, formatInlineTitle, resolveKeywordsForDisplay, formatDisplayTitle } from './lib/songUtils';



const USER_CUSTOM_SECTIONS_STORAGE_KEY = 'soridraw_user_custom_sections_v1';
const USER_CUSTOM_SECTION_TAGS_STORAGE_KEY = 'soridraw_user_custom_section_tags_v1';
const USER_SAVED_STRUCTURES_STORAGE_KEY = 'soridraw_saved_structures_v1';
const getSavedStructuresStorageKey = (uid?: string | null) => `${USER_SAVED_STRUCTURES_STORAGE_KEY}_${uid || 'guest'}`;

const safeReadJsonArray = <T,>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJsonArray = <T,>(key: string, value: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to write local custom data:', error);
  }
};

const sanitizeCustomLabel = (value: string) =>
  String(value || '')
    .replace(/[\[\]\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

const normalizeUserCustomSections = (input: any): UserCustomSectionDefinition[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const label = sanitizeCustomLabel(item?.label || item?.labelEn);
      if (!label) return null;
      const labelKo = sanitizeCustomLabel(item?.labelKo || item?.displayLabel || item?.label || '');
      const kind = ['vocal', 'rap', 'instrumental', 'transition', 'build', 'theme', 'other'].includes(item?.kind)
        ? item.kind as CustomSectionKind
        : 'other';
      const now = Date.now();
      const defaultTags = Array.isArray(item?.defaultTags)
        ? item.defaultTags.map((tag: any) => sanitizeCustomLabel(String(tag))).filter(Boolean).slice(0, 4)
        : [];
      return {
        id: String(item?.id || `custom_section_${now}_${Math.random().toString(36).slice(2, 7)}`),
        label,
        labelKo,
        tagCue: sanitizeCustomLabel(item?.tagCue || ''),
        promptFull: String(item?.promptFull || '').replace(/[\n\r]/g, ' ').trim().slice(0, 160),
        description: String(item?.description || '').replace(/[\n\r]/g, ' ').trim().slice(0, 120),
        kind,
        defaultTags,
        allowVocal: typeof item?.allowVocal === 'boolean' ? item.allowVocal : kind !== 'instrumental' && kind !== 'transition',
        isInstrumental: typeof item?.isInstrumental === 'boolean' ? item.isInstrumental : kind === 'instrumental',
        createdAt: Number(item?.createdAt || now),
        updatedAt: Number(item?.updatedAt || now),
      } as UserCustomSectionDefinition;
    })
    .filter((item): item is UserCustomSectionDefinition => Boolean(item));
};

const normalizeUserCustomSectionTags = (input: any): UserCustomSectionTagDefinition[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const label = sanitizeCustomLabel(item?.label);
      const section = sanitizeCustomLabel(item?.section);
      if (!label || !section) return null;
      const now = Date.now();
      return {
        id: String(item?.id || `custom_tag_${now}_${Math.random().toString(36).slice(2, 7)}`),
        label,
        labelKo: sanitizeCustomLabel(item?.labelKo || item?.label || ''),
        promptFull: String(item?.promptFull || '').replace(/[\n\r]/g, ' ').trim().slice(0, 160),
        description: String(item?.description || '').replace(/[\n\r]/g, ' ').trim().slice(0, 160),
        section,
        tier: 'free' as TagTier,
        createdAt: Number(item?.createdAt || now),
        updatedAt: Number(item?.updatedAt || now),
      } as UserCustomSectionTagDefinition;
    })
    .filter((item): item is UserCustomSectionTagDefinition => Boolean(item));
};

const normalizeSectionName = (section: string): string => {
  const normalized = String(section || '').trim();
  if (/^Verse\s*\d+$/i.test(normalized)) return 'Verse';
  if (/^Rap\s*Verse$/i.test(normalized)) return 'Rap Section';
  return normalized;
};

const normalizeCustomStructure = (input: any): CustomSectionItem[] => {
  if (!input || !Array.isArray(input)) return [];
  
  try {
    return input.map((item: any) => {
      // If it's already an object with the right structure
      if (typeof item === 'object' && item !== null && 'section' in item) {
        return {
          id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          section: normalizeSectionName(item.section || 'Unknown'),
          tags: Array.isArray(item.tags) ? item.tags : []
        };
      }
      // If it's the old string format
      if (typeof item === 'string') {
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          section: normalizeSectionName(item),
          tags: []
        };
      }
      // Fallback for unexpected items
      return null;
    }).filter((item): item is CustomSectionItem => item !== null);
  } catch (error) {
    console.error('Failed to normalize custom structure:', error);
    return [];
  }
};

const formatStoredCustomStructureText = (structure: any): string => {
  const normalized = normalizeCustomStructure(structure);
  const formatTag = (tag: any): string => {
    const raw = String(tag || '').trim();
    if (!raw) return '';
    if (raw.startsWith('VOCAL_ALL::')) return '전체보컬';
    if (raw.startsWith('VOCAL::')) {
      const parts = raw.split('::');
      return (parts[1] || 'Vocal').replace(/\s{2,}/g, ' ').trim();
    }
    return raw.replace(/\s{2,}/g, ' ').trim();
  };

  return normalized.map((sectionItem) => {
    const section = String(sectionItem.section || '').trim() || 'Section';
    const visibleTags = (sectionItem.tags ?? [])
      .map(formatTag)
      .filter(Boolean)
      .filter((tag, index, arr) => arr.findIndex((other) => String(other).toLowerCase() === String(tag).toLowerCase()) === index)
      .slice(0, 3);

    if (/^(Instrumental|Break|Stop)$/i.test(section)) {
      if (/^Instrumental$/i.test(section) && visibleTags.length > 0) return `${section}: ${visibleTags[0]}`;
      return section;
    }

    return `${section}${visibleTags.length > 0 ? ` · ${visibleTags.join(' · ')}` : ''}`;
  }).join(' → ');
};

import { generateSong, translateTitleAndLyrics, generateCustomSectionMetadata } from './services/geminiService';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
  limit,
  addDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
  increment,
  deleteField,
  query as firestoreQuery
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import { sanitizeForFirestore } from './lib/utils';
import GenreHierarchySelector from './components/GenreHierarchySelector';
import MusicApiGenerateModal, { LanguageCode, MusicApiTargetOption, SunoModelVersion } from './components/MusicApiGenerateModal';

const INSTRUMENTAL_BGM_GENRE_IDS = new Set([
  'instrumental_bgm',
  'lofi_study',
  'cafe_bgm',
  'nature_ambience',
  'healing_piano',
  'ambient',
  'minimalism',
  'piano_solo',
  'string_ensemble',
]);

const isInstrumentalBgmGenreId = (id?: string | null) => Boolean(id && INSTRUMENTAL_BGM_GENRE_IDS.has(id));
const hasInstrumentalBgmGenreIds = (ids: Array<string | null | undefined>) => ids.some(isInstrumentalBgmGenreId);
const isPureInstrumentalBgmGenreSelection = (ids: Array<string | null | undefined>) => {
  const cleanIds = ids.filter((id): id is string => Boolean(id));
  return cleanIds.length > 0 && cleanIds.every(isInstrumentalBgmGenreId);
};
import { signInWithPopup, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail, type User } from 'firebase/auth';

type AuthMode = 'login' | 'signup' | 'reset';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this.state as any).hasError) {
      const error = (this.state as any).error;
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      
      if (error?.message) {
        if (error.message.includes("VITE_GEMINI_API_KEY")) {
          errorMessage = "Gemini API 키가 설정되지 않았습니다. 설정을 확인해주세요.";
        } else if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("limit")) {
          errorMessage = "무료 생성 한도를 초과했습니다. 나중에 다시 시도해주세요.";
        } else {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.includes("insufficient permissions")) {
              errorMessage = "권한이 부족합니다. 로그인 상태를 확인해주세요.";
            }
          } catch (e) {
            errorMessage = error.message;
          }
        }
      }

      return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">문제가 발생했습니다</h2>
            <p className="text-[var(--text-secondary)]">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-brand-orange text-white font-bold hover:brightness-110 transition-all"
            >
              다시 시도하기
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}



type StudioSectionAccent = {
  bar: string;
  text: string;
  softText: string;
  selected: string;
  selectedSoft: string;
  summaryActive: string;
  summaryRest: string;
  summaryHover: string;
  summaryBorder: string;
  summaryBorderHover: string;
  summaryActiveBg: string;
  selectedBorder: string;
  badge: string;
  pointSelected: string;
  pointBadge: string;
  badgeAccent: string;
};

const STUDIO_ACCENT_AMBER: StudioSectionAccent = {
  bar: 'bg-[#DFA05D]/95',
  text: 'text-[#E8B878]',
  softText: 'text-[#E8B878]/58',
  selected: 'bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  selectedSoft: 'bg-[#DFA05D]/14 border-black/20 text-[#E8B878] hover:bg-[#DFA05D]/20',
  summaryActive: 'bg-[#DFA05D]/[0.035] border-[#DFA05D]/15 text-[#E8B878]',
  summaryRest: 'border-[#DFA05D]/10 bg-black/5',
  summaryHover: 'hover:border-[#DFA05D]/20 hover:bg-[#DFA05D]/[0.035]',
  summaryBorder: 'rgba(223, 160, 93, 0.14)',
  summaryBorderHover: 'rgba(223, 160, 93, 0.24)',
  summaryActiveBg: 'rgba(223, 160, 93, 0.035)',
  selectedBorder: 'border-black/20',
  badge: 'bg-[#050505]/92 border-black/55',
  pointSelected: 'bg-[#DFA05D]/68 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  pointBadge: 'bg-[#DFA05D]/80 text-[#171717] border-black/20',
  badgeAccent: '#DFA05D',
};

const STUDIO_ACCENT_RED: StudioSectionAccent = {
  bar: 'bg-[#AC5045]/95',
  text: 'text-[#D79084]',
  softText: 'text-[#D79084]/58',
  selected: 'bg-[#AC5045]/74 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  selectedSoft: 'bg-[#AC5045]/15 border-black/20 text-[#D79084] hover:bg-[#AC5045]/22',
  summaryActive: 'bg-[#AC5045]/[0.035] border-[#AC5045]/15 text-[#D79084]',
  summaryRest: 'border-[#AC5045]/10 bg-black/5',
  summaryHover: 'hover:border-[#AC5045]/20 hover:bg-[#AC5045]/[0.035]',
  summaryBorder: 'rgba(172, 80, 69, 0.14)',
  summaryBorderHover: 'rgba(172, 80, 69, 0.24)',
  summaryActiveBg: 'rgba(172, 80, 69, 0.035)',
  selectedBorder: 'border-black/20',
  badge: 'bg-[#050505]/92 border-black/55',
  pointSelected: 'bg-[#AC5045]/68 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  pointBadge: 'bg-[#AC5045]/80 text-[#171717] font-black border-black/20',
  badgeAccent: '#AC5045',
};

const STUDIO_ACCENT_GREEN: StudioSectionAccent = {
  bar: 'bg-[#658761]/95',
  text: 'text-[#A8C49F]',
  softText: 'text-[#A8C49F]/58',
  selected: 'bg-[#658761]/74 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  selectedSoft: 'bg-[#658761]/15 border-black/20 text-[#A8C49F] hover:bg-[#658761]/22',
  summaryActive: 'bg-[#658761]/[0.035] border-[#658761]/15 text-[#A8C49F]',
  summaryRest: 'border-[#658761]/10 bg-black/5',
  summaryHover: 'hover:border-[#658761]/20 hover:bg-[#658761]/[0.035]',
  summaryBorder: 'rgba(101, 135, 97, 0.14)',
  summaryBorderHover: 'rgba(101, 135, 97, 0.24)',
  summaryActiveBg: 'rgba(101, 135, 97, 0.035)',
  selectedBorder: 'border-black/20',
  badge: 'bg-[#050505]/92 border-black/55',
  pointSelected: 'bg-[#658761]/68 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  pointBadge: 'bg-[#658761]/80 text-[#171717] font-black border-black/20',
  badgeAccent: '#658761',
};

type StudioMenuThemeKey = 'amber' | 'red' | 'green';
type StudioMenuCategory = 'genre' | 'style' | 'sound' | 'mood' | 'theme' | 'vocal' | 'section' | 'structure' | 'tempo';

const STUDIO_MENU_THEME_CLASSES: Record<StudioMenuThemeKey, StudioSectionAccent> = {
  amber: STUDIO_ACCENT_AMBER,
  red: STUDIO_ACCENT_RED,
  green: STUDIO_ACCENT_GREEN,
};

const STUDIO_MENU_THEME_BY_CATEGORY: Record<StudioMenuCategory, StudioMenuThemeKey> = {
  genre: 'amber',
  style: 'amber',
  sound: 'amber',
  mood: 'red',
  theme: 'red',
  vocal: 'green',
  section: 'green',
  structure: 'green',
  tempo: 'green',
};

const getMenuThemeClass = (category: StudioMenuCategory): StudioSectionAccent =>
  STUDIO_MENU_THEME_CLASSES[STUDIO_MENU_THEME_BY_CATEGORY[category]];

const getMenuPanelClass = (category: StudioMenuCategory, state: 'active' | 'rest' | 'hover' = 'rest') => {
  const theme = getMenuThemeClass(category);
  if (state === 'active') return theme.summaryActive;
  if (state === 'hover') return theme.summaryHover;
  return theme.summaryRest;
};

const getKeywordChipClass = (category: StudioMenuCategory, isRandom = false) => {
  const theme = getMenuThemeClass(category);
  if (isRandom) {
    return `${theme.selectedSoft} font-bold shadow-[0_8px_18px_rgba(0,0,0,0.10)]`;
  }
  return `${theme.selectedSoft} shadow-[0_8px_18px_rgba(0,0,0,0.10)]`;
};

const STUDIO_CATEGORY_ACCENTS: Record<StudioMenuCategory, StudioSectionAccent> = {
  genre: getMenuThemeClass('genre'),
  style: getMenuThemeClass('style'),
  sound: getMenuThemeClass('sound'),
  mood: getMenuThemeClass('mood'),
  theme: getMenuThemeClass('theme'),
  vocal: getMenuThemeClass('vocal'),
  section: getMenuThemeClass('section'),
  structure: getMenuThemeClass('structure'),
  tempo: getMenuThemeClass('tempo'),
};

const getStudioSectionAccent = (section?: string): StudioSectionAccent => {
  const key = String(section || '').toLowerCase();
  if (key.includes('vocal') || key.includes('보컬')) return STUDIO_CATEGORY_ACCENTS.vocal;
  if (key.includes('section') || key.includes('structure') || key.includes('섹션')) return STUDIO_CATEGORY_ACCENTS.structure;
  if (key.includes('tempo') || key.includes('템포') || key.includes('bpm')) return STUDIO_CATEGORY_ACCENTS.tempo;
  if (key.includes('style') || key.includes('스타일')) return STUDIO_CATEGORY_ACCENTS.style;
  if (key.includes('sound') || key.includes('사운드')) return STUDIO_CATEGORY_ACCENTS.sound;
  if (key.includes('mood') || key.includes('분위기')) return STUDIO_CATEGORY_ACCENTS.mood;
  if (key.includes('theme') || key.includes('주제')) return STUDIO_CATEGORY_ACCENTS.theme;
  return STUDIO_CATEGORY_ACCENTS.genre;
};


const getAppliedKeywordChipClass = (typeOrKey: string, isRandom = false) => {
  const normalized = String(typeOrKey || '').toLowerCase();

  if (normalized.includes('vocal') || normalized.includes('section') || normalized.includes('structure') || normalized.includes('tempo') || normalized.includes('bpm')) {
    return getKeywordChipClass('section', isRandom);
  }
  if (normalized.includes('mood') || normalized.includes('atmosphere') || normalized.includes('theme') || normalized.includes('topic')) {
    return getKeywordChipClass('mood', isRandom);
  }
  if (normalized.includes('genre') || normalized === 'subgenre' || normalized.includes('style') || normalized.includes('sound') || normalized.includes('instrument') || normalized.includes('point')) {
    return getKeywordChipClass('genre', isRandom);
  }
  if (isRandom) {
    return getKeywordChipClass('genre', true);
  }
  return 'bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-secondary)]';
};


function keepExpandableSectionInView(_trigger: HTMLElement, _wasExpanded: boolean) {
  // Keep expansion purely local. Auto-scroll during height transitions can fight
  // the browser's scroll anchoring and make the first top-row open feel choppy.
}

function handleExpandableToggle(
  event: React.MouseEvent<HTMLElement>,
  isExpanded: boolean,
  onToggleExpand?: () => void
) {
  event.preventDefault();

  const section = event.currentTarget.closest('[data-expand-section]') as HTMLElement | null;
  const beforeTop = section?.getBoundingClientRect().top ?? null;

  onToggleExpand?.();
  keepExpandableSectionInView(event.currentTarget, isExpanded);

  if (!section || beforeTop === null) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const afterTop = section.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
      }
    });
  });
}

function useStableContentHeight(
  contentRef: React.RefObject<HTMLElement>,
  setHeight: (value: number | string | ((prev: number | string) => number | string)) => void,
  deps: React.DependencyList,
  onHeightChange?: (height: number) => void
) {
  useLayoutEffect(() => {
    let frameId: number | null = null;
    let timeoutId: number | null = null;

    const measure = () => {
      const el = contentRef.current;
      if (!el) return;
      const nextHeight = el.scrollHeight || el.getBoundingClientRect().height || 0;
      if (nextHeight <= 0) return;
      setHeight((prev) => (prev === nextHeight ? prev : nextHeight));
      onHeightChange?.(nextHeight);
    };

    const scheduleMeasure = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    timeoutId = window.setTimeout(measure, 80);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && contentRef.current) {
      observer = new ResizeObserver(scheduleMeasure);
      observer.observe(contentRef.current);
    }

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const resolveExpandedHeight = (preferredHeight: number | undefined, measuredHeight: number | string, fallbackHeight: number) => {
  if (typeof preferredHeight === 'number' && preferredHeight > 0) return preferredHeight;
  if (typeof measuredHeight === 'number' && measuredHeight > 0) return measuredHeight;
  return fallbackHeight;
};

const getVocalToneDisplayLabel = (toneId: string | undefined, vocalTones: VocalTone[]) => {
  if (!toneId) return '';
  const matched = vocalTones.find((tone) => tone.id === toneId);
  return matched?.labelKo || matched?.label || toneId;
};

const getVocalTonePromptValue = (toneId: string | undefined, vocalTones: VocalTone[]) => {
  if (!toneId) return undefined;
  const matched = vocalTones.find((tone) => tone.id === toneId);
  return matched?.promptCore || matched?.label || toneId;
};


const createEmptySituation = (): SituationConfig => ({ enabled: false });


const STORYBOARD_SLIDER_DEFAULT = 50;
const STORYBOARD_SLIDER_STOPS = [0, 17, 33, 50, 67, 83, 100] as const;
const snapStoryboardSliderValue = (value: number) => STORYBOARD_SLIDER_STOPS.reduce((closest, stop) => (
  Math.abs(stop - value) < Math.abs(closest - value) ? stop : closest
), STORYBOARD_SLIDER_DEFAULT);
const getStoryboardSliderStage = (value: number) => STORYBOARD_SLIDER_STOPS.findIndex((stop) => stop === snapStoryboardSliderValue(value));
const STORYBOARD_SLIDER_FIELDS = [
  'characterAPoliteness',
  'characterAIntensity',
  'characterADelivery',
  'characterBPoliteness',
  'characterBIntensity',
  'characterBDelivery',
  'storyDialogueBalance',
  'storyRealityScale',
  'storyPlayfulSincere',
] as const;

type StoryboardSliderField = typeof STORYBOARD_SLIDER_FIELDS[number];

const sanitizeStoryboardSituation = (value?: SituationConfig | null): SituationConfig => {
  const base = { ...(value || {}) } as SituationConfig & Record<string, any>;
  Object.keys(base).forEach((key) => {
    const current = base[key];
    if (typeof current === 'string' && !current.trim()) delete base[key];
    if (Array.isArray(current) && current.length === 0) delete base[key];
  });
  STORYBOARD_SLIDER_FIELDS.forEach((field) => {
    const raw = base[field];
    if (raw === undefined || raw === null || raw === '' || Number(raw) === STORYBOARD_SLIDER_DEFAULT) {
      delete base[field];
    } else {
      base[field] = snapStoryboardSliderValue(Math.max(0, Math.min(100, Number(raw))));
    }
  });
  const active = hasActiveSituation({ ...base, enabled: false } as SituationConfig);
  return active ? ({ ...base, enabled: true } as SituationConfig) : createEmptySituation();
};

const serializeStoryboardSituation = (value?: SituationConfig | null) => JSON.stringify(sanitizeStoryboardSituation(value));

const getStoryboardSliderValue = (value: SituationConfig | null | undefined, field: StoryboardSliderField) => {
  const raw = (value as any)?.[field];
  return typeof raw === 'number' ? snapStoryboardSliderValue(raw) : STORYBOARD_SLIDER_DEFAULT;
};

const storyboardAxisSummary = (value: number, left: string, right: string) => {
  const stage = getStoryboardSliderStage(value);
  if (stage === 0) return `${left} 강함`;
  if (stage === 1) return `${left} 중심`;
  if (stage === 2) return `살짝 ${left}`;
  if (stage === 4) return `살짝 ${right}`;
  if (stage === 5) return `${right} 중심`;
  if (stage === 6) return `${right} 강함`;
  return '중간';
};

const buildStoryboardSummary = (situation?: SituationConfig | null) => {
  if (!hasActiveSituation(situation)) return '캐릭터와 이야기 흐름을 정해요';
  const relation = [situation?.targetA, situation?.targetB].filter(Boolean).join(' vs ');
  const world = String(situation?.description || situation?.summary || '').trim();
  const storyBits = [
    storyboardAxisSummary(getStoryboardSliderValue(situation, 'storyDialogueBalance'), '티키타카', '독백'),
    storyboardAxisSummary(getStoryboardSliderValue(situation, 'storyRealityScale'), '리얼리즘', '드라마틱'),
    storyboardAxisSummary(getStoryboardSliderValue(situation, 'storyPlayfulSincere'), '위트', '진심'),
  ].filter((item) => item !== '중간');
  const parts = [relation, world ? world.slice(0, 28) : '', ...storyBits.slice(0, 2)]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : '스토리보드 설정됨';
};


const SITUATION_VERSION_OPTIONS = [
  { value: '', label: '연출 톤 선택' },
  { value: 'comic', label: '코믹형' },
  { value: 'satire', label: '풍자형' },
  { value: 'black-comedy', label: '블랙코미디형' },
  { value: 'absurd-comedy', label: '황당개그형' },
  { value: 'bittersweet', label: '짠한형' },
  { value: 'tearful-comedy', label: '웃픈형' },
  { value: 'sharp-conflict', label: '날카로운 갈등형' },
  { value: 'generation-gap', label: '세대차이형' },
  { value: 'miscommunication', label: '동문서답형' },
  { value: 'role-reversal', label: '역할반전형' },
  { value: 'warm-ending', label: '따뜻한형' },
  { value: 'parallel-ending', label: '평행선형' },
  { value: 'romantic', label: '로맨틱형' },
  { value: 'nostalgic', label: '회상형' },
  { value: 'dreamlike', label: '몽환형' },
  { value: 'daily-life-slice', label: '생활밀착형' },
  { value: 'social-satire', label: '사회풍자형' },
  { value: 'dry-humor', label: '건조한 유머형' },
  { value: 'healing', label: '힐링형' },
  { value: 'youthful', label: '청춘형' },
  { value: 'noir', label: '누아르형' },
  { value: 'fantasy', label: '판타지형' },
] as const;

const SITUATION_DEVELOPMENT_OPTIONS = [
  { value: 'solo-monologue', label: '독백형' },
  { value: 'memory-fragment', label: '기억 조각형' },
  { value: 'confession-delay', label: '늦은 고백형' },
  { value: 'scene-loop', label: '장면 반복형' },
  { value: 'object-led', label: '물건 중심형' },
  { value: 'detail-hook', label: '사소한 디테일 훅' },
  { value: 'chorus-takeover', label: '후렴 장악형' },
  { value: 'one-sided-hook', label: '한쪽 후렴형' },
  { value: 'together-hook', label: '함께 부르는 후렴형' },
  { value: 'echo-hook', label: '에코 훅형' },
  { value: 'adlib-response', label: '애드립 응답형' },
  { value: 'interruption', label: '끼어들기형' },
  { value: 'negotiation', label: '협상형' },
  { value: 'push-and-pull', label: '밀당형' },
  { value: 'role-reversal', label: '역전형' },
  { value: 'late-reveal', label: '후반 공개형' },
  { value: 'parallel-monologue', label: '평행 독백형' },
  { value: 'misunderstanding', label: '오해형' },
  { value: 'unresolved-ending', label: '끝까지 미해결형' },
  { value: 'comic-loop', label: '코믹 루프형' },
  { value: 'quiet-contradiction', label: '조용한 모순형' },
  { value: 'genre-led', label: '장르 주도형' },
  { value: 'drop-hook', label: '드롭 훅형' },
  { value: 'rap-relay', label: '랩 릴레이형' },
  { value: 'solo-hook', label: '솔로 훅 중심' },
  { value: 'dialogue-break', label: '대화 끊김형' },
  { value: 'inner-voice', label: '속마음 공개형' },
  { value: 'final-twist', label: '마지막 반전형' },
  { value: 'open-ending', label: '열린 결말형' },
  { value: 'chorus-contrast', label: '후렴 대비형' },
] as const;

const SITUATION_DETAIL_EXAMPLES = [
  '예: 처녀귀신은 적금 만기, 새 원피스, 편의점 신상처럼 사소한 미련이 많음',
  '예: 저승사자는 명부와 퇴근 시간 때문에 계속 재촉하지만 은근히 마음이 약함',
  '예: 후렴에는 특정 물건이나 장소 하나를 반복해서 훅처럼 사용',
  '예: 영어는 짧은 애드립만 사용하고, 본문은 한국어 중심으로 유지',
  '예: 마지막은 해결하지 않고 어색한 농담으로 끝남',
] as const;

const SITUATION_SPEECH_STYLE_OPTIONS = [
  '담담하게',
  '아무렇지 않은 척',
  '툭 던지듯',
  '혼잣말처럼',
  '고백하듯',
  '속삭이듯',
  '투덜대듯',
  '비꼬듯',
  '직설적으로',
  '차분하게',
  '무심하게',
  '애써 밝게',
  '체념한 듯',
  '불안하게',
  '서툴게',
  '건조하게',
  '능청스럽게',
  '장난스럽게',
  '간절하게',
  '망설이듯',
  '날카롭게',
  '다정하게',
  '쓸쓸하게',
  '흔들리듯',
  '빠르게',
  '리드미컬하게',
  '존댓말로',
  '반말처럼',
  '돌려 말하듯',
  '투정하듯',
  '웃으며',
  '숨을 삼키듯',
  '낮게 누르듯',
  '가볍게 받아치듯',
] as const;

const SITUATION_ATTITUDE_OPTIONS = [
  '괜히 기분이 좋은',
  '가슴이 콩닥대는',
  '자꾸 웃음이 나는',
  '기대하고 싶은',
  '오늘은 될 것 같은',
  '장난스럽게 들뜬',
  '가볍게 설레는',
  '사랑받고 싶은',
  '위로받고 싶은',
  '자유를 찾고 싶은',
  '어디론가 떠나고 싶은',
  '돌아가고 싶은',
  '끝내 놓지 못하는',
  '그리움이 남은',
  '말하고 싶은데 못하는',
  '복받쳐 오르는',
  '혼자 버티는',
  '참다 터질 것 같은',
  '괜히 날카로운',
  '억울해서 못 참는',
  '반항하고 싶은',
  '비꼬고 싶은',
  '말대꾸하고 싶은',
  '불안에 잠긴',
  '숨이 턱 막히는',
  '도망가고 싶은',
  '공황 올 것 같은',
  '자꾸 확인하게 되는',
  '실수할까 겁나는',
  '쫓기는 듯한',
  '아무것도 하기 싫은',
  '아무렇지 않은 척하는',
  '툭 놓고 싶은',
  '감정이 식은',
  '체념한 듯한',
  '귀찮은 듯한',
  '힘이 빠진',
  '좋은데 서운한',
  '웃는데 쓸쓸한',
  '화났는데 보고 싶은',
  '편한데 멀어진',
  '괜찮은데 흔들리는',
  '싫은데 신경 쓰이는',
  '끝난 줄 알았는데 아닌',
  '모르는 척하고 싶은',
  '조금만 기대고 싶은',
  '기쁜데 눈물 나는',
  '무미건조하게 흘러가는',
  '별일 아닌 척하는',
  '가볍게 웃어넘기고 싶은',
  '조용히 무너지는',
  '이유 없이 들뜬',
  '쓸데없이 신경 쓰이는',
  '아무것도 안 해서 편한',
] as const;

type SituationChoicePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  summaryLabel?: string;
  maxSelected?: number;
};

const splitSituationChoices = (value: string, labels: string[]) => {
  const parts = String(value || '')
    .split(/[,/]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.filter((item) => labels.includes(item));
};

const SituationChoicePicker = ({
  label,
  value,
  onChange,
  placeholder,
  options,
  summaryLabel = '선택하기',
  maxSelected = 2,
}: SituationChoicePickerProps) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customDraft, setCustomDraft] = useState(value || '');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const labels = useMemo(() => options.map((item) => typeof item === 'string' ? item : item.label), [options]);
  const selected = useMemo(() => splitSituationChoices(value || '', labels), [value, labels]);
  const hasValue = Boolean(String(value || '').trim());

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!editing) setCustomDraft(value || '');
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const startDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCustomDraft(value || '');
    setOpen(false);
    setEditing(true);
  };

  const cancelDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCustomDraft(value || '');
    setEditing(false);
  };

  const applyDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const next = customDraft.trim();
    onChange(next);
    setEditing(false);
    setOpen(false);
  };

  const toggleChoice = (labelText: string) => {
    const exists = selected.includes(labelText);
    const next = exists
      ? selected.filter((item) => item !== labelText)
      : selected.length >= maxSelected
        ? selected
        : [...selected, labelText];
    onChange(next.join(', '));
    setOpen(false);
    setEditing(false);
  };

  const clearChoices = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    onChange('');
    setCustomDraft('');
    setOpen(false);
    setEditing(false);
  };

  const buttonLabel = hasValue ? String(value).trim() : summaryLabel;

  return (
    <div ref={wrapRef} className="relative space-y-1.5 overflow-visible">
      <label className="block text-[11px] font-bold text-[var(--text-secondary)]">{label}</label>

      {editing ? (
        <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-[var(--input-bg)] border-brand-orange text-sm transition-all">
          <input
            ref={inputRef}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyDirectInput();
              if (e.key === 'Escape') cancelDirectInput();
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-xs md:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
          <button
            type="button"
            onClick={cancelDirectInput}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-btn-hover transition-all"
            aria-label={`${label} 직접 입력 취소`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={applyDirectInput}
            className="p-1.5 rounded-lg text-amber-300 hover:bg-amber-500/10 transition-all"
            aria-label={`${label} 직접 입력 적용`}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all",
            open
              ? "bg-brand-orange/10 border-brand-orange text-brand-orange"
              : hasValue
                ? "bg-[var(--input-bg)] border-brand-orange/55 text-[var(--text-primary)] hover:bg-btn-hover"
                : "bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-brand-orange"
          )}
        >
          <span className={cn("truncate", !hasValue && "text-[var(--text-tertiary)]")}>{buttonLabel}</span>
          <span className="flex items-center gap-1 shrink-0">
            {hasValue && (
              <span
                role="button"
                tabIndex={0}
                onClick={startDirectInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startDirectInput(event as any);
                  }
                }}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-brand-orange hover:bg-btn-hover transition-all"
                aria-label={`${label} 수정`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </span>
            )}
            {hasValue && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearChoices}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') clearChoices(event as any);
                }}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-brand-orange hover:bg-btn-hover transition-all"
                aria-label={`${label} 지우기`}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && !editing && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full z-[500] mt-2 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/90">
              <span className="text-[11px] font-bold text-[var(--text-tertiary)]">최대 {maxSelected}개 선택</span>
              {!!hasValue && (
                <button
                  type="button"
                  onClick={clearChoices}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-btn-bg border border-btn-border text-[10px] font-bold text-[var(--text-secondary)] hover:text-brand-orange transition-all"
                >
                  <X className="w-[18px] h-[18px]" />
                  지우기
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
              <button
                type="button"
                onClick={startDirectInput}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[#A8C49F]"
              >
                <span>직접 입력</span>
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
              </button>

              {labels.map((labelText) => {
                const active = selected.includes(labelText);
                const disabled = !active && selected.length >= maxSelected;
                return (
                  <button
                    key={labelText}
                    type="button"
                    onClick={() => toggleChoice(labelText)}
                    disabled={disabled}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left",
                      active
                        ? "bg-brand-orange text-white border-brand-orange"
                        : disabled
                          ? "bg-btn-bg/50 border-btn-border text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
                          : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover hover:text-[var(--text-primary)]"
                    )}
                  >
                    <span>{labelText}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

type SituationVersionPickerProps = {
  value: string;
  onChange: (value: string, label: string) => void;
};

const SituationVersionPicker = ({ value, onChange }: SituationVersionPickerProps) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = SITUATION_VERSION_OPTIONS.find((item) => item.value === value);
  const hasValue = !!value;
  const displayLabel = selectedOption?.label || value || '연출 톤 선택';

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!editing) setCustomDraft(selectedOption?.label || value || '');
  }, [editing, selectedOption?.label, value]);

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const startDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCustomDraft(selectedOption?.label || value || '');
    setOpen(false);
    setEditing(true);
  };

  const cancelDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCustomDraft(selectedOption?.label || value || '');
    setEditing(false);
  };

  const applyDirectInput = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const next = customDraft.trim();
    if (!next) return;
    onChange(next, next);
    setOpen(false);
    setEditing(false);
  };

  const clearValue = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    onChange('', '');
    setCustomDraft('');
    setOpen(false);
    setEditing(false);
  };

  return (
    <div ref={wrapRef} className="relative overflow-visible">
      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">연출 톤</label>

      {editing ? (
        <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-[var(--input-bg)] border-brand-orange text-sm transition-all">
          <input
            ref={inputRef}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyDirectInput();
              if (e.key === 'Escape') cancelDirectInput();
            }}
            placeholder="직접 입력: 예: 조용한 블랙코미디형, 풋풋한 성장형"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
          <button
            type="button"
            onClick={cancelDirectInput}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-btn-hover transition-all"
            aria-label="연출 톤 직접 입력 취소"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={applyDirectInput}
            className="p-1.5 rounded-lg text-brand-orange hover:bg-brand-orange/10 transition-all"
            aria-label="연출 톤 직접 입력 적용"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-bold transition-all",
            open
              ? "bg-brand-orange/10 border-brand-orange text-brand-orange"
              : hasValue
                ? "bg-[var(--input-bg)] border-brand-orange/60 text-[var(--text-primary)]"
                : "bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-brand-orange"
          )}
        >
          <span className={cn("truncate", !hasValue && "text-[var(--text-tertiary)]")}>{displayLabel}</span>
          <span className="flex items-center gap-1 shrink-0">
            {hasValue && (
              <span
                role="button"
                tabIndex={0}
                onClick={startDirectInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startDirectInput(e as any);
                  }
                }}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-brand-orange hover:bg-btn-hover transition-all"
                aria-label="연출 톤 수정"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </span>
            )}
            {hasValue && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') clearValue(e as any);
                }}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-brand-orange hover:bg-btn-hover transition-all"
                aria-label="연출 톤 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && !editing && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full z-[500] mt-2 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/90">
              <span className="text-[11px] font-bold text-[var(--text-tertiary)]">연출 톤 선택</span>
              {hasValue && (
                <button
                  type="button"
                  onClick={clearValue}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-btn-bg border border-btn-border text-[10px] font-bold text-[var(--text-secondary)] hover:text-brand-orange transition-all"
                >
                  <X className="w-[18px] h-[18px]" />
                  지우기
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
              <button
                type="button"
                onClick={startDirectInput}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[#A8C49F]"
              >
                <span>직접 입력</span>
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
              </button>

              {SITUATION_VERSION_OPTIONS.filter((option) => option.value !== '').map((option) => {
                const active = option.value === value || option.label === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value, option.label);
                      setOpen(false);
                      setEditing(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left",
                      active
                        ? "bg-brand-orange text-white border-brand-orange"
                        : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover hover:text-[var(--text-primary)]"
                    )}
                  >
                    <span>{option.label}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SituationDetailInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold text-[var(--text-secondary)]">추가 디테일</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="직접 입력: 인물의 사소한 습관, 장소, 물건, 말버릇, 엔딩 느낌 등을 자유롭게 적어주세요."
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-brand-orange resize-none"
      />
      <button
        type="button"
        onClick={() => setShowExamples(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-btn-bg border border-btn-border text-left text-xs font-bold text-[var(--text-secondary)] hover:bg-btn-hover hover:text-brand-orange transition-all"
      >
        <span>작성 예시 보기</span>
        {showExamples ? <ChevronUp className="w-[18px] h-[18px]" /> : <ChevronDown className="w-[18px] h-[18px]" />}
      </button>
      {showExamples && (
        <div className="rounded-2xl bg-btn-bg/70 border border-btn-border p-3 space-y-2">
          {SITUATION_DETAIL_EXAMPLES.map((example) => (
            <p key={example} className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{example}</p>
          ))}
        </div>
      )}
    </div>
  );
};


type StoryboardSliderProps = {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  statusLabels?: [string, string, string];
  accent?: 'story' | 'characterA' | 'characterB';
};

const getStoryboardSliderStatus = (value: number, labels?: [string, string, string]) => {
  const [leftLabel, , rightLabel] = labels || ['왼쪽', '균형', '오른쪽'];
  const stage = getStoryboardSliderStage(value);
  if (stage === 0) return `${leftLabel} 강함`;
  if (stage === 1) return `${leftLabel} 중심`;
  if (stage === 2) return `살짝 ${leftLabel}`;
  if (stage === 4) return `살짝 ${rightLabel}`;
  if (stage === 5) return `${rightLabel} 중심`;
  if (stage === 6) return `${rightLabel} 강함`;
  return '기본값';
};

const getStoryboardSliderHint = (value: number, left: string, right: string, labels?: [string, string, string]) => {
  const [leftLabel, , rightLabel] = labels || [left, '균형', right];
  const stage = getStoryboardSliderStage(value);
  if (stage === 0) return `${leftLabel}을 강하게 적용`;
  if (stage === 1) return `${leftLabel} 중심으로 적용`;
  if (stage === 2) return `${leftLabel}을 살짝 적용`;
  if (stage === 4) return `${rightLabel}을 살짝 적용`;
  if (stage === 5) return `${rightLabel} 중심으로 적용`;
  if (stage === 6) return `${rightLabel}을 강하게 적용`;
  return '기본';
};

const StoryboardSectionTitle = ({ title, description }: { title: string; description?: string }) => (
  <div className="flex items-start gap-3">
    <span className="mt-1 h-6 w-1.5 rounded-full bg-[#AC5045] shadow-[0_0_12px_rgba(172,80,69,0.38)] shrink-0" />
    <div className="min-w-0">
      <p className="text-lg md:text-xl font-black text-[#D79084] tracking-tight">{title}</p>
      {description && <p className="mt-1.5 text-sm md:text-[15px] leading-relaxed text-[var(--text-secondary)]">{description}</p>}
    </div>
  </div>
);

const StoryboardSlider = ({ label, left, right, value, onChange, description, statusLabels, accent = 'story' }: StoryboardSliderProps) => {
  const status = getStoryboardSliderStatus(value, statusLabels);
  const sliderHint = getStoryboardSliderHint(value, left, right, statusLabels);
  const leftLabelClass = left.length > 3 ? 'text-[11px] md:text-xs tracking-[-0.02em]' : 'text-xs md:text-sm';
  const rightLabelClass = right.length > 3 ? 'text-[11px] md:text-xs tracking-[-0.02em]' : 'text-xs md:text-sm';
  const accentStyle = accent === 'characterB'
    ? {
        text: 'text-[#E8B878]',
        dot: 'bg-[#DFA05D] shadow-[0_0_8px_rgba(223,160,93,0.36)]',
        badge: 'border-black/20 text-[#E8B878]',
        slider: 'storyboard-slider--character-b',
      }
    : {
        text: 'text-[#D79084]',
        dot: 'bg-[#AC5045] shadow-[0_0_8px_rgba(172,80,69,0.36)]',
        badge: 'border-black/20 text-[#D79084]',
        slider: 'storyboard-slider--story',
      };
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-[#2e2e2e] p-4 space-y-3.5 transition-all">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("inline-flex items-center gap-2 text-base md:text-[17px] font-black", accentStyle.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", accentStyle.dot)} />
          <span>{label}</span>
        </p>
        <span className={cn("rounded-full border bg-transparent px-3 py-1 text-xs font-black shrink-0", accentStyle.badge)}>{status}</span>
      </div>
      {description && <p className="text-xs md:text-[13px] leading-relaxed text-[var(--text-secondary)]">{description}</p>}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className={`${leftLabelClass} font-black text-[var(--text-primary)] text-left`}>{left}</span>
          <span className={`${rightLabelClass} font-black text-[var(--text-primary)] text-right`}>{right}</span>
        </div>
        <div className="relative px-[1px] pt-1 pb-7">
          <div className="storyboard-slider-center-marker" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={snapStoryboardSliderValue(value)}
            onChange={(e) => onChange(snapStoryboardSliderValue(Number(e.target.value))) }
            className={cn("storyboard-slider w-full", accentStyle.slider)}
            aria-label={`${left}에서 ${right} 사이 ${label}`}
          />
          <div className="pointer-events-none absolute bottom-0 left-1/2 max-w-[190px] -translate-x-1/2 truncate text-center text-[10px] font-black text-white/90 md:text-[11px]">
            {sliderHint}
          </div>
        </div>
      </div>
    </div>
  );
};

const hasActiveSituation = (situation?: SituationConfig | null) => {
  if (!situation) return false;
  return Boolean(
    situation.enabled ||
    situation.targetA ||
    situation.targetB ||
    situation.relationship ||
    situation.description ||
    situation.development ||
    situation.developmentPreset ||
    situation.developmentCustom ||
    situation.versionLabel ||
    situation.speakerAStyle ||
    situation.speakerAAttitude ||
    situation.speakerBStyle ||
    situation.speakerBAttitude ||
    situation.speakerAExtra ||
    situation.speakerBExtra ||
    STORYBOARD_SLIDER_FIELDS.some((field) => {
      const raw = (situation as any)[field];
      return raw !== undefined && raw !== null && raw !== '' && Number(raw) !== STORYBOARD_SLIDER_DEFAULT;
    }) ||
    situation.details ||
    situation.detailCustom ||
    (situation.detailPresets && situation.detailPresets.length > 0) ||
    situation.summary ||
    (situation.speakers && situation.speakers.length > 0)
  );
};

const buildSituationSummary = (situation?: SituationConfig | null) => {
  if (!hasActiveSituation(situation)) return '';
  return buildStoryboardSummary(situation);
};


const SECTION_SHORT_DESCRIPTION: Record<string, string> = {
  'Intro': '시작 분위기 설정',
  'Break': '짧은 전환',
  'Stop': '순간 정지',
  'Verse': '이야기 전개',
  'Verse 1': '첫 이야기 전개',
  'Verse 2': '두 번째 전개',
  'Verse A': '첫 이야기 전개',
  'Verse B': '두 번째 전개',
  'Pre-Chorus': '후렴 전 고조',
  'Chorus': '핵심 후렴',
  'Hook': '반복 훅 구간',
  'Drop': '비트 폭발 구간',
  'Bridge': '흐름 전환 구간',
  'Breakdown': '에너지 낮춤',
  'Instrumental': '악기 연주 구간',
  'Solo': '악기 독주 구간',
  'Rap Verse': '랩 전개 구간',
  'Final Chorus': '마지막 후렴',
  'Outro': '마무리 구간',
  'Theme A': '첫 번째 테마',
  'Theme B': '두 번째 테마',
  'Build-up': '에너지 고조',
  'Main Theme': '핵심 테마 연주',
  'Climax': '최고조 구간',
};

const getSectionShortDescription = (section: string, fallback?: string) => {
  const normalized = String(section || '').trim();
  return SECTION_SHORT_DESCRIPTION[normalized]
    || SECTION_SHORT_DESCRIPTION[normalized.replace(/\s+\d+$/g, '').trim()]
    || (fallback ? '직접 추가 섹션' : '섹션 설명');
};

const ReorderableSectionItem = ({ 
  item, 
  index, 
  onEdit, 
  onRemove, 
  onHover,
  onSelect,
  onDragStart,
  isReorderDragging,
  isDraggingItem,
  isInsertionTarget,
  sectionDisplayLabel,
  tagDisplayLabel,
}: { 
  item: CustomSectionItem; 
  index: number; 
  onEdit: (index: number) => void; 
  onRemove: (index: number) => void; 
  onHover: (item: CategoryItem | null) => void;
  onSelect: (index: number) => void;
  onDragStart: (index: number, event: React.PointerEvent<HTMLButtonElement>) => void;
  isReorderDragging?: boolean;
  isDraggingItem?: boolean;
  isInsertionTarget?: boolean;
  sectionDisplayLabel?: string;
  tagDisplayLabel?: (tag: string) => string;
  key?: React.Key;
}) => {
  return (
    <div
      data-reorder-section-id={item.id}
      onClick={() => {
        if (isReorderDragging) return;
        onSelect(index);
      }}
      className={cn(
        "flex items-center gap-2 rounded-2xl bg-[var(--bg-secondary)] border px-3 py-2.5 select-none shadow-sm cursor-pointer transition-[border-color,background-color,opacity,transform] duration-150",
        isDraggingItem
          ? "border-brand-orange/70 bg-white/[0.08] opacity-80 scale-[0.995]"
          : isInsertionTarget
            ? "border-white/70 bg-white/[0.07] ring-1 ring-white/35"
            : "border-btn-border hover:border-white/30 hover:bg-white/[0.04]"
      )}
    >
      <button
        onPointerDown={(e) => onDragStart(index, e)}
        onClick={(e) => e.stopPropagation()}
        className="w-8 h-8 rounded-lg border bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover transition-all flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 touch-none shadow-btn"
        onMouseEnter={() => onHover({ id: 'section-drag', label: '순서 변경', description: '이 버튼을 누른 채 위아래로 드래그하여 순서를 변경합니다. 목록 끝에 가까워지면 자동으로 스크롤됩니다.' })}
        onMouseLeave={() => onHover(null)}
      >
        <ArrowUpDown className="w-[18px] h-[18px]" />
      </button>

      <span className="w-6 h-6 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-black flex items-center justify-center shrink-0">
        {index + 1}
      </span>
      
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-[var(--text-primary)] block">{sectionDisplayLabel || item.section}</span>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed break-keep">
          {getSectionShortDescription(String(item.section), sectionDisplayLabel)}
        </p>
        {(item.tags ?? []).length > 0 && (
          <p className="text-[10px] text-amber-300/80 font-medium mt-1 truncate">
            {(item.tags ?? [])
              .map((tag) => tagDisplayLabel ? tagDisplayLabel(tag) : tag)
              .filter(Boolean)
              .filter((tag, idx, arr) => arr.findIndex((other) => String(other).toLowerCase() === String(tag).toLowerCase()) === idx)
              .join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(index); }}
          onMouseEnter={() => onHover({ id: 'section-edit-tags', label: '태그 편집', description: '이 섹션에 세부 디렉션(태그)을 추가하거나 수정합니다.' })}
          onMouseLeave={() => onHover(null)}
          className="w-8 h-8 rounded-lg border bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover transition-all flex items-center justify-center shadow-btn"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          onMouseEnter={() => onHover({ id: 'section-remove', label: '삭제', description: '이 섹션을 구조에서 제거합니다.' })}
          onMouseLeave={() => onHover(null)}
          className="w-8 h-8 rounded-lg border bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function SecondaryScrollControl() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const isDraggingRef = useRef(false);
  const dragYRef = useRef(0);
  const startY = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Max drag distance (track height is 160px, circle radius is 12px)
  const MAX_DRAG = 65;

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      // Show if page is long enough, regardless of current scroll position
      setIsVisible(scrollHeight > clientHeight * 1.2);
      
      // Show on scroll
      setIsActive(true);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      activeTimerRef.current = setTimeout(() => setIsActive(false), 2000);
    };

    const checkModal = () => {
      // Check if the lyrics modal is open (it has z-[100])
      const modal = document.querySelector('.z-\\[100\\]');
      setIsModalOpen(!!modal);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    const modalInterval = setInterval(checkModal, 500);
    
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearInterval(modalInterval);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    };
  }, []);

  const stopScrolling = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragYRef.current = 0;
    setDragY(0);
    
    if (scrollRaf.current) {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = null;
    }
    
    // Restore scroll behavior
    document.documentElement.style.scrollBehavior = '';
    
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => setIsActive(false), 999);
  }, []);

  // Global cleanup for safety
  useEffect(() => {
    const handleGlobalStop = () => stopScrolling();
    window.addEventListener('blur', handleGlobalStop);
    window.addEventListener('visibilitychange', handleGlobalStop);
    return () => {
      window.removeEventListener('blur', handleGlobalStop);
      window.removeEventListener('visibilitychange', handleGlobalStop);
    };
  }, [stopScrolling]);

  useEffect(() => {
    const scroll = () => {
      if (!isDraggingRef.current) {
        if (scrollRaf.current) {
          cancelAnimationFrame(scrollRaf.current);
          scrollRaf.current = null;
        }
        return;
      }

      const speedFactor = 0.4;
      const speed = dragYRef.current * speedFactor;
      const clampedSpeed = Math.max(-40, Math.min(40, speed));
      
      // Boundary checks with small epsilon
      const isAtTop = window.scrollY <= 0.5;
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      const canScrollUp = clampedSpeed < 0 && !isAtTop;
      const canScrollDown = clampedSpeed > 0 && !isAtBottom;

      if ((canScrollUp || canScrollDown) && Math.abs(clampedSpeed) > 1.5) {
        window.scrollBy(0, clampedSpeed);
      }
      
      scrollRaf.current = requestAnimationFrame(scroll);
    };

    if (isDragging) {
      // Disable smooth scroll during drag to prevent lag/infinite loops
      document.documentElement.style.scrollBehavior = 'auto';
      scrollRaf.current = requestAnimationFrame(scroll);
    } else {
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = null;
      }
    }

    return () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    };
  }, [isDragging, stopScrolling]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      const delta = e.clientY - startY.current;
      const clampedDelta = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, delta));
      setDragY(clampedDelta);
      dragYRef.current = clampedDelta;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    stopScrolling();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    stopScrolling();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {(isActive || isDragging || isVisible) && !isModalOpen && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ 
            opacity: (isActive || isDragging) ? 1 : 0.3, 
            x: 0 
          }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-2 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center pointer-events-none"
        >
          <div className="relative h-40 w-8 flex items-center justify-center">
            {/* Track Visual */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-btn-border/30 rounded-full" />
            
            {/* Control Circle (Reduced Size) */}
            <motion.div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              animate={{ y: isDragging ? dragY : 0 }}
              transition={isDragging ? { type: "just" } : { type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "w-6 h-6 rounded-full bg-zinc-900/80 backdrop-blur-md border border-brand-orange/40 shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto touch-none transition-colors",
                isDragging ? "border-brand-orange bg-zinc-800" : "hover:border-brand-orange/60"
              )}
            >
              <div className={cn(
                "w-1 h-1 rounded-full transition-all",
                isDragging ? "bg-brand-orange scale-125" : "bg-brand-orange/60"
              )} />
              
              {isDragging && Math.abs(dragY) > 10 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {dragY < 0 ? (
                    <ChevronUp className="w-3 h-3 text-brand-orange/60 animate-pulse" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-brand-orange/60 animate-pulse" />
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const FavoritesPageLazy = lazy(() => import('./pages/FavoritesPage'));
const AdminVocalTonesPageLazy = lazy(() => import('./pages/AdminVocalTonesPage'));
const AdminSectionTagsPageLazy = lazy(() => import('./pages/AdminSectionTagsPage'));
const AdminUserManagementPageLazy = lazy(() => import('./pages/AdminUserManagementPage'));
const SunoLibraryPageLazy = lazy(() => import('./pages/SunoLibraryPage'));
const SunoApiSettingsPageLazy = lazy(() => import('./pages/SunoApiSettingsPage'));
const MyPageLazy = lazy(() => import('./pages/MyPage'));
const HomePageLazy = lazy(() => import('./pages/HomePage'));
const AdminSunoApiPageLazy = lazy(() => import('./pages/AdminSunoApiPage'));

const TROT_GENRES = ['traditional-trot', 'semi-trot'];

const GENRE_BPM: Record<string, { min: number; max: number }> = {
  'ballad': { min: 60, max: 85 },
  'pop': { min: 100, max: 130 },
  'jazz': { min: 70, max: 120 },
  'rnb': { min: 65, max: 95 },
  'hip-hop': { min: 80, max: 110 },
  'rock': { min: 110, max: 150 },
  'metal': { min: 120, max: 160 },
  'latin': { min: 95, max: 135 },
  'dance': { min: 120, max: 140 },
  'synth': { min: 105, max: 135 },
  'electronic': { min: 115, max: 150 },
  'piano': { min: 40, max: 90 },
  'new-age': { min: 40, max: 80 },
  'country': { min: 85, max: 125 },
  'traditional-trot': { min: 60, max: 90 },
  'semi-trot': { min: 120, max: 150 },
  'jpop': { min: 115, max: 145 },
  'guitar': { min: 70, max: 130 }
};

const SUBGENRE_BPM: Record<string, { min: number; max: number }> = {
  'synth_pop': { min: 110, max: 135 },
  'disco': { min: 115, max: 130 },
  'electropop': { min: 120, max: 140 },
  'teen_pop': { min: 100, max: 130 },
  'britpop': { min: 110, max: 140 },
  'indie_pop': { min: 90, max: 125 },
  'city_pop': { min: 105, max: 125 },
  'funk_pop': { min: 100, max: 125 },
  'dance_pop': { min: 120, max: 140 },
  'acoustic_pop': { min: 70, max: 110 },
  'idol_dance': { min: 120, max: 145 },
  'k_ballad': { min: 60, max: 85 },
  'k_synth_pop': { min: 110, max: 135 },
  'k_trap': { min: 130, max: 160 },
  'k_new_jack_swing': { min: 100, max: 115 },
  'k_indie': { min: 80, max: 115 },
  'k_folk': { min: 70, max: 100 },
  'k_rock': { min: 120, max: 155 },
  'gugak_fusion': { min: 80, max: 130 },
  'trap': { min: 130, max: 160 },
  'drill': { min: 140, max: 150 },
  'boombap': { min: 85, max: 100 },
  'lofi': { min: 70, max: 95 },
  'jazz_hiphop': { min: 85, max: 105 },
  'emo_rap': { min: 120, max: 160 },
  'old_school': { min: 90, max: 110 },
  'g_funk': { min: 85, max: 100 },
  'cloud_rap': { min: 110, max: 150 },
  'contemporary_rnb': { min: 65, max: 95 },
  'neo_soul': { min: 70, max: 95 },
  'soul': { min: 70, max: 110 },
  'funk': { min: 100, max: 120 },
  'alternative_rnb': { min: 60, max: 90 },
  'new_jack_swing': { min: 100, max: 115 },
  'alternative_rock': { min: 110, max: 150 },
  'modern_rock': { min: 115, max: 145 },
  'punk_rock': { min: 140, max: 170 },
  'hard_rock': { min: 110, max: 140 },
  'soft_rock': { min: 80, max: 120 },
  'garage_rock': { min: 120, max: 160 },
  'shoegazing': { min: 90, max: 130 },
  'folk_rock': { min: 100, max: 130 },
  'blues_rock': { min: 90, max: 130 },
  'heavy_metal': { min: 120, max: 160 },
  'death_metal': { min: 140, max: 180 },
  'thrash_metal': { min: 150, max: 190 },
  'metalcore': { min: 130, max: 170 },
  'nu_metal': { min: 90, max: 120 },
  'symphonic_metal': { min: 120, max: 160 },
  'power_metal': { min: 150, max: 180 },
  'house': { min: 120, max: 130 },
  'techno': { min: 125, max: 145 },
  'trance': { min: 130, max: 145 },
  'future_bass': { min: 140, max: 170 },
  'dubstep': { min: 140, max: 150 },
  'deep_house': { min: 115, max: 125 },
  'tropical_house': { min: 100, max: 120 },
  'eurobeat': { min: 150, max: 165 },
  'drum_and_bass': { min: 165, max: 185 },
  'swing_jazz': { min: 120, max: 180 },
  'bossa_nova': { min: 80, max: 120 },
  'fusion_jazz': { min: 100, max: 140 },
  'cool_jazz': { min: 70, max: 100 },
  'big_band': { min: 120, max: 160 },
  'latin_jazz': { min: 110, max: 150 },
  'jazz_vocal': { min: 70, max: 120 },
  'hard_bop': { min: 140, max: 200 },
  'traditional_folk': { min: 80, max: 120 },
  'country': { min: 90, max: 130 },
  'bluegrass': { min: 130, max: 170 },
  'singer_songwriter': { min: 70, max: 110 },
  'acoustic_session': { min: 70, max: 120 },
  'fingerstyle': { min: 70, max: 110 },
  'reggae': { min: 80, max: 100 },
  'afrobeat': { min: 110, max: 130 },
  'celtic': { min: 100, max: 140 },
  'latin_salsa': { min: 160, max: 200 },
  'flamenco': { min: 100, max: 160 },
  'traditional_trot': { min: 60, max: 90 },
  'semi_trot': { min: 120, max: 150 },
  'disco_trot': { min: 125, max: 145 },
  'rock_trot': { min: 120, max: 150 },
  'ballad_trot': { min: 65, max: 90 },
  'blues_trot': { min: 70, max: 100 },
  'shuffle_trot': { min: 110, max: 135 },
  'gugak_trot': { min: 80, max: 120 },
  '7080_folk': { min: 80, max: 110 },
  'adult_ballad': { min: 60, max: 85 },
  'campus_band_sound': { min: 110, max: 140 },
  'enka_style': { min: 60, max: 90 },
  'orchestral_score': { min: 60, max: 140 },
  'hybrid_epic': { min: 80, max: 150 },
  'synth_score': { min: 90, max: 130 },
  'piano_solo': { min: 40, max: 90 },
  'string_ensemble': { min: 50, max: 110 },
  'chiptune': { min: 120, max: 160 },
  'world_music': { min: 80, max: 140 },
  'minimalism': { min: 90, max: 130 },
  'ambient': { min: 40, max: 80 },
};

const MOOD_BPM: Record<string, { min: number; max: number }> = {
  'emotional': { min: 55, max: 90 },
  'sad': { min: 50, max: 82 },
  'warm': { min: 70, max: 105 },
  'calm': { min: 45, max: 78 },
  'dark': { min: 60, max: 100 },
  'bright': { min: 105, max: 135 },
  'hopeful': { min: 80, max: 118 },
  'lonely': { min: 45, max: 80 },
  'nostalgic': { min: 55, max: 88 },
  'dreamy': { min: 55, max: 92 },
  'tense': { min: 85, max: 125 },
  'peaceful': { min: 45, max: 76 }
};

const CYCLE_VARIANT_COLORS = [
  "bg-[#A47048]/72 border-[#C69A76]/55 text-[#FFF7EF] shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
  "bg-[#AC6B69]/72 border-[#D8A4A2]/50 text-[#FFF4F3] shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
  "bg-[#965B77]/72 border-[#C995AC]/50 text-[#FFF2F8] shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
  "bg-[#877198]/72 border-[#BBA8CA]/50 text-[#F8F1FF] shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
  "bg-[#5E7FA8]/72 border-[#A7BCD8]/50 text-[#F1F7FF] shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
] as const;

function buildCycleLookup<T extends { variants: readonly { id: string }[] }>(cycles: readonly T[]) {
  return cycles.reduce<Record<string, T>>((acc, cycle) => {
    cycle.variants.forEach((variant) => {
      acc[variant.id] = cycle;
    });
    return acc;
  }, {});
}

const SOUND_TEXTURE_CYCLE_LOOKUP = buildCycleLookup(SOUND_TEXTURE_CYCLES);

function getCycleVariantLabel(cycles: readonly { id: string; title: string; variants: readonly { id: string; label: string }[] }[], selectedIds: string[]) {
  return cycles
    .map((cycle) => cycle.variants.find((variant) => selectedIds.includes(variant.id)))
    .filter(Boolean)
    .map((variant) => variant!.label);
}

const mapLabelsToIds = (labels: string[], category: CategoryItem[]) => {
  return labels.map(label => {
    const raw = String(label || '').trim();
    if (!raw) return null;

    // Preserve direct-input pseudo IDs as-is.
    if (isCustomMoodKeyword(raw) || isCustomThemeKeyword(raw)) {
      return raw;
    }

    // Special case for City Pop and K-Pop which might have extra labels
    if (raw.includes('City Pop') || raw === '80s Japanese Pop' || raw === 'Funk' || raw === 'Groovy' || raw === 'Retro' || raw === 'Nu-Disco' || raw === 'Synth-pop') {
      return 'citypop';
    }
    if (raw.includes('K-Pop')) {
      return 'kpop';
    }
    const item = category.find(c => c.label === raw || c.labelKo === raw || c.id === raw);
    return item ? item.id : null;
  }).filter(Boolean) as string[];
};

const resolveMidGenreId = (val: string) => {
  // 1. Check Hierarchy Main (MID)
  for (const group of GENRE_HIERARCHY) {
    const main = group.children.find(m => m.id === val || m.label === val || m.labelKo === val);
    if (main) return main.id;
  }
  // 2. Check Hierarchy Sub (if stored in genre[] by mistake)
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      const sub = main.children.find(s => s.id === val || s.label === val || s.labelKo === val);
      if (sub) return main.id;
    }
  }
  // 3. Fallback to GENRES but map to Hierarchy
  const item = GENRES.find(c => c.id === val || c.label === val || c.id === val.replace('_', '-'));
  if (item) {
    for (const group of GENRE_HIERARCHY) {
      const main = group.children.find(m => m.label === item.label || m.labelKo === item.labelKo || m.id === item.id.replace('-', '_'));
      if (main) return main.id;
    }
    return item.id;
  }
  return null;
};

const resolveSubGenreId = (val: string) => {
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      const sub = main.children.find(s => s.id === val || s.label === val || s.labelKo === val);
      if (sub) return sub.id;
    }
  }
  return null;
};

function isSeparatorKeywordId(value: unknown): boolean {
  return /^separator[-_]/i.test(String(value || '').trim());
}

function isSelectableKeywordItem(item: any): boolean {
  return Boolean(item && item.kind !== 'separator' && !isSeparatorKeywordId(item.id));
}

function filterSelectableIds(values: string[] = []) {
  return values.filter((value) => value && !isSeparatorKeywordId(value));
}

function resolveStyleIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => STYLE_LABEL_TO_ID[value] ?? (STYLE_VARIANT_LOOKUP[value] && !isSeparatorKeywordId(value) ? value : null)).filter(Boolean) as string[]));
}

function resolveSoundTextureIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => SOUND_LABEL_TO_ID[value] ?? (SOUND_VARIANT_LOOKUP[value] && !isSeparatorKeywordId(value) ? value : null)).filter(Boolean) as string[]));
}

function getStyleVariantLabelById(id: string) {
  if (isSeparatorKeywordId(id)) return '';
  const variant = STYLE_VARIANT_LOOKUP[id];
  if ((variant as any)?.kind === 'separator') return '';
  return variant?.labelKo || variant?.label || id;
}

function getSoundVariantLabelById(id: string) {
  if (isSeparatorKeywordId(id)) return '';
  const variant = SOUND_VARIANT_LOOKUP[id];
  if ((variant as any)?.kind === 'separator') return '';
  return variant?.labelKo || variant?.label || id;
}

function getPointSoundTagLabelById(id: string) {
  if (isSeparatorKeywordId(id)) return '';
  const variant = SOUND_VARIANT_LOOKUP[id] as any;
  if (variant?.kind === 'separator') return '';
  const raw = String(
    variant?.promptCore ||
    variant?.sound ||
    variant?.style ||
    variant?.label ||
    id
  ).trim();

  const compact = raw
    .split(',')[0]
    .replace(/\s+-\s+.*$/g, '')
    .replace(/[가-힣]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return compact || variant?.label || id;
}

function getPointSoundTagDisplayLabelById(id: string) {
  if (isSeparatorKeywordId(id)) return '';
  const variant = SOUND_VARIANT_LOOKUP[id] as any;
  if (variant?.kind === 'separator') return '';
  return String(variant?.labelKo || variant?.label || getPointSoundTagLabelById(id)).trim();
}

function safeVocalTagPart(value: string) {
  return String(value || '')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[,|:/-]+\s*|\s*[,|:/-]+\s*$/g, '')
    .trim();
}

function getMemberVisibleName(member: VocalMember, index: number, members: VocalMember[]) {
  const sameGenderBefore = members.slice(0, index).filter((item) => item.gender === member.gender).length + 1;
  return `${member.gender === 'male' ? '남성' : '여성'}${sameGenderBefore}`;
}

function inferVocalActualLabel(member: VocalMember) {
  const genderLabel = member.gender === 'male' ? 'Male' : 'Female';
  const role = member.roles?.includes('rapper') ? 'Rap Vocal' : 'Vocal';
  const char = member.character || {};
  const phrase = [
    VOCAL_VOICE_TONES.find((item) => item.id === char.voiceToneId)?.promptCore,
    VOCAL_PERSONALITIES.find((item) => item.id === char.personalityId)?.promptCore,
    ...getVocalCharacterScalePromptParts(char),
    ...(char.techniqueIds || []).map((id) => VOCAL_TECHNIQUES.find((item) => item.id === id)?.promptCore),
    char.customVoiceTone,
    char.customPersonality,
    char.customTechnique,
  ].filter(Boolean).join(' ').toLowerCase();

  if (role === 'Rap Vocal') {
    if (/deep|heavy|chest|low|묵직|흉성/.test(phrase)) return `Low ${genderLabel} Rap Vocal`;
    if (/wet|nasal|glissando|젖은|비성/.test(phrase)) return `Wet ${genderLabel} Rap Vocal`;
    if (/creaky|growl|rough|거친|크리키/.test(phrase)) return `Creaky ${genderLabel} Rap Vocal`;
    if (/bright|head|clear|두성|맑/.test(phrase)) return `Bright ${genderLabel} Rap Vocal`;
    if (/playful|flip|click|rhythmic|톡톡|글로탈/.test(phrase)) return `Playful ${genderLabel} Rap Vocal`;
    return `${genderLabel} Rap Vocal`;
  }

  if (/hollow|distant|empty|공허/.test(phrase)) return `Hollow ${genderLabel} Vocal`;
  if (/airy|falsetto|breath|에어리|팔세토|브레시/.test(phrase)) return `Airy ${genderLabel} Vocal`;
  if (/clear|bright|head|first-love|맑|첫사랑/.test(phrase)) return `Clear ${genderLabel} Vocal`;
  if (/wet|nasal|젖은|비성/.test(phrase)) return `Wet ${genderLabel} Vocal`;
  if (/deep|heavy|chest|low|묵직/.test(phrase)) return `Deep ${genderLabel} Vocal`;
  return `${genderLabel} Vocal`;
}

function compactVocalLyricCueText(value: string, isRap: boolean) {
  const raw = safeVocalTagPart(value).toLowerCase();
  if (!raw) return '';

  const cueMap: Array<[RegExp, string]> = [
    [/anticipat|앞박|당겨/, isRap ? 'anticipated rap' : 'anticipated'],
    [/nasal|비성|비음/, 'nasal'],
    [/falsetto|가성/, 'thin falsetto'],
    [/breathy|breath|숨|에어리|airy/, 'breathy'],
    [/half[-_\s]?air|air stop|하프/, 'half-air'],
    [/reverse[-_\s]?breath|역호흡/, 'reverse breath'],
    [/microtonal|미분음|melting/, 'melting slides'],
    [/glissando|글리산도|slide/, 'glissando'],
    [/layback|laid[-\s]?back|느슨/, 'laid-back'],
    [/staccato|스타카토/, 'staccato'],
    [/vibrato|비브라토/, 'vibrato'],
    [/husky|허스키/, 'husky'],
    [/creaky|fry|크리키/, 'creaky'],
    [/bright|밝|lively/, 'bright'],
    [/lazy|relaxed|게으른/, 'lazy'],
    [/dry|건조/, 'dry'],
    [/wet|젖은/, 'wet'],
    [/clear|맑|clean/, 'clear'],
    [/low|deep|heavy|낮|저음|묵직/, 'low'],
    [/playful|bounce|bouncy|장난|톡톡/, 'playful bounce'],
    [/whisper|속삭/, 'whisper'],
  ];

  for (const [pattern, cue] of cueMap) {
    if (pattern.test(raw)) return cue;
  }
  return safeVocalTagPart(value)
    .replace(/\b(?:vocal\s+tone|vocal|tone|phrasing|resonance|delivery|voice)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/[,，]/)[0]
    .trim();
}

function buildCompactVocalCue(member: VocalMember) {
  const char = member.character || {};
  const isRap = member.roles?.includes('rapper');
  const selectedTechniqueTexts = (char.techniqueIds || [])
    .map((id) => {
      const item = VOCAL_TECHNIQUES.find((technique) => technique.id === id);
      return item?.promptCore || item?.label || item?.labelKo || id;
    })
    .filter(Boolean);

  const selectedToneText = VOCAL_VOICE_TONES.find((item) => item.id === char.voiceToneId)?.promptCore || char.customVoiceTone || '';
  const selectedPersonalityText = VOCAL_PERSONALITIES.find((item) => item.id === char.personalityId)?.promptCore || char.customPersonality || '';
  const scalePromptTexts = getVocalCharacterScalePromptParts(char);
  const customTechniqueText = char.customTechnique || '';

  const cues: string[] = [];
  const pushCue = (cue: string) => {
    const clean = safeVocalTagPart(cue);
    if (!clean) return;
    if (!cues.some((item) => item.toLowerCase() === clean.toLowerCase())) cues.push(clean);
  };

  // 게이지 기반 캐릭터 cue를 우선 압축하고, 기존 선택형 창법은 보조로 유지한다.
  scalePromptTexts.forEach((text) => pushCue(compactVocalLyricCueText(text, isRap)));
  selectedTechniqueTexts.forEach((text) => pushCue(compactVocalLyricCueText(text, isRap)));
  if (customTechniqueText) pushCue(compactVocalLyricCueText(customTechniqueText, isRap));

  // 창법 cue가 부족할 때만 톤/성격에서 1개를 보강한다.
  if (cues.length < 1 && selectedToneText) pushCue(compactVocalLyricCueText(selectedToneText, isRap));
  if (cues.length < 1 && selectedPersonalityText) pushCue(compactVocalLyricCueText(selectedPersonalityText, isRap));

  // 너무 긴 보컬 설명을 반복하지 않기 위해 가사 섹션에는 대표 창법 cue 1개만 둔다.
  return cues.slice(0, 1).join(', ');
}

function buildVocalSectionTagOptions(members: VocalMember[], vocalMode: VocalMode): VocalSectionTagOption[] {
  if (vocalMode !== 'group' || members.length === 0) return [];
  const options = members.slice(0, 5).map((member, index) => {
    const displayLabel = getMemberVisibleName(member, index, members);
    const actualLabel = inferVocalActualLabel(member);
    const cue = buildCompactVocalCue(member);
    return {
      tag: `VOCAL::${safeVocalTagPart(actualLabel)}::${safeVocalTagPart(cue)}`,
      displayLabel,
      description: `${displayLabel}를 이 섹션에 단독 배치합니다. 실제 가사 태그에는 ${actualLabel}${cue ? `, ${cue}` : ''}로 적용되고 ONLY가 붙습니다.`,
    };
  });
  if (options.length >= 2) {
    options.push({ tag: 'VOCAL_ALL::All Vocals::', displayLabel: '전체보컬', description: '이 섹션을 모든 보컬이 함께 부르는 구간으로 지정합니다. ONLY는 붙지 않습니다.' });
  }
  return options;
}

function buildThemeSentence(themeLabels: string[] = []): string {
  if (!themeLabels.length) return '';
  if (themeLabels.length === 1) return `Focused on ${themeLabels[0].toLowerCase()}.`;
  if (themeLabels.length === 2) {
    return `Focused on ${themeLabels[0].toLowerCase()} and ${themeLabels[1].toLowerCase()}.`;
  }
  const lowered = themeLabels.map((label) => label.toLowerCase());
  return `Focused on ${lowered.slice(0, -1).join(', ')}, and ${lowered[lowered.length - 1]}.`;
}


const TEMPO_MIN_BPM = 20;
const TEMPO_MAX_BPM = 200;
const TEMPO_MAX_ACTIVE_RANGE = 20;

type BpmRange = { min: number; max: number };

const INSTRUMENTAL_BGM_BASE_BPM: Record<string, BpmRange> = {
  lofi_study: { min: 66, max: 88 },
  cafe_bgm: { min: 74, max: 98 },
  nature_ambience: { min: 38, max: 62 },
  healing_piano: { min: 46, max: 74 },
  ambient: { min: 42, max: 70 },
  minimalism: { min: 60, max: 104 },
  piano_solo: { min: 44, max: 78 },
  string_ensemble: { min: 50, max: 84 },
};

const INSTRUMENTAL_BGM_SLOW_MOOD_IDS = new Set([
  'calm', 'relaxing', 'zen', 'healing', 'peaceful', 'restrained',
  'sad', 'sorrowful', 'melancholic', 'lonely', 'wistful', 'hollow',
  'dark', 'moody', 'chilly', 'fragile_edge', 'soft_tender', 'tender',
]);

const INSTRUMENTAL_BGM_FAST_MOOD_IDS = new Set([
  'bright', 'hopeful', 'cheerful', 'playful_mischief', 'cheeky_deadpan',
  'comedic', 'quirky', 'cute_mood', 'upbeat', 'swelling', 'powerful',
  'infectious', 'tense', 'uneasy', 'groovy',
]);

const clampBpm = (value: number) => Math.max(TEMPO_MIN_BPM, Math.min(TEMPO_MAX_BPM, Math.round(value)));

const calculateInstrumentalBgmBPM = (genres: string[], moods: string[], subGenre: string[] = []): BpmRange | null => {
  const mainBgmId = [...subGenre, ...genres].find((id) => isInstrumentalBgmGenreId(id));
  if (!mainBgmId) return null;

  const base = INSTRUMENTAL_BGM_BASE_BPM[mainBgmId] || { min: 54, max: 88 };
  const slowHits = moods.filter((id) => INSTRUMENTAL_BGM_SLOW_MOOD_IDS.has(id)).length;
  const fastHits = moods.filter((id) => INSTRUMENTAL_BGM_FAST_MOOD_IDS.has(id)).length;
  const moodShift = Math.max(-12, Math.min(12, (fastHits - slowHits) * 4));

  let adjustedMin = clampBpm(base.min + moodShift);
  let adjustedMax = clampBpm(base.max + moodShift);

  // Keep BGM ranges musical: calm/ambient genres should not jump into pop-song tempo territory.
  if (['nature_ambience', 'ambient', 'healing_piano', 'piano_solo', 'string_ensemble'].includes(mainBgmId)) {
    adjustedMax = Math.min(adjustedMax, mainBgmId === 'nature_ambience' || mainBgmId === 'ambient' ? 78 : 92);
  }

  const availableRange = Math.max(8, adjustedMax - adjustedMin);
  const activeRange = Math.min(TEMPO_MAX_ACTIVE_RANGE, Math.max(10, Math.round(availableRange * 0.45)));
  const startMax = Math.max(adjustedMin, adjustedMax - activeRange);
  const min = clampBpm(adjustedMin + Math.floor(Math.random() * Math.max(1, startMax - adjustedMin + 1)));
  const max = clampBpm(Math.min(adjustedMax, min + activeRange));

  return { min, max };
};

const calculateOptimalBPM = (genres: string[], moods: string[], subGenre: string[] = []) => {
  const instrumentalBgmBpm = calculateInstrumentalBgmBPM(genres, moods, subGenre);
  if (instrumentalBgmBpm) return instrumentalBgmBpm;

  let sumMin = 0;
  let sumMax = 0;
  let count = 0;

  // 1. Sub-genres (Highest weight)
  subGenre.forEach(sg => {
    if (SUBGENRE_BPM[sg]) {
      sumMin += SUBGENRE_BPM[sg].min * 2;
      sumMax += SUBGENRE_BPM[sg].max * 2;
      count += 2;
    }
  });

  // 2. Genres
  genres.forEach(g => {
    if (GENRE_BPM[g]) {
      sumMin += GENRE_BPM[g].min;
      sumMax += GENRE_BPM[g].max;
      count++;
    }
  });

  // 3. Moods
  moods.forEach(m => {
    if (MOOD_BPM[m]) {
      sumMin += MOOD_BPM[m].min;
      sumMax += MOOD_BPM[m].max;
      count++;
    }
  });

  if (count === 0) {
    const base = Math.floor(Math.random() * (140 - 50 + 1)) + 50;
    return { min: base, max: base + Math.floor(Math.random() * 21) };
  }

  let avgMin = Math.round(sumMin / count);
  let avgMax = Math.round(sumMax / count);

  const range = avgMax - avgMin;
  const finalMin = Math.max(TEMPO_MIN_BPM, avgMin + Math.floor(Math.random() * (range / 4)));
  const finalMax = Math.min(TEMPO_MAX_BPM, finalMin + Math.max(10, Math.floor(Math.random() * (range / 2 + 10))));

  return { min: finalMin, max: finalMax };
};


export function getTimestampMs(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

const formatGeneratedDateTimeLabel = (value: any): string => {
  const ms = getTimestampMs(value);
  if (!ms) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}.${month}.${day} ${hours}:${minutes} 생성`;
};

import { GlobalPlayerProvider } from './contexts/GlobalPlayerContext';
import GlobalPlayer from './components/GlobalPlayer';

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <GlobalPlayerProvider>
        <App />
      </GlobalPlayerProvider>
    </ErrorBoundary>
  );
}

function Navigation({ user, handleLogin, isLoggingIn, handleLogout, isAdminUser, rememberLogin, setRememberLogin, sunoLibrarySignal, sunoLibrarySignalDotClass, clearSunoLibrarySignal }: { user: User | null; handleLogin: () => void; isLoggingIn: boolean; handleLogout: () => void; isAdminUser: boolean; rememberLogin: boolean; setRememberLogin: React.Dispatch<React.SetStateAction<boolean>>; sunoLibrarySignal: 'generating' | 'completed' | null; sunoLibrarySignalDotClass: string; clearSunoLibrarySignal: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const goToTopNav = (path: string, options?: { clearSuno?: boolean }) => {
    if (!user) {
      handleLogin();
      return;
    }
    if (options?.clearSuno) clearSunoLibrarySignal();
    if (location.pathname === path) {
      scrollToTop();
    } else {
      navigate(path);
    }
    setIsExpanded(false);
    setIsProfileOpen(false);
  };

  const topNavItems: Array<{ path: string; label: string; icon: React.ElementType; clearSuno?: boolean }> = [
    { path: '/', label: '홈', icon: HomeIcon },
    { path: '/studio', label: '스튜디오', icon: Zap },
    { path: '/history', label: '뮤직노트', icon: HeartIcon },
    { path: '/suno-library', label: '라이브러리', icon: Library, clearSuno: true },
    { path: '/my-page', label: '마이페이지', icon: UserIcon },
  ];

  // Collapse menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setIsProfileOpen(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setIsProfileOpen(false);
    }, 2000);
  };

  const handleProfileMouseEnter = () => {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    setIsProfileOpen(true);
  };

  const handleProfileMouseLeave = () => {
    profileTimeoutRef.current = setTimeout(() => {
      setIsProfileOpen(false);
    }, 150); // Small delay to prevent flickering
  };

  // Collapse menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsExpanded(false);
      setIsProfileOpen(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHomeClick = () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (location.pathname === '/') {
      scrollToTop();
    } else {
      navigate('/');
    }
    setIsExpanded(false);
  };

  const handleStudioClick = () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (location.pathname === '/studio') {
      scrollToTop();
    } else {
      navigate('/studio');
    }
    setIsExpanded(false);
  };

  const handleHistoryClick = () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (location.pathname === '/history') {
      scrollToTop();
    } else {
      navigate('/history');
    }
    setIsExpanded(false);
  };

  return (
    <>
      {/* Top Navigation */}
      <div
        className="absolute left-0 z-[60] hidden w-full items-center justify-between gap-3 border-b border-white/10 bg-[#101010]/92 px-5 py-3.5 shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:flex"
      >
        <button
          type="button"
          onClick={() => goToTopNav('/')}
          className="flex min-w-[176px] shrink-0 items-center rounded-xl px-3 py-2 text-left transition-all hover:bg-white/[0.04]"
        >
          <span className="font-display text-[22px] font-black leading-none tracking-tight bg-gradient-to-r from-[#F0D37C] via-[#F09B83] to-[#D86D8E] bg-clip-text text-transparent drop-shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            SORiDRAW
          </span>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-visible">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.path);
            const signalActive = item.path === '/suno-library' && sunoLibrarySignal;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goToTopNav(item.path, { clearSuno: item.clearSuno })}
                className={cn(
                  "relative flex h-11 items-center gap-2.5 rounded-2xl px-3 text-[14px] font-black transition-all whitespace-nowrap sm:px-4",
                  active
                    ? "bg-transparent text-white"
                    : "bg-transparent text-white/60 hover:text-white"
                )}
              >
                {signalActive && (
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black/50 ${sunoLibrarySignalDotClass}`} />
                )}
                <Icon className="h-6 w-6" />
                <span className="relative inline-flex items-center pb-1">
                  {item.label}
                  {active && <span className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-[#783159]" />}
                </span>
              </button>
            );
          })}
          {isAdminUser && (
            <button
              type="button"
              onClick={() => goToTopNav('/admin/users')}
              className={cn(
                "relative flex h-11 items-center gap-2.5 rounded-2xl px-3 text-[14px] font-black transition-all whitespace-nowrap sm:px-4",
                isActivePath('/admin')
                  ? "bg-transparent text-white"
                  : "bg-transparent text-white/60 hover:text-white"
              )}
            >
              <Shield className="h-6 w-6" />
              <span className="relative inline-flex items-center pb-1">
                관리자
                {isActivePath('/admin') && <span className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-[#783159]" />}
              </span>
            </button>
          )}
        </div>

        <div className="flex min-w-[176px] shrink-0 items-center justify-end gap-2.5">
          {user && (
            <>
              <a
                href="https://www.flowmusic.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-0 transition-all hover:border-white/20 hover:bg-white/[0.08]"
                title="Flow Music"
                aria-label="Flow Music"
              >
                <img
                  src="/flowmusic-icon.png"
                  alt="Flow Music"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
              <a
                href="https://elevenlabs.io/app/music/history"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-0 transition-all hover:border-white/20 hover:bg-white/[0.08]"
                title="ElevenLabs Music History"
                aria-label="ElevenLabs Music History"
              >
                <img
                  src="/elevenlabs-icon.png"
                  alt="ElevenLabs"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
              <a
                href="https://suno.com/create"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-0 transition-all hover:border-white/20 hover:bg-white/[0.08]"
                title="Suno Create"
                aria-label="Suno Create"
              >
                <img
                  src="/suno-icon.webp"
                  alt="Suno"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
            </>
          )}
          {location.pathname === '/' && !user && (
            <label className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[10px] font-bold text-white/50">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                className="h-3.5 w-3.5 rounded border border-white/20 accent-sky-500"
              />
              로그인 유지
            </label>
          )}
          {user ? (
            <>
              <button
                type="button"
                onClick={() => goToTopNav('/my-page')}
                className="flex h-11 max-w-[54px] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-[14px] font-black text-white/75 transition-all hover:bg-white/[0.07] hover:text-white sm:max-w-[170px] sm:px-4"
              >
                <img
                  src={user.photoURL || 'https://picsum.photos/seed/user/100/100'}
                  alt="Profile"
                  className="h-[30px] w-[30px] shrink-0 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="hidden truncate sm:inline">{user.displayName || 'My'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="flex h-11 items-center gap-2.5 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 text-[14px] font-black text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition-all"
            >
              {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Top Icon Bar */}
      <div
        ref={menuRef}
        className="fixed inset-x-0 top-0 z-[70] flex w-full items-center bg-[#111111]/95 px-3 py-2.5 shadow-[0_8px_22px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:hidden"
      >
        <div className="flex w-full min-w-0 items-center gap-1 overflow-visible">
          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
            <button
              type="button"
              onClick={handleHomeClick}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D]",
                isActivePath('/') && "bg-[#DFA05D]/18 text-[#DFA05D]"
              )}
              aria-label="홈"
              title="홈"
            >
              <HomeIcon className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={handleStudioClick}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D]",
                isActivePath('/studio') && "bg-[#DFA05D]/18 text-[#DFA05D]"
              )}
              aria-label="스튜디오"
              title="스튜디오"
            >
              <Zap className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={handleHistoryClick}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D]",
                isActivePath('/history') && "bg-[#DFA05D]/18 text-[#DFA05D]"
              )}
              aria-label="뮤직노트"
              title="뮤직노트"
            >
              <HeartIcon className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  handleLogin();
                  return;
                }
                clearSunoLibrarySignal();
                navigate('/suno-library');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setIsExpanded(false);
                setIsProfileOpen(false);
              }}
              className={cn(
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D]",
                isActivePath('/suno-library') && "bg-[#DFA05D]/18 text-[#DFA05D]"
              )}
              aria-label="라이브러리"
              title="라이브러리"
            >
              {sunoLibrarySignal && (
                <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-black/40 ${sunoLibrarySignalDotClass}`} />
              )}
              <Library className="h-6 w-6" />
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="relative shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen((prev) => !prev);
                    setIsExpanded(false);
                  }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent transition-all hover:bg-[#DFA05D]/15",
                    isProfileOpen && "bg-[#DFA05D]/18"
                  )}
                  aria-label="마이페이지 메뉴"
                  title="마이페이지"
                >
                  <img
                    src={user.photoURL || 'https://picsum.photos/seed/user/100/100'}
                    alt="Profile"
                    className="h-8 w-8 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D] disabled:opacity-50"
                  aria-label="로그인"
                  title="로그인"
                >
                  {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserIcon className="h-6 w-6" />}
                </button>
              )}

              <AnimatePresence>
                {isProfileOpen && user && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-full z-[80] mt-2 w-36 overflow-hidden rounded-2xl bg-[#181818]/96 p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.48)] backdrop-blur-xl"
                  >
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/admin/users');
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                        }}
                        className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-black text-white/78 transition-all hover:bg-[#DFA05D]/12 hover:text-[#DFA05D]"
                      >
                        <Users className="h-5 w-5" />
                        관리자메뉴
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/my-page');
                        setIsProfileOpen(false);
                        setIsExpanded(false);
                      }}
                      className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-black text-white/78 transition-all hover:bg-[#DFA05D]/12 hover:text-[#DFA05D]"
                    >
                      <UserIcon className="h-5 w-5" />
                      마이페이지
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setIsProfileOpen(false);
                        setIsExpanded(false);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
                      }}
                      className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-black text-[#DFA05D] transition-all hover:bg-[#DFA05D]/12"
                    >
                      <LogOut className="h-5 w-5" />
                      로그아웃
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded((prev) => !prev);
                  setIsProfileOpen(false);
                }}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl bg-transparent text-white/72 transition-all hover:bg-[#DFA05D]/15 hover:text-[#DFA05D]",
                  isExpanded && "bg-[#DFA05D]/18 text-[#DFA05D]"
                )}
                aria-label="외부 앱 메뉴"
                title="메뉴"
              >
                <Menu className={cn("h-6 w-6 transition-transform", isExpanded && "rotate-90")} />
              </button>

              <AnimatePresence>
                {isExpanded && user && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-full z-[80] mt-2 flex flex-col gap-1.5 rounded-xl bg-[#181818]/96 p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.48)] backdrop-blur-xl"
                  >
                    <a
                      href="https://www.flowmusic.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] p-0 transition-all hover:bg-white/[0.1]"
                      title="Flow Music"
                      aria-label="Flow Music"
                    >
                      <img src="/flowmusic-icon.png" alt="Flow Music" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                    <a
                      href="https://elevenlabs.io/app/music/history"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] p-0 transition-all hover:bg-white/[0.1]"
                      title="ElevenLabs Music History"
                      aria-label="ElevenLabs Music History"
                    >
                      <img src="/elevenlabs-icon.png" alt="ElevenLabs" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                    <a
                      href="https://suno.com/create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] p-0 transition-all hover:bg-white/[0.1]"
                      title="Suno Create"
                      aria-label="Suno Create"
                    >
                      <img src="/suno-icon.webp" alt="Suno" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}


const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net';
const GOOGLE_GEMINI_API_KEY_STORAGE_BASE = 'soridraw_google_gemini_api_key';
const GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_google_gemini_api_key_registered';
const SUNO_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_suno_api_key_registered';

const getUserScopedStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;

const getStoredGoogleGeminiApiKey = (_uid?: string | null): string => {
  // 실제 Gemini API Key는 로컬에 보관하지 않는다.
  // 항상 현재 로그인한 계정(uid) 기준으로 서버에서 다시 가져온다.
  return '';
};

const cacheGoogleGeminiApiKey = (uid: string, _apiKey: string) => {
  try {
    localStorage.removeItem(getUserScopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, uid));
    localStorage.setItem(getUserScopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid), 'true');
  } catch {
    // localStorage may be unavailable.
  }
};

const clearCachedGoogleGeminiApiKey = (uid?: string | null) => {
  try {
    localStorage.removeItem(getUserScopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, uid));
    localStorage.removeItem(getUserScopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid));
  } catch {
    // localStorage may be unavailable.
  }
};

const fetchGoogleGeminiApiKeyFromServer = async (user: User | null | undefined): Promise<string> => {
  if (!user?.uid) return '';

  const token = await user.getIdToken();
  const res = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/getGoogleGeminiApiKey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  const result = await res.json().catch(() => null);
  if (res.ok && result?.ok && typeof result.apiKey === 'string' && result.apiKey.trim()) {
    const apiKey = result.apiKey.trim();
    cacheGoogleGeminiApiKey(user.uid, apiKey);
    return apiKey;
  }

  if (res.status === 404) clearCachedGoogleGeminiApiKey(user.uid);
  return '';
};

const resolveGoogleGeminiApiKey = async (user: User | null | undefined): Promise<string> => {
  if (!user?.uid) return '';
  return fetchGoogleGeminiApiKeyFromServer(user);
};

const hasStoredGoogleGeminiApiKey = (uid?: string | null): boolean => {
  try {
    return localStorage.getItem(getUserScopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';
  } catch {
    return false;
  }
};

const hasStoredSunoApiKey = (uid?: string | null): boolean => {
  try {
    return localStorage.getItem(getUserScopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';
  } catch {
    return false;
  }
};

const fetchSunoApiKeyStatusFromServer = async (user: User | null | undefined): Promise<boolean> => {
  if (!user?.uid) return false;

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/getSunoApiKeyStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const result = await res.json().catch(() => null);
    if (res.ok) {
      const hasKey = Boolean(result && (result.hasSunoApiKey || result.hasMusicApiKey || result.registered || result.hasApiKey || result.exists));
      try {
        if (hasKey) localStorage.setItem(getUserScopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
        else localStorage.removeItem(getUserScopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
      } catch {
        // localStorage may be unavailable.
      }
      return hasKey;
    }
  } catch {
    // Network/server failures fall back to the local hint only.
  }

  return hasStoredSunoApiKey(user.uid);
};

const GEMINI_MODEL_LABELS: Record<string, string> = {
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'local-emergency': '로컬 안전 결과',
};

const getGeminiUsedModelLabel = (song?: SongResult | null): string => {
  if (!song) return '';
  const applied = (song.appliedKeywords || {}) as any;
  const rawModel = String(applied.geminiUsedModel || (song as any).geminiModelInfo?.usedModel || '').trim();
  return rawModel ? (GEMINI_MODEL_LABELS[rawModel] || rawModel) : '';
};

function App() {
  const getAvailableMusicApiLyricLanguages = (song: SongResult | null): LanguageCode[] => {
    return getGeneratedLyricLanguages(song);
  };

  const getMusicApiBatchSongs = (): SongResult[] => {
    if (!latestGenerationBatchId) return result ? [result] : [];
    const batchSongs = history.filter((song) => (song.appliedKeywords as any)?.generationBatchId === latestGenerationBatchId);
    return batchSongs.length > 0 ? batchSongs : (result ? [result] : []);
  };

  const getMusicApiTargetId = (song: SongResult, fallbackIndex = 0) => {
    const batchId = (song.appliedKeywords as any)?.generationBatchId || 'single';
    const index = (song.appliedKeywords as any)?.generationIndex || fallbackIndex + 1;
    return `${batchId}-${index}`;
  };

  const getMusicApiTargetOptions = (): MusicApiTargetOption[] => {
    return getMusicApiBatchSongs().map((song, index) => ({
      id: getMusicApiTargetId(song, index),
      label: (song.koreanTitle || song.englishTitle || song.title || `생성곡 ${index + 1}`).replace(/^\[[^\]]+\]\s*/, '').replace(/^['"]|['"]$/g, ''),
      subLabel: formatInlineTitle(song),
      availableLyricLanguages: getAvailableMusicApiLyricLanguages(song),
    }));
  };

  const generateMusic = async (
    _titleLanguage: LanguageCode = 'ko',
    includeLyrics: boolean = true,
    lyricLanguages: LanguageCode[] = ['ko'],
    _generationCount: number = 1,
    options?: { targetMode?: 'current' | 'batch'; perTargetLyricLanguages?: Record<string, LanguageCode>; sunoModelVersion?: SunoModelVersion }
  ) => {
    if (isMusicApiGenerating) return;

    try {
      setIsMusicApiGenerating(true);

      const user = auth.currentUser;
      if (!user) {
        showToast("로그인이 필요합니다.");
        return;
      }

      if (!result) {
        showToast("먼저 곡을 생성해주세요.");
        return;
      }

      const token = await user.getIdToken();
      const targetMode = options?.targetMode === 'batch' ? 'batch' : 'current';
      const targetSongs = targetMode === 'batch' ? getMusicApiBatchSongs() : [result];
      const sunoModelVersion: SunoModelVersion = options?.sunoModelVersion || 'V5_5';

      if (targetSongs.length === 0) {
        showToast("Music API로 보낼 곡이 없습니다.");
        return;
      }

      setSunoLibrarySignal('generating', Date.now());

      const lyricLanguageLabels: Record<LanguageCode, string> = {
        ko: 'Korean',
        en: 'English',
        ja: 'Japanese',
        zh: 'Chinese',
        es: 'Spanish',
        fr: 'French',
      };

      const resolveMusicApiLyricsByLanguage = (song: SongResult, lang: LanguageCode) => {
        return getLyricsByLanguage(song, lang);
      };

      const getMusicApiTitle = (song: SongResult, _selectedLanguage: LanguageCode | null) => {
        return formatUnifiedTitle(song);
      };

      for (let i = 0; i < targetSongs.length; i += 1) {
        const song = targetSongs[i];
        const targetId = getMusicApiTargetId(song, i);
        const selectedLanguage = includeLyrics
          ? (targetMode === 'batch'
              ? options?.perTargetLyricLanguages?.[targetId]
              : (lyricLanguages || [])[0]) || getAvailableMusicApiLyricLanguages(song)[0]
          : null;

        const resolvedLyricLanguages = includeLyrics && selectedLanguage ? [selectedLanguage] : [];
        const resolvedLyrics = includeLyrics && selectedLanguage
          ? resolveMusicApiLyricsByLanguage(song, selectedLanguage).trim()
          : '';

        if (includeLyrics && !resolvedLyrics) {
          clearSunoLibrarySignal();
          showToast(`${i + 1}번 곡에 선택한 언어의 가사가 없습니다. 다른 언어를 선택하거나 가사 미포함으로 생성해주세요.`);
          return;
        }

        const finalTitle = getMusicApiTitle(song, selectedLanguage || null);

        const res = await fetch(
          "https://us-central1-soridraw-app-866a5.cloudfunctions.net/createSunoTrack",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: finalTitle,
              prompt: song.prompt || "",
              style: song.prompt || "",
              lyrics: resolvedLyrics,
              appliedKeywords: song.appliedKeywords || {},
              titleLanguage: selectedLanguage || null,
              includeLyrics,
              lyricLanguages: resolvedLyricLanguages,
              lyricLanguage: selectedLanguage || null,
              model: sunoModelVersion,
              sunoVersion: sunoModelVersion,
              sunoModelVersion,
              generationIndex: i + 1,
              generationCount: targetSongs.length,
              sourceGenerationBatchId: (song.appliedKeywords as any)?.generationBatchId || null,
            }),
          }
        );

        const data = await res.json();
        console.log(`Music API 생성 결과 ${i + 1}/${targetSongs.length}:`, data);

        if (!res.ok || !data.ok) {
          clearSunoLibrarySignal();
          showToast(`Music API 생성 요청에 실패했습니다. (${i + 1}/${targetSongs.length})\n${data.error || "알 수 없는 오류"}`);
          return;
        }

        if (data.trackId) {
          addPendingSunoCreditTrackId(String(data.trackId));
        }
      }

      showToast(`Music API 생성 요청이 완료되었습니다.\n${targetSongs.length}곡은 라이브러리에서 자동으로 상태가 갱신됩니다.`);
    } catch (err) {
      console.error("생성 실패:", err);
      clearSunoLibrarySignal();
      showToast("Music API 생성 요청 중 오류가 발생했습니다.");
    } finally {
      setIsMusicApiGenerating(false);
    }
  };
  const navigate = useNavigate();
  const location = useLocation();

  // 1. ALL STATES & REFS FIRST
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [rememberLogin, setRememberLogin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rememberLogin') === 'true';
    } catch {
      return false;
    }
  });
  const [userRole, setUserRole] = useState<UserRole>('free');
  const [userStatus, setUserStatus] = useState<AccountStatus>('active');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [isForcedLogoutModalOpen, setIsForcedLogoutModalOpen] = useState(false);
  const [forcedLogoutCountdown, setForcedLogoutCountdown] = useState(10);
  const isForcedLogoutProcessingRef = useRef(false);
  const lastForcedLogoutTimeRef = useRef<number>(0);
  const hasCompletedForceLogoutReentryCheckRef = useRef(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [history, setHistory] = useState<SongResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [latestGenerationBatchId, setLatestGenerationBatchId] = useState<string | null>(null);
  const [generationModelNotice, setGenerationModelNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const SUNO_LIBRARY_SIGNAL_KEY = 'soridraw_suno_library_signal';
  const SUNO_LIBRARY_SIGNAL_STARTED_AT_KEY = 'soridraw_suno_library_signal_started_at';
  const SUNO_REMAINING_CREDITS_STORAGE_BASE = 'soridraw_suno_remaining_credits';
  const SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE = 'soridraw_suno_remaining_credits_updated_at';
  const SUNO_PENDING_CREDIT_TRACK_IDS_STORAGE_BASE = 'soridraw_suno_pending_credit_track_ids';
  const getScopedAppStorageKey = (base: string) => getUserScopedStorageKey(base, user?.uid);

  const [sunoLibrarySignal, setSunoLibrarySignalState] = useState<'generating' | 'completed' | null>(() => {
    try {
      const saved = localStorage.getItem(SUNO_LIBRARY_SIGNAL_KEY);
      return saved === 'generating' || saved === 'completed' ? saved : null;
    } catch {
      return null;
    }
  });

  const [sunoLibrarySignalStartedAt, setSunoLibrarySignalStartedAt] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(SUNO_LIBRARY_SIGNAL_STARTED_AT_KEY) || '');
      return Number.isFinite(saved) && saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });

  const [sunoRemainingCredits, setSunoRemainingCredits] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE)) || '');
      return Number.isFinite(saved) && saved >= 0 ? saved : null;
    } catch {
      return null;
    }
  });

  const [sunoRemainingCreditsUpdatedAt, setSunoRemainingCreditsUpdatedAt] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE)) || '');
      return Number.isFinite(saved) && saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });

  const pendingSunoCreditCheckTrackIdsRef = useRef<Set<string>>(new Set());
  const [recentSunoTracksForPolling, setRecentSunoTracksForPolling] = useState<any[]>([]);
  const globalSunoStatusCheckingIdsRef = useRef<Set<string>>(new Set());
  const globalSunoStatusCheckCountsRef = useRef<Map<string, number>>(new Map());
  const globalSunoStatusLastRunAtRef = useRef<Map<string, number>>(new Map());

  const setSunoLibrarySignal = (value: 'generating' | 'completed' | null, startedAt?: number) => {
    const resolvedStartedAt = value === 'generating'
      ? (startedAt || Date.now())
      : (value === 'completed' ? sunoLibrarySignalStartedAt : null);

    setSunoLibrarySignalState(value);
    setSunoLibrarySignalStartedAt(resolvedStartedAt);

    try {
      if (value) {
        localStorage.setItem(SUNO_LIBRARY_SIGNAL_KEY, value);
        if (resolvedStartedAt) {
          localStorage.setItem(SUNO_LIBRARY_SIGNAL_STARTED_AT_KEY, String(resolvedStartedAt));
        }
      } else {
        localStorage.removeItem(SUNO_LIBRARY_SIGNAL_KEY);
        localStorage.removeItem(SUNO_LIBRARY_SIGNAL_STARTED_AT_KEY);
      }
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }
  };

  const clearSunoLibrarySignal = () => setSunoLibrarySignal(null);

  const sunoLibrarySignalDotClass = sunoLibrarySignal === 'generating'
    ? 'bg-pink-400 shadow-[0_10px_24px_rgba(0,0,0,0.16)]'
    : 'bg-brand-orange shadow-[0_10px_24px_rgba(0,0,0,0.16)]';

  const updateSunoRemainingCreditsCache = useCallback((credits: number | null, updatedAt: number = Date.now()) => {
    setSunoRemainingCredits(credits);
    setSunoRemainingCreditsUpdatedAt(credits === null ? null : updatedAt);

    try {
      if (credits === null) {
        localStorage.removeItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE));
        localStorage.removeItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE));
        window.dispatchEvent(new CustomEvent('soridraw:suno-credits-updated', {
          detail: { remainingCredits: null, updatedAt: null }
        }));
      } else {
        localStorage.setItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE), String(credits));
        localStorage.setItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE), String(updatedAt));
        window.dispatchEvent(new CustomEvent('soridraw:suno-credits-updated', {
          detail: { remainingCredits: credits, updatedAt }
        }));
      }
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }
  }, [user?.uid]);

  useEffect(() => {
    const readSunoRemainingCreditsCache = () => {
      try {
        const creditValue = Number(localStorage.getItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_STORAGE_BASE)) || '');
        setSunoRemainingCredits(Number.isFinite(creditValue) && creditValue >= 0 ? creditValue : null);
        const updatedValue = Number(localStorage.getItem(getScopedAppStorageKey(SUNO_REMAINING_CREDITS_UPDATED_AT_STORAGE_BASE)) || '');
        setSunoRemainingCreditsUpdatedAt(Number.isFinite(updatedValue) && updatedValue > 0 ? updatedValue : null);
      } catch {
        setSunoRemainingCredits(null);
        setSunoRemainingCreditsUpdatedAt(null);
      }
    };

    const handleCreditsUpdate = () => readSunoRemainingCreditsCache();
    let isCancelled = false;
    readSunoRemainingCreditsCache();
    setHasSunoApiKey(hasStoredSunoApiKey(user?.uid));
    fetchSunoApiKeyStatusFromServer(user).then((hasKey) => {
      if (!isCancelled) setHasSunoApiKey(hasKey);
    });
    window.addEventListener('storage', handleCreditsUpdate);
    window.addEventListener('soridraw:suno-credits-updated', handleCreditsUpdate as EventListener);
    return () => {
      isCancelled = true;
      window.removeEventListener('storage', handleCreditsUpdate);
      window.removeEventListener('soridraw:suno-credits-updated', handleCreditsUpdate as EventListener);
    };
  }, [user]);

  const getPendingSunoCreditTrackIds = useCallback((): string[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(getScopedAppStorageKey(SUNO_PENDING_CREDIT_TRACK_IDS_STORAGE_BASE)) || '[]');
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(parsed.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())));
    } catch {
      return [];
    }
  }, [user?.uid]);

  const savePendingSunoCreditTrackIds = useCallback((trackIds: string[]) => {
    try {
      const uniqueTrackIds = Array.from(new Set(trackIds.filter(Boolean)));
      if (uniqueTrackIds.length === 0) {
        localStorage.removeItem(getScopedAppStorageKey(SUNO_PENDING_CREDIT_TRACK_IDS_STORAGE_BASE));
      } else {
        localStorage.setItem(getScopedAppStorageKey(SUNO_PENDING_CREDIT_TRACK_IDS_STORAGE_BASE), JSON.stringify(uniqueTrackIds));
      }
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }
  }, [user?.uid]);

  const addPendingSunoCreditTrackId = useCallback((trackId: string | null | undefined) => {
    if (!trackId) return;
    const next = Array.from(new Set([...getPendingSunoCreditTrackIds(), String(trackId)]));
    savePendingSunoCreditTrackIds(next);
  }, [getPendingSunoCreditTrackIds, savePendingSunoCreditTrackIds]);

  const removePendingSunoCreditTrackId = useCallback((trackId: string | null | undefined) => {
    if (!trackId) return;
    const next = getPendingSunoCreditTrackIds().filter((id) => id !== String(trackId));
    savePendingSunoCreditTrackIds(next);
  }, [getPendingSunoCreditTrackIds, savePendingSunoCreditTrackIds]);

  const formatSunoRemainingCreditsTime = (value: number | null): string => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getSunoTrackTimeMs = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const hasSunoAudioUrl = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    return Boolean(
      item.audioUrl ||
      item.streamAudioUrl ||
      item.audio_url ||
      item.stream_audio_url ||
      item.sourceAudioUrl ||
      item.sourceStreamAudioUrl
    );
  };

  const isCompletedSunoLibraryTrack = (track: any, startedAt: number): boolean => {
    if (!track || typeof track !== 'object') return false;

    const createdAtMs = getSunoTrackTimeMs(track.createdAt);
    const updatedAtMs = getSunoTrackTimeMs(track.updatedAt);
    const isRelevantTrack = Math.max(createdAtMs, updatedAtMs) >= startedAt - 30000;
    if (!isRelevantTrack) return false;

    const status = String(track.status || '').toLowerCase();
    const isCompleteStatus = status === 'completed' || status === 'success' || status === 'complete';
    if (!isCompleteStatus) return false;

    if (hasSunoAudioUrl(track)) return true;

    if (Array.isArray(track.audioUrls) && track.audioUrls.some(Boolean)) return true;

    const sunoData = Array.isArray(track.sunoData) ? track.sunoData.filter(Boolean) : [];
    if (sunoData.length === 0) return false;

    return sunoData.every((item: any) => hasSunoAudioUrl(item));
  };

  const checkSunoRemainingCreditsAfterCompletedTrack = useCallback(async (track: any): Promise<boolean> => {
    if (!user || !track?.id || track?.creditCheckedAfterComplete === true) return false;

    const trackId = String(track.id);
    if (pendingSunoCreditCheckTrackIdsRef.current.has(trackId)) return false;

    pendingSunoCreditCheckTrackIdsRef.current.add(trackId);

    try {
      const token = await user.getIdToken();
      const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoRemainingCreditsAfterComplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackId,
          taskId: track.taskId || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && typeof data.remainingCredits === 'number') {
        updateSunoRemainingCreditsCache(data.remainingCredits, Date.now());
        return true;
      } else if (!res.ok && res.status !== 409) {
        console.warn('Suno remaining credit check failed:', data);
      }
    } catch (error) {
      console.warn('Suno remaining credit check failed:', error);
    } finally {
      pendingSunoCreditCheckTrackIdsRef.current.delete(trackId);
    }
    return false;
  }, [user, updateSunoRemainingCreditsCache]);

  useEffect(() => {
    if (location.pathname === '/suno-library' && sunoLibrarySignal) {
      clearSunoLibrarySignal();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'suno_tracks', user.uid, 'tracks'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tracks = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setRecentSunoTracksForPolling(tracks);
      const pendingTrackIds = new Set(getPendingSunoCreditTrackIds());

      const completedPendingTrack = tracks.find((track) =>
        pendingTrackIds.has(String((track as any).id)) &&
        isCompletedSunoLibraryTrack(track, 0) &&
        (track as any).creditCheckedAfterComplete !== true
      );

      const completedSignalTrack = sunoLibrarySignal === 'generating' && sunoLibrarySignalStartedAt
        ? tracks.find((track) => isCompletedSunoLibraryTrack(track, sunoLibrarySignalStartedAt))
        : null;

      const completedTrack = completedPendingTrack || completedSignalTrack;

      if (completedTrack) {
        setSunoLibrarySignal('completed');
        void checkSunoRemainingCreditsAfterCompletedTrack(completedTrack).then((didUpdate) => {
          if (didUpdate) {
            removePendingSunoCreditTrackId(String((completedTrack as any).id));
          }
        });
      }
    }, (error) => {
      console.error('Suno library completion signal listener failed:', error);
    });

    return () => unsubscribe();
  }, [user?.uid, sunoLibrarySignal, sunoLibrarySignalStartedAt, checkSunoRemainingCreditsAfterCompletedTrack, getPendingSunoCreditTrackIds, removePendingSunoCreditTrackId]);

  const shouldPollSunoTrackGlobally = useCallback((track: any, now: number): boolean => {
    if (!track || typeof track !== 'object') return false;
    if (!track.id || !track.taskId) return false;

    const status = String(track.status || '').toLowerCase();
    if (['completed', 'success', 'complete', 'succeeded', 'failed', 'cancelled', 'canceled'].includes(status)) return false;
    if (isCompletedSunoLibraryTrack(track, 0)) return false;

    const createdAtMs = getSunoTrackTimeMs(track.createdAt);
    const updatedAtMs = getSunoTrackTimeMs(track.updatedAt);
    const baseTimeMs = createdAtMs || updatedAtMs;
    if (!baseTimeMs) return false;

    const elapsedMs = now - baseTimeMs;
    if (elapsedMs < 8000) return false;
    if (elapsedMs > 10 * 60 * 1000) return false;

    const trackId = String(track.id);
    const count = globalSunoStatusCheckCountsRef.current.get(trackId) || 0;
    if (count >= 30) return false;
    if (globalSunoStatusCheckingIdsRef.current.has(trackId)) return false;

    const nextIntervalMs = elapsedMs < 3 * 60 * 1000
      ? 15 * 1000
      : elapsedMs < 6 * 60 * 1000
        ? 30 * 1000
        : 60 * 1000;

    const lastRunAt = globalSunoStatusLastRunAtRef.current.get(trackId) || 0;
    if (lastRunAt && now - lastRunAt < nextIntervalMs) return false;

    return true;
  }, []);

  const checkSunoTrackStatusGlobally = useCallback(async (track: any) => {
    if (!user || !track?.id || !track?.taskId) return;

    const trackId = String(track.id);
    if (globalSunoStatusCheckingIdsRef.current.has(trackId)) return;

    globalSunoStatusCheckingIdsRef.current.add(trackId);
    globalSunoStatusLastRunAtRef.current.set(trackId, Date.now());
    globalSunoStatusCheckCountsRef.current.set(trackId, (globalSunoStatusCheckCountsRef.current.get(trackId) || 0) + 1);

    try {
      const token = await user.getIdToken();
      const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackId,
          taskId: track.taskId,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.warn('Global Suno status check failed:', trackId, data);
      }
    } catch (error) {
      console.warn('Global Suno status check error:', trackId, error);
    } finally {
      globalSunoStatusCheckingIdsRef.current.delete(trackId);
    }
  }, [user]);

  useEffect(() => {
    if (!user || location.pathname === '/suno-library') return;

    const runGlobalSunoPolling = () => {
      const now = Date.now();
      recentSunoTracksForPolling
        .filter((track) => shouldPollSunoTrackGlobally(track, now))
        .slice(0, 4)
        .forEach((track) => {
          void checkSunoTrackStatusGlobally(track);
        });
    };

    runGlobalSunoPolling();
    const intervalId = window.setInterval(runGlobalSunoPolling, 15000);
    return () => window.clearInterval(intervalId);
  }, [user, location.pathname, recentSunoTracksForPolling, shouldPollSunoTrackGlobally, checkSunoTrackStatusGlobally]);

  const RECENT_SONGS_CACHE_TTL_MS = 10 * 60 * 1000;
  const getRecentSongsCacheKey = (uid: string) => `soridraw_recent_songs_cache_${uid}`;
  const getRecentSongsBackupKey = (uid: string) => `soridraw_recent_songs_cache_backup_${uid}`;

  const isSongLike = (value: any) => {
    if (!value || typeof value !== 'object') return false;
    return Boolean(value.title || value.koreanTitle || value.englishTitle || value.prompt || value.lyrics);
  };

  const normalizeRecentSongList = (value: any): SongResult[] => {
    const rawList = Array.isArray(value)
      ? value
      : Array.isArray(value?.songs)
        ? value.songs
        : Array.isArray(value?.history)
          ? value.history
          : Array.isArray(value?.recentSongs)
            ? value.recentSongs
            : Array.isArray(value?.items)
              ? value.items
              : [];

    const seen = new Set<string>();
    return rawList
      .filter(isSongLike)
      .filter((song: any) => {
        const key = [song.id, song.createdAt, song.title, song.koreanTitle, song.englishTitle, song.prompt]
          .filter(Boolean)
          .join('::');
        const fallbackKey = JSON.stringify({ title: song.title || song.koreanTitle || song.englishTitle || '', prompt: song.prompt || '', lyrics: song.lyrics || '' }).slice(0, 500);
        const finalKey = key || fallbackKey;
        if (seen.has(finalKey)) return false;
        seen.add(finalKey);
        return true;
      }) as SongResult[];
  };

  const sortRecentSongs = (songs: SongResult[]) => [...songs].sort((a: any, b: any) => {
    const timeA = Number(a.createdAt || a.updatedAt || a.savedAt || 0);
    const timeB = Number(b.createdAt || b.updatedAt || b.savedAt || 0);
    return timeB - timeA;
  });

  const mergeRecentSongLists = (...lists: any[][]): SongResult[] => {
    const seen = new Set<string>();
    const merged: SongResult[] = [];
    lists.flat().filter(isSongLike).forEach((song: any) => {
      const key = [song.id, song.createdAt, song.title, song.koreanTitle, song.englishTitle, song.prompt]
        .filter(Boolean)
        .join('::') || JSON.stringify({ title: song.title || song.koreanTitle || song.englishTitle || '', prompt: song.prompt || '', lyrics: song.lyrics || '' }).slice(0, 500);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(song as SongResult);
    });
    return sortRecentSongs(merged).slice(0, 10);
  };

  const loadRecentSongsCache = (uid: string) => {
    try {
      const raw = localStorage.getItem(getRecentSongsCacheKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.history)) return null;
      return parsed as {
        history: SongResult[];
        historyIndex: number;
        latestGenerationBatchId: string | null;
        cachedAt: number;
      };
    } catch {
      return null;
    }
  };

  const loadRecentSongsBackup = (uid: string): SongResult[] => {
    try {
      const raw = localStorage.getItem(getRecentSongsBackupKey(uid));
      if (!raw) return [];
      return normalizeRecentSongList(JSON.parse(raw));
    } catch {
      return [];
    }
  };

  const findRecoverableLocalRecentSongs = (uid: string): SongResult[] => {
    if (typeof window === 'undefined') return [];
    const candidates: SongResult[][] = [];
    try {
      const currentCache = loadRecentSongsCache(uid);
      if (currentCache?.history?.length) candidates.push(currentCache.history);
      const backup = loadRecentSongsBackup(uid);
      if (backup.length) candidates.push(backup);

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        const lowerKey = key.toLowerCase();
        if (!lowerKey.includes('soridraw')) continue;
        if (!(lowerKey.includes('recent') || lowerKey.includes('history') || lowerKey.includes('song'))) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const songs = normalizeRecentSongList(parsed);
          if (songs.length) candidates.push(songs);
        } catch {}
      }
    } catch {}
    return mergeRecentSongLists(...candidates);
  };

  const saveRecentSongsCache = (uid: string, payload: {
    history: SongResult[];
    historyIndex: number;
    latestGenerationBatchId: string | null;
  }) => {
    try {
      const existing = loadRecentSongsCache(uid);
      const existingHistory = normalizeRecentSongList(existing?.history || []);
      const nextHistory = normalizeRecentSongList(payload.history || []);

      // If a bug or temporary empty state tries to shrink the cache, keep the larger list as backup first.
      if (existingHistory.length > nextHistory.length) {
        localStorage.setItem(getRecentSongsBackupKey(uid), JSON.stringify({ songs: existingHistory, backedUpAt: Date.now() }));
      }

      localStorage.setItem(
        getRecentSongsCacheKey(uid),
        JSON.stringify({
          ...payload,
          history: nextHistory,
          cachedAt: Date.now(),
        })
      );
    } catch {}
  };

  const applyRecentSongsState = (songs: SongResult[], options?: { preferredIndex?: number | null; latestBatchId?: string | null }) => {
    setHistory(songs);

    const newestBatchId = options?.latestBatchId ?? ((songs[0]?.appliedKeywords as any)?.generationBatchId || null);
    if (newestBatchId) {
      setLatestGenerationBatchId((prev) => prev || newestBatchId);
    }

    if (songs.length > 0) {
      const preferredIndex = options?.preferredIndex ?? null;
      const nextIndex = preferredIndex !== null && preferredIndex >= 0 && preferredIndex < songs.length ? preferredIndex : 0;
      setHistoryIndex(nextIndex);
      historyIndexRef.current = nextIndex;
      setResult(songs[nextIndex]);
    } else {
      setHistoryIndex(-1);
      historyIndexRef.current = -1;
      setResult(null);
    }
  };

  const [showMusicApiModal, setShowMusicApiModal] = useState(false);
  const [showMainGenerationModal, setShowMainGenerationModal] = useState(false);
  const [isAddingLyricsLanguage, setIsAddingLyricsLanguage] = useState(false);
  const [addingLyricsLanguageTarget, setAddingLyricsLanguageTarget] = useState<LanguageCode | null>(null);
  const [hasSunoApiKey, setHasSunoApiKey] = useState(() => {
    try {
      return hasStoredSunoApiKey(auth.currentUser?.uid);
    } catch {
      return false;
    }
  });

  // 2. CORE FUNCTIONS NEXT (BEFORE ANY USEEFFECT)
  const handleLogout = async () => {
    console.log('[ForceLogout Client] handleLogout called');
    try {
      const currentUser = auth.currentUser;

      if (currentUser) {
        console.log(`[ForceLogout Client] handleLogout - Updating Firestore for UID: ${currentUser.uid}`);
        const userDocRef = doc(db, 'users', currentUser.uid);

        try {
          await setDoc(userDocRef, {
            isOnline: false,
            lastLogoutAt: Date.now(),
            lastSeenAt: Date.now()
          }, { merge: true });
          console.log('[ForceLogout Client] handleLogout - Firestore update successful');
        } catch (dbErr) {
          console.error("[ForceLogout Client] handleLogout - Firestore update failed:", dbErr);
        }
      }

      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);

      console.log('[ForceLogout Client] handleLogout - Calling signOut(auth)');
      await signOut(auth);
      console.log('[ForceLogout Client] handleLogout - signOut(auth) successful');
      navigate('/', { replace: true });

    } catch (error) {
      console.error("[Logout] 처리 오류:", error);
    }
  };

  const performForcedLogout = async ({ silent }: { silent: boolean }) => {
    console.log(`[ForceLogout Client] performForcedLogout triggered (silent: ${silent})`);
    try {
      if (!silent) {
        setIsForcedLogoutModalOpen(true);
        setForcedLogoutCountdown(10);
      }
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          isOnline: false,
          lastLogoutAt: Date.now(),
          lastSeenAt: Date.now()
        });
      }

      await signOut(auth);
      navigate('/', { replace: true });
    } catch (error) {
      console.error("[ForceLogout Client] Error during forced logout:", error);
      // Even if updateDoc fails, we should try to sign out
      await signOut(auth).catch(() => {});
      navigate('/', { replace: true });
    }
  };

  const getEmailAuthErrorMessage = (error: any) => {
    const code = error?.code || 'unknown';
    if (code === 'auth/email-already-in-use') return '이미 가입된 이메일입니다. 이메일 로그인 또는 기존 로그인 방식을 사용해주세요.';
    if (code === 'auth/account-exists-with-different-credential') return '같은 이메일이 이미 다른 로그인 방식으로 가입되어 있습니다. 기존 로그인 방식으로 로그인해주세요.';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return '이메일 또는 비밀번호를 확인해주세요.';
    if (code === 'auth/weak-password') return '비밀번호는 6자 이상으로 입력해주세요.';
    if (code === 'auth/invalid-email') return '이메일 형식을 확인해주세요.';
    if (code === 'auth/too-many-requests') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    return `인증 처리 중 오류가 발생했습니다. (${code})`;
  };

  const prepareEmailAuthAttempt = async () => {
    localStorage.setItem('rememberLogin', String(rememberLogin));
    await setPersistence(auth, rememberLogin ? browserLocalPersistence : browserSessionPersistence);
  };

  const handleLogin = () => {
    setAuthMode('login');
    setAuthMessage(null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    if (isLoggingIn) return;
    setIsAuthModalOpen(false);
    setAuthMessage(null);
  };

  const handleEmailAuth = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isLoggingIn) return;

    const email = authEmail.trim();
    const password = authPassword;
    setAuthMessage(null);

    if (!email) {
      setAuthMessage('이메일을 입력해주세요.');
      return;
    }

    if (authMode === 'reset') {
      setIsLoggingIn(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setAuthMessage('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.');
      } catch (error: any) {
        console.error('Password reset error:', error);
        setAuthMessage(getEmailAuthErrorMessage(error));
      } finally {
        setIsLoggingIn(false);
      }
      return;
    }

    if (!password) {
      setAuthMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (authMode === 'signup' && password !== authPasswordConfirm) {
      setAuthMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsLoggingIn(true);
    try {
      await prepareEmailAuthAttempt();

      if (authMode === 'signup') {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0 && !methods.includes('password')) {
          setAuthMessage('같은 이메일이 이미 다른 로그인 방식으로 가입되어 있습니다. 기존 로그인 방식으로 로그인해주세요.');
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      setAuthPassword('');
      setAuthPasswordConfirm('');
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error('Email auth error:', error);
      setAuthMessage(getEmailAuthErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const showAuthError = (message: string) => {
      setToast({ message, visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 5000);
    };
    const getAuthErrorMessage = (error: any) => {
      const code = error?.code || 'unknown';
      const currentDomain = window.location.hostname;

      if (code === 'auth/unauthorized-domain') {
        return `Firebase Auth 승인 도메인에 ${currentDomain}을 추가해야 Google 로그인이 가능합니다.`;
      }
      if (code === 'auth/popup-blocked') {
        return 'Edge에서 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.';
      }
      if (code === 'auth/popup-closed-by-user') {
        return 'Google 로그인 팝업이 닫혀 로그인이 취소되었습니다.';
      }
      if (code === 'auth/cancelled-popup-request') {
        return 'Google 로그인 팝업 요청이 취소되었습니다. 다시 시도해주세요.';
      }
      if (code === 'auth/account-exists-with-different-credential') {
        return '같은 이메일이 이미 다른 로그인 방식으로 가입되어 있습니다. 기존 로그인 방식으로 로그인해주세요.';
      }
      return `Google 로그인에 실패했습니다. (${code})`;
    };

    try {
      localStorage.setItem('rememberLogin', String(rememberLogin));

      // Environment check
      const hostname = window.location.hostname;
      const isStudio = hostname.includes('aistudio.google.com') || hostname.includes('googleusercontent.com');
      const isDev = hostname.includes('localhost') || hostname.includes('127.0.0.1');
      
      console.log('LOGIN MODE CHECK:', { hostname, isStudio, isDev });

      let result = null;
      try {
        console.log("[Auth] Attempting primary login method: signInWithPopup");
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupError: any) {
        console.log(`[Auth] Popup attempt failed/cancelled with code: ${popupError.code}`);
        const authErrorMessage = getAuthErrorMessage(popupError);
        
        if (popupError.code === 'auth/popup-closed-by-user') {
          console.log("[Auth] Login cancelled: User closed the popup.");
          showAuthError(authErrorMessage);
          return;
        }

        if (popupError.code === 'auth/unauthorized-domain') {
          console.error(`[Auth] Unauthorized domain for Firebase Auth: ${hostname}`);
          showAuthError(authErrorMessage);
          return;
        }

        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
          showAuthError(authErrorMessage);
          return;
        }

        throw popupError;
      }

      if (result?.user) {
        console.log("[Auth] Popup login successful for:", result.user.uid);
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            lastLoginAt: Date.now()
          }, { merge: true });
        } catch (dbErr) {
          console.error("Failed to record lastLoginAt:", dbErr);
        }
      }
    } catch (error: any) {
      console.error("Login Error Details:", error);
      showAuthError(getAuthErrorMessage(error));
    } finally {
      // Small delay in resetting state to allow Auth listeners to update if needed
      setTimeout(() => setIsLoggingIn(false), 500);
    }
  };

  // 3. HANDLE REDIRECT RESULT & RECOVERY
  useEffect(() => {
    const processRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("[Auth] Redirect login successful for:", result.user.uid);
          try {
            await setDoc(doc(db, 'users', result.user.uid), {
              lastLoginAt: Date.now()
            }, { merge: true });
          } catch (dbErr) {
            console.error("Failed to record lastLoginAt after redirect:", dbErr);
          }
        }
      } catch (error: any) {
        console.error("Redirect Login Result Error:", error);
        const code = error?.code || 'unknown';
        const currentDomain = window.location.hostname;
        const message = code === 'auth/unauthorized-domain'
          ? `Firebase Auth 승인 도메인에 ${currentDomain}을 추가해야 Google 로그인이 가능합니다.`
          : `Google redirect 로그인에 실패했습니다. (${code})`;
        setToast({ message, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 5000);
      } finally {
        setIsLoggingIn(false);
      }
    };
    processRedirectResult();

    // Recovery logic for cases where user navigates back or closes popup
    const handleReEntry = () => {
      if (isLoggingIn) {
        console.log("[Auth] Window focus/visibility regained - ensuring isLoggingIn is cleared");
        // We wait 1 second to give getRedirectResult or popup a chance to resolve first
        setTimeout(() => setIsLoggingIn(false), 1000);
      }
    };

    window.addEventListener('focus', handleReEntry);
    window.addEventListener('pageshow', handleReEntry);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleReEntry();
    });

    return () => {
      window.removeEventListener('focus', handleReEntry);
      window.removeEventListener('pageshow', handleReEntry);
      document.removeEventListener('visibilitychange', handleReEntry);
    };
  }, [isLoggingIn]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('themeMode', 'dark');
  }, []);

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [subGenre, setSubGenre] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [situation, setSituation] = useState<SituationConfig>(createEmptySituation);

  type MenuLockKey = 'genre' | 'style' | 'sound' | 'mood' | 'theme' | 'situation' | 'vocal' | 'structure';
  const [menuLocks, setMenuLocks] = useState<Record<MenuLockKey, boolean>>({
    genre: false,
    style: false,
    sound: false,
    mood: false,
    theme: false,
    situation: false,
    vocal: false,
    structure: false,
  });
  const toggleMenuLock = useCallback((key: MenuLockKey) => {
    setMenuLocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const isMenuLocked = useCallback((key: MenuLockKey) => Boolean(menuLocks[key]), [menuLocks]);
  const bgmAutoLockedMenusRef = useRef<{ style: boolean; sound: boolean }>({ style: false, sound: false });


  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedInstrumentSounds, setSelectedInstrumentSounds] = useState<string[]>([]);
  const [selectedPointSounds, setSelectedPointSounds] = useState<string[]>([]);
  const [isPointSoundMode, setIsPointSoundMode] = useState(false);
  const hasSelectedInstrumentalBgm = useMemo(
    () => hasInstrumentalBgmGenreIds([...selectedGenres, ...subGenre]),
    [selectedGenres, subGenre]
  );

  useEffect(() => {
    if (hasSelectedInstrumentalBgm) {
      setSelectedStyles((prev) => (prev.length ? [] : prev));
      setSelectedInstrumentSounds((prev) => (prev.length ? [] : prev));
      setSelectedPointSounds((prev) => (prev.length ? [] : prev));
      setIsPointSoundMode(false);
      setMenuLocks((prev) => {
        const auto = { ...bgmAutoLockedMenusRef.current };
        const next = { ...prev };
        if (!prev.style) {
          next.style = true;
          auto.style = true;
        }
        if (!prev.sound) {
          next.sound = true;
          auto.sound = true;
        }
        bgmAutoLockedMenusRef.current = auto;
        return next;
      });
      return;
    }

    setMenuLocks((prev) => {
      const auto = bgmAutoLockedMenusRef.current;
      if (!auto.style && !auto.sound) return prev;
      const next = { ...prev };
      if (auto.style) next.style = false;
      if (auto.sound) next.sound = false;
      bgmAutoLockedMenusRef.current = { style: false, sound: false };
      return next;
    });
  }, [hasSelectedInstrumentalBgm]);
  
  const [lyricsLength, setLyricsLength] = useState<LyricsLength>('normal');
  const [songStructure, setSongStructure] = useState<SongStructure>('1');
  const [vocalMode, setVocalMode] = useState<VocalMode>('solo');
  const [vocalTones, setVocalTones] = useState<VocalTone[]>(VOCAL_TONES);
  const [selectedVocalToneId, setSelectedVocalToneId] = useState<string | undefined>(undefined);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [vocalMembers, setVocalMembers] = useState<VocalMember[]>([]);
  const [rapEnabled, setRapEnabled] = useState(false);
  useEffect(() => {
    const total = maleCount + femaleCount;
    if (total === 0) {
      if (vocalMembers.length > 0) setVocalMembers([]);
      return;
    }

    // If counts match members, do nothing (preserve custom order/settings)
    const currentM = vocalMembers.filter(m => m.gender === 'male').length;
    const currentF = vocalMembers.filter(m => m.gender === 'female').length;
    if (currentM === maleCount && currentF === femaleCount && vocalMembers.length === total) return;

    setVocalMembers(prev => {
      const newMembers: VocalMember[] = [];
      let mRemaining = maleCount;
      let fRemaining = femaleCount;

      // Try to preserve existing members' roles and tones if gender matches
      // In group mode, we might have a custom order, so we try to match by index first
      for (let i = 0; i < total; i++) {
        const existing = prev[i];
        let gender: 'male' | 'female' = 'male';
        
        if (mRemaining > 0) {
          gender = 'male';
          mRemaining--;
        } else {
          gender = 'female';
          fRemaining--;
        }

        if (existing && existing.gender === gender) {
          newMembers.push(existing);
        } else {
          // Assign default roles
          let roles: VocalRole[] = [];
          if (vocalMode === 'solo') {
            roles = ['main'];
          } else if (vocalMode === 'duo') {
            roles = i === 0 ? ['main'] : ['sub'];
          } else {
            if (i === 0) roles = ['main'];
            else if (i === 1) roles = ['lead'];
            else roles = ['sub'];
          }

          // If rap is enabled and it's a solo or we need a rapper in group
          if (rapEnabled && (vocalMode === 'solo' || (vocalMode === 'group' && i === total - 1) || (vocalMode === 'duo' && i === 1))) {
            if (!roles.includes('rapper')) roles.push('rapper');
          }

          newMembers.push({
            id: `member_${Date.now()}_${i}`,
            gender,
            roles,
          });
        }
      }
      return newMembers;
    });
  }, [maleCount, femaleCount, vocalMode, rapEnabled]);

  const [pinnedGenres, setPinnedGenres] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_genres');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedThemes, setPinnedThemes] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_themes');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedStyles, setPinnedStyles] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_styles');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedInstrumentSounds, setPinnedInstrumentSounds] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_instrument_sounds');
    return saved ? JSON.parse(saved) : [];
  });



  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_genres', JSON.stringify(pinnedGenres));
  }, [pinnedGenres]);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_themes', JSON.stringify(pinnedThemes));
  }, [pinnedThemes]);

  useEffect(() => {
    if (pinnedThemes.length > 0) {
      setPinnedThemes([]);
      sessionStorage.removeItem('soridraw_pinned_themes');
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_styles', JSON.stringify(pinnedStyles));
  }, [pinnedStyles]);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_instrument_sounds', JSON.stringify(pinnedInstrumentSounds));
  }, [pinnedInstrumentSounds]);
  const [isGenreExpanded, setIsGenreExpanded] = useState(false);
  const [isStyleExpanded, setIsStyleExpanded] = useState(false);
  const [isSoundExpanded, setIsSoundExpanded] = useState(false);
  const [isMoodExpanded, setIsMoodExpanded] = useState(false);
  const [isVocalExpanded, setIsVocalExpanded] = useState(true);
  const [isSongStructureExpanded, setIsSongStructureExpanded] = useState(true);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isSituationExpanded, setIsSituationExpanded] = useState(false);
  const [draftSituation, setDraftSituation] = useState<SituationConfig>(createEmptySituation);
  const [sectionTags, setSectionTags] = useState<SectionTag[]>([]);

  // Load section tags from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'section_tags'),
      orderBy('label', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTags = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as SectionTag[];
      console.log(`[Tags Debug] Fetched ${fetchedTags.length} tags`);
      setSectionTags(fetchedTags);
    }, (err) => {
      console.error("Error fetching section tags for user UI:", err);
      // Detailed logging for permissions error
      if (err.message.includes('permission')) {
        console.error("[Tags Debug] Current User Auth State:", {
          uid: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleMainSections = (section: 'genre' | 'style' | 'sound') => {
    if (section === 'genre') setIsGenreExpanded(prev => !prev);
    else if (section === 'style') setIsStyleExpanded(prev => !prev);
    else if (section === 'sound') setIsSoundExpanded(prev => !prev);
  };

  const toggleSubSections = (section: 'mood' | 'theme') => {
    if (section === 'mood') setIsMoodExpanded(prev => !prev);
    else if (section === 'theme') setIsThemeExpanded(prev => !prev);
  };

  const [genreHeight, setGenreHeight] = useState(0);
  const [styleHeight, setStyleHeight] = useState(0);
  const [soundHeight, setSoundHeight] = useState(0);
  const [moodHeight, setMoodHeight] = useState(0);
  const [themeHeight, setThemeHeight] = useState(0);

  const row1MaxHeight = useMemo(() => Math.max(genreHeight, styleHeight, soundHeight), [genreHeight, styleHeight, soundHeight]);
  const row2MaxHeight = useMemo(() => Math.max(moodHeight, themeHeight), [moodHeight, themeHeight]);

  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [isGenreHierarchyModalOpen, setIsGenreHierarchyModalOpen] = useState(false);
  const [isActionButtonsCollapsed, setIsActionButtonsCollapsed] = useState(true);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const genreModalHistoryPushedRef = useRef(false);
  const storyboardModalHistoryPushedRef = useRef(false);
  const storyboardModalBackdropMouseDownRef = useRef(false);
  const storyboardOpenTimerRef = useRef<number | null>(null);
  const [isStoryboardOpening, setIsStoryboardOpening] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isGlobalSearchOpening, setIsGlobalSearchOpening] = useState(false);
  const globalSearchOpenTimerRef = useRef<number | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const globalSearchBackdropMouseDownRef = useRef(false);
  const globalSearchModalHistoryPushedRef = useRef(false);
  const [activeGenreGroupId, setActiveGenreGroupId] = useState<string | null>(null);

  const openGenreModal = (groupId: string) => {
    syncActionBarModalBlock(true);
    setActiveGenreGroupId(groupId);
    setIsGenreModalOpen(true);
    window.history.pushState({ modal: 'genre' }, '');
    genreModalHistoryPushedRef.current = true;
  };

  const closeGenreModal = (source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && genreModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsGenreModalOpen(false);
    genreModalHistoryPushedRef.current = false;
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isGenreModalOpen) {
        closeGenreModal('history');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenreModalOpen]);

  const openGlobalSearchModal = () => {
    if (isGlobalSearchOpen || isGlobalSearchOpening) return;
    syncActionBarModalBlock(true);
    setIsGlobalSearchOpening(true);
    if (!globalSearchModalHistoryPushedRef.current) {
      window.history.pushState({ modal: 'global-search' }, '', window.location.href);
      globalSearchModalHistoryPushedRef.current = true;
    }
    if (globalSearchOpenTimerRef.current !== null) {
      window.clearTimeout(globalSearchOpenTimerRef.current);
    }
    globalSearchOpenTimerRef.current = window.setTimeout(() => {
      setIsGlobalSearchOpen(true);
      setIsGlobalSearchOpening(false);
      globalSearchOpenTimerRef.current = null;
    }, 120);
  };

  const closeGlobalSearchModal = (source: 'ui' | 'history' = 'ui') => {
    if (globalSearchOpenTimerRef.current !== null) {
      window.clearTimeout(globalSearchOpenTimerRef.current);
      globalSearchOpenTimerRef.current = null;
    }
    setIsGlobalSearchOpening(false);
    if (source === 'ui' && globalSearchModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsGlobalSearchOpen(false);
    globalSearchModalHistoryPushedRef.current = false;
  };

  const unlockGlobalSearchScrollLock = useCallback(() => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
  }, []);

  useEffect(() => {
    if (!isGlobalSearchOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    // Do not freeze the body with position: fixed. Browser fullscreen transitions can
    // leave that fixed body state behind and make the mouse feel locked. The modal
    // already owns its own scroll area, so overflow hidden is enough here.
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    const handleGlobalSearchPopState = (event: PopStateEvent) => {
      if (globalSearchModalHistoryPushedRef.current) {
        event.stopImmediatePropagation();
        closeGlobalSearchModal('history');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGlobalSearchModal();
      }
    };

    window.addEventListener('popstate', handleGlobalSearchPopState, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handleGlobalSearchPopState, true);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
      document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
    };
  }, [isGlobalSearchOpen]);

  useEffect(() => {
    return () => {
      if (globalSearchOpenTimerRef.current !== null) {
        window.clearTimeout(globalSearchOpenTimerRef.current);
        globalSearchOpenTimerRef.current = null;
      }
      if (storyboardOpenTimerRef.current !== null) {
        window.clearTimeout(storyboardOpenTimerRef.current);
        storyboardOpenTimerRef.current = null;
      }
    };
  }, []);

  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [minBPM, setMinBPM] = useState(90);
  const [maxBPM, setMaxBPM] = useState(110);
  const [userInput, setUserInput] = useState('');
  const [isLyricMode, setIsLyricMode] = useState(false);
  const [lyricDraft, setLyricDraft] = useState('');
  const [lyricMode, setLyricMode] = useState<'assist' | 'preserve'>('assist');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMusicApiGenerating, setIsMusicApiGenerating] = useState(false);
  const [isHomeMusicApiMenuCollapsed, setIsHomeMusicApiMenuCollapsed] = useState(true);
  const [isConfirmingDeleteHistory, setIsConfirmingDeleteHistory] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isAppliedKeywordsExpanded, setIsAppliedKeywordsExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<CategoryItem | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const appliedKeywordsRef = useRef<HTMLDivElement>(null);
  const [appliedKeywordsHeight, setAppliedKeywordsHeight] = useState<number | string>(0);
  const actionButtonsAnchorRef = useRef<HTMLDivElement>(null);
  const [isActionsFloating, setIsActionsFloating] = useState(true);
  const [isActionDragMobile, setIsActionDragMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const selectedKeywordCount = selectedGenres.length + subGenre.length + selectedThemes.length + selectedMoods.length + selectedStyles.length + selectedInstrumentSounds.length + selectedPointSounds.length + (hasActiveSituation(situation) ? 1 : 0);
  const vocalSectionTagOptions = useMemo(
    () => buildVocalSectionTagOptions(vocalMembers, vocalMode),
    [vocalMembers, vocalMode]
  );
  const MAX_FUSION_GENRES = 2;
  const limitFusionGenreIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean))).slice(0, MAX_FUSION_GENRES);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLongPressStart = (item: CategoryItem) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setHoveredItem(item);
    }, 2000);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applyTemplate = (template: PromptTemplate) => {
    // Helper to filter valid IDs
    const filterValid = (ids: string[] | undefined, validList: { id: string }[]) => {
      if (!ids) return [];
      const validIds = new Set(validList.map(item => item.id));
      return ids.filter(id => validIds.has(id));
    };

    // 1. Genres & SubGenres
    // SubGenres can be main genres or leaf genres in GENRE_HIERARCHY
    const allSubGenres = GENRE_HIERARCHY.flatMap(group => 
      group.children.flatMap(main => [main, ...(main.children || [])])
    );
    const validGenres = filterValid(template.genre, GENRES);
    const validSubGenres = filterValid(template.subGenre, allSubGenres);

    // 중분류는 더 이상 자동 선택하지 않는다.
    // 템플릿의 실제 장르 선택값은 모두 subGenre 슬롯에 합쳐서 보관한다.
    setSelectedGenres([]);
    setSubGenre(limitFusionGenreIds([...validGenres, ...validSubGenres]));

    // 2. Moods & Themes
    setSelectedMoods(filterValid(template.moods, MOODS));
    setSelectedThemes(filterValid(template.themes, THEMES));

    // 3. Styles & Sounds
    setSelectedStyles(filterValid(template.styles, SOUND_STYLES));
    setSelectedInstrumentSounds(filterValid(template.instrumentSounds, INSTRUMENT_SOUNDS));

    // 4. Vocal Settings
    setMaleCount(template.maleCount ?? 0);
    setFemaleCount(template.femaleCount ?? 0);
    setRapEnabled(template.rapEnabled ?? false);
    
    const isValidVocalTone = VOCAL_TONES.some(tone => tone.id === template.vocalToneId);
    setSelectedVocalToneId(isValidVocalTone ? template.vocalToneId : undefined);

    // 5. Structure & Mode
    if (template.songStructure) {
      setSongStructure(template.songStructure as SongStructure);
    }
    if (template.customStructure) {
      setCustomStructure(template.customStructure);
    }
    if (template.lyricMode) {
      setLyricMode(template.lyricMode);
    }
    
    // Scroll to input area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    limit = Number.POSITIVE_INFINITY
  ) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= limit) return prev;
      return [...prev, id];
    });
  };

const cycleFamilySelection = (
  cycleId: string,
  selected: string[],
  setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  cycles: readonly { id: string; variants: readonly { id: string }[] }[],
  maxCount = Number.POSITIVE_INFINITY
) => {
  setSelected((prev) => {
    const cycle = cycles.find((item) => item.id === cycleId);
    if (!cycle) return prev;
    const activeIndex = cycle.variants.findIndex((variant) =>
      prev.includes(variant.id)
    );
    const withoutFamily = prev.filter(
      (id) => !cycle.variants.some((variant) => variant.id === id)
    );
    if (activeIndex === -1) {
      if (withoutFamily.length >= maxCount) return prev;
      return [...withoutFamily, cycle.variants[0].id];
    }
    if (activeIndex < cycle.variants.length - 1) {
      return [...withoutFamily, cycle.variants[activeIndex + 1].id];
    }

    return withoutFamily;
  });
};

const toggleCycleVariantSelection = (
  variantId: string,
  selected: string[],
  setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  maxCount = Number.POSITIVE_INFINITY
) => {
  setSelected((prev) => {
    if (prev.includes(variantId)) return prev.filter((item) => item !== variantId);
    if (prev.length >= maxCount) return prev;
    return [...prev, variantId];
  });
};

  useEffect(() => {
    if (appliedKeywordsRef.current) {
      setAppliedKeywordsHeight(appliedKeywordsRef.current.scrollHeight);
    }
  }, [isAppliedKeywordsExpanded, result]);

  useEffect(() => {
    let rafId: number | null = null;

    const updateFloatingState = () => {
      if (!actionButtonsAnchorRef.current) return;

      const rect = actionButtonsAnchorRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Hysteresis prevents the inline/floating bars from rapidly toggling at the boundary,
      // which caused a short flicker right after docking/undocking.
      const floatStartLine = viewportHeight - 92;
      const floatEndLine = viewportHeight - 168;

      setIsActionsFloating((prev) => {
        const next = prev
          ? rect.top > floatEndLine
          : rect.top > floatStartLine;
        return prev === next ? prev : next;
      });
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateFloatingState();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    const updateActionDragMode = () => {
      setIsActionDragMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', updateActionDragMode);
    updateActionDragMode();
    return () => window.removeEventListener('resize', updateActionDragMode);
  }, []);

  useEffect(() => {
    if (hoveredItem) {
      const timer = setTimeout(() => {
        setHoveredItem(null);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setIsTooltipHovered(false);
    }
  }, [hoveredItem]);

  const [exitCount, setExitCount] = useState(0);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If there's a state object, it's likely a modal or internal navigation, so skip exit logic
      if (e.state) return;

      if (location.pathname === '/') {
        setExitCount(prev => {
          const newCount = prev + 1;
          
          if (newCount >= 4) {
            setToast({ message: '앱을 종료하려면 한 번 더 눌러주세요.', visible: true });
            if (newCount >= 5) {
              console.log('App Exit Triggered');
              // In a real PWA environment, you might use specific APIs to exit
            }
            return newCount;
          }
          
          if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
          exitTimerRef.current = setTimeout(() => setExitCount(0), 2000);
          
          return newCount;
        });
        
        // Push state back to prevent actual back navigation if on home
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Initial push state to enable popstate on home
    if (location.pathname === '/') {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [location.pathname]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const commandPlaceholderExamples = useMemo(() => [
    '어떤 분위기와 장면의 노래를 만들까요? (예: 새벽 버스 창가에서 떠오른 이별 노래)',
    '주제와 상황을 한 문장으로 적어주세요. (예: 오래된 친구에게 못했던 말을 전하는 팝 발라드)',
    '스타일, 사운드, 보컬 느낌까지 적어도 좋아요. (예: 몽환적인 신스팝, 낮게 속삭이는 여성 보컬)',
    '가사에 넣고 싶은 장면이나 물건을 적어주세요. (예: 꺼진 휴대폰, 식은 커피, 비 오는 정류장)',
  ], []);
  const [commandPlaceholderIndex, setCommandPlaceholderIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCommandPlaceholderIndex((prev) => (prev + 1) % commandPlaceholderExamples.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [commandPlaceholderExamples.length]);
  const [kpopMode, setKpopMode] = useState<0 | 1 | 2>(0); // legacy K-Pop mode state
  const [isKoreanEnglishMix, setIsKoreanEnglishMix] = useState(false);
  const [englishMixRatio, setEnglishMixRatio] = useState(10);
  const [customStructure, setCustomStructure] = useState<CustomSectionItem[]>([]);
  const [citypopMode, setCitypopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: old, 2: modern
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isCycleKeywordPopupOpen, setIsCycleKeywordPopupOpen] = useState(false);
  const [isVocalCharacterModalOpen, setIsVocalCharacterModalOpen] = useState(false);
  const [isActionBarBlockedByModal, setIsActionBarBlockedByModal] = useState(false);
  const actionBarModalReleaseTimerRef = useRef<number | null>(null);
  const isAnyModalOpen = isGenreModalOpen || isGenreHierarchyModalOpen || isGuideModalOpen || isStructureModalOpen || isCycleKeywordPopupOpen || isVocalCharacterModalOpen || isGlobalSearchOpen || isGlobalSearchOpening || isSituationExpanded || isStoryboardOpening;
  const shouldShowActionButtons = !isActionBarBlockedByModal && !isAnyModalOpen;

  const syncActionBarModalBlock = useCallback((isOpen: boolean) => {
    if (actionBarModalReleaseTimerRef.current !== null) {
      window.clearTimeout(actionBarModalReleaseTimerRef.current);
      actionBarModalReleaseTimerRef.current = null;
    }

    if (isOpen) {
      setIsActionBarBlockedByModal(true);
      return;
    }

    actionBarModalReleaseTimerRef.current = window.setTimeout(() => {
      setIsActionBarBlockedByModal(false);
      actionBarModalReleaseTimerRef.current = null;
    }, 140);
  }, []);

  useEffect(() => {
    syncActionBarModalBlock(isAnyModalOpen);
  }, [isAnyModalOpen, syncActionBarModalBlock]);

  useEffect(() => {
    return () => {
      if (actionBarModalReleaseTimerRef.current !== null) {
        window.clearTimeout(actionBarModalReleaseTimerRef.current);
        actionBarModalReleaseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const resetStudioModalsForFullscreen = () => {
      // Fullscreen transitions can detach the active fullscreen root from normal
      // fixed/portal layers. Close every studio popup and clear backdrop guards so
      // no invisible modal layer keeps stealing click/drag input.
      setIsGenreModalOpen(false);
      setIsGenreHierarchyModalOpen(false);
      setIsGuideModalOpen(false);
      setIsSituationExpanded(false);
      setIsStoryboardOpening(false);
      if (storyboardOpenTimerRef.current !== null) {
        window.clearTimeout(storyboardOpenTimerRef.current);
        storyboardOpenTimerRef.current = null;
      }
      setIsStructureModalOpen(false);
      setIsCycleKeywordPopupOpen(false);
      setIsVocalCharacterModalOpen(false);
      setIsActionBarBlockedByModal(false);
      if (actionBarModalReleaseTimerRef.current !== null) {
        window.clearTimeout(actionBarModalReleaseTimerRef.current);
        actionBarModalReleaseTimerRef.current = null;
      }
      setIsGlobalSearchOpen(false);
      setIsGlobalSearchOpening(false);
      if (globalSearchOpenTimerRef.current !== null) {
        window.clearTimeout(globalSearchOpenTimerRef.current);
        globalSearchOpenTimerRef.current = null;
      }
      setGlobalSearchQuery('');
      setActiveGenreGroupId(null);
      genreModalHistoryPushedRef.current = false;
      globalSearchModalHistoryPushedRef.current = false;
      storyboardModalHistoryPushedRef.current = false;
      globalSearchBackdropMouseDownRef.current = false;
      storyboardModalBackdropMouseDownRef.current = false;
      unlockGlobalSearchScrollLock();
      window.dispatchEvent(new CustomEvent(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT));
      window.requestAnimationFrame(() => {
        unlockGlobalSearchScrollLock();
      });
    };

    document.addEventListener('fullscreenchange', resetStudioModalsForFullscreen);
    document.addEventListener('webkitfullscreenchange', resetStudioModalsForFullscreen as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', resetStudioModalsForFullscreen);
      document.removeEventListener('webkitfullscreenchange', resetStudioModalsForFullscreen as EventListener);
    };
  }, [unlockGlobalSearchScrollLock]);
  
  const isAdminUser = useMemo(() => userRole === 'admin', [userRole]);
  const effectiveUserTier: TagTier = useMemo(() => {
    if (userRole === 'admin' || userRole === 'pro') return 'pro';
    if (userRole === 'basic') return 'basic';
    return 'free';
  }, [userRole]);

  // Refs for stable access in callbacks
  const pinnedGenresRef = useRef(pinnedGenres);
  const pinnedThemesRef = useRef(pinnedThemes);
  const pinnedStylesRef = useRef(pinnedStyles);
  const pinnedInstrumentSoundsRef = useRef(pinnedInstrumentSounds);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const preserveHistoryIndexOnNextSnapshotRef = useRef<number | null>(null);
  const recentSongsReadyToCacheRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => { pinnedGenresRef.current = pinnedGenres; }, [pinnedGenres]);
  useEffect(() => { pinnedThemesRef.current = pinnedThemes; }, [pinnedThemes]);
  useEffect(() => { pinnedStylesRef.current = pinnedStyles; }, [pinnedStyles]);
  useEffect(() => { pinnedInstrumentSoundsRef.current = pinnedInstrumentSounds; }, [pinnedInstrumentSounds]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    localStorage.setItem('rememberLogin', String(rememberLogin));
  }, [rememberLogin]);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!generationModelNotice) return;
    const timer = window.setTimeout(() => setGenerationModelNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [generationModelNotice]);

  const hasInitializedHomeRef = useRef(false);

  type ClearAllOptions = {
    preserveHistory?: boolean;
    preservePinned?: boolean;
  };

  // Real-time tempo calculation when in random mode
  useEffect(() => {
    if (tempoEnabled && (selectedGenres.length > 0 || selectedMoods.length > 0 || subGenre.length > 0)) {
      const { min, max } = calculateOptimalBPM(selectedGenres, selectedMoods, subGenre);
      setMinBPM(min);
      setMaxBPM(max);
    }
  }, [selectedGenres, selectedMoods, subGenre, tempoEnabled]);

  // Automated Forced Logout Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isForcedLogoutModalOpen) {
      console.log("[ForceLogout Client] Modal opened - Countdown timer started");
      setForcedLogoutCountdown(10);
      isForcedLogoutProcessingRef.current = false;
      
      interval = setInterval(() => {
        setForcedLogoutCountdown((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            // Auto-logout when countdown reaches 0
                    if (!isForcedLogoutProcessingRef.current) {
                      isForcedLogoutProcessingRef.current = true;
                      console.log("[ForceLogout Client] Auto-logout triggered by timer");
                      handleLogout().then(() => {
                        setIsForcedLogoutModalOpen(false);
                        navigate('/');
                      });
                    }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForcedLogoutModalOpen, navigate]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. " );
        }
      }
    };
    testConnection();

    let unsubFavs: (() => void) | null = null;
    let unsubUserDoc: (() => void) | null = null;

    const getSessionStartTime = (targetUser: User | null) => {
      if (!targetUser?.metadata?.lastSignInTime) return 0;
      const ms = new Date(targetUser.metadata.lastSignInTime).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    const shouldProcessForceLogout = (forceLogoutAtValue: any, targetUser: User | null) => {
      const forceLogoutTime = getTimestampMs(forceLogoutAtValue);
      const sessionStartTime = getSessionStartTime(targetUser);
      
      const result = forceLogoutTime > 0 && sessionStartTime > 0 && 
                     forceLogoutTime > sessionStartTime && 
                     forceLogoutTime > lastForcedLogoutTimeRef.current;
      
      console.log(`[ForceLogout Client] shouldProcessForceLogout check:
        - forceLogoutTime: ${forceLogoutTime} (${forceLogoutTime > 0 ? new Date(forceLogoutTime).toLocaleString() : 'N/A'})
        - sessionStartTime: ${sessionStartTime} (${sessionStartTime > 0 ? new Date(sessionStartTime).toLocaleString() : 'N/A'})
        - lastProcessedTime: ${lastForcedLogoutTimeRef.current}
        - result: ${result}`);

      if (!result) return false;
      lastForcedLogoutTimeRef.current = forceLogoutTime;
      return true;
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      setIsForcedLogoutModalOpen(false);
      setForcedLogoutCountdown(10);
      lastForcedLogoutTimeRef.current = 0;
      hasCompletedForceLogoutReentryCheckRef.current = false;
      
      if (unsubFavs) {
        unsubFavs();
        unsubFavs = null;
      }
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);

        const runInitialForceLogoutCheck = async () => {
          try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              hasCompletedForceLogoutReentryCheckRef.current = true;
              return;
            }

            const data = userSnap.data();
            if (data.role) setUserRole(data.role as UserRole);
            if (data.accountStatus) {
              const status = data.accountStatus as AccountStatus;
              setUserStatus(status);
              if (status === 'banned') setIsBanModalOpen(true);
            }

            if (shouldProcessForceLogout(data.forceLogoutAt, currentUser)) {
              console.log('[ForceLogout Client] Re-entry detection triggered. Executing silent logout.');
              await performForcedLogout({ silent: true });
              return;
            }
          } catch (error) {
            console.error('[Auth Debug] Initial force logout check failed:', error);
          } finally {
            hasCompletedForceLogoutReentryCheckRef.current = true;
          }
        };

        runInitialForceLogoutCheck();

        // Sync user role in real-time
        unsubUserDoc = onSnapshot(userRef, (docSnap) => {
          console.log('[ForceLogout Client] User document snapshot received');
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role) setUserRole(data.role as UserRole);
            
            // Check for Banned status
            if (data.accountStatus) {
              const status = data.accountStatus as AccountStatus;
              setUserStatus(status);
              if (status === 'banned') {
                setIsBanModalOpen(true);
              }
            }

            if (!hasCompletedForceLogoutReentryCheckRef.current) {
              return;
            }

            if (shouldProcessForceLogout(data.forceLogoutAt, currentUser)) {
              console.log('[ForceLogout Client] Real-time detection triggered. Showing modal.');
              setIsForcedLogoutModalOpen(true);
            }
          } else {
            // Initial signup fallback
            setUserRole('free');
            setUserStatus('active');
          }
        }, (error) => {
          console.error('Failed to sync user role:', error);
        });

        const syncUserDoc = async () => {
          console.log("[Auth Debug] syncUserDoc triggered for:", currentUser.uid);
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            console.log("[Auth Debug] User Doc Exists:", userSnap.exists());

            const safeSessionData = {
              uid: currentUser.uid,
              email: currentUser.email ?? '',
              displayName: currentUser.displayName ?? '',
              lastLoginAt: Date.now(),
              lastSeenAt: Date.now(),
              isOnline: true,
            };

            if (!userSnap.exists()) {
              const favsSnap = await getDocs(
                query(collection(db, 'favorites'), where('uid', '==', currentUser.uid))
              );
              const songsSnap = await getDoc(doc(db, 'user_recent_songs', currentUser.uid));
              const songCount = songsSnap.exists() ? (songsSnap.data().songs?.length || 0) : 0;

              await setDoc(userRef, {
                ...safeSessionData,
                favoriteCount: favsSnap.size,
                songGeneratedCount: songCount,
                createdAt: Date.now(),
                role: 'free',
                accountStatus: 'active',
                paymentStatus: 'none',
              });
            } else {
              const currentData = userSnap.data();

              if (currentData.accountStatus === 'banned') {
                setIsBanModalOpen(true);
              }

              // Existing users: never touch role/plan/account status from the client.
              await updateDoc(userRef, safeSessionData);
            }
          } catch (error) {
            console.error('Failed to sync user document:', error);
          }
        };

        syncUserDoc();

        // Fetch favorites for the user
        const q = query(collection(db, 'favorites'), where('uid', '==', currentUser.uid));
        unsubFavs = onSnapshot(q, (snapshot) => {
          const favs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAtMs || getTimestampMs(a.createdAt);
              const bTime = b.createdAtMs || getTimestampMs(b.createdAt);
              return bTime - aTime;
            });
          setFavorites(favs);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'favorites');
        });
      } else {
        setFavorites([]);
        setUserRole('free');
      }
    });

    return () => {
      unsubscribe();
      if (unsubFavs) unsubFavs();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  }, []);

  const toggleFavorite = async (song: SongResult) => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      handleLogin();
      return;
    }

    // Activity indicator
    updateDoc(doc(db, 'users', user.uid), { lastSeenAt: Date.now(), isOnline: true }).catch(() => {});

    const existingFav = favorites.find(f => f.title === song.title && f.prompt === song.prompt);

    try {
      if (existingFav) {
        if (existingFav.isLocked) {
          showToast('잠긴 곡은 삭제할 수 없습니다.');
          return;
        }
        await deleteDoc(doc(db, 'favorites', existingFav.id));
        
        // Decrement favoriteCount in users document
        await updateDoc(doc(db, 'users', user.uid), {
          favoriteCount: increment(-1)
        }).catch(err => console.error("Failed to decrement favoriteCount:", err));

        showToast('곡이 삭제 되었습니다.');
      } else {
          await addDoc(collection(db, 'favorites'), sanitizeForFirestore({
            uid: user.uid,
            title: song.title,
            koreanTitle: song.koreanTitle ?? '',
            englishTitle: song.englishTitle ?? '',
            genre: getResolvedGenre(song),
            lyrics: song.lyrics,
            prompt: song.prompt,
            appliedKeywords: song.appliedKeywords,
            situationSummary: song.situationSummary || (song.appliedKeywords as any)?.situationSummary || '',
            isLocked: false,
            createdAtMs: Date.now(),
            createdAt: serverTimestamp()
          }));

        // Increment favoriteCount in users document
        await updateDoc(doc(db, 'users', user.uid), {
          favoriteCount: increment(1)
        }).catch(err => console.error("Failed to increment favoriteCount:", err));

        showToast('저장되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, existingFav ? OperationType.DELETE : OperationType.CREATE, 'favorites');
    }
  };

  const updateFavorite = async (id: string, updates: Partial<any>) => {
    try {
      const sanitizedUpdates = sanitizeForFirestore(updates);
      await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);
      setFavorites((prev) => prev.map((favorite) => {
        if (favorite.id !== id) return favorite;
        return {
          ...favorite,
          ...sanitizedUpdates,
          lyrics: sanitizedUpdates.lyrics
            ? { ...(favorite.lyrics || {}), ...(sanitizedUpdates.lyrics || {}) }
            : favorite.lyrics,
          appliedKeywords: sanitizedUpdates.appliedKeywords
            ? { ...(favorite.appliedKeywords || {}), ...(sanitizedUpdates.appliedKeywords || {}) }
            : favorite.appliedKeywords,
        };
      }));
      if ('isLocked' in updates) {
        showToast(updates.isLocked ? "곡을 잠궜습니다." : "잠김이 해제되었습니다.");
      } else {
        showToast('수정되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'favorites');
    }
  };

  const clearAllFavorites = async () => {
    if (!user) return;
    const unlockedFavs = favorites.filter(f => !f.isLocked);
    if (unlockedFavs.length === 0) {
      showToast('삭제할 수 있는 곡이 없습니다.');
      return;
    }

    if (userStatus === 'banned' && !isAdminUser) {
      showToast('차단된 계정입니다. 기능을 사용할 수 없습니다.');
      return;
    }

    try {
      const batch = writeBatch(db);
      unlockedFavs.forEach(f => {
        batch.delete(doc(db, 'favorites', f.id));
      });
      
      // Update favoriteCount
      batch.update(doc(db, 'users', user.uid), {
        favoriteCount: increment(-unlockedFavs.length)
      });

      await batch.commit();
      showToast(`${unlockedFavs.length}개의 곡이 삭제되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  const lockAllFavorites = async () => {
    if (!user) return;
    const unlockedFavs = favorites.filter(f => !f.isLocked);
    if (unlockedFavs.length === 0) {
      showToast('이미 모든 곡이 잠겨 있습니다.');
      return;
    }
    try {
      const batch = writeBatch(db);
      unlockedFavs.forEach(f => {
        batch.update(doc(db, 'favorites', f.id), { isLocked: true });
      });
      await batch.commit();
      showToast(`${unlockedFavs.length}개의 곡이 잠금 설정되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  const unlockAllFavorites = async () => {
    if (!user) return;
    const lockedFavs = favorites.filter(f => f.isLocked);
    if (lockedFavs.length === 0) {
      showToast('잠긴 곡이 없습니다.');
      return;
    }
    try {
      const batch = writeBatch(db);
      lockedFavs.forEach(f => {
        batch.update(doc(db, 'favorites', f.id), { isLocked: false });
      });
      await batch.commit();
      showToast(`${lockedFavs.length}개의 곡이 잠금 해제되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // SORIDRAW_RANDOM_GENRE_LEAF_ONLY_RESTORE_FIX: 랜덤/복원에서 중분류 폴더가 실제 장르처럼 선택되지 않도록 leaf 장르만 후보로 사용
  const hierarchyLeafGenreItems = useMemo(() => {
    return GENRE_HIERARCHY.flatMap((group: any) =>
      (group.children || []).flatMap((main: any) =>
        Array.isArray(main.children) && main.children.length > 0 ? main.children : [main]
      )
    );
  }, []);

  const hierarchyLeafGenreIdSet = useMemo(() => {
    return new Set(hierarchyLeafGenreItems.map((item: any) => item.id));
  }, [hierarchyLeafGenreItems]);

  const pickRandomLeafGenreId = useCallback((): string | null => {
    const randomPool = hierarchyLeafGenreItems.filter((item: any) => !isInstrumentalBgmGenreId(item?.id));
    if (randomPool.length === 0) return null;
    const randomItem = randomPool[Math.floor(Math.random() * randomPool.length)];
    return randomItem?.id ?? null;
  }, [hierarchyLeafGenreItems]);

  const applyKeywordsToNext = useCallback((appliedKeywords: SongResult['appliedKeywords']) => {
    // Mobile browsers can keep the tapped result-card tooltip hovered after applying keywords.
    // Clear only that transient hint so the bottom generate bar does not look expanded/stuck.
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoveredItem(null);
    setIsTooltipHovered(false);

    const normalizeGenreKey = (value: string) => String(value || '')
      .replace(/\bcore\b/gi, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/['"`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const allSelectableGenres = hierarchyLeafGenreItems;

    const resolveSelectableGenreId = (value: unknown): string | null => {
      const raw = String(value || '').trim();
      if (!raw || isSeparatorKeywordId(raw)) return null;

      const exact = allSelectableGenres.find((item: any) =>
        item.id === raw || item.label === raw || item.labelKo === raw
      );
      if (exact) return exact.id;

      const normalized = normalizeGenreKey(raw);
      const fuzzy = allSelectableGenres.find((item: any) => {
        const keys = [item.id, item.label, item.labelKo]
          .filter(Boolean)
          .map((key) => normalizeGenreKey(String(key)));
        return keys.includes(normalized);
      });
      if (fuzzy) return fuzzy.id;

      const legacySub = resolveSubGenreId(raw);
      if (legacySub) return legacySub;

      const legacyMid = resolveMidGenreId(raw);
      if (legacyMid) {
        const midAsSelectable = allSelectableGenres.find((item: any) => item.id === legacyMid);
        if (midAsSelectable) return midAsSelectable.id;
      }

      return null;
    };

    // 중분류는 더 이상 별도 상태로 복원하지 않는다.
    // 저장된 genre/subGenre 라벨을 모두 실제 선택 가능한 장르 ID로 풀어서 subGenre 슬롯에만 복원한다.
    const restoredGenreIds = Array.from(new Set([
      ...((appliedKeywords.subGenre ?? []) as string[]),
      ...((appliedKeywords.genre ?? []) as string[]),
    ]
      .map(resolveSelectableGenreId)
      .filter(Boolean) as string[]));

    setSelectedGenres([]);
    setSubGenre(limitFusionGenreIds(restoredGenreIds));

    const rawMoodValues = Array.isArray(appliedKeywords.mood) ? appliedKeywords.mood : [];
    const rawThemeValues = Array.isArray(appliedKeywords.theme) ? appliedKeywords.theme : [];
    const explicitCustomMoodInput = String((appliedKeywords as any).customMoodInput || '').trim();
    const explicitCustomThemeInput = String((appliedKeywords as any).customThemeInput || '').trim();

    const moodIds = Array.from(new Set(mapLabelsToIds(rawMoodValues, MOODS)));
    const themeIds = Array.from(new Set(mapLabelsToIds(rawThemeValues, THEMES)));

    const restoredMoodIds = explicitCustomMoodInput
      ? [makeCustomKeywordId(CUSTOM_MOOD_PREFIX, explicitCustomMoodInput)]
      : moodIds.length > 0
        ? moodIds
        : rawMoodValues.length === 1
          ? [makeCustomKeywordId(CUSTOM_MOOD_PREFIX, String(rawMoodValues[0] || '').trim())].filter((id) => id !== makeCustomKeywordId(CUSTOM_MOOD_PREFIX, ''))
          : [];

    const restoredThemeIds = explicitCustomThemeInput
      ? [makeCustomKeywordId(CUSTOM_THEME_PREFIX, explicitCustomThemeInput)]
      : themeIds.length > 0
        ? themeIds
        : rawThemeValues.length === 1
          ? [makeCustomKeywordId(CUSTOM_THEME_PREFIX, String(rawThemeValues[0] || '').trim())].filter((id) => id !== makeCustomKeywordId(CUSTOM_THEME_PREFIX, ''))
          : [];

    const normalizeStringList = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
      const single = String(value || '').trim();
      return single ? [single] : [];
    };

    const pointSoundIds = resolveSoundTextureIds(normalizeStringList((appliedKeywords as any).pointSounds ?? (appliedKeywords as any).pointSound));

    if ((appliedKeywords as any).situation) {
      setSituation((appliedKeywords as any).situation as SituationConfig);
    } else {
      setSituation(createEmptySituation());
    }
    const styleIds = resolveStyleIds(appliedKeywords.style ?? appliedKeywords.theme ?? []);
    const rawInstrumentSoundIds = resolveSoundTextureIds(appliedKeywords.instrumentSound ?? []);

    // SORIDRAW_RECOMMENDED_SOUND_COMBO_NEXT_APPLY_FIX: 다음곡 적용 시 추천조합으로 자동 선택된 실제 악기들을 UI 강조 상태까지 복원
    const restoreRecommendedSoundComboFromAppliedKeywords = (ids: string[]) => {
      const ordered: string[] = [];
      const restoredAppliedMap: Record<string, string[]> = {};
      const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
      const idSet = new Set(uniqueIds);

      const recommendationVariants = SOUND_TEXTURE_CYCLES
        .flatMap((cycle) => cycle.variants as readonly any[])
        .filter((variant) => isSelectableKeywordItem(variant) && Array.isArray((variant as any).applyPools));

      uniqueIds.forEach((id) => {
        const recommendation = recommendationVariants.find((variant) => variant.id === id);

        if (!recommendation) {
          ordered.push(id);
          return;
        }

        const pools = ((recommendation as any).applyPools as string[][] | undefined) ?? [];
        const poolFlat = Array.from(new Set(pools.flat().filter(Boolean)));
        const savedChildren = poolFlat.filter((poolId) => idSet.has(poolId));

        let restoredChildren = savedChildren;
        if (restoredChildren.length === 0 && pools.length > 0) {
          // 과거 저장본처럼 추천조합 ID만 남아있는 경우에는 랜덤 재선택 대신 첫 후보를 사용한다.
          restoredChildren = (pools[0] ?? []).filter(Boolean);
        }

        const expandedIds = Array.from(new Set([id, ...restoredChildren].filter(Boolean)));
        restoredAppliedMap[id] = expandedIds;
        ordered.push(...expandedIds);
      });

      return {
        restoredSelection: Array.from(new Set(ordered)),
        restoredAppliedMap,
      };
    };

    const {
      restoredSelection: instrumentSoundIds,
      restoredAppliedMap: restoredRecommendedSoundComboAppliedIds,
    } = restoreRecommendedSoundComboFromAppliedKeywords(rawInstrumentSoundIds);
    recommendedSoundComboAppliedIdsRef.current = restoredRecommendedSoundComboAppliedIds;

    const resolvedKpopMode = appliedKeywords.kpopMode ?? (restoredGenreIds.includes('kpop') ? 1 : 0);
    const resolvedMixedLyrics = appliedKeywords.isKoreanEnglishMix ?? (appliedKeywords.kpopMode === 2);

    // Overwrite pinned keywords when applying from Favorites or Results
    setPinnedGenres([]);
    setPinnedThemes([]);

    setSelectedMoods(restoredMoodIds);
    setSelectedThemes(restoredThemeIds);
    setSelectedStyles(styleIds);
    setSelectedInstrumentSounds(instrumentSoundIds);
    setSelectedPointSounds(pointSoundIds);
    setIsPointSoundMode(pointSoundIds.length > 0);
    setKpopMode(restoredGenreIds.includes('kpop') ? resolvedKpopMode : 0);
    setIsKoreanEnglishMix(resolvedMixedLyrics);
    setEnglishMixRatio(Math.max(5, Math.min(90, Number((appliedKeywords as any).englishMixRatio ?? 10) || 10)));
    setCitypopMode(restoredGenreIds.includes('citypop') ? ((appliedKeywords.citypopMode ?? 1) as 0 | 1 | 2) : 0);

    // Expand to include other generation settings
    if (appliedKeywords.lyricsLength) setLyricsLength(appliedKeywords.lyricsLength);
    if (appliedKeywords.songStructure) setSongStructure(appliedKeywords.songStructure);
    if (appliedKeywords.maleCount !== undefined) setMaleCount(appliedKeywords.maleCount);
    if (appliedKeywords.femaleCount !== undefined) setFemaleCount(appliedKeywords.femaleCount);
    if (appliedKeywords.rapEnabled !== undefined) setRapEnabled(appliedKeywords.rapEnabled);
    if (appliedKeywords.customStructure) setCustomStructure(normalizeCustomStructure(appliedKeywords.customStructure));
    
    if (appliedKeywords.userInput !== undefined) setUserInput(appliedKeywords.userInput);
    if (appliedKeywords.lyricDraft !== undefined) setLyricDraft(appliedKeywords.lyricDraft);
    if (appliedKeywords.isLyricMode !== undefined) setIsLyricMode(appliedKeywords.isLyricMode);
    if (appliedKeywords.lyricMode !== undefined) setLyricMode(appliedKeywords.lyricMode);

    if (appliedKeywords.vocal) {
      const v = appliedKeywords.vocal;
      setSelectedVocalToneId(undefined);
      if (v.mode) setVocalMode(v.mode);
      if (v.members) setVocalMembers(v.members);
    }

    const appliedTempoSource = String((appliedKeywords as any).tempoSource || '').trim().toLowerCase();
    const shouldRestoreRandomTempo = Boolean((appliedKeywords as any).isRandomTempo) || appliedTempoSource === 'random';

    if (appliedKeywords.tempoConfig) {
      setTempoEnabled(shouldRestoreRandomTempo ? true : appliedKeywords.tempoConfig.enabled);
      setMinBPM(appliedKeywords.tempoConfig.min);
      setMaxBPM(appliedKeywords.tempoConfig.max);
    } else if (appliedKeywords.tempo) {
      const bpmMatch = appliedKeywords.tempo.match(/(\d+)/g);
      if (bpmMatch) {
        if (bpmMatch.length === 1) {
          const bpm = parseInt(bpmMatch[0]);
          setMinBPM(bpm);
          setMaxBPM(bpm);
        } else if (bpmMatch.length === 2) {
          setMinBPM(parseInt(bpmMatch[0]));
          setMaxBPM(parseInt(bpmMatch[1]));
        }
        // 다음곡 적용에서 랜덤 템포로 생성된 곡은 수동 BPM으로 고정하지 않는다.
        // UI에 표시된 이전 BPM 범위는 복원하되, 생성 시에는 현재 장르/분위기 기준으로 다시 최적화된다.
        setTempoEnabled(shouldRestoreRandomTempo ? true : false);
      } else if (shouldRestoreRandomTempo) {
        setTempoEnabled(true);
      }
    } else if (shouldRestoreRandomTempo) {
      setTempoEnabled(true);
    }

    showToast('키워드가 다음 곡에 적용되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hierarchyLeafGenreItems, setSelectedGenres, setSubGenre, setSelectedMoods, setSelectedThemes, setSelectedStyles, setSelectedInstrumentSounds, setSelectedPointSounds, setIsPointSoundMode, setKpopMode, setIsKoreanEnglishMix, setCitypopMode, setLyricsLength, setSongStructure, setPinnedGenres, setPinnedThemes, setMaleCount, setFemaleCount, setRapEnabled, setCustomStructure, setTempoEnabled, setMinBPM, setMaxBPM, showToast]);


  const [isGenreRandomized, setIsGenreRandomized] = useState(false);
  const [isMoodRandomized, setIsMoodRandomized] = useState(false);
  const [isThemeRandomized, setIsThemeRandomized] = useState(false);
  const [isStyleRandomized, setIsStyleRandomized] = useState(false);
  const [isSoundTextureRandomized, setIsSoundTextureRandomized] = useState(false);

  const randomizeCategory = (category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    if (isMenuLocked(category)) {
      showToast(`${{ genre: '장르', mood: '분위기', theme: '주제', style: '스타일', sound: '사운드' }[category]} 메뉴가 잠겨 있습니다.`);
      return;
    }

    const limits = {
      genre: 2,
      style: Number.POSITIVE_INFINITY,
      sound: 3,
      mood: 5,
      theme: 4
    };
    
    const allRaw = category === 'genre' ? GENRES : (category === 'mood' ? MOODS : (category === 'theme' ? THEMES : (category === 'style' ? SOUND_STYLES : INSTRUMENT_SOUNDS)));
    const all = category === 'sound'
      ? (allRaw as any[]).filter((item) => isSelectableKeywordItem(item) && String(item.promptCore || '').trim().length > 0)
      : (allRaw as any[]).filter(isSelectableKeywordItem);
    const pinned = category === 'genre' ? pinnedGenres : (category === 'theme' ? [] : (category === 'style' ? pinnedStyles : pinnedInstrumentSounds));
    const isGenre = category === 'genre';
    
    // Calculate current count of other categories to respect total 15 limit
    const otherCount = (category === 'genre' ? 0 : selectedGenres.length) +
                       (category === 'mood' ? 0 : selectedMoods.length) +
                       (category === 'theme' ? 0 : selectedThemes.length) +
                       (category === 'style' ? 0 : selectedStyles.length) +
                       (category === 'sound' ? 0 : selectedInstrumentSounds.length + selectedPointSounds.length);
    
    const maxForCat = limits[category];
    const maxAllowedByTotal = Math.max(0, 15 - otherCount);
    const finalLimit = Math.min(maxForCat, maxAllowedByTotal);
    
    // Start with pinned items, but don't exceed finalLimit
    let result = category === 'mood' ? [] : [...pinned].slice(0, finalLimit);
    
    const remainingPool = all.filter(item => 
      (category === 'mood' ? true : !pinned.includes(item.id)) && 
      (!isGenre || !TROT_GENRES.includes(item.id))
    );
    
    const currentCount = result.length;
    const needed = finalLimit - currentCount;
    
    let pickedIds: string[] = [];
    if (needed > 0) {
      // Pick between 1 and 'needed' items
      const additionalCount = Math.floor(Math.random() * needed) + 1;
      const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, additionalCount);
      pickedIds = picked.map(p => p.id);
    }
    
    const final = [...result, ...pickedIds];
    
    if (category === 'genre') {
      setSelectedGenres([]);
      setSubGenre(limitFusionGenreIds(final));
      setIsGenreRandomized(true);
    } else if (category === 'mood') {
      setSelectedMoods(final);
      setIsMoodRandomized(true);
    } else if (category === 'theme') {
      setSelectedThemes(final);
      setIsThemeRandomized(true);
    } else if (category === 'style') {
      setSelectedStyles(final);
      setIsStyleRandomized(true);
    } else if (category === 'sound') {
      const finalSoundSelection = expandRecommendedSoundComboSelection(final, { syncRef: true });
      setSelectedInstrumentSounds(finalSoundSelection);
      setSelectedPointSounds([]);
      setIsPointSoundMode(false);
      setIsSoundTextureRandomized(true);
    }
  };

  // SORIDRAW_RECOMMENDED_SOUND_COMBO_FIX_V20: 추천조합 해제 시 새 조합이 다시 적용되지 않도록 분리
  const recommendedSoundComboAppliedIdsRef = useRef<Record<string, string[]>>({});

  const getRecommendedSoundComboVariant = useCallback((variantId: string) => {
    return SOUND_TEXTURE_CYCLES
      .flatMap((cycle) => cycle.variants as readonly any[])
      .find((variant) => isSelectableKeywordItem(variant) && variant.id === variantId && Array.isArray((variant as any).applyPools));
  }, []);

  const expandRecommendedSoundComboSelection = useCallback((ids: string[], options?: { syncRef?: boolean }) => {
    const expanded: string[] = [];
    const nextAppliedMap: Record<string, string[]> = {};

    ids.forEach((id) => {
      const recommendation = getRecommendedSoundComboVariant(id);

      if (!recommendation) {
        expanded.push(id);
        return;
      }

      const pools = ((recommendation as any).applyPools as string[][] | undefined) ?? [];
      const existingApplied = recommendedSoundComboAppliedIdsRef.current[id]?.filter(Boolean) ?? [];
      const existingPool = existingApplied.filter((appliedId) => appliedId !== id);
      const pickedPool = existingPool.length > 0
        ? existingPool
        : (pools[Math.floor(Math.random() * pools.length)] ?? []);
      const expandedIds = Array.from(new Set([id, ...pickedPool].filter(Boolean)));

      nextAppliedMap[id] = expandedIds;
      expanded.push(...expandedIds);
    });

    if (options?.syncRef) {
      recommendedSoundComboAppliedIdsRef.current = nextAppliedMap;
    }

    return Array.from(new Set(expanded));
  }, [getRecommendedSoundComboVariant]);

  const applyRecommendedSoundCombo = useCallback((variantId: string) => {
    const recommendation = getRecommendedSoundComboVariant(variantId);

    if (!recommendation) return false;

    const pools = (recommendation as any).applyPools as string[][];
    if (!pools.length) return false;

    const pickedPool = pools[Math.floor(Math.random() * pools.length)] ?? [];
    const nextSounds = Array.from(new Set([variantId, ...pickedPool].filter(Boolean)));
    recommendedSoundComboAppliedIdsRef.current = { [variantId]: nextSounds };
    setSelectedInstrumentSounds(nextSounds);
    setIsSoundTextureRandomized(false);
    return true;
  }, [getRecommendedSoundComboVariant]);

  const clearRecommendedSoundCombo = useCallback((variantId: string) => {
    const recommendation = getRecommendedSoundComboVariant(variantId);
    if (!recommendation) return false;

    const appliedIds = recommendedSoundComboAppliedIdsRef.current[variantId];
    const fallbackPoolIds = ((recommendation as any).applyPools as string[][] | undefined)?.flat?.() ?? [];
    const idsToRemove = new Set([variantId, ...(appliedIds ?? fallbackPoolIds)]);

    delete recommendedSoundComboAppliedIdsRef.current[variantId];
    setSelectedInstrumentSounds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    setIsSoundTextureRandomized(false);
    return true;
  }, [getRecommendedSoundComboVariant]);

  const recommendedComboAppliedSoundIds = useMemo(() => {
    const recommenderIds = new Set(Object.keys(recommendedSoundComboAppliedIdsRef.current));
    return Array.from(
      new Set(
        Object.values(recommendedSoundComboAppliedIdsRef.current)
          .flat()
          .filter((id) => selectedInstrumentSounds.includes(id) && !recommenderIds.has(id))
      )
    );
  }, [selectedInstrumentSounds]);

  const getSubGenreIdsForMainGenre = useCallback((mainId: string | null | undefined): string[] => {
    if (!mainId) return [];
    for (const group of GENRE_HIERARCHY) {
      const main = group.children.find((item) => item.id === mainId);
      if (main) return (main.children || []).map((sub) => sub.id);
    }
    return [];
  }, []);

  const handleGenreSelect = (genreId: string) => {
    setSelectedGenres([]);
    setSubGenre([genreId]);
    setIsGenreRandomized(false);

    if (genreId === 'kpop') {
      setKpopMode(1);
    } else {
      setKpopMode(0);
    }

    if (genreId === 'citypop') {
      setCitypopMode(1);
    } else {
      setCitypopMode(0);
    }

    closeGenreModal('ui');
  };

  const randomizeSingleGenre = () => {
    const randomLeafGenreId = pickRandomLeafGenreId();
    if (!randomLeafGenreId) return;
    handleGenreSelect(randomLeafGenreId);
    setIsGenreRandomized(true);
  };

  // History state is cached locally first, but Firestore remains the source of truth.
  // Important: do not treat an empty/poisoned local cache as fresh, or it can hide older generated songs.
  useEffect(() => {
    if (!user) {
      recentSongsReadyToCacheRef.current = false;
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
      setLatestGenerationBatchId(null);
      return;
    }

    let isCancelled = false;
    recentSongsReadyToCacheRef.current = false;

    const cached = loadRecentSongsCache(user.uid);
    const cachedHistory = Array.isArray(cached?.history) ? cached!.history : [];
    const hasUsableCache = cachedHistory.length > 0;
    const hasFreshCache = hasUsableCache && Date.now() - (cached?.cachedAt || 0) < RECENT_SONGS_CACHE_TTL_MS;

    if (hasUsableCache) {
      applyRecentSongsState(cachedHistory, {
        preferredIndex: cached?.historyIndex,
        latestBatchId: cached?.latestGenerationBatchId || null,
      });
    } else {
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
      setLatestGenerationBatchId(null);
    }

    if (hasFreshCache) {
      recentSongsReadyToCacheRef.current = true;
      return;
    }

    const loadRecentSongsFromFirestore = async () => {
      try {
        const ref = doc(db, "user_recent_songs", user.uid);
        const snap = await getDoc(ref);
        if (isCancelled) return;

        const preservedIndex = preserveHistoryIndexOnNextSnapshotRef.current;
        preserveHistoryIndexOnNextSnapshotRef.current = null;

        const firestoreSongs = snap.exists() ? normalizeRecentSongList(snap.data().songs || []) : [];
        const recoverySongs = findRecoverableLocalRecentSongs(user.uid);
        const finalSongs = mergeRecentSongLists(firestoreSongs, recoverySongs);

        const preferredIndex = preservedIndex ?? cached?.historyIndex ?? 0;
        applyRecentSongsState(finalSongs, {
          preferredIndex: finalSongs.length ? preferredIndex : -1,
          latestBatchId: (finalSongs[0]?.appliedKeywords as any)?.generationBatchId || null,
        });

        // If Firestore was accidentally overwritten with a shorter list, restore the merged list once.
        if (finalSongs.length > firestoreSongs.length) {
          await setDoc(ref, sanitizeForFirestore({ songs: finalSongs }), { merge: true });
        }

        recentSongsReadyToCacheRef.current = true;
      } catch (error) {
        // If Firestore fails, keep a usable cache as temporary fallback.
        // If there is no usable cache, do not save the empty placeholder over the cache.
        recentSongsReadyToCacheRef.current = hasUsableCache;
        if (!hasUsableCache) {
          console.error('Failed to load recent songs:', error);
        }
      }
    };

    void loadRecentSongsFromFirestore();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !recentSongsReadyToCacheRef.current) return;
    saveRecentSongsCache(user.uid, {
      history,
      historyIndex,
      latestGenerationBatchId,
    });
  }, [user, history, historyIndex, latestGenerationBatchId]);


  const toggleSelection = (id: string, category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    const setters = {
      genre: { state: selectedGenres, set: setSelectedGenres, pinned: pinnedGenres },
      mood: { state: selectedMoods, set: setSelectedMoods, pinned: [] },
      theme: { state: selectedThemes, set: setSelectedThemes, pinned: [] },
      style: { state: selectedStyles, set: setSelectedStyles, pinned: pinnedStyles },
      sound: { state: selectedInstrumentSounds, set: setSelectedInstrumentSounds, pinned: pinnedInstrumentSounds }
    };
    
    const { state, set, pinned } = setters[category];
    
    // If pinned, don't allow unselecting unless unpinned first
    if (pinned.includes(id)) return;

    // Reset randomized state when manual change occurs
    if (category === 'genre') setIsGenreRandomized(false);
    if (category === 'mood') setIsMoodRandomized(false);
    if (category === 'theme') setIsThemeRandomized(false);
    if (category === 'style') setIsStyleRandomized(false);
    if (category === 'sound') setIsSoundTextureRandomized(false);

    // K-Pop Special Logic
    if (category === 'genre' && id === 'kpop') {
      const nextMode = ((kpopMode + 1) % 3) as 0 | 1 | 2;
      let canChange = true;
      
      if (nextMode !== 0 && !state.includes(id) && state.length >= MAX_FUSION_GENRES) {
        canChange = false;
      }

      if (canChange) {
        setKpopMode(nextMode);
        if (nextMode === 0) {
          set(state.filter(i => i !== id));
        } else if (!state.includes(id)) {
          set(limitFusionGenreIds([...state, id]));
        }

        // Update hover description
        const kpopItem = GENRES.find(g => g.id === 'kpop')!;
        let nextDesc = "K-Pop 장르를 선택하고 스타일(기본/Mix)을 순환하며 선택합니다.";
        if (nextMode === 2) nextDesc = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
        else if (nextMode === 1) nextDesc = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
        
        setHoveredItem({ ...kpopItem, description: nextDesc, _ts: Date.now() });
      }
      return;
    }

    // City Pop Special Logic
    if (category === 'genre' && id === 'citypop') {
      const nextMode = ((citypopMode + 1) % 3) as 0 | 1 | 2;
      let canChange = true;
      
      if (nextMode !== 0 && !state.includes(id) && state.length >= MAX_FUSION_GENRES) {
        canChange = false;
      }

      if (canChange) {
        setCitypopMode(nextMode);
        if (nextMode === 0) {
          set(state.filter(i => i !== id));
        } else if (!state.includes(id)) {
          set(limitFusionGenreIds([...state, id]));
        }

        // Update hover description
        const citypopItem = GENRES.find(g => g.id === 'citypop')!;
        let nextDesc = "City Pop 장르를 선택하고 스타일(올드/현대)을 순환하며 선택합니다.";
        if (nextMode === 2) nextDesc = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
        else if (nextMode === 1) nextDesc = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
        
        setHoveredItem({ ...citypopItem, description: nextDesc, _ts: Date.now() });
      }
      return;
    }

    const removeDirectCustomKeyword = (values: string[]) => {
      if (category === 'mood') return values.filter((value) => !isCustomMoodKeyword(value));
      if (category === 'theme') return values.filter((value) => !isCustomThemeKeyword(value));
      return values;
    };

    if (state.includes(id)) {
      set(removeDirectCustomKeyword(state.filter(i => i !== id)));
      
      // Trot Logic: Auto-unselect moods
      if (category === 'genre') {
        if (id === 'traditional-trot') {
          const moodsToRemove = ['sad', 'nostalgic', 'lonely', 'emotional', 'dark'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        } else if (id === 'semi-trot') {
          const moodsToRemove = ['bright', 'hopeful', 'warm', 'tense'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        }
      }
    } else if (category === 'genre' ? state.length < MAX_FUSION_GENRES : removeDirectCustomKeyword(state).length < 10) {
      const nextState = removeDirectCustomKeyword([...state, id]);
      set(category === 'genre' ? limitFusionGenreIds(nextState) : nextState);
      
      // Trot Logic: Auto-select moods
      if (category === 'genre') {
        if (id === 'traditional-trot') {
          const moodsToAdd = ['sad', 'nostalgic', 'lonely', 'emotional', 'dark'];
          setSelectedMoods(prev => {
            const combined = Array.from(new Set([...prev, ...moodsToAdd]));
            return combined.slice(0, 9);
          });
        } else if (id === 'semi-trot') {
          const moodsToAdd = ['bright', 'hopeful', 'warm', 'tense'];
          setSelectedMoods(prev => {
            const combined = Array.from(new Set([...prev, ...moodsToAdd]));
            return combined.slice(0, 9);
          });
        }
      }
    }

    // For all other items, update hover description on click (for mobile support)
    const item = [...GENRES, ...MOODS, ...THEMES].find(i => i.id === id);
    if (item) {
      setHoveredItem({ ...item, _ts: Date.now() });
    }
  };

  const applyDirectMoodInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsMoodRandomized(false);
    setSelectedMoods([makeCustomKeywordId(CUSTOM_MOOD_PREFIX, trimmed)]);
    setHoveredItem({
      id: 'custom-mood-direct-input',
      label: trimmed,
      labelKo: trimmed,
      description: '직접 입력한 분위기 키워드입니다.',
      _ts: Date.now(),
    });
  };

  const applyDirectThemeInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsThemeRandomized(false);
    setSelectedThemes([makeCustomKeywordId(CUSTOM_THEME_PREFIX, trimmed)]);
    setHoveredItem({
      id: 'custom-theme-direct-input',
      label: trimmed,
      labelKo: trimmed,
      description: '직접 입력한 주제 키워드입니다.',
      _ts: Date.now(),
    });
  };

  const clearDirectMoodInput = () => {
    setSelectedMoods((prev) => prev.filter((id) => !isCustomMoodKeyword(id)));
  };

  const clearDirectThemeInput = () => {
    setSelectedThemes((prev) => prev.filter((id) => !isCustomThemeKeyword(id)));
  };

  const togglePin = (id: string, category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    if (category === 'mood' || category === 'theme') return;
    const setters = {
      genre: { pinned: pinnedGenres, setPinned: setPinnedGenres, selected: selectedGenres, setSelected: setSelectedGenres },
      theme: { pinned: pinnedThemes, setPinned: setPinnedThemes, selected: selectedThemes, setSelected: setSelectedThemes },
      style: { pinned: pinnedStyles, setPinned: setPinnedStyles, selected: selectedStyles, setSelected: setSelectedStyles },
      sound: { pinned: pinnedInstrumentSounds, setPinned: setPinnedInstrumentSounds, selected: selectedInstrumentSounds, setSelected: setSelectedInstrumentSounds }
    };

    const { pinned, setPinned, selected, setSelected } = setters[category as Exclude<typeof category, 'mood'>];
    const isPinned = pinned.includes(id);

    if (isPinned) {
      setPinned(pinned.filter(i => i !== id));
    } else {
      // When pinning, ensure it's also selected
      if (!selected.includes(id)) {
        if (category === 'genre' ? selected.length < MAX_FUSION_GENRES : selected.length < 15) {
          setSelected(category === 'genre' ? limitFusionGenreIds([...selected, id]) : [...selected, id]);
          setPinned([...pinned, id]);
        }
      } else {
        setPinned([...pinned, id]);
      }
    }
  };

  const clearCategory = (category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    if (category === 'genre') {
      setSelectedGenres(pinnedGenres);
      if (!pinnedGenres.includes('kpop')) setKpopMode(0);
      if (!pinnedGenres.includes('citypop')) setCitypopMode(0);
      setIsGenreRandomized(false);
    }
    if (category === 'mood') {
      setSelectedMoods([]);
      setIsMoodRandomized(false);
    }
    if (category === 'theme') {
      setSelectedThemes([]);
      setIsThemeRandomized(false);
    }
    if (category === 'style') {
      setSelectedStyles(pinnedStyles);
      setIsStyleRandomized(false);
    }
    if (category === 'sound') {
      recommendedSoundComboAppliedIdsRef.current = {};
      setSelectedInstrumentSounds(pinnedInstrumentSounds);
      setSelectedPointSounds([]);
      setIsPointSoundMode(false);
      setIsSoundTextureRandomized(false);
    }
  };

  const updateSituationField = (field: keyof SituationConfig, value: string | boolean | string[] | number) => {
    setSituation(prev => {
      const next = { ...prev, [field]: value } as SituationConfig;
      return sanitizeStoryboardSituation(next);
    });
  };

  const openStoryboardModal = () => {
    if (isSituationExpanded || isStoryboardOpening) return;
    syncActionBarModalBlock(true);
    setDraftSituation(sanitizeStoryboardSituation(situation));
    setIsStoryboardOpening(true);
    if (!storyboardModalHistoryPushedRef.current) {
      window.history.pushState({ modal: 'storyboard' }, '', window.location.href);
      storyboardModalHistoryPushedRef.current = true;
    }
    if (storyboardOpenTimerRef.current !== null) {
      window.clearTimeout(storyboardOpenTimerRef.current);
    }
    storyboardOpenTimerRef.current = window.setTimeout(() => {
      setIsSituationExpanded(true);
      setIsStoryboardOpening(false);
      storyboardOpenTimerRef.current = null;
    }, 120);
  };

  const closeStoryboardModal = (source: 'ui' | 'history' = 'ui') => {
    if (storyboardOpenTimerRef.current !== null) {
      window.clearTimeout(storyboardOpenTimerRef.current);
      storyboardOpenTimerRef.current = null;
    }
    setIsStoryboardOpening(false);
    if (source === 'ui' && storyboardModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setDraftSituation(sanitizeStoryboardSituation(situation));
    setIsSituationExpanded(false);
    storyboardModalHistoryPushedRef.current = false;
  };

  const updateDraftSituationField = (field: keyof SituationConfig | StoryboardSliderField, value: string | boolean | string[] | number) => {
    setDraftSituation(prev => {
      const next = { ...prev, [field]: value } as SituationConfig;
      return { ...next, enabled: hasActiveSituation({ ...next, enabled: false }) };
    });
  };

  const clearDraftSituation = () => {
    setDraftSituation(createEmptySituation());
  };

  const applyStoryboardModal = () => {
    if (storyboardOpenTimerRef.current !== null) {
      window.clearTimeout(storyboardOpenTimerRef.current);
      storyboardOpenTimerRef.current = null;
    }
    setIsStoryboardOpening(false);
    const normalized = sanitizeStoryboardSituation(draftSituation);
    setSituation(normalized);
    if (storyboardModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsSituationExpanded(false);
  };

  const isStoryboardDraftChanged = serializeStoryboardSituation(draftSituation) !== serializeStoryboardSituation(situation);
  const hasDraftStoryboard = hasActiveSituation(draftSituation);

  useLayoutEffect(() => {
    if (!isSituationExpanded) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const originalBodyTouchAction = document.body.style.touchAction;

    // Keep the page geometry stable while Storyboard is open.
    // Using position: fixed here made the mobile floating action bar return with
    // a different jump/reflow from the other modal popups.
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    const handleStoryboardModalPopState = (event: PopStateEvent) => {
      if (storyboardModalHistoryPushedRef.current) {
        event.stopImmediatePropagation();
        closeStoryboardModal('history');
      }
    };

    const handleStoryboardModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStoryboardModal();
      }
    };

    window.addEventListener('popstate', handleStoryboardModalPopState, true);
    window.addEventListener('keydown', handleStoryboardModalKeyDown);

    return () => {
      window.removeEventListener('popstate', handleStoryboardModalPopState, true);
      window.removeEventListener('keydown', handleStoryboardModalKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
      document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;
      document.body.style.touchAction = originalBodyTouchAction;
    };
  }, [isSituationExpanded, situation]);

  const toggleSituationDetailPreset = (label: string) => {
    setSituation(prev => {
      const current = prev.detailPresets || [];
      const detailPresets = current.includes(label)
        ? current.filter(item => item !== label)
        : [...current, label];
      const next = { ...prev, detailPresets } as SituationConfig;
      const active = hasActiveSituation({ ...next, enabled: false });
      return { ...next, enabled: active };
    });
  };

  const clearSituation = () => {
    setSituation(createEmptySituation());
    setIsSituationExpanded(false);
  };

  const clearAll = useCallback(async (options: ClearAllOptions = {}) => {
    const { preserveHistory = false, preservePinned = false } = options;

    setMenuLocks({
      genre: false,
      style: false,
      sound: false,
      mood: false,
      theme: false,
      situation: false,
      vocal: false,
      structure: false,
    });

    if (!preservePinned) {
      setPinnedGenres([]);
      setPinnedThemes([]);
      setPinnedStyles([]);
      setPinnedInstrumentSounds([]);
    }

    setSelectedGenres([]);
    setSubGenre(preservePinned ? limitFusionGenreIds(pinnedGenresRef.current) : []);
    setSelectedMoods([]);
    setSelectedThemes(preservePinned ? pinnedThemesRef.current : []);
    setSelectedStyles(preservePinned ? pinnedStylesRef.current : []);
    recommendedSoundComboAppliedIdsRef.current = {};
    setSelectedInstrumentSounds(preservePinned ? pinnedInstrumentSoundsRef.current : []);
    setSelectedPointSounds([]);
    setIsPointSoundMode(false);
    setSelectedVocalToneId(undefined);
    setSituation(createEmptySituation());

    setKpopMode(0);
    setIsKoreanEnglishMix(false);
    setEnglishMixRatio(10);
    setCitypopMode(0);

    setIsGenreRandomized(false);
    setIsMoodRandomized(false);
    setIsThemeRandomized(false);
    setIsStyleRandomized(false);
    setIsSoundTextureRandomized(false);
        // 펼쳐보기 상태 초기화
    setIsGenreExpanded(false);
    setIsStyleExpanded(false);
    setIsSoundExpanded(false);
    setIsMoodExpanded(false);
    setIsThemeExpanded(false);
    setIsSituationExpanded(false);

    // 기본 열림 상태 유지 (앱 초기값 기준)
    setIsVocalExpanded(true);
    setIsSongStructureExpanded(true);

    // 적용된 키워드
    setIsAppliedKeywordsExpanded(false);

    setUserInput('');
    setLyricDraft('');
    setIsLyricMode(false);
    setLyricMode('assist');
    setLyricsLength('normal');
    setSongStructure('1');
    setVocalMode('solo');
    setMaleCount(0);
    setFemaleCount(0);
    setVocalMembers([]);
    setRapEnabled(false);
    setCustomStructure([]);

    setTempoEnabled(true);
    setMinBPM(90);
    setMaxBPM(110);

    if (!preserveHistory) {
      setResult(null);
      setHistoryIndex(-1);
      setHistory([]);

      if (userRef.current) {
        try {
          const ref = doc(db, "user_recent_songs", userRef.current.uid);
          await setDoc(ref, { songs: [] }, { merge: true });
        } catch (error) {
          console.error('Failed to clear history in Firestore:', error);
        }
      }
    } else {
      setResult(prev => {
        const currentHistory = historyRef.current;
        const currentIndex = historyIndexRef.current;
        if (currentHistory.length === 0) return null;
        if (currentIndex >= 0 && currentHistory[currentIndex]) return currentHistory[currentIndex];
        return currentHistory[0] ?? prev;
      });
    }
    // 상태 초기화들 다 끝난 뒤

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('전체 설정이 초기화되었습니다.');
  }, []); // Now truly stable

  const deleteHistoryItem = async (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    
    if (user) {
      try {
        const ref = doc(db, "user_recent_songs", user.uid);
        await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });
      } catch (e) {
        console.error("Failed to update history in Firestore:", e);
      }
    }

    setHistory(newHistory);
    
    if (newHistory.length === 0) {
      setResult(null);
      setHistoryIndex(-1);
    } else {
      const nextIndex = Math.min(index, newHistory.length - 1);
      setHistoryIndex(nextIndex);
      setResult(newHistory[nextIndex]);
    }
  };

  const clearHistory = async () => {
    if (window.confirm('모든 히스토리를 삭제하시겠습니까?')) {
      if (user) {
        try {
          const ref = doc(db, "user_recent_songs", user.uid);
          await setDoc(ref, { songs: [] }, { merge: true });
        } catch (e) {
          console.error("Failed to clear history in Firestore:", e);
        }
      }
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
    }
  };

  // Keep the in-progress Home draft when navigating away and back.
  // Only pending shared/playlist keywords intentionally replace the current draft.
  useEffect(() => {
    if (location.pathname !== '/studio') return;

    let isCancelled = false;

    const applyPendingKeywordsIfAny = async () => {
      const pending =
        sessionStorage.getItem('pendingAppliedKeywords') ||
        localStorage.getItem('pendingAppliedKeywordsBackup');

      if (!pending) return false;

      try {
        const keywords = JSON.parse(pending);

        // Mark Home as initialized before applying pending data.
        // Without this, opening a shared song from an external browser and navigating
        // to Home can hit the first-entry return path and show a blank/unapplied screen
        // until the user visits another page.
        hasInitializedHomeRef.current = true;

        await clearAll({ preserveHistory: true, preservePinned: true });
        if (isCancelled) return true;

        applyKeywordsToNext(keywords);
        sessionStorage.removeItem('pendingAppliedKeywords');
        localStorage.removeItem('pendingAppliedKeywordsBackup');
        window.scrollTo(0, 0);
        return true;
      } catch (e) {
        console.error('Failed to parse pending keywords', e);
        sessionStorage.removeItem('pendingAppliedKeywords');
        localStorage.removeItem('pendingAppliedKeywordsBackup');
        return false;
      }
    };

    const initializeHome = async () => {
      const appliedPending = await applyPendingKeywordsIfAny();
      if (isCancelled || appliedPending) return;

      if (!hasInitializedHomeRef.current) {
        hasInitializedHomeRef.current = true;
        window.scrollTo(0, 0);
        return;
      }

      // Do not clear selected keywords when returning from Library/Favorites.
      if (!isCancelled) window.scrollTo(0, 0);
    };

    initializeHome();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, location.search, applyKeywordsToNext, clearAll]);

  const unpinAll = (category: 'genre' | 'mood' | 'theme') => {
    if (category === 'genre') {
      setPinnedGenres([]);
      setIsGenreRandomized(false);
    }
    if (category === 'mood') {
      setIsMoodRandomized(false);
    }
    if (category === 'theme') {
      setPinnedThemes([]);
      setIsThemeRandomized(false);
    }
  };

  const applyRandom = () => {
    const getRandomForCategory = (all: CategoryItem[], pinned: string[], maxCount: number, isGenre: boolean = false) => {
      // Start with pinned, limited by maxCount
      let result = [...pinned].slice(0, maxCount);
      const remainingPool = all.filter(item => 
        !pinned.includes(item.id) && 
        (!isGenre || !TROT_GENRES.includes(item.id))
      );
      
      const currentCount = result.length;
      const needed = maxCount - currentCount;
      
      if (needed > 0) {
        // Pick a random number of items to add (at least 1 if current is 0)
        const minToPick = currentCount > 0 ? 0 : 1;
        const pickCount = Math.floor(Math.random() * (needed - minToPick + 1)) + minToPick;
        
        const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, pickCount);
        result = [...result, ...picked.map(p => p.id)];
      }
      
      return result;
    };

    // 1. Genre Selection: pick only one real leaf genre.
    // Locked menus keep their current values and are excluded from global random selection.
    const randomLeafGenreId = pickRandomLeafGenreId();
    let g: string[] = isMenuLocked('genre') ? selectedGenres : [];
    let sg: string[] = isMenuLocked('genre') ? subGenre : (randomLeafGenreId ? [randomLeafGenreId] : []);

    // 2. Other categories with their limits
    // Limits: Style 3, Sound 3, Mood 5, Theme 4
    let s = isMenuLocked('style') ? selectedStyles : getRandomForCategory(SOUND_STYLES.filter(isSelectableKeywordItem), pinnedStyles, 3);
    let snd = isMenuLocked('sound') ? selectedInstrumentSounds : getRandomForCategory(INSTRUMENT_SOUNDS.filter(isSelectableKeywordItem), pinnedInstrumentSounds, 3);
    let m = isMenuLocked('mood') ? selectedMoods : getRandomForCategory(MOODS, [], 5);
    let t = isMenuLocked('theme') ? selectedThemes : getRandomForCategory(THEMES, [], 4);

    // 3. Total Limit 15 Check and Priority Trimming
    // Priority: Genre > Style > Sound > Mood > Theme (Theme is first to be cut)
    while (g.length + s.length + snd.length + m.length + t.length > 15) {
      if (!isMenuLocked('theme') && t.length > 0) t.pop();
      else if (!isMenuLocked('mood') && m.length > 0) m.pop();
      else if (!isMenuLocked('sound') && snd.length > 0) snd.pop();
      else if (!isMenuLocked('style') && s.length > 0) s.pop();
      else break;
    }

    const expandedRandomSoundSelection = isMenuLocked('sound')
      ? selectedInstrumentSounds
      : expandRecommendedSoundComboSelection(snd, { syncRef: true });

    if (!isMenuLocked('genre')) {
      setSelectedGenres(g);
      setSubGenre(sg);
      setKpopMode(0);
      setCitypopMode(0);
      setIsGenreRandomized(true);
    }
    if (!isMenuLocked('mood')) {
      setSelectedMoods(m);
      setIsMoodRandomized(true);
    }
    if (!isMenuLocked('theme')) {
      setSelectedThemes(t);
      setIsThemeRandomized(true);
    }
    if (!isMenuLocked('style')) {
      setSelectedStyles(s);
      setIsStyleRandomized(true);
    }
    if (!isMenuLocked('sound')) {
      setSelectedInstrumentSounds(expandedRandomSoundSelection);
      setSelectedPointSounds([]);
      setIsPointSoundMode(false);
      setIsSoundTextureRandomized(true);
    }

    // These menus should not keep stale values during random selection unless explicitly locked.
    // Generation modal options are always reset on global random so old popup choices do not leak into the next song.
    setIsKoreanEnglishMix(false);
    setEnglishMixRatio(10);
    setRapEnabled(false);

    if (!isMenuLocked('situation')) {
      setSituation(createEmptySituation());
      setIsSituationExpanded(false);
    }
    if (!isMenuLocked('vocal')) {
      setVocalMode('solo');
      setMaleCount(0);
      setFemaleCount(0);
      setSelectedVocalToneId(undefined);
      setVocalMembers([]);
      setRapEnabled(false);
    }
    if (!isMenuLocked('structure')) {
      setLyricsLength('normal');
      setSongStructure('1');
      setCustomStructure([]);
    }

    // Random tempo logic
    if (tempoEnabled) {
      const tempoGenre = isMenuLocked('genre') ? selectedGenres : g;
      const tempoSubGenre = isMenuLocked('genre') ? subGenre : sg;
      const tempoMoods = isMenuLocked('mood') ? selectedMoods : m;
      const { min, max } = calculateOptimalBPM(tempoGenre, tempoMoods, tempoSubGenre);
      setMinBPM(min);
      setMaxBPM(max);
    }
  };
const saveRecentSong = async (newSong: any) => {
  if (!user) return;

  try {
    const ref = doc(db, "user_recent_songs", user.uid);
    const snap = await getDoc(ref);
    const firestoreSongs = snap.exists() ? normalizeRecentSongList(snap.data().songs || []) : [];
    const recoverySongs = findRecoverableLocalRecentSongs(user.uid);
    const updatedSongs = mergeRecentSongLists([newSong], firestoreSongs, recoverySongs);

    await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });
    recentSongsReadyToCacheRef.current = true;
    applyRecentSongsState(updatedSongs, {
      preferredIndex: 0,
      latestBatchId: (updatedSongs[0]?.appliedKeywords as any)?.generationBatchId || latestGenerationBatchId || null,
    });

  } catch (e) {
    console.error("Failed to save recent songs:", e);
  }
};

  /* 
  useEffect(() => {
    const q = query(collection(db, 'vocalTones'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VocalTone[];
      setVocalTones(tones.filter(t => t.isActive));
      
      // Set default tone if available
      const defaultTone = tones.find(t => t.isDefault && t.isActive);
      if (defaultTone && !selectedVocalToneId) {
        setSelectedVocalToneId(defaultTone.id);
      }
    }, (err) => {
      console.error("Error fetching vocal tones:", err);
    });

    return () => unsubscribe();
  }, []);
  */

  const handleGenerate = async (generationOptions?: {
    includeLyrics: boolean;
    lyricLanguages: LanguageCode[];
    generationCount?: number;
    isKoreanEnglishMix?: boolean;
    englishMixRatio?: number;
    rapEnabled?: boolean;
  }) => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      handleLogin();
      return;
    }

    if (userStatus !== 'active' && !isAdminUser) {
      if (userStatus === 'paused') {
        showToast('계정이 일시 제한되었습니다. 관리자에게 문의하세요.');
        return;
      }
      if (userStatus === 'expired') {
        showToast('이용 기간이 만료되었습니다. 플랜을 갱신해주세요.');
        return;
      }
      if (userStatus === 'banned') {
        showToast('접근이 차단된 계정입니다. 기능을 사용할 수 없습니다.');
        return;
      }
    }

    const personalGeminiApiKey = await resolveGoogleGeminiApiKey(user);
    if (!personalGeminiApiKey) {
      showToast('마이페이지에서 Google Gemini API Key를 먼저 등록해주세요.');
      navigate('/my-page');
      return;
    }

    const hasFreeTextDirectorNote = userInput.trim().length > 0;
    const isInstrumentalBgmRequest = isPureInstrumentalBgmGenreSelection(limitFusionGenreIds([...selectedGenres, ...subGenre]));
    const requestedIncludeLyrics = isInstrumentalBgmRequest ? false : (generationOptions?.includeLyrics ?? true);
    const requestedLyricLanguages = requestedIncludeLyrics
      ? Array.from(new Set((generationOptions?.lyricLanguages?.length ? generationOptions.lyricLanguages : ['ko']).filter(Boolean))).slice(0, 2) as LanguageCode[]
      : [];
    const requestedGenerationCount = Math.min(5, Math.max(1, Math.floor(Number(generationOptions?.generationCount) || 1)));
    const requestedKoreanEnglishMix = requestedIncludeLyrics
      ? Boolean(generationOptions?.isKoreanEnglishMix ?? isKoreanEnglishMix)
      : false;
    const requestedEnglishMixRatio = Math.max(5, Math.min(90, Number(generationOptions?.englishMixRatio ?? englishMixRatio) || 10));
    const requestedRapEnabled = requestedIncludeLyrics
      ? Boolean(generationOptions?.rapEnabled ?? rapEnabled)
      : rapEnabled;

    const hasAnySelectedGenre = selectedGenres.length > 0 || subGenre.length > 0;

    if (!hasAnySelectedGenre && !hasFreeTextDirectorNote) {
      showToast('장르를 선택하거나 명령창에 곡 방향을 입력해주세요.');
      return;
    }

    if (isGenerating) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setResult(prev => (prev ? { ...prev, title: '생성 중...' } : null));
    abortControllerRef.current = new AbortController();

    try {
      // Activity indicator
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { lastSeenAt: Date.now(), isOnline: true }).catch(() => {});
      }
      let finalGenres = limitFusionGenreIds([...selectedGenres, ...subGenre]);
      const isFinalInstrumentalBgm = isPureInstrumentalBgmGenreSelection(finalGenres);
      if (!isFinalInstrumentalBgm && hasInstrumentalBgmGenreIds(finalGenres)) {
        finalGenres = finalGenres.filter((id) => !isInstrumentalBgmGenreId(id));
      }
      let finalMoods = [...selectedMoods];
      let finalThemes = [...selectedThemes];
      let finalStyles = isFinalInstrumentalBgm ? [] : filterSelectableIds([...selectedStyles]);
      let finalInstrumentSounds = isFinalInstrumentalBgm
        ? []
        : filterSelectableIds(
            expandRecommendedSoundComboSelection([...selectedInstrumentSounds], { syncRef: false })
          );
      let randomKeywords: string[] = [];

      const hasGenre = finalGenres.length > 0 || subGenre.length > 0;
      const hasMood = finalMoods.length > 0;
      const hasTheme = finalThemes.length > 0;
      const hasStyle = finalStyles.length > 0;
      const finalPointSounds = filterSelectableIds([...selectedPointSounds]);
      const hasSound = finalInstrumentSounds.length > 0 || finalPointSounds.length > 0;
      const hasFreeTextDirectorNote = userInput.trim().length > 0;

      const selectedCount = [hasGenre, hasMood, hasTheme, hasStyle, hasSound].filter(Boolean).length;

      // If nothing selected and no free-text direction exists, pick random (5-15 total).
      // When the command box has text, let that text drive the whole prompt instead of injecting random keywords.
      if (selectedCount === 0 && !hasFreeTextDirectorNote) {
        const allItems = [
          ...GENRES.filter(i => !TROT_GENRES.includes(i.id) && !isInstrumentalBgmGenreId(i.id)).map(i => ({ ...i, cat: 'genre' as const })),
          ...MOODS.map(i => ({ ...i, cat: 'mood' as const })),
          ...THEMES.map(i => ({ ...i, cat: 'theme' as const })),
          ...SOUND_STYLES.filter(isSelectableKeywordItem).map(i => ({ ...i, cat: 'style' as const })),
          ...INSTRUMENT_SOUNDS.filter(isSelectableKeywordItem).map(i => ({ ...i, cat: 'sound' as const })),
        ];

        const count = Math.floor(Math.random() * 11) + 5; // 5-15
        const picked = allItems.sort(() => 0.5 - Math.random()).slice(0, count);

        picked.forEach(p => {
          if (p.cat === 'genre') finalGenres.push(p.id);
          if (p.cat === 'mood') finalMoods.push(p.id);
          if (p.cat === 'theme') finalThemes.push(p.id);
          if (p.cat === 'style') finalStyles.push(p.id);
          if (p.cat === 'sound') finalInstrumentSounds.push(p.id);
          randomKeywords.push(p.label);
        });
        finalGenres = limitFusionGenreIds(finalGenres);
        finalInstrumentSounds = filterSelectableIds(
          expandRecommendedSoundComboSelection(finalInstrumentSounds, { syncRef: false })
        );
      }

      let currentMinBPM = minBPM;
      let currentMaxBPM = maxBPM;

      const isManualTempoMode = !tempoEnabled;
      const isValidTempoRange =
        currentMaxBPM >= currentMinBPM &&
        currentMaxBPM - currentMinBPM <= TEMPO_MAX_ACTIVE_RANGE &&
        (currentMinBPM !== TEMPO_MIN_BPM || currentMaxBPM !== TEMPO_MAX_BPM);

      // Tempo priority rule:
      // - Random tempo mode sends the current genre/mood-based BPM range to the prompt.
      // - Manual tempo mode sends the exact/range value selected by the user.
      // - If the range is invalid, tempo is not injected to avoid noisy prompts.
      const shouldUseRandomTempo = tempoEnabled && isValidTempoRange;
      const shouldUseManualTempo = isManualTempoMode && isValidTempoRange;

      if (shouldUseRandomTempo) {
        const { min, max } = calculateOptimalBPM(finalGenres, finalMoods, subGenre);
        currentMinBPM = min;
        currentMaxBPM = max;
        setMinBPM(min);
        setMaxBPM(max);
      }

      const shouldSendTempo = shouldUseRandomTempo || shouldUseManualTempo;

      const tempoInfo =
        shouldSendTempo
          ? currentMinBPM === currentMaxBPM
            ? `Exactly ${currentMinBPM} BPM`
            : `Between ${currentMinBPM} and ${currentMaxBPM} BPM`
          : undefined;

      const tempoSource: 'random' | 'manual' | undefined = shouldUseRandomTempo
        ? 'random'
        : shouldUseManualTempo
          ? 'manual'
          : undefined;

      // Trot specific prompt logic
      let specialPrompt = "";
      if (finalGenres.includes('traditional-trot')) {
        specialPrompt =
          "Heartbreaking / Sorrowful, Deep Vibrato, Crying Vocal style, Accordion-led, Nostalgic / Yearning.";
      } else if (finalGenres.includes('semi-trot')) {
        specialPrompt =
          "Infectious Rhythm, Upbeat & Cheerful, Driving 2-beat / 4-beat, Bright Brass section, Festive / Celebratory.";
      }

      const effectiveStyleIds = Array.from(new Set(finalStyles ?? []));
      const styleLabels = getCycleVariantLabel(STYLE_CYCLES, effectiveStyleIds);
      const themeLabels = finalThemes.map(getThemeKeywordLabel);
      const customMoodInput = finalMoods.map((id) => getCustomKeywordText(id, CUSTOM_MOOD_PREFIX)).find(Boolean) || undefined;
      const customThemeInput = finalThemes.map((id) => getCustomKeywordText(id, CUSTOM_THEME_PREFIX)).find(Boolean) || undefined;
      const soundTextureLabels = getCycleVariantLabel(SOUND_TEXTURE_CYCLES, finalInstrumentSounds);
      const hasBalladStyle = effectiveStyleIds.some((id) => ['ballad', 'classic-ballad'].includes(id));

      const genreLabels = finalGenres.flatMap(id => {
        if (id === 'citypop') {
          if (citypopMode === 1) return ["City Pop", "80s Japanese Pop", "Funk", "Groovy", "Retro"];
          if (citypopMode === 2) return ["Modern City Pop", "Nu-Disco", "Synth-pop", "Smooth"];
        }
        return [GENRES.find(g => g.id === id)?.label || id];
      });

      const getRecommendedVocalTone = (m: number, f: number, genres: string[], subGenres: string[]) => {
        if (vocalTones.length === 0) return null;
        
        // 1. Determine gender target
        let genderTarget: 'male' | 'female' | 'group' = 'male';
        if (m > 0 && f > 0) {
          genderTarget = 'group';
        } else if (f > 0) {
          genderTarget = 'female';
        } else if (m > 0) {
          genderTarget = 'male';
        } else {
          // Default if nothing selected
          genderTarget = 'male';
        }

        // 2. Filter candidates by gender
        let candidates = vocalTones.filter(t => {
          if (genderTarget === 'group') {
            return t.genderTarget === 'group' || t.genderTarget === 'unisex' || t.genderTarget === 'any';
          } else if (genderTarget === 'male') {
            return t.genderTarget === 'male' || t.genderTarget === 'any';
          } else {
            return t.genderTarget === 'female' || t.genderTarget === 'any';
          }
        });

        // 3. Try matching genre (SubGenre first, then MainGenre)
        const searchGenres = [...(subGenres || []), ...(genres || [])];
        for (const gId of searchGenres) {
          const match = candidates.find(t => t.genreTags && t.genreTags.includes(gId));
          if (match) return match;
        }

        // 4. Fallback (Strictly defined default values)
        if (genderTarget === 'group') {
          return vocalTones.find(t => t.id === 'balanced_group') || candidates[0] || vocalTones[0];
        } else if (genderTarget === 'female') {
          return vocalTones.find(t => t.id === 'female_airy') || candidates[0] || vocalTones[0];
        } else {
          return vocalTones.find(t => t.id === 'male_husky') || candidates[0] || vocalTones[0];
        }
      };

      const recommendedTone = getRecommendedVocalTone(maleCount, femaleCount, finalGenres, subGenre);

      const formation = maleCount > 0 && femaleCount > 0
        ? 'Mixed group vocal'
        : maleCount > 1
          ? 'Male group vocal'
          : maleCount === 1
            ? 'Solo male vocal'
            : femaleCount > 1
              ? 'Female group vocal'
              : femaleCount === 1
                ? 'Solo female vocal'
                : '';

      const buildSongPrompt = () => {
        const subGenreLabels = subGenre.map((id) => {
          const matched = GENRE_HIERARCHY
            .flatMap((group) => group.children)
            .flatMap((main) => main.children)
            .find((item) => item.id === id);
          return matched?.label || id;
        });

        const genreStr = [...genreLabels, ...subGenreLabels].length > 0
          ? [...genreLabels, ...subGenreLabels].join(', ')
          : hasFreeTextDirectorNote
            ? 'Free-text director note defines the main genre and style'
            : 'Pop';
        const moodStr = finalMoods.length > 0
          ? finalMoods.map(getMoodKeywordLabel).join(', ')
          : hasFreeTextDirectorNote
            ? 'Mood should follow the free-text director note'
            : 'Emotional';
        const themeStr = buildThemeSentence(themeLabels);

        if (isFinalInstrumentalBgm) {
          const bgmIds = limitFusionGenreIds(finalGenres).filter(isInstrumentalBgmGenreId);
          const bgmLabels = bgmIds.map((id) => {
            const matched = GENRE_HIERARCHY
              .flatMap((group) => group.children)
              .flatMap((main) => main.children)
              .find((item) => item.id === id);
            return matched?.label || id;
          }).filter(Boolean).slice(0, 2);
          const mainBgmLabel = bgmLabels[0] || 'Instrumental BGM';
          const secondaryBgmLabel = bgmLabels[1] && bgmLabels[1] !== mainBgmLabel ? bgmLabels[1] : '';
          const bgmText = `${mainBgmLabel} ${secondaryBgmLabel} ${bgmIds.join(' ')}`.toLowerCase();
          const moodThemeText = [moodStr, themeStr, userInput.trim()].filter(Boolean).join(', ');
          const isRhythmBgm = /lo[-\s]?fi|lofi|study|스터디|cafe|카페/.test(bgmText);
          const isNatureBgm = /nature|자연|ambient|앰비언트/.test(bgmText);
          const isMinimalBgm = /minimal|미니멀/.test(bgmText);
          const isStringBgm = /string|스트링/.test(bgmText);
          const isPianoBgm = /piano|피아노|healing|힐링/.test(bgmText);
          const fusionNote = secondaryBgmLabel ? ` with secondary ${secondaryBgmLabel} color` : '';
          const instruments = isRhythmBgm
            ? 'soft keys or Rhodes, warm room tone, vinyl/tape texture, very sparse muted or brushed rhythm allowed only as background'
            : isNatureBgm
              ? 'natural field ambience, soft environmental pad, airy space texture, no drums'
              : isStringBgm
                ? 'soft string ensemble, warm sustained cello/violin texture, gentle hall reverb, no drums'
                : isPianoBgm
                  ? 'intimate piano or felt piano, soft room resonance, gentle reverb, no drums'
                  : isMinimalBgm
                    ? 'minimal repeating motif, soft tonal pulse, quiet room texture'
                    : 'minimal instrumental texture, soft pad, quiet room tone';
          const atmosphere = moodThemeText
            ? `${moodThemeText} interpreted as instrumental background atmosphere, space, temperature, listening environment, and emotional color`
            : 'selected BGM genre defines the space, temperature, listening environment, and background air';
          const arrangement = isRhythmBgm
            ? 'loopable low-distraction background groove, restrained dynamics, no sung hook, no lyrics'
            : isNatureBgm
              ? 'slow ambient drift, long texture breathing, beatless environmental flow, no lyrics'
              : isMinimalBgm
                ? 'repeating motif, subtle micro-variation, restrained loopable background structure, no lyrics'
                : 'slow instrumental flow, gentle rise and fall, soft transitions, no lyrics';

          return `·MODE: dedicated instrumental BGM route
·GENRE: ${mainBgmLabel}${fusionNote}
·INSTRUMENTS: ${instruments}
·ATMOSPHERE: ${atmosphere}
·VOCALS: instrumental only, no vocals, no humming
·ARRANGEMENT: ${arrangement}`.trim();
        }

        const selectedStyleText = styleLabels.length > 0 ? styleLabels.join(', ') : 'Core style kept close to the root genre';
        const selectedSoundText = soundTextureLabels.length > 0 ? soundTextureLabels.join(', ') : 'Balanced mainstream arrangement with tasteful detail';
        const selectedStyleIds = new Set(effectiveStyleIds);
        const selectedSoundFamilies = new Set(finalInstrumentSounds.map((id) => SOUND_TEXTURE_CYCLE_LOOKUP[id]?.id).filter(Boolean));
        const hasStyleId = (...ids: string[]) => ids.some((id) => selectedStyleIds.has(id));
        const hasSoundFamily = (...ids: string[]) => ids.some((id) => selectedSoundFamilies.has(id));
        const structureSignalText = [
          ...finalGenres,
          ...subGenre,
          ...effectiveStyleIds,
          ...genreLabels,
          ...subGenreLabels,
          ...styleLabels,
          ...themeLabels,
          ...soundTextureLabels,
        ].join(' ').toLowerCase();
        const hasStructureSignal = (...terms: string[]) => terms.some((term) => structureSignalText.includes(term.toLowerCase()));
        const buildAdaptiveDefaultStructureGuide = () => {
          const hasRapFlow = requestedRapEnabled || hasStructureSignal('rap', 'hip-hop', 'hiphop', 'drill', 'trap', 'boom bap', 'boombap', 'uk garage', 'garage r&b');
          const hasDanceFlow = hasStructureSignal('edm', 'house', 'techno', 'disco', 'dance', 'club', 'garage', 'breakbeat', 'future bass', 'electro', 'funk') || hasStyleId('dance', 'modern-edm', 'electronic', 'techno-style', 'house-style', 'classic-disco', 'funk');
          const hasBandFlow = hasStructureSignal('rock', 'band', 'emo', 'punk', 'metal', 'j-rock', 'k-band', 'anime rock', 'anisong') || hasStyleId('rock-style', 'anime-style');
          const hasCinematicFlow = hasStructureSignal('cinematic', 'score', 'opera', 'musical', 'orchestra', 'theme a', 'theme b', 'climax', 'ambient');
          const hasBreathingFlow = hasBalladStyle || hasStructureSignal('ballad', 'jazz', 'r&b', 'rnb', 'dream pop', 'dreampop', 'city pop', 'citypop', 'lo-fi', 'lofi', 'folk', 'acoustic', 'soul') || finalMoods.some((id) => ['calm', 'peaceful', 'sad', 'lonely', 'nostalgic', 'dreamy', 'warm'].includes(id));

          if (hasRapFlow) {
            return 'Default adaptive structure: choose a polished rap/hook variation such as Intro → Rap Section → Hook → Rap Section → Break → Hook → Bridge → Final Hook → Outro; keep the Hook memorable, let Rap Sections carry denser detail, and close with a clear final payoff.';
          }
          if (hasDanceFlow) {
            return 'Default adaptive structure: choose a polished hook/drop variation such as Intro → Hook → Verse A → Pre-Chorus → Chorus / Drop → Break → Verse B → Chorus / Drop → Bridge → Final Chorus / Drop → Outro; keep the flow popular and stable while using Break or Drop as a refined twist.';
          }
          if (hasBandFlow) {
            return 'Default adaptive structure: choose a polished band-build variation such as Intro → Verse A → Build-up → Chorus → Verse B → Chorus → Bridge → Final Chorus → Outro; keep the chorus singable, let the build-up raise pressure, and use the Bridge as the emotional turn.';
          }
          if (hasCinematicFlow) {
            return 'Default adaptive structure: choose a cinematic variation such as Intro → Theme A → Verse A → Theme B → Chorus → Instrumental → Bridge → Climax → Outro; keep it experimental but still finish with a clear climax and outro.';
          }
          if (hasBreathingFlow) {
            return 'Default adaptive structure: choose a spacious emotional variation such as Intro → Verse A → Pre-Chorus → Chorus → Instrumental → Verse B → Bridge → Final Chorus → Outro; leave room for breath, image, and melodic payoff.';
          }
          return 'Default adaptive structure: choose one stable modern-pop variation with a small twist, using Hook, Break, Drop, Instrumental, or Bridge only where it supports the story; never end after Stop, Break, or Instrumental.';
        };

        const bpm = tempoInfo
          ? tempoInfo
              .replace('Between ', '')
              .replace('Exactly ', '')
              .replace(' and ', '–')
          : hasFreeTextDirectorNote
            ? ''
            : (finalMoods.includes('bright') || finalMoods.includes('hopeful') || finalMoods.includes('tense') || hasStyleId('dance', 'modern-edm', 'electronic', 'techno-style', 'house-style'))
              ? '118–132 BPM'
              : (hasBalladStyle || finalMoods.includes('calm') || finalMoods.includes('peaceful') || finalMoods.includes('sad') || finalMoods.includes('lonely'))
                ? '72–96 BPM'
                : '90–112 BPM';

        const drums = [
          hasSoundFamily('drums-family') ? `Primary drum character shaped by ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'drums-family'), finalInstrumentSounds).join(', ') || 'Drums'}` : null,
          hasSoundFamily('snare-family') ? `Snare detail using ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'snare-family'), finalInstrumentSounds).join(', ')}` : null,
          hasSoundFamily('hihats-family') ? `Hi-hat motion using ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'hihats-family'), finalInstrumentSounds).join(', ')}` : null,
          !hasSoundFamily('drums-family', 'snare-family', 'hihats-family') && hasBalladStyle ? 'Soft live-pop drums with restrained movement and emotional pacing' : null,
          !hasSoundFamily('drums-family', 'snare-family', 'hihats-family') && !hasBalladStyle ? 'Clean modern drums supporting the topline without overcrowding the mix' : null,
        ].filter(Boolean).join(', ');

        const bass = [
          hasSoundFamily('bass-family')
            ? `Bass focus built around ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'bass-family'), finalInstrumentSounds).join(', ')}`
            : (hasBalladStyle ? 'Warm supportive low end following the emotional chord movement' : 'Warm melodic bass supporting the harmony'),
          hasStyleId('g-funk', 'funk', 'p-funk') ? 'keep the groove elastic and rhythm-led' : null,
          hasStyleId('trap-style', 'hip-hop', 'boom-bap-style') ? 'let the low end lock firmly with the beat' : null,
        ].filter(Boolean).join(', ');

        const sound = [
          selectedSoundText,
          hasStyleId('anime-style', 'game-bgm-style') ? 'with melodic lift and scene-like transitions' : null,
          hasStyleId('classic-disco', 'modern-edm', 'electronic', 'house-style') ? 'while keeping a polished commercial finish' : null,
        ].filter(Boolean).join(', ');

        const texture = [
          hasSoundFamily('texture-family') ? getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'texture-family'), finalInstrumentSounds).join(', ') : null,
          hasSoundFamily('ambience-family') ? getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'ambience-family'), finalInstrumentSounds).join(', ') : null,
          !hasSoundFamily('texture-family', 'ambience-family') && hasBalladStyle ? 'Emotion-first, gently rising, and spacious' : null,
          !hasSoundFamily('texture-family', 'ambience-family') && !hasBalladStyle ? 'Balanced, clear, and commercially polished' : null,
        ].filter(Boolean).join(', ');

        // --- Vocal Restoration Logic ---
        const genreVocalParts = subGenre.map((id) => {
          const matched = GENRE_HIERARCHY
            .flatMap((group) => group.children)
            .flatMap((main) => main.children)
            .find((item) => item.id === id);
          return matched?.vocal;
        }).filter(Boolean) as string[];

        const pickOneGenreVocal = (parts: string[]) => {
          if (parts.length === 0) return null;
          const allDescriptors = parts.flatMap(p => p.split(',').map(s => s.trim()));
          const harmonies = allDescriptors.find(d => d.toLowerCase().includes('harmonies'));
          if (harmonies) return harmonies;
          const hooks = allDescriptors.find(d => d.toLowerCase().includes('hooks'));
          if (hooks) return hooks;
          return allDescriptors[0];
        };
        const auxiliaryVocal = pickOneGenreVocal(genreVocalParts);

        const recTone = recommendedTone?.label;
        const primaryTone = recTone;

        const vocalDesignParts = [];
        if (formation) vocalDesignParts.push(formation);
        if (primaryTone) vocalDesignParts.push(primaryTone);
        if (auxiliaryVocal) vocalDesignParts.push(auxiliaryVocal);
        
        const vocalDesign = vocalDesignParts.length > 0 ? vocalDesignParts.join(', ') : 'Main lead vocal with harmony support where needed';

        const vocalStyle = [
          hasBalladStyle ? 'Tender and emotionally clear' : null,
          hasStyleId('anime-style', 'k-style') ? 'slightly dramatic with melodic lift' : null,
          finalMoods.includes('bright') ? 'youthful and open' : null,
          finalMoods.includes('warm') || finalMoods.includes('peaceful') ? 'gentle and reassuring' : null,
          finalMoods.includes('tense') ? 'focused and dynamically assertive' : null,
          !hasBalladStyle && !finalMoods.includes('bright') && !finalMoods.includes('warm') && !finalMoods.includes('tense') ? 'clear, expressive, and melody-led' : null,
        ].filter(Boolean).slice(0, 1).join(', '); // Limit to one additional styling

        const arrangement = [
          songStructure === 'custom'
            ? `Custom structure: ${formatStoredCustomStructureText(customStructure)}`
            : songStructure === '1'
              ? buildAdaptiveDefaultStructureGuide()
              : `Base structure: ${songStructure === '2' ? 'Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro' : 'Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro'}`,
          hasBalladStyle ? 'allow a slower emotional rise through the pre-chorus and chorus' : 'keep the sectional contrast clear and memorable',
          selectedStyleText !== 'Core style kept close to the root genre' ? `style direction anchored by ${selectedStyleText}` : null,
        ].filter(Boolean).join(', ');

        const genreLine = [genreStr, selectedStyleText, bpm].filter(Boolean).join(', ');

        return `·GENRE: ${genreLine}
·DRUMS: ${drums}
·BASS: ${bass}
·SOUND: ${sound}
·TEXTURE: ${texture}
·VOCAL: ${vocalDesign}
·VOCAL STYLE: ${vocalStyle}
·ARRANGEMENT: ${arrangement}
·MOOD: ${moodStr}
·THEME: ${themeStr || (hasFreeTextDirectorNote ? 'Theme should follow the free-text director note.' : 'No explicit story theme selected.')}`.trim();
      };

      const songPrompt = buildSongPrompt();

      const payload = {
        genre: finalGenres[0] ?? selectedGenres[0] ?? subGenre[0] ?? null,
        subGenre: finalGenres,
        isKpopSelected: ([...selectedGenres, ...subGenre] ?? []).includes('kpop'),
        moods: finalMoods.map(getMoodKeywordLabel),
        themes: themeLabels,
        ...(hasActiveSituation(situation) ? { situation } : {}),
        styles: finalStyles,
        instrumentSounds: finalInstrumentSounds,
        pointSounds: finalPointSounds,
        customMoodInput,
        customThemeInput,
        userInput,
        songPrompt,
        lyricsLength,
        songStructure,
        useAutoDuration: false,
        vocal: {
          male: maleCount,
          female: femaleCount,
          rap: requestedRapEnabled,
          mode: vocalMode,
          members: vocalMembers,
        },
        tempo: tempoInfo,
        isRandomTempo: tempoSource === 'random',
        tempoSource,
        specialPrompt,
        kpopMode,
        isKoreanEnglishMix: requestedKoreanEnglishMix,
        englishMixRatio: requestedEnglishMixRatio,
        customStructure,
        isNoLyrics: isFinalInstrumentalBgm ? true : !requestedIncludeLyrics,
        includeLyrics: isFinalInstrumentalBgm ? false : requestedIncludeLyrics,
        instrumentalBgmMode: isFinalInstrumentalBgm,
        lyricLanguages: isFinalInstrumentalBgm ? [] : requestedLyricLanguages,
        lyricDraft: isLyricMode ? lyricDraft : undefined,
        isLyricMode,
        lyricMode: isLyricMode ? lyricMode : undefined,
        geminiApiKey: personalGeminiApiKey,
      };

      console.log("SELECTED GENRE:", selectedGenres);
      console.log("SELECTED SUB GENRE:", subGenre);
      console.log("GENERATE PAYLOAD:", payload);

      const generatedResults: SongResult[] = [];
      const generationBatchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (let i = 0; i < requestedGenerationCount; i += 1) {
        if (abortControllerRef.current?.signal.aborted) return;

        const song = await generateSong({
          ...payload,
          generationIndex: i + 1,
          generationCount: requestedGenerationCount,
        } as any);

        if (abortControllerRef.current?.signal.aborted) return;

        const generatedAt = Date.now();
        const newResult = {
          ...song,
          genre: finalGenres[0] ?? undefined,
          subGenre: finalGenres,
          prompt: song.prompt,
          createdAt: generatedAt,
          updatedAt: generatedAt,
          appliedKeywords: {
            ...song.appliedKeywords,
            genre: [],
            subGenre: finalGenres,
            ...(hasActiveSituation(situation) ? { situation } : {}),
            situationSummary: buildSituationSummary(situation),
            vocal: payload.vocal,
            pointSounds: finalPointSounds,
            customMoodInput,
            customThemeInput,
            vocalType: formation || 'Default',
            rapEnabled: requestedRapEnabled,
            isNoLyrics: isFinalInstrumentalBgm ? true : !requestedIncludeLyrics,
            lyricLanguages: isFinalInstrumentalBgm ? [] : requestedLyricLanguages,
            generationCount: requestedGenerationCount,
            generationIndex: i + 1,
            generationBatchId,
            isKoreanEnglishMix: requestedKoreanEnglishMix,
            englishMixRatio: requestedEnglishMixRatio,
            kpopMode,
            isBallad: hasBalladStyle,
            userInput: userInput,
            lyricDraft: isLyricMode ? lyricDraft : undefined,
            isLyricMode,
            lyricMode: isLyricMode ? lyricMode : undefined,
            tempoConfig: {
              enabled: tempoEnabled,
              min: minBPM,
              max: maxBPM
            }
          },
          randomKeywords
        } as SongResult & { createdAt: number; updatedAt: number };

        generatedResults.push(newResult);
      }

      const [firstResult] = generatedResults;
      if (!firstResult) return;

      const usedModelLabel = getGeminiUsedModelLabel(firstResult);
      if (usedModelLabel) {
        setGenerationModelNotice(`생성 모델 ${usedModelLabel}`);
      }

      setResult(firstResult);
      setLatestGenerationBatchId(generationBatchId);
      setHistory(prev => [...generatedResults, ...prev].slice(0, 10));
      for (const item of generatedResults) {
        await saveRecentSong(item);
      }

      // Increment songGeneratedCount in users document
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          songGeneratedCount: increment(generatedResults.length)
        }).catch(err => console.error("Failed to increment songGeneratedCount:", err));
      }

      setHistoryIndex(0);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation cancelled');
      } else {
        console.error(error);
        const errorMessage = error.message || '곡 생성 중 오류가 발생했습니다.';
        if (errorMessage.includes('VITE_GEMINI_API_KEY')) {
          showToast('API 키가 설정되지 않았습니다. 설정을 확인해주세요.');
        } else if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
          showToast('무료 생성 한도를 초과했습니다. 나중에 다시 시도해주세요.');
        } else {
          showToast(errorMessage);
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const navigateHistory = (direction: 'prev' | 'next') => {
    setIsConfirmingDeleteHistory(false);
    if (direction === 'prev' && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setResult(history[newIndex]);
    } else if (direction === 'next' && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setResult(history[newIndex]);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const keywords = [
      `[Genres] ${result.appliedKeywords.genre.join(', ')}`,
      `[Moods] ${result.appliedKeywords.mood.join(', ')}`,
      (result.appliedKeywords as any).situationSummary ? `[Situation] ${(result.appliedKeywords as any).situationSummary}` : '',
      result.appliedKeywords.theme?.length ? `[Themes] ${result.appliedKeywords.theme.join(', ')}` : '',
      result.appliedKeywords.style?.length ? `[Styles] ${result.appliedKeywords.style.join(', ')}` : '',
      result.appliedKeywords.instrumentSound?.length ? `[Sound / Texture] ${result.appliedKeywords.instrumentSound.map(getSoundVariantLabelById).join(', ')}` : '',
      result.appliedKeywords.vocalType ? `[Vocal] ${result.appliedKeywords.vocalType}${result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone ? ` (${result.appliedKeywords.vocalTone})` : ''}` : '',
      result.appliedKeywords.tempo ? `[Tempo] ${result.appliedKeywords.tempo}` : ''
    ].filter(Boolean).join('\n');

    const songTitleCopy = formatUnifiedTitle(result);

    const text = `
${keywords}

${songTitleCopy}

[Lyrics - English]
${normalizeLyricsForDisplay(result.lyrics.english)}

[Lyrics - Korean]
${normalizeLyricsForDisplay(result.lyrics.korean)}

[Music Prompt]
${normalizePromptForDisplay(result.prompt)}
    `.trim();
    copyToClipboard(text, 'all');
  };


  const lyricLanguageLabels: Record<LanguageCode, { ko: string; en: string; api: string }> = {
    ko: { ko: '한글', en: 'Korean', api: 'korean' },
    en: { ko: '영어', en: 'English', api: 'english' },
    ja: { ko: '일본어', en: 'Japanese', api: 'japanese' },
    zh: { ko: '중국어', en: 'Chinese', api: 'chinese' },
    es: { ko: '스페인어', en: 'Spanish', api: 'spanish' },
    fr: { ko: '프랑스어', en: 'French', api: 'french' },
  };

  const getLyricsLanguageMap = (song: SongResult | null = result): Partial<Record<LanguageCode, string>> => {
    if (!song) return {};
    const applied = (song.appliedKeywords || {}) as any;
    const storedMap = (applied.lyricsByLanguage || {}) as Partial<Record<LanguageCode, string>>;
    const storedLanguages = ((applied.lyricLanguages || []) as LanguageCode[]).filter(Boolean);
    const secondaryLanguage = (applied.secondaryLanguage || storedLanguages.find((lang) => lang !== 'ko') || 'en') as LanguageCode;
    const map: Partial<Record<LanguageCode, string>> = { ...storedMap };

    if (song.lyrics?.korean?.trim()) map.ko = song.lyrics.korean;
    if (song.lyrics?.english?.trim()) {
      const mappedForeign = storedLanguages.find((lang) => lang !== 'ko' && (storedMap as any)[lang] === song.lyrics.english) || secondaryLanguage || 'en';
      map[mappedForeign as LanguageCode] = map[mappedForeign as LanguageCode] || song.lyrics.english;
    }

    return map;
  };

  const getTitleLanguageMap = (song: SongResult | null = result): Partial<Record<LanguageCode, string>> => {
    if (!song) return {};
    const applied = (song.appliedKeywords || {}) as any;
    const storedMap = (applied.titlesByLanguage || {}) as Partial<Record<LanguageCode, string>>;
    const storedLanguages = ((applied.titleLanguages || applied.lyricLanguages || []) as LanguageCode[]).filter(Boolean);
    const secondaryLanguage = (applied.secondaryLanguage || storedLanguages.find((lang) => lang !== 'ko') || 'en') as LanguageCode;
    const map: Partial<Record<LanguageCode, string>> = { ...storedMap };

    if (song.koreanTitle?.trim()) map.ko = song.koreanTitle;
    if (song.englishTitle?.trim()) {
      const mappedForeign = storedLanguages.find((lang) => lang !== 'ko' && (storedMap as any)[lang] === song.englishTitle) || secondaryLanguage || 'en';
      map[mappedForeign as LanguageCode] = map[mappedForeign as LanguageCode] || song.englishTitle;
    }

    return map;
  };

  const getLyricsByLanguage = (song: SongResult | null, lang: LanguageCode): string => {
    return (getLyricsLanguageMap(song)[lang] || '').trim();
  };

  const getTitleByLanguage = (song: SongResult | null, lang: LanguageCode): string => {
    return (getTitleLanguageMap(song)[lang] || '').trim();
  };

  const stripDisplayTitlePart = (value: string): string => {
    return String(value || '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim();
  };

  const formatUnifiedTitle = (song: SongResult | null = result): string => {
    if (!song) return "[Song] 'Untitled'";
    const genre = getResolvedGenre(song) || getSubGenre(song) || 'Song';
    const titleMap = getTitleLanguageMap(song);
    const koTitle = stripDisplayTitlePart(titleMap.ko || song.koreanTitle || '');
    const foreignTitle = stripDisplayTitlePart(
      Object.entries(titleMap).find(([lang, value]) => lang !== 'ko' && String(value).trim())?.[1] ||
      song.englishTitle ||
      ''
    );

    if (koTitle && foreignTitle && koTitle !== foreignTitle) {
      return `[${genre}] '${koTitle}' | '${foreignTitle}'`;
    }

    const fallback = stripDisplayTitlePart(koTitle || foreignTitle || song.title || 'Untitled');
    if (fallback.includes('|') || fallback.includes('│')) {
      const parts = fallback.split(/[|│]/).map(stripDisplayTitlePart).filter(Boolean);
      if (parts.length >= 2) return `[${genre}] '${parts[0]}' | '${parts[1]}'`;
      if (parts.length === 1) return `[${genre}] '${parts[0]}'`;
    }
    return `[${genre}] '${fallback || 'Untitled'}'`;
  };

  const getGeneratedLyricLanguages = (song: SongResult | null = result): LanguageCode[] => {
    const map = getLyricsLanguageMap(song);
    const stored = ((((song?.appliedKeywords as any)?.lyricLanguages || []) as LanguageCode[]).filter(Boolean));
    const languageOrder: LanguageCode[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr'];
    const ordered = [
      ...stored,
      ...languageOrder,
    ].filter((lang, index, arr) => arr.indexOf(lang) === index) as LanguageCode[];

    return ordered.filter((lang) => Boolean(map[lang]?.trim())).slice(0, 2);
  };

  const getDisplayLyricLanguages = (song: SongResult | null = result): LanguageCode[] => {
    const generated = getGeneratedLyricLanguages(song);
    if (generated.includes('ko')) {
      const foreign = generated.find((lang) => lang !== 'ko');
      return foreign ? ['ko', foreign] : ['ko'];
    }
    return generated.slice(0, 2);
  };

  const getSecondaryLyricLanguageLabel = (song: SongResult | null = result) => {
    const display = getDisplayLyricLanguages(song);
    const secondary = display.find((lang) => lang !== 'ko') || display[0] || 'en';
    return lyricLanguageLabels[secondary as LanguageCode]?.ko || '영어';
  };

  const getMissingLyricLanguages = (song: SongResult | null = result): LanguageCode[] => {
    const generated = getGeneratedLyricLanguages(song);
    if (!song || generated.length >= 2) return [];

    const languageOrder: LanguageCode[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr'];
    return languageOrder.filter((lang) => !generated.includes(lang));
  };


  const runWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const handleAddLyricsLanguage = async (targetLanguage: LanguageCode) => {
    if (!result || isAddingLyricsLanguage) return;

    const activeSong = result;
    const existingLanguages = getGeneratedLyricLanguages(activeSong);
    if (existingLanguages.includes(targetLanguage)) {
      showToast('이미 생성된 가사 언어입니다.');
      return;
    }
    if (existingLanguages.length >= 2) {
      showToast('가사 언어는 최대 2개까지 표시됩니다.');
      return;
    }

    const existingLyricsMap = getLyricsLanguageMap(activeSong);
    const existingTitleMap = getTitleLanguageMap(activeSong);
    const sourceLanguage = existingLanguages[0] || 'ko';
    const sourceLyrics = existingLyricsMap[sourceLanguage]?.trim() || activeSong.lyrics?.korean?.trim() || activeSong.lyrics?.english?.trim() || '';
    if (!sourceLyrics) {
      showToast('기준이 될 가사가 없습니다. 먼저 가사가 포함된 곡을 생성해주세요.');
      return;
    }

    const label = lyricLanguageLabels[targetLanguage];

    try {
      setIsAddingLyricsLanguage(true);
      setAddingLyricsLanguageTarget(targetLanguage);

      const personalGeminiApiKey = await resolveGoogleGeminiApiKey(user);
      if (!personalGeminiApiKey) {
        showToast('마이페이지에서 Google Gemini API Key를 먼저 등록해주세요.');
        navigate('/my-page');
        return;
      }

      const currentHistoryIndex = historyIndexRef.current;
      const sourceTitle = (existingTitleMap[sourceLanguage] || activeSong.koreanTitle || activeSong.englishTitle || activeSong.title || '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/^['"]|['"]$/g, '')
        .trim();

      const translatedBundle = await runWithTimeout(
        translateTitleAndLyrics(sourceTitle, sourceLyrics, label.api, personalGeminiApiKey),
        45000,
        'lyrics-language-timeout',
      );
      const translatedLyrics = (translatedBundle.lyrics || '').trim();

      if (!translatedLyrics) {
        throw new Error('empty-translated-lyrics');
      }

      const translatedTitle = (translatedBundle.title || sourceTitle)
        .replace(/\n/g, ' ')
        .replace(/^['"]|['"]$/g, '')
        .trim() || sourceTitle;

      const previousApplied = (activeSong.appliedKeywords || {}) as any;
      const nextLanguages = Array.from(new Set([...existingLanguages, targetLanguage])).slice(0, 2) as LanguageCode[];
      const nextLyricsByLanguage: Partial<Record<LanguageCode, string>> = {
        ...existingLyricsMap,
        [targetLanguage]: translatedLyrics,
      };
      const nextTitlesByLanguage: Partial<Record<LanguageCode, string>> = {
        ...existingTitleMap,
        [targetLanguage]: translatedTitle,
      };
      const firstForeignLanguage = nextLanguages.find((lang) => lang !== 'ko') || previousApplied.secondaryLanguage || 'en';

      const nextSong: SongResult = {
        ...activeSong,
        koreanTitle: nextTitlesByLanguage.ko || activeSong.koreanTitle || '',
        englishTitle: firstForeignLanguage ? (nextTitlesByLanguage[firstForeignLanguage as LanguageCode] || activeSong.englishTitle || '') : (activeSong.englishTitle || ''),
        lyrics: {
          ...(activeSong.lyrics || { korean: '', english: '' }),
          korean: nextLyricsByLanguage.ko || activeSong.lyrics?.korean || '',
          english: firstForeignLanguage ? (nextLyricsByLanguage[firstForeignLanguage as LanguageCode] || '') : '',
        },
        appliedKeywords: {
          ...previousApplied,
          lyricLanguages: nextLanguages,
          titleLanguages: nextLanguages,
          secondaryLanguage: firstForeignLanguage,
          lyricsByLanguage: nextLyricsByLanguage,
          titlesByLanguage: nextTitlesByLanguage,
          isNoLyrics: false,
          hasAddedLyricsLanguage: true,
          addedLyricsLanguage: targetLanguage,
          addedLyricsLanguageAt: Date.now(),
        } as any,
      };

      setResult(nextSong);
      if (currentHistoryIndex >= 0) {
        setHistoryIndex(currentHistoryIndex);
        historyIndexRef.current = currentHistoryIndex;
        preserveHistoryIndexOnNextSnapshotRef.current = currentHistoryIndex;
      }
      setHistory(prev => {
        const next = prev.map((song, index) => index === currentHistoryIndex ? nextSong : song);
        if (currentHistoryIndex < 0) return prev;
        if (user) {
          const ref = doc(db, "user_recent_songs", user.uid);
          setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true }).catch((error) => {
            console.error('Failed to persist added lyric language:', error);
          });
        }
        return next;
      });

      showToast(`${label.ko} 가사를 추가 생성했습니다.`);
    } catch (error) {
      console.error('Failed to add lyric language:', error);
      const message = error instanceof Error && error.message.includes('timeout')
        ? '가사 언어 추가 생성 시간이 너무 오래 걸립니다. 잠시 후 다시 시도해주세요.'
        : '가사 언어 추가 생성에 실패했습니다. 다시 시도해주세요.';
      showToast(message);
    } finally {
      setIsAddingLyricsLanguage(false);
      setAddingLyricsLanguageTarget(null);
    }
  };

  const isInLatestGenerationBatch = (song: SongResult | null = result) => {
    if (!song) return false;
    const batchId = (song.appliedKeywords as any)?.generationBatchId;
    if (batchId && latestGenerationBatchId) return batchId === latestGenerationBatchId;
    return historyIndex === 0;
  };

  const formatTitleLineByLanguage = (song: SongResult, lang: LanguageCode): string => {
    const rawTitle = getTitleByLanguage(song, lang);
    if (!rawTitle) return '';
    return formatDisplayTitle(getSubGenre(song), rawTitle);
  };

  const getTitleLinesForDisplay = (song: SongResult): string[] => {
    const generatedLanguages = getGeneratedLyricLanguages(song);
    const displayLanguages = getDisplayLyricLanguages(song);
    const addedLanguage = ((song.appliedKeywords as any)?.addedLyricsLanguage || '') as LanguageCode;
    const orderedLanguages = [
      ...displayLanguages,
      ...(addedLanguage ? [addedLanguage] : []),
      ...generatedLanguages,
    ].filter((lang, index, arr) => Boolean(lang) && arr.indexOf(lang) === index) as LanguageCode[];

    const lines = orderedLanguages
      .map((lang) => formatTitleLineByLanguage(song, lang))
      .filter(Boolean);

    if (lines.length > 0) return lines.slice(0, 2);

    if (song.koreanTitle && song.englishTitle) return [formatKoreanTitle(song), formatEnglishTitle(song)];
    if (song.koreanTitle) return [formatKoreanTitle(song)];
    if (song.englishTitle) return [formatEnglishTitle(song)];
    return [formatInlineTitle(song)];
  };

  // SORIDRAW_V49: generation fix + prompt UI/copy repair preserved
  const normalizeClipboardText = (value: string) => {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };


  const normalizePromptForDisplay = (value: string) => {
    const repairLine = (line: string) => {
      let repaired = String(line || '').replace(/\s+/g, ' ').trim();

      if (/^\[Atmosphere\]/i.test(repaired)) {
        repaired = repaired
          .replace(/\bwith the real reason hidden until the\s*$/i, 'with the real reason hidden until later')
          .replace(/\bthe real reason hidden until the\s*$/i, 'the real reason hidden until later')
          .replace(/\bhidden until the\s*$/i, 'hidden until later')
          .replace(/\buntil the\s*$/i, 'until later')
          .replace(/\buntil\s*$/i, 'until later')
          .replace(/\bwhile the other\s*$/i, 'while the other voice pulls away')
          .replace(/\binstead of\s*$/i, 'instead of balanced exchange')
          .replace(/\bkeeps chasing while the other\s*$/i, 'keeps chasing while the other voice pulls away')
          .replace(/\bas one voice keeps chasing while the other\s*$/i, 'as one voice keeps chasing while the other voice pulls away');
      }

      if (/^\[Vocals\]/i.test(repaired)) {
        repaired = repaired
          .replace(/\bwith\s+calmly restrained\s+with\s+lightly hopeful\b/gi, 'with calmly restrained and lightly hopeful delivery')
          .replace(/\bwith\s+lightly hopeful\s+with\s+calmly restrained\b/gi, 'with lightly hopeful and calmly restrained delivery')
          .replace(/\bwith\s+tossed-off and dry\s+with\s+pleading regret\b/gi, 'with tossed-off dry delivery and pleading regret')
          .replace(/\bwith\s+([^,;:.]{3,46}?)\s+with\s+([^,;:.]{3,46}?)(?=,|;|\.|$)/gi, 'with $1 and $2')
          .replace(/\bwith calmly restrained\s*$/i, 'with calmly restrained delivery')
          .replace(/\bwith lightly hopeful\s*$/i, 'with lightly hopeful delivery')
          .replace(/\bwith tossed-off and dry\s*$/i, 'with tossed-off dry delivery')
          .replace(/\s+,/g, ',');
      }

      if (/^\[Arrangement\]/i.test(repaired)) {
        repaired = repaired
          .replace(/\bone-sided\s*$/i, 'one-sided monologue focus')
          .replace(/\bsingle-owner\s*$/i, 'single-owner hook')
          .replace(/\bno balanced\s*$/i, 'no balanced call-response')
          .replace(/\bclear sectional\s*$/i, 'clear sectional contrast')
          .replace(/\buse ([^,]+?) as short point accents in key\s*$/i, 'use $1 as short point accents in key transitions')
          .replace(/\bclear sectional contrast\s*,\s*clear section contrast\b/gi, 'clear sectional contrast')
          .replace(/\bclear section contrast\s*,\s*clear sectional contrast\b/gi, 'clear sectional contrast')
          .replace(/\bclear section contrast\b/gi, 'clear sectional contrast');
      }

      return repaired.replace(/\s{2,}/g, ' ').trim();
    };

    return normalizeClipboardText(value)
      .split('\n')
      .map(repairLine)
      .filter(Boolean)
      .join('\n');
  };

  const normalizeLyricsForDisplay = (value: string) => {
    let normalized = normalizeClipboardText(value)
      .replace(sectionRegex, '\n\n$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Remove redundant generic instrumental note when the Intro section tag already says it.
    normalized = normalized.replace(
      /(\[Intro[^\]]*\bInstrumental(?:\s+Opening)?[^\]]*\])\s*\n+\s*\(Instrumental intro\)\s*(?=\n|$)/gi,
      '$1'
    );

    return normalized
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      const normalizedText = type === 'prompt'
        ? normalizePromptForDisplay(text)
        : (type.startsWith('lyrics-') ? normalizeLyricsForDisplay(text) : normalizeClipboardText(text));

      // SORIDRAW_V52: keep line breaks when pasting into Suno, notes, mobile messengers, etc.
      // Some targets collapse LF-only clipboard text, so copy with Windows-safe CRLF.
      const clipboardText = normalizedText.replace(/\r?\n/g, '\r\n');

      const htmlText = clipboardText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>');

      // SORIDRAW_V53: write both plain text and HTML so rich editors, Suno, notes,
      // and mobile paste targets keep line breaks instead of collapsing into one paragraph.
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([clipboardText], { type: 'text/plain' }),
            'text/html': new Blob([htmlText], { type: 'text/html' }),
          })
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = clipboardText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedType(type);
      setToast({ message: '복사되었습니다', visible: true });
      setTimeout(() => setCopiedType(null), 2000);
      setTimeout(() => setToast({ message: '', visible: false }), 1500);
    } catch (error) {
      console.error('Failed to copy text:', error);
      setToast({ message: '복사에 실패했습니다', visible: true });
      setTimeout(() => setToast({ message: '', visible: false }), 1500);
    }
  };

  const isGlobalClearable = 
    selectedGenres.length > 0 ||
    subGenre.length > 0 ||
    selectedMoods.length > 0 ||
    selectedThemes.length > 0 ||
    selectedStyles.length > 0 ||
    selectedInstrumentSounds.length > 0 ||
    selectedPointSounds.length > 0 ||
    userInput !== '' ||
    lyricsLength !== 'normal' ||
    songStructure !== '1' ||
    maleCount > 0 ||
    femaleCount > 0 ||
    rapEnabled ||
    !tempoEnabled ||
    minBPM !== 90 ||
    maxBPM !== 110 ||
    kpopMode !== 0 ||
    isKoreanEnglishMix ||
    citypopMode !== 0 ||
    isGenreRandomized ||
    isMoodRandomized ||
    isThemeRandomized ||
    isStyleRandomized ||
    isSoundTextureRandomized ||
    Object.values(menuLocks).some(Boolean);

  // --- Genre Display Logic ---
  const resolveGenreChipLabel = (id: string): string => {
    for (const group of GENRE_HIERARCHY) {
      for (const main of group.children) {
        if (main.id === id) return main.labelKo || main.label;
        const sub = main.children.find((s) => s.id === id);
        if (sub) return sub.labelKo || sub.label;
      }
    }
    return GENRES.find(item => item.id === id)?.labelKo || GENRES.find(item => item.id === id)?.label || id;
  };

  const displayGenreKeywords = Array.from(new Set([...subGenre, ...selectedGenres]))
    .map(id => ({
      id,
      type: 'genre' as const,
      label: resolveGenreChipLabel(id),
    }));


  type GlobalSearchType = 'genre' | 'style' | 'sound' | 'mood' | 'theme';

  const normalizeGlobalSearchText = (value: unknown) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[\s\-_/.,:;()[\]{}'"`~!@#$%^&*+=|\\?]+/g, ' ')
      .trim();

  const compactGlobalSearchText = (value: unknown) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[\s\-_/.,:;()[\]{}'"`~!@#$%^&*+=|\\?]+/g, '')
      .trim();

  const globalSearchIndex = useMemo(() => {
    const rows: Array<{
      id: string;
      type: GlobalSearchType;
      categoryLabel: string;
      groupLabel?: string;
      label: string;
      labelEn?: string;
      description?: string;
      searchText: string;
      compactText: string;
    }> = [];

    const seen = new Set<string>();
    const pushRow = (row: Omit<(typeof rows)[number], 'searchText' | 'compactText'>, extra: unknown[] = []) => {
      const key = `${row.type}:${row.id}`;
      if (seen.has(key)) return;
      seen.add(key);

      const textParts = [
        row.id,
        row.type,
        row.categoryLabel,
        row.groupLabel,
        row.label,
        row.labelEn,
        row.description,
        ...extra,
      ];

      rows.push({
        ...row,
        searchText: normalizeGlobalSearchText(textParts.join(' ')),
        compactText: compactGlobalSearchText(textParts.join(' ')),
      });
    };

    const walkGenreNode = (node: any, path: string[] = []) => {
      const nextPath = [...path, node.labelKo || node.label || node.id].filter(Boolean);
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length > 0) {
        children.forEach((child: any) => walkGenreNode(child, nextPath));
        return;
      }

      pushRow({
        id: node.id,
        type: 'genre',
        categoryLabel: '장르',
        groupLabel: nextPath.slice(0, -1).join(' · '),
        label: node.labelKo || node.label || node.id,
        labelEn: node.label,
        description: node.descriptionKo || node.description || '',
      }, nextPath);
    };

    GENRE_HIERARCHY.forEach((group: any) => walkGenreNode(group));

    STYLE_CYCLES.forEach((cycle: any) => {
      (cycle.variants || []).forEach((variant: any) => {
        if (!isSelectableKeywordItem(variant)) return;
        pushRow({
          id: variant.id,
          type: 'style',
          categoryLabel: '스타일',
          groupLabel: cycle.titleKo || cycle.title,
          label: variant.labelKo || variant.label || variant.id,
          labelEn: variant.label,
          description: variant.descriptionKo || variant.description || '',
        }, [variant.promptCore, variant.style, variant.sound, variant.mood, cycle.id, cycle.title, cycle.titleKo]);
      });
    });

    SOUND_TEXTURE_CYCLES.forEach((cycle: any) => {
      (cycle.variants || []).forEach((variant: any) => {
        if (!isSelectableKeywordItem(variant)) return;
        pushRow({
          id: variant.id,
          type: 'sound',
          categoryLabel: '사운드',
          groupLabel: cycle.titleKo || cycle.title,
          label: variant.labelKo || variant.label || variant.id,
          labelEn: variant.label,
          description: variant.descriptionKo || variant.description || '',
        }, [variant.promptCore, cycle.id, cycle.title, cycle.titleKo]);
      });
    });

    MOODS.forEach((item: any) => {
      if (!isSelectableKeywordItem(item)) return;
      pushRow({
        id: item.id,
        type: 'mood',
        categoryLabel: '분위기',
        label: item.labelKo || item.label || item.id,
        labelEn: item.label,
        description: item.descriptionKo || item.description || '',
      }, [item.mood, item.arrangement]);
    });

    THEMES.forEach((item: any) => {
      if (!isSelectableKeywordItem(item)) return;
      pushRow({
        id: item.id,
        type: 'theme',
        categoryLabel: '주제',
        label: item.labelKo || item.label || item.id,
        labelEn: item.label,
        description: item.descriptionKo || item.description || '',
      }, [item.theme, item.story, item.mood]);
    });

    return rows;
  }, []);

  const globalSearchTypePriority: Record<GlobalSearchType, number> = {
    genre: 0,
    style: 1,
    sound: 2,
    mood: 3,
    theme: 4,
  };

  const globalSearchResults = useMemo(() => {
    const normalizedQuery = normalizeGlobalSearchText(globalSearchQuery);
    const compactQuery = compactGlobalSearchText(globalSearchQuery);
    if (!normalizedQuery && !compactQuery) return [];

    const tokens = normalizedQuery.split(' ').filter(Boolean);
    return globalSearchIndex
      .map((item) => {
        let score = 0;
        if (compactQuery && item.compactText.includes(compactQuery)) score += 4;
        tokens.forEach((token) => {
          if (item.searchText.includes(token)) score += 2;
          if (item.label.toLowerCase().includes(token)) score += 4;
          if ((item.labelEn || '').toLowerCase().includes(token)) score += 3;
          if (item.id.toLowerCase().includes(token)) score += 2;
        });
        if (score <= 0) return null;
        return { ...item, score };
      })
      .filter(Boolean)
      .sort((a: any, b: any) =>
        globalSearchTypePriority[a.type as GlobalSearchType] - globalSearchTypePriority[b.type as GlobalSearchType] ||
        b.score - a.score ||
        a.label.localeCompare(b.label, 'ko') ||
        a.id.localeCompare(b.id)
      )
      .slice(0, 60) as Array<(typeof globalSearchIndex)[number] & { score: number }>;
  }, [globalSearchIndex, globalSearchQuery]);

  const isGlobalSearchSelectionClearable = subGenre.length > 0 || selectedStyles.length > 0 || selectedInstrumentSounds.length > 0 || selectedMoods.length > 0 || selectedThemes.length > 0;

  const clearGlobalSearchSelections = () => {
    setSelectedGenres([]);
    setSubGenre([]);
    setSelectedStyles([]);
    setSelectedInstrumentSounds([]);
    setSelectedMoods([]);
    setSelectedThemes([]);
    setIsGenreRandomized(false);
    setIsStyleRandomized(false);
    setIsSoundTextureRandomized(false);
    setIsMoodRandomized(false);
    setIsThemeRandomized(false);
  };

  const isGlobalSearchItemSelected = (item: { id: string; type: GlobalSearchType }) => {
    if (item.type === 'genre') return selectedGenres.includes(item.id) || subGenre.includes(item.id);
    if (item.type === 'style') return selectedStyles.includes(item.id);
    if (item.type === 'sound') return selectedInstrumentSounds.includes(item.id) || selectedPointSounds.includes(item.id);
    if (item.type === 'mood') return selectedMoods.includes(item.id);
    if (item.type === 'theme') return selectedThemes.includes(item.id);
    return false;
  };

  const handleGlobalSearchItemToggle = (item: { id: string; type: GlobalSearchType; label: string; categoryLabel?: string; description?: string }) => {
    if (isMenuLocked(item.type === 'sound' ? 'sound' : item.type)) {
      showToast(`${item.categoryLabel || '해당'} 메뉴가 잠겨 있습니다.`);
      return;
    }

    if (item.type === 'genre') {
      setSelectedGenres([]);
      setSubGenre((prev) => limitFusionGenreIds(prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      setIsGenreRandomized(false);
    } else if (item.type === 'style') {
      toggleCycleVariantSelection(item.id, selectedStyles, setSelectedStyles);
      setIsStyleRandomized(false);
    } else if (item.type === 'sound') {
      const isRecommendedCombo = !!getRecommendedSoundComboVariant(item.id);
      if (isRecommendedCombo) {
        if (selectedInstrumentSounds.includes(item.id)) {
          clearRecommendedSoundCombo(item.id);
        } else {
          applyRecommendedSoundCombo(item.id);
        }
      } else {
        setSelectedPointSounds((prev) => prev.filter((id) => id !== item.id));
        toggleCycleVariantSelection(item.id, selectedInstrumentSounds, setSelectedInstrumentSounds);
      }
      setIsSoundTextureRandomized(false);
    } else if (item.type === 'mood') {
      toggleSelection(item.id, 'mood');
    } else if (item.type === 'theme') {
      toggleSelection(item.id, 'theme');
    }

    setHoveredItem({
      id: item.id,
      label: item.label,
      labelKo: item.label,
      description: item.description || '',
      _ts: Date.now(),
    });
  };

  const getGlobalSearchBreadcrumbParts = (groupLabel?: string) =>
    String(groupLabel || '')
      .split(' · ')
      .map(part => part.trim())
      .filter(Boolean);

  const getGlobalSearchCategoryClass = (type: GlobalSearchType) => {
    if (type === 'genre') return 'text-brand-orange border-brand-orange/30 bg-brand-orange/10';
    if (type === 'style') return 'text-violet-300 border-violet-400/30 bg-violet-500/10';
    if (type === 'sound') return 'text-sky-300 border-sky-400/30 bg-sky-500/10';
    if (type === 'mood') return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10';
    return 'text-[#C995AC] border-fuchsia-400/30 bg-fuchsia-500/10';
  };


  const floatingActionBarVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  };

  const smoothActionPanelTransition = {
    duration: 0.28,
    ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  };

  const setActionButtonHint = (item: CategoryItem) => {
    if (isActionsFloating || isActionButtonsCollapsed) return;
    setHoveredItem(item);
  };

  const clearActionButtonHint = () => {
    if (isActionsFloating || isActionButtonsCollapsed) return;
    setHoveredItem(null);
  };

  const actionButtonsContent = (
    <>
      <div className="relative flex-shrink-0">
        <button
          onClick={() => {
            applyRandom();
            setActionButtonHint({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' });
          }}
          onMouseEnter={() => setActionButtonHint({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' })}
          onMouseLeave={() => {
            clearActionButtonHint();
            handleLongPressEnd();
          }}
          onTouchStart={() => handleLongPressStart({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' })}
          onTouchEnd={handleLongPressEnd}
          className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-[var(--card-bg)] hover:bg-btn-hover text-[#DFA05D] transition-all duration-150 ease-out border border-btn-border flex items-center justify-center gap-2 group/random shadow-btn active:scale-[0.94] active:translate-y-[3px] active:brightness-90 active:shadow-inner"
        >
          <Dices className="w-5 h-5 text-[#DFA05D] group-hover:rotate-180 transition-transform duration-500" />
          <span className="hidden md:block font-bold text-[#DFA05D]">랜덤 선택</span>
        </button>
      </div>

      <div className="relative flex-1">
        <button
          onClick={() => {
            if (isGenerating) {
              handleGenerate();
            } else {
              setShowMainGenerationModal(true);
            }
            setActionButtonHint({ id: 'generate', label: '생성하기', description: isGenerating ? '생성을 중단합니다.' : '생성 옵션을 선택한 뒤 곡을 생성합니다.' });
          }}
          onMouseEnter={() => setActionButtonHint({ id: 'generate', label: '생성하기', description: isGenerating ? '생성을 중단합니다.' : '생성 옵션을 선택한 뒤 곡을 생성합니다.' })}
          onMouseLeave={() => {
            clearActionButtonHint();
            handleLongPressEnd();
          }}
          onTouchStart={() => handleLongPressStart({ id: 'generate', label: '생성하기', description: isGenerating ? '생성을 중단합니다.' : '생성 옵션을 선택한 뒤 곡을 생성합니다.' })}
          onTouchEnd={handleLongPressEnd}
          className={cn(
            "w-full py-4 md:py-5 rounded-2xl text-white font-black text-[25px] md:text-[34px] shadow-lg transition-all duration-150 ease-out flex items-center justify-center gap-3 active:scale-[0.95] active:translate-y-[3px] active:brightness-90 active:shadow-inner",
            isGenerating 
              ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" 
              : "bg-[#E7AD68] text-[#171717] shadow-[0_8px_18px_rgba(0,0,0,0.30),0_4px_14px_rgba(231,173,104,0.16)] hover:bg-[#ECB976]"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
              <span>작곡 취소</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              <span>생성하기</span>
            </>
          )}
        </button>
      </div>

      <div className="relative flex-shrink-0">
        <button
          onClick={() => clearAll({ preserveHistory: true })}
          onMouseEnter={() => setActionButtonHint({ id: 'clear-all', label: 'Clear all', description: '선택한 옵션만 초기화하고, 아래 생성 곡 히스토리는 유지합니다.' })}
          onMouseLeave={() => clearActionButtonHint()}
          className={cn(
            "h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl transition-all duration-150 ease-out border flex items-center justify-center gap-2 shadow-btn active:scale-[0.94] active:translate-y-[3px] active:brightness-90 active:shadow-inner",
            isGlobalClearable
              ? "bg-[var(--card-bg)] border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
              : "bg-[var(--bg-primary)] border-btn-border text-[var(--text-secondary)]/50 cursor-not-allowed opacity-60"
          )}
          disabled={!isGlobalClearable}
        >
          <Trash2 className={cn("w-5 h-5", isGlobalClearable ? "text-red-500" : "text-red-500/30")} />
          <span className="hidden md:block font-bold">전체초기화</span>
        </button>
      </div>
    </>
  );

  const filteredSoundTextureCycles = useMemo(() => {
    const queryText = [
      ...selectedGenres,
      ...subGenre,
      ...selectedMoods,
      ...selectedStyles,
      userInput,
    ].join(' ').toLowerCase();

    const recommendationCycle = SOUND_TEXTURE_CYCLES.find((cycle) => cycle.id === 'recommended-sound-combos');
    if (!recommendationCycle) return SOUND_TEXTURE_CYCLES;

    const scoreRecommendation = (variant: any) => {
      const text = [variant.id, variant.label, variant.labelKo, variant.descriptionKo, variant.description].join(' ').toLowerCase();
      let score = 0;
      if (/gugak|korean|traditional|국악|전통|사극|판소리|가야금|해금|장구/.test(queryText)) score += /korean|전통|국악/.test(text) ? 6 : 0;
      if (/trap|hiphop|k-trap|808|dark|powerful|강력|어두|트랩|힙합|랩/.test(queryText)) score += /808|bass|베이스/.test(text) ? 4 : 0;
      if (/cyber|glitch|electronic|사이버|글리치|전자|미래/.test(queryText)) score += /cyber|glitch|사이버/.test(text) ? 4 : 0;
      if (/city|rnb|folk|band|warm|peaceful|시티|포크|밴드|따뜻|평화/.test(queryText)) score += /band|live|밴드/.test(text) ? 4 : 0;
      if (/magic|dream|fantasy|cute|몽환|마법|판타지|꿈|귀여/.test(queryText)) score += /magic|마법/.test(text) ? 4 : 0;
      if (/cinematic|epic|string|orchestra|웅장|시네마틱|영화|현악/.test(queryText)) score += /cinematic|strings|현악/.test(text) ? 4 : 0;
      return score;
    };

    const recommendedVariants = [...(recommendationCycle.variants as readonly any[])]
      .map((variant) => ({ variant, score: scoreRecommendation(variant) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.variant);

    const filteredRecommendationCycle = {
      ...recommendationCycle,
      variants: recommendedVariants.length > 0 ? recommendedVariants : recommendationCycle.variants,
    };

    return [filteredRecommendationCycle, ...SOUND_TEXTURE_CYCLES.filter((cycle) => cycle.id !== 'recommended-sound-combos')];
  }, [selectedGenres, subGenre, selectedMoods, selectedStyles, userInput]);


  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-brand-orange/30">
      {/* Account Status Banner */}
      {user && userStatus !== 'active' && !isAdminUser && (
        <Portal>
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%_-_48px)] max-w-lg">
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={cn(
                "px-4 py-3 rounded-2xl border backdrop-blur-md flex items-center gap-3 shadow-2xl overflow-hidden relative",
                userStatus === 'banned' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                "bg-orange-500/10 border-orange-500/20 text-orange-400"
              )}
            >
              <div className="absolute inset-0 bg-white/5 pointer-events-none" />
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-black leading-tight mb-0.5">
                  {userStatus === 'paused' && '계정 일시 제한'}
                  {userStatus === 'expired' && '이용 기간 만료'}
                  {userStatus === 'banned' && '계정 차단됨'}
                </p>
                <p className="text-[11px] opacity-80 leading-snug">
                  {userStatus === 'paused' && '관리자에 의해 계정이 일시 정지되었습니다. 곡 생성이 불가능합니다.'}
                  {userStatus === 'expired' && '워크스페이스 이용 기간이 종료되었습니다. 갱신 후 이용해주세요.'}
                  {userStatus === 'banned' && '해당 계정은 서비스 이용이 제한되었습니다. 고객센터에 문의하세요.'}
                </p>
              </div>
            </motion.div>
          </div>
        </Portal>
      )}

      {isGlobalSearchOpen && (
        <Portal>
          <motion.div
            className="fixed inset-0 z-[10000] flex items-start justify-center overflow-hidden overscroll-none bg-black/35 backdrop-blur-[1px] px-3 pb-5 pt-10 sm:pt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(event) => {
              globalSearchBackdropMouseDownRef.current = event.target === event.currentTarget;
            }}
            onPointerUp={(event) => {
              if (globalSearchBackdropMouseDownRef.current && event.target === event.currentTarget) {
                closeGlobalSearchModal();
              }
              globalSearchBackdropMouseDownRef.current = false;
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="flex h-[calc(100vh-5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--modal-soft-border)] bg-[var(--card-bg)] shadow-2xl sm:h-[min(760px,calc(100vh-7rem))]"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--modal-soft-border)] px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-brand-orange" />
                    <h2 className="text-lg font-black text-[var(--text-primary)]">통합 검색</h2>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">장르, 스타일, 사운드, 분위기, 주제를 한 번에 찾아요.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={clearGlobalSearchSelections}
                    disabled={!isGlobalSearchSelectionClearable}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-[11px] font-black transition-all active:scale-95",
                      isGlobalSearchSelectionClearable
                        ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange hover:bg-amber-500/15"
                        : "border-[var(--modal-button-border)] bg-btn-bg text-[var(--text-secondary)]/40"
                    )}
                  >
                    전체 해제
                  </button>
                  <button
                    type="button"
                    onClick={() => closeGlobalSearchModal()}
                    className={cn(
                      "rounded-2xl border p-2 transition-all active:scale-95",
                      isGlobalSearchSelectionClearable
                        ? "border-brand-orange bg-brand-orange text-white shadow-lg shadow-brand-orange/20 hover:bg-brand-orange/90"
                        : "border-[var(--modal-button-border)] bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover hover:text-brand-orange"
                    )}
                    aria-label="통합 검색 확인"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => closeGlobalSearchModal()}
                    className="rounded-2xl border border-[var(--modal-button-border)] bg-btn-bg p-2 text-[var(--text-secondary)] transition-all hover:bg-btn-hover hover:text-[var(--text-primary)] active:scale-95"
                    aria-label="통합 검색 닫기"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="border-b border-[var(--modal-soft-border)] px-5 py-4">
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--modal-button-border)] bg-[var(--bg-primary)] px-4 py-3 shadow-inner">
                  <Search className="h-5 w-5 text-brand-orange" />
                  <input
                    autoFocus
                    value={globalSearchQuery}
                    onChange={(event) => setGlobalSearchQuery(event.target.value)}
                    placeholder="예: 시티팝, 후렴, lead, 합창, 차가운"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]/60"
                  />
                  {globalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGlobalSearchQuery('')}
                      className="rounded-full p-1 text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                      aria-label="검색어 지우기"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {!globalSearchQuery.trim() ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--modal-soft-border)] bg-[var(--bg-primary)]/60 px-6 text-center">
                    <Search className="mb-3 h-8 w-8 text-brand-orange/70" />
                    <p className="text-sm font-black text-[var(--text-primary)]">찾고 싶은 키워드를 입력해줘.</p>
                    <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">한글, 영어, 설명, 내부 프롬프트까지 같이 검색해요.</p>
                  </div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--modal-soft-border)] bg-[var(--bg-primary)]/60 px-6 text-center">
                    <p className="text-sm font-black text-[var(--text-primary)]">검색 결과가 없어요.</p>
                    <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">비슷한 단어나 영어 키워드로 다시 찾아봐.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {globalSearchResults.map((item) => {
                      const isSelected = isGlobalSearchItemSelected(item);
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => handleGlobalSearchItemToggle(item)}
                          onMouseEnter={() => setHoveredItem({ id: item.id, label: item.labelEn || item.label, labelKo: item.label, description: item.description || '', _ts: Date.now() })}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.99]",
                            isSelected
                              ? "border-black/20 bg-[#658761]/74 text-[#171717] font-black soridraw-selected-strong shadow-lg shadow-[#658761]/10"
                              : "border-[var(--modal-button-border)] bg-[var(--bg-primary)]/80 hover:border-brand-orange/40 hover:bg-[var(--hover-bg)]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", getGlobalSearchCategoryClass(item.type))}>
                                  {item.categoryLabel}
                                </span>
                                {item.groupLabel && (
                                  <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                                    {getGlobalSearchBreadcrumbParts(item.groupLabel).map((part) => (
                                      <span key={`${item.type}-${item.id}-${part}`} className="inline-flex min-w-0 items-center gap-1">
                                        <span className="text-[var(--text-tertiary)]">&gt;</span>
                                        <span className="max-w-[9rem] truncate">{part}</span>
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-sm font-black text-[var(--text-primary)]">{item.label}</span>
                                {item.labelEn && item.labelEn !== item.label && (
                                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">{item.labelEn}</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-4 text-[var(--text-secondary)]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "mt-1 shrink-0 rounded-full px-2 py-1 text-[10px] font-black",
                              isSelected ? "bg-[#658761] text-[#171717] font-black" : "bg-[var(--hover-bg)] text-[var(--text-secondary)]"
                            )}>
                              {isSelected ? '선택됨' : '선택'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </Portal>
      )}


      <AnimatePresence>
        {isAuthModalOpen && !user && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/68 px-4 py-6 backdrop-blur-md"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeAuthModal();
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#151313] shadow-[0_24px_90px_rgba(0,0,0,0.52)]"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#D8B88C]/70">SORiDRAW</p>
                    <h2 className="mt-1 text-lg font-black text-white">
                      {authMode === 'signup' ? '이메일 회원가입' : authMode === 'reset' ? '비밀번호 재설정' : '로그인'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeAuthModal}
                    disabled={isLoggingIn}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/54 transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                    aria-label="닫기"
                    title="닫기"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/14 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthMessage(null);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-black transition-all",
                        authMode === 'login' ? "bg-white/12 text-white" : "text-white/55 hover:text-white"
                      )}
                    >
                      로그인
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthMessage(null);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-black transition-all",
                        authMode === 'signup' ? "bg-white/12 text-white" : "text-white/55 hover:text-white"
                      )}
                    >
                      회원가입
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 py-3 text-sm font-black text-white transition-all hover:bg-white/[0.11] disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#D8B88C]" />}
                    Google로 계속하기
                  </button>

                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/32">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-black text-white/55">이메일</span>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="name@example.com"
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/18 px-3 text-sm font-medium text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D8B88C]/45"
                      />
                    </label>

                    {authMode !== 'reset' && (
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black text-white/55">비밀번호</span>
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(event) => setAuthPassword(event.target.value)}
                          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                          placeholder="6자 이상"
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/18 px-3 text-sm font-medium text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D8B88C]/45"
                        />
                      </label>
                    )}

                    {authMode === 'signup' && (
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black text-white/55">비밀번호 확인</span>
                        <input
                          type="password"
                          value={authPasswordConfirm}
                          onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                          autoComplete="new-password"
                          placeholder="비밀번호 다시 입력"
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/18 px-3 text-sm font-medium text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D8B88C]/45"
                        />
                      </label>
                    )}

                    {authMessage && (
                      <div className="rounded-xl border border-[#D8B88C]/20 bg-[#D8B88C]/10 px-3 py-2 text-xs font-bold leading-5 text-[#F0D37C]">
                        {authMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F7D66E] via-[#F19A77] to-[#D56C7F] px-4 text-sm font-black text-[#151313] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-65"
                    >
                      {isLoggingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                      {authMode === 'signup' ? '이메일로 가입하기' : authMode === 'reset' ? '재설정 메일 보내기' : '이메일로 로그인'}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-white/45">
                    {authMode === 'reset' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthMessage(null);
                        }}
                        className="text-[#D8B88C] hover:text-[#F0D37C]"
                      >
                        로그인으로 돌아가기
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('reset');
                          setAuthMessage(null);
                        }}
                        className="text-[#D8B88C] hover:text-[#F0D37C]"
                      >
                        비밀번호를 잊으셨나요?
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <Navigation user={user} handleLogin={handleLogin} isLoggingIn={isLoggingIn} handleLogout={handleLogout} isAdminUser={isAdminUser} rememberLogin={rememberLogin} setRememberLogin={setRememberLogin} sunoLibrarySignal={sunoLibrarySignal} sunoLibrarySignalDotClass={sunoLibrarySignalDotClass} clearSunoLibrarySignal={clearSunoLibrarySignal} />

      <Routes>
        <Route path="/" element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 text-violet-300 animate-spin" /></div>}>
            <HomePageLazy user={user} onLogin={handleLogin} isLoggingIn={isLoggingIn} />
          </Suspense>
        } />
        <Route path="/studio" element={
          <>

              {/* Header */}
              <header className="studio-hero-tone pt-20 pb-0 md:pt-24 md:pb-0 bg-transparent relative">
                <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 relative">
                  {/* Studio header search button */}
                  {user && (
                    <button
                      type="button"
                      onClick={openGlobalSearchModal}
                      className="absolute bottom-0 right-5 md:right-6 z-20 flex h-9 w-9 md:h-10 md:w-10 translate-y-1/2 items-center justify-center rounded-2xl bg-transparent border-0 shadow-none hover:scale-105 transition-all group"
                      aria-label="통합 검색"
                      title="통합 검색"
                    >
                      <Search className="w-6 h-6 md:w-7 md:h-7 text-[#DFA05D] group-hover:scale-110 transition-transform" />
                    </button>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-start mt-4 md:mt-10 translate-y-6 md:translate-y-5"
                  >
                    <h1 
                      className="inline-flex items-center justify-start gap-2.5 text-[37px] md:text-[52px] font-black tracking-tight text-[var(--text-primary)] mb-0 font-display sori-studio-logo-text text-left w-full"
                    >
                      <Zap className="w-8 h-8 md:w-10 md:h-10 text-[#c8801b]" />
                      <span>Sori <span className="text-[#c8801b]">Studio</span></span>
                    </h1>
                  </motion.div>
                </div>
              </header>

            <main className="studio-tone-down mx-auto w-full max-w-[1500px] px-3 md:px-5 pt-6 pb-6 space-y-7">
              {/* Selection Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              <GenreHierarchySelector
                selectedGenre={selectedGenres}
                selectedSubGenre={subGenre}
                onSelectGenre={(id) => {
                  setSelectedGenres([]);
                  setSubGenre((prev) =>
                    limitFusionGenreIds(prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id])
                  );
                  setIsGenreRandomized(false);
                }}
                onSelectSubGenre={(id) =>
                  setSubGenre((prev) =>
                    limitFusionGenreIds(prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
                  )
                }
                onCommitSelection={(mainId, subId, meta) => {
                  const removeMainId = meta?.removeMainId ?? null;
                  const removeSubId = meta?.removeSubId ?? null;

                  const nextIds = Array.from(
                    new Set(
                      subGenre
                        .filter((id) => id !== removeMainId && id !== removeSubId)
                        .filter((id) => id !== mainId && id !== subId)
                    )
                  );

                  // Only store the final selectable leaf genre.
                  // If a sub genre exists, the parent/middle genre is only a navigation folder and must not be saved.
                  if (subId) {
                    nextIds.push(subId);
                  } else if (mainId && hierarchyLeafGenreIdSet.has(mainId)) {
                    nextIds.push(mainId);
                  }

                  setSelectedGenres([]);
                  setSubGenre(Array.from(new Set(nextIds)).slice(-MAX_FUSION_GENRES));
                  setIsGenreRandomized(false);
                }}
                onCommitSelectionList={(subIds) => {
                  setSelectedGenres([]);
                  setSubGenre(limitFusionGenreIds(subIds.filter((id) => hierarchyLeafGenreIdSet.has(id))));
                  setIsGenreRandomized(false);
                }}
                onClear={() => {
                  setSelectedGenres([]);
                  setSubGenre([]);
                  setIsGenreRandomized(false);
                }}
                onRandom={() => {
                  if (menuLocks.genre) {
                    showToast('장르 메뉴가 잠겨 있습니다.');
                    return;
                  }
                  const randomLeafGenreId = pickRandomLeafGenreId();
                  if (!randomLeafGenreId) return;
                  setSelectedGenres([]);
                  setSubGenre([randomLeafGenreId]);
                  setIsGenreRandomized(true);
                }}
                isLocked={menuLocks.genre}
                onToggleLock={() => toggleMenuLock('genre')}
                onHover={setHoveredItem}
                isExpanded={isGenreExpanded}
                onToggleExpand={() => toggleMainSections('genre')}
                isRandomized={isGenreRandomized}
                onHeightChange={setGenreHeight}
                forcedHeight={window.innerWidth >= 768 && row1MaxHeight > 0 ? row1MaxHeight : undefined}
                onModalStateChange={(isOpen) => { syncActionBarModalBlock(isOpen); setIsGenreHierarchyModalOpen(isOpen); }}
              />
          <CycleSection 
            title="Style" 
            titleKo="스타일"
            description="Determines the expression and flow of the song. Depending on the selected style, the development and rhythmic feel of the song change, leading the overall impression of the music in the desired direction, such as classic, sophisticated, or emotional."
            descriptionKo="하이브리드 장르를 위해 선택하세요. 선택한 스타일에 따라 곡의 전개와 리듬감이 달라지며, 굳이 선택 안하고 기본 장르만으로도 좋은 곡을 만들수 있습니다 "
            cycles={STYLE_CYCLES}
            selected={selectedStyles}
            onCycleToggle={(cycleId, variantId) => {
              if (variantId) toggleCycleVariantSelection(variantId, selectedStyles, setSelectedStyles);
              else cycleFamilySelection(cycleId, selectedStyles, setSelectedStyles, STYLE_CYCLES);
            }}
            onClear={() => { setSelectedStyles([]); setIsStyleRandomized(false); }}
            onRandom={() => randomizeCategory('style')}
            isLocked={menuLocks.style}
            onToggleLock={() => toggleMenuLock('style')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isRandomized={isStyleRandomized}
            isExpanded={isStyleExpanded}
            onToggleExpand={() => toggleMainSections('style')}
            onHeightChange={setStyleHeight}
            forcedHeight={window.innerWidth >= 768 && row1MaxHeight > 0 ? row1MaxHeight : undefined}
            onModalStateChange={(isOpen) => { syncActionBarModalBlock(isOpen); setIsCycleKeywordPopupOpen(isOpen); }}
          />
          <CycleSection 
            title="Sound/Texture" 
            titleKo="사운드"
            description="Sets the instrument tone and background texture. By adjusting the grain of the sound, spaciousness, weight, and impact, it determines the auditory impression of the music, affecting the production of rich or clean sounds."
            descriptionKo="악기 톤과 배경 질감을 설정합니다. 기본 장르에 적용된 악기 사운드의 질감을 바꿔서 원하는 느낌으로 풍성하거나 깔끔한 사운드를 연출하는 데 영향을 줍니다."
            cycles={filteredSoundTextureCycles}
            selected={selectedInstrumentSounds}
            pointSelected={selectedPointSounds}
            isPointSelectionMode={false}
            highlightedVariantIds={recommendedComboAppliedSoundIds}
            onCycleToggle={(cycleId, variantId) => {
              if (variantId) {
                const isRecommendedCombo = !!getRecommendedSoundComboVariant(variantId);
                if (isRecommendedCombo) {
                  if (selectedInstrumentSounds.includes(variantId)) {
                    clearRecommendedSoundCombo(variantId);
                    return;
                  }
                  if (applyRecommendedSoundCombo(variantId)) return;
                }
                setSelectedPointSounds((prev) => prev.filter((id) => id !== variantId));
                toggleCycleVariantSelection(variantId, selectedInstrumentSounds, setSelectedInstrumentSounds);
              }
              else cycleFamilySelection(cycleId, selectedInstrumentSounds, setSelectedInstrumentSounds, SOUND_TEXTURE_CYCLES);
            }}
            onOtherModeVariantToggle={(variantId) => {
              setSelectedInstrumentSounds((prev) => prev.filter((id) => id !== variantId));
              const combo = getRecommendedSoundComboVariant(variantId);
              if (combo) {
                recommendedSoundComboAppliedIdsRef.current = Object.fromEntries(
                  Object.entries(recommendedSoundComboAppliedIdsRef.current).filter(([, comboId]) => comboId !== variantId)
                );
              }
              toggleCycleVariantSelection(variantId, selectedPointSounds, setSelectedPointSounds);
            }}
            onClear={() => {
              recommendedSoundComboAppliedIdsRef.current = {};
              setSelectedInstrumentSounds([]);
              setSelectedPointSounds([]);
              setIsPointSoundMode(false);
              setIsSoundTextureRandomized(false);
            }}
            onRandom={() => randomizeCategory('sound')}
            isLocked={menuLocks.sound}
            onToggleLock={() => toggleMenuLock('sound')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isRandomized={isSoundTextureRandomized}
            isExpanded={isSoundExpanded}
            onToggleExpand={() => toggleMainSections('sound')}
            onHeightChange={setSoundHeight}
            forcedHeight={window.innerWidth >= 768 && row1MaxHeight > 0 ? row1MaxHeight : undefined}
            onModalStateChange={(isOpen) => { syncActionBarModalBlock(isOpen); setIsCycleKeywordPopupOpen(isOpen); }}
          />
        </div>

        <AnimatePresence>
          {isGenreModalOpen && activeGenreGroupId && (
            <GenreSelectModal
              group={GENRE_GROUPS.find((item) => item.id === activeGenreGroupId) ?? null}
              selectedGenreId={selectedGenres[0] ?? null}
              onClose={() => closeGenreModal('ui')}
              onSelect={handleGenreSelect}
            />
          )}
        </AnimatePresence>

        {/* Lyrics Length & Drum Style & Vocal Gender Controls */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-7 items-start">
            <CategorySection 
              title="Mood" 
              titleKo="분위기"
              description="Determines the emotional curve and mood of the song. By setting the emotional core the music aims to convey, such as sadness, joy, or tension, it decides the overall emotional tone of the generated music."
              descriptionKo="곡의 감정선과 분위기를 결정합니다. 슬픔, 기쁨, 긴장감 등 음악이 전달하고자 하는 감정적 핵심을 설정하여, 생성되는 음악의 전반적인 감성적 톤을 결정합니다."
              items={MOODS} 
              selected={selectedMoods} 
              onToggle={(id) => toggleSelection(id, 'mood')}
              onClear={() => clearCategory('mood')}
              onRandom={() => randomizeCategory('mood')}
              isLocked={menuLocks.mood}
              onToggleLock={() => toggleMenuLock('mood')}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              hoveredItem={hoveredItem}
              isExpanded={isMoodExpanded}
              onToggleExpand={() => toggleSubSections('mood')}
              onHeightChange={setMoodHeight}
              forcedHeight={window.innerWidth >= 768 && row2MaxHeight > 0 ? row2MaxHeight : undefined}
              allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
              isRandomized={isMoodRandomized}
              hidePin={true}
              uniformKeywordGrid={true}
              directInput={{
                selectedText: selectedMoods.map((id) => getCustomKeywordText(id, CUSTOM_MOOD_PREFIX)).find(Boolean) || '',
                onApply: applyDirectMoodInput,
                onCancelSelected: clearDirectMoodInput,
              }}
            />
            <CategorySection 
              title="Theme" 
              titleKo="주제"
              description="Determines the situation, story, and message of the song. Like love, breakup, night, or travel, it sets what the song talks about and what scene it paints."
              descriptionKo="곡의 상황, 이야기, 메시지를 결정합니다. 사랑, 이별, 밤, 여행처럼 노래가 무엇을 말하는지와 어떤 장면을 그릴지 설정합니다."
              items={THEMES} 
              selected={selectedThemes} 
              onToggle={(id) => toggleSelection(id, 'theme')}
              onClear={() => clearCategory('theme')}
              onRandom={() => randomizeCategory('theme')}
              isLocked={menuLocks.theme}
              onToggleLock={() => toggleMenuLock('theme')}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              hoveredItem={hoveredItem}
              isExpanded={isThemeExpanded}
              onToggleExpand={() => toggleSubSections('theme')}
              onHeightChange={setThemeHeight}
              forcedHeight={window.innerWidth >= 768 && row2MaxHeight > 0 ? row2MaxHeight : undefined}
              allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
              isRandomized={isThemeRandomized}
              hidePin={true}
              uniformKeywordGrid={true}
              directInput={{
                selectedText: selectedThemes.map((id) => getCustomKeywordText(id, CUSTOM_THEME_PREFIX)).find(Boolean) || '',
                onApply: applyDirectThemeInput,
                onCancelSelected: clearDirectThemeInput,
              }}
            />
            <div className="md:col-span-2 rounded-[26px] bg-[var(--card-bg)] shadow-card overflow-hidden relative z-[20]">
              <div className="p-5 md:p-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={openStoryboardModal}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#AC5045]/12 border border-black/20 flex items-center justify-center shrink-0">
                      <Users className="w-[22px] h-[22px] text-[#D79084]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base md:text-lg font-black text-[var(--text-primary)]">Storyboard</h3>
                        <span className="text-xs font-bold text-[var(--text-secondary)]">스토리보드</span>
                      </div>
                      <p className="text-xs md:text-sm text-[var(--text-secondary)] truncate">
                        {buildStoryboardSummary(situation)}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleMenuLock('situation')}
                    onMouseEnter={() => setHoveredItem({ id: 'situation-lock', label: menuLocks.situation ? 'Unlock Storyboard' : 'Lock Storyboard', labelKo: menuLocks.situation ? '잠금 해제' : '스토리보드 잠금', description: menuLocks.situation ? '스토리보드를 랜덤 선택에 다시 포함합니다.' : '현재 스토리보드 설정을 유지하고 랜덤 선택에서 제외합니다.' })}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      "p-2 rounded-xl border border-black/20 transition-all shadow-btn",
                      menuLocks.situation
                        ? "bg-[#AC5045]/72 text-[#17120F] border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                        : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
                    )}
                    title={menuLocks.situation ? '잠금 해제' : '스토리보드 잠금'}
                    aria-label={menuLocks.situation ? '스토리보드 잠금 해제' : '스토리보드 잠금'}
                  >
                    {menuLocks.situation ? <Lock className="w-[18px] h-[18px]" /> : <Unlock className="w-[18px] h-[18px]" />}
                  </button>
                  {hasActiveSituation(situation) && (
                    <button
                      type="button"
                      onClick={clearSituation}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-btn-bg border border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover transition-all"
                    >
                      초기화
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openStoryboardModal}
                    className={cn(
                      "px-3 py-2 rounded-xl border text-xs font-black transition-all shadow-btn",
                      hasActiveSituation(situation)
                        ? "bg-[#AC5045]/78 border-black/20 text-[#171717] font-black soridraw-selected-strong hover:bg-[#AC5045]/86"
                        : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                    )}
                    aria-label="스토리보드 설정 열기"
                  >
                    {hasActiveSituation(situation) ? '편집' : '설정'}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isSituationExpanded && (
                <Portal>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden overscroll-none bg-black/40 backdrop-blur-sm px-3 py-5"
                    onPointerDown={(event) => {
                      storyboardModalBackdropMouseDownRef.current = event.target === event.currentTarget;
                    }}
                    onPointerUp={(event) => {
                      if (storyboardModalBackdropMouseDownRef.current && event.target === event.currentTarget) {
                        storyboardModalBackdropMouseDownRef.current = false;
                        applyStoryboardModal();
                        return;
                      }
                      storyboardModalBackdropMouseDownRef.current = false;
                    }}
                    onPointerCancel={() => {
                      storyboardModalBackdropMouseDownRef.current = false;
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
                      className="w-full max-w-4xl max-h-[88vh] overflow-hidden overscroll-contain rounded-[28px] bg-[var(--card-bg)] shadow-[0_24px_70px_rgba(0,0,0,0.66)]"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                    >
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 md:px-5 py-4 bg-[var(--card-bg)]/95 backdrop-blur-xl shadow-[inset_0_-1px_0_rgba(172,80,69,0.08)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Users className="w-[22px] h-[22px] text-[#D79084]" />
                            <h3 className="text-base md:text-lg font-black text-[var(--text-primary)]">스토리보드</h3>
                            <span className="text-[11px] font-bold text-[var(--text-tertiary)]">Storyboard</span>
                          </div>
                          <p className="mt-1 text-[11px] md:text-xs text-[var(--text-secondary)]">캐릭터와 이야기 흐름을 정해요</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasDraftStoryboard && (
                            <button
                              type="button"
                              onClick={clearDraftSituation}
                              className="px-3 py-2 rounded-xl bg-btn-bg text-[11px] font-black text-[var(--text-secondary)] hover:text-[#D79084] hover:bg-[#AC5045]/10 transition-all"
                            >
                              전체 해제
                            </button>
                          )}
                          {isStoryboardDraftChanged && (
                            <button
                              type="button"
                              onClick={applyStoryboardModal}
                              className="p-2 rounded-xl bg-[#AC5045]/78 text-[#171717] font-black soridraw-selected-strong hover:bg-[#AC5045]/86 transition-all"
                              title="적용"
                              aria-label="스토리보드 적용"
                            >
                              <Check className="w-[18px] h-[18px]" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={closeStoryboardModal}
                            className="p-2 rounded-xl bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover transition-all"
                            title="닫기"
                            aria-label="스토리보드 닫기"
                          >
                            <X className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[calc(88vh-76px)] overflow-y-auto overscroll-contain custom-scrollbar p-4 md:p-5 space-y-5">
                        <section className="rounded-3xl bg-[#1a1a1a] p-5 space-y-4 shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
                          <StoryboardSectionTitle title="캐릭터" description="등장하는 캐릭터를 정해요. 한 명만 써도 됩니다." />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-black text-[#D79084] mb-2">캐릭터 A</label>
                              <input
                                value={draftSituation.targetA || ''}
                                onChange={(e) => updateDraftSituationField('targetA', e.target.value)}
                                placeholder="예: 저승사자, 엄마, 상사"
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-[#E8B878] mb-2">캐릭터 B</label>
                              <input
                                value={draftSituation.targetB || ''}
                                onChange={(e) => updateDraftSituationField('targetB', e.target.value)}
                                placeholder="예: 귀신, 아들, 직원"
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40"
                              />
                            </div>
                          </div>
                        </section>

                        <section className="rounded-3xl bg-[#1a1a1a] p-5 space-y-5 shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
                          <StoryboardSectionTitle title="캐릭터 포지션" description="원하는 스타일로 게이지를 맞춰보세요" />
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-3xl bg-[#151515] p-4 space-y-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
                              <div className="flex items-center gap-2 pl-2">
                                <p className="text-sm font-black text-[#D79084] truncate">{draftSituation.targetA || '캐릭터 A'}</p>
                              </div>
                              <StoryboardSlider label="말투" left="존댓말" right="반말" value={getStoryboardSliderValue(draftSituation, 'characterAPoliteness')} onChange={(v) => updateDraftSituationField('characterAPoliteness', v)} statusLabels={["존댓말", "반존대", "반말"]} accent="story" />
                              <StoryboardSlider label="감정" left="잔잔" right="폭발" value={getStoryboardSliderValue(draftSituation, 'characterAIntensity')} onChange={(v) => updateDraftSituationField('characterAIntensity', v)} statusLabels={["잔잔", "울컥", "폭발"]} accent="story" />
                              <StoryboardSlider label="화법" left="돌직구" right="변화구" value={getStoryboardSliderValue(draftSituation, 'characterADelivery')} onChange={(v) => updateDraftSituationField('characterADelivery', v)} statusLabels={["직설", "혼합", "은유"]} accent="story" />
                              <input
                                value={draftSituation.speakerAExtra || ''}
                                onChange={(e) => updateDraftSituationField('speakerAExtra', e.target.value)}
                                placeholder="추가 말맛: 예: 건방진 말투, 욕 살짝 섞음"
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40"
                              />
                            </div>

                            <div className="rounded-3xl bg-[#151515] p-4 space-y-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
                              <div className="flex items-center gap-2 pl-2">
                                <p className="text-sm font-black text-[#E8B878] truncate">{draftSituation.targetB || '캐릭터 B'}</p>
                              </div>
                              <StoryboardSlider label="말투" left="존댓말" right="반말" value={getStoryboardSliderValue(draftSituation, 'characterBPoliteness')} onChange={(v) => updateDraftSituationField('characterBPoliteness', v)} accent="characterB" statusLabels={["존댓말", "반존대", "반말"]} />
                              <StoryboardSlider label="감정" left="잔잔" right="폭발" value={getStoryboardSliderValue(draftSituation, 'characterBIntensity')} onChange={(v) => updateDraftSituationField('characterBIntensity', v)} accent="characterB" statusLabels={["잔잔", "울컥", "폭발"]} />
                              <StoryboardSlider label="화법" left="돌직구" right="변화구" value={getStoryboardSliderValue(draftSituation, 'characterBDelivery')} onChange={(v) => updateDraftSituationField('characterBDelivery', v)} accent="characterB" statusLabels={["직설", "혼합", "은유"]} />
                              <input
                                value={draftSituation.speakerBExtra || ''}
                                onChange={(e) => updateDraftSituationField('speakerBExtra', e.target.value)}
                                placeholder="추가 말맛: 예: 공손하지만 안 물러남"
                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40"
                              />
                            </div>
                          </div>
                        </section>

                        <section className="rounded-3xl bg-[#1a1a1a] p-5 space-y-4 shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
                          <StoryboardSectionTitle title="세계관" description="무슨 일이 벌어지는지, 어떤 배경인지 적어주세요." />
                          <textarea
                            value={draftSituation.description || ''}
                            onChange={(e) => updateDraftSituationField('description', e.target.value)}
                            placeholder="예: 저승사자가 살아 있을 때 못한 게 많아 미련이 남은 귀신을 데리러 온다"
                            rows={4}
                            className="w-full px-3 py-3 rounded-2xl bg-[var(--input-bg)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40 resize-none"
                          />
                          <input
                            value={draftSituation.detailCustom || draftSituation.details || ''}
                            onChange={(e) => {
                              updateDraftSituationField('detailCustom', e.target.value);
                              updateDraftSituationField('detailPresets', []);
                            }}
                            placeholder="추가 디테일: 장소, 물건, 말버릇, 엔딩 느낌"
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#AC5045]/40"
                          />
                        </section>

                        <section className="rounded-3xl bg-[#1a1a1a] p-5 space-y-5 shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
                          <StoryboardSectionTitle title="스토리 라인" description="노래를 부를때 어떤 방식으로 전개하는지 결정해요." />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <StoryboardSlider label="대화" left="티키타카" right="독백" value={getStoryboardSliderValue(draftSituation, 'storyDialogueBalance')} onChange={(v) => updateDraftSituationField('storyDialogueBalance', v)} description="주도하는 대화방식을 조절해요." statusLabels={["티키타카", "반반", "독백"]} />
                            <StoryboardSlider label="전개" left="리얼리즘" right="드라마틱" value={getStoryboardSliderValue(draftSituation, 'storyRealityScale')} onChange={(v) => updateDraftSituationField('storyRealityScale', v)} description="현실과 비현실의 비중을 조절해요." statusLabels={["리얼리즘", "시트콤", "드라마틱"]} />
                            <StoryboardSlider label="감정" left="위트" right="진심" value={getStoryboardSliderValue(draftSituation, 'storyPlayfulSincere')} onChange={(v) => updateDraftSituationField('storyPlayfulSincere', v)} description="장난과 진심 사이의 강약을 조절해요." statusLabels={["위트", "츤데레", "진심"]} />
                          </div>
                        </section>
                      </div>
                    </motion.div>
                  </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            <VocalControl 
              maleCount={maleCount}
              femaleCount={femaleCount}
              vocalMode={vocalMode}
              vocalTones={vocalTones}
              vocalMembers={vocalMembers}
              rapEnabled={rapEnabled}
              onMaleChange={setMaleCount}
              onFemaleChange={setFemaleCount}
              onModeChange={setVocalMode}
              onMembersChange={setVocalMembers}
              onRapChange={setRapEnabled}
              isKoreanEnglishMix={isKoreanEnglishMix}
              englishMixRatio={englishMixRatio}
              onEnglishMixRatioChange={setEnglishMixRatio}
              onToggleKoreanEnglishMix={() => {
                const nextValue = !isKoreanEnglishMix;
                setIsKoreanEnglishMix(nextValue);
                setHoveredItem({
                  id: 'lyrics-mix-toggle',
                  label: '한/영 혼합',
                  description: nextValue
                    ? '선택한 장르와 관계없이 한국어와 영어가 자연스럽게 섞인 가사를 생성합니다.'
                    : '한/영 혼합을 끄고 기본 언어 흐름으로 되돌립니다.',
                  _ts: Date.now(),
                });
              }}
              isLocked={menuLocks.vocal}
              onToggleLock={() => toggleMenuLock('vocal')}
              onClear={() => {
                setMaleCount(0);
                setFemaleCount(0);
                setVocalMode('solo');
                setSelectedVocalToneId(undefined);
                setVocalMembers([]);
              }}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              onModalStateChange={(isOpen) => { syncActionBarModalBlock(isOpen); setIsVocalCharacterModalOpen(isOpen); }}
            />
            <SongStructureIntegratedControl
              lyricsLength={lyricsLength}
              onLyricsLengthChange={setLyricsLength}
              songStructure={songStructure}
              customStructure={customStructure}
              onSongStructureChange={setSongStructure}
              onCustomStructureChange={setCustomStructure}
              isLocked={menuLocks.structure}
              onToggleLock={() => toggleMenuLock('structure')}
              onModalStateChange={(isOpen) => { syncActionBarModalBlock(isOpen); setIsStructureModalOpen(isOpen); }}
              onClear={() => {
                setLyricsLength('normal');
                setSongStructure('1');
                setCustomStructure([]);
              }}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              user={user}
              userTier={effectiveUserTier}
              sectionTags={sectionTags}
              pointSoundTags={filterSelectableIds(selectedPointSounds).map(getPointSoundTagLabelById).filter(Boolean)}
              pointSoundTagLabels={Object.fromEntries(
                filterSelectableIds(selectedPointSounds)
                  .map((id) => [getPointSoundTagLabelById(id), getPointSoundTagDisplayLabelById(id)] as const)
                  .filter(([tag, label]) => Boolean(tag && label))
              )}
              vocalSectionTags={vocalSectionTagOptions}
            />
          </div>
        </div>

        {/* Tempo Control Bar */}
        <div className="mb-4">
          <TempoControl 
            enabled={tempoEnabled}
            onEnabledChange={setTempoEnabled}
            min={minBPM}
            max={maxBPM}
            onMinChange={setMinBPM}
            onMaxChange={setMaxBPM}
            onClear={() => {
              setTempoEnabled(true);
              setMinBPM(90);
              setMaxBPM(110);
            }}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
        </div>

        {/* Search & Actions */}
        <div className="space-y-1 md:space-y-1">
          <div className="relative group">
            <div className="absolute top-6 left-4 pointer-events-none z-10">
              <Search className="w-5 h-5 text-[var(--text-secondary)] group-focus-within:text-brand-orange transition-colors" />
            </div>
            
              <textarea
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
                }}
                onFocus={() => {
                  setIsInputFocused(true);
                }}
                onBlur={() => setIsInputFocused(false)}
                className="w-full bg-[rgba(255,255,255,0.16)] border border-white/20 rounded-2xl py-5 pl-12 pr-40 md:pr-48 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-orange/60 focus:border-brand-orange/60 transition-all duration-300 text-lg min-h-[68px] max-h-[320px] resize-none overflow-y-auto custom-scrollbar relative shadow-[var(--shadow-lg)] placeholder:text-white/60 scroll-smooth shadow-inner hover:border-white/30"
                rows={1}
                placeholder=""
              />
            <AnimatePresence mode="wait">
              {!userInput && (
                <motion.div
                  key={commandPlaceholderIndex}
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: isInputFocused ? 0.78 : 0.92, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="pointer-events-none absolute left-12 right-40 md:right-48 top-1/2 -translate-y-1/2 z-10 text-base md:text-lg leading-snug text-white/65 truncate"
                >
                  {commandPlaceholderExamples[commandPlaceholderIndex]}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Direct Lyrics Toggle Button */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
              <button
                onClick={() => setIsLyricMode(!isLyricMode)}
                onMouseEnter={() => setHoveredItem({ id: 'lyric-mode', label: '직접 작사', description: '가사 초안을 직접 입력하여 생성 결과에 우선 반영합니다.' })}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-[13px] md:text-sm font-extrabold transition-all border shadow-[0_8px_24px_rgba(0,0,0,0.28)] min-h-[42px]",
                  isLyricMode 
                    ? "bg-brand-orange text-white border-brand-orange shadow-brand-orange/20" 
                    : "bg-white/14 text-white border-white/25 hover:bg-white/20 hover:border-brand-orange/70"
                )}
              >
                <Languages className="w-[18px] h-[18px]" />
                직접 작사
              </button>
            </div>
          </div>

          {/* Direct Lyrics Input Area */}
          <AnimatePresence>
            {isLyricMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-4 space-y-3">
                  <div className="h-px bg-btn-border w-full" />
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                      <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                        이 아래 내용은 가사 초안으로 우선 반영됩니다.
                      </p>
                    </div>
                    
                    {/* Lyric Mode Selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-btn-bg rounded-lg p-0.5 border border-btn-border shadow-btn">
                        <button
                          onClick={() => setLyricMode('assist')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                            lyricMode === 'assist' 
                              ? "bg-brand-orange text-white shadow-sm" 
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          AI 보정
                        </button>
                        <button
                          onClick={() => setLyricMode('preserve')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                            lyricMode === 'preserve' 
                              ? "bg-brand-orange text-white shadow-sm" 
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          원문 유지
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setLyricDraft('');
                          setIsLyricMode(false);
                        }}
                        onMouseEnter={() => setHoveredItem({ id: 'delete-lyric', label: '가사 삭제', description: '입력한 가사 초안을 모두 지우고 창을 닫습니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="p-1.5 rounded-lg bg-btn-bg border border-btn-border text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all shadow-btn"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative group">
                    <textarea
                      value={lyricDraft}
                      onChange={(e) => {
                        setLyricDraft(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
                      }}
                      placeholder="여기에 적은 가사초안을 기초로 Ai가 보정하여 재창작됩니다.(작사를 직접 하고싶다면 '원문유지'를 이용하세요.)"
                      className="w-full bg-[var(--bg-secondary)] border border-btn-border rounded-2xl py-4 px-5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/30 transition-all text-[15px] min-h-[100px] max-h-[320px] resize-none overflow-y-auto custom-scrollbar placeholder:text-[var(--text-secondary)]/30 shadow-inner"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons Anchor */}
          <div ref={actionButtonsAnchorRef} className="relative h-0" aria-hidden="true" />

          {/* Floating / Collapsible Action Buttons */}
          <AnimatePresence initial={false} mode="wait">
            {shouldShowActionButtons && (
              <Portal>
                {isActionButtonsCollapsed ? (
                  <motion.button
                    key="action-buttons-collapsed-toggle"
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={smoothActionPanelTransition}
                    drag={isActionDragMobile ? "x" : false}
                    dragConstraints={isActionDragMobile ? { left: 0, right: 92 } : undefined}
                    dragElastic={0.12}
                    onDragEnd={(_, info) => {
                      if (!isActionDragMobile) return;
                      if (info.offset.x > 34 || info.velocity.x > 360) {
                        setIsActionButtonsCollapsed(false);
                      }
                    }}
                    onClick={() => setIsActionButtonsCollapsed(false)}
                    onMouseEnter={() => {}}
                    onMouseLeave={() => {}}
                    aria-label="생성 버튼 펼치기"
                    className="group fixed left-[-20px] md:left-[24px] 2xl:left-[calc((100vw-1320px)/2-132px)] bottom-5 md:bottom-8 z-[120] h-[54px] md:h-16 w-[60px] md:w-14 overflow-hidden rounded-[19px] border border-black/20 bg-[#DFA05D] text-[#171717] shadow-[0_8px_18px_rgba(0,0,0,0.34)] flex items-center justify-end pr-3 md:justify-center md:pr-0 opacity-100 touch-pan-y cursor-grab active:cursor-grabbing transition-colors duration-150 hover:brightness-[1.06]"
                  >
                                        <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10">
                      <ArrowRight className="h-5 w-5 translate-x-0.5 text-white transition-transform group-hover:translate-x-1" />
                    </span>
                    <span className="pointer-events-none absolute right-2 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-white/35" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="action-buttons-expanded-bar"
                    initial={floatingActionBarVariants.initial}
                    animate={floatingActionBarVariants.animate}
                    exit={floatingActionBarVariants.exit}
                    transition={smoothActionPanelTransition}
                    className="fixed bottom-5 md:bottom-7 left-0 w-full z-[120] flex justify-center pointer-events-none px-5 md:px-8 will-change-transform"
                  >
                    <div className="relative w-full max-w-4xl pointer-events-auto">
                      {generationModelNotice && (
                        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] z-[140] whitespace-nowrap rounded-full border border-brand-orange/30 bg-[var(--card-bg)]/95 px-3 py-1.5 text-xs font-bold text-brand-orange shadow-lg shadow-brand-orange/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-200">
                          {generationModelNotice}
                        </div>
                      )}
                      <motion.div
                        drag={isActionDragMobile ? "x" : false}
                        dragConstraints={isActionDragMobile ? { left: 0, right: 0 } : undefined}
                        dragElastic={0.16}
                        onDragEnd={(_, info) => {
                          if (!isActionDragMobile) return;
                          if (info.offset.x < -70 || info.velocity.x < -520) {
                            setIsActionButtonsCollapsed(true);
                          }
                        }}
                        style={{ transformOrigin: 'center bottom' }}
                        className="flex flex-row items-stretch gap-2 md:gap-3 rounded-[24px] border border-white/12 bg-[#202020]/98 backdrop-blur-xl p-2 md:p-2.5 shadow-[0_18px_52px_rgba(0,0,0,0.52),0_7px_18px_rgba(0,0,0,0.34),0_0_0_1px_rgba(255,255,255,0.045)] opacity-100 overflow-hidden"
                      >
                        <motion.button
                                type="button"
                          onClick={() => setIsActionButtonsCollapsed(true)}
                          onMouseEnter={() => {}}
                          onMouseLeave={() => {}}
                          className="hidden md:flex self-stretch w-12 shrink-0 rounded-l-[18px] rounded-r-xl bg-white/[0.025] border-0 border-r border-white/10 text-[#DFA05D] hover:bg-white/[0.045] hover:text-[#DFA05D] transition-all shadow-none items-center justify-center opacity-100"
                          aria-label="생성 버튼 접기"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </motion.button>
                        {actionButtonsContent}
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </Portal>
            )}
          </AnimatePresence>

          {/* Applied Keywords Display */}
          <div className="relative mt-2 md:mt-3">
            <div className="flex flex-wrap gap-2 justify-center min-h-[24px] md:min-h-[26px] content-start">
              {[
                ...displayGenreKeywords,
                ...selectedThemes.map((id) => ({ id, type: 'theme' as const, label: getThemeKeywordLabel(id) })),
                ...selectedMoods.map((id) => ({ id, type: 'mood' as const, label: getMoodKeywordLabel(id) })),
                ...filterSelectableIds(selectedStyles).map((id) => ({ id, type: 'style' as const, label: getStyleVariantLabelById(id) })).filter((item) => item.label),
                ...filterSelectableIds(selectedInstrumentSounds).map((id) => ({ id, type: 'sound' as const, label: getSoundVariantLabelById(id) })).filter((item) => item.label),
                ...filterSelectableIds(selectedPointSounds).map((id) => ({ id: `point-${id}`, type: 'point-sound' as const, label: `#포인트: ${getSoundVariantLabelById(id)}` })).filter((item) => item.label !== '#포인트: '),
                ...(isKoreanEnglishMix ? [{ id: 'mix', type: 'mix' as const, label: '#한/영 혼합' }] : []),
                ...(rapEnabled ? [{ id: 'rap', type: 'rap' as const, label: '#랩 ON' }] : []),
              ].map((item) => {
                  const chipClassName = cn(
                    'px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-sm',
                    item.type === 'mix' || item.type === 'rap' || item.type === 'vocal-tone'
                      ? 'bg-brand-orange/10 border-brand-orange/20 text-brand-orange'
                      : getAppliedKeywordChipClass(item.type)
                  );
                  return (
                    <span
                      key={`${item.type}-${item.id}`}
                      className={chipClassName}
                    >
                      {item.label}
                      <button 
                        onClick={() => {
                          if (item.type === 'genre') toggleSelection(item.id, 'genre');
                          else if (item.type === 'theme') toggleSelection(item.id, 'theme');
                          else if (item.type === 'mood') toggleSelection(item.id, 'mood');
                          else if (item.type === 'style') setSelectedStyles((prev) => prev.filter((value) => value !== item.id));
                          else if (item.type === 'sound') setSelectedInstrumentSounds((prev) => prev.filter((value) => value !== item.id));
                          else if (item.type === 'mix') { setIsKoreanEnglishMix(false); setEnglishMixRatio(10); }
                          else if (item.type === 'rap') setRapEnabled(false);
                              }}
                        className="hover:bg-btn-hover rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-[18px] h-[18px]" />
                      </button>
                    </span>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Result Area */}
        <AnimatePresence>
          {user && result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-4 md:pt-5 border-t-2 border-[#cd8c31]/30 shadow-[0_-1px_0_rgba(205,140,49,0.16)]"
            >


              {/* Title Card */}
              <div className="bg-[var(--card-bg)] rounded-3xl p-8 border border-[#cd8c31]/[0.18] shadow-[0_18px_50px_rgba(0,0,0,0.32)] relative overflow-hidden group hover:border-[#cd8c31]/[0.18] transition-all duration-500">
          <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
                    <button
                      onClick={() => navigate('/history')}
                      onMouseEnter={() =>
                        setHoveredItem({
                          id: 'go-history',
                          label: '보관함으로 이동',
                          description: '보관함 페이지로 이동합니다.',
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-[var(--hover-bg)] hover:bg-[#cd8c31]/10 text-[#cd8c31] border border-[#cd8c31]/25 hover:border-[#cd8c31]/35 transition-all active:scale-95 shadow-sm"
                    >
                      <HeartIcon className="w-5 h-5" />
                      <span className="text-xs md:text-sm font-bold whitespace-nowrap">보관함</span>
                    </button>
                  </div>
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 scale-90 sm:scale-100 origin-top-right items-end">
                    {(() => {
                      const CopyBtn = ({ text, type, label, description }: { text: string, type: string, label: string, description: string }) => (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(text, type);
                          }}
                          onMouseEnter={() =>
                            setHoveredItem({
                              id: `copy-${type}`,
                              label: `${label} 제목 복사`,
                              description: description,
                            })
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                          className="inline-flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/15 text-[var(--text-primary)] transition-all shrink-0 active:scale-95 border border-white/10 shadow-sm"
                          title={`${label} 복사`}
                        >
                          {copiedType === type ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
                          <span className="text-[10px] font-bold opacity-80">{label}</span>
                        </button>
                      );

                      return (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = formatUnifiedTitle(result);
                              copyToClipboard(text, 'title');
                            }}
                            onMouseEnter={() =>
                              setHoveredItem({
                                id: 'copy-title',
                                label: '전체 제목 복사',
                                description: '장르를 포함한 전체 제목을 복사합니다.',
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-[#cd8c31]/10 hover:bg-[#cd8c31]/[0.18] text-[#cd8c31] transition-all shrink-0 active:scale-95 border border-[#cd8c31]/20 shadow-sm w-full"
                          >
                            {copiedType === 'title' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80" />}
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight">전체복사</span>
                          </button>
                          
                          <div className="flex gap-2">
                            {(() => {
                              const titleLanguages = getDisplayLyricLanguages(result);
                              const normalizedTitleLanguages = titleLanguages.length > 0
                                ? titleLanguages
                                : [
                                    result.koreanTitle ? 'ko' : null,
                                    result.englishTitle ? (((result.appliedKeywords as any)?.secondaryLanguage || 'en') as LanguageCode) : null,
                                  ].filter(Boolean) as LanguageCode[];

                              const uniqueTitleLanguages = normalizedTitleLanguages
                                .filter((lang, index, arr) => arr.indexOf(lang) === index)
                                .slice(0, 2);

                              return uniqueTitleLanguages.map((lang) => {
                                const titleText = formatTitleLineByLanguage(result, lang);
                                if (!titleText) return null;
                                const langLabel = lang.toUpperCase();
                                const langName = lyricLanguageLabels[lang]?.ko || langLabel;

                                return (
                                  <CopyBtn
                                    key={lang}
                                    text={titleText}
                                    type={`title-${lang}`}
                                    label={langLabel}
                                    description={`${langName} 제목 한 줄을 복사합니다.`}
                                  />
                                );
                              });
                            })()}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-[#cd8c31] font-mono text-sm tracking-widest uppercase font-bold">
                      <Music className="w-[18px] h-[18px]" />
                      제목 (Title)
                    </div>
                  </div>
                  <div className="h-auto min-h-[60px] flex items-center justify-center w-full px-4 mt-2">
                    <div className="w-full max-w-2xl text-center flex flex-col items-center">
                      {(() => {
                        const lines = getTitleLinesForDisplay(result);
                        const isRecent = isInLatestGenerationBatch(result);
                        const hasAddedLyricsLanguage = Boolean((result.appliedKeywords as any)?.hasAddedLyricsLanguage);
                        const primaryClass = hasAddedLyricsLanguage ? 'text-[#cd8c31]' : (isRecent ? 'text-[#f0c079]' : 'text-[var(--text-primary)]');
                        const secondaryClass = hasAddedLyricsLanguage ? 'text-[#cd8c31]' : (isRecent ? 'text-[#cd8c31]' : 'text-[#cd8c31]/90');

                        if (lines.length >= 2) {
                          return (
                            <div className="relative w-full flex items-center justify-center min-h-[100px] md:min-h-[120px]">
                              <div className="flex flex-col items-center justify-center gap-1.5 px-4 sm:px-10 w-full overflow-hidden">
                                <h2 className={`text-[15px] sm:text-xl md:text-2xl font-bold ${primaryClass} leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full`}>
                                  {lines[0]}
                                </h2>
                                <h2 className={`text-[11px] sm:text-[15px] md:text-[18px] font-bold ${secondaryClass} leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full`}>
                                  {lines[1]}
                                </h2>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="relative w-full flex items-center justify-center min-h-[60px]">
                            <h2 className={`text-[15px] sm:text-xl md:text-2xl font-bold ${primaryClass} leading-tight text-center px-4 sm:px-10 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full`}>
                              {lines[0]}
                            </h2>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {(() => {
                    const generatedAtLabel = formatGeneratedDateTimeLabel((result as any).createdAt || (result as any).updatedAt || (result as any).savedAt);
                    if (!generatedAtLabel) return null;
                    return (
                      <div className="flex justify-center -mt-1 px-4">
                        <p className="text-[11px] sm:text-xs font-semibold text-[var(--text-secondary)]/80 tracking-tight">
                          {generatedAtLabel}
                          {isInLatestGenerationBatch(result) && (
                            <span className="ml-1 text-[#f0c079] font-bold">(최근 생성곡)</span>
                          )}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        if (isConfirmingDeleteHistory) {
                          deleteHistoryItem(historyIndex);
                          setIsConfirmingDeleteHistory(false);
                        } else {
                          setIsConfirmingDeleteHistory(true);
                          setTimeout(() => setIsConfirmingDeleteHistory(false), 3000);
                        }
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border shadow-lg transition-all group/trash flex items-center justify-center min-w-[44px]",
                        isConfirmingDeleteHistory 
                          ? "bg-red-500 text-white border-red-600" 
                          : "bg-[var(--hover-bg)] border-[var(--border-color)] hover:bg-red-500/20"
                      )}
                      title={isConfirmingDeleteHistory ? "정말 삭제하시겠습니까?" : "히스토리에서 삭제"}
                    >
                      {isConfirmingDeleteHistory ? (
                        <span className="text-[10px] font-bold px-1 whitespace-nowrap">삭제 확인</span>
                      ) : (
                        <Trash2 className="w-5 h-5 text-[var(--text-secondary)] group-hover/trash:text-red-500" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateHistory('prev')}
                        disabled={historyIndex >= history.length - 1}
                        className={cn(
                          "px-4 py-3 rounded-xl transition-all border",
                          "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                        )}
                      >
                        <ArrowLeft className="w-[18px] h-[18px]" />
                      </button>
                      <span className="text-sm font-mono font-bold text-[var(--text-secondary)] min-w-[80px] text-center">
                        {historyIndex + 1} / {history.length}
                      </span>
                      <button
                        onClick={() => navigateHistory('next')}
                        disabled={historyIndex <= 0}
                        className={cn(
                          "px-4 py-3 rounded-xl transition-all border",
                          "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                        )}
                      >
                        <ArrowRight className="w-[18px] h-[18px]" />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleFavorite(result)}
                      className="p-2.5 rounded-2xl bg-[var(--hover-bg)] border border-[var(--border-color)] shadow-lg transition-all hover:bg-[var(--hover-bg)]/20 group/heart"
                    >
                      <Heart 
                        className={cn(
                          "w-5 h-5 transition-all",
                          favorites.some(f => f.title === result.title && f.prompt === result.prompt)
                            ? "fill-[#cd8c31] text-[#cd8c31]"
                            : "text-[var(--text-primary)] group-hover/heart:text-[#cd8c31]"
                        )} 
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Applied Keywords After Generation */}
              <div data-expand-section className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[#cd8c31]/[0.16] shadow-[0_14px_36px_rgba(0,0,0,0.26)] relative hover:border-[#cd8c31]/[0.15] transition-all duration-500">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#cd8c31]" />
                    적용된 키워드
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => applyKeywordsToNext(result.appliedKeywords)}
                      onMouseEnter={() => setHoveredItem({ id: 'apply-keywords-all', label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center justify-center gap-1.5 px-3 h-9 min-w-[90px] rounded-xl bg-[#cd8c31]/[0.08] text-[#cd8c31] hover:bg-[#cd8c31]/[0.12] transition-all shadow-sm text-[11px] font-bold border border-[#cd8c31]/[0.18] active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">다음 곡에 적용</span>
                    </button>
                  </div>
                </div>
                
                <motion.div 
                  initial={false}
                  animate={{ 
                    height: isAppliedKeywordsExpanded ? appliedKeywordsHeight : 0,
                    opacity: isAppliedKeywordsExpanded ? 1 : 0
                  }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div ref={appliedKeywordsRef} className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
                    {resolveKeywordsForDisplay(result).map((section) => (
                      <div key={section.key} className="space-y-0.5 group/cat">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">{section.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {section.items.map((item, idx) => (
                            <span 
                              key={idx} 
                              onMouseEnter={() => {
                                if (item.description) {
                                  setHoveredItem({ id: `kw-${section.key}-${idx}`, label: item.label, description: item.description });
                                }
                              }}
                              onMouseLeave={() => setHoveredItem(null)}
                              className={cn(
                                "px-1.5 py-0.5 rounded-md text-[11px] transition-all cursor-help border",
                                getAppliedKeywordChipClass(section.key || section.accent || '', item.isRandom)
                              )}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(result.appliedKeywords.vocalType || (result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone)) && (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">vocal</p>
                        <div className="flex flex-wrap gap-1">
                          {result.appliedKeywords.vocalType && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--border-color)] cursor-help"
                              onMouseEnter={() => setHoveredItem({ id: 'kw-vocal', label: 'Vocal', description: '곡의 보컬 구성을 나타냅니다.' })}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              {result.appliedKeywords.vocalType}
                            </span>
                          )}
                          {result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md text-[11px] bg-[#cd8c31]/10 text-[#cd8c31] border border-[#cd8c31]/20 cursor-help"
                              onMouseEnter={() => setHoveredItem({ id: 'kw-vocal-tone', label: 'Vocal Tone', description: `선택된 보컬톤: ${result.appliedKeywords.vocalTone}` })}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              #보컬톤: {result.appliedKeywords.vocalTone}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {result.appliedKeywords.tempo && (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">tempo</p>
                        <div className="flex flex-wrap gap-1">
                          <span 
                            className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border border-[var(--border-color)] cursor-help"
                            onMouseEnter={() => setHoveredItem({ id: 'kw-tempo', label: 'Tempo', description: '곡의 빠르기를 나타내는 BPM 범위입니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {result.appliedKeywords.tempo}
                          </span>
                        </div>
                      </div>
                    )}
                    {(result.appliedKeywords.songStructure && result.appliedKeywords.songStructure !== 'custom') || (result.appliedKeywords.customStructure && (result.appliedKeywords.customStructure ?? []).length > 0) ? (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">structure</p>
                        <div className="flex flex-wrap gap-1">
                          <span 
                            className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border border-[var(--border-color)] cursor-help"
                            onMouseEnter={() => setHoveredItem({ id: 'kw-structure', label: 'Structure', description: '곡의 전체 구성입니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {result.appliedKeywords.songStructure === 'custom' 
                              ? formatStoredCustomStructureText(result.appliedKeywords.customStructure ?? [])
                              : result.appliedKeywords.songStructure === '1'
                                ? '기본 자유 전개'
                                : result.appliedKeywords.songStructure === '2'
                                  ? 'Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro'
                                  : result.appliedKeywords.songStructure === '3'
                                    ? 'Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro'
                                    : ''
                            }
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>

                {/* Expand Button at Bottom Center */}
                <button
                  data-expanded={isAppliedKeywordsExpanded ? 'true' : 'false'}
                  aria-pressed={isAppliedKeywordsExpanded}
                  onClick={(event) => {
                    setIsAppliedKeywordsExpanded(!isAppliedKeywordsExpanded);
                    keepExpandableSectionInView(event.currentTarget, isAppliedKeywordsExpanded);
                  }}
                  className={cn(
                    "section-expand-button section-expand-button--half-y absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full border flex items-center justify-center transition-all z-20 shadow-xl",
                    isAppliedKeywordsExpanded 
                      ? "bg-[#cd8c31] text-white border-[#cd8c31]" 
                      : "bg-[var(--card-bg)] border-[var(--border-color)] text-[#cd8c31] hover:text-white hover:bg-[#cd8c31]"
                  )}
                >
                  {isAppliedKeywordsExpanded ? <ChevronUp className="w-[18px] h-[18px]" /> : <ChevronDown className="w-[18px] h-[18px]" />}
                </button>
              </div>

              {/* Prompt Section */}
              <div className="bg-[var(--card-bg)] rounded-3xl border border-[#cd8c31]/[0.16] overflow-hidden flex flex-col h-[400px] shadow-[0_14px_36px_rgba(0,0,0,0.26)] hover:border-[#cd8c31]/[0.15] transition-all duration-500">
                <div className="p-5 border-b border-[#cd8c31]/[0.14] flex items-center justify-between bg-[#cd8c31]/[0.045]">
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-[#cd8c31]" />
                    음악 프롬프트
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(normalizePromptForDisplay(result.prompt), 'prompt')}
                      onMouseEnter={() => setHoveredItem({ id: 'copy-prompt', label: '프롬프트 복사', description: '음악 생성 프롬프트를 복사합니다.' })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-[#cd8c31]/[0.08] hover:bg-[#cd8c31]/[0.12] text-[#cd8c31]/85 hover:text-[#f0c079] transition-all border border-[#cd8c31]/[0.16] active:scale-95 shadow-btn"
                    >
                      {copiedType === 'prompt' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                      <span className="hidden md:block text-sm font-bold">복사</span>
                    </button>
                  </div>
                </div>
                <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                  <pre className="whitespace-pre-wrap font-mono text-[var(--text-secondary)] leading-relaxed text-sm w-full">
                    {normalizePromptForDisplay(result.prompt)}
                  </pre>
                </div>
              </div>



              <div className="flex flex-col gap-3">
                {!result.appliedKeywords.isNoLyrics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(() => {
                      const displayLyricLanguages = getDisplayLyricLanguages(result);
                      const missingLyricLanguages = getMissingLyricLanguages(result);

                      const renderAddLyricsLanguageCard = () => missingLyricLanguages.length > 0 ? (
                        <div className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-dashed border-[#cd8c31]/[0.22] overflow-hidden flex flex-col shadow-[0_14px_36px_rgba(0,0,0,0.26)] transition-all duration-500">
                          <div className="p-5 border-b border-[#cd8c31]/[0.14] flex items-center justify-between bg-[#cd8c31]/[0.045]">
                            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                              <Languages className="w-4 h-4 text-[#cd8c31]" />
                              가사 언어 추가
                            </h3>
                          </div>
                          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col justify-center gap-4">
                            <div className="text-center space-y-2">
                              <p className="text-sm font-bold text-[var(--text-primary)]">다른 언어 가사가 필요해?</p>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                현재 곡의 제목과 가사를 기준으로<br />추가 언어 가사를 생성합니다.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {missingLyricLanguages.map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => handleAddLyricsLanguage(lang)}
                                  disabled={isAddingLyricsLanguage}
                                  className="px-3 py-3 rounded-2xl border border-[#cd8c31]/25 bg-[#cd8c31]/10 hover:bg-[#cd8c31] hover:text-white text-[#cd8c31] text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {addingLyricsLanguageTarget === lang ? '생성 중...' : `${lyricLanguageLabels[lang]?.ko || lang} 추가`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-center text-[var(--text-secondary)]">
                              가사 언어는 최대 2개까지 표시됩니다.
                            </p>
                          </div>
                        </div>
                      ) : null;

                      const renderLyricsCard = (lang: LanguageCode) => {
                        const lyricsText = getLyricsByLanguage(result, lang);
                        if (!lyricsText) return null;
                        const label = lyricLanguageLabels[lang]?.ko || lang;
                        const copyType = `lyrics-${lang}`;

                        return (
                          <div key={lang} className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-[#cd8c31]/[0.16] overflow-hidden flex flex-col group/lyrics shadow-[0_14px_36px_rgba(0,0,0,0.26)] hover:border-[#cd8c31]/[0.15] transition-all duration-500">
                            <div className="p-5 border-b border-[#cd8c31]/[0.14] flex items-center justify-between bg-[#cd8c31]/[0.045]">
                              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                                <Music className="w-4 h-4 text-[#cd8c31]" />
                                {label} 가사
                              </h3>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(lyricsText, copyType)}
                                  onMouseEnter={() => setHoveredItem({ id: `copy-${copyType}`, label: `${label} 가사 복사`, description: `${label} 가사 전체를 복사합니다.` })}
                                  onMouseLeave={() => setHoveredItem(null)}
                                  className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-[#cd8c31]/[0.08] hover:bg-[#cd8c31]/[0.12] text-[#cd8c31]/85 hover:text-[#f0c079] transition-all border border-[#cd8c31]/[0.16] active:scale-95 shadow-btn"
                                >
                                  {copiedType === copyType ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                                  <span className="hidden md:block text-sm font-bold">복사</span>
                                </button>
                              </div>
                            </div>
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                              <div className="flex-1" />
                              <pre className="whitespace-pre-wrap font-sans text-[var(--text-secondary)] leading-relaxed text-sm md:text-base w-full text-center">
                                {normalizeLyricsForDisplay(lyricsText)}
                              </pre>
                              <div className="flex-1" />
                            </div>
                          </div>
                        );
                      };

                      const firstCard = displayLyricLanguages[0] ? renderLyricsCard(displayLyricLanguages[0]) : renderAddLyricsLanguageCard();
                      const secondCard = displayLyricLanguages[1] ? renderLyricsCard(displayLyricLanguages[1]) : renderAddLyricsLanguageCard();

                      return (
                        <>
                          {firstCard}
                          {secondCard}
                        </>
                      );
                    })()}
                  </div>
                )}
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[#cd8c31]/[0.16] bg-[#cd8c31]/[0.035]">
                    <button
                      type="button"
                      onClick={() => setIsHomeMusicApiMenuCollapsed((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all hover:bg-[#cd8c31]/[0.06]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#f0c079]">Music API 생성</p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#cd8c31]/55">
                          Suno 음원 생성 메뉴
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-[11px] font-black text-[#cd8c31]/55">
                        <span>{isHomeMusicApiMenuCollapsed ? '펼쳐보기' : '접기'}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", !isHomeMusicApiMenuCollapsed && "rotate-180")} />
                      </div>
                    </button>

                    {!isHomeMusicApiMenuCollapsed && (
                      <div className="flex items-center justify-between gap-2 border-t border-[#cd8c31]/[0.14] p-3">
                        <button
                          onClick={() => navigate('/my-page')}
                          className="flex bg-[#cd8c31]/[0.08] hover:bg-[#cd8c31]/[0.12] py-3 px-4 rounded-xl text-[#cd8c31]/80 hover:text-[#f0c079] transition-all items-center justify-center shrink-0 border border-[#cd8c31]/[0.14]"
                          title="마이페이지에서 API 관리"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button
                          onClick={async () => {
                            setHasSunoApiKey(await fetchSunoApiKeyStatusFromServer(user));
                            setShowMusicApiModal(true);
                          }}
                          disabled={isMusicApiGenerating}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-white font-bold transition-all whitespace-nowrap",
                            isMusicApiGenerating
                              ? "bg-[#cd8c31]/35 cursor-not-allowed"
                              : "bg-[#cd8c31] hover:bg-[#b77925] shadow-lg shadow-[#cd8c31]/[0.18]"
                          )}
                        >
                          {isMusicApiGenerating ? "Music API 요청 중..." : "Music API로 생성"}
                        </button>
                        <button
                          onClick={() => {
                            clearSunoLibrarySignal();
                            navigate('/suno-library');
                          }}
                          className="relative flex bg-[#cd8c31]/[0.08] hover:bg-[#cd8c31]/[0.12] py-3 px-4 rounded-xl text-[#cd8c31]/80 hover:text-[#f0c079] transition-all items-center justify-center shrink-0 border border-[#cd8c31]/[0.14] text-sm font-bold"
                          title="라이브러리로 이동"
                        >
                          {sunoLibrarySignal && (
                            <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black/40 ${sunoLibrarySignalDotClass}`} />
                          )}
                          Library
                        </button>
                      </div>
                    )}
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </main>
          </>
        } />
        <Route
          path="/history"
          element={
            !isAuthReady ? (
              <div className="min-h-screen flex items-center justify-center text-[var(--text-primary)] bg-[var(--bg-primary)]">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
                  <p className="text-sm font-medium text-gray-400">사용자 정보를 불러오는 중...</p>
                </div>
              </div>
            ) : (user || auth.currentUser) ? (
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <FavoritesPageLazy
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  updateFavorite={updateFavorite}
                  clearAllFavorites={clearAllFavorites}
                  unlockAllFavorites={unlockAllFavorites}
                  lockAllFavorites={lockAllFavorites}
                  user={user || auth.currentUser}
                  onHover={setHoveredItem}
                  hoveredItem={hoveredItem}
                  onLongPressStart={handleLongPressStart}
                  onLongPressEnd={handleLongPressEnd}
                />
              </Suspense>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/archive" element={<Navigate to="/history" replace />} />
        <Route path="/library" element={<Navigate to="/history" replace />} />
        
        <Route path="/suno-library" element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>}>
            <SunoLibraryPageLazy appUser={user || auth.currentUser} />
          </Suspense>
        } />
        <Route path="/suno-api-settings" element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>}>
            <SunoApiSettingsPageLazy />
          </Suspense>
        } />
        <Route path="/my-page" element={
          user ? (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 text-sky-300 animate-spin" /></div>}>
              <MyPageLazy />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          )
        } />
        
        {/* Admin Routes */}
        {isAdminUser ? (
          <>
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={
              <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>}>
                <AdminUserManagementPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
            <Route path="/admin/vocals" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <AdminVocalTonesPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
            <Route path="/admin/tags" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <AdminSectionTagsPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
            <Route path="/admin/suno-api" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <AdminSunoApiPageLazy />
              </Suspense>
            } />
          </>
        ) : (
          <>
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/users" element={<Navigate to="/" replace />} />
            <Route path="/admin/vocals" element={<Navigate to="/" replace />} />
            <Route path="/admin/tags" element={<Navigate to="/" replace />} />
            <Route path="/admin/suno-api" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <GlobalPlayer />

      {/* Tooltip / Description Overlay */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, x: '-50%' }}
            animate={{ 
              opacity: isTooltipHovered ? 0.1 : 1, 
              x: '-50%'
            }}
            exit={{ opacity: 0, x: '-50%' }}
            onMouseEnter={() => setIsTooltipHovered(true)}
            onMouseLeave={() => setIsTooltipHovered(false)}
            className={cn(
              "fixed left-1/2 z-[200] px-5 py-3 rounded-2xl bg-[var(--card-bg)]/90 backdrop-blur-xl border border-brand-orange/40 shadow-[0_0_30px_rgba(242,125,38,0.1)] pointer-events-auto cursor-default text-center transition-all duration-300",
              location.pathname === '/studio' 
                ? (!isActionButtonsCollapsed && shouldShowActionButtons
                    ? "bottom-[6.75rem] md:bottom-[8.5rem] max-w-[200px] md:max-w-[400px]" 
                    : "bottom-10 max-w-[200px] md:max-w-[400px]")
                : "bottom-10 max-w-[250px] md:max-w-[400px]"
            )}
          >
            <p className="text-brand-orange font-black text-sm mb-1 tracking-tight">{hoveredItem.label}</p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">{hoveredItem.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 text-center border-t border-[var(--border-color)] text-[var(--text-secondary)]/50 text-sm">
        <p>© 2026 SORIDRAW's Studio. All rights reserved.</p>
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl text-xs font-bold text-[var(--text-primary)] flex items-center gap-2 block whitespace-pre-line text-center"
          >
            <Check className="w-3 h-3 text-brand-orange shrink-0" />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      

      <AnimatePresence>
        {showMainGenerationModal && (
          <MusicApiGenerateModal
            variant="main"
            hasApiKey={true}
            isNoLyrics={hasSelectedInstrumentalBgm}
            maxLyricLanguages={hasSelectedInstrumentalBgm ? 0 : 2}
            isKoreanEnglishMix={isKoreanEnglishMix}
            englishMixRatio={englishMixRatio}
            rapEnabled={rapEnabled}
            onClose={() => setShowMainGenerationModal(false)}
            onConfirm={(_titleLang, includeLyrics, lyricLanguages, generationCount, options) => {
              const nextMix = includeLyrics ? Boolean(options?.isKoreanEnglishMix ?? isKoreanEnglishMix) : false;
              const nextRatio = Math.max(5, Math.min(90, Number(options?.englishMixRatio ?? englishMixRatio) || 10));
              const nextRap = includeLyrics ? Boolean(options?.rapEnabled ?? rapEnabled) : rapEnabled;
              setIsKoreanEnglishMix(nextMix);
              setEnglishMixRatio(nextRatio);
              setRapEnabled(nextRap);
              setShowMainGenerationModal(false);
              handleGenerate({
                includeLyrics: hasSelectedInstrumentalBgm ? false : includeLyrics,
                lyricLanguages: hasSelectedInstrumentalBgm ? [] : lyricLanguages,
                generationCount,
                isKoreanEnglishMix: nextMix,
                englishMixRatio: nextRatio,
                rapEnabled: nextRap,
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMusicApiModal && (
          <MusicApiGenerateModal
            variant="musicApi"
            hasApiKey={hasSunoApiKey}
            remainingCredits={sunoRemainingCredits}
            isNoLyrics={(!result?.lyrics?.korean && !result?.lyrics?.english) || (result?.lyrics?.korean === "" && result?.lyrics?.english === "")}
            availableLyricLanguages={(() => {
              const langs: LanguageCode[] = [];
              const generated = (((result?.appliedKeywords as any)?.lyricLanguages || []) as LanguageCode[]);
              const generatedSecondary = generated.find((lang) => lang !== 'ko');
              if (result?.lyrics?.korean && (generated.length === 0 || generated.includes('ko'))) langs.push('ko');
              if (result?.lyrics?.english) langs.push(generatedSecondary || 'en');
              return Array.from(new Set(langs));
            })()}
            maxLyricLanguages={1}
            musicApiTargets={getMusicApiTargetOptions()}
            onClose={() => setShowMusicApiModal(false)}
            onConfirm={(titleLang, includeLyrics, lyricLanguages, generationCount, options) => {
              setShowMusicApiModal(false);
              generateMusic(titleLang, includeLyrics, lyricLanguages, generationCount, options);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBanModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full mx-4 bg-[var(--card-bg)] border border-red-500/30 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-4">
                계정 이용 제한 안내
              </h2>
              <div className="space-y-4 mb-8">
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  이 계정은 서비스 이용 정책 위반 또는 관리자 결정에 의해 <span className="text-red-500 font-bold underline underline-offset-4">이용이 제한</span>되었습니다.
                </p>
                <p className="text-xs text-[var(--text-secondary)]/60">
                  문의사항이 있으시면 관리자에게 연락해 주시기 바랍니다.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBanModalOpen(false);
                  handleLogout();
                }}
                className="w-full py-4 bg-brand-orange text-white font-black rounded-2xl shadow-xl shadow-brand-orange/20 hover:brightness-110 active:scale-95 transition-all"
              >
                확인 및 로그아웃
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isForcedLogoutModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full mx-4 bg-[var(--card-bg)] border border-brand-orange/30 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-10 h-10 text-brand-orange" />
              </div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-4">
                강제 로그아웃 알림
              </h2>
              <div className="space-y-4 mb-8">
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  관리자에 의해 <span className="text-brand-orange font-bold">강제 로그아웃</span> 처리가 수행되었습니다.<br />
                  세션이 만료되어 자동으로 로그아웃됩니다.
                </p>
                <div className="py-2.5 px-4 bg-brand-orange/10 rounded-2xl inline-block mx-auto border border-brand-orange/20">
                  <p className="text-brand-orange font-bold text-sm">
                    {forcedLogoutCountdown}초 후 자동으로 로그아웃됩니다.
                  </p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]/60">
                  문의사항이 있으시면 고객 센터로 연락해 주시기 바랍니다.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!isForcedLogoutProcessingRef.current) {
                    console.log("[ForceLogout Client] Manual logout button clicked in modal");
                    isForcedLogoutProcessingRef.current = true;
                    setIsForcedLogoutModalOpen(false);
                    await handleLogout();
                    navigate('/');
                  }
                }}
                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                닫기 및 확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GuideModal 
        isOpen={isGuideModalOpen} 
        onClose={() => setIsGuideModalOpen(false)} 
        applyTemplate={applyTemplate} 
      />


      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        :root {
          --home-card-border: rgba(24, 24, 27, 0.14);
          --keyword-button-border: rgba(24, 24, 27, 0.12);
          --modal-soft-border: rgba(24, 24, 27, 0.13);
          --modal-button-border: rgba(24, 24, 27, 0.11);
        }
        .dark {
          --home-card-border: rgba(255, 255, 255, 0.075);
          --keyword-button-border: rgba(255, 255, 255, 0.07);
          --modal-soft-border: rgba(255, 255, 255, 0.075);
          --modal-button-border: rgba(255, 255, 255, 0.07);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 130, 0, 0.3);
        }
        .custom-scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .saved-structure-scroll::-webkit-scrollbar {
          height: 2px;
        }
        .saved-structure-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .saved-structure-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
        }
        .saved-structure-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255,130,0,0.22);
        }
        .saved-structure-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.10) transparent;
        }

        .storyboard-slider {
          appearance: none;
          -webkit-appearance: none;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          outline: none;
        }
        .storyboard-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
        }
        .storyboard-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          margin-top: -8px;
          border-radius: 999px;
          background: rgb(172, 80, 69);
          border: 3px solid rgba(255,255,255,0.86);
          box-shadow: none;
          cursor: grab;
          position: relative;
          z-index: 2;
        }
        .storyboard-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.04);
        }
        .storyboard-slider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
        }
        .storyboard-slider::-moz-range-progress {
          background: transparent;
        }
        .storyboard-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: rgb(172, 80, 69);
          border: 3px solid rgba(255,255,255,0.86);
          box-shadow: none;
          cursor: grab;
        }
        .storyboard-slider--character-b::-webkit-slider-thumb {
          background: rgb(223, 160, 93);
        }
        .storyboard-slider--character-b::-moz-range-thumb {
          background: rgb(223, 160, 93);
        }
        .storyboard-slider-center-marker {
          position: absolute;
          top: 17px;
          left: 50%;
          width: 12px;
          height: 12px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.9);
          background: rgba(10,10,10,0.98);
          pointer-events: none;
          z-index: 1;
        }

        .vocal-character-slider {
          appearance: none;
          -webkit-appearance: none;
          height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,0.20);
          outline: none;
        }
        .vocal-character-slider::-webkit-slider-runnable-track {
          height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,0.20);
        }
        .vocal-character-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          margin-top: -8.5px;
          border-radius: 999px;
          background: rgb(172, 80, 69);
          border: 0;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.20);
          cursor: grab;
          position: relative;
          z-index: 2;
        }
        .vocal-character-slider-female::-webkit-slider-thumb {
          background: rgb(244, 114, 182);
        }
        .vocal-character-slider-male::-webkit-slider-thumb {
          background: rgb(96, 165, 250);
        }
        .vocal-character-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.04);
        }
        .vocal-character-slider::-moz-range-track {
          height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,0.20);
        }
        .vocal-character-slider::-moz-range-progress {
          background: transparent;
        }
        .vocal-character-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: rgb(172, 80, 69);
          border: 0;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.20);
          cursor: grab;
        }
        .vocal-character-slider-female::-moz-range-thumb {
          background: rgb(244, 114, 182);
        }
        .vocal-character-slider-male::-moz-range-thumb {
          background: rgb(96, 165, 250);
        }
        .vocal-character-slider-center-marker {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 14px;
          height: 14px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 0;
          background: rgba(101,135,97,0.34);
          pointer-events: none;
          z-index: 1;
        }
        .vocal-character-dual-track {
          position: relative;
          width: 100%;
          height: 34px;
          border-radius: 999px;
          background: transparent;
          touch-action: none;
        }
        .vocal-character-dual-track::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 7px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: rgba(255,255,255,0.20);
        }
        .vocal-character-dual-handle {
          position: absolute;
          top: 50%;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 0;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.20);
          cursor: grab;
          touch-action: none;
          transition: transform 120ms ease, filter 120ms ease;
        }
        .vocal-character-dual-handle:active {
          cursor: grabbing;
          transform: translate(-50%, -50%) scale(1.04);
        }
        .vocal-character-dual-handle-main {
          z-index: 3;
        }
        .vocal-character-dual-handle-secondary {
          z-index: 2;
          background: rgb(172, 80, 69);
        }
        .vocal-character-dual-handle-female {
          background: rgb(244, 114, 182);
        }
        .vocal-character-dual-handle-male {
          background: rgb(96, 165, 250);
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-right {
          animation: marquee-right 30s linear infinite;
        }

        /* Global soft press feedback for app buttons and button-like links */
        button:not(:disabled),
        a[href],
        [role="button"] {
          transition-property: background-color, border-color, color, box-shadow, opacity, filter, scale, translate, transform;
          transition-duration: 120ms;
          transition-timing-function: ease-out;
          -webkit-tap-highlight-color: transparent;
        }

        button:not(:disabled):active,
        a[href]:active,
        [role="button"]:active {
          scale: 0.965;
          translate: 0 2px;
          filter: brightness(0.94);
        }

        [data-expand-section] {
          overflow-anchor: none;
        }

        .section-expand-button[data-expanded="true"] {
          background: rgba(255, 130, 0, 0.16) !important;
          border-color: rgba(255, 130, 0, 0.38) !important;
          color: rgb(255, 166, 64) !important;
          box-shadow: 0 4px 12px rgba(255, 130, 0, 0.12) !important;
        }

        .section-expand-button[data-expanded="false"] {
          background: var(--card-bg) !important;
          color: rgb(255, 130, 0) !important;
        }

        @media (hover: hover) and (pointer: fine) {
          .section-expand-button[data-expanded="false"]:hover {
            background: rgb(255, 130, 0) !important;
            border-color: rgb(255, 130, 0) !important;
            color: #fff !important;
          }
        }

        @media (hover: none), (pointer: coarse) {
          .section-expand-button[data-expanded="false"]:hover {
            background: var(--card-bg) !important;
            color: rgb(255, 130, 0) !important;
          }
          .section-expand-button[data-expanded="true"]:hover {
            background: rgba(255, 130, 0, 0.2) !important;
            border-color: rgba(255, 130, 0, 0.46) !important;
            color: rgb(255, 182, 82) !important;
          }
        }

        .section-expand-button:not(:disabled):active {
          scale: 1;
          translate: 0 0;
          transform: translateX(-50%) translateY(2px) scale(0.965);
          filter: brightness(0.94);
        }

        .section-expand-button--half-y:not(:disabled):active {
          transform: translateX(-50%) translateY(calc(50% + 2px)) scale(0.965);
        }

        button:disabled {
          scale: 1;
          translate: 0 0;
        }
      `}</style>
    </div>
  );
}

function GuideModal({ isOpen, onClose, applyTemplate }: { isOpen: boolean; onClose: () => void; applyTemplate: (template: PromptTemplate) => void }) {

  if (!isOpen) return null;

  const guides = [
    {
      id: 'idol-dance',
      title: '아이돌 댄스곡 만들기',
      youtubeUrl: 'https://youtu.be/MuXLbouYeIM?si=wm2vQZCgdxb16Gzv',
      templateId: 'kpop-fresh'
    },
    {
      id: 'emotional-indie',
      title: '감성 인디곡 만들기',
      youtubeUrl: 'https://youtu.be/izyFzAfgjlg?si=Fna5bgfonYfaYBD7',
      templateId: 'indie-folk-warm'
    },
    {
      id: 'hiphop-beat',
      title: '힙합 비트 만들기',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      templateId: 'hiphop-dark'
    }
  ];

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[var(--card-bg)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <YoutubeIcon className="w-6 h-6 text-red-500" />
                가이드 템플릿
              </h2>
              <button onClick={() => closeTagModal()} className="p-2 hover:bg-btn-hover rounded-full transition-colors">
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-3">
              {guides.map((guide) => (
                <div key={guide.id} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      window.open(guide.youtubeUrl, '_blank');
                    }}
                    className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-btn-bg border border-btn-border hover:bg-btn-hover hover:border-[#3F7E75]/30 transition-all group text-left shadow-btn"
                  >
                    <span className="font-bold text-[var(--text-primary)] group-hover:text-brand-orange transition-colors">
                      {guide.title}
                    </span>
                    <ExternalLink className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                  <button
                    onClick={() => {
                      const template = PROMPT_TEMPLATES.find(t => t.id === guide.templateId);
                      if (template) {
                        applyTemplate(template);
                        onClose();
                      }
                    }}
                    className="p-4 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-all group/zap"
                    title="템플릿 적용"
                  >
                    <Zap className="w-5 h-5 group-hover/zap:scale-110 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}


interface GenreCategorySectionProps {
  title: string;
  description: string;
  groups: typeof GENRE_GROUPS;
  selectedGenreId: string | null;
  isRandomized: boolean;
  onOpenGroup: (groupId: string) => void;
  onClear: () => void;
  onRandom: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function GenreCategorySection({
  title,
  description,
  groups,
  selectedGenreId,
  isRandomized,
  onOpenGroup,
  onClear,
  onRandom,
  isLocked = false,
  onToggleLock,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  isExpanded = false,
  onToggleExpand,
}: GenreCategorySectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(120);

  useStableContentHeight(contentRef, setContentHeight, [groups]);

  const selectedChild = groups.flatMap((group) => group.children).find((item) => item.id === selectedGenreId) ?? null;
  const selectedGroup = groups.find((group) => group.children.some((item) => item.id === selectedGenreId)) ?? null;
  const sectionAccent = getStudioSectionAccent('genre');
  const isExpandSummaryActive = isExpanded;

  return (
    <div data-expand-section className="soridraw-expand-card bg-[var(--card-bg)] rounded-[28px] p-7 flex flex-col h-full relative group shadow-[var(--shadow-md)]">
      {onToggleExpand && (
        <button
          data-expanded={isExpanded ? 'true' : 'false'}
          aria-pressed={isExpanded}
          onClick={(event) => handleExpandableToggle(event, isExpanded, onToggleExpand)}
          className={cn(
            "section-expand-button absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full border transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center",
            isExpanded
              ? "bg-[#4a2a0e] text-amber-300 border-amber-500/40"
              : "bg-[var(--card-bg)] border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
          )}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <h3
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
            >
              <span className={cn("w-1.5 h-6 rounded-full", sectionAccent.bar)} />
              {title}
              <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2">({selectedChild ? '1' : '0'}/1)</span>
            </h3>
            <AnimatePresence>
              {showTitleTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={cn("absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border shadow-[var(--shadow-md)] w-56 pointer-events-none", sectionAccent.selectedBorder)}
                >
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{description}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRandom}
            onMouseEnter={() => onHover({ id: 'genre-random', label: 'Random', labelKo: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-random', label: 'Random', labelKo: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              isRandomized
                ? sectionAccent.selected
                : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/20"
            )}
          >
            <Dices className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'genre-clear', label: 'Reset', labelKo: '초기화', description: '선택한 장르를 초기화합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-clear', label: 'Reset', labelKo: '초기화', description: '선택한 장르를 초기화합니다.' })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-3 rounded-xl transition-all border shadow-btn",
              (!!selectedChild || isRandomized)
                ? "bg-white/5 border-red-500/40 text-red-400 hover:bg-red-500/20"
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
            )}
          >
            <RotateCcw className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? resolveExpandedHeight(undefined, contentHeight, 120) : 120,
          opacity: 1
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="grid grid-cols-2 gap-2">
          {groups.map((group) => {
            const isSelectedGroup = selectedGroup?.id === group.id;
            return (
              <button
                key={group.id}
                onClick={() => onOpenGroup(group.id)}
                onMouseEnter={() => onHover({ 
                  id: group.id, 
                  label: group.label, 
                  labelKo: group.labelKo,
                  description: group.descriptionKo || group.description 
                })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ 
                  id: group.id, 
                  label: group.label, 
                  labelKo: group.labelKo,
                  description: group.descriptionKo || group.description 
                })}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all border text-left min-h-[44px]",
                  isSelectedGroup
                    ? sectionAccent.selected
                    : "bg-btn-bg border-[var(--keyword-button-border)] text-[var(--text-primary)] hover:bg-btn-hover"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{group.labelKo || group.label}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </div>
                {isSelectedGroup && selectedChild && (
                  <div className="mt-1 text-[11px] text-[#171717]/75 font-black">
                    {selectedChild.labelKo || selectedChild.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      <div
        data-expanded={isExpanded ? 'true' : 'false'}
        role={onToggleExpand ? 'button' : undefined}
        tabIndex={onToggleExpand ? 0 : undefined}
        aria-pressed={onToggleExpand ? isExpanded : undefined}
        onClick={(event) => onToggleExpand && handleExpandableToggle(event, isExpanded, onToggleExpand)}
        onKeyDown={(event) => {
          if (!onToggleExpand) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleExpand();
            keepExpandableSectionInView(event.currentTarget, isExpanded);
          }
        }}
        className={cn(
        "soridraw-expand-summary mt-4 min-h-[44px] rounded-2xl border border-dashed px-4 py-3 flex items-center justify-center text-center transition-all",
        isExpandSummaryActive
          ? cn(sectionAccent.summaryActive, "border-dashed")
          : cn("border-dashed", sectionAccent.summaryRest),
        onToggleExpand && !isExpandSummaryActive && cn("cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15", sectionAccent.summaryHover),
        onToggleExpand && isExpandSummaryActive && "cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15"
      )}
        style={{
          '--soridraw-summary-border': sectionAccent.summaryBorder,
          '--soridraw-summary-border-hover': sectionAccent.summaryBorderHover,
          '--soridraw-summary-bg-active': sectionAccent.summaryActiveBg,
        } as React.CSSProperties}
      >
        {selectedChild ? (
          <p className={cn("text-[15px] font-black soridraw-selected-summary", sectionAccent.text)}>
            {(selectedGroup?.labelKo || selectedGroup?.label)} / {(selectedChild.labelKo || selectedChild.label)}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            대분류를 누른 뒤 팝업에서 세부 장르 1개를 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function GenreSelectModal({
  group,
  selectedGenreId,
  onClose,
  onSelect,
}: {
  group: (typeof GENRE_GROUPS)[number] | null;
  selectedGenreId: string | null;
  onClose: () => void;
  onSelect: (genreId: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    
    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [onClose]);

  if (!group) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{group.labelKo || group.label}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{group.descriptionKo || group.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div 
          className="p-4 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar overscroll-behavior-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {group.children.map((item) => {
            const isSelected = selectedGenreId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full text-left rounded-2xl border px-4 py-2 transition-all",
                  isSelected
                    ? "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">{item.labelKo || item.label}</div>
                    <div className={cn("text-xs mt-1", isSelected ? "text-[#171717]/75 font-bold" : "text-[var(--text-secondary)]")}>
                      {item.descriptionKo || item.description}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// SORIDRAW_SOUND_INSTRUMENT_SEPARATORS_V19: CycleKeywordPopup separator row support
const EMPTY_KEYWORD_ID_LIST: string[] = [];
interface CycleSectionProps {
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  cycles: readonly { 
    id: string; 
    title: string; 
    titleKo?: string;
    variants: readonly { 
      id: string; 
      kind?: 'separator';
      label: string; 
      labelKo?: string;
      description: string;
      descriptionKo?: string;
      promptCore?: string;
      applyPools?: string[][];
    }[] 
  }[];
  selected: string[];
  pointSelected?: string[];
  isPointSelectionMode?: boolean;
  extraHeaderControls?: React.ReactNode;
  pointModeControl?: {
    enabled: boolean;
    onToggle: () => void;
  };
  onCycleToggle: (cycleId: string, variantId?: string) => void;
  onOtherModeVariantToggle?: (variantId: string) => void;
  onClear: () => void;
  onRandom: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  titleClassName?: string;
  isRandomized?: boolean;
  highlightedVariantIds?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onHeightChange?: (height: number) => void;
  forcedHeight?: number;
  onModalStateChange?: (isOpen: boolean) => void;
}

function CycleSection({ 
  title, 
  titleKo,
  description, 
  descriptionKo,
  cycles, 
  selected,
  pointSelected = EMPTY_KEYWORD_ID_LIST,
  isPointSelectionMode = false,
  extraHeaderControls,
  pointModeControl,
  onCycleToggle, 
  onOtherModeVariantToggle,
  onClear, 
  onRandom,
  isLocked = false,
  onToggleLock,
  onHover, 
  onLongPressStart, 
  onLongPressEnd, 
  titleClassName, 
  isRandomized,
  highlightedVariantIds = [],
  isExpanded = false,
  onToggleExpand,
  onHeightChange,
  forcedHeight,
  onModalStateChange
}: CycleSectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(64);

  useStableContentHeight(contentRef, setContentHeight, [cycles, selected, pointSelected, isPointSelectionMode], onHeightChange);

  const [keywordPopupCycleId, setKeywordPopupCycleId] = useState<string | null>(null);

  useEffect(() => {
    onModalStateChange?.(keywordPopupCycleId !== null);
  }, [keywordPopupCycleId, onModalStateChange]);

  useEffect(() => {
    const handleCloseStudioModals = () => {
      setKeywordPopupCycleId(null);
    };
    window.addEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
    return () => window.removeEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
  }, []);

  const activeSelected = isPointSelectionMode ? pointSelected : selected;
  const otherSelected = isPointSelectionMode ? selected : pointSelected;
  const selectedDisplayItems = useMemo(() => {
    const allVariants = cycles.flatMap((cycle) => cycle.variants).filter((variant) => variant.kind !== 'separator');
    const variantMap = new Map(allVariants.map((variant) => [variant.id, variant]));
    return [
      ...selected.map((id) => ({ id, mode: 'normal' as const, label: variantMap.get(id)?.labelKo || variantMap.get(id)?.label || '' })),
      ...pointSelected.map((id) => ({ id, mode: 'point' as const, label: variantMap.get(id)?.labelKo || variantMap.get(id)?.label || '' })),
    ].filter((item) => item.label);
  }, [cycles, selected, pointSelected]);
  const selectedDisplayTextLength = selectedDisplayItems.reduce((sum, item) => sum + item.label.length + (item.mode === 'point' ? 5 : 2), 0);
  const selectedDisplayTextClass = selectedDisplayTextLength > 120
    ? 'text-[8.5px] leading-[1.05]'
    : selectedDisplayTextLength > 92
      ? 'text-[9.5px] leading-[1.08]'
      : selectedDisplayTextLength > 68
        ? 'text-[10.5px] leading-[1.12]'
        : selectedDisplayTextLength > 44
          ? 'text-[11.5px] leading-[1.15]'
          : 'text-sm leading-tight';
  const selectedKeywordCount = selected.length + pointSelected.length;
  const totalKeywordCount = cycles.reduce((sum, cycle) => sum + cycle.variants.filter((variant) => variant.kind !== 'separator').length, 0);
  const maxSelectableCount = Number.POSITIVE_INFINITY;
  const countLabel = isPointSelectionMode
    ? `${selectedKeywordCount}/${totalKeywordCount} · P${pointSelected.length}`
    : `${selectedKeywordCount}/${totalKeywordCount}`;
  const activePopupCycle = cycles.find((cycle) => cycle.id === keywordPopupCycleId) ?? null;
  const highlightedVariantIdSet = useMemo(() => new Set(highlightedVariantIds), [highlightedVariantIds]);
  const sectionAccent = getStudioSectionAccent(titleKo || title);
  const isExpandSummaryActive = isExpanded;

  return (
    <div data-expand-section className="soridraw-expand-card bg-[var(--card-bg)] rounded-[28px] p-7 flex flex-col justify-between h-auto relative group shadow-[var(--shadow-md)]">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className={cn("font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-help min-w-0", titleClassName ?? "text-[22px]")}
              >
                <span className={cn("w-1.5 h-6 rounded-full shrink-0", sectionAccent.bar)} />
                <span className="truncate">{titleKo || title}</span>
                {countLabel && (
                  <span className="text-[15px] font-normal text-[var(--text-secondary)] ml-1.5 shrink-0">({countLabel})</span>
                )}
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-56 pointer-events-none"
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{descriptionKo || description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {extraHeaderControls}
            {onToggleLock && (
              <button
                type="button"
                onClick={onToggleLock}
                onMouseEnter={() => onHover({ id: `cycle-lock-${title}`, label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? `${titleKo || title} 메뉴를 랜덤 선택에 다시 포함합니다.` : `현재 ${titleKo || title} 설정을 유지하고 랜덤 선택에서 제외합니다.` })}
                onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                onTouchStart={() => onLongPressStart({ id: `cycle-lock-${title}`, label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? `${titleKo || title} 메뉴를 랜덤 선택에 다시 포함합니다.` : `현재 ${titleKo || title} 설정을 유지하고 랜덤 선택에서 제외합니다.` })}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "p-3 rounded-xl transition-all shadow-btn border border-btn-border",
                  isLocked
                    ? sectionAccent.selected
                    : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
                title={isLocked ? '잠금 해제' : '메뉴 잠금'}
                aria-label={`${titleKo || title} ${isLocked ? '잠금 해제' : '잠금'}`}
              >
                {isLocked ? <Lock className="w-[18px] h-[18px]" /> : <Unlock className="w-[18px] h-[18px]" />}
              </button>
            )}
            <button onClick={onRandom} className={cn("p-3 rounded-xl transition-all shadow-btn border border-btn-border", isRandomized ? sectionAccent.selected : 'bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover')}>
              <Dices className="w-[18px] h-[18px]" />
            </button>
            <button 
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'cycle-clear', label: 'Reset', labelKo: '초기화', description: `${title} 설정을 초기화합니다.` })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-3 rounded-xl transition-all border shadow-btn",
                (activeSelected.length > 0 || isRandomized)
                  ? sectionAccent.selectedSoft 
                  : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{
            height: isExpanded ? resolveExpandedHeight(forcedHeight, contentHeight, 76) : 76,
            opacity: 1
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="soridraw-expand-content overflow-hidden min-h-[76px]"
        >
          <div ref={contentRef} className="grid grid-cols-2 gap-2.5 md:gap-3">
            {cycles.map((cycle) => {
              const selectedVariants = cycle.variants.filter((variant) => variant.kind !== 'separator' && selected.includes(variant.id));
              const pointSelectedVariants = cycle.variants.filter((variant) => variant.kind !== 'separator' && pointSelected.includes(variant.id));
              const activeModeVariants = isPointSelectionMode ? pointSelectedVariants : selectedVariants;
              const activeVariant = activeModeVariants[0] ?? selectedVariants[0] ?? pointSelectedVariants[0] ?? null;
              const selectedCountInCycle = selectedVariants.length;
              const pointSelectedCountInCycle = pointSelectedVariants.length;
              const hasHighlightedSelectedVariant = selectedVariants.some((variant) => highlightedVariantIdSet.has(variant.id));

              const baseVariant = cycle.variants.find((variant) => variant.kind !== 'separator') ?? cycle.variants[0];
              const hoverItem: CategoryItem = activeVariant
                ? {
                    id: cycle.id,
                    label: activeVariant.label,
                    labelKo: activeVariant.labelKo,
                    description: activeVariant.descriptionKo ?? activeVariant.description,
                  }
                : {
                    id: cycle.id,
                    label: cycle.title,
                    labelKo: cycle.titleKo,
                    description: baseVariant.descriptionKo ?? baseVariant.description,
                  };
              const folderLabel = cycle.titleKo ?? cycle.title;
              return (
                <button
                  key={cycle.id}
                  onClick={() => {
                    onModalStateChange?.(true);
                    setKeywordPopupCycleId(cycle.id);
                  }}
                  onMouseEnter={() => onHover(hoverItem)}
                  onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                  onTouchStart={() => onLongPressStart(hoverItem)}
                  onTouchEnd={onLongPressEnd}
                  className={cn(
                    "min-h-[58px] rounded-2xl border px-4 py-2.5 text-center transition-all flex items-center justify-center relative shadow-btn overflow-visible",
                    selectedVariants.length > 0
                      ? hasHighlightedSelectedVariant
                        ? "bg-sky-500/32 text-[#111111] border-sky-300/35 font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                        : sectionAccent.selected
                      : pointSelectedVariants.length > 0
                        ? sectionAccent.pointSelected
                        : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                  )}
                >
                  <span className="text-[14px] md:text-[15px] font-bold leading-tight w-full px-2 text-center whitespace-normal break-keep [text-wrap:balance]">
                    {folderLabel}
                  </span>
                  {selectedCountInCycle > 0 && (
                    <span
                      className={cn(
                        "soridraw-count-badge-main absolute top-1.5 right-1.5 z-30 min-w-[20px] h-[20px] px-1 rounded-full border shadow-[0_2px_8px_rgba(0,0,0,0.22)] flex items-center justify-center text-[10.5px] font-black leading-none pointer-events-none",
                        hasHighlightedSelectedVariant
                          ? "bg-[#050505]/92 border-black/55"
                          : sectionAccent.badge
                      )}
                      style={{ '--soridraw-badge-accent': hasHighlightedSelectedVariant ? '#38BDF8' : sectionAccent.badgeAccent } as React.CSSProperties}
                    >
                      {selectedCountInCycle}
                    </span>
                  )}
                  {pointSelectedCountInCycle > 0 && (
                    <span className={cn("soridraw-count-badge-point absolute top-1.5 left-1.5 z-30 min-w-[20px] h-[20px] px-1 rounded-full border shadow-[0_2px_8px_rgba(0,0,0,0.22)] flex items-center justify-center text-[10.5px] font-black leading-none pointer-events-none", sectionAccent.pointBadge)}>
                      {pointSelectedCountInCycle}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div 
        data-expanded={isExpanded ? 'true' : 'false'}
        role={onToggleExpand ? 'button' : undefined}
        tabIndex={onToggleExpand ? 0 : undefined}
        aria-pressed={onToggleExpand ? isExpanded : undefined}
        onClick={(event) => onToggleExpand && handleExpandableToggle(event, isExpanded, onToggleExpand)}
        onKeyDown={(event) => {
          if (!onToggleExpand) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleExpand();
            keepExpandableSectionInView(event.currentTarget, isExpanded);
          }
        }}
        className={cn(
          "soridraw-expand-summary mt-5 h-[64px] rounded-2xl border border-dashed px-4 py-3 flex items-center justify-center text-center overflow-hidden transition-all",
          isExpandSummaryActive
            ? cn(sectionAccent.summaryActive, "border-dashed")
            : cn("border-dashed", sectionAccent.summaryRest),
          onToggleExpand && !isExpandSummaryActive && cn("cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15", sectionAccent.summaryHover),
          onToggleExpand && isExpandSummaryActive && "cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15"
        )}
        style={{
          '--soridraw-summary-border': sectionAccent.summaryBorder,
          '--soridraw-summary-border-hover': sectionAccent.summaryBorderHover,
          '--soridraw-summary-bg-active': sectionAccent.summaryActiveBg,
        } as React.CSSProperties}
        title={onToggleExpand ? (isExpanded ? '접기' : '펼치기') : undefined}
      >
        {selectedDisplayItems.length > 0 ? (
          <div className={cn("w-full max-h-[42px] overflow-hidden font-black soridraw-selected-summary break-keep flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5", selectedDisplayTextClass)}>
            {selectedDisplayItems.map((item, index) => (
              <span key={`${item.mode}-${item.id}`} className={cn("soridraw-selected-summary", sectionAccent.text)}>
                {item.mode === 'point' ? '포인트: ' : ''}{item.label}{index < selectedDisplayItems.length - 1 ? ',' : ''}
              </span>
            ))}
          </div>
        ) : (
          <p className={cn("text-[15px] font-medium leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis", isPointSelectionMode ? "text-[#C995AC]/45" : sectionAccent.softText)}>
            {isPointSelectionMode ? '포인트 사운드를 선택하세요.' : `${titleKo || title} 키워드를 선택하세요.`}
          </p>
        )}
      </div>


      <AnimatePresence>
        {activePopupCycle && (
          <CycleKeywordPopup
            title={titleKo || title}
            cycle={activePopupCycle}
            selected={selected}
            otherSelected={pointSelected}
            highlightedVariantIds={highlightedVariantIds}
            isPointSelectionMode={false}
            maxSelectableCount={maxSelectableCount}
            onClose={() => setKeywordPopupCycleId(null)}
            onToggleVariant={(variantId) => onCycleToggle(activePopupCycle.id, variantId)}
            onToggleOtherVariant={onOtherModeVariantToggle}
            onHover={onHover}
          />
        )}
      </AnimatePresence>

    </div>
  );
}


function CycleKeywordPopup({
  title,
  cycle,
  selected,
  otherSelected = EMPTY_KEYWORD_ID_LIST,
  highlightedVariantIds = [],
  isPointSelectionMode = false,
  pointModeControl,
  maxSelectableCount,
  onClose,
  onToggleVariant,
  onToggleOtherVariant,
  onHover,
}: {
  title: string;
  cycle: {
    id: string;
    title: string;
    titleKo?: string;
    variants: readonly {
      id: string;
      kind?: 'separator';
      label: string;
      labelKo?: string;
      description: string;
      descriptionKo?: string;
      promptCore?: string;
      applyPools?: string[][];
    }[];
  };
  selected: string[];
  otherSelected?: string[];
  highlightedVariantIds?: string[];
  isPointSelectionMode?: boolean;
  pointModeControl?: {
    enabled: boolean;
    onToggle: () => void;
  };
  maxSelectableCount: number;
  onClose: () => void;
  onToggleVariant: (variantId: string) => void;
  onToggleOtherVariant?: (variantId: string) => void;
  onHover: (item: CategoryItem | null) => void;
}) {
  const closeFromHistoryRef = useRef(false);
  const cycleVariantIds = useMemo(() => cycle.variants.filter((variant) => variant.kind !== 'separator').map((variant) => variant.id), [cycle.variants]);
  const initialSelectedRef = useRef<string[]>(selected.filter((id) => cycleVariantIds.includes(id)));
  const initialOtherSelectedRef = useRef<string[]>(otherSelected.filter((id) => cycleVariantIds.includes(id)));
  const [localSelected, setLocalSelected] = useState<string[]>(initialSelectedRef.current);
  const [localOtherSelected, setLocalOtherSelected] = useState<string[]>(initialOtherSelectedRef.current);

  const normalizeIds = useCallback((ids: string[]) => [...ids].sort().join('|'), []);
  const hasChanges = normalizeIds(localSelected) !== normalizeIds(initialSelectedRef.current) || normalizeIds(localOtherSelected) !== normalizeIds(initialOtherSelectedRef.current);
  const highlightedVariantIdSet = useMemo(() => new Set(highlightedVariantIds), [highlightedVariantIds]);
  const sectionAccent = getStudioSectionAccent(title);
  const cyclePopupBackdropPointerDownRef = useRef(false);
  const isClosingRef = useRef(false);
  const [isBackdropBlurReady, setIsBackdropBlurReady] = useState(false);
  const popCycleKeywordHistoryEntry = useCallback(() => {
    if (!window.history.state?.cycleKeywordPopup) return;

    const suppressNextPopState = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      window.removeEventListener('popstate', suppressNextPopState, true);
    };

    window.addEventListener('popstate', suppressNextPopState, true);
    window.setTimeout(() => {
      try {
        closeFromHistoryRef.current = true;
        window.history.back();
      } catch {
        window.removeEventListener('popstate', suppressNextPopState, true);
      }
      window.setTimeout(() => {
        window.removeEventListener('popstate', suppressNextPopState, true);
      }, 500);
    }, 0);
  }, []);

  const closePopup = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
    popCycleKeywordHistoryEntry();
  }, [onClose, popCycleKeywordHistoryEntry]);

  const applyChangesAndClose = useCallback(() => {
    const before = new Set(initialSelectedRef.current);
    const after = new Set(localSelected);
    const otherBefore = new Set(initialOtherSelectedRef.current);
    const otherAfter = new Set(localOtherSelected);

    cycleVariantIds.forEach((variantId) => {
      if (before.has(variantId) !== after.has(variantId)) {
        onToggleVariant(variantId);
      }
      if (onToggleOtherVariant && otherBefore.has(variantId) !== otherAfter.has(variantId)) {
        onToggleOtherVariant(variantId);
      }
    });

    closePopup();
  }, [closePopup, cycleVariantIds, localOtherSelected, localSelected, onToggleOtherVariant, onToggleVariant]);

  useLayoutEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const originalBodyTouchAction = document.body.style.touchAction;

    // Mobile Chrome can flash the page behind this popup when body is switched to
    // position: fixed at the same frame as the portal/backdrop is mounted.
    // Keep the page geometry stable and block scroll with overflow/overscroll only.
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    try {
      window.history.pushState({ ...(window.history.state || {}), cycleKeywordPopup: true }, '');
    } catch {
      // ignore history errors in embedded preview environments
    }

    const handlePopState = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup();
      }
    };

    window.addEventListener('popstate', handlePopState, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
      document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;
      document.body.style.touchAction = originalBodyTouchAction;
      window.removeEventListener('popstate', handlePopState, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePopup, onClose]);

  useEffect(() => {
    const blurFrame = window.requestAnimationFrame(() => {
      setIsBackdropBlurReady(true);
    });

    return () => {
      window.cancelAnimationFrame(blurFrame);
    };
  }, []);

  useEffect(() => {
    const nextSelected = selected.filter((id) => cycleVariantIds.includes(id));
    const nextOtherSelected = otherSelected.filter((id) => cycleVariantIds.includes(id));
    initialSelectedRef.current = nextSelected;
    initialOtherSelectedRef.current = nextOtherSelected;
    setLocalSelected(nextSelected);
    setLocalOtherSelected(nextOtherSelected);
  }, [isPointSelectionMode, cycleVariantIds, selected, otherSelected]);

  const selectedOutsideCycleCount = selected.filter((id) => !cycleVariantIds.includes(id)).length;
  const localTotalSelectedCount = selectedOutsideCycleCount + localSelected.length;
  const isAtLimit = Number.isFinite(maxSelectableCount) && localTotalSelectedCount >= maxSelectableCount;

  useEffect(() => {
    onHover(null);
    return () => onHover(null);
  }, [onHover]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overscroll-none">
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-[backdrop-filter,opacity] duration-150 ease-out",
            isBackdropBlurReady ? "backdrop-blur-sm" : "backdrop-blur-0"
          )}
          onPointerDown={() => {
            cyclePopupBackdropPointerDownRef.current = true;
          }}
          onPointerUp={() => {
            if (cyclePopupBackdropPointerDownRef.current) {
              cyclePopupBackdropPointerDownRef.current = false;
              applyChangesAndClose();
              return;
            }
            cyclePopupBackdropPointerDownRef.current = false;
          }}
          onPointerCancel={() => { cyclePopupBackdropPointerDownRef.current = false; }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
          className="relative z-10 w-full max-w-2xl max-h-[82vh] rounded-3xl bg-[var(--card-bg)] shadow-2xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <p className={cn("text-[10px] font-black tracking-[0.16em] uppercase mb-1", sectionAccent.text)}>{isPointSelectionMode ? `${title} Point Keyword` : `${title} Keyword`}</p>
              <h3 className="text-2xl font-black text-[var(--text-primary)] leading-tight truncate">{cycle.titleKo || cycle.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {Number.isFinite(maxSelectableCount) ? `최대 ${maxSelectableCount}개까지 선택 가능 · 현재 ${localTotalSelectedCount}/${maxSelectableCount}` : '필요한 키워드를 선택하세요'}
                {localSelected.length > 0 ? ` (${localSelected.length})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(localSelected.length > 0 || localOtherSelected.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSelected([]);
                    setLocalOtherSelected([]);
                  }}
                  className={cn("h-11 px-3 rounded-2xl border transition-all text-[11px] font-black whitespace-nowrap", sectionAccent.selectedSoft)}
                  title="이 폴더 선택 전체 해제"
                >
                  전체 해제
                </button>
              )}
              {hasChanges && (
                <button
                  type="button"
                  onClick={applyChangesAndClose}
                  className={cn(
                    "w-11 h-11 rounded-2xl border flex items-center justify-center transition-all shrink-0",
                    sectionAccent.selected
                  )}
                  title="변경 적용"
                  aria-label="변경 적용"
                >
                  <Check className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={closePopup}
                className="w-11 h-11 rounded-2xl border flex items-center justify-center transition-all shrink-0 bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:text-white hover:bg-btn-hover"
                title={hasChanges ? "변경 적용 없이 닫기" : "닫기"}
                aria-label={hasChanges ? "변경 적용 없이 닫기" : "닫기"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="p-5 overflow-y-auto custom-scrollbar max-h-[calc(82vh-104px)] space-y-3"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {cycle.variants.map((variant) => {
              if (variant.kind === 'separator') {
                return (
                  <div key={variant.id} className={cn("pt-2 pb-1 flex items-center gap-2 text-[10.5px] font-black tracking-[0.14em] uppercase select-none", sectionAccent.text)}>
                    <span className="shrink-0">{variant.labelKo || variant.label}</span>
                    <span className={cn("h-px flex-1", sectionAccent.bar, "opacity-25")} />
                  </div>
                );
              }
              const isSelected = localSelected.includes(variant.id);
              const isOtherSelected = localOtherSelected.includes(variant.id);
              const isHighlightedSelected = isSelected && highlightedVariantIdSet.has(variant.id);
              const disabled = !isSelected && !isOtherSelected && isAtLimit;
              const canPointSelect = !!onToggleOtherVariant && cycle.id !== 'recommended-sound-combos' && !(variant.applyPools && variant.applyPools.length > 0);
              return (
                <div
                  key={variant.id}
                  className={cn(
                    "w-full rounded-2xl border transition-all flex items-stretch overflow-hidden bg-btn-bg border-btn-border text-[var(--text-primary)]",
                    disabled && "bg-[var(--hover-bg)] border-[var(--border-color)] text-[var(--text-secondary)] opacity-45 cursor-not-allowed"
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;

                      const nextSelected = isSelected
                        ? localSelected.filter((id) => id !== variant.id)
                        : [...localSelected.filter((id) => id !== variant.id), variant.id];
                      const nextOtherSelected = localOtherSelected.filter((id) => id !== variant.id);

                      setLocalSelected(nextSelected);
                      setLocalOtherSelected(nextOtherSelected);
                    }}
                    className={cn(
                      "min-w-0 flex-1 px-4 py-3 text-left transition-all",
                      isSelected && cn(sectionAccent.selected, "soridraw-selected-strong"),
                      !isSelected && !disabled && "hover:bg-btn-hover",
                      disabled && "cursor-not-allowed"
                    )}
                  >
                    <div className="min-w-0">
                      <span className={cn("text-sm truncate block", isSelected ? "font-black" : "font-black")}>{variant.labelKo || variant.label}</span>
                      <p className={cn("text-xs mt-1 leading-snug line-clamp-2", isSelected ? "text-[#050505]/85 font-extrabold" : "text-[var(--text-secondary)]")}>{variant.descriptionKo || variant.description}</p>
                    </div>
                  </button>
                  {canPointSelect && (
                    <button
                      type="button"
                      disabled={disabled && !isOtherSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (disabled && !isOtherSelected) return;

                        const nextSelected = localSelected.filter((id) => id !== variant.id);
                        const nextOtherSelected = isOtherSelected
                          ? localOtherSelected.filter((id) => id !== variant.id)
                          : [...localOtherSelected.filter((id) => id !== variant.id), variant.id];

                        setLocalSelected(nextSelected);
                        setLocalOtherSelected(nextOtherSelected);
                      }}
                      className={cn(
                        "w-12 shrink-0 border-l flex items-center justify-center transition-all",
                        isOtherSelected
                          ? cn(sectionAccent.pointSelected, "soridraw-selected-strong")
                          : "bg-black/5 text-[var(--text-secondary)] border-black/20 hover:bg-white/10"
                      )}
                      title={isOtherSelected ? '포인트 선택 해제' : '포인트 선택'}
                      aria-label={`${variant.labelKo || variant.label} 포인트 선택`}
                    >
                      <Zap className="w-[18px] h-[18px]" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}

interface CategorySectionProps {
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  items: CategoryItem[];
  selected: string[];
  pinned?: string[];
  onToggle: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onClear: () => void;
  onUnpinAll?: () => void;
  onRandom: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  hoveredItem: CategoryItem | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allExpanded: boolean;
  kpopMode?: 0 | 1 | 2;
  citypopMode?: 0 | 1 | 2;
  isRandomized?: boolean;
  hidePin?: boolean;
  onHeightChange?: (height: number) => void;
  forcedHeight?: number;
  uniformKeywordGrid?: boolean;
  directInput?: {
    selectedText?: string;
    onApply: (value: string) => void;
    onCancelSelected?: () => void;
  };
}

function CategorySection({ 
  title, 
  titleKo,
  description,
  descriptionKo,
  items, 
  selected, 
  pinned = [],
  onToggle, 
  onTogglePin,
  onClear, 
  onUnpinAll,
  onRandom,
  isLocked = false,
  onToggleLock,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  hoveredItem,
  isExpanded,
  onToggleExpand,
  allExpanded,
  kpopMode = 0,
  citypopMode = 0,
  isRandomized = false,
  hidePin = false,
  onHeightChange,
  forcedHeight,
  uniformKeywordGrid = false,
  directInput
}: CategorySectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(84);
  const [isDirectInputEditing, setIsDirectInputEditing] = useState(false);
  const [directInputDraft, setDirectInputDraft] = useState('');
  const sectionAccent = getStudioSectionAccent(titleKo || title);
  const isExpandSummaryActive = isExpanded;

  useStableContentHeight(contentRef, setContentHeight, [items, selected, pinned, uniformKeywordGrid], onHeightChange);

  const resolveSelectedLabel = (id: string) => {
    const customMoodText = getCustomKeywordText(id, CUSTOM_MOOD_PREFIX);
    if (customMoodText) return customMoodText;
    const customThemeText = getCustomKeywordText(id, CUSTOM_THEME_PREFIX);
    if (customThemeText) return customThemeText;
    const item = items.find(i => i.id === id);
    return item?.labelKo || item?.label || id;
  };

  const openDirectInput = () => {
    setDirectInputDraft(directInput?.selectedText || '');
    setIsDirectInputEditing(true);
  };

  const applyDirectInput = () => {
    const value = directInputDraft.trim();
    if (!value) {
      setIsDirectInputEditing(false);
      return;
    }
    directInput?.onApply(value);
    setIsDirectInputEditing(false);
  };

  const cancelDirectInput = () => {
    setDirectInputDraft(directInput?.selectedText || '');
    setIsDirectInputEditing(false);
  };

  return (
    <div data-expand-section className="soridraw-expand-card bg-[var(--card-bg)] rounded-[28px] p-7 flex flex-col justify-between h-auto relative group shadow-[var(--shadow-md)]">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3 
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[22px] font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-help min-w-0"
              >
                <span className={cn("w-1.5 h-6 rounded-full shrink-0", sectionAccent.bar)} />
                <span className="truncate">{titleKo || title}</span>
                <span className="text-[15px] font-normal text-[var(--text-secondary)] ml-2 shrink-0">({selected.length}/{items.length})</span>
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={cn("absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border shadow-[var(--shadow-md)] w-48 pointer-events-none", sectionAccent.selectedBorder)}
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{descriptionKo || description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleLock && (
              <button
                type="button"
                onClick={onToggleLock}
                onMouseEnter={() => onHover({ id: `lock-${title}`, label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? `${titleKo || title} 메뉴를 랜덤 선택에 다시 포함합니다.` : `현재 ${titleKo || title} 설정을 유지하고 랜덤 선택에서 제외합니다.` })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ id: `lock-${title}`, label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? `${titleKo || title} 메뉴를 랜덤 선택에 다시 포함합니다.` : `현재 ${titleKo || title} 설정을 유지하고 랜덤 선택에서 제외합니다.` })}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "p-3 rounded-xl transition-all shadow-btn border border-btn-border",
                  isLocked
                    ? sectionAccent.selected
                    : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
                title={isLocked ? '잠금 해제' : '메뉴 잠금'}
                aria-label={`${titleKo || title} ${isLocked ? '잠금 해제' : '잠금'}`}
              >
                {isLocked ? <Lock className="w-[18px] h-[18px]" /> : <Unlock className="w-[18px] h-[18px]" />}
              </button>
            )}
            <button 
              onClick={onRandom}
              onMouseEnter={() => onHover({ id: 'random-cat', label: 'Random', labelKo: '랜덤 선택', description: `${titleKo || title} 키워드를 무작위로 선택합니다.` })}
              onMouseLeave={() => {
                onHover(null);
                onLongPressEnd();
              }}
              onTouchStart={() => onLongPressStart({ id: 'random-cat', label: 'Random', labelKo: '랜덤 선택', description: `${titleKo || title} 키워드를 무작위로 선택합니다.` })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                "p-3 rounded-xl transition-all shadow-btn",
                isRandomized 
                  ? sectionAccent.selected 
                  : "bg-btn-bg text-[var(--text-secondary)] border border-btn-border hover:bg-btn-hover"
              )}
            >
              <Dices className="w-[18px] h-[18px]" />
            </button>
            {!hidePin && onUnpinAll && (
              <button 
                onClick={onUnpinAll}
                onMouseEnter={() => onHover({ id: 'unpin-all', label: 'Unpin All', labelKo: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ id: 'unpin-all', label: 'Unpin All', labelKo: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
                onTouchEnd={onLongPressEnd}
                className="p-3 rounded-xl bg-btn-bg text-[var(--text-secondary)] border border-btn-border hover:bg-btn-hover transition-all shadow-btn"
              >
                <PinOff className="w-[18px] h-[18px]" />
              </button>
            )}
            <button 
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'clear', label: 'Reset', labelKo: '초기화', description: hidePin ? '모든 선택을 초기화합니다.' : '핀을 제외한 모든 선택을 초기화합니다.' })}
              onMouseLeave={() => {
                onHover(null);
                onLongPressEnd();
              }}
              onTouchStart={() => onLongPressStart({ id: 'clear', label: 'Reset', labelKo: '초기화', description: hidePin ? '모든 선택을 초기화합니다.' : '핀을 제외한 모든 선택을 초기화합니다.' })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                "p-3 rounded-xl transition-all border shadow-btn",
                (selected.length > 0 || isRandomized)
                  ? sectionAccent.selectedSoft 
                  : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
        
        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded ? resolveExpandedHeight(forcedHeight, contentHeight, window.innerWidth < 768 ? 48 : 96) : (window.innerWidth < 768 ? 48 : 96),
            opacity: 1
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="soridraw-expand-content overflow-hidden min-h-[48px] md:min-h-[96px]"
        >
          <div
            ref={contentRef}
            className={cn(
              uniformKeywordGrid
                ? "grid grid-cols-4 lg:grid-cols-7 gap-2"
                : "flex flex-wrap gap-2"
            )}
          >
            {items.map((item) => {
            const isPinned = pinned.includes(item.id);
            const isSelected = selected.includes(item.id);
            const isKpop = item.id === 'kpop';
            const isCitypop = item.id === 'citypop';
            
            // K-Pop specific styles
            let kpopStyle = "";
            let displayLabel = item.labelKo ?? item.label;
            let displayDescription = item.descriptionKo ?? item.description;

            const labelLength = String(displayLabel ?? '').replace(/\s+/g, '').length;
            const uniformLabelTextClass = labelLength >= 6
              ? "text-[11px] md:text-[11.5px] leading-[1.05]"
              : labelLength >= 4
                ? "text-[11px] md:text-[11.5px] leading-[1.08]"
                : "text-[13px] md:text-[13.5px] leading-tight";

            if (isKpop) {
              if (kpopMode === 2) {
                kpopStyle = "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]";
                displayDescription = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
                displayLabel = "K-Pop (Mix)";
              } else if (kpopMode === 1) {
                kpopStyle = "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]";
                displayDescription = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
                displayLabel = "K-Pop";
              } else {
                kpopStyle = "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover shadow-btn";
                displayDescription = "K-Pop 장르를 선택하고 스타일(기본/Mix)을 순환하며 선택합니다.";
                displayLabel = "K-Pop";
              }
            }

            // City Pop specific styles
            let citypopStyle = "";
            if (isCitypop) {
              if (citypopMode === 2) {
                citypopStyle = "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]";
                displayDescription = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
                displayLabel = "City Pop(M)";
              } else if (citypopMode === 1) {
                citypopStyle = "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]";
                displayDescription = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
                displayLabel = "City Pop(O)";
              } else {
                citypopStyle = "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover shadow-btn";
                displayDescription = "City Pop 장르를 선택하고 스타일(올드/현대)을 순환하며 선택합니다.";
                displayLabel = "City Pop";
              }
            }

            return (
              <div key={item.id} className={cn("relative group/btn", uniformKeywordGrid && "min-w-0")}>
                <button
                  onMouseEnter={(event) => {
                    const tooltipItem = { 
                      ...item, 
                      label: item.label,
                      labelKo: item.labelKo,
                      description: displayDescription 
                    };
                    onHover(tooltipItem);
                  }}
                  onMouseLeave={() => {
                    onHover(null);
                    onLongPressEnd();
                  }}
                  onTouchStart={() => {
                    onLongPressStart({ 
                      ...item, 
                      label: item.label,
                      labelKo: item.labelKo,
                      description: displayDescription 
                    });
                  }}
                  onTouchEnd={onLongPressEnd}
                  onClick={() => {
                    onToggle(item.id);
                    // Show description on click for mobile/touch users
                    // For K-Pop and City Pop, toggleSelection already updates the hover state with the correct next description
                    if (!isKpop && !isCitypop) {
                      onHover({ 
                        ...item, 
                        label: item.label,
                        labelKo: item.labelKo,
                        description: displayDescription, 
                        _ts: Date.now() 
                      });
                    }
                  }}
                  className={cn(
                    uniformKeywordGrid
                      ? "w-full min-w-0 h-11 md:h-12 px-2 py-1.5 rounded-xl font-bold transition-all border flex items-center justify-center text-center shadow-btn"
                      : "px-4 py-3 rounded-xl text-[14px] font-bold transition-all border flex items-center gap-2 shadow-btn",
                    (isKpop || isCitypop) ? "min-w-[120px] justify-center" : "",
                    isSelected
                      ? sectionAccent.selected
                      : "bg-btn-bg border-[var(--keyword-button-border)] text-[var(--text-primary)] hover:bg-btn-hover",
                    isKpop && kpopMode > 0 ? kpopStyle : "",
                    isCitypop && citypopMode > 0 ? citypopStyle : ""
                  )}
                >
                  {isKpop && kpopMode > 0 && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      kpopMode === 1 ? "bg-[#171717]" : "bg-[#171717]"
                    )} />
                  )}
                  {isCitypop && citypopMode > 0 && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      citypopMode === 1 ? "bg-[#171717]" : "bg-[#171717]"
                    )} />
                  )}
                  <span
                    className={cn(
                      uniformKeywordGrid
                        ? ["block w-full whitespace-normal break-keep text-center", uniformLabelTextClass]
                        : ""
                    )}
                  >
                    {displayLabel}
                  </span>
                </button>
                

                {/* Pin Toggle Button - Top Right Corner Only */}
                {!hidePin && onTogglePin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(item.id);
                    }}
                    className={cn(
                      "absolute -top-2 -right-2 p-1.5 rounded-full border transition-all z-10",
                      isPinned 
                        ? "bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong opacity-100 scale-100 shadow-[0_10px_24px_rgba(0,0,0,0.16)]" 
                        : "bg-white/8 border-white/15 text-[var(--text-secondary)] opacity-0 scale-75 group-hover/btn:opacity-100 group-hover/btn:scale-100 hover:text-amber-300"
                    )}
                  >
                    <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </motion.div>
      </div>

      <div 
        data-expanded={isExpanded ? 'true' : 'false'}
        role={isDirectInputEditing ? undefined : 'button'}
        tabIndex={isDirectInputEditing ? undefined : 0}
        aria-pressed={isDirectInputEditing ? undefined : isExpanded}
        onClick={(event) => {
          if (isDirectInputEditing) return;
          handleExpandableToggle(event, isExpanded, onToggleExpand);
        }}
        onKeyDown={(event) => {
          if (isDirectInputEditing) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleExpand();
            keepExpandableSectionInView(event.currentTarget, isExpanded);
          }
        }}
        className={cn(
          "soridraw-expand-summary mt-5 h-[64px] rounded-2xl border border-dashed px-5 py-3 flex items-center justify-center text-center overflow-hidden relative transition-all",
          isExpandSummaryActive
            ? cn(sectionAccent.summaryActive, "border-dashed")
            : cn("border-dashed", sectionAccent.summaryRest),
          !isDirectInputEditing && !isExpandSummaryActive && cn("cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15", sectionAccent.summaryHover),
          !isDirectInputEditing && isExpandSummaryActive && "cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/15"
        )}
        style={{
          '--soridraw-summary-border': sectionAccent.summaryBorder,
          '--soridraw-summary-border-hover': sectionAccent.summaryBorderHover,
          '--soridraw-summary-bg-active': sectionAccent.summaryActiveBg,
        } as React.CSSProperties}
        title={!isDirectInputEditing ? (isExpanded ? '접기' : '펼치기') : undefined}
      >
        {isDirectInputEditing && directInput ? (
          <div className="flex items-center gap-2 w-full">
            <input
              value={directInputDraft}
              onChange={(event) => setDirectInputDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyDirectInput();
                if (event.key === 'Escape') cancelDirectInput();
              }}
              autoFocus
              placeholder={`${titleKo || title} 직접 입력`}
              className={cn("flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold text-center", sectionAccent.text, "placeholder:text-white/20")}
            />
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); applyDirectInput(); }}
              className={cn("shrink-0 w-8 h-8 bg-transparent border-0 transition-colors flex items-center justify-center", sectionAccent.text)}
              aria-label="직접입력 적용"
            >
              <Check className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); cancelDirectInput(); }}
              className="shrink-0 w-8 h-8 bg-transparent border-0 text-[var(--text-secondary)] hover:text-red-400 transition-colors flex items-center justify-center"
              aria-label="직접입력 취소"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        ) : selected.length > 0 ? (
          <p className={cn("text-[15px] font-black soridraw-selected-summary leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis pr-10", sectionAccent.text)}>
            {selected.map(id => resolveSelectedLabel(id)).join(', ')}
          </p>
        ) : (
          <p className={cn("text-[15px] font-medium leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis pr-10", sectionAccent.softText)}>
            키워드를 선택하여 곡의 {titleKo || title}를 설정하세요.
          </p>
        )}
        {directInput && !isDirectInputEditing && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); openDirectInput(); }}
            onMouseEnter={() => onHover({ id: `direct-${title}`, label: 'Direct input', labelKo: '직접 입력', description: `${titleKo || title} 키워드를 직접 입력합니다.` })}
            onMouseLeave={() => onHover(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-transparent border-0 shadow-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
            aria-label={`${titleKo || title} 직접 입력`}
          >
            <Edit2 className="w-[22px] h-[22px]" />
          </button>
        )}
      </div>
    </div>
  );
}

interface SongStructureIntegratedControlProps {
  lyricsLength: LyricsLength;
  onLyricsLengthChange: (val: LyricsLength) => void;
  songStructure: SongStructure;
  customStructure: CustomSectionItem[];
  onSongStructureChange: (val: SongStructure) => void;
  onCustomStructureChange: (val: CustomSectionItem[]) => void;
  onClear: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  user: User | null;
  userTier: TagTier;
  sectionTags: SectionTag[];
  pointSoundTags?: string[];
  pointSoundTagLabels?: Record<string, string>;
  vocalSectionTags?: VocalSectionTagOption[];
  onModalStateChange?: (isOpen: boolean) => void;
}

function SongStructureIntegratedControl({
  lyricsLength,
  onLyricsLengthChange,
  songStructure,
  customStructure,
  onSongStructureChange,
  onCustomStructureChange,
  onClear,
  isLocked = false,
  onToggleLock,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  user,
  userTier,
  sectionTags,
  pointSoundTags = [],
  pointSoundTagLabels = {},
  vocalSectionTags = [],
  onModalStateChange
}: SongStructureIntegratedControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const customModalHistoryPushedRef = useRef(false);
  const customModalBackdropMouseDownRef = useRef(false);
  const [draftStructure, setDraftStructure] = useState<CustomSectionItem[]>([]);
  const initialDraftStructureRef = useRef<CustomSectionItem[]>([]);
  const [selectedInsertIndex, setSelectedInsertIndex] = useState<number | null>(null);
  const currentStructureScrollRef = useRef<HTMLDivElement | null>(null);
  const [isReorderDragging, setIsReorderDragging] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const draggingSectionIdRef = useRef<string | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const dragStartPointerYRef = useRef<number | null>(null);
  const hasReorderDragStartedRef = useRef(false);
  const activeReorderPointerIdRef = useRef<number | null>(null);
  const activeReorderHandleRef = useRef<HTMLButtonElement | null>(null);
  const reorderDragCleanupRef = useRef<(() => void) | null>(null);
  const reorderFrameRef = useRef<number | null>(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [savedStructures, setSavedStructures] = useState<SavedStructurePreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [editingSavedStructureId, setEditingSavedStructureId] = useState<string | null>(null);
  const [isSaveStructureModalOpen, setIsSaveStructureModalOpen] = useState(false);
  const saveStructureModalHistoryPushedRef = useRef(false);
  const saveStructureModalBackdropMouseDownRef = useRef(false);
  const [isSavedSectionsModalOpen, setIsSavedSectionsModalOpen] = useState(false);
  const savedSectionsModalHistoryPushedRef = useRef(false);
  const savedSectionsModalBackdropMouseDownRef = useRef(false);
  const [structureSearch, setStructureSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<'all' | 'like' | 'dislike'>('all');
  const [deleteConfirmPresetId, setDeleteConfirmPresetId] = useState<string | null>(null);
  const [editingPresetTitleId, setEditingPresetTitleId] = useState<string | null>(null);
  const [editingPresetTitleDraft, setEditingPresetTitleDraft] = useState('');
  const [userCustomSections, setUserCustomSections] = useState<UserCustomSectionDefinition[]>([]);
  const [userCustomSectionTags, setUserCustomSectionTags] = useState<UserCustomSectionTagDefinition[]>([]);
  const [isCustomSectionEditorOpen, setIsCustomSectionEditorOpen] = useState(false);
  const [editingCustomSectionId, setEditingCustomSectionId] = useState<string | null>(null);
  const [customSectionDraft, setCustomSectionDraft] = useState({ labelKo: '', labelEn: '' });
  const customSectionEditorHistoryPushedRef = useRef(false);
  const customSectionEditorBackdropMouseDownRef = useRef(false);
  const [sectionLibraryFilter, setSectionLibraryFilter] = useState<'all' | 'basic' | 'my'>('all');
  const [isCustomSectionConverting, setIsCustomSectionConverting] = useState(false);
  const [clearedStructureTagSnapshot, setClearedStructureTagSnapshot] = useState<{ id: string; tags: string[] }[] | null>(null);
  const customBackupLoadedRef = useRef(false);
  const customBackupLoadingRef = useRef(false);
  const customBackupDirtyRef = useRef(false);
  const customBackupSavingRef = useRef(false);
  const savedStructuresRef = useRef<SavedStructurePreset[]>([]);
  const userCustomSectionsRef = useRef<UserCustomSectionDefinition[]>([]);
  const userCustomSectionTagsRef = useRef<UserCustomSectionTagDefinition[]>([]);

  const [contentHeight, setContentHeight] = useState<number | string>('auto');

  const getDraftStructureSignature = useCallback((items: CustomSectionItem[] = []) => JSON.stringify(
    items.map((item) => ({
      section: item.section,
      customId: item.customId || '',
      tags: [...(item.tags || [])].sort(),
    }))
  ), []);

  const hasCustomStructureModalChanges = getDraftStructureSignature(draftStructure ?? []) !== getDraftStructureSignature(initialDraftStructureRef.current ?? []);
  const hasDraftStructureSelection = (draftStructure ?? []).length > 0;
  const canApplyCustomStructureDraft = hasDraftStructureSelection || hasCustomStructureModalChanges;

  useEffect(() => {
    onModalStateChange?.(isCustomModalOpen || editingSectionIndex !== null || isCustomSectionEditorOpen || isSaveStructureModalOpen || isSavedSectionsModalOpen);
  }, [isCustomModalOpen, editingSectionIndex, isCustomSectionEditorOpen, isSaveStructureModalOpen, isSavedSectionsModalOpen, onModalStateChange]);

  useStableContentHeight(contentRef, setContentHeight, [lyricsLength, songStructure, customStructure]);

  const moveDraftSectionById = useCallback((dragId: string, targetIndex: number) => {
    setDraftStructure((prev) => {
      const currentItems = prev ?? [];
      const fromIndex = currentItems.findIndex((item) => item.id === dragId);
      if (fromIndex < 0 || currentItems.length <= 1) return currentItems;
      const safeTargetIndex = Math.max(0, Math.min(targetIndex, currentItems.length - 1));
      if (fromIndex === safeTargetIndex) return currentItems;
      const nextItems = [...currentItems];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      nextItems.splice(safeTargetIndex, 0, movedItem);
      return nextItems;
    });
    setSelectedInsertIndex(null);
  }, []);

  const processManualReorderDrag = useCallback(() => {
    const dragId = draggingSectionIdRef.current;
    const pointerY = dragPointerYRef.current;
    const container = currentStructureScrollRef.current;
    if (!hasReorderDragStartedRef.current || !dragId || pointerY == null || !container) return;

    const containerRect = container.getBoundingClientRect();
    const edgeSize = 74;
    const maxScrollStep = 18;
    let scrollStep = 0;

    if (pointerY < containerRect.top + edgeSize) {
      const ratio = (containerRect.top + edgeSize - pointerY) / edgeSize;
      scrollStep = -Math.ceil(Math.min(maxScrollStep, Math.max(4, ratio * maxScrollStep)));
    } else if (pointerY > containerRect.bottom - edgeSize) {
      const ratio = (pointerY - (containerRect.bottom - edgeSize)) / edgeSize;
      scrollStep = Math.ceil(Math.min(maxScrollStep, Math.max(4, ratio * maxScrollStep)));
    }

    if (scrollStep !== 0) {
      container.scrollTop += scrollStep;
    }

    const sectionNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-reorder-section-id]'));
    if (sectionNodes.length <= 1) return;

    let targetIndex = sectionNodes.length - 1;
    for (let i = 0; i < sectionNodes.length; i += 1) {
      const rect = sectionNodes[i].getBoundingClientRect();
      if (pointerY < rect.top + rect.height / 2) {
        targetIndex = i;
        break;
      }
    }

    moveDraftSectionById(dragId, targetIndex);
  }, [moveDraftSectionById]);

  const stopManualReorderDrag = useCallback(() => {
    if (reorderDragCleanupRef.current) {
      const cleanup = reorderDragCleanupRef.current;
      reorderDragCleanupRef.current = null;
      cleanup();
    }

    if (reorderFrameRef.current !== null) {
      cancelAnimationFrame(reorderFrameRef.current);
      reorderFrameRef.current = null;
    }

    const activeHandle = activeReorderHandleRef.current;
    const activePointerId = activeReorderPointerIdRef.current;
    if (activeHandle && activePointerId !== null) {
      try {
        if (activeHandle.hasPointerCapture?.(activePointerId)) {
          activeHandle.releasePointerCapture(activePointerId);
        }
      } catch {
        // Pointer capture cleanup is best-effort only.
      }
    }

    activeReorderHandleRef.current = null;
    activeReorderPointerIdRef.current = null;
    draggingSectionIdRef.current = null;
    dragPointerYRef.current = null;
    dragStartPointerYRef.current = null;
    hasReorderDragStartedRef.current = false;
    setDraggingSectionId(null);
    setIsReorderDragging(false);
  }, []);

  const startManualReorderLoop = useCallback(() => {
    if (reorderFrameRef.current !== null) return;
    const tick = () => {
      if (!draggingSectionIdRef.current) {
        reorderFrameRef.current = null;
        return;
      }
      processManualReorderDrag();
      reorderFrameRef.current = requestAnimationFrame(tick);
    };
    reorderFrameRef.current = requestAnimationFrame(tick);
  }, [processManualReorderDrag]);

  const handleSectionReorderPointerDown = useCallback((index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    const targetItem = (draftStructure ?? [])[index];
    if (!targetItem) return;

    event.preventDefault();
    event.stopPropagation();

    activeReorderPointerIdRef.current = event.pointerId;
    activeReorderHandleRef.current = event.currentTarget;
    draggingSectionIdRef.current = targetItem.id;
    dragPointerYRef.current = event.clientY;
    dragStartPointerYRef.current = event.clientY;
    hasReorderDragStartedRef.current = false;
    setDraggingSectionId(null);
    setIsReorderDragging(false);
    setSelectedInsertIndex(null);

    // Do not use pointer capture here. On mobile, the dragged row can be
    // reordered while the pointer is still down, and moving the handle in the
    // DOM may fire lostpointercapture, which makes the drag feel forcibly
    // released. Document-level capture listeners below keep the drag alive
    // until the actual pointerup/cancel event.

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (activeReorderPointerIdRef.current !== null && moveEvent.pointerId !== activeReorderPointerIdRef.current) return;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      dragPointerYRef.current = moveEvent.clientY;

      const startY = dragStartPointerYRef.current;
      if (!hasReorderDragStartedRef.current) {
        if (startY == null || Math.abs(moveEvent.clientY - startY) < 12) return;
        hasReorderDragStartedRef.current = true;
        setDraggingSectionId(draggingSectionIdRef.current);
        setIsReorderDragging(true);
        startManualReorderLoop();
      }
    };

    const handlePointerEnd = (endEvent?: PointerEvent | MouseEvent | TouchEvent | Event) => {
      if (endEvent && 'pointerId' in endEvent && activeReorderPointerIdRef.current !== null && endEvent.pointerId !== activeReorderPointerIdRef.current) return;
      stopManualReorderDrag();
    };

    const cleanupReorderListeners = () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerEnd, true);
      document.removeEventListener('pointercancel', handlePointerEnd, true);
      document.removeEventListener('mouseup', handlePointerEnd, true);
      document.removeEventListener('touchend', handlePointerEnd, true);
      document.removeEventListener('touchcancel', handlePointerEnd, true);
      window.removeEventListener('blur', handlePointerEnd, true);
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
    document.addEventListener('pointerup', handlePointerEnd, { capture: true });
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true });
    document.addEventListener('mouseup', handlePointerEnd, { capture: true });
    document.addEventListener('touchend', handlePointerEnd, { capture: true });
    document.addEventListener('touchcancel', handlePointerEnd, { capture: true });
    window.addEventListener('blur', handlePointerEnd, { capture: true });
    reorderDragCleanupRef.current = cleanupReorderListeners;
  }, [draftStructure, startManualReorderLoop, stopManualReorderDrag]);

  useEffect(() => {
    return () => {
      stopManualReorderDrag();
    };
  }, [stopManualReorderDrag]);


  useEffect(() => {
    const localSections = normalizeUserCustomSections(safeReadJsonArray<UserCustomSectionDefinition>(USER_CUSTOM_SECTIONS_STORAGE_KEY));
    const localTags = normalizeUserCustomSectionTags(safeReadJsonArray<UserCustomSectionTagDefinition>(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY));
    setUserCustomSections(localSections);
    setUserCustomSectionTags(localTags);
    userCustomSectionsRef.current = localSections;
    userCustomSectionTagsRef.current = localTags;
  }, []);

  useEffect(() => {
    savedStructuresRef.current = savedStructures;
  }, [savedStructures]);

  useEffect(() => {
    userCustomSectionsRef.current = userCustomSections;
  }, [userCustomSections]);

  useEffect(() => {
    userCustomSectionTagsRef.current = userCustomSectionTags;
  }, [userCustomSectionTags]);

  const markCustomBackupDirty = useCallback(() => {
    customBackupDirtyRef.current = true;
  }, []);

  const persistUserCustomSections = useCallback((next: UserCustomSectionDefinition[]) => {
    const normalized = normalizeUserCustomSections(next).slice(0, 40);
    setUserCustomSections(normalized);
    userCustomSectionsRef.current = normalized;
    writeJsonArray(USER_CUSTOM_SECTIONS_STORAGE_KEY, normalized);
    markCustomBackupDirty();
  }, [markCustomBackupDirty]);

  const persistUserCustomSectionTags = useCallback((next: UserCustomSectionTagDefinition[]) => {
    const normalized = normalizeUserCustomSectionTags(next).slice(0, 120);
    setUserCustomSectionTags(normalized);
    userCustomSectionTagsRef.current = normalized;
    writeJsonArray(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY, normalized);
    markCustomBackupDirty();
  }, [markCustomBackupDirty]);

  const flushCustomBackupIfDirty = useCallback(async () => {
    if (!user || !customBackupDirtyRef.current || customBackupSavingRef.current) return;

    customBackupDirtyRef.current = false;
    customBackupSavingRef.current = true;

    const payload = {
      structures: savedStructuresRef.current
        .map((item) => normalizeSavedStructurePreset(item))
        .filter((item): item is SavedStructurePreset => item !== null)
        .slice(0, 20),
      customSections: normalizeUserCustomSections(userCustomSectionsRef.current).slice(0, 40),
      customSectionTags: normalizeUserCustomSectionTags(userCustomSectionTagsRef.current).slice(0, 120),
      customDataSyncVersion: 2,
      customDataUpdatedAt: Date.now(),
    };

    try {
      const ref = doc(db, 'user_structures', user.uid);
      await setDoc(ref, sanitizeForFirestore(payload), { merge: true });
    } catch (error) {
      customBackupDirtyRef.current = true;
      console.error('Failed to save custom backup to Firestore:', error);
    } finally {
      customBackupSavingRef.current = false;
    }
  }, [user]);

  const ensureCustomBackupLoaded = useCallback(async () => {
    if (!user || customBackupLoadedRef.current || customBackupLoadingRef.current) return;

    customBackupLoadingRef.current = true;
    const storageKey = getSavedStructuresStorageKey(user.uid);

    try {
      const ref = doc(db, 'user_structures', user.uid);
      const snap = await getDoc(ref);
      const localStructures = safeReadJsonArray<SavedStructurePreset>(storageKey)
        .map((item) => normalizeSavedStructurePreset(item))
        .filter((item): item is SavedStructurePreset => item !== null);
      const localSections = normalizeUserCustomSections(safeReadJsonArray<UserCustomSectionDefinition>(USER_CUSTOM_SECTIONS_STORAGE_KEY));
      const localTags = normalizeUserCustomSectionTags(safeReadJsonArray<UserCustomSectionTagDefinition>(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY));

      if (!snap.exists()) {
        if (localStructures.length > 0 || localSections.length > 0 || localTags.length > 0) {
          customBackupDirtyRef.current = true;
        }
        return;
      }

      const data = snap.data();
      const hasStructures = Object.prototype.hasOwnProperty.call(data, 'structures') || Object.prototype.hasOwnProperty.call(data, 'savedStructures') || Object.prototype.hasOwnProperty.call(data, 'presets');
      const hasCustomSections = Object.prototype.hasOwnProperty.call(data, 'customSections');
      const hasCustomTags = Object.prototype.hasOwnProperty.call(data, 'customSectionTags');

      if (hasStructures) {
        const normalizedStructures = readSavedStructurePresets(data);
        setSavedStructures(normalizedStructures);
        savedStructuresRef.current = normalizedStructures;
        writeJsonArray(storageKey, normalizedStructures);
      } else if (localStructures.length > 0) {
        customBackupDirtyRef.current = true;
      }

      if (hasCustomSections) {
        const normalizedSections = normalizeUserCustomSections(data.customSections);
        setUserCustomSections(normalizedSections);
        userCustomSectionsRef.current = normalizedSections;
        writeJsonArray(USER_CUSTOM_SECTIONS_STORAGE_KEY, normalizedSections);
      } else if (localSections.length > 0) {
        customBackupDirtyRef.current = true;
      }

      if (hasCustomTags) {
        const normalizedTags = normalizeUserCustomSectionTags(data.customSectionTags);
        setUserCustomSectionTags(normalizedTags);
        userCustomSectionTagsRef.current = normalizedTags;
        writeJsonArray(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY, normalizedTags);
      } else if (localTags.length > 0) {
        customBackupDirtyRef.current = true;
      }
    } catch (error) {
      console.error('Failed to load custom backup from Firestore:', error);
    } finally {
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
    }
  }, [user]);


  const customSectionMap = useMemo(() => new Map(userCustomSections.map((item) => [item.label, item])), [userCustomSections]);
  const allStructureSections = useMemo(() => {
    const builtIns = CUSTOM_STRUCTURE_SECTIONS.map((label) => ({ label, custom: null as UserCustomSectionDefinition | null }));
    const customItems = userCustomSections
      .filter((item) => !CUSTOM_STRUCTURE_SECTIONS.includes(item.label as any))
      .map((item) => ({ label: item.label, custom: item }));
    if (sectionLibraryFilter === 'basic') return builtIns;
    if (sectionLibraryFilter === 'my') return customItems;
    return [...builtIns, ...customItems];
  }, [userCustomSections, sectionLibraryFilter]);

  const resetCustomSectionDraft = useCallback(() => {
    setEditingCustomSectionId(null);
    setCustomSectionDraft({ labelKo: '', labelEn: '' });
  }, []);

  const closeCustomSectionEditor = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && customSectionEditorHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsCustomSectionEditorOpen(false);
    customSectionEditorHistoryPushedRef.current = false;
    resetCustomSectionDraft();
  }, [resetCustomSectionDraft]);

  const openCustomSectionEditor = useCallback((section?: UserCustomSectionDefinition) => {
    onModalStateChange?.(true);
    if (section) {
      setEditingCustomSectionId(section.id);
      setCustomSectionDraft({
        labelKo: section.labelKo || '',
        labelEn: section.label || '',
      });
    } else {
      resetCustomSectionDraft();
    }
    setIsCustomSectionEditorOpen(true);
    if (!customSectionEditorHistoryPushedRef.current) {
      window.history.pushState({ modal: 'custom-section-editor' }, '');
      customSectionEditorHistoryPushedRef.current = true;
    }
  }, [onModalStateChange, resetCustomSectionDraft]);

  const saveCustomSectionDefinition = async () => {
    const rawKo = sanitizeCustomLabel(customSectionDraft.labelKo);
    const rawEn = sanitizeCustomLabel(customSectionDraft.labelEn);
    const labelKo = rawKo || rawEn;
    if (!labelKo || isCustomSectionConverting) return;
    setIsCustomSectionConverting(true);
    try {
      const prevItem = userCustomSections.find((item) => item.id === editingCustomSectionId);
      const shouldAutoGenerate = !rawEn || Boolean(prevItem && rawKo && rawKo !== (prevItem.labelKo || ''));
      const customSectionGeminiApiKey = shouldAutoGenerate ? await resolveGoogleGeminiApiKey(auth.currentUser) : '';
      const autoMeta = shouldAutoGenerate ? await generateCustomSectionMetadata({
        labelKo,
        description: '',
        kind: 'other',
        context: 'section',
        geminiApiKey: customSectionGeminiApiKey,
      }) : null;
      const label = sanitizeCustomLabel(shouldAutoGenerate ? (autoMeta?.labelEn || rawEn || labelKo) : (rawEn || autoMeta?.labelEn || labelKo));
      const tagCue = sanitizeCustomLabel(autoMeta?.tagCue || prevItem?.tagCue || label);
      const promptFull = String(autoMeta?.promptFull || prevItem?.promptFull || tagCue)
        .replace(/[\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      if (!label) return;
      const kind = (autoMeta?.kind || prevItem?.kind || 'other') as CustomSectionKind;
      const now = Date.now();
      const nextItem: UserCustomSectionDefinition = {
        id: editingCustomSectionId || `custom_section_${now}_${Math.random().toString(36).slice(2, 7)}`,
        label,
        labelKo,
        tagCue,
        promptFull,
        description: labelKo,
        kind,
        defaultTags: [],
        allowVocal: typeof autoMeta?.allowVocal === 'boolean' ? autoMeta.allowVocal : (prevItem?.allowVocal ?? (kind !== 'instrumental' && kind !== 'transition')),
        isInstrumental: typeof autoMeta?.isInstrumental === 'boolean' ? autoMeta.isInstrumental : (prevItem?.isInstrumental ?? kind === 'instrumental'),
        createdAt: prevItem?.createdAt || now,
        updatedAt: now,
      };
      const next = editingCustomSectionId
        ? userCustomSections.map((item) => item.id === editingCustomSectionId ? nextItem : item)
        : [nextItem, ...userCustomSections];
      persistUserCustomSections(next);
      closeCustomSectionEditor();
    } finally {
      setIsCustomSectionConverting(false);
    }
  };

  const deleteCustomSectionDefinition = useCallback((id: string) => {
    const target = userCustomSections.find((item) => item.id === id);
    if (!target) return;
    persistUserCustomSections(userCustomSections.filter((item) => item.id !== id));
    persistUserCustomSectionTags(userCustomSectionTags.filter((item) => item.section !== target.label));
  }, [persistUserCustomSections, persistUserCustomSectionTags, userCustomSectionTags, userCustomSections]);


  const lyricsOptions = [
    { id: 'very-short', label: 'Very Short', labelKo: '더짧게', description: '매우 간결하고 함축적인 가사 (트로트)' },
    { id: 'short', label: 'Short', labelKo: '짧게', description: '함축적이고 간결한 가사 (째즈/발라드 등)' },
    { id: 'normal', label: 'Normal', labelKo: '기본', description: '일반적인 팝 스타일의 가사 분량' },
    { id: 'long', label: 'Long', labelKo: '길게', description: '서사적이고 풍부한 가사(랩,오페라 등)' }
  ];


  useEffect(() => {
    customBackupLoadedRef.current = false;
    customBackupLoadingRef.current = false;
    customBackupDirtyRef.current = false;
    customBackupSavingRef.current = false;

    if (!user) {
      const localGuestStructures = safeReadJsonArray<SavedStructurePreset>(getSavedStructuresStorageKey(null))
        .map((item) => normalizeSavedStructurePreset(item))
        .filter((item): item is SavedStructurePreset => item !== null);
      setSavedStructures(localGuestStructures);
      savedStructuresRef.current = localGuestStructures;
      return;
    }

    const storageKey = getSavedStructuresStorageKey(user.uid);
    const localBackup = safeReadJsonArray<SavedStructurePreset>(storageKey)
      .map((item) => normalizeSavedStructurePreset(item))
      .filter((item): item is SavedStructurePreset => item !== null);
    setSavedStructures(localBackup);
    savedStructuresRef.current = localBackup;
  }, [user]);


  const closeCustomModal = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && customModalHistoryPushedRef.current) {
      void flushCustomBackupIfDirty();
      window.history.back();
      return;
    }
    void flushCustomBackupIfDirty();
    setIsCustomModalOpen(false);
    customModalHistoryPushedRef.current = false;
  }, [flushCustomBackupIfDirty]);

  const resetDraftStructure = useCallback(() => {
    setDraftStructure([]);
    setPresetName('');
    setEditingSavedStructureId(null);
    setStructureSearch('');
    setStructureFilter('all');
    setDeleteConfirmPresetId(null);
    setClearedStructureTagSnapshot(null);
  }, []);

  const closeSaveStructureModal = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && saveStructureModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsSaveStructureModalOpen(false);
    saveStructureModalHistoryPushedRef.current = false;
  }, []);


  const closeSavedSectionsModal = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && savedSectionsModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsSavedSectionsModalOpen(false);
    savedSectionsModalHistoryPushedRef.current = false;
  }, []);

  const openSavedSectionsModal = useCallback(() => {
    onModalStateChange?.(true);
    setIsSavedSectionsModalOpen(true);
    if (!savedSectionsModalHistoryPushedRef.current) {
      window.history.pushState({ modal: 'saved-sections' }, '');
      savedSectionsModalHistoryPushedRef.current = true;
    }
  }, [onModalStateChange]);

  const openSaveStructureModal = useCallback(() => {
    if ((draftStructure ?? []).length === 0) return;
    onModalStateChange?.(true);
    setIsSaveStructureModalOpen(true);
    if (!saveStructureModalHistoryPushedRef.current) {
      window.history.pushState({ modal: 'save-structure' }, '');
      saveStructureModalHistoryPushedRef.current = true;
    }
  }, [draftStructure]);

  useEffect(() => {
    if (!isCustomModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDocumentFullscreenActive()) return;
        if (isSavedSectionsModalOpen) {
          closeSavedSectionsModal();
        } else if (isSaveStructureModalOpen) {
          closeSaveStructureModal();
        } else if (isCustomSectionEditorOpen) {
          closeCustomSectionEditor();
        } else if (editingSectionIndex !== null) {
          setEditingSectionIndex(null);
        } else {
          closeCustomModal();
        }
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (editingSectionIndex !== null || isCustomSectionEditorOpen || isSaveStructureModalOpen || isSavedSectionsModalOpen) return;
      if (isCustomModalOpen) {
        closeCustomModal('history');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCustomModalOpen, closeCustomModal, editingSectionIndex, isCustomSectionEditorOpen, closeCustomSectionEditor, isSaveStructureModalOpen, closeSaveStructureModal, isSavedSectionsModalOpen, closeSavedSectionsModal]);

  useEffect(() => {
    if (!isCustomSectionEditorOpen) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDocumentFullscreenActive()) return;
        closeCustomSectionEditor();
      }
    };
    const handlePopState = () => {
      closeCustomSectionEditor('history');
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCustomSectionEditorOpen, closeCustomSectionEditor]);

  useEffect(() => {
    if (!isSaveStructureModalOpen) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDocumentFullscreenActive()) return;
        closeSaveStructureModal();
      }
    };
    const handlePopState = () => {
      closeSaveStructureModal('history');
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSaveStructureModalOpen, closeSaveStructureModal]);


  useEffect(() => {
    if (!isSavedSectionsModalOpen) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDocumentFullscreenActive()) return;
        closeSavedSectionsModal();
      }
    };
    const handlePopState = () => {
      closeSavedSectionsModal('history');
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSavedSectionsModalOpen, closeSavedSectionsModal]);

  useEffect(() => {
    const resetTransientPointerState = () => {
      customSectionEditorBackdropMouseDownRef.current = false;
      customModalBackdropMouseDownRef.current = false;
      saveStructureModalBackdropMouseDownRef.current = false;
      savedSectionsModalBackdropMouseDownRef.current = false;
      stopManualReorderDrag();
    };

    const handleFullscreenChange = () => {
      // Studio/browser fullscreen can move the active fullscreen root outside normal
      // portal stacking. Leaving the section custom modal/backdrops mounted can create
      // an invisible fixed layer that steals mouse input. Close only the section-custom
      // modal stack and clear transient guards whenever fullscreen state changes.
      resetTransientPointerState();
      setEditingSectionIndex(null);
      setIsCustomSectionEditorOpen(false);
      setIsSaveStructureModalOpen(false);
      setIsSavedSectionsModalOpen(false);
      setIsCustomModalOpen(false);
      customSectionEditorHistoryPushedRef.current = false;
      saveStructureModalHistoryPushedRef.current = false;
      savedSectionsModalHistoryPushedRef.current = false;
      customModalHistoryPushedRef.current = false;
    };

    const handleWindowBlur = () => {
      resetTransientPointerState();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    window.addEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pointerup', resetTransientPointerState);
    window.addEventListener('pointercancel', resetTransientPointerState);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      window.removeEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pointerup', resetTransientPointerState);
      window.removeEventListener('pointercancel', resetTransientPointerState);
    };
  }, [stopManualReorderDrag]);

  const persistSavedStructures = (next: SavedStructurePreset[]) => {
    const sanitized = next
      .map((item) => normalizeSavedStructurePreset(item))
      .filter((item): item is SavedStructurePreset => item !== null)
      .slice(0, 20);

    setSavedStructures(sanitized);
    savedStructuresRef.current = sanitized;
    writeJsonArray(getSavedStructuresStorageKey(user?.uid), sanitized);
    markCustomBackupDirty();
  };


  const openCustomModal = () => {
    onModalStateChange?.(true);
    void ensureCustomBackupLoaded();
    const initialDraft = normalizeCustomStructure(customStructure);
    initialDraftStructureRef.current = initialDraft;
    setDraftStructure(initialDraft);
    setSelectedInsertIndex(null);
    setPresetName('');
    setEditingSavedStructureId(null);
    setClearedStructureTagSnapshot(null);
    setIsCustomModalOpen(true);
    window.history.pushState({ modal: 'custom-structure' }, '');
    customModalHistoryPushedRef.current = true;
  };

  const vocalLabelMapForStructure = useMemo(() => Object.fromEntries(vocalSectionTags.map((item) => [item.tag, item.displayLabel] as const)), [vocalSectionTags]);
  const currentVocalActualLabelsForStructure = useMemo(() => vocalSectionTags
    .map((item) => {
      const raw = String(item.tag || '').trim();
      if (!raw.startsWith('VOCAL::')) return '';
      return (raw.split('::')[1] || '').replace(/\s{2,}/g, ' ').trim();
    })
    .filter(Boolean), [vocalSectionTags]);
  const customTagLabelMapForStructure = useMemo(() => Object.fromEntries(userCustomSectionTags.map((item) => [item.label, item.labelKo || item.label] as const)), [userCustomSectionTags]);
  const parseVocalTagFallbackForStructure = useCallback((tag: string) => {
    const raw = String(tag || '').trim();
    if (raw.startsWith('VOCAL_ALL::')) return '전체보컬';
    if (raw.startsWith('VOCAL::')) {
      const parts = raw.split('::');
      const label = (parts[1] || 'Vocal').replace(/\s{2,}/g, ' ').trim();
      const noGender = label.replace(/\b(?:Male|Female)\s+/gi, '').replace(/\s{2,}/g, ' ').trim().toLowerCase();
      const liveGenderedLabel = currentVocalActualLabelsForStructure.find((item) => item.replace(/\b(?:Male|Female)\s+/gi, '').replace(/\s{2,}/g, ' ').trim().toLowerCase() === noGender);
      return liveGenderedLabel || label;
    }
    return '';
  }, [currentVocalActualLabelsForStructure]);
  const getStructureTagDisplay = useCallback((tag: string) => {
    const raw = String(tag || '').trim();
    return vocalLabelMapForStructure[raw] || parseVocalTagFallbackForStructure(raw) || customTagLabelMapForStructure[raw] || pointSoundTagLabels[raw] || raw;
  }, [vocalLabelMapForStructure, parseVocalTagFallbackForStructure, customTagLabelMapForStructure, pointSoundTagLabels]);

  function formatStructureText(structure: CustomSectionItem[]) {
    const normalized = normalizeCustomStructure(structure);
    const getDisplay = getStructureTagDisplay;
    const getSectionDisplay = (section: string) => customSectionMap.get(section)?.labelKo || section;
    return normalized.map(s => {
      const sectionLabel = getSectionDisplay(String(s.section));
      const visibleTags = (s.tags ?? [])
        .map(getDisplay)
        .filter(Boolean)
        .filter((tag, index, arr) => arr.findIndex((other) => String(other).toLowerCase() === String(tag).toLowerCase()) === index)
        .slice(0, 3);
      if (s.section === 'Instrumental' && visibleTags.length > 0) {
        return `${sectionLabel}: ${visibleTags[0]}`;
      }
      return `${sectionLabel}${visibleTags.length > 0 ? ` · ${visibleTags.join(' · ')}` : ''}`;
    }).join(' → ');
  }


  const structureOptions = [
    { id: '1', label: '기본', description: '장르에 맞춰 Hook / Break / Drop / Instrumental을 안정적으로 섞는 세련된 랜덤 기본 구조입니다.' },
    { id: '2', label: '1', description: '일반적인 기본 섹션 구성. 추천 2~4분' },
    { id: '3', label: '2', description: '브릿지와 반복이 확장된 섹션 구성. 추천 4~6분' },
    { id: 'custom', label: '커스텀', description: (customStructure ?? []).length > 0 ? `직접 지정한 섹션 적용 · ${formatStructureText(customStructure)}` : '직접 섹션을 지정하는 모드 · 구성에 따라 길이가 달라집니다.' },
  ] as const;

  const handleSelectStructure = (optionId: SongStructure) => {
    const optionDescriptions: Record<SongStructure, string> = {
      '1': '장르별로 안정적인 기본 뼈대를 고르고 Hook / Break / Drop / Instrumental을 세련되게 섞는 기본 랜덤 구조',
      '2': '가장 일반적인 기본 섹션 구성 · 추천 길이 2~4분',
      '3': '브릿지와 반복이 확장된 섹션 구성 · 추천 길이 4~6분',
      'custom': (customStructure ?? []).length > 0 ? `직접 지정한 섹션 적용 · ${formatStructureText(customStructure)}` : '직접 섹션을 지정하는 모드 · Pro부터 사용할 수 있습니다.',
    };

    if (optionId === 'custom' && userTier === 'free') {
      onHover({
        id: 'song-structure-custom-locked',
        label: '섹션 커스텀',
        description: '섹션 커스텀은 Pro부터 사용할 수 있습니다.',
        _ts: Date.now(),
      });
      alert('섹션 커스텀은 Pro부터 사용할 수 있습니다.');
      return;
    }

    if (optionId === 'custom') {
      onHover({
        id: 'song-structure-custom',
        label: '섹션 커스텀',
        description: optionDescriptions.custom,
        _ts: Date.now(),
      });
      openCustomModal();
      return;
    }

    onSongStructureChange(optionId);

    onHover({
      id: `song-structure-${optionId}`,
      label: `섹션 ${optionId}`,
      description: optionDescriptions[optionId],
      _ts: Date.now(),
    });
  };

  const appendSection = (section: string) => {
    const newItem: CustomSectionItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      section,
      tags: []
    };
    setDraftStructure((prev) => {
      const insertAfter = selectedInsertIndex !== null && selectedInsertIndex >= 0 && selectedInsertIndex < prev.length
        ? selectedInsertIndex
        : prev.length - 1;
      const insertAt = insertAfter + 1;
      const next = [...prev.slice(0, insertAt), newItem, ...prev.slice(insertAt)];
      setSelectedInsertIndex(insertAt);
      return next;
    });
  };

  const removeSectionAt = (index: number) => {
    setDraftStructure((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedInsertIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const hasDraftStructureTags = useMemo(() => (draftStructure ?? []).some((item) => (item.tags ?? []).length > 0), [draftStructure]);
  const canToggleDraftStructureTags = hasDraftStructureTags || Boolean(clearedStructureTagSnapshot?.length);
  const isDraftStructureTagsCleared = !hasDraftStructureTags && Boolean(clearedStructureTagSnapshot?.length);

  const toggleClearDraftStructureTags = useCallback(() => {
    if (isDraftStructureTagsCleared && clearedStructureTagSnapshot?.length) {
      const snapshotById = new Map(clearedStructureTagSnapshot.map((item) => [item.id, item.tags] as const));
      setDraftStructure((prev) => (prev ?? []).map((item) => ({
        ...item,
        tags: snapshotById.get(item.id) ?? item.tags ?? []
      })));
      setClearedStructureTagSnapshot(null);
      return;
    }

    if (!hasDraftStructureTags) return;

    const snapshot = (draftStructure ?? [])
      .filter((item) => (item.tags ?? []).length > 0)
      .map((item) => ({ id: item.id, tags: [...(item.tags ?? [])] }));

    setClearedStructureTagSnapshot(snapshot);
    setDraftStructure((prev) => (prev ?? []).map((item) => ({ ...item, tags: [] })));
    setSelectedInsertIndex(null);
  }, [clearedStructureTagSnapshot, draftStructure, hasDraftStructureTags, isDraftStructureTagsCleared]);

  const handleApplyCustomStructure = () => {
    const nextStructure = normalizeCustomStructure(draftStructure ?? []);

    if (nextStructure.length === 0) {
      onCustomStructureChange([]);
      onSongStructureChange('1');
      setClearedStructureTagSnapshot(null);
      closeCustomModal();
      onHover({
        id: 'song-structure-custom-cleared',
        label: '커스텀 섹션 해제',
        description: '커스텀 섹션이 비어 있어 기본 섹션으로 전환되었습니다.',
        _ts: Date.now(),
      });
      return;
    }

    onCustomStructureChange(nextStructure);
    onSongStructureChange('custom');
    setClearedStructureTagSnapshot(null);
    closeCustomModal();
    onHover({
      id: 'song-structure-custom-applied',
      label: '커스텀 섹션 적용',
      description: formatStructureText(nextStructure),
      _ts: Date.now(),
    });
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim() || '제목없음';
    if ((draftStructure ?? []).length === 0) return;

    if (editingSavedStructureId) {
      const next = savedStructures.map(p => 
        p.id === editingSavedStructureId 
          ? { ...p, name: trimmedName, sections: draftStructure } 
          : p
      );
      persistSavedStructures(next);
    } else {
      const nextPreset: SavedStructurePreset = {
        id: `${Date.now()}`,
        name: trimmedName,
        sections: draftStructure,
        createdAt: Date.now(),
      };
      persistSavedStructures([nextPreset, ...savedStructures].slice(0, 20));
    }
    
    setPresetName('');
    setEditingSavedStructureId(null);
    setStructureSearch('');
    setStructureFilter('all');
    setDeleteConfirmPresetId(null);
    setEditingPresetTitleId(null);
    setEditingPresetTitleDraft('');
    closeSaveStructureModal();
  };

  const handleLoadPreset = (preset: SavedStructurePreset) => {
    const loadedSections = normalizeCustomStructure(preset.sections).map((item, index) => ({
      ...item,
      id: item.id || `${preset.id}-${index}-${Date.now()}`,
      tags: Array.isArray(item.tags) ? [...item.tags] : [],
    }));
    setDraftStructure(loadedSections);
    setSelectedInsertIndex(null);
    setClearedStructureTagSnapshot(null);
    setPresetName(preset.name);
    setEditingSavedStructureId(preset.id);
    setDeleteConfirmPresetId(null);
    setEditingPresetTitleId(null);
    setEditingPresetTitleDraft('');
  };

  const startEditPresetTitle = (preset: SavedStructurePreset) => {
    setDeleteConfirmPresetId(null);
    setEditingPresetTitleId(preset.id);
    setEditingPresetTitleDraft(preset.name);
  };

  const cancelEditPresetTitle = () => {
    setEditingPresetTitleId(null);
    setEditingPresetTitleDraft('');
  };

  const confirmEditPresetTitle = (presetId: string) => {
    const trimmedName = editingPresetTitleDraft.trim();
    if (!trimmedName) {
      cancelEditPresetTitle();
      return;
    }
    persistSavedStructures(savedStructures.map((preset) => (
      preset.id === presetId ? { ...preset, name: trimmedName } : preset
    )));
    cancelEditPresetTitle();
  };

  const handleDeletePreset = (presetId: string) => {
    if (deleteConfirmPresetId !== presetId) {
      setDeleteConfirmPresetId(presetId);
      window.setTimeout(() => {
        setDeleteConfirmPresetId((current) => current === presetId ? null : current);
      }, 2600);
      return;
    }
    persistSavedStructures(savedStructures.filter((preset) => preset.id !== presetId));
    setDeleteConfirmPresetId(null);
    if (editingPresetTitleId === presetId) cancelEditPresetTitle();
  };

  const handleToggleReaction = (presetId: string, reaction: 'like' | 'dislike') => {
    setDeleteConfirmPresetId(null);
    const next = savedStructures.map(p => {
      if (p.id === presetId) {
        return {
          ...p,
          reaction: p.reaction === reaction ? null : reaction
        };
      }
      return p;
    });
    persistSavedStructures(next);
  };

  const filteredSavedStructures = useMemo(() => {
    return savedStructures.filter(preset => {
      const matchesSearch = preset.name.toLowerCase().includes(structureSearch.toLowerCase()) ||
                          formatStructureText(preset.sections).toLowerCase().includes(structureSearch.toLowerCase());
      const matchesFilter = structureFilter === 'all' || preset.reaction === structureFilter;
      return matchesSearch && matchesFilter;
    });
  }, [savedStructures, structureSearch, structureFilter]);


  const renderSavedSectionPanel = (modalMode = false) => (
    <div className={cn(
      "h-full rounded-2xl border border-[var(--border-color)] p-4 min-w-0 overflow-hidden flex flex-col",
      modalMode ? "bg-[var(--card-bg)]" : ""
    )}>
      <div className="flex flex-col gap-3 mb-4 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-[#A8C49F] uppercase tracking-wider">Keep 섹션</p>
          <span className="text-[11px] text-[var(--text-secondary)]">{filteredSavedStructures.length} / {savedStructures.length}개</span>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={structureSearch}
              onChange={(e) => setStructureSearch(e.target.value)}
              placeholder="섹션 이름 또는 내용 검색..."
              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-btn-border pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-1 focus:ring-[#658761]/40 shadow-inner"
            />
            {structureSearch && (
              <button onClick={() => setStructureSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-[var(--text-secondary)]" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {(['all', 'like', 'dislike'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStructureFilter(f)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1.5 shadow-btn",
                  structureFilter === f
                    ? "bg-[#658761]/20 border-black/20 text-[#A8C49F]"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
              >
                {f === 'all' && '전체'}
                {f === 'like' && <><ThumbsUp className="w-3 h-3" /> </>}
                {f === 'dislike' && <><ThumbsDown className="w-3 h-3" /> </>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2">
        {filteredSavedStructures.length === 0 ? (
          <div className="rounded-xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-6 text-center">
            <Search className="w-6 h-6 text-[var(--text-secondary)]/30 mx-auto mb-2" />
            <p className="text-[12px] text-[var(--text-secondary)]">
              {structureSearch || structureFilter !== 'all' ? '검색 결과가 없습니다.' : 'Keep 섹션이 없습니다.'}
            </p>
          </div>
        ) : (
          filteredSavedStructures.map((preset) => (
            <div key={preset.id} className="relative rounded-2xl bg-[var(--bg-secondary)] border border-btn-border p-3 min-h-[132px] hover:border-black/20/30 transition-all group shadow-sm overflow-hidden min-w-0">
              <div className="absolute right-3 top-2 z-10 flex items-center gap-1.5">
                {editingPresetTitleId === preset.id ? (
                  <button
                    onClick={() => confirmEditPresetTitle(preset.id)}
                    className="w-7 h-7 rounded-lg border bg-[#658761]/20 border-black/20/50 text-[#A8C49F] hover:bg-[#658761]/30 transition-all flex items-center justify-center"
                    aria-label="Keep 섹션 이름 수정 완료"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => startEditPresetTitle(preset)}
                    className="w-7 h-7 rounded-lg border bg-white/5 border-white/15 text-[var(--text-secondary)] hover:text-[#A8C49F] hover:border-black/20 hover:bg-[#658761]/10 transition-all flex items-center justify-center"
                    aria-label="Keep 섹션 이름 편집"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDeletePreset(preset.id)}
                  className={cn(
                    "w-7 h-7 rounded-lg border bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center",
                    deleteConfirmPresetId === preset.id && "bg-red-500/20 border-red-400 text-red-200"
                  )}
                  aria-label="Keep 섹션 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <AnimatePresence>
                {deleteConfirmPresetId === preset.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-3 top-10 z-20 w-36 rounded-xl border border-red-500/40 bg-[var(--card-bg)] px-2.5 py-2 text-[10px] font-bold text-red-300 shadow-xl pointer-events-none"
                  >
                    한번 더 클릭시 삭제됩니다
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="min-w-0 pr-20">
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  {editingPresetTitleId === preset.id ? (
                    <input
                      autoFocus
                      value={editingPresetTitleDraft}
                      onChange={(e) => setEditingPresetTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEditPresetTitle(preset.id);
                        if (e.key === 'Escape') cancelEditPresetTitle();
                      }}
                      className="min-w-0 flex-1 rounded-lg bg-black/20 border border-black/20 px-2 py-1 text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                    />
                  ) : (
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{preset.name}</p>
                  )}
                  {preset.reaction && editingPresetTitleId !== preset.id && (
                    <span className={cn(
                      "shrink-0 p-1 rounded-md",
                      preset.reaction === 'like' ? "bg-[#658761]/20 text-[#A8C49F]" : "bg-btn-bg text-[var(--text-secondary)] shadow-btn border border-btn-border"
                    )}>
                      {preset.reaction === 'like' ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="mt-2 h-9 w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-btn-border bg-black/10 px-3 flex items-center saved-structure-scroll cursor-grab active:cursor-grabbing overscroll-x-contain"
                title={formatStructureText(preset.sections)}
              >
                <span className="inline-block whitespace-nowrap text-[11px] text-[var(--text-secondary)] leading-none">
                  {formatStructureText(preset.sections)}
                </span>
              </div>
              <div className="mt-3 flex gap-2 min-w-0">
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => handleToggleReaction(preset.id, 'like')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      preset.reaction === 'like' ? "bg-[#658761] text-[#171717] font-black shadow-sm" : "text-[var(--text-secondary)] hover:bg-white/10"
                    )}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleReaction(preset.id, 'dislike')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      preset.reaction === 'dislike' ? "bg-[#658761]/16 text-[#171717] font-black shadow-sm" : "text-[var(--text-secondary)] hover:bg-white/10"
                    )}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleLoadPreset(preset);
                    if (modalMode) closeSavedSectionsModal();
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-[#658761]/10 border border-black/20/25 text-[11px] font-bold text-[#A8C49F] hover:bg-[#658761]/16 transition-all"
                >
                  불러오기
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-[var(--card-bg)] rounded-3xl p-5 border border-[var(--home-card-border)] flex flex-col h-full shadow-[var(--shadow-md)] relative pb-12 overflow-visible">
        <div className="relative mb-4 flex items-center justify-between">
          <h3 
            onMouseEnter={() => setShowTitleTooltip(true)}
            onMouseLeave={() => setShowTitleTooltip(false)}
            className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
          >
            <span className="w-1.5 h-5 bg-[#658761] rounded-full" />
            섹션구조
          </h3>
          <div className="flex items-center gap-2">
            {onToggleLock && (
              <button
                type="button"
                onClick={onToggleLock}
                onMouseEnter={() => onHover({ id: 'song-structure-lock', label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? '섹션 구조를 랜덤 선택에 다시 포함합니다.' : '현재 섹션 구조 설정을 유지하고 랜덤 선택에서 제외합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "p-2 rounded-lg transition-all border border-btn-border shadow-btn",
                  isLocked
                    ? "bg-[#658761]/72 text-[#171717] font-black border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                    : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
                title={isLocked ? '잠금 해제' : '메뉴 잠금'}
                aria-label={isLocked ? '섹션 구조 잠금 해제' : '섹션 구조 잠금'}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'song-structure-integrated-clear', label: '초기화', description: '섹션 설정을 초기화합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2 rounded-lg transition-all border shadow-btn",
                (lyricsLength !== 'normal' || songStructure !== '1' || (customStructure ?? []).length > 0)
                  ? "bg-[#658761]/20 text-[#A8C49F] border-black/20/30 hover:bg-[#658761]/30" 
                  : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <AnimatePresence>
            {showTitleTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-black/20/30 shadow-2xl w-56 pointer-events-none"
              >
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug">가사 분량과 곡의 전개 방식을 통합적으로 설정합니다.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col flex-1 overflow-visible">
          <motion.div 
            animate={{ height: contentHeight }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div ref={contentRef} className="space-y-3 flex-1 flex flex-col justify-start">
              {/* 1. 가사 길이 */}
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-[#A8C49F] uppercase tracking-wider">│가사 길이</p>
                <div className="flex gap-2">
                  {lyricsOptions.map((opt) => (
                    <div key={opt.id} className="relative flex-1">
                      <button
                        onClick={() => {
                          onLyricsLengthChange(opt.id as LyricsLength);
                          onHover({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description, _ts: Date.now() });
                        }}
                        onMouseEnter={() => onHover({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "w-full py-1.5 rounded-xl text-[13px] font-bold transition-all border shadow-sm",
                          lyricsLength === opt.id
                            ? "bg-[#658761] border-black/20 text-[#171717] font-black shadow-lg shadow-[#658761]/20"
                            : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                        )}
                      >
                        {opt.labelKo || opt.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-1/2 h-[1px] bg-btn-border/50" />
              </div>

              {/* 3. 섹션 */}
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-[#A8C49F] uppercase tracking-wider">│섹션</p>
                <div className="grid grid-cols-4 gap-2">
                  {structureOptions.map((opt) => {
                    const isCustomLocked = opt.id === 'custom' && userTier === 'free';
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectStructure(opt.id as SongStructure)}
                        onMouseEnter={() => onHover({ id: `song-structure-${opt.id}`, label: `섹션 ${opt.label}`, description: isCustomLocked ? '섹션 커스텀은 Pro부터 사용할 수 있습니다.' : opt.description })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: `song-structure-${opt.id}`, label: `섹션 ${opt.label}`, description: isCustomLocked ? '섹션 커스텀은 Pro부터 사용할 수 있습니다.' : opt.description })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "py-1.5 rounded-xl text-[13px] font-bold transition-all border flex items-center justify-center gap-1.5 shadow-sm",
                          songStructure === opt.id
                            ? "bg-[#658761] border-black/20 text-[#171717] font-black shadow-lg shadow-[#658761]/20"
                            : isCustomLocked
                              ? "bg-btn-bg border-btn-border text-[var(--text-secondary)]/60 hover:bg-btn-hover"
                              : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                        )}
                      >
                        {opt.label}
                        {isCustomLocked && <Lock className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
                
                {/* Structure Guide - Always Visible */}
                <div className="mt-2 rounded-2xl border border-dashed border-black/20/30 px-3 py-3 bg-[#658761]/5">
                  <p className="text-[10px] font-bold text-[#A8C49F] mb-1 uppercase tracking-tight">
                    {songStructure === 'custom' ? '현재 커스텀 섹션' : songStructure === '1' ? '기본 섹션 상세 가이드' : `섹션 ${songStructure === '2' ? '1' : '2'} 상세 가이드`}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">
                    {songStructure === '1' && "장르에 따라 안정적인 기본 뼈대를 고른 뒤 Hook, Break, Drop, Instrumental, Bridge를 필요한 곳에만 섞습니다. 대중적인 흐름은 유지하고, 중간 전환만 세련되게 변주합니다."}
                    {songStructure === '2' && "Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro"}
                    {songStructure === '3' && "Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro"}
                    {songStructure === 'custom' && (
                      (customStructure ?? []).length > 0 ? formatStructureText(customStructure) : '직접 섹션을 지정하는 모드입니다.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isCustomModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4 overscroll-none"
            onPointerDown={(e) => {
              customModalBackdropMouseDownRef.current = e.target === e.currentTarget;
            }}
            onPointerUp={(e) => {
              if (customModalBackdropMouseDownRef.current && e.target === e.currentTarget) {
                customModalBackdropMouseDownRef.current = false;
                handleApplyCustomStructure();
                return;
              }
              customModalBackdropMouseDownRef.current = false;
            }}
            onPointerCancel={() => {
              customModalBackdropMouseDownRef.current = false;
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
              className="w-full max-w-4xl h-[86vh] rounded-3xl bg-[var(--card-bg)] border border-[var(--modal-soft-border)] shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[var(--modal-soft-border)] flex items-start justify-between gap-4 shrink-0">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">섹션 커스텀</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">섹션을 직접 추가하고 순서를 바꿔 원하는 섹션 구성을 만드세요.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasDraftStructureSelection && (
                    <button
                      type="button"
                      onClick={resetDraftStructure}
                      className="h-10 px-3 rounded-xl border border-black/20/30 bg-[#658761]/10 text-[#A8C49F] hover:bg-[#658761]/20 transition-all text-[11px] font-black whitespace-nowrap"
                      title="섹션 전체 해제"
                    >
                      전체 해제
                    </button>
                  )}
                  {hasCustomStructureModalChanges && (
                    <button
                      type="button"
                      onClick={handleApplyCustomStructure}
                      disabled={!canApplyCustomStructureDraft}
                      className={cn(
                        "w-10 h-10 rounded-xl border flex items-center justify-center transition-all shrink-0",
                        canApplyCustomStructureDraft
                          ? "bg-[#658761] text-[#171717] font-black border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)] hover:bg-[#6F946A]"
                          : "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/50 cursor-not-allowed"
                      )}
                      title="변경 적용"
                      aria-label="변경 적용"
                    >
                      <Check className="w-[18px] h-[18px]" />
                    </button>
                  )}
                  <button
                    onClick={() => closeCustomModal()}
                    className="w-10 h-10 rounded-xl border border-[var(--modal-button-border)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[#A8C49F] hover:border-black/20 hover:bg-[#658761]/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#658761]/25 transition-all flex items-center justify-center shrink-0"
                    aria-label={hasCustomStructureModalChanges ? "변경 적용 없이 닫기" : "섹션 커스텀 닫기"}
                    title={hasCustomStructureModalChanges ? "변경 적용 없이 닫기" : "닫기"}
                  >
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 min-h-0 space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs font-bold text-[#A8C49F] uppercase tracking-wider">섹션 추가</p>
                    <div className="flex gap-1 rounded-xl bg-black/10 border border-[var(--modal-button-border)] p-1">
                      {(['all', 'basic', 'my'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setSectionLibraryFilter(filter)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                            sectionLibraryFilter === filter
                              ? "bg-[#658761] text-[#171717] font-black"
                              : "text-[var(--text-secondary)] hover:bg-white/10"
                          )}
                        >
                          {filter === 'all' ? '전체' : filter === 'basic' ? '기본 섹션' : 'MY 섹션'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allStructureSections.map(({ label: section, custom }) => {
                      const displaySection = custom ? custom.label : section;
                      const meta = SECTION_META[section] || (custom ? { tier: 'free' as TagTier, descriptionKo: custom.labelKo || custom.description || custom.promptFull || custom.tagCue || custom.label } : undefined);
                      const sectionTier = meta?.tier || 'free';
                      const isLocked = (sectionTier === 'pro' && userTier !== 'pro') || 
                                       (sectionTier === 'basic' && userTier === 'free');

                      return (
                        <button
                          key={custom?.id || section}
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              const tierLabel = sectionTier === 'pro' ? 'Pro' : 'Basic';
                              alert(`이 섹션은 ${tierLabel} 플랜 전용 기능입니다.`);
                              return;
                            }
                            appendSection(section);
                          }}
                          onMouseEnter={() => onHover({ 
                            id: `section-add-${section}`, 
                            label: section,
                            labelKo: custom?.labelKo || displaySection, 
                            description: isLocked 
                              ? `${sectionTier === 'pro' ? 'Pro' : 'Basic'} 플랜 전용 섹션입니다.` 
                              : custom
                                ? (custom.labelKo || custom.description || custom.promptFull || custom.tagCue || custom.label || getSectionShortDescription(section))
                                : getSectionShortDescription(section)
                            })
                          }
                          onMouseLeave={() => onHover(null)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all border flex items-center gap-1.5 shadow-btn",
                            isLocked 
                              ? "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/40 cursor-not-allowed"
                              : "bg-btn-bg border-[var(--modal-button-border)] text-[var(--text-primary)] hover:bg-btn-hover"
                          )}
                        >
                          {displaySection}
                          {custom && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCustomSectionEditor(custom); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openCustomSectionEditor(custom); } }}
                              className="ml-1 inline-flex items-center rounded-md px-1.5 py-1 text-[#A8C49F] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all"
                              title="내 섹션 수정"
                            >
                              <Edit2 className="w-[22px] h-[22px]" />
                            </span>
                          )}
                          {isLocked && <Lock className="w-3 h-3" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => openCustomSectionEditor()}
                      className="px-3.5 py-2 rounded-xl border border-[var(--modal-button-border)] bg-white/5 text-[var(--text-primary)] text-[13px] font-black transition-all hover:bg-white/10 flex items-center gap-1.5 shadow-btn"
                    >
                      <Plus className="w-3.5 h-3.5" /> 섹션 추가
                    </button>
                  </div>

                  {isCustomSectionEditorOpen && (
                    <div
                      className="fixed inset-0 z-[185] flex items-center justify-center px-4 backdrop-blur-[1.5px]"
                      onMouseDown={(e) => { customSectionEditorBackdropMouseDownRef.current = e.target === e.currentTarget; }}
                      onClick={(e) => {
                        if (customSectionEditorBackdropMouseDownRef.current && e.target === e.currentTarget) {
                          void saveCustomSectionDefinition();
                        }
                        customSectionEditorBackdropMouseDownRef.current = false;
                      }}
                    >
                      <div
                        className="w-[min(92vw,460px)] rounded-2xl border border-black/20 bg-[var(--card-bg)] shadow-2xl p-4 space-y-3"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#A8C49F]">커스텀 섹션 {editingCustomSectionId ? '수정' : '추가'}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {editingCustomSectionId ? '한글은 설명용, 영어는 실제 가사 태그용입니다.' : '한글 섹션명만 입력하면 영어 태그명은 자동 생성됩니다.'}
                            </p>
                          </div>
                          <button type="button" onClick={() => closeCustomSectionEditor()} className="p-2 rounded-xl bg-btn-bg border border-[var(--modal-button-border)] text-[var(--text-secondary)]"><X className="w-[18px] h-[18px]" /></button>
                        </div>
                        <input
                          value={customSectionDraft.labelKo}
                          onChange={(e) => setCustomSectionDraft((prev) => ({ ...prev, labelKo: e.target.value }))}
                          placeholder="한글 섹션명: 예: 속삭이는 랩"
                          className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                        />
                        {editingCustomSectionId && (
                          <input
                            value={customSectionDraft.labelEn}
                            onChange={(e) => setCustomSectionDraft((prev) => ({ ...prev, labelEn: e.target.value }))}
                            placeholder="영어 태그명: 예: Whisper Rap"
                            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                          />
                        )}
                        <div className={cn("grid gap-2", editingCustomSectionId ? "grid-cols-3" : "grid-cols-2")}>
                          {editingCustomSectionId && (
                            <button
                              type="button"
                              onClick={() => { deleteCustomSectionDefinition(editingCustomSectionId); closeCustomSectionEditor(); }}
                              className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-sm font-bold text-red-300"
                            >
                              삭제
                            </button>
                          )}
                          <button type="button" onClick={() => closeCustomSectionEditor()} className="py-2.5 rounded-xl bg-btn-bg border border-[var(--modal-button-border)] text-sm font-bold text-[var(--text-primary)]">취소</button>
                          <button type="button" onClick={saveCustomSectionDefinition} disabled={isCustomSectionConverting} className="py-2.5 rounded-xl bg-[#658761] border border-black/20 text-sm font-bold text-[#171717] disabled:opacity-60">{isCustomSectionConverting ? '자동 변환 중...' : '저장'}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 min-w-0">
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-stretch min-w-0">
                    <div className="flex-1 min-w-0 rounded-2xl bg-[var(--hover-bg)]/60 border border-[var(--border-color)] px-4 py-3 overflow-hidden">
                      <p className="text-[11px] font-bold text-[#A8C49F] mb-2">미리보기</p>
                      <div className="h-[42px] overflow-y-auto pr-1 custom-scrollbar">
                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words">
                          {(draftStructure ?? []).length > 0 ? formatStructureText(draftStructure) : '섹션을 추가하면 현재 구조가 여기에 표시됩니다.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 shrink-0 w-full lg:w-auto">
                      <button
                        type="button"
                        onClick={openSavedSectionsModal}
                        title="Keep 섹션"
                        aria-label="Keep 섹션"
                        className="xl:hidden w-10 h-10 rounded-xl border border-black/20/45 bg-[#658761]/10 text-[#A8C49F] hover:bg-[#658761]/15 transition-all shadow-btn flex items-center justify-center"
                      >
                        <Bookmark className="w-[18px] h-[18px]" />
                      </button>
                      <button
                        onClick={openSaveStructureModal}
                        className={cn(
                          "px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border transition-all font-bold text-xs sm:text-sm shadow-btn",
                          (draftStructure ?? []).length > 0
                            ? "bg-btn-bg text-[#A8C49F] border-black/20 hover:bg-[#658761]/10"
                            : "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/50 cursor-not-allowed"
                        )}
                        disabled={(draftStructure ?? []).length === 0}
                      >
                        저장
                      </button>
                    </div>
                  </div>


                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.72fr)] gap-4 min-w-0 items-stretch">
                    <div className="space-y-3 min-w-0 flex flex-col h-[520px]">
                      <div className="flex items-center justify-between gap-3 shrink-0">
                        <p className="text-xs font-bold text-[#A8C49F] uppercase tracking-wider">현재 구조</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={toggleClearDraftStructureTags}
                            disabled={!canToggleDraftStructureTags}
                            title={isDraftStructureTagsCleared ? '태그 되돌리기' : '적용된 태그 전체삭제'}
                            aria-label={isDraftStructureTagsCleared ? '태그 되돌리기' : '적용된 태그 전체삭제'}
                            className={cn(
                              "relative w-9 h-9 rounded-xl border transition-all shadow-btn flex items-center justify-center",
                              canToggleDraftStructureTags
                                ? isDraftStructureTagsCleared
                                  ? "bg-[#658761]/10 border-black/20/45 text-[#A8C49F] hover:bg-[#658761]/15"
                                  : "bg-red-500/5 border-red-400/45 text-[var(--text-secondary)] hover:border-red-300/70 hover:bg-red-500/10"
                                : "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/35 cursor-not-allowed"
                            )}
                          >
                            <Tag className={cn("w-4 h-4", canToggleDraftStructureTags && !isDraftStructureTagsCleared && "text-[var(--text-secondary)]")} />
                            {isDraftStructureTagsCleared ? (
                              <RotateCcw className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-[var(--bg-secondary)] text-[#A8C49F] p-[1px]" />
                            ) : (
                              <X className={cn("absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-[var(--bg-secondary)] p-[1px]", canToggleDraftStructureTags ? "text-red-300 ring-1 ring-red-400/35" : "text-[var(--text-secondary)]/35")} />
                            )}
                          </button>
                          <div className="h-7 w-px bg-[var(--border-color)] mx-1" aria-hidden="true" />
                          <button
                            onClick={resetDraftStructure}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-btn",
                              (draftStructure ?? []).length > 0 || editingSavedStructureId
                                ? "bg-btn-bg border-[var(--modal-button-border)] text-[var(--text-primary)] hover:bg-btn-hover"
                                : "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/50 cursor-not-allowed"
                            )}
                            disabled={(draftStructure ?? []).length === 0 && !editingSavedStructureId}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleApplyCustomStructure}
                            disabled={!canApplyCustomStructureDraft}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-btn",
                              canApplyCustomStructureDraft
                                ? "bg-[#658761] text-[#171717] font-black border-black/20 hover:brightness-110"
                                : "bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)]/50 cursor-not-allowed"
                            )}
                          >
                            적용
                          </button>
                        </div>
                      </div>

                      <div
                        ref={currentStructureScrollRef}
                        className={cn(
                          "flex-1 min-h-0 rounded-2xl border border-dashed border-[var(--border-color)] p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2 overscroll-contain",
                          isReorderDragging && "cursor-grabbing select-none"
                        )}
                      >
                        {(draftStructure ?? []).length === 0 ? (
                          <div className="h-full min-h-[150px] flex items-center justify-center text-center text-[12px] text-[var(--text-secondary)]">
                            구조가 비어 있습니다. 위의 섹션 버튼을 눌러 추가하세요.
                          </div>
                        ) : (
                          (draftStructure ?? []).map((item, index) => (
                            <ReorderableSectionItem
                              key={item.id}
                              item={item}
                              index={index}
                              onEdit={setEditingSectionIndex}
                              onRemove={removeSectionAt}
                              onHover={onHover}
                              onSelect={setSelectedInsertIndex}
                              onDragStart={handleSectionReorderPointerDown}
                              isReorderDragging={isReorderDragging}
                              isDraggingItem={draggingSectionId === item.id}
                              isInsertionTarget={selectedInsertIndex === index}
                              sectionDisplayLabel={customSectionMap.get(String(item.section))?.label || String(item.section)}
                              tagDisplayLabel={getStructureTagDisplay}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="hidden xl:block min-w-0 overflow-hidden h-[520px]">
                      <div className="h-full rounded-2xl border border-[var(--border-color)] p-4 min-w-0 overflow-hidden flex flex-col">
                      <div className="flex flex-col gap-3 mb-4 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-[#A8C49F] uppercase tracking-wider">Keep 섹션</p>
                          <span className="text-[11px] text-[var(--text-secondary)]">{filteredSavedStructures.length} / {savedStructures.length}개</span>
                        </div>
                        
                        {/* Search and Filters */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            <input
                              type="text"
                              value={structureSearch}
                              onChange={(e) => setStructureSearch(e.target.value)}
                              placeholder="섹션 이름 또는 내용 검색..."
                              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-1 focus:ring-[#658761]/40 shadow-inner"
                            />
                            {structureSearch && (
                              <button 
                                onClick={() => setStructureSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                              >
                                <X className="w-3 h-3 text-[var(--text-secondary)]" />
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-1">
                            {(['all', 'like', 'dislike'] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setStructureFilter(f)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1.5 shadow-btn",
                                  structureFilter === f
                                    ? "bg-[#658761]/20 border-black/20 text-[#A8C49F]"
                                    : "bg-btn-bg border-[var(--modal-button-border)] text-[var(--text-secondary)] hover:bg-btn-hover"
                                )}
                              >
                                {f === 'all' && '전체'}
                                {f === 'like' && <><ThumbsUp className="w-3 h-3" /> </>}
                                {f === 'dislike' && <><ThumbsDown className="w-3 h-3" /> </>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                        {filteredSavedStructures.length === 0 ? (
                          <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] px-3 py-6 text-center">
                            <Search className="w-6 h-6 text-[var(--text-secondary)]/30 mx-auto mb-2" />
                            <p className="text-[12px] text-[var(--text-secondary)]">
                              {structureSearch || structureFilter !== 'all' ? '검색 결과가 없습니다.' : 'Keep 섹션이 없습니다.'}
                            </p>
                          </div>
                        ) : (
                          filteredSavedStructures.map((preset) => (
                            <div key={preset.id} className="relative rounded-2xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] p-3 min-h-[132px] hover:border-black/20/30 transition-all group shadow-sm overflow-hidden min-w-0">
                              <div className="absolute right-3 top-2 z-10 flex items-center gap-1.5">
                                {editingPresetTitleId === preset.id ? (
                                  <button
                                    onClick={() => confirmEditPresetTitle(preset.id)}
                                    className="w-7 h-7 rounded-lg border bg-[#658761]/20 border-black/20/50 text-[#A8C49F] hover:bg-[#658761]/30 transition-all flex items-center justify-center"
                                    aria-label="Keep 섹션 이름 수정 완료"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => startEditPresetTitle(preset)}
                                    className="w-7 h-7 rounded-lg border bg-white/5 border-[var(--modal-button-border)] text-[var(--text-secondary)] hover:text-[#A8C49F] hover:border-black/20 hover:bg-[#658761]/10 transition-all flex items-center justify-center"
                                    aria-label="Keep 섹션 이름 편집"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePreset(preset.id)}
                                  className={cn(
                                    "w-7 h-7 rounded-lg border bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center",
                                    deleteConfirmPresetId === preset.id && "bg-red-500/20 border-red-400 text-red-200"
                                  )}
                                  aria-label="Keep 섹션 삭제"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <AnimatePresence>
                                {deleteConfirmPresetId === preset.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="absolute right-3 top-10 z-20 w-36 rounded-xl border border-red-500/40 bg-[var(--card-bg)] px-2.5 py-2 text-[10px] font-bold text-red-300 shadow-xl pointer-events-none"
                                  >
                                    한번 더 클릭시 삭제됩니다
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              <div className="min-w-0 pr-20">
                                <div className="flex items-center gap-2 mb-1 min-w-0">
                                  {editingPresetTitleId === preset.id ? (
                                    <input
                                      autoFocus
                                      value={editingPresetTitleDraft}
                                      onChange={(e) => setEditingPresetTitleDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmEditPresetTitle(preset.id);
                                        if (e.key === 'Escape') cancelEditPresetTitle();
                                      }}
                                      className="min-w-0 flex-1 rounded-lg bg-black/20 border border-black/20 px-2 py-1 text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{preset.name}</p>
                                  )}
                                  {preset.reaction && editingPresetTitleId !== preset.id && (
                                    <span className={cn(
                                      "shrink-0 p-1 rounded-md",
                                      preset.reaction === 'like' ? "bg-[#658761]/20 text-[#A8C49F]" : "bg-btn-bg text-[var(--text-secondary)] shadow-btn border border-[var(--modal-button-border)]"
                                    )}>
                                      {preset.reaction === 'like' ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div
                                className="mt-2 h-9 w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--modal-button-border)] bg-black/10 px-3 flex items-center saved-structure-scroll cursor-grab active:cursor-grabbing overscroll-x-contain"
                                title={formatStructureText(preset.sections)}
                              >
                                <span className="inline-block whitespace-nowrap text-[11px] text-[var(--text-secondary)] leading-none">
                                  {formatStructureText(preset.sections)}
                                </span>
                              </div>
                              
                              <div className="mt-3 flex gap-2 min-w-0">
                                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-[var(--modal-button-border)]">
                                  <button
                                    onClick={() => handleToggleReaction(preset.id, 'like')}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      preset.reaction === 'like'
                                        ? "bg-[#658761] text-[#171717] font-black shadow-sm"
                                        : "text-[var(--text-secondary)] hover:bg-white/10"
                                    )}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleReaction(preset.id, 'dislike')}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      preset.reaction === 'dislike'
                                        ? "bg-[#658761]/16 text-[#171717] font-black shadow-sm"
                                        : "text-[var(--text-secondary)] hover:bg-white/10"
                                    )}
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleLoadPreset(preset)}
                                  className="flex-1 py-1.5 rounded-xl bg-[#658761]/10 border border-black/20/25 text-[11px] font-bold text-[#A8C49F] hover:bg-[#658761]/16 transition-all"
                                >
                                  불러오기
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSavedSectionsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex items-center justify-center px-4 backdrop-blur-[1.5px]"
            onMouseDown={(e) => { savedSectionsModalBackdropMouseDownRef.current = e.target === e.currentTarget; }}
            onClick={(e) => {
              if (savedSectionsModalBackdropMouseDownRef.current && e.target === e.currentTarget) closeSavedSectionsModal();
              savedSectionsModalBackdropMouseDownRef.current = false;
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-[min(94vw,440px)] h-[82vh] rounded-3xl bg-[var(--card-bg)] border border-[var(--modal-soft-border)] shadow-2xl overflow-hidden flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-[var(--modal-soft-border)] flex items-center justify-between gap-3 shrink-0">
                <div>
                  <p className="text-sm font-black text-[#A8C49F]">Keep 섹션</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">저장된 섹션 구성을 불러오거나 편집합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => closeSavedSectionsModal()}
                  className="w-9 h-9 rounded-xl border border-[var(--modal-soft-border)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center shrink-0"
                >
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>
              <div className="flex-1 min-h-0 p-3 overflow-hidden">
                {renderSavedSectionPanel(true)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSaveStructureModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] bg-black/0 backdrop-blur-[1px] flex items-center justify-center px-4"
            onMouseDown={(e) => {
              saveStructureModalBackdropMouseDownRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              if (saveStructureModalBackdropMouseDownRef.current && e.target === e.currentTarget) closeSaveStructureModal();
              saveStructureModalBackdropMouseDownRef.current = false;
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-md rounded-2xl bg-[var(--card-bg)] border border-black/20/35 shadow-2xl overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[var(--modal-soft-border)] flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#A8C49F]">저장</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">현재 구조를 저장할 제목을 입력합니다.</p>
                </div>
                <button
                  onClick={() => closeSaveStructureModal()}
                  className="w-9 h-9 rounded-xl border border-[var(--modal-button-border)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center shrink-0"
                >
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <input
                  autoFocus
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (draftStructure ?? []).length > 0) handleSavePreset();
                  }}
                  placeholder="예: 감성 발라드형"
                  className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--modal-button-border)] px-3 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[#658761]/40 shadow-inner"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => closeSaveStructureModal()}
                    className="py-3 rounded-xl bg-btn-bg border border-[var(--modal-button-border)] text-sm font-bold text-[var(--text-primary)] hover:bg-btn-hover transition-all"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePreset}
                    disabled={(draftStructure ?? []).length === 0}
                    className="py-3 rounded-xl bg-[#658761] border border-black/20 text-sm font-bold text-[#171717] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {editingSavedStructureId ? '업데이트 저장' : '저장'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingSectionIndex !== null && (
          <TagEditModal
            isOpen={true}
            onClose={() => setEditingSectionIndex(null)}
            section={draftStructure[editingSectionIndex]?.section || ''}
            tags={draftStructure[editingSectionIndex]?.tags || []}
            onSave={(newTags) => {
              setDraftStructure(prev => {
                const next = [...prev];
                if (next[editingSectionIndex]) {
                  next[editingSectionIndex] = { ...next[editingSectionIndex], tags: newTags };
                }
                return next;
              });
              setEditingSectionIndex(null);
            }}
            onHover={onHover}
            onLongPressStart={onLongPressStart}
            onLongPressEnd={onLongPressEnd}
            userTier={userTier}
            sectionTags={sectionTags}
            pointSoundTags={pointSoundTags}
            pointSoundTagLabels={pointSoundTagLabels}
            vocalSectionTags={vocalSectionTags}
            customSectionTags={userCustomSectionTags}
            customSections={userCustomSections}
            onCustomSectionTagsChange={persistUserCustomSectionTags}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface SongStructureControlProps {
  value: SongStructure;
  customStructure: CustomSectionItem[];
  onChange: (val: SongStructure) => void;
  onCustomStructureChange: (sections: CustomSectionItem[]) => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  user: User | null;
  userTier: TagTier;
}


// SORIDRAW_SECTION_TAG_KOREAN_DISPLAY_V32
const SECTION_TAG_LABEL_KO_LOCAL: Record<string, string> = {
  'Solo': '솔로',
  'Duet': '듀엣',
  'Group': '그룹',
  'Rap': '랩',
  'Harmony': '화음',
  'Adlib': '애드리브',
  'Minimal': '미니멀',
  'Minimalist': '미니멀리스트',
  'Ambient': '앰비언트',
  'Ambient Start': '앰비언트 시작',
  'Slow Build': '천천히 쌓기',
  'Hook-first': '훅 먼저',
  'Soft Entry': '부드러운 진입',
  'Instrumental Opening': '연주 오프닝',
  'Gradual Layering': '점진적 레이어링',
  'Teaser Opening': '티저 오프닝',
  'Muted emotion': '절제된 감정',
  'Restrained': '절제된 표현',
  'Urgent': '긴박한 진입',
  'piano solo': '피아노 솔로',
  'soft melancholic melody': '부드러운 멜랑콜리 멜로디',
  'vinyl crackle': '바이닐 노이즈',
  'Low Energy': '낮은 에너지',
  'Story Focused': '이야기 중심',
  'Rhythmic Flow': '리듬 흐름',
  'Sparse Arrangement': '비워둔 편곡',
  'Groove Driven': '그루브 중심',
  'Laid-back': '느긋한 무드',
  'Steady Pace': '안정된 진행',
  'Subtle Build': '은근한 빌드업',
  'Build-up': '빌드업',
  'Rising Energy': '상승 에너지',
  'Tension Lift': '긴장감 상승',
  'Dynamic Increase': '다이내믹 증가',
  'Momentum Shift': '흐름 전환',
  'Intensity Growth': '강도 상승',
  'Lead-in': '진입 유도',
  'Anticipation': '기대감 조성',
  'High Energy': '높은 에너지',
  'Explosive': '폭발감',
  'Full Arrangement': '풀 편곡',
  'Peak Section': '피크 구간',
  'Anthemic': '앤섬 느낌',
  'Wide Impact': '넓은 임팩트',
  'Powerful Delivery': '강한 전달감',
  'Hook Emphasis': '후렴 강조',
  'Breakdown': '브레이크다운',
  'Contrast Section': '대비 구간',
  'Energy Drop': '에너지 다운',
  'Minimal Reset': '미니멀 리셋',
  'Unexpected Shift': '예상 밖 전환',
  'Dynamic Change': '다이내믹 변화',
  'Rebuild Start': '재빌드 시작',
  'Transition Focused': '전환 중심',
  'Fade-out': '페이드아웃',
  'Soft Ending': '부드러운 엔딩',
  'Gradual Exit': '점진적 퇴장',
  'Echo Finish': '에코 마무리',
  'Energy Release': '에너지 해소',
  'Minimal Ending': '미니멀 엔딩',
  'Calm Closure': '차분한 마무리',
  'Loop-friendly Ending': '루프형 엔딩',
  'Off-beat Flow': '엇박 플로우',
  'Punchy Reply': '강한 응답',
  'Dry Spoken Rap': '건조한 스포큰 랩',
  'Character Switch': '화자 전환',
  'Piano': '피아노',
  'Acoustic Guitar': '어쿠스틱 기타',
  'Electric Guitar': '일렉 기타',
  'Synth': '신스',
  'Pad': '패드',
  'Strings': '현악',
  'Bass': '베이스',
  'Drums': '드럼',
  'Percussion': '타악',
  'Pluck': '플럭',
  'Saxophone': '색소폰',
  'Trumpet': '트럼펫',
  'Flute': '플루트',
  'Gayageum': '가야금',
  'Haegeum': '해금',
};

function TagEditModal({
  isOpen,
  onClose,
  section,
  tags,
  onSave,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  userTier,
  sectionTags,
  pointSoundTags = [],
  pointSoundTagLabels = {},
  vocalSectionTags = [],
  customSectionTags = [],
  customSections = [],
  onCustomSectionTagsChange
}: {
  isOpen: boolean;
  onClose: () => void;
  section: string;
  tags: string[];
  onSave: (tags: string[]) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  userTier: TagTier;
  sectionTags: SectionTag[];
  pointSoundTags?: string[];
  pointSoundTagLabels?: Record<string, string>;
  vocalSectionTags?: VocalSectionTagOption[];
  customSectionTags?: UserCustomSectionTagDefinition[];
  customSections?: UserCustomSectionDefinition[];
  onCustomSectionTagsChange?: (tags: UserCustomSectionTagDefinition[]) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(tags);
  const [tagLibraryFilter, setTagLibraryFilter] = useState<'all' | 'basic' | 'my'>('all');
  const [showCustomTagEditor, setShowCustomTagEditor] = useState(false);
  const [customTagDraft, setCustomTagDraft] = useState({ labelKo: '', labelEn: '' });
  const [editingCustomTagId, setEditingCustomTagId] = useState<string | null>(null);
  const [isCustomTagConverting, setIsCustomTagConverting] = useState(false);
  const tagModalHistoryPushedRef = useRef(false);
  const customTagEditorHistoryPushedRef = useRef(false);
  const tagModalBackdropMouseDownRef = useRef(false);
  const customTagEditorBackdropMouseDownRef = useRef(false);
  const customSectionDef = customSections.find((item) => item.label === section);
  const isInstrumental = section === 'Instrumental' || section === 'Solo' || Boolean(customSectionDef?.isInstrumental);
  const pointSoundTagSet = useMemo(() => new Set(pointSoundTags), [pointSoundTags]);
  const vocalSectionTagMap = useMemo(() => new Map(vocalSectionTags.map((item) => [item.tag, item])), [vocalSectionTags]);
  const vocalSectionTagSet = useMemo(() => new Set(vocalSectionTags.map((item) => item.tag)), [vocalSectionTags]);
  const localCustomTagsForSection = useMemo(() => customSectionTags.filter((item) => item.section === section), [customSectionTags, section]);
  const localCustomTagSet = useMemo(() => new Set(localCustomTagsForSection.map((item) => item.label)), [localCustomTagsForSection]);

  const getTagDisplayLabel = useCallback((tag: string) => {
    const localCustomTag = localCustomTagsForSection.find((item) => item.label === tag);
    if (localCustomTag) return localCustomTag.label;
    const fsTag = sectionTags.find(t => t.label === tag) as any;
    // Built-in section tags must stay in English for Suno tag clarity.
    // Korean is kept only for hover descriptions / custom labels, not button display.
    return String(
      vocalSectionTagMap.get(tag)?.displayLabel ||
      pointSoundTagLabels[tag] ||
      tag
    );
  }, [sectionTags, pointSoundTagLabels, vocalSectionTagMap, localCustomTagsForSection]);

  const allowedTags = useMemo(() => {
    // 기본 섹션 태그는 Firestore의 예전 데이터가 섞이지 않도록 constants.ts의 최신 큐레이션 목록을 우선 사용한다.
    // Firestore는 관리자/백업용으로 남겨두되, 사용자에게 보이는 기본 태그 수는 섹션별 12~15개 안에서 고정한다.
    const baseSectionTags = isInstrumental
      ? [...INSTRUMENTAL_SOLO_TAGS]
      : [
          ...((ALLOWED_TAGS_BY_SECTION[section as keyof typeof ALLOWED_TAGS_BY_SECTION] ||
            SECTION_TAG_FALLBACKS[section] ||
            []) as string[]),
        ];

    const pointSoundAllowedSections = new Set(['Intro', 'Bridge', 'Breakdown', 'Break', 'Instrumental', 'Solo', 'Outro']);
    const pointSoundFallbacks = pointSoundAllowedSections.has(section)
      ? pointSoundTags.filter(Boolean)
      : [];

    const vocalPlacementFallbacks = !isInstrumental
      ? vocalSectionTags.map((item) => item.tag).filter(Boolean)
      : [];

    const localCustomTagLabels = localCustomTagsForSection.map((item) => item.label);

    // MY 태그 표시 방식은 유지하고, 기본 태그는 최신 constants 기준으로만 노출한다.
    const merged = [...baseSectionTags, ...localCustomTagLabels, ...pointSoundFallbacks, ...vocalPlacementFallbacks];
    return Array.from(new Set(merged));
  }, [section, isInstrumental, pointSoundTags, vocalSectionTags, localCustomTagsForSection]);

  const visibleTags = useMemo(() => {
    if (tagLibraryFilter === 'my') return allowedTags.filter((tag) => localCustomTagSet.has(tag));
    if (tagLibraryFilter === 'basic') return allowedTags.filter((tag) => !localCustomTagSet.has(tag));
    return allowedTags;
  }, [allowedTags, localCustomTagSet, tagLibraryFilter]);

  const getTagTier = (tag: string) => {
    if (vocalSectionTagSet.has(tag) || localCustomTagSet.has(tag)) return 'free';
    const fsTag = sectionTags.find(t => t.label === tag);
    if (fsTag) return fsTag.tier;

    if (isInstrumental) return 'free';
    return TAG_META[tag as keyof typeof TAG_META]?.tier || 'free';
  };

  const getTagDescription = (tag: string) => {
    const localCustomTag = localCustomTagsForSection.find((item) => item.label === tag);
    if (localCustomTag) return localCustomTag.labelKo || localCustomTag.description || '사용자가 직접 추가한 섹션 태그입니다.';

    const fsTag = sectionTags.find(t => t.label === tag);

    if (vocalSectionTagSet.has(tag)) {
      return vocalSectionTagMap.get(tag)?.description || '보컬 캐릭터를 이 섹션에 직접 배치합니다.';
    }
    if (pointSoundTagSet.has(tag)) {
      return '포인트모드에서 선택한 사운드입니다. 실제 프롬프트는 영어 태그로 유지되며, 해당 섹션의 짧은 효과음/질감 지문으로만 사용됩니다.';
    }
    if (isInstrumental) {
      return INSTRUMENT_TAG_DESCRIPTIONS[tag as keyof typeof INSTRUMENT_TAG_DESCRIPTIONS] || fsTag?.description || '';
    }
    return TAG_DESCRIPTIONS[tag as keyof typeof TAG_DESCRIPTIONS] || SECTION_TAG_DESCRIPTIONS_LOCAL[tag] || fsTag?.description || '';
  };

  const maxSelectable = isInstrumental ? 1 : 3;

  const closeCustomTagEditor = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && customTagEditorHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setShowCustomTagEditor(false);
    setEditingCustomTagId(null);
    setCustomTagDraft({ labelKo: '', labelEn: '' });
    customTagEditorHistoryPushedRef.current = false;
  }, []);

  const closeTagModal = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (showCustomTagEditor) {
      closeCustomTagEditor(source);
      return;
    }
    if (source === 'ui' && tagModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    tagModalHistoryPushedRef.current = false;
    onClose();
  }, [showCustomTagEditor, closeCustomTagEditor, onClose]);

  useEffect(() => {
    if (isOpen) setSelectedTags(tags);
  }, [isOpen, tags]);

  useEffect(() => {
    if (!isOpen) return;
    if (!tagModalHistoryPushedRef.current) {
      window.history.pushState({ modal: 'section-tag-editor' }, '');
      tagModalHistoryPushedRef.current = true;
    }
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTagModal();
    };
    const handlePopState = () => {
      if (showCustomTagEditor) return;
      closeTagModal('history');
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, showCustomTagEditor, closeTagModal]);

  useEffect(() => {
    if (!showCustomTagEditor) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCustomTagEditor();
    };
    const handlePopState = () => {
      closeCustomTagEditor('history');
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showCustomTagEditor, closeCustomTagEditor]);

  const toggleTag = (tag: string) => {
    const tier = getTagTier(tag);
    
    const isLocked = !isInstrumental && (
      (tier === 'pro' && userTier !== 'pro') ||
      (tier === 'basic' && userTier === 'free')
    );

    if (isLocked) {
      const tierLabel = tier === 'pro' ? 'Pro' : 'Basic';
      alert(`${tierLabel} 기능입니다.`);
      return;
    }

    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      
      // For Instrumental, replace the existing selection if it's max 1
      if (isInstrumental) {
        return [tag];
      }


    if (vocalSectionTagSet.has(tag)) {
        const withoutVocal = prev.filter(t => !vocalSectionTagSet.has(t));
        const existingVocal = prev.filter(t => vocalSectionTagSet.has(t));
        if (tag.startsWith('VOCAL_ALL::')) return [...withoutVocal, tag];
        const nextVocal = existingVocal.filter(t => !t.startsWith('VOCAL_ALL::'));
        if (nextVocal.length >= 2) return [...withoutVocal, nextVocal[0], tag];
        return [...withoutVocal, ...nextVocal, tag].slice(0, maxSelectable);
      }

      if (prev.length >= maxSelectable) return prev;
      return [...prev, tag];
    });
  };

  const openCustomSectionTagEditor = (item?: UserCustomSectionTagDefinition) => {
    if (item) {
      setEditingCustomTagId(item.id);
      setCustomTagDraft({ labelKo: item.labelKo || '', labelEn: item.label || '' });
    } else {
      setEditingCustomTagId(null);
      setCustomTagDraft({ labelKo: '', labelEn: '' });
    }
    setShowCustomTagEditor(true);
    if (!customTagEditorHistoryPushedRef.current) {
      window.history.pushState({ modal: 'custom-section-tag-editor' }, '');
      customTagEditorHistoryPushedRef.current = true;
    }
  };


  const addCustomSectionTag = async () => {
    const rawKo = sanitizeCustomLabel(customTagDraft.labelKo);
    const rawEn = sanitizeCustomLabel(customTagDraft.labelEn);
    const labelKo = rawKo || rawEn;
    if (!labelKo || isCustomTagConverting) return;
    setIsCustomTagConverting(true);
    try {
      const prevItem = localCustomTagsForSection.find((item) => item.id === editingCustomTagId);
      const shouldAutoGenerate = !rawEn || Boolean(prevItem && rawKo && rawKo !== (prevItem.labelKo || ''));
      const customTagGeminiApiKey = shouldAutoGenerate ? await resolveGoogleGeminiApiKey(auth.currentUser) : '';
      const autoMeta = shouldAutoGenerate
        ? await generateCustomSectionMetadata({
            labelKo,
            description: '',
            context: 'tag',
            geminiApiKey: customTagGeminiApiKey,
          })
        : null;
      const englishLabel = sanitizeCustomLabel(shouldAutoGenerate ? (autoMeta?.labelEn || rawEn || labelKo) : (rawEn || autoMeta?.labelEn || labelKo));
      const cue = sanitizeCustomLabel(autoMeta?.tagCue || prevItem?.description || englishLabel);
      const promptFull = String(autoMeta?.promptFull || prevItem?.promptFull || cue || englishLabel)
        .replace(/[\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      if (!englishLabel) return;
      const now = Date.now();
      const nextTag: UserCustomSectionTagDefinition = {
        id: editingCustomTagId || `custom_tag_${now}_${Math.random().toString(36).slice(2, 7)}`,
        label: englishLabel,
        labelKo,
        promptFull,
        description: labelKo,
        section,
        tier: 'free',
        createdAt: prevItem?.createdAt || now,
        updatedAt: now,
      };
      const next = editingCustomTagId
        ? normalizeUserCustomSectionTags((customSectionTags || []).map((item) => item.id === editingCustomTagId ? nextTag : item))
        : normalizeUserCustomSectionTags([...(customSectionTags || []), nextTag]);
      onCustomSectionTagsChange?.(next);
      setCustomTagDraft({ labelKo: '', labelEn: '' });
      setEditingCustomTagId(null);
      closeCustomTagEditor();
      setSelectedTags((prev) => Array.from(new Set([...prev, nextTag.label])).slice(0, maxSelectable));
    } finally {
      setIsCustomTagConverting(false);
    }
  };
  const deleteCustomSectionTag = (tagLabel: string) => {
    const next = (customSectionTags || []).filter((item) => !(item.section === section && item.label === tagLabel));
    onCustomSectionTagsChange?.(next);
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagLabel));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onMouseDown={(e) => {
        tagModalBackdropMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (tagModalBackdropMouseDownRef.current && e.target === e.currentTarget) closeTagModal();
        tagModalBackdropMouseDownRef.current = false;
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-[var(--text-primary)]">{section} 태그 편집</h4>
            {SECTION_META[section]?.descriptionKo && (
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {SECTION_META[section].descriptionKo}
              </p>
            )}
            <p className="text-[10px] text-[#A8C49F] font-bold mt-1 uppercase tracking-wider">
              {`최대 ${maxSelectable}개 선택 가능`}
            </p>
          </div>
          <button 
            onClick={() => closeTagModal()} 
            className="p-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)]"
            onMouseEnter={() => onHover({ id: 'tag-modal-close', label: 'Close', labelKo: '닫기', description: '태그 편집 창을 닫습니다.' })}
            onMouseLeave={() => onHover(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl bg-black/10 border border-btn-border p-1">
              {(['all', 'basic', 'my'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTagLibraryFilter(filter)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                    tagLibraryFilter === filter
                      ? "bg-[#658761] text-[#171717] font-black"
                      : "text-[var(--text-secondary)] hover:bg-white/10"
                  )}
                >
                  {filter === 'all' ? '전체' : filter === 'basic' ? '기본 태그' : 'MY 태그'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleTags.map(tag => {
              const tier = getTagTier(tag);
              const description = getTagDescription(tag);
              const displayLabel = getTagDisplayLabel(tag);
              const isPointSoundTag = pointSoundTagSet.has(tag);
              const isVocalPlacement = vocalSectionTagSet.has(tag);
              const isLocked = !isInstrumental && (
                (tier === 'pro' && userTier !== 'pro') ||
                (tier === 'basic' && userTier === 'free')
              );
              
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  onMouseEnter={() => onHover({ 
                    id: `tag-${tag}`, 
                    label: displayLabel, 
                    labelKo: description || displayLabel, 
                    description: description || (isInstrumental ? '독주용 악기를 선택합니다.' : '음악적 디렉션을 추가합니다.')
                  })}
                  onMouseLeave={() => {
                    onHover(null);
                    onLongPressEnd();
                  }}
                  onTouchStart={() => onLongPressStart({ 
                    id: `tag-${tag}`, 
                    label: displayLabel, 
                    labelKo: description || displayLabel, 
                    description: description || (isInstrumental ? '독주용 악기를 선택합니다.' : '음악적 디렉션을 추가합니다.')
                  })}
                  onTouchEnd={onLongPressEnd}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border flex items-center gap-1.5",
                    selectedTags.includes(tag)
                      ? isVocalPlacement
                        ? "bg-[#658761] border-black/20 text-[#171717] font-black shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                        : isPointSoundTag
                          ? "bg-[#658761] border-black/20 text-[#171717] font-black shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                          : "bg-[#658761] border-black/20 text-[#171717] font-black"
                      : isLocked
                        ? "bg-white/5 border-white/10 text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                        : isVocalPlacement
                          ? "bg-white/5 border-black/20 text-[var(--text-primary)] hover:bg-sky-500/10 shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
                          : isPointSoundTag
                            ? "bg-white/5 border-black/20 text-[var(--text-primary)] hover:bg-pink-500/10 shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
                            : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                  )}
                >
                  {displayLabel}
                  {localCustomTagSet.has(tag) && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); const target = localCustomTagsForSection.find((item) => item.label === tag); if (target) openCustomSectionTagEditor(target); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const target = localCustomTagsForSection.find((item) => item.label === tag); if (target) openCustomSectionTagEditor(target); } }}
                      className={cn("ml-1 inline-flex items-center rounded-md px-1 py-0.5 transition-all", selectedTags.includes(tag) ? "text-[#171717] bg-[#658761]/20 hover:bg-[#658761]/30" : "text-[#A8C49F] hover:text-[var(--text-primary)] hover:bg-white/10")}
                      title="내 태그 수정"
                    >
                      <Edit2 className="w-3 h-3" />
                    </span>
                  )}
                  {isLocked && <Lock className="w-3 h-3" />}
                  {tier !== 'free' && !isLocked && !localCustomTagSet.has(tag) && <Sparkles className="w-3 h-3 text-yellow-500" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => openCustomSectionTagEditor()}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border border-white/20 bg-white/5 text-[var(--text-primary)] hover:bg-white/10 flex items-center gap-1.5 shadow-btn"
            >
              <Plus className="w-3 h-3" /> 태그 추가
            </button>
          </div>

          {showCustomTagEditor && (
            <div
              className="fixed inset-0 z-[185] flex items-center justify-center px-4 backdrop-blur-[1.5px]"
              onMouseDown={(e) => { customTagEditorBackdropMouseDownRef.current = e.target === e.currentTarget; }}
              onClick={(e) => {
                if (customTagEditorBackdropMouseDownRef.current && e.target === e.currentTarget) closeCustomTagEditor();
                customTagEditorBackdropMouseDownRef.current = false;
              }}
            >
              <div
                className="w-[min(92vw,420px)] rounded-2xl border border-black/20 bg-[var(--card-bg)] shadow-2xl p-4 space-y-3"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#A8C49F]">커스텀 태그 {editingCustomTagId ? '수정' : '추가'}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {editingCustomTagId ? '한글은 설명용, 영어는 실제 태그용입니다.' : '한글 태그명만 입력하면 영어 실행 태그는 자동 생성됩니다.'}
                    </p>
                  </div>
                  <button type="button" onClick={() => closeCustomTagEditor()} className="p-2 rounded-xl bg-btn-bg border border-btn-border text-[var(--text-secondary)]"><X className="w-[18px] h-[18px]" /></button>
                </div>
                <input
                  value={customTagDraft.labelKo}
                  onChange={(e) => setCustomTagDraft((prev) => ({ ...prev, labelKo: e.target.value }))}
                  placeholder="한글 태그명: 예: 숨죽인 톤"
                  className="w-full rounded-xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                />
                {editingCustomTagId && (
                  <input
                    value={customTagDraft.labelEn}
                    onChange={(e) => setCustomTagDraft((prev) => ({ ...prev, labelEn: e.target.value }))}
                    placeholder="영어 태그명: 예: held-back muted tone"
                    className="w-full rounded-xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#658761]/40"
                  />
                )}
                <div className={cn("grid gap-2", editingCustomTagId ? "grid-cols-3" : "grid-cols-2")}>
                  {editingCustomTagId && (
                    <button type="button" onClick={() => { const target = localCustomTagsForSection.find((item) => item.id === editingCustomTagId); if (target) deleteCustomSectionTag(target.label); closeCustomTagEditor(); }} className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-sm font-bold text-red-300">삭제</button>
                  )}
                  <button type="button" onClick={() => closeCustomTagEditor()} className="py-2.5 rounded-xl bg-btn-bg border border-btn-border text-sm font-bold text-[var(--text-primary)]">취소</button>
                  <button type="button" onClick={addCustomSectionTag} disabled={isCustomTagConverting} className="py-2.5 rounded-xl bg-[#658761] border border-black/20 text-sm font-bold text-[#171717] disabled:opacity-60">{isCustomTagConverting ? '자동 변환 중...' : '저장'}</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => closeTagModal()}
              onMouseEnter={() => onHover({ id: 'tag-modal-cancel', label: 'Cancel', labelKo: '취소', description: '변경사항을 취소하고 닫습니다.' })}
              onMouseLeave={() => onHover(null)}
              className="flex-1 py-3 rounded-xl bg-btn-bg border border-btn-border text-sm font-bold text-[var(--text-primary)] hover:bg-btn-hover transition-all shadow-btn"
            >
              취소
            </button>
            <button
              onClick={() => onSave(selectedTags)}
              onMouseEnter={() => onHover({ id: 'tag-modal-save', label: 'Save', labelKo: '저장', description: '선택한 태그를 해당 섹션에 적용합니다.' })}
              onMouseLeave={() => onHover(null)}
              className="flex-1 py-3 rounded-xl bg-[#658761] border border-black/20 text-sm font-bold text-[#171717] hover:brightness-110 transition-all shadow-lg shadow-[#658761]/20"
            >
              저장
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type SavedStructurePreset = {
  id: string;
  name: string;
  sections: CustomSectionItem[];
  createdAt: number;
  reaction?: 'like' | 'dislike' | null;
};

const normalizeSavedStructurePreset = (input: any): SavedStructurePreset | null => {
  if (!input || typeof input !== 'object') return null;

  const id = typeof input.id === 'string' && input.id.trim() ? input.id : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : '제목없음';
  const sectionsSource = Array.isArray(input.sections)
    ? input.sections
    : Array.isArray(input.structure)
      ? input.structure
      : [];
  const sections = normalizeCustomStructure(sectionsSource);

  if (sections.length === 0) return null;

  return {
    id,
    name,
    sections,
    createdAt: getTimestampMs(input.createdAt || Date.now()) || Date.now(),
    reaction: input.reaction === 'like' || input.reaction === 'dislike' ? input.reaction : null,
  };
};

const readSavedStructurePresets = (data: any): SavedStructurePreset[] => {
  if (!data || typeof data !== 'object') return [];

  const raw = Array.isArray(data.structures)
    ? data.structures
    : Array.isArray(data.savedStructures)
      ? data.savedStructures
      : Array.isArray(data.presets)
        ? data.presets
        : [];

  return raw
    .map((item: any) => normalizeSavedStructurePreset(item))
    .filter((item): item is SavedStructurePreset => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const CUSTOM_STRUCTURE_SECTIONS = [
  'Intro',
  'Verse',
  'Pre-Chorus',
  'Chorus',
  'Hook',
  'Bridge',
  'Final Chorus',
  'Outro',
  'Breakdown',
  'Drop',
  'Break',
  'Stop',
  'Rap Section',
  'Solo',
  'Instrumental',
  'Theme A',
  'Theme B',
  'Build-up',
  'Main Theme',
  'Climax',
] as const;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sectionPattern = CUSTOM_STRUCTURE_SECTIONS
  .map(escapeRegExp)
  .join('|');

const sectionRegex = new RegExp(
  `\\s*(\\[(${sectionPattern})[^\\]]*\\])`,
  'g'
);

const TAG_DESCRIPTIONS_LOCAL: Record<string, string> = {
  'Solo': '한 명의 보컬이 중심이 되어 또렷하게 들립니다.',
  'Duet': '두 보컬이 주고받으며 자연스럽게 어우러집니다.',
  'Group': '여러 보컬이 함께 나와 풍성하게 들립니다.',
  'Rap': '멜로디보다 리듬감 있는 랩이 강조됩니다.',
  'Harmony': '여러 화성이 겹쳐 더 풍부하게 들립니다.',
  'Adlib': '자유로운 애드리브가 추가되어 표현이 더 살아납니다.',
};

const SECTION_TAG_FALLBACKS: Record<string, string[]> = {
  Verse: [
    'Low Energy',
    'Story Focused',
    'Rhythmic Flow',
    'Sparse Arrangement',
    'Groove Driven',
    'Laid-back',
    'Steady Pace',
    'Subtle Build',
  ],
  'Rap Section': [
    'Story Focused',
    'Rhythmic Flow',
    'Sparse Arrangement',
    'Groove Driven',
    'Off-beat Flow',
    'Punchy Reply',
    'Dry Spoken Rap',
    'Character Switch',
  ],
};

const SECTION_TAG_DESCRIPTIONS_LOCAL: Record<string, string> = {
  'Off-beat Flow': '박자를 살짝 비껴 타며 말맛과 긴장감을 만듭니다.',
  'Punchy Reply': '짧고 강한 반응으로 대화형 전개에 힘을 줍니다.',
  'Dry Spoken Rap': '말하듯 건조하게 랩을 처리해 캐릭터성을 살립니다.',
  'Character Switch': '화자가 바뀌는 느낌을 분명하게 만들어 줍니다.',
};

type VocalCharacterScaleKey =
  | 'ageLevel'
  | 'rangeLevel'
  | 'deliveryLevel'
  | 'rhythmLevel'
  | 'emotionLevel'
  | 'textureLevel'
  | 'charmLevel'
  | 'ornamentLevel';

type VocalCharacterScaleStep = {
  labelKo: string;
  prompt: string;
  hintKo: string;
};

type VocalCharacterScaleConfig = {
  key: VocalCharacterScaleKey;
  titleKo: string;
  subtitleKo: string;
  defaultValue: number;
  defaultValues?: number[];
  minLabelKo: string;
  maxLabelKo: string;
  steps: VocalCharacterScaleStep[];
};

const VOCAL_CHARACTER_SCALE_CONFIGS: VocalCharacterScaleConfig[] = [
  {
    key: 'ageLevel',
    titleKo: '연령감',
    subtitleKo: '목소리에서 느껴지는 나이대와 성숙도를 잡습니다.',
    defaultValue: 6,
    minLabelKo: '어림',
    maxLabelKo: '원숙함',
    steps: [
      { labelKo: '어린 느낌', prompt: 'childlike youthful vocal color', hintKo: '작고 어린 결' },
      { labelKo: '10대 느낌', prompt: 'teen-like vocal color', hintKo: '풋풋하고 가벼움' },
      { labelKo: '20대 초반', prompt: 'young adult vocal color', hintKo: '젊고 선명함' },
      { labelKo: '풋풋한 성인', prompt: 'fresh early-adult vocal color', hintKo: '성인이지만 풋풋함' },
      { labelKo: '젊은 성인', prompt: 'clear young adult vocal color', hintKo: '젊고 안정적' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '성숙한 30대', prompt: 'mature adult vocal color', hintKo: '조금 더 안정적' },
      { labelKo: '중년감', prompt: 'middle-aged seasoned vocal color', hintKo: '삶의 결이 있음' },
      { labelKo: '노련함', prompt: 'aged seasoned vocal color', hintKo: '오래 부른 듯한 깊이' },
      { labelKo: '원숙함', prompt: 'veteran mature vocal color', hintKo: '깊고 원숙한 결' },
      { labelKo: '관록 있음', prompt: 'deep veteran vocal authority', hintKo: '관록 있는 무게감' },
    ],
  },
  {
    key: 'rangeLevel',
    titleKo: '음역',
    subtitleKo: '보컬의 기본 높낮이를 정합니다.',
    defaultValue: 6,
    minLabelKo: '낮음',
    maxLabelKo: '높음',
    steps: [
      { labelKo: '극저음', prompt: 'very deep low vocal range', hintKo: '깊게 깔리는 저음' },
      { labelKo: '매우 낮음', prompt: 'very low vocal range', hintKo: '낮고 무거움' },
      { labelKo: '낮음', prompt: 'low vocal range', hintKo: '낮은 목소리' },
      { labelKo: '중저음', prompt: 'low-mid vocal range', hintKo: '안정적인 중저음' },
      { labelKo: '낮은 보통', prompt: 'slightly low natural vocal range', hintKo: '기본보다 살짝 낮음' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '높은 보통', prompt: 'slightly high natural vocal range', hintKo: '기본보다 살짝 높음' },
      { labelKo: '중고음', prompt: 'upper-mid vocal range', hintKo: '밝게 올라감' },
      { labelKo: '높음', prompt: 'high vocal range', hintKo: '높고 선명함' },
      { labelKo: '매우 높음', prompt: 'thin very high vocal range', hintKo: '얇고 높은 고음' },
      { labelKo: '초고음', prompt: 'extremely high thin vocal range', hintKo: '아주 얇은 초고음' },
    ],
  },
  {
    key: 'deliveryLevel',
    titleKo: '창법/발성',
    subtitleKo: '가성, 진성, 말하듯 부름의 방향을 정합니다.',
    defaultValue: 6,
    minLabelKo: '가성',
    maxLabelKo: '랩형',
    steps: [
      { labelKo: '공기 가성', prompt: 'airy falsetto delivery', hintKo: '공기 섞인 얇은 가성 (가성)' },
      { labelKo: '얇은 가성', prompt: 'thin falsetto delivery', hintKo: '얇고 선명한 가성 (가성)' },
      { labelKo: '부드러운 가성', prompt: 'soft falsetto delivery', hintKo: '부드럽고 여린 가성 (가성)' },
      { labelKo: '가성 섞임', prompt: 'falsetto-leaning mixed delivery', hintKo: '가성 쪽으로 기운 연결 (가성)' },
      { labelKo: '믹스보이스', prompt: 'connected mixed voice', hintKo: '진성과 가성의 연결 (믹스보이스)' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '자연 진성', prompt: 'natural chest voice', hintKo: '자연스러운 진성 (진성)' },
      { labelKo: '힘 있는 진성', prompt: 'powerful chest voice', hintKo: '단단하게 밀어냄 (진성)' },
      { labelKo: '말하듯 부름', prompt: 'speech-like singing delivery', hintKo: '노래와 말 사이 (스프레히슈티메)' },
      { labelKo: '대사형', prompt: 'spoken theatrical delivery', hintKo: '대사처럼 전달 (대사형)' },
      { labelKo: '랩형', prompt: 'rap-like vocal delivery', hintKo: '리듬과 말맛 중심 (랩형)' },
    ],
  },
  {
    key: 'rhythmLevel',
    titleKo: '박자감',
    subtitleKo: '앞당김, 정박, 레이백, 자유박자 흐름을 정합니다.',
    defaultValue: 6,
    minLabelKo: '성급함',
    maxLabelKo: '박자이탈',
    steps: [
      { labelKo: '성급함', prompt: 'extremely rushed vocal delivery, deliberately singing far ahead of the beat with urgent anticipatory phrasing', hintKo: '박자보다 최대한 앞에서 급하게 치고 들어감' },
      { labelKo: '앞박자', prompt: 'ahead-of-the-beat vocal phrasing', hintKo: '박자보다 먼저 들어감' },
      { labelKo: '살짝당김', prompt: 'slightly anticipated vocal phrasing', hintKo: '살짝 앞박으로 당김' },
      { labelKo: '빠른반응', prompt: 'quick responsive vocal phrasing', hintKo: '말맛처럼 빠르게 반응' },
      { labelKo: '정박근처', prompt: 'near-steady vocal phrasing with slight rhythmic pull', hintKo: '거의 정박에 가까움' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '레이백', prompt: 'laid-back behind-the-beat vocal phrasing', hintKo: '박자 뒤에 여유롭게 걸침 (레이백)' },
      { labelKo: '느슨함', prompt: 'loose rhythmic vocal delivery', hintKo: '정박을 풀어 느슨하게 부름' },
      { labelKo: '불안정', prompt: 'intentionally uneven off-beat timing, slightly missing the beat', hintKo: '일부러 박자를 흔들거나 놓침' },
      { labelKo: '자유박자', prompt: 'rubato, speech-like free-time vocal phrasing', hintKo: '말하듯 자유롭게 흐름' },
      { labelKo: '박자이탈', prompt: 'speech-like free-time vocal delivery, intentionally drifting outside the beat grid', hintKo: '비트 밖으로 의도적으로 벗어남' },
    ],
  },
  {
    key: 'emotionLevel',
    titleKo: '감정 강도',
    subtitleKo: '감정을 얼마나 드러내는지 정합니다.',
    defaultValue: 6,
    minLabelKo: '절제',
    maxLabelKo: '폭발',
    steps: [
      { labelKo: '무감정', prompt: 'emotionless delivery', hintKo: '거의 감정을 보이지 않음' },
      { labelKo: '차가운 절제', prompt: 'cold restrained emotion', hintKo: '차갑게 눌러 담음' },
      { labelKo: '절제', prompt: 'restrained emotion', hintKo: '감정을 눌러 담음' },
      { labelKo: '담담함', prompt: 'calm understated emotion', hintKo: '담담하게 표현' },
      { labelKo: '은은함', prompt: 'subtle gentle emotion', hintKo: '감정이 살짝 비침' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '감정 있음', prompt: 'expressive emotion', hintKo: '감정이 드러남' },
      { labelKo: '감정 진함', prompt: 'strong expressive emotion', hintKo: '감정선이 진함' },
      { labelKo: '극적', prompt: 'dramatic emotion', hintKo: '드라마틱하게 표현' },
      { labelKo: '과장', prompt: 'exaggerated theatrical emotion', hintKo: '캐릭터처럼 과장' },
      { labelKo: '폭발', prompt: 'explosive emotional delivery', hintKo: '감정을 크게 터뜨림' },
    ],
  },
  {
    key: 'textureLevel',
    titleKo: '목소리 질감',
    subtitleKo: '목소리 표면의 결을 정합니다.',
    defaultValue: 6,
    minLabelKo: '건조함',
    maxLabelKo: '몽환',
    steps: [
      { labelKo: '극건조', prompt: 'very dry vocal tone', hintKo: '수분 없이 바짝 마름' },
      { labelKo: '보컬프라이', prompt: 'low vocal fry texture', hintKo: '낮게 지글거리는 결 (보컬 프라이)' },
      { labelKo: '크리키', prompt: 'creaky vocal texture', hintKo: '성대가 살짝 갈라짐 (크리키)' },
      { labelKo: '그로울링', prompt: 'low growling vocal edge', hintKo: '목 안쪽의 거친 울림 (그로울링)' },
      { labelKo: '비음 섞임', prompt: 'slightly nasal vocal tone', hintKo: '코끝 울림이 살짝 섞임 (비성)' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '따뜻함', prompt: 'warm vocal tone', hintKo: '온기 있는 목소리' },
      { labelKo: '부드러움', prompt: 'soft vocal texture', hintKo: '부드럽게 감김' },
      { labelKo: '공기감', prompt: 'airy vocal texture', hintKo: '가볍게 퍼짐' },
      { labelKo: '몽환공기', prompt: 'dreamy airy vocal texture', hintKo: '몽환적으로 퍼짐' },
      { labelKo: '유리결', prompt: 'glassy ethereal vocal texture', hintKo: '투명하고 신비로움' },
    ],
  },
  {
    key: 'charmLevel',
    titleKo: '보컬 매력',
    subtitleKo: '소울풀, 귀여움, 매혹감 같은 보컬의 매력 포인트를 정합니다.',
    defaultValue: 6,
    minLabelKo: '무채색',
    maxLabelKo: '몽환매력',
    steps: [
      { labelKo: '무채색', prompt: 'neutral colorless vocal charm', hintKo: '매력을 드러내지 않음' },
      { labelKo: '청순함', prompt: 'pure innocent vocal charm', hintKo: '맑고 순한 매력' },
      { labelKo: '귀여움', prompt: 'cute playful vocal charm', hintKo: '귀엽고 발랄함' },
      { labelKo: '친근함', prompt: 'friendly approachable vocal charm', hintKo: '가깝고 편안한 매력' },
      { labelKo: '따뜻매력', prompt: 'warm comforting vocal charm', hintKo: '따뜻하게 감싸는 매력' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '소울풀', prompt: 'soulful vocal character', hintKo: '영혼이 느껴지는 결' },
      { labelKo: '매혹적', prompt: 'seductive magnetic vocal charm', hintKo: '끌어당기는 매력' },
      { labelKo: '도도함', prompt: 'cool aloof vocal charm', hintKo: '도도하고 차가움' },
      { labelKo: '신비로움', prompt: 'mysterious vocal aura', hintKo: '알 수 없는 신비감' },
      { labelKo: '몽환매력', prompt: 'dreamy enigmatic vocal charm', hintKo: '몽환적이고 알 수 없음' },
    ],
  },
  {
    key: 'ornamentLevel',
    titleKo: '표현기교',
    subtitleKo: '뮤트발음, 숨섞임, 트릴, 벤딩, 실험창법 같은 보컬 습관을 정합니다.',
    defaultValue: 8,
    minLabelKo: '강한비성',
    maxLabelKo: '실험창법',
    steps: [
      { labelKo: '강한비성', prompt: 'intentional strong nasal resonance technique', hintKo: '코끝 울림을 강하게 섞음 (강한 비성)' },
      { labelKo: '담백연결', prompt: 'clean connected phrasing', hintKo: '담백하게 이어 부름' },
      { labelKo: '또박발음', prompt: 'clear precise articulation', hintKo: '또박또박 선명함 (또박발음)' },
      { labelKo: '뮤트발음', prompt: 'muted consonant-heavy articulation', hintKo: '받침을 눌러 삼킴 (뮤트발음)' },
      { labelKo: '숨섞임', prompt: 'breathy phrasing', hintKo: '숨을 섞어 부름 (브레시)' },
      { labelKo: '하프에어', prompt: 'breathy half-air stops', hintKo: '숨으로 살짝 막고 품 (하프 에어 스톱)' },
      { labelKo: '더블브레스', prompt: 'double-breath phrasing', hintKo: '숨을 한 번 더 꺾어 넣음 (더블 브레스)' },
      { labelKo: 'Gemini 기본', prompt: '', hintKo: '선택 없음 · 장르와 상황에 맡김' },
      { labelKo: '고스트노트', prompt: 'soft ghost-note vocal touches', hintKo: '들릴 듯 말 듯 스침 (고스트 노트)' },
      { labelKo: '데토네이션', prompt: 'slightly detuned vocal delivery', hintKo: '음정이 살짝 낮게 흔들림 (데토네이션)' },
      { labelKo: '클리산도', prompt: 'smooth vocal glissando slides', hintKo: '음을 미끄러지듯 연결 (클리산도)' },
      { labelKo: '트릴', prompt: 'vocal trills and quick ornaments', hintKo: '빠른 장식음 (트릴)' },
      { labelKo: '깊은비브라토', prompt: 'deep emotional vibrato', hintKo: '깊고 넓은 떨림 (비브라토)' },
      { labelKo: '벤딩슬러', prompt: 'vocal bends, slurred slides, and unique turns', hintKo: '음을 꺾고 미끄러뜨림 (벤딩/슬러)' },
      { labelKo: '실험창법', prompt: 'context-aware experimental vocal technique such as sprechgesang, yodel-like flips, glitchy phrasing, whisper-noise texture, cracked distorted edges, or unstable pitch texture', hintKo: '장르와 상황에 맞는 특수 창법 (실험창법)' },
    ],
  },
];

const isVocalCharacterScaleDefaultLevel = (config: VocalCharacterScaleConfig, level: number) => {
  return level === config.defaultValue;
};

const isVocalCharacterOrnamentConfig = (config: VocalCharacterScaleConfig) => config.key === 'ornamentLevel';

const getVocalCharacterOrnamentSecondaryLevel = (character: VocalMember['character'] | undefined, config: VocalCharacterScaleConfig) => {
  const value = Number((character as any)?.ornamentSecondaryLevel);
  return Number.isFinite(value) ? Math.min(config.steps.length, Math.max(1, Math.round(value))) : config.defaultValue;
};

const getVocalCharacterScaleStep = (key: VocalCharacterScaleKey, level?: number) => {
  const config = VOCAL_CHARACTER_SCALE_CONFIGS.find((item) => item.key === key);
  if (!config) return undefined;
  const safeLevel = Math.min(config.steps.length, Math.max(1, Number(level || config.defaultValue)));
  return config.steps[safeLevel - 1];
};

const getVocalCharacterScaleLevel = (character: VocalMember['character'] | undefined, config: VocalCharacterScaleConfig) => {
  const value = Number(character?.[config.key]);
  return Number.isFinite(value) ? Math.min(config.steps.length, Math.max(1, Math.round(value))) : config.defaultValue;
};

const getVocalCharacterScalePromptParts = (character?: VocalMember['character']) => {
  if (!character) return [] as string[];
  const parts = VOCAL_CHARACTER_SCALE_CONFIGS
    .map((config) => {
      const value = Number(character[config.key]);
      if (!Number.isFinite(value)) return '';
      const safeLevel = Math.min(config.steps.length, Math.max(1, Math.round(value)));
      if (isVocalCharacterScaleDefaultLevel(config, safeLevel)) return '';
      return config.steps[safeLevel - 1]?.prompt || '';
    })
    .filter(Boolean);

  const ornamentConfig = VOCAL_CHARACTER_SCALE_CONFIGS.find((config) => isVocalCharacterOrnamentConfig(config));
  if (ornamentConfig) {
    const mainValue = Number(character.ornamentLevel);
    const mainSafeValue = Number.isFinite(mainValue) ? Math.min(ornamentConfig.steps.length, Math.max(1, Math.round(mainValue))) : ornamentConfig.defaultValue;
    const secondaryValue = Number((character as any).ornamentSecondaryLevel);
    const secondarySafeValue = Number.isFinite(secondaryValue) ? Math.min(ornamentConfig.steps.length, Math.max(1, Math.round(secondaryValue))) : ornamentConfig.defaultValue;

    if (Number.isFinite(secondaryValue) && !isVocalCharacterScaleDefaultLevel(ornamentConfig, secondarySafeValue)) {
      const prompt = ornamentConfig.steps[secondarySafeValue - 1]?.prompt;
      if (prompt) parts.push(`secondary technique: ${prompt}`);
    } else if (Number.isFinite(mainValue) && !isVocalCharacterScaleDefaultLevel(ornamentConfig, mainSafeValue)) {
      parts.push('optional compatible secondary vocal habit chosen from a nearby or musically related technique, only if it fits the genre, mood, and character');
    }
  }

  return parts;
};


interface VocalControlProps {
  maleCount: number;
  femaleCount: number;
  vocalMode: VocalMode;
  vocalTones: VocalTone[];
  vocalMembers: VocalMember[];
  rapEnabled: boolean;
  onMaleChange: (count: number) => void;
  onFemaleChange: (count: number) => void;
  onModeChange: (mode: VocalMode) => void;
  onMembersChange: (members: VocalMember[]) => void;
  onRapChange: (enabled: boolean) => void;
  isKoreanEnglishMix: boolean;
  englishMixRatio: number;
  onEnglishMixRatioChange: (ratio: number) => void;
  onToggleKoreanEnglishMix: () => void;
  onClear: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  onModalStateChange?: (isOpen: boolean) => void;
}

function VocalControl({ 
  maleCount, 
  femaleCount, 
  vocalMode,
  vocalTones,
  vocalMembers,
  rapEnabled,
  isKoreanEnglishMix,
  englishMixRatio,
  onEnglishMixRatioChange,
  onToggleKoreanEnglishMix,
  onMaleChange, 
  onFemaleChange, 
  onModeChange,
  onMembersChange,
  onRapChange,
  onClear,
  isLocked = false,
  onToggleLock,
  onHover, 
  onLongPressStart, 
  onLongPressEnd,
  onModalStateChange,
}: VocalControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [editingVocalMemberId, setEditingVocalMemberId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Height is now handled by overflow-visible
  }, [maleCount, femaleCount, vocalMode, vocalMembers, rapEnabled, isKoreanEnglishMix]);
  const [activeVocalTonePopup, setActiveVocalTonePopup] = useState<string | null>(null);
  const [memberToneDirectInputId, setMemberToneDirectInputId] = useState<string | null>(null);
  const [memberToneDirectDraft, setMemberToneDirectDraft] = useState('');
  const [vocalTonePopupPos, setVocalTonePopupPos] = useState({ top: 0, left: 0, width: 560, maxHeight: 320 });

  const updateMemberTonePopupPos = useCallback((trigger?: HTMLElement | null) => {
    const target = trigger || document.querySelector(`[data-tone-trigger="${activeVocalTonePopup || ''}"]`) as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    if (!rect) return;

    // 멤버 카드/스크롤 부모 아래에 묶이지 않도록 Portal + fixed 좌표로 최상단 레이어에서 띄운다.
    // 버튼이 역할 버튼 라인으로 이동했기 때문에, 버튼 폭이 아니라 드롭다운에 필요한 최소 폭을 보장한다.
    const viewportPadding = 12;
    const width = Math.max(280, Math.min(340, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(rect.right - width, viewportPadding),
      window.innerWidth - width - viewportPadding
    );
    const bottomSpace = window.innerHeight - rect.bottom - viewportPadding;
    const topSpace = rect.top - viewportPadding;
    const shouldOpenAbove = bottomSpace < 190 && topSpace > bottomSpace;
    const maxHeight = Math.max(170, Math.min(320, shouldOpenAbove ? topSpace - 6 : bottomSpace));
    const top = shouldOpenAbove ? Math.max(viewportPadding, rect.top - maxHeight - 6) : rect.bottom + 6;

    setVocalTonePopupPos({ top, left, width, maxHeight });
  }, [activeVocalTonePopup]);

  const handleVocalToneClick = (e: React.MouseEvent, id: string) => {
    const trigger = e.currentTarget as HTMLElement;
    if (activeVocalTonePopup === id) {
      setActiveVocalTonePopup(null);
      setMemberToneDirectInputId(null);
      setMemberToneDirectDraft('');
      return;
    }
    setMemberToneDirectInputId(null);
    setMemberToneDirectDraft('');
    updateMemberTonePopupPos(trigger);
    setActiveVocalTonePopup(id);
  };

  const startMemberToneDirectInput = (member: VocalMember) => {
    setMemberToneDirectInputId(member.id);
    setMemberToneDirectDraft(getVocalToneDisplayLabel(member.toneId, vocalTones));
  };

  const applyMemberToneDirectInput = (idx: number) => {
    const nextTone = memberToneDirectDraft.trim();
    if (!nextTone) return;
    handleUpdateMember(idx, { toneId: nextTone });
    setMemberToneDirectInputId(null);
    setMemberToneDirectDraft('');
    setActiveVocalTonePopup(null);
  };

  const cancelMemberToneDirectInput = () => {
    setMemberToneDirectInputId(null);
    setMemberToneDirectDraft('');
  };

  useEffect(() => {
    if (!activeVocalTonePopup) return;

    updateMemberTonePopupPos();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveVocalTonePopup(null);
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-member-tone-panel]') || target.closest('[data-tone-trigger]')) return;
      setActiveVocalTonePopup(null);
      setMemberToneDirectInputId(null);
      setMemberToneDirectDraft('');
    };

    const handleWindowChange = () => updateMemberTonePopupPos();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [activeVocalTonePopup, updateMemberTonePopupPos]);

  const getModeLabel = (mode: VocalMode) => {
    if (mode === 'solo') return "솔로";
    return "그룹";
  };

  const getCombinedDescription = () => {
    if (maleCount === 0 && femaleCount === 0) return "보컬의 구성과 성별을 선택합니다.";
    
    const parts = [];
    parts.push(getModeLabel(vocalMode));
    
    if (maleCount > 0 && femaleCount > 0) parts.push("혼성");
    else if (maleCount > 0) parts.push("남성");
    else if (femaleCount > 0) parts.push("여성");
    
    return parts.join(" ");
  };

  const [contentHeight, setContentHeight] = useState<number | string>('auto');

  useStableContentHeight(contentRef, setContentHeight, [vocalMode, maleCount, femaleCount, vocalMembers, rapEnabled, isKoreanEnglishMix, englishMixRatio]);

  const handleModeClick = (mode: VocalMode) => {
    const nextMode = mode === 'duo' ? 'group' : mode;
    onModeChange(nextMode);

    // Reset counts when mode changes to keep it consistent
    if (nextMode === 'solo') {
      if (maleCount > 0) { onMaleChange(1); onFemaleChange(0); }
      else if (femaleCount > 0) { onMaleChange(0); onFemaleChange(1); }
      else { onMaleChange(1); onFemaleChange(0); } // Default to male solo
    } else if (nextMode === 'group') {
      // Start with a simple two-person group if empty.
      if (maleCount + femaleCount < 2) {
        onMaleChange(1); onFemaleChange(1);
      }
    }

    onHover({ id: 'vocal-mode', label: 'Vocal Mode', labelKo: getModeLabel(nextMode), description: `${getModeLabel(nextMode)} 모드로 전환합니다.`, _ts: Date.now() });
  };

  const handleGenderToggle = (gender: 'male' | 'female') => {
    if (vocalMode === 'solo') {
      // Solo mode: selected gender button toggles off to random solo.
      // male only = solo male, female only = solo female, none = random solo.
      if (gender === 'male') {
        if (maleCount > 0 && femaleCount === 0) {
          onMaleChange(0);
          onFemaleChange(0);
        } else {
          onMaleChange(1);
          onFemaleChange(0);
        }
      } else {
        if (femaleCount > 0 && maleCount === 0) {
          onMaleChange(0);
          onFemaleChange(0);
        } else {
          onMaleChange(0);
          onFemaleChange(1);
        }
      }
    } else if (vocalMode === 'group') {
      // Group mode has explicit add/remove member controls.
      // Gender buttons are not used here.
      return;
    }
    onHover({ 
      id: gender, 
      label: gender === 'male' ? 'Male' : 'Female', 
      labelKo: gender === 'male' ? '남성' : '여성', 
      description: `${gender === 'male' ? '남성' : '여성'} 보컬 비중을 조절합니다.`, 
      _ts: Date.now() 
    });
  };

  const handleAddMember = (gender: 'male' | 'female') => {
    if (maleCount + femaleCount >= 7) return;
    
    const newMember: VocalMember = {
      id: `member_${Date.now()}`,
      gender,
      roles: ['sub'],
    };
    
    const newMembers = [...vocalMembers, newMember];
    onMembersChange(newMembers);
    if (gender === 'male') onMaleChange(maleCount + 1);
    else onFemaleChange(femaleCount + 1);
  };

  const handleRemoveMember = (idx: number) => {
    // Group mode allows removing the last member too.
    // When all members are removed, generation treats it as a random group vocal.
    const member = vocalMembers[idx];
    if (!member) return;

    const newMembers = vocalMembers.filter((_, i) => i !== idx);
    onMembersChange(newMembers);

    if (member.gender === 'male') onMaleChange(Math.max(0, maleCount - 1));
    else onFemaleChange(Math.max(0, femaleCount - 1));
  };

  const handleUpdateMember = (idx: number, updates: Partial<VocalMember>) => {
    const newMembers = [...vocalMembers];
    newMembers[idx] = { ...newMembers[idx], ...updates };
    onMembersChange(newMembers);
  };


  const updateMemberCharacter = (idx: number, updates: Partial<NonNullable<VocalMember['character']>>) => {
    const current = vocalMembers[idx]?.character || {};
    handleUpdateMember(idx, {
      character: {
        ...current,
        ...updates,
      },
    });
  };

  const toggleMemberTechnique = (idx: number, techniqueId: string) => {
    const current = vocalMembers[idx]?.character?.techniqueIds || [];
    const next = current.includes(techniqueId)
      ? current.filter((id) => id !== techniqueId)
      : [...current, techniqueId];
    updateMemberCharacter(idx, { techniqueIds: next });
  };

  const getVocalCharacterSummary = (member: VocalMember) => {
    const character = member.character || {};
    const scaleParts = VOCAL_CHARACTER_SCALE_CONFIGS
      .flatMap((config) => {
        const level = getVocalCharacterScaleLevel(character, config);
        const labels: string[] = [];
        if (!isVocalCharacterScaleDefaultLevel(config, level)) labels.push(getVocalCharacterScaleStep(config.key, level)?.labelKo || '');
        if (isVocalCharacterOrnamentConfig(config)) {
          const secondaryLevel = getVocalCharacterOrnamentSecondaryLevel(character, config);
          if (!isVocalCharacterScaleDefaultLevel(config, secondaryLevel)) labels.push(`${config.steps[secondaryLevel - 1]?.labelKo || ''}`);
        }
        return labels.filter(Boolean);
      })
      .filter(Boolean)
      .slice(0, 4);
    const voice = VOCAL_VOICE_TONES.find((item) => item.id === character.voiceToneId)?.labelKo;
    const personality = VOCAL_PERSONALITIES.find((item) => item.id === character.personalityId)?.labelKo;
    const techniques = (character.techniqueIds || [])
      .map((id) => VOCAL_TECHNIQUES.find((item) => item.id === id)?.labelKo)
      .filter(Boolean)
      .slice(0, 2);
    const parts = [...scaleParts, voice, personality, ...techniques].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : '연령 / 음역 / 창법 / 박자 / 감정 / 매력';
  };

  const editingVocalMemberIndex = editingVocalMemberId
    ? vocalMembers.findIndex((member) => member.id === editingVocalMemberId)
    : -1;
  const editingVocalMember = editingVocalMemberIndex >= 0 ? vocalMembers[editingVocalMemberIndex] : null;
  const [localVocalCharacterDraft, setLocalVocalCharacterDraft] = useState<NonNullable<VocalMember['character']>>({});
  const initialVocalCharacterRef = useRef<NonNullable<VocalMember['character']>>({});
  const vocalCharacterBackdropPointerDownRef = useRef(false);
  const vocalCharacterCloseFromHistoryRef = useRef(false);
  const vocalCharacterTouchStartYRef = useRef<number | null>(null);

  const stopVocalCharacterScrollChaining = (element: HTMLElement, deltaY: number, preventDefault: () => void) => {
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    if (!canScroll) {
      preventDefault();
      return;
    }

    const atTop = element.scrollTop <= 0;
    const atBottom = Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight;
    if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
      preventDefault();
    }
  };

  const handleVocalCharacterWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    stopVocalCharacterScrollChaining(event.currentTarget, event.deltaY, () => event.preventDefault());
  };

  const handleVocalCharacterTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    vocalCharacterTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleVocalCharacterTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const startY = vocalCharacterTouchStartYRef.current;
    const currentY = event.touches[0]?.clientY ?? null;
    if (startY === null || currentY === null) return;
    stopVocalCharacterScrollChaining(event.currentTarget, startY - currentY, () => event.preventDefault());
  };

  const blockVocalCharacterOuterScroll = (event: React.WheelEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    onModalStateChange?.(!!editingVocalMember);
  }, [editingVocalMember, onModalStateChange]);

  useEffect(() => {
    const handleCloseStudioModals = () => {
      setEditingVocalMemberId(null);
      setActiveVocalTonePopup(null);
      vocalCharacterBackdropPointerDownRef.current = false;
      vocalCharacterCloseFromHistoryRef.current = false;
    };
    window.addEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
    return () => window.removeEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
  }, []);

  const getVocalCharacterSignature = useCallback((character?: VocalMember['character']) => JSON.stringify({
    voiceToneId: character?.voiceToneId || '',
    personalityId: character?.personalityId || '',
    techniqueIds: [...(character?.techniqueIds || [])].sort(),
    ageLevel: character?.ageLevel || '',
    rangeLevel: character?.rangeLevel || '',
    deliveryLevel: character?.deliveryLevel || '',
    rhythmLevel: character?.rhythmLevel || '',
    emotionLevel: character?.emotionLevel || '',
    textureLevel: character?.textureLevel || '',
    charmLevel: character?.charmLevel || '',
    ornamentLevel: character?.ornamentLevel || '',
    ornamentSecondaryLevel: (character as any)?.ornamentSecondaryLevel || '',
  }), []);

  const hasNonDefaultVocalCharacterScale = VOCAL_CHARACTER_SCALE_CONFIGS.some((config) => {
    const value = Number(localVocalCharacterDraft[config.key]);
    const hasMain = Number.isFinite(value) && !isVocalCharacterScaleDefaultLevel(config, Math.min(config.steps.length, Math.max(1, Math.round(value))));
    if (!isVocalCharacterOrnamentConfig(config)) return hasMain;
    const secondaryValue = Number((localVocalCharacterDraft as any).ornamentSecondaryLevel);
    const hasSecondary = Number.isFinite(secondaryValue) && !isVocalCharacterScaleDefaultLevel(config, Math.min(config.steps.length, Math.max(1, Math.round(secondaryValue))));
    return hasMain || hasSecondary;
  });

  const hasVocalCharacterChanges = getVocalCharacterSignature(localVocalCharacterDraft) !== getVocalCharacterSignature(initialVocalCharacterRef.current);
  const hasVocalCharacterSelection = Boolean(
    hasNonDefaultVocalCharacterScale ||
    localVocalCharacterDraft.voiceToneId ||
    localVocalCharacterDraft.personalityId ||
    (localVocalCharacterDraft.techniqueIds || []).length > 0
  );

  const closeVocalCharacterEditor = useCallback(() => {
    if (window.history.state?.vocalCharacterEditor && !vocalCharacterCloseFromHistoryRef.current) {
      vocalCharacterCloseFromHistoryRef.current = true;
      window.history.back();
      return;
    }
    setEditingVocalMemberId(null);
  }, []);

  useEffect(() => {
    if (!editingVocalMember) return;
    const initialCharacter = { ...(editingVocalMember.character || {}) };
    if (initialCharacter.techniqueIds) {
      initialCharacter.techniqueIds = [...initialCharacter.techniqueIds];
    }
    initialVocalCharacterRef.current = initialCharacter;
    setLocalVocalCharacterDraft(initialCharacter);
    vocalCharacterCloseFromHistoryRef.current = false;

    try {
      window.history.pushState({ ...(window.history.state || {}), vocalCharacterEditor: true }, '');
    } catch {
      // ignore history errors in embedded preview environments
    }

    const handlePopState = () => {
      vocalCharacterCloseFromHistoryRef.current = true;
      setEditingVocalMemberId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeVocalCharacterEditor();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingVocalMember, closeVocalCharacterEditor]);

  const updateLocalVocalCharacter = useCallback((updates: Partial<NonNullable<VocalMember['character']>>) => {
    setLocalVocalCharacterDraft((current) => ({
      ...current,
      ...updates,
    }));
  }, []);

  const handleVocalCharacterDualSliderDragStart = useCallback((event: React.PointerEvent<HTMLButtonElement>, config: VocalCharacterScaleConfig, fieldKey: 'ornamentLevel' | 'ornamentSecondaryLevel') => {
    event.preventDefault();
    event.stopPropagation();

    const track = event.currentTarget.closest('[data-vocal-character-dual-track]') as HTMLElement | null;
    if (!track) return;

    const updateFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
      const nextLevel = Math.round(ratio * (config.steps.length - 1)) + 1;
      updateLocalVocalCharacter({ [fieldKey]: nextLevel } as Partial<NonNullable<VocalMember['character']>>);
    };

    updateFromClientX(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateFromClientX(moveEvent.clientX);
    };

    const handlePointerEnd = () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerEnd, true);
      document.removeEventListener('pointercancel', handlePointerEnd, true);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerEnd, true);
    document.addEventListener('pointercancel', handlePointerEnd, true);
  }, [updateLocalVocalCharacter]);

  const toggleLocalVocalTechnique = useCallback((techniqueId: string) => {
    setLocalVocalCharacterDraft((current) => {
      const techniqueIds = current.techniqueIds || [];
      const next = techniqueIds.includes(techniqueId)
        ? techniqueIds.filter((id) => id !== techniqueId)
        : [...techniqueIds, techniqueId];
      return { ...current, techniqueIds: next };
    });
  }, []);

  const clearLocalVocalCharacter = useCallback(() => {
    setLocalVocalCharacterDraft({});
  }, []);

  const applyVocalCharacterAndClose = useCallback(() => {
    if (!editingVocalMember || editingVocalMemberIndex < 0) return;
    const normalizedCharacter: NonNullable<VocalMember['character']> = {
      ...(localVocalCharacterDraft.voiceToneId ? { voiceToneId: localVocalCharacterDraft.voiceToneId } : {}),
      ...(localVocalCharacterDraft.personalityId ? { personalityId: localVocalCharacterDraft.personalityId } : {}),
      ...((localVocalCharacterDraft.techniqueIds || []).length > 0 ? { techniqueIds: localVocalCharacterDraft.techniqueIds } : {}),
    };
    VOCAL_CHARACTER_SCALE_CONFIGS.forEach((config) => {
      const value = Number(localVocalCharacterDraft[config.key]);
      const safeValue = Math.min(config.steps.length, Math.max(1, Math.round(value)));
      if (Number.isFinite(value) && !isVocalCharacterScaleDefaultLevel(config, safeValue)) {
        (normalizedCharacter as any)[config.key] = safeValue;
      }
      if (isVocalCharacterOrnamentConfig(config)) {
        const secondaryValue = Number((localVocalCharacterDraft as any).ornamentSecondaryLevel);
        const safeSecondaryValue = Math.min(config.steps.length, Math.max(1, Math.round(secondaryValue)));
        if (Number.isFinite(secondaryValue) && !isVocalCharacterScaleDefaultLevel(config, safeSecondaryValue)) {
          (normalizedCharacter as any).ornamentSecondaryLevel = safeSecondaryValue;
        }
      }
    });
    handleUpdateMember(editingVocalMemberIndex, {
      character: Object.keys(normalizedCharacter).length > 0 ? normalizedCharacter : undefined,
    });
    closeVocalCharacterEditor();
  }, [closeVocalCharacterEditor, editingVocalMember, editingVocalMemberIndex, handleUpdateMember, localVocalCharacterDraft]);

  const filteredTones = vocalTones.filter(t => {
    const target = t.genderTarget as string;
    if (target === 'any' || target === 'unisex') return true;
    
    if (maleCount > 0 && femaleCount > 0) {
      return target === 'unisex' || target === 'any' || target === 'group';
    }
    if (maleCount > 0) {
      return target === 'male' || target === 'any' || (vocalMode === 'group' && target === 'group');
    }
    if (femaleCount > 0) {
      return target === 'female' || target === 'any' || (vocalMode === 'group' && target === 'group');
    }
    
    return true;
  });

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl pt-3 px-5 pb-10 border border-[var(--home-card-border)] flex flex-col h-full shadow-[var(--shadow-md)] relative overflow-visible">
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 
            onMouseEnter={() => setShowTitleTooltip(true)}
            onMouseLeave={() => setShowTitleTooltip(false)}
            className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
          >
            <span className="w-1.5 h-5 bg-[#658761] rounded-full" />
            보컬
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onToggleLock && (
            <button
              type="button"
              onClick={onToggleLock}
              onMouseEnter={() => onHover({ id: 'vocal-lock', label: isLocked ? 'Unlock menu' : 'Lock menu', labelKo: isLocked ? '잠금 해제' : '메뉴 잠금', description: isLocked ? '보컬 메뉴를 랜덤 선택에 다시 포함합니다.' : '현재 보컬 설정을 유지하고 랜덤 선택에서 제외합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2 rounded-lg transition-all border border-btn-border shadow-btn",
                isLocked
                  ? "bg-[#658761]/72 text-[#171717] font-black border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                  : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover"
              )}
              title={isLocked ? '잠금 해제' : '메뉴 잠금'}
              aria-label={isLocked ? '보컬 잠금 해제' : '보컬 잠금'}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'vocal-clear', label: 'Reset', labelKo: '초기화', description: '보컬 설정을 초기화합니다.' })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "p-2 rounded-lg transition-all border shadow-btn",
              (maleCount > 0 || femaleCount > 0)
                ? "bg-[#658761]/20 text-[#A8C49F] border-black/20/30 hover:bg-[#658761]/30" 
                : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-black/20/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{getCombinedDescription()}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn(
        "flex flex-col flex-1 overflow-visible transition-all duration-500 ease-in-out",
        (vocalMembers.length > 0 || maleCount > 0 || femaleCount > 0 || vocalMode === 'group') ? "justify-start" : "justify-center"
      )}>
        <motion.div 
          animate={{ height: contentHeight }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="soridraw-expand-content overflow-hidden min-h-[76px]"
        >
          <div ref={contentRef} className="space-y-2 mt-0">
            {/* Mode Selection */}
          <div className="flex gap-1 bg-btn-bg p-1 rounded-xl border border-btn-border shadow-btn">
            {(['solo', 'group'] as VocalMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeClick(mode)}
                onMouseEnter={() => {
                  const modeInfo = {
                    solo: { label: 'Solo', labelKo: '솔로', description: '혼자서 노래하는 솔로 보컬을 선택합니다.' },
                    duo: { label: 'Group', labelKo: '그룹', description: '두 명 이상을 캐릭터별로 설정합니다.' },
                    group: { label: 'Group', labelKo: '그룹', description: '두 명 이상을 캐릭터별로 설정합니다.' }
                  };
                  onHover({ id: `vocal-mode-${mode}`, ...modeInfo[mode] });
                }}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                  vocalMode === mode 
                    ? "bg-[#658761] text-[#171717] font-black shadow-md" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-btn-hover"
                )}
              >
                {getModeLabel(mode)}
              </button>
            ))}
          </div>

          {/* Gender Selection */}
          {vocalMode === 'group' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddMember('male')}
                disabled={maleCount + femaleCount >= 7}
                onMouseEnter={() => onHover({ id: 'add-male', label: 'Add Male Member', labelKo: '남성 멤버 추가', description: '남성 보컬 멤버를 1명 추가합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3 px-2 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2.5",
                  maleCount + femaleCount < 7
                    ? "bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                남성 멤버 추가
              </button>
              <button
                onClick={() => handleAddMember('female')}
                disabled={maleCount + femaleCount >= 7}
                onMouseEnter={() => onHover({ id: 'add-female', label: 'Add Female Member', labelKo: '여성 멤버 추가', description: '여성 보컬 멤버를 1명 추가합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3 px-2 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2.5",
                  maleCount + femaleCount < 7
                    ? "bg-pink-600/10 border-pink-500/20 text-pink-400 hover:bg-pink-600/20"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                여성 멤버 추가
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleGenderToggle('male')}
                onMouseEnter={() => onHover({ id: 'male', label: 'Male', labelKo: '남성', description: '남성 보컬을 선택합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3.5 px-3 rounded-2xl text-[13px] font-bold transition-all border flex items-center justify-center gap-2.5 shadow-btn",
                  maleCount > 0
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", maleCount > 0 ? "bg-blue-400" : "bg-[var(--border-color)]")} />
                남성
              </button>
              <button
                onClick={() => handleGenderToggle('female')}
                onMouseEnter={() => onHover({ id: 'female', label: 'Female', labelKo: '여성', description: '여성 보컬을 선택합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3.5 px-3 rounded-2xl text-[13px] font-bold transition-all border flex items-center justify-center gap-2.5 shadow-btn",
                  femaleCount > 0
                    ? "bg-pink-600/20 border-pink-500/40 text-pink-400"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", femaleCount > 0 ? "bg-pink-400" : "bg-[var(--border-color)]")} />
                여성
              </button>
            </div>
          )}


          {/* Global vocal emotion direction removed.
              Vocal emotion/attitude is now handled per character through 성격. */}

          {/* Member Roles */}
          {vocalMembers.length > 0 && (
            <div className="space-y-1.5 pt-1.5 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">멤버 ({vocalMembers.length}/7)</p>
                <span className="text-[9px] text-[var(--text-secondary)] opacity-50">연령 · 음역 · 창법 · 기교</span>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                {vocalMembers.map((member, idx) => {
                  const sameGenderIndex = vocalMembers
                    .slice(0, idx + 1)
                    .filter(item => item.gender === member.gender).length - 1;
                  const memberLetter = String.fromCharCode(97 + sameGenderIndex);
                  const memberDisplayName = `${member.gender === 'male' ? '남자보컬' : '여자보컬'}${memberLetter}`;
                  const roleLabels: Record<VocalRole, { label: string, labelKo: string, description: string }> = {
                    main: { label: 'Main Vocal', labelKo: '메인', description: '곡의 중심이 되는 메인 보컬 역할을 수행합니다.' },
                    lead: { label: 'Lead Vocal', labelKo: '리드', description: '메인 보컬을 보조하며 곡의 흐름을 이끄는 역할을 수행합니다.' },
                    sub: { label: 'Sub Vocal', labelKo: '서브', description: '곡의 풍성함을 더해주는 서브 보컬 역할을 수행합니다.' },
                    rapper: { label: 'Rapper', labelKo: '래퍼', description: '곡의 랩 파트를 담당하는 래퍼 역할을 수행합니다.' }
                  };

                  return (
                  <div key={member.id} className="bg-btn-bg rounded-xl p-2 border border-btn-border relative group/member shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          member.gender === 'male' ? "bg-blue-400" : "bg-pink-400"
                        )} />
                        <span className="shrink-0 text-xs font-bold text-[var(--text-primary)]">
                          {memberDisplayName}
                        </span>
                        <span className="h-4 w-px shrink-0 bg-[var(--border-color)]" />
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          {(['main', 'lead', 'sub', 'rapper'] as VocalRole[]).map(role => {
                            const isActive = member.roles.includes(role);
                            const isRoleLimitReached = member.roles.length >= 2;
                            const info = roleLabels[role];
                            
                            return (
                              <button
                                key={role}
                                onClick={() => {
                                  if (isActive) {
                                    handleUpdateMember(idx, { roles: member.roles.filter(r => r !== role) });
                                    return;
                                  }
                                  if (isRoleLimitReached) return;
                                  handleUpdateMember(idx, { roles: [...member.roles, role] });
                                }}
                                onMouseEnter={() => onHover({ id: `role-${role}`, ...info })}
                                onMouseLeave={() => onHover(null)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border",
                                  isActive
                                    ? "bg-[#658761]/20 border-black/20 text-[#A8C49F]"
                                    : isRoleLimitReached
                                      ? "bg-btn-bg border-btn-border text-[var(--text-secondary)] opacity-45 cursor-not-allowed"
                                      : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                                )}
                              >
                                {info.labelKo}
                              </button>
                            );
                          })}
                          {/* Legacy 목소리(기본) tone selector is hidden.
                              If no member tone is selected, Gemini keeps using the existing genre-based recommended vocal tone. */}
                        </div>
                      </div>
                      
                      {(vocalMode === 'group' || vocalMode === 'solo') && (
                        <button
                          onClick={() => handleRemoveMember(idx)}
                          onMouseEnter={() => onHover({ id: `remove-member-${idx}`, label: 'Remove Member', labelKo: '멤버 삭제', description: vocalMode === 'solo' ? '선택한 솔로 보컬을 해제합니다.' : '이 멤버를 삭제합니다. 마지막 멤버까지 삭제하면 랜덤 그룹 보컬로 적용됩니다.' })}
                          onMouseLeave={() => onHover(null)}
                          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/member:opacity-100"
                        >
                          <X className="w-[18px] h-[18px]" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onModalStateChange?.(true);
                          setEditingVocalMemberId(member.id);
                        }}
                        className={cn(
                          "w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]/45 p-3 text-left transition-all group/character",
                          member.gender === 'male'
                            ? "hover:border-[#4B6280]/45 hover:bg-[#4B6280]/5"
                            : "hover:border-[#73495D]/45 hover:bg-[#73495D]/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-black tracking-tight",
                                member.gender === 'male' ? "text-[#4B6280]" : "text-[#73495D]"
                              )}>보컬 캐릭터 만들기</span>
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-[var(--text-primary)] truncate">
                              {getVocalCharacterSummary(member)}
                            </p>
                          </div>
                          <div className={cn(
                            "shrink-0 p-1 text-[var(--text-secondary)] transition-colors",
                            member.gender === 'male' ? "group-hover/character:text-[#4B6280]" : "group-hover/character:text-[#73495D]"
                          )}>
                            <Edit2 className="w-[22px] h-[22px]" />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {activeVocalTonePopup === member.id && (
                          <Portal>
                            <motion.div
                              data-member-tone-panel
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.14, ease: 'easeOut' }}
                              className="fixed z-[10050] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[#050505] shadow-2xl shadow-black/60"
                              style={{
                                top: vocalTonePopupPos.top,
                                left: vocalTonePopupPos.left,
                                width: vocalTonePopupPos.width,
                                maxHeight: vocalTonePopupPos.maxHeight,
                              }}
                            >
                              <div className="overflow-y-auto custom-scrollbar p-1.5 space-y-1 bg-[#050505]" style={{ maxHeight: vocalTonePopupPos.maxHeight }}>
                                <button
                                  type="button"
                                  onClick={() => { handleUpdateMember(idx, { toneId: undefined }); setMemberToneDirectInputId(null); setMemberToneDirectDraft(''); setActiveVocalTonePopup(null); }}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                                    !member.toneId
                                      ? "bg-[#658761] text-[#171717] font-black border-black/20 shadow-lg shadow-[#658761]/20"
                                      : "bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[#A8C49F]"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span>기본 추천 사용</span>
                                    {!member.toneId && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  </div>
                                </button>

                                {memberToneDirectInputId === member.id ? (
                                  <div
                                    className="rounded-lg border border-black/20 bg-[#111] p-2 space-y-2"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      value={memberToneDirectDraft}
                                      onChange={(e) => setMemberToneDirectDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyMemberToneDirectInput(idx);
                                        if (e.key === 'Escape') cancelMemberToneDirectInput();
                                      }}
                                      placeholder="직접 입력: 예: 공기 섞인 콧소리, 2000s K-indie airy tone"
                                      className="w-full rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] px-2.5 py-2 text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60"
                                      autoFocus
                                    />
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={cancelMemberToneDirectInput}
                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a]"
                                      >
                                        취소
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applyMemberToneDirectInput(idx)}
                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border bg-brand-orange border-brand-orange text-white shadow-lg shadow-[#658761]/20 disabled:opacity-50"
                                        disabled={!memberToneDirectDraft.trim()}
                                      >
                                        적용
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startMemberToneDirectInput(member);
                                    }}
                                    className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[#A8C49F]"
                                  >
                                    <span>직접 입력</span>
                                    <Edit2 className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                )}

                                {vocalTones
                                  .filter(t => t.genderTarget === 'any' || t.genderTarget === 'unisex' || t.genderTarget === member.gender || (vocalMode === 'group' && t.genderTarget === 'group'))
                                  .map(tone => {
                                    const isToneActive = member.toneId === tone.id;
                                    return (
                                      <button
                                        key={tone.id}
                                        type="button"
                                        onClick={() => { handleUpdateMember(idx, { toneId: tone.id }); setMemberToneDirectInputId(null); setMemberToneDirectDraft(''); setActiveVocalTonePopup(null); }}
                                        className={cn(
                                          "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border text-left",
                                          isToneActive
                                            ? "bg-[#658761] text-[#171717] font-black border-black/20 shadow-lg shadow-[#658761]/20"
                                            : "bg-[#1f1f1f] border-[#3a3a3a] text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[#A8C49F]"
                                        )}
                                      >
                                        <span className="leading-snug">{tone.labelKo || tone.label}</span>
                                        {isToneActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                                      </button>
                                    );
                                  })}
                              </div>
                            </motion.div>
                          </Portal>
                        )}
                      </AnimatePresence>
                  </div>
                </div>
                  );
                })}
            </div>
          </div>
        )}

      </div>
    </motion.div>
      </div>

      <AnimatePresence>
        {editingVocalMember && (
          <Portal>
            <motion.div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm overscroll-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(e) => {
                vocalCharacterBackdropPointerDownRef.current = e.target === e.currentTarget;
              }}
              onPointerUp={(e) => {
                if (vocalCharacterBackdropPointerDownRef.current && e.target === e.currentTarget) {
                  vocalCharacterBackdropPointerDownRef.current = false;
                  applyVocalCharacterAndClose();
                  return;
                }
                vocalCharacterBackdropPointerDownRef.current = false;
              }}
              onPointerCancel={() => { vocalCharacterBackdropPointerDownRef.current = false; }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onWheel={blockVocalCharacterOuterScroll}
                onTouchMove={blockVocalCharacterOuterScroll}
                className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.66)]"
              >
                <div className="flex items-center justify-between gap-3 bg-[#151515] px-5 py-4 shadow-[inset_0_-1px_0_rgba(101,135,97,0.08)]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        editingVocalMember.gender === 'male' ? "bg-blue-400" : "bg-pink-400"
                      )} />
                      <h4 className="text-lg font-black text-[var(--text-primary)]">
                        {editingVocalMember.gender === 'male' ? '남성' : '여성'} {editingVocalMemberIndex + 1} 캐릭터
                      </h4>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-[#A8C49F]">{getVocalCharacterSummary({ ...editingVocalMember, character: localVocalCharacterDraft })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasVocalCharacterSelection && (
                      <button
                        type="button"
                        onClick={clearLocalVocalCharacter}
                        className="h-10 px-3 rounded-xl bg-[#658761]/12 text-[#A8C49F] hover:bg-[#658761]/18 transition-all text-[11px] font-black whitespace-nowrap"
                        title="캐릭터 전체 해제"
                      >
                        전체 해제
                      </button>
                    )}
                    {hasVocalCharacterChanges && (
                      <button
                        type="button"
                        onClick={applyVocalCharacterAndClose}
                        className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all shrink-0 bg-[#658761] text-[#171717] font-black border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)] hover:bg-[#6F946A]"
                        title="변경 적용"
                        aria-label="변경 적용"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeVocalCharacterEditor}
                      className="rounded-full bg-btn-bg p-2 text-[var(--text-secondary)] transition-all hover:bg-[#658761]/10 hover:text-[#A8C49F]"
                      title={hasVocalCharacterChanges ? "변경 적용 없이 닫기" : "닫기"}
                      aria-label={hasVocalCharacterChanges ? "변경 적용 없이 닫기" : "닫기"}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div
                  className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4"
                  style={{ overscrollBehavior: 'contain' }}
                  onWheel={handleVocalCharacterWheel}
                  onTouchStart={handleVocalCharacterTouchStart}
                  onTouchMove={handleVocalCharacterTouchMove}
                >
                  <div className="space-y-5">
                    <section className="space-y-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h5 className="text-base font-black text-[var(--text-primary)]">보컬 캐릭터 게이지</h5>
                          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">가운데가 기본값입니다. 움직인 항목만 보컬 프롬프트에 반영됩니다.</p>
                        </div>
                        <span className="text-xs font-bold text-[#A8C49F]">좌우 5단계 · 기교 좌우 7단계</span>
                      </div>

                      <div className="space-y-3">
                        {VOCAL_CHARACTER_SCALE_CONFIGS.map((config) => {
                          const value = getVocalCharacterScaleLevel(localVocalCharacterDraft, config);
                          const step = config.steps[value - 1];
                          const isOrnament = isVocalCharacterOrnamentConfig(config);
                          const secondaryValue = isOrnament ? getVocalCharacterOrnamentSecondaryLevel(localVocalCharacterDraft, config) : config.defaultValue;
                          const secondaryStep = config.steps[secondaryValue - 1];
                          const isDefault = isVocalCharacterScaleDefaultLevel(config, value);
                          const isSecondaryDefault = !isOrnament || isVocalCharacterScaleDefaultLevel(config, secondaryValue);
                          const isCardActive = !isDefault || !isSecondaryDefault;
                          const mainPercent = config.steps.length > 1 ? ((value - 1) / (config.steps.length - 1)) * 100 : 50;
                          const secondaryPercent = config.steps.length > 1 ? ((secondaryValue - 1) / (config.steps.length - 1)) * 100 : 50;
                          const mainHandleClass = editingVocalMember?.gender === 'female' ? 'vocal-character-dual-handle-female' : 'vocal-character-dual-handle-male';
                          return (
                            <div
                              key={config.key}
                              className={cn(
                                "rounded-2xl p-4 transition-all shadow-[0_10px_26px_rgba(0,0,0,0.18)]",
                                isCardActive
                                  ? "bg-[#658761]/12"
                                  : "bg-[#1a1a1a]"
                              )}
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <h6 className="text-base font-black text-[#A8C49F]">{config.titleKo}</h6>
                                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-black", isDefault ? "bg-btn-bg text-[var(--text-secondary)]" : "bg-[#658761]/14 text-[#A8C49F]")}>{step.labelKo}</span>
                                    {isOrnament && !isSecondaryDefault && (
                                      <span className="rounded-full bg-[#658761]/14 px-2.5 py-0.5 text-[11px] font-black text-[#A8C49F]">{secondaryStep.labelKo}</span>
                                    )}
                                  </div>
                                  <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">{config.subtitleKo}</p>
                                </div>
                                <span className="shrink-0 text-xs font-black text-[#A8C49F]">{isOrnament ? `${value}/${config.steps.length}${!isSecondaryDefault ? ` · ${secondaryValue}/${config.steps.length}` : ''}` : `${value}/${config.steps.length}`}</span>
                              </div>

                              {isOrnament ? (
                                <div className="relative px-[1px] py-3">
                                  <div
                                    data-vocal-character-dual-track
                                    className="vocal-character-dual-track"
                                  >
                                    <div className="vocal-character-slider-center-marker" />
                                    <button
                                      type="button"
                                      aria-label={`${config.titleKo} 보조 기교`}
                                      title={isSecondaryDefault ? '보조기교: Gemini 자동 보정' : `보조기교: ${secondaryStep.labelKo}`}
                                      onPointerDown={(event) => handleVocalCharacterDualSliderDragStart(event, config, 'ornamentSecondaryLevel')}
                                      className="vocal-character-dual-handle vocal-character-dual-handle-secondary"
                                      style={{ left: `${secondaryPercent}%` }}
                                    />
                                    <button
                                      type="button"
                                      aria-label={`${config.titleKo} 메인 기교`}
                                      title={`메인기교: ${step.labelKo}`}
                                      onPointerDown={(event) => handleVocalCharacterDualSliderDragStart(event, config, 'ornamentLevel')}
                                      className={cn("vocal-character-dual-handle vocal-character-dual-handle-main", mainHandleClass)}
                                      style={{ left: `${mainPercent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="relative px-[1px] py-2">
                                  <div className="vocal-character-slider-center-marker" />
                                  <input
                                    type="range"
                                    min={1}
                                    max={config.steps.length}
                                    step={1}
                                    value={value}
                                    onChange={(event) => updateLocalVocalCharacter({ [config.key]: Number(event.currentTarget.value) } as Partial<NonNullable<VocalMember['character']>>)}
                                    className={cn("vocal-character-slider w-full", editingVocalMember?.gender === 'female' ? 'vocal-character-slider-female' : 'vocal-character-slider-male')}
                                    aria-label={config.titleKo}
                                  />
                                </div>
                              )}

                              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                                <span>{config.minLabelKo}</span>
                                <span className="truncate text-center text-[var(--text-secondary)]">{isOrnament && !isSecondaryDefault ? `${step.hintKo} + ${secondaryStep.hintKo}` : step.hintKo}</span>
                                <span>{config.maxLabelKo}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>

              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}


interface TempoControlProps {
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  min: number;
  max: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function TempoControl({ enabled, onEnabledChange, min, max, onMinChange, onMaxChange, onClear, onHover, onLongPressStart, onLongPressEnd }: TempoControlProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const handleStart = (type: 'min' | 'max') => {
    if (enabled) return; // If random is enabled, slider is disabled
    setIsDragging(type);
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isDragging || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const val = Math.round(TEMPO_MIN_BPM + percent * (TEMPO_MAX_BPM - TEMPO_MIN_BPM));

      if (isDragging === 'min') {
        if (val <= max) onMinChange(val);
      } else {
        if (val >= min) onMaxChange(val);
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(null);
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, onMinChange, onMaxChange]);

  const displayMin = min;
  const displayMax = max;
  const minPos = ((displayMin - TEMPO_MIN_BPM) / (TEMPO_MAX_BPM - TEMPO_MIN_BPM)) * 100;
  const maxPos = ((displayMax - TEMPO_MIN_BPM) / (TEMPO_MAX_BPM - TEMPO_MIN_BPM)) * 100;
  const isValid = (max - min <= TEMPO_MAX_ACTIVE_RANGE) && (min !== TEMPO_MIN_BPM || max !== TEMPO_MAX_BPM);

  return (
    <div className={cn(
      "bg-[var(--card-bg)] rounded-3xl px-6 py-4 border border-[var(--home-card-border)] transition-all shadow-[var(--shadow-md)]"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <h3 
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
            >
              <span className="w-1.5 h-5 bg-[#658761] rounded-full" />
              템포(BPM)
            </h3>

            <div 
              className={cn(
                "hidden md:flex items-center gap-1 px-2.5 py-2 bg-btn-bg rounded-xl border border-btn-border shadow-btn transition-opacity",
                enabled && "opacity-30 pointer-events-none"
              )}
              onMouseEnter={() => onHover({ id: 'bpm-input-pc', label: 'BPM Input', labelKo: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
              onMouseLeave={() => onHover(null)}
            >
              <input
                type="number"
                min={TEMPO_MIN_BPM}
                max={max}
                value={min}
                disabled={enabled}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    const clamped = Math.max(TEMPO_MIN_BPM, Math.min(val, max));
                    onMinChange(clamped);
                  }
                }}
                className="w-7 bg-transparent text-[#A8C49F] font-mono font-bold text-[14px] focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[var(--text-secondary)]/50 font-bold text-sm">-</span>
              <input
                type="number"
                min={min}
                max={TEMPO_MAX_BPM}
                value={max}
                disabled={enabled}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    const clamped = Math.max(min, Math.min(val, TEMPO_MAX_BPM));
                    onMaxChange(clamped);
                  }
                }}
                className="w-7 bg-transparent text-[#C5D6BD] font-mono font-bold text-[14px] focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[var(--text-secondary)] text-[9px] uppercase font-bold tracking-tighter">bpm</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => {
                  onEnabledChange(!enabled);
                  onHover({ id: 'tempo-random-mobile', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
                }}
                onMouseEnter={() => onHover({ id: 'tempo-random-mobile', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  enabled 
                    ? "bg-[#658761] text-[#171717] font-black" 
                    : "bg-white/10 text-[var(--text-primary)] hover:bg-white/20"
                )}
              >
                <Dices className={cn("w-4 h-4", enabled && "animate-pulse")} />
                <span>랜덤</span>
              </button>
              <button
                onClick={onClear}
                onMouseEnter={() => onHover({ id: 'tempo-clear-mobile', label: 'Reset', labelKo: '초기화', description: '템포 설정을 초기화합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "p-2 rounded-lg transition-all border shadow-btn",
                  (!enabled || min !== 90 || max !== 110)
                    ? "bg-[#658761]/20 text-[#A8C49F] border-black/20/30 hover:bg-[#658761]/30" 
                    : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => {
                onEnabledChange(!enabled);
                onHover({ id: 'tempo-random-pc', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
              }}
              onMouseEnter={() => onHover({ id: 'tempo-random-pc', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "px-6 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-2",
                enabled 
                  ? "bg-[#658761] text-[#171717] font-black" 
                  : "bg-white/10 text-[var(--text-primary)] hover:bg-white/20"
              )}
            >
              <Dices className={cn("w-5 h-5", enabled && "animate-pulse")} />
              <span>랜덤</span>
            </button>
            <button
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'tempo-clear-pc', label: 'Reset', labelKo: '초기화', description: '템포 설정을 초기화합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2 rounded-lg transition-all border",
                (!enabled || min !== 90 || max !== 110)
                  ? "bg-[#658761]/20 text-[#A8C49F] border-black/20/30 hover:bg-[#658761]/30" 
                  : "bg-white/10 text-[var(--text-secondary)] border-white/10 hover:bg-white/20"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div 
          className={cn(
            "md:hidden flex items-center justify-center gap-1 px-3 py-2 bg-white/5 rounded-xl border border-white/10 shadow-[var(--shadow-md)] transition-opacity w-fit mx-auto",
            enabled && "opacity-30 pointer-events-none"
          )}
          onMouseEnter={() => onHover({ id: 'bpm-input-mobile', label: 'BPM Input', labelKo: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
          onMouseLeave={() => onHover(null)}
        >
          <input
            type="number"
            min={TEMPO_MIN_BPM}
            max={max}
            value={min}
            disabled={enabled}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const clamped = Math.max(TEMPO_MIN_BPM, Math.min(val, max));
                onMinChange(clamped);
              }
            }}
            className="w-9 bg-transparent text-[#A8C49F] font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[var(--text-secondary)]/50 font-bold text-base">-</span>
          <input
            type="number"
            min={min}
            max={TEMPO_MAX_BPM}
            value={max}
            disabled={enabled}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const clamped = Math.max(min, Math.min(val, TEMPO_MAX_BPM));
                onMaxChange(clamped);
              }
            }}
            className="w-9 bg-transparent text-[#C5D6BD] font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[var(--text-secondary)] text-[9px] uppercase font-bold tracking-tighter">bpm</span>
        </div>
      </div>

      <div 
        className={cn(
          "px-0 py-2 transition-opacity",
          enabled && "opacity-50 pointer-events-none"
        )}
        onMouseEnter={() => onHover({ id: 'bpm-slider', label: 'BPM 조절', description: '슬라이더를 드래그하여 BPM을 조절합니다.' })}
        onMouseLeave={() => onHover(null)}
      >
        <div 
          ref={sliderRef}
          className="relative h-2 bg-[var(--hover-bg)] rounded-full cursor-pointer mx-0"
          onClick={(e) => {
            if (enabled) return;
            const rect = sliderRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const val = Math.round(TEMPO_MIN_BPM + percent * (TEMPO_MAX_BPM - TEMPO_MIN_BPM));
            
            // Snap to nearest handle but respect constraints
            if (Math.abs(val - min) < Math.abs(val - max)) {
              onMinChange(Math.min(val, max));
            } else {
              onMaxChange(Math.max(val, min));
            }
          }}
        >
          {/* Active Range Bar */}
          <div 
            className={cn(
              "absolute h-full rounded-full transition-colors",
              !enabled ? (isValid ? "bg-[#658761]" : "bg-[var(--text-secondary)]/30") : "bg-[#658761]/40"
            )}
            style={{ left: `${minPos}%`, width: `${maxPos - minPos}%` }}
          />

          {/* Min Handle */}
          <div 
            onMouseDown={(e) => { e.stopPropagation(); handleStart('min'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleStart('min'); }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-20",
              !enabled 
                ? "bg-[var(--card-bg)] border-black/20 shadow-lg shadow-[#658761]/20 scale-110" 
                : "bg-[var(--card-bg)] border-black/20 shadow-lg shadow-[#658761]/10 scale-100 cursor-not-allowed",
              isDragging === 'min' && "scale-125 border-[#B8CB93]"
            )}
            style={{ left: `${minPos}%` }}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", !enabled ? "bg-[#658761]" : "bg-[#658761]/50")} />
          </div>

          {/* Max Handle */}
          <div 
            onMouseDown={(e) => { e.stopPropagation(); handleStart('max'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleStart('max'); }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-20",
              !enabled 
                ? "bg-[var(--card-bg)] border-[#8AA35A] shadow-lg shadow-[#8AA35A]/20 scale-110" 
                : "bg-[var(--card-bg)] border-[#8AA35A]/40 shadow-lg shadow-[#8AA35A]/10 scale-100 cursor-not-allowed",
              isDragging === 'max' && "scale-125 border-[#C5D6BD]"
            )}
            style={{ left: `${maxPos}%` }}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", !enabled ? "bg-[#8AA35A]" : "bg-[#8AA35A]/50")} />
          </div>
        </div>
        
        <div className="flex justify-between mt-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          <span>20 BPM</span>
          <span>100 BPM</span>
          <span>200 BPM</span>
        </div>
      </div>

      {/* Status Guidance Text - Repositioned to Bottom Center */}
      <div className="flex justify-center mt-2">
        {enabled ? (
          <span className="text-[#A8C49F] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#658761]/10 px-3 py-0.5 rounded-full border border-black/20/20">
            <Sparkles className="w-3 h-3 animate-pulse" /> 랜덤 템포 적용됨
          </span>
        ) : (
          isValid ? (
            <span className="text-[#C5D6BD] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#658761]/12 px-3 py-0.5 rounded-full border border-black/20/24">
              <Check className="w-3 h-3" /> 템포 지정됨
            </span>
          ) : (
            <span className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wider bg-[var(--hover-bg)]/50 px-3 py-0.5 rounded-full border border-[var(--border-color)]">
              범위 20 이하일 때 적용
            </span>
          )
        )}
      </div>
    </div>
  );
}
