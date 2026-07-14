import { TagTier } from './constants';

export interface CategoryItem {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  promptCore?: string;
  mood?: string;
  arrangement?: string;
  kind?: 'separator';
  _ts?: number;
}

export interface GenreGroup {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  children: CategoryItem[];
}

export interface SoundStyleItem extends CategoryItem {
  style?: string;
  sound?: string;
  mood?: string;
}

export interface InstrumentSoundItem extends CategoryItem {
  promptCore?: string;
}

export interface SoundStyleCycle {
  id: string;
  title: string;
  titleKo?: string;
  description?: string;
  descriptionKo?: string;
  variants: SoundStyleItem[];
}

export interface InstrumentSoundCycle {
  id: string;
  title: string;
  titleKo?: string;
  description?: string;
  descriptionKo?: string;
  variants: InstrumentSoundItem[];
}

export type Category = 'genre' | 'style' | 'mood';
export type LyricsLength = 'very-short' | 'short' | 'normal' | 'long';
export type SongStructure = '1' | '2' | '3' | 'custom'; // 1=자동, 2=기본랜덤, 3=변칙랜덤, custom=직접선택

export type VocalMode = 'solo' | 'duo' | 'group'; // 'duo' is kept for legacy saved data; UI now uses solo/group.

export type VocalRole = 'main' | 'lead' | 'sub' | 'rapper';


export type VocalTechniqueCategory = 'basic' | 'experimental';

export interface VocalTechniqueOption {
  id: string;
  category: VocalTechniqueCategory;
  label: string;
  labelKo: string;
  descriptionKo: string;
  usageKo: string[];
  promptCore: string;
  promptNatural: string;
}

export interface VocalVoiceToneOption {
  id: string;
  label: string;
  labelKo: string;
  promptCore: string;
}

export interface VocalPersonalityOption {
  id: string;
  label: string;
  labelKo: string;
  promptCore: string;
}

export interface VocalCharacterSelection {
  techniqueIds?: string[];
  voiceToneId?: string;
  personalityId?: string;
  rangeLevel?: number;
  deliveryLevel?: number;
  rhythmLevel?: number;
  emotionLevel?: number;
  textureLevel?: number;
  charmLevel?: number;
  ornamentLevel?: number;
  ornamentSecondaryLevel?: number;
  ageLevel?: number;
  customTechnique?: string;
  customVoiceTone?: string;
  customPersonality?: string;
  emphasizeInLyrics?: boolean;
  sunoReferenceUrl?: string;
  referenceSection?: string;
  referenceMemo?: string;
  displayName?: string;
  prompt?: string;
}

export interface VocalMember {
  id: string;
  gender: 'male' | 'female';
  roles: VocalRole[];
  toneId?: string;
  tonePrompt?: string;
  character?: VocalCharacterSelection;
}

