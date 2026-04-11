import { CustomSectionItem } from '../types';

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;

  genre: string[];
  subGenre?: string[];
  moods: string[];
  themes?: string[];
  styles?: string[];
  instrumentSounds?: string[];

  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  vocalToneId?: string;
  songStructure?: string;
  customStructure?: CustomSectionItem[];

  lyricMode?: 'assist' | 'preserve';

  sampleAudio?: string;   // Firebase Storage URL
  sampleVideo?: string;   // Firebase Storage URL
  youtubeUrl?: string;    // YouTube 홍보/외부 샘플 링크
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'kpop-fresh',
    title: '청량한 K-pop',
    description: '밝고 에너제틱한 멜로디와 청량한 신스 사운드가 특징인 아이돌 스타일',
    genre: ['kpop'],
    subGenre: ['idol_dance'],
    moods: ['upbeat', 'bright', 'cheerful'],
    themes: ['youth', 'love'],
    styles: ['k-style', 'global-pop-style'],
    instrumentSounds: ['bright-synth', 'crisp-hi-hats'],
    maleCount: 0,
    femaleCount: 5,
    rapEnabled: true,
    vocalToneId: 'female_sweet',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Bright Synth', 'Atmospheric'] },
      { id: '2', section: 'Verse 1', tags: ['Clean Guitar', 'Groovy Bass'] },
      { id: '3', section: 'Pre-Chorus', tags: ['Rising Energy', 'Snaps'] },
      { id: '4', section: 'Chorus', tags: ['Explosive', 'Catchy Hook', 'Full Band'] },
      { id: '5', section: 'Verse 2', tags: ['Rhythmic', 'Minimal'] },
      { id: '6', section: 'Pre-Chorus', tags: ['Rising Energy'] },
      { id: '7', section: 'Final Chorus', tags: ['Grand Finale', 'High Energy'] },
      { id: '8', section: 'Outro', tags: ['Fading Synth', 'Cheerful'] }
    ],
    lyricMode: 'assist',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  },
  {
    id: 'citypop-dreamy',
    title: '몽환 시티팝',
    description: '80년대 레트로 감성과 세련된 도시적 분위기가 어우러진 몽환적인 사운드',
    genre: ['pop'],
    subGenre: ['city_pop'],
    moods: ['dreamy', 'nostalgic', 'chill'],
    themes: ['night', 'loneliness'],
    styles: ['nu-disco-fusion', 'sophisticated'],
    instrumentSounds: ['smooth-bass', 'glassy-pad'],
    maleCount: 0,
    femaleCount: 1,
    rapEnabled: false,
    vocalToneId: 'female_airy',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Retro Synth', 'City Ambience'] },
      { id: '2', section: 'Verse 1', tags: ['Smooth Bass', 'Electric Piano'] },
      { id: '3', section: 'Chorus', tags: ['Dreamy', 'Lush Pads', 'Groovy'] },
      { id: '4', section: 'Verse 2', tags: ['Mellow', 'Funk Guitar'] },
      { id: '5', section: 'Bridge', tags: ['Atmospheric Solo', 'Nostalgic'] },
      { id: '6', section: 'Final Chorus', tags: ['Full Groove', 'Sparkling Synths'] },
      { id: '7', section: 'Outro', tags: ['Slow Fade', 'City Lights vibe'] }
    ],
    lyricMode: 'assist',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  },
  {
    id: 'ballad-emotional',
    title: '감성 발라드',
    description: '애절한 피아노와 웅장한 스트링이 돋보이는 정통 감성 발라드',
    genre: ['kpop'],
    subGenre: ['k_ballad'],
    moods: ['sad', 'emotional', 'melancholic'],
    themes: ['breakup', 'memory'],
    styles: ['ballad', 'classic-ballad'],
    instrumentSounds: ['acoustic', 'strings'],
    maleCount: 1,
    femaleCount: 0,
    rapEnabled: false,
    vocalToneId: 'male_husky',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Soft Piano', 'Melancholic'] },
      { id: '2', section: 'Verse 1', tags: ['Intimate', 'Minimal Piano'] },
      { id: '3', section: 'Pre-Chorus', tags: ['Subtle Strings', 'Emotional Build'] },
      { id: '4', section: 'Chorus', tags: ['Powerful', 'Full Strings', 'Heartbreaking'] },
      { id: '5', section: 'Verse 2', tags: ['Deepening Emotion', 'Cello'] },
      { id: '6', section: 'Bridge', tags: ['Climax', 'High Note', 'Orchestral'] },
      { id: '7', section: 'Final Chorus', tags: ['Grand Emotion', 'Fading out'] },
      { id: '8', section: 'Outro', tags: ['Lonely Piano', 'Silence'] }
    ],
    lyricMode: 'preserve',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  },
  {
    id: 'hiphop-dark',
    title: '어두운 힙합',
    description: '강렬한 808 베이스와 긴장감 넘치는 분위기의 다크 트랩 비트',
    genre: ['hiphop'],
    subGenre: ['trap'],
    moods: ['dark', 'tense', 'powerful'],
    themes: ['identity', 'resistance'],
    styles: ['hip-hop', 'heavy-lowend'],
    instrumentSounds: ['808-bass', 'fast-triplet-hi-hats'],
    maleCount: 1,
    femaleCount: 0,
    rapEnabled: true,
    vocalToneId: 'male_rap_aggressive',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Dark Pad', 'Tense Ambience'] },
      { id: '2', section: 'Verse 1', tags: ['Aggressive Flow', 'Hard 808'] },
      { id: '3', section: 'Hook', tags: ['Catchy', 'Dark Energy', 'Heavy Bass'] },
      { id: '4', section: 'Verse 2', tags: ['Fast Rap', 'Minimal Beat'] },
      { id: '5', section: 'Hook', tags: ['Powerful', 'Repetitive'] },
      { id: '6', section: 'Bridge/Break', tags: ['Eerie Silence', 'Filtered Drums'] },
      { id: '7', section: 'Final Hook', tags: ['Maximum Intensity', 'Distorted'] },
      { id: '8', section: 'Outro', tags: ['Fading 808', 'Darkness'] }
    ],
    lyricMode: 'assist',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  },
  {
    id: 'indie-folk-warm',
    title: '따뜻한 인디 포크',
    description: '어쿠스틱 기타와 소박한 감성이 묻어나는 편안한 포크 사운드',
    genre: ['acoustic_folk'],
    subGenre: ['acoustic_session'],
    moods: ['warm', 'peaceful', 'coziness'],
    themes: ['small_happiness', 'walk'],
    styles: ['classic-jazz', 'minimalist'],
    instrumentSounds: ['acoustic', 'warm-pad'],
    maleCount: 1,
    femaleCount: 1,
    rapEnabled: false,
    vocalToneId: 'male_folk_earnest',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Acoustic Guitar', 'Warm'] },
      { id: '2', section: 'Verse 1', tags: ['Storytelling', 'Soft Strumming'] },
      { id: '3', section: 'Chorus', tags: ['Harmonious', 'Gentle Percussion'] },
      { id: '4', section: 'Verse 2', tags: ['Intimate', 'Whistling'] },
      { id: '5', section: 'Chorus', tags: ['Fuller Sound', 'Warmth'] },
      { id: '6', section: 'Bridge', tags: ['Reflective', 'Solo Guitar'] },
      { id: '7', section: 'Final Chorus', tags: ['Uplifting', 'Peaceful'] },
      { id: '8', section: 'Outro', tags: ['Simple Chords', 'Fading'] }
    ],
    lyricMode: 'assist',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  },
  {
    id: 'ost-dramatic',
    title: '드라마틱 OST',
    description: '웅장한 스케일과 서사적인 전개가 돋보이는 영화/드라마 테마곡',
    genre: ['ost'],
    subGenre: ['orchestral_score'],
    moods: ['cinematic', 'hopeful', 'emotional'],
    themes: ['fate', 'growth'],
    styles: ['anime-style', 'classic-ballad'],
    instrumentSounds: ['full-orchestral-strings', 'piano'],
    maleCount: 0,
    femaleCount: 0,
    rapEnabled: false,
    vocalToneId: 'female_power_belter',
    songStructure: 'custom',
    customStructure: [
      { id: '1', section: 'Intro', tags: ['Grand Orchestra', 'Mysterious'] },
      { id: '2', section: 'Verse 1', tags: ['Narrative', 'Piano & Cello'] },
      { id: '3', section: 'Pre-Chorus', tags: ['Rising Tension', 'Percussion Build'] },
      { id: '4', section: 'Chorus', tags: ['Epic', 'Heroic', 'Full Strings'] },
      { id: '5', section: 'Verse 2', tags: ['Determined', 'Brass accents'] },
      { id: '6', section: 'Bridge', tags: ['Sudden Change', 'Emotional Peak', 'Choir'] },
      { id: '7', section: 'Final Chorus', tags: ['Maximum Scale', 'Triumphant'] },
      { id: '8', section: 'Outro', tags: ['Lingering Strings', 'Hopeful'] }
    ],
    lyricMode: 'assist',
    sampleAudio: '',
    sampleVideo: '',
    youtubeUrl: ''
  }
];
