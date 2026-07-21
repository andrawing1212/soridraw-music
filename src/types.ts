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

export interface SectionCueOptions {
  vocal: boolean;
  instrument: boolean;
}

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
  | 'Intro' | 'Verse 1' | 'Verse 2' | 'Pre-Chorus' | 'Pre-Chorus 1' | 'Pre-Chorus 2' | 'Chorus' | 'Chorus 1' | 'Chorus 2' | 'Hook' | 'Hook 1' | 'Hook 2' | 'Drop' 
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
  sectionCueOptions?: SectionCueOptions;
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
  languageMixAudit?: {
    active?: boolean;
    requestedRatio?: number;
    targetLanguages?: string[];
    status?: 'inactive' | 'passed' | 'needs-review' | 'preserved';
    exactRepairAttempted?: boolean;
    exactRepairUsed?: boolean;
    exactRepairError?: string;
    cards?: Partial<Record<'korean' | 'secondary', {
      active?: boolean;
      card?: 'korean' | 'secondary';
      baseLanguage?: string;
      targetLanguages?: string[];
      requestedRatio?: number;
      lowerBound?: number;
      upperBound?: number;
      actualMixRatio?: number;
      actualBaseRatio?: number;
      totalLexicalUnits?: number;
      languageUnits?: Record<string, number>;
      languageRatios?: Record<string, number>;
      targetGoals?: Record<string, number>;
      targetLowerBounds?: Record<string, number>;
      targetUpperBounds?: Record<string, number>;
      targetSectionFamilyCount?: number;
      requiredSectionFamilyCount?: number;
      uniqueTargetExpressionCount?: number;
      requiredUniqueTargetExpressionCount?: number;
      placementMode?: 'accent' | 'hook-led' | 'distributed-blocks' | 'arc-balanced' | 'balanced-blocks' | 'target-led' | 'target-dominant' | 'near-total';
      alternatingSequenceCount?: number;
      maxAllowedAlternatingSequences?: number;
      mirroredTranslationPairCount?: number;
      maxAllowedMirroredPairs?: number;
      isolatedTargetLineCount?: number;
      targetBlockCount?: number;
      averageTargetBlockLength?: number;
      targetSectionCount?: number;
      requiredTargetSectionCount?: number;
      maxTargetSectionShare?: number;
      maxAllowedTargetSectionShare?: number;
      maxTargetSectionRatio?: number;
      overloadedTargetSectionCount?: number;
      duplicateTargetExpressionCount?: number;
      targetTimelineZoneCount?: number;
      requiredTimelineZoneCount?: number;
      maxTargetTimelineZoneShare?: number;
      maxAllowedTargetTimelineZoneShare?: number;
      maxTargetSectionCount?: number;
      earlyTargetPresent?: boolean;
      middleTargetPresent?: boolean;
      lateTargetPresent?: boolean;
      hookTargetPresent?: boolean;
      finalRecallPresent?: boolean;
      maxTargetOnlyRunLength?: number;
      maxHookTargetOnlyRunLength?: number;
      abruptTakeoverCount?: number;
      mixedLanguageLineCount?: number;
      maxAllowedTargetOnlyRunLength?: number;
      maxAllowedHookTargetOnlyRunLength?: number;
      sectionCoverageIsReference?: boolean;
      genreBlendProfile?: string;
      easySingActive?: boolean;
      languageArcPassed?: boolean;
      placementPassed?: boolean;
      repairApplied?: boolean;
      replacedLineCount?: number;
      status?: 'inactive' | 'passed' | 'needs-review' | 'preserved';
      reasons?: string[];
    }>>;
  };
  hookBlueprint?: {
    selected?: Array<{
      id: string;
      label: string;
      pattern?: string;
      dimension?: 'form' | 'placement' | 'repetition' | 'performance' | 'structure' | 'none';
    }>;
    dimensions?: Record<string, Array<{ id: string; label: string }>>;
    patterns?: string[];
    structureMode?: 'recommended' | 'stable' | 'experimental' | 'custom';
    structureProfile?: string;
    targetSections?: string[];
    targetSectionsText?: string;
    structureCondition?: string;
    dropCondition?: string;
    circularCondition?: string;
    vocalCondition?: string;
    placement?: string;
    repeatShape?: string;
    chorusMode?: 'fixed' | 'evolving';
    rhythmicCell?: string;
    performanceEvent?: string;
    warnings?: string[];
    korean?: {
      primaryHookLine?: string;
      microHook?: string;
      previewFragment?: string;
      variationHook?: string;
      callLine?: string;
      responseLine?: string;
      echoResponseLine?: string;
      postChorusTag?: string;
      chorusBLine?: string;
      chorus2ShiftLine?: string;
      finalShiftLine?: string;
      checks?: Record<string, boolean>;
      statuses?: Record<string, 'passed' | 'failed' | 'audio' | 'not-applicable' | 'incompatible' | 'target-missing'>;
      passed?: boolean;
    };
    secondary?: {
      primaryHookLine?: string;
      microHook?: string;
      previewFragment?: string;
      variationHook?: string;
      callLine?: string;
      responseLine?: string;
      echoResponseLine?: string;
      postChorusTag?: string;
      chorusBLine?: string;
      chorus2ShiftLine?: string;
      finalShiftLine?: string;
      checks?: Record<string, boolean>;
      statuses?: Record<string, 'passed' | 'failed' | 'audio' | 'not-applicable' | 'incompatible' | 'target-missing'>;
      passed?: boolean;
    };
  };
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
  sectionCueOptions?: SectionCueOptions;
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