export interface VocalTone {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  genderTarget: 'male' | 'female' | 'unisex' | 'group' | 'any';
  toneType?: string;
  genreTags: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  promptCore?: string;
  promptShort?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VocalConfig {
  male: number;
  female: number;
  rap: boolean;
  mode?: VocalMode;
  globalToneId?: string;
  tonePrompt?: string;
  isToneSelected?: boolean;
  // Future expansion fields
  members?: VocalMember[];
  isGroup?: boolean;
}


export type SituationVersion =
  | 'comic'
  | 'satire'
  | 'black-comedy'
  | 'absurd-comedy'
  | 'bittersweet'
  | 'tearful-comedy'
  | 'sharp-conflict'
  | 'generation-gap'
  | 'miscommunication'
  | 'role-reversal'
  | 'reconciliation'
  | 'parallel-ending'
  | 'one-sided-crush'
  | 'nostalgic-memory'
  | 'social-satire'
  | 'daily-life-slice'
  | 'dramatic-twist'
  | 'custom';

export interface SituationSpeakerConfig {
  id?: string;
  role: string;
  gender?: 'male' | 'female' | 'any';
  ageRange?: string;
  characterTone?: string;
  speechStyle?: string;
  attitude?: string;
  vocalDirection?: string;
}

export interface SituationConfig {
  enabled?: boolean;
  targetA?: string;
  targetB?: string;
  relationship?: string;
  description?: string;
  development?: string;
  developmentPreset?: string;
  developmentCustom?: string;
  version?: SituationVersion | string;
  versionLabel?: string;
  speakerAStyle?: string;
  speakerAAttitude?: string;
  speakerAExtra?: string;
  speakerBStyle?: string;
  speakerBAttitude?: string;
  speakerBExtra?: string;
  attitudeA?: string;
  attitudeB?: string;
  characterAGender?: 'male' | 'female' | number;
  characterAVocalRole?: 'auto' | 'main' | 'lead' | 'sub' | 'rapper';
  characterAAge?: number;
  characterAPoliteness?: number;
  characterAIntensity?: number;
  characterADelivery?: number;
  characterBGender?: 'male' | 'female' | number;
  characterBVocalRole?: 'auto' | 'main' | 'lead' | 'sub' | 'rapper';
  characterBAge?: number;
  characterBPoliteness?: number;
  characterBIntensity?: number;
  characterBDelivery?: number;
  storyDialogueBalance?: number;
  storyRealityScale?: number;
  storyPlayfulSincere?: number;
  detailPresets?: string[];
  detailCustom?: string;
  details?: string;
  speakers?: SituationSpeakerConfig[];
  summary?: string;
}

export interface TempoConfig {
  enabled: boolean;
  min: number;
  max: number;
}

export type CustomSectionType = 
  | 'Intro' | 'Verse 1' | 'Verse 2' | 'Pre-Chorus' | 'Chorus' | 'Hook' | 'Drop' 
  | 'Bridge' | 'Breakdown' | 'Instrumental' | 'Rap Verse' | 'Rap Section' | 'Final Chorus' | 'Final Hook' | 'Outro' | 'Refrain' | 'Interlude'
  | 'Theme A' | 'Theme B' | 'Build-up' | 'Main Theme' | 'Climax' | 'Break' | 'Stop';


export type CustomSectionKind = 'vocal' | 'rap' | 'instrumental' | 'transition' | 'build' | 'theme' | 'other';

export interface UserCustomSectionDefinition {
  id: string;
  /** English Suno-facing section label used inside lyrics tags, e.g. Whisper Rap. */
  label: string;
  /** User-facing Korean/custom display label, e.g. 속삭이는 랩. */
  labelKo?: string;
  /** Short cue used inside lyric tags, e.g. held-back muted rap. */
  tagCue?: string;
  /** Fuller internal prompt used as an interpretation helper, not always printed. */
  promptFull?: string;
  description?: string;
  kind: CustomSectionKind;
  defaultTags?: string[];
  allowVocal: boolean;
  isInstrumental: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserCustomSectionTagDefinition {
  id: string;
  /** Short English tag cue used in lyric tags. */
  label: string;
  labelKo?: string;
  /** Fuller internal prompt used as an interpretation helper, not always printed. */
  promptFull?: string;
  description?: string;
  section: string;
  tier?: TagTier;
  createdAt: number;
  updatedAt: number;
}

export interface CustomSectionItem {
  id: string;
  section: CustomSectionType | string;
  tags: string[];
  customId?: string;
}

export interface VocalSectionTagOption {
  tag: string;
  displayLabel: string;
  description: string;
}

export type GenreSubItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  vocal?: string;
};

export type GenreMainItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  vocal?: string;
  children: GenreSubItem[];
};

export type GenreGroupItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  children: GenreMainItem[];
};

export interface SectionTag {
  id: string;
  label: string;
  description: string;
  tier: TagTier;
  sections: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppliedKeywords {
  genre: string[];
  subGenre?: string[];
  subGenreIds?: string[];
  mood: string[];
  theme: string[];
  situation?: SituationConfig;
  situationSummary?: string;
  style?: string[];
  instrumentSound?: string[];
  pointSound?: string | string[];
  pointSounds?: string[];
  customGenreInput?: string;
  customMoodInput?: string;
  customThemeInput?: string;
  customStyleInput?: string;
  customSoundInput?: string;
  tempo?: string;
  tempoConfig?: TempoConfig | null;
  vocalType?: string;
  vocalTone?: string | null;
  lyricsLength?: LyricsLength;
  songStructure?: SongStructure;
  customStructure?: CustomSectionItem[];
  kpopMode?: 0 | 1 | 2;
  isKoreanEnglishMix?: boolean;
  citypopMode?: 0 | 1 | 2;
  vocal?: VocalConfig;
  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  drumStyle?: string;
  isBallad?: boolean;
  userInput?: string;
  lyricDraft?: string;
  isLyricMode?: boolean;
  lyricMode?: 'assist' | 'preserve';
  instrumentTags?: string[];
  isNoLyrics?: boolean;
  includeLyrics?: boolean;
  instrumentalBgmMode?: boolean;
  geminiUsedModel?: string;
  geminiFallbackUsed?: boolean;
  geminiFallbackFrom?: string | null;
  geminiFallbackReason?: string | null;
  geminiAttemptedModels?: string[];
}


export interface LyricClicheGuardSettings {
  hardBanTerms?: string[];
  softBanTerms?: string[];
  updatedAt?: any;
  updatedBy?: string | null;
}

export interface LyricClicheGuardRuntimeSettings {
  global?: LyricClicheGuardSettings | null;
  user?: LyricClicheGuardSettings | null;
}

export interface GenerateSongParams {
  genre: string;
  subGenre: string[];
  moods: string[];
  themes: string[];
  situation?: SituationConfig;
  styles: string[];
  instrumentSounds: string[];
  pointSounds?: string[];
  customGenreInput?: string;
  customMoodInput?: string;
  customThemeInput?: string;
  customStyleInput?: string;
  customSoundInput?: string;
  tempo: string;
  vocal: VocalConfig;
  userInput?: string;
  lyricDraft?: string;
  isLyricMode?: boolean;
  lyricMode?: 'assist' | 'preserve';
  songStructure?: SongStructure;
  customStructure?: CustomSectionItem[];
  lyricsLength?: LyricsLength;
  kpopMode?: 0 | 1 | 2;
  instrumentTags?: string[];
  isNoLyrics?: boolean;
  recentGeneratedTitles?: string[];
  recentGeneratedLyricSnippets?: string[];
  recentMoodThemeMemory?: string[];
  lyricClicheGuard?: LyricClicheGuardRuntimeSettings;
}

export interface SongResult {
  title: string;
  englishTitle?: string;
  koreanTitle?: string;
  lyrics: {
    english: string;
    korean: string;
  };
  prompt: string;
  appliedKeywords: AppliedKeywords;
  userInput?: string;
  situationSummary?: string;
  randomKeywords?: string[];
  geminiModelInfo?: {
    usedModel: string;
    fallbackUsed: boolean;
    fallbackFrom?: string | null;
    fallbackReason?: string | null;
    attemptedModels?: string[];
  };
}

export type UserRole = 'free' | 'basic' | 'pro' | 'admin';
export type AccountStatus = 'active' | 'paused' | 'expired' | 'banned';
export type PaymentStatus = 'none' | 'active' | 'canceled' | 'expired' | 'refunded' | 'trial';

export interface AppUserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  nickname?: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  paymentStatus: PaymentStatus;
  createdAt: number;
  lastLoginAt?: number;
  lastLogoutAt?: number;
  isOnline?: boolean;
  lastSeenAt?: number;
  forceLogoutAt?: number;
  
  // Subscription info
  planName?: string;
  planStartAt?: number;
  planExpireAt?: number;
  nextBillingAt?: number;
  lastPaymentAt?: number;
  
  // Usage info
  songGeneratedCount: number;
  favoriteCount: number;
  
  // Admin only
  adminMemo?: string;
  lyricClicheGuard?: LyricClicheGuardSettings | null;
}

// ==========================================
// Suno API Types
// ==========================================

export interface SunoAllowedPlans {
  free: boolean;
  basic: boolean;
  pro: boolean;
  admin: boolean;
}

export interface SunoAccessSettings {
  enabled: boolean;
  allowedPlans: SunoAllowedPlans;
  updatedAt?: number;
  updatedBy?: string;
}

export type SunoModelVersion = 'V5_5' | 'V5' | 'V4_5';

export interface SunoApiKeyStatus {
  hasSunoApiKey: boolean;
  provider: "sunoapi.org";
  createdAt?: number;
  updatedAt?: number;
}

export type SunoTrackStatus = "draft" | "generating" | "completed" | "failed";

export interface SunoTrack {
  id?: string;
  title: string;
  status: SunoTrackStatus;
  taskId?: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  lyrics?: string;
  style?: string;
  appliedKeywords?: any;
  model?: SunoModelVersion | string;
  sunoVersion?: SunoModelVersion | string;
  requestPayload?: any;
  source: "suno-api";
  isFavorite?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface SunoShareOptions {
  allowDownload: boolean;
  showKeywords: boolean;
  allowApplyToNext: boolean;
}

export interface SunoShare {
  id?: string;
  ownerUid: string;
  trackId: string;
  title: string;
  audioUrl?: string;
  imageUrl?: string;
  isPublic: boolean;
  shareOptions: SunoShareOptions;
  appliedKeywords?: any;
  model?: SunoModelVersion | string;
  sunoVersion?: SunoModelVersion | string;
  requestPayload?: any;
  createdAt?: number;
  updatedAt?: number;
}

// ==========================================
// Playlist Types
// ==========================================

export interface Playlist {
  id?: string;
  title: string;
  type: 'normal' | 'shared';
  order: number;
  isDefault: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface PlaylistItem {
  id?: string;
  sourceType: 'suno_track' | 'shared_track';
  sourceId: string;
  sourceSubTrackId?: string | null;
  sourceSubTrackIndex?: number | null;
  playlistUniqueKey?: string | null;
  ownerUid: string;
  creatorDisplayId: string | null;
  ownerNickname?: string | null;
  creatorNickname?: string | null;
  ownerEmail?: string | null;
  creatorEmail?: string | null;
  title: string;
  audioUrl: string | null;
  imageUrl: string | null;
  duration: number | null;
  genreLabels: string[];
  appliedKeywords: Record<string, any> | null;
  prompt?: string | null;
  style?: string | null;
  lyrics?: string | null;
  lyricsText?: string | null;
  koreanLyrics?: string | null;
  englishLyrics?: string | null;
  requestPayload?: Record<string, any> | null;
  colorTag: string | null;
  likeCount: number;
  order: number;
  addedAt?: any;
  updatedAt?: any;
  isUnavailable: boolean;
  unavailableReason: string | null;
}
